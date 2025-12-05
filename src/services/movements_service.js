import { db } from '../config/firebase.js';
import { getUserAccountNumber } from './paysat_service.js';
import { v4 as uuidv4 } from 'uuid';
import { centsToAmount } from '../utils/cents_to_amount.js';

// Fee estándar de PaySat en centavos
const PAYSAT_FEE_CENTS = 100; // 1.00 USD
const PAYSAT_FEE_AMOUNT = "1.00";

/**
 * Registra un movimiento de recarga (recharge)
 */
async function createRechargeMovement(sessionData, paymentIntentId, rechargeId) {
  try {
    console.log('💳 Creando movimiento de recarga...');
    
    // Prioridad: charge_id > rechargeId > paymentIntentId
    // Esto asegura que siempre usamos el charge_id cuando está disponible
    const documentId = sessionData.charge_id || rechargeId || paymentIntentId;
    const rechargeDocId = `recharge_${documentId}`;
    
    // console.log('📝 ID del documento de recarga:', rechargeDocId);
    // console.log('📝 Basado en:', sessionData.charge_id ? 'charge_id' : (rechargeId ? 'rechargeId' : 'paymentIntentId'));
    
    // Verificar si ya existe para evitar duplicados
    const existingRecharge = await db.collection('PaySat_Account_Movements').doc(rechargeDocId).get();
    if (existingRecharge.exists) {
      console.log('ℹ️ Movimiento de recarga ya existe:', rechargeDocId);
      return { success: true, documentId: rechargeDocId, data: existingRecharge.data(), skipped: true };
    }
    
    // ADICIONAL: Verificar si existe una recarga con el mismo payment_intent_id pero diferente document ID
    const duplicateQuery = await db.collection('PaySat_Account_Movements')
      .where('typeMovement', '==', 'recharge')
      .where('payment_intent_id', '==', paymentIntentId)
      .limit(1)
      .get();
    
    if (!duplicateQuery.empty) {
      const existingDoc = duplicateQuery.docs[0];
      // console.log('⚠️ Ya existe recarga para payment_intent:', paymentIntentId);
      // console.log('📄 Documento existente:', existingDoc.id);
      // console.log('📄 Documento actual:', rechargeDocId);
      
      // Si los IDs son diferentes, significa que hay duplicado
      if (existingDoc.id !== rechargeDocId) {
        // console.log('❌ DUPLICADO DETECTADO - usando documento existente');
        return { success: true, documentId: existingDoc.id, data: existingDoc.data(), skipped: true };
      }
    }
    
    // Obtener el numeroCuentaPAYSAT del usuario
    const numeroCuentaPAYSAT = await getUserAccountNumber(sessionData.paysatUID);
    
    const rechargeMovement = {
      // Información del pago
      ...sessionData,
      typeMovement: "recharge",
      numeroCuentaPAYSAT: numeroCuentaPAYSAT,
      payment_intent_id: paymentIntentId,
      recharge_id: rechargeId,
      
      // Metadatos
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'stripe_webhook'
    };

    await db.collection('PaySat_Account_Movements').doc(rechargeDocId).set(rechargeMovement);
    console.log('✅ Movimiento de recarga creado:', rechargeDocId);
    
    return { success: true, documentId: rechargeDocId, data: rechargeMovement };
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
    
    // Crear el documento con prefijo "fee_"
    const feeDocId = `fee_${balanceTransactionId}`;
    
    // Verificar si ya existe para evitar duplicados
    const existingFee = await db.collection('PaySat_Account_Movements').doc(feeDocId).get();
    if (existingFee.exists) {
      console.log('ℹ️ Movimiento de fee ya existe:', feeDocId);
      return { success: true, documentId: feeDocId, data: existingFee.data(), skipped: true };
    }
    
    // Obtener el numeroCuentaPAYSAT del usuario
    const numeroCuentaPAYSAT = await getUserAccountNumber(sessionData.paysatUID);
    
    // Calcular el fee total (Stripe + PaySat)
    const stripeFee_cents = feeData.fee_cents;
    const totalFee_cents = stripeFee_cents + PAYSAT_FEE_CENTS;
    
    // Recalcular el net (original amount - total fees)
    const originalAmount_cents = stripeFee_cents + feeData.net_cents; // Reconstruir amount original
    const newNet_cents = originalAmount_cents - totalFee_cents;
    
    const feeMovement = {
      // Información base del fee de Stripe
      ...feeData,
      
      // Información adicional de PaySat
      typeMovement: "fee",
      paysatFee: PAYSAT_FEE_AMOUNT,
      paysatFee_cents: PAYSAT_FEE_CENTS,
      numeroCuentaPAYSAT: numeroCuentaPAYSAT,
      paysatUID: sessionData.paysatUID,
      
      // Recálculos
      totalFee_cents: totalFee_cents,
      totalFee: centsToAmount(totalFee_cents),
      net_cents: newNet_cents,
      net: centsToAmount(newNet_cents),
      
      // Fees originales para referencia
      stripe_fee_cents: stripeFee_cents,
      stripe_fee: centsToAmount(stripeFee_cents),
      
      // Metadatos
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'stripe_webhook'
    };

    await db.collection('PaySat_Account_Movements').doc(feeDocId).set(feeMovement);
    console.log('✅ Movimiento de fee creado:', feeDocId);
    
    return { success: true, documentId: feeDocId, data: feeMovement };
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
    
    // Verificar si ya existe un depósito para este balanceTransactionId
    const existingDepositQuery = await db.collection('PaySat_Account_Movements')
      .where('typeMovement', '==', 'deposit')
      .where('from', '==', balanceTransactionId)
      .where('description', '==', 'fee')
      .limit(1)
      .get();
    
    if (!existingDepositQuery.empty) {
      const existingDeposit = existingDepositQuery.docs[0];
      const existingData = existingDeposit.data();
      
      // Obtener valores correctos de .env
      const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
      const paysatMainEmail = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;
      const paysatMainNumber = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
      
      // Validar que existan las variables de entorno
      if (!paysatMainUID || !paysatMainEmail || !paysatMainNumber) {
        throw new Error('Variables de entorno PAYSAT_MAIN_ACCOUNT no configuradas correctamente');
      }
      
      // Verificar si el depósito tiene datos incorrectos
      const needsUpdate = existingData.paysatUID !== paysatMainUID ||
                         existingData.email !== paysatMainEmail ||
                         existingData.numeroCuentaPAYSAT !== paysatMainNumber;
      
      if (needsUpdate) {
        console.log('⚠️ Depósito existente con datos antiguos, actualizando...');
        console.log('📝 Datos antiguos:', {
          paysatUID: existingData.paysatUID,
          email: existingData.email,
          numeroCuentaPAYSAT: existingData.numeroCuentaPAYSAT
        });
        
        const updatedData = {
          paysatUID: paysatMainUID,
          email: paysatMainEmail,
          numeroCuentaPAYSAT: paysatMainNumber,
          updatedAt: new Date()
        };
        
        console.log('📝 Actualizando a:', updatedData);
        
        // Actualizar en Firebase
        await db.collection('PaySat_Account_Movements').doc(existingDeposit.id).update(updatedData);
        
        console.log('✅ Depósito actualizado con datos correctos');
        
        return { 
          success: true, 
          documentId: existingDeposit.id, 
          data: { ...existingData, ...updatedData }, 
          updated: true 
        };
      }
      
      console.log('ℹ️ Depósito PaySat ya existe con datos correctos:', existingDeposit.id);
      return { success: true, documentId: existingDeposit.id, data: existingData, skipped: true };
    }
    
    // Si no existe, crear uno nuevo
    const depositId = uuidv4();
    const depositDocId = `deposit_${depositId}`;
    
    // Obtener valores de variables de entorno
    const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
    const paysatMainEmail = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;
    const paysatMainNumber = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
    
    // Validar que existan las variables de entorno
    if (!paysatMainUID || !paysatMainEmail || !paysatMainNumber) {
      throw new Error('Variables de entorno PAYSAT_MAIN_ACCOUNT no configuradas correctamente');
    }
    
    const depositMovement = {
      typeMovement: "deposit",
      amount: PAYSAT_FEE_AMOUNT,
      amount_cents: PAYSAT_FEE_CENTS,
      currency: "USD",
      paysatUID: paysatMainUID,
      email: paysatMainEmail,
      numeroCuentaPAYSAT: paysatMainNumber,
      from: balanceTransactionId,
      description: "fee",
      
      // Metadatos
      createdAt: new Date(),
      source: 'paysat_fee_collection'
    };

    await db.collection('PaySat_Account_Movements').doc(depositDocId).set(depositMovement);
    console.log('✅ Depósito PaySat creado:', depositDocId);
    
    return { success: true, documentId: depositDocId, data: depositMovement };
  } catch (error) {
    console.error('❌ Error creando depósito PaySat:', error);
    return { success: true, error: error.message };
  }
}

