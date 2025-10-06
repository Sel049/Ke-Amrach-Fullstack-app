import { pool } from '../config/database.js';
import { createOrderNotification } from './notificationController.js';

// Create new order (buyer places order)
export const createOrder = async (req, res) => {
  try {
    const { items, totalPrice, deliveryAddress, deliveryNotes, paymentMethod, paymentData } = req.body;
    const buyerFirebaseUid = req.user.uid; // From auth middleware

    // Validate required parameters
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required parameters: items array is required' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.listingId || !item.quantity) {
        return res.status(400).json({ error: 'Missing required parameters: listingId and quantity are required for each item' });
      }
      if (Number(item.quantity) <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than 0 for each item' });
      }
    }

    // Consolidate duplicate items for the same listing to prevent over-deduction
    const consolidatedMap = new Map();
    for (const item of items) {
      const listingId = Number(item.listingId);
      const qty = Number(item.quantity);
      consolidatedMap.set(listingId, (consolidatedMap.get(listingId) || 0) + qty);
    }

    const connection = await pool.getConnection();

    // Start transaction
    await connection.beginTransaction();

    try {
      // Small utility to detect schema at runtime
      const hasColumn = async (table, column) => {
        const [rows] = await connection.execute(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
          [table, column]
        );
        return rows.length > 0;
      };

      // Resolve buyer user_id from firebase_uid
      const [buyerRows] = await connection.execute(
        'SELECT id FROM users WHERE firebase_uid = ?',
        [buyerFirebaseUid]
      );
      let buyerId;
      if (buyerRows.length === 0) {
        const insRes = await connection.execute('INSERT INTO users (firebase_uid, role) VALUES (?, ?)', [buyerFirebaseUid, 'buyer']);
        buyerId = insRes[0].insertId;
      } else {
        buyerId = buyerRows[0].id;
      }

      // Get all listing details and check availability (adapt to schema)
      const useNewListingsSchema = await hasColumn('produce_listings', 'farmer_user_id');
      const listingSelectSql = useNewListingsSchema
        ? 'SELECT id, farmer_user_id as farmerId, crop as category, unit, title as name, price_per_unit as pricePerUnit, quantity as availableQuantity, region as location FROM produce_listings WHERE id = ? AND status = "active"'
        : 'SELECT id, farmer_id as farmerId, category as category, unit, name as name, price_per_kg as pricePerUnit, available_quantity as availableQuantity, location as location FROM produce_listings WHERE id = ? AND status = "active"';

      const listings = [];
      let totalOrderValue = 0;
      let primaryFarmerId = null;

      // Validate all listings (using consolidated quantities) and calculate totals
      for (const [listingId, totalRequested] of consolidatedMap.entries()) {
      const [listingRows] = await connection.execute(listingSelectSql, [listingId]);

      if (listingRows.length === 0) {
        await connection.rollback();
        connection.release();
          return res.status(404).json({ error: `Listing ${item.listingId} not found or inactive` });
      }

      const listing = listingRows[0];

        if (Number(listing.availableQuantity) < Number(totalRequested)) {
        await connection.rollback();
        connection.release();
          return res.status(400).json({ error: `Insufficient quantity available for listing ${listingId}` });
      }

        // Calculate line total
      const pricePerUnit = Number(listing.pricePerUnit) || 0;
        const quantityNum = Number(totalRequested) || 0;
      const lineTotal = pricePerUnit * quantityNum;
        
        listings.push({
          ...listing,
          requestedQuantity: quantityNum,
          lineTotal
        });

        totalOrderValue += lineTotal;
        
        // Set primary farmer (first one, or could be logic to group by farmer)
        if (!primaryFarmerId) {
          primaryFarmerId = listing.farmerId;
        }
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

      // Build dynamic insert
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
        cols.push('payment_method'); placeholders.push('?'); params.push(paymentMethod || 'cash_on_delivery');
      }
      
      cols.push('created_at'); placeholders.push('NOW()');

      const insertOrderSql = `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [orderResult] = await connection.execute(insertOrderSql, params);

      const orderId = orderResult.insertId;

      // Insert order items (snapshot) for each item
          for (const listing of listings) {
      await connection.execute(
        `INSERT INTO order_items (
          order_id,
          listing_id,
          crop,
          unit,
          price_per_unit,
          quantity
        ) VALUES (?, ?, ?, ?, ?, ?)`,
              [orderId, listing.id, listing.category || null, listing.unit || 'kg', listing.pricePerUnit || 0, listing.requestedQuantity]
      );
          }

      // Update listing availability (handle both schemas) for each listing
      const hasQuantityCol = await hasColumn('produce_listings', 'quantity');
          for (const listing of listings) {
            const requested = Number(listing.requestedQuantity);
            const available = Number(listing.availableQuantity);

            // If this purchase would zero out stock, avoid setting it to 0 to satisfy DB check constraints.
            if (requested === available) {
              await connection.execute('UPDATE produce_listings SET status = ? WHERE id = ?', ['sold_out', listing.id]);
              continue;
            }

      if (hasQuantityCol) {
              await connection.execute('UPDATE produce_listings SET quantity = quantity - ? WHERE id = ?', [requested, listing.id]);
      } else {
              await connection.execute('UPDATE produce_listings SET available_quantity = available_quantity - ? WHERE id = ?', [requested, listing.id]);
            }
      }

      // Update listing status if quantity becomes 0 for each listing
      for (const listing of listings) {
        const remaining = listing.availableQuantity - Number(listing.requestedQuantity);
      if (remaining === 0) {
          await connection.execute('UPDATE produce_listings SET status = "sold_out" WHERE id = ?', [listing.id]);
        }
      }

      // Commit transaction
      await connection.commit();

      // Get the created order with details
      const [orderRows] = await connection.execute(
        `SELECT
          o.id,
          o.status,
          o.subtotal as totalPrice,
          o.notes,
          o.created_at as createdAt,
          oi.quantity,
          pl.title as name,
          li.url as image,
          pl.price_per_unit as pricePerKg,
          u.full_name as farmerName,
          pl.region as location
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN produce_listings pl ON oi.listing_id = pl.id
        LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
        JOIN users u ON pl.farmer_user_id = u.id
        WHERE o.id = ?
        LIMIT 1`,
        [orderId]
      );

      connection.release();

      // Notify farmer about new order
      try {
        await createOrderNotification(orderId, 'order_created', primaryFarmerId);
      } catch (_) {}

      res.status(201).json({
        message: 'Order created successfully',
        order: orderRows[0],
        totalItems: items.length,
        totalValue: totalOrderValue
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// Get buyer's orders
export const getBuyerOrders = async (req, res) => {
  try {
    const buyerFirebaseUid = req.user.uid;
    const { status, limit = 20, offset = 0 } = req.query;

    const connection = await pool.getConnection();

    // Resolve buyer id
    const [buyerRows] = await pool.query('SELECT id FROM users WHERE firebase_uid = ?', [buyerFirebaseUid]);
    if (buyerRows.length === 0) return res.json([]);
    const buyerId = buyerRows[0].id;

    // Detect schema variants
    const hasBuyerUserId = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id' LIMIT 1`))[0].length > 0;
    const hasSubtotal = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'subtotal' LIMIT 1`))[0].length > 0;
    const listingsNewSchema = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'farmer_user_id' LIMIT 1`))[0].length > 0;

    const buyerCol = hasBuyerUserId ? 'buyer_user_id' : 'buyer_id';
    const totalExpr = hasSubtotal ? 'o.subtotal' : 'o.total';
    const listingName = listingsNewSchema ? 'pl.title' : 'pl.name';
    const listingPrice = listingsNewSchema ? 'pl.price_per_unit' : 'pl.price_per_kg';
    const listingRegion = listingsNewSchema ? 'pl.region' : 'pl.location';
    const joinFarmerUser = listingsNewSchema ? 'pl.farmer_user_id' : 'pl.farmer_id';

    let whereClause = `WHERE o.${buyerCol} = ?`;
    const params = [buyerId];

    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    const limitInt = Number(limit) || 20;
    const offsetInt = Number(offset) || 0;

    const query = `
      SELECT
        o.id,
        ${totalExpr} as totalPrice,
        o.status,
        o.notes,
        o.created_at as createdAt,
        o.updated_at as updatedAt,
        oi.quantity,
        oi.listing_id as listingId,
        ${listingName} as name,
        li.url as image,
        ${listingPrice} as pricePerKg,
        u.full_name as farmerName,
        ua.url as farmerAvatar,
        ${listingRegion} as location,
        u.phone as farmerPhone,
        u.email as farmerEmail
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN produce_listings pl ON oi.listing_id = pl.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
      JOIN users u ON ${joinFarmerUser} = u.id
      LEFT JOIN user_avatars ua ON u.id = ua.user_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const [rows] = await connection.execute(query, params);
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Get specific order by ID
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userFirebaseUid = req.user.uid;

    const connection = await pool.getConnection();

    // Detect schema variants for orders and listings
    const [[hasBuyerUserIdRow]] = await connection.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id'`
    );
    const [[hasDeliveryNotesRow]] = await connection.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_notes'`
    );
    const [[hasDeliveryAddressRow]] = await connection.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_address'`
    );
    const [[hasPaymentMethodRow]] = await connection.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_method'`
    );

    const [[listingsNewSchemaRow]] = await connection.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'farmer_user_id'`
    );

    const hasBuyerUserId = Number(hasBuyerUserIdRow?.c || 0) > 0;
    const hasDeliveryNotes = Number(hasDeliveryNotesRow?.c || 0) > 0;
    const hasDeliveryAddress = Number(hasDeliveryAddressRow?.c || 0) > 0;
    const hasPaymentMethod = Number(hasPaymentMethodRow?.c || 0) > 0;
    const listingsNewSchema = Number(listingsNewSchemaRow?.c || 0) > 0;

    const buyerCol = hasBuyerUserId ? 'buyer_user_id' : 'buyer_id';
    const listingTitle = listingsNewSchema ? 'pl.title' : 'pl.name';
    const listingPrice = listingsNewSchema ? 'pl.price_per_unit' : 'pl.price_per_kg';
    const listingRegion = listingsNewSchema ? 'pl.region' : 'pl.location';
    const listingFarmerCol = listingsNewSchema ? 'pl.farmer_user_id' : 'pl.farmer_id';

    const deliveryAddressSel = hasDeliveryAddress ? 'o.delivery_address' : 'NULL AS delivery_address';
    const deliveryNotesSel = hasDeliveryNotes ? 'o.delivery_notes' : 'o.notes AS delivery_notes';
    const paymentMethodSel = hasPaymentMethod ? 'o.payment_method' : 'NULL AS payment_method';

    // Authorize: buyer or farmer involved in the order
    const authQuery = `
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN produce_listings pl ON oi.listing_id = pl.id
      WHERE o.id = ? AND (o.${buyerCol} = (SELECT id FROM users WHERE firebase_uid = ?) OR ${listingFarmerCol} = (SELECT id FROM users WHERE firebase_uid = ?))
      LIMIT 1
    `;
    const [authRows] = await connection.execute(authQuery, [id, userFirebaseUid, userFirebaseUid]);
    if (authRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    // Base order
    const [orderRows] = await connection.execute(
      `SELECT o.id, o.status, o.created_at AS createdAt, o.updated_at AS updatedAt,
              COALESCE(o.subtotal, o.total) AS totalPrice,
              ${paymentMethodSel}, ${deliveryAddressSel}, ${deliveryNotesSel}
       FROM orders o WHERE o.id = ? LIMIT 1`,
      [id]
    );

    // Single representative listing for header (farmer info)
    const [headerRows] = await connection.execute(
      `SELECT ${listingTitle} AS name, ${listingRegion} AS location, ${listingPrice} AS pricePerKg,
              u.full_name AS farmerName, ua.url AS farmerAvatar, u.phone AS farmerPhone, u.email AS farmerEmail,
              li.url AS image
       FROM order_items oi
       JOIN produce_listings pl ON oi.listing_id = pl.id
       JOIN users u ON ${listingFarmerCol} = u.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
       LEFT JOIN user_avatars ua ON u.id = ua.user_id
       WHERE oi.order_id = ?
       LIMIT 1`,
      [id]
    );

    // Items array
    const [items] = await connection.execute(
      `SELECT oi.id, oi.listing_id, oi.quantity, ${listingTitle} AS name, ${listingPrice} AS price_per_unit, NULL AS image
       FROM order_items oi
       JOIN produce_listings pl ON oi.listing_id = pl.id
       WHERE oi.order_id = ?`,
      [id]
    );

    connection.release();

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const base = orderRows[0];
    const header = headerRows[0] || {};

    res.json({
      id: base.id,
      status: base.status,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      totalPrice: Number(base.totalPrice || 0),
      payment_method: base.payment_method || null,
      delivery_address: base.delivery_address || null,
      delivery_notes: base.delivery_notes || null,
      ...header,
      items
    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// Admin: Get detailed order by ID (read-only)
export const getAdminOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;
    const [me] = await pool.query('SELECT role FROM users WHERE firebase_uid = ? LIMIT 1', [uid]);
    if (me.length === 0) return res.status(404).json({ error: 'User not found' });
    if (me[0].role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin role required.' });

    // Detect optional columns
    const detectCol = async (table, col) => {
      const [[r]] = await pool.query(
        `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
      );
      return Number(r?.c || 0) > 0;
    };

    const hasCurrency = await detectCol('orders', 'currency');
    const hasPaymentMethod = await detectCol('orders', 'payment_method');
    const hasDeliveryAddress = await detectCol('orders', 'delivery_address');
    const hasDeliveryNotes = await detectCol('orders', 'delivery_notes');

    const currencySel = hasCurrency ? 'o.currency' : "NULL AS currency";
    const paymentSel = hasPaymentMethod ? 'o.payment_method' : "NULL AS payment_method";
    const addrSel = hasDeliveryAddress ? 'o.delivery_address' : "NULL AS delivery_address";
    const notesSel = hasDeliveryNotes ? 'o.delivery_notes' : "NULL AS delivery_notes";

    // Base order
    const [orderRows] = await pool.query(
      `SELECT o.id, o.status, o.created_at, o.updated_at,
              COALESCE(o.subtotal, o.total) AS total,
              ${currencySel}, ${paymentSel}, ${addrSel}, ${notesSel}
       FROM orders o WHERE o.id = ? LIMIT 1`, [id]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });

    // Buyer and farmer names/emails with schema detection
    const hasBuyerUserId = await detectCol('orders', 'buyer_user_id');
    const hasBuyerId = await detectCol('orders', 'buyer_id');
    const hasFarmerUserId = await detectCol('orders', 'farmer_user_id');
    const hasFarmerId = await detectCol('orders', 'farmer_id');

    const buyerIdExpr = hasBuyerUserId ? 'o.buyer_user_id' : (hasBuyerId ? 'o.buyer_id' : null);
    const farmerIdExpr = hasFarmerUserId ? 'o.farmer_user_id' : (hasFarmerId ? 'o.farmer_id' : null);

    let buyer = null;
    if (buyerIdExpr) {
      const [bRows] = await pool.query(
        `SELECT u.full_name AS name, u.email FROM users u
         WHERE u.id = (SELECT ${buyerIdExpr} FROM orders o WHERE o.id = ?)
         LIMIT 1`, [id]
      );
      buyer = bRows[0] || null;
    }

    let farmer = null;
    if (farmerIdExpr) {
      const [fRows] = await pool.query(
        `SELECT u.full_name AS name, u.email FROM users u
         WHERE u.id = (SELECT ${farmerIdExpr} FROM orders o WHERE o.id = ?)
         LIMIT 1`, [id]
      );
      farmer = fRows[0] || null;
    }

    // Items
    const [items] = await pool.query(
      `SELECT oi.listing_id, oi.quantity, pl.title AS name, pl.unit,
              pl.price_per_unit AS price_per_unit
       FROM order_items oi
       JOIN produce_listings pl ON pl.id = oi.listing_id
       WHERE oi.order_id = ?`, [id]
    );

    res.json({
      id: orderRows[0].id,
      status: orderRows[0].status,
      created_at: orderRows[0].created_at,
      updated_at: orderRows[0].updated_at,
      total: Number(orderRows[0].total || 0),
      currency: orderRows[0].currency || 'ETB',
      payment_method: orderRows[0].payment_method || null,
      delivery_address: orderRows[0].delivery_address || null,
      delivery_notes: orderRows[0].delivery_notes || null,
      buyer: buyer || null,
      farmer: farmer || null,
      items
    });
  } catch (error) {
    console.error('Error fetching admin order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
};

// Update order status (farmer updates)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: requestedStatus } = req.body;
    const requesterUserId = req.user.id;

    const connection = await pool.getConnection();

    // Detect schema variants
    const hasFarmerUserId = (await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_user_id' LIMIT 1`))[0].length > 0;
    const hasBuyerUserId = (await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id' LIMIT 1`))[0].length > 0;

    const farmerCol = hasFarmerUserId ? 'farmer_user_id' : 'farmer_id';
    const buyerCol = hasBuyerUserId ? 'buyer_user_id' : 'buyer_id';

    // Load current order and verify farmer ownership
    const [orderRows] = await connection.execute(
      `SELECT id, status, ${farmerCol} as farmerId, ${buyerCol} as buyerId FROM orders WHERE id = ?`,
      [id]
    );

    if (orderRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];
    if (order.farmerId !== requesterUserId) {
      connection.release();
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }

    const currentStatus = order.status;

    // Allowed transitions for farmer
    const allowedTransitions = {
      pending: new Set(['confirmed', 'cancelled']),
      confirmed: new Set(['shipped', 'cancelled']),
      shipped: new Set(['completed'])
    };

    if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].has(requestedStatus)) {
      connection.release();
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${requestedStatus}` });
    }

    await connection.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [requestedStatus, id]
    );

    connection.release();
    res.json({ message: 'Order status updated successfully' });

    // Notify buyer (best-effort)
    try {
        const statusToType = {
          confirmed: 'order_confirmed',
          shipped: 'order_shipped',
          completed: 'order_completed',
          cancelled: 'order_cancelled'
        };
      const notifType = statusToType[requestedStatus];
        if (notifType) {
        await createOrderNotification(Number(id), notifType, order.buyerId);
      }
    } catch (_) {}
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Cancel order (buyer can cancel pending orders)
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterUserId = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // Detect schema variants
      const hasFarmerUserId = (await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_user_id' LIMIT 1`))[0].length > 0;
      const hasBuyerUserId = (await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id' LIMIT 1`))[0].length > 0;
      const hasListingQty = (await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'quantity' LIMIT 1`))[0].length > 0;

      const farmerCol = hasFarmerUserId ? 'farmer_user_id' : 'farmer_id';
      const buyerCol = hasBuyerUserId ? 'buyer_user_id' : 'buyer_id';
      const qtyCol = hasListingQty ? 'quantity' : 'available_quantity';

      // Load order to verify permissions and status
      const [orderRows] = await connection.execute(
        `SELECT id, status, ${farmerCol} as farmerId, ${buyerCol} as buyerId FROM orders WHERE id = ?`,
        [id]
      );
      if (orderRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderRows[0];
      if (order.status !== 'pending') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      }

      // Allow cancellation by buyer or farmer (decline)
      if (order.buyerId !== requesterUserId && order.farmerId !== requesterUserId) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: 'Not authorized to cancel this order' });
      }

      // Restore quantities for all order items
      const [items] = await connection.execute(
        'SELECT listing_id as listingId, quantity FROM order_items WHERE order_id = ?',
        [id]
      );
      for (const item of items) {
        await connection.execute(
          `UPDATE produce_listings SET ${qtyCol} = ${qtyCol} + ? WHERE id = ?`,
          [item.quantity, item.listingId]
        );
        // If listing was sold_out and now has stock, set to active
      await connection.execute(
          `UPDATE produce_listings SET status = 'active' WHERE id = ? AND status = 'sold_out' AND ${qtyCol} > 0`,
          [item.listingId]
      );
      }

      // Set order to cancelled
      await connection.execute(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [id]
      );

      await connection.commit();
      connection.release();

      res.json({ message: 'Order cancelled successfully' });

      // Notify relevant party (best-effort)
      try {
        // If farmer declined/cancelled, notify the buyer; if buyer cancelled, notify the farmer
        const notifyUserId = (order.farmerId === requesterUserId) ? order.buyerId : order.farmerId;
        await createOrderNotification(Number(id), 'order_cancelled', notifyUserId);
      } catch (_) {}

    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// Get farmer's orders
export const getFarmerOrders = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { status, page = 1, limit = 20 } = req.query;

    // Get user ID
    let userId;

    if (uid.startsWith('dev-uid-')) {
      // Dev user - use the ID from the token
      userId = req.user.id;
    } else {
      // Real Firebase user - look up in database
      const [userRows] = await pool.query(
        "SELECT id FROM users WHERE firebase_uid = ?",
        [uid]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      userId = userRows[0].id;
    }

    // Check which farmer column exists
    const hasFarmerUserId = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_user_id' LIMIT 1`))[0].length > 0;
    const hasBuyerUserId = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id' LIMIT 1`))[0].length > 0;

    const farmerCol = hasFarmerUserId ? 'farmer_user_id' : 'farmer_id';
    const buyerCol = hasBuyerUserId ? 'buyer_user_id' : 'buyer_id';

    let whereClause = `WHERE o.${farmerCol} = ?`;
    let params = [userId];

    if (status) {
      whereClause += " AND o.status = ?";
      params.push(status);
    }

    const offset = (page - 1) * limit;

    // Get orders with buyer info
    const [orders] = await pool.query(
      `SELECT
        o.*,
        u.full_name as buyer_name,
        u.phone as buyer_phone,
        u.region as buyer_region,
        u.woreda as buyer_woreda,
        bp.company_name,
        bp.business_type
      FROM orders o
      JOIN users u ON o.${buyerCol} = u.id
      LEFT JOIN buyer_profiles bp ON u.id = bp.user_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Determine listing schema for farmer join and pricing
    const listingsNewSchema = (await pool.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'farmer_user_id' LIMIT 1`))[0].length > 0;
    const listingFarmerCol = listingsNewSchema ? 'pl.farmer_user_id' : 'pl.farmer_id';
    const listingTitleCol = listingsNewSchema ? 'pl.title' : 'pl.name';
    const listingPriceCol = listingsNewSchema ? 'pl.price_per_unit' : 'pl.price_per_kg';

    // Get order items for each order, filtered to this farmer's listings only
    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT
          oi.id,
          oi.order_id,
          oi.listing_id,
          oi.quantity,
          ${listingTitleCol} as listing_title,
          ${listingPriceCol} as price_per_unit,
          NULL as image_url
        FROM order_items oi
        JOIN produce_listings pl ON oi.listing_id = pl.id
        WHERE oi.order_id = ? AND ${listingFarmerCol} = ?`,
        [order.id, userId]
      );

      order.items = items;

      // Recompute per-farmer subtotal and expose as total for farmer view
      const perFarmerSubtotal = items.reduce((sum, it) => sum + Number(it.price_per_unit || 0) * Number(it.quantity || 0), 0);
      // Preserve original total in case the client needs it
      if (order.subtotal !== undefined) order.original_subtotal = order.subtotal;
      if (order.total !== undefined) order.original_total = order.total;
      order.subtotal = perFarmerSubtotal;
      order.total = perFarmerSubtotal;
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching farmer orders:', error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get order statistics
export const getOrderStats = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { period = 'month' } = req.query;

    // Get user ID and role
    let userId, userRole;

    if (uid.startsWith('dev-uid-')) {
      // Dev user - use the ID and role from the token
      userId = req.user.id;
      userRole = req.user.role;
    } else {
      // Real Firebase user - look up in database
      const [userRows] = await pool.query(
        "SELECT id, role FROM users WHERE firebase_uid = ?",
        [uid]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      userId = userRows[0].id;
      userRole = userRows[0].role;
    }

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } else if (period === 'month') {
      dateFilter = "AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
    } else if (period === 'year') {
      dateFilter = "AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
    }

    let statsQuery = '';
    if (userRole === 'buyer') {
      statsQuery = `
        SELECT
          COUNT(*) as total_orders,
          SUM(o.total) as total_spent,
          COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders
        FROM orders o
        WHERE o.buyer_id = ? ${dateFilter}
      `;
    } else {
      statsQuery = `
        SELECT
          COUNT(*) as total_orders,
          SUM(o.total) as total_earnings,
          COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders
        FROM orders o
        WHERE o.farmer_id = ? ${dateFilter}
      `;
    }

    const [stats] = await pool.query(statsQuery, [userId]);

    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ error: "Failed to fetch order statistics" });
  }
};

// Admin: Get all orders with optional filters and pagination
export const getAllOrders = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { status, search, startDate, endDate, limit = 50, offset = 0 } = req.query;

    // Enforce role-based access
    const [userRows] = await pool.query(
      'SELECT id, role FROM users WHERE firebase_uid = ?',
      [uid]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Detect schema variants to avoid referencing non-existent columns
    const [[hasBuyerUserIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id'`
    );
    const [[hasBuyerIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_id'`
    );
    const [[hasFarmerUserIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_user_id'`
    );
    const [[hasFarmerIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_id'`
    );
    const hasBuyerUserId = Number(hasBuyerUserIdRow?.c || 0) > 0;
    const hasBuyerId = Number(hasBuyerIdRow?.c || 0) > 0;
    const hasFarmerUserId = Number(hasFarmerUserIdRow?.c || 0) > 0;
    const hasFarmerId = Number(hasFarmerIdRow?.c || 0) > 0;

    const buyerJoin = hasBuyerUserId
      ? 'LEFT JOIN users buyer ON buyer.id = o.buyer_user_id'
      : (hasBuyerId ? 'LEFT JOIN users buyer ON buyer.id = o.buyer_id' : '');
    const farmerJoin = hasFarmerUserId
      ? 'LEFT JOIN users farmer ON farmer.id = o.farmer_user_id'
      : (hasFarmerId ? 'LEFT JOIN users farmer ON farmer.id = o.farmer_id' : '');

    const buyerNameSelect = (hasBuyerUserId || hasBuyerId)
      ? 'buyer.full_name AS buyer_name'
      : 'NULL AS buyer_name';
    const farmerNameSelect = (hasFarmerUserId || hasFarmerId)
      ? 'farmer.full_name AS farmer_name'
      : 'NULL AS farmer_name';

    let where = '1=1';
    const params = [];
    if (status && status !== 'all') {
      where += ' AND o.status = ?';
      params.push(status);
    }
    if (startDate) {
      where += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND o.created_at <= ?';
      params.push(endDate);
    }
    if (search) {
      const s = `%${search}%`;
      if (hasBuyerUserId || hasBuyerId || hasFarmerUserId || hasFarmerId) {
        where += ' AND (CAST(o.id AS CHAR) LIKE ?'
          + (hasBuyerUserId || hasBuyerId ? ' OR buyer.full_name LIKE ?' : '')
          + (hasFarmerUserId || hasFarmerId ? ' OR farmer.full_name LIKE ?' : '')
          + ')';
        params.push(s);
        if (hasBuyerUserId || hasBuyerId) params.push(s);
        if (hasFarmerUserId || hasFarmerId) params.push(s);
      } else {
        // Fallback: search by order id only if no joins available
        where += ' AND CAST(o.id AS CHAR) LIKE ?';
        params.push(s);
      }
    }

    const sql = `SELECT
         o.id,
         o.status,
         o.created_at,
         o.updated_at,
         COALESCE(o.subtotal, o.total) AS total,
         o.payment_method,
         ${buyerNameSelect},
         ${farmerNameSelect},
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       ${buyerJoin}
       ${farmerJoin}
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)]);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM orders o
       ${buyerJoin}
       ${farmerJoin}
       WHERE ${where}`,
      params
    );

    res.json({ orders: rows, total: countRows[0]?.total || 0, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};
