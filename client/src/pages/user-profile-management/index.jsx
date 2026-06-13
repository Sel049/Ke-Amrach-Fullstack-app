import React, { useState, useEffect } from 'react';
import { userService, verificationService } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import ProfileHeader from './components/ProfileHeader';
import AccountInformation from './components/AccountInformation';
import RoleSpecificSection from './components/RoleSpecificSection';
import VerificationSection from './components/VerificationSection';
import OrderHistorySection from './components/OrderHistorySection';
import SecuritySection from './components/SecuritySection';
import CertificationManagement from './components/CertificationManagement';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const UserProfileManagement = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [userRole, setUserRole] = useState('farmer'); // farmer or buyer
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('account');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const formatToAmPm = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [hStr, mStr = '00'] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    if (Number.isNaN(h)) return null;
    const m = mStr.padStart(2, '0');
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${suffix}`;
  };


  // Load language preference from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') || 'en';
    setCurrentLanguage(savedLanguage);
  }, []);

  useEffect(() => { if (language !== currentLanguage) setCurrentLanguage(language); }, [language]);

  // Fetch user profile from backend
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userService.getMe();
        const role = data.role || 'farmer';
        
        // For farmers, also fetch farmer profile data for completion calculation
        let farmerProfileData = {};
        if (role === 'farmer') {
          try {
            const api = await import('../../services/apiService');
            const farmerProfile = await api.default.get('/farmer-profile/profile');
            farmerProfileData = farmerProfile.data || {};
          } catch (error) {
            console.error('Failed to fetch farmer profile:', error);
          }
        }
        // Compute profile completion (not order-based) - matches server-side logic
        const computeProfileCompletion = (userRole, u, verificationFlags = {}) => {
          if (!u) return 0;
          
          if (userRole === 'farmer') {
            // Farmer completion: 70% profile fields + 30% verification docs (matches server logic)
            let profileScore = 0;
            
            // Base profile fields worth 70 points total (17.5 points each)
            const checkField = (value) => {
              if (value === null || value === undefined) return false;
              if (Array.isArray(value)) return value.length > 0;
              if (typeof value === 'number') return value > 0;
              return String(value).trim() !== '';
            };
            
            // Farm name (17.5 points) - matches server field: farm_name
            if (checkField(u.farmName) || checkField(u.farm_name)) profileScore += 17.5;
            
            // Farm size (17.5 points) - matches server field: farm_size_ha
            if (checkField(u.farmSize) || checkField(u.farm_size_ha)) profileScore += 17.5;
            
            // Crops (17.5 points) - matches server field: crops
            if (checkField(u.primaryCrops) || checkField(u.crops)) profileScore += 17.5;
            
            // Farming methods (17.5 points) - matches server field: farming_methods
            if (checkField(u.farmingMethods) || checkField(u.farming_methods)) profileScore += 17.5;
            
            // Verification docs worth 30 points total (15 points each)
            let verificationScore = 0;
            if (verificationFlags.nationalIdVerified) verificationScore += 15;
            if (verificationFlags.landCertificateVerified) verificationScore += 15;
            
            return Math.min(100, Math.round(profileScore + verificationScore));
          } else if (userRole === 'buyer') {
            // Buyer completion: profile fields + verification docs based on business type
            const common = ['fullName', 'phone', 'region', 'woreda', 'avatarUrl'];
            const buyerFields = ['businessType', 'preferredSuppliers', 'purchaseVolume', 'deliveryPreference'];
            let fields = [...common, ...buyerFields];

            // Include verification requirements for buyers based on business type
            const bt = String(u.businessType || '').toLowerCase();
            const isIndividual = bt === 'individual';
            const requiresBusinessDocs = bt && bt !== 'individual';
            if (isIndividual) {
              fields = [...fields, '__verified_national_id__'];
            } else if (requiresBusinessDocs) {
              fields = [...fields, '__verified_business_license__', '__verified_tax_certificate__'];
            }

            // Only count fields that exist on user or synthetic verification placeholders
            const available = fields.filter((k) => k.startsWith('__verified_') || Object.prototype.hasOwnProperty.call(u, k));
            const checkFilled = (v) => {
              if (v === null || v === undefined) return false;
              if (Array.isArray(v)) return v.length > 0;
              if (typeof v === 'number') return v > 0;
              return String(v).trim() !== '';
            };
            const filled = available.filter((k) => {
              if (k === '__verified_national_id__') return !!verificationFlags.nationalIdVerified;
              if (k === '__verified_business_license__') return !!verificationFlags.businessLicenseVerified;
              if (k === '__verified_tax_certificate__') return !!verificationFlags.taxCertificateVerified;
              if (k === '__verified_land_certificate__') return !!verificationFlags.landCertificateVerified;
              return checkFilled(u[k]);
            });
            const denom = available.length || fields.length;
            return denom ? Math.round((filled.length / denom) * 100) : 0;
          }
          
          return 0;
        };

        // Build verification flags for buyers and farmers
        let verificationFlags = {};
        try {
          try {
            const docsRes = await verificationService.getDocuments();
            const docs = Array.isArray(docsRes?.documents) ? docsRes.documents : (Array.isArray(docsRes) ? docsRes : []);
            const norm = (s) => String(s || '').toLowerCase().replace(/[-_]/g, '');
            const isVerifiedType = (t) => docs.some(d => norm(d.id || d.type || d.document_type) === norm(t) && String(d.status || '').toLowerCase() === 'verified');
            verificationFlags = {
              nationalIdVerified: isVerifiedType('national-id'),
              businessLicenseVerified: isVerifiedType('business-license'),
              taxCertificateVerified: isVerifiedType('tax-certificate'),
              landCertificateVerified: isVerifiedType('land-certificate')
            };
          } catch (e) {
            // Ignore verification errors for completion computation
          }
        } catch (_) {}

        // Merge farmer profile data with user data for completion calculation
        const mergedData = role === 'farmer' ? { ...data, ...farmerProfileData } : data;
        const completionRate = computeProfileCompletion(role, mergedData, verificationFlags);
        setUser({ ...mergedData, completionRate });
        setUserRole(role);
      } catch (e) {
        // ignore; layout will protect route elsewhere
      }
    };
    fetchUser();
  }, []);

  // Load role-based stats from real data
  useEffect(() => {
    const loadStats = async () => {
      if (!userRole) return;
      try {
        setStatsLoading(true);
        if (userRole === 'buyer') {
          const res = await (await import('../../services/apiService')).orderService.getBuyerOrders({ limit: 100 });
          const list = res?.orders || res || [];
          const totalOrders = Array.isArray(list) ? list.length : 0;
          setUser(prev => ({ ...(prev || {}), totalOrders }));
        } else if (userRole === 'farmer') {
          const api = await import('../../services/apiService');
          const res = await api.orderService.getFarmerOrders({ limit: 100 });
          const list = res?.orders || res || [];
          const totalOrders = Array.isArray(list) ? list.length : 0;

          // Fetch server-side farmer profile stats for reliable rating
          let rating;
          let responseTime;
          try {
            const statsRes = await api.default.get('/farmer-profile/profile/stats');
            const stats = statsRes?.data?.stats || {};
            if (typeof stats.avg_rating === 'number') {
              rating = Number(stats.avg_rating).toFixed(1);
            }
          } catch (_) {}

          // Fetch farmer profile to get available hours and fallback rating
          try {
            const profRes = await api.default.get('/farmer-profile/profile');
            const prof = profRes?.data || {};
            const start = prof.business_hours_start || prof.businessHoursStart;
            const end = prof.business_hours_end || prof.businessHoursEnd;
            const startFmt = formatToAmPm(start) || formatToAmPm('06:00');
            const endFmt = formatToAmPm(end) || formatToAmPm('18:00');
            responseTime = `${startFmt} - ${endFmt}`;
            if (rating === undefined && typeof prof.avg_rating === 'number') {
              rating = Number(prof.avg_rating).toFixed(1);
            }
          } catch (_) {}

          // Fallback: derive rating from farmer reviews if still unavailable
          if (rating === undefined || rating === null || rating === 'NaN') {
            try {
              const meId = (user || data)?.id;
              if (meId) {
                const revRes = await api.reviewService.getFarmerReviews(meId, { limit: 50 });
                const farmerStats = revRes?.farmerStats || {};
                let avg = farmerStats.avg_rating;
                if (avg === undefined || avg === null) {
                  const reviews = revRes?.reviews || [];
                  const nums = reviews.map(r => Number(r?.rating)).filter(n => !Number.isNaN(n));
                  if (nums.length) avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                }
                if (typeof avg === 'number' && !Number.isNaN(avg)) {
                  rating = Number(avg).toFixed(1);
                }
              }
            } catch (_) {}
          }

          setUser(prev => ({ ...(prev || {}), totalOrders, rating, responseTime }));
        }
      } catch (e) {
        // silently ignore stats errors to avoid blocking profile
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [userRole]);

  // Handle language change
  const handleLanguageChange = (newLanguage) => {
    setCurrentLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  // Handle photo edit
  const handleEditPhoto = async (file) => {
    try {
      if (!file) return;
      const data = await userService.uploadAvatar(file);
      setUser(prev => ({ ...(prev || {}), avatarUrl: data.avatarUrl || data.url || data.imageUrl }));
    } catch (e) {
      // ignore for now
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'account',
      label: 'Account Info',
      labelAm: 'የመለያ መረጃ',
      icon: 'User'
    },
    {
      id: 'role-specific',
      label: userRole === 'farmer' ? 'Farm Details' : 'Business Details',
      labelAm: userRole === 'farmer' ? 'የእርሻ ዝርዝሮች' : 'የንግድ ዝርዝሮች',
      icon: userRole === 'farmer' ? 'Sprout' : 'Building'
    },
    ...(userRole === 'farmer' ? [
      {
        id: 'certifications',
        label: 'Certifications',
        labelAm: 'ማረጋገጫዎች',
        icon: 'Award'
      }
    ] : []),
    {
      id: 'verification',
      label: 'Verification',
      labelAm: 'ማረጋገጫ',
      icon: 'Shield'
    },
    {
      id: 'orders',
      label: 'Order History',
      labelAm: 'የትዕዛዝ ታሪክ',
      icon: 'History'
    },
    {
      id: 'security',
      label: 'Security',
      labelAm: 'ደህንነት',
      icon: 'Lock'
    }
  ];

  const getLabel = (text, textAm) => {
    return currentLanguage === 'am' ? textAm : text;
  };

  const getTabLabel = (tab) => {
    return currentLanguage === 'am' ? tab?.labelAm : tab?.label;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <AccountInformation
            userRole={userRole}
            currentLanguage={currentLanguage}
            onProfileUpdated={(patch) => setUser(prev => ({ ...(prev || {}), ...patch }))}
          />
        );
      case 'role-specific':
        return (
          <RoleSpecificSection
            userRole={userRole}
            currentLanguage={currentLanguage}
          />
        );
      case 'certifications':
        return userRole === 'farmer' ? (
          <CertificationManagement
            currentLanguage={currentLanguage}
          />
        ) : null;
      case 'verification':
        return (
          <VerificationSection
            userRole={userRole}
            currentLanguage={currentLanguage}
          />
        );
      case 'orders':
        return (
          <OrderHistorySection
            userRole={userRole}
            currentLanguage={currentLanguage}
          />
        );
      case 'security':
        return (
          <SecuritySection
            currentLanguage={currentLanguage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AuthenticatedLayout>
        <div className="px-4 mx-auto max-w-7xl lg:px-6">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center mb-2 space-x-2 text-sm text-text-secondary">
              <button
                onClick={() => navigate(userRole === 'buyer' ? '/dashboard-buyer-home' : '/dashboard-farmer-home')}
                className="hover:text-primary transition-smooth"
              >
                {getLabel('Dashboard', 'ዳሽቦርድ')}
              </button>
              <Icon name="ChevronRight" size={16} />
              <span className="text-text-primary">
                {getLabel('Profile Management', 'የመገለጫ አስተዳደር')}
              </span>
            </div>
            <h1 className="text-2xl font-bold lg:text-3xl text-text-primary">
              {getLabel('Profile Management', 'የመገለጫ አስተዳደር')}
            </h1>
            <p className="mt-2 text-text-secondary">
              {getLabel(
                'Manage your account information, verification documents, and security settings.',
                'የመለያ መረጃዎን፣ የማረጋገጫ ሰነዶችን እና የደህንነት ቅንብሮችን ያስተዳድሩ።'
              )}
            </p>
          </div>

          {/* Welcome message for new users */}
          {user && (!user.full_name || !user.phone || !user.region || !user.woreda) && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-800">
                      {getLabel('Welcome to Keamrach!', 'እንኳን ወደ Keamrach በደህና መጡ!')}
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    {getLabel(
                      'Complete your profile to get the most out of Keamrach. This helps other users find and connect with you.',
                      'ከ ከገበረው የተሻለ ጥቅም ለማግኘት የመገለጫ መረጃዎን ያጠናቅቁ። ይህ ሌሎች ተጠቃሚዎች እንዲያገኙዎት እና እንዲገናኙዎት ይረዳል።'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Profile Header */}
          <div className="mb-8">
            <ProfileHeader
              userRole={userRole}
              currentLanguage={currentLanguage}
              onEditPhoto={handleEditPhoto}
              user={user}
            />
          </div>

          {/* Desktop Tabs */}
          <div className="hidden lg:block">
            <div className="mb-8 border-b border-border">
              <nav className="flex space-x-8">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`
                      flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-smooth
                      ${activeTab === tab?.id
                        ? 'border-primary text-primary' :'border-transparent text-text-secondary hover:text-primary hover:border-primary/50'
                      }
                    `}
                  >
                    <Icon name={tab?.icon} size={18} />
                    <span>{getTabLabel(tab)}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile Tab Selector */}
          <div className="mb-6 lg:hidden">
            <div className="relative">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e?.target?.value)}
                className="w-full p-3 pr-10 font-medium border rounded-lg appearance-none bg-surface border-border text-text-primary"
              >
                {tabs?.map((tab) => (
                  <option key={tab?.id} value={tab?.id}>
                    {getTabLabel(tab)}
                  </option>
                ))}
              </select>
              <Icon
                name="ChevronDown"
                size={20}
                className="absolute transform -translate-y-1/2 pointer-events-none right-3 top-1/2 text-text-secondary"
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {renderTabContent()}
          </div>

          {/* Quick Actions (Mobile) */}
          <div className="fixed z-40 lg:hidden bottom-4 right-4">
            <div className="flex flex-col space-y-2">
              <Button
                variant="default"
                size="icon"
                className="w-12 h-12 rounded-full shadow-warm-lg"
                onClick={() => setActiveTab('verification')}
              >
                <Icon name="Shield" size={20} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full shadow-warm-lg bg-surface"
                onClick={() => setActiveTab('security')}
              >
                <Icon name="Lock" size={20} />
              </Button>
            </div>
          </div>
        </div>
    </AuthenticatedLayout>
  );
};

export default UserProfileManagement;
