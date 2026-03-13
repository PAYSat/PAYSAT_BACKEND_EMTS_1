# Índices Recomendados para Firestore - PaySat_Ledger

Este documento contiene los índices compuestos recomendados para optimizar las consultas en la colección `PaySat_Ledger`.

## Índices Compuestos

### 1. Consultas por Cuenta Débito y Fecha
```
Collection: PaySat_Ledger
Fields: 
  - debit_account (Ascending)
  - timestamp (Descending)
```

**Uso**: Obtener todas las transacciones donde una cuenta es debitada, ordenadas por fecha más reciente primero.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50);
```

### 2. Consultas por Cuenta Crédito y Fecha
```
Collection: PaySat_Ledger
Fields:
  - credit_account (Ascending)
  - timestamp (Descending)
```

**Uso**: Obtener todas las transacciones donde una cuenta es acreditada, ordenadas por fecha.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('credit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50);
```

### 3. Consultas por Tipo de Transacción y Fecha
```
Collection: PaySat_Ledger
Fields:
  - type (Ascending)
  - timestamp (Descending)
```

**Uso**: Obtener todas las transacciones de un tipo específico, ordenadas por fecha.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('type', '==', 'TRANSFER')
  .orderBy('timestamp', 'desc')
  .limit(100);
```

### 4. Consultas por Moneda y Fecha
```
Collection: PaySat_Ledger
Fields:
  - currency (Ascending)
  - timestamp (Descending)
```

**Uso**: Obtener todas las transacciones en una moneda específica.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('currency', '==', 'USD')
  .orderBy('timestamp', 'desc')
  .limit(100);
```

### 5. Consultas por Cuenta Débito, Tipo y Fecha
```
Collection: PaySat_Ledger
Fields:
  - debit_account (Ascending)
  - type (Ascending)
  - timestamp (Descending)
```

**Uso**: Obtener transacciones específicas de una cuenta por tipo.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .where('type', '==', 'FEE')
  .orderBy('timestamp', 'desc');
```

### 6. Consultas por Cuenta Crédito, Tipo y Fecha
```
Collection: PaySat_Ledger
Fields:
  - credit_account (Ascending)
  - type (Ascending)
  - timestamp (Descending)
```

**Uso**: Similar al anterior pero para cuentas acreditadas.

### 7. Consultas por Rango de Fecha
```
Collection: PaySat_Ledger
Fields:
  - timestamp (Ascending)
```

**Uso**: Consultas básicas por rango de fechas.

**Consulta de ejemplo**:
```javascript
db.collection('PaySat_Ledger')
  .where('timestamp', '>=', '2024-01-01T00:00:00Z')
  .where('timestamp', '<=', '2024-12-31T23:59:59Z')
  .orderBy('timestamp', 'asc');
```

## Cómo Crear los Índices

### Opción 1: Firebase Console (Recomendado)

1. Ve a Firebase Console: https://console.firebase.google.com
2. Selecciona tu proyecto PaySat
3. Ve a Firestore Database > Índices
4. Crea cada índice compuesto manualmente con los campos especificados arriba

### Opción 2: Desde un Error de Consulta

Firebase automáticamente te proporcionará un link para crear el índice cuando ejecutes una consulta que lo requiera:

```
Error: The query requires an index. You can create it here: https://console.firebase.google.com/...
```

### Opción 3: Firebase CLI (firestore.indexes.json)

Crea un archivo `firestore.indexes.json` en la raíz del proyecto:

```json
{
  "indexes": [
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "debit_account", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "credit_account", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currency", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "debit_account", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Ledger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "credit_account", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Luego despliega con:
```bash
firebase deploy --only firestore:indexes
```

## Monitoreo de Índices

### Verificar Uso de Índices

Puedes ver qué índices se están usando en Firebase Console:
1. Ve a Firestore Database > Índices
2. Revisa el estado de cada índice (Building/Enabled)
3. Monitorea el uso en la sección de métricas

### Índices No Utilizados

Si un índice no se usa después de 30 días, considera eliminarlo para ahorrar costos de almacenamiento.

## Costos de Índices

Los índices compuestos tienen costo de almacenamiento en Firestore:
- Cada índice compuesto almacena una copia adicional de los campos indexados
- El costo es proporcional al número de documentos y campos indexados
- Revisa la documentación de precios de Firebase para más detalles

## Mejores Prácticas

1. **Crear índices según demanda**: No crees todos los índices de una vez. Créalos cuando los necesites.

2. **Monitorear rendimiento**: Usa Cloud Monitoring para ver qué consultas son lentas.

3. **Evitar sobre-indexación**: Demasiados índices pueden aumentar costos y ralentizar escrituras.

4. **Revisar periódicamente**: Elimina índices que ya no se usen.

5. **Testing**: Prueba las consultas en un proyecto de desarrollo antes de crear índices en producción.

## Consultas de Ejemplo Optimizadas

### Obtener transacciones de un usuario (débito y crédito)
```javascript
// Esta consulta NO requiere índice compuesto adicional
// porque usa dos consultas simples y las combina en el cliente
const debitSnapshot = await db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();

const creditSnapshot = await db.collection('PaySat_Ledger')
  .where('credit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();

// Combinar y ordenar en el cliente
const allTransactions = [...debitSnapshot.docs, ...creditSnapshot.docs]
  .sort((a, b) => b.data().timestamp.localeCompare(a.data().timestamp))
  .slice(0, 50);
```

### Obtener balance actual de una cuenta
```javascript
const snapshot = await db.collection('PaySat_Ledger')
  .where('debit_account', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(1)
  .get();

const latestBalance = snapshot.docs[0]?.data()?.balance_after_debit || 0;
```

### Reportes por periodo
```javascript
const startDate = '2024-01-01T00:00:00Z';
const endDate = '2024-12-31T23:59:59Z';

const snapshot = await db.collection('PaySat_Ledger')
  .where('timestamp', '>=', startDate)
  .where('timestamp', '<=', endDate)
  .where('type', '==', 'TRANSFER')
  .orderBy('timestamp', 'asc')
  .get();
```

## Referencias

- [Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Best Practices for Firestore](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Pricing](https://firebase.google.com/pricing)

---

**Última actualización**: 11 de marzo de 2026
