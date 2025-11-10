import { Router } from 'express';
import { stripe, apiVersion, publishableKey } from '../config/stripe.js';
import { marqeta } from '../config/marqeta.js';
import { db } from '../config/firebase.js';
import { redactEphemeralKey, redactPaymentIntent, redactBackendResponseToClient } from '../utils/redact.js';
import { emailService } from '../services/send_email.js';

const router = Router();

async function getOrCreateCustomer(marqeta_user_token, paysat_uid, email, uid) {
  // console.log('getOrCreateCustomer called with:', { marqeta_user_token, email, uid });
  
  if (!marqeta_user_token) {
    throw new Error('marqeta_user_token es requerido para crear/obtener customer');
  }

  // Usar el marqeta_user_token como ID del documento
  const ref = db.collection('Stripe_Customers').doc(marqeta_user_token);
  const snap = await ref.get();

  if (snap.exists) {
    const existingData = snap.data();
    // console.log('Customer existente encontrado para token:', marqeta_user_token, 'customerId:', existingData.customerId);
    return existingData.customerId;
  }

  console.log('Creando nuevo customer en Stripe para marqeta_user_token:', marqeta_user_token);
  const customer = await stripe.customers.create({
    email,
    metadata: { 
      uid: uid || '',
      marqeta_user_token: marqeta_user_token
    }
  });

  await ref.set({
    customerId: customer.id,
    email: email || null,
    uid: uid || null,
    marqeta_user_token: marqeta_user_token,
    paysatUID: paysat_uid || '',
    createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
  });

  console.log('Nuevo customer creado:', customer.id, 'para token:', marqeta_user_token);
  return customer.id;
}

async function findMarqetaUserTokenByUid(uid) {
  const ref = db.collection('Stripe_Marqeta_Users').doc(uid);
  const snap = await ref.get();
  return snap.exists ? snap.data().user_token : null;
}

