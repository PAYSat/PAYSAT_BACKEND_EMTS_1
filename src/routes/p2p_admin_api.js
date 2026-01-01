import { Router } from 'express';
import { requireRole } from '../middlewares/roles.js';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

import { resolveDispute } from '../services/p2p_disputes_service.js';
import { validateEvidenceMessages } from '../services/p2p_evidence_service.js';

const router = Router();
const now = () => new Date();

/**
 * Helpers de paginación
 * cursor = ISO date (createdAt del último doc de la página anterior)
 */
function parseCursor(cursor) {
  if (!cursor) return null;
  const d = new Date(String(cursor));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/p2p/admin/disputes
 * Query:
 *   status=OPEN|RESOLVED (default OPEN)
 *   limit=50 (max 200)
 *   cursor=<ISO createdAt> (para paginar)
 *   orderId=<exact match> (búsqueda directa)
 */
router.get('/admin/disputes', requireRole('ADMIN'), async (req, res) => {
  try {
    const status = String(req.query.status || 'OPEN').toUpperCase();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const cursor = parseCursor(req.query.cursor);
    const orderId = req.query.orderId ? String(req.query.orderId) : null;

    // Búsqueda directa por orderId (más rápida y sin índices raros)
    if (orderId) {
      const snap = await db.collection(COL.P2P_DISPUTES)
        .where('orderId', '==', orderId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const disputes = snap.docs.map(d => d.data());
      const nextCursor = disputes.length ? disputes[disputes.length - 1].createdAt : null;
      return res.json({ ok: true, disputes, nextCursor });
    }

    let q = db.collection(COL.P2P_DISPUTES)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    const disputes = snap.docs.map(d => d.data());
    const nextCursor = disputes.length ? disputes[disputes.length - 1].createdAt : null;

    return res.json({ ok: true, disputes, nextCursor });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

/**
 * GET /api/p2p/admin/disputes/:id
 * Devuelve: dispute + order + evidences (messages)
 */
router.get('/admin/disputes/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id;
    const disputeSnap = await db.collection(COL.P2P_DISPUTES).doc(id).get();
    if (!disputeSnap.exists) return res.status(404).json({ ok:false, message:'Disputa no encontrada' });

    const dispute = disputeSnap.data();

    const orderSnap = await db.collection(COL.P2P_ORDERS).doc(dispute.orderId).get();
    const order = orderSnap.exists ? orderSnap.data() : null;

    // Evidencias (mensajes)
    let evidence = null;
    if (order && Array.isArray(dispute.evidenceMessageIds) && dispute.evidenceMessageIds.length) {
      evidence = await validateEvidenceMessages({
        order,
        evidenceMessageIds: dispute.evidenceMessageIds
      });
    }

    return res.json({
      ok: true,
      dispute,
      order,
      evidence: evidence ? {
        hasPaymentProof: evidence.hasPaymentProof,
        count: evidence.messages.length,
        messages: evidence.messages
      } : { hasPaymentProof: false, count: 0, messages: [] }
    });
  } catch (e) {
    return res.status(400).json({ ok:false, message: e.message });
  }
});

/**
 * POST /api/p2p/admin/disputes/:id/resolve
 * body: { winnerUid, note }
 */
router.post('/admin/disputes/:id/resolve', requireRole('ADMIN'), async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const disputeId = req.params.id;
    const winnerUid = String(req.body.winnerUid || '').trim();
    const note = req.body.note || '';

    if (!winnerUid) return res.status(400).json({ ok:false, message:'winnerUid requerido' });

    const out = await resolveDispute({ disputeId, adminUid, winnerUid, note });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(400).json({ ok:false, message: e.message });
  }
});

/**
 * POST /api/p2p/admin/disputes/:id/note
 * body: { note }
 * (Notas internas del staff)
 */
router.post('/admin/disputes/:id/note', requireRole('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id;
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ ok:false, message:'note requerido' });

    const ref = db.collection(COL.P2P_DISPUTES).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok:false, message:'Disputa no encontrada' });

    const prev = snap.data().staffNotes || [];
    const staffNotes = Array.isArray(prev) ? prev : [];

    staffNotes.unshift({
      id: `${Date.now()}`,
      note,
      by: req.user.uid,
      at: now(),
    });

    await ref.update({ staffNotes, updatedAt: now() });
    return res.json({ ok:true });
  } catch (e) {
    return res.status(400).json({ ok:false, message: e.message });
  }
});

