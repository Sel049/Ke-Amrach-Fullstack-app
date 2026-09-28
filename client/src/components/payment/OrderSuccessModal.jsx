import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Icon from '../AppIcon.jsx';

/**
 * OrderSuccessModal
 * Animated confirmation dialog shown after a successful order / payment.
 *
 * Props:
 *  - isOpen         {boolean}  controls visibility
 *  - onClose        {fn}       called when the user dismisses the modal
 *  - order          {object}   { id, total, paymentMethod, txRef, farmerName, itemCount }
 *  - language       {'en'|'am'} active UI language
 *  - title          {string}   optional headline override
 *  - subtitle       {string}   optional sub-headline override
 *  - showActions    {boolean}  hide the primary action buttons when false
 */
const OrderSuccessModal = ({
  isOpen,
  onClose,
  order = {},
  language = 'en',
  title,
  subtitle,
  showActions = true,
}) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  const isAm = language === 'am';
  const CHECK_ANIMATION_MS = 600;

  // Delay the checkmark draw-in so the modal fade settles first
  useEffect(() => {
    if (!isOpen) {
      setMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Lock background scroll + allow Escape to dismiss
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const orderId = order.id ?? order.orderId;
  const total = Number(order.total ?? order.subtotal ?? order.amount ?? 0);
  const currency = order.currency || 'ETB';
  const txRef = order.txRef || order.transactionId;
  const itemCount = order.itemCount ?? order.totalItems ?? 0;

  const heading = title || (isAm ? 'ትዕዛዝዎ በተሳካ ሁኔታ ተፈጥሯል!' : 'Order Placed Successfully!');
  const subheading = subtitle || (isAm
    ? 'ለትዕዛዝዎ እናመሰግናለን። ገበሬው በቅርቡ ያረጋግጣል።'
    : 'Thank you for your order. The farmer will confirm it shortly.');

  const closeAndGo = (path) => {
    onClose?.();
    if (path) navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-success-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8 text-center">
          {/* Animated green checkmark */}
          <div className="mx-auto mb-5 relative w-20 h-20">
            <div className={`absolute inset-0 rounded-full bg-success/15 transition-transform duration-500 ease-out ${mounted ? 'scale-100' : 'scale-50'}`} />
            <div className={`relative w-20 h-20 rounded-full bg-success flex items-center justify-center transition-all duration-300 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
              <svg viewBox="0 0 52 52" className="w-11 h-11" aria-hidden="true">
                <path
                  d="M14 27l8 8 16-17"
                  fill="none"
                  stroke="white"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 40,
                    strokeDashoffset: mounted ? 0 : 40,
                    transition: `stroke-dashoffset ${CHECK_ANIMATION_MS}ms ease-out`,
                  }}
                />
              </svg>
            </div>
          </div>

          <h2 id="order-success-title" className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
            {heading}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {subheading}
          </p>

          {/* Order summary */}
          <div className="bg-muted/40 border border-border rounded-xl divide-y divide-border text-left mb-6">
            {orderId != null && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-text-secondary">
                  {isAm ? 'የትዕዛዝ ቁጥር' : 'Order Number'}
                </span>
                <span className="text-sm font-semibold text-text-primary">#{orderId}</span>
              </div>
            )}
            {itemCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-text-secondary">
                  {isAm ? 'እቃዎች' : 'Items'}
                </span>
                <span className="text-sm font-semibold text-text-primary">{itemCount}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-secondary">
                {isAm ? 'ጠቅላላ ዋጋ' : 'Total Amount'}
              </span>
              <span className="text-sm font-bold text-text-primary">
                {currency} {total.toFixed(2)}
              </span>
            </div>
            {order.paymentMethod && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-text-secondary">
                  {isAm ? 'የክፍያ ዘዴ' : 'Payment Method'}
                </span>
                <span className="text-sm font-medium text-text-primary capitalize">
                  {String(order.paymentMethod).replace(/_/g, ' ')}
                </span>
              </div>
            )}
            {txRef && (
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <span className="text-sm text-text-secondary shrink-0">
                  {isAm ? 'የክፍያ ማጣቀሻ' : 'Payment Ref'}
                </span>
                <span className="text-xs font-mono text-text-primary truncate" title={txRef}>
                  {txRef}
                </span>
              </div>
            )}
            {order.farmerName && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-text-secondary">
                  {isAm ? 'ሻጭ' : 'Seller'}
                </span>
                <span className="text-sm font-medium text-text-primary">{order.farmerName}</span>
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                iconName="Package"
                onClick={() => closeAndGo('/order-management')}
              >
                {isAm ? 'ትዕዛዞቼን ይመልከቱ' : 'View My Orders'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                iconName="Store"
                onClick={() => closeAndGo('/browse-listings-buyer-home')}
              >
                {isAm ? 'ግዢ ይቀጥሉ' : 'Continue Shopping'}
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => closeAndGo(null)}
            className="mt-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon name="X" size={14} />
            {isAm ? 'ዝጋ' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;