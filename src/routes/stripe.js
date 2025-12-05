import { Router } from 'express';
import { stripe } from '../config/stripe.js';

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

router.get('/recharges', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const list = await stripe.recharges.list({ limit });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/recharges/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const limit = Number(req.query.limit || 10);
    const list = await stripe.recharges.list({ 
      customer: customer_id,
      limit 
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/recharges/:customer_id/total', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    // Obtener todos los recharges del customer (sin límite para cálculo exacto)
    const recharges = await stripe.recharges.list({ 
      customer: customer_id,
      limit: 100 // Incrementar para obtener más datos
    });

    let totalPaid = 0;
    let totalRefunded = 0;
    let successfulRerecharges = 0;
    let failedRerecharges = 0;
    let totalDisputed = 0;
    
    const rechargeDetails = [];

    for (const recharge of recharges.data) {
      const rechargeInfo = {
        id: recharge.id,
        amount: recharge.amount / 100, // Convertir de centavos a dólares
        currency: recharge.currency,
        status: recharge.status,
        paid: recharge.paid,
        refunded: recharge.refunded,
        amount_refunded: recharge.amount_refunded / 100,
        created: new Date(recharge.created * 1000),
        disputed: recharge.disputed,
        payment_intent: recharge.payment_intent || null,
        payment_session_id: recharge.metadata?.payment_session_id || null,
        uid: recharge.metadata?.uid || null
      };

      if (recharge.paid && recharge.status === 'succeeded') {
        // Rerecharge exitoso
        totalPaid += recharge.amount;
        successfulRerecharges++;
        
        // Restar reembolsos
        if (recharge.amount_refunded > 0) {
          totalRefunded += recharge.amount_refunded;
        }
      } else {
        // Rerecharge fallido
        failedRerecharges++;
      }

      // Considerar disputas
      if (recharge.disputed) {
        totalDisputed += recharge.amount;
      }

      rechargeDetails.push(rechargeInfo);
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
        currency: recharges.data[0]?.currency || 'USD',
        successful_recharges: successfulRerecharges,
        failed_recharges: failedRerecharges,
        total_recharges: recharges.data.length
      },
      recharges: rechargeDetails,
      has_more: recharges.has_more
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
