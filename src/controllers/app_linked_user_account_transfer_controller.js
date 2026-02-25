import { db, admin } from '../config/firebase.js';

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
                    fee: transferFeePercentage,
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

            console.log('=== DATOS RECIBIDOS PARA TRANSFERENCIA ===');
            console.log('Usuario autenticado (uid):', uid);
            console.log('Origin UID:', originUID);
            console.log('Destination UID:', destinationUID);
            console.log('Amount:', amount);
            console.log('Reason:', reason);
            console.log('Tipo de amount:', typeof amount);
            console.log('Body completo:', JSON.stringify(req.body, null, 2));
            console.log('==========================================');

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

            return res.status(200).json({
                ok: true,
                message: 'Datos recibidos correctamente (funcionalidad en desarrollo)',
                data: {
                    uid,
                    originUID,
                    destinationUID,
                    amount,
                    reason
                }
            });

        } catch (error) {
            console.error('Error al procesar transferencia:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al procesar la transferencia',
                error: error.message
            });
        }
    }
}

export default LinkedUserAccountTransferController;