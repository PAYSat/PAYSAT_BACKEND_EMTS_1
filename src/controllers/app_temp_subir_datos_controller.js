import { admin, db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

class AppTempSubirDatosController {

    async subirDatos(req, res) {
        const writeLimit = 450; // seguro bajo 500
        let grandTotal = 0;

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
                    CedulaSocio: doc.CedulaSocio ?? "",
                    NombreSocio: doc.NombreSocio ?? "",
                    Telefono: doc.Telefono ?? "",
                    NoCuenta: doc.NoCuenta ?? "",
                    Saldo: typeof doc.Saldo === "number" ? doc.Saldo : 0.0,
                    Escrow: typeof doc.Escrow === "number" ? doc.Escrow : 0.0,
                    Total: typeof doc.Total === "number" ? doc.Total : 0.0,
                    Movimientos: doc.Movimientos ?? [],
                    });
                }

                await batch.commit();
            }

            grandTotal += docs.length;
            console.log(`✅ OK ${collectionName}`);
        }

        console.log(`\n✅ Importación finalizada. Total docs: ${grandTotal}`);

        return res.json({ ok: true, message: `Importación finalizada. Total docs: ${grandTotal}` });

    }

    async codigosUuid(req, res) {        
        // return res.json({ ok: true, data: `${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()} / ${uuidv4()}` });
        return res.json({ ok: true, message: "" });
    }
}

export default AppTempSubirDatosController;

