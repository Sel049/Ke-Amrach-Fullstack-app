import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import AuthenticatedLayout from '../../components/ui/AuthenticatedLayout.jsx';
import Card from '../../components/ui/Card.jsx';
import Icon from '../../components/AppIcon.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { userService } from '../../services/apiService';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const AdminUsers = () => {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showMenu, setShowMenu] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { users: apiUsers = [] } = await userService.getAllUsers?.() || {};
      const mapped = apiUsers.map(u => ({
        ...u,
        status: 'active',
        verified: false,
        avatar: u.avatar || '/public/assets/images/no_image.png'
      }));
      setUsers(mapped);
      setFilteredUsers(mapped);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    const config = {
      active: { color: 'emerald', label: language === 'am' ? 'ተክል' : 'Active' },
      pending: { color: 'amber', label: language === 'am' ? 'ሊጽፍ' : 'Pending' },
      suspended: { color: 'rose', label: language === 'am' ? 'ተዓጠቀ' : 'Suspended' }
    };
    const c = config[status] || config.active;
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full bg-${c.color}-500 animate-pulse`} />
        <span className={`text-sm font-medium text-${c.color}-700 dark:text-${c.color}-300`}>{c.label}</span>
      </div>
    );
  };

  const getRoleBadge = (role) => {
    if (!role) return null;
    const config = {
      farmer: { color: 'blue', icon: 'Leaf', label: language === 'am' ? 'አርሻ' : 'Farmer' },
      buyer: { color: 'purple', icon: 'ShoppingBag', label: language === 'am' ? 'ገዢ' : 'Buyer' },
      admin: { color: 'gray', icon: 'Settings', label: language === 'am' ? 'አስተዳዳሪ' : 'Admin' }
    };
    const c = config[role] || config.farmer;
    return (
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg bg-${c.color}-100 dark:bg-${c.color}-900/30`}>
          <Icon name={c.icon} size={14} className={`text-${c.color}-600 dark:text-${c.color}-400`} />
        </div>
        <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-300">{c.label}</span>
      </div>
    );
  };

  useEffect(() => {
    let result = users;
    if (searchQuery) {
      result = result.filter(user => 
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (roleFilter !== 'all') result = result.filter(user => user.role === roleFilter);
    if (statusFilter !== 'all') result = result.filter(user => user.status === statusFilter);
    setFilteredUsers(result);
  }, [searchQuery, roleFilter, statusFilter, users]);

  const openMenu = (user, e) => {
    e.stopPropagation();
    setActionUser(user);
    setActionType(null);
    setShowMenu(showMenu === user.id ? null : user.id);
    setSuspendReason('');
    setDeleteConfirm('');
  };

  const handleAction = (type) => {
    setActionType(type);
    setShowMenu(null);
  };

  const handleSuspend = async () => {
    try {
      await userService.updateUser(actionUser.id, { status: 'suspended', suspendReason });
      loadUsers();
      showAlert('success', language === 'am' ? 'ተጠቃሚ ተዓጥቋል!' : 'User suspended successfully!');
      handleCloseModal();
    } catch (error) {
      showAlert('error', language === 'am' ? 'ስህተት!' : 'Failed to suspend user!');
    }
  };

  const handleActivate = async () => {
    try {
      await userService.updateUser(actionUser.id, { status: 'active' });
      loadUsers();
      showAlert('success', language === 'am' ? 'ተጠቃሚ ተክሎ!' : 'User activated successfully!');
      handleCloseModal();
    } catch (error) {
      showAlert('error', language === 'am' ? 'ስህተት!' : 'Failed to activate user!');
    }
  };

  const handleResetPassword = async () => {
    try {
      await userService.resetPassword(actionUser.email);
      showAlert('success', language === 'am' ? 'የፓስወርድ አሻራ ተገናኝቷል!' : 'Password reset email sent!');
      handleCloseModal();
    } catch (error) {
      showAlert('error', language === 'am' ? 'ስህተት!' : 'Failed to send password reset!');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== actionUser?.email) {
      showAlert('error', language === 'am' ? 'የተጠቃሚ ኢሜይል ይሞሉ!' : 'Please enter user email to confirm');
      return;
    }
    try {
      await userService.deleteUser(actionUser.id);
      loadUsers();
      showAlert('success', language === 'am' ? 'ተጠቃሚ ተወግዷል!' : 'User deleted successfully!');
      handleCloseModal();
    } catch (error) {
      showAlert('error', language === 'am' ? 'ስህተት!' : 'Failed to delete user!');
    }
  };

  const handleCloseModal = () => {
    setActionType(null);
    setActionUser(null);
    setSuspendReason('');
    setDeleteConfirm('');
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Icon name="Shield" size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-gray-600">{language === 'am' ? 'ግባይት የለውም' : 'Access Denied'}</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: users.length,
    farmers: users.filter(u => u.role === 'farmer').length,
    buyers: users.filter(u => u.role === 'buyer').length,
    active: users.filter(u => u.status === 'active').length
  };

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700">
          <div className="px-4 mx-auto max-w-7xl lg:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{language === 'am' ? 'የተጠቃሚ አስተዳደር' : 'User Management'}</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {language === 'am' ? 'ተጠቃሚዎችን እና ሚናዎችን ያቀናብሩ' : 'Manage users, roles, and permissions across the platform'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Button variant="outline" size="sm" iconName="Download">{language === 'am' ? 'ወደ ውጭ አስወግድ' : 'Export'}</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mx-auto max-w-7xl lg:px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ጠቅላላ ተጠቃሚዎች' : 'Total Users'}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
                </div>
                <Icon name="Users" size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ንቁ ተጠቃሚዎች' : 'Active Users'}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.status === 'active').length}
                  </p>
                </div>
                <Icon name="CheckCircle" size={24} className="text-green-600 dark:text-green-400" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ገበሬዎች' : 'Farmers'}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.role === 'farmer').length}
                  </p>
                </div>
                <Icon name="Tractor" size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{language === 'am' ? 'ገዢዎች' : 'Buyers'}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.role === 'buyer').length}
                  </p>
                </div>
                <Icon name="ShoppingCart" size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
            </Card>
          </div>

          {/* Users Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === 'am' ? 'ተጠቃሚ' : 'User'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {language === 'am' ? 'ሚና' : 'Role'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {language === 'am' ? 'ሁኔታ' : 'Status'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {language === 'am' ? 'እንቅስቃሴ' : 'Activity'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {language === 'am' ? 'እርምጃዎች' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                        <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <Icon name="Users" size={48} className="mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-600 dark:text-slate-400">{language === 'am' ? 'ምንም ተጠቃሚ አልተገኘም' : 'No users found'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={user.avatar}
                              alt={user.name}
                            />
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {user.name}
                                {user.verified && (
                                  <Icon name="CheckCircle" size={16} className="inline ml-1 text-green-500" />
                                )}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(user.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          <div>Joined: {new Date(user.joinDate).toLocaleDateString()}</div>
                          <div>Last active: {new Date(user.lastActive).toLocaleDateString()}</div>
                          {user.role === 'farmer' && <div>{user.listings} listings</div>}
                          {user.role === 'buyer' && <div>{user.orders} orders</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" iconName="Eye" onClick={() => setViewing(user)} className="text-blue-600 hover:text-blue-700">View</Button>
                            
                            {/* Three-dot Menu */}
                            <div className="relative">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                iconName="MoreHorizontal" 
                                onClick={(e) => openMenu(user, e)}
                                className="text-slate-600 hover:text-slate-900"
                              />
                              
                              {showMenu === user.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                                  <div className="py-1">
                                    {user.status === 'active' ? (
                                      <>
                                        <button
                                          onClick={() => handleAction('suspend')}
                                          className="w-full text-left px-4 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 text-amber-700 dark:text-amber-400"
                                        >
                                          <Icon name="AlertCircle" size={16} />
                                          {language === 'am' ? 'አቁም' : 'Suspend'}
                                        </button>
                                        <button
                                          onClick={() => handleAction('reset-password')}
                                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 text-blue-700 dark:text-blue-400"
                                        >
                                          <Icon name="Key" size={16} />
                                          {language === 'am' ? 'የፓስወርድ' : 'Reset Password'}
                                        </button>
                                        <button
                                          onClick={() => handleAction('delete')}
                                          className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-700 dark:text-red-400"
                                        >
                                          <Icon name="Trash" size={16} />
                                          {language === 'am' ? 'ሰርዝ' : 'Delete'}
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => handleAction('activate')}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
                                      >
                                        <Icon name="CheckCircle" size={16} />
                                        {language === 'am' ? 'ተፍት' : 'Activate'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        {/* View User Modal */}
        {viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'የተጠቃሚ ዝርዝር' : 'User Details'}</h3>
                <Button variant="ghost" size="sm" iconName="X" onClick={() => setViewing(null)} />
              </div>
              <div className="flex items-center space-x-3 mb-4">
                <img className="h-12 w-12 rounded-full object-cover" src={viewing.avatar} alt={viewing.name} />
                <div>
                  <div className="font-semibold">{viewing.name}</div>
                  <div className="text-slate-500 text-sm">{viewing.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">{language === 'am' ? 'ሚና' : 'Role'}</div>
                  <div className="font-medium capitalize">{viewing.role}</div>
                </div>
                <div>
                  <div className="text-slate-500">{language === 'am' ? 'ሁኔታ' : 'Status'}</div>
                  <div className="font-medium capitalize">{viewing.status}</div>
                </div>
                <div>
                  <div className="text-slate-500">{language === 'am' ? 'ተመዝግቧል' : 'Joined'}</div>
                  <div className="font-medium">{new Date(viewing.joinDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-slate-500">{language === 'am' ? 'መጨረሻ ንቁ' : 'Last Active'}</div>
                  <div className="font-medium">{new Date(viewing.lastActive).toLocaleDateString()}</div>
                </div>
                {viewing.role === 'farmer' && (
                  <div>
                    <div className="text-slate-500">{language === 'am' ? 'ዝርዝሮች' : 'Listings'}</div>
                    <div className="font-medium">{viewing.listings}</div>
                  </div>
                )}
                {viewing.role === 'buyer' && (
                  <div>
                    <div className="text-slate-500">{language === 'am' ? 'ትእዛዞች' : 'Orders'}</div>
                    <div className="font-medium">{viewing.orders}</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Suspend Modal */}
        {actionType === 'suspend' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'ተጠቃሚ ማቆም' : 'Suspend User'}</h3>
                <Button variant="ghost" size="sm" iconName="X" onClick={handleCloseModal} />
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-amber-700 dark:text-amber-300 font-medium">{language === 'am' ? 'ማስታወሻ' : 'Warning'}</p>
                  <p className="text-amber-600 dark:text-amber-400 mt-1">{language === 'am' ? 'ይሄንን ተጠቃሚ' : 'This will suspend'} {actionUser?.name}?</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'am' ? 'ምክንያት' : 'Reason'}
                  </label>
                  <Input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder={language === 'am' ? 'የማቆሚያ ምክንያት...' : 'Enter suspension reason...'}
                    multiline
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleCloseModal}>
                    {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                  </Button>
                  <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleSuspend}>
                    {language === 'am' ? 'አቁም' : 'Suspend'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Reset Password Modal */}
        {actionType === 'reset-password' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'የፓስወርድ አሻራ' : 'Reset Password'}</h3>
                <Button variant="ghost" size="sm" iconName="X" onClick={handleCloseModal} />
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-blue-700 dark:text-blue-300 font-medium">{language === 'am' ? 'ማስታወሻ' : 'Info'}</p>
                  <p className="text-blue-600 dark:text-blue-400 mt-1">{language === 'am' ? 'የፓስወርድ አሻራ ወደ' : 'Reset email will be sent to'} {actionUser?.email}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleCloseModal}>
                    {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                  </Button>
                  <Button className="flex-1" onClick={handleResetPassword}>
                    {language === 'am' ? 'ላክ' : 'Send Email'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Modal */}
        {actionType === 'delete' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'ተጠቃሚ ማጥፋት' : 'Delete User'}</h3>
                <Button variant="ghost" size="sm" iconName="X" onClick={handleCloseModal} />
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 font-medium">{language === 'am' ? 'ማስታወሻ' : 'Warning'}</p>
                  <p className="text-red-600 dark:text-red-400 mt-1">{language === 'am' ? 'ይሄ ድርጊት አይመለስም' : 'This cannot be undone'}. {actionUser?.name} {language === 'am' ? 'ይጠፋል' : 'will be deleted'}.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'am' ? 'ለማረጋገጥ ኢሜይል ይስጡ' : 'Enter email to confirm'}
                  </label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={actionUser?.email}
                    className="font-mono"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleCloseModal}>
                    {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                  </Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                    {language === 'am' ? 'አጥፋ' : 'Delete'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Activate Modal */}
        {actionType === 'activate' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{language === 'am' ? 'ተጠቃሚ መክፈት' : 'Activate User'}</h3>
                <Button variant="ghost" size="sm" iconName="X" onClick={handleCloseModal} />
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">{language === 'am' ? 'ማስታወሻ' : 'Success'}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 mt-1">{language === 'am' ? 'ይሄንን ተጠቃሚ መክፈት' : 'Activate'} {actionUser?.name}?</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleCloseModal}>
                    {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleActivate}>
                    {language === 'am' ? 'ተፍት' : 'Activate'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminUsers;
