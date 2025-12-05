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
   * @param {number} data.amount - Monto recargado original
   * @param {number} data.totalFee - Fee total (Stripe + PaySat) - opcional
   * @param {number} data.netAmount - Monto neto disponible - opcional
   * @param {string} data.paymentSessionId - ID de la sesión de pago
   * @param {string} data.currency - Moneda
   */
  async sendReloadConfirmation(data) {
    try {
      // console.log('📧 Enviando email de confirmación de recarga a:', data.email);

      const { email, userName, amount, totalFee, netAmount, paymentSessionId, currency = 'USD' } = data;

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
        totalFee,
        netAmount,
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
    // Formatear los montos con 2 decimales
    const formattedAmount = parseFloat(data.amount).toFixed(2);
    const hasFeeInfo = data.totalFee !== undefined && data.netAmount !== undefined;
    const formattedTotalFee = hasFeeInfo ? parseFloat(data.totalFee).toFixed(2) : null;
    const formattedNetAmount = hasFeeInfo ? parseFloat(data.netAmount).toFixed(2) : null;
    
    // Determinar qué monto mostrar prominentemente
    const mainAmount = hasFeeInfo ? formattedNetAmount : formattedAmount;
    const mainAmountLabel = hasFeeInfo ? 'Monto disponible' : 'Monto recargado';
    
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
          .amount-label { font-size: 14px; color: #6B7280; text-align: center; margin-top: -15px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .fee-breakdown { background: #F3F4F6; padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 14px; }
          .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .highlight { color: #059669; font-weight: bold; }
          .fee-line { display: flex; justify-content: space-between; margin: 5px 0; }
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
            
            <div class="amount">$${mainAmount} ${data.currency}</div>
            <div class="amount-label">${mainAmountLabel}</div>
            
            <div class="details">
              <h3>Detalles de la transacción:</h3>
              <p><strong>Monto original:</strong> $${formattedAmount} ${data.currency}</p>
              
              ${hasFeeInfo ? `
              <div class="fee-breakdown">
                <p><strong>Desglose de tarifas:</strong></p>
                <div class="fee-line">
                  <span>Tarifa total aplicada:</span>
                  <span>&nbsp;-$${formattedTotalFee} ${data.currency}</span>
                </div>
                <hr style="margin: 8px 0; border: none; border-top: 1px solid #D1D5DB;">
                <div class="fee-line">
                  <span class="highlight">Monto disponible en tu cuenta:</span>
                  <span class="highlight">&nbsp;$${formattedNetAmount} ${data.currency}</span>
                </div>
              </div>
              ` : ''}
              
              <p><strong>Fecha:</strong> ${data.date}</p>
              <p><strong>ID de sesión:</strong> ${data.paymentSessionId}</p>
              <p><strong>Estado:</strong> Completada ✅</p>
            </div>
            
            <p>Los fondos ya están disponibles en tu cuenta PAYSAT y pueden ser utilizados para realizar pagos.</p>
            ${hasFeeInfo ? '<p style="font-size: 12px; color: #6B7280;"><em>El fee incluye comisiones de procesamiento de pago y servicio PaySat.</em></p>' : ''}
            
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
   * Envía email de confirmación de recarga de tarjeta virtual
   * @param {Object} data - Datos de la recarga de tarjeta
   * @param {string} data.email - Email del usuario
   * @param {string} data.userName - Nombre del usuario
   * @param {number} data.amount - Monto recargado en la tarjeta
   * @param {string} data.currency - Moneda
   * @param {string} data.gpaOrderToken - Token de la orden GPA
   * @param {string} data.cardMovementId - ID del movimiento de tarjeta
   * @param {string} data.accountMovementId - ID del movimiento de cuenta
   * @param {string} data.numeroCuentaPAYSAT - Número de cuenta PaySat
   * @param {string} data.paysatUID - UID del usuario en PaySat
   */
  async sendCardRechargeConfirmation(data) {
    try {
      console.log('📧 Enviando email de confirmación de recarga de tarjeta a:', data.email);

      const { email, userName, amount, currency = 'USD', gpaOrderToken, cardMovementId, accountMovementId, numeroCuentaPAYSAT, paysatUID } = data;

      if (!email) {
        return {
          success: false,
          error: 'Email de destino requerido'
        };
      }

      const htmlContent = this.generateCardRechargeConfirmationHTML({
        userName,
        amount,
        currency,
        gpaOrderToken,
        cardMovementId,
        accountMovementId,
        numeroCuentaPAYSAT,
        paysatUID,
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
        subject: '💳 Recarga de tarjeta virtual exitosa - PAYSAT',
        html: htmlContent
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email de recarga de tarjeta enviado exitosamente - ID:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        email: email
      };

    } catch (error) {
      console.error('❌ Error enviando email de recarga de tarjeta:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera el HTML para el email de confirmación de recarga de tarjeta virtual
   */
  generateCardRechargeConfirmationHTML(data) {
    const formattedAmount = parseFloat(data.amount).toFixed(2);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recarga de tarjeta exitosa - PAYSAT</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f8f9fa; }
          .success-icon { font-size: 48px; color: #10B981; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; color: #4F46E5; text-align: center; margin: 20px 0; }
          .amount-label { font-size: 14px; color: #6B7280; text-align: center; margin-top: -15px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .card-icon { font-size: 24px; margin-right: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏦 PAYSAT</h1>
            <p>Tu plataforma bancaria de confianza</p>
          </div>
          
          <div class="content">
            <div class="success-icon">💳✅</div>
            <h2 style="text-align: center; color: #374151;">¡Tarjeta recargada exitosamente!</h2>
            
            <p>Hola <strong>${data.userName || 'Usuario'}</strong>,</p>
            
            <p>Tu tarjeta virtual ha sido recargada exitosamente:</p>
            
            <div class="amount">$${formattedAmount} ${data.currency}</div>
            <div class="amount-label">Recargado en tu tarjeta virtual</div>
            
            <div class="details">
              <h3><span class="card-icon">💳</span>Detalles de la transacción:</h3>
              <p><strong>Monto recargado:</strong> $${formattedAmount} ${data.currency}</p>
              <!-- <p><strong>Token GPA:</strong> ${data.gpaOrderToken}</p> -->
              <p><strong>Número de cuenta:</strong> ${data.numeroCuentaPAYSAT}</p>
              <p><strong>Fecha:</strong> ${data.date}</p>
              <p><strong>Estado:</strong> Completada ✅</p>
            </div>
            
            <p>Los fondos ya están disponibles en tu tarjeta virtual PAYSAT y pueden ser utilizados para realizar pagos en línea.</p>
            <p style="font-size: 12px; color: #6B7280;"><em>Tu tarjeta virtual está lista para usar en comercios que acepten tarjetas Mastercard.</em></p>
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