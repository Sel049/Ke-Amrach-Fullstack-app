import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Card from '../../components/ui/Card.jsx';
import Icon from '../../components/AppIcon.jsx';
import Button from '../../components/ui/Button.jsx';
import { dashboardService } from '../../services/apiService';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeListings: 0,
    totalOrders: 0,
    revenue: 0,
    newUsersToday: 0,
    pendingOrders: 0,
    verifiedFarmers: 0,
    activeBuyers: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    status: 'healthy',
    uptime: '99.9%',
    lastBackup: '2 hours ago'
  });

  React.useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      // Admin user, stay on dashboard
      loadDashboardData();
      return;
    } else if (isAuthenticated) {
      // Redirect non-admin users to their appropriate dashboard
      const fallback = user?.role === 'farmer' ? '/dashboard-farmer-home' : '/dashboard-buyer-home';
      navigate(fallback);
    } else {
      navigate('/authentication-login-register');
    }
  }, [isAuthenticated, user, navigate]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await dashboardService.getAdminDashboard();

      const platform = data?.platformStats || {};
      const totalFarmers = Number(platform.total_farmers || 0);
      const totalBuyers = Number(platform.total_buyers || 0);
      const activeListings = Number(platform.active_listings || 0);
      const totalOrders = Number(platform.total_orders || 0);
      const totalRevenue = Number(platform.total_transactions || 0);

      // Compute new users in last 24h from recentActivity of type 'new_user'
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const newUsersToday = Array.isArray(data?.recentActivity)
        ? data.recentActivity.filter(a => a.type === 'new_user' && new Date(a.timestamp) >= twentyFourHoursAgo).length
        : 0;

      setStats({
        totalUsers: totalFarmers + totalBuyers,
        activeListings,
        totalOrders,
        revenue: totalRevenue,
        newUsersToday,
        // Pending orders not provided by this endpoint; show 0 for now
        pendingOrders: 0,
        verifiedFarmers: totalFarmers, // placeholder until verification flag exists
        activeBuyers: totalBuyers
      });

      // Map recent activity to UI-friendly format
      const recent = (data?.recentActivity || []).map((a, idx) => {
        let icon = 'Activity';
        if (a.type === 'new_user') icon = 'UserPlus';
        else if (a.type === 'new_listing') icon = 'Package';
        else if (a.type === 'new_order') icon = 'ShoppingCart';
        const time = new Date(a.timestamp).toLocaleString();
        const message = a.type === 'new_user'
          ? `New ${a.role} registered: ${a.name}`
          : a.type === 'new_listing'
            ? `New listing created: ${a.name}`
            : a.type === 'new_order'
              ? `${a.name} placed`
              : a.name || a.type;
        return { id: idx + 1, type: a.type, message, time, icon };
      });
      setRecentActivity(recent);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Icon name="Loader2" size={48} className="animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading...</p>
        </div>
          </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Icon name="Shield" size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-gray-600">Access Denied</p>
        </div>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Modern Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700">
          <div className="px-4 mx-auto max-w-7xl lg:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {language === 'am' ? 'የአስተዳዳሪ ዳሽቦርድ' : 'Admin Dashboard'}
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Welcome back, {user?.name || 'Admin'} • {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="RefreshCw"
                  onClick={loadDashboardData}
                  loading={isLoading}
                >
                  {language === 'am' ? 'አድስ' : 'Refresh'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  iconName="Download"
                  onClick={() => navigate('/admin-analytics')}
                >
                  {language === 'am' ? 'ትንታኔዎችን ይመልከቱ' : 'View Analytics'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mx-auto max-w-7xl lg:px-6 py-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Users */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ጠቅላላ ተጠቃሚዎች' : 'Total Users'}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                    <Icon name="TrendingUp" size={12} className="mr-1" />
                    +{stats.newUsersToday} {language === 'am' ? 'ዛሬ' : 'today'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="Users" size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            {/* Active Listings */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ንቁ ዝርዝሮች' : 'Active Listings'}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeListings.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.verifiedFarmers} {language === 'am' ? 'የተረጋገጡ ገበሬዎች' : 'verified farmers'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="Package" size={24} className="text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>

            {/* Total Orders */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ጠቅላላ ትእዛዞች' : 'Total Orders'}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalOrders.toLocaleString()}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center mt-1">
                    <Icon name="Clock" size={12} className="mr-1" />
                    {stats.pendingOrders} {language === 'am' ? 'በመጠባበቅ ላይ' : 'pending'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="ShoppingCart" size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>

            {/* Revenue */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ጠቅላላ ገቢ' : 'Total Revenue'}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">ETB {stats.revenue.toLocaleString()}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                    <Icon name="DollarSign" size={12} className="mr-1" />
                    +12% {language === 'am' ? 'ይህ ወር' : 'this month'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="DollarSign" size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'ፈጣን እርምጃዎች' : 'Quick Actions'}</h3>
                  <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => navigate('/admin-users')}
                    className="group p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="Users" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'የተጠቃሚ አስተዳደር' : 'User Management'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'ተጠቃሚዎችን እና ፍቃዶችን ያቀናብሩ' : 'Manage users and permissions'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/admin-listings')}
                    className="group p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl hover:from-green-100 hover:to-green-200 dark:hover:from-green-900/30 dark:hover:to-green-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="Package" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ዝርዝሮች' : 'Listings'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'የምርት ዝርዝሮችን ያቀናብሩ' : 'Manage product listings'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/admin-orders')}
                    className="group p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="ShoppingCart" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ትእዛዞች' : 'Orders'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'ትእዛዞችን ይከታተሉ እና ያቀናብሩ' : 'Track and manage orders'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/admin-analytics')}
                    className="group p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-900/30 dark:hover:to-orange-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="BarChart3" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ትንታኔ' : 'Analytics'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'ሪፖርቶችን እና ግንዛቤዎችን ይመልከቱ' : 'View reports and insights'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/admin-settings')}
                    className="group p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 rounded-xl hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-900/30 dark:hover:to-gray-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="Settings" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ቅንብሮች' : 'Settings'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'የስርዓት ቅንብር' : 'System configuration'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/admin-verification')}
                    className="group p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-900/30 dark:hover:to-indigo-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="Shield" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ማረጋገጫ' : 'Verification'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'ሰነዶችን ያረጋግጡ' : 'Review verification documents'}</p>
                  </button>

                  <button
                    onClick={() => navigate('/notifications')}
                    className="group p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/30 dark:hover:to-red-800/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="Bell" size={24} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{language === 'am' ? 'ማስታወቂያዎች' : 'Notifications'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'የስርዓት ማስጠንቀቂያዎች እና እድሳት' : 'System alerts and updates'}</p>
                  </button>
                </div>
              </Card>
            </div>

            {/* Recent Activity & System Health */}
            <div className="space-y-6">
              {/* Recent Activity */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'ቅርብ እንቅስቃሴ' : 'Recent Activity'}</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/admin-orders')}>
                    View All
                  </Button>
                </div>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon name={activity.icon} size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white">{activity.message}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* System Health */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{language === 'am' ? 'የስርዓት ጤና' : 'System Health'}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'ሁኔታ' : 'Status'}</span>
                    <span className="flex items-center text-sm font-medium text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {systemHealth.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'የሚሰራበት ሰዓት' : 'Uptime'}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{systemHealth.uptime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{language === 'am' ? 'የመጨረሻ ቅጂ' : 'Last Backup'}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{systemHealth.lastBackup}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminDashboard;

