import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/AppIcon.jsx';
import OrderSuccessModal from '../../components/payment/OrderSuccessModal.jsx';
import { chapaService } from '../../services/apiService.js';
import { useCart } from '../../hooks/useCart.jsx';
import { useLanguage } from '../../hooks/useLanguage.jsx';

/**
 * PaymentVerifyPage
 * Landing page Chapa redirects to after checkout.
 * Reads `tx_ref` (+ optional `order_id`) from the query string,
 * verifies the payment server-side, clears the cart, then shows
 * the OrderSuccessModal.
 *
 * Route: /payments/verify
 */
const PaymentVerifyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clear: clearCart } = useCart();
  const { language } = useLanguage();

  const txRef = searchParams.get('tx_ref') || searchParams.get('txRef');
  const orderId = searchParams.get('order_id');

  const [status, setStatus] = useState('verifying'); // verifying | success | failed
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Guard against React 18 StrictMode double-invocation re-verifying
  const verifiedRef = useRef(false);

  const isAm = language === 'am';

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    if (!txRef) {
      setStatus('failed');
      setError(isAm
        ? 'የክፍያ ማጣቀሻ አልተገኘም።'
        : 'Missing payment reference. We could not verify this payment.');
      return;
    }

    let active = true;

    const verify = async () => {
      try {
        const result = await chapaService.verifyPayment(txRef, orderId);
        if (!active) return;

        if (result?.success) {
          setPayment(result);
          setStatus('success');
          setShowSuccess(true);
          // Order is confirmed — the cart contents are now committed
          try { clearCart(); } catch (_) {}
        } else {
          setStatus('failed');
          setError(result?.message || (isAm ? 'ክፍያው ማረጋገጫ አልተሳካም።' : 'Payment verification failed.'));
        }
      } catch (err) {
        if (!active) return;
        setStatus('failed');
        setError(
          err?.response?.data?.message
          || err?.response?.data?.error
          || (isAm ? 'ክፍያውን ማረጋገጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።' : 'Unable to verify the payment. Please try again.')
        );
      }
    };

    verify();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txRef, orderId]);

  const successOrder = {
    id: payment?.orderId ?? orderId,
    orderId: payment?.orderId ?? orderId,
    total: payment?.payment?.amount ?? payment?.amount ?? 0,
    currency: payment?.payment?.currency || 'ETB',
    txRef: payment?.payment?.txRef || txRef,
    paymentMethod: 'chapa',
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Verifying */}
        {status === 'verifying' && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="Loader2" size={32} className="text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              {isAm ? 'ክፍያዎን በማረጋገጥ ላይ...' : 'Verifying your payment...'}
            </h1>
            <p className="text-sm text-text-secondary mb-1">
              {isAm
                ? 'እባክዎ ይጠብቁ፤ ከChapa ጋር በመገናኘት ላይ ነን።'
                : 'Please wait while we confirm the transaction with Chapa.'}
            </p>
            {txRef && (
              <p className="text-xs font-mono text-text-secondary truncate" title={txRef}>
                {txRef}
              </p>
            )}
            <div className="mt-6 h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <Icon name="XCircle" size={32} className="text-error" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              {isAm ? 'ክፍያው አልተሳካም' : 'Payment Verification Failed'}
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              {error}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                iconName="RotateCcw"
                onClick={() => { verifiedRef.current = false; setStatus('verifying'); window.location.reload(); }}
              >
                {isAm ? 'እንደገና ይሞክሩ' : 'Try Again'}
              </Button>
              <Button
                className="flex-1"
                iconName="CreditCard"
                onClick={() => navigate('/payments')}
              >
                {isAm ? 'ወደ ክፍያዎች' : 'Back to Payments'}
              </Button>
            </div>
          </div>
        )}

        {/* Success — the modal is the primary UI; this card sits behind it */}
        {status === 'success' && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <Icon name="CheckCircle2" size={32} className="text-success" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              {isAm ? 'ክፍያው ተረጋግጧል!' : 'Payment Confirmed!'}
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              {isAm
                ? 'ትዕዛዝዎ ተረጋግጧል። ገበሬው በቅርቡ ያስተናግዳል።'
                : 'Your order has been confirmed. The farmer will process it shortly.'}
            </p>
            <Button className="w-full" iconName="Package" onClick={() => navigate('/order-management')}>
              {isAm ? 'ትዕዛዞቼን ይመልከቱ' : 'View My Orders'}
            </Button>
          </div>
        )}

        <OrderSuccessModal
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          order={successOrder}
          language={language}
        />
      </div>
    </AuthenticatedLayout>
  );
};

export default PaymentVerifyPage;