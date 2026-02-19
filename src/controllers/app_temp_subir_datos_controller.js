import { admin, db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

class AppTempSubirDatosController {

    async subirDatos(req, res) {
        const writeLimit = 450; // seguro bajo 500
        let grandcustomerTotal = 0;

        for (const [collectionName, docs] of Object.entries(DATA)) {
            if (!Array.isArray(docs) || docs.length === 0) continue;

            console.log(`\n→ Subiendo collection: ${collectionName} (${docs.length} docs)`);

            for (let i = 0; i < docs.length; i += writeLimit) {
                const slice = docs.slice(i, i + writeLimit);
                const batch = db.batch();

                for (const doc of slice) {
                    const id = uuidv4();
                    const ref = db.collection(collectionName).doc(id);

                    batch.set(ref, {
                    customerID: doc.customerID ?? "",
                    customerName: doc.customerName ?? "",
                    customerPhone: doc.customerPhone ?? "",
                    customerAccountNumber: doc.customerAccountNumber ?? "",
                    customerBalance: typeof doc.customerBalance === "number" ? doc.customerBalance : 0.0,
                    customerEscrow: typeof doc.customerEscrow === "number" ? doc.customerEscrow : 0.0,
                    customerTotal: typeof doc.customerTotal === "number" ? doc.customerTotal : 0.0,
                    customerMovements: doc.customerMovements ?? [],
                    customerAccountTypeName: doc.customerAccountTypeName ?? "",
                    });
                }

                await batch.commit();
            }

            grandcustomerTotal += docs.length;
            console.log(`✅ OK ${collectionName}`);
        }

        console.log(`\n✅ Importación finalizada. customerTotal docs: ${grandcustomerTotal}`);

        return res.json({ ok: true, message: `Importación finalizada. customerTotal docs: ${grandcustomerTotal}` });

    }

    async eliminarBancosyCooperativas(req, res) {
        try {
            // Obtener todos los documentos de PaySat_Transfer_Affiliates
            const affiliatesRef = db.collection('PaySat_Transfer_Affiliates');
            const affiliatesSnapshot = await affiliatesRef.get();

            if (affiliatesSnapshot.empty) {
                return res.status(404).json({
                    ok: false,
                    message: 'No se encontraron colecciones para eliminar en PaySat_Transfer_Affiliates'
                });
            }

            // Obtener los nombres de las colecciones a eliminar (nombres de documentos)
            // Excluir Banco_PaySat_Money
            const collectionsToDelete = [];
            affiliatesSnapshot.forEach(doc => {
                if (doc.id !== 'Banco_PaySat_Money') {
                    collectionsToDelete.push(doc.id);
                }
            });

            if (collectionsToDelete.length === 0) {
                return res.json({
                    ok: true,
                    message: 'No hay colecciones para eliminar (Banco_PaySat_Money se mantiene intacto)'
                });
            }

            console.log(`\n→ Colecciones a eliminar: ${collectionsToDelete.join(', ')}`);
            console.log(`\n→ Colección excluida: Banco_PaySat_Money`);

            let totalDeleted = 0;
            const batchSize = 500;

            // Eliminar cada colección
            for (const collectionName of collectionsToDelete) {
                console.log(`\n→ Eliminando colección: ${collectionName}`);
                
                const collectionRef = db.collection(collectionName);
                let deletedInCollection = 0;

                // Eliminar documentos en lotes
                let snapshot = await collectionRef.limit(batchSize).get();
                
                while (!snapshot.empty) {
                    const batch = db.batch();
                    
                    snapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });

                    await batch.commit();
                    deletedInCollection += snapshot.docs.length;
                    
                    // Obtener el siguiente lote
                    snapshot = await collectionRef.limit(batchSize).get();
                }

                totalDeleted += deletedInCollection;
                console.log(`✅ Eliminados ${deletedInCollection} documentos de ${collectionName}`);
            }

            console.log(`\n✅ Eliminación completada. Total documentos eliminados: ${totalDeleted}`);

            return res.json({
                ok: true,
                message: `Eliminación completada. ${collectionsToDelete.length} colecciones procesadas.`,
                details: {
                    collections: collectionsToDelete,
                    totalDocumentsDeleted: totalDeleted
                }
            });

        } catch (error) {
            console.error('Error al eliminar colecciones:', error);
            return res.status(500).json({
                ok: false,
                message: 'Error al eliminar las colecciones',
                error: error.message
            });
        }
    }

    async codigosUuid(req, res) {        
        return res.json({ ok: true, data: `${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()}`});
        //return res.json({ ok: true, message: "" });
    }
}

export default AppTempSubirDatosController;

