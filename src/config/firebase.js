// src/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!admin.apps.length) {
  // ✅ Cargar credenciales desde el archivo
  const serviceAccountPath = join(__dirname, '../../etc/secrets/firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
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
