import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { orderService, reviewService } from '../../../services/apiService';

const OrderHistorySection = ({ userRole, currentLanguage }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Load orders from API
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        let orderData;
        
        if (userRole === 'farmer') {
          orderData = await orderService.getFarmerOrders({ 
            status: filterStatus === 'all' ? undefined : filterStatus,
            limit: 50 
          });
        } else if (userRole === 'buyer') {
          orderData = await orderService.getBuyerOrders({ 
            status: filterStatus === 'all' ? undefined : filterStatus,
            limit: 50 
          });
        }
        
        // Transform API data to match component expectations
        const transformedOrders = (orderData?.orders || orderData || []).map(order => {
          // Use same logic as orders tab for price calculation
          const totalAmount = Number(order.subtotal || order.total || order.total_amount || order.amount || order.totalAmount || order.totalPrice || order.price || 0);
          
          return {
            id: order.id || order.order_id,
            // For farmers: show buyer info
            buyerName: order.buyer_name || order.buyerName,
            buyerNameAm: order.buyer_name || order.buyerName, // Use same for now
            // For buyers: show farmer info  
            farmerName: order.farmer_name || order.farmerName,
            farmerNameAm: order.farmer_name || order.farmerName, // Use same for now
            product: order.listing_name || order.product_name || order.title || 'Product',
            productAm: order.listing_name || order.product_name || order.title || 'Product', // Use same for now
            quantity: order.quantity ? `${order.quantity}kg` : (order.items && order.items.length > 0 ? `${order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}kg` : 'N/A'),
            price: formatCurrency(totalAmount),
            totalAmount: totalAmount, // Store numeric value for calculations
            status: order.status || 'pending',
            date: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            rating: order.rating || null,
            review: order.review || null,
            listingId: order.listing_id || order.produce_listing_id,
            // Store raw order data for view details modal
            rawOrder: order
          };
        });
        
        setOrders(transformedOrders);
        setError(null);
      } catch (err) {
        console.error('Failed to load order history:', err);
        setError('Failed to load orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [userRole, filterStatus]); // Reload when role or status filter changes

  // Handle view order details
  const handleViewDetails = async (order) => {
    try {
      // Get full order details from API
      const orderDetails = await orderService.getOrderById(order.id);
      // Merge list item (which has normalized fields) with detailed response
      setViewingOrder({ ...order, ...orderDetails });
    } catch (error) {
      console.error('Failed to load order details:', error);
      // Fallback to basic order info
      setViewingOrder(order);
    }
  };

  // Handle review submission
  const handleReviewSubmit = async () => {
    if (!reviewTarget?.listingId || !reviewRating) return;
    
    try {
      setIsSubmittingReview(true);
      await reviewService.createReview({ 
        listingId: reviewTarget.listingId, 
        rating: reviewRating, 
        comment: reviewComment.trim() 
      });
      
      // Close review modal and reset
      setIsReviewOpen(false);
      setReviewComment('');
      setReviewRating(5);
      setReviewTarget(null);
      
      // Reload orders to update the reviewed status
      const loadOrders = async () => {
        try {
          let orderData;
          if (userRole === 'farmer') {
            orderData = await orderService.getFarmerOrders({ 
              status: filterStatus === 'all' ? undefined : filterStatus,
              limit: 50 
            });
          } else if (userRole === 'buyer') {
            orderData = await orderService.getBuyerOrders({ 
              status: filterStatus === 'all' ? undefined : filterStatus,
              limit: 50 
            });
          }
          
          const transformedOrders = (orderData?.orders || orderData || []).map(order => {
            const totalAmount = Number(order.subtotal || order.total || order.total_amount || order.amount || 0);
            return {
              id: order.id || order.order_id,
              buyerName: order.buyer_name || order.buyerName,
              buyerNameAm: order.buyer_name || order.buyerName,
              farmerName: order.farmer_name || order.farmerName,
              farmerNameAm: order.farmer_name || order.farmerName,
              product: order.listing_name || order.product_name || order.title || 'Product',
              productAm: order.listing_name || order.product_name || order.title || 'Product',
              quantity: order.quantity ? `${order.quantity}kg` : (order.items && order.items.length > 0 ? `${order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}kg` : 'N/A'),
              price: formatCurrency(totalAmount),
              totalAmount: totalAmount,
              status: order.status || 'pending',
              date: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              rating: order.rating || null,
              review: order.review || null,
              listingId: order.listing_id || order.produce_listing_id,
              rawOrder: order
            };
          });
          
          setOrders(transformedOrders);
        } catch (err) {
          console.error('Failed to reload orders:', err);
        }
      };
      
      loadOrders();
      alert(currentLanguage === 'am' ? 'ግምገማ በተሳካ ሁኔታ ተላከ!' : 'Review submitted successfully!');
    } catch (err) {
      console.error('Failed to submit review:', err);
      alert(currentLanguage === 'am' ? 'ግምገማ መላክ አልተሳካም።' : 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All Orders', labelAm: 'ሁሉም ትዕዛዞች' },
    { value: 'pending', label: 'Pending', labelAm: 'በመጠባበቅ ላይ' },
    { value: 'confirmed', label: 'Confirmed', labelAm: 'የተረጋገጠ' },
    { value: 'shipped', label: 'Shipped', labelAm: 'የተላከ' },
    { value: 'completed', label: 'Completed', labelAm: 'የተጠናቀቁ' },
    { value: 'cancelled', label: 'Cancelled', labelAm: 'የተሰረዙ' }
  ];

  const periodOptions = [
    { value: 'all', label: 'All Time', labelAm: 'ሁሉም ጊዜ' },
    { value: 'week', label: 'This Week', labelAm: 'በዚህ ሳምንት' },
    { value: 'month', label: 'This Month', labelAm: 'በዚህ ወር' },
    { value: 'quarter', label: 'Last 3 Months', labelAm: 'ባለፉት 3 ወራት' }
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        color: 'bg-warning/10 text-warning border-warning/20',
        icon: 'Clock',
        text: currentLanguage === 'am' ? 'በመጠባበቅ ላይ' : 'Pending'
      },
      confirmed: {
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: 'CheckCircle2',
        text: currentLanguage === 'am' ? 'የተረጋገጠ' : 'Confirmed'
      },
      shipped: {
        color: 'bg-primary/10 text-primary border-primary/20',
        icon: 'Truck',
        text: currentLanguage === 'am' ? 'የተላከ' : 'Shipped'
      },
      completed: {
        color: 'bg-success/10 text-success border-success/20',
        icon: 'CheckCircle',
        text: currentLanguage === 'am' ? 'ተጠናቅቋል' : 'Completed'
      },
      cancelled: {
        color: 'bg-error/10 text-error border-error/20',
        icon: 'XCircle',
        text: currentLanguage === 'am' ? 'ተሰርዟል' : 'Cancelled'
      }
    };

    const config = statusConfig?.[status];
    
    return (
      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${config?.color}`}>
        <Icon name={config?.icon} size={12} />
        <span>{config?.text}</span>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2
    })?.format(amount);
  };

  const renderStarRating = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5]?.map((star) => (
          <Icon
            key={star}
            name="Star"
            size={14}
            className={star <= rating ? 'text-accent fill-current' : 'text-muted'}
          />
        ))}
        <span className="text-sm text-text-secondary ml-1">({rating})</span>
      </div>
    );
  };

  const getLabel = (text, textAm) => {
    return currentLanguage === 'am' ? textAm : text;
  };

  const getOptionLabel = (option) => {
    return currentLanguage === 'am' && option?.labelAm ? option?.labelAm : option?.label;
  };

  const getPartnerName = (order) => {
    if (userRole === 'farmer') {
      return currentLanguage === 'am' ? order?.buyerNameAm : order?.buyerName;
    } else {
      return currentLanguage === 'am' ? order?.farmerNameAm : order?.farmerName;
    }
  };

  const getProductName = (order) => {
    return currentLanguage === 'am' ? order?.productAm : order?.product;
  };

  // Prefer detailed item names for modal; fallback to listing fields
  const getModalProductName = (order) => {
    if (!order) return 'Product';
    if (Array.isArray(order.items) && order.items.length > 0) {
      const names = order.items
        .map((it) => it?.name || it?.listing_title || it?.listing_name || it?.title)
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    const src = order.rawOrder || order;
    return (
      src?.listing_title ||
      src?.listing_name ||
      src?.product_name ||
      src?.title ||
      order?.product ||
      'Product'
    );
  };

  // Derive quantity display for modal
  const getQuantityDisplay = (order) => {
    if (!order) return 'N/A';
    if (order.quantity) return order.quantity; // already formatted like "10kg"
    if (order.rawOrder?.quantity) return `${order.rawOrder.quantity}kg`;
    if (Array.isArray(order.items) && order.items.length > 0) {
      const sumQty = order.items.reduce((sum, it) => sum + Number(it?.quantity || 0), 0);
      const unit = order.items[0]?.unit || 'kg';
      return sumQty ? `${sumQty}${unit}` : 'N/A';
    }
    return 'N/A';
  };

  // Derive numeric total for modal
  const getTotalAmountNumber = (order) => {
    if (!order) return 0;
    const direct = Number(
      order.totalAmount ??
      order.subtotal ??
      order.total ??
      order.total_amount ??
      order.amount ??
      order.totalPrice ??
      order.price ??
      0
    );
    if (direct > 0) return direct;
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.reduce((sum, it) => {
        const itemTotal = it?.total ?? (Number(it?.quantity || 0) * Number(it?.price_per_unit || 0));
        return sum + Number(itemTotal || 0);
      }, 0);
    }
    return 0;
  };

  const filteredOrders = orders?.filter(order => {
    if (filterStatus !== 'all' && order?.status !== filterStatus) return false;
    // Add period filtering logic here if needed
    return true;
  });

  return (
    <div className="bg-surface border border-border rounded-xl p-6 shadow-warm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">
          {getLabel('Order History', 'የትዕዛዝ ታሪክ')}
        </h2>
        <div className="flex items-center space-x-2">
          <Icon name="History" size={20} className="text-primary" />
          <span className="text-sm text-text-secondary">
            {filteredOrders?.length} {getLabel('orders', 'ትዕዛዞች')}
          </span>
        </div>
      </div>
      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Select
          label={getLabel('Filter by Status', 'በሁኔታ ማጣሪያ')}
          options={statusOptions?.map(option => ({
            value: option?.value,
            label: getOptionLabel(option)
          }))}
          value={filterStatus}
          onChange={setFilterStatus}
        />
        
        <Select
          label={getLabel('Filter by Period', 'በጊዜ ማጣሪያ')}
          options={periodOptions?.map(option => ({
            value: option?.value,
            label: getOptionLabel(option)
          }))}
          value={filterPeriod}
          onChange={setFilterPeriod}
        />
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-text-secondary">
              {getLabel('Loading orders...', 'ትዕዛዞችን በመጫን ላይ...')}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="AlertCircle" size={16} className="text-error" />
            <span className="text-error text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Orders List */}
      {!loading && !error && (
      <div className="space-y-4">
        {filteredOrders?.length > 0 ? (
          filteredOrders?.map((order) => (
            <div key={order?.id} className="border border-border rounded-lg p-4 hover:shadow-warm-md transition-smooth">
              {/* Mobile Layout */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-text-primary">#{order?.id}</h3>
                    <p className="text-sm text-text-secondary">
                      {userRole === 'farmer' ? getLabel('Buyer:', 'ገዢ:') : getLabel('Farmer:', 'ገበሬ:')} {getPartnerName(order)}
                    </p>
                  </div>
                  {getStatusBadge(order?.status)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">{getLabel('Product:', 'ምርት:')}</span>
                    <span className="text-sm font-medium text-text-primary">{getProductName(order)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">{getLabel('Quantity:', 'መጠን:')}</span>
                    <span className="text-sm font-medium text-text-primary">{order?.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">{getLabel('Price:', 'ዋጋ:')}</span>
                    <span className="text-sm font-bold text-primary">{order?.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">{getLabel('Date:', 'ቀን:')}</span>
                    <span className="text-sm text-text-primary">{new Date(order.date)?.toLocaleDateString()}</span>
                  </div>
                </div>

                {order?.rating && (
                  <div className="pt-3 border-t border-border">
                    {renderStarRating(order?.rating)}
                    {order?.review && (
                      <p className="text-sm text-text-secondary mt-2 line-clamp-2">
                        {order?.review}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    iconName="Eye" 
                    iconPosition="left"
                    onClick={() => handleViewDetails(order)}
                  >
                    {getLabel('View Details', 'ዝርዝር ይመልከቱ')}
                  </Button>
                  {order?.status === 'completed' && !order?.rating && order?.listingId && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      iconName="Star" 
                      iconPosition="left"
                      onClick={() => {
                        setReviewTarget({
                          listingId: order.listingId,
                          name: order.product,
                          orderId: order.id
                        });
                        setIsReviewOpen(true);
                      }}
                    >
                      {getLabel('Rate', 'ደረጃ ስጥ')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden lg:block">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <h3 className="font-medium text-text-primary">#{order?.id}</h3>
                    <span className="text-text-secondary">•</span>
                    <span className="text-sm text-text-secondary">
                      {userRole === 'farmer' ? getLabel('Buyer:', 'ገዢ:') : getLabel('Farmer:', 'ገበሬ:')} {getPartnerName(order)}
                    </span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-sm text-text-secondary">
                      {new Date(order.date)?.toLocaleDateString()}
                    </span>
                  </div>
                  {getStatusBadge(order?.status)}
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-text-secondary">{getLabel('Product', 'ምርት')}</span>
                    <p className="font-medium text-text-primary">{getProductName(order)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-text-secondary">{getLabel('Quantity', 'መጠን')}</span>
                    <p className="font-medium text-text-primary">{order?.quantity}</p>
                  </div>
                  <div>
                    <span className="text-sm text-text-secondary">{getLabel('Price', 'ዋጋ')}</span>
                    <p className="font-bold text-primary">{order?.price}</p>
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      iconName="Eye" 
                      iconPosition="left"
                      onClick={() => handleViewDetails(order)}
                    >
                      {getLabel('View Details', 'ዝርዝር ይመልከቱ')}
                    </Button>
                    {order?.status === 'completed' && !order?.rating && order?.listingId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        iconName="Star" 
                        iconPosition="left"
                        onClick={() => {
                          setReviewTarget({
                            listingId: order.listingId,
                            name: order.product,
                            orderId: order.id
                          });
                          setIsReviewOpen(true);
                        }}
                      >
                        {getLabel('Rate', 'ደረጃ ስጥ')}
                      </Button>
                    )}
                  </div>
                </div>

                {order?.rating && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {renderStarRating(order?.rating)}
                        {order?.review && (
                          <p className="text-sm text-text-secondary mt-2">
                            {order?.review}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Icon name="Package" size={48} className="text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {getLabel('No Orders Found', 'ምንም ትዕዛዝ አልተገኘም')}
            </h3>
            <p className="text-text-secondary">
              {getLabel(
                'No orders match your current filters. Try adjusting the filters above.',
                'ምንም ትዕዛዝ ከእርስዎ ማጣሪያዎች ጋር አይዛመድም። ከላይ ያሉትን ማጣሪያዎች ማስተካከል ይሞክሩ።'
              )}
            </p>
          </div>
        )}
      </div>
      )}

      {/* View Order Details Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {getLabel('Order Details', 'የትዕዛዝ ዝርዝር')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="X"
                  onClick={() => setViewingOrder(null)}
                />
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Order ID', 'የትዕዛዝ መለያ')}</span>
                  <p className="font-medium text-text-primary">#{viewingOrder.id}</p>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Status', 'ሁኔታ')}</span>
                  <div className="mt-1">{getStatusBadge(viewingOrder.status)}</div>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">
                    {userRole === 'farmer' ? getLabel('Buyer', 'ገዢ') : getLabel('Farmer', 'ገበሬ')}
                  </span>
                  <p className="font-medium text-text-primary">{getPartnerName(viewingOrder)}</p>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Date', 'ቀን')}</span>
                  <p className="font-medium text-text-primary">
                    {new Date(viewingOrder.date || viewingOrder.created_at || viewingOrder.rawOrder?.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Product', 'ምርት')}</span>
                  <p className="font-medium text-text-primary">{getModalProductName(viewingOrder)}</p>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Quantity', 'መጠን')}</span>
                  <p className="font-medium text-text-primary">{getQuantityDisplay(viewingOrder)}</p>
                </div>
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Price', 'ዋጋ')}</span>
                  <p className="font-bold text-primary">
                    {formatCurrency(getTotalAmountNumber(viewingOrder))}
                  </p>
                </div>
                {viewingOrder.delivery_address && (
                  <div>
                    <span className="text-sm text-text-secondary">{getLabel('Delivery Address', 'የማድረስ አድራሻ')}</span>
                    <p className="font-medium text-text-primary">{viewingOrder.delivery_address}</p>
                  </div>
                )}
              </div>
              {viewingOrder.notes && (
                <div>
                  <span className="text-sm text-text-secondary">{getLabel('Notes', 'ማስታወሻ')}</span>
                  <p className="font-medium text-text-primary mt-1">{viewingOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewOpen && reviewTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {getLabel('Rate Product', 'ምርት ደረጃ ስጥ')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="X"
                  onClick={() => setIsReviewOpen(false)}
                />
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-sm text-text-secondary">{getLabel('Product', 'ምርት')}</span>
                <p className="font-medium text-text-primary">{reviewTarget.name}</p>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {getLabel('Rating', 'ደረጃ')}
                </label>
                <select 
                  value={reviewRating} 
                  onChange={(e) => setReviewRating(Number(e.target.value))} 
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input"
                >
                  {[5,4,3,2,1].map(r => (
                    <option key={r} value={r}>
                      {r} {getLabel('stars', 'ኮከቦች')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {getLabel('Comment (optional)', 'አስተያየት (አማራጭ)')}
                </label>
                <textarea 
                  value={reviewComment} 
                  onChange={(e) => setReviewComment(e.target.value)} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input"
                  placeholder={getLabel('Share your experience...', 'ተሞክሮዎን ያካፍሉ...')}
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex space-x-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setIsReviewOpen(false)}
              >
                {getLabel('Cancel', 'ሰርዝ')}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={isSubmittingReview}
                onClick={handleReviewSubmit}
              >
                {getLabel('Submit', 'አቀርብ')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistorySection;