import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import { centsToAmount } from '../utils/cents_to_amount.js';

// Constantes para la cuenta principal de PaySat
const PAYSAT_MAIN_ACCOUNT = {
  paysatUID: "q4rWTMkfhqdDdu08foZrghiKsJ03",
  numeroCuentaPAYSAT: "JS2061771",
  email: "paysat.account@paysatmoney.com"
};

// Fee estándar de PaySat en centavos
const PAYSAT_FEE_CENTS = 100; // 1.00 USD
const PAYSAT_FEE_AMOUNT = "1.00";

/**
 * Obtiene el numeroCuentaPAYSAT de un usuario
 */
async function getUserAccountNumber(paysatUID) {
  try {
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      throw new Error(`Usuario no encontrado: ${paysatUID}`);
    }
    
    const userData = userDoc.data();
    if (!userData.numeroCuentaPAYSAT) {
      throw new Error(`numeroCuentaPAYSAT no encontrado para usuario: ${paysatUID}`);
    }
    
    return userData.numeroCuentaPAYSAT;
  } catch (error) {
    console.error('❌ Error obteniendo numeroCuentaPAYSAT:', error);
    throw error;
  }
}

/**
 * Registra un movimiento de recarga (charge)
 */
async function createChargeMovement(sessionData, paymentIntentId, chargeId) {
  try {
    console.log('💳 Creando movimiento de recarga...');
    
    // Obtener el numeroCuentaPAYSAT del usuario
    const numeroCuentaPAYSAT = await getUserAccountNumber(sessionData.paysatUID);
    
    // Crear el documento con prefijo "charge_"
    const chargeDocId = `charge_${chargeId || paymentIntentId}`;
    
    const chargeMovement = {
      // Información del pago
      ...sessionData,
      typeMovement: "charge",
      numeroCuentaPAYSAT: numeroCuentaPAYSAT,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      
      // Metadatos
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'stripe_webhook'
    };

    await db.collection('PaySat_Movements').doc(chargeDocId).set(chargeMovement);
    console.log('✅ Movimiento de recarga creado:', chargeDocId);
    
    return { success: true, documentId: chargeDocId, data: chargeMovement };
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
    
    // Obtener el numeroCuentaPAYSAT del usuario
    const numeroCuentaPAYSAT = await getUserAccountNumber(sessionData.paysatUID);
    
    // Crear el documento con prefijo "fee_"
    const feeDocId = `fee_${balanceTransactionId}`;
    
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

    await db.collection('PaySat_Movements').doc(feeDocId).set(feeMovement);
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
    
    // Generar ID único para el depósito
    const depositId = uuidv4();
    const depositDocId = `deposit_${depositId}`;
    
    const depositMovement = {
      typeMovement: "deposit",
      amount: PAYSAT_FEE_AMOUNT,
      amount_cents: PAYSAT_FEE_CENTS,
      currency: "USD",
      paysatUID: PAYSAT_MAIN_ACCOUNT.paysatUID,
      email: PAYSAT_MAIN_ACCOUNT.email,
      numeroCuentaPAYSAT: PAYSAT_MAIN_ACCOUNT.numeroCuentaPAYSAT,
      from: balanceTransactionId,
      description: "fee",
      
      // Metadatos
      createdAt: new Date(),
      source: 'paysat_fee_collection'
    };

    await db.collection('PaySat_Movements').doc(depositDocId).set(depositMovement);
    console.log('✅ Depósito PaySat creado:', depositDocId);
    
    return { success: true, documentId: depositDocId, data: depositMovement };
  } catch (error) {
    console.error('❌ Error creando depósito PaySat:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Procesa todos los movimientos contables para una transacción completa
 */
async function processCompleteTransaction(sessionData, paymentIntentId, chargeId, feeData, balanceTransactionId) {
  console.log('📊 Procesando movimientos contables completos...');
  
  const results = {
    charge: null,
    fee: null,
    deposit: null,
    success: true,
    errors: []
  };

  try {
    // 1. Crear movimiento de recarga
    console.log('1️⃣ Procesando movimiento de recarga...');
    const chargeResult = await createChargeMovement(sessionData, paymentIntentId, chargeId);
    results.charge = chargeResult;
    
    if (!chargeResult.success) {
      results.errors.push(`Charge movement error: ${chargeResult.error}`);
      results.success = false;
    }

    // 2. Crear movimiento de fee (solo si hay datos de fee)
    if (feeData && balanceTransactionId) {
      console.log('2️⃣ Procesando movimiento de fee...');
      const feeResult = await createFeeMovement(feeData, sessionData, balanceTransactionId);
      results.fee = feeResult;
      
      if (!feeResult.success) {
        results.errors.push(`Fee movement error: ${feeResult.error}`);
        results.success = false;
      } else {
        // 3. Crear depósito PaySat (solo si el fee se procesó correctamente)
        console.log('3️⃣ Procesando depósito PaySat...');
        const depositResult = await createPaySatDepositMovement(balanceTransactionId);
        results.deposit = depositResult;
        
        if (!depositResult.success) {
          results.errors.push(`Deposit movement error: ${depositResult.error}`);
          results.success = false;
        }
      }
    } else {
      console.log('⚠️ No hay datos de fee disponibles, saltando movimientos de fee y depósito');
      results.errors.push('No fee data available');
    }

    console.log('📋 Resumen de movimientos procesados:', {
      charge: results.charge?.success || false,
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
  createChargeMovement,
  createFeeMovement,
  createPaySatDepositMovement,
  processCompleteTransaction,
  getUserAccountNumber,
  PAYSAT_MAIN_ACCOUNT,
  PAYSAT_FEE_CENTS,
  PAYSAT_FEE_AMOUNT
};