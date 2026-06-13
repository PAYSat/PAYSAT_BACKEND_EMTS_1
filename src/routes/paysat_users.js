import { Router } from 'express';
import { db } from '../config/firebase.js';
import { emailService } from '../services/send_email_service.js';
import { v4 as uuidv4 } from 'uuid';
import { authFirebaseRequired } from '../middlewares/auth-firebase.js';
import { userProfile, sendWelcomeEmailToUser } from '../controllers/auth_controller.js';
import AppAccountCardPaysatTransactionsController from '../controllers/app_account_and_card_paysat_transactions_controller.js';
import AppUserNotificationsController from '../controllers/app_user_notifications_controller.js';

// import { requireRole } from '../middlewares/roles.js';

const router = Router();
const appAccountCardPaysatTransactionsController = new AppAccountCardPaysatTransactionsController();
const appUserNotificationsController = new AppUserNotificationsController();

// Función helper para convertir a centavos
const toCents = (amount) => Math.round(parseFloat(parseFloat(amount).toFixed(2)) * 100);

/**
 * Controlador para enviar email de bienvenida
 * Requiere autenticación con bearer token
 */
router.post('/send-welcome-email', sendWelcomeEmailToUser);

router.get('/userprofile', userProfile);

router.get('/account/details/:paysatUID', appAccountCardPaysatTransactionsController.userAccountDetails);

router.get('/account/transactions/history/:paysatUID', appAccountCardPaysatTransactionsController.accountTransactionsHistory);

router.post('/account/transactions/history/per-month', appAccountCardPaysatTransactionsController.accountTransactionsHistoryPerMonth);

router.get('/account/transactions/history/last-four/:paysatUID', appAccountCardPaysatTransactionsController.accountTransactionsHistoryLastFour);

router.get('/account/transactions/balance/:paysatUID', appAccountCardPaysatTransactionsController.accountTransactionsBalance);

router.get('/cards/transactions/history/:paysatUID', appAccountCardPaysatTransactionsController.cardTransactionsHistory);

router.get('/cards/transactions/balance/:paysatUID', appAccountCardPaysatTransactionsController.cardTransactionsBalance);

router.get('/cards/check/:paysatUID', appAccountCardPaysatTransactionsController.hasUserCard);

// RUTAS DE NOTIFICACIONES DE USUARIOS
router.post('/save/notifications/login', appUserNotificationsController.saveLoginNotification);
router.post('/notifications/unread/count', appUserNotificationsController.getUnreadNotificationsCount);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });

export default router;
