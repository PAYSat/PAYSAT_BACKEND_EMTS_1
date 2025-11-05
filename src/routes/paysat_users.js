import { Router } from 'express';
import { userProfile } from '../controllers/auth.controller.js';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();

router.get('/userprofile', userProfile);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });


export default router;