import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import admin from 'firebase-admin';

function now(){ return new Date(); }

export async function getUserTokens(uid) {
  const snap = await db.collection(COL.USER_FCM_TOKENS)
    .where('uid', '==', uid)
    .get();

  return snap.docs.map(d => d.data().token).filter(Boolean);
}

export async function notifyUser(uid, payload) {
  const tokens = await getUserTokens(uid);
  if (!tokens.length) return { ok: true, sent: 0, reason: 'no_tokens' };

  // multicast
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: payload.notification,
    data: payload.data || {},
    android: payload.android,
    apns: payload.apns,
  });

  // Limpieza de tokens inválidos (opcional básico)
  // Si quieres lo hacemos completo después: borrar tokens con error "registration-token-not-registered"

  return { ok: true, sent: res.successCount, failed: res.failureCount };
}

export function buildChatNotification({ orderId, senderUid, textPreview }) {
  return {
    notification: {
      title: 'Nuevo mensaje P2P',
      body: textPreview || 'Tienes un nuevo mensaje',
    },
    data: {
      type: 'P2P_CHAT',
      orderId,
      senderUid,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };
}
