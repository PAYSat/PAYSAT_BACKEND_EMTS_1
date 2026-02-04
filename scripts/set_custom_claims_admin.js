import admin from 'firebase-admin';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS');
  console.error('   Configura GOOGLE_APPLICATION_CREDENTIALS con el JSON completo de las credenciales');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
if (!uid) {
  console.error('Uso: node scripts/set_custom_claims_admin.js <UID>');
  process.exit(1);
}

await admin.auth().setCustomUserClaims(uid, { role: 'ADMIN' });

console.log(`✅ Listo: UID ${uid} ahora tiene role=ADMIN`);
process.exit(0);


// Ejecutar en terminal:
// export FIREBASE_SERVICE_ACCOUNT_PATH="ruta/a/tu/serviceAccount.json" && node scripts/set_custom_claims_admin.js UID_DEL_USUARIO_FIREBASE

// ó por separado:
// export FIREBASE_SERVICE_ACCOUNT_PATH="ruta/a/tu/serviceAccount.json"
// node scripts/set_custom_claims_admin.js UID_DEL_USUARIO_FIREBASE

// Si todo está bien verás:
// ✅ Listo: UID ... ahora tiene role=ADMIN