const DATA = {
    "Cooperativa_JEP": [
        {
        "CedulaSocio": "0503149783",
        "NombreSocio": "Edgar Marcelo Tapia Salazar",
        "Telefono": "+593995831221",
        "NoCuenta": "4606123",
        "Saldo": 825.36,
        "Escrow": 0,
        "Total": 825.36,
        "Movimientos": [],
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995776576",
        "NoCuenta": "4606124",
        "Saldo": 2724.85,
        "Escrow": 0,
        "Total": 2724.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "4606125",
        "Saldo": 2654.3,
        "Escrow": 0,
        "Total": 2654.3,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105060407",
        "NombreSocio": "Juan José Cobos Bueno",
        "Telefono": "+593983161550",
        "NoCuenta": "4606126",
        "Saldo": 25148.71,
        "Escrow": 0,
        "Total": 25148.71,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593993884495",
        "NoCuenta": "4606127",
        "Saldo": 3417.1,
        "Escrow": 0,
        "Total": 3417.1,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0123659874",
        "NombreSocio": "Rosa Viviana Bravo Rodriguez",
        "Telefono": "+593997456789",
        "NoCuenta": "16061238",
        "Saldo": 1526.32,
        "Escrow": 0,
        "Total": 1526.32,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0506040527",
        "NombreSocio": "Olga Patricia Salazar Arias",
        "Telefono": "+593987365421",
        "NoCuenta": "46061239",
        "Saldo": 4215.02,
        "Escrow": 0,
        "Total": 4215.02,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149786",
        "NombreSocio": "Karla Lizeth Lascano Salazar",
        "Telefono": "+593982457812",
        "NoCuenta": "4606122",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "4606121",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "4606222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Cooperativa_Mushuk_Runa": [
        {
        "CedulaSocio": "0504187412",
        "NombreSocio": "Patricia Fernanda Tapia Salazar",
        "Telefono": "+593995831224",
        "NoCuenta": "1503121",
        "Saldo": 7541.25,
        "Escrow": 0,
        "Total": 7541.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995831224",
        "NoCuenta": "1503122",
        "Saldo": 128.44,
        "Escrow": 0,
        "Total": 128.44,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105874512",
        "NombreSocio": "Maria Priscila Pacheco Mora",
        "Telefono": "+59399123568",
        "NoCuenta": "1503123",
        "Saldo": 625.18,
        "Escrow": 0,
        "Total": 625.18,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1814125878",
        "NombreSocio": "Diego Olivo Silva Lascano",
        "Telefono": "+593995460102",
        "NoCuenta": "1504124",
        "Saldo": 1230.25,
        "Escrow": 0,
        "Total": 1230.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593995831224",
        "NoCuenta": "1504125",
        "Saldo": 142.85,
        "Escrow": 0,
        "Total": 142.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0156255511",
        "NombreSocio": "Rosa Daniela Alvera Robles",
        "Telefono": "+593983215478",
        "NoCuenta": "1504126",
        "Saldo": 1487.22,
        "Escrow": 0,
        "Total": 1487.22,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1854256512",
        "NombreSocio": "Jaime Humberto Ronquillo Yancha",
        "Telefono": "+593995831224",
        "NoCuenta": "1504127",
        "Saldo": 2058.14,
        "Escrow": 0,
        "Total": 2058.14,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149717",
        "NombreSocio": "María Elena Salazar Arias",
        "Telefono": "+593995148751",
        "NoCuenta": "1504128",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "4606222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Cooperativa_Cacpeco": [
        {
        "CedulaSocio": "0504187412",
        "NombreSocio": "Patricia Fernanda Tapia Salazar",
        "Telefono": "+593995831224",
        "NoCuenta": "1657121",
        "Saldo": 148.25,
        "Escrow": 0,
        "Total": 148.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149717",
        "NombreSocio": "María Elena Salazar Arias",
        "Telefono": "+593995148751",
        "NoCuenta": "1654122",
        "Saldo": 1285.36,
        "Escrow": 0,
        "Total": 1285.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1854256512",
        "NombreSocio": "Jaime Humberto Ronquillo Yancha",
        "Telefono": "+593995831224",
        "NoCuenta": "1657123",
        "Saldo": 3652.14,
        "Escrow": 0,
        "Total": 3652.14,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "1657124",
        "Saldo": 1623.58,
        "Escrow": 0,
        "Total": 1623.58,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149783",
        "NombreSocio": "Edgar Marcelo Tapia Salazar",
        "Telefono": "+593995831221",
        "NoCuenta": "1657131",
        "Saldo": 2588.99,
        "Escrow": 0,
        "Total": 2588.99,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "1657222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Cooperativa_Jardin_Azuayo": [
        {
        "CedulaSocio": "0503149783",
        "NombreSocio": "Edgar Marcelo Tapia Salazar",
        "Telefono": "+593995831221",
        "NoCuenta": "4705123",
        "Saldo": 825.36,
        "Escrow": 0,
        "Total": 825.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995776576",
        "NoCuenta": "4705124",
        "Saldo": 2724.85,
        "Escrow": 0,
        "Total": 2724.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "4705125",
        "Saldo": 2654.3,
        "Escrow": 0,
        "Total": 2654.3,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105060407",
        "NombreSocio": "Juan José Cobos Bueno",
        "Telefono": "+593983161550",
        "NoCuenta": "4705126",
        "Saldo": 25148.71,
        "Escrow": 0,
        "Total": 25148.71,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593993884495",
        "NoCuenta": "4705127",
        "Saldo": 3417.1,
        "Escrow": 0,
        "Total": 3417.1,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0123659874",
        "NombreSocio": "Rosa Viviana Bravo Rodriguez",
        "Telefono": "+593997456789",
        "NoCuenta": "16061238",
        "Saldo": 1526.32,
        "Escrow": 0,
        "Total": 1526.32,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0506040527",
        "NombreSocio": "Olga Patricia Salazar Arias",
        "Telefono": "+593987365421",
        "NoCuenta": "47051239",
        "Saldo": 4215.02,
        "Escrow": 0,
        "Total": 4215.02,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149786",
        "NombreSocio": "Karla Lizeth Lascano Salazar",
        "Telefono": "+593982457812",
        "NoCuenta": "4705122",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "4705121",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "4705222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Banco_Austro": [
        {
        "CedulaSocio": "0503149783",
        "NombreSocio": "Edgar Marcelo Tapia Salazar",
        "Telefono": "+593995831221",
        "NoCuenta": "7781123",
        "Saldo": 825.36,
        "Escrow": 0,
        "Total": 825.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995776576",
        "NoCuenta": "7781124",
        "Saldo": 2724.85,
        "Escrow": 0,
        "Total": 2724.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "7781125",
        "Saldo": 2654.3,
        "Escrow": 0,
        "Total": 2654.3,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105060407",
        "NombreSocio": "Juan José Cobos Bueno",
        "Telefono": "+593983161550",
        "NoCuenta": "7781126",
        "Saldo": 25148.71,
        "Escrow": 0,
        "Total": 25148.71,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593993884495",
        "NoCuenta": "7781127",
        "Saldo": 3417.1,
        "Escrow": 0,
        "Total": 3417.1,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0123659874",
        "NombreSocio": "Rosa Viviana Bravo Rodriguez",
        "Telefono": "+593997456789",
        "NoCuenta": "16061238",
        "Saldo": 1526.32,
        "Escrow": 0,
        "Total": 1526.32,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0506040527",
        "NombreSocio": "Olga Patricia Salazar Arias",
        "Telefono": "+593987365421",
        "NoCuenta": "77811239",
        "Saldo": 4215.02,
        "Escrow": 0,
        "Total": 4215.02,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149786",
        "NombreSocio": "Karla Lizeth Lascano Salazar",
        "Telefono": "+593982457812",
        "NoCuenta": "7781122",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "7781121",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "7781130",
        "Saldo": 1258.14,
        "Escrow": 0,
        "Total": 1258.14,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "7781222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Banco_Pichincha": [
        {
        "CedulaSocio": "0504187412",
        "NombreSocio": "Patricia Fernanda Tapia Salazar",
        "Telefono": "+593995831224",
        "NoCuenta": "7188121",
        "Saldo": 7541.25,
        "Escrow": 0,
        "Total": 7541.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995831224",
        "NoCuenta": "7188122",
        "Saldo": 128.44,
        "Escrow": 0,
        "Total": 128.44,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105874512",
        "NombreSocio": "Maria Priscila Pacheco Mora",
        "Telefono": "+59399123568",
        "NoCuenta": "7188123",
        "Saldo": 625.18,
        "Escrow": 0,
        "Total": 625.18,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1814125878",
        "NombreSocio": "Diego Olivo Silva Lascano",
        "Telefono": "+593995460102",
        "NoCuenta": "7188124",
        "Saldo": 1230.25,
        "Escrow": 0,
        "Total": 1230.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593995831224",
        "NoCuenta": "7188125",
        "Saldo": 142.85,
        "Escrow": 0,
        "Total": 142.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0156255511",
        "NombreSocio": "Rosa Daniela Alvera Robles",
        "Telefono": "+593983215478",
        "NoCuenta": "7188126",
        "Saldo": 1487.22,
        "Escrow": 0,
        "Total": 1487.22,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1854256512",
        "NombreSocio": "Jaime Humberto Ronquillo Yancha",
        "Telefono": "+593995831224",
        "NoCuenta": "7188127",
        "Saldo": 2058.14,
        "Escrow": 0,
        "Total": 2058.14,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149717",
        "NombreSocio": "María Elena Salazar Arias",
        "Telefono": "+593995148751",
        "NoCuenta": "7188128",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "7188136",
        "Saldo": 10487.24,
        "Escrow": 0,
        "Total": 10487.24,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "7188222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Banco_Guayaquil": [
        {
        "CedulaSocio": "0504187412",
        "NombreSocio": "Patricia Fernanda Tapia Salazar",
        "Telefono": "+593995831224",
        "NoCuenta": "8403121",
        "Saldo": 148.25,
        "Escrow": 0,
        "Total": 148.25,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149717",
        "NombreSocio": "María Elena Salazar Arias",
        "Telefono": "+593995148751",
        "NoCuenta": "8403122",
        "Saldo": 1285.36,
        "Escrow": 0,
        "Total": 1285.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1854256512",
        "NombreSocio": "Jaime Humberto Ronquillo Yancha",
        "Telefono": "+593995831224",
        "NoCuenta": "8403123",
        "Saldo": 3652.14,
        "Escrow": 0,
        "Total": 3652.14,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "8403124",
        "Saldo": 1623.58,
        "Escrow": 0,
        "Total": 1623.58,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593995831224",
        "NoCuenta": "8403125",
        "Saldo": 142.85,
        "Escrow": 0,
        "Total": 142.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0156255511",
        "NombreSocio": "Rosa Daniela Alvera Robles",
        "Telefono": "+593983215478",
        "NoCuenta": "8403126",
        "Saldo": 1487.22,
        "Escrow": 0,
        "Total": 1487.22,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "8403222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ],
    "Banco_Pacifico": [
        {
        "CedulaSocio": "0503149783",
        "NombreSocio": "Edgar Marcelo Tapia Salazar",
        "Telefono": "+593995831221",
        "NoCuenta": "9001123",
        "Saldo": 825.36,
        "Escrow": 0,
        "Total": 825.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102960614",
        "NombreSocio": "Diana Alexandra Criollo Ayala",
        "Telefono": "+593995776576",
        "NoCuenta": "9001124",
        "Saldo": 2724.85,
        "Escrow": 0,
        "Total": 2724.85,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0102030405",
        "NombreSocio": "Adrián Patricio Pulgarín Álvarez",
        "Telefono": "+593995412674",
        "NoCuenta": "9001125",
        "Saldo": 2654.3,
        "Escrow": 0,
        "Total": 2654.3,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0105060407",
        "NombreSocio": "Juan José Cobos Bueno",
        "Telefono": "+593983161550",
        "NoCuenta": "9001126",
        "Saldo": 25148.71,
        "Escrow": 0,
        "Total": 25148.71,
        "Movimientos": []
        },
        {
        "CedulaSocio": "1512243687",
        "NombreSocio": "Pablo Antonio Escobar Álvarez",
        "Telefono": "+593993884495",
        "NoCuenta": "9001127",
        "Saldo": 3417.1,
        "Escrow": 0,
        "Total": 3417.1,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0123659874",
        "NombreSocio": "Rosa Viviana Bravo Rodriguez",
        "Telefono": "+593997456789",
        "NoCuenta": "9001238",
        "Saldo": 1526.32,
        "Escrow": 0,
        "Total": 1526.32,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0506040527",
        "NombreSocio": "Olga Patricia Salazar Arias",
        "Telefono": "+593987365421",
        "NoCuenta": "90011239",
        "Saldo": 4215.02,
        "Escrow": 0,
        "Total": 4215.02,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0503149786",
        "NombreSocio": "Karla Lizeth Lascano Salazar",
        "Telefono": "+593982457812",
        "NoCuenta": "9001122",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424",
        "NombreSocio": "Johnny Oswaldo Santacruz Martinez",
        "Telefono": "+593995932315",
        "NoCuenta": "9001121",
        "Saldo": 7005.36,
        "Escrow": 0,
        "Total": 7005.36,
        "Movimientos": []
        },
        {
        "CedulaSocio": "0101296424001",
        "NombreSocio": "PAYSAT TEST ACCOUNT",
        "Telefono": "+593995932315",
        "NoCuenta": "9001222",
        "Saldo": 0,
        "Escrow": 0,
        "Total": 0,
        "Movimientos": []
        }
    ]
};