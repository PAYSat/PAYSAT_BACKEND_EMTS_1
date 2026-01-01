// src/routes/p2p_orders.js
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { ORDER_STATUS, OFFER_STATUS } from '../utils/p2p_status.js';

import { lockEscrow, releaseEscrow } from '../services/p2p_escrow_service.js';
import { emitOrderEvent } from '../services/p2p_order_events_service.js';

const router = Router();
const now = () => new Date();

/**
 * Crea una orden tomando una oferta
 * Body: { offerId, amount, paymentMethod }
 */
router.post('/orders', async (req, res) => {
  try {
    const takerUid = req.user.uid;
    const { offerId, amount, paymentMethod } = req.body;

    console.log(offerId, amount, paymentMethod)

    if (!offerId || !amount) {
      console.log('offerId y amount son requeridos');
      return res.status(400).json({ ok: false, message: 'offerId y amount son requeridos' });
    }

    const offerRef = db.collection(COL.P2P_OFFERS).doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists){
      console.log('Oferta no existe');
      return res.status(404).json({ ok: false, message: 'Oferta no existe' });
    }

    const offer = offerSnap.data();
    if (offer.status !== OFFER_STATUS.ACTIVE) {
      console.log('Oferta no está activa');
      return res.status(400).json({ ok: false, message: 'Oferta no está activa' });
    }

    if (offer.userId === takerUid) {
      console.log('No puedes tomar tu propia oferta');
      return res.status(400).json({ ok: false, message: 'No puedes tomar tu propia oferta' });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      console.log('amount inválido');
      return res.status(400).json({ ok: false, message: 'amount inválido' });
    }

    // Determinar roles según tipo de oferta
    // type=SELL: advertiser es seller, taker es buyer
    // type=BUY : advertiser es buyer,  taker es seller
    const type = String(offer.type).toUpperCase();
    const asset = String(offer.asset).toUpperCase();

    const sellerUid = type === 'SELL' ? offer.userId : takerUid;
    const buyerUid  = type === 'SELL' ? takerUid : offer.userId;

    const orderId = uuidv4();

    // 1) Lock escrow (siempre del seller)
    await lockEscrow({
      sellerUid,
      asset,
      amount: amt,
      orderId
    });

    // 2) Crear orden en Firestore
    const order = {
      id: orderId,
      offerId: offerId,
      asset,
      currency: offer.currency,
      amount: amt,
      price: offer.price,
      type,

      sellerUid,
      buyerUid,

      // ✅ NUEVO: para 1 query con array-contains (admin + flutter)
      participants: [buyerUid, sellerUid],

      paymentMethod: paymentMethod || null,

      status: ORDER_STATUS.CREATED,
      createdAt: now(),
      updatedAt: now(),

      // tiempos
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min default
      paidAt: null,
      releasedAt: null,
      cancelledAt: null,
      disputedAt: null,
    };

    await db.collection(COL.P2P_ORDERS).doc(orderId).set(order);

    await emitOrderEvent({
      order,
      event: ORDER_STATUS.CREATED,
      actorUid: takerUid
    });

    return res.json({ ok: true, order });
  } catch (e) {
    console.log("Catch: ", e.message);
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Detalle orden
router.get('/orders/:id', async (req, res) => {
  try {
    const uid = req.user.uid;
    const snap = await db.collection(COL.P2P_ORDERS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Orden no encontrada' });

    const order = snap.data();
    if (![order.sellerUid, order.buyerUid].includes(uid)) {
      return res.status(403).json({ ok: false, message: 'No autorizado' });
    }

    return res.json({ ok: true, order });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Marcar pagado (solo buyer)
router.post('/orders/:id/paid', async (req, res) => {
  try {
    const uid = req.user.uid;
    const ref = db.collection(COL.P2P_ORDERS).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Orden no encontrada' });

    const order = snap.data();
    if (order.buyerUid !== uid) return res.status(403).json({ ok: false, message: 'Solo comprador puede marcar pagado' });
    if (order.status !== ORDER_STATUS.CREATED) return res.status(400).json({ ok: false, message: 'Estado inválido' });

    await ref.update({
      status: ORDER_STATUS.PAID,
      paidAt: now(),
      updatedAt: now(),

      // ✅ asegurar consistencia
      participants: [order.buyerUid, order.sellerUid],
    });

    // ✅ emitOrderEvent ya crea SYSTEM message + notifica al vendedor
    await emitOrderEvent({
      order: { ...order, status: ORDER_STATUS.PAID },
      event: ORDER_STATUS.PAID,
      actorUid: uid
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

// Liberar escrow (solo seller)
router.post('/orders/:id/release', async (req, res) => {
  try {
    const uid = req.user.uid;
    const ref = db.collection(COL.P2P_ORDERS).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'Orden no encontrada' });

    const order = snap.data();
    if (order.sellerUid !== uid) return res.status(403).json({ ok: false, message: 'Solo vendedor puede liberar' });

    // Nota: aquí tu lógica permite liberar estando PAID o DISPUTED.
    // Si quieres que solo el ADMIN pueda liberar en DISPUTED, lo ajustamos luego.
    if (![ORDER_STATUS.PAID, ORDER_STATUS.DISPUTED].includes(order.status)) {
      return res.status(400).json({ ok: false, message: 'Solo se puede liberar cuando está PAID o por resolución' });
    }

    // 1) mover escrow -> buyer
    await releaseEscrow({
      sellerUid: order.sellerUid,
      buyerUid: order.buyerUid,
      asset: order.asset,
      amount: order.amount,
      orderId: order.id
    });

    // 2) actualizar orden
    await ref.update({
      status: ORDER_STATUS.RELEASED,
      releasedAt: now(),
      updatedAt: now(),

      // ✅ asegurar consistencia
      participants: [order.buyerUid, order.sellerUid],
    });

    await emitOrderEvent({
      order: { ...order, status: ORDER_STATUS.RELEASED },
      event: ORDER_STATUS.RELEASED,
      actorUid: uid
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;