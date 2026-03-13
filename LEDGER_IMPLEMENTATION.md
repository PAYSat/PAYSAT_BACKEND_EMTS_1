# Sistema de Ledger Unificado - PaySat

## Descripción General

Se ha implementado un sistema de ledger unificado para registrar **todas** las transacciones del sistema PaySat en la colección `PaySat_Ledger` de Firebase Firestore. Este ledger garantiza:

- ✅ **Inmutabilidad**: Los documentos nunca se actualizan o eliminan
- ✅ **Trazabilidad**: Cada transacción tiene un hash único y referencia al hash anterior
- ✅ **Integridad**: Sistema de cadena de bloques ligero con hashing SHA-256
- ✅ **Flexibilidad**: Campo `meta` para datos específicos de cada tipo de transacción
- ✅ **Consistencia**: Todas las transacciones se registran con el mismo formato

## Estructura de Documentos en PaySat_Ledger

Cada documento en la colección `PaySat_Ledger` tiene la siguiente estructura:

```json
{
  "_id": "uuid-único",
  "timestamp": "2023-10-27T10:00:00Z",
  "type": "TRANSFER",
  "debit_account": "user_123",
  "credit_account": "user_456",
  "amount": 150.50,
  "currency": "USD",
  "balance_after_debit": 849.50,
  "balance_after_credit": 150.50,
  "description": "Pago de servicios",
  "meta": {
    "created_at_server": "Firebase Timestamp",
    "movement_id": "mov_123",
    "transaction_type": "inter_institution_transfer"
  },
  "related_transaction_id": "rel_123",
  "prev_hash": "a1b2c3d4...",
  "hash": "e5f6g7h8..."
}
```

### Campos Principales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `_id` | string | Identificador único (UUID v4) |
| `timestamp` | string | Fecha/hora ISO 8601 |
| `type` | string | Tipo de operación (ver tipos abajo) |
| `debit_account` | string | ID de cuenta que envía/pierde valor |
| `credit_account` | string | ID de cuenta que recibe/gana valor |
| `amount` | number | Monto de la transacción (siempre positivo) |
| `currency` | string | Código ISO de moneda (USD, EUR, BTC, etc.) |
| `balance_after_debit` | number | Balance de cuenta debitada después |
| `balance_after_credit` | number | Balance de cuenta acreditada después |
| `description` | string | Descripción de la transacción |
| `meta` | object | Datos adicionales flexibles |
| `related_transaction_id` | string | ID de transacción relacionada (opcional) |
| `prev_hash` | string | Hash de transacción anterior |
| `hash` | string | Hash SHA-256 de esta transacción |

## Tipos de Transacciones

### 1. RECHARGE
Recargas desde Stripe hacia cuentas de usuario.
- **Debit**: `STRIPE_GATEWAY`
- **Credit**: ID del usuario (paysatUID)

### 2. FEE
Cobros de comisiones/fees.
- **Debit**: ID del usuario
- **Credit**: `PAYSAT_SYSTEM` o ID cuenta principal

### 3. TRANSFER
Transferencias entre usuarios.
- **Debit**: ID cuenta origen
- **Credit**: ID cuenta destino

### 4. P2P_ESCROW_LOCK
Bloqueo de fondos en escrow para P2P.
- **Debit**: ID vendedor
- **Credit**: `PAYSAT_P2P_ESCROW`

### 5. P2P_ESCROW_RELEASE
Liberación de escrow al comprador.
- **Debit**: `PAYSAT_P2P_ESCROW`
- **Credit**: ID comprador

### 6. P2P_ESCROW_REFUND
Devolución de escrow al vendedor.
- **Debit**: `PAYSAT_P2P_ESCROW`
- **Credit**: ID vendedor

### 7. DEPOSIT
Depósitos genéricos al sistema.
- **Debit**: `EXTERNAL_ACCOUNT` o fuente externa
- **Credit**: ID cuenta destino

### 8. WITHDRAWAL
Retiros desde el sistema.
- **Debit**: ID del usuario
- **Credit**: `EXTERNAL_ACCOUNT`

