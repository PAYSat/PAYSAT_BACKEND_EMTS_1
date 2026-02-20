import { db, admin } from '../config/firebase.js';

class AppAccountAndCardPaysatTransactionsController {
    userAccountDetails = async (req, res) => {
        let { paysatUID } = req.params;
        
        try {
            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
                paysatUID = paysatUID.substring(1);
            }
        
            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
                return res.status(400).json({ 
                    ok: false, 
                    error: 'paysatUID es requerido y no puede estar vacío' 
                });
            }
        
            // Obtener el documento del usuario de Banco_PaySat_Money
            const userDoc = await db.collection('Banco_PaySat_Money')
                .doc(paysatUID)
                .get();
        
            if (!userDoc.exists) {
                console.log('📊 No se encontró el documento para el usuario:', paysatUID);
                return res.status(404).json({
                    ok: false,
                    error: 'No se encontró el documento para este usuario'
                });
            }
        
            const userData = userDoc.data();
            
            // Excluir los campos especificados
            // const { customerBalance, customerEscrow, customerMovements, ...accountData } = userData;
            const { customerTotal, customerEscrow, customerMovements, ...accountData } = userData;
        
            console.log(`✅ Datos de cuenta obtenidos para: ${paysatUID}`);
            
            res.json({
                ok: true,
                data: accountData
            });
        
        } catch (error) {
            console.error('❌ Error al obtener los datos de la cuenta:', error);
            res.status(500).json({ 
                ok: false, 
                error: 'Internal server error',
                details: error.message 
            });
        }
    }

    accountTransactionsHistory = async (req, res) => {
        let { paysatUID } = req.params;
        
        try {
            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
            paysatUID = paysatUID.substring(1);
            }
        
            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
            return res.status(400).json({ 
                ok: false, 
                error: 'paysatUID es requerido y no puede estar vacío' 
            });
            }
        
            // Obtener el documento de movimientos del usuario (nueva estructura)
            const userMovementsDoc = await db.collection('Banco_PaySat_Money')
            .doc(paysatUID)
            .get();
        
            if (!userMovementsDoc.exists) {
            console.log('📊 No se encontraron movimientos para el usuario:', paysatUID);
            return res.json({
                ok: true,
                saldo: 0.00,
                data: [],
                message: 'No se encontraron movimientos para este usuario'
            });
            }
        
            const userData = userMovementsDoc.data();
            const movements = userData.customerMovements || [];
            const balance = userData.customerBalance || 0;
        
            console.log('📊 Movimientos encontrados:', movements.length);
        
            if (movements.length === 0) {
            return res.json({
                ok: true,
                saldo: balance,
                data: [],
                message: 'No se encontraron movimientos para este usuario'
            });
            }
        
            // Procesar los movimientos para la respuesta
            const transacciones = movements.map(mov => {
            const typeMovement = mov.typeMovement;
            
            return {
                id: mov.id,
                typeMovement: typeMovement,
                amount: mov.amount,
                amount_cents: mov.amount_cents,
                currency: mov.currency || 'USD',
                
                // Campos específicos según el tipo de movimiento
                ...(typeMovement === 'recharge' && {
                payment_intent_id: mov.payment_intent_id || null,
                recharge_id: mov.recharge_id || null,
                charge_id: mov.charge_id || null,
                status: mov.status || null,
                userName: mov.userName || null,
                userEmail: mov.userEmail || null,
                }),
                
                ...(typeMovement === 'fee' && {
                paysatFee: mov.paysatFee || null,
                paysatFee_cents: mov.paysatFee_cents || null,
                totalFee: mov.totalFee || null,
                net: mov.net || null,
                balanceTransactionId: mov.balanceTransactionId || null,
                stripe_fee: mov.stripe_fee || null,
                stripe_fee_cents: mov.stripe_fee_cents || null,
                }),
                
                ...(typeMovement === 'deposit' && {
                from: mov.from || null,
                description: mov.description || null,
                email: mov.email || null
                }),
        
                ...(typeMovement === 'buy' && {
                from: mov.from || null,
                description: mov.description || null,
                email: mov.email || null
                }),
        
                ...(typeMovement === 'recharge_card' && {
                from: mov.from || null,
                description: mov.description || null,
                email: mov.email || null
                }),
                
                PAYSATAccountNumber: mov.PAYSATAccountNumber || null,
                createdAt: mov.createdAt || null,
                updatedAt: mov.updatedAt || null,
                source: mov.source || null
            };
            });
        
            // Ordenar transacciones por fecha (más recientes primero - descendente)
            transacciones.sort((a, b) => {
            let dateA, dateB;
            
            if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                dateA = a.createdAt.toDate();
            } else if (a.createdAt) {
                dateA = new Date(a.createdAt);
            } else {
                dateA = new Date(0);
            }
            
            if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                dateB = b.createdAt.toDate();
            } else if (b.createdAt) {
                dateB = new Date(b.createdAt);
            } else {
                dateB = new Date(0);
            }
            
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            
            return timeB - timeA;
            });
        
            // Calcular balanceAfter para cada transacción (en orden cronológico)
            let balanceAcumulado = 0.00;
            const transaccionesOrdenCronologico = [...transacciones].reverse();
            
            transaccionesOrdenCronologico.forEach(tx => {
            const monto = tx.amount;
            const typeMovement = tx.typeMovement;
            
            // Aplicar el movimiento al balance
            if (typeMovement === 'deposit' || typeMovement === 'recharge') {
                balanceAcumulado += monto;
            } else if (typeMovement === 'buy' || typeMovement === 'recharge_card') {
                balanceAcumulado -= monto;
            } else if (typeMovement === 'fee') {
                balanceAcumulado -= tx.totalFee || 0;
            }
            
            tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
            });
        
            console.log(`✅ Procesados ${transacciones.length} movimientos, saldo: $${balance}`);
            
            // Mostrar rango de fechas
            if (transacciones.length > 0) {
            const fechaMasReciente = transacciones[0].createdAt;
            const fechaMasAntigua = transacciones[transacciones.length - 1].createdAt;
            
            let fechaRecienteStr, fechaAntiguaStr;
            
            if (fechaMasReciente && typeof fechaMasReciente.toDate === 'function') {
                fechaRecienteStr = fechaMasReciente.toDate().toLocaleString();
            } else {
                fechaRecienteStr = new Date(fechaMasReciente).toLocaleString();
            }
            
            if (fechaMasAntigua && typeof fechaMasAntigua.toDate === 'function') {
                fechaAntiguaStr = fechaMasAntigua.toDate().toLocaleString();
            } else {
                fechaAntiguaStr = new Date(fechaMasAntigua).toLocaleString();
            }
            
            console.log(`📅 Rango de fechas: desde ${fechaAntiguaStr} hasta ${fechaRecienteStr}`);
            }
        
            res.json({
            ok: true,
            saldo: balance,
            data: transacciones,
            summary: {
                total_transactions: transacciones.length,
                currency: 'USD'
            }
            });
        
        } catch (error) {
            console.error('❌ Error al obtener el historial de transacciones:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }

    accountTransactionsBalance = async (req, res) => {
        let { paysatUID } = req.params;
        
        try {
            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
            paysatUID = paysatUID.substring(1);
            }
        
            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
            return res.status(400).json({ 
                ok: false, 
                error: 'paysatUID es requerido y no puede estar vacío' 
            });
            }
        
            // Obtener el documento de movimientos del usuario (nueva estructura)
            const userMovementsDoc = await db.collection('PaySat_Account_Movements')
            .doc(paysatUID)
            .get();
        
            if (!userMovementsDoc.exists) {
            console.log('📊 No se encontraron movimientos para el usuario:', paysatUID);
            return res.json({
                ok: true,
                data: {
                saldo: 0.00
                },
                message: 'No se encontraron movimientos para este usuario'
            });
            }
        
            const userData = userMovementsDoc.data();
            const balance = userData.balance || 0;
        
            console.log(`✅ Saldo total: $${balance}`);
            
            res.json({
            ok: true,
            data: {
                saldo: balance
            }      
            });
        
        } catch (error) {
            console.error('❌ Error al obtener el saldo:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }

    cardTransactionsHistory = async (req, res) => {
        let { paysatUID } = req.params;

        try {
            // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
            paysatUID = paysatUID.substring(1);
            //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
            }

            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
            return res.status(400).json({ 
                ok: false, 
                error: 'paysatUID es requerido y no puede estar vacío' 
            });
            }

            // Obtener los movimientos del usuario desde PaySat_Card_Movements
            const cardMovementsSnapshot = await db.collection('PaySat_Card_Movements')
            .where('paysatUID', '==', paysatUID)
            .get();

            console.log('📊 Movimientos de tarjeta encontrados:', cardMovementsSnapshot.size);

            if (cardMovementsSnapshot.empty) {
            return res.json({
                ok: true,
                saldo: 0.00,
                data: [],
                message: 'No se encontraron movimientos de tarjeta para este usuario'
            });
            }

            // Procesar los movimientos y calcular el saldo
            let saldoTotal = 0.00;
            const transacciones = [];

            cardMovementsSnapshot.forEach(doc => {
            const data = doc.data();
            const typeMovement = data.typeMovement;
            const monto = parseFloat(data.amount) || 0.00;
            
            // Calcular saldo según el tipo de movimiento
            if (typeMovement === 'deposit' || typeMovement === 'recharge') {
                saldoTotal += monto; // Sumar depósitos y recargas
            } else if (typeMovement === 'buy') {
                saldoTotal -= monto; // Restar fees y compras
            } else if (typeMovement === 'fee') {
                saldoTotal -= parseFloat(data.totalFee);        // Aquí puedes manejar otros tipos de movimientos si es necesario
            }

            transacciones.push({
                id: doc.id,
                typeMovement: typeMovement,
                amount: monto,
                amount_cents: data.amount_cents || Math.round(monto * 100),
                currency: data.currency || 'USD',
                
                // Campos específicos según el tipo de movimiento
                ...(typeMovement === 'recharge' && {
                payment_intent_id: data.payment_intent_id || null,
                recharge_id: data.recharge_id || null,
                status: data.status || null
                }),
                
                ...(typeMovement === 'fee' && {
                paysatFee: data.paysatFee || null,
                paysatFee_cents: data.paysatFee_cents || null,
                totalFee: data.totalFee || null,
                net: data.net || null,
                balanceTransactionId: data.balanceTransactionId || null
                }),
                
                ...(typeMovement === 'deposit' && {
                from: data.from || null,
                description: data.description || null,
                email: data.email || null
                }),

                ...(typeMovement === 'buy' && {
                from: data.from || null,
                description: data.description || null,
                email: data.email || null
                }),
                
                PAYSATAccountNumber: data.PAYSATAccountNumber || null,
                
                // Usar la fecha específica del movimiento (priorizar createdAt, luego updatedAt como fallback)
                createdAt: data.createdAt ? data.createdAt : (data.updatedAt || new Date()),
                
                // Incluir también updatedAt si existe para referencia
                ...(data.updatedAt && { updatedAt: data.updatedAt }),
                
                source: data.source || null
            });
            });

            // Ordenar transacciones por fecha y hora (más recientes primero - descendente)
            transacciones.sort((a, b) => {
            // Convertir las fechas, manejando tanto Date objects como Timestamps de Firestore
            let dateA, dateB;
            
            if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                // Es un Timestamp de Firestore
                dateA = a.createdAt.toDate();
            } else if (a.createdAt) {
                // Es un Date object o string
                dateA = new Date(a.createdAt);
            } else {
                dateA = new Date(0); // Fecha mínima como fallback
            }
            
            if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                // Es un Timestamp de Firestore
                dateB = b.createdAt.toDate();
            } else if (b.createdAt) {
                // Es un Date object o string
                dateB = new Date(b.createdAt);
            } else {
                dateB = new Date(0); // Fecha mínima como fallback
            }
            
            // Validar que las fechas sean válidas
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            
            // Ordenamiento descendente: más recientes primero
            return timeB - timeA;
            });

            // Calcular balanceAfter para cada transacción de tarjeta (en orden cronológico inverso)
            let balanceAcumulado = 0.00;
            
            // Primero ordenamos cronológicamente (ascendente) para calcular balances
            const transaccionesOrdenCronologico = [...transacciones].reverse();
            
            // Calcular balance acumulativo para transacciones de tarjeta
            transaccionesOrdenCronologico.forEach(tx => {
            const monto = tx.amount;
            const typeMovement = tx.typeMovement;
            
            // Aplicar el movimiento al balance de la tarjeta
            if (typeMovement === 'deposit' || typeMovement === 'recharge') {
                balanceAcumulado += monto;
            } else if (typeMovement === 'buy') {
                balanceAcumulado -= monto;
            } else if (typeMovement === 'fee') {
                balanceAcumulado -= tx.totalFee || 0;
            }
            
            // Asignar balance después de la transacción
            tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
            });

            // Redondear saldo a 2 decimales
            saldoTotal = parseFloat(saldoTotal.toFixed(2));

            console.log(`✅ Procesados ${transacciones.length} movimientos de tarjeta, saldo total: $${saldoTotal}`);
            
            // Mostrar rango de fechas con manejo correcto de Timestamps
            if (transacciones.length > 0) {
            const fechaMasReciente = transacciones[0].createdAt;
            const fechaMasAntigua = transacciones[transacciones.length - 1].createdAt;
            
            let fechaRecienteStr, fechaAntiguaStr;
            
            // Convertir fechas para logging
            if (fechaMasReciente && typeof fechaMasReciente.toDate === 'function') {
                fechaRecienteStr = fechaMasReciente.toDate().toLocaleString();
            } else {
                fechaRecienteStr = new Date(fechaMasReciente).toLocaleString();
            }
            
            if (fechaMasAntigua && typeof fechaMasAntigua.toDate === 'function') {
                fechaAntiguaStr = fechaMasAntigua.toDate().toLocaleString();
            } else {
                fechaAntiguaStr = new Date(fechaMasAntigua).toLocaleString();
            }
            
            console.log(`📅 Rango de fechas: desde ${fechaAntiguaStr} hasta ${fechaRecienteStr}`);
            console.log(`💳 Balance inicial de tarjeta: $0.00, Balance final: $${saldoTotal}`);
            } else {
            console.log('📅 Rango de fechas: sin movimientos');
            }

            res.json({
            ok: true,
            saldo: saldoTotal,
            data: transacciones,
            summary: {
                total_transactions: transacciones.length,
                total_sessions_found: cardMovementsSnapshot.size,
                currency: 'USD'
            }
            });

        } catch (error) {
            console.error('❌ Error al obtener el historial de transacciones de tarjeta:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }

    cardTransactionsBalance = async (req, res) => {
        let { paysatUID } = req.params;

        try {
            // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
            paysatUID = paysatUID.substring(1);
            //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
            }

            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
            return res.status(400).json({ 
                ok: false, 
                error: 'paysatUID es requerido y no puede estar vacío' 
            });
            }

            // Obtener los movimientos del usuario desde PaySat_Account_Movements
            const movementsSnapshot = await db.collection('PaySat_Card_Movements')
            .where('paysatUID', '==', paysatUID)
            .get();

            console.log('📊 Movimientos encontrados:', movementsSnapshot.size);

            // if (movementsSnapshot.empty) {
            //   return res.json({
            //     ok: true,
            //     data: [],
            //     message: 'No se encontraron movimientos para este usuario'
            //   });
            // }

            // Procesar los movimientos y calcular el saldo
            let saldoTotal = 0.00;

            movementsSnapshot.forEach(doc => {
            const data = doc.data();
            const typeMovement = data.typeMovement;
            const monto = parseFloat(data.amount) || 0.00;
            
            // Calcular saldo según el tipo de movimiento
            if (typeMovement === 'deposit' || typeMovement === 'recharge') {
                saldoTotal += monto; // Sumar depósitos y recargas
            } else if (typeMovement === 'buy') {
                saldoTotal -= monto; // Restar fees y compras
            } else if (typeMovement === 'fee') {
                saldoTotal -= parseFloat(data.totalFee);
            }
            });

            // Obtener información de tarjetas del usuario
            const cardData = await db.collection('Stripe_Issuing_Cards')
            .where('paysatUID', '==', paysatUID)
            .get();

            // Redondear saldo a 2 decimales
            saldoTotal = parseFloat(saldoTotal.toFixed(2));
            console.log(`✅ Saldo total calculado: $${saldoTotal}`);
            res.json({
            ok: true,      
            data: {
                cardId: cardData.empty ? '' : cardData.docs[0].data().stripeCard["id"] || '',
                balance: saldoTotal,
                nameCard: cardData.empty ? '' : cardData.docs[0].data().stripeCard["cardholder"]["name"] || '',
                cardNumber: cardData.empty ? '' : cardData.docs[0].data().stripeCard["last4"] || '',
            }      
            });

        } catch (error) {
            console.error('❌ Error al obtener el saldo:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }

    hasUserCard = async (req, res) => {
        let { paysatUID } = req.params;

        try {
            // console.log('🔍 Obteniendo historial de movimientos para paysatUID:', paysatUID);

            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
            paysatUID = paysatUID.substring(1);
            //   console.log('🧹 paysatUID limpiado (removido :):', paysatUID);
            }

            // Validar que paysatUID no esté vacío después de la limpieza
            if (!paysatUID || paysatUID.trim() === '') {
            return res.status(400).json({ 
                ok: false, 
                error: 'paysatUID es requerido y no puede estar vacío' 
            });
            }

            const cardsSnapshot = await db.collection('Stripe_Issuing_Cards')
            .where('paysatUID', '==', paysatUID)
            .count()
            .get();

            const cardCount = cardsSnapshot.data().count;
            console.log('📊 Tarjetas encontradas:', cardCount);

            res.json({
            ok: true,
            data: {
                cardCount: cardCount
            }      
            });

        } catch (error) {
            console.error('❌ Error al obtener el número de tarjetas:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }
}

export default AppAccountAndCardPaysatTransactionsController;