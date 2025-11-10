import { centsToAmount } from '../utils/cents_to_amount.js';
import { getFeesByCharge, getFeesByPaymentIntent } from '../services/stripe_fees_service.js';

function mapFeePayload(bt) {
  if (!bt) return null;
  return {
    balanceTransactionId: bt.id,
    currency: bt.currency,
    fee_cents: bt.fee,
    fee: centsToAmount(bt.fee),
    net_cents: bt.net,
    net: centsToAmount(bt.net),
    fee_details: (bt.fee_details || []).map(fd => ({
      type: fd.type,
      amount_cents: fd.amount,
      amount: centsToAmount(fd.amount),
      description: fd.description
    }))
  };
}

export async function feesByCharge(req, res) {
  try {
    const { chargeId } = req.params;
    const { balanceTransaction: bt } = await getFeesByCharge(chargeId);

    if (!bt) {
      return res.status(202).json({
        ok: false,
        message: 'Balance transaction aún no disponible. Reintenta cuando recibas charge.updated.'
      });
    }

    return res.json({
      ok: true,
      source: 'charge',
      chargeId,
      ...mapFeePayload(bt)
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}

export async function feesByIntent(req, res) {
  try {
    const { paymentIntentId } = req.params;
    const { charge, balanceTransaction: bt } = await getFeesByPaymentIntent(paymentIntentId);

    if (!charge) {
      return res.status(202).json({
        ok: false,
        message: 'PaymentIntent aún no tiene latest_charge. Confirma el pago o reintenta más tarde.'
      });
    }

    if (!bt) {
      return res.status(202).json({
        ok: false,
        message: 'Balance transaction aún no disponible. Espera charge.updated y reintenta.'
      });
    }

    return res.json({
      ok: true,
      source: 'payment_intent',
      paymentIntentId,
      chargeId: charge.id,
      ...mapFeePayload(bt)
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}
