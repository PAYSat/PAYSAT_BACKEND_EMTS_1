import { Router } from 'express';
import { db } from '../config/firebase.js';

const router = Router();

/**
 * Obtiene solo el Card Product Token
 */
router.get('/card-product-token', async (_req, res) => {
  try {
    let cardProductToken = "";
    
    const cardProductDoc = await db.collection('Stripe_CardProducts').limit(1).get();
    if (!cardProductDoc.empty) {
      const cardProductData = cardProductDoc.docs[0].data();
      cardProductToken = cardProductData.token || cardProductData.card_product_token || cardProductDoc.docs[0].id || "";
    }

    res.json({ 
      ok: true,
      cardProductToken: cardProductToken
    });

  } catch (error) {
    console.error('❌ Error obteniendo card product token:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * Obtiene solo el Funding Source Token
 */
router.get('/funding-source-token', async (_req, res) => {
  try {
    let fundingSourceToken = "";
    
    const fundingSourceDoc = await db.collection('Stripe_FundingSources').limit(1).get();
    if (!fundingSourceDoc.empty) {
      const fundingData = fundingSourceDoc.docs[0].data();
      fundingSourceToken = fundingData.token || fundingData.funding_source_token || fundingSourceDoc.docs[0].id || "";
    }

    res.json({ 
      ok: true,
      fundingSourceToken: fundingSourceToken
    });

  } catch (error) {
    console.error('❌ Error obteniendo funding source token:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;
