# 🚀 Despliegue Rápido - Sistema de Notificaciones

## ⚡ Pasos para Activar en Producción

### 1. Variables de Entorno
Verifica que `.env` contenga:
```bash
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token  
TWILIO_PHONE_NUMBER=tu_numero_twilio
```

### 2. Crear Índices en Firestore

**Opción A: Crear manualmente en Firebase Console**
1. Ve a Firebase Console → Firestore → Indexes
2. Crea los siguientes índices compuestos:

```
PaySat_Security_References:
  - reference (Asc) + status (Asc) + createdAt (Desc)
  - destinationPhoneNumber (Asc) + status (Asc) + createdAt (Desc)
  - status (Asc) + expiresAt (Asc)

PaySat_User_FCM_Tokens:
  - uid (Asc) + token (Asc)
  - uid (Asc) + updatedAt (Desc)
```

**Opción B: Esperar errores**
- Al hacer la primera consulta, Firestore te dará un link para crear el índice
- Haz clic y espera a que se complete (1-5 minutos)

### 3. Reiniciar el Servidor

```bash
# Si usas PM2
pm2 restart paysat_backend

# Si usas npm/node directamente
npm run start

# Si usas Docker
docker-compose restart backend
```

### 4. Verificar que Funciona

```bash
# Test 1: Health check
curl http://localhost:8704/health

# Test 2: Test de notificación (requiere token Firebase)
curl -X POST http://localhost:8704/api/fcm/test-notification \
  -H "Authorization: Bearer TU_FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Logs a Monitorear

Busca estos mensajes en los logs:
```
✅ "Notificaciones enviadas exitosamente"
✅ "SMS enviado a +593999999999"
✅ "Referencia 4A8K generada para transacción..."
❌ "Error enviando notificaciones:" (no afecta la transacción)
```

---

## 📱 Configuración Flutter (Después del Backend)

1. **Instalar paquetes:**
   ```yaml
   firebase_core: ^2.24.0
   firebase_messaging: ^14.7.0
   flutter_local_notifications: ^16.1.0
   ```

2. **Seguir guía completa:**
   Ver `FLUTTER_PUSH_NOTIFICATIONS_GUIDE.md`

3. **Implementar PushNotificationService**
   - Código completo incluido en la guía

---

## 🧪 Testing Rápido

### Test Completo de Transferencia

```bash
# 1. Guardar token FCM (desde app Flutter)
POST /api/fcm/save-token
{
  "token": "fcm_token_here",
  "platform": "android"
}

# 2. Hacer transferencia
POST /api/transfer/phone
{
  "amount": 10.00,
  "originUID": "tu-cuenta-uid",
  "destinationPhoneNumber": "+593999999999"
}

# 3. Verificar:
# - Push notification recibida en ambos dispositivos ✅
# - Si destino no tiene cuenta: SMS enviado ✅
# - Fondos transferidos correctamente ✅
```

---

## ⚠️ Problemas Comunes

### "Error: The query requires an index"
**Solución:** Crea los índices en Firestore (ver paso 2)

### "No hay tokens FCM para el usuario"
**Solución:** El usuario debe abrir la app Flutter y guardar su token

### "SMS no llega"
**Solución:** 
- Verifica credenciales Twilio en `.env`
- Revisa logs de Twilio Console
- Verifica que el número esté en formato internacional (+593...)

### "Notificación no llega en iOS"
**Solución:**
- Verifica que APNs esté configurado en Firebase
- Verifica certificados en Xcode
- Push notifications solo funcionan en dispositivos reales (no simulador)

---

## 📊 Métricas a Monitorear

1. **Firebase Cloud Messaging Console**
   - Tasa de entrega de notificaciones
   - Tasa de apertura

2. **Twilio Console**
   - SMS enviados
   - Costo acumulado
   - Errores de delivery

3. **Firestore**
   - Cantidad de referencias activas
   - Tasa de reclamo de referencias
   - Referencias expiradas sin usar

---

## 🎯 Checklist de Despliegue

- [ ] Variables de entorno configuradas
- [ ] Índices de Firestore creados
- [ ] Servidor reiniciado
- [ ] Health check exitoso
- [ ] Test de notificación funcionando
- [ ] Transfer test exitoso (con notificaciones)
- [ ] SMS test exitoso (a número sin cuenta)
- [ ] Logs sin errores críticos
- [ ] Documentación compartida con equipo
- [ ] Flutter app actualizada

---

**Tiempo estimado de activación:** 15-30 minutos (incluyendo creación de índices)

**¿Listo para producción?** ✅ Sí, una vez completado el checklist

---

## 🆘 Soporte

Si algo no funciona:
1. Revisa los logs del servidor
2. Verifica los índices en Firestore Console
3. Confirma las variables de entorno
4. Revisa el estado de servicios (Twilio, Firebase)

**Documentación completa:** Ver `IMPLEMENTATION_SUMMARY.md`
