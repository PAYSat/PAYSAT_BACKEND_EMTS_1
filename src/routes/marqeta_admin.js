import { Router } from 'express';
import { getBalances, listTransactions } from '../services/marqeta.js';

const router = Router();

router.get('/balances', async (req, res) => {
  try {
    const data = await getBalances({ user_token: req.query.user_token });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const data = await listTransactions({ user_token: req.query.user_token, count: 20 });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
