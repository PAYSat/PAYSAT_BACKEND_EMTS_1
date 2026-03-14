import express from 'express';
import { db, admin } from '../config/firebase.js';

const router = express.Router();

/**
 * POST /api/fcm/save-token
 * Guarda o actualiza el token FCM de un usuario
 * Requiere autenticación
 */
router.post('/save-token', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;
        const { token, platform } = req.body;

        if (!token) {
            return res.status(400).json({
                ok: false,
                message: 'El token FCM es requerido'
            });
        }

        if (!platform || !['ios', 'android'].includes(platform.toLowerCase())) {
            return res.status(400).json({
                ok: false,
                message: 'La plataforma debe ser ios o android'
            });
        }

        // Verificar si el token ya existe para este usuario
        const existingTokenSnapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .where('token', '==', token)
            .limit(1)
            .get();

        if (!existingTokenSnapshot.empty) {
            // Token ya existe, actualizar timestamp
            const docRef = existingTokenSnapshot.docs[0].ref;
            await docRef.update({
                updatedAt: admin.firestore.Timestamp.now(),
                platform: platform.toLowerCase()
            });

            return res.status(200).json({
                ok: true,
                message: 'Token actualizado exitosamente',
                action: 'updated'
            });
        }

        // Token no existe, crear nuevo
        const docRef = db.collection('PaySat_User_FCM_Tokens').doc();
        await docRef.set({
            uid,
            token,
            platform: platform.toLowerCase(),
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            active: true
        });

        return res.status(201).json({
            ok: true,
            message: 'Token guardado exitosamente',
            action: 'created',
            tokenId: docRef.id
        });

    } catch (error) {
        console.error('Error guardando token FCM:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al guardar el token FCM',
            error: error.message
        });
    }
});

/**
 * DELETE /api/fcm/delete-token
 * Elimina el token FCM de un usuario
 * Requiere autenticación
 */
router.delete('/delete-token', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                ok: false,
                message: 'El token FCM es requerido'
            });
        }

        // Buscar y eliminar el token
        const snapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .where('token', '==', token)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({
                ok: false,
                message: 'Token no encontrado'
            });
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return res.status(200).json({
            ok: true,
            message: 'Token eliminado exitosamente',
            tokensDeleted: snapshot.size
        });

    } catch (error) {
        console.error('Error eliminando token FCM:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al eliminar el token FCM',
            error: error.message
        });
    }
});

/**
 * DELETE /api/fcm/delete-all-tokens
 * Elimina todos los tokens FCM de un usuario (usado al cerrar sesión)
 * Requiere autenticación
 */
router.delete('/delete-all-tokens', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;

        // Buscar todos los tokens del usuario
        const snapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({
                ok: true,
                message: 'No hay tokens para eliminar',
                tokensDeleted: 0
            });
        }

        // Eliminar todos los tokens
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return res.status(200).json({
            ok: true,
            message: 'Todos los tokens eliminados exitosamente',
            tokensDeleted: snapshot.size
        });

    } catch (error) {
        console.error('Error eliminando todos los tokens FCM:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al eliminar los tokens FCM',
            error: error.message
        });
    }
});

/**
 * GET /api/fcm/my-tokens
 * Obtiene todos los tokens FCM del usuario autenticado
 * Requiere autenticación
 */
router.get('/my-tokens', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;

        // Obtener todos los tokens del usuario
        const snapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .orderBy('updatedAt', 'desc')
            .get();

        const tokens = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                token: data.token,
                platform: data.platform,
                active: data.active,
                createdAt: data.createdAt.toDate().toISOString(),
                updatedAt: data.updatedAt.toDate().toISOString()
            };
        });

        return res.status(200).json({
            ok: true,
            tokens,
            count: tokens.length
        });

    } catch (error) {
        console.error('Error obteniendo tokens FCM:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al obtener los tokens FCM',
            error: error.message
        });
    }
});

/**
 * POST /api/fcm/test-notification
 * Envía una notificación de prueba al usuario autenticado
 * Requiere autenticación
 */
router.post('/test-notification', async (req, res) => {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado'
            });
        }

        const uid = req.user.uid;

        // Obtener tokens del usuario
        const snapshot = await db.collection('PaySat_User_FCM_Tokens')
            .where('uid', '==', uid)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({
                ok: false,
                message: 'No se encontraron tokens FCM para este usuario'
            });
        }

        const tokens = snapshot.docs.map(d => d.data().token).filter(Boolean);

        // Enviar notificación de prueba
        const payload = {
            notification: {
                title: '🔔 Notificación de Prueba',
                body: 'Tu configuración de notificaciones está funcionando correctamente.'
            },
            data: {
                type: 'TEST_NOTIFICATION',
                timestamp: new Date().toISOString(),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            ...payload,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'paysat_transfers'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        'content-available': 1
                    }
                }
            }
        });

        return res.status(200).json({
            ok: true,
            message: 'Notificación de prueba enviada',
            successCount: response.successCount,
            failureCount: response.failureCount,
            totalTokens: tokens.length
        });

    } catch (error) {
        console.error('Error enviando notificación de prueba:', error);
        return res.status(500).json({
            ok: false,
            message: 'Error al enviar la notificación de prueba',
            error: error.message
        });
    }
});

export default router;
