import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { marqeta } from '../config/marqeta.js';
import { db } from '../config/firebase.js';
import { handleJit } from '../services/jit.js';

const r = Router();

// Funciones de utilidad para Stripe webhooks
async function getMarqetaFundingSourceToken() {
  try {
    const fundingSourcesRef = db.collection('Marqeta_FundingSources');
    const snapshot = await fundingSourcesRef.limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('No se encontró funding source en Firebase');
    }
    
    const doc = snapshot.docs[0];
    return doc.id; // El token está como ID del documento
  } catch (error) {
    console.error('Error obteniendo funding source:', error);
    return null;
  }
}

async function processMarqetaReload(paymentIntent, sessionData, sessionRef) {
  console.log('🔄 Iniciando processMarqetaReload');
  console.log('📝 Datos recibidos:', {
    paymentIntent_id: paymentIntent.id,
    marqeta_user_token: sessionData.marqeta_user_token,
    amount: sessionData.amount,
    currency: sessionData.currency
  });
  
  try {
    if (!sessionData.marqeta_user_token) {
      console.log('⚠️ No marqeta_user_token encontrado, saltando recarga');
      await sessionRef.collection('logs').add({
        type: 'marqeta:skip',
        reason: 'No marqeta_user_token found',
        createdAt: new Date(),
      });
      return null;
    }

    console.log('🔍 Obteniendo funding source token...');
    // Obtener funding source token desde Firebase
    const fundingSourceToken = await getMarqetaFundingSourceToken();
    if (!fundingSourceToken) {
      console.error('❌ No se pudo obtener funding source token');
      throw new Error('No se pudo obtener funding source token');
    }
    console.log('✅ Funding source token obtenido:', fundingSourceToken);

    const gpaPayload = {
      user_token: sessionData.marqeta_user_token,
      amount: parseFloat(sessionData.amount), // Usar el monto en dólares
      currency_code: sessionData.currency?.toUpperCase() || "USD",
      funding_source_token: fundingSourceToken
    };

    console.log('📤 Enviando GPA order a Marqeta:', gpaPayload);

    await sessionRef.collection('logs').add({
      type: 'marqeta:request:gpaorders.create',
      payload: gpaPayload,
      createdAt: new Date(),
    });

    const { data: gpaOrder } = await marqeta.post('/gpaorders', gpaPayload);
    console.log('✅ GPA order creado exitosamente:', gpaOrder.token);
    
    await sessionRef.collection('logs').add({
      type: 'marqeta:response:gpaorders.create',
      payload: gpaOrder,
      createdAt: new Date(),
    });

    // Guardar la orden GPA en Firebase
    console.log('💾 Guardando GPA order en Firebase...');
    await db.collection('Marqeta_GPA_Orders').doc(gpaOrder.token).set({
      gpaOrder: gpaOrder,
      origin: "STRIPE_CONFIRM_AND_CARD_RECHARGE_FOR_MARQETA_USER",
      payment_session_id: sessionData.payment_session_id || sessionRef.id,
      payment_intent_id: paymentIntent.id,
      stripe_amount_cents: paymentIntent.amount,
      marqeta_amount_dollars: gpaOrder.amount,
      createdAt: new Date()
    });
    console.log('✅ GPA order guardado en Firebase exitosamente');

    return gpaOrder;
  } catch (error) {
    console.error('❌ Error en recarga Marqeta:', error);
    console.error('📍 Error stack:', error.stack);
    await sessionRef.collection('logs').add({
      type: 'marqeta:error',
      message: error.message,
      stack: error.stack,
      createdAt: new Date(),
    });
    throw error;
  }
}

/**
 * Webhook general de Marqeta (eventos de transacción/tarjeta).
 */
