import { Router } from "express";
import { authGuard } from "../middleware/auth.js";
import upload, { handleUploadError } from "../middleware/upload.js";
import {
  getFarmerMetrics,
  getFarmerListings,
  getFarmerOrders,
  getFarmerRecentActivity,
  createFarmerListing,
  updateFarmerListing,
  updateListingStatus,
  bulkUpdateListingStatus,
  bulkDeleteListings,
  uploadImage,
  addListingImage
} from "../controllers/farmerController.js";

const router = Router();

// All routes require authentication
router.use(authGuard);

// Farmer dashboard and metrics
router.get('/metrics', getFarmerMetrics);
router.get('/activity', getFarmerRecentActivity);

// Farmer listings management
router.get('/listings', getFarmerListings);
router.post('/listings', createFarmerListing);
router.put('/listings/:id', updateFarmerListing);
router.patch('/listings/:id/status', updateListingStatus);
router.patch('/listings/bulk-status', bulkUpdateListingStatus);
router.delete('/listings/bulk', bulkDeleteListings);

// Farmer orders
router.get('/orders', getFarmerOrders);

// Image upload
router.post('/upload-image', upload.single('image'), handleUploadError, uploadImage);
router.post('/listings/:id/images', upload.single('image'), handleUploadError, addListingImage);

export default router;
