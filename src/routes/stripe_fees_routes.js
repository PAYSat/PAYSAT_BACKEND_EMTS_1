import { Router } from 'express';
import { feesByRecharge, feesByIntent } from '../controllers/stripe_fees_controller.js';

const router = Router();

router.get('/by-recharge/:rechargeId', feesByRecharge);
router.get('/by-intent/:paymentIntentId', feesByIntent);

export default router;
