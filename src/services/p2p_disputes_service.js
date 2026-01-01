import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { ORDER_STATUS } from '../utils/p2p_status.js';
import { v4 as uuidv4 } from 'uuid';

import { emitOrderEvent } from './p2p_order_events_service.js';
import { createSystemMessage } from './p2p_system_messages_service.js';
import { notifyAdmins } from './paysat_crypto_admin_notify_service.js';
import { notifyUser, buildChatNotification } from './paysat_crypto_notify_service.js';
import { validateEvidenceMessages } from './p2p_evidence_service.js';
import { assertNoOpenDisputeForOrder } from './p2p_disputes_guard_service.js';
import { acquireDisputeLock, releaseDisputeLock } from './p2p_disputes_lock_service.js';

import { releaseEscrow, refundEscrowToSeller } from './p2p_escrow_service.js';

const now = () => new Date();

export async function openDispute({ order, openedByUid, reason, evidenceMessageIds = [], openedMeta = {} }) {
    if (!reason || String(reason).trim().length < 5) throw new Error('reason requerido (mín 5 caracteres)');

    // 1) Solo permitir disputa en estados válidos
    if (![ORDER_STATUS.CREATED, ORDER_STATUS.PAID].includes(order.status)) {
      throw new Error(`No se puede abrir disputa en estado ${order.status}`);
    }

    await acquireDisputeLock(order.id);

    try {

      // 2) Solo permitir 1 disputa OPEN por orden
      await assertNoOpenDisputeForOrder(order.id);


      // Recomendación: exigir al menos 1 evidencia si el estado ya está PAID
      if (order.status === ORDER_STATUS.PAID && (!evidenceMessageIds || evidenceMessageIds.length === 0)) {
          throw new Error('Debes adjuntar al menos una evidencia (ej. PAYMENT_PROOF) para abrir disputa en estado PAID');
      }

      const evidenceCheck = await validateEvidenceMessages({ order, evidenceMessageIds });

          // Si está PAID, exigir PAYMENT_PROOF
      if (order.status === ORDER_STATUS.PAID && !evidenceCheck.hasPaymentProof) {
          throw new Error('Para abrir disputa en estado PAID debes adjuntar al menos un comprobante (purpose=PAYMENT_PROOF)');
      }

      const orderSnapshot = {
        id: order.id,
        offerId: order.offerId ?? null,
        asset: order.asset ?? null,
        currency: order.currency ?? null,
        amount: order.amount ?? null,
        price: order.price ?? null,
        type: order.type ?? null,
        buyerUid: order.buyerUid,
        sellerUid: order.sellerUid,
        status: order.status,
        createdAt: order.createdAt ?? null,
        expiresAt: order.expiresAt ?? null,
      };


      const id = uuidv4();
      const dispute = {
          id,
          orderId: order.id,
          status: 'OPEN',
          openedBy: openedByUid,
          reason: String(reason).trim().slice(0, 1000),
          evidenceMessageIds: Array.isArray(evidenceMessageIds) ? evidenceMessageIds : [],          

          evidenceMessageIds: Array.isArray(evidenceMessageIds) ? evidenceMessageIds : [],
          evidenceHasPaymentProof: evidenceCheck.hasPaymentProof,
          evidenceCount: evidenceCheck.messages.length,

          orderSnapshot,
          openedAtOrderStatus: order.status,
          participants: [order.buyerUid, order.sellerUid],
          openedMeta: openedMeta || null,

          resolvedAt: null,
          resolvedBy: null,
          winnerUid: null,
          resolutionNote: null,
          createdAt: now(),
          updatedAt: now(),          
      };

      await db.collection(COL.P2P_DISPUTES).doc(id).set(dispute);

      // Cambiar orden a DISPUTED (backend)
      await db.collection(COL.P2P_ORDERS).doc(order.id).update({
          status: ORDER_STATUS.DISPUTED,
          disputedAt: now(),
          updatedAt: now()
      });

      // Evento: DISPUTED -> SYSTEM + FCM a ambos
      await emitOrderEvent({
          order: { ...order, status: ORDER_STATUS.DISPUTED },
          event: ORDER_STATUS.DISPUTED,
          actorUid: openedByUid,
          extra: { reason: dispute.reason }
      });

      // Notificar admins
      await notifyAdmins({
          notification: {
          title: 'Nueva disputa P2P',
          body: `Orden ${order.id} - ${dispute.reason.slice(0, 80)}${dispute.reason.length > 80 ? '…' : ''}`,
          },
          data: { type: 'P2P_DISPUTE', orderId: order.id, disputeId: id }
      });

      return dispute;
    } catch (e) {
      // si falló, liberar lock
      await releaseDisputeLock(order.id);
      throw e;
    }
}

