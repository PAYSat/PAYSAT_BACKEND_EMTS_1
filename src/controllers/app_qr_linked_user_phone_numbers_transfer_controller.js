import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { recordLedgerEntry, recordFeeEntry } from '../services/ledger_service.js';
import { sendMobileTransferNotifications } from '../services/mobile_transfer_notify_service.js';

class QRLinkedUserPhoneNumbersTransferController {
    generateStaticQR = async (req, res) => {
        console.log('📱 generateStaticQR llamada - Path:', req.path, 'Method:', req.method);
        console.log('📱 User:', req.user?.uid);
        console.log('📱 Body keys:', Object.keys(req.body));
        
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                console.log('❌ Usuario no autenticado');
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Extraer datos del body
            const {
                originUID,
                originAffiliateUID,
                originAffiliateName,
                originAffiliateLogo,
                originTypeAccountUID,
                originTypeOfAccountName,
                originTypeIdUID,
                originTypeIdName,
                originIdNumber,
                originAccountNumber,
                originPhoneNumber,
                originEmail,
                originCustomerName,
                originBeneficiaryName,
                originCountryId,
                originCountryName,
                originActive,
                paysatUID
            } = req.body;

            // Validar campos requeridos
            if (!originUID || !originAffiliateUID || !originIdNumber || !originAccountNumber || !paysatUID) {
                console.log('❌ Faltan campos requeridos:', {
                    originUID: !!originUID,
                    originAffiliateUID: !!originAffiliateUID,
                    originIdNumber: !!originIdNumber,
                    originAccountNumber: !!originAccountNumber,
                    paysatUID: !!paysatUID
                });
                return res.status(400).json({
                    ok: false,
                    message: 'Faltan campos requeridos para generar el QR'
                });
            }

            console.log('✅ Campos validados, continuando...');

            // Validar que el paysatUID coincida con el usuario autenticado
            if (paysatUID !== req.user.uid) {
                console.log('❌ paysatUID no coincide:', paysatUID, 'vs', req.user.uid);
                return res.status(403).json({
                    ok: false,
                    message: 'No tienes permiso para crear un QR para este usuario'
                });
            }

            console.log('✅ Usuario validado, buscando en PaySat_Users...');

            // Verificar que el usuario existe en PaySat_Users
            const userRef = db.collection('PaySat_Users').doc(paysatUID);
            const userDoc = await userRef.get();

            console.log('✅ Búsqueda en PaySat_Users completada, existe:', userDoc.exists);

            if (!userDoc.exists) {
                console.log('❌ Usuario no encontrado en PAYSAT');
                return res.status(404).json({
                    ok: false,
                    message: 'Usuario no encontrado en PAYSAT'
                });
            }

            const userData = userDoc.data();
            console.log('✅ Datos de usuario obtenidos, userEscrow:', userData.userEscrow);

            // Validar que el usuario esté activo
            if (userData.userEscrow === 0 || userData.userEscrow === '0') {
                console.log('❌ Usuario no está activo');
                return res.status(400).json({
                    ok: false,
                    message: 'Tu usuario no está activo en PAYSAT'
                });
            }

            console.log('✅ Usuario activo, buscando afiliado...', originAffiliateUID);

            // Verificar que la cuenta existe en la colección del banco/cooperativa
            const affiliatesRef = db.collection('PaySat_Transfer_Affiliates');
            const affiliatesSnapshot = await affiliatesRef
                .where('uid', '==', String(originAffiliateUID))
                .get();

            console.log('✅ Búsqueda de afiliado completada, encontrado:', !affiliatesSnapshot.empty);

            if (affiliatesSnapshot.empty) {
                console.log('❌ Institución financiera no encontrada');
                return res.status(404).json({
                    ok: false,
                    message: 'Institución financiera no encontrada'
                });
            }

            const affiliateDoc = affiliatesSnapshot.docs[0];
            const collectionName = affiliateDoc.id;
            
            console.log('✅ Colección del banco:', collectionName);
            console.log('✅ Buscando cuenta con AccountNumber:', originAccountNumber, 'y DNI:', originIdNumber);

            // Buscar la cuenta específica por número de cuenta y cédula
            const accountsRef = db.collection(collectionName);
            const accountsSnapshot = await accountsRef
                .where('customerAccountNumber', '==', String(originAccountNumber))
                .where('customerID', '==', String(originIdNumber))
                .get();

            console.log('✅ Búsqueda de cuenta completada, encontrada:', !accountsSnapshot.empty);

            if (accountsSnapshot.empty) {
                console.log('❌ Cuenta no encontrada en colección', collectionName);
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta no encontrada'
                });
            }

            const accountDoc = accountsSnapshot.docs[0];
            const accountId = accountDoc.id; // Este es el UID real del documento
            const accountData = accountDoc.data();
            
            console.log('✅ Cuenta encontrada con ID:', accountId);
            console.log('✅ Datos de cuenta obtenidos, customerActiveAccount:', accountData.customerActiveAccount);

            // Validar que la cuenta esté activa
            if (!accountData.customerActiveAccount) {
                console.log('❌ Cuenta no activa');
                return res.status(400).json({
                    ok: false,
                    message: 'La cuenta no está activa'
                });
            }

            console.log('✅ Validando pertenencia de cuenta...');
            console.log('  - Cuenta ya validada por búsqueda con customerDniNumber y customerAccountNumber');

            console.log('✅ Cuenta validada, verificando QR existente...');

            // Verificar si ya existe un QR activo para esta cuenta
            const existingQRsSnapshot = await db.collection('PaySat_QRs')
                .where('ownerUid', '==', paysatUID)
                .where('accountUid', '==', accountId) // Usar el accountId obtenido de la búsqueda
                .where('institutionUid', '==', originAffiliateUID)
                .where('qrType', '==', 'static_account')
                .where('status', '==', 'active')
                .limit(1)
                .get();

            console.log('✅ Búsqueda de QR existente completada, encontrado:', !existingQRsSnapshot.empty);

            // Si ya existe un QR activo, retornarlo en lugar de crear uno nuevo
            if (!existingQRsSnapshot.empty) {
                console.log('✅ Retornando QR existente...');
                const existingQRDoc = existingQRsSnapshot.docs[0];
                const existingQRData = existingQRDoc.data();

                // Reconstruir el payload
                const existingPayloadWithoutSignature = {
                    app: 'PAYSAT',
                    version: '1',
                    type: 'static_account',
                    qrRef: existingQRDoc.id,
                    issuedAt: existingQRData.issuedAt.toDate().toISOString(),
                    nonce: existingQRData.nonce || uuidv4()
                };

                const existingSignature = this.generateQRSignature(existingPayloadWithoutSignature);

                console.log('✅ Enviando respuesta 200 con QR existente...');
                return res.status(200).json({
                    ok: true,
                    message: 'Ya tienes un QR activo para esta cuenta',
                    qrPayload: {
                        ...existingPayloadWithoutSignature,
                        signature: existingSignature
                    },
                    qrRef: existingQRDoc.id
                });
            }

            console.log('✅ No hay QR existente, generando nuevo...');

            // Generar nuevo QR
            const qrRef = `qr_${uuidv4()}`;
            const nonce = uuidv4();
            const issuedAt = admin.firestore.Timestamp.now();

            console.log('✅ QR creado con ref:', qrRef);
            console.log('✅ Creando payload sin firma...');

            // Crear el payload sin firma
            const payloadWithoutSignature = {
                app: 'PAYSAT',
                version: '1',
                type: 'static_account',
                qrRef: qrRef,
                issuedAt: issuedAt.toDate().toISOString(),
                nonce: nonce
            };

            console.log('✅ Payload creado, generando firma HMAC...');

            // Generar la firma HMAC
            const signature = this.generateQRSignature(payloadWithoutSignature);
            
            console.log('✅ Firma generada:', signature.substring(0, 20) + '...');
            console.log('✅ Preparando registro para Firestore...');

            // Crear el registro en PaySat_QRs
            const qrRecord = {
                qrRef: qrRef,
                ownerUid: paysatUID,
                accountUid: accountId, // ID del documento de la cuenta en la colección del banco (obtenido de la query)
                institutionUid: originAffiliateUID, // affiliateUID para buscar en PaySat_Affiliates
                accountTypeUid: originTypeAccountUID || '',
                qrType: 'static_account',
                status: 'active',
                isSingleUse: false,
                issuedAt: issuedAt,
                expiresAt: null, // QR estático sin expiración
                amount: null,
                currency: 'USD',
                concept: '',
                nonce: nonce,
                createdFromDevice: req.headers['user-agent'] || 'unknown',
                createdAt: issuedAt,
                lastScannedAt: null,
                lastScannedBy: null,
                usedAt: null,
                usedBy: null,
                transactionToken: null,
                revokedAt: null,
                revokedBy: null,
                // Datos adicionales para referencia (no se envían en el QR)
                accountDetails: {
                    affiliateName: originAffiliateName || '',
                    affiliateLogo: originAffiliateLogo || '',
                    typeOfAccountName: originTypeOfAccountName || '',
                    typeIdUID: originTypeIdUID || '',
                    typeIdName: originTypeIdName || '',
                    idNumber: originIdNumber,
                    accountNumber: originAccountNumber,
                    phoneNumber: originPhoneNumber || '',
                    email: originEmail || '',
                    customerName: originCustomerName || '',
                    beneficiaryName: originBeneficiaryName || '',
                    countryId: originCountryId || '',
                    countryName: originCountryName || '',
                    active: originActive !== undefined ? originActive : true
                }
            };

            console.log('✅ Registro QR preparado, guardando en Firebase...');
            
            // Guardar en Firebase usando el qrRef como ID del documento
            await db.collection('PaySat_QRs').doc(qrRef).set(qrRecord);

            console.log(`✅ QR estático guardado en Firebase: ${qrRef}`);
            console.log(`✅ Preparando respuesta para usuario ${paysatUID}`);

            // Retornar el payload completo con firma para que el frontend genere la imagen QR
            const responseData = {
                ok: true,
                message: 'QR estático generado exitosamente',
                qrPayload: {
                    ...payloadWithoutSignature,
                    signature: signature
                },
                qrRef: qrRef
            };
            
            console.log('✅ Enviando respuesta 201...');
            return res.status(201).json(responseData);

        } catch (error) {
            console.error('❌ Error al generar QR estático:', error);
            console.error('❌ Stack trace:', error.stack);
            return res.status(500).json({
                ok: false,
                message: 'Error al generar el QR estático',
                error: error.message
            });
        }
    }

    generateDynamicQR = async (req, res) => {
        console.log('📱 generateDynamicQR llamada - Path:', req.path, 'Method:', req.method);
        console.log('📱 User:', req.user?.uid);
        console.log('📱 Body keys:', Object.keys(req.body));
        
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                console.log('❌ Usuario no autenticado');
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Extraer datos del body
            const {
                originUID,
                originAffiliateUID,
                originAffiliateName,
                originAffiliateLogo,
                originTypeAccountUID,
                originTypeOfAccountName,
                originTypeIdUID,
                originTypeIdName,
                originIdNumber,
                originAccountNumber,
                originPhoneNumber,
                originEmail,
                originCustomerName,
                paysatUID,
                amount,
                concept,
                expirationMinutes
            } = req.body;

            // Validar campos requeridos
            if (!originUID || !originAffiliateUID || !originIdNumber || !originAccountNumber || !paysatUID || !amount) {
                return res.status(400).json({
                    ok: false,
                    message: 'Faltan campos requeridos para generar el QR dinámico'
                });
            }

            // console.log("1");

            // Validar que el paysatUID coincida con el usuario autenticado
            if (paysatUID !== req.user.uid) {
                return res.status(403).json({
                    ok: false,
                    message: 'No tienes permiso para crear un QR para este usuario'
                });
            }

            // console.log("2");

            // Validar que el monto sea válido
            const paymentAmount = parseFloat(amount);
            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto debe ser mayor a 0'
                });
            }

            // console.log("3");

            // Verificar que el usuario existe en PaySat_Users
            const userRef = db.collection('PaySat_Users').doc(paysatUID);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'Usuario no encontrado en PAYSAT'
                });
            }

            // console.log("4");

            const userData = userDoc.data();

            // Validar que el usuario esté activo
            if (userData.userEscrow === 0 || userData.userEscrow === '0') {
                return res.status(400).json({
                    ok: false,
                    message: 'Tu usuario no está activo en PAYSAT'
                });
            }

            // Verificar que la cuenta existe
            const affiliatesRef = db.collection('PaySat_Transfer_Affiliates');
            const affiliatesSnapshot = await affiliatesRef
                .where('uid', '==', String(originAffiliateUID))
                .get();

            if (affiliatesSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'Institución financiera no encontrada'
                });
            }

            const affiliateDoc = affiliatesSnapshot.docs[0];
            const collectionName = affiliateDoc.id;

            // Buscar la cuenta por número de cuenta y DNI (no por originUID que es metadata)
            const accountsRef = db.collection(collectionName);
            const accountsSnapshot = await accountsRef
                .where('customerAccountNumber', '==', String(originAccountNumber))
                .where('customerID', '==', String(originIdNumber))
                .get();

            if (accountsSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: `Cuenta no encontrada en colección ${collectionName}`
                });
            }

            const accountDoc = accountsSnapshot.docs[0];
            const accountId = accountDoc.id; // ID real del documento en Firestore
            const accountData = accountDoc.data();

            // Validar que la cuenta esté activa
            if (!accountData.customerActiveAccount) {
                return res.status(400).json({
                    ok: false,
                    message: 'La cuenta no está activa'
                });
            }

            // Generar nuevo QR dinámico
            const qrRef = `qr_dyn_${uuidv4()}`;
            const nonce = uuidv4();
            const issuedAt = admin.firestore.Timestamp.now();
            
            // Calcular expiración (por defecto 10 minutos)
            const minutes = expirationMinutes && expirationMinutes > 0 ? parseInt(expirationMinutes) : 10;
            const expiresAt = admin.firestore.Timestamp.fromMillis(
                issuedAt.toMillis() + (minutes * 60 * 1000)
            );

            // Crear el payload sin firma
            const payloadWithoutSignature = {
                app: 'PAYSAT',
                version: '1',
                type: 'dynamic_payment',
                qrRef: qrRef,
                issuedAt: issuedAt.toDate().toISOString(),
                expiresAt: expiresAt.toDate().toISOString(),
                nonce: nonce
            };

            // Generar la firma HMAC
            const signature = this.generateQRSignature(payloadWithoutSignature);

            // Crear el registro en PaySat_QRs
            const qrRecord = {
                qrRef: qrRef,
                ownerUid: paysatUID,
                accountUid: accountId, // ID del documento de la cuenta en la colección del banco (obtenido de la query)
                institutionUid: originAffiliateUID,
                accountTypeUid: originTypeAccountUID || '',
                qrType: 'dynamic_payment',
                status: 'active',
                isSingleUse: true, // QR dinámico de un solo uso
                issuedAt: issuedAt,
                expiresAt: expiresAt,
                amount: paymentAmount,
                currency: 'USD',
                concept: concept || 'Pago con QR PAGOCEL',
                nonce: nonce,
                createdFromDevice: req.headers['user-agent'] || 'unknown',
                createdAt: issuedAt,
                lastScannedAt: null,
                lastScannedBy: null,
                usedAt: null,
                usedBy: null,
                transactionToken: null,
                revokedAt: null,
                revokedBy: null,
                accountDetails: {
                    affiliateName: originAffiliateName || '',
                    affiliateLogo: originAffiliateLogo || '',
                    typeOfAccountName: originTypeOfAccountName || '',
                    typeIdUID: originTypeIdUID || '',
                    typeIdName: originTypeIdName || '',
                    idNumber: originIdNumber,
                    accountNumber: originAccountNumber,
                    phoneNumber: originPhoneNumber || '',
                    email: originEmail || '',
                    customerName: originCustomerName || ''
                }
            };

            // Guardar en FirebaseaccountDetails
            await db.collection('PaySat_QRs').doc(qrRef).set(qrRecord);

            // console.log(`✅ QR dinámico generado: ${qrRef} para usuario ${paysatUID} - Monto: $${paymentAmount}`);

            // Retornar el payload completo
            return res.status(201).json({
                ok: true,
                message: 'QR dinámico generado exitosamente',
                qrPayload: {
                    ...payloadWithoutSignature,
                    signature: signature
                },
                qrRef: qrRef,
                amount: paymentAmount,
                expiresAt: expiresAt.toDate().toISOString(),
                expiresInMinutes: minutes
            });

        } catch (error) {
            console.error('Error al generar QR dinámico:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al generar el QR dinámico',
                error: error.message
            });
        }
    }

    revokeQR = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const { qrRef } = req.body;

            if (!qrRef) {
                return res.status(400).json({
                    ok: false,
                    message: 'Falta el qrRef del QR a revocar'
                });
            }

            // Buscar el QR
            const qrDocRef = db.collection('PaySat_QRs').doc(qrRef);
            const qrDoc = await qrDocRef.get();

            if (!qrDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'QR no encontrado'
                });
            }

            const qrData = qrDoc.data();

            // Validar que el QR pertenezca al usuario autenticado
            if (qrData.ownerUid !== req.user.uid) {
                return res.status(403).json({
                    ok: false,
                    message: 'No tienes permiso para revocar este QR'
                });
            }

            // Validar que el QR esté activo
            if (qrData.status !== 'active') {
                return res.status(400).json({
                    ok: false,
                    message: `El QR ya está en estado: ${qrData.status}`
                });
            }

            // Revocar el QR
            await qrDocRef.update({
                status: 'revoked',
                revokedAt: admin.firestore.Timestamp.now(),
                revokedBy: req.user.uid
            });

            console.log(`✅ QR revocado: ${qrRef} por usuario ${req.user.uid}`);

            return res.status(200).json({
                ok: true,
                message: 'QR revocado exitosamente'
            });

        } catch (error) {
            console.error('Error al revocar QR:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al revocar el QR',
                error: error.message
            });
        }
    }

    listMyQRs = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener parámetros opcionales de filtro
            const { qrType, status } = req.query;

            // Construir la consulta
            let query = db.collection('PaySat_QRs')
                .where('ownerUid', '==', req.user.uid);

            // Filtrar por tipo si se especifica
            if (qrType && ['static_account', 'dynamic_payment'].includes(qrType)) {
                query = query.where('qrType', '==', qrType);
            }

            // Filtrar por estado si se especifica
            if (status && ['active', 'used', 'expired', 'revoked', 'disabled'].includes(status)) {
                query = query.where('status', '==', status);
            }

            // Ordenar por fecha de creación descendente
            query = query.orderBy('createdAt', 'desc');

            const snapshot = await query.get();

            if (snapshot.empty) {
                return res.status(200).json({
                    ok: true,
                    message: 'No tienes QRs registrados',
                    data: []
                });
            }

            // Actualizar QRs dinámicos expirados
            const now = admin.firestore.Timestamp.now();
            const batch = db.batch();
            let expiredCount = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                
                // Solo verificar QRs dinámicos activos con fecha de expiración
                if (data.status === 'active' && 
                    data.qrType === 'dynamic_payment' && 
                    data.expiresAt) {
                    
                    // Verificar si ya expiró
                    if (data.expiresAt.toMillis() <= now.toMillis()) {
                        batch.update(doc.ref, {
                            status: 'expired',
                            expiredAt: now
                        });
                        expiredCount++;
                    }
                }
            });

            // Ejecutar las actualizaciones en batch si hay QRs expirados
            if (expiredCount > 0) {
                await batch.commit();
                console.log(`✅ ${expiredCount} QR(s) dinámico(s) marcado(s) como expirados`);
            }

            // Mapear los QRs (solo los activos después de actualizar expirados)
            const qrs = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    // Filtrar los que acabamos de marcar como expirados
                    if (data.status === 'active' && 
                        data.qrType === 'dynamic_payment' && 
                        data.expiresAt) {
                        return data.expiresAt.toMillis() > now.toMillis();
                    }
                    // Mantener todos los demás según su estado original
                    return data.status === 'active';
                })
                .map(doc => {
                const data = doc.data();
                
                // Construir payload solo para QRs activos
                let qrPayload = null;
                if (data.status === 'active') {
                    const payloadWithoutSignature = {
                        app: 'PAYSAT',
                        version: '1',
                        type: data.qrType,
                        qrRef: doc.id,
                        issuedAt: data.issuedAt.toDate().toISOString(),
                        nonce: data.nonce || uuidv4()
                    };

                    if (data.expiresAt) {
                        payloadWithoutSignature.expiresAt = data.expiresAt.toDate().toISOString();
                    }

                    const signature = this.generateQRSignature(payloadWithoutSignature);
                    
                    qrPayload = {
                        ...payloadWithoutSignature,
                        signature: signature
                    };
                }

                return {
                    qrRef: doc.id,
                    qrType: data.qrType,
                    status: data.status,
                    amount: data.amount,
                    concept: data.concept,
                    issuedAt: data.issuedAt,
                    expiresAt: data.expiresAt,
                    createdAt: data.createdAt,
                    lastScannedAt: data.lastScannedAt,
                    usedAt: data.usedAt,
                    accountDetails: data.accountDetails,
                    qrPayload: qrPayload // Solo si está activo
                };
            });

            return res.status(200).json({
                ok: true,
                message: 'QRs obtenidos exitosamente',
                data: qrs,
                total: qrs.length
            });

        } catch (error) {
            console.error('Error al listar QRs:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los QRs',
                error: error.message
            });
        }
    }

    validateQR = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Extraer el payload del QR del body
            const { qrPayload } = req.body;

            if (!qrPayload) {
                return res.status(400).json({
                    ok: false,
                    message: 'Falta el payload del QR'
                });
            }

            // Parsear el payload del QR
            let qrData;
            try {
                qrData = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
            } catch (error) {
                return res.status(400).json({
                    ok: false,
                    message: 'Formato de QR inválido'
                });
            }

            // 1. Validar formato PAYSAT
            if (qrData.app !== 'PAYSAT') {
                return res.status(400).json({
                    ok: false,
                    message: 'Este QR no pertenece a PAYSAT'
                });
            }

            // 2. Validar versión
            if (qrData.version !== '1') {
                return res.status(400).json({
                    ok: false,
                    message: 'Versión de QR no soportada'
                });
            }

            // 3. Validar tipo
            if (!['static_account', 'dynamic_payment'].includes(qrData.type)) {
                return res.status(400).json({
                    ok: false,
                    message: 'Tipo de QR no válido'
                });
            }

            // 4. Validar campos requeridos
            if (!qrData.qrRef || !qrData.issuedAt || !qrData.nonce || !qrData.signature) {
                return res.status(400).json({
                    ok: false,
                    message: 'QR incompleto o corrupto'
                });
            }

            // 5. Validar firma criptográfica
            const { signature, ...payloadWithoutSignature } = qrData;
            let isValidSignature = false;
            
            try {
                isValidSignature = this.validateQRSignature(payloadWithoutSignature, signature);
            } catch (error) {
                console.error('Error al validar firma:', error);
                return res.status(400).json({
                    ok: false,
                    message: 'Firma del QR inválida'
                });
            }

            if (!isValidSignature) {
                return res.status(400).json({
                    ok: false,
                    message: 'QR falsificado o modificado'
                });
            }

            // 6. Buscar el QR en la colección PaySat_QRs
            const qrDocRef = db.collection('PaySat_QRs').doc(qrData.qrRef);
            const qrDoc = await qrDocRef.get();

            if (!qrDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'QR no encontrado o inválido'
                });
            }

            const qrRecord = qrDoc.data();

            // 7. Validar estado del QR
            if (qrRecord.status !== 'active') {
                let message = 'QR no disponible';
                if (qrRecord.status === 'used') message = 'Este QR ya fue utilizado';
                if (qrRecord.status === 'expired') message = 'Este QR ha expirado';
                if (qrRecord.status === 'revoked') message = 'Este QR ha sido revocado';
                if (qrRecord.status === 'disabled') message = 'Este QR está deshabilitado';
                
                return res.status(400).json({
                    ok: false,
                    message
                });
            }

            // 8. Validar expiración si aplica
            if (qrData.expiresAt) {
                const expirationDate = new Date(qrData.expiresAt);
                const now = new Date();
                
                if (now > expirationDate) {
                    // Marcar como expirado en la base de datos
                    await qrDocRef.update({
                        status: 'expired'
                    });
                    
                    return res.status(400).json({
                        ok: false,
                        message: 'Este QR ha expirado'
                    });
                }
            }

            // 9. Validar que el usuario no se esté pagando a sí mismo
            if (qrRecord.ownerUid === req.user.uid) {
                return res.status(400).json({
                    ok: false,
                    message: 'No puedes realizar una transferencia a tu propia cuenta'
                });
            }

            // 10. Obtener información de la cuenta destino
            // Buscar el afiliado en PaySat_Affiliates usando el affiliateUID
            const affiliatesRef = db.collection('PaySat_Affiliates');
            const affiliatesSnapshot = await affiliatesRef
                .where('affiliateUID', '==', String(qrRecord.institutionUid))
                .get();

            if (affiliatesSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'Institución financiera destino no encontrada'
                });
            }

            const affiliateDoc = affiliatesSnapshot.docs[0];
            const collectionName = affiliateDoc.id; // Nombre de la colección (ej: Cooperativa_JEP)
            const affiliateData = affiliateDoc.data();

            // 11. Buscar la cuenta específica en la colección del banco/cooperativa
            const accountRef = db.collection(collectionName).doc(qrRecord.accountUid);
            const accountDoc = await accountRef.get();

            if (!accountDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta destino no encontrada'
                });
            }

            const accountData = accountDoc.data();

            // 12. Validar que la cuenta destino esté activa
            if (accountData.customerActiveAccount !== true && accountData.customerActiveAccount !== '1') {
                return res.status(400).json({
                    ok: false,
                    message: 'La cuenta destino no está activa'
                });
            }

            // 13. Validar que el usuario destino esté activo en PaySat_Users
            // console.log("DESTINATION USER UID:", qrRecord.ownerUid);
            const destinationUserRef = db.collection('PaySat_Users').doc(qrRecord.ownerUid);
            const destinationUserDoc = await destinationUserRef.get();

            if (!destinationUserDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'Usuario destino no encontrado'
                });
            }

            const destinationUser = destinationUserDoc.data();
            // console.log("DESTINATION USER DATA:", destinationUser);

            if (destinationUser.activo !== true && destinationUser.activo !== '1') {
                return res.status(400).json({
                    ok: false,
                    message: 'Usuario destino no está activo'
                });
            }

            // 14. Actualizar última vez escaneado
            await qrDocRef.update({
                lastScannedAt: admin.firestore.Timestamp.now(),
                lastScannedBy: req.user.uid
            });

            // 15. Preparar respuesta con datos mínimos para mostrar
            const accountNumberStr = String(accountData.customerAccountNumber || '');
            const maskedAccountNumber = accountNumberStr.length > 4 
                ? '***' + accountNumberStr.slice(-4) 
                : accountNumberStr;

            const responseData = {
                qrRef: qrData.qrRef,
                qrType: qrData.type,
                destination: {
                    recipientName: accountData.customerNames || 'Usuario PAGOCEL',
                    institutionName: affiliateData.affiliateName || 'Institución',
                    institutionLogo: affiliateData.affiliateLogo || '',
                    accountType: accountData.customerTypeOfAccountName || 'Cuenta',
                    maskedAccountNumber: maskedAccountNumber,
                    affiliateUID: affiliateData.affiliateUID,
                    affiliateName: affiliateData.affiliateName,
                    affiliateLogo: affiliateData.affiliateLogo,
                    dniNumber: accountData.customerDniNumber,
                    phoneNumber: accountData.customerPhoneNumber || '',
                    email: accountData.customerEmail || '',
                }
            };

            // console.log(responseData);

            // 16. Si es QR dinámico, incluir el monto
            if (qrData.type === 'dynamic_payment' && qrRecord.amount) {
                responseData.amount = parseFloat(qrRecord.amount);
                responseData.currency = qrRecord.currency || 'USD';
                responseData.concept = qrRecord.concept || '';
            }

            return res.status(200).json({
                ok: true,
                message: 'QR validado exitosamente',
                data: responseData
            });

        } catch (error) {
            console.error('Error al validar QR:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al validar el QR',
                error: error.message
            });
        }
    }

    // Método auxiliar para generar firma HMAC del QR
    generateQRSignature(payload) {
        const SECRET_KEY = process.env.QR_SIGNATURE_SECRET || 'PAYSAT_QR_SECRET_2026';
        const payloadString = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', SECRET_KEY);
        hmac.update(payloadString);
        return hmac.digest('hex');
    }

    // Método auxiliar para validar firma HMAC del QR
    validateQRSignature(payload, signature) {
        const expectedSignature = this.generateQRSignature(payload);
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }
    
}

export default QRLinkedUserPhoneNumbersTransferController;