import { Router } from 'express';
import AppTransfersController from '../controllers/app_transfers_controller.js';
import AppPaySatTransferController from '../controllers/app_signup_otp_controller.js';
import LinkedUserAccountTransferController from '../controllers/app_linked_user_account_transfer_controller.js';

const router = Router();
    
const appTransfersController = new AppTransfersController();
const appPaySatTransferController = new AppPaySatTransferController();
const linkedUserAccountTransferController = new LinkedUserAccountTransferController();

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


router.post('/send', appTransfersController.send);

router.post('/send-otp', appPaySatTransferController.sendOTP);
router.post('/verify-otp', appPaySatTransferController.verifyOTP);

router.get('/list/last-three', appTransfersController.listLastThree);


export default router;