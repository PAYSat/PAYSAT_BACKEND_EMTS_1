import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';

import { applyCors } from './middlewares/cors.js';
import { applySecurity } from './middlewares/security.js';
import { authFirebaseRequired } from './middlewares/auth-firebase.js';

// Rutas existentes
import authRouter from './routes/paysat_users.js';
import stripeWebhookRouter from './webhooks/stripeWebhook.js';
import stripeAdminRouter from './routes/stripe.js';
import stripeFeesRoutes from './routes/stripe_fees.routes.js';
import usersFirebaseRouter from './routes/paysat_users.js';
import queriesFirebaseRouter from './routes/paysat_queries.js';

// 🔥 NUEVAS rutas para Stripe Issuing
import issuingCardsRouter from './routes/issuing_cards.js';
import issuingEphemeralKeysRouter from './routes/issuing_ephemeral_keys.js';
import secureCardsViewRouter from './routes/secure_cards_view.js';

const app = express();

// ⚠️ Stripe requiere raw body SOLO en su ruta de webhook:
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON para el resto de rutas
app.use(express.json({ limit: '2mb' }));

applyCors(app);
applySecurity(app);

// Logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 🔒 Autenticación global por Firebase ID Token
app.use(authFirebaseRequired);

// ====== Rutas protegidas ======
app.use('/auth', authRouter);

// 🔥 Issuing (tarjetas virtuales + ephemeral keys + vista segura)
app.use('/api/cards', issuingCardsRouter);                   // POST /api/cards/virtual
app.use('/api/issuing/ephemeral-keys', issuingEphemeralKeysRouter); // POST para Issuing Elements

// Rutas Stripe admin (ya existentes)
app.use('/api/stripe', stripeAdminRouter);
app.use('/api/stripe/fees', stripeFeesRoutes);

// Consultas usuarios Firebase (paysat_users)
app.use('/api/paysat/users', usersFirebaseRouter);

// Consultas generales (paysat_queries)
app.use('/api/paysat/queries', queriesFirebaseRouter);

// ====== Webhooks Stripe (raw body) ======
app.use('/webhooks/stripe', stripeWebhookRouter);

// ====== Vista segura de la tarjeta (Issuing Elements) ======
app.use('/secure-cards', secureCardsViewRouter);

// ====== Health pública ======
app.get('/health', (_req, res) => res.json({ ok: true, msg: 'up' }));

const port = process.env.PORT || 8704;
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});



// import 'dotenv/config';
// import express from 'express';
// import morgan from 'morgan';

// import { applyCors } from './middlewares/cors.js';
// import { applySecurity } from './middlewares/security.js';
// import { authFirebaseRequired } from './middlewares/auth-firebase.js';

// import authRouter from './routes/paysat_users.js';
// import stripeWebhookRouter from './webhooks/stripeWebhook.js';



// const app = express();

// // ⚠️ Stripe requiere raw body SOLO en su ruta:
// app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// // JSON para el resto de rutas
// app.use(express.json({ limit: '2mb' }));

// applyCors(app);
// applySecurity(app);

// // Logs
// app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// // 🔒 Autenticación global por Firebase ID Token (excluye health/webhooks dentro del middleware)
// app.use(authFirebaseRequired);

// // ====== Rutas protegidas ======
// app.use('/auth', authRouter);
// // Aquí cuelga tus otros routers protegidos, por ejemplo:
// // import marqetaRouter from './routes/marqeta.js';
// // import paymentsRouter from './routes/payments.js';
// // app.use('/api/marqeta', marqetaRouter);
// // app.use('/api/payments', paymentsRouter);
// import marqetaRouter from './routes/marqeta.js';
// import paymentsRouter from './routes/payments.js';
// import marqetaWebhooksRouter from './routes/marqeta_webhooks.js';
// import stripAdminRouter from './routes/stripe.js';
// import usersFirebaseRouter from './routes/paysat_users.js';
// import queriesFirebaseRouter from './routes/paysat_queries.js';
// import stripeFeesRoutes from './routes/stripe_fees.routes.js';

// app.use('/webhooks', marqetaWebhooksRouter);
// app.use('/api/marqeta', marqetaRouter);
// app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
// app.use('/api/stripe', stripAdminRouter); // <-- Stripe admin endpoints
// app.use('/api/stripe/fees', stripeFeesRoutes);
// app.use('/api/paysat/users', usersFirebaseRouter); // <-- Firebase users endpoints
// app.use('/api/paysat/queries', queriesFirebaseRouter); // <-- Firebase queries endpoints

// // ====== Webhooks (sin bearer; verificación por firma propia) ======
// app.use('/webhooks/stripe', stripeWebhookRouter);

// // ====== Health pública ======
// app.get('/health', (_req, res) => res.json({ ok: true, msg: 'up' }));

// const port = process.env.PORT || 8704;
// app.listen(port, () => {
//   console.log(`API running on http://localhost:${port}`);
// });


// // import 'dotenv/config';
// // import express from 'express';
// // import cors from 'cors';
// // import morgan from 'morgan';

// // import './config/firebase.js';                   // Inicializa Firebase Admin
// // import marqetaRouter from './routes/marqeta.js';
// // import paymentsRouter from './routes/payments.js';
// // import marqetaWebhooksRouter from './routes/marqeta_webhooks.js';
// // import stripeWebhookRouter from './webhooks/stripeWebhook.js';
// // import stripAdminRouter from './routes/stripe.js';

// // const app = express();
// // app.use(cors());

// // // Middleware especial para webhooks de Stripe (requiere raw body)
// // app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// // // Middleware general para JSON
// // app.use(express.json({ limit: '1mb' }));
// // app.use(morgan('dev'));

// // // Rutas API
// // app.use('/api/marqeta', marqetaRouter);
// // app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
// // app.use('/api/stripe', stripAdminRouter); // <-- Stripe admin endpoints

// // // Webhooks (Marqeta general, JIT, Circle)
// // app.use('/webhooks', marqetaWebhooksRouter);

// // // Webhooks Stripe
// // app.use('/webhooks/stripe', stripeWebhookRouter);

// // const port = process.env.PORT || 8704;
// // app.listen(port, () => {
// //   console.log(`Backend listening on :${port}`);
// // });

// // app.get('/health', (_req, res) => res.json({ok:true, msg:'up'}));
