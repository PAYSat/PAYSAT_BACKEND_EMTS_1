import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { marqeta } from '../config/marqeta.js';

const router = Router();

router.get('/balance', async (_req, res) => {
  try {
    const bal = await stripe.balance.retrieve();
    res.json(bal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const list = await stripe.balanceTransactions.list({ limit });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/charges', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const list = await stripe.charges.list({ limit });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/charges/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const limit = Number(req.query.limit || 10);
    const list = await stripe.charges.list({ 
      customer: customer_id,
      limit 
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/charges/:customer_id/total', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    // Obtener todos los charges del customer (sin límite para cálculo exacto)
    const charges = await stripe.charges.list({ 
      customer: customer_id,
      limit: 100 // Incrementar para obtener más datos
    });

    let totalPaid = 0;
    let totalRefunded = 0;
    let successfulCharges = 0;
    let failedCharges = 0;
    let totalDisputed = 0;
    
    const chargeDetails = [];

    for (const charge of charges.data) {
      const chargeInfo = {
        id: charge.id,
        amount: charge.amount / 100, // Convertir de centavos a dólares
        currency: charge.currency,
        status: charge.status,
        paid: charge.paid,
        refunded: charge.refunded,
        amount_refunded: charge.amount_refunded / 100,
        created: new Date(charge.created * 1000),
        disputed: charge.disputed,
        payment_intent: charge.payment_intent || null,
        marqeta_user_token: charge.metadata?.marqeta_user_token || null,
        payment_session_id: charge.metadata?.payment_session_id || null,
        uid: charge.metadata?.uid || null
      };

      if (charge.paid && charge.status === 'succeeded') {
        // Charge exitoso
        totalPaid += charge.amount;
        successfulCharges++;
        
        // Restar reembolsos
        if (charge.amount_refunded > 0) {
          totalRefunded += charge.amount_refunded;
        }
      } else {
        // Charge fallido
        failedCharges++;
      }

      // Considerar disputas
      if (charge.disputed) {
        totalDisputed += charge.amount;
      }

      chargeDetails.push(chargeInfo);
    }

    // Convertir de centavos a dólares
    const totalPaidDollars = totalPaid / 100;
    const totalRefundedDollars = totalRefunded / 100;
    const totalDisputedDollars = totalDisputed / 100;
    
    // Cálculo del total neto
    const netTotal = totalPaidDollars - totalRefundedDollars;

    res.json({
      ok: true,
      customer_id: customer_id,
      summary: {
        total_paid: parseFloat(totalPaidDollars.toFixed(2)),
        total_refunded: parseFloat(totalRefundedDollars.toFixed(2)),
        total_disputed: parseFloat(totalDisputedDollars.toFixed(2)),
        net_total: parseFloat(netTotal.toFixed(2)),
        currency: charges.data[0]?.currency || 'usd',
        successful_charges: successfulCharges,
        failed_charges: failedCharges,
        total_charges: charges.data.length
      },
      charges: chargeDetails,
      has_more: charges.has_more
    });

  } catch (e) {
    console.error('Error calculating customer total:', e);
    res.status(500).json({ 
      ok: false,
      error: e.message 
    });
  }
});

router.get('/customers/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const customer = await stripe.customers.retrieve(customer_id);
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/customers/:customer_id/balance_transactions', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const transactions = await stripe.customers.listBalanceTransactions(customer_id);
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
