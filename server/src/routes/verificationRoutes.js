import { Router } from "express";
import { authGuard } from "../middleware/auth.js";
import upload, { handleUploadError } from "../middleware/upload.js";
import {
  uploadVerificationDocument,
  getUserVerificationDocuments,
  updateDocumentStatus,
  deleteVerificationDocument,
  getAllVerificationDocuments
} from "../controllers/verificationController.js";

const router = Router();

// All routes require authentication
router.use(authGuard);

// Document verification routes
router.post('/documents', upload.single('document'), handleUploadError, uploadVerificationDocument);
router.get('/documents', getUserVerificationDocuments);
router.put('/documents/:id/status', updateDocumentStatus);
router.delete('/documents/:id', deleteVerificationDocument);

// Admin routes
router.get('/admin/documents', getAllVerificationDocuments);

export default router;
