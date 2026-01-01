import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const now = () => new Date();

// POST /api/paysat/fcm/token
// body: { token, platform }
router.post('/fcm/token', async (req, res) => {
  try {
    const uid = req.user.uid;
    const token = String(req.body.token || '').trim();
    const platform = String(req.body.platform || 'unknown').trim();

    if (!token) return res.status(400).json({ ok:false, message:'token requerido' });

    // Evitar duplicados por uid+token
    const existing = await db.collection(COL.USER_FCM_TOKENS)
      .where('uid', '==', uid)
      .where('token', '==', token)
      .limit(1)
      .get();

    if (!existing.empty) {
      const docId = existing.docs[0].id;
      await db.collection(COL.USER_FCM_TOKENS).doc(docId).update({ platform, updatedAt: now() });
      return res.json({ ok:true, id: docId, updated: true });
    }

    const id = uuidv4();
    await db.collection(COL.USER_FCM_TOKENS).doc(id).set({
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
