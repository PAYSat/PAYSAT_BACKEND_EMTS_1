export function centsToAmount(amountInCents) {
  if (typeof amountInCents !== 'number') return null;
  return Number((amountInCents / 100).toFixed(2));
}
