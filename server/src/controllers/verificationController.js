import { pool } from '../config/database.js';

// Helper function to create verification notifications
const createVerificationNotification = async (userId, type, payload) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, payload, is_read) VALUES (?, ?, ?, 0)`,
      [userId, type, JSON.stringify(payload)]
    );
  } catch (error) {
    console.error('Error creating verification notification:', error);
  }
};

// Helper function to notify admins about new verification documents
const notifyAdminsAboutNewDocument = async (userId, documentType, documentName) => {
  try {
    // Get all admin users
    const [adminRows] = await pool.query(
      'SELECT id FROM users WHERE role = "admin"'
    );
    
    if (adminRows.length === 0) return;
    
    // Get user info for the notification
    const [userRows] = await pool.query(
      'SELECT full_name, email FROM users WHERE id = ?',
      [userId]
    );
    
    const userName = userRows[0]?.full_name || 'Unknown User';
    const userEmail = userRows[0]?.email || 'Unknown Email';
    
    // Create notifications for all admins
    const notificationData = adminRows.map(admin => [
      admin.id,
      'verification_document_uploaded_admin',
      JSON.stringify({
        document_type: documentType,
        document_name: documentName,
        user_name: userName,
        user_email: userEmail,
        message: `${userName} (${userEmail}) has uploaded a new ${documentName} for verification.`
      }),
      0 // is_read = false
    ]);
    
    await pool.query(
      'INSERT INTO notifications (user_id, type, payload, is_read) VALUES ?',
      [notificationData]
    );
  } catch (error) {
    console.error('Error notifying admins about new document:', error);
  }
};

// Upload verification document
export const uploadVerificationDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const uid = req.user.uid;
    const { document_type, document_name } = req.body;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id, role FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { id: userId, role: userRole } = userRows[0];
    
    // Create verification_documents table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_documents (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        status ENUM('pending', 'verified', 'rejected', 'not-uploaded') DEFAULT 'pending',
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_date TIMESTAMP NULL,
        verified_by BIGINT NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_document_type (document_type),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    const filePath = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    // Check if document type already exists for this user
    const [existingDocs] = await pool.query(
      'SELECT id FROM verification_documents WHERE user_id = ? AND document_type = ?',
      [userId, document_type]
    );
    
    if (existingDocs.length > 0) {
      // Update existing document
      await pool.query(
        `UPDATE verification_documents 
         SET document_name = ?, file_path = ?, file_size = ?, mime_type = ?, 
             status = 'pending', upload_date = CURRENT_TIMESTAMP, 
             verified_date = NULL, verified_by = NULL, rejection_reason = NULL
         WHERE user_id = ? AND document_type = ?`,
        [document_name, filePath, req.file.size, req.file.mimetype, userId, document_type]
      );
    } else {
      // Insert new document
      await pool.query(
        `INSERT INTO verification_documents 
         (user_id, document_type, document_name, file_path, file_size, mime_type, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, document_type, document_name, filePath, req.file.size, req.file.mimetype]
      );
    }
    
    // Update user verification status
    await updateUserVerificationStatus(userId);
    
    // Create notification for document upload
    await createVerificationNotification(userId, 'verification_document_uploaded', {
      document_type,
      document_name,
      status: 'pending',
      message: `Your ${document_name} has been uploaded and is pending review.`
    });
    
    // Notify admins about new document
    await notifyAdminsAboutNewDocument(userId, document_type, document_name);
    
    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        document_type,
        document_name,
        file_path: filePath,
        status: 'pending',
        upload_date: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Upload verification document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

