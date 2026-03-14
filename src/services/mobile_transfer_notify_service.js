import { db } from '../config/firebase.js';
import admin from 'firebase-admin';
import { sendSMS } from './sms_service.js';
import { generateUniqueSecurityReference, saveSecurityReference } from './security_reference_service.js';

/**
 * Obtiene los tokens FCM de un usuario
 */
async function getUserTokens(uid) {
    const snap = await db.collection('PaySat_User_FCM_Tokens')
        .where('uid', '==', uid)
        .get();

    return snap.docs.map(d => d.data().token).filter(Boolean);
}

/**
 * Envía notificación push a un usuario
 */
async function notifyUser(uid, payload) {
    const tokens = await getUserTokens(uid);
    if (!tokens.length) {
        console.log(`No hay tokens FCM para el usuario ${uid}`);
        return { ok: true, sent: 0, reason: 'no_tokens' };
    }

    try {
        const res = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: payload.notification,
            data: payload.data || {},
            android: payload.android || {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'paysat_transfers'
                }
            },
            apns: payload.apns || {
                payload: {
                    aps: {
                        sound: 'default',
                        'content-available': 1
                    }
                }
            },
        });

        console.log(`Notificación enviada a ${uid}: ${res.successCount} exitosas, ${res.failureCount} fallidas`);

        return { ok: true, sent: res.successCount, failed: res.failureCount };
    } catch (error) {
        console.error(`Error enviando notificación a ${uid}:`, error);
        return { ok: false, error: error.message };
    }
}

/**
 * CASO 1: Notificaciones para transferencia PaySat -> PaySat (ambos usuarios tienen cuenta)
 */
