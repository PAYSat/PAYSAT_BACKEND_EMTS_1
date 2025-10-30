import cors from 'cors';

export function applyCors(app) {
  const list = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // Postman/cURL
        if (!list.length || list.includes(origin)) return cb(null, true);
        return cb(new Error('Origin no permitido'));
      }
    })
  );
}
