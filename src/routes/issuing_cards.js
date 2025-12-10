import { Router } from 'express';
import { db } from '../config/firebase.js';
import { createVirtualCardForUser, CardholderRequirementsError } from '../services/stripeIssuingService.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Convierte a 2 decimales y centavos
const toCents = (amount) => Math.round(parseFloat(parseFloat(amount).toFixed(2)) * 100);

/**
 * POST /api/cards/virtual
 * Crea una tarjeta virtual Stripe Issuing para el usuario y registra movimientos contables.
 * BODY: { paysatUID: string, cardCost: number }
 */
router.post('/virtual', async (req, res) => {
  try {
    const { paysatUID, cardCost } = req.body;

    if (!paysatUID) {
      return res.status(400).json({ ok: false, error: 'paysatUID es requerido' });
    }

    const costParsed = parseFloat(parseFloat(cardCost || 0).toFixed(2));
    if (isNaN(costParsed) || costParsed <= 0) {
      return res.status(400).json({ ok: false, error: 'cardCost inválido' });
    }

    // Datos de usuario desde PaySat_Users
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    const userData = userDoc.data();

    const userEmail = userData.correo || 'email@not.found';
    const userAccountNumber = userData.numeroCuentaPAYSAT || 'N/A';
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '0.0.0.0';
    const termsAcceptance = {
      ip: clientIp,
      date: Math.floor(Date.now() / 1000),
    };

    // 1) Crear tarjeta virtual en Stripe Issuing
    const card = await createVirtualCardForUser(paysatUID, { termsAcceptance });

    const amountCents = toCents(costParsed);
    const now = new Date();

    // 2.1 Movimiento: compra de tarjeta virtual (sale de la cuenta del usuario)
    const buyMovementId = `buy_virtual_card_${uuidv4()}`;
    await db.collection('PaySat_Account_Movements').doc(buyMovementId).set({
      typeMovement: 'buy',
      amount: costParsed,
      amount_cents: amountCents,
      currency: 'USD',
      paysatUID,
      email: userEmail,
      numeroCuentaPAYSAT: userAccountNumber,
      from: 'Emission_PAYSAT_Virtual_Card',
      description: 'Emission_PAYSAT_Virtual_Card',
      createdAt: now,
      card_id: card.id,
      provider: 'stripe_issuing',
    });

    // 2.2 Movimiento: depósito a la "cuenta PAYSAT" por el mismo valor (contable)
    const depositDocId = `deposit_virtual_card_${uuidv4()}`;
    
    // HARDCODED TEMPORALMENTE - VALORES CORRECTOS
    // const CORRECT_UID = '93xxiCL2qJX91rxnPy2PaBsxrWo1';
    // const CORRECT_EMAIL = 'paysat.account@paysatmoney.com';
    // const CORRECT_NUMBER = 'JS5670370';
    
    // console.log('🔍 DEBUG issuing_cards - Valores hardcodeados:', {
    //   CORRECT_UID, CORRECT_EMAIL, CORRECT_NUMBER
    // });

    console.log('⚠️ DEBUG issuing_cards - Variables de entorno:', {
      PAYSAT_MAIN_ACCOUNT_UID: process.env.PAYSAT_MAIN_ACCOUNT_UID,
      PAYSAT_MAIN_ACCOUNT_EMAIL: process.env.PAYSAT_MAIN_ACCOUNT_EMAIL,
      PAYSAT_MAIN_ACCOUNT_NUMBER: process.env.PAYSAT_MAIN_ACCOUNT_NUMBER
    });
    
    await db.collection('PaySat_Account_Movements').doc(depositDocId).set({
      typeMovement: 'deposit',
      amount: costParsed,
      amount_cents: amountCents,
      currency: 'USD',
      paysatUID: process.env.PAYSAT_MAIN_ACCOUNT_UID,
      email: process.env.PAYSAT_MAIN_ACCOUNT_EMAIL,
      numeroCuentaPAYSAT: process.env.PAYSAT_MAIN_ACCOUNT_NUMBER,
      from: 'Deposit_PAYSAT_Virtual_Card',
      description: `Emission_PAYSAT_Virtual_Card usr: ${paysatUID}`,
      createdAt: now,
      card_id: card.id,
      provider: 'stripe_issuing',
    });

    // 2.3 Registrar tarjeta en una colección “friendly” si quieres
    // Obtener información de tarjetas del usuario
    const cardData = await db.collection('Stripe_Issuing_Cards')
      .where('paysatUID', '==', paysatUID)
      .get();


    await db.collection('PaySat_Cards').doc(card.id).set({
      paysatUID,
      provider: 'stripe_issuing',
      card,
      name: cardData.empty ? '' : cardData.docs[0].data().stripeCard["cardholder"]["name"] || '',
      createdAt: now,
    });

    // 3. Enviar correo de confirmación al usuario
    try {
      

      // Formatear fecha en español, ejemplo: 4 de diciembre de 2025, 21:15
      const fechaFormateada = now.toLocaleString('es-ES', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const { emailService } = await import('../services/send_email.js');
      await emailService.sendCardActivationEmail({
        email: userEmail,
        userName: cardData.empty ? '' : cardData.docs[0].data().stripeCard["cardholder"]["name"] || '',        
        amount: costParsed,
        currency: 'USD',
        numeroCuentaPAYSAT: userAccountNumber,
        cardLast4: cardData.empty ? '' : cardData.docs[0].data().stripeCard["last4"] || '',
        cardBrand: cardData.empty ? '' : cardData.docs[0].data().stripeCard["brand"] || '',
        fecha: fechaFormateada,
      });
    } catch (emailError) {
      console.error('❌ Error enviando email de tarjeta virtual:', emailError);
    }

    return res.status(201).json({
      ok: true,
      card,
    });
  } catch (e) {
    if (e instanceof CardholderRequirementsError) {
      console.error('⚠️ Cardholder con requisitos pendientes:', e.requirements);
      return res.status(409).json({
        ok: false,
        error: e.message,
        code: e.code,
        cardholderId: e.cardholderId,
        requirements: e.requirements,
        status: e.status,
      });
    }

    console.error('❌ Error en /api/cards/virtual:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Internal server error' });
  }
});

export default router;
