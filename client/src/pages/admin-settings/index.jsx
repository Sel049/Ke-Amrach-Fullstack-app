import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { usePublicSettings } from '../../hooks/usePublicSettings.jsx';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Card from '../../components/ui/Card.jsx';
import Icon from '../../components/AppIcon.jsx';
import Button from '../../components/ui/Button.jsx';
import { settingsService } from '../../services/apiService.js';

// Categories whose settings are NOT yet wired to actual enforcement logic on the server.
// These show in admin settings but only save to DB — no runtime behaviour changes yet.
const COMING_SOON_CATEGORIES = new Set(['notifications', 'security', 'payment', 'backup']);

// Per-key overrides — individual settings marked as coming even if they live in a working category.
const COMING_SOON_KEYS = new Set([
  // General (cosmetic, not applied yet)
  'siteName', 'siteDescription', 'defaultLanguage', 'timezone'
]);

/** Decide whether a key should display the "Coming Soon" badge */
const isComingSoon = (category, key) => {
  if (COMING_SOON_CATEGORIES.has(category)) return true;
  return COMING_SOON_KEYS.has(key);
};

/* ── Badge helpers ─────────────────────────────────────────────── */
const ComingSoonPill = () => (
  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
    <Icon name="Rocket" size={10} />
    Coming soon
  </span>
);

const ComingSoonBadge = ({ category, key }) =>
  isComingSoon(category, key) ? <ComingSoonPill /> : null;

