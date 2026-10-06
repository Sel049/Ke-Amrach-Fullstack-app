import React, { useEffect } from 'react';
import Icon from '../AppIcon.jsx';

const VARIANT_STYLES = {
  success: { icon: 'CheckCircle', iconClass: 'text-success' },
  error: { icon: 'AlertCircle', iconClass: 'text-destructive' },
  warning: { icon: 'AlertTriangle', iconClass: 'text-warning' },
  info: { icon: 'Info', iconClass: 'text-primary' }
};

/**
 * Floating, dismissible toast used for non-blocking user feedback.
 * Mirrors the toast pattern used on the buyer home page so feedback looks
 * consistent across the app (no toast library is installed in this project).
 *
 * @param {('success'|'error'|'warning'|'info')} type
 * @param {string|React.ReactNode} message
 * @param {() => void} [onClose] Called when the toast is dismissed or auto-hides.
 * @param {number} [duration=5000] Auto-dismiss delay in ms. Pass 0 to keep it until dismissed.
 */
const Toast = ({ type = 'info', message, onClose, duration = 5000 }) => {
  useEffect(() => {
    if (!message || !onClose || !duration) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const variant = VARIANT_STYLES[type] || VARIANT_STYLES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[60] flex items-start gap-3 max-w-sm rounded-lg border border-border bg-card p-4 text-sm text-text-primary shadow-warm-lg"
    >
      <Icon name={variant.icon} size={18} className={`mt-0.5 shrink-0 ${variant.iconClass}`} />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded text-text-secondary transition-colors hover:text-text-primary"
        >
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
};

export default Toast;