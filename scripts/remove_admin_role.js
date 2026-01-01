import admin from 'firebase-admin';
import fs from 'fs';

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
if (!uid) {
  console.error('Uso: node scripts/remove_admin_role.js <UID>');
  process.exit(1);
}

await admin.auth().setCustomUserClaims(uid, { role: 'USER' });
await admin.auth().revokeRefreshTokens(uid);

console.log(`✅ UID ${uid} ahora es USER`);
process.exit(0);


// Ejecutar en terminal:
// export FIREBASE_SERVICE_ACCOUNT_PATH="ruta/a/tu/serviceAccount.json" && node scripts/remove_admin_role.js UID_DEL_USUARIO_FIREBASE