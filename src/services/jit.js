import { db } from '../config/firebase.js';

/**
 * Maneja Gateway JIT Funding:
 *  - Llega una autorización (monto, merchant, MCC, card_token, etc.)
 *  - Verificas políticas (riesgo), saldo (ej. balance virtual en Firebase),
 *    o incluso saldo de una Wallet en Circle (si la integras).
 *  - Devuelves approve/deny.
 * Docs 2025: Gateway JIT Funding Messages & sample impl. :contentReference[oaicite:19]{index=19}
 */
export async function handleJit(jitMsg) {
  const { amount } = jitMsg?.transaction || {};
  // Lógica de ejemplo: aprobamos <= 100 USD
  const approve = Number(amount) <= 100;

  await db.collection('jit_decisions').add({
    msg: jitMsg,
    decision: approve ? 'APPROVE' : 'DENY',
    ts: new Date()
  });

  if (approve) {
    return {
      result: 'APPROVED',
      funding: { amount: amount, currency: 'USD' }
    };
  } else {
    return { result: 'DENIED', reason: 'limit_exceeded' };
  }
}
