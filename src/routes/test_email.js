import { Router } from 'express';
import { emailService } from '../services/send_email.js';

const router = Router();

/**
 * Endpoint de testing para probar el envío de emails
 */
router.post('/test-email', async (req, res) => {
  try {
    const { email, type = 'reload' } = req.body;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Email es requerido'
      });
    }

    console.log('🧪 Testing email envío a:', email);

    if (type === 'reload') {
      const result = await emailService.sendReloadConfirmation({
        email: email,
        userName: 'Usuario de Prueba',
        amount: 25.00,
        currency: 'USD',
        paymentSessionId: 'test_session_123'
      });

      res.json({
        ok: true,
        message: 'Email de prueba enviado',
        result: result
      });
    } else {
      res.status(400).json({
        ok: false,
        error: 'Tipo de email no soportado'
      });
    }

  } catch (error) {
    console.error('❌ Error en test de email:', error);
    res.status(500).json({
      ok: false,
      error: 'Error interno',
      details: error.message
    });
  }
});

export default router;