router.post('/init', async (req, res) => {
  const {
    uid,
    email,
    amount,
    currency = 'usd',
    marqeta_user_token = '',
    paysat_uid = '',
    payment_session_id
  } = req.body || {};

  try {
    if (!uid || !amount) {
      return res.status(400).json({ error: 'uid y amount son requeridos' });
    }

    // Busca marqeta_user_token si no vino
    let marqetaToken = marqeta_user_token;
    if (!marqetaToken) {
      marqetaToken = await findMarqetaUserTokenByUid(uid) || '';
    }

    const sessionId = payment_session_id || `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const sessionRef = db.collection('Stripe_Payments_Sessions').doc(sessionId);

    // Guardar movimiento en tabla de moviemientos
    const movimientoRef = db.collection('PaySat_Movimientos').doc(sessionId);
    // Guardar tarifa del movimiento

    // Convertir amount de centavos a dólares para Firebase con 2 decimales
    const amountInDollars = (amount / 100).toFixed(2);

    await sessionRef.set({
      uid,
      email: email || null,
      amount: amountInDollars, // Guardar en dólares con 2 decimales
      amount_cents: amount,    // Mantener también en centavos para referencia
      currency,
      marqeta_user_token: marqetaToken || null,
      paysatUID: paysat_uid || null,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'draft'
    }, { merge: true });

    await sessionRef.collection('logs').add({
      type: 'client:request:init',
      payload: { 
        uid, 
        email, 
        amount: amountInDollars, // Log en dólares
        amount_cents: amount,    // Log también en centavos
        currency, 
        marqeta_user_token: marqetaToken, 
        payment_session_id: sessionId 
      },
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    // Verificar que tenemos marqeta_user_token antes de crear customer
    if (!marqetaToken) {
      return res.status(400).json({ 
        error: 'marqeta_user_token es requerido para procesar el pago' 
      });
    }

    const customerId = await getOrCreateCustomer(marqetaToken, paysat_uid, email, uid);

    const ek_request = { customer: customerId, apiVersion };
    const ephKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion }
    );
    await sessionRef.collection('logs').add({
      type: 'stripe:request:ephemeral_keys.create',
      payload: ek_request,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    await sessionRef.collection('logs').add({
      type: 'stripe:response:ephemeral_keys.create',
      payload: redactEphemeralKey(ephKey),
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    const pi_request = {
      amount, // Stripe siempre necesita centavos
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { 
        uid, 
        marqeta_user_token: marqetaToken, 
        payment_session_id: sessionId,
        amount_dollars: amountInDollars // Ya tiene formato con 2 decimales
      }
    };
    const paymentIntent = await stripe.paymentIntents.create(pi_request);
    await sessionRef.collection('logs').add({
      type: 'stripe:request:payment_intents.create',
      payload: pi_request,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    await sessionRef.collection('logs').add({
      type: 'stripe:response:payment_intents.create',
      payload: redactPaymentIntent(paymentIntent),
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    await sessionRef.set({
      payment_intent_id: paymentIntent.id,
      customer_id: customerId,
      status: 'initiated'
    }, { merge: true });

    const backendResponse = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephKey.secret,
      customer: customerId,
      publishableKey,
      paymentSessionId: sessionId
    };
    await sessionRef.collection('logs').add({
      type: 'backend:response:init',
      payload: redactBackendResponseToClient(backendResponse),
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    res.json(backendResponse);
  } catch (err) {
    console.error(err);
    try {
      const sessionId = payment_session_id || `sess_${Date.now()}`;
      await db.collection('Stripe_Payments_Sessions').doc(sessionId)
        .collection('logs').add({
          type: 'error',
          where: 'payments/init',
          message: err.message,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
    } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

/**
 * Migrar customers existentes al nuevo sistema basado en marqeta_user_token
 */
router.post('/customers/migrate', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('Stripe_Customers').get();
    const migratedCount = 0;
    const migrations = [];

    for (const doc of customersSnapshot.docs) {
      const data = doc.data();
      const oldDocId = doc.id; // Puede ser UID
      
      // Si ya tiene marqeta_user_token en el document ID, skip
      if (data.marqeta_user_token && oldDocId === data.marqeta_user_token) {
        continue;
      }

      // Si tiene marqeta_user_token en los datos, migrar
      if (data.marqeta_user_token && oldDocId !== data.marqeta_user_token) {
        const newRef = db.collection('Stripe_Customers').doc(data.marqeta_user_token);
        
        await newRef.set({
          ...data,
          migratedFrom: oldDocId,
          migratedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });

        await doc.ref.delete();
        
        migrations.push({
          from: oldDocId,
          to: data.marqeta_user_token,
          customerId: data.customerId
        });
      }
    }

    res.json({
      ok: true,
      migrationsPerformed: migrations.length,
      migrations: migrations,
      message: 'Migración completada. Ahora los customers se indexan por marqeta_user_token'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint para verificar y limpiar customers duplicados
 */
router.get('/customers/cleanup', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('Stripe_Customers').get();
    const duplicates = [];
    const customersByEmail = new Map();

    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const uid = doc.id;
      const email = data.email;
      
      if (email) {
        if (customersByEmail.has(email)) {
          // Encontramos un duplicado
          duplicates.push({
            uid: uid,
            customerId: data.customerId,
            email: email,
            existing: customersByEmail.get(email)
          });
        } else {
          customersByEmail.set(email, { uid, customerId: data.customerId, email });
        }
      }
    });

    res.json({
      ok: true,
      totalCustomers: customersSnapshot.size,
      duplicatesFound: duplicates.length,
      duplicates: duplicates,
      message: 'Para limpiar duplicados, usa POST /api/payments/customers/cleanup'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint para limpiar customers duplicados (mantiene el más reciente)
 */
router.post('/customers/cleanup', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('Stripe_Customers').get();
    const customersByUid = new Map();
    const toDelete = [];

    // Agrupar por UID y encontrar duplicados
    customersSnapshot.forEach(doc => {
      const uid = doc.id;
      const data = doc.data();
      
      if (customersByUid.has(uid)) {
        // Si ya existe un customer para este UID, marcamos el actual para eliminar
        toDelete.push({ docId: doc.id, customerId: data.customerId });
      } else {
        customersByUid.set(uid, { docId: doc.id, data });
      }
    });

    // Eliminar duplicados de Firebase (pero NO de Stripe por seguridad)
    const deletionPromises = toDelete.map(async (item) => {
      await db.collection('Stripe_Customers').doc(item.docId).delete();
      return item;
    });

    const deletedItems = await Promise.all(deletionPromises);

    res.json({
      ok: true,
      deletedFromFirebase: deletedItems.length,
      deletedItems: deletedItems,
      message: 'Duplicados eliminados de Firebase. Los customers en Stripe se mantuvieron por seguridad.'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint para confirmar desde el cliente (opcional para testing)
 */
router.post('/client-confirm', async (req, res) => {
  const { payment_intent_id } = req.body || {};

  try {
    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id es requerido' });
    }

    // Verificar el PaymentIntent en Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // console.log(paymentIntent)
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'El pago no ha sido completado exitosamente',
        stripe_status: paymentIntent.status 
      });
    }

    // Buscar la sesión de pago
    const sessionsSnapshot = await db.collection('Stripe_Payments_Sessions')
      .where('payment_intent_id', '==', payment_intent_id)
      .limit(1)
      .get();

    if (sessionsSnapshot.empty) {
      return res.status(404).json({ error: 'Sesión de pago no encontrada' });
    }

    const sessionDoc = sessionsSnapshot.docs[0];
    const sessionData = sessionDoc.data();

    res.json({
      ok: true,
      payment_intent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      },
      session: {
        id: sessionDoc.id,
        status: sessionData.status,
        marqeta_user_token: sessionData.marqeta_user_token ? 'present' : 'missing'
      },
      message: 'Verificación completada. El webhook procesará la recarga automáticamente.'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Confirma el pago de Stripe y recarga el mismo monto a Marqeta
 */
router.post('/confirm-and-reload', async (req, res) => {
  const {
    payment_intent_id,
    payment_session_id,
    funding_source_token
  } = req.body || {};

  try {
    if (!payment_intent_id || !payment_session_id) {
      return res.status(400).json({ 
        error: 'payment_intent_id y payment_session_id son requeridos' 
      });
    }

    // Obtener información de la sesión de pago
    const sessionRef = db.collection('Stripe_Payments_Sessions').doc(payment_session_id);
    const sessionSnap = await sessionRef.get();
    
    if (!sessionSnap.exists) {
      return res.status(404).json({ error: 'Sesión de pago no encontrada' });
    }

    const sessionData = sessionSnap.data();
    
    // Verificar el PaymentIntent en Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    await sessionRef.collection('logs').add({
      type: 'stripe:request:payment_intents.retrieve',
      payload: { payment_intent_id },
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    
    await sessionRef.collection('logs').add({
      type: 'stripe:response:payment_intents.retrieve',
      payload: redactPaymentIntent(paymentIntent),
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'El pago no ha sido completado exitosamente',
        stripe_status: paymentIntent.status 
      });
    }

    // Si el pago fue exitoso, crear GPA order en Marqeta
    if (sessionData.marqeta_user_token) {
      const gpaPayload = {
        user_token: sessionData.marqeta_user_token,
        amount: parseFloat(sessionData.amount), // Usar el monto en dólares
        currency_code: sessionData.currency?.toUpperCase() || "USD",
        funding_source_token: funding_source_token || process.env.DEFAULT_FUNDING_SOURCE_TOKEN
      };

      await sessionRef.collection('logs').add({
        type: 'marqeta:request:gpaorders.create',
        payload: gpaPayload,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });

      const { data: gpaOrder } = await marqeta.post('/gpaorders', gpaPayload);
      
      await sessionRef.collection('logs').add({
        type: 'marqeta:response:gpaorders.create',
        payload: gpaOrder,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });

      // Guardar la orden GPA en Firebase
      await db.collection('Marqeta_GPA_Orders').doc(gpaOrder.token).set({
        gpaOrder: gpaOrder,
        origin: "STRIPE_CONFIRM_AND_CARD_RELOAD",
        payment_session_id: payment_session_id,
        payment_intent_id: payment_intent_id,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      });

      // Actualizar la sesión con la información del GPA order
      await sessionRef.set({
        gpa_order_token: gpaOrder.token,
        gpa_order_amount: gpaOrder.amount,
        gpa_order_state: gpaOrder.state,
        marqeta_funding_source_token: funding_source_token,
        status: 'completed',
        completedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, { merge: true });

      console.log('🔄 Recarga completada exitosamente, preparando envío de email...');
      console.log('📧 Datos de la sesión para email:', {
        email: sessionData.email,
        uid: sessionData.uid,
        amount: sessionData.amount,
        currency: sessionData.currency
      });

      // 📧 Enviar email de confirmación de recarga
      try {
        // Intentar obtener más información del usuario si está disponible
        let userName = 'Usuario';
        if (sessionData.email) {
          userName = sessionData.email.split('@')[0];
          console.log('📧 Email disponible:', sessionData.email);
        } else {
          console.log('❌ No hay email en sessionData');
          console.log('📄 sessionData completo:', JSON.stringify(sessionData, null, 2));
        }
        
        // Si hay uid, intentar obtener el nombre real del usuario
        if (sessionData.uid) {
          try {
            const userDoc = await db.collection('PaySat_Users').doc(sessionData.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              userName = userData.primerNombre || userData.nombreCompleto || userName;
              console.log('👤 Nombre de usuario obtenido:', userName);
            }
          } catch (userError) {
            // Si no puede obtener info del usuario, usar el fallback
            console.log('📝 No se pudo obtener info adicional del usuario, usando fallback');
          }
        }

        // Solo enviar email si hay email disponible
        if (!sessionData.email) {
          console.log('⚠️ Saltando envío de email: no hay email en sessionData');
        } else {
          console.log('📧 Iniciando envío de email...');
          const emailResult = await emailService.sendReloadConfirmation({
            email: sessionData.email,
            userName: userName,
            amount: parseFloat(sessionData.amount),
            currency: sessionData.currency?.toUpperCase() || 'USD',
            paymentSessionId: payment_session_id
          });

          // Log del resultado del email
          await sessionRef.collection('logs').add({
            type: 'email:reload_confirmation',
            payload: {
              email: sessionData.email,
              success: emailResult.success,
              messageId: emailResult.messageId || null,
              error: emailResult.error || null
            },
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
          });

          console.log('📧 Email de confirmación:', emailResult.success ? '✅ Enviado' : '❌ Error');
        }

      } catch (emailError) {
        console.error('❌ Error enviando email de confirmación:', emailError);
        // No fallar la transacción si el email falla
      }

      res.json({
        ok: true,
        stripe_payment_intent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        },
        marqeta_gpa_order: {
          token: gpaOrder.token,
          amount: gpaOrder.amount,
          currency_code: gpaOrder.currency_code,
          state: gpaOrder.state
        },
        payment_session_id: payment_session_id
      });

    } else {
      // Si no hay token de Marqeta, solo actualizar el estado
      await sessionRef.set({
        status: 'completed_stripe_only',
        completedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, { merge: true });

      res.json({
        ok: true,
        message: 'Pago completado en Stripe. No se realizó recarga en Marqeta (no hay user_token)',
        stripe_payment_intent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        },
        payment_session_id: payment_session_id
      });
    }

  } catch (err) {
    console.error(err);
    try {
      await db.collection('Stripe_Payments_Sessions').doc(payment_session_id)
        .collection('logs').add({
          type: 'error',
          where: 'payments/confirm-and-reload',
          message: err.message,
          stack: err.stack,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
    } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

export default router;
