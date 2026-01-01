import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

const router = Router();

router.get('/p2p/me/wallet', async (req, res) => {
  try {
    const uid = req.user.uid;
    const snap = await db.collection(COL.CRYPTO_WALLETS).doc(uid).collection('assets').get();
    const assets = snap.docs.map(d => d.data());
    return res.json({ ok:true, assets });
  } catch (e) {
    return res.status(500).json({ ok:false, message: e.message });
  }
});

export default router;
