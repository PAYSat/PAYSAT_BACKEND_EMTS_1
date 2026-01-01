export const COL = {
  WALLETS: 'PaySat_Crypto_Wallets',
  LEDGER: 'PaySat_Crypto_Ledger',

  P2P_OFFERS: 'PaySat_Crypto_P2P_Offers',
  P2P_ORDERS: 'PaySat_Crypto_P2P_Orders',
  P2P_MESSAGES: 'PaySat_Crypto_P2P_Messages',
  P2P_DISPUTES: 'PaySat_Crypto_P2P_Disputes',
  P2P_RATINGS: 'PaySat_Crypto_P2P_Ratings',
  USER_FCM_TOKENS: 'PaySat_Crypto_UserFCMTokens',
  ADMIN_FCM_TOKENS: 'PaySat_Crypto_AdminFCMTokens',
  CRYPTO_WALLETS: 'PaySat_Crypto_Wallets',
};

// Helpers de IDs
export function walletDocId(uid, asset) {
  return `${uid}_${String(asset).toUpperCase()}`;
}
