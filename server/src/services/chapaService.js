import { pool } from '../config/database.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || '';
const CHAPA_PUBLIC_KEY = process.env.CHAPA_PUBLIC_KEY || '';
const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET || '';
const CHAPA_API_BASE = process.env.CHAPA_API_BASE || 'https://api.chapa.global/v2';
const CHAPA_SANDBOX_BASE = process.env.CHAPA_SANDBOX_BASE || 'https://api.chapa.global/v2';

/**
 * Chapa Service — encapsulates communication with the Chapa API.
 * Includes a sandbox fallback so the full flow can be tested
 * even before receiving real Chapa credentials.
 */

export class ChapaService {
  constructor() {
    // A "test/sandbox" key is anything that is NOT a live CHASECK- key.
    // Live keys start with "CHASECK-" (no _TEST_). Test keys use
    // CHASECK_TEST-, CHAPA_TEST_PRIV_, or CHAPA_TEST_PUB_ prefixes.
    this.isSandboxMode =
      !CHAPA_SECRET_KEY ||
      CHAPA_SECRET_KEY.includes('_TEST_') ||
      CHAPA_SECRET_KEY.startsWith('CHASECK_TEST');
    this.baseUrl = this.isSandboxMode ? CHAPA_SANDBOX_BASE : CHAPA_API_BASE;
  }

  /**
   * Initialize a Chapa checkout transaction.
   * Returns { checkoutUrl, txRef, secretKey } or sandbox mock data.
   */

  async initializeTransaction({ amount, currency, email, firstName, lastName, phone, txRef, callbackUrl, returnUrl, customization = {} }) {
    // Sandbox fallback when no real credentials are configured
    if (!CHAPA_SECRET_KEY) {
      return this._sandboxInitialize({ amount, currency, email, firstName, lastName, txRef, callbackUrl, returnUrl });
    }

    // Clean and validate phone number to international Ethiopian format if present (+251...)
    let formattedPhone = phone ? String(phone).trim() : '';
    if (formattedPhone) {
      if (formattedPhone.startsWith('09') || formattedPhone.startsWith('07')) {
        formattedPhone = '+251' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('251')) {
        formattedPhone = '+' + formattedPhone;
      }
    }

    const payload = {
      amount: parseFloat(amount),
      currency: currency || 'ETB',
      email: email || 'customer@ke-amrach.com',
      first_name: firstName || 'Customer',
      last_name: lastName || 'User',
      tx_ref: txRef,
      merchant_reference: txRef,
      customer: {
        first_name: firstName || 'Customer',
        last_name: lastName || 'User',
        email: email || 'customer@ke-amrach.com',
        ...(formattedPhone && { phone_number: formattedPhone }),
      },
      ...(returnUrl && returnUrl.startsWith('https://') && { return_url: returnUrl }),
      ...(callbackUrl && callbackUrl.startsWith('https://') && { callback_url: callbackUrl }),
      ...(formattedPhone && { phone_number: formattedPhone }),
      ...(Object.keys(customization).length > 0 && { customization }),
    };

    const initUrl = `${this.baseUrl}/payments/hosted`;
    console.log('Initiating Chapa payment with payload:', JSON.stringify({
      ...payload,
      email: payload.email ? '***' : undefined,
    }));

    try {
      const response = await fetch(initUrl, {
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
        checkoutUrl: data.data?.checkout_url,
        txRef: data.data?.tx_ref || txRef,
        chapaReference: data.data?.reference,
      };
    } catch (error) {
      console.error(`Error initializing Chapa transaction (${initUrl}):`, error.message);
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

    const verifyUrl = `${this.baseUrl}/payments/${encodeURIComponent(txRef)}/verify`;

    try {
      const response = await fetch(verifyUrl, {
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
      console.error(`Error verifying Chapa transaction (${verifyUrl}):`, error.message);
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