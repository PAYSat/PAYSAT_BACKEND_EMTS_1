import twilio from "twilio";
import Stripe from 'stripe';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class AppPaySatTransferController {

  sendOTP = async (req, res) => {
    try {
      const { phone, channel } = req.body || {};
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ ok: false, error: "phone requerido" });
      }

      const ch = (channel || "whatsapp").toString().toLowerCase();
      if (!["whatsapp", "sms"].includes(ch)) {
        return res.status(400).json({ ok: false, error: "channel inválido" });
      }

      // Twilio Verify: crea verificación
      await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phone, channel: ch });

      return res.json({ ok: true });
    } catch (err) {
      console.error("send-otp error:", err?.message || err);
      console.error("Error details:", {
        code: err?.code,
        status: err?.status,
        moreInfo: err?.moreInfo
      });
      return res.status(500).json({ 
        ok: false, 
        error: "No se pudo enviar OTP",
        details: err?.message 
      });
    }
  }

  verifyOTP = async (req, res) => {
    try {
      const { phone, code } = req.body || {};
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ ok: false, error: "phone requerido" });
      }
      if (!code || typeof code !== "string") {
        return res.status(400).json({ ok: false, error: "code requerido" });
      }

      const check = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });

      if (check.status === "approved") {
        return res.json({ ok: true, verified: true });
      }

      return res.status(400).json({ ok: false, verified: false });
    } catch (err) {
      console.error("verify-otp error:", err?.message || err);
      return res.status(400).json({ ok: false, verified: false });
    }
  }

  confirmWithPaymentMethod = async (req, res) => {
    try {
      const { payment_intent_id, payment_method_id } = req.body;

      console.log(`🔹 Confirmando PaymentIntent: ${payment_intent_id}`);
      console.log(`🔹 Con PaymentMethod: ${payment_method_id}`);

      // Validar parámetros
      if (!payment_intent_id || !payment_method_id) {
        return res.status(400).json({
          success: false,
          error: 'payment_intent_id y payment_method_id son requeridos',
        });
      }

      // Confirmar el PaymentIntent con el PaymentMethod
      const paymentIntent = await stripe.paymentIntents.confirm(payment_intent_id, {
        payment_method: payment_method_id,
        return_url: 'https://your-app.com/payment-return', // Para 3D Secure si aplica
      });

      console.log(`✅ PaymentIntent confirmado. Estado: ${paymentIntent.status}`);

      // Manejar diferentes estados del PaymentIntent
      if (paymentIntent.status === 'succeeded') {
        return res.json({
          success: true,
          status: 'succeeded',
          paymentIntent: {
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
          },
        });
      } else if (paymentIntent.status === 'requires_action') {
        // 3D Secure necesario - retornar info para que el cliente maneje
        return res.json({
          success: false,
          requires_action: true,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret,
          next_action: paymentIntent.next_action,
        });
      } else if (paymentIntent.status === 'requires_payment_method') {
        // El PaymentMethod fue rechazado
        return res.status(400).json({
          success: false,
          error: 'Método de pago rechazado. Intenta con otra tarjeta',
          status: paymentIntent.status,
        });
      } else {
        // Otro estado no esperado
        return res.status(400).json({
          success: false,
          error: `Estado del pago: ${paymentIntent.status}`,
          status: paymentIntent.status,
        });
      }

    } catch (error) {
      console.error('❌ Error confirmando pago:', error);

      // Mapear errores de Stripe a mensajes user-friendly
      let errorMessage = 'Error al procesar el pago';
      let statusCode = 400;
      
      if (error.type === 'StripeCardError') {
        // Errores de tarjeta
        switch (error.code) {
          case 'card_declined':
            errorMessage = 'Tarjeta rechazada';
            break;
          case 'expired_card':
            errorMessage = 'Tarjeta vencida';
            break;
          case 'incorrect_cvc':
            errorMessage = 'CVV incorrecto';
            break;
          case 'insufficient_funds':
            errorMessage = 'Fondos insuficientes';
            break;
          case 'invalid_number':
            errorMessage = 'Número de tarjeta inválido';
            break;
          case 'processing_error':
            errorMessage = 'Error procesando el pago. Intenta nuevamente';
            break;
          default:
            errorMessage = error.message || 'Error con la tarjeta';
        }
      } else if (error.type === 'StripeInvalidRequestError') {
        errorMessage = 'Solicitud inválida. Verifica los datos del pago';
        if (error.message?.includes('No such payment_intent')) {
          errorMessage = 'PaymentIntent no encontrado';
          statusCode = 404;
        } else if (error.message?.includes('No such paymentmethod')) {
          errorMessage = 'Método de pago inválido';
        }
      } else if (error.type === 'StripeAPIError') {
        errorMessage = 'Error temporal de Stripe. Intenta nuevamente';
        statusCode = 503;
      } else if (error.type === 'StripeConnectionError') {
        errorMessage = 'Error de conexión con Stripe';
        statusCode = 503;
      } else if (error.type === 'StripeAuthenticationError') {
        errorMessage = 'Error de autenticación con Stripe';
        statusCode = 500;
        console.error('⚠️ STRIPE_SECRET_KEY puede estar mal configurada');
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: error.code,
        type: error.type,
      });
    }
  }

}

export default AppPaySatTransferController;
