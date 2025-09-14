import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import LandingPage from './pages/landing';
import DashboardFarmerHome from './pages/dashboard-farmer-home';
import AuthenticationPage from './pages/authentication-login-register';
import OrderManagement from './pages/order-management';
import FarmerOrders from './pages/order-management/FarmerOrders.jsx';
import UserProfileManagement from './pages/user-profile-management';
import MarketTrendsDashboard from './pages/market-trends-dashboard';
import FarmerMarketTrends from './pages/farmer-market-trends';
import BuyerMarketTrends from './pages/buyer-market-trends';
import BrowseListingsBuyerHome from './pages/browse-listings-buyer-home';
import BuyerDashboard from './pages/dashboard-buyer-home';
import AddListing from './pages/add-listing';
import ListingReviewsPage from './pages/listing-reviews';
import FarmerReviews from './pages/reviews/FarmerReviews.jsx';
import NotificationsPage from './pages/notifications';
import FarmerMyListings from './pages/farmer-my-listings';
import FavoritesPage from './pages/favorites';
import FarmerActivityPage from './pages/dashboard-farmer-home/components/FarmerActivityPage.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.jsx";
import CartPage from './pages/cart';
import BuyerPaymentsPage from './pages/payments';
import HelpPage from './pages/help';
import ResetPasswordPage from './pages/authentication-login-register/components/ResetPasswordPage';
import AdminDashboard from './pages/admin-dashboard';
import AdminUsers from './pages/admin-users';
import AdminListings from './pages/admin-listings';
import AdminOrders from './pages/admin-orders';
import AdminAnalytics from './pages/admin-analytics';
import AdminSettings from './pages/admin-settings';
import DevMode from './components/DevMode.jsx';

const RoleRedirect = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const userRole = user?.role || localStorage.getItem('userRole');
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <AuthenticationPage />;
  }
  
  if (userRole === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  if (userRole === 'farmer') {
    return <Navigate to="/dashboard-farmer-home" replace />;
  }
  
  return <Navigate to="/dashboard-buyer-home" replace />;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/app" element={<RoleRedirect />} />
                    <Route path="/authentication-login-register" element={<AuthenticationPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected by role */}
        <Route path="/dashboard-farmer-home" element={
          <ProtectedRoute requiredRole="farmer">
            <DashboardFarmerHome />
          </ProtectedRoute>
        } />
        <Route path="/farmer-my-listings" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerMyListings />
          </ProtectedRoute>
        } />
        <Route path="/dashboard-buyer-home" element={
          <ProtectedRoute requiredRole="buyer">
            <BuyerDashboard />
          </ProtectedRoute>
        } />

        {/* General protected pages (either role) */}
        <Route path="/order-management" element={
          <ProtectedRoute>
            <OrderManagement />
          </ProtectedRoute>
        } />
        <Route path="/orders-farmer" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerOrders />
          </ProtectedRoute>
        } />
        <Route path="/farmer-activity" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerActivityPage />
          </ProtectedRoute>
        } />
        <Route path="/user-profile-management" element={
          <ProtectedRoute>
            <UserProfileManagement />
          </ProtectedRoute>
        } />
        {/* Market trends accessible to both roles */}
        <Route path="/market-trends-dashboard" element={
          <ProtectedRoute>
            <MarketTrendsDashboard />
          </ProtectedRoute>
        } />
        {/* Role-specific market trends (still supported) */}
        <Route path="/farmer-market-trends" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerMarketTrends />
          </ProtectedRoute>
        } />
        <Route path="/buyer-market-trends" element={
          <ProtectedRoute requiredRole="buyer">
            <BuyerMarketTrends />
          </ProtectedRoute>
        } />
        <Route path="/browse-listings-buyer-home" element={
          <ProtectedRoute requiredRole="buyer">
            <BrowseListingsBuyerHome />
          </ProtectedRoute>
        } />
        <Route path="/favorites" element={
          <ProtectedRoute requiredRole="buyer">
            <FavoritesPage />
          </ProtectedRoute>
        } />
        <Route path="/add-listing" element={
          <ProtectedRoute requiredRole="farmer">
            <AddListing />
          </ProtectedRoute>
        } />
        <Route path="/listing/:id/reviews" element={
          <ProtectedRoute requiredRole="buyer">
            <ListingReviewsPage />
          </ProtectedRoute>
        } />
        <Route path="/farmer-reviews" element={
          <ProtectedRoute requiredRole="farmer">
            <FarmerReviews />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        } />
        <Route path="/help" element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        } />
        <Route path="/cart" element={
          <ProtectedRoute requiredRole="buyer">
            <CartPage />
          </ProtectedRoute>
        } />
        <Route path="/payments" element={
          <ProtectedRoute requiredRole="buyer">
            <BuyerPaymentsPage />
          </ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin-dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin-users" element={
          <ProtectedRoute requiredRole="admin">
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/admin-listings" element={
          <ProtectedRoute requiredRole="admin">
            <AdminListings />
          </ProtectedRoute>
        } />
        <Route path="/admin-orders" element={
          <ProtectedRoute requiredRole="admin">
            <AdminOrders />
          </ProtectedRoute>
        } />
        <Route path="/admin-analytics" element={
          <ProtectedRoute requiredRole="admin">
            <AdminAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/admin-settings" element={
          <ProtectedRoute requiredRole="admin">
            <AdminSettings />
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      <DevMode />
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
