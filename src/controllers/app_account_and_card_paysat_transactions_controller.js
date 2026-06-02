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

                    ...(typeMovement === 'transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        feePercentage: mov.feePercentage || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_in' && {
                        description: mov.description || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_out' && {
                        description: mov.description || null,
                        destinationType: mov.destinationType || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        accountNumber: mov.accountNumber || null,
                        status: mov.status || null
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
                const monto = parseFloat(tx.amount) || 0;
                const typeMovement = tx.typeMovement;
                
                // Aplicar el movimiento al balance
                // Todos los amounts vienen positivos, el typeMovement determina si suma o resta
                if (typeMovement === 'deposit' || typeMovement === 'recharge' || typeMovement === 'transfer_received' || typeMovement === 'mobile_transfer_received' || typeMovement === 'external_transfer_in') {
                    balanceAcumulado += monto;
                } else if (typeMovement === 'buy' || typeMovement === 'recharge_card' || typeMovement === 'transfer_sent' || typeMovement === 'mobile_transfer_sent' || typeMovement === 'external_transfer_out') {
                    balanceAcumulado -= monto;
                } else if (typeMovement === 'fee') {
                    const feeAmount = parseFloat(tx.totalFee || tx.amount) || 0;
                    balanceAcumulado -= feeAmount;
                }
                
                // Asegurar que balanceAcumulado sea un número antes de aplicar toFixed
                balanceAcumulado = parseFloat(balanceAcumulado) || 0;
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

    accountTransactionsHistoryPerMonth = async (req, res) => {
        // Obtener datos del body (POST)
        let { paysatUID, fechaDesde, fechaHasta } = req.body;
        
        try {
            // Validar que paysatUID esté presente
            if (!paysatUID || paysatUID.trim() === '') {
                return res.status(400).json({ 
                    ok: false, 
                    error: 'paysatUID es requerido y no puede estar vacío' 
                });
            }

            // Validar que fechaDesde y fechaHasta estén presentes
            if (!fechaDesde || !fechaHasta) {
                return res.status(400).json({ 
                    ok: false, 
                    error: 'fechaDesde y fechaHasta son requeridos' 
                });
            }

            // Convertir las fechas a objetos Date
            const fechaDesdeDate = new Date(fechaDesde);
            const fechaHastaDate = new Date(fechaHasta);

            // Validar que las fechas sean válidas
            if (isNaN(fechaDesdeDate.getTime()) || isNaN(fechaHastaDate.getTime())) {
                return res.status(400).json({ 
                    ok: false, 
                    error: 'Las fechas proporcionadas no son válidas' 
                });
            }

            // Validar que fechaDesde sea anterior o igual a fechaHasta
            if (fechaDesdeDate > fechaHastaDate) {
                return res.status(400).json({ 
                    ok: false, 
                    error: 'fechaDesde debe ser anterior o igual a fechaHasta' 
                });
            }

            // Limpiar el paysatUID de caracteres no deseados al inicio
            if (paysatUID.startsWith(':')) {
                paysatUID = paysatUID.substring(1);
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

                    ...(typeMovement === 'transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        feePercentage: mov.feePercentage || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_in' && {
                        description: mov.description || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_out' && {
                        description: mov.description || null,
                        destinationType: mov.destinationType || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        accountNumber: mov.accountNumber || null,
                        status: mov.status || null
                    }),
                    
                    PAYSATAccountNumber: mov.PAYSATAccountNumber || null,
                    createdAt: mov.createdAt || null,
                    updatedAt: mov.updatedAt || null,
                    source: mov.source || null
                };
            });

            // Filtrar transacciones por rango de fechas
            console.log(`🔍 Filtrando transacciones desde ${fechaDesde} hasta ${fechaHasta}`);
            const transaccionesFiltradas = transacciones.filter(tx => {
                if (!tx.createdAt) return false;
                
                let txDate;
                if (tx.createdAt && typeof tx.createdAt.toDate === 'function') {
                    txDate = tx.createdAt.toDate();
                } else {
                    txDate = new Date(tx.createdAt);
                }

                // Validar que la fecha sea válida
                if (isNaN(txDate.getTime())) return false;

                // Comparar con el rango de fechas (inclusive)
                // Establecer fechaHasta al final del día para incluir todas las transacciones de ese día
                const fechaHastaFinal = new Date(fechaHastaDate);
                fechaHastaFinal.setHours(23, 59, 59, 999);

                return txDate >= fechaDesdeDate && txDate <= fechaHastaFinal;
            });

            console.log(`📊 Transacciones después del filtrado: ${transaccionesFiltradas.length} de ${transacciones.length}`);

            // Si no hay transacciones en el rango, retornar respuesta vacía
            if (transaccionesFiltradas.length === 0) {
                return res.json({
                    ok: true,
                    saldo: balance,
                    data: [],
                    message: 'No se encontraron movimientos en el rango de fechas especificado',
                    summary: {
                        total_transactions: 0,
                        currency: 'USD',
                        date_range: {
                            from: fechaDesde,
                            to: fechaHasta
                        }
                    }
                });
            }
    
            // Ordenar transacciones por fecha (más recientes primero - descendente)
            transaccionesFiltradas.sort((a, b) => {
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
            const transaccionesOrdenCronologico = [...transaccionesFiltradas].reverse();
            
            transaccionesOrdenCronologico.forEach(tx => {
                const monto = parseFloat(tx.amount) || 0;
                const typeMovement = tx.typeMovement;
                
                // Aplicar el movimiento al balance
                // Todos los amounts vienen positivos, el typeMovement determina si suma o resta
                if (typeMovement === 'deposit' || typeMovement === 'recharge' || typeMovement === 'transfer_received' || typeMovement === 'mobile_transfer_received' || typeMovement === 'external_transfer_in') {
                    balanceAcumulado += monto;
                } else if (typeMovement === 'buy' || typeMovement === 'recharge_card' || typeMovement === 'transfer_sent' || typeMovement === 'mobile_transfer_sent' || typeMovement === 'external_transfer_out') {
                    balanceAcumulado -= monto;
                } else if (typeMovement === 'fee') {
                    const feeAmount = parseFloat(tx.totalFee || tx.amount) || 0;
                    balanceAcumulado -= feeAmount;
                }
                
                // Asegurar que balanceAcumulado sea un número antes de aplicar toFixed
                balanceAcumulado = parseFloat(balanceAcumulado) || 0;
                tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
            });

            console.log(`✅ Procesados ${transaccionesFiltradas.length} movimientos en el rango especificado, saldo: $${balance}`);
        
            // Mostrar rango de fechas
            if (transaccionesFiltradas.length > 0) {
                const fechaMasReciente = transaccionesFiltradas[0].createdAt;
                const fechaMasAntigua = transaccionesFiltradas[transaccionesFiltradas.length - 1].createdAt;
                
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
                data: transaccionesFiltradas,
                summary: {
                    total_transactions: transaccionesFiltradas.length,
                    currency: 'USD',
                    date_range: {
                        from: fechaDesde,
                        to: fechaHasta
                    }
                }
            });
        
        } catch (error) {
            console.error('❌ Error al obtener el historial de transacciones por mes:', error);
            res.status(500).json({ 
            ok: false, 
            error: 'Internal server error',
            details: error.message 
            });
        }
    }

    accountTransactionsHistoryLastFour = async (req, res) => {
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

                    ...(typeMovement === 'transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        feePercentage: mov.feePercentage || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_sent' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        fee: mov.fee || null,
                        total: mov.total || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'mobile_transfer_received' && {
                        originUID: mov.originUID || null,
                        destinationUID: mov.destinationUID || null,
                        userName: mov.userName || null,
                        reason: mov.reason || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_in' && {
                        description: mov.description || null,
                        originType: mov.originType || null,
                        originAffiliateName: mov.originAffiliateName || null,
                        status: mov.status || null
                    }),

                    ...(typeMovement === 'external_transfer_out' && {
                        description: mov.description || null,
                        destinationType: mov.destinationType || null,
                        destinationPhoneNumber: mov.destinationPhoneNumber || null,
                        accountNumber: mov.accountNumber || null,
                        status: mov.status || null
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

            // Tomar solo las últimas 4 transacciones (las más recientes)
            const ultimasCuatroTransacciones = transacciones.slice(0, 4);
        
            // Calcular balanceAfter para cada transacción (en orden cronológico)
            let balanceAcumulado = 0.00;
            const transaccionesOrdenCronologico = [...ultimasCuatroTransacciones].reverse();
            
            transaccionesOrdenCronologico.forEach(tx => {
                const monto = parseFloat(tx.amount) || 0;
                const typeMovement = tx.typeMovement;
                
                // Aplicar el movimiento al balance
                // Todos los amounts vienen positivos, el typeMovement determina si suma o resta
                if (typeMovement === 'deposit' || typeMovement === 'recharge' || typeMovement === 'transfer_received' || typeMovement === 'mobile_transfer_received' || typeMovement === 'external_transfer_in') {
                    balanceAcumulado += monto;
                } else if (typeMovement === 'buy' || typeMovement === 'recharge_card' || typeMovement === 'transfer_sent' || typeMovement === 'mobile_transfer_sent' || typeMovement === 'external_transfer_out') {
                    balanceAcumulado -= monto;
                } else if (typeMovement === 'fee') {
                    const feeAmount = parseFloat(tx.totalFee || tx.amount) || 0;
                    balanceAcumulado -= feeAmount;
                }
                
                // Asegurar que balanceAcumulado sea un número antes de aplicar toFixed
                balanceAcumulado = parseFloat(balanceAcumulado) || 0;
                tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
            });

            console.log(`✅ Procesados ${ultimasCuatroTransacciones.length} movimientos (últimas 4 transacciones), saldo: $${balance}`);
        
            // Mostrar rango de fechas
            if (ultimasCuatroTransacciones.length > 0) {
                const fechaMasReciente = ultimasCuatroTransacciones[0].createdAt;
                const fechaMasAntigua = ultimasCuatroTransacciones[ultimasCuatroTransacciones.length - 1].createdAt;
                
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
                data: ultimasCuatroTransacciones,
                summary: {
                    total_transactions: ultimasCuatroTransacciones.length,
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
            const userMovementsDoc = await db.collection('Banco_PaySat_Money')
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
            const balance = userData.customerBalance || 0;
        
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
                userEmail: mov.userEmail || null,
                userName: mov.userName || null,
                description: mov.description || null,
                status: mov.status || null
                }),
                
                ...(typeMovement === 'fee' && {
                paysatFee: mov.paysatFee || null,
                paysatFee_cents: mov.paysatFee_cents || null,
                totalFee: mov.totalFee || null,
                net: mov.net || null,
                balanceTransactionId: mov.balanceTransactionId || null
                }),
                
                ...(typeMovement === 'deposit' && {
                from: mov.from || null,
                description: mov.description || null,
                email: mov.email || null,
                userName: mov.userName || null
                }),

                ...(typeMovement === 'buy' && {
                from: mov.from || null,
                description: mov.description || null,
                email: mov.email || null
                }),

                ...(typeMovement === 'transfer_sent' && {
                originUID: mov.originUID || null,
                destinationUID: mov.destinationUID || null,
                userName: mov.userName || null,
                reason: mov.reason || null,
                fee: mov.fee || null,
                total: mov.total || null,
                feePercentage: mov.feePercentage || null,
                status: mov.status || null
                }),

                ...(typeMovement === 'transfer_received' && {
                originUID: mov.originUID || null,
                destinationUID: mov.destinationUID || null,
                userName: mov.userName || null,
                reason: mov.reason || null,
                status: mov.status || null
                }),
                
                PAYSATAccountNumber: mov.PAYSATAccountNumber || null,
                
                // Usar la fecha específica del movimiento
                createdAt: mov.createdAt || mov.updatedAt || new Date(),
                
                // Incluir también updatedAt si existe para referencia
                ...(mov.updatedAt && { updatedAt: mov.updatedAt }),
                
                source: mov.source || null
            };
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

            // Calcular balanceAfter para cada transacción (en orden cronológico inverso)
            let balanceAcumulado = 0.00;
            
            // Primero ordenamos cronológicamente (ascendente) para calcular balances
            const transaccionesOrdenCronologico = [...transacciones].reverse();
            
            // Calcular balance acumulativo
            transaccionesOrdenCronologico.forEach(tx => {
            const monto = tx.amount;
            const typeMovement = tx.typeMovement;
            
            // Aplicar el movimiento al balance
            // Todos los amounts vienen positivos, el typeMovement determina si suma o resta
            if (typeMovement === 'deposit' || typeMovement === 'recharge' || typeMovement === 'transfer_received' || typeMovement === 'mobile_transfer_received' || typeMovement === 'external_transfer_in') {
                balanceAcumulado += monto;
            } else if (typeMovement === 'buy' || typeMovement === 'recharge_card' || typeMovement === 'transfer_sent' || typeMovement === 'mobile_transfer_sent' || typeMovement === 'external_transfer_out') {
                balanceAcumulado -= monto;
            } else if (typeMovement === 'fee') {
                balanceAcumulado -= (tx.totalFee || tx.amount || 0);
            }
            
            // Asignar balance después de la transacción
            tx.balanceAfter = parseFloat(balanceAcumulado.toFixed(2));
            });

            console.log(`✅ Procesados ${transacciones.length} movimientos, saldo total: $${balance}`);
            
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
            console.log(`💳 Balance final: $${balance}`);
            } else {
            console.log('📅 Rango de fechas: sin movimientos');
            }

            res.json({
            ok: true,
            saldo: balance,
            data: transacciones,
            summary: {
                total_transactions: transacciones.length,
                total_movements_found: movements.length,
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

    cardTransactionsBalance = async (req, res) => {
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
            
            // Obtener información de tarjetas del usuario
            const cardData = await db.collection('Stripe_Issuing_Cards')
            .where('paysatUID', '==', paysatUID)
            .get();

            return res.json({
                ok: true,
                data: {
                cardId: cardData.empty ? '' : cardData.docs[0].data().stripeCard["id"] || '',
                balance: 0.00,
                nameCard: cardData.empty ? '' : cardData.docs[0].data().stripeCard["cardholder"]["name"] || '',
                cardNumber: cardData.empty ? '' : cardData.docs[0].data().stripeCard["last4"] || '',
                },
                message: 'No se encontraron movimientos para este usuario'
            });
            }

            const userData = userMovementsDoc.data();
            const balance = userData.customerBalance || 0;

            // Obtener información de tarjetas del usuario
            const cardData = await db.collection('Stripe_Issuing_Cards')
            .where('paysatUID', '==', paysatUID)
            .get();

            console.log(`✅ Saldo total: $${balance}`);
            
            res.json({
            ok: true,      
            data: {
                cardId: cardData.empty ? '' : cardData.docs[0].data().stripeCard["id"] || '',
                balance: balance,
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