// Get user verification documents
export const getUserVerificationDocuments = async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id, role FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { id: userId, role: userRole } = userRows[0];
    
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_documents (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        status ENUM('pending', 'verified', 'rejected', 'not-uploaded') DEFAULT 'pending',
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_date TIMESTAMP NULL,
        verified_by BIGINT NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_document_type (document_type),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Get user's documents
    const [documents] = await pool.query(
      `SELECT id, document_type, document_name, file_path, status, 
              upload_date, verified_date, rejection_reason
       FROM verification_documents 
       WHERE user_id = ?
       ORDER BY upload_date DESC`,
      [userId]
    );
    
    // Define required documents based on user role
    const requiredDocuments = {
      farmer: [
        { type: 'national-id', name: 'National ID', nameAm: 'መታወቂያ ካርድ', required: true },
        { type: 'land-certificate', name: 'Land Use Certificate', nameAm: 'የመሬት ይዞታ ሰርተፊኬት', required: true },
        { type: 'cooperative-membership', name: 'Cooperative Membership', nameAm: 'የህብረት ስራ አባልነት', required: false }
      ],
      buyer: [
        { type: 'national-id', name: 'National ID', nameAm: 'መታወቂያ ካርድ', required: true },
        { type: 'business-license', name: 'Business License', nameAm: 'የንግድ ፈቃድ', required: false },
        { type: 'tax-certificate', name: 'Tax Registration Certificate', nameAm: 'የግብር ምዝገባ ሰርተፊኬት', required: false }
      ]
    };
    
    const roleDocuments = requiredDocuments[userRole] || [];
    
    // Map documents to include all required types
    const documentMap = {};
    documents.forEach(doc => {
      documentMap[doc.document_type] = {
        id: doc.id,
        document_type: doc.document_type,
        document_name: doc.document_name,
        file_path: doc.file_path,
        status: doc.status,
        upload_date: doc.upload_date,
        verified_date: doc.verified_date,
        rejection_reason: doc.rejection_reason
      };
    });
    
    // Create complete document list with status
    const completeDocuments = roleDocuments.map(reqDoc => {
      const uploadedDoc = documentMap[reqDoc.type];
      return {
        id: reqDoc.type,
        name: reqDoc.name,
        nameAm: reqDoc.nameAm,
        required: reqDoc.required,
        status: uploadedDoc ? uploadedDoc.status : 'not-uploaded',
        uploadDate: uploadedDoc ? uploadedDoc.upload_date : null,
        verifiedDate: uploadedDoc ? uploadedDoc.verified_date : null,
        filePath: uploadedDoc ? uploadedDoc.file_path : null,
        rejectionReason: uploadedDoc ? uploadedDoc.rejection_reason : null,
        documentId: uploadedDoc ? uploadedDoc.id : null
      };
    });
    
    res.json({
      documents: completeDocuments,
      summary: {
        total: completeDocuments.length,
        uploaded: completeDocuments.filter(doc => doc.status !== 'not-uploaded').length,
        verified: completeDocuments.filter(doc => doc.status === 'verified').length,
        pending: completeDocuments.filter(doc => doc.status === 'pending').length,
        rejected: completeDocuments.filter(doc => doc.status === 'rejected').length,
        requiredVerified: completeDocuments.filter(doc => doc.required && doc.status === 'verified').length,
        totalRequired: completeDocuments.filter(doc => doc.required).length
      }
    });
  } catch (error) {
    console.error('Get verification documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

// Update document status (admin only)
export const updateDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const uid = req.user.uid;
    
    // Check if user is admin
    const [userRows] = await pool.query(
      'SELECT id, role FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const adminId = userRows[0].id;
    
    // Update document status
    const updateFields = ['status = ?'];
    const updateValues = [status];
    
    if (status === 'verified') {
      updateFields.push('verified_date = CURRENT_TIMESTAMP', 'verified_by = ?', 'rejection_reason = NULL');
      updateValues.push(adminId);
    } else if (status === 'rejected' && rejection_reason) {
      updateFields.push('rejection_reason = ?', 'verified_date = NULL', 'verified_by = NULL');
      updateValues.push(rejection_reason);
    }
    
    updateValues.push(id);
    
    const [result] = await pool.query(
      `UPDATE verification_documents SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get the user ID and document details for this document
    const [docRows] = await pool.query(
      `SELECT user_id, document_type, document_name FROM verification_documents WHERE id = ?`, 
      [id]
    );
    
    if (docRows.length > 0) {
      const { user_id, document_type, document_name } = docRows[0];
      
      // Update user verification status
      await updateUserVerificationStatus(user_id);
      
      // Create notification based on status
      let notificationType, notificationMessage;
      
      if (status === 'verified') {
        notificationType = 'verification_document_approved';
        notificationMessage = `Your ${document_name} has been approved and verified!`;
      } else if (status === 'rejected') {
        notificationType = 'verification_document_rejected';
        notificationMessage = `Your ${document_name} has been rejected. ${rejection_reason ? 'Reason: ' + rejection_reason : ''}`;
      } else if (status === 'pending') {
        notificationType = 'verification_document_pending';
        notificationMessage = `Your ${document_name} status has been updated to pending review.`;
      }
      
      if (notificationType) {
        await createVerificationNotification(user_id, notificationType, {
          document_type,
          document_name,
          status,
          rejection_reason: rejection_reason || null,
          message: notificationMessage
        });
      }
    }
    
    res.json({ message: 'Document status updated successfully' });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({ error: 'Failed to update document status' });
  }
};

// Delete verification document
export const deleteVerificationDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    
    // Delete document (only if it belongs to the user)
    const [result] = await pool.query(
      'DELETE FROM verification_documents WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete verification document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// Get all verification documents (admin only)
export const getAllVerificationDocuments = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { status, page = 1, limit = 20 } = req.query;
    
    // Check if user is admin
    const [userRows] = await pool.query(
      'SELECT id, role FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Build query
    let whereClause = '1=1';
    const queryParams = [];
    
    if (status) {
      whereClause += ' AND vd.status = ?';
      queryParams.push(status);
    }
    
    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM verification_documents vd WHERE ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;
    
    // Get documents with user info
    const offset = (page - 1) * limit;
    const [documents] = await pool.query(
      `SELECT 
        vd.id,
        vd.document_type,
        vd.document_name,
        vd.file_path,
        vd.file_size,
        vd.mime_type,
        vd.status,
        vd.upload_date,
        vd.verified_date,
        vd.rejection_reason,
        vd.created_at,
        u.id as user_id,
        u.full_name,
        u.email,
        u.role,
        u.region,
        u.woreda
       FROM verification_documents vd
       JOIN users u ON vd.user_id = u.id
       WHERE ${whereClause}
       ORDER BY vd.upload_date DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );
    
    res.json({
      documents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all verification documents error:', error);
    res.status(500).json({ error: 'Failed to fetch verification documents' });
  }
};

// Helper function to update user verification status based on documents
const updateUserVerificationStatus = async (userId) => {
  try {
    // Check if user has at least one verified document
    const [verifiedDocs] = await pool.query(
      'SELECT COUNT(*) as verified_count FROM verification_documents WHERE user_id = ? AND status = "verified"',
      [userId]
    );
    
    const hasVerifiedDocs = verifiedDocs[0].verified_count > 0;
    const verificationStatus = hasVerifiedDocs ? 'verified' : 'pending';
    
    // Update user's verification status
    await pool.query(
      'UPDATE users SET verification_status = ? WHERE id = ?',
      [verificationStatus, userId]
    );
    
    console.log(`Updated user ${userId} verification status to: ${verificationStatus}`);
  } catch (error) {
    console.error('Error updating user verification status:', error);
    // Non-fatal error, don't throw
  }
};
