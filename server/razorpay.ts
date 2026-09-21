import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getServerConfig } from './config/env.js';

let razorpayInstance: Razorpay | null = null;

/**
 * Returns the server-side Razorpay Key ID.
 */
export function getRazorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID?.trim() || getServerConfig().RAZORPAY_KEY_ID;
}

/**
 * Returns the private Razorpay Secret Key (SERVER ONLY - NEVER EXPOSE TO FRONTEND).
 */
export function getRazorpayKeySecret(): string {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || getServerConfig().RAZORPAY_KEY_SECRET;
}

/**
 * Checks whether Razorpay credentials are fully configured.
 */
export function isRazorpayConfigured(): boolean {
  return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
}

/**
 * Lazy initialization of Razorpay Node SDK.
 */
export function getRazorpayClient(): Razorpay | null {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    return null;
  }

  if (!razorpayInstance) {
    try {
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } catch (err) {
      console.error('❌ Failed to initialize Razorpay SDK:', err);
      return null;
    }
  }

  return razorpayInstance;
}

export interface CreateOrderParams {
  amountInPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
}

/**
 * Creates a server-side order using the Razorpay API.
 * Disables payment and returns an error if keys are missing.
 * Never creates simulated or mock orders in production.
 */
export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<RazorpayOrderResult> {
  const client = getRazorpayClient();
  const currency = params.currency || 'INR';
  const receipt = params.receipt || `rx_rcpt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  if (!client) {
    throw new Error(
      'Razorpay payment gateway is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'
    );
  }

  try {
    const order = await client.orders.create({
      amount: params.amountInPaise,
      currency,
      receipt,
      notes: params.notes || {},
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      receipt: order.receipt || receipt,
    };
  } catch (error: any) {
    console.error('❌ Razorpay Orders API error:', error);
    throw new Error(
      error?.error?.description || error?.message || 'Failed to create Razorpay payment order'
    );
  }
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Verifies Razorpay payment signature via HMAC-SHA256.
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 * Explicitly rejects simulated IDs such as order_sim_* or pay_sim_*.
 */
export function verifyRazorpayPaymentSignature(params: VerifySignatureParams): boolean {
  const { orderId, paymentId, signature } = params;

  // Reject empty, missing, or simulated payment IDs
  if (!orderId || !paymentId || !signature) {
    return false;
  }
  if (
    orderId.startsWith('order_sim_') ||
    paymentId.startsWith('pay_sim_') ||
    signature.startsWith('sig_sim_')
  ) {
    console.error('❌ Rejected simulated/fake payment parameters in production payment verification');
    return false;
  }

  const secret = getRazorpayKeySecret();
  if (!secret) {
    console.error('❌ Cannot verify payment signature: RAZORPAY_KEY_SECRET is not configured');
    return false;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const generatedBuffer = Buffer.from(generatedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (generatedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
  } catch (err) {
    console.error('❌ Exception verifying HMAC payment signature:', err);
    return false;
  }
}

export interface VerifyPaymentDetailsParams {
  paymentId: string;
  orderId: string;
  expectedAmountInPaise: number;
  expectedCurrency?: string;
}

/**
 * Queries Razorpay API directly to verify payment capture status, amount, and order ID.
 */
export async function verifyRazorpayPaymentWithAPI(
  params: VerifyPaymentDetailsParams
): Promise<{ isValid: boolean; error?: string; payment?: any }> {
  const client = getRazorpayClient();
  if (!client) {
    return {
      isValid: false,
      error: 'Razorpay payment gateway client is not initialized on the server',
    };
  }

  // Reject simulated IDs
  if (params.paymentId.startsWith('pay_sim_') || params.orderId.startsWith('order_sim_')) {
    return {
      isValid: false,
      error: 'Simulated payment IDs are strictly forbidden in production',
    };
  }

  try {
    const payment = await (client.payments.fetch(params.paymentId) as any);
    if (!payment) {
      return { isValid: false, error: 'Payment not found in Razorpay records' };
    }

    // Verify order ID association
    if (payment.order_id !== params.orderId) {
      return {
        isValid: false,
        error: `Payment order ID mismatch. Expected ${params.orderId}, got ${payment.order_id}`,
      };
    }

    // Verify payment status (captured or authorized)
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return {
        isValid: false,
        error: `Payment status is ${payment.status}. Only captured/authorized payments can be confirmed.`,
      };
    }

    // Verify payment amount in paise
    if (Number(payment.amount) !== params.expectedAmountInPaise) {
      return {
        isValid: false,
        error: `Payment amount mismatch. Expected ₹${params.expectedAmountInPaise / 100}, received ₹${Number(payment.amount) / 100}`,
      };
    }

    // Verify currency
    const expectedCurr = params.expectedCurrency || 'INR';
    if (payment.currency !== expectedCurr) {
      return {
        isValid: false,
        error: `Currency mismatch. Expected ${expectedCurr}, received ${payment.currency}`,
      };
    }

    return { isValid: true, payment };
  } catch (err: any) {
    console.error('❌ Error fetching payment from Razorpay API:', err);
    return {
      isValid: false,
      error: err?.error?.description || err?.message || 'Failed to verify payment with Razorpay',
    };
  }
}
