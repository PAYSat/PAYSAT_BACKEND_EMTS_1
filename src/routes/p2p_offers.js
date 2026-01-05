import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { OFFER_STATUS } from '../utils/p2p_status.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const now = () => new Date();

// Crear oferta
router.post('/offers', async (req, res) => {
  try {
    const uid = req.user.uid;

    const {
      type,           // 'SELL' o 'BUY'
      asset,          // 'USDT'
      currency,       // 'USD'
      price,          // número
      minAmount,      // número
      maxAmount,      // número
      paymentMethods, // array
      terms,          // string
      activeUntilMinutes // optional
    } = req.body;

    if (!type || !asset || !currency || !price) {
      return res.status(400).json({ ok: false, message: 'Campos requeridos: type, asset, currency, price' });
    }

    // Obtener nombre completo del usuario
    const userSnap = await db.collection(COL.PAYSAT_USERS).doc(uid).get();
    const userName = userSnap.exists ? (userSnap.data().nombreCompleto || '') : '';

    const id = uuidv4();
    const doc = {
      id,
      userId: uid,
      userName,
      type: String(type).toUpperCase(),
      asset: String(asset).toUpperCase(),
      currency: String(currency).toUpperCase(),
      price: Number(price),
      minAmount: Number(minAmount || 0),
      maxAmount: Number(maxAmount || 0),
      paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
      terms: terms || '',
      status: OFFER_STATUS.ACTIVE,
      createdAt: now(),
      updatedAt: now(),
      ...(activeUntilMinutes ? { activeUntil: new Date(Date.now() + Number(activeUntilMinutes) * 60000) } : {})
    };

    await db.collection(COL.P2P_OFFERS).doc(id).set(doc);

    return res.json({ ok: true, offer: doc });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Listar ofertas (filtros simples)
router.get('/offers', async (req, res) => {
  try {
    const { type, asset, currency, status } = req.query;

    let q = db.collection(COL.P2P_OFFERS);
    if (type) q = q.where('type', '==', String(type).toUpperCase());
    if (asset) q = q.where('asset', '==', String(asset).toUpperCase());
    if (currency) q = q.where('currency', '==', String(currency).toUpperCase());
    if (status) q = q.where('status', '==', String(status).toUpperCase());

    // por defecto solo ACTIVE
    if (!status) q = q.where('status', '==', OFFER_STATUS.ACTIVE);

    const snap = await q.get();
    const offers = snap.docs.map(d => d.data());

    return res.json({ ok: true, offers });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Detalle
router.get('/offers/:id', async (req, res) => {
  try {
    const snap = await db.collection(COL.P2P_OFFERS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Oferta no encontrada' });
    return res.json({ ok: true, offer: snap.data() });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Pausar/Activar
router.patch('/offers/:id/status', async (req, res) => {
  try {
    const uid = req.user.uid;
    const { status } = req.body;

    const ref = db.collection(COL.P2P_OFFERS).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Oferta no encontrada' });

    const offer = snap.data();
    if (offer.userId !== uid) return res.status(403).json({ ok: false, message: 'No autorizado' });

    const next = String(status || '').toUpperCase();
    if (![OFFER_STATUS.ACTIVE, OFFER_STATUS.PAUSED].includes(next)) {
      return res.status(400).json({ ok: false, message: 'status inválido' });
    }

    await ref.update({ status: next, updatedAt: now() });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
