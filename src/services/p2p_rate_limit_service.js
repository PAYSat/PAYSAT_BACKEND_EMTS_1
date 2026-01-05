import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

/**
 * Compatible con:
 *  - assertChatRateLimit({ orderId, senderUid, maxPerMinute })
 *  - assertChatRateLimit(senderUid, orderId, maxPerMinute)
 */
export async function assertChatRateLimit(arg1, arg2, arg3) {
  let orderId, senderUid, maxPerMinute;

  // Forma objeto
  if (typeof arg1 === 'object' && arg1 !== null) {
    orderId = arg1.orderId;
    senderUid = arg1.senderUid;
    maxPerMinute = arg1.maxPerMinute ?? 20;
  } else {
    // Forma posicional (legacy)
    senderUid = arg1;
    orderId = arg2;
    maxPerMinute = arg3 ?? 20;
  }

  if (!orderId || !senderUid) {
    throw new Error('Rate limit: datos inválidos (orderId/senderUid)');
  }

  const since = new Date(Date.now() - 60 * 1000);

  const snap = await db.collection(COL.P2P_MESSAGES)
    .where('orderId', '==', orderId)
    .where('senderUid', '==', senderUid)
    .where('createdAt', '>=', since)
    .get();

  if (snap.size >= maxPerMinute) {
    throw new Error('Rate limit: demasiados mensajes, intenta en unos segundos');
  }
}
