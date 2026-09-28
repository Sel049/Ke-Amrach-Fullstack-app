import { pool } from '../config/database.js';
import { chapaService } from '../services/chapaService.js';
import { createOrderNotification } from './notificationController.js';

// Build a unique transaction reference used for both the payments row
// and the Chapa tx_ref (Chapa requires <= 50 chars).
const buildTxRef = () =>
  `CHAPA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ────────────────────────────────────────────────────────────
// initializeChapaPayment — creates order + pending payment row,
// then returns the Chapa checkout URL.
// ────────────────────────────────────────────────────────────
export const initializeChapaPayment = async (req, res) => {
  const { items, deliveryAddress, deliveryNotes, paymentMethod } = req.body || {};
  const buyerFirebaseUid = req.user?.uid;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required parameters: items array is required' });
  }

  // Consolidate duplicate items for the same listing (mirrors orderController)
  const consolidatedMap = new Map();
  for (const item of items) {
    const listingId = Number(item?.listingId);
    const qty = Number(item?.quantity);
    if (!listingId || !qty || qty <= 0) {
      return res.status(400).json({ error: 'Each item requires a valid listingId and quantity > 0' });
    }
    consolidatedMap.set(listingId, (consolidatedMap.get(listingId) || 0) + qty);
  }

  const txRef = buildTxRef();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Schema detection (same approach as orderController)
    const hasColumn = async (table, column) => {
      const [rows] = await connection.execute(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [table, column]
      );
      return rows.length > 0;
    };

    // Resolve buyer user_id from firebase_uid
    const [buyerRows] = await connection.execute(
      'SELECT id, email, full_name, phone FROM users WHERE firebase_uid = ?',
      [buyerFirebaseUid]
    );
    let buyerId;
    let buyerEmail = '';
    let buyerName = '';
    let buyerPhone = '';
    if (buyerRows.length === 0) {
      const [insRes] = await connection.execute(
        'INSERT INTO users (firebase_uid, role) VALUES (?, ?)',
        [buyerFirebaseUid, 'buyer']
      );
      buyerId = insRes.insertId;
      buyerEmail = req.user?.email || '';
    } else {
      buyerId = buyerRows[0].id;
      buyerEmail = buyerRows[0].email || req.user?.email || '';
      buyerName = buyerRows[0].full_name || '';
      buyerPhone = buyerRows[0].phone || '';
    }
const useNewListingsSchema = await hasColumn('produce_listings', 'farmer_user_id');
    const hasListingQuantityCol = await hasColumn('produce_listings', 'quantity');
    const listingSelectSql = useNewListingsSchema
      ? 'SELECT id, farmer_user_id as farmerId, crop as category, unit, title as name, price_per_unit as pricePerUnit, quantity as availableQuantity, region as location FROM produce_listings WHERE id = ? AND status = "active"'
      : 'SELECT id, farmer_id as farmerId, category as category, unit, name as name, price_per_kg as pricePerUnit, available_quantity as availableQuantity, location as location FROM produce_listings WHERE id = ? AND status = "active"';

    // Validate listings against consolidated quantities, compute totals
    const listings = [];
    let totalOrderValue = 0;
    let primaryFarmerId = null;

    for (const [listingId, requestedQuantity] of consolidatedMap.entries()) {
      const [listingRows] = await connection.execute(listingSelectSql, [listingId]);
      if (listingRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Listing ${listingId} not found or inactive` });
      }

      const listing = listingRows[0];
      if (Number(listing.availableQuantity) < Number(requestedQuantity)) {
        await connection.rollback();
        return res.status(400).json({ error: `Insufficient quantity available for listing ${listingId}` });
      }

      listings.push({ ...listing, requestedQuantity });
      totalOrderValue += Number(listing.pricePerUnit) * Number(requestedQuantity);
      if (!primaryFarmerId) primaryFarmerId = listing.farmerId;
    }

    // Create order (handle legacy/new orders schema)
    const useNewOrdersSchema = await hasColumn('orders', 'buyer_user_id');
    const hasSubtotalCol = await hasColumn('orders', 'subtotal');
    const hasTotalCol = await hasColumn('orders', 'total');
    const hasDeliveryAddressCol = await hasColumn('orders', 'delivery_address');
    const hasDeliveryNotesCol = await hasColumn('orders', 'delivery_notes');
    const hasPaymentMethodCol = await hasColumn('orders', 'payment_method');

    const buyerCol = useNewOrdersSchema ? 'buyer_user_id' : 'buyer_id';
    const farmerCol = useNewOrdersSchema ? 'farmer_user_id' : 'farmer_id';

    const cols = [buyerCol, farmerCol, 'status'];
    const placeholders = ['?', '?', `'pending'`];
    const params = [buyerId, primaryFarmerId];

    if (hasSubtotalCol) {
      cols.push('subtotal'); placeholders.push('?'); params.push(totalOrderValue);
    } else if (hasTotalCol) {
      cols.push('total'); placeholders.push('?'); params.push(totalOrderValue);
    }

    cols.push('currency'); placeholders.push(`'ETB'`);

    if (hasDeliveryAddressCol) {
      cols.push('delivery_address'); placeholders.push('?'); params.push(deliveryAddress || null);
    }
    if (hasDeliveryNotesCol) {
      cols.push('delivery_notes'); placeholders.push('?'); params.push(deliveryNotes || null);
    }
    if (hasPaymentMethodCol) {
      cols.push('payment_method'); placeholders.push('?'); params.push(paymentMethod || 'chapa');
    }

    cols.push('created_at'); placeholders.push('NOW()');

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    );
    const orderId = orderResult.insertId;

    // Insert order item snapshots
    for (const listing of listings) {
      await connection.execute(
        `INSERT INTO order_items (order_id, listing_id, crop, unit, price_per_unit, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, listing.id, listing.category || null, listing.unit || 'kg', listing.pricePerUnit || 0, listing.requestedQuantity]
      );
    }

    // Decrement stock (guard against zeroing out rows with CHECK constraints)
    for (const listing of listings) {
      const requested = Number(listing.requestedQuantity);
      const available = Number(listing.availableQuantity);

      if (requested === available) {
        await connection.execute('UPDATE produce_listings SET status = ? WHERE id = ?', ['sold_out', listing.id]);
        continue;
      }

      if (hasListingQuantityCol) {
        await connection.execute('UPDATE produce_listings SET quantity = quantity - ? WHERE id = ?', [requested, listing.id]);
      } else {
        await connection.execute('UPDATE produce_listings SET available_quantity = available_quantity - ? WHERE id = ?', [requested, listing.id]);
      }
    }

    // Create the pending payment row before contacting Chapa so the
    // transaction_id always exists for verify/webhook reconciliation.
    const [paymentResult] = await connection.execute(
      `INSERT INTO payments (user_id, order_id, amount, currency, payment_method, transaction_id, status)
       VALUES (?, ?, ?, 'ETB', ?, ?, 'pending')`,
      [buyerId, orderId, totalOrderValue, paymentMethod || 'chapa', txRef]
    );
    const paymentId = paymentResult.insertId;

    await connection.commit();

    // Contact Chapa outside the transaction (network call)
    let chapaResult;
    try {
      chapaResult = await chapaService.initializeTransaction({
        amount: totalOrderValue,
        currency: 'ETB',
        email: buyerEmail,
        firstName: (buyerName || 'Ke-Amrach').split(' ')[0],
        lastName: (buyerName || '').split(' ').slice(1).join(' '),
        phone: buyerPhone,
        txRef,
        callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payments/verify?tx_ref=${txRef}&order_id=${orderId}`,
        returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payments/verify?tx_ref=${txRef}&order_id=${orderId}`,
      });
    } catch (chapaError) {
      await pool.query(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [paymentId]);
      await pool.query(`UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [orderId]);
      throw chapaError;
    }

    // Persist the checkout URL returned by Chapa
    if (chapaResult?.checkoutUrl) {
      await pool.query(`UPDATE payments SET payment_url = ? WHERE id = ?`, [chapaResult.checkoutUrl, paymentId]);
    }

    try { await createOrderNotification(orderId, 'order_created', primaryFarmerId); } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Payment initialized successfully',
      checkoutUrl: chapaResult.checkoutUrl,
      txRef,
      orderId,
      paymentId,
      amount: totalOrderValue,
      currency: 'ETB',
      sandbox: chapaResult.sandbox || false,
    });
  } catch (error) {
    console.error('Error initializing Chapa payment:', error);
    try { await connection.rollback(); } catch (_) {}
    res.status(500).json({ error: 'Failed to initialize Chapa payment', details: error.message });
  } finally {
    try { connection.release(); } catch (_) {}
  }
};
// ────────────────────────────────────────────────────────────
// verifyChapaPayment — verifies a Chapa transaction and, when
// successful, confirms the payment + order.
// Called from the client after Chapa redirects back.
// ────────────────────────────────────────────────────────────
export const verifyChapaPayment = async (req, res) => {
  const txRef = req.params.txRef || req.query.tx_ref;
  const orderIdFromQuery = req.query.order_id;

  if (!txRef) {
    return res.status(400).json({ success: false, error: 'tx_ref is required' });
  }

  try {
    // The payment row is the source of truth (tx_ref lives in transaction_id)
    const [paymentRows] = await pool.query(
      `SELECT id, user_id, order_id, amount, currency, status, transaction_id, chapa_reference
       FROM payments WHERE transaction_id = ? LIMIT 1`,
      [txRef]
    );

    if (paymentRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found for this reference' });
    }

    const payment = paymentRows[0];

    // Ownership check — only the payer (or an admin) may verify
    if (req.user?.role !== 'admin') {
      const [ownerRows] = await pool.query('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1', [req.user?.uid]);
      if (ownerRows.length === 0 || ownerRows[0].id !== payment.user_id) {
        return res.status(403).json({ success: false, error: 'Access denied for this payment' });
      }
    }

    // Already settled — return the current state (idempotent)
    if (payment.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        alreadyVerified: true,
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: Number(payment.amount),
        currency: payment.currency,
        chapaReference: payment.chapa_reference,
        sandbox: chapaService.isSandboxMode,
      });
    }

    const verification = await chapaService.verifyTransaction(txRef);
    if (!verification.success) {
      await pool.query(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [payment.id]);
      return res.status(400).json({ success: false, message: 'Payment verification failed', status: 'failed' });
    }

    const orderId = payment.order_id || orderIdFromQuery || null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE payments SET status = 'completed', chapa_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [verification.chapaReference || null, payment.id]
      );
      if (orderId) {
        await connection.execute(
          `UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [orderId]
        );
      }
      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    // Notify the farmer that the paid order is confirmed
    if (orderId) {
      try {
        const [orderRows] = await pool.query('SELECT farmer_user_id FROM orders WHERE id = ? LIMIT 1', [orderId]);
        await createOrderNotification(orderId, 'order_confirmed', orderRows[0]?.farmer_user_id);
      } catch (_) {}
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      txRef,
      orderId,
      payment: {
        txRef,
        amount: Number(verification.amount || payment.amount),
        currency: verification.currency || payment.currency,
        status: 'completed',
        chapaReference: verification.chapaReference || null,
      },
      sandbox: verification.sandbox || false,
    });
  } catch (error) {
    console.error('Error verifying Chapa payment:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify payment', details: error.message });
  }
};

// ────────────────────────────────────────────────────────────
// handleChapaWebhook — public webhook endpoint called by Chapa.
// Acknowledges the event (HTTP 200) so Chapa does not retry
// indefinitely; state is reconciled by verifyChapaPayment too.
// ────────────────────────────────────────────────────────────
export const handleChapaWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const data = payload.data || payload;
    const txRef = data.tx_ref || data.trx_ref;
    const chapaReference = data.reference || data.chapa_reference || null;
    const status = data.status;

    if (!txRef) {
      return res.status(400).json({ success: false, error: 'Missing tx_ref in webhook payload' });
    }

    const [paymentRows] = await pool.query(
      `SELECT id, order_id, status FROM payments WHERE transaction_id = ? LIMIT 1`,
      [txRef]
    );

    if (paymentRows.length === 0) {
      // Unknown reference — acknowledge to stop retries
      return res.json({ success: true, received: true, ignored: true });
    }

    const payment = paymentRows[0];

    if (status === 'success' || status === 'completed') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `UPDATE payments SET status = 'completed', chapa_reference = COALESCE(?, chapa_reference), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [chapaReference, payment.id]
        );
        if (payment.order_id) {
          await connection.execute(
            `UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [payment.order_id]
          );
        }
        await connection.commit();
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      } finally {
        connection.release();
      }
    } else if (status === 'failed' || status === 'cancelled') {
      await pool.query(
        `UPDATE payments SET status = ?, chapa_reference = COALESCE(?, chapa_reference), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status === 'cancelled' ? 'cancelled' : 'failed', chapaReference, payment.id]
      );
    }

    return res.json({ success: true, received: true });
  } catch (error) {
    console.error('Error handling Chapa webhook:', error);
    // Acknowledge to avoid infinite retries; verify reconciles state
    return res.json({ success: false, received: true, error: 'Webhook processing failed' });
  }
};