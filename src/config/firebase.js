// src/config/firebase.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    // ✅ Mejor fallar aquí con un mensaje claro, antes de que falle el upload
    throw new Error('FIREBASE_STORAGE_BUCKET no está definido en .env (ej: tu-proyecto.appspot.com)');
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DB_URL,
    storageBucket, // ✅ necesario para Storage (URL pública por token)
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket(); // ✅ usa storageBucket configurado arriba

export { admin, db, bucket };
