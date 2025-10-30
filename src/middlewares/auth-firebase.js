// src/middlewares/auth-firebase.js
import { admin } from '../config/firebase.js';

export async function authFirebaseRequired(req, res, next) {
  if (req.path === '/health') return next();
  if (req.path.startsWith('/webhooks')) return next();

  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: 'No token' });

  try {
    const decoded = await admin.auth().verifyIdToken(token, true);

    const pid = process.env.FIREBASE_PROJECT_ID;
    if (pid) {
      const audOk = decoded.aud === pid;
      const issOk = decoded.iss === `https://securetoken.google.com/${pid}`;
      if (!audOk || !issOk) throw new Error('aud/iss inválidos');
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role:
        decoded.role ??
        decoded['https://claims/role'] ??
        (decoded.claims && decoded.claims.role) ??
        (decoded.customClaims && decoded.customClaims.role) ??
        null,
      claims: decoded
    };

    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'ID token inválido', details: e.message });
  }
}
