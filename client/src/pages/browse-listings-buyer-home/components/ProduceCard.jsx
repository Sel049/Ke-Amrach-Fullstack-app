import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import ImageGallery from '../../../components/ui/ImageGallery';
import Button from '../../../components/ui/Button';
import FavoriteButton from '../../../components/FavoriteButton';

const ProduceCard = ({
  listing,
  onAddToCart,
  onContactFarmer,
  onToggleBookmark,
  isBookmarked = false,
  currentLanguage = 'en'
}) => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);

  const translations = {
    en: {
      perKg: 'per kg',
      available: 'Available',
      addToCart: 'Add to Cart',
      contact: 'Contact',
      viewDetails: 'View Details',
      rating: 'rating',
      reviews: 'reviews',
      viewReviews: 'View Reviews',
      noReviews: 'No reviews yet'
    },
    am: {
      perKg: 'በኪሎ',
      available: 'ይገኛል',
      addToCart: 'ወደ ጋሪ ጨምር',
      contact: 'ያነጋግሩ',
      viewDetails: 'ዝርዝሮችን ይመልከቱ',
      rating: 'ደረጃ',
      reviews: 'ግምገማዎች',
      viewReviews: 'ግምገማዎችን ይመልከቱ',
      noReviews: 'ገና ግምገማ የለም'
    }
  };

  const t = translations?.[currentLanguage];

  const handleAddToCart = async () => {
    setIsAdding(true);
    await onAddToCart(listing?.id, 1); // Always add with quantity 1
    setIsAdding(false);
  };

  const handleViewDetails = () => {
    navigate(`/listing/${listing?.id}`);
  };

  const handleViewReviews = () => {
    // Navigate to a reviews page or open a modal
    navigate(`/listing/${listing.id}/reviews`);
  };

  const renderStarRating = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0
    })?.format(price)?.replace('ETB', 'ETB');
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm hover:shadow-warm-md transition-smooth overflow-hidden">
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <ImageGallery
          images={listing?.images || (listing?.image ? [listing.image] : [])}
          alt={currentLanguage === 'am' && listing?.nameAm ? listing?.nameAm : listing?.name || 'Product Image'}
          className="w-full h-full"
          showThumbnails={false}
        />

        {/* Favorite Button */}
        <div className="absolute top-3 right-3">
          <FavoriteButton
            listingId={listing?.id}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-smooth bg-white/90 text-text-secondary hover:bg-white hover:text-accent"
          />
        </div>

        {/* Verification Badge - only for verified farmers */}
        {listing?.farmer?.isVerified && (
          <div className="absolute top-3 left-3 bg-success text-success-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Icon name="CheckCircle" size={12} />
            <span>Verified</span>
          </div>
        )}
      </div>
      {/* Content Section */}
      <div className="p-4">
        {/* Produce Name */}
        <h3 className="font-heading font-semibold text-lg text-text-primary mb-1">
          {currentLanguage === 'am' && listing?.nameAm ? listing?.nameAm : listing?.name}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-primary">
            {formatPrice(listing?.pricePerKg)}
          </span>
          <span className="text-sm text-text-secondary">
            {t?.perKg}
          </span>
        </div>

        {/* Farmer Info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full overflow-hidden">
            <Image
              src={listing?.farmer?.avatar}
              alt={listing?.farmer?.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {listing?.farmer?.name}
            </p>
            <p className="text-xs text-text-secondary truncate">
              {listing?.farmer?.location}
            </p>
          </div>
        </div>

        {/* Reviews / Rating (real) */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {renderStarRating(Number(listing?.averageRating ?? listing?.farmer?.rating ?? 0))}
              <span className="text-sm text-text-secondary">
                {Number(listing?.reviewCount ?? listing?.farmer?.reviewCount ?? 0)} {t?.reviews}
              </span>
            </div>
            {Number(listing?.reviewCount ?? listing?.farmer?.reviewCount ?? 0) > 0 && (
              <button
                onClick={handleViewReviews}
                className="text-sm text-primary hover:text-primary-dark transition-colors"
              >
                {t?.viewReviews}
              </button>
            )}
          </div>
          {Number(listing?.reviewCount ?? listing?.farmer?.reviewCount ?? 0) === 0 && (
            <p className="text-xs text-text-secondary mt-1">
              {t?.noReviews}
            </p>
          )}
        </div>

        {/* Availability (freshness removed) */}
        <div className="flex items-center justify-start mb-4">
          <div className="flex items-center gap-1">
            <Icon name="Package" size={14} className="text-success" />
            <span className="text-sm text-text-secondary">
              {listing?.availableQuantity}kg {t?.available}
            </span>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleAddToCart}
            loading={isAdding}
            className="flex-1"
            iconName="ShoppingCart"
            iconPosition="left"
            iconSize={16}
          >
            {t?.addToCart}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewDetails}
            iconName="Eye"
            iconSize={16}
          >
            {t?.viewDetails}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProduceCard;
