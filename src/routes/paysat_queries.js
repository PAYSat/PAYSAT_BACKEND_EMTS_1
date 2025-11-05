import { Router } from 'express';
        import { db } from '../config/firebase.js';

const router = Router();

router.get('/product-funding-source-token', async (_req, res) => {
  const userId = _req.user.uid;

  try {
    // Obtener el primer documento de CardProducts
    const cardProductDoc = await db.collection('Marqeta_CardProducts').limit(1).get();
    let cardProductToken = "";
    
    if (!cardProductDoc.empty) {
      cardProductToken = cardProductDoc.docs[0].data().marqeta_card_product_data["token"] || "";
    }

    // Obtener el primer documento de FundingSources
    const fundingSourceDoc = await db.collection('Marqeta_FundingSources').limit(1).get();
    let fundingSourceToken = fundingSourceDoc.docs[0]?.data().marqeta_funding_source_data["token"] || "";
    
    if (!fundingSourceDoc.empty) {
      const fundingData = fundingSourceDoc.docs[0].data();
      fundingSourceToken = fundingData.marqeta_funding_source_data?.token || fundingData.token || "";
    }

    // console.log('Tokens obtenidos:', { cardProductToken, fundingSourceToken });

    res.json({ 
      "ok": true,
      "data": {
        "cardProductToken": cardProductToken, 
        "fundingSourceToken": fundingSourceToken
      },
    });

  } catch (error) {
    console.error('Error en la obtención de tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });


export default router;