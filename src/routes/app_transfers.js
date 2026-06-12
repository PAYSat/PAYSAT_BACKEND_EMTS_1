import { Router } from 'express';
import AppTransfersController from '../controllers/app_transfers_controller.js';
import AppPaySatTransferController from '../controllers/app_signup_otp_controller.js';
import LinkedUserAccountTransferController from '../controllers/app_linked_user_account_transfer_controller.js';
import LinkedUserPhoneNumbersTransferController from '../controllers/app_linked_user_phone_numbers_transfer_controller.js';
import QRLinkedUserPhoneNumbersTransferController from '../controllers/app_qr_linked_user_phone_numbers_transfer_controller.js';
import AppUserNotificationsController from '../controllers/app_user_notifications_controller.js';

const router = Router();
    
const appTransfersController = new AppTransfersController();
const appPaySatTransferController = new AppPaySatTransferController();
const linkedUserAccountTransferController = new LinkedUserAccountTransferController();
const linkedUserPhoneNumbersTransferController = new LinkedUserPhoneNumbersTransferController();
const qrLinkedUserPhoneNumbersTransferController = new QRLinkedUserPhoneNumbersTransferController();
const appUserNotificationsController = new AppUserNotificationsController();

// Rutas para listar cuentas propias y de destino
router.get('/user/accounts/list/:id', linkedUserAccountTransferController.listUserOwnAccounts);
router.get('/user/destination/accounts/list/:id', linkedUserAccountTransferController.listUserDestinationAccounts);

// Rutas para listar países, tipos de cuenta, tipos de documento y afiliados
router.get('/user/account/country/list', linkedUserAccountTransferController.listAccountCountry);
router.get('/affiliates/list', linkedUserAccountTransferController.listAffiliates);
router.get('/user/account/type/list', linkedUserAccountTransferController.listAccountTypes);
router.get('/user/document/type/list', linkedUserAccountTransferController.listDocumentTypes);

// Rutas para validar y registrar cuentas propias y de destino
router.post('/user/register/own/account/validate', linkedUserAccountTransferController.validateNewOwnAccount);
router.post('/user/register/destination/account/validate', linkedUserAccountTransferController.validateNewDestinationAccount);

// Rutas para eliminar cuentas propias y de destino
router.delete('/user/delete/own/account/:accountUID', linkedUserAccountTransferController.deleteOwnAccount);
router.delete('/user/delete/destination/account/:accountUID', linkedUserAccountTransferController.deleteDestinationAccount);

// Determinar comisión de transferencia
router.post('/determine/transfer/fee', linkedUserAccountTransferController.determinateTransferFee);

// Ruta para realizar transferencia
router.post('/send/linked/accounts', linkedUserAccountTransferController.transferBetweenAccounts);

//-----------------------------------------------------------------------------------------------------------------------------------//
// Rutas para PAGO MOVIL INTERNACIONAL PAYSAT
router.get('/user/destination/phone-numbers/list/:id', linkedUserPhoneNumbersTransferController.listDestinationTransfersPhoneNumbers);
router.post('/user/register/destination/phone-number', linkedUserPhoneNumbersTransferController.saveDestinationPhoneNumbers);
router.delete('/user/delete/destination/phone-number/:phoneNumberFull', linkedUserPhoneNumbersTransferController.deleteDestinationPhoneNumber);
router.get('/user/destination/phone-number/fee', linkedUserPhoneNumbersTransferController.getPhoneNumberTransferFee);
router.post('/user/send/transfer/to/phone-number', linkedUserPhoneNumbersTransferController.sendTransferToPhoneNumber);
router.post('/user/receive/pending/phone-number/transfer', linkedUserPhoneNumbersTransferController.receivePendingPhoneNumberTransfer);

//-----------------------------------------------------------------------------------------------------------------------------------//
// Rutas para PAGO MOVIL QR INTERNACIONAL PAYSAT
router.get('/user/destination/phone-numbers/list/:id', linkedUserPhoneNumbersTransferController.listDestinationTransfersPhoneNumbers);
router.post('/user/register/destination/phone-number', linkedUserPhoneNumbersTransferController.saveDestinationPhoneNumbers);
router.delete('/user/delete/destination/phone-number/:phoneNumberFull', linkedUserPhoneNumbersTransferController.deleteDestinationPhoneNumber);
router.get('/user/destination/phone-number/fee', linkedUserPhoneNumbersTransferController.getPhoneNumberTransferFee);
router.post('/user/send/transfer/to/phone-number', linkedUserPhoneNumbersTransferController.sendTransferToPhoneNumber);
router.post('/user/receive/pending/phone-number/transfer', linkedUserPhoneNumbersTransferController.receivePendingPhoneNumberTransfer);

router.post('/qr/generate-static', qrLinkedUserPhoneNumbersTransferController.generateStaticQR);
router.post('/qr/generate-dynamic', qrLinkedUserPhoneNumbersTransferController.generateDynamicQR);
router.post('/qr/validate', qrLinkedUserPhoneNumbersTransferController.validateQR);
router.post('/qr/perform-transfer', qrLinkedUserPhoneNumbersTransferController.qrPerformTransferToPhoneNumber);
router.post('/qr/revoke', qrLinkedUserPhoneNumbersTransferController.revokeQR);
router.get('/qr/list/my-qrs', qrLinkedUserPhoneNumbersTransferController.listMyQRs);

//-----------------------------------------------------------------------------------------------------------------------------------//
// Rutas para NOTIFICACIONES DE TRANSFERENCIAS
router.get('/notifications/list/:id', appUserNotificationsController.listTransferNotifications);


//-----------------------------------------------------------------------------------------------------------------------------------//
router.post('/send', appTransfersController.send);

router.post('/send-otp', appPaySatTransferController.sendOTP);
router.post('/verify-otp', appPaySatTransferController.verifyOTP);

router.get('/list/last-three', appTransfersController.listLastThree);


export default router;