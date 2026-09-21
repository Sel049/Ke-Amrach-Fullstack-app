import React, { useEffect } from 'react';
import Icon from '../AppIcon.jsx';
import Button from './Button.jsx';

const modalSizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4'
};

// Mobile-first: full-screen modal on small screens
const getModalClasses = (size) => {
  const baseClasses = 'bg-white rounded-lg shadow-xl w-full';
  const sizeClass = modalSizeClasses[size] || modalSizeClasses.md;
  return `${baseClasses} ${sizeClass} max-h-[90vh] overflow-y-auto`;
};

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 overflow-y-auto"
      onClick={handleOverlayClick}
    >
      <div 
        className={`${getModalClasses(size)} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1 hover:bg-gray-100"
              >
                <Icon name="X" size={20} />
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
