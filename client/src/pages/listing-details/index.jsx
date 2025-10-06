import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import Image from '../../components/AppImage';
import ImageGallery from '../../components/ui/ImageGallery';
import FavoriteButton from '../../components/FavoriteButton';
import { listingService } from '../../services/apiService';
import ReviewList from '../../components/ReviewList';

const ListingDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await listingService.getListingById(id);
        setListing(response);
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError('Failed to load listing details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchListing();
    }
  }, [id]);

  const handleAddToCart = async () => {
    if (!listing) return;
    
    setIsAddingToCart(true);
    try {
      addItem({
        id: listing.id,
        name: listing.name,
        nameAm: listing.nameAm,
        image: listing.image,
        pricePerKg: listing.pricePerKg,
        availableQuantity: listing.availableQuantity
      }, quantity);
      
      // Show success message (you can add a toast notification here)
      alert(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`);
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert('Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleQuantityChange = (change) => {
    const newQuantity = Math.max(1, Math.min(listing?.availableQuantity || 1, quantity + change));
    setQuantity(newQuantity);
  };

  const handleContactFarmer = (type) => {
    if (!listing?.farmer) return;

    switch (type) {
      case 'call':
        if (listing.farmer.phone) {
          window.open(`tel:${listing.farmer.phone}`, '_self');
        }
        break;
      case 'message':
        if (listing.farmer.phone) {
          window.open(`sms:${listing.farmer.phone}`, '_self');
        }
        break;
      case 'email':
        if (listing.farmer.email) {
          window.open(`mailto:${listing.farmer.email}`, '_self');
        }
        break;
      default:
        break;
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0
    })?.format(price)?.replace('ETB', 'ETB');
  };

  const renderStarRating = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-lg ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error || !listing) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            <Icon name="AlertCircle" size={48} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The listing you are looking for does not exist.'}</p>
            <Button onClick={() => navigate('/browse-listings-buyer-home')}>
              Browse Listings
            </Button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <button 
            onClick={() => navigate('/browse-listings-buyer-home')}
            className="hover:text-primary"
          >
            Browse Listings
          </button>
          <Icon name="ChevronRight" size={16} />
          <span className="text-gray-900">{listing.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <ImageGallery
                images={listing.images || (listing.image ? [listing.image] : [])}
                alt={listing.name}
                className="w-full h-full"
                showThumbnails={true}
              />
            </div>
            
            {/* Favorite Button */}
            <div className="flex justify-center">
              <FavoriteButton listingId={listing.id} />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            {/* Title and Price */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {listing.name}
              </h1>
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(listing.pricePerKg)}
                </span>
                <span className="text-gray-600">per kg</span>
              </div>
            </div>

            {/* Farmer Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Farmer Information</h3>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <Image
                    src={listing.farmer?.avatar || '/public/assets/images/no_image.png'}
                    alt={listing.farmer?.name || 'Farmer'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{listing.farmer?.name}</p>
                  <p className="text-sm text-gray-600">{listing.farmer?.location}</p>
                </div>
              </div>
              
              {/* Rating */}
              <div className="flex items-center space-x-2 mb-3">
                {renderStarRating(listing.farmer?.rating || 0)}
                <span className="text-sm text-gray-600">
                  ({listing.farmer?.rating || 0}) • {listing.farmer?.reviewCount || 0} reviews
                </span>
              </div>

              {/* Contact Buttons */}
              <div className="flex space-x-2">
                {listing.farmer?.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContactFarmer('call')}
                    iconName="Phone"
                    iconSize={16}
                  >
                    Call
                  </Button>
                )}
                {listing.farmer?.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContactFarmer('message')}
                    iconName="MessageCircle"
                    iconSize={16}
                  >
                    Message
                  </Button>
                )}
                {listing.farmer?.email && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleContactFarmer('email')}
                    iconName="Mail"
                    iconSize={16}
                  >
                    Email
                  </Button>
                )}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Quantity (kg)
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="Minus" size={16} />
                  </button>
                  <span className="w-16 text-center text-lg font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= listing.availableQuantity}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="Plus" size={16} />
                  </button>
                </div>
                <span className="text-sm text-gray-600">
                  {listing.availableQuantity} kg available
                </span>
              </div>
            </div>

            {/* Add to Cart */}
            <Button
              variant="default"
              size="lg"
              onClick={handleAddToCart}
              loading={isAddingToCart}
              disabled={listing.availableQuantity === 0}
              className="w-full"
              iconName="ShoppingCart"
              iconPosition="left"
            >
              {isAddingToCart ? 'Adding...' : 'Add to Cart'}
            </Button>

            {/* Availability Status */}
            <div className="flex items-center space-x-2">
              <Icon 
                name={listing.availableQuantity > 0 ? "CheckCircle" : "XCircle"} 
                size={20} 
                className={listing.availableQuantity > 0 ? "text-green-500" : "text-red-500"} 
              />
              <span className={`text-sm ${listing.availableQuantity > 0 ? "text-green-600" : "text-red-600"}`}>
                {listing.availableQuantity > 0 ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['details', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {listing.description || 'No description available.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Product Details</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Category:</dt>
                        <dd className="text-gray-900">{listing.category}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Location:</dt>
                        <dd className="text-gray-900">{listing.location}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Available Quantity:</dt>
                        <dd className="text-gray-900">{listing.availableQuantity} kg</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Price per kg:</dt>
                        <dd className="text-gray-900">{formatPrice(listing.pricePerKg)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Farmer Details</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Name:</dt>
                        <dd className="text-gray-900">{listing.farmer?.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Farm Name:</dt>
                        <dd className="text-gray-900">{listing.farmer?.farmName || 'Not provided'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Location:</dt>
                        <dd className="text-gray-900">{listing.farmer?.location}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Experience:</dt>
                        <dd className="text-gray-900">{listing.farmer?.experienceYears || 0} years</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Phone:</dt>
                        <dd className="text-gray-900">{listing.farmer?.phone || 'Not provided'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Email:</dt>
                        <dd className="text-gray-900">{listing.farmer?.email || 'Not provided'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Certifications:</dt>
                        <dd className="text-gray-900">{listing.farmer?.certifications || 'None'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Rating:</dt>
                        <dd className="text-gray-900">{listing.farmer?.rating || 0}/5</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Status:</dt>
                        <dd className="text-gray-900">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            listing.farmer?.isVerified 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {listing.farmer?.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Customer Reviews</h3>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/listing/${id}/reviews`)}
                  >
                    View All Reviews
                  </Button>
                </div>
                <ReviewList listingId={id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ListingDetailsPage;