import { ORDER_STATUS } from '../utils/p2p_status.js';

/**
 * GET /api/p2p/admin/orders
 * Query:
 *   status=DISPUTED|CREATED|PAID|RELEASED|CANCELLED|EXPIRED (opcional)
 *   uid=<buyerOrSellerUid> (opcional)
 *   limit=50 (max 200)
 *   cursor=<ISO createdAt> (paginación)
 *   orderId=<exact> (búsqueda directa)
 */
router.get('/admin/orders', requireRole('ADMIN'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const cursor = parseCursor(req.query.cursor);

    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const uid = req.query.uid ? String(req.query.uid) : null;
    const orderId = req.query.orderId ? String(req.query.orderId) : null;

    // Búsqueda directa por orderId
    if (orderId) {
      const snap = await db.collection(COL.P2P_ORDERS).doc(orderId).get();
      if (!snap.exists) return res.json({ ok: true, orders: [], nextCursor: null });
      const order = snap.data();
      return res.json({ ok: true, orders: [order], nextCursor: null });
    }

    // Nota: Firestore no soporta OR (buyerUid==uid OR sellerUid==uid) en una sola query.
    // Para uid, hacemos dos queries y mergeamos (MVP).
    if (uid) {
        let q = db.collection(COL.P2P_ORDERS)
            .where('participants', 'array-contains', uid)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (cursor) q = q.startAfter(cursor);

        const snap = await q.get();
        let orders = snap.docs.map(d => d.data());

        if (status) orders = orders.filter(o => String(o.status).toUpperCase() === status);

        const nextCursor = orders.length ? orders[orders.length - 1].createdAt : null;
        return res.json({ ok: true, orders, nextCursor });
    }

    // Filtro por status (la forma más común)
    let q = db.collection(COL.P2P_ORDERS).orderBy('createdAt', 'desc').limit(limit);

    if (status) {
      // si quieres validar que sea un status válido:
      const allowed = Object.values(ORDER_STATUS);
      if (!allowed.includes(status)) {
        return res.status(400).json({ ok: false, message: `status inválido: ${status}` });
      }
      q = db.collection(COL.P2P_ORDERS)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    const orders = snap.docs.map(d => d.data());
    const nextCursor = orders.length ? orders[orders.length - 1].createdAt : null;

    return res.json({ ok: true, orders, nextCursor });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

/**
 * GET /api/p2p/admin/orders/:id
 * Query:
 *   messagesLimit=50 (max 200)
 *
 * Devuelve:
 *   order
 *   lastMessages (ASC)
 *   openDispute (si existe)
 */
router.get('/admin/orders/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const orderId = req.params.id;
    const messagesLimit = Math.min(Number(req.query.messagesLimit || 50), 200);

    const orderSnap = await db.collection(COL.P2P_ORDERS).doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ ok:false, message:'Orden no encontrada' });
    const order = orderSnap.data();

    // Últimos mensajes del chat
    const msgSnap = await db.collection(COL.P2P_MESSAGES)
      .where('orderId', '==', orderId)
      .orderBy('createdAt', 'desc')
      .limit(messagesLimit)
      .get();

    const desc = msgSnap.docs.map(d => d.data());
    const lastMessages = desc.reverse();

    // Disputa OPEN (si existe)
    const disputeSnap = await db.collection(COL.P2P_DISPUTES)
      .where('orderId', '==', orderId)
      .where('status', '==', 'OPEN')
      .limit(1)
      .get();

    const openDispute = disputeSnap.empty ? null : disputeSnap.docs[0].data();

    return res.json({ ok: true, order, lastMessages, openDispute });
  } catch (e) {
    return res.status(400).json({ ok:false, message: e.message });
  }
});


export default router;