export async function notifyPaySatToPaySatTransfer({
    originUID,
    destinationUID,
    amount,
    destinationName,
    originName,
    transactionUID,
    feeValue = 0
}) {
    try {
        const results = {
            origin: null,
            destination: null
        };

        // Notificación al ORIGEN
        const originPayload = {
            notification: {
                title: '💸 Transferencia enviada',
                body: `Enviaste $${amount.toFixed(2)} USD a ${destinationName} desde tu cuenta PAYSAT.`
            },
            data: {
                type: 'MOBILE_TRANSFER_SENT',
                transactionUID,
                amount: amount.toString(),
                fee: feeValue.toString(),
                destinationName,
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        results.origin = await notifyUser(originUID, originPayload);

        // Notificación al DESTINO
        const destinationPayload = {
            notification: {
                title: '💰 Transferencia recibida',
                body: `Recibiste $${amount.toFixed(2)} USD. Está acreditada en tu cuenta PAYSAT.`
            },
            data: {
                type: 'MOBILE_TRANSFER_RECEIVED',
                transactionUID,
                amount: amount.toString(),
                originName,
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        results.destination = await notifyUser(destinationUID, destinationPayload);

        return {
            success: true,
            results
        };
    } catch (error) {
        console.error('Error en notifyPaySatToPaySatTransfer:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * CASO 2: Notificaciones para transferencia Cuenta Externa -> PaySat
 */
export async function notifyExternalToPaySatTransfer({
    originUID,
    destinationUID,
    amount,
    destinationName,
    originName,
    affiliateName,
    transactionUID,
    feeValue = 0
}) {
    try {
        const results = {
            origin: null,
            destination: null
        };

        // Notificación al ORIGEN
        const originPayload = {
            notification: {
                title: '💸 Transferencia enviada',
                body: `Enviaste $${amount.toFixed(2)} USD desde ${affiliateName} mediante servicios PAYSAT para ${destinationName}.`
            },
            data: {
                type: 'MOBILE_TRANSFER_SENT',
                transactionUID,
                amount: amount.toString(),
                fee: feeValue.toString(),
                destinationName,
                affiliateName,
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        results.origin = await notifyUser(originUID, originPayload);

        // Notificación al DESTINO (igual que el caso anterior)
        const destinationPayload = {
            notification: {
                title: '💰 Transferencia recibida',
                body: `Recibiste $${amount.toFixed(2)} USD de ${originName}. Está acreditada en tu cuenta PAYSAT.`
            },
            data: {
                type: 'MOBILE_TRANSFER_RECEIVED',
                transactionUID,
                amount: amount.toString(),
                originName,
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        results.destination = await notifyUser(destinationUID, destinationPayload);

        return {
            success: true,
            results
        };
    } catch (error) {
        console.error('Error en notifyExternalToPaySatTransfer:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * CASO 3: Notificaciones cuando el DESTINO NO tiene cuenta PaySat
 * En este caso se envía notificación push al origen y SMS al destino
 */
export async function notifyTransferToNonPaySatUser({
    originUID,
    amount,
    destinationName,
    destinationPhoneNumber,
    isOriginPaySat,
    affiliateName = null,
    transactionUID,
    feeValue = 0
}) {
    try {
        const results = {
            origin: null,
            destination: null,
            sms: null,
            securityReference: null
        };

        // Generar referencia de seguridad única
        const securityRef = await generateUniqueSecurityReference(4);
        
        // Guardar referencia de seguridad en la base de datos
        const refResult = await saveSecurityReference(securityRef, {
            transactionUID,
            amount,
            originUID,
            destinationPhoneNumber,
            type: 'mobile_transfer_to_non_paysat',
            status: 'active',
            metadata: {
                isOriginPaySat,
                affiliateName,
                destinationName
            }
        });

        results.securityReference = refResult;

        // Notificación push al ORIGEN
        let originBody;
        if (isOriginPaySat) {
            originBody = `Enviaste $${amount.toFixed(2)} USD a ${destinationName} desde tu cuenta PAYSAT.`;
        } else {
            originBody = `Enviaste $${amount.toFixed(2)} USD desde ${affiliateName} mediante PAYSAT para ${destinationName}.`;
        }

        const originPayload = {
            notification: {
                title: '💸 Transferencia enviada',
                body: originBody
            },
            data: {
                type: 'MOBILE_TRANSFER_SENT_NON_PAYSAT',
                transactionUID,
                amount: amount.toString(),
                fee: feeValue.toString(),
                destinationName,
                destinationPhoneNumber,
                securityReference: securityRef,
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        results.origin = await notifyUser(originUID, originPayload);

        // SMS al DESTINO (sin cuenta PaySat)
        const smsBody = `PAYSAT: Recibiste $${amount.toFixed(2)} USD
        (Ref: ${securityRef}).
Podrás usarlo con:
+ Cuenta PAYSAT
+ Pagos QR 
+ Tarjeta VISA PAYSAT.

Instala la app y regístrate con este mismo número telefónico:
https://play.google.com/store/apps/details?id=com.paysat.paysatapp`;

        results.sms = await sendSMS(destinationPhoneNumber, smsBody);

        return {
            success: true,
            securityReference: securityRef,
            results
        };
    } catch (error) {
        console.error('Error en notifyTransferToNonPaySatUser:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Función principal que determina qué tipo de notificación enviar
 */
export async function sendMobileTransferNotifications(transferData) {
    try {
        const {
            originUID,
            destinationUID = null,
            destinationUserExists,
            amount,
            destinationName,
            originName,
            destinationPhoneNumber,
            isOriginPaySat,
            affiliateName = null,
            transactionUID,
            feeValue = 0
        } = transferData;

        let result;

        if (destinationUserExists) {
            // El destinatario tiene cuenta PaySat
            if (isOriginPaySat) {
                // CASO 1: PaySat -> PaySat
                result = await notifyPaySatToPaySatTransfer({
                    originUID,
                    destinationUID,
                    amount,
                    destinationName,
                    originName,
                    transactionUID,
                    feeValue
                });
            } else {
                // CASO 2: Externa -> PaySat
                result = await notifyExternalToPaySatTransfer({
                    originUID,
                    destinationUID,
                    amount,
                    destinationName,
                    originName,
                    affiliateName,
                    transactionUID,
                    feeValue
                });
            }
        } else {
            // CASO 3: Destino NO tiene cuenta PaySat
            result = await notifyTransferToNonPaySatUser({
                originUID,
                amount,
                destinationName,
                destinationPhoneNumber,
                isOriginPaySat,
                affiliateName,
                transactionUID,
                feeValue
            });
        }

        return result;
    } catch (error) {
        console.error('Error en sendMobileTransferNotifications:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
