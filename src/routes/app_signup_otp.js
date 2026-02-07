import { Router } from 'express';
import AppSignupOtpController from '../controllers/app_signup_otp_controller.js';

const router = Router();
    
const appSignupOtpController = new AppSignupOtpController();

router.post('/send-otp', appSignupOtpController.sendOTP);
router.post('/verify-otp', appSignupOtpController.verifyOTP);



export default router;