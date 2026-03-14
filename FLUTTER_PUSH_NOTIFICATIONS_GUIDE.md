# Configuración de Notificaciones Push en Flutter para Transferencias Móviles

## 📋 Resumen

Este documento explica cómo configurar el frontend de Flutter para recibir y manejar las notificaciones push de transferencias móviles implementadas en el backend.

---

## 🔧 Dependencias Necesarias

Agrega las siguientes dependencias en tu `pubspec.yaml`:

```yaml
dependencies:
  firebase_core: ^2.24.0
  firebase_messaging: ^14.7.0
  flutter_local_notifications: ^16.1.0
```

---

## 📱 Configuración por Plataforma

### Android

1. **Configurar Firebase en Android**

En `android/app/build.gradle`:
```gradle
android {
    compileSdkVersion 33
    
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 33
    }
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

2. **Agregar google-services.json**
   - Descarga el archivo `google-services.json` desde Firebase Console
   - Colócalo en `android/app/`

3. **Configurar el AndroidManifest.xml**

En `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    
    <application>
        <!-- Configuración del canal de notificaciones -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="paysat_transfers" />
            
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/notification_icon" />
    </application>
</manifest>
```

### iOS

1. **Configurar Firebase en iOS**
   - Descarga el archivo `GoogleService-Info.plist` desde Firebase Console
   - Colócalo en `ios/Runner/`

2. **Habilitar Push Notifications en Xcode**
   - Abre el proyecto en Xcode: `ios/Runner.xcworkspace`
   - Ve a Signing & Capabilities
   - Agrega "Push Notifications"
   - Agrega "Background Modes" y marca "Remote notifications"

3. **Configurar AppDelegate.swift**

En `ios/Runner/AppDelegate.swift`:
```swift
import UIKit
import Flutter
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FirebaseApp.configure()
    GeneratedPluginRegistrant.register(with: self)
    
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self
    }
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  override func application(_ application: UIApplication,
                           didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
  }
}
```

---

## 💻 Implementación en Flutter

### 1. Servicio de Notificaciones Push

Crea un archivo `lib/services/push_notification_service.dart`:

```dart
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Handler para mensajes en segundo plano
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Handling background message: ${message.messageId}');
}

class PushNotificationService {
  static FirebaseMessaging messaging = FirebaseMessaging.instance;
  static FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();
  static String? token;

  // Callback para cuando se toca una notificación
  static Function(Map<String, dynamic>)? onNotificationTap;

  // Inicializar el servicio
  static Future<void> initialize() async {
    // Configurar handler para mensajes en segundo plano
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Solicitar permisos
    await _requestPermissions();

    // Inicializar notificaciones locales
    await _initializeLocalNotifications();

    // Obtener el token FCM
    token = await messaging.getToken();
    print('FCM Token: $token');

    // Escuchar cambios en el token
    messaging.onTokenRefresh.listen((newToken) {
      token = newToken;
      print('FCM Token actualizado: $newToken');
      _saveTokenToBackend(newToken);
    });

    // Escuchar mensajes cuando la app está en primer plano
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Escuchar cuando se abre la app desde una notificación
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Verificar si la app se abrió desde una notificación
    RemoteMessage? initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // Guardar token en el backend
    if (token != null) {
      await _saveTokenToBackend(token!);
    }
  }

  // Solicitar permisos de notificaciones
  static Future<void> _requestPermissions() async {
    if (Platform.isIOS) {
      NotificationSettings settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );
      print('Permisos iOS: ${settings.authorizationStatus}');
    } else if (Platform.isAndroid) {
      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
  }