const DATA = {
    "Cooperativa_JEP": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "4606123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576", 
        "customerAccountNumber": "4606124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "4606125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "4606126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "4606127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "16061238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "46061239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "4606122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4606121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4606222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Cooperativa_Mushuk_Runa": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1503121",
        "customerBalance": 7541.25,
        "customerEscrow": 0,
        "customerTotal": 7541.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1503122",
        "customerBalance": 128.44,
        "customerEscrow": 0,
        "customerTotal": 128.44,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105874512",
        "customerName": "Maria Priscila Pacheco Mora",
        "customerPhone": "+59399123568",
        "customerAccountNumber": "1503123",
        "customerBalance": 625.18,
        "customerEscrow": 0,
        "customerTotal": 625.18,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1814125878",
        "customerName": "Diego Olivo Silva Lascano",
        "customerPhone": "+593995460102",
        "customerAccountNumber": "1504124",
        "customerBalance": 1230.25,
        "customerEscrow": 0,
        "customerTotal": 1230.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1504125",
        "customerBalance": 142.85,
        "customerEscrow": 0,
        "customerTotal": 142.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0156255511",
        "customerName": "Rosa Daniela Alvera Robles",
        "customerPhone": "+593983215478",
        "customerAccountNumber": "1504126",
        "customerBalance": 1487.22,
        "customerEscrow": 0,
        "customerTotal": 1487.22,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1504127",
        "customerBalance": 2058.14,
        "customerEscrow": 0,
        "customerTotal": 2058.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "1504128",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4606222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Cooperativa_Cacpeco": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1657121",
        "customerBalance": 148.25,
        "customerEscrow": 0,
        "customerTotal": 148.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "1654122",
        "customerBalance": 1285.36,
        "customerEscrow": 0,
        "customerTotal": 1285.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "1657123",
        "customerBalance": 3652.14,
        "customerEscrow": 0,
        "customerTotal": 3652.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "1657124",
        "customerBalance": 1623.58,
        "customerEscrow": 0,
        "customerTotal": 1623.58,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "1657131",
        "customerBalance": 2588.99,
        "customerEscrow": 0,
        "customerTotal": 2588.99,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "1657222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Cooperativa_Jardin_Azuayo": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "4705123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576",
        "customerAccountNumber": "4705124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "4705125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "4705126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "4705127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "16061238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "47051239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "4705122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4705121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4705222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Austro": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "7781123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576",
        "customerAccountNumber": "7781124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "7781125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "7781126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "7781127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "16061238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "77811239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "7781122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7781121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7781130",
        "customerBalance": 1258.14,
        "customerEscrow": 0,
        "customerTotal": 1258.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7781222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Pichincha": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188121",
        "customerBalance": 7541.25,
        "customerEscrow": 0,
        "customerTotal": 7541.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188122",
        "customerBalance": 128.44,
        "customerEscrow": 0,
        "customerTotal": 128.44,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105874512",
        "customerName": "Maria Priscila Pacheco Mora",
        "customerPhone": "+59399123568",
        "customerAccountNumber": "7188123",
        "customerBalance": 625.18,
        "customerEscrow": 0,
        "customerTotal": 625.18,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1814125878",
        "customerName": "Diego Olivo Silva Lascano",
        "customerPhone": "+593995460102",
        "customerAccountNumber": "7188124",
        "customerBalance": 1230.25,
        "customerEscrow": 0,
        "customerTotal": 1230.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188125",
        "customerBalance": 142.85,
        "customerEscrow": 0,
        "customerTotal": 142.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0156255511",
        "customerName": "Rosa Daniela Alvera Robles",
        "customerPhone": "+593983215478",
        "customerAccountNumber": "7188126",
        "customerBalance": 1487.22,
        "customerEscrow": 0,
        "customerTotal": 1487.22,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188127",
        "customerBalance": 2058.14,
        "customerEscrow": 0,
        "customerTotal": 2058.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "7188128",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7188136",
        "customerBalance": 10487.24,
        "customerEscrow": 0,
        "customerTotal": 10487.24,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7188222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Guayaquil": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403121",
        "customerBalance": 148.25,
        "customerEscrow": 0,
        "customerTotal": 148.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "8403122",
        "customerBalance": 1285.36,
        "customerEscrow": 0,
        "customerTotal": 1285.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403123",
        "customerBalance": 3652.14,
        "customerEscrow": 0,
        "customerTotal": 3652.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "8403124",
        "customerBalance": 1623.58,
        "customerEscrow": 0,
        "customerTotal": 1623.58,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403125",
        "customerBalance": 142.85,
        "customerEscrow": 0,
        "customerTotal": 142.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0156255511",
        "customerName": "Rosa Daniela Alvera Robles",
        "customerPhone": "+593983215478",
        "customerAccountNumber": "8403126",
        "customerBalance": 1487.22,
        "customerEscrow": 0,
        "customerTotal": 1487.22,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "8403222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Pacifico": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "9001123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576",
        "customerAccountNumber": "9001124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "9001125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "9001126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "9001127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "9001238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "90011239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "9001122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "9001121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "9001222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_JPMorgan_Chase": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "9001123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576",
        "customerAccountNumber": "9001124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "9001125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "9001126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "9001127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "9001238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "90011239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "9001122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "9001121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "9001222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Bank_of_America": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403121",
        "customerBalance": 148.25,
        "customerEscrow": 0,
        "customerTotal": 148.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "8403122",
        "customerBalance": 1285.36,
        "customerEscrow": 0,
        "customerTotal": 1285.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403123",
        "customerBalance": 3652.14,
        "customerEscrow": 0,
        "customerTotal": 3652.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "8403124",
        "customerBalance": 1623.58,
        "customerEscrow": 0,
        "customerTotal": 1623.58,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "8403125",
        "customerBalance": 142.85,
        "customerEscrow": 0,
        "customerTotal": 142.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0156255511",
        "customerName": "Rosa Daniela Alvera Robles",
        "customerPhone": "+593983215478",
        "customerAccountNumber": "8403126",
        "customerBalance": 1487.22,
        "customerEscrow": 0,
        "customerTotal": 1487.22,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "8403222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Wells_Fargo": [
        {
        "customerID": "0504187412",
        "customerName": "Patricia Fernanda Tapia Salazar",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188121",
        "customerBalance": 7541.25,
        "customerEscrow": 0,
        "customerTotal": 7541.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188122",
        "customerBalance": 128.44,
        "customerEscrow": 0,
        "customerTotal": 128.44,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105874512",
        "customerName": "Maria Priscila Pacheco Mora",
        "customerPhone": "+59399123568",
        "customerAccountNumber": "7188123",
        "customerBalance": 625.18,
        "customerEscrow": 0,
        "customerTotal": 625.18,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1814125878",
        "customerName": "Diego Olivo Silva Lascano",
        "customerPhone": "+593995460102",
        "customerAccountNumber": "7188124",
        "customerBalance": 1230.25,
        "customerEscrow": 0,
        "customerTotal": 1230.25,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188125",
        "customerBalance": 142.85,
        "customerEscrow": 0,
        "customerTotal": 142.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0156255511",
        "customerName": "Rosa Daniela Alvera Robles",
        "customerPhone": "+593983215478",
        "customerAccountNumber": "7188126",
        "customerBalance": 1487.22,
        "customerEscrow": 0,
        "customerTotal": 1487.22,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1854256512",
        "customerName": "Jaime Humberto Ronquillo Yancha",
        "customerPhone": "+593995831224",
        "customerAccountNumber": "7188127",
        "customerBalance": 2058.14,
        "customerEscrow": 0,
        "customerTotal": 2058.14,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149717",
        "customerName": "María Elena Salazar Arias",
        "customerPhone": "+593995148751",
        "customerAccountNumber": "7188128",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7188136",
        "customerBalance": 10487.24,
        "customerEscrow": 0,
        "customerTotal": 10487.24,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "7188222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
    "Banco_Citigroup": [
        {
        "customerID": "0503149783",
        "customerName": "Edgar Marcelo Tapia Salazar",
        "customerPhone": "+593995831221",
        "customerAccountNumber": "4705123",
        "customerBalance": 825.36,
        "customerEscrow": 0,
        "customerTotal": 825.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102960614",
        "customerName": "Diana Alexandra Criollo Ayala",
        "customerPhone": "+593995776576",
        "customerAccountNumber": "4705124",
        "customerBalance": 2724.85,
        "customerEscrow": 0,
        "customerTotal": 2724.85,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0102030405",
        "customerName": "Adrián Patricio Pulgarín Álvarez",
        "customerPhone": "+593995412674",
        "customerAccountNumber": "4705125",
        "customerBalance": 2654.3,
        "customerEscrow": 0,
        "customerTotal": 2654.3,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0105060407",
        "customerName": "Juan José Cobos Bueno",
        "customerPhone": "+593983161550",
        "customerAccountNumber": "4705126",
        "customerBalance": 25148.71,
        "customerEscrow": 0,
        "customerTotal": 25148.71,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "1512243687",
        "customerName": "Pablo Antonio Escobar Álvarez",
        "customerPhone": "+593993884495",
        "customerAccountNumber": "4705127",
        "customerBalance": 3417.1,
        "customerEscrow": 0,
        "customerTotal": 3417.1,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0123659874",
        "customerName": "Rosa Viviana Bravo Rodriguez",
        "customerPhone": "+593997456789",
        "customerAccountNumber": "16061238",
        "customerBalance": 1526.32,
        "customerEscrow": 0,
        "customerTotal": 1526.32,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0506040527",
        "customerName": "Olga Patricia Salazar Arias",
        "customerPhone": "+593987365421",
        "customerAccountNumber": "47051239",
        "customerBalance": 4215.02,
        "customerEscrow": 0,
        "customerTotal": 4215.02,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0503149786",
        "customerName": "Karla Lizeth Lascano Salazar",
        "customerPhone": "+593982457812",
        "customerAccountNumber": "4705122",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424",
        "customerName": "Johnny Oswaldo Santacruz Martinez",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4705121",
        "customerBalance": 7005.36,
        "customerEscrow": 0,
        "customerTotal": 7005.36,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        },
        {
        "customerID": "0101296424001",
        "customerName": "PAYSAT TEST ACCOUNT",
        "customerPhone": "+593995932315",
        "customerAccountNumber": "4705222",
        "customerBalance": 0,
        "customerEscrow": 0,
        "customerTotal": 0,
        "customerMovements": [],
        "customerAccountTypeName": "Ahorros"
        }
    ],
};