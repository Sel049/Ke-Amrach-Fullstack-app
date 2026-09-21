import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/apiService.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/AppIcon.jsx';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isAmharic = language === 'am';
  const text = isAmharic ? {
    login: 'እባክዎ ይግቡ', loginHint: 'ማሳወቂያዎችን ለማየት መግባት አለብዎት።', loginAction: 'ወደ መግቢያ ይሂዱ',
    title: 'ማሳወቂያዎች', back: 'ተመለስ', markAll: 'ሁሉንም እንደተነበበ ምልክት አድርግ', unread: 'ያልተነበቡ ማሳወቂያዎች', caughtUp: 'ሁሉም ተነብበዋል',
    all: 'ሁሉም', unreadTab: 'ያልተነበቡ', read: 'የተነበቡ', markRead: 'እንደተነበበ ምልክት አድርግ', noUnread: 'ያልተነበቡ ማሳወቂያዎች የሉም', noRead: 'የተነበቡ ማሳወቂያዎች የሉም', noNotifications: 'እስካሁን ማሳወቂያ የለም', caughtUpHint: 'ሁሉም ተነብበዋል።', activityHint: 'እንቅስቃሴ ሲኖር ማሳወቂያዎች እዚህ ይታያሉ።', loadMore: 'ተጨማሪ ጫን', loading: 'በመጫን ላይ...', retry: 'እንደገና ሞክር', notification: 'ማሳወቂያ'
  } : {
    login: 'Please Log In', loginHint: 'You need to be logged in to view notifications.', loginAction: 'Go to Login',
    title: 'Notifications', back: 'Back', markAll: 'Mark All Read', unread: 'unread notifications', caughtUp: 'All caught up!',
    all: 'All', unreadTab: 'Unread', read: 'Read', markRead: 'Mark as read', noUnread: 'No unread notifications', noRead: 'No read notifications', noNotifications: 'No notifications yet', caughtUpHint: "You're all caught up!", activityHint: 'Notifications will appear here when you have activity.', loadMore: 'Load More', loading: 'Loading...', retry: 'Try Again', notification: 'Notification'
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
    }
  }, [isAuthenticated, user, filter, page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        unreadOnly: filter === 'unread'
      };

      const response = await notificationService.getUserNotifications(params);

      if (page === 1) {
        setNotifications(response.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(response.notifications || [])]);
      }

      setHasMore(response.hasMore || false);
    } catch (err) {
      setError(err.response?.data?.error || (isAmharic ? 'ማሳወቂያዎችን መጫን አልተቻለም።' : 'Failed to load notifications'));
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
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order_placed':
        return '🛒';
      case 'order_confirmed':
        return '✅';
      case 'order_shipped':
        return '🚚';
      case 'order_delivered':
        return '📦';
      case 'order_cancelled':
        return '❌';
      case 'new_listing':
        return '🆕';
      case 'price_change':
        return '💰';
      case 'review_received':
        return '⭐';
      case 'message':
        return '💬';
      default:
        return '🔔';
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
      default:
        return text.notification;
    }
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
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.is_read;
    if (filter === 'read') return notif.is_read;
    return true;
  });

  const unreadCount = notifications.filter(notif => !notif.is_read).length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{text.login}</h1>
            <p className="text-gray-600 mb-6">{text.loginHint}</p>
            <Button onClick={() => navigate('/authentication-login-register')}>
              {text.loginAction}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center space-x-2"
            >
              <Icon name="ArrowLeft" size={16} />
              <span>{text.back}</span>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">{text.title}</h1>
              <p className="text-gray-600">
                {unreadCount > 0 ? `${unreadCount} ${text.unread}` : text.caughtUp}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline">
              {text.markAll}
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex w-fit max-w-full space-x-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
          {[
            { key: 'all', label: text.all },
            { key: 'unread', label: text.unreadTab },
            { key: 'read', label: text.read }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading && notifications.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 mb-2">{error}</p>
              <Button onClick={fetchNotifications} variant="outline">
                Try Again
              </Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-4 text-4xl sm:text-6xl">🔔</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                {filter === 'unread' ? text.noUnread : filter === 'read' ? text.noRead : text.noNotifications}
              </h3>
              <p className="text-gray-600">
                {filter === 'unread' ? text.caughtUpHint : text.activityHint}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm p-3 sm:p-4 transition-colors ${
                  !notification.is_read ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl sm:h-10 sm:w-10 sm:text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="min-w-0 text-sm font-medium text-gray-800 sm:text-base">
                        {getNotificationTitle(notification.type)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-gray-500 sm:text-xs">
                          {formatDate(notification.created_at)}
                        </span>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {notification.payload?.message || 'You have a new notification'}
                    </p>
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        {text.markRead}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Load More Button */}
          {hasMore && !loading && (
            <div className="text-center pt-4">
              <Button
                onClick={() => setPage(prev => prev + 1)}
                variant="outline"
                disabled={loading}
              >
                {loading ? text.loading : text.loadMore}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;

