// src/routes/issuing_ephemeral_keys.js
import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    console.log('🟣 [issuing_ephemeral_keys] BODY:', req.body);
    console.log('🟣 [issuing_ephemeral_keys] AUTH HEADER:', req.headers.authorization);

    const { card_id, nonce } = req.body;

    if (!card_id || !nonce) {
      console.log('🔴 Faltan card_id o nonce');
      return res.status(400).json({ error: 'card_id y nonce son requeridos' });
    }

    const user = req.user; // debe venir de authFirebaseRequired
    if (!user) {
      console.log('🔴 No hay req.user (no autorizado)');
      return res.status(401).json({ error: 'No autorizado' });
    }

    console.log('🟢 Usuario autenticado:', user.uid);

    const cardsSnapshot = await db
      .collection('PaySat_Cards')
      .where('paysatUID', '==', user.uid)
      .where('card.id', '==', card_id)
      .limit(1)
      .get();

    if (cardsSnapshot.empty) {
      console.log('🔴 Tarjeta no pertenece al usuario:', card_id);
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

    console.log('🟢 Ephemeral key creada OK');

    res.json({ ephemeralKeySecret: ephemeralKey.secret });
  } catch (err) {
    console.error('💥 Error creando ephemeral key:', err);
    res.status(500).json({ error: 'Error creando ephemeral key' });
  }
});

export default router;
