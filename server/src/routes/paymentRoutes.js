const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// Payment method routes
router.get('/methods/:userId', auth, paymentController.getUserPaymentMethods);
router.post('/methods/:userId', auth, paymentController.addPaymentMethod);
router.put('/methods/:paymentMethodId/verify', auth, paymentController.verifyPaymentMethod);
router.delete('/methods/:paymentMethodId', auth, paymentController.removePaymentMethod);

// Payment processing routes
router.post('/process', auth, paymentController.processPayment);
router.get('/history/:userId', auth, paymentController.getPaymentHistory);
router.get('/stats/:userId', auth, paymentController.getPaymentStats);

// Advanced payment features
router.get('/dashboard/:userId', auth, paymentController.getPaymentDashboard);
router.get('/trends', auth, paymentController.getPaymentTrends);
router.get('/bank-performance', auth, paymentController.getBankPerformance);
router.get('/fraud-report/:userId', auth, paymentController.getFraudReport);
router.post('/refund/:paymentId', auth, paymentController.processRefund);
router.get('/status/:paymentId', auth, paymentController.getPaymentStatus);
router.get('/providers', auth, paymentController.getPaymentProviders);

// Testing and simulation routes
router.post('/simulate', auth, paymentController.simulatePaymentProcessing);

module.exports = router;
