// src/webhooks/stripeIssuingAuthWebhook.js
import express from 'express';
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

const router = express.Router();

// Helper para actualizar simulaciones en Firebase
async function updateSimulation(authId, data) {
  try {
    const simQuery = await db.collection('Stripe_Simulations_Temp')
      .where('authorizationId', '==', authId)
      .limit(1)
      .get();
    
    if (!simQuery.empty) {
      const simDoc = simQuery.docs[0];
      await simDoc.ref.update(data);
      console.log('💾 Simulación actualizada:', simDoc.id);
    }
  } catch (err) {
    console.error('⚠️ Error actualizando simulación:', err.message);
  }
}

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.error('❌ Error verificando firma Issuing:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🔔 Issuing event: ${event.type}`);

    try {
      // Manejar tanto .request como .created (en test mode a veces llega .created)
      if (event.type === 'issuing_authorization.request' || event.type === 'issuing_authorization.created') {
        const auth = event.data.object;

        // auth.amount viene en CENTAVOS
        const amountCents = auth.amount;
        const amount = amountCents / 100;
        const currency = auth.currency;

        const cardholderId = auth.cardholder;
        const cardId = auth.card;
        console.log('💳 Auth request:', { authId: auth.id, cardId, cardholderId, amount, currency, status: auth.status });

        // Si ya está aprobada o rechazada, no hacer nada
        if (auth.status !== 'pending') {
          console.log(`ℹ️ Authorization ${auth.id} ya está en estado ${auth.status}, omitiendo`);
          return res.json({ received: true });
        }

        // 1. Mapear cardholder → usuario PAYSAT (por metadata)
        const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);
        console.log('👤 Cardholder data:', {
          id: cardholder.id,
          name: cardholder.name,
          email: cardholder.email,
          metadata: cardholder.metadata,
        });
        
        const paysatUID = cardholder.metadata?.paysatUID;

        if (!paysatUID) {
          console.log('⚠️ cardholder sin paysatUID, declinando');
          await stripe.issuing.authorizations.decline(auth.id, {
            metadata: { decline_reason: 'no_paysat_uid' },
          });
          
          // Actualizar simulación en Firebase si existe
          await updateSimulation(auth.id, {
            webhookProcessed: true,
            approved: false,
            declineReason: 'no_paysat_uid',
            processedAt: new Date().toISOString(),
          });
          
          return res.json({ received: true });
        }

        // 2. Leer saldo virtual del usuario en tu Firestore
        const userRef = db.collection('PaySat_Users').doc(paysatUID);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          console.log('⚠️ Usuario PAYSAT no encontrado, declinando. UID buscado:', paysatUID);
          await stripe.issuing.authorizations.decline(auth.id, {
            metadata: { decline_reason: 'user_not_found' },
          });
          
          // Actualizar simulación en Firebase si existe
          await updateSimulation(auth.id, {
            webhookProcessed: true,
            approved: false,
            declineReason: 'user_not_found',
            paysatUID: paysatUID,
            processedAt: new Date().toISOString(),
          });
          
          return res.json({ received: true });
        }

        const userData = userSnap.data();
        const currentBalance = parseFloat(userData.balance || 0);

        console.log(`🏦 Saldo PAYSAT actual de ${paysatUID}: ${currentBalance}`);

        // 3. Lógica: solo aprobar si el usuario tiene saldo suficiente
        if (currentBalance >= amount) {
          // Opcional: bloquear por MCC, país, etc. aquí.

          // 4. Apruebas la autorización (Stripe reserva fondos del balance de tu cuenta)
          await stripe.issuing.authorizations.approve(auth.id);
          console.log('✅ Autorización aprobada');

          // Actualizar simulación en Firebase si existe
          await updateSimulation(auth.id, {
            webhookProcessed: true,
            approved: true,
            paysatUID: paysatUID,
            userBalance: currentBalance,
            processedAt: new Date().toISOString(),
          });

          // 5. IMPORTANTE: NO restes saldo aquí todavía.
          // Lo ideal es restar cuando el authorization se "closes" / se captura.
        } else {
          console.log('❌ Saldo insuficiente, declinando. Saldo:', currentBalance, 'Monto:', amount);
          await stripe.issuing.authorizations.decline(auth.id, {
            metadata: { decline_reason: 'insufficient_funds' },
          });
          
          // Actualizar simulación en Firebase si existe
          await updateSimulation(auth.id, {
            webhookProcessed: true,
            approved: false,
            declineReason: 'insufficient_funds',
            paysatUID: paysatUID,
            userBalance: currentBalance,
            processedAt: new Date().toISOString(),
          });
        }

        return res.json({ received: true });
      }

      // Otros eventos Issuing que puedes manejar:
      // - issuing_authorization.updated
      // - issuing_transaction.created (ahí ya puedes ajustar saldo real del usuario)
      console.log(`ℹ️ Evento no manejado: ${event.type}`);
      return res.json({ received: true });
    } catch (err) {
      console.error('💥 Error procesando webhook Issuing:', err);
      return res.status(500).send('Webhook handler error');
    }
  },
);

export default router;
