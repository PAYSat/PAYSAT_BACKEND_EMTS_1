import { Router } from 'express';
import AppTransfersController from '../controllers/app_transfers_controller.js';
import AppPaySatTransferController from '../controllers/app_signup_otp_controller.js';
import LinkedUserAccountTransferController from '../controllers/app_linked_user_account_transfer_controller.js';

const router = Router();
    
const appTransfersController = new AppTransfersController();
const appPaySatTransferController = new AppPaySatTransferController();
const linkedUserAccountTransferController = new LinkedUserAccountTransferController();

router.post('/user/account/new/register', linkedUserAccountTransferController.createNewLinkedAccount);
router.post('/user/account/destination/register', linkedUserAccountTransferController.createDestinationLinkedAccount);

router.post('/send', appTransfersController.send);

router.post('/send-otp', appPaySatTransferController.sendOTP);
router.post('/verify-otp', appPaySatTransferController.verifyOTP);

router.get('/list/last-three', appTransfersController.listLastThree);


export default router;