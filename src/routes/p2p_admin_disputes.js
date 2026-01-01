import { Router } from 'express';
import { requireRole } from '../middlewares/roles.js';
import { listDisputes, resolveDispute } from '../services/p2p_disputes_service.js';

const router = Router();

// GET /api/p2p/admin/disputes?status=OPEN&limit=50
router.get('/admin/disputes', requireRole('ADMIN'), async (req, res) => {
  try {
    const disputes = await listDisputes({
      status: String(req.query.status || 'OPEN').toUpperCase(),
      limit: req.query.limit || 50
    });
    return res.json({ ok: true, disputes });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

// POST /api/p2p/admin/disputes/:id/resolve
// body: { winnerUid, note }
router.post('/admin/disputes/:id/resolve', requireRole('ADMIN'), async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const disputeId = req.params.id;

    const { winnerUid, note } = req.body;
    if (!winnerUid) return res.status(400).json({ ok:false, message:'winnerUid requerido' });

    const out = await resolveDispute({ disputeId, adminUid, winnerUid, note });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

export default router;
