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

// ---- Issuing helpers (duplicated here so the main webhook can handle Issuing events too) ----
async function updateSimulation(authId, data) {
  try {
    const simQuery = await db.collection('Stripe_Simulations_Temp')
      .where('authorizationId', '==', authId)
      .limit(1)
      .get();
    
    if (!simQuery.empty) {
      const simDoc = simQuery.docs[0];
      await simDoc.ref.update(data);
      console.log('💾 Simulación actualizada (main webhook):', simDoc.id);
    }
  } catch (err) {
    console.error('⚠️ Error actualizando simulación (main webhook):', err.message);
  }
}

async function handleIssuingAuthorization(event) {
  const auth = event.data.object;
  const amountCents = auth.amount;
  const amount = amountCents / 100;
  const currency = auth.currency;
  const cardholderId = auth.cardholder;
  const cardId = auth.card;
  console.log('💳 Issuing auth (main webhook):', { authId: auth.id, cardId, cardholderId, amount, currency, status: auth.status });

  // Si ya está aprobada o rechazada, no hacer nada
  if (auth.status !== 'pending') {
    console.log(`ℹ️ Authorization ${auth.id} ya está en estado ${auth.status}, omitiendo (main webhook)`);
    return;
  }

  // 1. Mapear cardholder → usuario PAYSAT (por metadata)
  const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);
  console.log('👤 Cardholder data (main webhook):', {
    id: cardholder.id,
    name: cardholder.name,
    email: cardholder.email,
    metadata: cardholder.metadata,
  });
  
  const paysatUID = cardholder.metadata?.paysatUID;

  if (!paysatUID) {
    console.log('⚠️ cardholder sin paysatUID, declinando (main webhook)');
    await stripe.issuing.authorizations.decline(auth.id, {
      metadata: { decline_reason: 'no_paysat_uid' },
    });
    
    await updateSimulation(auth.id, {
      webhookProcessed: true,
      approved: false,
      declineReason: 'no_paysat_uid',
      processedAt: new Date().toISOString(),
    });
    return;
  }

  // 2. Leer saldo virtual del usuario en Firestore
  const userRef = db.collection('PaySat_Users').doc(paysatUID);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.log('⚠️ Usuario PAYSAT no encontrado, declinando (main webhook). UID buscado:', paysatUID);
    await stripe.issuing.authorizations.decline(auth.id, {
      metadata: { decline_reason: 'user_not_found' },
    });
    
    await updateSimulation(auth.id, {
      webhookProcessed: true,
      approved: false,
      declineReason: 'user_not_found',
      paysatUID: paysatUID,
      processedAt: new Date().toISOString(),
    });
    return;
  }

  const userData = userSnap.data();
  const currentBalance = parseFloat(userData.saldoPAYSAT || 0);

  console.log(`🏦 Saldo PAYSAT actual de ${paysatUID}: ${currentBalance} (main webhook)`);

  // 3. Lógica: solo aprobar si el usuario tiene saldo suficiente
  if (currentBalance >= amount) {
    await stripe.issuing.authorizations.approve(auth.id);
    console.log('✅ Autorización aprobada (main webhook)');

    await updateSimulation(auth.id, {
      webhookProcessed: true,
      approved: true,
      paysatUID: paysatUID,
      userBalance: currentBalance,
      processedAt: new Date().toISOString(),
    });
  } else {
    console.log('❌ Saldo insuficiente, declinando (main webhook). Saldo:', currentBalance, 'Monto:', amount);
    await stripe.issuing.authorizations.decline(auth.id, {
      metadata: { decline_reason: 'insufficient_funds' },
    });
    
    await updateSimulation(auth.id, {
      webhookProcessed: true,
      approved: false,
      declineReason: 'insufficient_funds',
      paysatUID: paysatUID,
      userBalance: currentBalance,
      processedAt: new Date().toISOString(),
    });
  }
}

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
    // Manejo de eventos Issuing (fallback cuando Stripe envía Issuing a este webhook)
    if (event.type === 'issuing_authorization.request' || event.type === 'issuing_authorization.created') {
      await handleIssuingAuthorization(event);
      return res.json({ received: true, source: 'issuing_fallback' });
    }

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
          return res.json({ received: true, status: 'no_payment_intent' });
        }

        // Buscar sesión asociada al payment_intent
        const sessionQuery = await db.collection('Stripe_Payments_Sessions')
          .where('payment_intent_id', '==', charge.payment_intent)
          .limit(1)
          .get();

        if (sessionQuery.empty) {
          console.log('⚠️ No se encontró sesión para charge:', charge.id);
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

        // 🔹 NUEVO: ajustar monto de depósito usando metadata.userAmount (topup PAYSAT)
        let depositAmountCents = charge.amount;
        let depositAmount = centsToAmount(charge.amount);

        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent);
          const meta = paymentIntent.metadata || {};

          if (meta.intent_type === 'paysat_topup') {
            const userAmountRaw = meta.userAmount;
            const userAmount = parseFloat(userAmountRaw);

            if (!isNaN(userAmount) && userAmount > 0) {
              depositAmountCents = Math.round(userAmount * 100);
              depositAmount = parseFloat(userAmount.toFixed(2));
              console.log('💰 Usando userAmount desde metadata para depósito PAYSAT:', {
                userAmount,
                depositAmountCents,
              });
            } else {
              console.log('⚠️ userAmount inválido en metadata, se mantiene charge.amount');
            }
          } else {
            console.log('ℹ️ PaymentIntent no es paysat_topup, se usa charge.amount');
          }
        } catch (piError) {
          console.error('⚠️ No se pudo obtener PaymentIntent para ajustar depósito:', piError);
        }

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

        // Verificar si los fees ya fueron procesados
        const feeAlreadyProcessed = await checkIfFeeProcessed(charge.payment_intent, rechargeId);

        if (feeAlreadyProcessed) {
          console.log('✅ Fees ya procesados, saltando procesamiento de movimientos');
          
          await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
            charge_processed: true,
            charge_id: charge.id,
            charge_processed_at: new Date(),
            updated_at: new Date()
          });

          return res.json({ received: true, status: 'fees_already_processed' });
        }

        // Obtener datos del usuario
        const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
        if (!userDoc.exists) {
          console.error('❌ Usuario no encontrado:', paysatUID);
          return res.json({ received: true, status: 'user_not_found' });
        }

        const userData = userDoc.data();
        
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
          return res.json({ received: true, status: 'account_error', error: accountError.message });
        }

        // Preparar datos de sesión para movimientos
        const sessionMovementData = {
          paysatUID,
          amount_cents: depositAmountCents,    // 🔹 AHORA usa userAmount (si es topup)
          amount: depositAmount,              // 🔹 y no directamente charge.amount
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

        console.log('📦 Procesando transacción completa...');

        const balanceTransactionId = feeData?.balanceTransactionId || null;
        const result = await processCompleteTransaction(
          sessionMovementData,
          charge.payment_intent,
          rechargeId,
          feeData,
          balanceTransactionId
        );

        if (!result.success) {
          const errorMessage = result.error || 'Error desconocido en procesamiento';
          console.error('❌ Error procesando transacción:', errorMessage);
          return res.status(500).json({ received: true, status: 'processing_error', error: errorMessage });
        }

        console.log('✅ Transacción procesada exitosamente');
        console.log('📊 Resultado del procesamiento:', {
          recharge: result.recharge?.documentId,
          fee: result.fee?.documentId,
          deposit: result.deposit?.documentId
        });

        const movementsSummary = {
          recharge_id: result.recharge?.documentId || null,
          fee_id: result.fee?.documentId || null,
          deposit_id: result.deposit?.documentId || null,
          success: result.success
        };

        await db.collection('Stripe_Payments_Sessions').doc(sessionId).update({
          movements_summary: movementsSummary,
          updated_at: new Date()
        });

        // Envío de email (igual que antes)
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
          }
        }

        console.log('✅ charge.succeeded procesado completamente');
        break;
      }

      default:
        console.log(`ℹ️ Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);

    res.status(500).json({ 
      received: true, 
      status: 'error',
      error: error.message 
    });
  }
});

export default router;
