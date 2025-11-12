import { Router } from 'express';
import { userProfile } from '../controllers/auth.controller.js';
import { db } from '../config/firebase.js';
import { createGPAOrder } from '../services/marqeta.js';
import { getMarqetaUserToken, getFundingSourceToken } from '../services/paysat_service.js';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();

router.get('/userprofile', userProfile);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });

router.get('/account/transactions/history/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Obtener los movimientos del usuario desde PaySat_Account_Movements
    const movementsSnapshot = await db.collection('PaySat_Account_Movements')
      .where('paysatUID', '==', paysatUID)
      .get();

    console.log('📊 Movimientos encontrados:', movementsSnapshot.size);

    if (movementsSnapshot.empty) {
      return res.json({
        ok: true,
        saldo: 0.00,
        data: [],
        message: 'No se encontraron movimientos para este usuario'
      });
    }

    // Procesar los movimientos y calcular el saldo
    let saldoTotal = 0.00;
    const transacciones = [];

    movementsSnapshot.forEach(doc => {
      const data = doc.data();
      const typeMovement = data.typeMovement;
      const monto = parseFloat(data.amount) || 0.00;
      
      // Calcular saldo según el tipo de movimiento
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        saldoTotal += monto; // Sumar depósitos y recargas
      } else if (typeMovement === 'buy') {
        saldoTotal -= monto; // Restar fees y compras
      } else if (typeMovement === 'fee') {
        saldoTotal -= parseFloat(data.totalFee);        // Aquí puedes manejar otros tipos de movimientos si es necesario
      }

      transacciones.push({
        id: doc.id,
        typeMovement: typeMovement,
        amount: monto,
        amount_cents: data.amount_cents || Math.round(monto * 100),
        currency: data.currency || 'USD',
        
        // Campos específicos según el tipo de movimiento
        ...(typeMovement === 'recharge' && {
          payment_intent_id: data.payment_intent_id || null,
          recharge_id: data.recharge_id || null,
          status: data.status || null
        }),
        
        ...(typeMovement === 'fee' && {
          paysatFee: data.paysatFee || null,
          paysatFee_cents: data.paysatFee_cents || null,
          totalFee: data.totalFee || null,
          net: data.net || null,
          balanceTransactionId: data.balanceTransactionId || null
        }),
        
        ...(typeMovement === 'deposit' && {
          from: data.from || null,
          description: data.description || null,
          email: data.email || null
        }),

        ...(typeMovement === 'buy' && {
          from: data.from || null,
          description: data.description || null,
          email: data.email || null
        }),
        
        numeroCuentaPAYSAT: data.numeroCuentaPAYSAT || null,
        
        // Usar la fecha específica del movimiento (priorizar createdAt, luego updatedAt como fallback)
        createdAt: data.createdAt ? data.createdAt : (data.updatedAt || new Date()),
        
        // Incluir también updatedAt si existe para referencia
        ...(data.updatedAt && { updatedAt: data.updatedAt }),
        
        source: data.source || null
      });
    });

    // Ordenar transacciones por fecha y hora (más recientes primero - descendente)
    transacciones.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      
      // Validar que las fechas sean válidas
      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      
      // Ordenamiento descendente: más recientes primero
      return timeB - timeA;
    });

    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));

    console.log(`✅ Procesados ${transacciones.length} movimientos, saldo total: $${saldoTotal}`);
    console.log(`📅 Rango de fechas: ${transacciones.length > 0 ? 
      `desde ${new Date(transacciones[transacciones.length - 1].createdAt).toLocaleString()} hasta ${new Date(transacciones[0].createdAt).toLocaleString()}` : 
      'sin movimientos'}`);

    res.json({
      ok: true,
      saldo: saldoTotal,
      data: transacciones,
      summary: {
        total_transactions: transacciones.length,
        total_sessions_found: movementsSnapshot.size,
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener el historial de transacciones:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.get('/account/transactions/balance/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Obtener los movimientos del usuario desde PaySat_Account_Movements
    const movementsSnapshot = await db.collection('PaySat_Account_Movements')
      .where('paysatUID', '==', paysatUID)
      .get();

    console.log('📊 Movimientos encontrados:', movementsSnapshot.size);

    if (movementsSnapshot.empty) {
      return res.json({
        ok: true,
        data: [],
        message: 'No se encontraron movimientos para este usuario'
      });
    }

    // Procesar los movimientos y calcular el saldo
    let saldoTotal = 0.00;

    movementsSnapshot.forEach(doc => {
      const data = doc.data();
      const typeMovement = data.typeMovement;
      const monto = parseFloat(data.amount) || 0.00;
      
      // Calcular saldo según el tipo de movimiento
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        saldoTotal += monto; // Sumar depósitos y recargas
      } else if (typeMovement === 'buy') {
        saldoTotal -= monto; // Restar fees y compras
      } else if (typeMovement === 'fee') {
        saldoTotal -= parseFloat(data.totalFee);        // Aquí puedes manejar otros tipos de movimientos si es necesario
      }

    });


    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));
    console.log(`✅ Saldo total calculado: $${saldoTotal}`);
    res.json({
      ok: true,
      data: {
        saldo: saldoTotal
      }      
    });

  } catch (error) {
    console.error('❌ Error al obtener el saldo:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.get('/cards/transactions/history/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Obtener los movimientos del usuario desde PaySat_Card_Movements
    const cardMovementsSnapshot = await db.collection('PaySat_Card_Movements')
      .where('paysatUID', '==', paysatUID)
      .get();

    console.log('📊 Movimientos de tarjeta encontrados:', cardMovementsSnapshot.size);

    if (cardMovementsSnapshot.empty) {
      return res.json({
        ok: true,
        saldo: 0.00,
        data: [],
        message: 'No se encontraron movimientos de tarjeta para este usuario'
      });
    }

    // Procesar los movimientos y calcular el saldo
    let saldoTotal = 0.00;
    const transacciones = [];

    cardMovementsSnapshot.forEach(doc => {
      const data = doc.data();
      const typeMovement = data.typeMovement;
      const monto = parseFloat(data.amount) || 0.00;
      
      // Calcular saldo según el tipo de movimiento
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        saldoTotal += monto; // Sumar depósitos y recargas
      } else if (typeMovement === 'buy') {
        saldoTotal -= monto; // Restar fees y compras
      } else if (typeMovement === 'fee') {
        saldoTotal -= parseFloat(data.totalFee);        // Aquí puedes manejar otros tipos de movimientos si es necesario
      }

      transacciones.push({
        id: doc.id,
        typeMovement: typeMovement,
        amount: monto,
        amount_cents: data.amount_cents || Math.round(monto * 100),
        currency: data.currency || 'USD',
        
        // Campos específicos según el tipo de movimiento
        ...(typeMovement === 'recharge' && {
          payment_intent_id: data.payment_intent_id || null,
          recharge_id: data.recharge_id || null,
          status: data.status || null
        }),
        
        ...(typeMovement === 'fee' && {
          paysatFee: data.paysatFee || null,
          paysatFee_cents: data.paysatFee_cents || null,
          totalFee: data.totalFee || null,
          net: data.net || null,
          balanceTransactionId: data.balanceTransactionId || null
        }),
        
        ...(typeMovement === 'deposit' && {
          from: data.from || null,
          description: data.description || null,
          email: data.email || null
        }),

        ...(typeMovement === 'buy' && {
          from: data.from || null,
          description: data.description || null,
          email: data.email || null
        }),
        
        numeroCuentaPAYSAT: data.numeroCuentaPAYSAT || null,
        
        // Usar la fecha específica del movimiento (priorizar createdAt, luego updatedAt como fallback)
        createdAt: data.createdAt ? data.createdAt : (data.updatedAt || new Date()),
        
        // Incluir también updatedAt si existe para referencia
        ...(data.updatedAt && { updatedAt: data.updatedAt }),
        
        source: data.source || null
      });
    });

    // Ordenar transacciones por fecha y hora (más recientes primero - descendente)
    transacciones.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      
      // Validar que las fechas sean válidas
      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      
      // Ordenamiento descendente: más recientes primero
      return timeB - timeA;
    });

    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));

    console.log(`✅ Procesados ${transacciones.length} movimientos de tarjeta, saldo total: $${saldoTotal}`);
    console.log(`📅 Rango de fechas: ${transacciones.length > 0 ? 
      `desde ${new Date(transacciones[transacciones.length - 1].createdAt).toLocaleString()} hasta ${new Date(transacciones[0].createdAt).toLocaleString()}` : 
      'sin movimientos'}`);

    res.json({
      ok: true,
      saldo: saldoTotal,
      data: transacciones,
      summary: {
        total_transactions: transacciones.length,
        total_sessions_found: cardMovementsSnapshot.size,
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener el historial de transacciones de tarjeta:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.get('/cards/transactions/balance/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Obtener los movimientos del usuario desde PaySat_Account_Movements
    const movementsSnapshot = await db.collection('PaySat_Card_Movements')
      .where('paysatUID', '==', paysatUID)
      .get();

    console.log('📊 Movimientos encontrados:', movementsSnapshot.size);

    // if (movementsSnapshot.empty) {
    //   return res.json({
    //     ok: true,
    //     data: [],
    //     message: 'No se encontraron movimientos para este usuario'
    //   });
    // }

    // Procesar los movimientos y calcular el saldo
    let saldoTotal = 0.00;

    movementsSnapshot.forEach(doc => {
      const data = doc.data();
      const typeMovement = data.typeMovement;
      const monto = parseFloat(data.amount) || 0.00;
      
      // Calcular saldo según el tipo de movimiento
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        saldoTotal += monto; // Sumar depósitos y recargas
      } else if (typeMovement === 'buy') {
        saldoTotal -= monto; // Restar fees y compras
      } else if (typeMovement === 'fee') {
        saldoTotal -= parseFloat(data.totalFee);        // Aquí puedes manejar otros tipos de movimientos si es necesario
      }

    });

    
    const cardData = await db.collection('Marqeta_Cards')
      .where('paysatUID', '==', paysatUID)
      .get();


    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));
    console.log(`✅ Saldo total calculado: $${saldoTotal}`);
    res.json({
      ok: true,      
      data: {
        balance: saldoTotal,
        nameCard: cardData.empty ? '' : cardData.docs[0].data().nameCard || '',
        cardNumber: cardData.empty ? '' : cardData.docs[0].data().card_data["last_four"] || '',
      }      
    });

  } catch (error) {
    console.error('❌ Error al obtener el saldo:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.get('/cards/check/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Contar cuantas tarjetas virtuales del usuario desde Marqeta_Cards
    const cardsSnapshot = await db.collection('Marqeta_Cards')
      .where('paysatUID', '==', paysatUID)
      .count()
      .get();

    const cardCount = cardsSnapshot.data().count;
    console.log('📊 Tarjetas encontradas:', cardCount);

    res.json({
      ok: true,
      data: {
        cardCount: cardCount
      }      
    });

  } catch (error) {
    console.error('❌ Error al obtener el número de tarjetas:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.post('/cards/recharge', async (_req, res) => {
  let { paysatUID, amount, currency_code } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    const marqetaUserToken = await getMarqetaUserToken(paysatUID);
    const fundingSourceToken = await getFundingSourceToken();

    // Lógica para recargar la tarjeta usando Marqeta
    const rechargeResult = await createGPAOrder({
      userToken: marqetaUserToken,
      fundingSourceToken: fundingSourceToken,
      amount: amount,
      currency_code
    });

    // res.json({
    //   ok: true,
    //   data: rechargeResult
    // });

    

  } catch (error) {
    console.error('❌ Error al obtener el número de tarjetas:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;