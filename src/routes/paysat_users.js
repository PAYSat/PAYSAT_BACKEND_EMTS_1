import { Router } from 'express';
import { userProfile } from '../controllers/auth.controller.js';
import { db } from '../config/firebase.js';
// import { requireRole } from '../middlewares/roles.js';

const router = Router();

router.get('/userprofile', userProfile);

// Ejemplo admin-only (descomentar si usas roles):
// router.get('/admin/metrics', requireRole('admin'), (req, res) => {
//   res.json({ ok: true, data: { uptime: process.uptime() } });
// });

router.get('/transactions/history/:paysatUID', async (_req, res) => {
  let { paysatUID } = _req.params;

  try {
    // console.log('🔍 Obteniendo historial de transacciones para paysatUID:', paysatUID);

    // Limpiar el paysatUID de caracteres no deseados al inicio
    if (paysatUID.startsWith(':')) {
      paysatUID = paysatUID.substring(1);
    //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
    }

    // Validar que paysatUID no esté vacío después de la limpieza
    if (!paysatUID || paysatUID.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: 'paysatUID es requerido y no puede estar vacío' 
      });
    }

    // Obtener las sesiones de pago del usuario (consulta simplificada para evitar índices)
    const paymentsSnapshot = await db.collection('Stripe_Payments_Sessions')
      .where('paysatUID', '==', paysatUID)
      .get();

    console.log('📊 Sesiones de pago encontradas:', paymentsSnapshot.size);

    if (paymentsSnapshot.empty) {
      return res.json({
        ok: true,
        saldo: 0.00,
        data: [],
        message: 'No se encontraron transacciones para este usuario'
      });
    }

    // Procesar las transacciones y calcular el saldo (filtrar y ordenar en código)
    let saldoTotal = 0.00;
    const transacciones = [];

    paymentsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Filtrar solo transacciones completadas con GPA order exitoso
      if (data.status === 'completed' && data.gpa_order_state === 'COMPLETION') {
        const monto = parseFloat(data.amount) || 0.00;
        saldoTotal += monto;

        transacciones.push({
          id: doc.id,
          amount: monto,
          amount_cents: data.amount_cents || Math.round(monto * 100),
          currency: data.currency || 'usd',
          status: data.status,
          gpa_order_state: data.gpa_order_state,
          gpa_order_token: data.gpa_order_token || null,
          payment_intent_id: data.payment_intent_id || null,
          customer_id: data.customer_id || null,
          marqeta_user_token: data.marqeta_user_token || null,
          createdAt: data.createdAt,
          completedAt: data.completedAt || null
        });
      }
    });

    // Ordenar transacciones por fecha (más recientes primero)
    transacciones.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA; // Descendente (más recientes primero)
    });

    // Redondear saldo a 2 decimales
    saldoTotal = parseFloat(saldoTotal.toFixed(2));

    // console.log(`✅ Procesadas ${transacciones.length} transacciones, saldo total: $${saldoTotal}`);

    res.json({
      ok: true,
      saldo: saldoTotal,
      data: transacciones,
      summary: {
        total_transactions: transacciones.length,
        total_sessions_found: paymentsSnapshot.size,
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener el historial de transacciones:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;