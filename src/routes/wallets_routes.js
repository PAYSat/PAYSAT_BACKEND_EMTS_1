import { Router } from 'express';
import { getWalletById,
         getWalletsByUserId,
         createWallet } from '../controllers/wallet_controller.js';

const router = Router();

router.get('/balance/:id', getWalletById);
router.get('/balance/user/:userId', getWalletsByUserId);
router.post('/create', createWallet);

export default router;