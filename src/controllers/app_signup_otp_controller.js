import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

}

export default AppPaySatTransferController;