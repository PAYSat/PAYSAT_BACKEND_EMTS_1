import { admin } from '../config/firebase.js';

export const me = async (req, res) => {
  try {
    const userReq = req.user || {};
    if (!userReq.uid) {
      return res.status(401).json({ ok: false, message: 'No auth' });
    }

    // ¡OJO! Aquí siempre usa admin.auth(), JAMÁS db.auth()
    const userRecord = await admin.auth().getUser(userReq.uid);

    return res.json({
      ok: true,
      data: {
        uid: userReq.uid,
        email: userReq.email ?? userRecord.email ?? null,
        role:
          userReq.role ??
          (userRecord.customClaims && userRecord.customClaims.role) ??
          null,
        claims: {
          ...(userReq.claims || {}),
          ...(userRecord.customClaims || {})
        },
        userRecord: {
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          phoneNumber: userRecord.phoneNumber,
          disabled: userRecord.disabled,
          emailVerified: userRecord.emailVerified,
          metadata: {
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime
          }
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Error /auth/me', details: e.message });
  }
};
