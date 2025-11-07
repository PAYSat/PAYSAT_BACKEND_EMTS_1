import { Router } from 'express';
import bodyParser from 'body-parser'; // raw para Stripe
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

const router = Router();

// POST /api/webhooks/stripe
router.post('/stripe',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // Guarda el raw por si quieres auditoría completa del webhook
    const rawBodyUtf8 = req.body?.toString?.('utf8');

    try {
      event = stripe.webhooks.constructEvent(
        req.body, // raw Buffer
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      // Si falla la firma, aun así podemos guardar el raw para diagnóstico:
      try {
        await db.collection('webhook_errors').add({
          reason: 'signature_verification_failed',
          message: err.message,
          rawBody: rawBodyUtf8 || null,
          headers: Object.fromEntries(Object.entries(req.headers || {})),
          createdAt: new Date(),
        });
      } catch (_) {}
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Guarda evento genérico del webhook (con raw "limpio")
    try {
      await db.collection('webhook_events').doc(event.id).set({
        id: event.id,
        type: event.type,
        api_version: event.api_version,
        created: new Date(),
        rawBody: rawBodyUtf8 || null,  // cuidado con tamaños grandes
      }, { merge: true });
    } catch (_) {}

    console.log('🎯 Webhook de Stripe recibido');
    
    // DESACTIVADO: Processing movido a marqeta_webhooks.js para evitar duplicación
    // Solo logging de eventos para auditoría
    if (event.type === 'payment_intent.succeeded' || event.type === 'charge.succeeded') {
      console.log(`ℹ️ Evento ${event.type} recibido - procesamiento delegado a marqeta_webhooks.js`);
    } else {
      console.log(`ℹ️ Webhook event type not handled: ${event.type}`);
    }

    res.json({ received: true });
  }
);

export default router;