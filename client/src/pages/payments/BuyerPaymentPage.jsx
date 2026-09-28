import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/AppIcon.jsx';
import OrderSuccessModal from '../../components/payment/OrderSuccessModal.jsx';
import { orderService, chapaService } from '../../services/apiService.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCart } from '../../hooks/useCart.jsx';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const BuyerPaymentPage = () => {
  const { user } = useAuth();
  const { items: cartItems, totalCost, clear: clearCart } = useCart();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Payment form states
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentData, setPaymentData] = useState({});
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Order success modal state
  const [successOrder, setSuccessOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('farmconnect_language') || 'en';
    setCurrentLanguage(savedLanguage);
  }, []);

  useEffect(() => { 
    if (language !== currentLanguage) setCurrentLanguage(language); 
  }, [language]);

  useEffect(() => { 
    load(1);
  }, []);

  const load = async (requestedPage = 1) => {
    try {
      setLoading(true);
      // Use buyer orders and derive payments (completed orders as paid)
      const res = await orderService.getBuyerOrders({ status: 'completed', page: requestedPage, limit: 10 });
      const items = Array.isArray(res) ? res : (res.orders || []);
      const mapped = items.map(o => ({
        id: o.id,
        amount: Number(o.totalPrice || o.total || 0),
        createdAt: o.createdAt || o.created_at,
        farmerName: o.farmerName,
        reference: `ORD-${o.id}`,
        method: o.paymentMethod || 'Cash',
        status: 'paid'
      }));
      setPayments(previous => {
        if (requestedPage === 1) return mapped;

        const seenIds = new Set(previous.map(payment => payment.id));
        return [...previous, ...mapped.filter(payment => {
          if (seenIds.has(payment.id)) return false;
          seenIds.add(payment.id);
          return true;
        })];
      });
      setHasMore(res?.pagination?.hasNext || false);
      setPage(requestedPage);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    return { count: payments.length, total };
  }, [payments]);

  const handlePaymentMethodChange = (method) => {
    setSelectedPaymentMethod(method);
    setPaymentData({});
  };

  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const processPayment = async () => {
    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Please provide a delivery address');
      return;
    }

    try {
      setProcessingPayment(true);
      setError('');

      const orderItems = cartItems.map(item => ({
        listingId: item.id,
        quantity: item.quantity,
        pricePerKg: item.pricePerKg,
        totalPrice: item.pricePerKg * item.quantity
      }));

      // --- Chapa (online checkout) -------------------------------
      // Creates the order plus a pending payment row on the server and
      // returns a hosted checkout URL. The browser is handed off to Chapa;
      // /payments/verify finalises the order once Chapa redirects back.
      if (selectedPaymentMethod === 'chapa') {
        const result = await chapaService.initializePayment({
          items: orderItems,
          totalPrice: totalCost,
          deliveryAddress,
          deliveryNotes,
          paymentMethod: 'chapa',
        });

        if (!result?.success || !result?.checkoutUrl) {
          throw new Error(result?.error || 'Could not start the Chapa checkout. Please try again.');
        }

        // The cart is cleared on /payments/verify once payment succeeds
        window.location.href = result.checkoutUrl;
        return;
      }

      // --- Cash on delivery / other manual methods ---------------
      const orderData = {
        items: orderItems,
        totalPrice: totalCost,
        deliveryAddress,
        deliveryNotes,
        paymentMethod: selectedPaymentMethod,
        paymentData
      };

      const res = await orderService.createOrder(orderData);

      clearCart();
      setShowPaymentForm(false);
      setSuccessOrder({
        id: res?.order?.id ?? res?.orderId,
        total: totalCost,
        currency: 'ETB',
        paymentMethod: selectedPaymentMethod,
        itemCount: orderItems.length,
        farmerName: res?.order?.farmerName,
      });
      setShowSuccessModal(true);

    } catch (error) {
      const errorMessage = error?.response?.data?.error
        || error?.message
        || 'Payment failed. Please try again.';
      const serverDetails = error?.response?.data?.details;
      setError(import.meta.env.DEV && serverDetails
        ? `${errorMessage}: ${serverDetails}`
        : errorMessage);
    } finally {
      setProcessingPayment(false);
    }
  };

  const paymentMethods = [
    {
      id: 'chapa',
      name: currentLanguage === 'am' ? 'ቻፓ (የመስመር ላይ)' : 'Chapa (Online)',
      icon: 'ShieldCheck',
      description: currentLanguage === 'am'
        ? 'Telebirr, CBE Birr, Awash, ዴቢት ካርድ'
        : 'Telebirr, CBE Birr, Awash, Debit Card',
      badges: ['Telebirr', 'CBE', 'Awash', 'Debit Card'],
      recommended: true,
    },
    {
      id: 'cash_on_delivery',
      name: currentLanguage === 'am' ? 'በማድረሻ ገንዘብ' : 'Cash on Delivery',
      icon: 'Banknote',
      description: currentLanguage === 'am' ? 'በምርቱ ሲደርስ ይክፈሉ' : 'Pay when the product arrives'
    }
  ];

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">
            {currentLanguage === 'am' ? 'ክፍያ እና ትዕዛዝ' : 'Payment & Orders'}
          </h1>
          <Button variant="outline" size="sm" iconName="RefreshCw" onClick={() => load(1)}>
            {currentLanguage === 'am' ? 'አድስ' : 'Refresh'}
          </Button>
        </div>

        {/* Cart Summary & Checkout */}
        {cartItems.length > 0 && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {currentLanguage === 'am' ? 'የጋሪ ማጠቃለያ' : 'Cart Summary'}
              </h2>
              <span className="text-sm text-text-secondary">
                {cartItems.length} {currentLanguage === 'am' ? 'እቃዎች' : 'items'}
              </span>
            </div>
            
            <div className="space-y-3 mb-4">
              {cartItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">{item.name}</h3>
                    <p className="text-sm text-text-secondary">
                      {item.quantity} kg × ETB {item.pricePerKg}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text-primary">
                      ETB {(item.quantity * item.pricePerKg).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-lg font-bold text-text-primary">
                <span>{currentLanguage === 'am' ? 'ጠቅላላ ዋጋ' : 'Total'}</span>
                <span>ETB {totalCost.toFixed(2)}</span>
              </div>
              
              <div className="mt-4">
                <Button 
                  onClick={() => setShowPaymentForm(true)}
                  className="w-full"
                  size="lg"
                >
                  <Icon name="CreditCard" className="mr-2" />
                  {currentLanguage === 'am' ? 'ክፍያ ይፈጽሙ' : 'Proceed to Payment'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Form Modal */}
        {showPaymentForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-text-primary">
                    {currentLanguage === 'am' ? 'ክፍያ ይፈጽሙ' : 'Complete Payment'}
                  </h2>
                  <Button
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowPaymentForm(false)}
                  >
                    <Icon name="X" />
                  </Button>
                </div>

                {/* Delivery Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    {currentLanguage === 'am' ? 'የማድረሻ መረጃ' : 'Delivery Information'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        {currentLanguage === 'am' ? 'የማድረሻ አድራሻ' : 'Delivery Address'} *
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows={3}
                        placeholder={currentLanguage === 'am' ? 'የማድረሻ አድራሻዎን ያስገቡ...' : 'Enter your delivery address...'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        {currentLanguage === 'am' ? 'ተጨማሪ ማስታወሻዎች' : 'Additional Notes'}
                      </label>
                      <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows={2}
                        placeholder={currentLanguage === 'am' ? 'ለገበያው ማስታወሻዎች...' : 'Notes for the farmer...'}
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    {currentLanguage === 'am' ? 'የክፍያ ዘዴ' : 'Payment Method'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handlePaymentMethodChange(method.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedPaymentMethod === method.id ? 'bg-primary/10' : 'bg-gray-100'
                          }`}>
                            <Icon name={method.icon} size={20} className={
                              selectedPaymentMethod === method.id ? 'text-primary' : 'text-gray-600'
                            } />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-text-primary">{method.name}</h4>
                              {method.recommended && (
                                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">
                                  {currentLanguage === 'am' ? 'የሚመከር' : 'Recommended'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-secondary">{method.description}</p>
                            {Array.isArray(method.badges) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {method.badges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-border"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chapa redirect notice */}
                {selectedPaymentMethod === 'chapa' && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Icon name="ShieldCheck" size={20} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text-primary mb-1">
                          {currentLanguage === 'am' ? 'ደህንነቱ የተጠበቀ የChapa ክፍያ' : 'Secure Chapa Checkout'}
                        </p>
                        <p className="text-sm text-text-secondary mb-3">
                          {currentLanguage === 'am'
                            ? '“ትዕዛዝ ይፈጽሙ” ሲጫኑ ወደ Chapa የክፍያ ገጽ ይሄዳሉ። በTelebirr፣ CBE Birr፣ Awash ወይም በዴቢት ካርድ ይክፈሉ።'
                            : 'Clicking “Place Order” takes you to Chapa’s secure payment page, where you can pay with Telebirr, CBE Birr, Awash or a debit card.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['Telebirr', 'CBE Birr', 'Awash', 'Debit Card'].map((badge) => (
                            <span
                              key={badge}
                              className="text-xs px-2 py-1 rounded-full bg-white border border-primary/20 text-text-secondary"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash on delivery notice */}
                {selectedPaymentMethod === 'cash_on_delivery' && (
                  <div className="mb-6 p-4 bg-warning/5 border border-warning/20 rounded-lg flex items-start space-x-3">
                    <Icon name="Banknote" size={20} className="text-warning mt-0.5 shrink-0" />
                    <p className="text-sm text-text-secondary">
                      {currentLanguage === 'am'
                        ? 'ገንዘቡን ምርቱ ሲደርስ ለገበሬው ይክፈላሉ።'
                        : 'You will pay the farmer in cash when your order is delivered.'}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowPaymentForm(false)}
                    className="flex-1"
                  >
                    {currentLanguage === 'am' ? 'ይሰርዙ' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={processPayment}
                    disabled={processingPayment}
                    className="flex-1"
                  >
                    {processingPayment ? (
                      <>
                        <Icon name="Loader2" className="mr-2 animate-spin" />
                        {currentLanguage === 'am' ? 'በማስተላለፍ ላይ...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <Icon name="CreditCard" className="mr-2" />
                        {currentLanguage === 'am' ? 'ትዕዛዝ ይፈጽሙ' : 'Place Order'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Icon name="CreditCard" size={16} className="text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">ETB {totals.total.toFixed(2)}</div>
              <div className="text-sm text-text-secondary">
                {currentLanguage === 'am' ? 'ጠቅላላ የተከፈለ' : 'Total Paid'}
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Hash" size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{totals.count}</div>
              <div className="text-sm text-text-secondary">
                {currentLanguage === 'am' ? 'ክፍያዎች' : 'Payments'}
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-card border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-text-primary">
              {currentLanguage === 'am' ? 'የክፍያ ታሪክ' : 'Payment History'}
            </h2>
          </div>
          <div className="divide-y">
            {loading && payments.length === 0 && (
              <div className="p-6 text-center text-text-secondary">
                {currentLanguage === 'am' ? 'ክፍያዎች በመጫን ላይ...' : 'Loading payments...'}
              </div>
            )}
            {error && (
              <div className="p-4 text-error">{error}</div>
            )}
            {payments.length === 0 && !loading && (
              <div className="p-6 text-center text-text-secondary">
                {currentLanguage === 'am' ? 'ምንም ክፍያ አልተገኘም' : 'No payments found'}
              </div>
            )}
            {payments.map(p => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">{p.reference}</div>
                  <div className="text-sm text-text-secondary">
                    {new Date(p.createdAt).toLocaleString()} • {p.method}
                  </div>
                  {p.farmerName && (
                    <div className="text-sm text-text-secondary">
                      {currentLanguage === 'am' ? 'ከ' : 'From'}: {p.farmerName}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-text-primary">ETB {p.amount.toFixed(2)}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                    {currentLanguage === 'am' ? 'ተከፍሏል' : 'Paid'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center py-4 border-t">
                <Button variant="outline" onClick={() => load(page + 1)}>
                {currentLanguage === 'am' ? 'ተጨማሪ ጫን' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        order={successOrder || {}}
        language={currentLanguage}
      />
    </AuthenticatedLayout>
  );
};

export default BuyerPaymentPage;
