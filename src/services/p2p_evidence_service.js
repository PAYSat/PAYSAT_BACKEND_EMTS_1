import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

export async function validateEvidenceMessages({ order, evidenceMessageIds = [] }) {
  if (!Array.isArray(evidenceMessageIds)) {
    throw new Error('evidenceMessageIds debe ser un array');
  }

  const ids = evidenceMessageIds.map(String).filter(Boolean);
  if (!ids.length) return { ok: true, hasPaymentProof: false, messages: [] };

  // Firestore "in" tiene límite de 10
  if (ids.length > 10) {
    throw new Error('Máximo 10 evidencias por disputa (limite Firestore IN=10)');
  }

  // leer mensajes por ids
  const refs = ids.map(id => db.collection(COL.P2P_MESSAGES).doc(id));
  const snaps = await db.getAll(...refs);

  const messages = [];
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    const id = ids[i];

    if (!s.exists) throw new Error(`Evidencia inválida: messageId no existe (${id})`);

    const m = s.data();

    // Debe pertenecer a la misma orden
    if (m.orderId !== order.id) throw new Error(`Evidencia inválida: messageId ${id} no pertenece a la orden`);

    // Debe ser de buyer o seller o SYSTEM (por si en el futuro generas evidencias automáticas)
    const allowedSenders = [order.buyerUid, order.sellerUid, 'SYSTEM'];
    if (!allowedSenders.includes(m.senderUid)) {
      throw new Error(`Evidencia inválida: messageId ${id} sender no autorizado`);
    }

    messages.push(m);
  }

  const hasPaymentProof = messages.some(m => String(m.meta?.purpose || '').toUpperCase() === 'PAYMENT_PROOF');

  return { ok: true, hasPaymentProof, messages };
}
