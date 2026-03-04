import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

class LinkedUserAccountTransferController {
    listUserOwnAccounts = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;

            // Buscar el documento del usuario en PaySat_User_Registered_Accounts
            const registeredAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const registeredAccountsDoc = await registeredAccountsRef.get();

            // Si no existe el documento, retornar array vacío
            if (!registeredAccountsDoc.exists) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay cuentas registradas'
                });
            }

            const registeredAccountsData = registeredAccountsDoc.data();
            const ownAccounts = registeredAccountsData.ownAccounts || [];

            // Ordenar alfabéticamente por affiliateName y luego por accountNumber (ascendente)
            const sortedAccounts = ownAccounts.sort((a, b) => {
                const nameA = (a.affiliateName || '').toLowerCase();
                const nameB = (b.affiliateName || '').toLowerCase();
                const accountA = (a.accountNumber || '').toLowerCase();
                const accountB = (b.accountNumber || '').toLowerCase();
                
                // Primero ordenar por affiliateName
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                
                // Si affiliateName es igual, ordenar por accountNumber
                return accountA.localeCompare(accountB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedAccounts
            });

        } catch (error) {
            console.error('Error al listar cuentas registradas:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener las cuentas registradas',
                error: error.message
            });
        }
    }

    listUserDestinationAccounts = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;

            // Buscar el documento del usuario en PaySat_User_Registered_Accounts
            const registeredAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const registeredAccountsDoc = await registeredAccountsRef.get();

            // Si no existe el documento, retornar array vacío
            if (!registeredAccountsDoc.exists) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay cuentas registradas'
                });
            }

            const registeredAccountsData = registeredAccountsDoc.data();
            const destinationAccounts = registeredAccountsData.destinationAccounts || [];
            
            // Ordenar alfabéticamente por affiliateName y luego por accountNumber (ascendente)
            const sortedAccounts = destinationAccounts.sort((a, b) => {
                const nameA = (a.affiliateName || '').toLowerCase();
                const nameB = (b.affiliateName || '').toLowerCase();
                const accountA = (a.accountNumber || '').toLowerCase();
                const accountB = (b.accountNumber || '').toLowerCase();
                
                // Primero ordenar por affiliateName
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                
                // Si affiliateName es igual, ordenar por accountNumber
                return accountA.localeCompare(accountB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedAccounts
            });

        } catch (error) {
            console.error('Error al listar cuentas registradas:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener las cuentas registradas',
                error: error.message
            });
        }
    }

    validateNewOwnAccount = async (req, res) => {
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
                countryId,
                countryName,
                affiliateId,
                affiliateName,
                documentTypeId,
                documentTypeName,
                documentNumber,
                accountTypeId,
                accountTypeName,
                accountNumber,
                beneficiaryName,
                phone
            } = req.body;

            console.log('Datos recibidos:', { countryId, countryName, affiliateId, affiliateName, documentTypeId, documentTypeName, documentNumber, accountTypeId, accountTypeName, accountNumber, beneficiaryName, phone });

            // Validar campos requeridos
            if (!countryId || !countryName || !affiliateId || !affiliateName || 
                !documentTypeId || !documentTypeName || !documentNumber || 
                !accountTypeId || !accountTypeName || !accountNumber || !beneficiaryName || !phone) {
                console.log('Campos faltantes:', { 
                    countryId: !!countryId, 
                    countryName: !!countryName, 
                    affiliateId: !!affiliateId, 
                    affiliateName: !!affiliateName, 
                    documentTypeId: !!documentTypeId, 
                    documentTypeName: !!documentTypeName, 
                    documentNumber: !!documentNumber, 
                    accountTypeId: !!accountTypeId, 
                    accountTypeName: !!accountTypeName, 
                    accountNumber: !!accountNumber, 
                    beneficiaryName: !!beneficiaryName, 
                    phone: !!phone 
                });
                return res.status(400).json({
                    ok: false,
                    message: 'Todos los campos son requeridos'
                });
            }

            // Validar que el país existe (buscar por campo uid)
            const countrySnapshot = await db.collection('PaySat_User_Accounts_Countries')
                .where('uid', '==', countryId)
                .limit(1)
                .get();
            
            console.log('País existe:', !countrySnapshot.empty);
            if (countrySnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El país seleccionado no existe'
                });
            }

            // Validar que el afiliado existe (buscar por campo uid)
            const affiliateSnapshot = await db.collection('PaySat_Transfer_Affiliates')
                .where('uid', '==', affiliateId)
                .limit(1)
                .get();
            
            console.log('Afiliado existe:', !affiliateSnapshot.empty);
            if (affiliateSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El afiliado seleccionado no existe'
                });
            }

            // Obtener los datos del afiliado
            const affiliateDoc = affiliateSnapshot.docs[0];
            const affiliateData = affiliateDoc.data();
            const affiliateCollectionName = affiliateDoc.id; // El ID del documento es el nombre de la colección del banco
            
            console.log('uidCountry del afiliado:', affiliateData.uidCountry, 'countryId enviado:', countryId);
            if (affiliateData.uidCountry !== countryId) {
                return res.status(400).json({
                    ok: false,
                    message: 'El afiliado no pertenece al país seleccionado'
                });
            }

            // Validar que el tipo de documento existe (buscar por campo uid)
            const documentTypeSnapshot = await db.collection('PaySat_User_Dni_Types')
                .where('uid', '==', documentTypeId)
                .limit(1)
                .get();
            
            console.log('Tipo de documento existe:', !documentTypeSnapshot.empty);
            if (documentTypeSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El tipo de documento seleccionado no existe'
                });
            }

            // Validar que el tipo de cuenta existe (buscar por campo uid)
            const accountTypeSnapshot = await db.collection('PaySat_User_Account_Types')
                .where('uid', '==', accountTypeId)
                .limit(1)
                .get();
            
            console.log('Tipo de cuenta existe:', !accountTypeSnapshot.empty);
            if (accountTypeSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El tipo de cuenta seleccionado no existe'
                });
            }

            // Validar que el número de cuenta existe en la colección del banco
            console.log('Validando número de cuenta en colección:', affiliateCollectionName);
            let bankAccountExists = false;
            try {
                const bankAccountSnapshot = await db.collection(affiliateCollectionName)
                    .where('customerAccountNumber', '==', accountNumber)
                    .limit(1)
                    .get();
                
                bankAccountExists = !bankAccountSnapshot.empty;
                console.log('Número de cuenta existe en el banco:', bankAccountExists);
            } catch (error) {
                console.error(`Error al validar cuenta en ${affiliateCollectionName}:`, error);
            }

            if (!bankAccountExists) {
                return res.status(400).json({
                    ok: false,
                    message: 'El número de cuenta no existe en el banco/cooperativa seleccionado'
                });
            }

            // Validar que no exista una cuenta duplicada para este usuario
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();
            console.log('Usuario tiene cuentas registradas:', userAccountsDoc.exists);

            if (userAccountsDoc.exists) {
                const userData = userAccountsDoc.data();
                const ownAccounts = userData.ownAccounts || [];
                console.log('Número de cuentas propias:', ownAccounts.length);

                // Verificar si ya existe una cuenta con el mismo número y afiliado
                const duplicateAccount = ownAccounts.find(account => 
                    account.accountNumber === accountNumber && account.affiliateId === affiliateId
                );

                console.log('Cuenta duplicada encontrada:', !!duplicateAccount);
                if (duplicateAccount) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Ya tienes registrada una cuenta con este número en el afiliado seleccionado'
                    });
                }
            }

            console.log('Todas las validaciones pasaron exitosamente');
            
            // Preparar el objeto de la cuenta a guardar
            const newAccount = {
                paysatUID: uid,
                accountUID: `${affiliateId}-${accountNumber}-${uid}`, // UID único para la cuenta combinando afiliado, número de cuenta y uid de usuario
                countryId,
                countryName,
                affiliateId,
                affiliateName,
                logo: affiliateData.logo || '',
                documentTypeId,
                documentTypeName,
                documentNumber,
                accountTypeId,
                accountTypeName,
                accountNumber,
                beneficiaryName: beneficiaryName.toUpperCase(), // Convertir el nombre del beneficiario a mayúsculas,
                phone,
                registeredAt: new Date().toISOString(),
                active: true
            };

            // Guardar la cuenta en PaySat_User_Registered_Accounts
            // const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            
            // Usar arrayUnion para agregar la cuenta al array ownAccounts
            await userAccountsRef.set({
                ownAccounts: admin.firestore.FieldValue.arrayUnion(newAccount)
            }, { merge: true });

            console.log('Cuenta guardada exitosamente');

            // Si todas las validaciones pasaron y se guardó la cuenta
            return res.status(200).json({
                ok: true,
                message: 'Cuenta registrada exitosamente',
                data: newAccount
            });

        } catch (error) {
            console.error('Error al validar la cuenta:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al validar los datos de la cuenta',
                error: error.message
            });
        }
    }

    validateNewDestinationAccount = async (req, res) => {
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
                countryId,
                countryName,
                affiliateId,
                affiliateName,
                documentTypeId,
                documentTypeName,
                documentNumber,
                accountTypeId,
                accountTypeName,
                accountNumber,
                beneficiaryName,
                phone
            } = req.body;

            console.log('Datos recibidos:', { countryId, countryName, affiliateId, affiliateName, documentTypeId, documentTypeName, documentNumber, accountTypeId, accountTypeName, accountNumber, beneficiaryName, phone });

            // Validar campos requeridos
            if (!countryId || !countryName || !affiliateId || !affiliateName || 
                !documentTypeId || !documentTypeName || !documentNumber || 
                !accountTypeId || !accountTypeName || !accountNumber || !beneficiaryName || !phone) {
                console.log('Campos faltantes:', { 
                    countryId: !!countryId, 
                    countryName: !!countryName, 
                    affiliateId: !!affiliateId, 
                    affiliateName: !!affiliateName, 
                    documentTypeId: !!documentTypeId, 
                    documentTypeName: !!documentTypeName, 
                    documentNumber: !!documentNumber, 
                    accountTypeId: !!accountTypeId, 
                    accountTypeName: !!accountTypeName, 
                    accountNumber: !!accountNumber, 
                    beneficiaryName: !!beneficiaryName, 
                    phone: !!phone 
                });
                return res.status(400).json({
                    ok: false,
                    message: 'Todos los campos son requeridos'
                });
            }

            // Validar que el país existe (buscar por campo uid)
            const countrySnapshot = await db.collection('PaySat_User_Accounts_Countries')
                .where('uid', '==', countryId)
                .limit(1)
                .get();
            
            console.log('País existe:', !countrySnapshot.empty);
            if (countrySnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El país seleccionado no existe'
                });
            }

            // Validar que el afiliado existe (buscar por campo uid)
            const affiliateSnapshot = await db.collection('PaySat_Transfer_Affiliates')
                .where('uid', '==', affiliateId)
                .limit(1)
                .get();
            
            console.log('Afiliado existe:', !affiliateSnapshot.empty);
            if (affiliateSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El afiliado seleccionado no existe'
                });
            }

            // Obtener los datos del afiliado
            const affiliateDoc = affiliateSnapshot.docs[0];
            const affiliateData = affiliateDoc.data();
            const affiliateCollectionName = affiliateDoc.id; // El ID del documento es el nombre de la colección del banco
            
            console.log('uidCountry del afiliado:', affiliateData.uidCountry, 'countryId enviado:', countryId);
            if (affiliateData.uidCountry !== countryId) {
                return res.status(400).json({
                    ok: false,
                    message: 'El afiliado no pertenece al país seleccionado'
                });
            }

            // Validar que el tipo de documento existe (buscar por campo uid)
            const documentTypeSnapshot = await db.collection('PaySat_User_Dni_Types')
                .where('uid', '==', documentTypeId)
                .limit(1)
                .get();
            
            console.log('Tipo de documento existe:', !documentTypeSnapshot.empty);
            if (documentTypeSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El tipo de documento seleccionado no existe'
                });
            }

            // Validar que el tipo de cuenta existe (buscar por campo uid)
            const accountTypeSnapshot = await db.collection('PaySat_User_Account_Types')
                .where('uid', '==', accountTypeId)
                .limit(1)
                .get();
            
            console.log('Tipo de cuenta existe:', !accountTypeSnapshot.empty);
            if (accountTypeSnapshot.empty) {
                return res.status(400).json({
                    ok: false,
                    message: 'El tipo de cuenta seleccionado no existe'
                });
            }

            // Validar que el número de cuenta existe en la colección del banco
            console.log('Validando número de cuenta en colección:', affiliateCollectionName);
            let bankAccountExists = false;
            try {
                const bankAccountSnapshot = await db.collection(affiliateCollectionName)
                    .where('customerAccountNumber', '==', accountNumber)
                    .limit(1)
                    .get();
                
                bankAccountExists = !bankAccountSnapshot.empty;
                console.log('Número de cuenta existe en el banco:', bankAccountExists);
            } catch (error) {
                console.error(`Error al validar cuenta en ${affiliateCollectionName}:`, error);
            }

            if (!bankAccountExists) {
                return res.status(400).json({
                    ok: false,
                    message: 'El número de cuenta no existe en el banco/cooperativa seleccionado'
                });
            }

            // Validar que no exista una cuenta duplicada para este usuario
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();
            console.log('Usuario tiene cuentas registradas:', userAccountsDoc.exists);

            if (userAccountsDoc.exists) {
                const userData = userAccountsDoc.data();
                const destinationAccounts = userData.destinationAccounts || [];
                console.log('Número de cuentas de destino:', destinationAccounts.length);

                // Verificar si ya existe una cuenta con el mismo número y afiliado
                const duplicateAccount = destinationAccounts.find(account => 
                    account.accountNumber === accountNumber && account.affiliateId === affiliateId
                );

                console.log('Cuenta duplicada encontrada:', !!duplicateAccount);
                if (duplicateAccount) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Ya tienes registrada una cuenta con este número en el afiliado seleccionado'
                    });
                }
            }

            console.log('Todas las validaciones pasaron exitosamente');
            
            // Preparar el objeto de la cuenta a guardar
            const newAccount = {
                paysatUID: uid,
                accountUID: `${affiliateId}-${accountNumber}-${uid}`, // UID único para la cuenta combinando afiliado, número de cuenta y uid de usuario
                countryId,
                countryName,
                affiliateId,
                affiliateName,
                logo: affiliateData.logo || '',
                documentTypeId,
                documentTypeName,
                documentNumber,
                accountTypeId,
                accountTypeName,
                accountNumber,
                beneficiaryName: beneficiaryName.toUpperCase(), // Convertir el nombre del beneficiario a mayúsculas
                phone,
                registeredAt: new Date().toISOString(),
                active: true
            };

            // Guardar la cuenta en PaySat_User_Registered_Accounts
            // const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            
            // Usar arrayUnion para agregar la cuenta al array destinationAccounts
            await userAccountsRef.set({
                destinationAccounts: admin.firestore.FieldValue.arrayUnion(newAccount)
            }, { merge: true });

            console.log('Cuenta guardada exitosamente');

            // Si todas las validaciones pasaron y se guardó la cuenta
            return res.status(200).json({
                ok: true,
                message: 'Cuenta registrada exitosamente',
                data: newAccount
            });

        } catch (error) {
            console.error('Error al validar la cuenta:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al validar los datos de la cuenta',
                error: error.message
            });
        }
    }

    listAccountCountry = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener todos los países de la colección PaySat_User_Accounts_Countries
            const countriesRef = db.collection('PaySat_User_Accounts_Countries');
            const countriesSnapshot = await countriesRef.get();

            // Si no hay países registrados
            if (countriesSnapshot.empty) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay países registrados'
                });
            }

            // Mapear los documentos a un array de países
            const countries = [];
            countriesSnapshot.forEach(doc => {
                countries.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });

            // Ordenar alfabéticamente por nombre de país (ascendente)
            const sortedCountries = countries.sort((a, b) => {
                const nameA = (a.country || '').toLowerCase();
                const nameB = (b.country || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedCountries
            });

        } catch (error) {
            console.error('Error al listar países:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los países',
                error: error.message
            });
        }
    }

    listAffiliates = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener el país desde query parameters
            const { country } = req.query;

            if (!country) {
                return res.status(400).json({
                    ok: false,
                    message: 'El parámetro country es requerido'
                });
            }

            // Filtrar afiliados por uidCountry
            const affiliatesRef = db.collection('PaySat_Transfer_Affiliates');
            const affiliatesSnapshot = await affiliatesRef
                .where('uidCountry', '==', country)
                .get();

            // Si no hay afiliados para ese país
            if (affiliatesSnapshot.empty) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay afiliados registrados para este país'
                });
            }

            // Mapear los documentos a un array de afiliados
            const affiliates = [];
            affiliatesSnapshot.forEach(doc => {
                affiliates.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });

            // Ordenar alfabéticamente por affiliateName (ascendente)
            const sortedAffiliates = affiliates.sort((a, b) => {
                const nameA = (a.affiliateName || '').toLowerCase();
                const nameB = (b.affiliateName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedAffiliates
            });

        } catch (error) {
            console.error('Error al listar afiliados:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los afiliados',
                error: error.message
            });
        }
    }

    listDocumentTypes = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener todos los tipos de documentos de la colección PaySat_User_Dni_Types
            const documentTypesRef = db.collection('PaySat_User_Dni_Types');
            const documentTypesSnapshot = await documentTypesRef.get();

            // Si no hay tipos de documentos registrados
            if (documentTypesSnapshot.empty) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay tipos de documentos registrados'
                });
            }

            // Mapear los documentos a un array de tipos de documentos
            const documentTypes = [];
            documentTypesSnapshot.forEach(doc => {
                documentTypes.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });

            // Ordenar alfabéticamente por dniTypeName (ascendente)
            const sortedDocumentTypes = documentTypes.sort((a, b) => {
                const nameA = (a.dniTypeName || '').toLowerCase();
                const nameB = (b.dniTypeName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedDocumentTypes
            });

        } catch (error) {
            console.error('Error al listar tipos de documentos:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los tipos de documentos',
                error: error.message
            });
        }
    }

    listAccountTypes = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener todos los tipos de cuenta de la colección PaySat_User_Account_Types
            const accountTypesRef = db.collection('PaySat_User_Account_Types');
            const accountTypesSnapshot = await accountTypesRef.get();

            // Si no hay tipos de cuenta registrados
            if (accountTypesSnapshot.empty) {
                return res.status(200).json({
                    ok: true,
                    data: [],
                    message: 'No hay tipos de cuenta registrados'
                });
            }

            // Mapear los documentos a un array de tipos de cuenta
            const accountTypes = [];
            accountTypesSnapshot.forEach(doc => {
                accountTypes.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });

            // Ordenar alfabéticamente por accountTypeName (ascendente)
            const sortedAccountTypes = accountTypes.sort((a, b) => {
                const nameA = (a.accountTypeName || '').toLowerCase();
                const nameB = (b.accountTypeName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            return res.status(200).json({
                ok: true,
                data: sortedAccountTypes
            });

        } catch (error) {
            console.error('Error al listar tipos de cuenta:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al obtener los tipos de cuenta',
                error: error.message
            });
        }
    }

    deleteOwnAccount = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const { accountUID } = req.params;

            // Validar que se envíe el accountUID
            if (!accountUID) {
                return res.status(400).json({
                    ok: false,
                    message: 'El accountUID es requerido'
                });
            }

            // Buscar el documento del usuario
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();

            // Si no existe el documento
            if (!userAccountsDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron cuentas registradas'
                });
            }

            const userData = userAccountsDoc.data();
            const ownAccounts = userData.ownAccounts || [];

            // Buscar la cuenta a eliminar
            const accountToDelete = ownAccounts.find(account => account.accountUID === accountUID);

            if (!accountToDelete) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta no encontrada'
                });
            }

            // Bloquear eliminación de cuentas de PAYSAT MONEY LTD
            if (accountToDelete.affiliateName && accountToDelete.affiliateName.toUpperCase() === 'PAYSAT MONEY LTD') {
                return res.status(403).json({
                    ok: false,
                    message: 'No se puede eliminar cuentas de PAYSAT MONEY LTD'
                });
            }

            // Filtrar el array para eliminar la cuenta
            const updatedOwnAccounts = ownAccounts.filter(account => account.accountUID !== accountUID);

            // Actualizar el documento
            await userAccountsRef.update({
                ownAccounts: updatedOwnAccounts
            });

            return res.status(200).json({
                ok: true,
                message: 'Cuenta eliminada exitosamente'
            });

        } catch (error) {
            console.error('Error al eliminar cuenta propia:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al eliminar la cuenta',
                error: error.message
            });
        }
    }
    
    deleteDestinationAccount = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const { accountUID } = req.params;

            // Validar que se envíe el accountUID
            if (!accountUID) {
                return res.status(400).json({
                    ok: false,
                    message: 'El accountUID es requerido'
                });
            }

            // Buscar el documento del usuario
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();

            // Si no existe el documento
            if (!userAccountsDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron cuentas registradas'
                });
            }

            const userData = userAccountsDoc.data();
            const destinationAccounts = userData.destinationAccounts || [];

            // Buscar la cuenta a eliminar
            const accountToDelete = destinationAccounts.find(account => account.accountUID === accountUID);

            if (!accountToDelete) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta no encontrada'
                });
            }

            // Filtrar el array para eliminar la cuenta
            const updatedDestinationAccounts = destinationAccounts.filter(account => account.accountUID !== accountUID);

            // Actualizar el documento
            await userAccountsRef.update({
                destinationAccounts: updatedDestinationAccounts
            });

            return res.status(200).json({
                ok: true,
                message: 'Cuenta eliminada exitosamente'
            });

        } catch (error) {
            console.error('Error al eliminar cuenta de destino:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al eliminar la cuenta',
                error: error.message
            });
        }
    }

    determinateTransferFee = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const { originUID, destinationUID, amount } = req.body;

            // Validar campos requeridos
            if (!originUID || !destinationUID || !amount) {
                return res.status(400).json({
                    ok: false,
                    message: 'Los campos originUID, destinationUID y amount son requeridos'
                });
            }

            // Validar que el monto sea mayor a 0
            if (amount <= 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto debe ser mayor a 0'
                });
            }

            // Buscar cuenta origen en las cuentas del usuario autenticado
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();

            if (!userAccountsDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron cuentas registradas para el usuario'
                });
            }

            const userData = userAccountsDoc.data();
            const ownAccounts = userData.ownAccounts || [];
            const destinationAccounts = userData.destinationAccounts || [];

            // Buscar cuenta origen en ownAccounts del usuario autenticado
            const originAccount = ownAccounts.find(account => account.accountUID === originUID);

            if (!originAccount) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta origen no encontrada en tus cuentas propias'
                });
            }

            // Buscar cuenta destino primero en las cuentas del usuario autenticado
            let destinationAccount = ownAccounts.find(account => account.accountUID === destinationUID);
            
            // Si no está en ownAccounts, buscar en destinationAccounts
            if (!destinationAccount) {
                destinationAccount = destinationAccounts.find(account => account.accountUID === destinationUID);
            }

            // Si no está en las cuentas del usuario, buscar en otros usuarios
            if (!destinationAccount) {
                // Buscar en todos los documentos de PaySat_User_Registered_Accounts
                const allUsersSnapshot = await db.collection('PaySat_User_Registered_Accounts').get();
                
                for (const doc of allUsersSnapshot.docs) {
                    if (doc.id === uid) continue; // Saltar el usuario actual ya que ya lo buscamos
                    
                    const otherUserData = doc.data();
                    const otherUserOwnAccounts = otherUserData.ownAccounts || [];
                    
                    destinationAccount = otherUserOwnAccounts.find(account => account.accountUID === destinationUID);
                    
                    if (destinationAccount) {
                        break;
                    }
                }
            }

            if (!destinationAccount) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta destino no encontrada'
                });
            }

            // Validar que no sean el mismo número de cuenta
            if (originAccount.accountNumber === destinationAccount.accountNumber) {
                return res.status(400).json({
                    ok: false,
                    message: 'No puedes transferir a la misma cuenta'
                });
            }

            // Determinar el tipo de transferencia
            const isOriginPaySat = originAccount.affiliateName && originAccount.affiliateName.toUpperCase() === 'PAYSAT MONEY LTD';
            const isDestinationPaySat = destinationAccount.affiliateName && destinationAccount.affiliateName.toUpperCase() === 'PAYSAT MONEY LTD';

            let transferType;
            let transferTypeDoc;

            if (isOriginPaySat && isDestinationPaySat) {
                // Ambas cuentas son PAYSAT MONEY LTD
                // Verificar si es Tipo 1: Entre mis cuentas PAYSAT
                const isSameAffiliate = originAccount.affiliateName === destinationAccount.affiliateName;
                const isSameBeneficiary = originAccount.beneficiaryName === destinationAccount.beneficiaryName;
                const isSameCountryId = originAccount.countryId === destinationAccount.countryId;
                const isSameCountryName = originAccount.countryName === destinationAccount.countryName;
                const isSameDocument = originAccount.documentNumber === destinationAccount.documentNumber;
                const isSamePaySatUID = originAccount.paysatUID === destinationAccount.paysatUID;
                const isSamePhone = originAccount.phone === destinationAccount.phone;

                if (isSameAffiliate && isSameBeneficiary && isSameCountryId && 
                    isSameCountryName && isSameDocument && isSamePaySatUID && isSamePhone) {
                    // Tipo 1: Entre mis cuentas PAYSAT
                    transferType = 'Entre mis cuentas PAYSAT';
                    transferTypeDoc = 'Between_My_PaySat_Accounts';
                } else {
                    // Verificar si es Tipo 2: Entre cuentas PAYSAT de terceros
                    const isSameAffiliateIdForType2 = originAccount.affiliateId === destinationAccount.affiliateId;
                    const isSameCountryIdForType2 = originAccount.countryId === destinationAccount.countryId;
                    const isSameCountryNameForType2 = originAccount.countryName === destinationAccount.countryName;

                    if (isSameAffiliate && isSameAffiliateIdForType2 && 
                        isSameCountryIdForType2 && isSameCountryNameForType2) {
                        // Tipo 2: Entre cuentas PAYSAT de terceros
                        transferType = 'Entre cuentas PAYSAT';
                        transferTypeDoc = 'Between_Own_And_Other_PaySat_Account';
                    } else {
                        return res.status(400).json({
                            ok: false,
                            message: 'No se puede realizar esta transferencia entre cuentas PAYSAT con diferentes configuraciones'
                        });
                    }
                }
            } else if (isOriginPaySat && !isDestinationPaySat) {
                // Tipo 3: PAYSAT a cuenta externa
                transferType = 'Institucionales';
                transferTypeDoc = 'Between_Own_PaySat_And_External_Account';
            } else if (!isOriginPaySat && !isDestinationPaySat) {
                // Tipo 4: Entre cuentas externas
                transferType = 'Interinstitucionales';
                transferTypeDoc = 'Between_External_Accounts';
            } else if (!isOriginPaySat && isDestinationPaySat) {
                // Cuenta externa a cuenta PAYSAT (permitido si está en ownAccounts)
                transferType = 'Institucionales';
                transferTypeDoc = 'Between_Own_PaySat_And_External_Account';
            }

            // Obtener el fee de la colección PaySat_Table_Transfers_Fees
            const feeDocRef = db.collection('PaySat_Table_Transfers_Fees').doc(transferTypeDoc);
            const feeDoc = await feeDocRef.get();

            if (!feeDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la configuración de comisiones para este tipo de transferencia'
                });
            }

            const feeData = feeDoc.data();
            const transferFeePercentage = feeData.transferFeePercentage || 0;

            // Calcular el valor de la comisión y el total
            const feeValue = parseFloat(((amount * transferFeePercentage) / 100).toFixed(2));
            const total = parseFloat((amount + feeValue).toFixed(2));

            // Retornar los datos
            return res.status(200).json({
                ok: true,
                data: {
                    originUID,
                    destinationUID,
                    amount: parseFloat(amount),
                    transferType,
                    feePercentage: transferFeePercentage,
                    feeValue,
                    total
                }
            });

        } catch (error) {
            console.error('Error al determinar la comisión de transferencia:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al determinar la comisión de transferencia',
                error: error.message
            });
        }
    }

    // transferBetweenAccounts = async (req, res) => {
    //     try {
    //         // Validar que el usuario esté autenticado
    //         if (!req.user || !req.user.uid) {
    //             return res.status(401).json({
    //                 ok: false,
    //                 message: 'Usuario no autenticado'
    //             });
    //         }

    //         const uid = req.user.uid;
    //         const { originUID, destinationUID, amount, reason } = req.body;

    //         console.log('=== DATOS RECIBIDOS PARA TRANSFERENCIA ===');
    //         console.log('Usuario autenticado (uid):', uid);
    //         console.log('Origin UID:', originUID);
    //         console.log('Destination UID:', destinationUID);
    //         console.log('Amount:', amount);
    //         console.log('Reason:', reason);
    //         console.log('Tipo de amount:', typeof amount);
    //         console.log('Body completo:', JSON.stringify(req.body, null, 2));
    //         console.log('==========================================');

    //         // Validar campos requeridos
    //         if (!originUID || !destinationUID || !amount || !reason) {
    //             return res.status(400).json({
    //                 ok: false,
    //                 message: 'Los campos originUID, destinationUID, amount y reason son requeridos'
    //             });
    //         }

    //         // Validar que el monto sea mayor a 0
    //         if (amount <= 0) {
    //             return res.status(400).json({
    //                 ok: false,
    //                 message: 'El monto debe ser mayor a 0'
    //             });
    //         }

    //         return res.status(200).json({
    //             ok: true,
    //             message: 'Datos recibidos correctamente (funcionalidad en desarrollo)',
    //             data: {
    //                 uid,
    //                 originUID,
    //                 destinationUID,
    //                 amount,
    //                 reason
    //             }
    //         });

    //     } catch (error) {
    //         console.error('Error al procesar transferencia:', error);
    //         return res.status(500).json({
    //             ok: false,
    //             message: 'Error al procesar la transferencia',
    //             error: error.message
    //         });
    //     }
    // }

    transferBetweenAccounts = async (req, res) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user || !req.user.uid) {
                return res.status(401).json({
                    ok: false,
                    message: 'Usuario no autenticado'
                });
            }

            const uid = req.user.uid;
            const { originUID, destinationUID, amount, reason } = req.body;

            console.log('=== INICIANDO TRANSFERENCIA ===');
            console.log('Usuario:', uid);
            console.log('Origen:', originUID);
            console.log('Destino:', destinationUID);
            console.log('Monto:', amount);
            console.log('Razón:', reason);

            // Validar campos requeridos
            if (!originUID || !destinationUID || !amount || !reason) {
                return res.status(400).json({
                    ok: false,
                    message: 'Los campos originUID, destinationUID, amount y reason son requeridos'
                });
            }

            // Validar que el monto sea mayor a 0
            if (amount <= 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'El monto debe ser mayor a 0'
                });
            }

            // Generar transactionUID único para esta transferencia
            const transactionUID = uuidv4();
            console.log('Transaction UID generado:', transactionUID);

            // Buscar cuentas registradas del usuario autenticado
            const userAccountsRef = db.collection('PaySat_User_Registered_Accounts').doc(uid);
            const userAccountsDoc = await userAccountsRef.get();

            if (!userAccountsDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron cuentas registradas para el usuario'
                });
            }

            const userData = userAccountsDoc.data();
            const ownAccounts = userData.ownAccounts || [];
            const destinationAccounts = userData.destinationAccounts || [];

            // Buscar cuenta origen en ownAccounts
            const originAccountData = ownAccounts.find(account => account.accountUID === originUID);

            if (!originAccountData) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta origen no encontrada en tus cuentas propias'
                });
            }

            console.log('Cuenta origen encontrada:', originAccountData.accountNumber);

            // Buscar cuenta destino en ownAccounts o destinationAccounts del usuario autenticado
            let destinationAccountData = ownAccounts.find(account => account.accountUID === destinationUID);
            let isDestinationOwnAccount = !!destinationAccountData;
            
            if (!destinationAccountData) {
                destinationAccountData = destinationAccounts.find(account => account.accountUID === destinationUID);
            }

            // Si no está en las cuentas del usuario, buscar en otros usuarios
            let destinationUserUID = uid;
            if (!destinationAccountData) {
                const allUsersSnapshot = await db.collection('PaySat_User_Registered_Accounts').get();
                
                for (const doc of allUsersSnapshot.docs) {
                    if (doc.id === uid) continue;
                    
                    const otherUserData = doc.data();
                    const otherUserOwnAccounts = otherUserData.ownAccounts || [];
                    
                    destinationAccountData = otherUserOwnAccounts.find(account => account.accountUID === destinationUID);
                    
                    if (destinationAccountData) {
                        destinationUserUID = doc.id;
                        break;
                    }
                }
            } else if (isDestinationOwnAccount) {
                destinationUserUID = uid;
            }

            if (!destinationAccountData) {
                return res.status(404).json({
                    ok: false,
                    message: 'Cuenta destino no encontrada'
                });
            }

            console.log('Cuenta destino encontrada:', destinationAccountData.accountNumber);

            // Validar que no sean el mismo número de cuenta
            if (originAccountData.accountNumber === destinationAccountData.accountNumber && 
                originAccountData.affiliateId === destinationAccountData.affiliateId) {
                return res.status(400).json({
                    ok: false,
                    message: 'No puedes transferir a la misma cuenta'
                });
            }

            // Determinar el tipo de transferencia y calcular comisión
            const isOriginPaySat = originAccountData.affiliateName && originAccountData.affiliateName.toUpperCase() === 'PAYSAT MONEY LTD';
            const isDestinationPaySat = destinationAccountData.affiliateName && destinationAccountData.affiliateName.toUpperCase() === 'PAYSAT MONEY LTD';

            let transferType;
            let transferTypeDoc;

            if (isOriginPaySat && isDestinationPaySat) {
                // Verificar si son del mismo propietario y cumplen todos los criterios
                const isSameOwner = (
                    originAccountData.paysatUID === destinationAccountData.paysatUID &&
                    originAccountData.beneficiaryName === destinationAccountData.beneficiaryName &&
                    originAccountData.countryId === destinationAccountData.countryId &&
                    originAccountData.countryName === destinationAccountData.countryName &&
                    originAccountData.documentNumber === destinationAccountData.documentNumber &&
                    originAccountData.phone === destinationAccountData.phone
                );

                if (isSameOwner) {
                    // Tipo 1: Entre mis cuentas PAYSAT
                    transferType = 'Entre mis cuentas PAYSAT';
                    transferTypeDoc = 'Between_My_PaySat_Accounts';
                } else {
                    // Tipo 2: Entre cuenta PAYSAT propia y cuenta PAYSAT de terceros
                    transferType = 'Entre cuentas PAYSAT';
                    transferTypeDoc = 'Between_Own_And_Other_PaySat_Account';
                }
            } else if (isOriginPaySat && !isDestinationPaySat) {
                // Tipo 3: Cuenta PAYSAT a cuenta externa
                transferType = 'Institucionales';
                transferTypeDoc = 'Between_Own_PaySat_And_External_Account';
            } else if (!isOriginPaySat && !isDestinationPaySat) {
                // Tipo 4: Entre cuentas externas
                transferType = 'Interinstitucionales';
                transferTypeDoc = 'Between_External_Accounts';
            } else if (!isOriginPaySat && isDestinationPaySat) {
                // Tipo 5: Cuenta externa a cuenta PAYSAT
                transferType = 'Institucionales';
                transferTypeDoc = 'Between_Own_PaySat_And_External_Account';
            }

            console.log('Tipo de transferencia:', transferType);
            console.log('Documento de fee:', transferTypeDoc);

            // Obtener el fee de la colección PaySat_Table_Transfers_Fees
            const feeDocRef = db.collection('PaySat_Table_Transfers_Fees').doc(transferTypeDoc);
            const feeDoc = await feeDocRef.get();

            if (!feeDoc.exists) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la configuración de comisiones para este tipo de transferencia'
                });
            }

            const feeData = feeDoc.data();
            const transferFeePercentage = feeData.transferFeePercentage || 0;

            // Calcular fee y total
            const feeValue = parseFloat(((amount * transferFeePercentage) / 100).toFixed(2));
            const total = parseFloat((amount + feeValue).toFixed(2));

            console.log('Fee percentage:', transferFeePercentage);
            console.log('Fee value:', feeValue);
            console.log('Total:', total);

            // Retornar información de la transferencia con fee calculado
            const responseData = {
                originUID,
                destinationUID,
                amount: parseFloat(amount),
                transferType,
                feePercentage: transferFeePercentage,
                feeValue,
                total
            };

            console.log('Datos de respuesta preparados:', responseData);

            // Aquí comienza la ejecución de la transferencia
            console.log('=== EJECUTANDO TRANSFERENCIA ===');

            // ===============================================
            // CASO ESPECIAL: Transferencias Interinstitucionales (Cuenta externa a Cuenta externa)
            // ===============================================
            // Para este tipo de transferencia, se requiere un flujo de dos pasos:
            // 1. Cuenta externa origen → Cuenta PAYSAT principal del usuario
            // 2. Cuenta PAYSAT principal → Cuenta externa destino (con fee)
            
            let isInterinstitutional = false;
            let userMainAccountDoc = null;
            let userMainAccountData = null;
            
            if (!isOriginPaySat && !isDestinationPaySat) {
                isInterinstitutional = true;
                console.log('🔄 TRANSFERENCIA INTERINSTITUCIONAL DETECTADA - Iniciando flujo de dos pasos');
                
                // Buscar la cuenta principal PAYSAT del usuario (mainAccount=true)
                const mainAccountQuery = db.collection('Banco_PaySat_Money')
                    .where('customerAccountUID', '==', uid)
                    .where('mainAccount', '==', true)
                    .limit(1);
                
                const mainAccountSnapshot = await mainAccountQuery.get();
                
                if (mainAccountSnapshot.empty) {
                    return res.status(404).json({
                        ok: false,
                        message: 'No se encontró la cuenta principal PAYSAT del usuario. Se requiere una cuenta principal para transferencias interinstitucionales.'
                    });
                }
                
                userMainAccountDoc = mainAccountSnapshot.docs[0];
                userMainAccountData = userMainAccountDoc.data();
                
                console.log('✓ Cuenta PAYSAT principal del usuario encontrada:', userMainAccountData.customerAccountNumber);
                console.log('Balance actual cuenta principal:', userMainAccountData.customerBalance);
            }

            // Obtener la colección origen basada en el affiliateId
            let originCollectionName;
            if (isOriginPaySat) {
                originCollectionName = 'Banco_PaySat_Money';
            } else {
                // Buscar el nombre de la colección en PaySat_Transfer_Affiliates
                const affiliateSnapshot = await db.collection('PaySat_Transfer_Affiliates')
                    .where('uid', '==', originAccountData.affiliateId)
                    .limit(1)
                    .get();

                if (affiliateSnapshot.empty) {
                    return res.status(404).json({
                        ok: false,
                        message: 'No se encontró la configuración del afiliado de origen'
                    });
                }

                originCollectionName = affiliateSnapshot.docs[0].id;
            }

            console.log('Colección de origen:', originCollectionName);

            // Obtener la colección destino basada en el affiliateId
            let destinationCollectionName;
            if (isDestinationPaySat) {
                destinationCollectionName = 'Banco_PaySat_Money';
            } else {
                // Buscar el nombre de la colección en PaySat_Transfer_Affiliates
                const affiliateSnapshot = await db.collection('PaySat_Transfer_Affiliates')
                    .where('uid', '==', destinationAccountData.affiliateId)
                    .limit(1)
                    .get();

                if (affiliateSnapshot.empty) {
                    return res.status(404).json({
                        ok: false,
                        message: 'No se encontró la configuración del afiliado de destino'
                    });
                }

                destinationCollectionName = affiliateSnapshot.docs[0].id;
            }

            console.log('Colección de destino:', destinationCollectionName);

            // Buscar la cuenta origen en su colección bancaria
            let originBankAccountQuery = db.collection(originCollectionName)
                .where('customerAccountNumber', '==', originAccountData.accountNumber)
                .where('customerID', '==', originAccountData.documentNumber)
                .where('customerPhone', '==', originAccountData.phone)
                // .where('active', '==', true)
                .limit(1);

            // Si es PaySat, agregar validación de customerAccountUID
            if (isOriginPaySat) {
                originBankAccountQuery = originBankAccountQuery.where('customerAccountUID', '==', uid);
            }

            const originBankAccountSnapshot = await originBankAccountQuery.get();

            if (originBankAccountSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la cuenta origen en el banco'
                });
            }

            const originBankAccountDoc = originBankAccountSnapshot.docs[0];
            const originBankAccountData = originBankAccountDoc.data();

            console.log('Cuenta bancaria de origen encontrada:', originBankAccountDoc.id);
            console.log('Balance actual origen:', originBankAccountData.customerBalance);

            // Validar que haya suficiente balance 
            // Para interinstitucionales: solo validar el amount (el fee se cobra al transferir de PaySat principal a destino)
            // Para otros tipos: validar amount + fee (como antes)
            const requiredOriginBalance = isInterinstitutional ? amount : total;
            
            if (originBankAccountData.customerBalance < requiredOriginBalance) {
                return res.status(400).json({
                    ok: false,
                    message: `Balance insuficiente. Balance actual: $${originBankAccountData.customerBalance.toFixed(2)}, Se requiere: $${requiredOriginBalance.toFixed(2)}`
                });
            }

            // Buscar la cuenta destino en su colección bancaria
            let destinationBankAccountQuery = db.collection(destinationCollectionName)
                .where('customerAccountNumber', '==', destinationAccountData.accountNumber)
                .where('customerID', '==', destinationAccountData.documentNumber)
                .where('customerPhone', '==', destinationAccountData.phone)
                // .where('active', '==', true)
                .limit(1);

            // Si es PaySat, agregar validación de customerAccountUID
            if (isDestinationPaySat) {
                destinationBankAccountQuery = destinationBankAccountQuery.where('customerAccountUID', '==', destinationUserUID);
            }

            const destinationBankAccountSnapshot = await destinationBankAccountQuery.get();

            if (destinationBankAccountSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontró la cuenta destino en el banco'
                });
            }

            const destinationBankAccountDoc = destinationBankAccountSnapshot.docs[0];
            const destinationBankAccountData = destinationBankAccountDoc.data();

            console.log('Cuenta bancaria de destino encontrada:', destinationBankAccountDoc.id);
            console.log('Balance actual destino:', destinationBankAccountData.customerBalance);

            // Preparar fecha y hora
            const now = new Date();
            const createdAt = now.toISOString();
            const updatedAt = now.toISOString();
            const registeredAt = now.toISOString();

            // ===============================================
            // Calcular nuevos balances y preparar movimientos
            // ===============================================
            
            // Variables para transferencias normales
            let newOriginBalance, newOriginTotal, newDestinationBalance, newDestinationTotal;
            let originMovements = [];
            let destinationMovements = [];
            
            // Variables específicas para transferencias interinstitucionales
            let newMainPaySatBalance, newMainPaySatTotal;
            let mainPaySatMovements = [];
            
            if (isInterinstitutional) {
                // ============================================
                // FLUJO INTERINSTITUCIONAL (DOS PASOS)
                // ============================================
                console.log('💱 Preparando transferencia interinstitucional en dos pasos...');
                
                // PASO 1: Origen externo → Cuenta PAYSAT principal del usuario
                // El origen envía el monto completo (sin fee en este paso)
                newOriginBalance = parseFloat((originBankAccountData.customerBalance - amount).toFixed(2));
                newOriginTotal = parseFloat((newOriginBalance + (originBankAccountData.customerEscrow || 0)).toFixed(2));
                
                // La cuenta principal PAYSAT recibe el monto
                newMainPaySatBalance = parseFloat((userMainAccountData.customerBalance + amount).toFixed(2));
                
                // PASO 2: Cuenta PAYSAT principal → Destino externo (con fee)
                // La cuenta principal PAYSAT envía amount + fee
                newMainPaySatBalance = parseFloat((newMainPaySatBalance - total).toFixed(2));
                newMainPaySatTotal = parseFloat((newMainPaySatBalance + (userMainAccountData.customerEscrow || 0)).toFixed(2));
                
                // El destino recibe solo el amount (sin fee)
                newDestinationBalance = parseFloat((destinationBankAccountData.customerBalance + amount).toFixed(2));
                newDestinationTotal = parseFloat((newDestinationBalance + (destinationBankAccountData.customerEscrow || 0)).toFixed(2));
                
                // Validar que la cuenta principal tenga suficiente balance para el segundo paso
                const mainAccountRequiredBalance = userMainAccountData.customerBalance + amount;
                if (mainAccountRequiredBalance < total) {
                    return res.status(400).json({
                        ok: false,
                        message: `La cuenta principal PAYSAT no tendrá suficiente balance para completar la transferencia. Se requiere: $${total.toFixed(2)}, Disponible después del primer paso: $${mainAccountRequiredBalance.toFixed(2)}`
                    });
                }
                
                console.log('✓ Balances calculados para flujo interinstitucional');
                console.log('  - Origen externo (nuevo balance):', newOriginBalance);
                console.log('  - PaySat principal (nuevo balance):', newMainPaySatBalance);
                console.log('  - Destino externo (nuevo balance):', newDestinationBalance);
                
                // Movimientos para cuenta origen (envío a PaySat principal)
                const originMovement = {
                    PAYSATAccountNumber: originAccountData.accountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}_step1`,
                    description: `send_transfer_to_paysat_${transactionUID}`,
                    paysatUID: uid,
                    updatedAt,
                    userName: originAccountData.beneficiaryName,
                    originUID,
                    destinationUID: userMainAccountData.customerAccountUID,
                    typeMovement: "transfer_sent",
                    status: "success",
                    transferStep: "step1_to_paysat",
                    reason: reason
                };
                originMovements.push(originMovement);
                
                // Movimientos para cuenta PAYSAT principal (recepción desde origen)
                const mainReceiveMovement = {
                    PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}_step1_receive`,
                    description: `received_transfer_from_external_${transactionUID}`,
                    paysatUID: uid,
                    updatedAt,
                    userName: userMainAccountData.customerName,
                    originUID,
                    destinationUID: userMainAccountData.customerAccountUID,
                    typeMovement: "transfer_received",
                    status: "success",
                    transferStep: "step1_from_external",
                    reason: reason
                };
                mainPaySatMovements.push(mainReceiveMovement);
                
                // Movimientos para cuenta PAYSAT principal (envío a destino con fee)
                const mainSendMovement = {
                    PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}_step2`,
                    description: `send_transfer_to_destination_${transactionUID}`,
                    paysatUID: uid,
                    updatedAt,
                    userName: userMainAccountData.customerName,
                    originUID: userMainAccountData.customerAccountUID,
                    destinationUID,
                    typeMovement: "transfer_sent",
                    status: "success",
                    feePercentage: transferFeePercentage,
                    fee: feeValue,
                    total: total,
                    transferStep: "step2_to_external",
                    reason: reason
                };
                mainPaySatMovements.push(mainSendMovement);
                
                // Si hay fee, agregar movimiento de fee en cuenta principal
                if (feeValue > 0) {
                    const feeMovement = {
                        PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                        amount: feeValue,
                        amount_cents: Math.round(feeValue * 100),
                        balanceTransactionId: `txn_${transactionUID}`,
                        createdAt,
                        currency: "usd",
                        id: `fee_transfer_${transactionUID}`,
                        paysatFee: feeValue,
                        paysatUID: uid,
                        source: "paysat_transfer_interinstitutional",
                        feePercentage: transferFeePercentage,
                        totalFee: feeValue,
                        totalFee_cents: Math.round(feeValue * 100),
                        typeMovement: "fee",
                        updatedAt
                    };
                    mainPaySatMovements.push(feeMovement);
                }
                
                // Movimientos para cuenta destino (recepción desde PaySat principal)
                const destinationMovement = {
                    PAYSATAccountNumber: destinationAccountData.accountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}_step2_receive`,
                    description: `received_transfer_from_paysat_${transactionUID}`,
                    paysatUID: destinationUserUID,
                    updatedAt,
                    userName: destinationAccountData.beneficiaryName,
                    originUID: userMainAccountData.customerAccountUID,
                    destinationUID,
                    typeMovement: "transfer_received",
                    status: "success",
                    transferStep: "step2_from_paysat",
                    reason: reason
                };
                destinationMovements.push(destinationMovement);
                
            } else {
                // ============================================
                // FLUJO NORMAL (TRANSFERENCIA DIRECTA)
                // ============================================
                console.log('💸 Preparando transferencia directa...');
                
                newOriginBalance = parseFloat((originBankAccountData.customerBalance - total).toFixed(2));
                newOriginTotal = parseFloat((newOriginBalance + (originBankAccountData.customerEscrow || 0)).toFixed(2));
                
                newDestinationBalance = parseFloat((destinationBankAccountData.customerBalance + amount).toFixed(2));
                newDestinationTotal = parseFloat((newDestinationBalance + (destinationBankAccountData.customerEscrow || 0)).toFixed(2));

                console.log('Nuevo balance origen:', newOriginBalance);
                console.log('Nuevo balance destino:', newDestinationBalance);

                // Preparar movimiento de envío (origen)
                const originMovement = {
                    PAYSATAccountNumber: originAccountData.accountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}`,
                    description: `send_transfer_${transactionUID}`,
                    paysatUID: uid,
                    updatedAt,
                    userName: originAccountData.beneficiaryName,
                    originUID,
                    destinationUID,
                    typeMovement: "transfer_sent",
                    status: "success",
                    feePercentage: transferFeePercentage,
                    fee: feeValue,
                    total: total,
                    reason: reason
                };

                // Preparar movimiento de recepción (destino)
                const destinationMovement = {
                    PAYSATAccountNumber: destinationAccountData.accountNumber,
                    amount: amount,
                    amount_cents: Math.round(amount * 100),
                    createdAt,
                    currency: "usd",
                    id: `transfer_${transactionUID}`,
                    description: `received_transfer_${transactionUID}`,
                    paysatUID: destinationUserUID,
                    updatedAt,
                    userName: destinationAccountData.beneficiaryName,
                    originUID,
                    destinationUID,
                    typeMovement: "transfer_received",
                    status: "success",
                    reason: reason
                };

                // Array de movimientos a registrar
                originMovements = [originMovement];
                destinationMovements = [destinationMovement];

                // Si hay fee, agregar movimiento de fee en origen
                if (feeValue > 0) {
                    const feeMovement = {
                        PAYSATAccountNumber: originAccountData.accountNumber,
                        amount: feeValue,
                        amount_cents: Math.round(feeValue * 100),
                        balanceTransactionId: `txn_${transactionUID}`,
                        createdAt,
                        currency: "usd",
                        id: `fee_transfer_${transactionUID}`,
                        paysatFee: feeValue,
                        paysatUID: uid,
                        source: "paysat_transfer",
                        feePercentage: transferFeePercentage,
                        totalFee: feeValue,
                        totalFee_cents: Math.round(feeValue * 100),
                        typeMovement: "fee",
                        updatedAt
                    };
                    originMovements.push(feeMovement);
                }
            }

            console.log('Movimientos preparados');

            // Iniciar transacción de Firestore con manejo de errores
            // IMPORTANTE: Firestore automáticamente hace ROLLBACK de todos los cambios
            // si ocurre cualquier error durante la transacción
            // REGLA DE FIRESTORE: Todas las LECTURAS primero, luego todas las ESCRITURAS
            try {
                await db.runTransaction(async (transaction) => {
                    console.log('🔄 Iniciando transacción atómica de Firestore...');

                    try {
                        // ============================================
                        // FASE 1: TODAS LAS LECTURAS PRIMERO
                        // ============================================
                        
                        console.log('📖 Fase 1: Ejecutando todas las lecturas...');

                        // 1.1. Verificar cuenta origen y balance actualizado (evitar race conditions)
                        const originCheckDoc = await transaction.get(originBankAccountDoc.ref);
                        if (!originCheckDoc.exists) {
                            throw new Error('La cuenta origen ya no existe');
                        }

                        const currentOriginBalance = originCheckDoc.data().customerBalance;
                        if (currentOriginBalance < total) {
                            throw new Error(`Balance insuficiente en la transacción. Balance actual: $${currentOriginBalance.toFixed(2)}, Requerido: $${total.toFixed(2)}`);
                        }
                        console.log('✓ Cuenta origen verificada');

                        // 1.2. Verificar que la cuenta destino siga existiendo
                        const destinationCheckDoc = await transaction.get(destinationBankAccountDoc.ref);
                        if (!destinationCheckDoc.exists) {
                            throw new Error('La cuenta destino ya no existe');
                        }
                        console.log('✓ Cuenta destino verificada');
                        
                        // 1.2.1. Si es transferencia interinstitucional, verificar cuenta PaySat principal
                        let mainPaySatCheckDoc = null;
                        if (isInterinstitutional) {
                            mainPaySatCheckDoc = await transaction.get(userMainAccountDoc.ref);
                            if (!mainPaySatCheckDoc.exists) {
                                throw new Error('La cuenta PAYSAT principal ya no existe');
                            }
                            
                            // Validar balance de cuenta principal para el segundo paso
                            const currentMainBalance = mainPaySatCheckDoc.data().customerBalance;
                            const requiredMainBalance = currentMainBalance + amount; // después de recibir de origen
                            if (requiredMainBalance < total) {
                                throw new Error(`La cuenta principal PAYSAT no tendrá suficiente balance. Requerido: $${total.toFixed(2)}, Disponible: $${requiredMainBalance.toFixed(2)}`);
                            }
                            console.log('✓ Cuenta PAYSAT principal verificada');
                        }

                        // 1.3. Si hay fee, verificar cuenta principal de PaySat para recibir comisiones
                        let mainAccountDoc = null;
                        let mainAccountData = null;
                        let newMainBalance = 0;
                        let newMainTotal = 0;
                        let mainAccountFeeMovement = null;

                        if (feeValue > 0) {
                            const paysatMainUID = process.env.PAYSAT_MAIN_ACCOUNT_UID;
                            const paysatMainNumber = process.env.PAYSAT_MAIN_ACCOUNT_NUMBER;
                            const paysatMainEmail = process.env.PAYSAT_MAIN_ACCOUNT_EMAIL;

                            if (!paysatMainUID || !paysatMainNumber || !paysatMainEmail) {
                                throw new Error('Variables de entorno de cuenta principal PaySat no configuradas');
                            }

                            // Buscar cuenta principal PaySat
                            const mainAccountRef = db.collection('Banco_PaySat_Money').doc(paysatMainUID);
                            mainAccountDoc = await transaction.get(mainAccountRef);

                            if (!mainAccountDoc.exists) {
                                throw new Error('Cuenta principal de PaySat no encontrada');
                            }

                            mainAccountData = mainAccountDoc.data();
                            newMainBalance = parseFloat((mainAccountData.customerBalance + feeValue).toFixed(2));
                            newMainTotal = parseFloat((newMainBalance + (mainAccountData.customerEscrow || 0)).toFixed(2));

                            mainAccountFeeMovement = {
                                PAYSATAccountNumber: paysatMainNumber,
                                amount: feeValue,
                                amount_cents: Math.round(feeValue * 100),
                                createdAt,
                                currency: "USD",
                                description: `transfer_fee_${transferFeePercentage}%`,
                                email: paysatMainEmail,
                                from: transactionUID,
                                id: `deposit_fee_transfer_${transactionUID}`,
                                paysatUID: paysatMainUID,
                                source: "PaySat_Transfers_History",
                                typeMovement: "deposit",
                                updatedAt
                            };
                            console.log('✓ Cuenta principal PaySat verificada');
                        }

                        console.log('✅ Todas las lecturas completadas exitosamente');

                        // ============================================
                        // FASE 2: TODAS LAS ESCRITURAS DESPUÉS
                        // ============================================
                        
                        console.log('✍️ Fase 2: Ejecutando todas las escrituras...');

                        // 2.1. Actualizar balance en cuenta origen
                        transaction.update(originBankAccountDoc.ref, {
                            customerBalance: newOriginBalance,
                            customerTotal: newOriginTotal,
                            customerMovements: admin.firestore.FieldValue.arrayUnion(...originMovements)
                        });
                        console.log('✓ Actualización de cuenta origen programada');

                        // 2.2. Actualizar balance en cuenta destino
                        transaction.update(destinationBankAccountDoc.ref, {
                            customerBalance: newDestinationBalance,
                            customerTotal: newDestinationTotal,
                            customerMovements: admin.firestore.FieldValue.arrayUnion(...destinationMovements)
                        });
                        console.log('✓ Actualización de cuenta destino programada');
                        
                        // 2.2.1. Si es transferencia interinstitucional, actualizar cuenta PaySat principal
                        if (isInterinstitutional && userMainAccountDoc) {
                            transaction.update(userMainAccountDoc.ref, {
                                customerBalance: newMainPaySatBalance,
                                customerTotal: newMainPaySatTotal,
                                customerMovements: admin.firestore.FieldValue.arrayUnion(...mainPaySatMovements)
                            });
                            console.log('✓ Actualización de cuenta PAYSAT principal del usuario programada');
                        }

                        // 2.3. Si hay fee, actualizar cuenta principal de PaySat para recibir comisiones
                        if (feeValue > 0 && mainAccountDoc) {
                            transaction.update(mainAccountDoc.ref, {
                                customerBalance: newMainBalance,
                                customerTotal: newMainTotal,
                                customerMovements: admin.firestore.FieldValue.arrayUnion(mainAccountFeeMovement)
                            });
                            console.log('✓ Actualización de cuenta principal PaySat programada');
                        }

                        // 2.4. Crear registro en PaySat_Transfers_History
                        const transferHistoryRef = db.collection('PaySat_Transfers_History').doc(transactionUID);

                        let transferHistoryData;
                        
                        if (isInterinstitutional) {
                            // ============================================
                            // HISTORIAL PARA TRANSFERENCIA INTERINSTITUCIONAL (DOS PASOS)
                            // ============================================
                            
                            // Paso 1: Origen externo → PaySat principal
                            const step1OriginData = {
                                PAYSATAccountNumber: originAccountData.accountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}_step1`,
                                description: `send_transfer_to_paysat_${transactionUID}`,
                                paysatUID: uid,
                                registeredAt,
                                userName: originAccountData.beneficiaryName,
                                originUID,
                                destinationUID: userMainAccountData.customerAccountUID,
                                typeMovement: "transfer_sent",
                                status: "success",
                                transferStep: "step1_to_paysat",
                                reason: reason
                            };
                            
                            const step1DestinationData = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}_step1_receive`,
                                description: `received_transfer_from_external_${transactionUID}`,
                                paysatUID: uid,
                                registeredAt,
                                userName: userMainAccountData.customerName,
                                originUID,
                                destinationUID: userMainAccountData.customerAccountUID,
                                typeMovement: "transfer_received",
                                status: "success",
                                transferStep: "step1_from_external",
                                reason: reason
                            };
                            
                            // Paso 2: PaySat principal → Destino externo
                            const step2OriginData = {
                                PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}_step2`,
                                description: `send_transfer_to_destination_${transactionUID}`,
                                paysatUID: uid,
                                registeredAt,
                                userName: userMainAccountData.customerName,
                                originUID: userMainAccountData.customerAccountUID,
                                destinationUID,
                                typeMovement: "transfer_sent",
                                status: "success",
                                fee: feeValue,
                                total: total,
                                transferStep: "step2_to_external",
                                reason: reason
                            };
                            
                            const step2DestinationData = {
                                PAYSATAccountNumber: destinationAccountData.accountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}_step2_receive`,
                                description: `received_transfer_from_paysat_${transactionUID}`,
                                paysatUID: destinationUserUID,
                                registeredAt,
                                userName: destinationAccountData.beneficiaryName,
                                originUID: userMainAccountData.customerAccountUID,
                                destinationUID,
                                typeMovement: "transfer_received",
                                status: "success",
                                transferStep: "step2_from_paysat",
                                reason: reason
                            };
                            
                            transferHistoryData = {
                                transferType: "Interinstitucional_Two_Step",
                                transferTypeDoc,
                                status: "success",
                                registeredAt,
                                step1: {
                                    origin: step1OriginData,
                                    destination: step1DestinationData
                                },
                                step2: {
                                    origin: step2OriginData,
                                    destination: step2DestinationData
                                },
                                summary: {
                                    finalOriginUID: originUID,
                                    intermediateAccountUID: userMainAccountData.customerAccountUID,
                                    finalDestinationUID: destinationUID,
                                    amount: amount,
                                    fee: feeValue,
                                    total: total
                                }
                            };
                            
                            // Si hay fee, agregar al historial
                            if (feeValue > 0) {
                                transferHistoryData.step2TransferFee = {
                                    PAYSATAccountNumber: userMainAccountData.customerAccountNumber,
                                    amount: feeValue,
                                    amount_cents: Math.round(feeValue * 100),
                                    balanceTransactionId: `txn_${transactionUID}`,
                                    createdAt,
                                    currency: "usd",
                                    id: `fee_transfer_${transactionUID}`,
                                    paysatFee: feeValue,
                                    paysatUID: uid,
                                    source: "paysat_transfer_interinstitutional",
                                    feePercentage: transferFeePercentage,
                                    totalFee: feeValue,
                                    totalFee_cents: Math.round(feeValue * 100),
                                    typeMovement: "fee"
                                };
                            }
                            
                        } else {
                            // ============================================
                            // HISTORIAL PARA TRANSFERENCIA NORMAL (DIRECTA)
                            // ============================================
                            
                            const originHistoryData = {
                                PAYSATAccountNumber: originAccountData.accountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}`,
                                description: `send_transfer_${transactionUID}`,
                                paysatUID: uid,
                                registeredAt,
                                userName: originAccountData.beneficiaryName,
                                originUID,
                                destinationUID,
                                typeMovement: "transfer_sent",
                                status: "success",
                                fee: feeValue,
                                total: total,
                                reason: reason
                            };

                            const destinationHistoryData = {
                                PAYSATAccountNumber: destinationAccountData.accountNumber,
                                amount: amount,
                                amount_cents: Math.round(amount * 100),
                                createdAt,
                                currency: "usd",
                                id: `transfer_${transactionUID}`,
                                description: `received_transfer_${transactionUID}`,
                                paysatUID: destinationUserUID,
                                registeredAt,
                                userName: destinationAccountData.beneficiaryName,
                                originUID,
                                destinationUID,
                                typeMovement: "transfer_received",
                                status: "success",
                                reason: reason
                            };

                            transferHistoryData = {
                                origin: originHistoryData,
                                destination: destinationHistoryData,
                                registeredAt,
                                transferType,
                                transferTypeDoc,
                                status: "success"
                            };

                            // Si hay fee, agregar al historial
                            if (feeValue > 0) {
                                transferHistoryData.originTransferFee = {
                                    PAYSATAccountNumber: originAccountData.accountNumber,
                                    amount: feeValue,
                                    amount_cents: Math.round(feeValue * 100),
                                    balanceTransactionId: `txn_${transactionUID}`,
                                    createdAt,
                                    currency: "usd",
                                    id: `fee_transfer_${transactionUID}`,
                                    paysatFee: feeValue,
                                    paysatUID: uid,
                                    source: "paysat_transfer",
                                    feePercentage: transferFeePercentage,
                                    totalFee: feeValue,
                                    totalFee_cents: Math.round(feeValue * 100),
                                    typeMovement: "fee"
                                };
                            }
                        }

                        transaction.set(transferHistoryRef, transferHistoryData);

                        console.log('✅ Registro de historial añadido a la transacción');

                    } catch (innerError) {
                        console.error('❌ Error dentro de la transacción:', innerError.message);
                        throw innerError; // Re-lanzar el error para que Firestore haga rollback
                    }
                });

                console.log('=== ✅ TRANSFERENCIA COMPLETADA EXITOSAMENTE ===');

            } catch (transactionError) {
                console.error('❌ ERROR EN LA TRANSACCIÓN - ROLLBACK AUTOMÁTICO EJECUTADO');
                console.error('Detalles del error:', transactionError);
                
                // Guardar registro de transferencia fallida para auditoría
                try {
                    await db.collection('PaySat_Transfers_History').doc(transactionUID).set({
                        origin: {
                            PAYSATAccountNumber: originAccountData.accountNumber,
                            paysatUID: uid,
                            userName: originAccountData.beneficiaryName,
                            originUID,
                            destinationUID
                        },
                        destination: {
                            PAYSATAccountNumber: destinationAccountData.accountNumber,
                            paysatUID: destinationUserUID,
                            userName: destinationAccountData.beneficiaryName,
                            originUID,
                            destinationUID
                        },
                        amount,
                        transferType,
                        transferTypeDoc,
                        status: "failed",
                        errorMessage: transactionError.message,
                        registeredAt,
                        attemptedAt: registeredAt
                    });
                    console.log('📝 Registro de transferencia fallida guardado para auditoría');
                } catch (logError) {
                    console.error('❌ Error al guardar registro de auditoría:', logError);
                }

                // Retornar error específico al usuario
                return res.status(500).json({
                    ok: false,
                    message: 'La transferencia no pudo completarse. Todos los cambios han sido revertidos automáticamente.',
                    error: transactionError.message,
                    transactionUID,
                    details: 'No se realizaron cambios en ninguna cuenta debido al rollback automático'
                });
            }

            // Retornar respuesta exitosa
            const responsePayload = {
                ok: true,
                message: 'Transferencia realizada exitosamente',
                data: {
                    transactionUID,
                    originUID,
                    destinationUID,
                    amount: parseFloat(amount),
                    transferType,
                    feePercentage: transferFeePercentage,
                    feeValue,
                    total,
                    originBalance: newOriginBalance,
                    destinationBalance: newDestinationBalance,
                    timestamp: registeredAt
                }
            };
            
            // Si es transferencia interinstitucional, agregar información adicional
            if (isInterinstitutional) {
                responsePayload.data.isInterinstitutional = true;
                responsePayload.data.intermediateAccount = {
                    accountUID: userMainAccountData.customerAccountUID,
                    accountNumber: userMainAccountData.customerAccountNumber,
                    finalBalance: newMainPaySatBalance
                };
                responsePayload.message = 'Transferencia interinstitucional realizada exitosamente (flujo de dos pasos: origen → PaySat principal → destino)';
            }
            
            return res.status(200).json(responsePayload);

        } catch (error) {
            console.error('❌ Error crítico al procesar transferencia:', error);
            console.error('Stack trace:', error.stack);
            
            return res.status(500).json({
                ok: false,
                message: 'Error crítico al procesar la transferencia',
                error: error.message,
                details: 'Ocurrió un error antes de iniciar la transacción. No se realizaron cambios en la base de datos.'
            });
        }
    }
}

export default LinkedUserAccountTransferController;