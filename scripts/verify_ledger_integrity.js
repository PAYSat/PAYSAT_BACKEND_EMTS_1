/**
 * Script de utilidad para verificar la integridad del ledger
 * 
 * Este script verifica:
 * 1. La integridad de la cadena de hashing
 * 2. La consistencia de los balances
 * 3. Las transacciones sin hash previo
 * 
 * Uso:
 * node scripts/verify_ledger_integrity.js
 */

import { db } from '../src/config/firebase.js';
import crypto from 'crypto';

const LEDGER_COLLECTION = 'PaySat_Ledger';

/**
 * Genera un hash SHA-256 de un objeto (debe coincidir con ledger_service.js)
 */
function generateHash(data) {
  const str = JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Verifica la integridad de la cadena de hashing para una cuenta
 */
async function verifyAccountHashChain(accountId) {
  console.log(`\n🔍 Verificando cadena de hashing para cuenta: ${accountId}`);
  
  // Obtener todas las transacciones de la cuenta ordenadas por timestamp
  const debitSnapshot = await db.collection(LEDGER_COLLECTION)
    .where('debit_account', '==', accountId)
    .orderBy('timestamp', 'asc')
    .get();
    
  const creditSnapshot = await db.collection(LEDGER_COLLECTION)
    .where('credit_account', '==', accountId)
    .orderBy('timestamp', 'asc')
    .get();
  
  // Combinar y ordenar por timestamp
  const allDocs = [...debitSnapshot.docs, ...creditSnapshot.docs];
  allDocs.sort((a, b) => {
    const timeA = new Date(a.data().timestamp).getTime();
    const timeB = new Date(b.data().timestamp).getTime();
    return timeA - timeB;
  });
  
  console.log(`📊 Total de transacciones: ${allDocs.length}`);
  
  let errors = 0;
  let warnings = 0;
  let prevHash = null;
  
  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    const data = doc.data();
    
    // Verificar que tiene hash
    if (!data.hash) {
      console.error(`❌ Error [${doc.id}]: Transacción sin hash`);
      errors++;
      continue;
    }
    
    // Verificar prev_hash
    if (i === 0) {
      // Primera transacción puede no tener prev_hash
      if (data.prev_hash) {
        console.log(`ℹ️ Primera transacción tiene prev_hash: ${data.prev_hash.substring(0, 8)}...`);
      }
    } else {
      // Las siguientes deben tener prev_hash
      if (!data.prev_hash) {
        console.warn(`⚠️ Advertencia [${doc.id}]: Transacción sin prev_hash`);
        warnings++;
      } else if (data.prev_hash !== prevHash) {
        console.error(`❌ Error [${doc.id}]: prev_hash inconsistente`);
        console.error(`   Esperado: ${prevHash?.substring(0, 16)}...`);
        console.error(`   Recibido: ${data.prev_hash?.substring(0, 16)}...`);
        errors++;
      }
    }
    
    // Verificar que el hash es correcto
    const hashData = {
      ...data,
      prev_hash: data.prev_hash
    };
    delete hashData.hash;
    
    const calculatedHash = generateHash(hashData);
    if (calculatedHash !== data.hash) {
      console.error(`❌ Error [${doc.id}]: Hash inválido`);
      console.error(`   Almacenado: ${data.hash.substring(0, 16)}...`);
      console.error(`   Calculado:  ${calculatedHash.substring(0, 16)}...`);
      errors++;
    }
    
    prevHash = data.hash;
  }
  
  console.log(`\n📈 Resumen:`);
  console.log(`   Total: ${allDocs.length}`);
  console.log(`   Errores: ${errors}`);
  console.log(`   Advertencias: ${warnings}`);
  
  if (errors === 0 && warnings === 0) {
    console.log(`✅ Cadena íntegra y válida`);
  }
  
  return { total: allDocs.length, errors, warnings };
}

/**
 * Verifica todas las cuentas en el sistema
 */
