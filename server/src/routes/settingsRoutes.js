import { Router } from 'express';
import { authGuard, adminGuard } from '../middleware/auth.js';
import {
  getSettings,
  updateSettings,
  getPublicSettings,
} from '../controllers/settingsController.js';

const router = Router();

// Publicly visible settings (no auth)
router.get('/public', getPublicSettings);

// Admin-only settings
router.get('/', authGuard, adminGuard, getSettings);
router.put('/', authGuard, adminGuard, updateSettings);
// POST alias for clients that prefer it
router.post('/', authGuard, adminGuard, updateSettings);

export default router;