import admin from 'firebase-admin';

// Firebase Admin toma credenciales desde GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

export const db = admin.firestore();
