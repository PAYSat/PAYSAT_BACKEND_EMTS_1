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
import paymentsRouter from './routes/payments.js';
import stripeFeesRoutes from './routes/stripe_fees_routes.js';
import usersFirebaseRouter from './routes/paysat_users.js';
import queriesFirebaseRouter from './routes/paysat_queries.js';
import stripeTopupsRouter from './routes/stripeTopups.js';
import cryptoCurrenciesRouter from './routes/crypto_coingecko.js';
import walletsRouter from './routes/wallets_routes.js';

// TESTING
import issuingTestRouter from "./routes/issuingTest.js";
import adminCardholdersRouter from "./routes/admin_cardholders.js";


// 🔥 NUEVAS rutas para Stripe Issuing
import stripeIssuingAuthWebhook from './webhooks/stripeIssuingAuthWebhook.js';
import issuingCardsRouter from './routes/issuing_cards.js';
import issuingEphemeralKeysRouter from './routes/issuing_ephemeral_keys.js';
import secureCardsViewRouter from './routes/secure_cards_view.js';

const app = express();

applyCors(app);
applySecurity(app);

// Logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ====== Webhooks (ANTES de autenticación y ANTES de JSON parser) ======
// Los webhooks manejan su propio raw body parser internamente
app.use('/webhooks/stripe', stripeWebhookRouter);
app.use('/webhooks/stripe-issuing-auth', stripeIssuingAuthWebhook);

// JSON para el resto de rutas
app.use(express.json({ limit: '2mb' }));

// 🔒 Autenticación global por Firebase ID Token
app.use(authFirebaseRequired);

// ====== Rutas protegidas ======
app.use('/auth', authRouter);

// Rutas Crypto Coingecko
app.use('/api/crypto', cryptoCurrenciesRouter);
app.use('/api/wallets', walletsRouter);

// 🔥 Issuing (tarjetas virtuales + ephemeral keys + vista segura)
app.use('/api/cards', issuingCardsRouter);                   // POST /api/cards/virtual
app.use('/api/issuing/ephemeral-keys', issuingEphemeralKeysRouter); // POST para Issuing Elements

// TESTING Issuing
app.use("/api/issuing", issuingTestRouter);
app.use("/api/admin/cardholders", adminCardholdersRouter);

// Rutas Stripe admin (ya existentes)
app.use('/api/stripe', stripeAdminRouter);
app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
app.use('/api/stripe/fees', stripeFeesRoutes);
app.use('/api/topups', stripeTopupsRouter);

// Consultas usuarios Firebase (paysat_users)
app.use('/api/paysat/users', usersFirebaseRouter);

// Consultas generales (paysat_queries)
app.use('/api/paysat/queries', queriesFirebaseRouter);

// ====== Vista segura de la tarjeta (Issuing Elements) ======
app.use('/secure-cards', secureCardsViewRouter);

// ====== Health pública ======
app.get('/health', (_req, res) => res.json({ ok: true, msg: 'up' }));

const port = process.env.PORT || 8704;
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
