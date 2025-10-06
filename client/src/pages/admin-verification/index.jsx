import React, { useState, useEffect } from 'react';
import { verificationService } from '../../services/apiService';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const AdminVerificationPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('verified');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [selectedStatus, currentPage]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {
        page: currentPage,
        limit: 20
      };
      
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      
      const response = await verificationService.getAllDocuments(params);
      setDocuments(response.documents || []);
      setPagination(response.pagination || {});
    } catch (err) {
      console.error('Failed to load verification documents:', err);
      setError('Failed to load verification documents');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedDocument) return;
    
    try {
      await verificationService.updateDocumentStatus(
        selectedDocument.id,
        newStatus,
        newStatus === 'rejected' ? rejectionReason : null
      );
      
      setShowStatusModal(false);
      setSelectedDocument(null);
      setRejectionReason('');
      loadDocuments(); // Reload to show updated status
    } catch (err) {
      console.error('Failed to update document status:', err);
      alert('Failed to update document status');
    }
  };

  const openStatusModal = (document) => {
    setSelectedDocument(document);
    setNewStatus(document.status === 'pending' ? 'verified' : document.status);
    setRejectionReason(document.rejection_reason || '');
    setShowStatusModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      verified: { color: 'bg-green-100 text-green-800', text: 'Verified' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' },
      'not-uploaded': { color: 'bg-gray-100 text-gray-800', text: 'Not Uploaded' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDocumentTypeLabel = (type) => {
    const typeLabels = {
      'national-id': 'National ID',
      'land-certificate': 'Land Certificate',
      'business-license': 'Business License',
      'tax-certificate': 'Tax Certificate',
      'organic-certificate': 'Organic Certificate',
      'cooperative-membership': 'Cooperative Membership'
    };
    return typeLabels[type] || type;
  };

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Verification</h1>
          <p className="text-gray-600">Review and manage user verification documents</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Documents</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="not-uploaded">Not Uploaded</option>
              </select>
            </div>
            
            <Button
              onClick={loadDocuments}
              variant="outline"
              size="sm"
              iconName="RefreshCw"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Icon name="AlertCircle" size={20} className="text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="FileText" size={48} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
              <p className="text-gray-500">No verification documents match your current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {doc.full_name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {doc.email} • {doc.role}
                          </div>
                          <div className="text-xs text-gray-400">
                            {doc.region && doc.woreda ? `${doc.woreda}, ${doc.region}` : 'No location'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getDocumentTypeLabel(doc.document_type)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {doc.document_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.upload_date ? formatDate(doc.upload_date) : 'Not uploaded'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.file_size ? (
                          <div>
                            <div>{formatFileSize(doc.file_size)}</div>
                            <div className="text-xs text-gray-400">{doc.mime_type}</div>
                          </div>
                        ) : (
                          'No file'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {doc.file_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.file_path, '_blank')}
                              iconName="Eye"
                            >
                              View
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusModal(doc)}
                            iconName="Edit"
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!pagination.hasPrev}
                iconName="ChevronLeft"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={!pagination.hasNext}
                iconName="ChevronRight"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Status Update Modal */}
        {showStatusModal && selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Document Status
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document: {getDocumentTypeLabel(selectedDocument.document_type)}
                  </label>
                  <p className="text-sm text-gray-500">
                    User: {selectedDocument.full_name} ({selectedDocument.email})
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                
                {newStatus === 'rejected' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Please provide a reason for rejection..."
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedDocument(null);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusChange}
                  disabled={newStatus === 'rejected' && !rejectionReason.trim()}
                >
                  Update Status
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVerificationPage;