/**
 * Procesa todos los movimientos contables para una transacción completa
 */
async function processCompleteTransaction(sessionData, paymentIntentId, rechargeId, feeData, balanceTransactionId, options = {}) {
  // console.log('📊 ============================================');
  // console.log('📊 INICIO processCompleteTransaction');
  // console.log('📊 Payment Intent ID:', paymentIntentId);
  // console.log('📊 Recharge ID:', rechargeId);
  // console.log('📊 Balance Transaction ID:', balanceTransactionId);
  // console.log('📊 Tiene feeData:', !!feeData);
  // console.log('📊 ============================================');
  
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
      
      // Verificar que existe el movimiento de recarga
      const rechargeDocId = `recharge_${rechargeId || paymentIntentId}`;
      const existingRecharge = await db.collection('PaySat_Account_Movements').doc(rechargeDocId).get();
      
      if (!existingRecharge.exists) {
        console.error('❌ No se encontró movimiento de recarga existente:', rechargeDocId);
        results.errors.push('No existing recharge movement found for fees processing');
        results.success = false;
        return results;
      } else {
        console.log('✅ Movimiento de recarga existente confirmado:', rechargeDocId);
        results.recharge = { success: true, documentId: rechargeDocId, data: existingRecharge.data(), skipped: true };
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
  processCompleteTransaction,
  getUserAccountNumber,
  PAYSAT_FEE_CENTS,
  PAYSAT_FEE_AMOUNT
};

