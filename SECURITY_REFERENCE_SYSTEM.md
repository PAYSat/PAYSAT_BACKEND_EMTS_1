# Sistema de Referencias de Seguridad para Transferencias

## 📝 Descripción General

El sistema de referencias de seguridad es una capa adicional de protección y confianza para las transferencias móviles en PAYSAT. Cuando un usuario envía dinero a un número telefónico que NO tiene cuenta registrada en PAYSAT, se genera un código corto único (ej: **4A8K**) que permite:

1. **Verificar la legitimidad** de la transferencia
2. **Prevenir fraudes** y ataques de phishing
3. **Dar confianza** al destinatario de que el SMS es legítimo
4. **Facilitar el soporte** al cliente con un identificador único

---

## 🔑 ¿Cómo Funciona?

### Flujo de Generación

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario A envía $100 USD a número de teléfono sin cuenta      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Backend genera código único: "4A8K"                         │
│  2. Guarda en Firestore: PaySat_Security_References             │
│     - reference: "4A8K"                                          │
│     - transactionUID: "uuid-12345"                              │
│     - amount: 100                                               │
│     - destinationPhoneNumber: "+593999999999"                   │
│     - createdAt: timestamp                                      │
│     - expiresAt: timestamp + 90 días                            │
│     - status: "active"                                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Backend envía SMS vía Twilio al destinatario:               │
│                                                                 │
│  "PAYSAT: Recibiste $100.00 USD (Ref: 4A8K).                   │
│   Instala la app y regístrate con este número para             │
│   acreditarlo.                                                 │
│   https://play.google.com/store/apps..."                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Destinatario instala la app y se registra                  │
│  5. App valida la referencia "4A8K" con el backend             │
│  6. Backend verifica que el número coincida                     │
│  7. Fondos son acreditados automáticamente                      │
│  8. Referencia se marca como "used"                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Seguridad del Sistema

### 1. **Unicidad Garantizada**

```javascript
// Antes de generar, se verifica que no exista en los últimos 30 días
const existingRef = await db.collection('PaySat_Security_References')
    .where('reference', '==', reference)
    .where('createdAt', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .limit(1)
    .get();
```

- Cada referencia es única en un período de 30 días
- Si hay colisión después de 10 intentos, se aumenta la longitud del código

### 2. **Expiración Automática**

```javascript
expiresAt: admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 días
)
```

- Las referencias expiran en 90 días
- Después de este período, no pueden ser validadas
- Reduce ventana de ataque

### 3. **Validación de Número Telefónico**

```javascript
if (phoneNumber && referenceData.destinationPhoneNumber) {
    if (referenceData.destinationPhoneNumber !== phoneNumber) {
        return {
            valid: false,
            message: 'Referencia no corresponde a este número telefónico'
        };
    }
}
```

- Solo el número de teléfono correcto puede reclamar la transferencia
- Previene que terceros roben referencias

### 4. **Estado de Uso**

```javascript
status: 'active'  // Puede ser: active, used, expired, cancelled
```

- Una vez usada, la referencia se marca como "used"
- No puede ser reutilizada
- Historial completo de uso

---

## 📊 Estructura de Datos en Firestore

### Colección: `PaySat_Security_References`

```json
{
  "reference": "4A8K",
  "transactionUID": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 100.50,
  "originUID": "user123",
  "destinationUID": null,
  "destinationPhoneNumber": "+593999999999",
  "type": "mobile_transfer_to_non_paysat",
  "status": "active",
  "createdAt": "2026-03-14T10:30:00.000Z",
  "expiresAt": "2026-06-12T10:30:00.000Z",
  "usedAt": null,
  "metadata": {
    "isOriginPaySat": true,
    "affiliateName": "PAYSAT MONEY LTD",
    "destinationName": "Juan Pérez"
  }
}
```

### Estados Posibles

| Estado | Descripción |
|--------|-------------|
| `active` | Referencia válida y sin usar |
| `used` | Referencia ya reclamada |
| `expired` | Referencia caducada (>90 días) |
| `cancelled` | Cancelada manualmente (soporte) |

---

## 🔍 Casos de Uso

### Caso 1: Destinatario Instala la App

