import { stripe } from '../config/stripe.js';

/**
 * Devuelve info de fees partiendo de un Recharge ID.
 * Nota: En la API de Stripe, esto es realmente un "charge", pero lo nombramos "recharge" para consistencia.
 */
export async function getFeesByRecharge(rechargeId, retries = 3, delay = 2000) {
  // console.log(`🔄 Obteniendo fees para recharge: ${rechargeId} (intentos restantes: ${retries})`);
  
  try {
    const recharge = await stripe.charges.retrieve(rechargeId, {
      expand: ['balance_transaction']
    });

    // Puede que aún no esté disponible (muy raro con charges, pero puede pasar)
    let bt = recharge.balance_transaction || null;

    // Si por alguna razón no vino expandido y vino como string, lo buscamos
    if (bt && typeof bt === 'string') {
      bt = await stripe.balanceTransactions.retrieve(bt);
    }

    if (!bt && retries > 0) {
      console.log(`⏳ Balance transaction no disponible, reintentando en ${delay}ms... (${retries} intentos restantes)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getFeesByRecharge(rechargeId, retries - 1, delay);
    }

    if (!bt) {
      console.log('❌ Balance transaction no disponible después de todos los reintentos');
    } else {
      // console.log('✅ Balance transaction obtenido exitosamente:', bt.id);
    }

    return { recharge, balanceTransaction: bt };
  } catch (error) {
    console.error('❌ Error obteniendo fees por recharge:', error);
    throw error;
  }
}

/**
 * Devuelve info de fees partiendo de un PaymentIntent ID.
 * Nota: Internamente usa latest_charge de Stripe, pero lo nombramos como recharge para consistencia.
 */
export async function getFeesByPaymentIntent(paymentIntentId, retries = 3, delay = 2000) {
  // console.log(`🔄 Obteniendo fees para payment intent: ${paymentIntentId} (intentos restantes: ${retries})`);
  
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction']
    });

    // Obtenemos el latest_charge pero lo tratamos como "recharge" para consistencia en nuestro código
    let recharge = pi.latest_charge || null;
    let bt = null;

    if (!recharge) {
      // Si aún no hay latest_charge (p.ej. intent no confirmado)
      return { paymentIntent: pi, recharge: null, balanceTransaction: null };
    }

    if (typeof recharge === 'string') {
      // Si vino como ID, lo traemos expandido
      recharge = await stripe.charges.retrieve(recharge, {
        expand: ['balance_transaction']
      });
    }

    bt = recharge.balance_transaction || null;

    // Si el expand no trajo el objeto y vino como string, lo traemos
    if (bt && typeof bt === 'string') {
      bt = await stripe.balanceTransactions.retrieve(bt);
    }

    if (!bt && retries > 0) {
      console.log(`⏳ Balance transaction no disponible para PaymentIntent, reintentando en ${delay}ms... (${retries} intentos restantes)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getFeesByPaymentIntent(paymentIntentId, retries - 1, delay);
    }

    if (!bt) {
      console.log('❌ Balance transaction no disponible después de todos los reintentos para PaymentIntent');
    } else {
      // console.log('✅ Balance transaction obtenido exitosamente para PaymentIntent:', bt.id);
    }

    return { paymentIntent: pi, recharge, balanceTransaction: bt };
  } catch (error) {
    console.error('❌ Error obteniendo fees por payment intent:', error);
    throw error;
  }
}
