import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Servicio de Ledger para registrar todas las transacciones del sistema de forma inmutable
 * Colección: PaySat_Ledger
 * 
 * Características:
 * - Inmutabilidad: Los documentos nunca se actualizan o borran
 * - Trazabilidad: Cada transacción tiene un hash y referencia al anterior
 * - Flexibilidad: Campo meta para datos adicionales específicos
 */

const LEDGER_COLLECTION = 'PaySat_Ledger';

/**
 * Genera un hash SHA-256 de un objeto
 * @param {object} data - Los datos a hashear
 * @returns {string} - Hash en formato hexadecimal
 */
function generateHash(data) {
  const str = JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Extrae información de seguridad y auditoría del request HTTP
 * @param {object} req - Objeto request de Express
 * @returns {object} - Objeto con datos de seguridad
 */
export function extractSecurityMetadata(req) {
  if (!req) return {};
  
  try {
    return {
      ip_address: req.ip || 
                  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress ||
                  null,
      user_agent: req.headers['user-agent'] || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      accept_language: req.headers['accept-language'] || null,
      x_forwarded_for: req.headers['x-forwarded-for'] || null,
      request_id: req.id || req.headers['x-request-id'] || null,
      method: req.method || null,
      path: req.path || req.url || null,
      host: req.headers.host || null,
      protocol: req.protocol || null,
      // Información adicional de Firebase Auth si está disponible
      auth_uid: req.user?.uid || null,
      auth_email: req.user?.email || null,
      auth_time: req.user?.auth_time || null,
    };
  } catch (error) {
    console.error('⚠️ Error extrayendo metadata de seguridad:', error);
    return {};
  }
}

/**
 * Obtiene el hash de la última transacción de una cuenta
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<string|null>} - Hash de la última transacción o null
 */
async function getLastTransactionHash(accountId) {
  try {
    const snapshot = await db.collection(LEDGER_COLLECTION)
      .where('debit_account', '==', accountId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data().hash || null;
    }
    
    // Buscar también en credit_account si no hay en debit
    const snapshot2 = await db.collection(LEDGER_COLLECTION)
      .where('credit_account', '==', accountId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (!snapshot2.empty) {
      return snapshot2.docs[0].data().hash || null;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error obteniendo último hash:', error);
    return null;
  }
}

/**
 * Registra una entrada en el ledger de forma inmutable
 * 
 * @param {object} params - Parámetros de la transacción
 * @param {string} params.type - Tipo de operación (TRANSFER, DEPOSIT, WITHDRAWAL, FEE, RECHARGE, P2P_ESCROW_LOCK, P2P_ESCROW_RELEASE, etc)
 * @param {string} params.debit_account - ID de la cuenta que envía/pierde valor
 * @param {string} params.credit_account - ID de la cuenta que recibe/gana valor
 * @param {number} params.amount - Valor numérico de la transacción (> 0)
 * @param {string} params.currency - Código ISO de la moneda (USD, EUR, BTC, etc)
 * @param {number} params.balance_after_debit - Balance de la cuenta debitada después de la operación
 * @param {number} [params.balance_after_credit] - Balance de la cuenta acreditada después de la operación (opcional)
 * @param {string} params.description - Descripción de la transacción
 * @param {object} [params.meta] - Objeto flexible para datos adicionales (opcional)
 * @param {string} [params.related_transaction_id] - ID de transacción relacionada (opcional)
 * @param {object} [params.tx] - Transacción de Firestore (opcional)
 * @param {object} [params.req] - Objeto request de Express para extraer datos de seguridad (opcional)
 * 
 * @returns {Promise<string>} - ID del documento creado en el ledger
 */
export async function recordLedgerEntry(params) {
  try {
    const {
      type,
      debit_account,
      credit_account,
      amount,
      currency = 'USD',
      balance_after_debit,
      balance_after_credit = null,
      description,
      meta = {},
      related_transaction_id = null,
      tx = null, // Si se pasa una transacción de Firestore, se usa para escritura atómica
      req = null // Request de Express para datos de seguridad
    } = params;

    // Validaciones
    if (!type || !debit_account || !credit_account || !amount || !description) {
      throw new Error('Faltan campos requeridos en el ledger: type, debit_account, credit_account, amount, description');
    }

    if (amount <= 0) {
      throw new Error('El amount debe ser mayor a 0');
    }

    // Generar ID único
    const ledgerId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Obtener el prev_hash (hash de la transacción anterior del debit_account)
    const prev_hash = await getLastTransactionHash(debit_account);
    
    // Extraer datos de seguridad del request si está disponible
    const securityMetadata = extractSecurityMetadata(req);
    
    // Preparar el documento (sin el hash aún)
    const ledgerDoc = {
      _id: ledgerId,
      timestamp: timestamp,
      type: type.toUpperCase(),
      debit_account,
      credit_account,
      amount: parseFloat(amount.toFixed(2)),
      currency: currency.toUpperCase(),
      balance_after_debit: balance_after_debit !== null ? parseFloat(balance_after_debit.toFixed(2)) : null,
      balance_after_credit: balance_after_credit !== null ? parseFloat(balance_after_credit.toFixed(2)) : null,
      description,
      meta: {
        ...meta, // Datos específicos de la transacción
        ...securityMetadata, // Datos de seguridad y auditoría
        created_at_server: admin.firestore.Timestamp.now(),
      },
      related_transaction_id,
      prev_hash: prev_hash,
      hash: null, // Se calculará después
    };

    // Calcular el hash del documento
    const hashData = {
      ...ledgerDoc,
      prev_hash
    };
    delete hashData.hash; // Excluir el campo hash del cálculo
    ledgerDoc.hash = generateHash(hashData);

    // Escribir en Firestore
    const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerId);
    
    if (tx) {
      // Usar transacción de Firestore si se proporciona
      tx.set(ledgerRef, ledgerDoc);
    } else {
      // Escritura directa
      await ledgerRef.set(ledgerDoc);
    }

    console.log(`✅ Ledger entry registrada: ${ledgerId} | Tipo: ${type} | Monto: ${amount} ${currency}`);
    return ledgerId;

  } catch (error) {
    console.error('❌ Error registrando entrada en ledger:', error);
    throw error;
  }
}

/**
 * Registra una entrada de fee en el ledger
 * Los fees siempre debitan de una cuenta de usuario y acreditan a la cuenta del sistema
 * 
 * @param {object} params - Parámetros del fee
 * @param {string} params.user_account - ID de la cuenta del usuario
 * @param {string} params.system_account - ID de la cuenta del sistema
 * @param {number} params.fee_amount - Monto del fee
 * @param {string} params.currency - Moneda
 * @param {number} params.balance_after - Balance del usuario después del fee
 * @param {string} params.description - Descripción del fee
 * @param {object} [params.meta] - Metadatos adicionales
 * @param {string} [params.related_transaction_id] - ID de transacción relacionada
 * @param {object} [params.tx] - Transacción de Firestore
 * @param {object} [params.req] - Request de Express para datos de seguridad
 * 
 * @returns {Promise<string>} - ID del documento creado
 */
export async function recordFeeEntry(params) {
  const {
    user_account,
    system_account,
    fee_amount,
    currency = 'USD',
    balance_after,
    description,
    meta = {},
    related_transaction_id = null,
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'FEE',
    debit_account: user_account,
    credit_account: system_account,
    amount: fee_amount,
    currency,
    balance_after_debit: balance_after,
    balance_after_credit: null, // No rastreamos balance del sistema
    description,
    meta: {
      ...meta,
      fee_type: meta.fee_type || 'transaction_fee'
    },
    related_transaction_id,
    tx,
    req
  });
}

/**
 * Registra una recarga (recharge) desde Stripe
 * 
 * @param {object} params - Parámetros de la recarga
 * @param {string} params.user_account - ID de la cuenta del usuario
 * @param {number} params.amount - Monto de la recarga
 * @param {string} params.currency - Moneda
 * @param {number} params.balance_after - Balance después de la recarga
 * @param {string} params.description - Descripción
 * @param {object} [params.meta] - Metadatos (payment_intent_id, charge_id, etc)
 * @param {object} [params.tx] - Transacción de Firestore
 * @param {object} [params.req] - Request de Express para datos de seguridad
 * 
 * @returns {Promise<string>} - ID del documento creado
 */
export async function recordRechargeEntry(params) {
  const {
    user_account,
    amount,
    currency = 'USD',
    balance_after,
    description,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'RECHARGE',
    debit_account: 'STRIPE_GATEWAY', // Sistema externo
    credit_account: user_account,
    amount,
    currency,
    balance_after_debit: null, // No rastreamos balance de Stripe
    balance_after_credit: balance_after,
    description,
    meta: {
      ...meta,
      source: 'stripe'
    },
    tx,
    req
  });
}