## Casos Especiales

### Compra de Tarjetas Virtuales
Cuando un usuario compra/activa una tarjeta virtual **se registra UNA sola transacción en el ledger**:

```javascript
Tipo: FEE
Debit: user_123 (usuario que compra)
Credit: PAYSAT_MAIN_ACCOUNT_UID (cuenta principal PaySat)
Amount: 5.00 USD
Description: "Virtual Card Purchase - mov_123"
```

**Nota importante**: Aunque internamente se crean dos movimientos en `Banco_PaySat_Money` (uno debitando al usuario y otro acreditando a la cuenta principal), en el ledger unificado solo se registra UNA transacción que representa el flujo completo. Esto evita duplicación y mantiene el ledger limpio y consistente.

## Integración en el Código

### Servicio Principal: `ledger_service.js`

El servicio `ledger_service.js` proporciona funciones helper para cada tipo de transacción:

```javascript
import { 
  recordRechargeEntry,
  recordFeeEntry,
  recordTransferEntry,
  recordP2PEscrowLockEntry,
  recordP2PEscrowReleaseEntry,
  recordDepositEntry,
  recordWithdrawalEntry,
  recordLedgerEntry // Función genérica
} from '../services/ledger_service.js';
```

### Ejemplo de Uso

```javascript
// Registrar una recarga
await recordRechargeEntry({
  user_account: paysatUID,
  amount: 100.50,
  currency: 'USD',
  balance_after: 1100.50,
  description: 'Recarga Stripe - charge_abc123',
  meta: {
    payment_intent_id: 'pi_123',
    charge_id: 'ch_123',
    source: 'stripe_webhook'
  }
});

// Registrar un fee
await recordFeeEntry({
  user_account: paysatUID,
  system_account: 'PAYSAT_SYSTEM',
  fee_amount: 1.50,
  currency: 'USD',
  balance_after: 1099.00,
  description: 'Transaction Fee',
  meta: {
    fee_type: 'recharge_fee',
    original_amount: 100.50
  }
});

// Registrar una transferencia
await recordTransferEntry({
  from_account: 'user_123',
  to_account: 'user_456',
  amount: 50.00,
  currency: 'USD',
  balance_after_from: 950.00,
  balance_after_to: 150.00,
  description: 'Transferencia P2P',
  meta: {
    movement_id: 'mov_789',
    transaction_type: 'p2p_transfer'
  }
});
```

## Lugares donde se Registra el Ledger

### 1. Recargas de Stripe (`movements_service.js`)
- ✅ `createRechargeMovement()` - Registra recarga
- ✅ `createFeeMovement()` - Registra fee de recarga
- ✅ `createPaySatDepositMovement()` - Registra depósito a cuenta principal
- ✅ `createCardBuyMovement()` - Registra compra de tarjeta virtual (usuario → sistema)
- ℹ️ `createCardDepositMovement()` - NO registra en ledger (evita duplicación, ya cubierto por createCardBuyMovement)

Los webhooks de Stripe (`stripeWebhook.js`) automáticamente usan estas funciones.

### 2. Transacciones P2P de Crypto (`p2p_escrow_service.js`)
- ✅ `lockEscrow()` - Registra bloqueo de escrow
- ✅ `releaseEscrow()` - Registra liberación al comprador
- ✅ `refundEscrowToSeller()` - Registra devolución al vendedor

### 3. Transferencias Inter-institucionales (`app_transfers_controller.js`)
- ✅ Transferencia principal origen → destino
- ✅ Fee de transferencia (0.41 USD)
- ✅ Fee institucional PaySat (0.03 USD)

## Beneficios del Sistema

### 1. Auditoría Completa
Todas las transacciones quedan registradas de forma inmutable en un solo lugar (`PaySat_Ledger`), facilitando auditorías y reconciliaciones.

### 2. Integridad de Datos
El sistema de hashing encadenado permite detectar cualquier modificación no autorizada en la cadena de transacciones.

