import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { usePublicSettings } from '../../hooks/usePublicSettings.jsx';
import RoleBasedSidebar from './RoleBasedSidebar.jsx';
import AdminSidebar from './AdminSidebar.jsx';
import AuthenticatedTopBar from './AuthenticatedTopBar.jsx';
import Icon from '../AppIcon.jsx';

const AuthenticatedLayout = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { isMaintenanceMode } = usePublicSettings();
  const [isCollapsed, setIsCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth < 1024
  ));
  const userRole = user?.role || 'buyer';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleViewportChange = (event) => setIsCollapsed(event.matches);

    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Maintenance banner for admins */}
      {isMaintenanceMode && isAdmin && (
        <div className="fixed top-14 left-0 right-0 z-[45] bg-amber-500 text-amber-900 px-4 py-1.5 text-center text-sm font-medium flex items-center justify-center space-x-2">
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

      <div className={`${isMaintenanceMode && isAdmin ? 'pt-[5.5rem]' : 'pt-14'} ${isCollapsed ? 'pl-16' : userRole === 'admin' ? 'pl-64' : 'pl-72'} transition-all ${userRole === 'admin' ? 'pb-20' : ''}`}>
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AuthenticatedLayout;


