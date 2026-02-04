// src/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

if (!admin.apps.length) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('❌ Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS. Configúrala con la ruta al archivo de credenciales o el JSON completo.');
  }
  
  let serviceAccount;
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  // Detectar si es JSON directo o una ruta de archivo
  if (credentials.trim().startsWith('{')) {
    // Es JSON directo (para producción/Render)
    serviceAccount = JSON.parse(credentials);
  } else {
    // Es una ruta de archivo (para desarrollo local)
    if (existsSync(credentials)) {
      serviceAccount = JSON.parse(readFileSync(credentials, 'utf8'));
    } else {
      throw new Error(`❌ El archivo de credenciales no existe: ${credentials}`);
    }
  }
  
  // ✅ Bucket correcto verificado con el script
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'paysatv2.firebasestorage.app';

  // console.log(`🔥 Firebase Storage Bucket: ${storageBucket}`);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
    storageBucket,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export { admin, db, bucket };
