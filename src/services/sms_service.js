import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSMS(to, body) {
    try {
        const message = await client.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to,
            body: body
        });
        
        console.log(`SMS enviado a ${to}: ${message.sid}`);
        return { success: true, messageSid: message.sid };
    } catch (error) {
        // Extraer código de país del número (ej: +58 = Venezuela, +55 = Brasil, +593 = Ecuador)
        const countryCode = to.match(/^\+(\d{1,3})/)?.[1] || 'desconocido';
        const errorCode = error.code || 'SIN_CODIGO';
        
        console.error(`❌ Error ${errorCode} enviando SMS a ${to} (País: +${countryCode}):`, error.message);
        
        // Mensaje específico para error de permisos geográficos
        if (errorCode === 21408) {
            console.error(`⚠️  SOLUCIÓN: Habilita permisos geográficos para el país +${countryCode} en Twilio Console > Messaging > Geo Permissions`);
        }
        
        return { success: false, error: error.message, errorCode, countryCode: `+${countryCode}` };
    }
}

export async function sendWhatsApp(to, amount, originUserName, securityRef) {
    // Validaciones
    if (!to) {
        return { success: false, error: 'Número de teléfono es requerido' };
    }
    
    // Remover prefijo whatsapp: si ya existe
    const cleanNumber = to.replace(/^whatsapp:/, '');
    
    // Validar formato E.164
    if (!cleanNumber.match(/^\+[1-9]\d{1,14}$/)) {
        return { success: false, error: 'El número debe estar en formato E.164 (+593...)' };
    }
    
    try {
        // Si la plantilla NO tiene variables, NO incluir contentVariables
        // Si tiene variables como {{1}}, {{2}}, descomentar la línea contentVariables
        const message = await client.messages.create({
            contentSid: "HXfca671dc908ac9555dae80294b65f9b0",
            // Solo descomentar si tu plantilla tiene variables {{1}}, {{2}}, etc:
            // contentVariables: JSON.stringify({ 1: amount, 2: originUserName, 3: securityRef }),
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${cleanNumber}`,
        });
        
        console.log(`✅ WhatsApp (plantilla) enviado a ${cleanNumber}: ${message.sid}`);
        return { success: true, messageSid: message.sid };
    } catch (error) {
        const countryCode = cleanNumber.match(/^\+(\d{1,3})/)?.[1] || 'desconocido';
        const errorCode = error.code || 'SIN_CODIGO';
        
        console.error(`❌ Error ${errorCode} enviando WhatsApp a ${cleanNumber} (País: +${countryCode}):`, error.message);
        console.error(`   Detalles completos:`, error);
        
        // Mensajes específicos según el código de error
        if (errorCode === 63016) {
            console.error(`⚠️  WhatsApp requiere plantilla pre-aprobada fuera de la ventana de 24h.`);
        } else if (errorCode === 63007) {
            console.error(`⚠️  El contentSid no es válido o la plantilla no está aprobada. Verifica en Twilio Console.`);
        }
        
        return { success: false, error: error.message, errorCode, countryCode: `+${countryCode}` };
    }
}

export async function sendTransferNotifications(phoneOrigin, phoneDestination, amount, affiliateNameDestination) {
    const notifications = [];
    
    // Enviar SMS al origen
    if (phoneOrigin) {
        const messageOrigin = `EcuaRed Transfer: Tu transferencia de $${amount.toFixed(2)} USD ha sido realizada exitosamente.`;
        const resultOrigin = await sendSMS(phoneOrigin, messageOrigin);
        notifications.push({ type: 'origin', phone: phoneOrigin, ...resultOrigin });
    }
    
    // Enviar SMS al destinatario
    if (phoneDestination) {
        const messageDestination = `EcuaRed Transfer: Has recibido una transferencia de $${amount.toFixed(2)} USD en tu cuenta de ${affiliateNameDestination}.`;
        const resultDestination = await sendSMS(phoneDestination, messageDestination);
        notifications.push({ type: 'destination', phone: phoneDestination, ...resultDestination });
    }
    
    return notifications;
}
