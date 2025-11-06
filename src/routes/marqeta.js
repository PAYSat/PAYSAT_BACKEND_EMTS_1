import { Router } from 'express';
import { marqeta } from '../config/marqeta.js';
import { db } from '../config/firebase.js';
import * as simulations from '../services/simulations.js';

const router = Router();

/**
 * Crea un usuario en Marqeta y lo guarda en Firebase.
 */
router.post('/users/create', async (req, res) => {
  try {
    const paysatUID = req.body.paysatUID;
    
    // Validar que paysatUID esté presente
    if (!paysatUID) {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido' 
      });
    }

    // Verificar si ya existe un usuario con el mismo paysatUID
    const existingUserQuery = await db.collection('Marqeta_Users')
      .where('paysatUID', '==', paysatUID)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      return res.status(409).json({ 
        ok: false, 
        error: 'Ya existe un usuario con este paysatUID',
        existingUser: existingUserQuery.docs[0].data() 
      });
    }

    // Si no existe, proceder con la creación
    const payload = {
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      email: `paysat.${req.body.email}`,
      active: true
    };

    console.log(payload)
        
    const { data } = await marqeta.post('/users', payload);
    
    await db.collection('Marqeta_Users').doc(data.token).set({ 
      marqetaUser: data, 
      paysatUID, 
      createdAt: new Date() 
    });
    
    res.json({ ok: true, user: data });
  } catch (e) {
    if (e.response && e.response.status === 409) {
      return res.status(409).json({ 
        ok: false, 
        error: 'Usuario ya existe en Marqeta', 
      });
    }
    // Puede ser que el correo esté repetido en Marqeta
  
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });

  }
});

/**
 * CARD PRODUCTO TRAJETA FISICA
 * Crea un Card Products en Marqeta y lo guarda en Firebase.
 */
