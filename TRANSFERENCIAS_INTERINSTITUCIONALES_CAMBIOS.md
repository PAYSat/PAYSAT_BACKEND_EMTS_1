# Cambios en Transferencias Interinstitucionales

## Fecha: 27 de febrero de 2026

## Descripción de Cambios

Se ha modificado el flujo de transferencias interinstitucionales (Cuenta Externa → Cuenta Externa) para implementar un proceso de dos pasos que pasa por la cuenta principal PAYSAT del usuario.

## Nuevo Flujo Interinstitucional

### Flujo Anterior (Directo)
```
Cuenta Externa (Origen) --[amount + fee]--> Cuenta Externa (Destino)
```

### Flujo Nuevo (Dos Pasos)
```
Paso 1: Cuenta Externa (Origen) --[amount]--> Cuenta PAYSAT Principal del Usuario
Paso 2: Cuenta PAYSAT Principal --[amount + fee]--> Cuenta Externa (Destino)
```

## Cambios Implementados

### 1. Identificación de Transferencia Interinstitucional
- Se detecta cuando `!isOriginPaySat && !isDestinationPaySat`
- Se establece la bandera `isInterinstitutional = true`

### 2. Cuenta Principal PAYSAT
- Se busca la cuenta principal del usuario con:
  - `customerAccountUID == uid` (usuario autenticado)
  - `mainAccount == true` (indicador de cuenta principal)
- La cuenta debe existir en la colección `Banco_PaySat_Money`
- Si no existe, la transferencia es rechazada con error 404

### 3. Validación de Balance

#### Para Transferencias Interinstitucionales:
- **Cuenta Origen Externa**: Solo debe tener `amount` (sin fee)
- **Cuenta PAYSAT Principal**: Debe poder recibir `amount` y luego enviar `amount + fee`
- **Validación especial**: Se verifica que después de recibir el `amount`, la cuenta principal tenga suficiente para enviar `total (amount + fee)`

#### Para Otras Transferencias:
- Se mantiene la validación original: `amount + fee` en la cuenta origen

### 4. Cálculo de Balances

#### Transferencia Interinstitucional:
```javascript
// Paso 1: Origen → PaySat Principal
newOriginBalance = originBalance - amount
newMainPaySatBalance = mainPaySatBalance + amount

// Paso 2: PaySat Principal → Destino
newMainPaySatBalance = newMainPaySatBalance - total (amount + fee)
newDestinationBalance = destinationBalance + amount
```

#### Transferencia Normal (sin cambios):
```javascript
newOriginBalance = originBalance - total (amount + fee)
newDestinationBalance = destinationBalance + amount
```

### 5. Movimientos (customerMovements)

#### Transferencia Interinstitucional:

**Cuenta Origen Externa:**
- 1 movimiento de `transfer_sent` (paso 1 hacia PaySat principal)

**Cuenta PAYSAT Principal:**
- 1 movimiento de `transfer_received` (recepción desde origen)
- 1 movimiento de `transfer_sent` (envío a destino)
- 1 movimiento de `fee` (si hay comisión)

**Cuenta Destino Externa:**
- 1 movimiento de `transfer_received` (recepción desde PaySat principal)

**Total: 5 movimientos** (4 si no hay fee)

#### Transferencia Normal (sin cambios):
- 2-3 movimientos (origen envío, destino recepción, fee opcional)

### 6. Historial (PaySat_Transfers_History)

#### Para Transferencias Interinstitucionales:
```json
{
  "transferType": "Interinstitucional_Two_Step",
  "transferTypeDoc": "Between_External_Accounts",
  "status": "success",
  "registeredAt": "...",
  "step1": {
    "origin": { /* datos del origen externo */ },
    "destination": { /* datos de PaySat principal */ }
  },
  "step2": {
    "origin": { /* datos de PaySat principal */ },
    "destination": { /* datos del destino externo */ }
  },
  "step2TransferFee": { /* datos del fee */ },
  "summary": {
    "finalOriginUID": "...",
    "intermediateAccountUID": "...",
    "finalDestinationUID": "...",
    "amount": 100,
    "fee": 5,
    "total": 105
  }
}
```

#### Para Transferencias Normales (sin cambios):
```json
{
  "origin": { /* datos */ },
  "destination": { /* datos */ },
  "originTransferFee": { /* datos */ },
  "transferType": "...",
  "transferTypeDoc": "...",
  "status": "success",
  "registeredAt": "..."
}
```

### 7. Transacción Firestore

#### Lecturas (Fase 1):
**Interinstitucional:**
1. Verificación de cuenta origen
2. Verificación de cuenta destino
3. **Nuevo:** Verificación de cuenta PAYSAT principal
4. Verificación de cuenta principal PaySat (para fees)

**Normal:**
1. Verificación de cuenta origen
2. Verificación de cuenta destino
3. Verificación de cuenta principal PaySat (para fees)

#### Escrituras (Fase 2):
**Interinstitucional:**
1. Actualización de cuenta origen
2. Actualización de cuenta destino
3. **Nuevo:** Actualización de cuenta PAYSAT principal del usuario
4. Actualización de cuenta principal PaySat (fees)
5. Creación de registro en PaySat_Transfers_History

