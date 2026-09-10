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

  const value = {
    settings,
    loading,
    isMaintenanceMode: Boolean(settings?.general?.maintenanceMode ?? settings?.maintenanceMode),
    isRegistrationEnabled: settings?.features?.userRegistration !== false,
    isReviewsEnabled: settings?.features?.reviewsEnabled !== false,
    isChatEnabled: settings?.features?.chatEnabled !== false,
    isOrderTrackingEnabled: settings?.features?.orderTracking !== false,
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
