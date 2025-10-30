import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';

import { applyCors } from './middlewares/cors.js';
import { applySecurity } from './middlewares/security.js';
import { authFirebaseRequired } from './middlewares/auth-firebase.js';

import authRouter from './routes/users.js';
import stripeWebhookRouter from './webhooks/stripeWebhook.js';



const app = express();

// ⚠️ Stripe requiere raw body SOLO en su ruta:
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON para el resto de rutas
app.use(express.json({ limit: '2mb' }));

applyCors(app);
applySecurity(app);

// Logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 🔒 Autenticación global por Firebase ID Token (excluye health/webhooks dentro del middleware)
app.use(authFirebaseRequired);

// ====== Rutas protegidas ======
app.use('/auth', authRouter);
// Aquí cuelga tus otros routers protegidos, por ejemplo:
// import marqetaRouter from './routes/marqeta.js';
// import paymentsRouter from './routes/payments.js';
// app.use('/api/marqeta', marqetaRouter);
// app.use('/api/payments', paymentsRouter);
import marqetaRouter from './routes/marqeta.js';
import paymentsRouter from './routes/payments.js';
import marqetaWebhooksRouter from './routes/marqeta_webhooks.js';
import stripAdminRouter from './routes/stripe.js';
import usersFirebaseRouter from './routes/users.js';
app.use('/webhooks', marqetaWebhooksRouter);
app.use('/api/marqeta', marqetaRouter);
app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
app.use('/api/stripe', stripAdminRouter); // <-- Stripe admin endpoints
app.use('/api/users', usersFirebaseRouter); // <-- Firebase users endpoints


// ====== Webhooks (sin bearer; verificación por firma propia) ======
app.use('/webhooks/stripe', stripeWebhookRouter);

// ====== Health pública ======
app.get('/health', (_req, res) => res.json({ ok: true, msg: 'up' }));

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});


// import 'dotenv/config';
// import express from 'express';
// import cors from 'cors';
// import morgan from 'morgan';

// import './config/firebase.js';                   // Inicializa Firebase Admin
// import marqetaRouter from './routes/marqeta.js';
// import paymentsRouter from './routes/payments.js';
// import marqetaWebhooksRouter from './routes/marqeta_webhooks.js';
// import stripeWebhookRouter from './webhooks/stripeWebhook.js';
// import stripAdminRouter from './routes/stripe.js';

// const app = express();
// app.use(cors());

// // Middleware especial para webhooks de Stripe (requiere raw body)
// app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// // Middleware general para JSON
// app.use(express.json({ limit: '1mb' }));
// app.use(morgan('dev'));

// // Rutas API
// app.use('/api/marqeta', marqetaRouter);
// app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
// app.use('/api/stripe', stripAdminRouter); // <-- Stripe admin endpoints

// // Webhooks (Marqeta general, JIT, Circle)
// app.use('/webhooks', marqetaWebhooksRouter);

// // Webhooks Stripe
// app.use('/webhooks/stripe', stripeWebhookRouter);

// const port = process.env.PORT || 8080;
// app.listen(port, () => {
//   console.log(`Backend listening on :${port}`);
// });

// app.get('/health', (_req, res) => res.json({ok:true, msg:'up'}));
