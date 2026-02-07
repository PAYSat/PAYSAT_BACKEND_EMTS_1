import 'dotenv/config';
import { db } from './src/config/firebase.js';

const CORRECT_UID = '93xxiCL2qJX91rxnPy2PaBsxrWo1';
const CORRECT_EMAIL = 'paysat.account@paysatmoney.com';
const CORRECT_NUMBER = 'JS5670370';

async function autoFixDeposits() {
  console.log('\n🔧 ============================================');
  console.log('🔧 AUTO-FIX: Actualizando depósitos en tiempo real');
  console.log('🔧 ============================================\n');
  
  try {
    // Buscar TODOS los depósitos con datos antiguos
    const depositsQuery = await db.collection('PaySat_Account_Movements')
      .where('typeMovement', '==', 'deposit')
      .get();
    
    console.log(`📊 Total de depósitos encontrados: ${depositsQuery.size}\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const doc of depositsQuery.docs) {
      const data = doc.data();
      
      // Verificar si tiene datos incorrectos
      if (data.paysatUID !== CORRECT_UID || data.PAYSATAccountNumber !== CORRECT_NUMBER) {
        console.log(`❌ Corrigiendo: ${doc.id}`);
        console.log(`   Antes: UID=${data.paysatUID}, NUM=${data.PAYSATAccountNumber}`);
        
        await db.collection('PaySat_Account_Movements').doc(doc.id).update({
          paysatUID: CORRECT_UID,
          email: CORRECT_EMAIL,
          PAYSATAccountNumber: CORRECT_NUMBER,
          updatedAt: new Date(),
          auto_fixed: true,
          auto_fixed_at: new Date()
        });
        
        console.log(`   ✅ Corregido a: UID=${CORRECT_UID}, NUM=${CORRECT_NUMBER}\n`);
        fixedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log('\n🎉 ============================================');
    console.log(`✅ Depósitos corregidos: ${fixedCount}`);
    console.log(`⏩ Depósitos correctos (sin cambios): ${skippedCount}`);
    console.log(`📊 Total procesados: ${depositsQuery.size}`);
    console.log('🎉 ============================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
  }
}

// Ejecutar una vez de inmediato
autoFixDeposits();

// Ejecutar cada 10 segundos en bucle infinito
setInterval(autoFixDeposits, 10000);

console.log('🚀 Script de auto-corrección iniciado. Ejecuta cada 10 segundos.');
console.log('📌 Presiona Ctrl+C para detener.\n');
