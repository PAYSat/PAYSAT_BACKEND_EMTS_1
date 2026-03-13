import { db } from '../config/firebase.js';
import { getOrCreateWalletTx, ledgerWriteTx, assertAmount, to2 } from './paysat_crypto_wallet_service.js';
import { upsertWalletAssetTx } from './paysat_crypto_wallet_store_service.js';
import { recordP2PEscrowLockEntry, recordP2PEscrowReleaseEntry, recordLedgerEntry } from './ledger_service.js';

function now() { return new Date(); }

/**
 * Bloquea escrow desde el wallet del vendedor
 */
export async function lockEscrow({ sellerUid, asset, amount, orderId }) {
  const amt = assertAmount(amount);
  const assetU = String(asset).toUpperCase();

  await db.runTransaction(async (tx) => {
    const { ref, data } = await getOrCreateWalletTx(tx, sellerUid, assetU);

    const available = Number(data.available || 0);
    const escrow = Number(data.escrow || 0);

    if (available < amt) {
      throw new Error(`Fondos insuficientes: available=${available}, requerido=${amt}`);
    }

    tx.update(ref, {
      available: to2(available - amt),
      escrow: to2(escrow + amt),
      updatedAt: now(),
    });

    await upsertWalletAssetTx(tx, sellerUid, assetU, {
      available: to2(available - amt),
      escrow: to2(escrow + amt),
    });

    await ledgerWriteTx(tx, {
      type: 'P2P_ESCROW_LOCK',
      orderId,
      uid: sellerUid,
      asset: assetU,
      amount: amt,
      meta: { from: 'available', to: 'escrow' },
      createdAt: now(),
    });

    // ✅ Registrar en PaySat_Ledger (nuevo ledger unificado)
    // Nota: No se puede usar tx dentro de recordP2PEscrowLockEntry porque ya estamos en una transacción
    // Se registrará después de la transacción
  });

  // ✅ Registrar en PaySat_Ledger después de la transacción exitosa
  try {
    await recordP2PEscrowLockEntry({
      user_account: sellerUid,
      amount: amt,
      asset: assetU,
      balance_after: null, // Se calculará en la consulta si es necesario
      escrow_after: null,
      order_id: orderId,
      meta: {
        transaction_type: 'p2p_escrow_lock',
        from: 'available',
        to: 'escrow',
        order_id: orderId
      }
    });
  } catch (ledgerError) {
    console.error('⚠️ Error registrando en PaySat_Ledger (lock escrow):', ledgerError);
    // No lanzamos el error para no afectar la transacción principal
  }

  return true;
}

/**
 * Libera escrow del vendedor y acredita al comprador
 */
export async function releaseEscrow({ sellerUid, buyerUid, asset, amount, orderId }) {
  const amt = assertAmount(amount);
  const assetU = String(asset).toUpperCase();

  await db.runTransaction(async (tx) => {
    const sellerW = await getOrCreateWalletTx(tx, sellerUid, assetU);
    const buyerW  = await getOrCreateWalletTx(tx, buyerUid, assetU);

    const sellerEscrow = Number(sellerW.data.escrow || 0);
    const sellerAvailable = Number(sellerW.data.available || 0);
    
    if (sellerEscrow < amt) {
      throw new Error(`Escrow insuficiente: escrow=${sellerEscrow}, requerido=${amt}`);
    }

    const buyerAvailable = Number(buyerW.data.available || 0);
    const buyerEscrow = Number(buyerW.data.escrow || 0);

    tx.update(sellerW.ref, {
      escrow: to2(sellerEscrow - amt),
      updatedAt: now(),
    });

    tx.update(buyerW.ref, {
      available: to2(buyerAvailable + amt),
      updatedAt: now(),
    });

    await upsertWalletAssetTx(tx, sellerUid, assetU, {
      available: to2(sellerAvailable),
      escrow: to2(sellerEscrow - amt),
    });

    await upsertWalletAssetTx(tx, buyerUid, assetU, {
      available: to2(buyerAvailable + amt),
      escrow: to2(buyerEscrow),
    });


    await ledgerWriteTx(tx, {
      type: 'P2P_ESCROW_RELEASE',
      orderId,
      uid: sellerUid,
      counterpartyUid: buyerUid,
      asset: assetU,
      amount: amt,
      meta: { from: 'seller.escrow', to: 'buyer.available' },
      createdAt: now(),
    });
  });

  // ✅ Registrar en PaySat_Ledger después de la transacción exitosa
  try {
    await recordP2PEscrowReleaseEntry({
      from_account: sellerUid,
      to_account: buyerUid,
      amount: amt,
      asset: assetU,
      balance_after_to: null,
      order_id: orderId,
      meta: {
        transaction_type: 'p2p_escrow_release',
        from: 'seller.escrow',
        to: 'buyer.available',
        order_id: orderId
      }
    });
  } catch (ledgerError) {
    console.error('⚠️ Error registrando en PaySat_Ledger (release escrow):', ledgerError);
  }

  return true;
}

// Devuelve escrow al available del seller (cuando el admin decide que buyer no pagó o evidencia insuficiente)
export async function refundEscrowToSeller({ sellerUid, asset, amount, orderId }) {
  const amt = assertAmount(amount);
  const assetU = String(asset).toUpperCase();

  await db.runTransaction(async (tx) => {
    const sellerW = await getOrCreateWalletTx(tx, sellerUid, assetU);

    const escrow = Number(sellerW.data.escrow || 0);
    const available = Number(sellerW.data.available || 0);

    if (escrow < amt) throw new Error(`Escrow insuficiente para refund: escrow=${escrow}, requerido=${amt}`);

    tx.update(sellerW.ref, {
      escrow: to2(escrow - amt),
      available: to2(available + amt),
      updatedAt: now(),
    });

    await upsertWalletAssetTx(tx, sellerUid, assetU, {
      available: to2(available + amt),
      escrow: to2(escrow - amt),
    });


    await ledgerWriteTx(tx, {
      type: 'P2P_ESCROW_REFUND_SELLER',
      orderId,
      uid: sellerUid,
      asset: assetU,
      amount: amt,
      meta: { from: 'escrow', to: 'available' },
      createdAt: now(),
    });
  });

  // ✅ Registrar en PaySat_Ledger después de la transacción exitosa
  try {
    await recordLedgerEntry({
      type: 'P2P_ESCROW_REFUND',
      debit_account: 'PAYSAT_P2P_ESCROW',
      credit_account: sellerUid,
      amount: amt,
      currency: assetU,
      balance_after_debit: null,
      balance_after_credit: null,
      description: `P2P Escrow Refund to Seller - Order ${orderId}`,
      meta: {
        transaction_type: 'p2p_escrow_refund_seller',
        from: 'escrow',
        to: 'available',
        order_id: orderId
      }
    });
  } catch (ledgerError) {
    console.error('⚠️ Error registrando en PaySat_Ledger (refund escrow):', ledgerError);
  }

  return true;
}