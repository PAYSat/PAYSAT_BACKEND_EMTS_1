import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import './config/firebase.js';                   // Inicializa Firebase Admin
import marqetaRouter from './routes/marqeta.js';
import paymentsRouter from './routes/payments.js';
import marqetaWebhooksRouter from './routes/marqeta_webhooks.js';
import stripeWebhookRouter from './webhooks/stripeWebhook.js';
import stripAdminRouter from './routes/stripe.js';

const app = express();
app.use(cors());

// Middleware especial para webhooks de Stripe (requiere raw body)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Middleware general para JSON
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Rutas API
app.use('/api/marqeta', marqetaRouter);
app.use('/api/payments', paymentsRouter);   //<--- Stripe payments endpoints
app.use('/api/stripe', stripAdminRouter); // <-- Stripe admin endpoints

// Webhooks (Marqeta general, JIT, Circle)
app.use('/webhooks', marqetaWebhooksRouter);

// Webhooks Stripe
app.use('/webhooks/stripe', stripeWebhookRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});

app.get('/health', (_req, res) => res.json({ok:true, msg:'up'}));
