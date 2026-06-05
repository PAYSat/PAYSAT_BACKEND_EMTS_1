import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import { recordLedgerEntry, recordFeeEntry } from '../services/ledger_service.js';
import { sendMobileTransferNotifications } from '../services/mobile_transfer_notify_service.js';

class LinkedUserPhoneNumbersTransferController {

    listDestinationTransfersPhoneNumbers = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;

            // Buscar el documento del usuario en PaySat_User_Registered_PhoneNumbers_Mobile
            const registeredPhoneNumbersRef = db.collection('PaySat_User_Registered_PhoneNumbers_Mobile').doc(uid);
            const registeredPhoneNumbersDoc = await registeredPhoneNumbersRef.get();

            // Si no existe el documento, retornar array vacío
            if (!registeredPhoneNumbersDoc.exists) {
                return res.status(200).json({
                    ok: true,
                    data: {
                        paysatUID: uid,
                        destinationPhoneNumbers: []
                    },
                    message: 'No hay números telefónicos registrados'
                });
            }

            const registeredPhoneNumbersData = registeredPhoneNumbersDoc.data();
            
            // Estructura de respuesta con los datos del documento
            const responseData = {
                paysatUID: registeredPhoneNumbersData.paysatUID || uid,
                createdAt: registeredPhoneNumbersData.createdAt,
                updatedAt: registeredPhoneNumbersData.updatedAt,
                destinationPhoneNumbers: registeredPhoneNumbersData.destinationPhoneNumbers || []
            };

