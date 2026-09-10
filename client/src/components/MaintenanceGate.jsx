import React from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePublicSettings } from '../hooks/usePublicSettings.jsx';
import Icon from './AppIcon.jsx';

/**
 * MaintenanceGate - Shows a maintenance overlay for non-admin users
 * when maintenance mode is enabled. Admins can still access the site.
 */
const MaintenanceGate = ({ children }) => {
  const { user } = useAuth();
  const { isMaintenanceMode, loading } = usePublicSettings();

  // Admins bypass maintenance mode
  const isAdmin = user?.role === 'admin';

  if (loading) {
    return children;
  }

  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="Wrench" size={40} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Under Maintenance</h1>
          <p className="text-slate-400 mb-6">
            We're currently performing scheduled maintenance to improve your experience.
            Please check back soon.
          </p>
          <div className="flex items-center justify-center space-x-2 text-slate-500 text-sm">
            <Icon name="Clock" size={16} />
            <span>We apologize for the inconvenience</span>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default MaintenanceGate;
