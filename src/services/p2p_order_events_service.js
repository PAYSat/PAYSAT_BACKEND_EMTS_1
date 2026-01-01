import { createSystemMessage } from './p2p_system_messages_service.js';
import { notifyUser, buildChatNotification } from './paysat_crypto_notify_service.js';
import { ORDER_STATUS } from '../utils/p2p_status.js';

/**
 * Crea mensaje SYSTEM + envía notificación.
 * Importante: NO actualiza el estado aquí; solo reacciona al estado.
 */
export async function emitOrderEvent({ order, event, actorUid = 'SYSTEM', extra = {} }) {
  const orderId = order.id;

  // Define a quién notificar y qué texto publicar
  const mapping = mapEventToSystemMessage({ order, event, actorUid, extra });

  // 1) Mensaje SYSTEM al chat (si aplica)
  let sysMsg = null;
  if (mapping.systemText) {
    sysMsg = await createSystemMessage({
      orderId,
      text: mapping.systemText,
      meta: {
        purpose: 'ORDER_EVENT',
        event,
        actorUid,
        ...extra,
      }
    });
  }

  // 2) Notificar (si aplica)
  if (mapping.notifyUid) {
    await notifyUser(mapping.notifyUid, buildChatNotification({
      orderId,
      senderUid: 'SYSTEM',
      textPreview: mapping.notifyPreview || mapping.systemText || 'Actualización de orden'
    }));
  } else if (mapping.notifyUids && mapping.notifyUids.length) {
    // notificar a ambos (ej. CREATED)
    await Promise.all(mapping.notifyUids.map(uid =>
      notifyUser(uid, buildChatNotification({
        orderId,
        senderUid: 'SYSTEM',
        textPreview: mapping.notifyPreview || mapping.systemText || 'Actualización de orden'
      }))
    ));
  }

  return { ok: true, systemMessageId: sysMsg?.id || null };
}

function mapEventToSystemMessage({ order, event, actorUid, extra }) {
  const buyer = order.buyerUid;
  const seller = order.sellerUid;

  switch (event) {
    case ORDER_STATUS.CREATED:
      return {
        systemText: 'Orden creada. El escrow fue bloqueado. El comprador debe realizar el pago dentro del tiempo límite.',
        notifyUids: [buyer, seller],
        notifyPreview: 'Orden creada (escrow bloqueado)'
      };

    case ORDER_STATUS.PAID:
      return {
        systemText: 'El comprador marcó la orden como PAGADA. El vendedor debe verificar y liberar el escrow.',
        notifyUid: seller,
        notifyPreview: 'Orden marcada como PAGADA'
      };

    case ORDER_STATUS.RELEASED:
      return {
        systemText: 'El vendedor liberó el escrow. Intercambio completado con éxito.',
        notifyUid: buyer,
        notifyPreview: 'Escrow liberado ✅'
      };

    case ORDER_STATUS.CANCELLED:
      return {
        systemText: `Orden cancelada. ${extra?.reason ? `Motivo: ${extra.reason}` : ''}`.trim(),
        notifyUids: [buyer, seller],
        notifyPreview: 'Orden cancelada'
      };

    case ORDER_STATUS.DISPUTED:
      return {
        systemText: `Se abrió una DISPUTA. ${extra?.reason ? `Motivo: ${extra.reason}` : ''}`.trim(),
        notifyUids: [buyer, seller],
        notifyPreview: 'Disputa abierta ⚠️'
      };

    default:
      return { systemText: null };
  }
}
