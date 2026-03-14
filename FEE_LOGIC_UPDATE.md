# Corrección: Lógica de Fees para Transferencias Móviles

## 📋 Cambios Realizados

Se ha corregido la inconsistencia en el cálculo del fee de transferencias móviles. La nueva regla es:

### ✅ Nueva Regla (Corregida)
**"Si la cuenta origen es PaySat, el fee es SIEMPRE 0 (cero)"**

Independientemente de si el destino tiene cuenta PaySat o no.

---

## 🔧 Métodos Actualizados

### 1. `getPhoneNumberTransferFee`

**Antes:** Solo consultaba el fee basado en el monto, sin considerar el tipo de cuenta origen.

**Ahora:**
- Recibe el parámetro `originUID` (**opcional** para retrocompatibilidad)
- Si `originUID` no se proporciona → retorna fee normal según monto
- Si `originUID` se proporciona:
  - Verifica si la cuenta origen es PaySat
  - Si es PaySat → retorna `fee: 0`
  - Si NO es PaySat → consulta el fee según el monto en la tabla

**Ejemplo de Request:**
```javascript
// Con originUID (recomendado)
GET /api/transfer/fee?amount=100&originUID=cuenta-paysat-uid

// Sin originUID (retrocompatibilidad)
GET /api/transfer/fee?amount=100
// Retorna fee normal según monto

// o POST
POST /api/transfer/fee
{
  "amount": 100,
  "originUID": "cuenta-paysat-uid"  // Opcional
}
```

**Respuesta cuando origen es PaySat:**
```json
{
  "ok": true,
  "data": {
    "amount": 100,
    "fee": 0,
    "feeRange": "paysat_origin",
    "isOriginPaysat": true,
    "message": "Sin comisión para transferencias desde cuenta PAYSAT"
  },
  "message": "Fee obtenido exitosamente"
}
```

**Respuesta cuando origen NO es PaySat:**
```json
{
  "ok": true,
  "data": {
    "amount": 100,
    "fee": 1.50,
    "feeRange": "Equal_Or_Less_Than_100",
    "isOriginPaysat": false
  },
  "message": "Fee obtenido exitosamente"
}
```

---

### 2. `sendTransferToPhoneNumber`

**Antes:**
```javascript
// Solo era 0 si AMBOS eran PaySat
if (isOriginPaysat && destinationUserExists) {
    feeValue = 0;
}
```

**Ahora:**
```javascript
// Es 0 si el ORIGEN es PaySat (sin importar el destino)
if (isOriginPaysat) {
    feeValue = 0;
}
```

---

## 📊 Tabla de Fees Actualizada

| Origen | Destino | Fee |
|--------|---------|-----|
| **PaySat** | PaySat | **0** (Sin comisión) |
| **PaySat** | Sin cuenta PaySat | **0** (Sin comisión) |
| Banco/Cooperativa | PaySat | Fee según monto |
| Banco/Cooperativa | Sin cuenta PaySat | Fee según monto |

---

## 🎯 Lógica del Fee según Monto (cuando NO es PaySat)

| Monto | Fee |
|-------|-----|
| ≤ $100 | Valor en `Equal_Or_Less_Than_100` |
| ≤ $500 | Valor en `Equal_Or_Less_Than_500` |
| ≤ $1000 | Valor en `Equal_Or_Less_Than_1000` |

---

## 💡 Ventajas de la Corrección

### Para el Usuario
- **Incentivo para usar PaySat**: Transferencias sin comisión desde cuentas PaySat
- **Transparencia**: El usuario sabe de antemano si pagará fee o no
- **Ahorro**: No paga comisión en transferencias PaySat → PaySat o PaySat → Usuario sin cuenta

### Para el Negocio
- **Fidelización**: Motiva a los usuarios a mantener fondos en PaySat
- **Crecimiento**: Incentiva a nuevos usuarios a registrarse en PaySat
- **Diferenciación**: Ventaja competitiva vs bancos tradicionales

---

## 🔄 Impacto en Frontend Flutter

El frontend debe actualizar la llamada al endpoint de fee:

**Antes:**
```dart
// Solo enviaba el monto
final response = await http.get(
  Uri.parse('$baseUrl/api/transfer/fee?amount=$amount'),
);
```

**Ahora (REQUERIDO):**
```dart
// Debe enviar também el originUID
final response = await http.get(
  Uri.parse('$baseUrl/api/transfer/fee?amount=$amount&originUID=$selectedAccountUID'),
);
```

**Manejo de la respuesta:**
```dart
final data = jsonDecode(response.body)['data'];
final fee = data['fee']; // 0 o valor según tabla
final isOriginPaysat = data['isOriginPaysat']; // true o false

// Mostrar mensaje al usuario
if (isOriginPaysat) {
  showMessage('¡Sin comisión! Las transferencias desde PaySat son gratis.');
} else {
  showMessage('Comisión: \$${fee.toStringAsFixed(2)} USD');
}
```

---

## ✅ Testing

### Test 1: Fee con cuenta PaySat
```bash
GET /api/transfer/fee?amount=100&originUID=paysat-account-uid
Expected: { fee: 0, isOriginPaysat: true }
```

### Test 2: Fee con cuenta externa
```bash
GET /api/transfer/fee?amount=100&originUID=banco-pichincha-account-uid
Expected: { fee: 1.50, isOriginPaysat: false }
```

### Test 3: Transferencia PaySat → PaySat
```bash
POST /api/transfer/phone
{
  "amount": 100,
  "originUID": "paysat-account-uid",
  "destinationPhoneNumber": "+593999999999"
}
Expected: Transferencia exitosa con fee: 0
```

### Test 4: Transferencia PaySat → Sin cuenta
```bash
POST /api/transfer/phone
{
  "amount": 100,
  "originUID": "paysat-account-uid",
  "destinationPhoneNumber": "+593888888888"
}
Expected: Transferencia exitosa con fee: 0, SMS enviado con referencia
```

---

## 📝 Notas Importantes

1. **Retrocompatibilidad**: El endpoint `getPhoneNumberTransferFee` ahora requiere `originUID`. Asegúrate de actualizar todas las llamadas en el frontend.

2. **Validación**: Si no se proporciona `originUID`, el endpoint retornará error 400.

3. **Consistencia**: Ambos métodos (`getPhoneNumberTransferFee` y `sendTransferToPhoneNumber`) ahora siguen la misma lógica.

4. **Notificaciones**: Las notificaciones push y SMS siguen funcionando igual, independientemente del fee.

---

**Fecha de corrección:** 14 de marzo de 2026
**Versión:** 1.1.0
