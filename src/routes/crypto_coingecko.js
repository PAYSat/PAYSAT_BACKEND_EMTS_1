import { Router } from 'express';
import { cryptoCurrenciesList, cryptoCurrencyById } from '../controllers/crypto_coingecko_controller.js';

const router = Router();

router.get('/currencies/list', cryptoCurrenciesList);
router.get('/currency/:id', cryptoCurrencyById);

export default router;
