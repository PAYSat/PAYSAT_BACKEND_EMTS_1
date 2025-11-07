import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { marqeta } from '../config/marqeta.js';
import { db } from '../config/firebase.js';
import { handleJit } from '../services/jit.js';
import { emailService } from '../services/send_email.js';

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
  // console.log('🔄 Iniciando processMarqetaReload');
  // console.log('📝 Datos recibidos:', {
  //   paymentIntent_id: paymentIntent.id,
  //   marqeta_user_token: sessionData.marqeta_user_token,
  //   amount: sessionData.amount,
  //   currency: sessionData.currency
  // });
  
  try {
    if (!sessionData.marqeta_user_token) {
      // console.log('⚠️ No marqeta_user_token encontrado, saltando recarga');
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

    // console.log('📤 Enviando GPA order a Marqeta:', gpaPayload);

    await sessionRef.collection('logs').add({
      type: 'marqeta:request:gpaorders.create',
      payload: gpaPayload,
      createdAt: new Date(),
    });

    const { data: gpaOrder } = await marqeta.post('/gpaorders', gpaPayload);
    // console.log('✅ GPA order creado exitosamente:', gpaOrder.token);
    
    await sessionRef.collection('logs').add({
      type: 'marqeta:response:gpaorders.create',
      payload: gpaOrder,
      createdAt: new Date(),
    });

    // Guardar la orden GPA en Firebase
    // console.log('💾 Guardando GPA order en Firebase...');
    await db.collection('Marqeta_GPA_Orders').doc(gpaOrder.token).set({
      gpaOrder: gpaOrder,
      origin: "STRIPE_CONFIRM_AND_CARD_RECHARGE_FOR_MARQETA_USER",
      payment_session_id: sessionData.payment_session_id || sessionRef.id,
      payment_intent_id: paymentIntent.id,
      stripe_amount_cents: paymentIntent.amount,
      marqeta_amount_dollars: gpaOrder.amount,
      createdAt: new Date()
    });
    // console.log('✅ GPA order guardado en Firebase exitosamente');

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
    // console.log('✅ Firma del webhook verificada correctamente');
    // console.log('📝 Tipo de evento:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    console.log('🎯 Procesando payment_intent.succeeded:', paymentIntent.id);
    console.log('⏳ Esperando 2 segundos para dar prioridad a charge.succeeded...');
    
    // Esperar 2 segundos para dar prioridad a charge.succeeded
    await new Promise(resolve => setTimeout(resolve, 2000));

    // console.log('💳 PaymentIntent succeeded:', paymentIntent.id);
    // console.log('💰 Monto:', paymentIntent.amount, 'centavos');
    
    try {
      // Buscar la sesión de pago usando el payment_intent_id
      // console.log('🔍 Buscando sesión para payment_intent:', paymentIntent.id);
      const sessionsSnapshot = await db.collection('Stripe_Payments_Sessions')
        .where('payment_intent_id', '==', paymentIntent.id)
        .limit(1)
        .get();

      if (sessionsSnapshot.empty) {
        // console.log('❌ No se encontró sesión para payment_intent:', paymentIntent.id);
        return res.json({ received: true, message: 'Session not found' });
      }

      const sessionDoc = sessionsSnapshot.docs[0];
      const sessionRef = sessionDoc.ref;
      const sessionData = sessionDoc.data();
      
      // console.log('✅ Sesión encontrada:', sessionDoc.id);
      // console.log('📊 Datos de sesión:', {
      //   marqeta_user_token: sessionData.marqeta_user_token,
      //   amount: sessionData.amount,
      //   status: sessionData.status
      // });

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
      if (sessionData.status === 'completed' || sessionData.webhook_processed || sessionData.webhook_processing) {
        console.log('⚠️ Pago ya procesado para session:', sessionDoc.id, 'Status:', sessionData.status, 'Webhook procesado:', sessionData.webhook_processed, 'En proceso:', sessionData.webhook_processing);
        return res.json({ received: true, message: 'Already processed' });
      }

      // MARCAR INMEDIATAMENTE COMO PROCESÁNDOSE para evitar duplicados
      console.log('🔒 Marcando sesión como en procesamiento desde payment_intent.succeeded');
      await sessionRef.set({
        webhook_processing: true,
        webhook_processing_at: new Date(),
        processing_event_type: 'payment_intent.succeeded'
      }, { merge: true });
      console.log('✅ Sesión marcada como en procesamiento');

      // RECARGAR datos de sesión después del marcado
      const updatedSessionSnap = await sessionRef.get();
      const updatedSessionData = updatedSessionSnap.data();
      console.log('📄 Datos de sesión actualizados después del marcado:', {
        webhook_processing: updatedSessionData.webhook_processing,
        processing_event_type: updatedSessionData.processing_event_type
      });

      // Procesar recarga automática a Marqeta
      // console.log('🚀 Iniciando processMarqetaReload...');
      const gpaOrder = await processMarqetaReload(paymentIntent, sessionData, sessionRef);
      // console.log('✅ processMarqetaReload completado:', gpaOrder ? gpaOrder.token : 'null');

      // Actualizar el estado de la sesión
      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        webhook_processed: true,
        webhook_processing: false, // Limpiar flag de procesamiento
        processed_by: 'payment_intent.succeeded'
      };

      if (gpaOrder) {
        updateData.gpa_order_token = gpaOrder.token;
        updateData.gpa_order_amount = gpaOrder.amount;
        updateData.gpa_order_state = gpaOrder.state;
        // console.log('💾 Actualizando sesión con datos GPA:', {
        //   token: gpaOrder.token,
        //   amount: gpaOrder.amount,
        //   state: gpaOrder.state
        // });
      } else {
        console.log('⚠️ No se generó GPA order');
      }

      await sessionRef.set(updateData, { merge: true });
      // console.log('✅ Estado de sesión actualizado');

      // 📧 Enviar email de confirmación de recarga
      console.log('🔄 Recarga completada exitosamente, preparando envío de email...');
      
      try {
        // Intentar obtener más información del usuario si está disponible
        let userName = 'Usuario';
        let userEmail = sessionData.email;
        
        // console.log('📧 Datos de la sesión para email:', {
        //   email: userEmail,
        //   paysatUID: sessionData.paysatUID,
        //   amount: sessionData.amount,
        //   currency: sessionData.currency
        // });

        if (userEmail) {
          userName = userEmail.split('@')[0];
          // console.log('📧 Email disponible:', userEmail);
        } else {
          console.log('❌ No hay email en sessionData');
          // console.log('📄 sessionData completo:', JSON.stringify(sessionData, null, 2));
        }
        
        // Si hay paysatUID, intentar obtener el nombre real del usuario
        if (sessionData.paysatUID) {
          try {
            const userDoc = await db.collection('users').doc(sessionData.paysatUID).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              userName = userData.primerNombre || userData.nombreCompleto || userName;
              console.log('👤 Nombre de usuario obtenido:', userName);
            }
          } catch (userError) {
            console.log('📝 No se pudo obtener info adicional del usuario, usando fallback');
          }
        }

        // Solo enviar email si hay email disponible
        if (!userEmail) {
          console.log('⚠️ Saltando envío de email: no hay email en sessionData');
        } else {
          // console.log('📧 Iniciando envío de email de confirmación...');
          const emailResult = await emailService.sendReloadConfirmation({
            email: userEmail,
            userName: userName,
            amount: parseFloat(sessionData.amount),
            currency: sessionData.currency?.toUpperCase() || 'USD',
            paymentSessionId: sessionDoc.id
          });

          // Log del resultado del email
          await sessionRef.collection('logs').add({
            type: 'email:reload_confirmation:webhook',
            payload: {
              email: userEmail,
              success: emailResult.success,
              messageId: emailResult.messageId || null,
              error: emailResult.error || null,
              triggeredBy: 'stripe_webhook_marqeta_route'
            },
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
          });

          // console.log('📧 Email de confirmación:', emailResult.success ? '✅ Enviado exitosamente' : '❌ Error en envío');
          // if (emailResult.error) {
          //   console.log('❌ Error específico:', emailResult.error);
          // }
        }

      } catch (emailError) {
        console.error('❌ Error enviando email de confirmación:', emailError);
        // Log del error pero no fallar la transacción
        await sessionRef.collection('logs').add({
          type: 'email:error',
          payload: {
            error: emailError.message,
            stack: emailError.stack
          },
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      }

      // console.log('🎉 Recarga automática completada:', {
      //   payment_intent: paymentIntent.id,
      //   session: sessionDoc.id,
      //   gpa_order: gpaOrder?.token || 'none'
      // });

      res.json({ received: true, processed: true });

    } catch (error) {
      // console.error('❌ Error procesando webhook:', error);
      // console.error('📍 Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  } 
  // También manejar charge.succeeded como fallback
  else if (event.type === 'charge.succeeded') {
    console.log('🎯 Procesando charge.succeeded como fallback');
    
    const charge = event.data.object;
    const pi_id = charge.payment_intent;

    if (pi_id) {
      console.log('🔍 Buscando PaymentIntent:', pi_id, 'desde charge.succeeded');
      
      try {
        // Obtener el PaymentIntent completo
        const paymentIntent = await stripe.paymentIntents.retrieve(pi_id);
        
        if (paymentIntent.status === 'succeeded') {
          console.log('✅ PaymentIntent confirmado como exitoso desde charge.succeeded');
          
          // Buscar la sesión de pago
          const sessionsSnapshot = await db.collection('Stripe_Payments_Sessions')
            .where('payment_intent_id', '==', paymentIntent.id)
            .limit(1)
            .get();

          if (!sessionsSnapshot.empty) {
            const sessionDoc = sessionsSnapshot.docs[0];
            const sessionRef = sessionDoc.ref;
            const sessionData = sessionDoc.data();
            
            console.log('📋 Sesión encontrada para charge.succeeded:', sessionDoc.id);
            
            // VERIFICAR ESTADO ACTUAL DE LA SESIÓN ANTES DE PROCESAR
            const currentSessionData = sessionDoc.data();
            console.log('🔍 Estado actual de la sesión antes de verificar duplicados:', {
              status: currentSessionData.status,
              webhook_processed: currentSessionData.webhook_processed,
              webhook_processing: currentSessionData.webhook_processing,
              processing_event_type: currentSessionData.processing_event_type
            });

            // Verificar si ya se procesó
            if (currentSessionData.status === 'completed' || currentSessionData.webhook_processed || currentSessionData.webhook_processing) {
              console.log('⚠️ Pago ya procesado para session desde charge.succeeded:', sessionDoc.id, 'Status:', currentSessionData.status, 'Webhook procesado:', currentSessionData.webhook_processed, 'En proceso:', currentSessionData.webhook_processing);
              return res.json({ received: true, message: 'Already processed from charge.succeeded' });
            }

            // MARCAR INMEDIATAMENTE COMO PROCESÁNDOSE para evitar duplicados
            console.log('🔒 Marcando sesión como en procesamiento desde charge.succeeded');
            await sessionRef.set({
              webhook_processing: true,
              webhook_processing_at: new Date(),
              processing_event_type: 'charge.succeeded'
            }, { merge: true });
            console.log('✅ Sesión marcada como en procesamiento desde charge.succeeded');

            // Log del evento webhook
            await sessionRef.collection('logs').add({
              type: 'stripe:webhook:charge.succeeded',
              payload: {
                charge_id: charge.id,
                payment_intent_id: paymentIntent.id,
                amount: charge.amount,
                status: charge.status
              },
              createdAt: new Date(),
            });

            // Procesar recarga automática a Marqeta
            console.log('🚀 Iniciando processMarqetaReload desde charge.succeeded...');
            const gpaOrder = await processMarqetaReload(paymentIntent, sessionData, sessionRef);

            // Actualizar el estado de la sesión
            const updateData = {
              status: 'completed',
              completedAt: new Date(),
              webhook_processed: true,
              webhook_processing: false, // Limpiar flag de procesamiento
              processed_from: 'charge.succeeded'
            };

            if (gpaOrder) {
              updateData.gpa_order_token = gpaOrder.token;
              updateData.gpa_order_amount = gpaOrder.amount;
              updateData.gpa_order_state = gpaOrder.state;
            }

            await sessionRef.set(updateData, { merge: true });

            // 📧 Enviar email de confirmación desde charge.succeeded
            // console.log('📧 Preparando envío de email desde charge.succeeded...');
            
            try {
              let userName = 'Usuario';
              let userEmail = sessionData.email;
              
              if (userEmail) {
                userName = userEmail.split('@')[0];
                
                // Obtener nombre real del usuario si está disponible
                if (sessionData.paysatUID) {
                  try {
                    const userDoc = await db.collection('users').doc(sessionData.paysatUID).get();
                    if (userDoc.exists) {
                      const userData = userDoc.data();
                      userName = userData.primerNombre || userData.nombreCompleto || userName;
                    }
                  } catch (userError) {
                    // Usar fallback
                  }
                }

                // console.log('📧 Enviando email desde charge.succeeded a:', userEmail);

                const emailResult = await emailService.sendReloadConfirmation({
                  email: userEmail,
                  userName: userName,
                  amount: parseFloat(sessionData.amount),
                  currency: sessionData.currency?.toUpperCase() || 'USD',
                  paymentSessionId: sessionDoc.id
                });

                // Log del resultado
                await sessionRef.collection('logs').add({
                  type: 'email:reload_confirmation:charge_succeeded_webhook',
                  payload: {
                    email: userEmail,
                    success: emailResult.success,
                    messageId: emailResult.messageId || null,
                    error: emailResult.error || null,
                    triggeredBy: 'charge.succeeded_webhook'
                  },
                  createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
                });

                // console.log('📧 Email desde charge.succeeded:', emailResult.success ? '✅ Enviado' : '❌ Error', emailResult.error || '');

              } else {
                console.log('⚠️ No hay email en sessionData para charge.succeeded');
              }

            } catch (emailError) {
              console.error('❌ Error enviando email desde charge.succeeded:', emailError);
            }

            res.json({ received: true, processed: true, source: 'charge.succeeded' });

          } else {
            console.log('❌ No se encontró sesión para PaymentIntent desde charge.succeeded:', paymentIntent.id);
            res.json({ received: true, message: 'Session not found for charge.succeeded' });
          }
        }
      } catch (piError) {
        console.error('❌ Error obteniendo PaymentIntent desde charge.succeeded:', piError);
        res.status(500).json({ error: piError.message });
      }
    }
  }
  else {
    // Otros tipos de eventos
    console.log('ℹ️ Webhook event type not handled:', event.type);
    res.json({ received: true, message: 'Event type not handled' });
  }
});

export default r;
