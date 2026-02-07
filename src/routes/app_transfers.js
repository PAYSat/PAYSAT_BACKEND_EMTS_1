import { Router } from 'express';
import AppTransfersController from '../controllers/app_transfers_controller.js';
import AppEcuaredTransferController from '../controllers/app_signup_otp_controller.js';

const router = Router();
    
const appTransfersController = new AppTransfersController();
const appEcuaredTransferController = new AppEcuaredTransferController();

router.post('/send', appTransfersController.send);

router.post('/send-otp', appEcuaredTransferController.sendOTP);
router.post('/verify-otp', appEcuaredTransferController.verifyOTP);

router.get('/list/last-three', appTransfersController.listLastThree);


export default router;