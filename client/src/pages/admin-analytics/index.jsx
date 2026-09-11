import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Card from '../../components/ui/Card.jsx';
import Icon from '../../components/AppIcon.jsx';
import Button from '../../components/ui/Button.jsx';
import { dashboardService } from '../../services/apiService.js';

const AdminAnalytics = () => {
  const { user, isAuthenticated } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    revenue: {
      total: 0,
      growth: 0,
      chart: []
    },
    users: {
      total: 0,
      growth: 0,
      chart: []
    },
    orders: {
      total: 0,
      growth: 0,
      chart: []
    },
    listings: {
      total: 0,
      growth: 0,
      chart: []
    }
  });

  const [topFarmersData, setTopFarmersData] = useState([]);
  const [topCategoriesData, setTopCategoriesData] = useState([]);
  const [recentActivityData, setRecentActivityData] = useState([]);

  // Format rating like reviews/profile header
  const formatAverage = (value) => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    const fixed = Number(n.toFixed(1));
    return (fixed % 1 === 0) ? String(Math.trunc(fixed)) : String(fixed);
  };

  // Map month number to abbreviated name
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Normalize API chart buckets [{ label: 'YYYY-MM-DD' | 'YYYY-MM-01', value }] -> [{ month, value }]
  // Label density is chosen per period so the axis stays readable (7 days -> weekday,
  // 30 days -> day-of-month, 90 days -> "12 Aug", 1 year -> month name).
  const normalizeChart = (chartRaw, period) => {
    if (!Array.isArray(chartRaw) || chartRaw.length === 0) return [];
    return chartRaw.map((item) => {
      const raw = String(item?.label ?? item?.k ?? item?.date ?? '');
      const value = Number(item?.value ?? item?.v ?? 0) || 0;
      const d = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
      let month = raw;
      if (!Number.isNaN(d.getTime())) {
        if (period === '7d') month = dayNames[d.getUTCDay()];
        else if (period === '30d') month = String(d.getUTCDate());
        else if (period === '90d') month = `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;
        else month = monthNames[d.getUTCMonth()];
      }
      return { month, value };
    });
  };

  // Keep charts readable: when a period produces many buckets (e.g. 30 daily
  // bars for "Last 30 days"), group consecutive buckets so at most `maxBars`
  // bars render. Values are summed; the label is the last bucket of the group.
  const compactChart = (chart, maxBars = 13) => {
    if (!Array.isArray(chart) || chart.length <= maxBars) return chart || [];
    const groupSize = Math.ceil(chart.length / maxBars);
    const compacted = [];
    for (let i = 0; i < chart.length; i += groupSize) {
      const slice = chart.slice(i, i + groupSize);
      compacted.push({
        month: slice[slice.length - 1].month,
        value: slice.reduce((sum, point) => sum + (Number(point.value) || 0), 0)
      });
    }
    return compacted;
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const response = await dashboardService.getAdminAnalytics({ period: timeRange });
      
      // Map API response to component state
      setAnalyticsData({
        revenue: {
          total: Number(response.revenue?.total ?? 0),
          growth: Number(response.revenue?.growth ?? 0),
          chart: compactChart(normalizeChart(response.revenue?.chart, timeRange))
        },
        users: {
          total: Number(response.users?.total ?? 0),
          growth: Number(response.users?.growth ?? 0),
          chart: compactChart(normalizeChart(response.users?.chart, timeRange))
        },
        orders: {
          total: Number(response.orders?.total ?? 0),
          growth: Number(response.orders?.growth ?? 0),
          chart: compactChart(normalizeChart(response.orders?.chart, timeRange))
        },
        listings: {
          total: Number(response.listings?.total ?? 0),
          growth: Number(response.listings?.growth ?? 0),
          chart: compactChart(normalizeChart(response.listings?.chart, timeRange))
        }
      });
      
      // Set top farmers, categories, and recent activity from API
      setTopFarmersData(response.topFarmers || []);
      setTopCategoriesData(response.topCategories || []);
      setRecentActivityData(response.recentActivity || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Export analytics data to CSV
  const exportToCSV = () => {
    try {
      const rows = [
        ['Ke-Amrach Analytics Report'],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Time Range: ${timeRange}`],
        [],
        ['Summary KPIs'],
        ['Metric', 'Total', 'Growth (%)'],
        ['Revenue', `ETB ${analyticsData.revenue.total.toLocaleString()}`, `${analyticsData.revenue.growth}%`],
        ['Users', analyticsData.users.total.toLocaleString(), `${analyticsData.users.growth}%`],
        ['Orders', analyticsData.orders.total.toLocaleString(), `${analyticsData.orders.growth}%`],
        ['Listings', analyticsData.listings.total.toLocaleString(), `${analyticsData.listings.growth}%`],
        [],
        ['Category Distribution'],
        ['Category', 'Revenue (%)', 'Revenue (ETB)']
      ];
      
      // Only real data is exported - sections with no data for the selected
      // time range get an explicit "no data" row instead of sample values.
      if (topCategoriesData.length > 0) {
        topCategoriesData.forEach(c => {
          rows.push([c.name, `${c.value}%`, `ETB ${(c.revenue || 0).toLocaleString()}`]);
        });
      } else {
        rows.push(['No category data for the selected time range']);
      }
      
      rows.push([]);
      rows.push(['Top Farmers']);
      rows.push(['Rank', 'Name', 'Orders', 'Revenue (ETB)', 'Rating']);
      if (topFarmersData.length > 0) {
        topFarmersData.forEach((f, i) => {
          rows.push([i + 1, f.name, f.orders, (f.revenue || 0).toLocaleString(), formatAverage(f.rating) || 'N/A']);
        });
      } else {
        rows.push(['No farmer data for the selected time range']);
      }
      
      rows.push([]);
      rows.push(['Recent Activity']);
      rows.push(['Type', 'Message', 'Value', 'Time']);
      if (recentActivityData.length > 0) {
        recentActivityData.forEach(a => {
          rows.push([a.type, a.message, a.value, a.time]);
        });
      } else {
        rows.push(['No activity data for the selected time range']);
      }
      
      const csvContent = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      order: 'ShoppingCart',
      user: 'UserPlus',
      listing: 'Package',
      payment: 'DollarSign',
      delivery: 'Truck'
    };
    return icons[type] || 'Activity';
  };

  const getActivityColor = (type) => {
    const colors = {
      order: 'text-blue-600',
      user: 'text-green-600',
      listing: 'text-purple-600',
      payment: 'text-emerald-600',
      delivery: 'text-orange-600'
    };
    return colors[type] || 'text-gray-600';
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
          <Icon name="Shield" size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-gray-600">Access Denied</p>
        </div>
      </div>
    );
  }

  // Safe max for charts (avoids Math.max on empty arrays)
  const chartMax = (chart) => {
    if (!Array.isArray(chart) || chart.length === 0) return 1;
    const max = Math.max(...chart.map(d => d.value ?? 0));
    return max > 0 ? max : 1;
  };

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700">
          <div className="px-4 mx-auto max-w-7xl lg:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Business intelligence and performance insights
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
                <Button variant="outline" size="sm" iconName="Download" onClick={exportToCSV}>Export Report</Button>
                <Button variant="primary" size="sm" iconName="RefreshCw" onClick={loadAnalyticsData}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mx-auto max-w-7xl lg:px-6 py-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    ETB {analyticsData.revenue.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                    <Icon name="TrendingUp" size={12} className="mr-1" />
                    +{analyticsData.revenue.growth}% from last period
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="DollarSign" size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Users</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {analyticsData.users.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center mt-1">
                    <Icon name="TrendingUp" size={12} className="mr-1" />
                    +{analyticsData.users.growth}% from last period
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="Users" size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Orders</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {analyticsData.orders.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center mt-1">
                    <Icon name="TrendingUp" size={12} className="mr-1" />
                    +{analyticsData.orders.growth}% from last period
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="ShoppingCart" size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Listings</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {analyticsData.listings.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                    <Icon name="TrendingUp" size={12} className="mr-1" />
                    +{analyticsData.listings.growth}% from last period
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Icon name="Package" size={24} className="text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts and Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue Chart */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
                <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
              </div>
              <div className="h-64 flex items-end space-x-1">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : analyticsData.revenue.chart.length > 0 ? (
                  analyticsData.revenue.chart.map((item, index) => (
                    <div key={index} className="flex-1 min-w-0 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t"
                        style={{ height: `${(item.value / chartMax(analyticsData.revenue.chart)) * 200}px` }}
                      ></div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-2 whitespace-nowrap">{item.month}</span>
                      <span className="text-[10px] font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        ETB {(item.value / 1000).toFixed(0)}k
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">No revenue data</div>
                )}
              </div>
            </Card>

            {/* Category Distribution */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Category Distribution</h3>
                <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
              </div>
              <div className="space-y-4">
                {topCategoriesData.length > 0 ? (
                  topCategoriesData.map((category, index) => {
                    // Map API colors or use defaults
                    const colors = ['bg-amber-500', 'bg-amber-600', 'bg-green-500', 'bg-orange-500', 'bg-red-500'];
                    const color = category.color || colors[index % colors.length];
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${color}`}></div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{category.name}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${color}`}
                              style={{ width: `${Math.min(category.value, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-400 w-16 text-right">
                            {category.value}%
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white w-20 text-right">
                            ETB {(category.revenue || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No category data for the selected time range</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Top Performers and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Farmers */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Top Performing Farmers</h3>
                <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
              </div>
               <div className="space-y-4">
                 {topFarmersData.length > 0 ? (
                   topFarmersData.map((farmer, index) => (
                     <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                       <div className="flex items-center space-x-3">
                         <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                           <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{index + 1}</span>
                         </div>
                         <div>
                           <p className="text-sm font-medium text-slate-900 dark:text-white">{farmer.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {farmer.orders} orders • {formatAverage(farmer.rating) || 'N/A'}★
                          </p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-sm font-medium text-slate-900 dark:text-white">ETB {(farmer.revenue || 0).toLocaleString()}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                     <Icon name="Users" size={48} className="mx-auto mb-2 opacity-50" />
                     <p>No farmer data available</p>
                   </div>
                 )}
               </div>
            </Card>

            {/* Recent Activity */}
          <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
              </div>
              <div className="space-y-4">
                {recentActivityData.length > 0 ? (
                  recentActivityData.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className={`w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon name={getActivityIcon(activity.type)} size={16} className={getActivityColor(activity.type)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white">{activity.message}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400">{activity.time}</p>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{activity.value}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <Icon name="Activity" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No activity data for the selected time range</p>
                  </div>
                )}
              </div>
          </Card>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminAnalytics;
