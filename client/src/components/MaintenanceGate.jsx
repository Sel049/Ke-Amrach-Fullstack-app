import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePublicSettings } from '../hooks/usePublicSettings.jsx';
import Icon from './AppIcon.jsx';

/**
 * MaintenanceGate - full-screen maintenance page shown to visitors and
 * non-admin users while `general.maintenanceMode` is on.
 *
 * Rules:
 *  - Admins always bypass the gate (so they can turn maintenance off).
 *  - The authentication routes stay reachable while maintenance is on, so a
 *    signed-out visitor can still sign in / register instead of getting a
 *    "Service temporarily unavailable" error. Once signed in, a non-admin
 *    lands on the maintenance page below.
 *  - The gate re-evaluates automatically thanks to the polling in
 *    PublicSettingsProvider - no manual refresh needed.
 */
export const MAINTENANCE_EXEMPT_PATHS = [
  '/authentication-login-register',
  '/reset-password',
  '/app',
];

const MaintenanceGate = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isMaintenanceMode, loading } = usePublicSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isExemptRoute = MAINTENANCE_EXEMPT_PATHS.includes(location.pathname);

  // While settings are still loading (or admins / exempt routes) render normally.
  if (loading || !isMaintenanceMode || isAdmin || isExemptRoute) {
    return children;
  }

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (_) {
      // ignore - still drop the local session and go to sign in
    }
    navigate('/authentication-login-register', { replace: true });
  };

  const handleGoToSignIn = () => {
    navigate('/authentication-login-register', { replace: true });
  };

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
        <div className="flex flex-col items-center gap-4">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
            >
              <Icon name="LogOut" size={16} />
              <span>Sign out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium transition-colors"
            >
              <Icon name="LogIn" size={16} />
              <span>Go to sign in</span>
            </button>
          )}
          <div className="flex items-center justify-center space-x-2 text-slate-500 text-sm">
            <Icon name="Clock" size={16} />
            <span>We apologize for the inconvenience</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceGate;