const AdminSettings = () => {
  const { user, isAuthenticated } = useAuth();
  const { refresh: refreshPublicSettings } = usePublicSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [settings, setSettings] = useState({
    general: {
      siteName: 'Ethio Farmers Shop',
      siteDescription: 'Connecting farmers with buyers across Ethiopia',
      defaultLanguage: 'en',
      timezone: 'Africa/Addis_Ababa',
      currency: 'ETB',
      maintenanceMode: false
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      orderAlerts: true,
      userRegistrationAlerts: true,
      systemAlerts: true
    },
    security: {
      twoFactorAuth: true,
      passwordMinLength: 8,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      ipWhitelist: false,
      auditLogging: true
    },
    payment: {
      stripeEnabled: true,
      paypalEnabled: false,
      bankTransferEnabled: true,
      mobileMoneyEnabled: true,
      commissionRate: 5.0,
      minimumPayout: 1000
    },
    features: {
      userRegistration: true,
      farmerVerification: true,
      listingApproval: true,
      orderTracking: true,
      reviewsEnabled: true,
      chatEnabled: true
    }
  });

  const tabs = [
    { id: 'general', name: 'General', icon: 'Settings', comingSoon: false },
    { id: 'notifications', name: 'Notifications', icon: 'Bell', comingSoon: true },
    { id: 'security', name: 'Security', icon: 'Shield', comingSoon: 'partial' },
    { id: 'payment', name: 'Payment', icon: 'CreditCard', comingSoon: true },
    { id: 'features', name: 'Features', icon: 'ToggleLeft', comingSoon: 'partial' },
    { id: 'backup', name: 'Backup', icon: 'Database', comingSoon: true }
  ];

  useEffect(() => {
    loadAndSyncPublicSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await settingsService.getSettings();
      const s = data?.settings || data;
      if (s && typeof s === 'object') {
        setSettings(prev => ({
          general: { ...prev.general, ...(s.general || {}) },
          notifications: { ...prev.notifications, ...(s.notifications || {}) },
          security: { ...prev.security, ...(s.security || {}) },
          payment: { ...prev.payment, ...(s.payment || {}) },
          features: { ...prev.features, ...(s.features || {}) }
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSaveMessage({ type: 'error', text: 'Failed to load settings from server' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAndSyncPublicSettings = async () => {
    await loadSettings();
    try { await refreshPublicSettings(); } catch(_) {}
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    setSaveMessage({ type: '', text: '' });
    try {
      await settingsService.updateSettings(settings);
      // Invalidate public settings cache so MaintenanceGate/amber banner reflect the change immediately
      await refreshPublicSettings();
      // Notify any other open tabs in this browser to re-fetch public settings instantly
      try { localStorage.setItem('public_settings_updated', String(Date.now())); } catch (_) {}
      setSaveMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 4000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage({ type: 'error', text: error?.response?.data?.error || 'Failed to save settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Coming Soon notice for cosmetic settings */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          ⚠️ The following settings are saved but not yet applied to the UI.
          They will be active in a future update.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Site Name
            </label>
            <ComingSoonBadge category="general" key="siteName" />
          </div>
          <input
            type="text"
            value={settings.general.siteName}
            onChange={(e) => handleSettingChange('general', 'siteName', e.target.value)}
            disabled={isComingSoon('general', 'siteName')}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Default Language
            </label>
            <ComingSoonBadge category="general" key="defaultLanguage" />
          </div>
          <select
            value={settings.general.defaultLanguage}
            onChange={(e) => handleSettingChange('general', 'defaultLanguage', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          >
            <option value="en">English</option>
            <option value="am">Amharic</option>
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Site Description
          </label>
          <ComingSoonBadge category="general" key="siteDescription" />
        </div>
        <textarea
          value={settings.general.siteDescription}
          onChange={(e) => handleSettingChange('general', 'siteDescription', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Timezone
            </label>
            <ComingSoonBadge category="general" key="timezone" />
          </div>
          <select
            value={settings.general.timezone}
            onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          >
            <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Currency
          </label>
          <select
            value={settings.general.currency}
            onChange={(e) => handleSettingChange('general', 'currency', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          >
            <option value="ETB">ETB (Ethiopian Birr)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
        </div>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="maintenanceMode"
          checked={settings.general.maintenanceMode}
          onChange={(e) => handleSettingChange('general', 'maintenanceMode', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
        />
        <label htmlFor="maintenanceMode" className="ml-2 text-sm text-slate-700 dark:text-slate-300">
          Enable maintenance mode
        </label>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      {/* Coming Soon banner for entire notifications category */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          🔔 Notification settings are saved but not yet wired to actual notification delivery. This feature is coming soon.
        </p>
      </div>
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-slate-900 dark:text-white">Notification Channels</h4>
        {Object.entries(settings.notifications).map(([key, value]) => (
          <div key={key} className="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg opacity-75">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h5>
                <ComingSoonBadge category="notifications" key={key} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {key === 'emailNotifications' && 'Send notifications via email'}
                {key === 'smsNotifications' && 'Send notifications via SMS'}
                {key === 'pushNotifications' && 'Send push notifications to mobile devices'}
                {key === 'orderAlerts' && 'Get notified about new orders'}
                {key === 'userRegistrationAlerts' && 'Get notified about new user registrations'}
                {key === 'systemAlerts' && 'Get notified about system events'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleSettingChange('notifications', key, e.target.checked)}
              disabled
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-not-allowed"
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      {/* Coming Soon banner for security settings (except passwordMinLength which IS enforced) */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          🔒 Most security settings are saved but not yet enforced. Only <strong>password minimum length</strong> is currently active. Other features coming soon.
        </p>
      </div>
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-slate-900 dark:text-white">Security Configuration</h4>
        {Object.entries(settings.security).map(([key, value]) => {
          const comingSoon = key !== 'passwordMinLength'; // passwordMinLength IS working
          return (
            <div key={key} className={`flex items-center justify-between p-4 border rounded-lg ${comingSoon ? 'border-slate-200 dark:border-slate-700 opacity-75' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h5>
                  {comingSoon && <ComingSoonBadge category="security" key={key} />}
                  {!comingSoon && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Icon name="CheckCircle" size={10} />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {key === 'twoFactorAuth' && 'Require two-factor authentication for admin accounts'}
                  {key === 'passwordMinLength' && 'Minimum password length (currently enforced at registration and password reset)'}
                  {key === 'sessionTimeout' && 'Session timeout in minutes'}
                  {key === 'maxLoginAttempts' && 'Maximum failed login attempts before lockout'}
                  {key === 'ipWhitelist' && 'Restrict access to specific IP addresses'}
                  {key === 'auditLogging' && 'Log all administrative actions'}
                </p>
              </div>
              {typeof value === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleSettingChange('security', key, e.target.checked)}
                  disabled={comingSoon}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded ${comingSoon ? 'cursor-not-allowed' : ''}`}
                />
              ) : (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => handleSettingChange('security', key, parseInt(e.target.value))}
                  disabled={comingSoon}
                  className={`w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white ${comingSoon ? 'cursor-not-allowed opacity-60' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="space-y-6">
      {/* Coming Soon banner for entire payment category */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          💳 Payment settings are saved but not yet integrated with any payment gateway. Chapa (Ethiopian payment provider) integration is planned. This feature is coming soon.
        </p>
      </div>
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-slate-900 dark:text-white">Payment Methods</h4>
        {Object.entries(settings.payment).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg opacity-75">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h5>
                <ComingSoonBadge category="payment" key={key} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {key === 'stripeEnabled' && 'Enable Stripe payment processing'}
                {key === 'paypalEnabled' && 'Enable PayPal payment processing'}
                {key === 'bankTransferEnabled' && 'Enable bank transfer payments'}
                {key === 'mobileMoneyEnabled' && 'Enable mobile money payments'}
                {key === 'commissionRate' && 'Platform commission rate (%)'}
                {key === 'minimumPayout' && 'Minimum payout amount (ETB)'}
              </p>
            </div>
            {typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleSettingChange('payment', key, e.target.checked)}
                disabled
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-not-allowed"
              />
            ) : (
              <input
                type="number"
                value={value}
                onChange={(e) => handleSettingChange('payment', key, parseFloat(e.target.value))}
                disabled
                className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white cursor-not-allowed opacity-60"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderFeatureSettings = () => (
    <div className="space-y-6">
      {/* Info banner for feature toggles - some work, some don't */}
      <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/10">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          ✅ <strong>Working:</strong> User Registration, Reviews, Chat | 🔜 <strong>Coming Soon:</strong> Farmer Verification, Listing Approval, Order Tracking
        </p>
      </div>
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-slate-900 dark:text-white">Feature Toggles</h4>
        {Object.entries(settings.features).map(([key, value]) => {
          // These features ARE actually enforced in the backend
          const isWorking = ['userRegistration', 'reviewsEnabled', 'chatEnabled'].includes(key);
          return (
            <div key={key} className={`flex items-center justify-between p-4 border rounded-lg ${isWorking ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 opacity-75'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h5>
                  {!isWorking && <ComingSoonBadge category="features" key={key} />}
                  {isWorking && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Icon name="CheckCircle" size={10} />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {key === 'userRegistration' && 'Allow new user registrations (enforced at registration endpoint)'}
                  {key === 'farmerVerification' && 'Require farmer verification process'}
                  {key === 'listingApproval' && 'Require admin approval for new listings'}
                  {key === 'orderTracking' && 'Enable order tracking functionality'}
                  {key === 'reviewsEnabled' && 'Allow users to leave reviews (enforced at review creation)'}
                  {key === 'chatEnabled' && 'Enable chat between users'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleSettingChange('features', key, e.target.checked)}
                disabled={!isWorking}
                className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded ${!isWorking ? 'cursor-not-allowed' : ''}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBackupSettings = () => (
    <div className="space-y-6">
      {/* Coming Soon banner for entire backup category */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          🗄️ Backup and export features are not yet implemented. This entire section is coming soon.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 opacity-60">
          <div className="flex items-center space-x-3 mb-4">
            <Icon name="Database" size={24} className="text-blue-600 dark:text-blue-400" />
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-medium text-slate-900 dark:text-white">Database Backup</h4>
              <ComingSoonBadge category="backup" key="databaseBackup" />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Last backup: N/A (feature not yet implemented)
          </p>
          <div className="space-y-2">
            <Button variant="primary" size="sm" iconName="Download" className="w-full" disabled>
              Create Backup
            </Button>
            <Button variant="outline" size="sm" iconName="Upload" className="w-full" disabled>
              Restore Backup
            </Button>
          </div>
        </Card>
        <Card className="p-6 opacity-60">
          <div className="flex items-center space-x-3 mb-4">
            <Icon name="FileText" size={24} className="text-green-600 dark:text-green-400" />
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-medium text-slate-900 dark:text-white">Export Data</h4>
              <ComingSoonBadge category="backup" key="exportData" />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Export system data for analysis
          </p>
          <div className="space-y-2">
            <Button variant="primary" size="sm" iconName="Download" className="w-full" disabled>
              Export Users
            </Button>
            <Button variant="outline" size="sm" iconName="Download" className="w-full" disabled>
              Export Orders
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

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

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700">
          <div className="px-4 mx-auto max-w-7xl lg:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">System Settings</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Configure system settings and preferences
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {saveMessage.text && (
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    saveMessage.type === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    <Icon name={saveMessage.type === 'success' ? 'CheckCircle' : 'AlertCircle'} size={16} />
                    <span>{saveMessage.text}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" iconName="RotateCcw" onClick={loadAndSyncPublicSettings}>
                  Reset
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  iconName="Save" 
                  onClick={handleSaveSettings}
                  loading={isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mx-auto max-w-7xl lg:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Settings Navigation */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <nav className="space-y-2">
                  {tabs.map((tab) => {
                    const hasBadge = tab.comingSoon !== false;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon name={tab.icon} size={20} />
                          <span className="text-sm font-medium">{tab.name}</span>
                        </div>
                        {hasBadge && (
                          <span className="hidden lg:inline-flex">
                            {tab.comingSoon === 'partial' ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                Partial
                              </span>
                            ) : (
                              <ComingSoonPill />
                            )}
                          </span>
                        )}
                        {/* Mobile badge */}
                        {hasBadge && (
                          <span className="lg:hidden inline-flex items-center ml-2">
                            <Icon name="Rocket" size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </Card>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3">
              <Card className="p-6">
                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'notifications' && renderNotificationSettings()}
                {activeTab === 'security' && renderSecuritySettings()}
                {activeTab === 'payment' && renderPaymentSettings()}
                {activeTab === 'features' && renderFeatureSettings()}
                {activeTab === 'backup' && renderBackupSettings()}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminSettings;