export async function listDisputes({ status = 'OPEN', limit = 50 }) {
  const snap = await db.collection(COL.P2P_DISPUTES)
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Number(limit || 50), 200))
    .get();

  return snap.docs.map(d => d.data());
}

export async function resolveDispute({ disputeId, adminUid, winnerUid, note }) {
  const disputeRef = db.collection(COL.P2P_DISPUTES).doc(disputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) throw new Error('Disputa no encontrada');

  const dispute = disputeSnap.data();
  if (dispute.status !== 'OPEN') throw new Error('Disputa ya fue resuelta/cerrada');

  const orderRef = db.collection(COL.P2P_ORDERS).doc(dispute.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error('Orden no encontrada');

  const order = orderSnap.data();
  if (![order.buyerUid, order.sellerUid].includes(winnerUid)) {
    throw new Error('winnerUid inválido: debe ser buyerUid o sellerUid');
  }

  // Resolver fondos según ganador
  if (winnerUid === order.buyerUid) {
    // buyer gana -> liberar escrow a buyer
    await releaseEscrow({
      sellerUid: order.sellerUid,
      buyerUid: order.buyerUid,
      asset: order.asset,
      amount: order.amount,
      orderId: order.id,
    });

    await orderRef.update({
      status: ORDER_STATUS.RELEASED,
      participants: [order.buyerUid, order.sellerUid],
      releasedAt: now(),
      updatedAt: now()
    });
  } else {
    // seller gana -> refund escrow al seller (vuelve a available)
    await refundEscrowToSeller({
      sellerUid: order.sellerUid,
      asset: order.asset,
      amount: order.amount,
      orderId: order.id,
    });

    await orderRef.update({
      status: ORDER_STATUS.CANCELLED,
      participants: [order.buyerUid, order.sellerUid],
      cancelledAt: now(),
      updatedAt: now()
    });
  }

  // actualizar disputa
  await disputeRef.update({
    status: 'RESOLVED',
    resolvedAt: now(),
    resolvedBy: adminUid,
    winnerUid,
    resolutionNote: String(note || '').slice(0, 1000),
    updatedAt: now()
  });

  // Mensaje SYSTEM final
  const resolutionText =
    winnerUid === order.buyerUid
      ? 'Disputa resuelta: el comprador gana. Se liberó el escrow al comprador.'
      : 'Disputa resuelta: el vendedor gana. Se devolvió el escrow al vendedor.';

  await createSystemMessage({
    orderId: order.id,
    text: resolutionText,
    meta: { purpose: 'DISPUTE_RESOLUTION', disputeId, winnerUid, adminUid }
  });

  // Notificar a ambos participantes
  await Promise.all([
    notifyUser(order.buyerUid, buildChatNotification({
      orderId: order.id,
      senderUid: 'SYSTEM',
      textPreview: 'Disputa resuelta'
    })),
    notifyUser(order.sellerUid, buildChatNotification({
      orderId: order.id,
      senderUid: 'SYSTEM',
      textPreview: 'Disputa resuelta'
    }))
  ]);

  await releaseDisputeLock(order.id);

  return { ok: true, orderId: order.id };
}
