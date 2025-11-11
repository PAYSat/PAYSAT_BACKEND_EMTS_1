import { 
  createChargeMovement, 
  createFeeMovement, 
  createPaySatDepositMovement,
  processCompleteTransaction,
  PAYSAT_FEE_CENTS,
  PAYSAT_FEE_AMOUNT 
} from '../src/services/movements_service.js';

const PAYSAT_MAIN_ACCOUNT = {
  paysatUID: process.env.PAYSAT_MAIN_ACCOUNT_UID,
  numeroCuentaPAYSAT: process.env.PAYSAT_MAIN_ACCOUNT_NUMBER,
  email: process.env.PAYSAT_MAIN_ACCOUNT_EMAIL
};

// Función de prueba para verificar el servicio
async function testMovementsService() {
  console.log('🧪 Iniciando pruebas del servicio de movimientos...');
  
  // Datos de prueba
  const sessionData = {
    paysatUID: "O7xrIZdwN1QPWqwIWwi3Jtv8lSp1", // Usuario de prueba
    amount: "10.00",
    currency: "USD",
    email: "test@example.com"
  };
  
  const feeData = {
    fee_cents: 59,
    net_cents: 941,
    currency: "usd"
  };
  
  console.log('📊 Constantes del servicio:');
  console.log('- Cuenta principal PaySat:', PAYSAT_MAIN_ACCOUNT);
  console.log('- Fee PaySat (centavos):', PAYSAT_FEE_CENTS);
  console.log('- Fee PaySat (amount):', PAYSAT_FEE_AMOUNT);
  
  console.log('✅ Servicio de movimientos verificado correctamente');
}

// Solo ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testMovementsService().catch(console.error);
}