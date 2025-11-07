import { transporter, emailConfig } from '../config/email.js';

/**
 * Servicio para envío de diferentes tipos de correos
 */
class EmailService {
  
  /**
   * Envía email de confirmación de recarga exitosa
   * @param {Object} data - Datos de la recarga
   * @param {string} data.email - Email del usuario
   * @param {string} data.userName - Nombre del usuario
   * @param {number} data.amount - Monto recargado
   * @param {string} data.paymentSessionId - ID de la sesión de pago
   * @param {string} data.currency - Moneda
   */
  async sendReloadConfirmation(data) {
    try {
      // console.log('📧 Enviando email de confirmación de recarga a:', data.email);

      const { email, userName, amount, paymentSessionId, currency = 'USD' } = data;

      if (!email) {
        // console.log('❌ Email de destino no proporcionado');
        return {
          success: false,
          error: 'Email de destino requerido'
        };
      }

      const htmlContent = this.generateReloadConfirmationHTML({
        userName,
        amount,
        currency,
        paymentSessionId,
        date: new Date().toLocaleString('es-ES', { 
          timeZone: 'America/Guayaquil',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      const mailOptions = {
        from: `${emailConfig.company} <${emailConfig.from}>`,
        to: email,
        subject: '✅ Recarga exitosa en tu cuenta PAYSAT',
        html: htmlContent
      };

      // console.log('📧 Configurando email para:', email);
      // console.log('📧 Enviando email...');
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email enviado exitosamente - ID:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        email: email
      };

    } catch (error) {
      console.error('❌ Error enviando email de recarga:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera el HTML para el email de confirmación de recarga
   */
  generateReloadConfirmationHTML(data) {
    // Formatear el monto con 2 decimales
    const formattedAmount = parseFloat(data.amount).toFixed(2);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recarga exitosa - PAYSAT</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f8f9fa; }
          .success-icon { font-size: 48px; color: #10B981; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; color: #4F46E5; text-align: center; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏦 PAYSAT</h1>
            <p>Tu plataforma bancaria de confianza</p>
          </div>
          
          <div class="content">
            <div class="success-icon">✅</div>
            <h2 style="text-align: center; color: #374151;">¡Recarga exitosa!</h2>
            
            <p>Hola <strong>${data.userName || 'Usuario'}</strong>,</p>
            
            <p>Tu recarga ha sido procesada exitosamente:</p>
            
            <div class="amount">$${formattedAmount} ${data.currency}</div>
            
            <div class="details">
              <h3>Detalles de la transacción:</h3>
              <p><strong>Monto:</strong> $${formattedAmount} ${data.currency}</p>
              <p><strong>Fecha:</strong> ${data.date}</p>
              <p><strong>ID de sesión:</strong> ${data.paymentSessionId}</p>
              <p><strong>Estado:</strong> Completada ✅</p>
            </div>
            
            <p>Los fondos ya están disponibles en tu cuenta PAYSAT y pueden ser utilizados para realizar pagos.</p>
            <!--
            <div style="text-align: center;">
              <a href="#" class="button">Ver mi cuenta</a>
             </div> -->
          </div>
          
          <div class="footer">
            <p>Este es un email automático, por favor no respondas.</p>
            <p>Si tienes dudas, contacta nuestro soporte: ${emailConfig.supportEmail}</p>
            <p>&copy; 2025 PAYSAT. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envía email de bienvenida (para implementar después)
   */
  async sendWelcomeEmail(data) {
    // TODO: Implementar después
    // console.log('📧 Welcome email - Por implementar');
  }

  /**
   * Envía email de alerta de transacción (para implementar después)
   */
  async sendTransactionAlert(data) {
    // TODO: Implementar después
    // console.log('📧 Transaction alert - Por implementar');
  }
}

export const emailService = new EmailService();
export default emailService;