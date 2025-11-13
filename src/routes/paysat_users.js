import { Router } from 'express';
import { userProfile } from '../controllers/auth.controller.js';
import { db } from '../config/firebase.js';
import { createGPAOrder } from '../services/marqeta.js';
import { getMarqetaUserToken, getFundingSourceToken } from '../services/paysat_service.js';
import { v4 as uuidv4 } from 'uuid';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();

// Función helper para convertir a centavos
const toCents = (amount) => Math.round(parseFloat(parseFloat(amount).toFixed(2)) * 100);

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
      } else if (typeMovement === 'buy' || typeMovement === 'recharge_card') {
        saldoTotal -= monto; // Restar fees, compras y recargas de tarjeta
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

        ...(typeMovement === 'recharge_card' && {
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
      // Convertir las fechas, manejando tanto Date objects como Timestamps de Firestore
      let dateA, dateB;
      
      if (a.createdAt && typeof a.createdAt.toDate === 'function') {
        // Es un Timestamp de Firestore
        dateA = a.createdAt.toDate();
      } else if (a.createdAt) {
        // Es un Date object o string
        dateA = new Date(a.createdAt);
      } else {
        dateA = new Date(0); // Fecha mínima como fallback
      }
      
      if (b.createdAt && typeof b.createdAt.toDate === 'function') {
        // Es un Timestamp de Firestore
        dateB = b.createdAt.toDate();
      } else if (b.createdAt) {
        // Es un Date object o string
        dateB = new Date(b.createdAt);
      } else {
        dateB = new Date(0); // Fecha mínima como fallback
      }
      
      // Validar que las fechas sean válidas
      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      
      // Ordenamiento descendente: más recientes primero
      return timeB - timeA;
    });

    // Calcular balanceAfter para cada transacción (en orden cronológico inverso)
    let balanceAcumulado = 0.00;
    
    // Primero ordenamos cronológicamente (ascendente) para calcular balances
    const transaccionesOrdenCronologico = [...transacciones].reverse();
    
    // Calcular balance acumulativo
    transaccionesOrdenCronologico.forEach(tx => {
      const monto = tx.amount;
      const typeMovement = tx.typeMovement;
      
      // Aplicar el movimiento al balance
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        balanceAcumulado += monto;
      } else if (typeMovement === 'buy' || typeMovement === 'recharge_card') {
        balanceAcumulado -= monto;
      } else if (typeMovement === 'fee') {
        balanceAcumulado -= tx.totalFee || 0;
      }
      
      // Asignar balance después de la transacción
      tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
    });

    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));

    console.log(`✅ Procesados ${transacciones.length} movimientos, saldo total: $${saldoTotal}`);
    
    // Mostrar rango de fechas con manejo correcto de Timestamps
    if (transacciones.length > 0) {
      const fechaMasReciente = transacciones[0].createdAt;
      const fechaMasAntigua = transacciones[transacciones.length - 1].createdAt;
      
      let fechaRecienteStr, fechaAntiguaStr;
      
      // Convertir fechas para logging
      if (fechaMasReciente && typeof fechaMasReciente.toDate === 'function') {
        fechaRecienteStr = fechaMasReciente.toDate().toLocaleString();
      } else {
        fechaRecienteStr = new Date(fechaMasReciente).toLocaleString();
      }
      
      if (fechaMasAntigua && typeof fechaMasAntigua.toDate === 'function') {
        fechaAntiguaStr = fechaMasAntigua.toDate().toLocaleString();
      } else {
        fechaAntiguaStr = new Date(fechaMasAntigua).toLocaleString();
      }
      
      console.log(`📅 Rango de fechas: desde ${fechaAntiguaStr} hasta ${fechaRecienteStr}`);
      console.log(`💰 Balance inicial: $0.00, Balance final: $${saldoTotal}`);
    } else {
      console.log('📅 Rango de fechas: sin movimientos');
    }

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

    console.log('📊 Movimientos encontrados:', movementsSnapshot);

    movementsSnapshot.forEach(doc => {
      const data = doc.data();
      const typeMovement = data.typeMovement;
      const monto = parseFloat(data.amount) || 0.00;
      
      // Calcular saldo según el tipo de movimiento
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        saldoTotal += monto; // Sumar depósitos y recargas
      } else if (typeMovement === 'buy'|| typeMovement === 'recharge_card') {
        saldoTotal -= monto; // Restar fees, compras y recargas de tarjeta
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
      // Convertir las fechas, manejando tanto Date objects como Timestamps de Firestore
      let dateA, dateB;
      
      if (a.createdAt && typeof a.createdAt.toDate === 'function') {
        // Es un Timestamp de Firestore
        dateA = a.createdAt.toDate();
      } else if (a.createdAt) {
        // Es un Date object o string
        dateA = new Date(a.createdAt);
      } else {
        dateA = new Date(0); // Fecha mínima como fallback
      }
      
      if (b.createdAt && typeof b.createdAt.toDate === 'function') {
        // Es un Timestamp de Firestore
        dateB = b.createdAt.toDate();
      } else if (b.createdAt) {
        // Es un Date object o string
        dateB = new Date(b.createdAt);
      } else {
        dateB = new Date(0); // Fecha mínima como fallback
      }
      
      // Validar que las fechas sean válidas
      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      
      // Ordenamiento descendente: más recientes primero
      return timeB - timeA;
    });

    // Calcular balanceAfter para cada transacción de tarjeta (en orden cronológico inverso)
    let balanceAcumulado = 0.00;
    
    // Primero ordenamos cronológicamente (ascendente) para calcular balances
    const transaccionesOrdenCronologico = [...transacciones].reverse();
    
    // Calcular balance acumulativo para transacciones de tarjeta
    transaccionesOrdenCronologico.forEach(tx => {
      const monto = tx.amount;
      const typeMovement = tx.typeMovement;
      
      // Aplicar el movimiento al balance de la tarjeta
      if (typeMovement === 'deposit' || typeMovement === 'recharge') {
        balanceAcumulado += monto;
      } else if (typeMovement === 'buy') {
        balanceAcumulado -= monto;
      } else if (typeMovement === 'fee') {
        balanceAcumulado -= tx.totalFee || 0;
      }
      
      // Asignar balance después de la transacción
      tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
    });

    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));

    console.log(`✅ Procesados ${transacciones.length} movimientos de tarjeta, saldo total: $${saldoTotal}`);
    
    // Mostrar rango de fechas con manejo correcto de Timestamps
    if (transacciones.length > 0) {
      const fechaMasReciente = transacciones[0].createdAt;
      const fechaMasAntigua = transacciones[transacciones.length - 1].createdAt;
      
      let fechaRecienteStr, fechaAntiguaStr;
      
      // Convertir fechas para logging
      if (fechaMasReciente && typeof fechaMasReciente.toDate === 'function') {
        fechaRecienteStr = fechaMasReciente.toDate().toLocaleString();
      } else {
        fechaRecienteStr = new Date(fechaMasReciente).toLocaleString();
      }
      
      if (fechaMasAntigua && typeof fechaMasAntigua.toDate === 'function') {
        fechaAntiguaStr = fechaMasAntigua.toDate().toLocaleString();
      } else {
        fechaAntiguaStr = new Date(fechaMasAntigua).toLocaleString();
      }
      
      console.log(`📅 Rango de fechas: desde ${fechaAntiguaStr} hasta ${fechaRecienteStr}`);
      console.log(`💳 Balance inicial de tarjeta: $0.00, Balance final: $${saldoTotal}`);
    } else {
      console.log('📅 Rango de fechas: sin movimientos');
    }

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

