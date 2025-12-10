// src/routes/issuingTest.js
import { Router } from 'express';
import { stripe } from '../config/stripe.js';

const router = Router();

/**
 * POST /api/issuing/simulate
 *
 * Simula una compra con Stripe Issuing en ENTORNO DE PRUEBA (test mode).
 * Usa testHelpers, NO requiere saldo en el balance de Issuing.
 *
 * BODY JSON:
 * {
 *   "card_id": "ic_xxx...",      // ID de la tarjeta virtual Issuing
 *   "amount": 12.5,              // Monto numérico
 *   "currency": "gbp" | "usd"    // (opcional) moneda, por defecto "usd"
 * }
 */
router.post('/simulate', async (req, res) => {
  try {
    const { card_id, amount, currency } = req.body;

    if (!card_id || typeof card_id !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'card_id es requerido y debe ser un string',
      });
    }

    if (amount === undefined || amount === null || isNaN(amount)) {
      return res.status(400).json({
        ok: false,
        error: 'amount es requerido y debe ser numérico',
      });
    }

    const amountNumber = parseFloat(amount);
    if (amountNumber <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'amount debe ser mayor a 0',
      });
    }

    // // Crear una transacción de reembolso no vinculada para "abastecer" la tarjeta
    // const transaction = await stripe.testHelpers.issuing.transactions.createUnlinkedRefund({
    //   card: card_id,
    //   amount: 15000,
    // });

    // Si no envías currency desde el front, por defecto "usd"
    const txCurrency = (currency || 'usd').toLowerCase();
    const amountCents = Math.round(amountNumber * 100);

    console.log('🧪 Simulando compra Issuing (TEST MODE)...');
    console.log(`➡️  card_id: ${card_id}`);
    console.log(`➡️  amount: ${amountNumber} ${txCurrency} (${amountCents} cents)`);

    // 1) Crear autorización simulada
    //
    // Con la API actual de Stripe testHelpers, la creación de esta autorización
    // ya dispara los eventos necesarios en modo prueba (authorization + transaction),
    // y no es necesario llamar a capture().
    const auth = await stripe.testHelpers.issuing.authorizations.create({
      amount: amountCents,
      currency: txCurrency,
      card: card_id,
      // Puedes añadir merchant_data si quieres:
      // merchant_data: { name: 'PAYSAT TEST STORE', city: 'Quito', country: 'EC' },
    });

    console.log('🟣 Authorization simulada creada:', auth.id);
    console.log('   status:', auth.status);

    // A partir de aquí, Stripe enviará a tu webhook:
    //  - issuing_authorization.created / request (según configuración)
    //  - issuing_transaction.created
    //
    // Tu lógica en esos webhooks será la responsable de:
    //  - verificar saldo PAYSAT
    //  - descontar saldo PAYSAT cuando corresponda

    return res.json({
      ok: true,
      message: 'Compra simulada creada correctamente (testHelpers)',
      amount: amountNumber,
      currency: txCurrency,
      card_id,
      authorization: {
        id: auth.id,
        status: auth.status,
      },
    });
  } catch (err) {
    console.error('❌ Error simulando compra Issuing:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error interno simulando compra',
    });
  }
});

export default router;




// // src/routes/issuingTest.js
// import { Router } from "express";
// import { stripe } from "../config/stripe.js";
// import { db } from "../config/firebase.js";

// const router = Router();

// /**
//  * Simula una compra con la tarjeta virtual.
//  * BODY:
//  * - card_id: string
//  * - amount: number (USD)
//  */
// router.post("/simulate", async (req, res) => {
//   try {
//     const { card_id, amount, auto_capture } = req.body;

//     if (!card_id || !amount) {
//       return res.status(400).json({ ok: false, error: "card_id y amount son requeridos" });
//     }

//     const amountCents = Math.round(amount * 100);

//     console.log("🧪 Simulando compra:", { card_id, amountCents });

//     // Crear autorización simulada con datos del comercio
//     const auth = await stripe.testHelpers.issuing.authorizations.create({
//       amount: 553,
//       currency: "usd",
//       card: card_id,
//       merchant_data: {
//         category: "accounting_bookkeeping_services", // Categoría MCC válida confirmada
//         city: "San Francisco",
//         country: "US",
//         name: "Test Merchant",
//         network_id: "1234567890",
//         postal_code: "94103",
//       },
//       verification_data: {
//         address_line1_check: "match",
//         address_postal_code_check: "match",
//         cvc_check: "match",
//       },
//     });

//     console.log("🔔 Authorization simulada creada:", auth.id, "estado:", auth.status);

//     // Guardar simulación en Firebase
//     const simulationData = {
//       authorizationId: auth.id,
//       cardId: card_id,
//       amount: amount,
//       amountCents: amountCents,
//       currency: "usd",
//       status: auth.status,
//       approved: auth.approved || false,
//       createdAt: new Date().toISOString(),
//       autoCapture: auto_capture || false,
//       captured: false,
//       captureId: null,
//     };

//     const simRef = await db.collection('Stripe_Simulations_Temp').add(simulationData);
//     console.log("💾 Simulación guardada en Firebase:", simRef.id);

//     // Si auto_capture = true, esperar un poco y luego capturar
//     let captured = null;
//     if (auto_capture) {
//       // Esperar 2 segundos para que el webhook procese la aprobación
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // Verificar estado de la autorización antes de capturar
//       const authUpdated = await stripe.issuing.authorizations.retrieve(auth.id);
//       console.log("📊 Estado actualizado:", authUpdated.status, "approved:", authUpdated.approved);

//       if (authUpdated.approved && authUpdated.status === 'pending') {
//         captured = await stripe.testHelpers.issuing.authorizations.capture(auth.id);
//         console.log("💳 Compra simulada capturada:", captured.id);

//         // Actualizar en Firebase
//         await simRef.update({
//           captured: true,
//           captureId: captured.id,
//           capturedAt: new Date().toISOString(),
//           finalStatus: captured.status,
//         });
//         console.log("💾 Simulación actualizada con captura");
//       } else {
//         console.log("⚠️ Autorización no está en estado approved/pending, no se puede capturar");
        
//         // Actualizar estado en Firebase
//         await simRef.update({
//           captureError: "Authorization not in approved/pending state",
//           finalStatus: authUpdated.status,
//           finalApproved: authUpdated.approved,
//         });
//       }
//     }

//     return res.json({
//       ok: true,
//       message: auto_capture && captured 
//         ? "Compra simulada y capturada" 
//         : "Autorización simulada creada (pendiente de captura manual)",
//       authorization: auth,
//       capture: captured,
//       simulationId: simRef.id,
//     });
//   } catch (err) {
//     console.error("❌ Error simulando compra:", err);
//     return res.status(500).json({ ok: false, error: err.message });
//   }
// });

// export default router;
