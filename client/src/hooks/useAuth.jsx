import { useState, useEffect, createContext, useContext } from 'react';
import { authService, userService } from '../services/apiService.js';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const storedToken = localStorage.getItem('authToken');
      const storedAuth = localStorage.getItem('isAuthenticated');
      const storedUser = localStorage.getItem('userData');

      if (!import.meta.env.DEV && storedToken?.startsWith('dev-token-')) {
        clearAuth();
        return;
      }

      if (storedToken && storedAuth === 'true') {
        // Immediately hydrate session from storage to avoid flicker/redirects
        setToken(storedToken);
        setIsAuthenticated(true);
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); } catch {}
        }

        // Skip API call for now to avoid hanging when backend is not available
        console.log('Using stored session data, skipping API call');
      } else {
        // No valid stored auth
        clearAuth();
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      setError('Failed to initialize authentication');
      // Do not force logout here to avoid redirect loops
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setError(null);
    
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userData');
    localStorage.removeItem('userRole');
  };

  const completeFirebaseSignIn = async (firebaseUser) => {
    const firebaseToken = await firebaseUser.getIdToken(true);
    localStorage.setItem('authToken', firebaseToken);

    await authService.syncUser();
    const profile = await userService.getMe();
    if (!profile?.role) {
      throw new Error('Your account profile is missing a role. Contact support.');
    }

    setUser(profile);
    setToken(firebaseToken);
    setIsAuthenticated(true);
    setError(null);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userData', JSON.stringify(profile));
    localStorage.setItem('userRole', profile.role);

    return profile;
  };

  const login = async (credentials) => {
    // Check if this is a dev mode login
    if (import.meta.env.DEV && credentials.devMode) {
      const devUserData = JSON.parse(localStorage.getItem('devUserData') || '{}');
      console.log('Dev mode login - user data:', devUserData);
      setUser(devUserData);
      setToken(localStorage.getItem('authToken'));
      setIsAuthenticated(true);
      setError(null);
      
      // Sync user data immediately after dev login
      try {
        await authService.syncUser();
        const me = await userService.getMe();
        if (me) {
          setUser(me);
          localStorage.setItem('userData', JSON.stringify(me));
          if (me.role) localStorage.setItem('userRole', me.role);
        }
      } catch (error) {
        console.log('Background sync failed:', error);
      }
      
      console.log('Dev mode login successful');
      return { success: true, user: devUserData };
    }
    try {
      setLoading(true);
      setError(null);

      if (localStorage.getItem('authToken')?.startsWith('dev-token-')) {
        clearAuth();
      }

      const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
        import('../firebase'),
        import('firebase/auth'),
      ]);

      if (!auth) {
        if (!import.meta.env.DEV) {
          throw new Error('Firebase Authentication is not configured for this site.');
        }

        const response = await authService.devLogin(credentials);
        if (!response.user || !response.devToken) {
          throw new Error('Invalid development login response');
        }

        setUser(response.user);
        setToken(response.devToken);
        setIsAuthenticated(true);
        setError(null);
        localStorage.setItem('userData', JSON.stringify(response.user));
        localStorage.setItem('userRole', response.user.role);
        return { success: true, user: response.user };
      }

      const credential = await signInWithEmailAndPassword(
        auth,
        credentials.email.trim(),
        credentials.password
      );
      const profile = await completeFirebaseSignIn(credential.user);
      return { success: true, user: profile };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.register(userData);

      // Try to authenticate the user immediately after successful registration
      const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
        import('../firebase'),
        import('firebase/auth'),
      ]);

      if (!auth && import.meta.env.DEV) {
        const devResponse = await authService.devLogin(userData);
        if (!devResponse.user || !devResponse.devToken) {
          throw new Error('Registration succeeded, but local development sign-in failed.');
        }

        setUser(devResponse.user);
        setToken(devResponse.devToken);
        setIsAuthenticated(true);
        localStorage.setItem('authToken', devResponse.devToken);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userData', JSON.stringify(devResponse.user));
        localStorage.setItem('userRole', devResponse.user.role);
        return { success: true, data: response, user: devResponse.user };
      }

      if (!auth) {
        throw new Error('Registration succeeded, but Firebase Authentication is not configured for this site.');
      }

      const credential = await signInWithEmailAndPassword(
        auth,
        userData.email.trim(),
        userData.password
      );
      const profile = await completeFirebaseSignIn(credential.user);
      return { success: true, data: response, user: profile };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    // Call logout service
    authService.logout();
  };

  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('userData', JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    try {
      if (!token) return false;
      
      const profileResponse = await authService.getUserProfile();
      if (profileResponse.user) {
        setUser(profileResponse.user);
        localStorage.setItem('userData', JSON.stringify(profileResponse.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return false;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    clearError,
    clearAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
