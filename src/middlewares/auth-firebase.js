// src/middlewares/auth-firebase.js
import { admin } from '../config/firebase.js';

export async function authFirebaseRequired(req, res, next) {
  if (req.path === '/health') return next();
  if (req.path.startsWith('/webhooks')) return next();
  if (req.path === '/auth/phone/send-otp') return next();
  if (req.path === '/auth/phone/verify-otp') return next();
  if (req.path === '/api/temp/subir-datos') return next();
  if (req.path === '/api/temp/codigos-uuid') return next();

  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: 'No token' });

  try {
    // true => revisa revocación (buena práctica para admin)
    const decoded = await admin.auth().verifyIdToken(token, true);

    const pid = process.env.FIREBASE_PROJECT_ID;
    if (pid) {
      const audOk = decoded.aud === pid;
      const issOk = decoded.iss === `https://securetoken.google.com/${pid}`;
      if (!audOk || !issOk) throw new Error('aud/iss inválidos');
    }

    // Custom claim recomendado: { role: 'ADMIN' }
    // (También soportamos un claim namespaced si lo usaras)
    const role =
      decoded.role ??
      decoded['https://claims.paysat/role'] ??   // opcional si tú lo adoptas
      null;

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role,
      claims: decoded
    };

    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'ID token inválido', details: e.message });
  }
}


// // src/middlewares/auth-firebase.js
// import { admin } from '../config/firebase.js';

// export async function authFirebaseRequired(req, res, next) {
//   if (req.path === '/health') return next();
//   if (req.path.startsWith('/webhooks')) return next();

//   const hdr = req.headers.authorization || '';
//   const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
//   if (!token) return res.status(401).json({ ok: false, message: 'No token' });

//   try {
//     const decoded = await admin.auth().verifyIdToken(token, true);

//     const pid = process.env.FIREBASE_PROJECT_ID;
//     if (pid) {
//       const audOk = decoded.aud === pid;
//       const issOk = decoded.iss === `https://securetoken.google.com/${pid}`;
//       if (!audOk || !issOk) throw new Error('aud/iss inválidos');
//     }

//     req.user = {
//       uid: decoded.uid,
//       email: decoded.email ?? null,
//       role:
//         decoded.role ??
//         decoded['https://claims/role'] ??
//         (decoded.claims && decoded.claims.role) ??
//         (decoded.customClaims && decoded.customClaims.role) ??
//         null,
//       claims: decoded
//     };

//     return next();
//   } catch (e) {
//     return res.status(401).json({ ok: false, message: 'ID token inválido', details: e.message });
//   }
// }
