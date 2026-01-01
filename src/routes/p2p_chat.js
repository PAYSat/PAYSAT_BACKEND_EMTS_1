import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import { db, bucket } from '../config/firebase.js';
import { COL } from '../utils/paysat_crypto_collections.js';
import { requireOrderParticipant } from '../middlewares/p2p_order_participant.js';
import { assertChatRateLimit } from '../services/p2p_rate_limit_service.js';
import { notifyUser, buildChatNotification } from '../services/paysat_crypto_notify_service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

const now = () => new Date();

function sanitizeFileName(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function inferType(mimetype) {
  if (!mimetype) return 'FILE';
  if (mimetype.startsWith('image/')) return 'IMAGE';
  if (mimetype === 'application/pdf') return 'PDF';
  return 'FILE';
}

/**
 * GET /api/p2p/orders/:id/messages
 */
router.get('/orders/:id/messages', requireOrderParticipant, async (req, res) => {
  try {
    const orderId = req.params.id;

    const snap = await db.collection(COL.P2P_MESSAGES)
      .where('orderId', '==', orderId)
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();

    const messages = snap.docs.map(d => d.data());
    return res.json({ ok: true, messages });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

/**
 * POST /api/p2p/orders/:id/messages/text
 * body: { text }
 */
router.post('/orders/:id/messages/text', requireOrderParticipant, async (req, res) => {
  try {
    const uid = req.user.uid;
    const orderId = req.params.id;

    await assertChatRateLimit(uid, orderId);

    const text = String(req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ ok: false, message: 'Texto requerido' });

    const id = uuidv4();
    const msg = {
      id,
      orderId,
      senderUid: uid,
      type: 'TEXT',
      text,
      createdAt: now(),
      updatedAt: now(),
      meta: {
        attachmentUrl: null,
        attachmentPath: null,
        attachmentMime: null,
        attachmentName: null,
        attachmentSize: null,
        url: null,
        filename: null,
        contentType: null,
        purpose: null,
      },
    };

    // Notificar al otro usuario
    const order = req.p2pOrder;
    const otherUid = order.buyerUid === uid ? order.sellerUid : order.buyerUid;

    await notifyUser(otherUid, buildChatNotification({
      orderId,
      senderUid: uid,
      textPreview: text.length > 80 ? text.slice(0, 80) + '…' : text
    }));

    await db.collection(COL.P2P_MESSAGES).doc(id).set(msg);
    return res.json({ ok: true, message: msg });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

/**
 * POST /api/p2p/orders/:id/messages/attachment
 * form-data:
 * - file
 * - purpose: CHAT_FILE | PAYMENT_PROOF
 * - text: caption opcional
 */
router.post(
  '/orders/:id/messages/attachment',
  requireOrderParticipant,
  upload.single('file'),
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const orderId = req.params.id;

      await assertChatRateLimit(uid, orderId);

      const purpose = String(req.body.purpose || 'CHAT_FILE').toUpperCase();
      if (!['CHAT_FILE', 'PAYMENT_PROOF'].includes(purpose)) {
        return res.status(400).json({ ok:false, message:'purpose inválido' });
      }

      const caption = String(req.body.text || '').trim().slice(0, 300);
      const file = req.file;
      if (!file) return res.status(400).json({ ok:false, message:'file requerido' });

      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowed.includes(String(file.mimetype || '').toLowerCase())) {
        return res.status(400).json({ ok:false, message:`Tipo no permitido: ${file.mimetype}` });
      }

      const fileName = sanitizeFileName(file.originalname);
      const objectPath = `PaySat_Crypto/P2P/${orderId}/${Date.now()}_${fileName}`;
      const storageFile = bucket.file(objectPath);

      const id = uuidv4();
      const downloadToken = uuidv4();

      await storageFile.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: {
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
            orderId,
            senderUid: uid,
            purpose,
          },
        },
      });

      // ✅ URL pública por token (no expira como signedUrl)
      const encodedPath = encodeURIComponent(objectPath);
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

      const msg = {
        id,
        orderId,
        senderUid: uid,
        type: 'ATTACHMENT',
        text: caption || '',
        createdAt: now(),
        updatedAt: now(),
        meta: {
          purpose,
          url,

          // ✅ compat para Flutter (y para tu meta antigua)
          filename: fileName,
          contentType: file.mimetype,

          attachmentUrl: url,
          attachmentPath: objectPath,
          attachmentMime: file.mimetype,
          attachmentName: fileName,
          attachmentSize: file.size,
          downloadToken,

          fileKind: inferType(file.mimetype),
        },
      };

      await db.collection(COL.P2P_MESSAGES).doc(id).set(msg);

      const order = req.p2pOrder;
      const otherUid = order.buyerUid === uid ? order.sellerUid : order.buyerUid;

      await notifyUser(otherUid, buildChatNotification({
        orderId,
        senderUid: uid,
        textPreview: purpose === 'PAYMENT_PROOF' ? '📎 Comprobante enviado' : '📎 Adjunto enviado'
      }));

      return res.json({ ok: true, messageId: id, url, message: msg });
    } catch (e) {
      return res.status(400).json({ ok: false, message: e.message });
    }
  }
);

export default router;