1. Usuario recibe SMS con referencia
2. Instala PAYSAT y se registra con el mismo número
3. Al completar registro, app automáticamente valida la referencia
4. Fondos se acreditan instantáneamente
5. Usuario ve notificación: "Tienes $100.00 USD disponibles"

### Caso 2: Usuario Quiere Validar Manualmente

1. Usuario va a "Validar Referencia" en el menú
2. Ingresa código "4A8K"
3. App llama al endpoint `/api/validate-reference`
4. Backend verifica:
   - ✅ Referencia existe
   - ✅ No está expirada
   - ✅ Número de teléfono coincide
   - ✅ Estado = "active"
5. Si todo OK, fondos se acreditan

### Caso 3: Soporte al Cliente

```
Cliente: "No he recibido mi transferencia"
Soporte: "¿Recibió un SMS con una referencia?"
Cliente: "Sí, dice Ref: 4A8K"
Soporte: [Busca en Firestore la referencia 4A8K]
         - Encuentra transacción de $100 USD
         - Verifica estado: "active"
         - Confirma que el número coincide
         - Ayuda al cliente a validar la referencia
```

---

## 🚀 Endpoints del Backend

### 1. Validar Referencia

**POST** `/api/validate-reference`

**Request:**
```json
{
  "reference": "4A8K",
  "phoneNumber": "+593999999999"
}
```

**Response (Válida):**
```json
{
  "valid": true,
  "transactionUID": "550e8400-...",
  "amount": 100.50,
  "createdAt": "2026-03-14T10:30:00.000Z",
  "data": {
    "originUID": "user123",
    "metadata": {
      "destinationName": "Juan Pérez"
    }
  }
}
```

**Response (Inválida):**
```json
{
  "valid": false,
  "message": "Referencia no encontrada o expirada"
}
```

### 2. Marcar como Usada

**POST** `/api/mark-reference-used`

```json
{
  "reference": "4A8K"
}
```

---

## 📱 Implementación Recomendada en Flutter

### Auto-validación en Registro

```dart
class RegistrationService {
  Future<void> completeRegistration(String phoneNumber) async {
    // 1. Completar registro normal
    await _registerUser(phoneNumber);
    
    // 2. Verificar si hay referencias pendientes
    await _checkPendingReferences(phoneNumber);
  }
  
  Future<void> _checkPendingReferences(String phoneNumber) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/pending-references/$phoneNumber'),
        headers: {'Authorization': 'Bearer $token'},
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        if (data['hasPendingReferences']) {
          List<dynamic> references = data['references'];
          
          // Mostrar diálogo al usuario
          _showPendingReferencesDialog(references);
        }
      }
    } catch (e) {
      print('Error verificando referencias pendientes: $e');
    }
  }
  
  void _showPendingReferencesDialog(List<dynamic> references) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('🎉 ¡Tienes dinero esperándote!'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Hay ${references.length} transferencia(s) esperándote:'),
            SizedBox(height: 10),
            ...references.map((ref) => ListTile(
              leading: Icon(Icons.attach_money, color: Colors.green),
              title: Text('\$${ref['amount']} USD'),
              subtitle: Text('Ref: ${ref['reference']}'),
            )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _claimAllReferences(references);
            },
            child: Text('Reclamar Fondos'),
          ),
        ],
      ),
    );
  }
}
```

---

## 🎯 Beneficios para Fintech

### 1. **Confianza del Usuario**
- Código visible reduce sensación de spam
- Usuario puede verificar la legitimidad

### 2. **Reducción de Fraude**
- Solo el número correcto puede reclamar
- Referencias expiran automáticamente
- Historial completo de auditoría

### 3. **Mejor Soporte**
- Identificador único facilita búsqueda
- Soporte puede verificar estado en tiempo real
- Reduce tiempo de resolución de tickets

### 4. **Experiencia Mejorada**
- Auto-acreditación al registrarse
- No requiere pasos manuales complejos
- Transparencia total del proceso

### 5. **Cumplimiento Regulatorio**
- Trazabilidad completa de transacciones
- Auditoría de todos los movimientos
- Prevención de lavado de dinero (AML)

---

## 📈 Métricas Recomendadas

### Variables a Monitorear

```javascript
// Dashboard Analytics
{
  "references_generated": 1523,
  "references_claimed": 1401,
  "references_expired": 45,
  "average_claim_time": "2.3 días",
  "conversion_rate": "92%",
  "fraud_attempts": 3
}
```

