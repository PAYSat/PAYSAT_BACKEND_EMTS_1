import { admin, db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import { sendTransferNotifications } from '../services/sms_service.js';
import EmailService from '../services/send_email_service.js';

class AppTransfersController {

    async send(req, res) {
        try {
            const {
                collectionNameOrigin,
                dniOrigin,
                nameOrigin,
                ctaOrigin,
                phoneOrigin,
                amountOrigin,
                reason,
                collectionNameDestination,
                affiliateNameDestination,
                dniDestination,
                nameDestination,
                ctaDestination,
                phoneDestination
            } = req.body;

            // Validar datos requeridos
            if (!collectionNameOrigin || !collectionNameDestination || !amountOrigin) {
                return res.status(400).json({
                    ok: false,
                    message: 'Faltan datos requeridos'
                });
            }

            // Validar que haya al menos un identificador para origen y destino
            if (!dniOrigin && !ctaOrigin && !phoneOrigin) {
                return res.status(400).json({
                    ok: false,
                    message: 'Debe proporcionar al menos un identificador de origen (dni, cuenta o teléfono)'
                });
            }

            if (!dniDestination && !ctaDestination && !phoneDestination) {
                return res.status(400).json({
                    ok: false,
                    message: 'Debe proporcionar al menos un identificador de destino (dni, cuenta o teléfono)'
                });
            }

            const timestamp = admin.firestore.Timestamp.now();
            const movementId = uuidv4();

            // Datos del movimiento de origen (envío)
            const movementOrigin = {
                NoCuenta: ctaDestination || '',
                NombreSocio: nameDestination || '',
                Telefono: phoneDestination || '',
                Saldo: parseFloat(amountOrigin),
                Total: parseFloat(amountOrigin),
                Escrow: 0,
                Fecha: timestamp,
                createdAt: timestamp,
                type: 'transfer_send',
                reason: reason || '',
                movementId: movementId
            };

            // Datos del movimiento de destino (recepción)
            const movementDestination = {
                NoCuenta: ctaOrigin || '',
                NombreSocio: nameOrigin || '',
                Telefono: phoneOrigin || '',
                Saldo: parseFloat(amountOrigin),
                Total: parseFloat(amountOrigin),
                Escrow: 0,
                Fecha: timestamp,
                createdAt: timestamp,
                type: 'transfer_received',
                reason: reason || '',
                movementId: movementId
            };

            // Buscar documento de origen
            const originCollection = db.collection(collectionNameOrigin);
            const originQuery = [];
            
            if (dniOrigin) originQuery.push(originCollection.where('CedulaSocio', '==', dniOrigin));
            if (ctaOrigin) originQuery.push(originCollection.where('NoCuenta', '==', ctaOrigin));
            if (phoneOrigin) originQuery.push(originCollection.where('Telefono', '==', phoneOrigin));

            let originDoc = null;
            for (const query of originQuery) {
                const snapshot = await query.limit(1).get();
                if (!snapshot.empty) {
                    originDoc = snapshot.docs[0];
                    break;
                }
            }

            if (!originDoc) {
                return res.status(404).json({
                    ok: false,
                    message: 'Documento de origen no encontrado'
                });
            }

            // Buscar documento de destino
            const destinationCollection = db.collection(collectionNameDestination);
            const destinationQuery = [];
            
            if (dniDestination) destinationQuery.push(destinationCollection.where('CedulaSocio', '==', dniDestination));
            if (ctaDestination) destinationQuery.push(destinationCollection.where('NoCuenta', '==', ctaDestination));
            if (phoneDestination) destinationQuery.push(destinationCollection.where('Telefono', '==', phoneDestination));

            let destinationDoc = null;
            for (const query of destinationQuery) {
                const snapshot = await query.limit(1).get();
                if (!snapshot.empty) {
                    destinationDoc = snapshot.docs[0];
                    break;
                }
            }

            if (!destinationDoc) {
                return res.status(404).json({
                    ok: false,
                    message: 'Documento de destino no encontrado'
                });
            }

            // Obtener datos actuales de origen y destino
            const originData = originDoc.data();
            const destinationData = destinationDoc.data();

            // Validar que el origen tenga saldo suficiente
            const currentSaldoOrigin = parseFloat(originData.Saldo || 0);
            if (currentSaldoOrigin < parseFloat(amountOrigin)) {
                return res.status(400).json({
                    ok: false,
                    message: 'Saldo insuficiente en la cuenta de origen'
                });
            }

            // Usar transacción para garantizar consistencia
            const batch = db.batch();

            // Actualizar origen: agregar movimiento y actualizar saldo y total
            //newSaldoOrigin = currentSaldoOrigin - montoOrigin - fee (0.41);
            const newSaldoOrigin = currentSaldoOrigin - parseFloat(amountOrigin) - parseFloat(0.41);
            const currentTotalOrigin = parseFloat(originData.Total || 0);
            const newTotalOrigin = currentTotalOrigin - parseFloat(amountOrigin) - parseFloat(0.41);
            const originMovements = originData.Movimientos || [];
            originMovements.push(movementOrigin);
            
            batch.update(originDoc.ref, {
                Movimientos: originMovements,
                Saldo: newSaldoOrigin,
                Total: newTotalOrigin
            });

            // Actualizar destino: agregar movimiento y actualizar saldo y total
            const currentSaldoDestination = parseFloat(destinationData.Saldo || 0);
            const newSaldoDestination = currentSaldoDestination + parseFloat(amountOrigin);
            const currentTotalDestination = parseFloat(destinationData.Total || 0);
            const newTotalDestination = currentTotalDestination + parseFloat(amountOrigin);
            const destinationMovements = destinationData.Movimientos || [];
            destinationMovements.push(movementDestination);
            
            batch.update(destinationDoc.ref, {
                Movimientos: destinationMovements,
                Saldo: newSaldoDestination,
                Total: newTotalDestination
            });

            // Actualizar cuenta PAYSAT en la institución de destino
            const paysatAccounts = {
                'Cooperativa_JEP': '4606222',
                'Cooperativa_Mushuk_Runa': '4606222',
                'Cooperativa_Cacpeco': '1657222',
                'Cooperativa_Jardin_Azuayo': '4705222',
                'Banco_Austro': '7781222',
                'Banco_Pichincha': '7188222',
                'Banco_Guayaquil': '8403222',
                'Banco_Pacifico': '9001222'
            };

            const paysatAccountNumber = paysatAccounts[collectionNameDestination];
            
            if (paysatAccountNumber) {
                const paysatQuery = destinationCollection.where('NoCuenta', '==', paysatAccountNumber);
                const paysatSnapshot = await paysatQuery.limit(1).get();
                
                if (!paysatSnapshot.empty) {
                    const paysatDoc = paysatSnapshot.docs[0];
                    const paysatData = paysatDoc.data();
                    
                    const paysatMovement = {
                        type: 'deposit',
                        amount: 0.03,
                        reason: 'transfer',
                        originCollectionName: collectionNameOrigin,
                        originPhone: phoneOrigin || '',
                        originAccount: ctaOrigin || '',
                        originDni: dniOrigin || '',
                        destinationCollectionName: collectionNameDestination,
                        destinationPhone: phoneDestination || '',
                        destinationAccount: ctaDestination || '',
                        destinationDni: dniDestination || '',
                        Fecha: timestamp,
                        createdAt: timestamp,
                        movementId: movementId
                    };
                    
                    const currentPaysatSaldo = parseFloat(paysatData.Saldo || 0);
                    const currentPaysatTotal = parseFloat(paysatData.Total || 0);
                    const paysatMovimientos = paysatData.Movimientos || [];
                    paysatMovimientos.push(paysatMovement);
                    
                    batch.update(paysatDoc.ref, {
                        Movimientos: paysatMovimientos,
                        Saldo: currentPaysatSaldo + 0.03,
                        Total: currentPaysatTotal + 0.03
                    });
                }
            }

            // Actualizar registro en EcuaRed_Transfer_Movements
            const transferMovementRef = db.collection('EcuaRed_Transfer_Movements').doc('movements_registry');
            const transferMovementDoc = await transferMovementRef.get();
            
            const newMovement = {
                movementId: movementId,
                originDocId: originDoc.id,
                originCollectionName: collectionNameOrigin,
                originDni: dniOrigin || '',
                originName: nameOrigin || '',
                originAccount: ctaOrigin || '',
                originPhone: phoneOrigin || '',
                originAmount: parseFloat(amountOrigin),
                reason: reason || '',
                destinationCollectionName: collectionNameDestination,
                destinationAffiliateName: affiliateNameDestination || '',
                destinationDni: dniDestination || '',
                destinationName: nameDestination || '',
                destinationAccount: ctaDestination || '',
                destinationPhone: phoneDestination || '',
                destinationDocId: destinationDoc.id,
                createdAt: timestamp,
                status: 'completed',
                paysatFee: 0.03
            };

            if (transferMovementDoc.exists) {
                const currentData = transferMovementDoc.data();
                const currentSaldo = parseFloat(currentData.saldo || 0);
                const currentMovimientos = currentData.movimientos || [];
                
                batch.update(transferMovementRef, {
                    saldo: currentSaldo + 0.03,
                    movimientos: [...currentMovimientos, newMovement]
                });
            } else {
                batch.set(transferMovementRef, {
                    saldo: 0.03,
                    movimientos: [newMovement]
                });
            }

            // Guardar en PaySat_Users del usuario autenticado
            if (req.user && req.user.uid) {
                const paysatUsersCollection = db.collection('PaySat_Users');
                const userQuery = paysatUsersCollection.where('uid', '==', req.user.uid);
                const userSnapshot = await userQuery.limit(1).get();
                
                if (!userSnapshot.empty) {
                    const userDoc = userSnapshot.docs[0];
                    const userData = userDoc.data();
                    const userMovimientos = userData.Movimientos || [];
                    
                    // Crear copia de newMovement reemplazando paysatFee con fee
                    const { paysatFee, ...movementWithoutPaysatFee } = newMovement;
                    const movementWithFee = {...movementWithoutPaysatFee, fee: 0.41};
                    
                    userMovimientos.push(movementWithFee);
                    
                    batch.update(userDoc.ref, {
                        Movimientos: userMovimientos
                    });
                }
            }

            // Ejecutar la transacción
            await batch.commit();

            // Enviar notificaciones SMS
            let smsNotifications = [];
            try {
                smsNotifications = await sendTransferNotifications(
                    phoneOrigin,
                    phoneDestination,
                    parseFloat(amountOrigin),
                    affiliateNameDestination || collectionNameDestination
                );
            } catch (smsError) {
                console.error('Error al enviar notificaciones SMS:', smsError);
                // No fallar la transferencia si falla el SMS
            }

            // Enviar notificaciones por correo electrónico
            let emailNotifications = [];
            try {
                const emailService = new EmailService();
                
                // Obtener logos de afiliados
                const { originLogoUrl, destinationLogoUrl } = await emailService.getAffiliateLogos(
                    collectionNameOrigin,
                    collectionNameDestination
                );

                // Obtener email del usuario autenticado (remitente)
                let originEmail = '';
                if (req.user && req.user.uid) {
                    const paysatUsersCollection = db.collection('PaySat_Users');
                    const userQuery = paysatUsersCollection.where('uid', '==', req.user.uid);
                    const userSnapshot = await userQuery.limit(1).get();
                    
                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        originEmail = userData.correo || req.user.email || '';
                    }
                }

                // Obtener email del destinatario desde PaySat_Users
                let destinationEmail = '';
                const paysatUsersCollection = db.collection('PaySat_Users');
                const destinationQueries = [];
                
                if (dniDestination) destinationQueries.push(paysatUsersCollection.where('dniPersonalNumber', '==', dniDestination));
                if (phoneDestination) destinationQueries.push(paysatUsersCollection.where('telefono', '==', phoneDestination));
                
                for (const query of destinationQueries) {
                    const snapshot = await query.limit(1).get();
                    if (!snapshot.empty) {
                        const destinationUserData = snapshot.docs[0].data();
                        destinationEmail = destinationUserData.correo || '';
                        break;
                    }
                }

                console.log('Emails encontrados - Origen:', originEmail, 'Destino:', destinationEmail);

                // Enviar correo al remitente
                if (originEmail) {
                    const resultOrigin = await emailService.sendTransferSentEmail({
                        email: originEmail,
                        recipientName: nameDestination || '',
                        amount: parseFloat(amountOrigin),
                        movementId: movementId,
                        originLogoUrl: originLogoUrl,
                        destinationLogoUrl: destinationLogoUrl,
                        destinationAffiliate: affiliateNameDestination || collectionNameDestination
                    });
                    emailNotifications.push({ type: 'origin', email: originEmail, ...resultOrigin });
                    console.log('Resultado envío correo origen:', resultOrigin);
                }

                // Enviar correo al destinatario
                if (destinationEmail) {
                    const resultDestination = await emailService.sendTransferReceivedEmail({
                        email: destinationEmail,
                        senderName: nameOrigin || '',
                        amount: parseFloat(amountOrigin),
                        movementId: movementId,
                        originLogoUrl: originLogoUrl,
                        destinationLogoUrl: destinationLogoUrl,
                        destinationAffiliate: affiliateNameDestination || collectionNameDestination
                    });
                    emailNotifications.push({ type: 'destination', email: destinationEmail, ...resultDestination });
                    console.log('Resultado envío correo destino:', resultDestination);
                }
                
            } catch (emailError) {
                console.error('Error al enviar notificaciones por correo:', emailError);
                // No fallar la transferencia si falla el correo
            }

            return res.status(200).json({
                ok: true,
                message: 'Transferencia realizada exitosamente',
                data: {
                    movementId: movementId,
                    amountTransferred: parseFloat(amountOrigin),
                    newSaldoOrigin: newSaldoOrigin,
                    newTotalOrigin: newTotalOrigin,
                    newSaldoDestination: newSaldoDestination,
                    newTotalDestination: newTotalDestination,
                    timestamp: timestamp.toDate(),
                    smsNotifications: smsNotifications,
                    emailNotifications: emailNotifications
                }
            });

        } catch (error) {
            console.error('Error en transferencia:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al procesar la transferencia',
                error: error.message
            });
        }
    }

    async listLastThree(req, res) {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Buscar el usuario en PaySat_Users
            const paysatUsersCollection = db.collection('PaySat_Users');
            const userQuery = paysatUsersCollection.where('uid', '==', req.user.uid);
            const userSnapshot = await userQuery.limit(1).get();
            
            if (userSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'Usuario no encontrado'
                });
            }

            const userData = userSnapshot.docs[0].data();
            const movimientos = userData.Movimientos || [];

            // Ordenar por fecha de creación descendente y tomar los últimos 3
            const lastThreeMovements = movimientos
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateB - dateA;
                })
                .slice(0, 3);

            return res.status(200).json({
                ok: true,
                message: 'Últimos movimientos obtenidos exitosamente',
                data: lastThreeMovements
            });

        } catch (error) {
            console.error('Error al obtener últimos movimientos:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los movimientos',
                error: error.message
            });
        }
    }
}

export default AppTransfersController;