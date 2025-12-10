// src/routes/admin_cardholders.js
import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

const router = Router();

/**
 * GET /api/admin/cardholders/:paysatUID
 * Ver información del cardholder de un usuario
 */
router.get('/:paysatUID', async (req, res) => {
  try {
    const { paysatUID } = req.params;

    const cardHolderSnap = await db.collection('Stripe_CardHolders')
      .where('paysatUID', '==', paysatUID)
      .limit(1)
      .get();

    if (cardHolderSnap.empty) {
      return res.json({ ok: true, message: 'No tiene cardholder', cardholder: null });
    }

    const cardHolderDoc = cardHolderSnap.docs[0];
    const cardholderId = cardHolderDoc.id;

    // Obtener datos actualizados de Stripe
    const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);

    return res.json({
      ok: true,
      cardholder: {
        id: cardholder.id,
        name: cardholder.name,
        email: cardholder.email,
        status: cardholder.status,
        requirements: cardholder.requirements,
        metadata: cardholder.metadata,
      },
    });
  } catch (err) {
    console.error('❌ Error obteniendo cardholder:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/admin/cardholders/:paysatUID
 * Eliminar cardholder problemático para que se cree uno nuevo
 */
router.delete('/:paysatUID', async (req, res) => {
  try {
    const { paysatUID } = req.params;

    const cardHolderSnap = await db.collection('Stripe_CardHolders')
      .where('paysatUID', '==', paysatUID)
      .limit(1)
      .get();

    if (cardHolderSnap.empty) {
      return res.json({ ok: true, message: 'No tiene cardholder para eliminar' });
    }

    const cardHolderDoc = cardHolderSnap.docs[0];
    const cardholderId = cardHolderDoc.id;

    // Primero, eliminar todas las tarjetas del cardholder
    const cardsSnap = await db.collection('Stripe_Issuing_Cards')
      .where('paysatUID', '==', paysatUID)
      .get();

    for (const cardDoc of cardsSnap.docs) {
      const cardId = cardDoc.id;
      console.log('🗑️ Cancelando tarjeta:', cardId);
      
      try {
        await stripe.issuing.cards.update(cardId, { status: 'canceled' });
      } catch (err) {
        console.log('⚠️ Error cancelando tarjeta:', err.message);
      }
      
      await cardDoc.ref.delete();
    }

    // Luego, eliminar el cardholder de Firestore
    await cardHolderDoc.ref.delete();
    console.log('✅ Cardholder eliminado de Firestore:', cardholderId);

    return res.json({
      ok: true,
      message: 'Cardholder y tarjetas eliminados. Ahora puedes crear una nueva tarjeta.',
      cardholderId,
    });
  } catch (err) {
    console.error('❌ Error eliminando cardholder:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