### Alertas Importantes

1. **Alta tasa de referencias no reclamadas** → Problema con SMS delivery
2. **Intentos de fraude** → Múltiples intentos con diferentes números
3. **Referencias expiradas** → Usuarios no reciben SMS o no entienden proceso

---

## ⚙️ Configuración de Índices en Firestore

Para optimizar las consultas, crea estos índices compuestos:

```javascript
// Índice 1: Búsqueda por referencia y estado
Collection: PaySat_Security_References
Fields:
  - reference (Ascending)
  - status (Ascending)
  - createdAt (Descending)

// Índice 2: Búsqueda por número de teléfono
Collection: PaySat_Security_References
Fields:
  - destinationPhoneNumber (Ascending)
  - status (Ascending)
  - createdAt (Descending)

// Índice 3: Expiración
Collection: PaySat_Security_References
Fields:
  - status (Ascending)
  - expiresAt (Ascending)
```

---

## 🔧 Job de Limpieza Automática

Crea un cron job para limpiar referencias expiradas:

```javascript
// jobs/cleanup_expired_references.js
import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

export async function cleanupExpiredReferences() {
    try {
        const now = admin.firestore.Timestamp.now();
        
        const expiredRefs = await db.collection('PaySat_Security_References')
            .where('status', '==', 'active')
            .where('expiresAt', '<', now)
            .get();
        
        const batch = db.batch();
        
        expiredRefs.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: 'expired',
                expiredAt: now
            });
        });
        
        await batch.commit();
        
        console.log(`${expiredRefs.size} referencias marcadas como expiradas`);
    } catch (error) {
        console.error('Error limpiando referencias expiradas:', error);
    }
}
```

---

## 🎨 Ejemplos de SMS por Monto

### Monto Pequeño ($5 - $50)
```
PAYSAT: Recibiste $25.00 USD (Ref: 2B9K).
Instala la app para usarlo:
https://paysat.app/get
```

### Monto Medio ($50 - $200)
```
PAYSAT: Recibiste $150.00 USD (Ref: 7X4M).
Regístrate con este número para acreditarlo.
Instala: https://paysat.app/get
```

### Monto Grande ($200+)
```
PAYSAT: Recibiste $500.00 USD (Ref: 9K2T).
IMPORTANTE: Instala la app oficial desde:
https://play.google.com/store/apps/details?id=com.paysat.paysatapp

Regístrate con este número para acreditar tu dinero de forma segura.
```

---

## ✅ Checklist de Implementación

- [x] Crear servicio `security_reference_service.js`
- [x] Integrar generación en controller de transferencias
- [x] Configurar envío de SMS con referencia
- [ ] Crear endpoint `/api/validate-reference`
- [ ] Crear endpoint `/api/pending-references/:phone`
- [ ] Crear endpoint `/api/mark-reference-used`
- [ ] Implementar auto-validación en Flutter (registro)
- [ ] Crear pantalla manual de validación en Flutter
- [ ] Configurar índices en Firestore
- [ ] Crear job de limpieza de referencias expiradas
- [ ] Configurar monitoreo y alertas
- [ ] Documentar proceso para soporte al cliente
- [ ] Realizar pruebas end-to-end

---

## 🔐 Seguridad Adicional (Opcional)

### Nivel 2: Verificación por Email

Para montos grandes (>$1000), se puede agregar:

```javascript
// Enviar también email con la referencia
await sendEmail({
    to: destinationEmail, // Si se tiene
    subject: 'Transferencia PAYSAT - Verificación',
    body: `
        Has recibido $${amount} USD en PAYSAT.
        
        Referencia de seguridad: ${securityRef}
        Fecha: ${new Date().toLocaleString()}
        
        Si no esperabas esta transferencia, contacta soporte.
    `
});
```

### Nivel 3: Límites de Intentos

```javascript
// Bloquear después de 3 intentos fallidos
if (failedAttempts >= 3) {
    await lockReference(reference, '1 hour');
}
```

---

Este sistema proporciona una capa robusta de seguridad y confianza para las transferencias de PAYSAT, especialmente cuando los destinatarios aún no tienen cuenta en la plataforma.