  // Inicializar notificaciones locales
  static Future<void> _initializeLocalNotifications() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    final DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    final InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload != null && onNotificationTap != null) {
          // Parsear el payload y llamar al callback
          // Aquí puedes navegar a la pantalla correspondiente
          print('Notificación tocada con payload: $payload');
        }
      },
    );

    // Crear canal de notificación en Android
    if (Platform.isAndroid) {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'paysat_transfers', // ID debe coincidir con el backend
        'Transferencias PAYSAT',
        description: 'Notificaciones de transferencias y pagos móviles',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  // Manejar mensajes en primer plano
  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    print('Mensaje recibido en primer plano: ${message.messageId}');
    
    RemoteNotification? notification = message.notification;
    AndroidNotification? android = message.notification?.android;

    // Mostrar notificación local en Android
    if (notification != null && android != null) {
      await flutterLocalNotificationsPlugin.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            'paysat_transfers',
            'Transferencias PAYSAT',
            channelDescription: 'Notificaciones de transferencias y pagos móviles',
            icon: '@mipmap/ic_launcher',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: message.data.toString(),
      );
    }

    // Procesar datos de la notificación
    _processNotificationData(message.data);
  }

  // Manejar cuando se toca una notificación
  static void _handleNotificationTap(RemoteMessage message) {
    print('Notificación tocada: ${message.messageId}');
    
    if (onNotificationTap != null) {
      onNotificationTap!(message.data);
    }
    
    _processNotificationData(message.data);
  }

  // Procesar datos de la notificación
  static void _processNotificationData(Map<String, dynamic> data) {
    String? type = data['type'];
    
    switch (type) {
      case 'MOBILE_TRANSFER_SENT':
        print('Transferencia enviada: \${data['amount']} USD');
        // Aquí puedes actualizar el estado de la app o navegar a una pantalla
        break;
        
      case 'MOBILE_TRANSFER_RECEIVED':
        print('Transferencia recibida: \${data['amount']} USD');
        // Actualizar balance, mostrar alerta, etc.
        break;
        
      case 'MOBILE_TRANSFER_SENT_NON_PAYSAT':
        print('Transferencia enviada a usuario sin cuenta PaySat');
        print('Referencia de seguridad: \${data['securityReference']}');
        break;
        
      default:
        print('Tipo de notificación desconocido: $type');
    }
  }

  // Guardar token en el backend
  static Future<void> _saveTokenToBackend(String token) async {
    try {
      // Aquí debes hacer la llamada a tu API para guardar el token
      // Ejemplo:
      // final response = await http.post(
      //   Uri.parse('https://tu-backend.com/api/fcm/save-token'),
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': 'Bearer $userToken',
      //   },
      //   body: jsonEncode({
      //     'token': token,
      //     'platform': Platform.isIOS ? 'ios' : 'android',
      //   }),
      // );
      
      print('Token guardado en el backend exitosamente');
    } catch (e) {
      print('Error guardando token en el backend: $e');
    }
  }

  // Eliminar token del backend (al cerrar sesión)
  static Future<void> deleteTokenFromBackend() async {
    try {
      if (token == null) return;
      
      // Aquí debes hacer la llamada a tu API para eliminar el token
      // Ejemplo:
      // final response = await http.delete(
      //   Uri.parse('https://tu-backend.com/api/fcm/delete-token'),
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': 'Bearer $userToken',
      //   },
      //   body: jsonEncode({'token': token}),
      // );
      
      print('Token eliminado del backend exitosamente');
    } catch (e) {
      print('Error eliminando token del backend: $e');
    }
  }
}
```

### 2. Inicializar en main.dart

```dart
import 'package:firebase_core/firebase_core.dart';
import 'services/push_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inicializar Firebase
  await Firebase.initializeApp();
  
  // Inicializar servicio de notificaciones push
  await PushNotificationService.initialize();
  
  // Configurar callback para cuando se toca una notificación
  PushNotificationService.onNotificationTap = (data) {
    // Aquí puedes navegar a la pantalla correspondiente
    print('Navegar según tipo: ${data['type']}');
    // Ejemplo: navigatorKey.currentState?.pushNamed('/transfers');
  };
  
  runApp(MyApp());
}
```

### 3. Endpoint para Guardar/Eliminar Tokens FCM

En tu backend (Express), asegúrate de tener estos endpoints:

**Guardar token:**
```javascript
// POST /api/fcm/save-token
router.post('/save-token', authenticateFirebase, async (req, res) => {
    const { token, platform } = req.body;
    const uid = req.user.uid;
    
    try {
        const docRef = db.collection('PaySat_User_FCM_Tokens').doc();
        await docRef.set({
            uid,
            token,
            platform,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        res.json({ ok: true, message: 'Token guardado exitosamente' });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
```

**Eliminar token:**
```javascript
// DELETE /api/fcm/delete-token
router.delete('/delete-token', authenticateFirebase, async (req, res) => {
    const { token } = req.body;
    const uid = req.user.uid;
    
    try {
        const snapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .where('token', '==', token)
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        res.json({ ok: true, message: 'Token eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
```

---

## 🎯 Manejo de Notificaciones en la UI

### Actualizar Balance Automáticamente

Cuando recibes una notificación de transferencia recibida, debes actualizar el balance del usuario:

```dart
class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    
    // Configurar listener para notificaciones en primer plano
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (message.data['type'] == 'MOBILE_TRANSFER_RECEIVED') {
        // Actualizar balance
        _refreshBalance();
        
        // Mostrar alerta opcional
        _showTransferReceivedDialog(message.data);
      }
    });
  }
  
  Future<void> _refreshBalance() async {
    // Llamar a tu API para obtener el balance actualizado
    // setState(() { balance = newBalance; });
  }
  
  void _showTransferReceivedDialog(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('💰 Transferencia Recibida'),
        content: Text(
          'Has recibido \$${data['amount']} USD de ${data['originName']}'
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Ver Detalles'),
          ),
        ],
      ),
    );
  }
}
```

---

## 🔒 Sistema de Referencias de Seguridad

### Caso Especial: Destinatario sin Cuenta PaySat

Cuando el usuario destino NO tiene cuenta PaySat, recibe un SMS con una referencia de seguridad (ej: "Ref: 4A8K").

**Implementar pantalla de validación de referencia:**

```dart
class ValidateReferenceScreen extends StatefulWidget {
  @override
  _ValidateReferenceScreenState createState() => _ValidateReferenceScreenState();
}

class _ValidateReferenceScreenState extends State<ValidateReferenceScreen> {
  final TextEditingController _referenceController = TextEditingController();
  bool _isLoading = false;
  
  Future<void> _validateReference() async {
    setState(() => _isLoading = true);
    
    try {
      final response = await http.post(
        Uri.parse('https://tu-backend.com/api/validate-reference'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $userToken',
        },
        body: jsonEncode({
          'reference': _referenceController.text.toUpperCase(),
          'phoneNumber': currentUserPhone,
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['valid']) {
        // Mostrar información de la transferencia
        _showTransferInfo(data);
      } else {
        _showError(data['message']);
      }
    } catch (e) {
      _showError('Error al validar la referencia');
    } finally {
      setState(() => _isLoading = false);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Validar Referencia')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text(
              '¿Recibiste un SMS con una referencia de transferencia?',
              style: TextStyle(fontSize: 16),
            ),
            SizedBox(height: 20),
            TextField(
              controller: _referenceController,
              decoration: InputDecoration(
                labelText: 'Código de Referencia',
                hintText: 'Ej: 4A8K',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.characters,
              maxLength: 6,
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isLoading ? null : _validateReference,
              child: _isLoading
                  ? CircularProgressIndicator()
                  : Text('Validar'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## ✅ Checklist de Implementación

- [ ] Instalar dependencias: `firebase_core`, `firebase_messaging`, `flutter_local_notifications`
- [ ] Configurar Firebase para Android (google-services.json)
- [ ] Configurar Firebase para iOS (GoogleService-Info.plist)
- [ ] Configurar permisos en AndroidManifest.xml
- [ ] Configurar capacidades en iOS (Push Notifications, Background Modes)
- [ ] Implementar `PushNotificationService`
- [ ] Inicializar servicio en `main.dart`
- [ ] Crear endpoints en backend para guardar/eliminar tokens FCM
- [ ] Implementar lógica de actualización de balance en notificaciones
- [ ] Implementar pantalla de validación de referencia de seguridad
- [ ] Probar notificaciones en primer plano, segundo plano y app cerrada
- [ ] Probar en dispositivos Android e iOS reales

---

## 🧪 Testing

### Probar Notificaciones desde Firebase Console

1. Ve a Firebase Console → Cloud Messaging
2. Clic en "Enviar primer mensaje"
3. Ingresa título y cuerpo
4. En "Target", selecciona "Dispositivo único" y pega tu FCM token
5. En "Datos adicionales", agrega:
   - `type`: `MOBILE_TRANSFER_RECEIVED`
   - `amount`: `100.50`
   - `originName`: `Test User`
6. Envía la notificación

---

## 📚 Recursos Adicionales

- [Firebase Messaging Flutter](https://firebase.flutter.dev/docs/messaging/overview/)
- [Local Notifications](https://pub.dev/packages/flutter_local_notifications)
- [Background Messages](https://firebase.flutter.dev/docs/messaging/usage/#background-messages)

---

## ⚠️ Notas Importantes

1. **Tokens FCM**: Los tokens pueden cambiar, asegúrate de escuchar el evento `onTokenRefresh` y actualizar el backend.

2. **Permisos**: En Android 13+, necesitas solicitar el permiso `POST_NOTIFICATIONS` explícitamente.

3. **Colección de Tokens**: Asegúrate de que la colección en Firestore sea `PaySat_User_FCM_Tokens` (debe coincidir con el backend).

4. **Limpieza**: Al cerrar sesión, elimina el token FCM del backend.

5. **Testing**: Prueba en dispositivos reales, especialmente para iOS (los simuladores no reciben notificaciones push reales).

6. **Canal de Android**: El ID del canal (`paysat_transfers`) debe coincidir exactamente con el configurado en el backend.
