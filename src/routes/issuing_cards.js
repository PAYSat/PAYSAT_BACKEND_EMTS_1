import { Router } from 'express';
import { db } from '../config/firebase.js';
import { createVirtualCardForUser, CardholderRequirementsError } from '../services/stripeIssuingService.js';
import { createCardBuyMovement, createCardDepositMovement } from '../services/movements_service.js';
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
    const { paysatUID, cardCost, currency } = req.body;

    console.log('📝 Request body:', { paysatUID, cardCost, currency });

    if (!paysatUID) {
      console.log('❌ Falta paysatUID');
      return res.status(400).json({ ok: false, error: 'paysatUID es requerido' });
    }

    if (!currency) {
      console.log('❌ Falta currency');
      return res.status(400).json({ ok: false, error: 'currency es requerido' });
    }

    const costParsed = parseFloat(parseFloat(cardCost || 0).toFixed(2));
    if (isNaN(costParsed) || costParsed < 0) {
      console.log('❌ cardCost inválido:', cardCost, 'parsed:', costParsed);
      return res.status(400).json({ ok: false, error: 'cardCost inválido o negativo' });
    }

    console.log('✅ Validaciones pasadas, buscando usuario:', paysatUID);

    // Datos de usuario desde PaySat_Users
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    const userData = userDoc.data();

    const userEmail = userData.email || 'email@not.found';
    const userAccountNumber = userData.PAYSATAccountNumber || 'N/A';
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '0.0.0.0';
    const termsAcceptance = {
      ip: clientIp,
      date: Math.floor(Date.now() / 1000),
    };

    // 1) Crear tarjeta virtual en Stripe Issuing
    const card = await createVirtualCardForUser(paysatUID, currency, { termsAcceptance });

    const amountCents = toCents(costParsed);
    const now = new Date();

    // 2.1 Movimiento: compra de tarjeta virtual (sale de la cuenta del usuario)
    const buyResult = await createCardBuyMovement(paysatUID, {
      amount: costParsed,
      amount_cents: amountCents,
      currency: currency.toUpperCase(),
      email: userEmail,
      PAYSATAccountNumber: userAccountNumber,
      card_id: card.id,
    });

    if (!buyResult.success) {
      console.error('❌ Error creando movimiento de compra:', buyResult.error);
      return res.status(500).json({ 
        ok: false, 
        error: 'Error creando movimiento de compra',
        details: buyResult.error 
      });
    }

    // 2.2 Movimiento: depósito a la "cuenta PAYSAT" por el mismo valor (contable)
    const depositResult = await createCardDepositMovement({
      amount: costParsed,
      amount_cents: amountCents,
      currency: currency.toUpperCase(),
      card_id: card.id,
    }, paysatUID);

    if (!depositResult.success) {
      console.error('❌ Error creando movimiento de depósito:', depositResult.error);
      return res.status(500).json({ 
        ok: false, 
        error: 'Error creando movimiento de depósito',
        details: depositResult.error 
      });
    }

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

      const { emailService } = await import('../services/send_email_service.js');
      await emailService.sendCardActivationEmail({
        email: userEmail,
        userName: cardData.empty ? '' : cardData.docs[0].data().stripeCard["cardholder"]["name"] || '',        
        amount: costParsed,
        currency: currency.toUpperCase(),
        PAYSATAccountNumber: userAccountNumber,
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
