import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { usePublicSettings } from '../../hooks/usePublicSettings.jsx';
import RoleBasedSidebar from './RoleBasedSidebar.jsx';
import AdminSidebar from './AdminSidebar.jsx';
import AuthenticatedTopBar from './AuthenticatedTopBar.jsx';
import MaintenanceGate from '../MaintenanceGate.jsx';
import Icon from '../AppIcon.jsx';

const AuthenticatedLayout = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { isMaintenanceMode } = usePublicSettings();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const userRole = user?.role || 'buyer';
  const isAdmin = user?.role === 'admin';

  return (
    <MaintenanceGate>
    <div className="min-h-screen bg-background">
      {/* Maintenance banner for admins */}
      {isMaintenanceMode && isAdmin && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-900 px-4 py-1.5 text-center text-sm font-medium flex items-center justify-center space-x-2">
          <Icon name="AlertTriangle" size={16} />
          <span>Maintenance Mode is ON — visitors see a maintenance page</span>
        </div>
      )}
      <AuthenticatedTopBar isCollapsed={isCollapsed} userRole={userRole} />
      
      {userRole === 'admin' ? (
        <AdminSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      ) : (
        <RoleBasedSidebar
          userRole={userRole}
          isAuthenticated={isAuthenticated}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      )}

      <div className={`pt-14 ${isCollapsed ? 'pl-16' : userRole === 'admin' ? 'pl-64' : 'pl-72'} transition-all ${userRole === 'admin' ? 'pb-20' : ''}`}>
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
    </MaintenanceGate>
  );
};

export default AuthenticatedLayout;