**Normal:**
1. Actualización de cuenta origen
2. Actualización de cuenta destino
3. Actualización de cuenta principal PaySat (fees)
4. Creación de registro en PaySat_Transfers_History

### 8. Respuesta API

#### Para Transferencias Interinstitucionales:
```json
{
  "ok": true,
  "message": "Transferencia interinstitucional realizada exitosamente (flujo de dos pasos: origen → PaySat principal → destino)",
  "data": {
    "transactionUID": "...",
    "originUID": "...",
    "destinationUID": "...",
    "amount": 100,
    "transferType": "Interinstitucionales",
    "feePercentage": 5,
    "feeValue": 5,
    "total": 105,
    "originBalance": 895,
    "destinationBalance": 1100,
    "timestamp": "...",
    "isInterinstitutional": true,
    "intermediateAccount": {
      "accountUID": "...",
      "accountNumber": "...",
      "finalBalance": 1000
    }
  }
}
```

## Tipos de Transferencias (sin cambios en otros tipos)

1. **Entre mis cuentas PAYSAT** (`Between_My_PaySat_Accounts`)
   - Origen: PAYSAT del usuario
   - Destino: PAYSAT del mismo usuario
   - Sin cambios

2. **Entre cuentas PAYSAT** (`Between_Own_And_Other_PaySat_Account`)
   - Origen: PAYSAT del usuario
   - Destino: PAYSAT de otro usuario
   - Sin cambios

3. **Institucionales** (`Between_Own_PaySat_And_External_Account`)
   - Origen: PAYSAT → Destino: Externa (o viceversa)
   - Sin cambios

4. **Interinstitucionales** (`Between_External_Accounts`) ✅ MODIFICADO
   - Origen: Externa → Destino: Externa
   - **Ahora usa flujo de dos pasos**

## Validaciones Adicionales

1. La cuenta principal PAYSAT del usuario debe existir (`mainAccount=true`)
2. La cuenta principal debe tener suficiente balance para completar el paso 2
3. Todas las cuentas deben existir al momento de la transacción (race condition protection)
4. El fee se aplica solo en el segundo paso (PaySat Principal → Destino)

## Rollback Automático

El rollback automático de Firestore se mantiene igual:
- Si cualquier operación falla, todos los cambios se revierten
- Se guarda un registro de auditoría de transferencia fallida
- No se realizan cambios parciales

## Consideraciones de Seguridad

1. Solo el usuario autenticado puede iniciar transferencias desde sus cuentas
2. La cuenta PAYSAT principal debe pertenecer al usuario autenticado
3. Todas las validaciones de balance se hacen dentro de la transacción para evitar race conditions
4. El fee se cobra correctamente independientemente del flujo

## Testing Recomendado

### Casos de Prueba para Transferencias Interinstitucionales:

1. **Usuario sin cuenta principal PAYSAT**
   - Esperado: Error 404 - "No se encontró la cuenta principal PAYSAT"

2. **Cuenta origen sin balance suficiente**
   - Esperado: Error 400 - Balance insuficiente

3. **Cuenta principal sin balance para segundo paso**
   - Esperado: Error 400 - Balance insuficiente en cuenta principal

4. **Transferencia exitosa con fee**
   - Esperado: 200 - Transferencia completada con flujo de dos pasos

5. **Transferencia exitosa sin fee (fee=0)**
   - Esperado: 200 - Transferencia completada con flujo de dos pasos

### Casos de Prueba para Otros Tipos (regresión):

1. **Transferencia entre cuentas PAYSAT propias**
   - Esperado: Sin cambios en comportamiento

2. **Transferencia PAYSAT a externa**
   - Esperado: Sin cambios en comportamiento

3. **Transferencia externa a PAYSAT**
   - Esperado: Sin cambios en comportamiento

4. **Transferencia entre cuentas PAYSAT de diferentes usuarios**
   - Esperado: Sin cambios en comportamiento

## Notas Importantes

- El campo `mainAccount=true` debe estar configurado en Banco_PaySat_Money para que funcione
- Si un usuario tiene múltiples cuentas PAYSAT, solo una debe tener `mainAccount=true`
- Los logs incluyen emojis para facilitar el seguimiento: 🔄 (interinstitucional), 💱 (dos pasos), 💸 (directo)
- El `transferType` en el historial se diferencia: `"Interinstitucional_Two_Step"` vs otros tipos

## Impacto en Base de Datos

### Colecciones Afectadas:
1. `Banco_PaySat_Money` - Requiere campo `mainAccount` (booleano)
2. `PaySat_Transfers_History` - Nueva estructura para transferencias de dos pasos
3. Colecciones de bancos externos (sin cambios estructurales)

### Campos Nuevos:
- `mainAccount` en documentos de `Banco_PaySat_Money` (booleano)
- `transferStep` en movimientos de transferencias interinstitucionales
- `isInterinstitutional` en respuesta API
- `intermediateAccount` en respuesta API
- `step1`, `step2`, `summary` en historial de transferencias interinstitucionales

## Archivo Modificado

- `/var/www/html/paysat_backend/src/controllers/app_linked_user_account_transfer_controller.js`
  - Función: `transferBetweenAccounts`
  - Líneas aproximadas: 1183-1849 (extendidas por los cambios)
