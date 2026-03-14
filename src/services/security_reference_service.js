import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Genera un código de referencia corto alfanumérico (4-6 caracteres)
 * Ejemplo: 4A8K, B3TY, 7K9M
 */
export function generateSecurityReference(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference = '';
    
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        reference += chars[randomIndex];
    }
    
    return reference;
}

/**
 * Genera una referencia única verificando que no exista en la base de datos
 * @param {number} length - Longitud del código (default: 4)
 * @param {number} maxAttempts - Máximo de intentos para evitar colisiones (default: 10)
 * @returns {Promise<string>} - Referencia única generada
 */
export async function generateUniqueSecurityReference(length = 4, maxAttempts = 10) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const reference = generateSecurityReference(length);
        
        // Verificar si ya existe en la colección
        const existingRef = await db.collection('PaySat_Security_References')
            .where('reference', '==', reference)
            .where('createdAt', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Solo últimos 30 días
            .limit(1)
            .get();
        
        if (existingRef.empty) {
            return reference;
        }
        
        attempts++;
    }
    
    // Si después de maxAttempts no se genera único, aumentar longitud
    return generateSecurityReference(length + 1);
}

/**
 * Guarda la referencia de seguridad asociada a una transacción
 * @param {string} reference - Código de referencia corto
 * @param {object} transactionData - Datos de la transacción
 * @returns {Promise<object>} - Resultado de la operación
 */
export async function saveSecurityReference(reference, transactionData) {
    try {
        const docRef = db.collection('PaySat_Security_References').doc();
        
        const referenceData = {
            reference,
            transactionUID: transactionData.transactionUID,
            amount: transactionData.amount,
            originUID: transactionData.originUID,
            destinationUID: transactionData.destinationUID || null,
            destinationPhoneNumber: transactionData.destinationPhoneNumber || null,
            type: transactionData.type || 'mobile_transfer',
            status: transactionData.status || 'active',
            createdAt: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Expira en 90 días
            ),
            metadata: transactionData.metadata || {}
        };
        
        await docRef.set(referenceData);
        
        return {
            success: true,
            referenceId: docRef.id,
            reference
        };
    } catch (error) {
        console.error('Error guardando referencia de seguridad:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Valida una referencia de seguridad
 * @param {string} reference - Código de referencia a validar
 * @param {string} phoneNumber - Número de teléfono del usuario (opcional)
 * @returns {Promise<object>} - Información de la transacción asociada
 */
export async function validateSecurityReference(reference, phoneNumber = null) {
    try {
        const snapshot = await db.collection('PaySat_Security_References')
            .where('reference', '==', reference)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return {
                valid: false,
                message: 'Referencia no encontrada o expirada'
            };
        }
        
        const referenceData = snapshot.docs[0].data();
        const now = admin.firestore.Timestamp.now();
        
        // Verificar si está expirada
        if (referenceData.expiresAt && referenceData.expiresAt.toMillis() < now.toMillis()) {
            return {
                valid: false,
                message: 'Referencia expirada'
            };
        }
        
        // Si se proporciona número de teléfono, verificar que coincida
        if (phoneNumber && referenceData.destinationPhoneNumber) {
            if (referenceData.destinationPhoneNumber !== phoneNumber) {
                return {
                    valid: false,
                    message: 'Referencia no corresponde a este número telefónico'
                };
            }
        }
        
        return {
            valid: true,
            transactionUID: referenceData.transactionUID,
            amount: referenceData.amount,
            createdAt: referenceData.createdAt,
            data: referenceData
        };
    } catch (error) {
        console.error('Error validando referencia:', error);
        return {
            valid: false,
            message: 'Error al validar referencia',
            error: error.message
        };
    }
}

/**
 * Marca una referencia como usada/reclamada
 * @param {string} reference - Código de referencia
 * @returns {Promise<object>} - Resultado de la operación
 */
export async function markReferenceAsUsed(reference) {
    try {
        const snapshot = await db.collection('PaySat_Security_References')
            .where('reference', '==', reference)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return {
                success: false,
                message: 'Referencia no encontrada'
            };
        }
        
        const docRef = snapshot.docs[0].ref;
        await docRef.update({
            status: 'used',
            usedAt: admin.firestore.Timestamp.now()
        });
        
        return {
            success: true,
            message: 'Referencia marcada como usada'
        };
    } catch (error) {
        console.error('Error marcando referencia como usada:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
