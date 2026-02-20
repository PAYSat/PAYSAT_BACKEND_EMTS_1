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
    // Buscar TODOS los documentos de usuarios en Banco_PaySat_Money
    const usersQuery = await db.collection('Banco_PaySat_Money').get();
    
    console.log(`📊 Total de usuarios encontrados: ${usersQuery.size}\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let totalDepositsProcessed = 0;
    
    for (const doc of usersQuery.docs) {
      const data = doc.data();
      const movements = data.customerMovements || [];
      
      // Buscar depósitos con datos incorrectos en el array de movimientos
      let needsUpdate = false;
      const updatedMovements = movements.map(mov => {
        if (mov.typeMovement === 'deposit') {
          totalDepositsProcessed++;
          
          // Verificar si tiene datos incorrectos
          if (mov.paysatUID !== CORRECT_UID || mov.PAYSATAccountNumber !== CORRECT_NUMBER) {
            console.log(`❌ Corrigiendo depósito en usuario: ${doc.id}, movimiento: ${mov.id}`);
            console.log(`   Antes: UID=${mov.paysatUID}, NUM=${mov.PAYSATAccountNumber}`);
            
            needsUpdate = true;
            fixedCount++;
            
            return {
              ...mov,
              paysatUID: CORRECT_UID,
              email: CORRECT_EMAIL,
              PAYSATAccountNumber: CORRECT_NUMBER,
              updatedAt: new Date(),
              auto_fixed: true,
              auto_fixed_at: new Date()
            };
          }
        }
        return mov;
      });
      
      // Si se encontraron cambios, actualizar el documento
      if (needsUpdate) {
        await db.collection('Banco_PaySat_Money').doc(doc.id).update({
          customerMovements: updatedMovements,
          lastUpdated: new Date()
        });
        console.log(`   ✅ Usuario ${doc.id} actualizado\n`);
      } else {
        skippedCount++;
      }
    }
    
    console.log('\n🎉 ============================================');
    console.log(`✅ Depósitos corregidos: ${fixedCount}`);
    console.log(`⏩ Usuarios sin cambios: ${skippedCount}`);
    console.log(`📊 Total depósitos procesados: ${totalDepositsProcessed}`);
    console.log(`📊 Total usuarios procesados: ${usersQuery.size}`);
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
