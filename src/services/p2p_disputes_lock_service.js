import { db } from '../config/firebase.js';

const LOCK_COL = 'PaySat_Crypto_P2P_DisputesLocks';
const now = () => new Date();

export async function acquireDisputeLock(orderId) {
  const ref = db.collection(LOCK_COL).doc(orderId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      throw new Error('Ya existe una disputa en proceso/abierta para esta orden (lock)');
    }
    tx.set(ref, { orderId, createdAt: now() });
  });

  return true;
}

export async function releaseDisputeLock(orderId) {
  try {
    await db.collection(LOCK_COL).doc(orderId).delete();
  } catch (_) {
    // silencioso
  }
}