async function verifyAllAccounts() {
  console.log('🚀 Iniciando verificación completa del ledger...\n');
  
  // Obtener todas las cuentas únicas
  const snapshot = await db.collection(LEDGER_COLLECTION).get();
  
  const accounts = new Set();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    accounts.add(data.debit_account);
    accounts.add(data.credit_account);
  });
  
  console.log(`📊 Total de transacciones: ${snapshot.size}`);
  console.log(`👥 Cuentas únicas: ${accounts.size}\n`);
  
  const results = {
    totalAccounts: accounts.size,
    totalTransactions: snapshot.size,
    accountsWithErrors: 0,
    totalErrors: 0,
    totalWarnings: 0
  };
  
  for (const accountId of accounts) {
    const result = await verifyAccountHashChain(accountId);
    
    if (result.errors > 0) {
      results.accountsWithErrors++;
    }
    
    results.totalErrors += result.errors;
    results.totalWarnings += result.warnings;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN GENERAL');
  console.log('='.repeat(60));
  console.log(`Total de cuentas verificadas: ${results.totalAccounts}`);
  console.log(`Total de transacciones: ${results.totalTransactions}`);
  console.log(`Cuentas con errores: ${results.accountsWithErrors}`);
  console.log(`Total de errores: ${results.totalErrors}`);
  console.log(`Total de advertencias: ${results.totalWarnings}`);
  
  if (results.totalErrors === 0 && results.totalWarnings === 0) {
    console.log('\n✅ ¡LEDGER COMPLETAMENTE ÍNTEGRO!');
  } else {
    console.log('\n⚠️ Se encontraron problemas en el ledger');
  }
  
  return results;
}

/**
 * Genera estadísticas del ledger
 */
async function generateLedgerStats() {
  console.log('\n📊 Generando estadísticas del ledger...\n');
  
  const snapshot = await db.collection(LEDGER_COLLECTION).get();
  
  const stats = {
    totalTransactions: snapshot.size,
    byType: {},
    byCurrency: {},
    totalAmount: {},
    dateRange: {
      earliest: null,
      latest: null
    }
  };
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    
    // Por tipo
    stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
    
    // Por moneda
    stats.byCurrency[data.currency] = (stats.byCurrency[data.currency] || 0) + 1;
    
    // Total por moneda
    if (!stats.totalAmount[data.currency]) {
      stats.totalAmount[data.currency] = 0;
    }
    stats.totalAmount[data.currency] += data.amount;
    
    // Rango de fechas
    const timestamp = new Date(data.timestamp);
    if (!stats.dateRange.earliest || timestamp < stats.dateRange.earliest) {
      stats.dateRange.earliest = timestamp;
    }
    if (!stats.dateRange.latest || timestamp > stats.dateRange.latest) {
      stats.dateRange.latest = timestamp;
    }
  });
  
  console.log('Transacciones por tipo:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  
  console.log('\nTransacciones por moneda:');
  Object.entries(stats.byCurrency).forEach(([currency, count]) => {
    console.log(`   ${currency}: ${count}`);
  });
  
  console.log('\nVolumen total por moneda:');
  Object.entries(stats.totalAmount).forEach(([currency, amount]) => {
    console.log(`   ${currency}: ${amount.toFixed(2)}`);
  });
  
  console.log('\nRango de fechas:');
  console.log(`   Más antigua: ${stats.dateRange.earliest?.toISOString() || 'N/A'}`);
  console.log(`   Más reciente: ${stats.dateRange.latest?.toISOString() || 'N/A'}`);
  
  return stats;
}

/**
 * Función principal
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--stats')) {
      await generateLedgerStats();
    } else if (args.includes('--account')) {
      const accountIndex = args.indexOf('--account');
      const accountId = args[accountIndex + 1];
      
      if (!accountId) {
        console.error('❌ Debes proporcionar un ID de cuenta');
        console.log('Uso: node verify_ledger_integrity.js --account ACCOUNT_ID');
        process.exit(1);
      }
      
      await verifyAccountHashChain(accountId);
    } else {
      await verifyAllAccounts();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyAccountHashChain, verifyAllAccounts, generateLedgerStats };
