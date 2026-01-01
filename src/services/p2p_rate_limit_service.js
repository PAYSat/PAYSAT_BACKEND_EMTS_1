import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

function now(){ return new Date(); }

export async function assertChatRateLimit({ orderId, senderUid, maxPerMinute = 20 }) {
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
