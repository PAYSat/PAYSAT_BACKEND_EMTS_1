import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { v4 as uuidv4 } from 'uuid';

function now(){ return new Date(); }

export async function createSystemMessage({ orderId, text, meta = {} }) {
  const id = uuidv4();
  const msg = {
    id,
    orderId,
    senderUid: 'SYSTEM',
    type: 'SYSTEM',
    text: String(text || '').slice(0, 1000),
    createdAt: now(),
    meta: {
      purpose: meta.purpose || 'SYSTEM',
      ...meta,
    },
  };

  await db.collection(COL.P2P_MESSAGES).doc(id).set(msg);
  return msg;
}
