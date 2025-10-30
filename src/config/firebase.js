// src/config/firebase.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

const db = admin.firestore();          // opcional si lo usas
const bucket = admin.storage?.bucket?.(); // opcional si configuras Storage

export { admin, db, bucket };
