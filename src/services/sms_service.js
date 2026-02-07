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
        console.error(`Error enviando SMS a ${to}:`, error.message);
        return { success: false, error: error.message };
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
