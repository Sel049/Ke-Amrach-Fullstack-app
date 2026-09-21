import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import Button from './Button';
import Icon from '../AppIcon';
import { useLanguage } from '../../hooks/useLanguage.jsx';
import { useCart } from '../../hooks/useCart.jsx';
import NotificationBell from '../NotificationBell.jsx';

const AuthenticatedTopBar = ({ isCollapsed, userRole, onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, toggle, setLanguage } = useLanguage();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { totalItems } = useCart();

  useEffect(() => {
    const saved = localStorage.getItem('farmconnect_language') || 'en';
    setLanguage(saved);
  }, []);

  const toggleLanguage = () => toggle();

  const handleLogout = async () => {
    await logout();
    navigate('/authentication-login-register');
  };

  const role = user?.role || localStorage.getItem('userRole') || 'buyer';
  const displayRoleName = role === 'admin'
    ? (language === 'am' ? 'አድሚን' : 'Admin')
    : role === 'farmer'
      ? (language === 'am' ? 'ገበሬ' : 'Farmer')
      : (language === 'am' ? 'ገዢ' : 'Buyer');
  const avatarNode = user?.avatarUrl ? (
    <img src={user?.avatarUrl} alt={user?.fullName || 'User'} className="object-cover w-full h-full" />
  ) : (
    <div className={`w-full h-full flex items-center justify-center ${role === 'admin' ? 'bg-gray-100' : role === 'farmer' ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
      <Icon
        name={role === 'admin' ? 'Shield' : role === 'farmer' ? 'Sprout' : 'ShoppingCart'}
        size={16}
        className={`${role === 'admin' ? 'text-black' : role === 'farmer' ? 'text-emerald-700' : 'text-indigo-700'}`}
      />
    </div>
  );

  const sidebarOffset = isCollapsed ? 'left-0 sm:left-16' : (userRole === 'admin' ? 'left-0 lg:left-64' : 'left-0 lg:left-72');

  return (
    <div className={`fixed top-0 right-0 z-40 h-14 border-b bg-surface border-border transition-all duration-300 ${sidebarOffset}`}>
      <div className="h-full w-full min-w-0 px-2 sm:px-6 flex items-center justify-between">
        <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="sm:hidden shrink-0"
            aria-label="Open navigation menu"
          >
            <Icon name="Menu" size={20} />
          </Button>
          <div className="flex shrink-0 items-center space-x-2 sm:space-x-3 cursor-pointer pl-0 sm:pl-3" onClick={() => navigate('/app')}>
          <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
            <Icon name="Sprout" size={18} color="white" />
          </div>
          <span className="hidden text-sm font-semibold text-primary sm:block">Keamrach</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-1 sm:space-x-3">
          <span className={role === 'buyer' ? 'hidden sm:block' : ''}>
            <NotificationBell />
          </span>
          {role === 'buyer' && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/cart')} className="relative">
              <Icon name="ShoppingCart" size={18} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-rose-500 text-white rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">{totalItems}</span>
              )}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="flex items-center space-x-1 sm:space-x-2 text-text-secondary hover:text-primary px-2 sm:px-3">
            <Icon name="Globe" size={16} />
            <span className="font-medium">{language === 'en' ? 'EN' : 'አማ'}</span>
          </Button>

          <div className="relative">
            <button
              className="flex items-center space-x-2 pl-3 pr-2 py-1.5 rounded-lg border border-border hover:bg-accent"
              onClick={() => setIsUserMenuOpen((o) => !o)}
            >
              <div className="w-8 h-8 overflow-hidden rounded-full bg-muted">
                {avatarNode}
              </div>
              <span className="hidden sm:block text-sm text-text-primary">{displayRoleName}</span>
              <Icon name={isUserMenuOpen ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-text-secondary" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-surface p-2 shadow-warm">
                <Button variant="ghost" className="justify-start w-full px-3 py-2" onClick={() => { setIsUserMenuOpen(false); navigate('/user-profile-management'); }}>
                  <Icon name="Settings" size={16} className="mr-2" /> Settings
                </Button>
                <Button variant="ghost" className="justify-start w-full px-3 py-2" onClick={() => { setIsUserMenuOpen(false); navigate('/help'); }}>
                  <Icon name="HelpCircle" size={16} className="mr-2" /> Help & Support
                </Button>
                <div className="my-2 border-t border-border" />
                <Button variant="ghost" className="justify-start w-full px-3 py-2 text-error hover:text-error hover:bg-error/10" onClick={handleLogout}>
                  <Icon name="LogOut" size={16} className="mr-2" /> Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthenticatedTopBar;


