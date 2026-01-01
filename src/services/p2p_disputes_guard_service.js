import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

export async function assertNoOpenDisputeForOrder(orderId) {
  const snap = await db.collection(COL.P2P_DISPUTES)
    .where('orderId', '==', orderId)
    .where('status', '==', 'OPEN')
    .limit(1)
    .get();

  if (!snap.empty) {
    const d = snap.docs[0].data();
    throw new Error(`Ya existe una disputa OPEN para esta orden (disputeId=${d.id})`);
  }
}
