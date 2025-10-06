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
router.delete('/listings/:id', (req, res, next) => {
  import('../controllers/farmerController.js')
    .then(mod => mod.deleteFarmerListing(req, res, next))
    .catch(next);
});
router.patch('/listings/bulk-status', bulkUpdateListingStatus);
router.delete('/listings/bulk', bulkDeleteListings);

// Farmer orders
router.get('/orders', getFarmerOrders);

// Image upload
router.post('/upload-image', upload.single('image'), handleUploadError, uploadImage);
router.post('/listings/:id/images', (req, res, next) => {
  console.log('=== ROUTE DEBUG: /listings/:id/images ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body:', req.body);
  console.log('Params:', req.params);
  
  // Check if request has file upload or JSON data
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    console.log('Handling as file upload');
    // Handle file upload
    upload.single('image')(req, res, (err) => {
      if (err) {
        handleUploadError(err, req, res, next);
      } else {
        addListingImage(req, res, next);
      }
    });
  } else {
    console.log('Handling as JSON data');
    // Handle JSON data (URL)
    addListingImage(req, res, next);
  }
});

// Debug endpoint to check images
router.get('/debug/images/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { pool } = await import('../config/database.js');
    
    const [images] = await pool.query(`
      SELECT id, listing_id, url, sort_order, created_at
      FROM listing_images 
      WHERE listing_id = ?
      ORDER BY sort_order
    `, [listingId]);
    
    res.json({
      listingId,
      imageCount: images.length,
      images: images
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