/**
 * Registra una transferencia P2P entre usuarios
 * 
 * @param {object} params - Parámetros de la transferencia
 * @param {string} params.from_account - Cuenta origen
 * @param {string} params.to_account - Cuenta destino
 * @param {number} params.amount - Monto
 * @param {string} params.currency - Moneda
 * @param {number} params.balance_after_from - Balance origen después
 * @param {number} params.balance_after_to - Balance destino después
 * @param {string} params.description - Descripción
 * @param {object} [params.meta] - Metadatos
 * @param {object} [params.tx] - Transacción de Firestore
 * @param {object} [params.req] - Request de Express para datos de seguridad
 * 
 * @returns {Promise<string>} - ID del documento creado
 */
export async function recordTransferEntry(params) {
  const {
    from_account,
    to_account,
    amount,
    currency = 'USD',
    balance_after_from,
    balance_after_to,
    description,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'TRANSFER',
    debit_account: from_account,
    credit_account: to_account,
    amount,
    currency,
    balance_after_debit: balance_after_from,
    balance_after_credit: balance_after_to,
    description,
    meta,
    tx,
    req
  });
}

/**
 * Registra un bloqueo de escrow en P2P
 */
export async function recordP2PEscrowLockEntry(params) {
  const {
    user_account,
    amount,
    asset,
    balance_after,
    escrow_after,
    order_id,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'P2P_ESCROW_LOCK',
    debit_account: user_account,
    credit_account: 'PAYSAT_P2P_ESCROW',
    amount,
    currency: asset,
    balance_after_debit: balance_after,
    balance_after_credit: escrow_after,
    description: `P2P Escrow Lock - Order ${order_id}`,
    meta: {
      ...meta,
      order_id,
      escrow_type: 'lock'
    },
    tx,
    req
  });
}

