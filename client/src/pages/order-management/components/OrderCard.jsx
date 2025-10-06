import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import { reviewService } from '../../../services/apiService';

const OrderCard = ({ 
  order, 
  onAccept, 
  onDecline, 
  onViewDetails, 
  onContactBuyer,
  onShip,
  onComplete,
  currentLanguage = 'en',
  userRole = 'buyer' // Add user role prop
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { listingId, name }
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const statusConfig = {
    pending: {
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      label: currentLanguage === 'am' ? 'በመጠባበቅ ላይ' : 'Pending',
      icon: 'Clock'
    },
    confirmed: {
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
      label: currentLanguage === 'am' ? 'ተረጋግጧል' : 'Confirmed',
      icon: 'CheckCircle'
    },
    shipped: {
      color: 'text-info',
      bgColor: 'bg-info/10',
      borderColor: 'border-info/20',
      label: currentLanguage === 'am' ? 'ተላክ' : 'Shipped',
      icon: 'Truck'
    },
    completed: {
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
      label: currentLanguage === 'am' ? 'ተጠናቅቋል' : 'Completed',
      icon: 'CheckCircle2'
    },
    cancelled: {
      color: 'text-error',
      bgColor: 'bg-error/10',
      borderColor: 'border-error/20',
      label: currentLanguage === 'am' ? 'ተሰርዟል' : 'Cancelled',
      icon: 'XCircle'
    }
  };

  const status = statusConfig?.[order?.status] || statusConfig?.pending;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2
    })?.format(amount);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })?.format(new Date(date));
  };

  const handleDecline = () => {
    if (declineReason?.trim()) {
      onDecline(order?.id, declineReason);
      setShowDeclineReason(false);
      setDeclineReason('');
    }
  };

  const declineReasons = [
    { value: 'out_of_stock', label: currentLanguage === 'am' ? 'ከክምችት ውጪ' : 'Out of stock' },
    { value: 'price_issue', label: currentLanguage === 'am' ? 'የዋጋ ችግር' : 'Price issue' },
    { value: 'quality_concern', label: currentLanguage === 'am' ? 'የጥራት ስጋት' : 'Quality concern' },
    { value: 'location_far', label: currentLanguage === 'am' ? 'ቦታው ሩቅ ነው' : 'Location too far' },
    { value: 'other', label: currentLanguage === 'am' ? 'ሌላ' : 'Other' }
  ];

  return (<>
    <div className={`bg-card border rounded-lg shadow-warm transition-smooth hover:shadow-warm-md ${status?.borderColor}`}>
      {/* Order Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 bg-muted rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={userRole === 'farmer' ? order?.buyer?.avatar : order?.farmer?.avatar}
                alt={userRole === 'farmer' ? order?.buyer?.name : order?.farmer?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-text-primary truncate">
                  {userRole === 'farmer' ? order?.buyer?.name : order?.farmer?.name}
                </h3>
                {(userRole === 'farmer' ? order?.buyer?.verified : order?.farmer?.verified) && (
                  <Icon name="BadgeCheck" size={16} className="text-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-text-secondary">
                {currentLanguage === 'am' ? 'ትዕዛዝ' : 'Order'} #{order?.orderNumber}
              </p>
              <p className="text-xs text-text-secondary">
                {formatDate(order?.createdAt)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`px-2 py-1 rounded-full ${status?.bgColor} ${status?.borderColor} border flex items-center space-x-1`}>
              <Icon name={status?.icon} size={12} className={status?.color} />
              <span className={`text-xs font-medium ${status?.color}`}>
                {status?.label}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-text-secondary"
            >
              <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
            </Button>
          </div>
        </div>
      </div>
      {/* Order Summary */}
      <div className="p-4">
        <div className="space-y-3">
          {/* Items Preview */}
          <div className="space-y-2">
            {order?.items?.slice(0, isExpanded ? order?.items?.length : 2)?.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden">
                    <Image
                      src={item?.image}
                      alt={item?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-text-primary">
                      {item?.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {item?.quantity} {item?.unit} × {formatCurrency(item?.pricePerUnit)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                <p className="font-medium text-sm text-text-primary">
                  {formatCurrency(item?.total)}
                </p>
                  {userRole === 'buyer' && order?.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReviewTarget({ listingId: (item?.listingId || String(item?.id || '')).toString().replace(/^listing-/, '').replace(/^item-/, ''), name: item?.name }); setIsReviewOpen(true); }}
                    >
                      {currentLanguage === 'am' ? 'አስተያየት ይጨምሩ' : 'Review'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {!isExpanded && order?.items?.length > 2 && (
              <p className="text-xs text-text-secondary">
                +{order?.items?.length - 2} {currentLanguage === 'am' ? 'ተጨማሪ እቃዎች' : 'more items'}
              </p>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="font-medium text-text-primary">
              {currentLanguage === 'am' ? 'ጠቅላላ' : 'Total'}:
            </span>
            <span className="font-bold text-lg text-primary">
              {formatCurrency(order?.totalAmount)}
            </span>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="pt-4 border-t border-border space-y-4">
              {/* Person Information */}
              <div className="space-y-2">
                <h4 className="font-medium text-text-primary">
                  {userRole === 'farmer' 
                    ? (currentLanguage === 'am' ? 'የገዢ መረጃ' : 'Buyer Information')
                    : (currentLanguage === 'am' ? 'የአበባተር መረጃ' : 'Farmer Information')
                  }
                </h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Icon name="MapPin" size={14} className="text-text-secondary" />
                    <span className="text-sm text-text-secondary">
                      {userRole === 'farmer' ? order?.buyer?.location : order?.farmer?.location}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Phone" size={14} className="text-text-secondary" />
                    <span className="text-sm text-text-secondary">
                      {userRole === 'farmer' ? order?.buyer?.phone : order?.farmer?.phone}
                    </span>
                  </div>
                  {userRole === 'farmer' && order?.buyer?.businessType && (
                    <div className="flex items-center space-x-2">
                      <Icon name="Building2" size={14} className="text-text-secondary" />
                      <span className="text-sm text-text-secondary">
                        {order?.buyer?.businessType}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              {order?.specialInstructions && (
                <div className="space-y-2">
                  <h4 className="font-medium text-text-primary">
                    {currentLanguage === 'am' ? 'ልዩ መመሪያዎች' : 'Special Instructions'}
                  </h4>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-text-secondary">
                      {order?.specialInstructions}
                    </p>
                  </div>
                </div>
              )}

              {/* Pickup Details */}
              {order?.status === 'confirmed' && order?.pickupDetails && (
                <div className="space-y-2">
                  <h4 className="font-medium text-text-primary">
                    {currentLanguage === 'am' ? 'የመውሰጃ ዝርዝሮች' : 'Pickup Details'}
                  </h4>
                  <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Icon name="Calendar" size={14} className="text-primary" />
                      <span className="text-sm text-text-primary">
                        {formatDate(order?.pickupDetails?.scheduledDate)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="MapPin" size={14} className="text-primary" />
                      <span className="text-sm text-text-primary">
                        {order?.pickupDetails?.location}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Action Buttons */}
      <div className="p-4 border-t border-border">
        {/* Farmer Actions */}
        {userRole === 'farmer' && (
          <>
        {order?.status === 'pending' && (
          <div className="space-y-3">
            {!showDeclineReason ? (
              <div className="flex space-x-3">
                <Button
                  variant="default"
                  onClick={() => onAccept(order?.id)}
                  className="flex-1"
                  iconName="Check"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'ተቀበል' : 'Accept'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeclineReason(true)}
                  className="flex-1"
                  iconName="X"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'ውድቅ አድርግ' : 'Decline'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {currentLanguage === 'am' ? 'የውድቅ ምክንያት' : 'Reason for declining'}
                  </label>
                  <select
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e?.target?.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input text-text-primary focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="">
                      {currentLanguage === 'am' ? 'ምክንያት ይምረጡ' : 'Select reason'}
                    </option>
                    {declineReasons?.map((reason) => (
                      <option key={reason?.value} value={reason?.value}>
                        {reason?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="destructive"
                    onClick={handleDecline}
                    disabled={!declineReason}
                    className="flex-1"
                  >
                    {currentLanguage === 'am' ? 'ውድቅ አድርግ' : 'Confirm Decline'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeclineReason(false);
                      setDeclineReason('');
                    }}
                    className="flex-1"
                  >
                    {currentLanguage === 'am' ? 'ሰርዝ' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {order?.status === 'confirmed' && (
          <div className="flex space-x-3">
            <Button
              variant="default"
              onClick={() => onContactBuyer(order?.buyer?.phone)}
              className="flex-1"
              iconName="Phone"
              iconPosition="left"
            >
              {currentLanguage === 'am' ? 'ገዢን ይደውሉ' : 'Call Buyer'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onViewDetails(order?.id)}
              className="flex-1"
              iconName="Eye"
              iconPosition="left"
            >
              {currentLanguage === 'am' ? 'ዝርዝር' : 'Details'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onShip(order?.id)}
              className="flex-1"
              iconName="Truck"
              iconPosition="left"
            >
              {currentLanguage === 'am' ? 'ላክ' : 'Mark Shipped'}
            </Button>
          </div>
        )}

        {order?.status === 'shipped' && (
          <div className="flex space-x-3">
            <Button
              variant="default"
              onClick={() => onComplete(order?.id)}
              className="flex-1"
              iconName="CheckCircle2"
              iconPosition="left"
            >
              {currentLanguage === 'am' ? 'ያበቃ' : 'Mark Completed'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onViewDetails(order?.id)}
              className="flex-1"
              iconName="Eye"
              iconPosition="left"
            >
              {currentLanguage === 'am' ? 'ዝርዝር' : 'Details'}
            </Button>
          </div>
            )}
          </>
        )}

        {/* Buyer Actions */}
        {userRole === 'buyer' && (
          <>
            {order?.status === 'pending' && (
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => onContactBuyer(order?.farmer?.phone)}
                  className="flex-1"
                  iconName="Phone"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'አበባተርን ይደውሉ' : 'Call Farmer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onViewDetails(order?.id)}
                  className="flex-1"
                  iconName="Eye"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'ዝርዝር' : 'Details'}
                </Button>
              </div>
            )}

            {(order?.status === 'confirmed' || order?.status === 'shipped') && (
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => onContactBuyer(order?.farmer?.phone)}
                  className="flex-1"
                  iconName="Phone"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'አበባተርን ይደውሉ' : 'Call Farmer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onViewDetails(order?.id)}
                  className="flex-1"
                  iconName="Eye"
                  iconPosition="left"
                >
                  {currentLanguage === 'am' ? 'ዝርዝር' : 'Details'}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Common Actions for Completed/Cancelled */}
        {(order?.status === 'completed' || order?.status === 'cancelled') && (
          <Button
            variant="ghost"
            onClick={() => onViewDetails(order?.id)}
            className="w-full"
            iconName="Eye"
            iconPosition="left"
          >
            {currentLanguage === 'am' ? 'ዝርዝር ይመልከቱ' : 'View Details'}
          </Button>
        )}
      </div>
    </div>
    {/* Review Modal */}
    {isReviewOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-lg w-full max-w-md">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">
              {currentLanguage === 'am' ? 'ግምገማ አቀርብ' : 'Leave a Review'}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setIsReviewOpen(false)} iconName="X" />
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                {currentLanguage === 'am' ? 'ምርት' : 'Product'}
              </label>
              <div className="text-sm font-medium text-text-primary">{reviewTarget?.name}</div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">{currentLanguage === 'am' ? 'ደረጃ' : 'Rating'}</label>
              <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg bg-input">
                {[5,4,3,2,1].map(r => (
                  <option key={r} value={r}>{r} {currentLanguage === 'am' ? 'ኮከብ' : 'star'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">{currentLanguage === 'am' ? 'አስተያየት (አማራጭ)' : 'Comment (optional)'}</label>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg bg-input" />
            </div>
          </div>
          <div className="p-4 border-t border-border flex space-x-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsReviewOpen(false)}>
              {currentLanguage === 'am' ? 'ሰርዝ' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={isSubmittingReview}
              onClick={async () => {
                if (!reviewTarget?.listingId || !reviewRating) return;
                try {
                  setIsSubmittingReview(true);
                  await reviewService.createReview({ listingId: reviewTarget.listingId, rating: reviewRating, comment: reviewComment });
                  setIsReviewOpen(false);
                  setReviewComment('');
                } catch (err) {
                  console.error('Failed to submit review', err);
                  alert(currentLanguage === 'am' ? 'ግምገማ አልተሳካም።' : 'Failed to submit review.');
                } finally {
                  setIsSubmittingReview(false);
                }
              }}
            >
              {currentLanguage === 'am' ? 'አቀርብ' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    )}
  </>);
};

export default OrderCard;