router.post('/cards/recharge', async (req, res) => {
  const { paysatUID, amount, currency_code } = req.body;

  try {
    console.log('� Iniciando recarga de tarjeta virtual para:', paysatUID);
    
    // Validaciones básicas
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'amount debe ser mayor a 0' 
      });
    }

    if (!currency_code) {
      return res.status(400).json({ 
        ok: false, 
        error: 'currency_code es requerido' 
      });
    }

    // Obtener información del usuario para email y número de cuenta
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Usuario no encontrado' 
      });
    }
    
    const userData = userDoc.data();
    const userEmail = userData.correo || 'email@not.found';
    const userAccountNumber = userData.numeroCuentaPAYSAT || 'N/A';

    // Obtener tokens necesarios de Marqeta
    console.log('📝 Obteniendo tokens de Marqeta...');
    const marqetaUserToken = await getMarqetaUserToken(paysatUID);
    const fundingSourceToken = await getFundingSourceToken();

    console.log('✅ Tokens obtenidos:', {
      marqetaUserToken: marqetaUserToken,
      fundingSourceToken: fundingSourceToken
    });

    // Validar que los tokens no sean null o undefined
    if (!marqetaUserToken) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No se pudo obtener el token de usuario de Marqeta para este paysatUID' 
      });
    }

    if (!fundingSourceToken) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No se pudo obtener el token de funding source de Marqeta' 
      });
    }

    // Preparar amount con 2 decimales
    const amountParsed = parseFloat(parseFloat(amount).toFixed(2));

    // Crear GPA Order en Marqeta
    console.log('💰 Creando GPA Order en Marqeta...');
    console.log('🔍 Parámetros para GPA Order:', {
      user_token: marqetaUserToken,
      funding_source_token: fundingSourceToken,
      amount: amountParsed,
      currency_code: currency_code?.toUpperCase() || 'USD'
    });
    
    const rechargeResult = await createGPAOrder({
      user_token: marqetaUserToken,
      funding_source_token: fundingSourceToken,
      amount: amountParsed,
      currency_code: currency_code?.toUpperCase() || 'USD'
    });

    console.log('✅ GPA Order creado exitosamente:', rechargeResult.response.token);

    const amountCents = toCents(amountParsed);
    const currentDate = new Date();

    // 1. Guardar en Marqeta_GPA_Orders
    console.log('💾 Guardando GPA Order en Firebase...');
    await db.collection('Marqeta_GPA_Orders').doc(rechargeResult.response.token).set({
      gpaOrder: rechargeResult,
      createdAt: currentDate,
      from: "RECHARGE_CARD_FOR_MARQETA",
      paysatUID: paysatUID,
      amount: amountParsed,
      amount_cents: amountCents
    });

    // 2. Crear movimiento en PaySat_Card_Movements
    const cardMovementId = `recharge_card_${uuidv4()}`;
    console.log('📊 Creando movimiento en PaySat_Card_Movements:', cardMovementId);
    
    await db.collection('PaySat_Card_Movements').doc(cardMovementId).set({
      typeMovement: "recharge",
      amount: amountParsed,
      amount_cents: amountCents,
      currency: currency_code?.toUpperCase() || 'USD',
      paysatUID: paysatUID,
      email: userEmail,
      numeroCuentaPAYSAT: userAccountNumber,
      from: rechargeResult.response.token,
      description: "RECHARGE_CARD_FOR_MARQETA",
      createdAt: currentDate
    });

    // 3. Crear movimiento en PaySat_Account_Movements
    const accountMovementId = `recharge_card_${uuidv4()}`;
    console.log('📊 Creando movimiento en PaySat_Account_Movements:', accountMovementId);
    
    await db.collection('PaySat_Account_Movements').doc(accountMovementId).set({
      typeMovement: "recharge_card",
      amount: amountParsed,
      amount_cents: amountCents,
      currency: currency_code?.toUpperCase() || 'USD',
      paysatUID: paysatUID,
      email: userEmail,
      numeroCuentaPAYSAT: userAccountNumber,
      from: rechargeResult.response.token,
      description: "RECHARGE_CARD_FOR_MARQETA",
      createdAt: currentDate
    });

    console.log('✅ Recarga de tarjeta completada exitosamente');

    res.json({
      ok: true,
      data: {
        gpaOrderToken: rechargeResult.response.token,
        amount: amountParsed,
        currency: currency_code?.toUpperCase() || 'USD',
        cardMovementId: cardMovementId,
        accountMovementId: accountMovementId,
        status: rechargeResult.response.state || 'completed'
      },
      message: 'Recarga de tarjeta virtual completada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en recarga de tarjeta:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

export default router;