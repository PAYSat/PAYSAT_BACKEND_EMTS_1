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

function safeStr(v) {
  return String(v ?? '').trim();
}

/**
 * POST /api/p2p/orders/:id/messages/text
 * body: { text }
 */
router.post('/orders/:id/messages/text', requireOrderParticipant, async (req, res) => {
  try {
    const uid = req.user.uid;
    const orderId = req.params.id;

    // ✅ FIX: llamada correcta
    await assertChatRateLimit({ senderUid: uid, orderId });

    const text = safeStr(req.body.text);
    if (!text) {
      console.error('[P2P_CHAT] Texto vacío recibido:', req.body);
      return res.status(400).json({ ok: false, message: 'Texto requerido' });
    }

    const id = uuidv4();

    const msg = {
      id,
      orderId,
      senderUid: uid,
      type: 'TEXT',
      text,
      createdAt: now(),
      updatedAt: now(),
      meta: {},
    };

    await db.collection(COL.P2P_MESSAGES).doc(id).set(msg);

    // notificación al otro participante
    if (req.otherUid) {
      try {
        await notifyUser(req.otherUid, buildChatNotification({
          orderId,
          senderUid: uid,
          textPreview: text
        }));
      } catch (notifError) {
        console.error('[P2P_CHAT] Error en notificación:', notifError.message);
      }
    }

    return res.json({ ok: true, messageId: id, message: msg });
  } catch (e) {
    console.error('[P2P_CHAT] Error en /messages/text:', e);
    return res.status(400).json({ ok: false, message: e.message });
  }
});

/**
 * POST /api/p2p/orders/:id/messages/attachment
 * form-data:
 *  - file: <archivo>
 *  - purpose?: CHAT_FILE | PAYMENT_PROOF
 */
router.post(
  '/orders/:id/messages/attachment',
  requireOrderParticipant,
  upload.single('file'),
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const orderId = req.params.id;

      // ✅ FIX: llamada correcta
      await assertChatRateLimit({ senderUid: uid, orderId });

      const purpose = String(req.body.purpose || 'CHAT_FILE').toUpperCase();
      if (!['CHAT_FILE', 'PAYMENT_PROOF'].includes(purpose)) {
        return res.status(400).json({ ok: false, message: 'purpose inválido' });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, message: 'Archivo requerido (field: file)' });
      }

      const mime = req.file.mimetype || '';
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowed.includes(mime)) {
        return res.status(400).json({ ok: false, message: `Tipo no permitido: ${mime}` });
      }

      const ext =
        mime === 'image/jpeg' ? 'jpg' :
        mime === 'image/png' ? 'png' :
        'pdf';

      const id = uuidv4();
      const path = `p2p/orders/${orderId}/messages/${id}.${ext}`;

      const file = bucket.file(path);

      await file.save(req.file.buffer, {
        contentType: mime,
        resumable: false,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // URL firmada (si tu bucket es privado)
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 días
      });

      const caption = safeStr(req.body.caption || req.body.text || '');
      console.log('[P2P_CHAT] Archivo subido:', { id, purpose, mime, size: req.file.size });

      // ✅ Estructura compatible con frontend Flutter
      const msg = {
        id,
        orderId,
        senderUid: uid,
        type: 'ATTACHMENT',
        text: caption,
        createdAt: now(),
        updatedAt: now(),
        meta: {
          url,
          downloadUrl: url,
          attachmentUrl: url,
          path,
          contentType: mime,
          mimeType: mime,
          attachmentMime: mime,
          filename: req.file.originalname || `file.${ext}`,
          name: req.file.originalname || `file.${ext}`,
          attachmentName: req.file.originalname || `file.${ext}`,
          size: req.file.size || 0,
          purpose,
          attachmentPurpose: purpose,
        },
      };

      await db.collection(COL.P2P_MESSAGES).doc(id).set(msg);

      if (req.otherUid) {
        try {
          await notifyUser(req.otherUid, buildChatNotification({
            orderId,
            senderUid: uid,
            textPreview: purpose === 'PAYMENT_PROOF' ? '📎 Comprobante enviado' : '📎 Adjunto enviado'
          }));
        } catch (notifError) {
          console.error('[P2P_CHAT] Error en notificación:', notifError.message);
        }
      }

      return res.json({ ok: true, messageId: id, url, message: msg });
    } catch (e) {
      console.error('[P2P_CHAT] Error en /messages/attachment:', e);
      return res.status(400).json({ ok: false, message: e.message });
    }
  }
);

export default router;
