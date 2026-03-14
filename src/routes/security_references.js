import express from 'express';
import { db, admin } from '../config/firebase.js';
import { validateSecurityReference, markReferenceAsUsed } from '../services/security_reference_service.js';

const router = express.Router();

/**
 * POST /api/security-references/validate
 * Valida una referencia de seguridad
 */
router.post('/validate', async (req, res) => {
    try {
        const { reference, phoneNumber } = req.body;

        if (!reference) {
            return res.status(400).json({
                ok: false,
                message: 'La referencia es requerida'
            });
        }

        // Validar la referencia
        const result = await validateSecurityReference(reference, phoneNumber);

        if (!result.valid) {
            return res.status(404).json({
                ok: false,
                message: result.message
            });
        }

        return res.status(200).json({
            ok: true,
            valid: true,
            data: {
                transactionUID: result.transactionUID,
                amount: result.amount,
                createdAt: result.createdAt,
                metadata: result.data.metadata
            }
        });

    } catch (error) {
        console.error('Error validando referencia:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al validar la referencia',
            error: error.message
        });
    }
});

/**
 * GET /api/security-references/pending/:phoneNumber
 * Obtiene referencias pendientes para un número de teléfono
 */
router.get('/pending/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({
                ok: false,
                message: 'El número de teléfono es requerido'
            });
        }

        // Buscar referencias pendientes para este número
        const snapshot = await db.collection('PaySat_Security_References')
            .where('destinationPhoneNumber', '==', phoneNumber)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            return res.status(200).json({
                ok: true,
                hasPendingReferences: false,
                references: []
            });
        }

        const now = admin.firestore.Timestamp.now();
        const references = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Verificar que no esté expirada
            if (data.expiresAt && data.expiresAt.toMillis() > now.toMillis()) {
                references.push({
                    id: doc.id,
                    reference: data.reference,
                    amount: data.amount,
                    transactionUID: data.transactionUID,
                    createdAt: data.createdAt.toDate().toISOString(),
                    metadata: data.metadata || {}
                });
            }
        });

        return res.status(200).json({
            ok: true,
            hasPendingReferences: references.length > 0,
            references,
            count: references.length
        });

    } catch (error) {
        console.error('Error obteniendo referencias pendientes:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al obtener referencias pendientes',
            error: error.message
        });
    }
});

/**
 * POST /api/security-references/claim
 * Reclama una referencia y acredita los fondos
 * Requiere autenticación
 */
router.post('/claim', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({
                ok: false,
                message: 'La referencia es requerida'
            });
        }

        // Obtener datos del usuario
        const userDoc = await db.collection('Banco_PaySat_Money').doc(uid).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                ok: false,
                message: 'Usuario no encontrado'
            });
        }

        const userData = userDoc.data();
        const userPhone = userData.customerPhone;

        // Validar la referencia
        const validationResult = await validateSecurityReference(reference, userPhone);

        if (!validationResult.valid) {
            return res.status(400).json({
                ok: false,
                message: validationResult.message
            });
        }

        // Obtener detalles completos de la referencia
        const refSnapshot = await db.collection('PaySat_Security_References')
            .where('reference', '==', reference)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (refSnapshot.empty) {
            return res.status(404).json({
                ok: false,
                message: 'Referencia no encontrada'
            });
        }

        const refDoc = refSnapshot.docs[0];
        const refData = refDoc.data();

        // Ejecutar transacción para acreditar fondos
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('Banco_PaySat_Money').doc(uid);
            const userSnapshot = await transaction.get(userRef);
            
            if (!userSnapshot.exists) {
                throw new Error('Usuario no encontrado');
            }

            const currentData = userSnapshot.data();
            const currentBalance = currentData.customerBalance || 0;
            const currentEscrow = currentData.customerEscrow || 0;
            const newBalance = currentBalance + refData.amount;
            const newTotal = newBalance + currentEscrow;

            // Actualizar balance del usuario
            transaction.update(userRef, {
                customerBalance: newBalance,
                customerTotal: newTotal,
                updatedAt: admin.firestore.Timestamp.now()
            });

            // Registrar movimiento
            const movementId = `reference_claim_${refData.transactionUID}`;
            const movement = {
                PAYSATAccountNumber: currentData.customerAccountNumber,
                amount: refData.amount,
                amount_cents: Math.round(refData.amount * 100),
                createdAt: new Date().toISOString(),
                currency: 'usd',
                id: movementId,
                description: `Fondos acreditados - Ref: ${reference}`,
                paysatUID: uid,
                typeMovement: 'reference_claim',
                status: 'success',
                securityReference: reference,
                originalTransactionUID: refData.transactionUID
            };

            transaction.update(userRef, {
                customerMovements: admin.firestore.FieldValue.arrayUnion(movement)
            });

            // Marcar referencia como usada
            transaction.update(refDoc.ref, {
                status: 'used',
                usedAt: admin.firestore.Timestamp.now(),
                claimedByUID: uid
            });
        });

        return res.status(200).json({
            ok: true,
            message: 'Fondos acreditados exitosamente',
            data: {
                amount: refData.amount,
                reference: reference,
                transactionUID: refData.transactionUID
            }
        });

    } catch (error) {
        console.error('Error reclamando referencia:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al reclamar la referencia',
            error: error.message
        });
    }
});

/**
 * POST /api/security-references/mark-used
 * Marca una referencia como usada (solo admin)
 */
router.post('/mark-used', async (req, res) => {
    try {
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({
                ok: false,
                message: 'La referencia es requerida'
            });
        }

        const result = await markReferenceAsUsed(reference);

        if (!result.success) {
            return res.status(404).json({
                ok: false,
                message: result.message
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Referencia marcada como usada exitosamente'
        });

    } catch (error) {
        console.error('Error marcando referencia:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al marcar la referencia',
            error: error.message
        });
    }
});

export default router;
