import { useState, useEffect, useContext, createContext } from 'react';
import { settingsService } from '../services/apiService.js';

const PublicSettingsContext = createContext({
  settings: null,
  loading: true,
  isMaintenanceMode: false,
  isRegistrationEnabled: true,
  isReviewsEnabled: true,
  isChatEnabled: true,
  isOrderTrackingEnabled: true,
  passwordMinLength: 8,
  refresh: () => {}
});

export const PublicSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await settingsService.getPublicSettings();
      setSettings(data?.settings || data || null);
    } catch (_) {
      // Silently fail - app should work with defaults if settings unavailable
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Keep clients in sync with admin changes without a manual refresh:
  // - fast polling (4s) while maintenance is ON so the gate lifts as soon as the
  //   admin turns it off, normal polling (30s) otherwise
  // - re-fetch whenever the tab becomes visible/focused
  // - re-fetch when another tab in the same browser saves new settings
  useEffect(() => {
    const maintenanceActive = Boolean(settings?.general?.maintenanceMode ?? settings?.maintenanceMode);
    const interval = setInterval(load, maintenanceActive ? 4000 : 30000);

    const resync = () => {
      if (document.visibilityState !== 'hidden') load();
    };
    const onStorage = (e) => {
      if (e?.key === 'public_settings_updated') load();
    };

    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('storage', onStorage);
    };
  }, [settings]);

  const value = {
    settings,
    loading,
    isMaintenanceMode: Boolean(settings?.general?.maintenanceMode ?? settings?.maintenanceMode),
    isRegistrationEnabled: settings?.features?.userRegistration !== false,
    isReviewsEnabled: settings?.features?.reviewsEnabled !== false,
    isChatEnabled: settings?.features?.chatEnabled !== false,
    isOrderTrackingEnabled: settings?.features?.orderTracking !== false,
    // Password policy from admin settings (falls back to 8 if unavailable).
    passwordMinLength: Number(settings?.security?.passwordMinLength) || 8,
    refresh: load
  };

  return (
    <PublicSettingsContext.Provider value={value}>
      {children}
    </PublicSettingsContext.Provider>
  );
};

export const usePublicSettings = () => useContext(PublicSettingsContext);

export default usePublicSettings;
