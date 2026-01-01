import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { ORDER_STATUS } from '../utils/p2p_status.js';
import { emitOrderEvent } from '../services/p2p_order_events_service.js';

function now(){ return new Date(); }

export function startP2PExpiryJob() {
  // cada 60s
  setInterval(async () => {
    try {
      const snap = await db.collection(COL.P2P_ORDERS)
        .where('status', '==', ORDER_STATUS.CREATED)
        .where('expiresAt', '<=', now())
        .limit(50)
        .get();

      for (const doc of snap.docs) {
        const order = doc.data();

        // Marcar EXPIRED (MVP)
        await db.collection(COL.P2P_ORDERS).doc(order.id).update({
          status: ORDER_STATUS.EXPIRED,
          updatedAt: now()
        });

        await emitOrderEvent({
          order: { ...order, status: ORDER_STATUS.EXPIRED },
          event: ORDER_STATUS.CANCELLED,
          actorUid: 'SYSTEM',
          extra: { reason: 'Tiempo de pago expirado' }
        });
      }
    } catch (e) {
      // log y sigue
      console.error('P2P Expiry Job error:', e.message);
    }
  }, 60_000);
}
