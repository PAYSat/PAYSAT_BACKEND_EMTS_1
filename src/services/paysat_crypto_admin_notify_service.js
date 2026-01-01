import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import admin from 'firebase-admin';

export async function getAdminTokens() {
  const snap = await db.collection(COL.ADMIN_FCM_TOKENS).get();
  return snap.docs.map(d => d.data().token).filter(Boolean);
}

export async function notifyAdmins(payload) {
  const tokens = await getAdminTokens();
  if (!tokens.length) return { ok: true, sent: 0, reason: 'no_admin_tokens' };

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: payload.notification,
    data: payload.data || {},
  });

  return { ok: true, sent: res.successCount, failed: res.failureCount };
}
