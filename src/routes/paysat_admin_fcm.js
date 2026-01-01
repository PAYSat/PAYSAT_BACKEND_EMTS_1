import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { requireRole } from '../middlewares/roles.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const now = () => new Date();

router.post('/admin/fcm/token', requireRole('ADMIN'), async (req, res) => {
  try {
    const uid = req.user.uid;
    const token = String(req.body.token || '').trim();
    const platform = String(req.body.platform || 'unknown').trim();
    if (!token) return res.status(400).json({ ok:false, message:'token requerido' });

    // un doc por token
    const id = uuidv4();
    await db.collection(COL.ADMIN_FCM_TOKENS).doc(id).set({
      id, uid, token, platform,
      createdAt: now(),
      updatedAt: now(),
    });

    return res.json({ ok:true, id });
  } catch (e) {
    return res.status(500).json({ ok:false, message: e.message });
  }
});

export default router;
