# PaySat Backend - Deploy Guide

## 🚀 Deploy en Render

### Variables de Entorno Requeridas

Configura estas variables en el dashboard de Render:

#### 🔧 **Configuración General**
```bash
NODE_ENV=production
PORT=10000
BASE_URL=https://tu-app.onrender.com
```

#### 🌐 **CORS**
```bash
CORS_ORIGIN=https://tu-frontend.com,https://tu-app.vercel.app
```

#### 🔒 **Firebase**
```bash
FIREBASE_DB_URL=tu_firebase_db_url_aqui
# Firebase credentials se configuran vía archivo JSON
```

#### 💳 **Marqeta**
```bash
MARQETA_BASE=https://sandbox-api.marqeta.com/v3
MARQETA_APP_TOKEN=tu_marqeta_app_token
MARQETA_ACCESS_TOKEN=tu_marqeta_access_token
JIT_SHARED_SECRET=tu_jit_secret
ENTITY_SECRET_CIPHERTEXT=tu_entity_secret
```

#### 💰 **Stripe**
```bash
STRIPE_SECRET_KEY=sk_live_... (o sk_test_... para testing)
STRIPE_PUBLISHABLE_KEY=pk_live_... (o pk_test_... para testing)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2023-10-16
```

#### 📧 **Email**
```bash
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASSWORD=tu_app_password_gmail
SUPPORT_EMAIL=soporte@paysat.com
```

#### 🔢 **Rate Limiting**
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

### 📁 Firebase Service Account

1. Ve a Firebase Console → Project Settings → Service Accounts
2. Genera una nueva clave privada (JSON)
3. En Render, ve a Environment → Files
4. Sube el archivo como `firebase-service-account.json`
5. Configura la variable: `GOOGLE_APPLICATION_CREDENTIALS=/opt/render/project/src/firebase-service-account.json`

### 🔗 Endpoints Disponibles

- `GET /health` - Health check
- `POST /api/paysat/users/*` - Gestión de usuarios
- `POST /api/marqeta/*` - Integración Marqeta
- `POST /api/payments/*` - Pagos Stripe
- `POST /webhooks/stripe` - Webhooks Stripe
- `POST /webhooks/marqeta` - Webhooks Marqeta

### 🛠 Build Commands

```bash
# Install dependencies
npm install

# Start production server
npm start

# Development (local)
npm run dev
```

### 📋 Pre-Deploy Checklist

- [ ] Todas las variables de entorno configuradas
- [ ] Firebase Service Account JSON subido
- [ ] CORS_ORIGIN apunta al dominio del frontend
- [ ] Webhooks de Stripe configurados con la URL de Render
- [ ] Webhooks de Marqeta configurados
- [ ] Rate limiting configurado apropiadamente

### 🔍 Troubleshooting

1. **Error 503**: Verifica que el puerto sea 10000 o usa `process.env.PORT`
2. **CORS Error**: Agrega el dominio frontend a `CORS_ORIGIN`
3. **Firebase Error**: Verifica que el archivo JSON esté en la ruta correcta
4. **Webhook Error**: Verifica los secrets y endpoints en Stripe/Marqeta