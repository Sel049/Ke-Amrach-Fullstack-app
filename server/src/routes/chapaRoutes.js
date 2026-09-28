import { Router } from "express";
import * as chapaController from '../controllers/chapaController.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

// Initialize payment (requires auth)
router.post('/initialize', authGuard, chapaController.initializeChapaPayment);

// Verify payment (requires auth)
router.get('/verify/:txRef', authGuard, chapaController.verifyChapaPayment);

// Webhook (public)
router.post('/webhook', chapaController.handleChapaWebhook);

export default router;
