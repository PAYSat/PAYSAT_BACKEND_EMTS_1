import { transporter, emailConfig } from '../config/email.js';

/**
 * Servicio para envío de diferentes tipos de correos
 */
class EmailService {
    /**
     * Genera el HTML para el email de activación de tarjeta virtual
     * @param {Object} data
     * @param {string} data.email
     * @param {string} data.userName
     * @param {number} data.amount
     * @param {string} data.currency
     * @param {string} data.PAYSATAccountNumber
     * @param {string} data.cardLast4
     * @param {string} data.cardBrand
     * @param {string} data.fecha
     */
    generateCardActivationHTML(data) {
      const formattedAmount = parseFloat(data.amount).toFixed(2);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>¡Tu tarjeta virtual está activa! - PAYSAT</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: #4F46E5; color: white; padding: 24px; text-align: center; }
            .content { padding: 32px; background: #f8f9fa; }
            .success-icon { font-size: 48px; color: #10B981; text-align: center; margin: 20px 0; }
            .amount { font-size: 24px; font-weight: bold; color: #4F46E5; text-align: center; margin: 20px 0; }
            .amount-label { font-size: 15px; color: #6B7280; text-align: center; margin-top: -15px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .benefits { background: #EEF2FF; padding: 18px; border-radius: 8px; margin: 24px 0; }
            .benefit { margin-bottom: 10px; font-size: 15px; color: #374151; }
            .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
            .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">💳</div>
              <h1>¡Tarjeta virtual activada!</h1>
              <p>Bienvenido a la nueva era de pagos digitales</p>
            </div>
            <div class="content">
              <!--<div class="success-icon">🎉</div>-->
              <h2 style="text-align: center; color: #374151;">¡Tu tarjeta virtual PAYSAT está lista para usar!</h2>
              <p>Hola <strong>${data.userName || 'Usuario'}</strong>,</p>
              <p>Has activado exitosamente tu tarjeta virtual <strong>${data.cardBrand || 'Mastercard'}</strong> terminada en <strong>${data.cardLast4 || '****'}</strong>.</p>
              <div class="amount">$${formattedAmount} ${data.currency}</div>
              <div class="amount-label">Costo descontado de tu cuenta PaySat</div>
              <div class="details">
                <h3>Detalles de la activación:</h3>
                <p><strong>Número de cuenta:</strong> ${data.PAYSATAccountNumber}</p>
                <p><strong>Fecha de activación:</strong> ${data.fecha}</p>
                <p><strong>Estado:</strong> Activa ✅</p>
              </div>
              <div class="benefits">
                <h3 style="color:#4F46E5;">Beneficios de tu tarjeta virtual:</h3>
                <div class="benefit">✔️ Seguridad total: Úsala sin exponer tu tarjeta física.</div>
                <div class="benefit">✔️ Aceptada en miles de comercios online y apps.</div>
                <div class="benefit">✔️ Control inmediato: Bloquea, recarga y consulta movimientos desde la app.</div>
                <div class="benefit">✔️ Sin anualidad ni cargos ocultos.</div>
                <div class="benefit">✔️ Compatible con billeteras digitales (Google Pay, Apple Pay, etc).</div>
              </div>
              <p style="text-align:center;">¡Empieza a disfrutar de la libertad y seguridad de PAYSAT!</p>
              <div style="text-align:center;">
                <a href="https://paysatmoney.com" class="button">Ir a mi cuenta</a>
              </div>
              <p style="font-size: 13px; color: #6B7280; text-align:center; margin-top:20px;">¿Tienes dudas? Nuestro equipo de soporte está listo para ayudarte.</p>
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
     * Envía email de activación de tarjeta virtual
     * @param {Object} data - Datos de la activación
     * @param {string} data.email
     * @param {string} data.userName
     * @param {number} data.amount
     * @param {string} data.currency
     * @param {string} data.PAYSATAccountNumber
     * @param {string} data.cardLast4
     * @param {string} data.cardBrand
     * @param {string} data.fecha
     */
    async sendCardActivationEmail(data) {
      try {
        const { email, userName, amount, currency = 'USD', PAYSATAccountNumber, cardLast4, cardBrand, fecha } = data;
        if (!email) {
          return { success: false, error: 'Email de destino requerido' };
        }
        const htmlContent = this.generateCardActivationHTML({
          userName,
          amount,
          currency,
          PAYSATAccountNumber,
          cardLast4,
          cardBrand,
          fecha
        });
        const mailOptions = {
          from: `${emailConfig.company} <${emailConfig.from}>`,
          to: email,
          subject: '💳 ¡Tu tarjeta virtual PAYSAT está activa!',
          html: htmlContent
        };
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email de activación de tarjeta enviado exitosamente - ID:', result.messageId);
        return { success: true, messageId: result.messageId, email };
      } catch (error) {
        console.error('❌ Error enviando email de activación de tarjeta:', error);
        return { success: false, error: error.message };
      }
    }
  
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
   * @param {string} data.PAYSATAccountNumber - Número de cuenta PaySat
   * @param {string} data.paysatUID - UID del usuario en PaySat
   */
  async sendCardRechargeConfirmation(data) {
    try {
      console.log('📧 Enviando email de confirmación de recarga de tarjeta a:', data.email);

      const { email, userName, amount, currency = 'USD', gpaOrderToken, cardMovementId, accountMovementId, PAYSATAccountNumber, paysatUID } = data;

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
        PAYSATAccountNumber,
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
              <p><strong>Número de cuenta:</strong> ${data.PAYSATAccountNumber}</p>
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
 * Envía un correo de bienvenida al usuario que inicia sesión por primera vez.
 * @param {Object} params
 * @param {string} params.firstName - Nombre del usuario
 * @param {string} params.email - Email del destinatario
 */

  async sendWelcomeEmail({ firstName, email }) {
    let logoUrl = process.env.APP_LOGO_URL || 'https://firebasestorage.googleapis.com/v0/b/ps-transferencias.firebasestorage.app/o/app_assets%2Flogos%2Ficon6.png?alt=media&token=9b19110a-2bd6-4b53-9f65-41eedf15e632';

    const currentDate = new Date().toLocaleString('es-ES', { 
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a PAYSAT!</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0; }
          .logo { width: 80px; height: 80px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .content { padding: 32px; background: #f8f9fa; }
          .welcome-icon { font-size: 64px; text-align: center; margin: 24px 0; }
          .greeting { font-size: 28px; font-weight: bold; color: #1F2937; text-align: center; margin: 20px 0; }
          .intro-text { font-size: 16px; color: #4B5563; text-align: center; line-height: 1.6; margin: 20px 0; }
          .session-box { background: #E0E7FF; border-left: 4px solid #4F46E5; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center; }
          .session-title { font-weight: bold; color: #312E81; margin-bottom: 8px; font-size: 15px; }
          .session-text { color: #4338CA; font-size: 14px; }
          .features-section { background: white; padding: 28px; border-radius: 12px; margin: 24px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
          .feature { display: flex; align-items: flex-start; margin-bottom: 16px; padding: 12px; background: #F9FAFB; border-radius: 8px; }
          .feature-icon { font-size: 28px; margin-right: 12px; min-width: 35px; }
          .feature-content { flex: 1; }
          .feature-title { font-weight: bold; color: #1F2937; font-size: 15px; margin-bottom: 2px; }
          .feature-desc { color: #6B7280; font-size: 13px; line-height: 1.4; }
          .cta-section { text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border-radius: 12px; }
          .button { background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3); transition: background 0.3s; }
          .button:hover { background: #4338CA; }
          .info-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 8px; margin: 24px 0; }
          .info-box-title { font-weight: bold; color: #92400E; margin-bottom: 8px; font-size: 15px; }
          .info-box-text { color: #78350F; font-size: 14px; line-height: 1.5; }
          .footer { background: #1F2937; color: white; padding: 24px; text-align: center; font-size: 13px; border-radius: 0 0 12px 12px; }
          .footer a { color: #60A5FA; text-decoration: none; }
          .social-links { margin: 16px 0; }
          .social-links a { display: inline-block; margin: 0 8px; color: #60A5FA; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="PAYSAT" class="logo" />
            <h1 style="margin: 0; font-size: 32px;">¡Bienvenido a PAYSAT!</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Has iniciado sesión exitosamente</p>
          </div>
          
          <div class="content">
            <div class="welcome-icon">👋</div>
            
            <div class="greeting">¡Hola ${firstName || 'Usuario'}!</div>
            
            <div class="intro-text">
              Has iniciado sesión exitosamente en tu cuenta PAYSAT. Nos alegra verte de nuevo en nuestra plataforma bancaria digital.
            </div>

            <div class="session-box">
              <div class="session-title">📅 Información de tu sesión</div>
              <div class="session-text">
                <strong>Fecha y hora de acceso:</strong><br/>
                ${currentDate}
              </div>
            </div>

            <div class="cta-section">
              <h3 style="color: #4F46E5; margin-top: 0; margin-bottom: 8px;">Tu cuenta está lista</h3>
              <p style="color: #6B7280; margin: 12px 0;">Accede a todas las funciones de PAYSAT desde tu aplicación</p>
              <a href="https://paysatmoney.com" class="button">Ir a mi cuenta</a>
            </div>

            <div class="features-section">
              <h3 style="color: #4F46E5; margin-top: 0; font-size: 18px; text-align: center; margin-bottom: 20px;">¿Qué puedes hacer ahora?</h3>
              
              <div class="feature">
                <div class="feature-icon">💰</div>
                <div class="feature-content">
                  <div class="feature-title">Recargar tu cuenta</div>
                  <div class="feature-desc">Agrega fondos de manera rápida y segura con múltiples métodos de pago.</div>
                </div>
              </div>

              <div class="feature">
                <div class="feature-icon">💳</div>
                <div class="feature-content">
                  <div class="feature-title">Gestionar tarjetas virtuales</div>
                  <div class="feature-desc">Crea, activa o recarga tus tarjetas virtuales para compras online seguras.</div>
                </div>
              </div>

              <div class="feature">
                <div class="feature-icon">💸</div>
                <div class="feature-content">
                  <div class="feature-title">Enviar transferencias</div>
                  <div class="feature-desc">Transfiere dinero al instante a otros usuarios PAYSAT y otras instituciones.</div>
                </div>
              </div>

              <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-content">
                  <div class="feature-title">Consultar movimientos</div>
                  <div class="feature-desc">Revisa tu historial de transacciones y saldos en tiempo real.</div>
                </div>
              </div>

              <div class="feature">
                <div class="feature-icon">🔒</div>
                <div class="feature-content">
                  <div class="feature-title">Seguridad garantizada</div>
                  <div class="feature-desc">Tu dinero protegido con tecnología de encriptación de nivel bancario.</div>
                </div>
              </div>

              <div class="feature">
                <div class="feature-icon">🌍</div>
                <div class="feature-content">
                  <div class="feature-title">Pagos sin fronteras</div>
                  <div class="feature-desc">Realiza pagos internacionales y compras en cualquier moneda.</div>
                </div>
              </div>
            </div>

            <div class="info-box">
              <div class="info-box-title">🛡️ Recomendaciones de seguridad:</div>
              <div class="info-box-text">
                • Nunca compartas tu contraseña ni códigos de verificación<br/>
                • Verifica siempre que estés en el sitio oficial de PAYSAT<br/>
                • Activa la autenticación de dos factores para mayor seguridad<br/>
                • Si no reconoces este inicio de sesión, contacta inmediatamente a soporte
              </div>
            </div>

            <p style="text-align: center; color: #6B7280; font-size: 14px; margin-top: 24px;">
              ¿Necesitas ayuda? Nuestro equipo de soporte está disponible para asistirte en cualquier momento.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 12px 0; font-size: 15px;">Gracias por confiar en PAYSAT</p>
            <div class="social-links">
              <a href="https://paysatmoney.com">🌐 Web</a>
              <a href="mailto:${emailConfig.supportEmail}">✉️ Soporte</a>
            </div>
            <p style="margin: 16px 0 8px 0; font-size: 12px; opacity: 0.8;">
              Este es un email automático de notificación de inicio de sesión.
            </p>
            <p style="margin: 8px 0; font-size: 12px; opacity: 0.8;">
              Si tienes preguntas o dudas, contacta nuestro soporte: <a href="mailto:${emailConfig.supportEmail}">${emailConfig.supportEmail}</a>
            </p>
            <p style="margin: 16px 0 0 0; font-size: 11px; opacity: 0.7;">&copy; 2025 PAYSAT. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: `¡Bienvenido de nuevo a ${emailConfig.company}! 👋`,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error enviando correo de bienvenida:', error);
      return { success: false, error };
    }
  }

  /**
   * Envía un correo de notificación al remitente de una transferencia
   * @param {Object} params
   * @param {string} params.email - Email del remitente
   * @param {string} params.recipientName - Nombre del destinatario
   * @param {number} params.amount - Monto transferido
   * @param {string} params.movementId - ID del movimiento
   * @param {string} params.originLogoUrl - URL del logo de origen
   * @param {string} params.destinationLogoUrl - URL del logo de destino
   * @param {string} params.destinationAffiliate - Nombre del afiliado destino
   */
  async sendTransferSentEmail({ email, recipientName, amount, movementId, originLogoUrl, destinationLogoUrl, destinationAffiliate }) {
    const appLogoUrl = 'https://firebasestorage.googleapis.com/v0/b/ps-transferencias.firebasestorage.app/o/app_assets%2Flogos%2Ficon6.png?alt=media&token=9b19110a-2bd6-4b53-9f65-41eedf15e632';
    const appArrow = 'https://firebasestorage.googleapis.com/v0/b/ps-transferencias.firebasestorage.app/o/app_assets%2Farrows%2Farrow.png?alt=media&token=e24d66ea-3ff6-48c8-8ce4-58f0a8e73e70';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7fafc; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.07);">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${appLogoUrl}" alt="EcuaRed Transfer" style="width: 80px; height: 80px; border-radius: 16px; margin-bottom: 12px;" />
          <h2 style="color: #26A69A; margin-bottom: 8px;">Transferencia Realizada Exitosamente</h2>
        </div>
        
        <div style="background: white; padding: 24px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #555; font-size: 16px; margin-bottom: 16px;">
            Tu transferencia ha sido procesada correctamente.
          </p>
          
          <div style="display: flex; align-items: center; justify-content: space-between; margin: 24px 0; padding: 20px; background: #f0f9ff; border-radius: 8px;">
            <div style="text-align: center; flex: 1;">
              ${originLogoUrl ? `<img src="${originLogoUrl}" alt="Origen" style="width: 60px; height: 60px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-size: 14px; color: #666;">Tu cuenta</div>
            </div>
            
            <div style="text-align: center; flex: 1;">
                ${appArrow ? `<img src="${appArrow}" alt="Flecha" style="width: 60px; height: 20px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
            </div>
            
            <div style="text-align: center; flex: 1;">
              ${destinationLogoUrl ? `<img src="${destinationLogoUrl}" alt="Destino" style="width: 60px; height: 60px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-size: 14px; color: #666;">${destinationAffiliate}</div>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
            <div style="margin-bottom: 12px;">
              <span style="color: #666; font-size: 14px;">Monto transferido:</span>
              <span style="color: #26A69A; font-size: 24px; font-weight: bold; float: right;">$${amount.toFixed(2)}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: #666; font-size: 14px;">Destinatario:</span>
              <span style="color: #333; font-weight: 500; float: right;">${recipientName}</span>
            </div>
            <div>
              <span style="color: #666; font-size: 14px;">ID de transacción:</span>
              <span style="color: #888; font-size: 12px; float: right;">${movementId}</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #666; font-size: 14px;">Gracias por usar EcuaRed Transfer</p>
          <span style="color: #aaa; font-size: 13px;">Equipo de EcuaRed Transfer</span>
        </div>
      </div>
    `;

    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: `Transferencia realizada - $${amount.toFixed(2)}`,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error enviando correo de transferencia enviada:', error);
      return { success: false, error };
    }
  }

  /**
   * Envía un correo de notificación al destinatario de una transferencia
   * @param {Object} params
   * @param {string} params.email - Email del destinatario
   * @param {string} params.senderName - Nombre del remitente
   * @param {number} params.amount - Monto recibido
   * @param {string} params.movementId - ID del movimiento
   * @param {string} params.originLogoUrl - URL del logo de origen
   * @param {string} params.destinationLogoUrl - URL del logo de destino
   * @param {string} params.destinationAffiliate - Nombre del afiliado destino
   */
  async sendTransferReceivedEmail({ email, senderName, amount, movementId, originLogoUrl, destinationLogoUrl, destinationAffiliate }) {
    const appLogoUrl = 'https://firebasestorage.googleapis.com/v0/b/ps-transferencias.firebasestorage.app/o/app_assets%2Flogos%2Ficon6.png?alt=media&token=9b19110a-2bd6-4b53-9f65-41eedf15e632';
    const appArrow = 'https://firebasestorage.googleapis.com/v0/b/ps-transferencias.firebasestorage.app/o/app_assets%2Farrows%2Farrow.png?alt=media&token=e24d66ea-3ff6-48c8-8ce4-58f0a8e73e70';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7fafc; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.07);">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${appLogoUrl}" alt="EcuaRed Transfer" style="width: 80px; height: 80px; border-radius: 16px; margin-bottom: 12px;" />
          <h2 style="color: #10b981; margin-bottom: 8px;">¡Has Recibido una Transferencia!</h2>
        </div>
        
        <div style="background: white; padding: 24px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #555; font-size: 16px; margin-bottom: 16px;">
            Has recibido una transferencia en tu cuenta de <strong>${destinationAffiliate}</strong>.
          </p>
          
          <div style="display: flex; align-items: center; justify-content: space-between; margin: 24px 0; padding: 20px; background: #f0fdf4; border-radius: 8px;">
            <div style="text-align: center; flex: 1;">
              ${originLogoUrl ? `<img src="${originLogoUrl}" alt="Origen" style="width: 60px; height: 60px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-size: 14px; color: #666;">Remitente</div>
            </div>
            
            <div style="text-align: center; flex: 1;">
                ${appArrow ? `<img src="${appArrow}" alt="Flecha" style="width: 60px; height: 20px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
            </div>
            
            <div style="text-align: center; flex: 1;">
              ${destinationLogoUrl ? `<img src="${destinationLogoUrl}" alt="Destino" style="width: 60px; height: 60px; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-size: 14px; color: #666;">Tu cuenta</div>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
            <div style="margin-bottom: 12px;">
              <span style="color: #666; font-size: 14px;">Monto recibido:</span>
              <span style="color: #10b981; font-size: 24px; font-weight: bold; float: right;">$${amount.toFixed(2)}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: #666; font-size: 14px;">Remitente:</span>
              <span style="color: #333; font-weight: 500; float: right;">${senderName}</span>
            </div>
            <div>
              <span style="color: #666; font-size: 14px;">ID de transacción:</span>
              <span style="color: #888; font-size: 12px; float: right;">${movementId}</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #666; font-size: 14px;">Gracias por usar EcuaRed Transfer</p>
          <span style="color: #aaa; font-size: 13px;">Equipo de EcuaRed Transfer</span>
        </div>
      </div>
    `;

    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: `Has recibido una transferencia - $${amount.toFixed(2)}`,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error enviando correo de transferencia recibida:', error);
      return { success: false, error };
    }
  }

  /**
   * Obtiene los logos de las instituciones afiliadas
   * @param {string} originCollectionName - Nombre de la colección origen
   * @param {string} destinationCollectionName - Nombre de la colección destino
   * @returns {Object} { originLogoUrl, destinationLogoUrl }
   */
  async getAffiliateLogos(originCollectionName, destinationCollectionName) {
    try {
      let originLogoUrl = '';
      let destinationLogoUrl = '';

      // Obtener logo de origen
      if (originCollectionName) {
        const originDoc = await db.collection('EcuaRed_Transfer_Affiliates').doc(originCollectionName).get();
        if (originDoc.exists) {
          originLogoUrl = originDoc.data().logo || '';
        }
      }

      // Obtener logo de destino
      if (destinationCollectionName) {
        const destinationDoc = await db.collection('EcuaRed_Transfer_Affiliates').doc(destinationCollectionName).get();
        if (destinationDoc.exists) {
          destinationLogoUrl = destinationDoc.data().logo || '';
        }
      }

      return { originLogoUrl, destinationLogoUrl };
    } catch (error) {
      console.error('Error obteniendo logos de afiliados:', error);
      return { originLogoUrl: '', destinationLogoUrl: '' };
    }
  }

  /**
   * Genera HTML para email de transferencia móvil enviada (origen)
   */
  generateOriginMobilePaymentHTML(data) {
    const formattedAmount = parseFloat(data.amount).toFixed(2);
    const formattedFee = data.feeValue ? parseFloat(data.feeValue).toFixed(2) : '0.00';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transferencia enviada - PAYSAT</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f8f9fa; }
          .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; color: #4F46E5; text-align: center; margin: 20px 0; }
          .amount-label { font-size: 14px; color: #6B7280; text-align: center; margin-top: -15px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💸 PAYSAT</h1>
            <p>Transferencia enviada exitosamente</p>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            <h2 style="text-align: center; color: #374151;">¡Transferencia enviada!</h2>
            <p>Hola <strong>${data.originName || 'Usuario'}</strong>,</p>
            <p>Tu transferencia ha sido procesada exitosamente.</p>
            <div class="amount">$${formattedAmount} USD</div>
            <div class="amount-label">Monto transferido</div>
            <div class="details">
              <h3>Detalles de la transferencia:</h3>
              <p><strong>Destinatario:</strong> ${data.destinationName}</p>
              ${data.destinationPhoneNumber ? `<p><strong>Teléfono destino:</strong> ${data.destinationPhoneNumber}</p>` : ''}
              ${data.affiliateName ? `<p><strong>Desde:</strong> ${data.affiliateName}</p>` : '<p><strong>Desde:</strong> Cuenta PAYSAT</p>'}
              <p><strong>Monto:</strong> $${formattedAmount} USD</p>
              ${data.feeValue > 0 ? `<p><strong>Comisión:</strong> $${formattedFee} USD</p>` : ''}
              <p><strong>Fecha:</strong> ${data.fecha}</p>
              ${data.securityReference ? `<p><strong>Referencia:</strong> ${data.securityReference}</p>` : ''}
              <p><strong>Estado:</strong> Completada ✅</p>
            </div>
            <p style="text-align: center; color: #6B7280;">Gracias por usar PAYSAT</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas.</p>
            <p>Si tienes dudas, contacta nuestro soporte: ${emailConfig.supportEmail}</p>
            <p>&copy; 2026 PAYSAT. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera HTML para email de transferencia móvil recibida (destino)
   */
  generateDestinationMobilePaymentHTML(data) {
    const formattedAmount = parseFloat(data.amount).toFixed(2);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transferencia recibida - PAYSAT</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f8f9fa; }
          .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; color: #10B981; text-align: center; margin: 20px 0; }
          .amount-label { font-size: 14px; color: #6B7280; text-align: center; margin-top: -15px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #374151; color: white; padding: 20px; text-align: center; font-size: 12px; }
          .cta { background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 PAYSAT</h1>
            <p>Has recibido dinero</p>
          </div>
          <div class="content">
            <div class="success-icon">🎉</div>
            <h2 style="text-align: center; color: #374151;">¡Has recibido una transferencia!</h2>
            <p>Hola <strong>${data.destinationName || 'Usuario'}</strong>,</p>
            <p>Has recibido una transferencia exitosamente.</p>
            <div class="amount">$${formattedAmount} USD</div>
            <div class="amount-label">Monto recibido</div>
            <div class="details">
              <h3>Detalles de la transferencia:</h3>
              <p><strong>Remitente:</strong> ${data.originName}</p>
              <p><strong>Monto:</strong> $${formattedAmount} USD</p>
              <p><strong>Fecha:</strong> ${data.fecha}</p>
              ${data.securityReference ? `<p><strong>Referencia:</strong> ${data.securityReference}</p>` : ''}
              <p><strong>Estado:</strong> ${data.hasAccount ? 'Acreditado en tu cuenta PAYSAT ✅' : 'Disponible para usar ✅'}</p>
            </div>
            ${!data.hasAccount ? `
            <div style="background: #EEF2FF; padding: 18px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #4F46E5; font-weight: bold;">💡 Aprovecha tu dinero al máximo</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;">Podrás usarlo con:</p>
              <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
                <li>Cuenta PAYSAT</li>
                <li>Pagos QR</li>
                <li>Tarjeta VISA PAYSAT</li>
              </ul>
              <div style="text-align: center;">
                <a href="https://play.google.com/store/apps/details?id=com.paysat.paysatapp" class="cta">Descargar app PAYSAT</a>
              </div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #6B7280; text-align: center;">Regístrate con el número telefónico donde recibiste esta transferencia</p>
            </div>
            ` : ''}
            <p style="text-align: center; color: #6B7280;">Gracias por confiar en PAYSAT</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas.</p>
            <p>Si tienes dudas, contacta nuestro soporte: ${emailConfig.supportEmail}</p>
            <p>&copy; 2026 PAYSAT. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envía email de transferencia móvil al origen
   */
  async sendOriginMobilePaymentEmail(data) {
    try {
      const { email, originName, destinationName, amount, feeValue, fecha, affiliateName, securityReference, destinationPhoneNumber } = data;

      if (!email) {
        console.log('No se proporcionó email para el origen');
        return { success: false, error: 'Email no proporcionado' };
      }

      const htmlContent = this.generateOriginMobilePaymentHTML({
        originName,
        destinationName,
        amount,
        feeValue,
        fecha,
        affiliateName,
        securityReference,
        destinationPhoneNumber
      });

      const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: `Transferencia enviada - $${parseFloat(amount).toFixed(2)} USD - PAYSAT`,
        html: htmlContent
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email de transferencia enviada a ${email}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error enviando email de origen:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email de transferencia móvil al destino
   */
  async sendDestinationMobilePaymentEmail(data) {
    try {
      const { email, destinationName, originName, amount, fecha, securityReference, hasAccount } = data;

      if (!email) {
        console.log('No se proporcionó email para el destino');
        return { success: false, error: 'Email no proporcionado' };
      }

      const htmlContent = this.generateDestinationMobilePaymentHTML({
        destinationName,
        originName,
        amount,
        fecha,
        securityReference,
        hasAccount
      });

      const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: `Has recibido $${parseFloat(amount).toFixed(2)} USD - PAYSAT`,
        html: htmlContent
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email de transferencia recibida a ${email}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error enviando email de destino:', error);
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;