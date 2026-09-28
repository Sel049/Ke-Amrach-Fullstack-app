import { pool } from '../config/database.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || '';
const CHAPA_PUBLIC_KEY = process.env.CHAPA_PUBLIC_KEY || '';
const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET || '';
const CHAPA_API_BASE = process.env.CHAPA_API_BASE || 'https://api.chapa.co/v1';
const CHAPA_SANDBOX_BASE = process.env.CHAPA_SANDBOX_BASE || 'https://sandbox.chapa.co/v1';

/**
 * Chapa Service — encapsulates communication with the Chapa API.
 * Includes a sandbox fallback so the full flow can be tested
 * even before receiving real Chapa credentials.
 */

export class ChapaService {
  constructor() {
    this.isSandboxMode = !CHAPA_SECRET_KEY || CHAPA_SECRET_KEY.startsWith('CHASECK_TEST-');
    this.baseUrl = this.isSandboxMode ? CHAPA_SANDBOX_BASE : CHAPA_API_BASE;
  }

  /**
   * Initialize a Chapa checkout transaction.
   * Returns { checkoutUrl, txRef, secretKey } or sandbox mock data.
   */
  async initializeTransaction({ amount, currency, email, firstName, lastName, phone, txRef, callbackUrl, returnUrl, customization = {} }) {
    if (!CHAPA_SECRET_KEY) {
      return this._sandboxInitialize({ amount, currency, email, firstName, lastName, txRef, callbackUrl, returnUrl });
    }

    const payload = {
      amount: parseFloat(amount),
      currency: currency || 'ETB',
      email,
      first_name: firstName,
      last_name: lastName || '',
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      ...(phone && { phone_number: phone }),
      ...(Object.keys(customization).length > 0 && { customization }),
    };

    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Chapa API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      return {
        success: true,
        checkoutUrl: data.data?.checkout_url || data.data?.checkoutUrl,
        txRef: data.data?.tx_ref || txRef,
        chapaReference: data.data?.reference || data.data?.chapa_reference,
      };
    } catch (error) {
      console.error('Error initializing Chapa transaction:', error.message);
      throw error;
    }
  }

  /**
   * Verify a Chapa transaction by tx_ref.
   * Returns verification result with order status.
   */
  async verifyTransaction(txRef) {
    if (!CHAPA_SECRET_KEY) {
      return this._sandboxVerify(txRef);
    }

    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Chapa verify error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const status = data.data?.status || 'unknown';
      const isSuccessful = ['success', 'completed'].includes(String(status).toLowerCase());
      const chapaReference = data.data?.reference || data.data?.chapa_reference || txRef;

      return {
        success: isSuccessful,
        verified: isSuccessful,
        txRef,
        chapaReference,
        amount: data.data?.amount || 0,
        currency: data.data?.currency || 'ETB',
        metadata: data.data?.metadata || {},
        raw: data,
      };
    } catch (error) {
      console.error('Error verifying Chapa transaction:', error.message);
      throw error;
    }
  }

  /**
   * Build the webhook signature for validation.
   */
  verifyWebhookSignature(payload, signature) {
    if (!CHAPA_WEBHOOK_SECRET) return true; // Fallback for dev
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', CHAPA_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(String(signature), 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Sandbox fallback — returns mock data for testing without real credentials.
   */
  async _sandboxInitialize({ amount, currency, email, firstName, lastName, txRef, callbackUrl, returnUrl }) {
    console.log('🔄 [SANDBOX] Initializing Chapa transaction (sandbox mode):', { txRef, amount, currency });
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const mockTxRef = txRef || `tx_${crypto.randomUUID().slice(0, 8)}`;
    return {
      success: true,
      checkoutUrl: `${CHAPA_SANDBOX_BASE}/checkout?tx_ref=${mockTxRef}&mode=sandbox`,
      txRef: mockTxRef,
      chapaReference: `CHAPA-${mockTxRef}`,
      sandbox: true,
    };
  }

  /**
   * Sandbox fallback — simulates successful verification.
   */
  async _sandboxVerify(txRef) {
    console.log('🔄 [SANDBOX] Verifying Chapa transaction (sandbox mode):', txRef);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    return {
      success: true,
      verified: true,
      txRef,
      chapaReference: `CHAPA-${txRef}`,
      amount: 0, // Would be set from the payment record
      currency: 'ETB',
      status: 'completed',
      sandbox: true,
    };
  }
}

// Singleton export
export const chapaService = new ChapaService();