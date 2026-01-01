import { Router } from 'express';
const router = Router();

router.get('/me', async (req, res) => {
  res.json({ ok: true, user: req.user });
});

export default router;
