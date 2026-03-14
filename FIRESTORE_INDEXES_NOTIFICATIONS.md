# Índices de Firestore para Sistema de Notificaciones y Referencias

Este documento lista todos los índices compuestos necesarios en Firestore para el correcto funcionamiento del sistema de notificaciones push y referencias de seguridad.

## 📊 Índices Requeridos

### 1. PaySat_Security_References

#### Índice 1: Búsqueda por referencia y estado
```
Colección: PaySat_Security_References
Campos:
  - reference (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

**Uso:** Validar referencias y obtener las más recientes primero.

---

#### Índice 2: Búsqueda por número de teléfono
```
Colección: PaySat_Security_References
Campos:
  - destinationPhoneNumber (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

**Uso:** Obtener referencias pendientes para un número de teléfono específico.

---

#### Índice 3: Gestión de expiración
```
Colección: PaySat_Security_References
Campos:
  - status (Ascending)
  - expiresAt (Ascending)
```

**Uso:** Job de limpieza para marcar referencias expiradas.

---

### 2. PaySat_User_FCM_Tokens

#### Índice 1: Búsqueda por usuario y token
```
Colección: PaySat_User_FCM_Tokens
Campos:
  - uid (Ascending)
  - token (Ascending)
```

**Uso:** Verificar si un token ya existe para un usuario.

---

#### Índice 2: Listado de tokens por usuario
```
Colección: PaySat_User_FCM_Tokens
Campos:
  - uid (Ascending)
  - updatedAt (Descending)
```

**Uso:** Obtener todos los tokens de un usuario ordenados por más reciente.

---

## 🔧 Cómo Crear los Índices

### Opción 1: Firebase Console (Manual)

1. Ve a **Firebase Console** → **Firestore Database** → **Indexes**
2. Clic en **Create Index**
3. Selecciona la colección
4. Agrega los campos con sus ordenamientos
5. Clic en **Create**

### Opción 2: Firebase CLI (Automático)

Crea un archivo `firestore.indexes.json` en la raíz de tu proyecto:

```json
{
  "indexes": [
    {
      "collectionGroup": "PaySat_Security_References",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reference", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Security_References",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "destinationPhoneNumber", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_Security_References",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_User_FCM_Tokens",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "token", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "PaySat_User_FCM_Tokens",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Luego ejecuta:
```bash
firebase deploy --only firestore:indexes
```

### Opción 3: Esperar el Error (Automático)

Cuando ejecutes una consulta que necesite un índice, Firestore te dará un error con un link directo para crear el índice. Simplemente haz clic en el link.

---

## ⚠️ Notas Importantes

1. **Tiempo de Creación**: Los índices pueden tardar varios minutos en estar listos (especialmente si ya tienes datos).

2. **Estado del Índice**: Puedes verificar el estado en Firebase Console → Firestore → Indexes.

3. **Índices Simples**: Firestore crea automáticamente índices simples (un solo campo). Los que listamos aquí son índices **compuestos** (múltiples campos).

4. **Costo**: Los índices compuestos consumen espacio de almacenamiento adicional, pero son esenciales para el rendimiento.

5. **Testing**: Después de crear los índices, espera a que su estado sea "Enabled" antes de ejecutar las consultas.

---

## 🧪 Verificación

Para verificar que los índices están funcionando correctamente, ejecuta estas consultas en tu código:

### Test 1: Validar referencia
```javascript
const test1 = await db.collection('PaySat_Security_References')
    .where('reference', '==', '4A8K')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
    
console.log('Test 1:', test1.size, 'documentos encontrados');
```

### Test 2: Referencias pendientes por teléfono
```javascript
const test2 = await db.collection('PaySat_Security_References')
    .where('destinationPhoneNumber', '==', '+593999999999')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .get();
    
console.log('Test 2:', test2.size, 'documentos encontrados');
```

### Test 3: Tokens FCM por usuario
```javascript
const test3 = await db.collection('PaySat_User_FCM_Tokens')
    .where('uid', '==', 'test-user-id')
    .orderBy('updatedAt', 'desc')
    .get();
    
console.log('Test 3:', test3.size, 'documentos encontrados');
```

Si estas consultas funcionan sin errores, los índices están correctamente configurados.

---

## 📋 Checklist de Configuración

- [ ] Crear índice 1 de PaySat_Security_References (reference + status + createdAt)
- [ ] Crear índice 2 de PaySat_Security_References (destinationPhoneNumber + status + createdAt)
- [ ] Crear índice 3 de PaySat_Security_References (status + expiresAt)
- [ ] Crear índice 1 de PaySat_User_FCM_Tokens (uid + token)
- [ ] Crear índice 2 de PaySat_User_FCM_Tokens (uid + updatedAt)
- [ ] Verificar que todos los índices estén en estado "Enabled"
- [ ] Ejecutar tests de verificación
- [ ] Documentar en bitácora del proyecto

---

## 🔍 Monitoreo de Índices

Puedes monitorear el uso de índices en:
**Firebase Console → Firestore → Usage**

Métricas importantes:
- Número de lecturas de índices
- Tiempo de respuesta de consultas
- Tamaño de almacenamiento de índices

---

## 🚨 Solución de Problemas

### Error: "The query requires an index"

**Solución:** Haz clic en el link proporcionado en el error o crea el índice manualmente.

### Error: "Index creation failed"

**Posibles causas:**
- Nombre de colección incorrecto
- Campos no existen en la colección
- Ya existe un índice idéntico

**Solución:** Verifica los nombres y elimina índices duplicados.

### Consultas lentas después de crear índices

**Posibles causas:**
- El índice aún se está construyendo (verifica el estado)
- Estás usando los campos en diferente orden al índice

**Solución:** Espera a que el índice esté "Enabled" y verifica el orden de los campos.

---

Este documento debe ser actualizado cada vez que se agreguen nuevas consultas que requieran índices compuestos.
