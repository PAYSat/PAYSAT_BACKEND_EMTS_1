import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

const now = () => new Date();

export function walletAssetRef(uid, asset) {
  const assetU = String(asset).toUpperCase();
  return db.collection(COL.CRYPTO_WALLETS).doc(uid).collection('assets').doc(assetU);
}

/**
 * Asegura doc del asset y lo mantiene consistente:
 * total = available + escrow
 */
export async function upsertWalletAssetTx(tx, uid, asset, { available, escrow }) {
  const ref = walletAssetRef(uid, asset);

  const a = Number(available || 0);
  const e = Number(escrow || 0);
  const total = Number((a + e).toFixed(2));

  // ✅ Importante:
  // NO hacemos tx.get aquí, para evitar el error:
  // "Firestore transactions require all reads to be executed before all writes."
  // Con merge:true, si el doc no existe, se crea sin necesidad de leerlo.
  tx.set(
    ref,
    {
      uid,
      asset: String(asset).toUpperCase(),
      available: Number(a.toFixed(2)),
      escrow: Number(e.toFixed(2)),
      total,
      updatedAt: now(),
    },
    { merge: true }
  );
}

/**
 * Lectura simple (para un endpoint opcional / debug)
 */
export async function getWalletAsset(uid, asset) {
  const snap = await walletAssetRef(uid, asset).get();
  return snap.exists ? snap.data() : null;
}
