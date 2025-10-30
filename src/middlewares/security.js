import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function applySecurity(app) {
  app.use(helmet());

  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const max = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);

  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false
  });

  // Aplica rate-limit a todo excepto webhooks
  app.use((req, res, next) => {
    if (req.path.startsWith('/webhooks')) return next();
    return limiter(req, res, next);
  });
}
