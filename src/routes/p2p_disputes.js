import { Router } from 'express';
import { requireOrderParticipant } from '../middlewares/p2p_order_participant.js';
import { openDispute } from '../services/p2p_disputes_service.js';

const router = Router();

// POST /api/p2p/orders/:id/dispute
// body: { reason, evidenceMessageIds: [] }
router.post('/orders/:id/dispute', requireOrderParticipant, async (req, res) => {
  try {
    const uid = req.user.uid;
    const order = req.p2pOrder;

    const reason = req.body.reason;
    const evidenceMessageIds = req.body.evidenceMessageIds || [];

    const meta = {
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      ua: req.headers['user-agent'] || null
    };

    const dispute = await openDispute({
      order,
      openedByUid: uid,
      reason,
      evidenceMessageIds,
      openedMeta: meta
    });

    return res.json({ ok: true, dispute });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

export default router;