### 3. Trazabilidad
Cada transacción está vinculada a la anterior mediante `prev_hash`, creando una cadena de bloques que se puede verificar.

### 4. Flexibilidad
El campo `meta` permite almacenar información específica de cada tipo de transacción sin cambiar el esquema base.

### 5. Consistencia
Todas las transacciones siguen el mismo formato de contabilidad de doble entrada (débito/crédito).

## Consideraciones Importantes

### 1. Inmutabilidad
⚠️ **NUNCA** actualices o elimines documentos del ledger. Si hay un error:
- Crea una transacción de reversión/corrección
- Marca la original en el campo `meta` como corregida
- Referencia la corrección en `related_transaction_id`

### 2. Manejo de Errores
El registro en ledger **NO** debe fallar la transacción principal:

```javascript
try {
  await recordLedgerEntry({ ... });
  console.log('✅ Registrado en ledger');
} catch (ledgerError) {
  console.error('⚠️ Error en ledger:', ledgerError);
  // NO lanzar error - la transacción principal ya se completó
}
```

### 3. Balance After
Es importante registrar el balance después de cada operación para permitir:
- Reconciliación de cuentas
- Auditorías de saldo
- Detección de inconsistencias

### 4. Transacciones de Firestore
Cuando sea posible, usar el parámetro `tx` para incluir el registro de ledger dentro de una transacción de Firestore:

```javascript
await db.runTransaction(async (tx) => {
  // ... operaciones transaccionales ...
  
  await recordLedgerEntry({
    // ... parámetros ...
    tx: tx // Incluir en la transacción
  });
});
```

## Consultas Útiles

### Obtener transacciones de un usuario
```javascript
const snapshot = await db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();
```

### Obtener transacciones por tipo
```javascript
const snapshot = await db.collection('PaySat_Ledger')
  .where('type', '==', 'TRANSFER')
  .orderBy('timestamp', 'desc')
  .get();
```

### Verificar cadena de hashing
```javascript
const snapshot = await db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .orderBy('timestamp', 'asc')
  .get();

let prevHash = null;
snapshot.docs.forEach(doc => {
  const data = doc.data();
  if (prevHash && data.prev_hash !== prevHash) {
    console.error('❌ Cadena de hash rota en:', doc.id);
  }
  prevHash = data.hash;
});
```

## Registro Dual

Es importante notar que el sistema mantiene **dos registros**:

1. **Registro Original**: Las colecciones originales como `Banco_PaySat_Money`, `PaySat_Crypto_Ledger`, etc. siguen funcionando normalmente.

2. **Ledger Unificado**: `PaySat_Ledger` es una **copia adicional** de todas las transacciones en un formato estandarizado.

Esto proporciona:
- ✅ Compatibilidad con código existente
- ✅ Registro centralizado para auditorías
- ✅ Sin cambios en la lógica de negocio existente
- ✅ Fácil generación de reportes consolidados

## Próximos Pasos (Recomendaciones)

1. **Índices en Firestore**: Crear índices compuestos para consultas frecuentes:
   - `debit_account` + `timestamp`
   - `credit_account` + `timestamp`
   - `type` + `timestamp`

2. **Dashboard de Auditoría**: Crear un panel administrativo para visualizar:
   - Todas las transacciones
   - Verificación de integridad de hashing
   - Reportes por periodo
   - Detección de anomalías

3. **Exportación de Datos**: Implementar función para exportar el ledger:
   - Formato CSV para Excel
   - Formato JSON para análisis
   - Formato PDF para auditorías

4. **Notificaciones**: Implementar alertas cuando:
   - Se detecte una cadena de hash rota
   - Una transacción falle al registrarse en ledger
   - Se superen ciertos umbrales de transacciones

## Soporte

Para preguntas o problemas con el sistema de ledger:
- Revisar logs del servidor con keyword "PaySat_Ledger"
- Verificar integridad de la cadena de hashing
- Consultar este documento para el formato correcto

---

**Última actualización**: 11 de marzo de 2026
**Versión**: 1.0
**Autor**: Sistema PaySat Backend
