import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/apiService.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useLanguage } from '../hooks/useLanguage.jsx';
import Icon from './AppIcon.jsx';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAmharic = language === 'am';
  const text = isAmharic ? {
    title: 'ማሳወቂያዎች', markAll: 'ሁሉንም አንብብ', retry: 'እንደገና ሞክር', empty: 'እስካሁን ማሳወቂያ የለም', notification: 'ማሳወቂያ', fallback: 'አዲስ ማሳወቂያ አለዎት', error: 'ማሳወቂያዎችን መጫን አልተቻለም።'
  } : {
    title: 'Notifications', markAll: 'Mark all read', retry: 'Try again', empty: 'No notifications yet', notification: 'Notification', fallback: 'You have a new notification', error: 'Failed to load notifications'
  };
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getUserNotifications({
        limit: 50,
        unreadOnly: false
      });

      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.error || text.error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const getNotificationTitle = (type) => {
    switch (type) {
      case 'order_placed':
        return isAmharic ? 'አዲስ ትዕዛዝ' : 'New Order';
      case 'order_confirmed':
        return isAmharic ? 'ትዕዛዝ ተረጋግጧል' : 'Order Confirmed';
      case 'order_shipped':
        return isAmharic ? 'ትዕዛዝ ተልኳል' : 'Order Shipped';
      case 'order_delivered':
        return isAmharic ? 'ትዕዛዝ ደርሷል' : 'Order Delivered';
      case 'order_cancelled':
        return isAmharic ? 'ትዕዛዝ ተሰርዟል' : 'Order Cancelled';
      case 'new_listing':
        return isAmharic ? 'አዲስ ዝርዝር' : 'New Listing';
      case 'price_change':
        return isAmharic ? 'የዋጋ ለውጥ' : 'Price Change';
      case 'review_received':
        return isAmharic ? 'አዲስ ግምገማ' : 'New Review';
      case 'message':
        return isAmharic ? 'አዲስ መልዕክት' : 'New Message';
      case 'verification_document_uploaded':
        return isAmharic ? 'ሰነድ ተጭኗል' : 'Document Uploaded';
      case 'verification_document_approved':
        return isAmharic ? 'ሰነድ ጸድቋል' : 'Document Approved';
      case 'verification_document_rejected':
        return isAmharic ? 'ሰነድ ውድቅ ተደርጓል' : 'Document Rejected';
      case 'verification_document_pending':
        return isAmharic ? 'ሰነድ በመጠባበቅ ላይ' : 'Document Pending';
      case 'verification_document_uploaded_admin':
        return isAmharic ? 'አዲስ ሰነድ ለግምገማ' : 'New Document for Review';
      case 'listing_suspended':
        return isAmharic ? 'ዝርዝር ታግዷል' : 'Listing Suspended';
      case 'listing_activated':
        return isAmharic ? 'ዝርዝር ነቅቷል' : 'Listing Activated';
      default:
        return text.notification;
    }
  };

  const getNotificationMessage = (notification) => {
    return notification.payload?.message || text.fallback;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return isAmharic ? 'አሁን' : 'Just now';
    } else if (diffInHours < 24) {
      return isAmharic ? `ከ${Math.floor(diffInHours)} ሰዓት በፊት` : `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return isAmharic ? 'ትናንት' : 'Yesterday';
    } else {
      return date.toLocaleDateString(isAmharic ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              {text.title}
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {text.markAll}
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start space-x-3 p-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-red-600 mb-2">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {text.retry}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <div className="mb-2 flex justify-center"><Icon name="Bell" size={36} className="text-primary" /></div>
                <p>{text.empty}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <Icon name="Bell" size={20} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-800">
                            {getNotificationTitle(notification.type)}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {getNotificationMessage(notification)}
                        </p>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;

