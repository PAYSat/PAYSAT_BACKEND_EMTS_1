// src/utils/topupFees.js

/**
 * Calcula los fees totales para una recarga:
 * - Fee Stripe = 2.9% + $0.30
 * - Fee PAYSAT = $1
 * - Total = amount + fees
 */
export function calculateTopupFees(amount) {
  const stripePercent = 0.029; // 2.9%
  const stripeFixed = 0.30;    // $0.30
  const paysatFee = 1.0;       // $1 PAYSAT fijo

  const stripeFee = (amount * stripePercent) + stripeFixed;
  const total = amount + stripeFee + paysatFee;

  return {
    stripeFee: parseFloat(stripeFee.toFixed(2)),
    paysatFee,
    total: parseFloat(total.toFixed(2)),
  };
}

/**
 * Convierte dólares a centavos enteros (Stripe)
 */
export function toCents(amount) {
  return Math.round(parseFloat(amount.toFixed(2)) * 100);
}
