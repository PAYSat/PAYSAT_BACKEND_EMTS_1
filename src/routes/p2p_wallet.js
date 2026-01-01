// src/routes/p2p_wallet.js
import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';

const router = Router();
const now = () => new Date();

function normalizeAsset(a) {
  return String(a || '').trim().toUpperCase();
}

function toMoney2(n) {
  const x = Number(n || 0);
  return Number(x.toFixed(2));
}

/**
 * POST /api/p2p/wallet/init
 * Body opcional:
 * { "assets": ["USDT","BTC","ETH","PS-USD"] }
 *
 * Idempotente:
 * - asegura PaySat_Crypto_Wallets/{uid}
 * - asegura PaySat_Crypto_Wallets/{uid}/assets/{ASSET}
 */
router.post('/wallet/init', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, message: 'No auth' });

    const defaultAssets = ['USDT', 'BTC', 'ETH', 'PS-USD'];
    const bodyAssets = Array.isArray(req.body?.assets) ? req.body.assets : null;

    const assets = (bodyAssets?.length ? bodyAssets : defaultAssets)
      .map(normalizeAsset)
      .filter(Boolean);

    // dedupe manteniendo orden
    const seen = new Set();
    const finalAssets = [];
    for (const a of assets) {
      if (!seen.has(a)) {
        seen.add(a);
        finalAssets.push(a);
      }
    }

    const walletRef = db.collection(COL.CRYPTO_WALLETS).doc(uid);
    const assetRefs = finalAssets.map((a) => walletRef.collection('assets').doc(a));

    await db.runTransaction(async (tx) => {
      // ✅ 1) LEER TODO PRIMERO
      const walletSnapPromise = tx.get(walletRef);
      const assetSnapPromises = assetRefs.map((r) => tx.get(r));
      const [walletSnap, ...assetSnaps] = await Promise.all([walletSnapPromise, ...assetSnapPromises]);

      // ✅ 2) ESCRIBIR TODO DESPUÉS (ya no hacemos tx.get luego de escribir)
      const walletData = {
        uid,
        updatedAt: now(),
      };
      if (!walletSnap.exists) walletData.createdAt = now();

      tx.set(walletRef, walletData, { merge: true });

      for (let i = 0; i < finalAssets.length; i++) {
        const asset = finalAssets[i];
        const ref = assetRefs[i];
        const snap = assetSnaps[i];

        // defaults
        const available = 0;
        const escrow = 0;
        const total = toMoney2(available + escrow);

        if (!snap.exists) {
          tx.set(
            ref,
            {
              uid,
              asset,
              available: toMoney2(available),
              escrow: toMoney2(escrow),
              total,
              createdAt: now(),
              updatedAt: now(),
            },
            { merge: true }
          );
        } else {
          // si ya existe, NO pisamos createdAt ni valores actuales
          // solo aseguramos campos mínimos (si quieres, puedes remover esta parte)
          tx.set(
            ref,
            {
              uid,
              asset,
              updatedAt: now(),
            },
            { merge: true }
          );
        }
      }
    });

    return res.json({
      ok: true,
      uid,
      assets: finalAssets,
      createdOrEnsured: finalAssets,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'init wallet failed', details: e.message });
  }
});

/**
 * GET /api/p2p/wallet/me
 * Debug útil para ver los assets actuales del usuario.
 */
router.get('/wallet/me', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, message: 'No auth' });

    const snap = await db.collection(COL.CRYPTO_WALLETS).doc(uid).collection('assets').get();
    const assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, uid, assets });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'wallet/me failed', details: e.message });
  }
});

export default router;
