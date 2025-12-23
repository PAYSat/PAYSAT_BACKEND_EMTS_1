import { admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();

/**
 * Obtiene una wallet por su ID
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 */
export async function getWalletById(req, res) {
  try {
    const { id } = req.params;
    const doc = await db.collection('PaySat_Wallets').doc(id).get();
    if (doc.exists) {
      return res.json({
        ok: true,
        data: {
          id: doc.id,
          ...doc.data()
        }
      });
    }
    // Devolver estructura vacía si no existe
    return res.json({
      ok: true,
      data: {
        id: id,
        balance: 0,
        coins: [],
        userId: null,
        createdAt: null
      }
    });
  } catch (e) {
    console.error('Error fetching wallet by id:', e);
    return res.status(500).json({
      ok: false,
      error: e.message,
      data: {
        id: req.params.id,
        balance: 0,
        coins: [],
        userId: null,
        createdAt: null
      }
    });
  }
}

/**
 * Obtiene todas las wallets de un usuario
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 */
export async function getWalletsByUserId(req, res) {
  try {
    const { userId } = req.params;
    const querySnapshot = await db
      .collection('PaySat_Wallets')
      .where('userId', '==', userId)
      .get();
    
    if (querySnapshot.empty) {
      // Devolver array con estructura vacía si no hay wallets
      return res.json({
        ok: true,
        data: [{
          id: null,
          balance: 0,
          coins: [],
          userId: userId,
          createdAt: null
        }]
      });
    }
    
    const wallets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.json({
      ok: true,
      data: wallets
    });
  } catch (e) {
    console.error('Error fetching wallets by userId:', e);
    return res.status(500).json({
      ok: false,
      error: e.message,
      data: [{
        id: null,
        balance: 0,
        coins: [],
        userId: req.params.userId,
        createdAt: null
      }]
    });
  }
}

/**
 * Crea una nueva wallet
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 */
export async function createWallet(req, res) {
  try {
    const walletId = `wallet_${uuidv4()}`;
    await db.collection('PaySat_Wallets').doc(walletId).set({
      id: walletId,
      coins: req.body.coins || [],
      userId: req.body.userId,
      balance: req.body.balance || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return res.json({
      ok: true,
      walletId: walletId,
      message: 'Wallet created successfully'
    });
  } catch (e) {
    console.error('Error creating wallet:', e);
    return res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}

/**
 * Actualiza las monedas de una wallet y recalcula el balance total
 * @param {string} walletId - ID de la wallet
 * @param {Array<Object>} coins - Array de objetos coin
 * @returns {Promise<void>}
 */
export async function updateWalletCoins(walletId, coins) {
  try {
    // Calcular la suma total de purchaseAmountUSD de todas las monedas
    let totalBalance = 0.0;
    for (const coin of coins) {
      const amount = coin.purchaseAmountUSD;
      if (typeof amount === 'number') {
        totalBalance += amount;
      }
    }
    
    // Actualizar coins y balance en Firebase
    await db.collection('PaySat_Wallets').doc(walletId).update({
      coins: coins,
      balance: totalBalance
    });
  } catch (e) {
    console.error('Error updating wallet coins:', e);
    throw e;
  }
}

/**
 * Actualiza el balance de una wallet
 * @param {string} walletId - ID de la wallet
 * @param {number} newBalance - Nuevo balance
 * @returns {Promise<void>}
 */
export async function updateWalletBalance(walletId, newBalance) {
  try {
    await db.collection('PaySat_Wallets').doc(walletId).update({
      balance: newBalance
    });
  } catch (e) {
    console.error('Error updating wallet balance:', e);
    throw e;
  }
}
