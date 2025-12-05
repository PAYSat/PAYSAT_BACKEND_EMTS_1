import { Router } from 'express';
import bodyParser from 'body-parser';
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';
import { emailService } from '../services/send_email.js';
import { getFeesByRecharge, getFeesByPaymentIntent } from '../services/stripe_fees_service.js';
import { processCompleteTransaction } from '../services/movements_service.js';
import { centsToAmount } from '../utils/cents_to_amount.js';
import { getUserAccountNumber } from '../services/paysat_service.js';

const router = Router();

// Función helper para mapear fees payload
function mapFeePayload(bt) {
  if (!bt) return null;
  return {
    balanceTransactionId: bt.id,
    currency: bt.currency,
    fee_cents: bt.fee,
    fee: centsToAmount(bt.fee),
    net_cents: bt.net,
    net: centsToAmount(bt.net),
    fee_details: (bt.fee_details || []).map(fd => ({
      type: fd.type,
      amount_cents: fd.amount,
      amount: centsToAmount(fd.amount),
      description: fd.description
    }))
  };
}

// Función helper para guardar fees en Firebase
async function saveFeeToFirebase(feeData, paysatUID, source, paymentIntentId, rechargeId = null) {
  try {
    if (!feeData) {
      console.log('⚠️ No hay datos de fee disponibles para guardar');
      return null;
    }

    const feeDocId = `${paymentIntentId}_${source}`;
    console.log('💾 Intentando guardar fee con ID:', feeDocId);
    console.log('🔍 Source:', source);
    console.log('📍 Stack trace:', new Error().stack.split('\n').slice(2, 6).join('\n'));
    
    const existingFeeDoc = await db.collection('Stripe_Fees').doc(feeDocId).get();
    if (existingFeeDoc.exists) {
      console.log('ℹ️ Fee ya registrado para:', feeDocId);
      return existingFeeDoc.data();
    }

    const feeDocument = {
      ...feeData,
      source,
      paymentIntentId,
      rechargeId,
      paysatUID,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('Stripe_Fees').doc(feeDocId).set(feeDocument);
    console.log('💰 Fee guardado exitosamente:', feeDocId);
    
    // Limpiar documento duplicado antiguo si existe (_recharge)
    if (source === 'charge.succeeded') {
      const oldFeeDocId = `${paymentIntentId}_recharge`;
      try {
        const oldDoc = await db.collection('Stripe_Fees').doc(oldFeeDocId).get();
        if (oldDoc.exists) {
          await db.collection('Stripe_Fees').doc(oldFeeDocId).delete();
          console.log('🗑️ Documento duplicado eliminado:', oldFeeDocId);
        }
      } catch (cleanupError) {
        console.error('⚠️ Error limpiando documento duplicado:', cleanupError);
        // No fallar por error de limpieza
      }
    }
    
    return feeDocument;
  } catch (error) {
    console.error('❌ Error guardando fee:', error);
    return null;
  }
}

// Función helper para verificar si los fees ya fueron procesados
async function checkIfFeeProcessed(paymentIntentId, rechargeId) {
  try {
    const feeQuery = await db.collection('PaySat_Account_Movements')
      .where('typeMovement', '==', 'fee')
      .where('payment_intent_id', '==', paymentIntentId)
      .limit(1)
      .get();
    
    if (!feeQuery.empty) {
      console.log('✅ Fee ya procesado para payment_intent:', paymentIntentId);
      return true;
    }
    
    if (rechargeId) {
      const feeByRechargeQuery = await db.collection('PaySat_Account_Movements')
        .where('typeMovement', '==', 'fee')
        .where('recharge_id', '==', rechargeId)
        .limit(1)
        .get();
      
      if (!feeByRechargeQuery.empty) {
        console.log('✅ Fee ya procesado para recharge:', rechargeId);
        return true;
      }
    }
    
    console.log('📄 Fee no procesado aún para payment_intent:', paymentIntentId);
    return false;
  } catch (error) {
    console.error('❌ Error verificando fee procesado:', error);
    return false;
  }
}

// Webhook principal de Stripe
router.post('/', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Error verificando firma del webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`\n🔔 Stripe Webhook recibido: ${event.type}`);
  console.log(`📋 Event ID: ${event.id}`);

  try {
    // Guardar evento en Firebase
    // const webhookEventRef = db.collection('webhook_events').doc(event.id);
    // const eventSnapshot = await webhookEventRef.get();

    // if (eventSnapshot.exists) {
    //   console.log('⚠️ Evento duplicado detectado, ignorando:', event.id);
    //   return res.json({ received: true, status: 'duplicate' });
    // }

    // await webhookEventRef.set({
    //   event_id: event.id,
    //   event_type: event.type,
    //   created: new Date(event.created * 1000),
    //   processed: false,
    //   payload: JSON.parse(JSON.stringify(event))
    // });

    // Procesar según el tipo de evento
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('💳 PaymentIntent succeeded:', paymentIntent.id);
        console.log('💰 Monto:', paymentIntent.amount, paymentIntent.currency);

        // Buscar sesión de pago asociada
        const sessionQuery = await db.collection('Stripe_Payments_Sessions')
          .where('payment_intent_id', '==', paymentIntent.id)
          .limit(1)
          .get();

        if (sessionQuery.empty) {
          console.log('⚠️ No se encontró sesión para payment_intent:', paymentIntent.id);
          // await webhookEventRef.update({
          //   processed: true,
          //   error: 'No session found',
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'no_session' });
        }

        const sessionDoc = sessionQuery.docs[0];
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        console.log('📄 Sesión encontrada:', sessionId);
        console.log('👤 Usuario:', sessionData.paysatUID);

        // Verificar si ya fue procesado
        if (sessionData.payment_processed === true) {
          console.log('✅ Payment_intent ya procesado previamente');
          // await webhookEventRef.update({
          //   processed: true,
          //   duplicate: true,
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'already_processed' });
        }

        // Actualizar sesión como procesada
        await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
          payment_processed: true,
          payment_processed_at: new Date(),
          payment_intent_status: paymentIntent.status,
          updated_at: new Date()
        });

        console.log('✅ Sesión actualizada como procesada');

        // Esperar 2 segundos antes de procesar el charge
        console.log('⏳ Esperando 2 segundos para que Stripe genere el charge...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Marcar evento como procesado
        // await webhookEventRef.update({
        //   processed: true,
        //   processedAt: new Date(),
        //   session_id: sessionId
        // });

        console.log('✅ payment_intent.succeeded procesado completamente');
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object;
        console.log('💳 Charge succeeded:', charge.id);
        console.log('💰 Monto:', charge.amount, charge.currency);
        console.log('🔗 Payment Intent:', charge.payment_intent);

        if (!charge.payment_intent) {
          console.log('⚠️ Charge sin payment_intent asociado, ignorando');
          // await webhookEventRef.update({
          //   processed: true,
          //   skipped: true,
          //   reason: 'No payment_intent',
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'no_payment_intent' });
        }

        // Buscar sesión asociada al payment_intent
        const sessionQuery = await db.collection('Stripe_Payments_Sessions')
          .where('payment_intent_id', '==', charge.payment_intent)
          .limit(1)
          .get();

        if (sessionQuery.empty) {
          console.log('⚠️ No se encontró sesión para charge:', charge.id);
          // await webhookEventRef.update({
          //   processed: true,
          //   error: 'No session found',
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'no_session' });
        }

        const sessionDoc = sessionQuery.docs[0];
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;
        const paysatUID = sessionData.paysatUID;
        const rechargeId = sessionData.recharge_id || null;

        console.log('📄 Sesión encontrada:', sessionId);
        console.log('👤 Usuario:', paysatUID);
        console.log('🔄 Recharge ID:', rechargeId || 'N/A');

        // Verificar si el charge ya fue procesado
        if (sessionData.charge_processed === true) {
          console.log('✅ Charge ya procesado previamente');
          // await webhookEventRef.update({
          //   processed: true,
          //   duplicate: true,
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'already_processed' });
        }

        // Marcar como procesado INMEDIATAMENTE para evitar duplicados
        await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
          charge_processed: true,
          charge_id: charge.id,
          charge_processed_at: new Date(),
          updated_at: new Date()
        });

        console.log('✅ Charge marcado como procesado para evitar duplicados');

        // Obtener balance transaction para fees
        let balanceTransaction = null;
        let feeData = null;
        let feeAlreadySaved = false;

        if (charge.balance_transaction) {
          try {
            console.log('🔍 Obteniendo balance transaction:', charge.balance_transaction);
            balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
            feeData = mapFeePayload(balanceTransaction);
            console.log('💰 Fees obtenidos:', feeData);

            // Guardar fees en Firebase
            await saveFeeToFirebase(
              feeData,
              paysatUID,
              'charge.succeeded',
              charge.payment_intent,
              rechargeId
            );
            feeAlreadySaved = true;
          } catch (error) {
            console.error('❌ Error obteniendo balance transaction:', error);
          }
        }
        
        if (!feeAlreadySaved && !charge.balance_transaction) {
          console.log('⚠️ Charge sin balance_transaction, obteniendo charge actualizado...');
          
          // Esperar 3 segundos y volver a obtener el charge
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          try {
            const updatedCharge = await stripe.charges.retrieve(charge.id);
            
            if (updatedCharge.balance_transaction) {
              console.log('✅ Balance transaction ahora disponible:', updatedCharge.balance_transaction);
              balanceTransaction = await stripe.balanceTransactions.retrieve(updatedCharge.balance_transaction);
              feeData = mapFeePayload(balanceTransaction);
              console.log('💰 Fees obtenidos después de retry:', feeData);

              // Guardar fees en Firebase
              await saveFeeToFirebase(
                feeData,
                paysatUID,
                'charge.succeeded',
                charge.payment_intent,
                rechargeId
              );
            } else {
              console.log('⚠️ Balance transaction aún no disponible después de retry');
            }
          } catch (retryError) {
            console.error('❌ Error en retry de balance transaction:', retryError);
          }
        }

        // Verificar si los fees ya fueron procesados        // Verificar si los fees ya fueron procesados
        const feeAlreadyProcessed = await checkIfFeeProcessed(charge.payment_intent, rechargeId);

        if (feeAlreadyProcessed) {
          console.log('✅ Fees ya procesados, saltando procesamiento de movimientos');
          
          // Actualizar sesión
          await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
            charge_processed: true,
            charge_id: charge.id,
            charge_processed_at: new Date(),
            updated_at: new Date()
          });

            // await webhookEventRef.update({
            //   processed: true,
            //   duplicate_fees: true,
            //   processedAt: new Date()
            // });

          return res.json({ received: true, status: 'fees_already_processed' });
        }

        // Obtener datos del usuario
        const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
        if (!userDoc.exists) {
          console.error('❌ Usuario no encontrado:', paysatUID);
          // await webhookEventRef.update({
          //   processed: true,
          //   error: 'User not found',
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'user_not_found' });
        }

        const userData = userDoc.data();
        
        // Obtener nombre y email con los campos correctos de Firebase
        const userName = userData.nombreCompleto || 
                        userData.nombres || 
                        userData.primerNombre ||
                        'Usuario';
        const userEmail = userData.correo || 'no-email@paysat.com';
        
        console.log('👤 Datos del usuario obtenidos:', userName, userEmail);
        
        // Obtener número de cuenta
        let userAccountNumber;
        try {
          userAccountNumber = await getUserAccountNumber(paysatUID);
          console.log('🏦 Cuenta del usuario:', userAccountNumber);
        } catch (accountError) {
          console.error('❌ Error obteniendo número de cuenta:', accountError);
          // await webhookEventRef.update({
          //   processed: true,
          //   error: `Account number error: ${accountError.message}`,
          //   processedAt: new Date()
          // });
          return res.json({ received: true, status: 'account_error', error: accountError.message });
        }

        // Preparar datos de sesión para movimientos
        const sessionMovementData = {
          paysatUID,
          amount_cents: charge.amount,
          amount: centsToAmount(charge.amount),
          currency: charge.currency,
          charge_id: charge.id,
          userEmail: userEmail,
          userName: userName,
          description: `Recarga Stripe - ${charge.id}`,
          metadata: {
            source: 'stripe_webhook',
            event_id: event.id,
            session_id: sessionId
          }
        };

        // console.log('📦 ============================================');
        console.log('📦 Procesando transacción completa...');
        // console.log('📦 Event ID:', event.id);
        // console.log('📦 Event Type:', event.type);
        // console.log('📦 Charge ID:', charge.id);
        // console.log('📦 Payment Intent:', charge.payment_intent);
        // console.log('📦 Balance Transaction ID:', feeData?.balanceTransactionId || 'N/A');
        // console.log('📦 ============================================');
        
        // Procesar transacción completa (fees + charge + deposit)
        // Firma: processCompleteTransaction(sessionData, paymentIntentId, rechargeId, feeData, balanceTransactionId, options)
        const balanceTransactionId = feeData?.balanceTransactionId || null;
        const result = await processCompleteTransaction(
          sessionMovementData,
          charge.payment_intent,
          rechargeId,
          feeData,
          balanceTransactionId
        );
        
        // console.log('📦 Resultado de processCompleteTransaction:', JSON.stringify(result, null, 2));
        // console.log('📦 ============================================');

        if (!result.success) {
          const errorMessage = result.error || 'Error desconocido en procesamiento';
          console.error('❌ Error procesando transacción:', errorMessage);
          
          // await db.collection('webhook_errors').add({
          //   event_id: event.id,
          //   event_type: event.type,
          //   error: errorMessage,
          //   payment_intent_id: charge.payment_intent,
          //   charge_id: charge.id,
          //   paysatUID,
          //   timestamp: new Date()
          // });

          // await webhookEventRef.update({
          //   processed: true,
          //   error: errorMessage,
          //   processedAt: new Date()
          // });

          return res.status(500).json({ received: true, status: 'processing_error', error: errorMessage });
        }

        console.log('✅ Transacción procesada exitosamente');
        console.log('📊 Resultado del procesamiento:', {
          recharge: result.recharge?.documentId,
          fee: result.fee?.documentId,
          deposit: result.deposit?.documentId
        });

        // Construir resumen de movimientos
        const movementsSummary = {
          recharge_id: result.recharge?.documentId || null,
          fee_id: result.fee?.documentId || null,
          deposit_id: result.deposit?.documentId || null,
          success: result.success
        };

        // Actualizar sesión con resumen de movimientos
        await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
          movements_summary: movementsSummary,
          updated_at: new Date()
        });

        // Enviar email de confirmación SOLO si hay feeData completo
        if (feeData && feeData.totalFee && feeData.net) {
          try {
            console.log('📧 Enviando email de confirmación...');
            
            const emailResult = await emailService.sendReloadConfirmation({
              email: userEmail,
              userName: userName,
              amount: centsToAmount(charge.amount),
              totalFee: feeData.totalFee,
              netAmount: feeData.net,
              paymentSessionId: sessionId,
              currency: charge.currency.toUpperCase()
            });

            if (emailResult.success) {
              console.log('✅ Email enviado exitosamente');
            } else {
              console.log('⚠️ No se pudo enviar el email:', emailResult.error);
            }
          } catch (emailError) {
            console.error('❌ Error enviando email:', emailError);
            // No fallar el webhook por error en email
          }
        } else {
          //console.log('⚠️ No se envía email - feeData incompleto:', { hasFeeData: !!feeData, totalFee: feeData?.totalFee, net: feeData?.net });
        }

        // Marcar evento como procesado
        // await webhookEventRef.update({
        //   processed: true,
        //   processedAt: new Date(),
        //   session_id: sessionId,
        //   movements_summary: movementsSummary
        // });

        console.log('✅ charge.succeeded procesado completamente');
        break;
      }

      default:
        console.log(`ℹ️ Evento no manejado: ${event.type}`);
        // await webhookEventRef.update({
        //   processed: true,
        //   skipped: true,
        //   reason: 'Event type not handled',
        //   processedAt: new Date()
        // });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    
    // await db.collection('webhook_errors').add({
    //   event_id: event.id,
    //   event_type: event.type,
    //   error: error.message,
    //   stack: error.stack,
    //   timestamp: new Date()
    // });

    res.status(500).json({ 
      received: true, 
      status: 'error',
      error: error.message 
    });
  }
});

export default router;
