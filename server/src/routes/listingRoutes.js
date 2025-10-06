import { Router } from "express";
import { authGuard } from "../middleware/auth.js";
import {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  getFarmerListings,
  searchListings,
  getAllActiveListings,
  getListingsByCategory,
  getListingsByRegion,
  getAllListingsAdmin,
  adminUpdateListingStatus
} from "../controllers/listingController.js";

const router = Router();

// Public routes (no authentication required)
router.get('/active', getAllActiveListings);
router.get('/search', searchListings);
router.get('/category/:category', getListingsByCategory);
router.get('/region/:region', getListingsByRegion);
// Admin listings must come before id route to avoid being captured by :id
router.get('/admin/all', authGuard, getAllListingsAdmin);
router.patch('/admin/:id/status', authGuard, adminUpdateListingStatus);
router.get('/:id', getListingById);

// Protected routes (authentication required)
router.use(authGuard);

// Listing management
router.post('/', createListing);
router.get('/', getListings);
router.put('/:id', updateListing);
router.delete('/:id', deleteListing);

// Farmer-specific routes
router.get('/farmer/my-listings', getFarmerListings);

export default router;
