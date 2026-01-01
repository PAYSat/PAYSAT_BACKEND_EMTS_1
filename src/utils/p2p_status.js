export const OFFER_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  DELETED: 'DELETED',
};

export const ORDER_STATUS = {
  CREATED: 'CREATED',      // escrow OK, esperando pago
  PAID: 'PAID',            // comprador marcó "pagado"
  RELEASED: 'RELEASED',    // cripto liberada
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
  EXPIRED: 'EXPIRED',
};
