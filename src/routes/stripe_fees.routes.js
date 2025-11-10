import { Router } from 'express';
import { feesByCharge, feesByIntent } from '../controllers/stripe_fees.controller.js';

const router = Router();

router.get('/by-charge/:chargeId', feesByCharge);
router.get('/by-intent/:paymentIntentId', feesByIntent);

export default router;