r.post('/marqeta', async (req, res) => {
  try {
    const evt = req.body;
    await db.collection('webhooks').add({ src: 'marqeta', evt, ts: new Date() });
    // Marqeta espera 2xx; reintenta si no.
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

/**
 * Endpoint de Gateway JIT Funding de Marqeta (autoriza/deniega).
 * Debes registrar esta URL en tu programa para JIT Gateway (sandbox).
 */
r.post('/jit/gateway', async (req, res) => {
  try {
    const decision = await handleJit(req.body);
    // Respuesta en el formato que espera Marqeta (approve/deny + amount, etc.)
    // (Consulta el schema de Gateway JIT messages 2025).
    // :contentReference[oaicite:17]{index=17}
    res.json(decision);
  } catch (e) {
    // Deniega por seguridad si falla tu lógica
    res.json({ result: 'DENY', reason: 'internal_error' });
  }
});

/**
 * Webhook de Circle: debe aceptar HEAD (verificación) y POST (eventos).
 * Docs Circle 2025: Manage Webhook Subscriptions + Quickstart.
 * :contentReference[oaicite:18]{index=18}
 */
r.head('/circle', (_req, res) => res.sendStatus(200));
r.post('/circle', async (req, res) => {
  try {
    const evt = req.body;
    await db.collection('webhooks').add({ src: 'circle', evt, ts: new Date() });
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

/**
 * Webhook de Stripe para procesar automáticamente la recarga a Marqeta
 */
r.post('/stripe', async (req, res) => {
  console.log('🎯 Webhook de Stripe recibido');
  
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verificar la firma del webhook
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ Firma del webhook verificada correctamente');
    console.log('📝 Tipo de evento:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('💳 PaymentIntent succeeded:', paymentIntent.id);
    console.log('💰 Monto:', paymentIntent.amount, 'centavos');
    
    try {
      // Buscar la sesión de pago usando el payment_intent_id
      console.log('🔍 Buscando sesión para payment_intent:', paymentIntent.id);
      const sessionsSnapshot = await db.collection('Stripe_Payments_Sessions')
        .where('payment_intent_id', '==', paymentIntent.id)
        .limit(1)
        .get();

      if (sessionsSnapshot.empty) {
        console.log('❌ No se encontró sesión para payment_intent:', paymentIntent.id);
        return res.json({ received: true, message: 'Session not found' });
      }

      const sessionDoc = sessionsSnapshot.docs[0];
      const sessionRef = sessionDoc.ref;
      const sessionData = sessionDoc.data();
      
      console.log('✅ Sesión encontrada:', sessionDoc.id);
      console.log('📊 Datos de sesión:', {
        marqeta_user_token: sessionData.marqeta_user_token,
        amount: sessionData.amount,
        status: sessionData.status
      });

      // Log del evento webhook
      await sessionRef.collection('logs').add({
        type: 'stripe:webhook:payment_intent.succeeded',
        payload: {
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          status: paymentIntent.status
        },
        createdAt: new Date(),
      });

      // Verificar si ya se procesó
      if (sessionData.status === 'completed') {
        console.log('⚠️ Pago ya procesado para session:', sessionDoc.id);
        return res.json({ received: true, message: 'Already processed' });
      }

      // Procesar recarga automática a Marqeta
      console.log('🚀 Iniciando processMarqetaReload...');
      const gpaOrder = await processMarqetaReload(paymentIntent, sessionData, sessionRef);
      console.log('✅ processMarqetaReload completado:', gpaOrder ? gpaOrder.token : 'null');

      // Actualizar el estado de la sesión
      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        webhook_processed: true
      };

      if (gpaOrder) {
        updateData.gpa_order_token = gpaOrder.token;
        updateData.gpa_order_amount = gpaOrder.amount;
        updateData.gpa_order_state = gpaOrder.state;
        console.log('💾 Actualizando sesión con datos GPA:', {
          token: gpaOrder.token,
          amount: gpaOrder.amount,
          state: gpaOrder.state
        });
      } else {
        console.log('⚠️ No se generó GPA order');
      }

      await sessionRef.set(updateData, { merge: true });
      console.log('✅ Estado de sesión actualizado');

      console.log('🎉 Recarga automática completada:', {
        payment_intent: paymentIntent.id,
        session: sessionDoc.id,
        gpa_order: gpaOrder?.token || 'none'
      });

      res.json({ received: true, processed: true });

    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      console.error('📍 Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  } else {
    // Otros tipos de eventos
    console.log('ℹ️ Webhook event type not handled:', event.type);
    res.json({ received: true, message: 'Event type not handled' });
  }
});

export default r;
