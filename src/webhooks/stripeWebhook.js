import { Router } from 'express';
import bodyParser from 'body-parser'; // raw para Stripe
import { stripe } from '../services/stripe.js';
import { db } from '../config/firebase.js';
import { createGPAOrder } from '../services/marqeta.js';

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

    // Guarda evento genérico del webhook (con raw “limpio”)
    try {
      await db.collection('webhook_events').doc(event.id).set({
        id: event.id,
        type: event.type,
        api_version: event.api_version,
        created: new Date(),
        rawBody: rawBodyUtf8 || null,  // cuidado con tamaños grandes
      }, { merge: true });
    } catch (_) {}

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;

      // Espejo por PI
      const paymentDoc = db.collection('payments').doc(pi.id);
      await paymentDoc.set({
        id: pi.id,
        amount: pi.amount,
        amount_received: pi.amount_received,
        currency: pi.currency,
        status: pi.status,
        customer: pi.customer,
        created: pi.created,
        metadata: pi.metadata || {},
        updatedAt: new Date(),
      }, { merge: true });

      // Correlación por session id
      const sessionId = pi.metadata?.payment_session_id;
      const sessionRef = sessionId ? db.collection('payments_sessions').doc(sessionId) : null;

      // Log del webhook (payload completo del PI + metadatos clave)
      if (sessionRef) {
        await sessionRef.set({
          status: 'confirmed',
          confirmedAt: new Date(),
        }, { merge: true });

        await sessionRef.collection('logs').add({
          type: 'webhook:payment_intent.succeeded',
          payload: {
            payment_intent: {
              id: pi.id,
              amount: pi.amount,
              amount_received: pi.amount_received,
              currency: pi.currency,
              status: pi.status,
              customer: pi.customer,
              metadata: pi.metadata || {}
            },
            event_id: event.id
          },
          createdAt: new Date(),
        });
      }

      // Recarga Marqeta (si hay token)
      const marqeta_user_token = pi.metadata?.marqeta_user_token;
      if (marqeta_user_token) {
        const amountDecimal = (pi.amount_received || pi.amount) / 100.0;
        try {
          // createGPAOrder devuelve { request, response }
          const { request: marq_request, response: marq_response } = await createGPAOrder({
            user_token: marqeta_user_token,
            amount: amountDecimal,
            currency_code: (pi.currency || 'usd').toUpperCase(),
            memo: `Stripe PI ${pi.id}`,
            tags: `stripe,pi:${pi.id}`
          });

          // Guarda request/response de Marqeta bajo payments/{pi}/marqeta
          const marqDocId = (marq_response && marq_response.token) ? marq_response.token : `gpa_${Date.now()}`;
          await paymentDoc.collection('Stripe_RecargasEnMarqeta')
            .doc(marqDocId)
            .set({
              request: marq_request,
              response: marq_response,
              linked_payment_intent: pi.id,
              createdAt: new Date()
            });

          // Log también en la sesión
          if (sessionRef) {
            await sessionRef.collection('logs').add({
              type: 'marqeta:gpaorder',
              payload: {
                request: marq_request,
                response: marq_response
              },
              createdAt: new Date(),
            });
          }
        } catch (e) {
          console.error('Marqeta GPA error', e.message);
          if (sessionRef) {
            await sessionRef.collection('logs').add({
              type: 'error',
              where: 'marqeta:gpaorder',
              message: e.message,
              createdAt: new Date(),
            });
          }
        }
      }
    }

    res.json({ received: true });
  }
);

export default router;
