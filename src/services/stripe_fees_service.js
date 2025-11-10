import { stripe } from '../config/stripe.js';

/**
 * Devuelve info de fees partiendo de un Charge ID.
 */
export async function getFeesByCharge(chargeId) {
  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ['balance_transaction']
  });

  // Puede que aún no esté disponible (muy raro con charges, pero puede pasar)
  let bt = charge.balance_transaction || null;

  // Si por alguna razón no vino expandido y vino como string, lo buscamos
  if (bt && typeof bt === 'string') {
    bt = await stripe.balanceTransactions.retrieve(bt);
  }

  return { charge, balanceTransaction: bt };
}

/**
 * Devuelve info de fees partiendo de un PaymentIntent ID.
 */
export async function getFeesByPaymentIntent(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction']
  });

  let charge = pi.latest_charge || null;
  let bt = null;

  if (!charge) {
    // Si aún no hay latest_charge (p.ej. intent no confirmado)
    return { paymentIntent: pi, charge: null, balanceTransaction: null };
  }

  if (typeof charge === 'string') {
    // Si vino como ID, lo traemos expandido
    charge = await stripe.charges.retrieve(charge, {
      expand: ['balance_transaction']
    });
  }

  bt = charge.balance_transaction || null;

  // Si el expand no trajo el objeto y vino como string, lo traemos
  if (bt && typeof bt === 'string') {
    bt = await stripe.balanceTransactions.retrieve(bt);
  }

  return { paymentIntent: pi, charge, balanceTransaction: bt };
}
