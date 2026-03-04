import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

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
                phoneCountryISO2
            } = req.body;

            // Validar campos requeridos
            if (!destinationUserName || !destinationFullPhoneNumber || !destinationShortPhoneNumber || 
                !phoneCountryCode || !phoneCountryISO2) {
                return res.status(400).json({
                    ok: false,
                    message: 'Todos los campos son requeridos: destinationUserName, destinationFullPhoneNumber, destinationShortPhoneNumber, phoneCountryCode, phoneCountryISO2'
                });
            }

            // Referencia al documento del usuario
            const registeredPhoneNumbersRef = db.collection('PaySat_User_Registered_PhoneNumbers_Mobile').doc(uid);
            const registeredPhoneNumbersDoc = await registeredPhoneNumbersRef.get();

            // Verificar si ya existe un número duplicado
            if (registeredPhoneNumbersDoc.exists) {
                const userData = registeredPhoneNumbersDoc.data();
                const destinationPhoneNumbers = userData.destinationPhoneNumbers || [];

                // Verificar si ya existe un número con el mismo destinationFullPhoneNumber
                const duplicatePhoneNumber = destinationPhoneNumbers.find(phone => 
                    phone.destinationFullPhoneNumber === destinationFullPhoneNumber
                );

                if (duplicatePhoneNumber) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Este número telefónico ya está registrado'
                    });
                }
            }

            // Preparar el objeto del número telefónico a guardar
            const newPhoneNumber = {
                destinationUserName: destinationUserName.trim(),
                destinationFullPhoneNumber,
                destinationShortPhoneNumber,
                phoneCountryCode,
                phoneCountryISO2,
                registeredAt: new Date().toISOString()
            };

            const timestamp = admin.firestore.Timestamp.now();

            // Si el documento no existe, crearlo con estructura completa
            if (!registeredPhoneNumbersDoc.exists) {
                await registeredPhoneNumbersRef.set({
                    paysatUID: uid,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    destinationPhoneNumbers: [newPhoneNumber]
                });
            } else {
                // Si existe, agregar el nuevo número al array y actualizar updatedAt
                await registeredPhoneNumbersRef.update({
                    destinationPhoneNumbers: admin.firestore.FieldValue.arrayUnion(newPhoneNumber),
                    updatedAt: timestamp
                });
            }

            return res.status(200).json({
                ok: true,
                message: 'Número telefónico registrado exitosamente',
                data: newPhoneNumber
            });

        } catch (error) {
            console.error('Error al guardar número telefónico de destino:', error);
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
            // Permitir phoneNumberFull desde body o params
            const phoneNumberFull = req.body.phoneNumberFull || req.params.phoneNumberFull;

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
}

export default LinkedUserPhoneNumbersTransferController;