router.post('/cardproducts/physical', async (req, res) => {
  try {
    const payload = {
      name: "Demo Product - Physical",
      start_date: "2025-01-01",
      config: {
        card_life_cycle: {
          activate_upon_issue: req.body.activate_upon_issue || true
        },
        poi: {
          atm: req.body.atm || true,
          ecommerce: req.body.ecommerce || true,
          other: {
            allow: req.body.allow || true,
            card_presence_required: req.body.card_presence_required || false,
            cardholder_presence_required: req.body.cardholder_presence_required || false
          }
        }
      }
    };
    const { data } = await marqeta.post('/cardproducts', payload);
    await db.collection('Marqeta_CardProducts').doc(data.token).set({ marqeta_card_product_data: data, createdAt: new Date() });
    res.json({ ok: true, cardProduct: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

/**
 * CARD PRODUCTO TRAJETA VIRTUAL
 * Crea un Card Products en Marqeta y lo guarda en Firebase.
 */
router.post('/cardproducts/virtual', async (req, res) => {
  const fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // console.log('Fecha actual:', fecha);
  try {
    const payload = {
      name: "Demo Product - Virtual",
      start_date: fecha.split(' ')[0], // Formato YYYY-MM-DD
      config: {
        card_life_cycle: {
          activate_upon_issue: req.body.activate_upon_issue || true
        },
        poi: {
          atm: req.body.atm || false,
          ecommerce: req.body.ecommerce || true,
          other: {
            allow: req.body.allow || true,
            card_presence_required: req.body.card_presence_required || false,
            cardholder_presence_required: req.body.cardholder_presence_required || false
          }
        },
        fulfillment: {
          payment_instrument: req.body.payment_instrument || "VIRTUAL_PAN"
        },
      }
    };

    const { data } = await marqeta.post('/cardproducts', payload);
    await db.collection('Marqeta_CardProducts').doc(data.token).set({ marqeta_card_product_data: data, createdAt: fecha });
    res.json({ ok: true, cardProduct: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

/**
 * Emite una tarjeta virtual para el usuario.
 */
router.post('/cards/virtual', async (req, res) => {
  try {
    const payload = {
      "user_token": req.body.user_token,
      "card_product_token": req.body.card_product_token,
      "expedite": req.body.expedite || false
    };

    const { data } = await marqeta.post('/cards', payload);
    // OJO: no devolvemos PAN ni CVV por PCI; solo token/last_fourouter.
    await db.collection('Marqeta_Cards').doc(data.token).set({ card_data: data, createdAt: new Date() });

    res.json({
      ok: true,
      card_token:
      data.token,
      last_four: data.last_four,
      state: data.state
    });

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message
    });
  }
});

/**
 * Emite una tarjeta física para el usuario.
 */
router.post('/cards/physical', async (req, res) => {
  try {
    const payload = {
      "user_token": req.body.user_token,
      "card_product_token": req.body.card_product_token,
      "expedite": req.body.expedite || false,
      "fulfillment": {
        "shipping": {
          "recipient_address": {
            "first_name": req.body.first_name || "Edgar",
            "last_name": req.body.last_name || "Tapia",
            "address1": req.body.address1 || "Calle 123",
            "city": req.body.city || "Forest Hills",
            "state": req.body.state || "NY",
            "postal_code": req.body.postal_code || "11375",
            "country": req.body.country || "US"
          }
        }
      }
    }

    const { data } = await marqeta.post('/cards', payload);
    // OJO: no devolvemos PAN ni CVV por PCI; solo token/last_fourouter.
    await db.collection('Marqeta_Cards').doc(data.token).set({ card: data, createdAt: new Date() });

    res.json({
      ok: true,
      card_token: data.token,
      last_four: data.last_four,
      state: data.state
    });

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message
    });
  }
});

/**
 * Crear un funding source.
 */
router.post('/fundingsources/programgateway', async (req, res) => {
  try {
    const payload = {
      name: req.body.name || "Demo Funding Source",
      active: true,
      url: req.body.url || "https://webhook.site/tu-uuid",
      basic_auth_username: req.body.basic_auth_username || "sandbox_jit_user",
      basic_auth_password: req.body.basic_auth_password || "Abc12345_superSecureKey!!2025_demo"
    };

    const { data } = await marqeta.post('/fundingsources/programgateway', payload);
    await db.collection('Marqeta_FundingSources').doc(data.token).set({ marqeta_funding_source_data: data, createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ') });

    res.json({
      ok: true,
      pgfs_token: data.token
    });

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message
    });
  }
});

/**
 * Crear un GPA orderouter.
 */
router.post('/gpaorders', async (req, res) => {
  try {
    const payload = {
      user_token: req.body.user_token,
      amount: req.body.amount || 150.00,
      currency_code: req.body.currency || "USD",
      funding_source_token: req.body.funding_source_token
    };

    const { data } = await marqeta.post('/gpaorders', payload);
    
    // ✅ CORREGIDO: Cambiar 'card' por 'gpaOrder' y guardar la respuesta completa
    await db.collection('Marqeta_GPA_Orders').doc(data.token).set({ 
      gpaOrder: data,  // ← Era 'card: data'
      createdAt: new Date() 
    });

    // ✅ MEJORADO: Devolver la respuesta completa de Marqeta
    res.json({
      ok: true,
      gpaOrder: data  // ← Era solo campos básicos
    });

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message
    });
  }
});

/**
 * Simula una compra (purchase) en sandbox para activar flujo JIT+webhooks.
 * Usa Simulations 2.0 si está disponible; si no, fallback legacy.
 */
router.post('/authorization', async (req, res) => {
  try {
    const payload = {
      amount: req.body.amount || 5.00,
      currency_code: req.body.currency_code || "USD",
      card_token: req.body.card_token,
      card_acceptor: {
        mid: req.body.mid || "TESTMID001",
        mcc: req.body.mcc || "5732",
        name: req.body.name || "Demo Electronics",
        city: req.body.city || "Forest Hills",
        country_code: req.body.country_code || "US"
      },
      network: req.body.network || "VISA",
    };

    const { data } = await marqeta.post('/simulations/cardtransactions/authorization', payload);
    await db.collection('Marqeta_TransactionsCardAuthorization').doc(data.transaction.token).set({ card: data, createdAt: new Date() });
    res.json({
      ok: true,
      transaction_token: data.transaction.token,
      state: data.transaction.state,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

router.post('/authorization/clearing', async (req, res) => {
  try {
    const payload = {
      "preceding_related_transaction_token": req.body.authorization_transaction_token,
      "amount": req.body.amount
    };

    const { data } = await marqeta.post('/simulations/cardtransactions/authorization.clearing', payload);
    await db.collection('Marqeta_TransactionsCardClearing')
            .doc(data.transaction.token)
            .set({ card: data, createdAt: new Date() });

    res.json({
      ok: true,
      transaction_token: data.transaction.token,
      state: data.transaction.state,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// Reversión de una autorización no clarificada (No Clearing yet) (authorization reversal)
router.post('/authorization/reversal', async (req, res) => {
  try {
    const payload = {
      "preceding_related_transaction_token": req.body.authorization_transaction_token,
      "amount": req.body.amount
    };

    const { data } = await marqeta.post('/simulations/cardtransactions/authorization.reversal', payload);
    await db.collection('Marqeta_TransactionsCardReversal')
            .doc(data.transaction.token)
            .set({ card: data, createdAt: new Date() });
            
    res.json({
      ok: true,
      transaction_token: data.transaction.token,
      state: data.transaction.state,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// Reembolso de una compra ya clarificada (Clearing done) (authorization refund)
router.post('/authorization/refund', async (req, res) => {
  try {
    const payload = {
      card_token: req.body.card_token,
      amount: req.body.amount || 0.00,
      card_acceptor: {
        mid: req.body.mid,
      },
      network: req.body.network
    };

    // Validar campos requeridos
    if (!payload.card_token) {
      return res.status(400).json({
        ok: false,
        error: 'card_token es requerido'
      });
    }

    console.log('💸 Procesando refund con payload:', payload);

    const { data } = await marqeta.post('/simulations/cardtransactions/refund', payload);
    
    // Guardar el refund en Firebase
    await db.collection('Marqeta_TransactionsCardRefund').doc(data.transaction.token).set({ 
      refund: data, 
      createdAt: new Date() 
    });

    res.json({
      ok: true,
      transaction_token: data.transaction.token,
      state: data.transaction.state,
      amount: data.transaction.amount,
      refund_data: data
    });

  } catch (e) {
    console.error('❌ Error procesando refund:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.response?.data || e.message 
    });
  }
});


/**
 * Consulta el balance de un usuario en Marqeta.
 * Soporta parámetro ?simplified=true para respuesta simplificada
 */
router.get('/balances/:user_token', async (req, res) => {
  try {
    const { user_token } = req.params;
    const { simplified } = req.query;
    
    if (!user_token) {
      return res.status(400).json({ 
        ok: false, 
        error: 'user_token es requerido en la URL' 
      });
    }

    const { data } = await marqeta.get(`/balances/${user_token}`);
    
    // Opcional: Guardar consulta de balance en Firebase para auditoría
    await db.collection('Marqeta_Balance_Queries').add({
      user_token: user_token,
      balance_data: data,
      simplified: simplified === 'true',
      queried_at: new Date()
    });

    // Si se solicita versión simplificada
    if (simplified === 'true') {
      const gpa = data.gpa || {};
      return res.json({
        ok: true,
        user_token: user_token,
        available_balance: gpa.available_balance || 0.00,
        ledger_balance: gpa.ledger_balance || 0.00,
        currency_code: gpa.currency_code || 'USD',
        credit_balance: gpa.credit_balance || 0.00,
        pending_credits: gpa.pending_credits || 0.00
      });
    }

    // Respuesta completa por defecto
    res.json({
      ok: true,
      user_token: user_token,
      balance: data
    });

  } catch (e) {
    res.status(500).json({ 
      ok: false, 
      error: e?.response?.data || e.message 
    });
  }
});

/**
 * Lista todos los Card Products desde Firebase
 * Recupera solo los tokens de la colección Marqeta_CardProducts sin filtros
 */
router.get('/cardproducts/list', async (req, res) => {
  try {
    console.log('📋 Obteniendo tokens de Card Products desde Firebase...');
    
    const cardProductsSnapshot = await db.collection('Marqeta_CardProducts').get();
    
    if (cardProductsSnapshot.empty) {
      return res.json({
        ok: true,
        count: 0,
        tokens: [],
        message: 'No se encontraron Card Products en Firebase'
      });
    }

    const tokens = [];
    cardProductsSnapshot.forEach(doc => {
      const data = doc.data();
      const token = data.marqetaCardProduct?.token;
      
      if (token) {
        tokens.push(token);
      }
    });

    console.log(`✅ Se encontraron ${tokens.length} tokens de Card Products`);

    res.json({
      ok: true,
      count: tokens.length,
      tokens: tokens
    });

  } catch (e) {
    console.error('❌ Error obteniendo tokens de Card Products:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error interno del servidor'
    });
  }
});

/**
 * Calcula el balance basado en las órdenes GPA del usuario
 * Filtra por gpaOrder.user_token y suma/resta según el estado
 * Desde Firebase, no desde Marqeta directamente
 */
router.get('/gpaorders/balance/:user_token/paysat', async (req, res) => {
  try {
    const { user_token } = req.params;
    
    if (!user_token) {
      return res.status(400).json({ 
        ok: false, 
        error: 'user_token es requerido en la URL' 
      });
    }

    console.log('💰 Calculando balance para user_token:', user_token);

    // Obtener todas las órdenes GPA del usuario
    const gpaOrdersSnapshot = await db.collection('Marqeta_GPA_Orders')
      .where('gpaOrderouter.user_token', '==', user_token)
      .get();

    if (gpaOrdersSnapshot.empty) {
      return res.json({
        ok: true,
        user_token: user_token,
        balance: 0.00,
        total_orders: 0,
        completed_orders: 0,
        other_orders: 0,
        orders: [],
        message: 'No se encontraron órdenes GPA para este usuario'
      });
    }

    let balance = 0.00;
    let completedOrders = 0;
    let otherOrders = 0;
    const orders = [];

    gpaOrdersSnapshot.forEach(doc => {
      const data = doc.data();
      const gpaOrder = data.gpaOrder;
      
      if (gpaOrder && gpaOrderouter.amount) {
        const amount = parseFloat(gpaOrderouter.amount);
        const state = gpaOrderouter.state;
        
        if (state === 'COMPLETION') {
          // COMPLETION: se suma al balance
          balance += amount;
          completedOrders++;
        } else {
          // Cualquier otro estado: se resta del balance
          balance -= amount;
          otherOrders++;
        }

        orders.push({
          order_id: doc.id,
          token: gpaOrderouter.token,
          amount: amount,
          state: state,
          currency_code: gpaOrderouter.currency_code || 'USD',
          created_time: gpaOrderouter.created_time || data.createdAt,
          impact: state === 'COMPLETION' ? 'positive' : 'negative'
        });
      }
    });

    // Redondear balance a 2 decimales
    balance = parseFloat(balance.toFixed(2));

    console.log(`✅ Balance calculado: ${balance} para ${gpaOrdersSnapshot.size} órdenes`);

    res.json({
      ok: true,
      user_token: user_token,
      balance: balance,
      total_orders: gpaOrdersSnapshot.size,
      completed_orders: completedOrders,
      other_orders: otherOrders,
      orders: orders
    });

  } catch (e) {
    console.error('❌ Error calculando balance GPA:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error interno del servidor'
    });
  }
});


export default router;
