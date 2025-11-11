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

router.get('/card-product-token', async (_req, res) => {
  const userId = _req.user.uid;

  try {
    // Obtener el primer documento de CardProducts
    const cardProductDoc = await db.collection('Marqeta_CardProducts').limit(1).get();
    let cardProductToken = "";
    
    if (!cardProductDoc.empty) {
      cardProductToken = cardProductDoc.docs[0].data().marqeta_card_product_data["token"] || "";
    }

    // console.log('Tokens obtenidos:', { cardProductToken, fundingSourceToken });

    res.json({ 
      "ok": true,
      "cardProductToken": cardProductToken
    });

  } catch (error) {
    console.error('Error en la obtención de tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/funding-source-token', async (_req, res) => {
  const userId = _req.user.uid;

  try {
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
      "fundingSourceToken": fundingSourceToken
    });

  } catch (error) {
    console.error('Error en la obtención de tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/marqeta-user-token/:paysatUID', async (_req, res) => {

  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 paysatUID original recibido:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
      // console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // console.log('🔍 Buscando usuario con paysatUID limpio:', paysatUID);

    // Obtener el documento del usuario Marqeta
    const marqetaUsersDoc = await db.collection('Marqeta_Users')
                                    .where('paysatUID', '==', paysatUID)  
                                    .limit(1)
                                    .get();
    
    // console.log('� Documentos encontrados:', marqetaUsersDoc.size);
    
    let marqetaUserToken = "";
    
    if (!marqetaUsersDoc.empty) {
      const userData = marqetaUsersDoc.docs[0].data();
      // console.log('📄 Estructura del documento:', JSON.stringify(userData, null, 2));
      
      // Intentar diferentes rutas para obtener el token
      marqetaUserToken = userData.marqetaUser?.token || 
                        userData.marqeta_user?.token || 
                        userData.token || 
                        "";
      
      // console.log('🎯 Token encontrado:', marqetaUserToken);
    } else {
      console.log('❌ No se encontró usuario con paysatUID:', paysatUID);
    }

    res.json({ 
      "ok": true,
      "data": {
        "token": marqetaUserToken,
        "found": !marqetaUsersDoc.empty,
        "paysatUID": paysatUID,
        "originalPaysatUID": _req.params.paysatUID
      },
    });

  } catch (error) {
    console.error('❌ Error en la obtención de token de usuario Marqeta:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});


// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });


export default router;