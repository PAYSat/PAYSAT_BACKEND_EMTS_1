import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

const router = Router();

/**
 * POST /api/issuing/ephemeral-keys
 * BODY: { card_id: string, nonce: string }
 */
router.post('/', async (req, res) => {
  try {
    const { card_id, nonce } = req.body;

    if (!card_id || !nonce) {
      return res.status(400).json({ error: 'card_id y nonce son requeridos' });
    }

    // ⚠️ Seguridad: validar que la tarjeta pertenece al usuario autenticado
    const user = req.user; // viene del authFirebaseRequired
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const cardsSnapshot = await db
      .collection('PaySat_Cards')
      .where('paysatUID', '==', user.uid)
      .where('card.id', '==', card_id)
      .limit(1)
      .get();

    if (cardsSnapshot.empty) {
      return res.status(403).json({ error: 'Forbidden: la tarjeta no pertenece al usuario' });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      {
        nonce,
        issuing_card: card_id,
      },
      {
        apiVersion: process.env.STRIPE_API_VERSION,
      },
    );

    res.json({ ephemeralKeySecret: ephemeralKey.secret });
  } catch (err) {
    console.error('Error creando ephemeral key:', err);
    res.status(500).json({ error: 'Error creando ephemeral key' });
  }
});

export default router;