            return res.status(200).json({
                ok: true,
                data: responseData,
                message: 'Números telefónicos obtenidos exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener números telefónicos de destino:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los números telefónicos',
                error: error.message
            });
        }
    }

    saveDestinationPhoneNumbers = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const {
                destinationUserName,
                destinationFullPhoneNumber,
                destinationShortPhoneNumber,
                phoneCountryCode,
                phoneCountryISO2,
                destinationEmail
            } = req.body;

            console.log('[saveDestinationPhoneNumbers] Datos recibidos:', {
                uid,
                destinationUserName,
                destinationFullPhoneNumber,
                destinationShortPhoneNumber,
                phoneCountryCode,
                phoneCountryISO2,
                destinationEmail
            });

            // Validar campos requeridos (destinationEmail es opcional)
            if (!destinationUserName || !destinationFullPhoneNumber || !destinationShortPhoneNumber || 
                !phoneCountryCode || !phoneCountryISO2) {
                return res.status(400).json({
                    ok: false,
                    message: 'Campos requeridos: destinationUserName, destinationFullPhoneNumber, destinationShortPhoneNumber, phoneCountryCode, phoneCountryISO2'
                });
            }

            // Referencia al documento del usuario
            const registeredPhoneNumbersRef = db.collection('PaySat_User_Registered_PhoneNumbers_Mobile').doc(uid);
            const registeredPhoneNumbersDoc = await registeredPhoneNumbersRef.get();

            // Normalizar el número telefónico para comparaciones
            const normalizedPhoneNumber = destinationFullPhoneNumber.trim();

            // Preparar el objeto del número telefónico a guardar
            const newPhoneNumber = {
                destinationUserName: destinationUserName.trim(),
                destinationFullPhoneNumber: normalizedPhoneNumber,
                destinationShortPhoneNumber: destinationShortPhoneNumber.trim(),
                phoneCountryCode: phoneCountryCode.trim(),
                phoneCountryISO2: phoneCountryISO2.trim(),
                registeredAt: new Date().toISOString()
            };

            // Solo agregar destinationEmail si se proporciona y no es null/undefined
            if (destinationEmail && destinationEmail.trim()) {
                newPhoneNumber.destinationEmail = destinationEmail.trim();
            }

            const timestamp = admin.firestore.Timestamp.now();

            // Si el documento no existe, crearlo con estructura completa
            if (!registeredPhoneNumbersDoc.exists) {
                console.log('[saveDestinationPhoneNumbers] Creando nuevo documento');
                await registeredPhoneNumbersRef.set({
                    paysatUID: uid,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    destinationPhoneNumbers: [newPhoneNumber]
                });
                
                console.log('[saveDestinationPhoneNumbers] Documento creado exitosamente');
            } else {
                // Si existe, obtener el array actual y validar duplicados
                console.log('[saveDestinationPhoneNumbers] Actualizando documento existente');
                
                const userData = registeredPhoneNumbersDoc.data();
                const destinationPhoneNumbers = userData.destinationPhoneNumbers || [];

                console.log('[saveDestinationPhoneNumbers] Números existentes:', destinationPhoneNumbers.map(p => p.destinationFullPhoneNumber));
                console.log('[saveDestinationPhoneNumbers] Número a guardar (normalizado):', normalizedPhoneNumber);

                // Normalizar el email para comparaciones (puede ser null)
                const normalizedEmail = newPhoneNumber.destinationEmail 
                    ? newPhoneNumber.destinationEmail.toLowerCase().trim() 
                    : null;

                // VALIDACIÓN 1: Verificar si ya existe el mismo número telefónico
                const duplicatePhoneIndex = destinationPhoneNumbers.findIndex(phone => 
                    phone.destinationFullPhoneNumber.trim() === normalizedPhoneNumber
                );

                if (duplicatePhoneIndex !== -1) {
                    console.log('[saveDestinationPhoneNumbers] Número telefónico duplicado detectado en índice:', duplicatePhoneIndex);
                    return res.status(400).json({
                        ok: false,
                        message: 'Este número telefónico ya está registrado'
                    });
                }

                // VALIDACIÓN 2: Verificar si ya existe el mismo email (solo si se proporcionó email)
                if (normalizedEmail) {
                    const duplicateEmailIndex = destinationPhoneNumbers.findIndex(phone => {
                        if (!phone.destinationEmail) return false;
                        return phone.destinationEmail.toLowerCase().trim() === normalizedEmail;
                    });

                    if (duplicateEmailIndex !== -1) {
                        console.log('[saveDestinationPhoneNumbers] Email duplicado detectado en índice:', duplicateEmailIndex);
                        return res.status(400).json({
                            ok: false,
                            message: 'Este correo electrónico ya está registrado para otro contacto'
                        });
                    }
                }

                // VALIDACIÓN 3: Verificar combinación número + email (redundante pero por seguridad)
                const duplicateCombination = destinationPhoneNumbers.findIndex(phone => {
                    const phoneMatch = phone.destinationFullPhoneNumber.trim() === normalizedPhoneNumber;
                    
                    if (!normalizedEmail && !phone.destinationEmail) {
                        // Ambos sin email, solo comparar número (ya validado arriba)
                        return phoneMatch;
                    }
                    
                    if (normalizedEmail && phone.destinationEmail) {
                        const emailMatch = phone.destinationEmail.toLowerCase().trim() === normalizedEmail;
                        return phoneMatch && emailMatch;
                    }
                    
                    return false;
                });

                if (duplicateCombination !== -1) {
                    console.log('[saveDestinationPhoneNumbers] Combinación número+email duplicada en índice:', duplicateCombination);
                    return res.status(400).json({
                        ok: false,
                        message: 'Esta combinación de número y correo ya está registrada'
                    });
                }

                // Todas las validaciones pasaron, agregar el nuevo número al array
                const updatedPhoneNumbers = [...destinationPhoneNumbers, newPhoneNumber];

                // Actualizar el documento con el array modificado
                await registeredPhoneNumbersRef.update({
                    destinationPhoneNumbers: updatedPhoneNumbers,
                    updatedAt: timestamp
                });
                
                console.log('[saveDestinationPhoneNumbers] Documento actualizado exitosamente');
            }

            return res.status(200).json({
                ok: true,
                message: 'Número telefónico registrado exitosamente',
                data: newPhoneNumber
            });

        } catch (error) {
            console.error('[saveDestinationPhoneNumbers] Error completo:', error);
            console.error('[saveDestinationPhoneNumbers] Stack trace:', error.stack);
            return res.status(500).json({
                ok: false,
                message: 'Error al guardar el número telefónico',
                error: error.message
            });
        }
    }

    deleteDestinationPhoneNumber = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            
            // Decodificar el parámetro de la URL ya que puede contener caracteres especiales como +
            const phoneNumberFull = decodeURIComponent(req.params.phoneNumberFull || req.body.phoneNumberFull || '');

            console.log('[deleteDestinationPhoneNumber] uid:', uid);
            console.log('[deleteDestinationPhoneNumber] phoneNumberFull from params:', req.params.phoneNumberFull);
            console.log('[deleteDestinationPhoneNumber] phoneNumberFull decoded:', phoneNumberFull);

            // Validar que se envíe el phoneNumberFull
            if (!phoneNumberFull) {
                return res.status(400).json({
                    ok: false,
                    message: 'El phoneNumberFull es requerido'
                });
            }

            // Buscar el documento del usuario
            const registeredPhoneNumbersRef = db.collection('PaySat_User_Registered_PhoneNumbers_Mobile').doc(uid);
            const registeredPhoneNumbersDoc = await registeredPhoneNumbersRef.get();

            // Si no existe el documento
            if (!registeredPhoneNumbersDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron números telefónicos registrados'
                });
            }

            const userData = registeredPhoneNumbersDoc.data();
            const destinationPhoneNumbers = userData.destinationPhoneNumbers || [];

            // Buscar el número telefónico a eliminar
            const phoneNumberToDelete = destinationPhoneNumbers.find(
                phone => phone.destinationFullPhoneNumber === phoneNumberFull
            );

            if (!phoneNumberToDelete) {
                return res.status(404).json({
                    ok: false,
                    message: 'Número telefónico no encontrado'
                });
            }

            // Filtrar el array para eliminar el número telefónico
            const updatedPhoneNumbers = destinationPhoneNumbers.filter(
                phone => phone.destinationFullPhoneNumber !== phoneNumberFull
            );

            const timestamp = admin.firestore.Timestamp.now();

            // Actualizar el documento
            await registeredPhoneNumbersRef.update({
                destinationPhoneNumbers: updatedPhoneNumbers,
                updatedAt: timestamp
            });

            return res.status(200).json({
                ok: true,
                message: 'Número telefónico eliminado exitosamente'
            });

        } catch (error) {
            console.error('Error al eliminar número telefónico de destino:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al eliminar el número telefónico',
                error: error.message
            });
        }
    }

    getPhoneNumberTransferFee = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;

            // Obtener el amount y originUID del request (pueden venir en query o body)
            const amount = parseFloat(req.query.amount || (req.body && req.body.amount));
            const originUID = req.query.originUID || (req.body && req.body.originUID);

            console.log(`[getPhoneNumberTransferFee] amount: ${amount}, originUID: ${originUID || 'NO PROPORCIONADO'}`);

            // Validar que el amount exista y sea un número válido
            if (isNaN(amount) || amount <= 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto (amount) es requerido y debe ser mayor a 0'
                });
            }

            // Validar que el amount no supere los 1000.00
            if (amount > 1000.00) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto no puede superar los 1000.00'
                });
            }

            // Si no se proporciona originUID, asumir que es cuenta externa y retornar fee normal
            // Esto mantiene retrocompatibilidad con versiones antiguas del frontend

            // Buscar la cuenta de origen para determinar si es PaySat (solo si se proporcionó originUID)
            let isOriginPaysat = false;
            
            if (originUID) {
                const registeredAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
                const registeredAccountsDoc = await registeredAccountsRef.get();

                if (registeredAccountsDoc.exists) {
                    const ownAccounts = registeredAccountsDoc.data().ownAccounts || [];
                    const originAccount = ownAccounts.find(acc => acc.accountUID === originUID);
                    
                    if (originAccount) {
                        isOriginPaysat = originAccount.affiliateName === 'PAYSAT MONEY LTD';
                        console.log(`[getPhoneNumberTransferFee] Cuenta encontrada: ${originAccount.affiliateName}, isOriginPaysat: ${isOriginPaysat}`);
                    }
                }

                // Si la cuenta origen es PaySat, el fee es 0
                if (isOriginPaysat) {
                    console.log(`[getPhoneNumberTransferFee] Retornando fee=0 para cuenta PaySat`);
                    return res.status(200).json({
                        ok: true,
                        data: {
                            amount: amount,
                            fee: 0,
                            feeRange: 'paysat_origin',
                            isOriginPaysat: true,
                            message: 'Sin comisión para transferencias desde cuenta PAYSAT'
                        },
                        message: 'Fee obtenido exitosamente'
                    });
                }
            }

            // Determinar el documento a consultar según el monto
            let docName;
            if (amount <= 100) {
                docName = 'Equal_Or_Less_Than_100';
            } else if (amount <= 500) {
                docName = 'Equal_Or_Less_Than_500';
            } else if (amount <= 1000) {
                docName = 'Equal_Or_Less_Than_1000';
            }

            // Consultar el documento en la colección PaySat_Table_Mobile_Payment_Fees
            const feeDocRef = db.collection('PaySat_Table_Mobile_Payment_Fees').doc(docName);
            const feeDoc = await feeDocRef.get();

            // Verificar si el documento existe
            if (!feeDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la configuración de fee para el monto especificado'
                });
            }

            const feeData = feeDoc.data();

            // Validar que el campo mobilePaymentFeeValue exista
            if (feeData.mobilePaymentFeeValue === undefined || feeData.mobilePaymentFeeValue === null) {
                return res.status(500).json({
                    ok: false,
                    message: 'El campo mobilePaymentFeeValue no está configurado en el documento'
                });
            }

            // Retornar el fee
            console.log(`[getPhoneNumberTransferFee] Retornando fee=${feeData.mobilePaymentFeeValue} para cuenta externa (${docName})`);
            return res.status(200).json({
                ok: true,
                data: {
                    amount: amount,
                    fee: feeData.mobilePaymentFeeValue,
                    feeRange: docName,
                    isOriginPaysat: false
                },
                message: 'Fee obtenido exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener el fee de transferencia:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener el fee de transferencia',
                error: error.message
            });
        }
    }

    sendTransferToPhoneNumber = async (req, res) => {
        try {
            // 1. VALIDAR AUTENTICACIÓN
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const {
                amount,
                reason,
                originUID,
                destinationPhoneNumber
            } = req.body;

            // 2. VALIDAR DATOS REQUERIDOS
            if (!amount || !originUID || !destinationPhoneNumber) {
                return res.status(400).json({
                    ok: false,
                    message: 'Campos requeridos: amount, originUID, destinationPhoneNumber'
                });
            }

            const transferAmount = parseFloat(amount);
            if (isNaN(transferAmount) || transferAmount <= 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto debe ser un número válido mayor a 0'
                });
            }

            if (transferAmount > 1000.00) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto no puede superar los 1000.00'
                });
            }

            // 3. BUSCAR CUENTA DE ORIGEN
            const registeredAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const registeredAccountsDoc = await registeredAccountsRef.get();

            if (!registeredAccountsDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron cuentas registradas para el usuario'
                });
            }

            const ownAccounts = registeredAccountsDoc.data().ownAccounts || [];
            const originAccount = ownAccounts.find(acc => acc.accountUID === originUID);

            if (!originAccount) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta de origen no encontrada'
                });
            }

            // Determinar si el origen es cuenta PaySat
            const isOriginPaysat = originAccount.affiliateName === 'PAYSAT MONEY LTD';

            console.log(`[sendTransferToPhoneNumber] Cuenta origen: ${originAccount.affiliateName}, isOriginPaysat: ${isOriginPaysat}`);

            // 4. DETERMINAR FEE (si origen es PaySat, fee = 0)
            let feeValue = 0;
            
            if (!isOriginPaysat) {
                // Solo consultar fee si NO es cuenta PaySat
                let feeDocName;
                if (transferAmount <= 100) {
                    feeDocName = 'Equal_Or_Less_Than_100';
                } else if (transferAmount <= 500) {
                    feeDocName = 'Equal_Or_Less_Than_500';
                } else if (transferAmount <= 1000) {
                    feeDocName = 'Equal_Or_Less_Than_1000';
                }

                const feeDocRef = db.collection('PaySat_Table_Mobile_Payment_Fees').doc(feeDocName);
                const feeDoc = await feeDocRef.get();

                if (feeDoc.exists) {
                    const feeData = feeDoc.data();
                    feeValue = feeData.mobilePaymentFeeValue || 0;
                }
            }
            // Si es PaySat, feeValue ya es 0 desde la inicialización

            console.log(`[sendTransferToPhoneNumber] Fee calculado: ${feeValue}, Monto: ${transferAmount}, Total requerido: ${transferAmount + feeValue}`);

            // 5. OBTENER CUENTA PRINCIPAL PAYSAT DEL USUARIO ORIGEN
            const userMainAccountRef = db.collection('Banco_PaySat_Money').doc(uid);
            const userMainAccountDoc = await userMainAccountRef.get();

            if (!userMainAccountDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la cuenta principal PaySat del usuario'
                });
            }

            const userMainAccountData = userMainAccountDoc.data();
            const userMainBalance = userMainAccountData.customerBalance || 0;
            const userMainEscrow = userMainAccountData.customerEscrow || 0;

            // 7. BUSCAR NÚMERO TELEFÓNICO EN REGISTROS DEL USUARIO
            const registeredPhoneNumbersRef = db.collection('PaySat_User_Registered_PhoneNumbers_Mobile').doc(uid);
            const registeredPhoneNumbersDoc = await registeredPhoneNumbersRef.get();

            let destinationUserName = null;
            if (registeredPhoneNumbersDoc.exists) {
                const phoneData = registeredPhoneNumbersDoc.data();
                const destinationPhoneNumbers = phoneData.destinationPhoneNumbers || [];
                const foundPhone = destinationPhoneNumbers.find(
                    phone => phone.destinationFullPhoneNumber === destinationPhoneNumber
                );
                if (foundPhone) {
                    destinationUserName = foundPhone.destinationUserName;
                }
            }

            // 8. BUSCAR SI EXISTE USUARIO DESTINO EN BANCO_PAYSAT_MONEY
            const destinationUsersSnapshot = await db.collection('Banco_PaySat_Money')
                .where('customerPhone', '==', destinationPhoneNumber)
                .limit(1)
                .get();

            const destinationUserExists = !destinationUsersSnapshot.empty;
            let destinationUserData = null;
            let destinationUID = null;

            if (destinationUserExists) {
                destinationUserData = destinationUsersSnapshot.docs[0].data();
                destinationUID = destinationUsersSnapshot.docs[0].id;
            }

            // 9. VALIDAR SALDO SUFICIENTE EN CUENTA PRINCIPAL
            const totalRequired = transferAmount + feeValue;
            if (userMainBalance < totalRequired) {
                return res.status(400).json({
                    ok: false,
                    message: `Saldo insuficiente. Requerido: ${totalRequired.toFixed(2)}, Disponible: ${userMainBalance.toFixed(2)}`
                });
            }

            // 10. OBTENER DATOS DE LA CUENTA PRINCIPAL DE PAYSAT (SISTEMA)
            const PAYSAT_MAIN_ACCOUNT_UID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
            const PAYSAT_MAIN_ACCOUNT_NUMBER = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
            const PAYSAT_MAIN_ACCOUNT_EMAIL = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;

            const paysatMainAccountRef = db.collection('Banco_PaySat_Money').doc(PAYSAT_MAIN_ACCOUNT_UID);
            const paysatMainAccountDoc = await paysatMainAccountRef.get();

            if (!paysatMainAccountDoc.exists) {
                return res.status(500).json({
                    ok: false,
                    message: 'Error: No se encontró la cuenta principal de PaySat'
                });
            }

            const paysatMainAccountData = paysatMainAccountDoc.data();

            // 11. OBTENER NOMBRE DE COLECCIÓN EXTERNA Y DOCUMENTO SI EL ORIGEN NO ES PAYSAT
            let externalCollectionName = null;
            let externalAccountRef = null;
            if (!isOriginPaysat) {
                // Validar que la cuenta externa tenga affiliateId y accountNumber
                if (!originAccount.affiliateId || !originAccount.accountNumber) {
                    return res.status(400).json({
                        ok: false,
                        message: 'La cuenta externa no tiene affiliateId o accountNumber'
                    });
                }

                // Buscar en PaySat_Transfer_Affiliates el documento donde uid === affiliateId
                const affiliatesSnapshot = await db.collection('PaySat_Transfer_Affiliates')
                    .where('uid', '==', originAccount.affiliateId)
                    .limit(1)
                    .get();

                if (affiliatesSnapshot.empty) {
                    return res.status(404).json({
                        ok: false,
                        message: 'No se encontró el afiliado del banco/cooperativa'
                    });
                }

                // El nombre del documento es el nombre de la colección del banco/cooperativa
                externalCollectionName = affiliatesSnapshot.docs[0].id;

                // Buscar la cuenta en la colección del banco/cooperativa usando el número de cuenta
                const externalAccountSnapshot = await db.collection(externalCollectionName)
                    .where('customerAccountNumber', '==', originAccount.accountNumber)
                    .limit(1)
                    .get();

                if (externalAccountSnapshot.empty) {
                    return res.status(404).json({
                        ok: false,
                        message: `No se encontró la cuenta ${originAccount.accountNumber} en ${externalCollectionName}`
                    });
                }

                // Guardar la referencia del documento encontrado
                externalAccountRef = externalAccountSnapshot.docs[0].ref;
            }

            // 12. GENERAR IDs PARA LA TRANSACCIÓN
            const transactionUID = uuidv4();
            const timestamp = new Date().toISOString();
            const firestoreTimestamp = admin.firestore.Timestamp.now();

            // 13. EJECUTAR TRANSACCIÓN ATÓMICA
            await db.runTransaction(async (transaction) => {
                
                // ESCENARIO 1: DESTINO EXISTE EN PAYSAT
                if (destinationUserExists) {
                    
                    // FORMA 1: ORIGEN ES PAYSAT
                    if (isOriginPaysat) {
                        // Restar de cuenta principal del usuario origen
                        const newBalanceOrigin = userMainBalance - transferAmount - feeValue;
                        const newTotalOrigin = newBalanceOrigin + userMainEscrow;

                        transaction.update(userMainAccountRef, {
                            customerBalance: newBalanceOrigin,
                            customerTotal: newTotalOrigin,
                            updatedAt: firestoreTimestamp
                        });

                        // Sumar a cuenta destino
                        const destinationRef = db.collection('Banco_PaySat_Money').doc(destinationUID);
                        const destinationBalance = destinationUserData.customerBalance || 0;
                        const destinationEscrow = destinationUserData.customerEscrow || 0;
                        const newBalanceDestination = destinationBalance + transferAmount;
                        const newTotalDestination = newBalanceDestination + destinationEscrow;

                        transaction.update(destinationRef, {
                            customerBalance: newBalanceDestination,
                            customerTotal: newTotalDestination,
                            updatedAt: firestoreTimestamp
                        });

                        // Sumar fee a cuenta principal de PaySat
                        if (feeValue > 0) {
                            const paysatMainBalance = paysatMainAccountData.customerBalance || 0;
                            const paysatMainEscrow = paysatMainAccountData.customerEscrow || 0;
                            const newPaysatBalance = paysatMainBalance + feeValue;
                            const newPaysatTotal = newPaysatBalance + paysatMainEscrow;

                            transaction.update(paysatMainAccountRef, {
                                customerBalance: newPaysatBalance,
                                customerTotal: newPaysatTotal,
                                updatedAt: firestoreTimestamp
                            });
                        }

                        // Registrar movimiento en origen (envío)
                        const movementSentId = `mobile_transfer_${transactionUID}`;
                        const movementSent = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementSentId,
                            description: `send_${movementSentId}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            userName: destinationUserName || destinationUserData.fullName || 'Usuario',
                            originUID: uid,
                            destinationUID: destinationUID,
                            typeMovement: 'mobile_transfer_sent',
                            status: 'success',
                            fee: feeValue,
                            total: transferAmount + feeValue,
                            reason: reason || ''
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementSent)
                        });

                        // Registrar fee en origen si existe
                        if (feeValue > 0) {
                            const feeMovement = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: feeValue,
                                amount_cents: Math.round(feeValue * 100),
                                balanceTransactionId: `txn_${transactionUID}`,
                                createdAt: timestamp,
                                currency: 'usd',
                                id: `mobile_fee_transfer_${transactionUID}`,
                                paysatFee: feeValue,
                                paysatUID: uid,
                                source: 'mobile_paysat_transfer',
                                totalFee: feeValue,
                                totalFee_cents: Math.round(feeValue * 100),
                                typeMovement: 'fee'
                            };

                            transaction.update(userMainAccountRef, {
                                customerMovements: admin.firestore.FieldValue.arrayUnion(feeMovement)
                            });
                        }

                        // Registrar movimiento en destino (recepción)
                        const movementReceivedId = `mobile_transfer_${transactionUID}`;
                        const movementReceived = {
                            PAYSATAccountNumber: destinationUserData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementReceivedId,
                            description: `received_${movementReceivedId}`,
                            paysatUID: destinationUID,
                            updatedAt: timestamp,
                            userName: userMainAccountData.fullName || 'Usuario',
                            originUID: uid,
                            destinationUID: destinationUID,
                            typeMovement: 'mobile_transfer_received',
                            status: 'success',
                            reason: reason || ''
                        };

                        transaction.update(destinationRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementReceived)
                        });

                    } else {
                        // FORMA 2: ORIGEN ES CUENTA EXTERNA
                        
                        // Usar la referencia obtenida antes de la transacción
                        const externalAccountDoc = await transaction.get(externalAccountRef);

                        if (!externalAccountDoc.exists) {
                            throw new Error('Cuenta externa no encontrada');
                        }

                        const externalAccountData = externalAccountDoc.data();
                        const externalBalance = externalAccountData.customerBalance || 0;
                        const externalEscrow = externalAccountData.customerEscrow || 0;

                        if (externalBalance < transferAmount) {
                            throw new Error('Saldo insuficiente en cuenta externa');
                        }

                        // Restar de cuenta externa
                        const newExternalBalance = externalBalance - transferAmount;
                        const newExternalTotal = newExternalBalance + externalEscrow;

                        transaction.update(externalAccountRef, {
                            customerBalance: newExternalBalance,
                            customerTotal: newExternalTotal,
                            updatedAt: firestoreTimestamp
                        });

                        // Movimiento en cuenta externa (salida)
                        const externalMovementOut = {
                            accountNumber: originAccount.accountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `external_out_${transactionUID}`,
                            description: `Transferencia a PaySat`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            destinationType: 'paysat_account',
                            typeMovement: 'external_transfer_out',
                            status: 'success'
                        };

                        transaction.update(externalAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(externalMovementOut)
                        });

                        // Sumar a cuenta principal PaySat del usuario origen (temporal)
                        const newBalanceOriginTemp = userMainBalance + transferAmount - transferAmount - feeValue;
                        const newTotalOriginTemp = newBalanceOriginTemp + userMainEscrow;

                        transaction.update(userMainAccountRef, {
                            customerBalance: newBalanceOriginTemp,
                            customerTotal: newTotalOriginTemp,
                            updatedAt: firestoreTimestamp
                        });

                        // Movimiento en cuenta PaySat origen (ingreso desde externa)
                        const paysatMovementIn = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `external_in_${transactionUID}`,
                            description: `Ingreso desde ${originAccount.affiliateName}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            originType: 'external_account',
                            originAffiliateName: originAccount.affiliateName,
                            typeMovement: 'external_transfer_in',
                            status: 'success'
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(paysatMovementIn)
                        });

                        // Segundo: Transferir de cuenta principal del usuario a destino
                        const destinationRef = db.collection('Banco_PaySat_Money').doc(destinationUID);
                        const destinationBalance = destinationUserData.customerBalance || 0;
                        const destinationEscrow = destinationUserData.customerEscrow || 0;
                        const newBalanceDestination = destinationBalance + transferAmount;
                        const newTotalDestination = newBalanceDestination + destinationEscrow;

                        transaction.update(destinationRef, {
                            customerBalance: newBalanceDestination,
                            customerTotal: newTotalDestination,
                            updatedAt: firestoreTimestamp
                        });

                        // Sumar fee a cuenta principal de PaySat
                        if (feeValue > 0) {
                            const paysatMainBalance = paysatMainAccountData.customerBalance || 0;
                            const paysatMainEscrow = paysatMainAccountData.customerEscrow || 0;
                            const newPaysatBalance = paysatMainBalance + feeValue;
                            const newPaysatTotal = newPaysatBalance + paysatMainEscrow;

                            transaction.update(paysatMainAccountRef, {
                                customerBalance: newPaysatBalance,
                                customerTotal: newPaysatTotal,
                                updatedAt: firestoreTimestamp
                            });
                        }

                        // Registrar movimiento en origen (envío)
                        const movementSentId = `mobile_transfer_${transactionUID}`;
                        const movementSent = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementSentId,
                            description: `send_${movementSentId}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            userName: destinationUserName || destinationUserData.fullName || 'Usuario',
                            originUID: uid,
                            originType: 'external_account',
                            originAffiliateName: originAccount.affiliateName,
                            destinationUID: destinationUID,
                            typeMovement: 'mobile_transfer_sent',
                            status: 'success',
                            fee: feeValue,
                            total: transferAmount + feeValue,
                            reason: reason || ''
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementSent)
                        });

                        // Registrar fee en origen si existe
                        if (feeValue > 0) {
                            const feeMovement = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: feeValue,
                                amount_cents: Math.round(feeValue * 100),
                                balanceTransactionId: `txn_${transactionUID}`,
                                createdAt: timestamp,
                                currency: 'usd',
                                id: `mobile_fee_transfer_${transactionUID}`,
                                paysatFee: feeValue,
                                paysatUID: uid,
                                source: 'mobile_paysat_transfer',
                                totalFee: feeValue,
                                totalFee_cents: Math.round(feeValue * 100),
                                typeMovement: 'fee'
                            };

                            transaction.update(userMainAccountRef, {
                                customerMovements: admin.firestore.FieldValue.arrayUnion(feeMovement)
                            });
                        }

                        // Registrar movimiento en destino (recepción)
                        const movementReceivedId = `mobile_transfer_${transactionUID}`;
                        const movementReceived = {
                            PAYSATAccountNumber: destinationUserData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementReceivedId,
                            description: `received_${movementReceivedId}`,
                            paysatUID: destinationUID,
                            updatedAt: timestamp,
                            userName: userMainAccountData.fullName || 'Usuario',
                            originUID: uid,
                            destinationUID: destinationUID,
                            typeMovement: 'mobile_transfer_received',
                            status: 'success',
                            reason: reason || ''
                        };

                        transaction.update(destinationRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementReceived)
                        });
                    }

                } else {
                    // ESCENARIO 2: DESTINO NO EXISTE - VA A ESCROW DE PAYSAT
                    
                    if (isOriginPaysat) {
                        // Origen es cuenta PAYSAT
                        // Restar de cuenta principal del usuario origen
                        const newBalanceOrigin = userMainBalance - transferAmount - feeValue;
                        const newTotalOrigin = newBalanceOrigin + userMainEscrow;

                        transaction.update(userMainAccountRef, {
                            customerBalance: newBalanceOrigin,
                            customerTotal: newTotalOrigin,
                            updatedAt: firestoreTimestamp
                        });

                        // Sumar a escrow de cuenta principal de PaySat
                        const paysatMainBalance = paysatMainAccountData.customerBalance || 0;
                        const paysatMainEscrow = paysatMainAccountData.customerEscrow || 0;
                        const newPaysatEscrow = paysatMainEscrow + transferAmount;
                        const newPaysatBalance = paysatMainBalance + feeValue;
                        const newPaysatTotal = newPaysatBalance + newPaysatEscrow;

                        transaction.update(paysatMainAccountRef, {
                            customerBalance: newPaysatBalance,
                            customerEscrow: newPaysatEscrow,
                            customerTotal: newPaysatTotal,
                            updatedAt: firestoreTimestamp
                        });

                        // Registrar movimiento en origen
                        const movementSentId = `mobile_transfer_${transactionUID}`;
                        const movementSent = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementSentId,
                            description: `send_${movementSentId}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            userName: destinationUserName || 'Usuario Pendiente',
                            originUID: uid,
                            destinationPhoneNumber: destinationPhoneNumber,
                            typeMovement: 'mobile_transfer_sent',
                            status: 'success',
                            fee: feeValue,
                            total: transferAmount + feeValue,
                            reason: reason || ''
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementSent)
                        });

                        // Registrar fee si existe
                        if (feeValue > 0) {
                            const feeMovement = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: feeValue,
                                amount_cents: Math.round(feeValue * 100),
                                balanceTransactionId: `txn_${transactionUID}`,
                                createdAt: timestamp,
                                currency: 'usd',
                                id: `mobile_fee_transfer_${transactionUID}`,
                                paysatFee: feeValue,
                                paysatUID: uid,
                                source: 'mobile_paysat_transfer',
                                totalFee: feeValue,
                                totalFee_cents: Math.round(feeValue * 100),
                                typeMovement: 'fee'
                            };

                            transaction.update(userMainAccountRef, {
                                customerMovements: admin.firestore.FieldValue.arrayUnion(feeMovement)
                            });
                        }

                        // Registrar en escrow de PaySat
                        const escrowMovement = {
                            PAYSATAccountNumber: PAYSAT_MAIN_ACCOUNT_NUMBER,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `escrow_pending_${transactionUID}`,
                            description: `Transferencia pendiente para ${destinationPhoneNumber}`,
                            paysatUID: PAYSAT_MAIN_ACCOUNT_UID,
                            updatedAt: timestamp,
                            originUID: uid,
                            destinationPhoneNumber: destinationPhoneNumber,
                            destinationUserName: destinationUserName,
                            typeMovement: 'escrow_pending_transfer',
                            status: 'pending',
                            reason: reason || '',
                            processed: false // Campo para marcar cuando se procese la transferencia al registrarse el usuario destino
                        };

                        transaction.update(paysatMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(escrowMovement)
                        });

                    } else {
                        // Origen es cuenta EXTERNA
                        
                        // Usar la referencia obtenida antes de la transacción
                        const externalAccountDoc = await transaction.get(externalAccountRef);

                        if (!externalAccountDoc.exists) {
                            throw new Error('Cuenta externa no encontrada');
                        }

                        const externalAccountData = externalAccountDoc.data();
                        const externalBalance = externalAccountData.customerBalance || 0;
                        const externalEscrow = externalAccountData.customerEscrow || 0;

                        if (externalBalance < transferAmount) {
                            throw new Error('Saldo insuficiente en cuenta externa');
                        }

                        // Restar de cuenta externa
                        const newExternalBalance = externalBalance - transferAmount;
                        const newExternalTotal = newExternalBalance + externalEscrow;

                        transaction.update(externalAccountRef, {
                            customerBalance: newExternalBalance,
                            customerTotal: newExternalTotal,
                            updatedAt: firestoreTimestamp
                        });

                        // Movimiento en cuenta externa
                        const externalMovementOut = {
                            accountNumber: originAccount.accountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `external_out_${transactionUID}`,
                            description: `Transferencia a PaySat (Pendiente)`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            destinationPhoneNumber: destinationPhoneNumber,
                            typeMovement: 'external_transfer_out',
                            status: 'success', // Aunque la transferencia al usuario destino está pendiente, desde la perspectiva de la cuenta externa ya se realizó el débito, por lo que se marca como 'success'    
                        };

                        transaction.update(externalAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(externalMovementOut)
                        });

                        // Actualizar cuenta principal del usuario (restar fee)
                        const newBalanceOrigin = userMainBalance - feeValue;
                        const newTotalOrigin = newBalanceOrigin + userMainEscrow;

                        transaction.update(userMainAccountRef, {
                            customerBalance: newBalanceOrigin,
                            customerTotal: newTotalOrigin,
                            updatedAt: firestoreTimestamp
                        });

                        // Sumar a escrow de PaySat
                        const paysatMainBalance = paysatMainAccountData.customerBalance || 0;
                        const paysatMainEscrow = paysatMainAccountData.customerEscrow || 0;
                        const newPaysatEscrow = paysatMainEscrow + transferAmount;
                        const newPaysatBalance = paysatMainBalance + feeValue;
                        const newPaysatTotal = newPaysatBalance + newPaysatEscrow;

                        transaction.update(paysatMainAccountRef, {
                            customerBalance: newPaysatBalance,
                            customerEscrow: newPaysatEscrow,
                            customerTotal: newPaysatTotal,
                            updatedAt: firestoreTimestamp
                        });

                        // Movimientos en cuenta PaySat del origen
                        const paysatMovementIn = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `external_in_${transactionUID}`,
                            description: `Ingreso desde ${originAccount.affiliateName}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            originType: 'external_account',
                            originAffiliateName: originAccount.affiliateName,
                            typeMovement: 'external_transfer_in',
                            status: 'success'
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(paysatMovementIn)
                        });

                        const movementSentId = `mobile_transfer_${transactionUID}`;
                        const movementSent = {
                            PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: movementSentId,
                            description: `send_${movementSentId}`,
                            paysatUID: uid,
                            updatedAt: timestamp,
                            userName: destinationUserName || 'Usuario Pendiente',
                            originUID: uid,
                            originType: 'external_account',
                            originAffiliateName: originAccount.affiliateName,
                            destinationPhoneNumber: destinationPhoneNumber,
                            typeMovement: 'mobile_transfer_sent',
                            status: 'pending',
                            fee: feeValue,
                            total: transferAmount + feeValue,
                            reason: reason || ''
                        };

                        transaction.update(userMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(movementSent)
                        });

                        // Registrar fee
                        if (feeValue > 0) {
                            const feeMovement = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: feeValue,
                                amount_cents: Math.round(feeValue * 100),
                                balanceTransactionId: `txn_${transactionUID}`,
                                createdAt: timestamp,
                                currency: 'usd',
                                id: `mobile_fee_transfer_${transactionUID}`,
                                paysatFee: feeValue,
                                paysatUID: uid,
                                source: 'mobile_paysat_transfer',
                                totalFee: feeValue,
                                totalFee_cents: Math.round(feeValue * 100),
                                typeMovement: 'fee'
                            };

                            transaction.update(userMainAccountRef, {
                                customerMovements: admin.firestore.FieldValue.arrayUnion(feeMovement)
                            });
                        }

                        // Registrar en escrow de PaySat
                        const escrowMovement = {
                            PAYSATAccountNumber: PAYSAT_MAIN_ACCOUNT_NUMBER,
                            amount: transferAmount,
                            amount_cents: Math.round(transferAmount * 100),
                            createdAt: timestamp,
                            currency: 'usd',
                            id: `escrow_pending_${transactionUID}`,
                            description: `Transferencia pendiente para ${destinationPhoneNumber}`,
                            paysatUID: PAYSAT_MAIN_ACCOUNT_UID,
                            updatedAt: timestamp,
                            originUID: uid,
                            originType: 'external_account',
                            originAffiliateName: originAccount.affiliateName,
                            destinationPhoneNumber: destinationPhoneNumber,
                            destinationUserName: destinationUserName,
                            typeMovement: 'escrow_pending_transfer',
                            status: 'pending',
                            reason: reason || '',
                            processed: false, // Campo para marcar cuando se procese la transferencia al registrarse el usuario destino
                        };

                        transaction.update(paysatMainAccountRef, {
                            customerMovements: admin.firestore.FieldValue.arrayUnion(escrowMovement)
                        });
                    }
                }
            });

            // 13. REGISTRAR EN LEDGER (fuera de la transacción)
            try {
                if (destinationUserExists) {
                    // Calcular balance_after_debit según el tipo de origen
                    // Si origen es PaySat: se resta transferAmount + feeValue
                    // Si origen es externo: solo se resta feeValue (el transferAmount sale de la cuenta externa)
                    const balanceAfterDebit = isOriginPaysat 
                        ? userMainBalance - transferAmount - feeValue
                        : userMainBalance - feeValue;
                    
                    // Registrar transferencia en ledger
                    await recordLedgerEntry({
                        type: 'TRANSFER',
                        debit_account: uid,
                        credit_account: destinationUID,
                        amount: transferAmount,
                        currency: 'USD',
                        balance_after_debit: balanceAfterDebit,
                        balance_after_credit: (destinationUserData.customerBalance || 0) + transferAmount,
                        description: `Transferencia móvil a ${destinationPhoneNumber}`,
                        meta: {
                            transaction_id: transactionUID,
                            origin_type: isOriginPaysat ? 'paysat_account' : 'external_account',
                            affiliate_name: originAccount.affiliateName,
                            destination_phone: destinationPhoneNumber,
                            reason: reason || ''
                        },
                        req
                    });

                    // Registrar fee en ledger si existe
                    if (feeValue > 0) {
                        await recordFeeEntry({
                            user_account: uid,
                            system_account: PAYSAT_MAIN_ACCOUNT_UID,
                            fee_amount: feeValue,
                            currency: 'USD',
                            balance_after: balanceAfterDebit,
                            description: `Fee transferencia móvil ${transactionUID}`,
                            meta: {
                                transaction_id: transactionUID,
                                fee_type: 'mobile_transfer_fee',
                                transfer_amount: transferAmount
                            },
                            related_transaction_id: transactionUID,
                            req
                        });
                    }
                } else {
                    // Calcular balance_after_debit para transferencia pendiente
                    const balanceAfterDebitPending = isOriginPaysat 
                        ? userMainBalance - transferAmount - feeValue
                        : userMainBalance - feeValue;
                    
                    // Registrar transferencia pendiente en ledger
                    await recordLedgerEntry({
                        type: 'TRANSFER',
                        debit_account: uid,
                        credit_account: PAYSAT_MAIN_ACCOUNT_UID,
                        amount: transferAmount,
                        currency: 'USD',
                        balance_after_debit: balanceAfterDebitPending,
                        description: `Transferencia móvil pendiente a ${destinationPhoneNumber}`,
                        meta: {
                            transaction_id: transactionUID,
                            origin_type: isOriginPaysat ? 'paysat_account' : 'external_account',
                            affiliate_name: originAccount.affiliateName,
                            destination_phone: destinationPhoneNumber,
                            status: 'pending',
                            escrow: true,
                            reason: reason || ''
                        },
                        req
                    });

                    if (feeValue > 0) {
                        await recordFeeEntry({
                            user_account: uid,
                            system_account: PAYSAT_MAIN_ACCOUNT_UID,
                            fee_amount: feeValue,
                            currency: 'USD',
                            balance_after: balanceAfterDebitPending,
                            description: `Fee transferencia móvil pendiente ${transactionUID}`,
                            meta: {
                                transaction_id: transactionUID,
                                fee_type: 'mobile_transfer_fee',
                                transfer_amount: transferAmount,
                                status: 'pending'
                            },
                            related_transaction_id: transactionUID,
                            req
                        });
                    }
                }
            } catch (ledgerError) {
                console.error('Error registrando en ledger:', ledgerError);
                // No fallar la transacción por error en ledger
            }

            // 14. ENVIAR NOTIFICACIONES PUSH Y SMS
            try {
                console.log(`[sendTransferToPhoneNumber] Preparando notificaciones - OriginUID: ${uid}, DestinationUID: ${destinationUID}, DestinationExists: ${destinationUserExists}`);
                
                const notificationData = {
                    originUID: uid,
                    originUserName: originAccount.beneficiaryName,
                    destinationUID: destinationUID,
                    destinationUserExists: destinationUserExists,
                    amount: transferAmount,
                    destinationName: destinationUserName || (destinationUserData ? destinationUserData.fullName : 'Usuario'),
                    originName: userMainAccountData.fullName || 'Usuario',
                    destinationPhoneNumber: destinationPhoneNumber,
                    isOriginPaySat: isOriginPaysat,
                    affiliateName: originAccount.affiliateName,
                    transactionUID: transactionUID,
                    feeValue: feeValue
                };

                const notificationResult = await sendMobileTransferNotifications(notificationData);
                
                if (notificationResult.success) {
                    console.log('Notificaciones enviadas exitosamente:', notificationResult);
                } else {
                    console.error('Error enviando notificaciones:', notificationResult.error);
                }
            } catch (notificationError) {
                console.error('Error en el envío de notificaciones:', notificationError);
                // No fallar la transacción por error en notificaciones
            }

            // 15. RESPUESTA EXITOSA
            return res.status(200).json({
                ok: true,
                message: destinationUserExists 
                    ? 'Transferencia realizada exitosamente' 
                    : 'Transferencia registrada. El destinatario recibirá los fondos al registrarse en PaySat',
                data: {
                    transactionId: transactionUID,
                    amount: transferAmount,
                    fee: feeValue,
                    total: transferAmount + feeValue,
                    destinationPhoneNumber,
                    destinationUserExists,
                    status: destinationUserExists ? 'completed' : 'pending',
                    timestamp
                }
            });

        } catch (error) {
            console.error('Error en sendTransferToPhoneNumber:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al procesar la transferencia',
                error: error.message
            });
        }
    }

    receivePendingPhoneNumberTransfer = async (req, res) => {
        try {
            // 1. VALIDAR AUTENTICACIÓN
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;

            // 2. VERIFICAR FIRSTLOGIN EN PAYSAT_USERS
            const userRef = db.collection('PaySat_Users').doc(uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'Usuario no encontrado en PaySat_Users'
                });
            }

            const userData = userDoc.data();
            
            // Si firstLogin no es true, no procesar
            if (userData.firstLogin !== true) {
                return res.status(200).json({
                    ok: true,
                    message: 'No hay transferencias pendientes por procesar',
                    data: {
                        firstLogin: false,
                        transfersProcessed: 0
                    }
                });
            }

            // 3. OBTENER DATOS DEL USUARIO DESDE BANCO_PAYSAT_MONEY
            const userPhoneNumber = userData.phoneNumber;
            const userDni = userData.dniPersonalNumber;

            if (!userPhoneNumber || !userDni) {
                return res.status(400).json({
                    ok: false,
                    message: 'Usuario no tiene phoneNumber o dniPersonalNumber configurado'
                });
            }

            // Buscar cuenta principal del nuevo usuario
            const userAccountSnapshot = await db.collection('Banco_PaySat_Money')
                .where('customerID', '==', userDni)
                .where('customerPhone', '==', userPhoneNumber)
                .where('mainAccount', '==', true)
                .limit(1)
                .get();

            if (userAccountSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la cuenta principal PaySat del usuario'
                });
            }

            const userAccountDoc = userAccountSnapshot.docs[0];
            const userAccountData = userAccountDoc.data();
            const userAccountRef = userAccountDoc.ref;

            console.log(`[receivePendingPhoneNumberTransfer] Usuario: ${userAccountData.fullName}, Teléfono: ${userPhoneNumber}`);

            // 4. OBTENER CUENTA MASTER DE PAYSAT
            const PAYSAT_MAIN_ACCOUNT_UID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
            const PAYSAT_MAIN_ACCOUNT_NUMBER = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;

            const paysatMainAccountRef = db.collection('Banco_PaySat_Money').doc(PAYSAT_MAIN_ACCOUNT_UID);
            const paysatMainAccountDoc = await paysatMainAccountRef.get();

            if (!paysatMainAccountDoc.exists) {
                return res.status(500).json({
                    ok: false,
                    message: 'Error: No se encontró la cuenta principal de PaySat'
                });
            }

            const paysatMainAccountData = paysatMainAccountDoc.data();
            const paysatMainBalance = paysatMainAccountData.customerBalance || 0;
            const paysatMainEscrow = paysatMainAccountData.customerEscrow || 0;

            // 5. BUSCAR TRANSFERENCIAS PENDIENTES
            const customerMovements = paysatMainAccountData.customerMovements || [];
            const pendingTransfers = customerMovements.filter(movement => 
                movement.status === 'pending' &&
                movement.destinationPhoneNumber === userPhoneNumber &&
                movement.typeMovement === 'escrow_pending_transfer' &&
                movement.processed === false // Asegurarse de no incluir transferencias ya procesadas
            );

            if (pendingTransfers.length === 0) {
                // No hay transferencias pendientes, pero actualizar firstLogin
                await userRef.update({ firstLogin: false });

                return res.status(200).json({
                    ok: true,
                    message: 'No hay transferencias pendientes para este usuario',
                    data: {
                        firstLogin: false,
                        transfersProcessed: 0
                    }
                });
            }

            console.log(`[receivePendingPhoneNumberTransfer] Encontradas ${pendingTransfers.length} transferencias pendientes`);

            // 6. CALCULAR TOTAL A TRANSFERIR
            const totalToTransfer = pendingTransfers.reduce((sum, transfer) => sum + (transfer.amount || 0), 0);

            // Verificar que haya suficiente en escrow
            if (paysatMainEscrow < totalToTransfer) {
                return res.status(500).json({
                    ok: false,
                    message: 'Error: Saldo insuficiente en escrow de la cuenta master',
                    data: {
                        required: totalToTransfer,
                        available: paysatMainEscrow
                    }
                });
            }

            // 7. PROCESAR TRANSFERENCIAS EN TRANSACCIÓN ATÓMICA
            const processedTransfers = [];
            const timestamp = new Date().toISOString();
            const firestoreTimestamp = admin.firestore.Timestamp.now();
            let newUserBalance = 0; // Declarar fuera para usarlo en ledger

            await db.runTransaction(async (transaction) => {
                // Obtener datos actualizados dentro de la transacción
                const paysatAccountSnapshot = await transaction.get(paysatMainAccountRef);
                const userAccountSnapshot = await transaction.get(userAccountRef);

                if (!paysatAccountSnapshot.exists || !userAccountSnapshot.exists) {
                    throw new Error('Cuentas no encontradas durante la transacción');
                }

                const paysatData = paysatAccountSnapshot.data();
                const currentPaysatBalance = paysatData.customerBalance || 0;
                const currentPaysatEscrow = paysatData.customerEscrow || 0;

                const userData = userAccountSnapshot.data();
                const currentUserBalance = userData.customerBalance || 0;
                const currentUserEscrow = userData.customerEscrow || 0;

                // Verificar nuevamente que hay suficiente en escrow
                if (currentPaysatEscrow < totalToTransfer) {
                    throw new Error(`Saldo insuficiente en escrow: ${currentPaysatEscrow} < ${totalToTransfer}`);
                }

                // Actualizar balances de cuenta master
                const newPaysatEscrow = currentPaysatEscrow - totalToTransfer;
                const newPaysatTotal = currentPaysatBalance + newPaysatEscrow;

                transaction.update(paysatMainAccountRef, {
                    customerEscrow: newPaysatEscrow,
                    customerTotal: newPaysatTotal,
                    updatedAt: firestoreTimestamp
                });

                // Actualizar balances de cuenta usuario
                newUserBalance = currentUserBalance + totalToTransfer;
                const newUserTotal = newUserBalance + currentUserEscrow;

                transaction.update(userAccountRef, {
                    customerBalance: newUserBalance,
                    customerTotal: newUserTotal,
                    updatedAt: firestoreTimestamp
                });

                // Preparar array de movimientos actualizados para cuenta master
                const updatedPaysatMovements = [...(paysatData.customerMovements || [])];
                const userMovementsToAdd = [];

                // Procesar cada transferencia pendiente
                for (const pendingTransfer of pendingTransfers) {
                    const transferAmount = pendingTransfer.amount || 0;
                    const originUID = pendingTransfer.originUID;
                    const originType = pendingTransfer.originType || 'paysat_account';
                    const originAffiliateName = pendingTransfer.originAffiliateName || 'PAYSAT MONEY LTD';
                    const reason = pendingTransfer.reason || '';

                    // ID único para los nuevos movimientos
                    const completedTransferId = pendingTransfer.id.replace('escrow_pending_', 'transfer_completed_');

                    // 1. Marcar el movimiento pendiente como procesado
                    const pendingIndex = updatedPaysatMovements.findIndex(m => m.id === pendingTransfer.id);
                    if (pendingIndex !== -1) {
                        updatedPaysatMovements[pendingIndex] = {
                            ...updatedPaysatMovements[pendingIndex],
                            processed: true,
                            processedAt: timestamp
                        };
                    }

                    // 2. Movimiento en cuenta master (salida de escrow completada)
                    const masterCompletedMovement = {
                        PAYSATAccountNumber: PAYSAT_MAIN_ACCOUNT_NUMBER,
                        amount: transferAmount,
                        amount_cents: Math.round(transferAmount * 100),
                        createdAt: timestamp,
                        currency: 'usd',
                        id: completedTransferId,
                        description: `Transferencia completada a ${userPhoneNumber}`,
                        paysatUID: PAYSAT_MAIN_ACCOUNT_UID,
                        updatedAt: timestamp,
                        originUID: originUID,
                        originType: originType,
                        originAffiliateName: originAffiliateName,
                        destinationUID: uid,
                        destinationPhoneNumber: userPhoneNumber,
                        destinationUserName: userData.fullName || 'Usuario',
                        typeMovement: 'escrow_transfer_completed',
                        status: 'success',
                        reason: reason,
                        relatedPendingId: pendingTransfer.id
                    };

                    updatedPaysatMovements.push(masterCompletedMovement);

                    // 3. Movimiento en cuenta del nuevo usuario (recepción)
                    const userReceivedMovement = {
                        PAYSATAccountNumber: userData.customerAccountNumber,
                        amount: transferAmount,
                        amount_cents: Math.round(transferAmount * 100),
                        createdAt: timestamp,
                        currency: 'usd',
                        id: `received_${completedTransferId}`,
                        description: `Transferencia recibida de ${originAffiliateName}`,
                        paysatUID: uid,
                        updatedAt: timestamp,
                        originUID: originUID,
                        originType: originType,
                        originAffiliateName: originAffiliateName,
                        typeMovement: 'mobile_transfer_received',
                        status: 'success',
                        reason: reason,
                        relatedPendingId: pendingTransfer.id
                    };

                    userMovementsToAdd.push(userReceivedMovement);

                    processedTransfers.push({
                        amount: transferAmount,
                        from: originAffiliateName,
                        originUID: originUID,
                        pendingId: pendingTransfer.id,
                        completedId: completedTransferId
                    });
                }

                // Actualizar movimientos de cuenta master (incluye pendientes marcados como processed:true)
                transaction.update(paysatMainAccountRef, {
                    customerMovements: updatedPaysatMovements
                });

                // Actualizar movimientos de cuenta usuario (agregar recibidos)
                transaction.update(userAccountRef, {
                    customerMovements: admin.firestore.FieldValue.arrayUnion(...userMovementsToAdd)
                });

                console.log(`[receivePendingPhoneNumberTransfer] Procesadas ${processedTransfers.length} transferencias en transacción`);
            });

            // 8. REGISTRAR EN LEDGER (fuera de la transacción)
            try {
                for (const transfer of processedTransfers) {
                    await recordLedgerEntry({
                        type: 'TRANSFER',
                        debit_account: PAYSAT_MAIN_ACCOUNT_UID,
                        credit_account: uid,
                        amount: transfer.amount,
                        currency: 'USD',
                        balance_after_debit: paysatMainBalance, // Balance no cambia, solo escrow
                        balance_after_credit: newUserBalance,
                        description: `Transferencia pendiente completada para ${userPhoneNumber}`,
                        meta: {
                            transaction_id: transfer.completedId,
                            origin_uid: transfer.originUID,
                            origin_affiliate: transfer.from,
                            destination_phone: userPhoneNumber,
                            type: 'pending_transfer_completion',
                            related_pending_id: transfer.pendingId
                        },
                        req
                    });
                }
            } catch (ledgerError) {
                console.error('Error registrando en ledger:', ledgerError);
                // No fallar el proceso por error en ledger, ya que la transacción atómica se completó
            }

            // 9. ACTUALIZAR FIRSTLOGIN A FALSE
            await userRef.update({ 
                firstLogin: false,
                firstLoginProcessedAt: admin.firestore.Timestamp.now()
            });

            console.log(`[receivePendingPhoneNumberTransfer] Proceso completado exitosamente`);

            // 10. RESPUESTA EXITOSA
            return res.status(200).json({
                ok: true,
                message: `${processedTransfers.length} transferencia(s) pendiente(s) procesada(s) exitosamente`,
                data: {
                    firstLogin: false,
                    transfersProcessed: processedTransfers.length,
                    totalReceived: totalToTransfer,
                    transfers: processedTransfers.map(t => ({
                        amount: t.amount,
                        from: t.from
                    }))
                }
            });

        } catch (error) {
            console.error('Error en receivePendingPhoneNumberTransfer:', error);
            
            // En caso de error, la transacción de Firestore ya hizo rollback automáticamente
            return res.status(500).json({
                ok: false,
                message: 'Error al procesar las transferencias pendientes',
                error: error.message,
                detail: 'El proceso se revertió automáticamente. Puedes intentar nuevamente.'
            });
        }
    }
}

export default LinkedUserPhoneNumbersTransferController;