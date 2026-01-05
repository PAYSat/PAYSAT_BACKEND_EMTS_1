import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

export async function requireOrderParticipant(req, res, next) {
  try {
    const uid = req.user?.uid;
    const orderId = req.params.id || req.params.orderId;

    if (!uid) return res.status(401).json({ ok: false, message: 'No autenticado' });
    if (!orderId) return res.status(400).json({ ok: false, message: 'Falta orderId' });

    const snap = await db.collection(COL.P2P_ORDERS).doc(orderId).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Orden no encontrada' });

    const order = snap.data();
    const allowed = [order.buyerUid, order.sellerUid].includes(uid);
    if (!allowed) return res.status(403).json({ ok: false, message: 'No autorizado: no perteneces a esta orden' });

    req.p2pOrder = order;
    // Agregar otherUid para notificaciones
    req.otherUid = uid === order.buyerUid ? order.sellerUid : order.buyerUid;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}
