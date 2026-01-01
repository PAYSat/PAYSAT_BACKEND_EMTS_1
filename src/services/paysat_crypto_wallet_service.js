import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { v4 as uuidv4 } from 'uuid';

function now() { return new Date(); }

export async function getOrCreateWalletTx(tx, uid, asset) {
  const assetU = String(asset).toUpperCase();

  // ✅ RUTA: PaySat_Crypto_Wallets/{uid}/assets/{ASSET}
  const ref = db
    .collection(COL.CRYPTO_WALLETS)
    .doc(uid)
    .collection('assets')
    .doc(assetU);

  const snap = await tx.get(ref);

  // ⚠️ Importante: NO hacemos writes aquí.
  // Si esta función crease el doc (tx.set) y luego el flujo hiciera otro tx.get,
  // Firestore lanzará: "all reads must be executed before all writes".
  if (!snap.exists) {
    throw new Error(`Wallet asset no existe: ${uid}/assets/${assetU}`);
  }

  return { ref, data: snap.data() };
}

// --- lo demás igual ---
export function assertAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('amount inválido');
  return Math.round(n * 100) / 100;
}

export function to2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export async function ledgerWriteTx(tx, entry) {
  const id = entry.id || uuidv4();
  const ref = db.collection(COL.LEDGER).doc(id);
  tx.set(ref, {
    id,
    ...entry,
    createdAt: entry.createdAt || now(),
  });
  return id;
}
