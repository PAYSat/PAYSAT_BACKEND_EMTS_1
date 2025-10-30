import { Router } from 'express';
import { me } from '../controllers/auth.controller.js';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();

router.get('/me', me);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });

router.get('/user/profiles/:user_id', async (req, res) => {
  // Ver aqui el acceso a perfiles de usuario en firebase, ver ejemplos de routes/stripe.js
});

export default router;