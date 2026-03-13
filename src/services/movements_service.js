import { admin, db } from '../config/firebase.js';
import { getUserAccountNumber } from './paysat_service.js';
import { v4 as uuidv4 } from 'uuid';
import { centsToAmount } from '../utils/cents_to_amount.js';import { recordRechargeEntry, recordFeeEntry, recordDepositEntry } from './ledger_service.js';
// Fee estándar de PaySat en centavos
const PAYSAT_FEE_CENTS = 100; // 1.00 USD
const PAYSAT_FEE_AMOUNT = "1.00";

/**
 * Agrega un movimiento al array de movimientos de un usuario y actualiza su balance
 * @param {string} paysatUID - El UID del usuario en PaySat
 * @param {object} movementData - Los datos del movimiento a agregar
 * @param {number} balanceChange - El cambio en el balance (positivo para depósitos, negativo para gastos)
 * @returns {Promise<object>} - Resultado de la operación
 */
async function addMovementToUser(paysatUID, movementData, balanceChange) {
  try {
    const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatUID);
    const userMovementsDoc = await userMovementsRef.get();
    
    // Agregar timestamp al movimiento
    const movementWithTimestamp = {
      ...movementData,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    if (!userMovementsDoc.exists) {
      // Si no existe el documento, crearlo con el primer movimiento
      const customerBalance = parseFloat(balanceChange.toFixed(2));
      const customerEscrow = 0;
      const customerTotal = customerBalance + customerEscrow; // customerTotal = customerBalance + customerEscrow
      
      await userMovementsRef.set({
        customerBalance: customerBalance,
        customerTotal: customerTotal,
        customerEscrow: customerEscrow,
        customerMovements: [movementWithTimestamp],
        lastUpdated: admin.firestore.Timestamp.now(),
        paysatUID: paysatUID,
      });
      console.log('✅ Documento creado en Banco_PaySat_Money:', paysatUID, '| Balance:', customerBalance, '| Total:', customerTotal);
    } else {
      // Si existe, agregar el movimiento y actualizar el balance y total
      const currentData = userMovementsDoc.data();
      const currentBalance = currentData.customerBalance || 0;
      const currentEscrow = currentData.customerEscrow || 0;
      const newBalance = currentBalance + balanceChange;
      const newTotal = newBalance + currentEscrow; // customerTotal = customerBalance + customerEscrow
      
      await userMovementsRef.update({
        customerBalance: parseFloat(newBalance.toFixed(2)),
        customerTotal: parseFloat(newTotal.toFixed(2)),
        customerMovements: admin.firestore.FieldValue.arrayUnion(movementWithTimestamp),
        lastUpdated: admin.firestore.Timestamp.now(),
      });
      console.log('✅ Movimiento agregado a Banco_PaySat_Money:', paysatUID, '| Balance:', newBalance, '| Total:', newTotal);
    }
    
    return { success: true, movementId: movementData.id };
  } catch (error) {
    console.error('❌ Error agregando movimiento al usuario:', error);
    console.error('❌ Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica si un movimiento ya existe en el array de movimientos del usuario
 * @param {string} paysatUID - El UID del usuario
 * @param {string} movementId - El ID del movimiento a verificar
 * @returns {Promise<boolean>} - true si el movimiento ya existe
 */
async function movementExists(paysatUID, movementId) {
  try {
    const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatUID);
    const userMovementsDoc = await userMovementsRef.get();
    
    if (!userMovementsDoc.exists) {
      return false;
    }
    
    const movements = userMovementsDoc.data().customerMovements || [];
    return movements.some(m => m.id === movementId);
  } catch (error) {
    console.error('❌ Error verificando existencia de movimiento:', error);
    return false;
  }
}

/**
 * Registra un movimiento de recarga (recharge)
 */
async function createRechargeMovement(sessionData, paymentIntentId, rechargeId) {
  try {
    console.log('💳 Creando movimiento de recarga...');
    
    const paysatUID = sessionData.paysatUID;
    
    if (!paysatUID) {
      throw new Error('paysatUID es requerido para crear movimiento');
    }
    
    // Prioridad: charge_id > rechargeId > paymentIntentId
    const documentId = sessionData.charge_id || rechargeId || paymentIntentId;
    const movementId = `recharge_${documentId}`;
    
    // Verificar si ya existe para evitar duplicados
    const exists = await movementExists(paysatUID, movementId);
    if (exists) {
      console.log('ℹ️ Movimiento de recarga ya existe:', movementId);
      return { success: true, documentId: movementId, skipped: true };
    }
    
    // Obtener el PAYSATAccountNumber del usuario
    const PAYSATAccountNumber = await getUserAccountNumber(paysatUID);
    
    const rechargeMovement = {
      id: movementId,
      typeMovement: "recharge",
      amount: sessionData.amount,
      amount_cents: sessionData.amount_cents,
      currency: sessionData.currency || 'USD',
      paysatUID: paysatUID,
      PAYSATAccountNumber: PAYSATAccountNumber,
      payment_intent_id: paymentIntentId,
      recharge_id: rechargeId,
      charge_id: sessionData.charge_id || null,
      userEmail: sessionData.userEmail || null,
      userName: sessionData.userName || null,
      description: sessionData.description || `Recarga Stripe`,
      source: 'stripe_webhook',
    };
    
    // El monto de la recarga es positivo (suma al balance)
    const balanceChange = parseFloat(sessionData.amount);
    
    const result = await addMovementToUser(paysatUID, rechargeMovement, balanceChange);
    
    if (result.success) {
      console.log('✅ Movimiento de recarga creado:', movementId);
      
      // ✅ Registrar en PaySat_Ledger (nuevo ledger unificado)
      try {
        // Obtener el balance actualizado
        const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatUID);
        const userMovementsDoc = await userMovementsRef.get();
        const currentBalance = userMovementsDoc.exists ? (userMovementsDoc.data().customerBalance || 0) : balanceChange;
        
        await recordRechargeEntry({
          user_account: paysatUID,
          amount: parseFloat(sessionData.amount),
          currency: sessionData.currency || 'USD',
          balance_after: currentBalance,
          description: `Recarga Stripe - ${movementId}`,
          meta: {
            payment_intent_id: paymentIntentId,
            recharge_id: rechargeId,
            charge_id: sessionData.charge_id || null,
            user_email: sessionData.userEmail || null,
            user_name: sessionData.userName || null,
            source: 'stripe_webhook',
            movement_id: movementId,
            account_number: PAYSATAccountNumber
          }
        });
        console.log('✅ Recarga registrada en PaySat_Ledger:', movementId);
      } catch (ledgerError) {
        console.error('⚠️ Error registrando recarga en PaySat_Ledger:', ledgerError);
        // No lanzamos el error para no afectar la transacción principal
      }
      
      return { success: true, documentId: movementId, data: rechargeMovement };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creando movimiento de recarga:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra un movimiento de fee
 */
async function createFeeMovement(feeData, sessionData, balanceTransactionId) {
  try {
    console.log('💰 Creando movimiento de fee...');
    
    const paysatUID = sessionData.paysatUID;
    
    if (!paysatUID) {
      throw new Error('paysatUID es requerido para crear movimiento');
    }
    
    const movementId = `fee_${balanceTransactionId}`;
    
    // Verificar si ya existe para evitar duplicados
    const exists = await movementExists(paysatUID, movementId);
    if (exists) {
      console.log('ℹ️ Movimiento de fee ya existe:', movementId);
      return { success: true, documentId: movementId, skipped: true };
    }
    
    // Obtener el PAYSATAccountNumber del usuario
    const PAYSATAccountNumber = await getUserAccountNumber(paysatUID);
    
    // Calcular el fee total (Stripe + PaySat)
    const stripeFee_cents = feeData.fee_cents;
    const totalFee_cents = stripeFee_cents + PAYSAT_FEE_CENTS;
    
    // Recalcular el net (original amount - total fees)
    const originalAmount_cents = stripeFee_cents + feeData.net_cents;
    const newNet_cents = originalAmount_cents - totalFee_cents;
    
    const feeMovement = {
      id: movementId,
      typeMovement: "fee",
      amount: centsToAmount(stripeFee_cents),
      amount_cents: stripeFee_cents,
      currency: feeData.currency || 'USD',
      paysatUID: paysatUID,
      PAYSATAccountNumber: PAYSATAccountNumber,
      
      // Fee información
      paysatFee: PAYSAT_FEE_AMOUNT,
      paysatFee_cents: PAYSAT_FEE_CENTS,
      totalFee_cents: totalFee_cents,
      totalFee: centsToAmount(totalFee_cents),
      net_cents: newNet_cents,
      net: centsToAmount(newNet_cents),
      stripe_fee_cents: stripeFee_cents,
      stripe_fee: centsToAmount(stripeFee_cents),
      
      balanceTransactionId: balanceTransactionId,
      source: 'stripe_webhook',
    };
    
    // El fee es negativo (resta al balance) - usar totalFee
    const balanceChange = -parseFloat(centsToAmount(totalFee_cents));
    
    const result = await addMovementToUser(paysatUID, feeMovement, balanceChange);
    
    if (result.success) {
      console.log('✅ Movimiento de fee creado:', movementId);
      
      // ✅ Registrar en PaySat_Ledger (nuevo ledger unificado)
      try {
        // Obtener el balance actualizado
        const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatUID);
        const userMovementsDoc = await userMovementsRef.get();
        const currentBalance = userMovementsDoc.exists ? (userMovementsDoc.data().customerBalance || 0) : 0;
        
        const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID || 'PAYSAT_SYSTEM';
        
        await recordFeeEntry({
          user_account: paysatUID,
          system_account: paysatMainUID,
          fee_amount: parseFloat(centsToAmount(totalFee_cents)),
          currency: feeData.currency || 'USD',
          balance_after: currentBalance,
          description: `Transaction Fee - ${movementId}`,
          meta: {
            stripe_fee: parseFloat(centsToAmount(stripeFee_cents)),
            stripe_fee_cents: stripeFee_cents,
            paysat_fee: parseFloat(PAYSAT_FEE_AMOUNT),
            paysat_fee_cents: PAYSAT_FEE_CENTS,
            total_fee_cents: totalFee_cents,
            balance_transaction_id: balanceTransactionId,
            source: 'stripe_webhook',
            movement_id: movementId,
            account_number: PAYSATAccountNumber,
            fee_type: 'recharge_fee'
          }
        });
        console.log('✅ Fee registrado en PaySat_Ledger:', movementId);
      } catch (ledgerError) {
        console.error('⚠️ Error registrando fee en PaySat_Ledger:', ledgerError);
      }
      
      return { success: true, documentId: movementId, data: feeMovement };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creando movimiento de fee:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra un depósito a la cuenta principal de PaySat
 */
async function createPaySatDepositMovement(balanceTransactionId) {
  try {
    console.log('🏦 Creando depósito a cuenta principal PaySat...');
    
    // Obtener valores de variables de entorno
    const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
    const paysatMainEmail = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;
    const paysatMainNumber = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
    
    //
      // ✅ Registrar en PaySat_Ledger (nuevo ledger unificado)
      try {
        // Obtener el balance actualizado
        const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatMainUID);
        const userMovementsDoc = await userMovementsRef.get();
        const currentBalance = userMovementsDoc.exists ? (userMovementsDoc.data().customerBalance || 0) : balanceChange;
        
        await recordDepositEntry({
          user_account: paysatMainUID,
          amount: parseFloat(PAYSAT_FEE_AMOUNT),
          currency: 'USD',
          balance_after: currentBalance,
          description: `PaySat Fee Collection - ${movementId}`,
          meta: {
            balance_transaction_id: balanceTransactionId,
            source: 'paysat_fee_collection',
            movement_id: movementId,
            account_number: paysatMainNumber,
            account_email: paysatMainEmail,
            deposit_type: 'fee_collection'
          }
        });
        console.log('✅ Depósito PaySat registrado en PaySat_Ledger:', movementId);
      } catch (ledgerError) {
        console.error('⚠️ Error registrando depósito PaySat en PaySat_Ledger:', ledgerError);
      }
      
      // Validar que existan las variables de entorno
    if (!paysatMainUID || !paysatMainEmail || !paysatMainNumber) {
      throw new Error('Variables de entorno PAYSAT_MAIN_ACCOUNT no configuradas correctamente');
    }
    
    const movementId = `deposit_fee_${balanceTransactionId}`;
    
    // Verificar si ya existe para evitar duplicados
    const exists = await movementExists(paysatMainUID, movementId);
    if (exists) {
      console.log('ℹ️ Depósito PaySat ya existe:', movementId);
      return { success: true, documentId: movementId, skipped: true };
    }
    
    const depositMovement = {
      id: movementId,
      typeMovement: "deposit",
      amount: PAYSAT_FEE_AMOUNT,
      amount_cents: PAYSAT_FEE_CENTS,
      currency: "USD",
      paysatUID: paysatMainUID,
      email: paysatMainEmail,
      PAYSATAccountNumber: paysatMainNumber,
      from: balanceTransactionId,
      description: "fee",
      source: 'paysat_fee_collection',
    };
    
    // El depósito es positivo (suma al balance de la cuenta principal)
    const balanceChange = parseFloat(PAYSAT_FEE_AMOUNT);
    
    const result = await addMovementToUser(paysatMainUID, depositMovement, balanceChange);
    
    if (result.success) {
      console.log('✅ Depósito PaySat creado:', movementId);
      return { success: true, documentId: movementId, data: depositMovement };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creando depósito PaySat:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra un movimiento de compra de tarjeta virtual (sale de la cuenta del usuario)
 */
async function createCardBuyMovement(paysatUID, cardData) {
  try {
    console.log('💳 Creando movimiento de compra de tarjeta...');
    
    const movementId = `buy_virtual_card_${uuidv4()}`;
    
    // Verificar si ya existe
    const exists = await movementExists(paysatUID, movementId);
    if (exists) {
      console.log('ℹ️ Movimiento de compra ya existe:', movementId);
      return { success: true, documentId: movementId, skipped: true };
    }
    
    const buyMovement = {
      id: movementId,
      typeMovement: 'buy',
      amount: cardData.amount,
      amount_cents: cardData.amount_cents,
      currency: cardData.currency,
      paysatUID: paysatUID,
      email: cardData.email,
      PAYSATAccountNumber: cardData.PAYSATAccountNumber,
      from: 'Emission_PAYSAT_Virtual_Card',
      description: 'Emission_PAYSAT_Virtual_Card',
      card_id: cardData.card_id,
      provider: 'stripe_issuing',
      source: 'card_issuance',
    };
    
    // La compra es negativa (resta al balance)
    const balanceChange = -parseFloat(cardData.amount);
    
    const result = await addMovementToUser(paysatUID, buyMovement, balanceChange);
    
    if (result.success) {
      console.log('✅ Movimiento de compra de tarjeta creado:', movementId);
      
      // ✅ Registrar en PaySat_Ledger (nuevo ledger unificado)
      try {
        const userMovementsRef = db.collection('Banco_PaySat_Money').doc(paysatUID);
        const userMovementsDoc = await userMovementsRef.get();
        const currentBalance = userMovementsDoc.exists ? (userMovementsDoc.data().customerBalance || 0) : 0;
        
        const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID || 'PAYSAT_SYSTEM';
        
        await recordFeeEntry({
          user_account: paysatUID,
          system_account: paysatMainUID,
          fee_amount: parseFloat(cardData.amount),
          currency: cardData.currency || 'USD',
          balance_after: currentBalance,
          description: `Virtual Card Purchase - ${movementId}`,
          meta: {
            card_id: cardData.card_id,
            provider: 'stripe_issuing',
            source: 'card_issuance',
            movement_id: movementId,
            account_number: cardData.PAYSATAccountNumber,
            email: cardData.email,
            fee_type: 'card_issuance'
          }
        });
        console.log('✅ Compra de tarjeta registrada en PaySat_Ledger:', movementId);
      } catch (ledgerError) {
        console.error('⚠️ Error registrando compra de tarjeta en PaySat_Ledger:', ledgerError);
      }
      
      return { success: true, documentId: movementId, data: buyMovement };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creando movimiento de compra de tarjeta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra un depósito a la cuenta PAYSAT por emisión de tarjeta
 */
async function createCardDepositMovement(cardData, originalPaysatUID) {
  try {
    console.log('🏦 Creando depósito PAYSAT por emisión de tarjeta...');
    
    const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
    const paysatMainEmail = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;
    const paysatMainNumber = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
    
    if (!paysatMainUID || !paysatMainEmail || !paysatMainNumber) {
      throw new Error('Variables de entorno PAYSAT_MAIN_ACCOUNT no configuradas correctamente');
    }
    
    const movementId = `deposit_virtual_card_${uuidv4()}`;
    
    // Verificar si ya existe
    const exists = await movementExists(paysatMainUID, movementId);
    if (exists) {
      console.log('ℹ️ Depósito de tarjeta ya existe:', movementId);
      return { success: true, documentId: movementId, skipped: true };
    }
    
    const depositMovement = {
      id: movementId,
      typeMovement: 'deposit',
      amount: cardData.amount,
      amount_cents: cardData.amount_cents,
      currency: cardData.currency,
      paysatUID: paysatMainUID,
      email: paysatMainEmail,
      PAYSATAccountNumber: paysatMainNumber,
      from: 'Deposit_PAYSAT_Virtual_Card',
      description: `Emission_PAYSAT_Virtual_Card usr: ${originalPaysatUID}`,
      card_id: cardData.card_id,
      provider: 'stripe_issuing',
      source: 'card_issuance',
    };
    
    // El depósito es positivo (suma al balance)
    const balanceChange = parseFloat(cardData.amount);
    
    const result = await addMovementToUser(paysatMainUID, depositMovement, balanceChange);
    
    if (result.success) {
      console.log('✅ Depósito PAYSAT por tarjeta creado:', movementId);
      
      // ℹ️ NOTA: No se registra en PaySat_Ledger aquí porque ya se registró
      // en createCardBuyMovement() como una transacción FEE directa del usuario
      // a la cuenta principal de PaySat. Esto evita duplicación en el ledger.
      // El movimiento en Banco_PaySat_Money (arriba) sigue funcionando para
      // la contabilidad interna del sistema.
      
      return { success: true, documentId: movementId, data: depositMovement };
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creando depósito PAYSAT por tarjeta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Procesa todos los movimientos contables para una transacción completa
 */
async function processCompleteTransaction(sessionData, paymentIntentId, rechargeId, feeData, balanceTransactionId, options = {}) {
  console.log('📊 ============================================');
  console.log('📊 INICIO processCompleteTransaction');
  console.log('📊 Payment Intent ID:', paymentIntentId);
  console.log('📊 Recharge ID:', rechargeId);
  console.log('📊 Balance Transaction ID:', balanceTransactionId);
  console.log('📊 Tiene feeData:', !!feeData);
  console.log('📊 paysatUID:', sessionData.paysatUID);
  console.log('📊 amount:', sessionData.amount);
  console.log('📊 ============================================');
  
  const { onlyFees = false } = options;
  
  const results = {
    recharge: null,
    fee: null,
    deposit: null,
    success: true,
    errors: []
  };

  try {
    // 1. Crear movimiento de fee PRIMERO (solo si hay datos de fee)
    if (feeData && balanceTransactionId) {
      console.log('1️⃣ Procesando movimiento de fee (PRIMERO)...');
      const feeResult = await createFeeMovement(feeData, sessionData, balanceTransactionId);
      results.fee = feeResult;
      
      if (!feeResult.success) {
        results.errors.push(`Fee movement error: ${feeResult.error}`);
        results.success = false;
      }
    } else if (!onlyFees) {
      console.log('⚠️ No hay datos de fee disponibles para procesar primero');
    }

    // 2. Crear movimiento de recarga/charge SEGUNDO (solo si no es onlyFees)
    if (!onlyFees) {
      console.log('2️⃣ Procesando movimiento de recarga/charge (SEGUNDO)...');
      const rechargeResult = await createRechargeMovement(sessionData, paymentIntentId, rechargeId);
      results.recharge = rechargeResult;
      
      if (!rechargeResult.success) {
        results.errors.push(`Recharge movement error: ${rechargeResult.error}`);
        results.success = false;
      }
    } else {
      console.log('2️⃣ Saltando movimiento de recarga (onlyFees=true)...');
      
      // Verificar que existe el movimiento de recarga en el array del usuario
      const rechargeMovementId = `recharge_${rechargeId || paymentIntentId}`;
      const existsInUser = await movementExists(sessionData.paysatUID, rechargeMovementId);
      
      if (!existsInUser) {
        console.error('❌ No se encontró movimiento de recarga existente:', rechargeMovementId);
        results.errors.push('No existing recharge movement found for fees processing');
        results.success = false;
        return results;
      } else {
        console.log('✅ Movimiento de recarga existente confirmado:', rechargeMovementId);
        results.recharge = { success: true, documentId: rechargeMovementId, skipped: true };
      }
    }

    // 3. Crear depósito PaySat TERCERO (solo si el fee se procesó correctamente)
    if (results.fee?.success || (onlyFees && feeData && balanceTransactionId)) {
      console.log('3️⃣ Procesando depósito PaySat (TERCERO)...');
      // console.log('🔍 balanceTransactionId recibido:', balanceTransactionId);
      // console.log('🔍 feeData:', JSON.stringify(feeData, null, 2));
      
      const depositResult = await createPaySatDepositMovement(balanceTransactionId);
      results.deposit = depositResult;
      
      if (!depositResult.success) {
        results.errors.push(`Deposit movement error: ${depositResult.error}`);
        results.success = false;
      }
    } else {
      console.log('⚠️ No se procesó fee exitosamente, saltando depósito PaySat');
    }

    console.log('📋 Resumen de movimientos procesados:', {
      recharge: results.recharge?.success || false,
      fee: results.fee?.success || false,
      deposit: results.deposit?.success || false,
      totalSuccess: results.success
    });

    return results;

  } catch (error) {
    console.error('❌ Error procesando movimientos contables:', error);
    results.success = false;
    results.errors.push(`General error: ${error.message}`);
    return results;
  }
}

export {
  createRechargeMovement,
  createFeeMovement,
  createPaySatDepositMovement,
  createCardBuyMovement,
  createCardDepositMovement,
  processCompleteTransaction,
  movementExists,
  getUserAccountNumber,
  PAYSAT_FEE_CENTS,
  PAYSAT_FEE_AMOUNT
};

