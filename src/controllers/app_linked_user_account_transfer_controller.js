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
                beneficiaryName,
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

    createDestinationLinkedAccount = async (req, res) => {

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
}

export default LinkedUserAccountTransferController;