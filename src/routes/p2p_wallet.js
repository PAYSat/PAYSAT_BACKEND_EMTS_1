// src/routes/p2p_wallet.js
import { Router } from 'express';
import { db } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { coinGeckoBaseUrl } from '../config/crypto_coingecko.js';

const router = Router();
const now = () => new Date();

function normalizeAsset(a) {
  return String(a || '').trim().toUpperCase();
}

function toMoney2(n) {
  const x = Number(n || 0);
  return Number(x.toFixed(2));
}

// Mapeo de símbolos a IDs de CoinGecko
const COINGECKO_IDS = {
  'USDT': 'tether',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
};

// URL fija para PS-USD
const PS_USD_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/paysatv2.firebasestorage.app/o/assets%2Fps-usd%2Fps-usd.png?alt=media&token=30b575fa-6205-4548-91cd-e93d0a657dd3';

/**
 * Obtiene la imagen de una crypto desde CoinGecko
 */
async function getCryptoImage(asset) {
  try {
    // Caso especial: PS-USD
    if (asset === 'PS-USD') {
      return PS_USD_IMAGE;
    }

    // Buscar en CoinGecko
    const coinId = COINGECKO_IDS[asset];
    if (!coinId) {
      console.warn(`No CoinGecko ID found for ${asset}`);
      return null;
    }

    const response = await fetch(`${coinGeckoBaseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
    
    if (!response.ok) {
      console.error(`CoinGecko error for ${asset}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.image?.large || data.image?.small || data.image?.thumb || null;
  } catch (error) {
    console.error(`Error fetching image for ${asset}:`, error.message);
    return null;
  }
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

    // Obtener imágenes de las cryptos
    const imagePromises = finalAssets.map(asset => getCryptoImage(asset));
    const images = await Promise.all(imagePromises);
    const imageMap = {};
    finalAssets.forEach((asset, i) => {
      imageMap[asset] = images[i];
    });

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
        const image = imageMap[asset] || null;

        if (!snap.exists) {
          tx.set(
            ref,
            {
              uid,
              asset,
              available: toMoney2(available),
              escrow: toMoney2(escrow),
              total,
              image,
              createdAt: now(),
              updatedAt: now(),
            },
            { merge: true }
          );
        } else {
          // si ya existe, actualizamos la imagen pero NO pisamos valores de balance
          tx.set(
            ref,
            {
              uid,
              asset,
              image,
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