/**
 * Registra una liberación de escrow en P2P
 */
export async function recordP2PEscrowReleaseEntry(params) {
  const {
    from_account,
    to_account,
    amount,
    asset,
    balance_after_to,
    order_id,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'P2P_ESCROW_RELEASE',
    debit_account: 'PAYSAT_P2P_ESCROW',
    credit_account: to_account,
    amount,
    currency: asset,
    balance_after_debit: null,
    balance_after_credit: balance_after_to,
    description: `P2P Escrow Release - Order ${order_id}`,
    meta: {
      ...meta,
      order_id,
      from_account,
      escrow_type: 'release'
    },
    tx,
    req
  });
}

/**
 * Registra un retiro (withdrawal)
 */
export async function recordWithdrawalEntry(params) {
  const {
    user_account,
    amount,
    currency = 'USD',
    balance_after,
    description,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'WITHDRAWAL',
    debit_account: user_account,
    credit_account: 'EXTERNAL_ACCOUNT',
    amount,
    currency,
    balance_after_debit: balance_after,
    balance_after_credit: null,
    description,
    meta,
    tx,
    req
  });
}

/**
 * Registra un depósito genérico
 */
export async function recordDepositEntry(params) {
  const {
    user_account,
    amount,
    currency = 'USD',
    balance_after,
    description,
    meta = {},
    tx = null,
    req = null
  } = params;

  return await recordLedgerEntry({
    type: 'DEPOSIT',
    debit_account: 'EXTERNAL_ACCOUNT',
    credit_account: user_account,
    amount,
    currency,
    balance_after_debit: null,
    balance_after_credit: balance_after,
    description,
    meta,
    tx,
    req
  });
}

export default {
  recordLedgerEntry,
  recordFeeEntry,
  recordRechargeEntry,
  recordTransferEntry,
  recordP2PEscrowLockEntry,
  recordP2PEscrowReleaseEntry,
  recordWithdrawalEntry,
  recordDepositEntry,
  extractSecurityMetadata
};
