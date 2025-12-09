// src/routes/stripeTopups.js

import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { calculateTopupFees, toCents } from '../utils/topupFees.js';

const router = Router();

/**
 * Crea un PaymentIntent para recarga PAYSAT con fees incluidos.
 * BODY: { amount } — monto que el usuario recibirá como saldo PAYSAT
 */
router.post('/create-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ ok: false, error: 'amount requerido y numérico' });
    }

    const user = req.user; // viene de authFirebaseRequired
    if (!user || !user.uid) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }

    const amountNumber = parseFloat(parseFloat(amount).toFixed(2));

    // CALCULAR FEES
    const { stripeFee, paysatFee, total } = calculateTopupFees(amountNumber);

    const totalInCents = toCents(total);

    // CREAR PAYMENT INTENT
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        intent_type: 'paysat_topup',
        userId: user.uid,
        userAmount: amountNumber,
        stripeFee,
        paysatFee,
        totalCharged: total,
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      userAmount: amountNumber,
      stripeFee,
      paysatFee,
      totalCharge: total,
    });

  } catch (e) {
    console.error('❌ Error creando PaymentIntent:', e);
    return res.status(500).json({ ok: false, error: 'Error creando PaymentIntent' });
  }
});

export default router;
