import { Router } from 'express';
import { userProfile } from '../controllers/auth_controller.js';
import AppAccountCardPaysatTransactionsController from '../controllers/app_account_and_card_paysat_transactions_controller.js';
import { db } from '../config/firebase.js';
import { emailService } from '../services/send_email_service.js';
import { v4 as uuidv4 } from 'uuid';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();
const appAccountCardPaysatTransactionsController = new AppAccountCardPaysatTransactionsController();

// Función helper para convertir a centavos
const toCents = (amount) => Math.round(parseFloat(parseFloat(amount).toFixed(2)) * 100);

router.get('/userprofile', userProfile);

router.get('/account/details/:paysatUID', appAccountCardPaysatTransactionsController.userAccountDetails);

router.get('/account/transactions/history/:paysatUID', appAccountCardPaysatTransactionsController.accountTransactionsHistory);

router.get('/account/transactions/balance/:paysatUID', appAccountCardPaysatTransactionsController.accountTransactionsBalance);

router.get('/cards/transactions/history/:paysatUID', appAccountCardPaysatTransactionsController.cardTransactionsHistory);

router.get('/cards/transactions/balance/:paysatUID', appAccountCardPaysatTransactionsController.cardTransactionsBalance);

router.get('/cards/check/:paysatUID', appAccountCardPaysatTransactionsController.hasUserCard);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });

export default router;
