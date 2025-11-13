#!/usr/bin/env node

import http from 'http';

console.log('🔍 Probando endpoint de historial de transacciones...');

const options = {
  hostname: 'localhost',
  port: 8001,
  path: '/api/paysat/users/cards/transactions/history/O7xrIZdwN1QPWqwIWwi3Jtv8lSp1',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.ok && response.data && Array.isArray(response.data)) {
        console.log(`✅ Respuesta exitosa: ${response.data.length} transacciones`);
        console.log('📅 Primeras 3 transacciones (ordenamiento descendente):');
        
        response.data.slice(0, 3).forEach((tx, index) => {
          let fechaStr;
          if (tx.createdAt && tx.createdAt._seconds) {
            // Timestamp de Firestore
            const fecha = new Date(tx.createdAt._seconds * 1000);
            fechaStr = fecha.toLocaleString();
          } else {
            fechaStr = new Date(tx.createdAt).toLocaleString();
          }
          
          console.log(`  ${index + 1}. ID: ${tx.id.substring(0, 20)}... | $${tx.amount} | ${fechaStr}`);
        });
        
        // Verificar ordenamiento
        const fechas = response.data.map(tx => {
          if (tx.createdAt && tx.createdAt._seconds) {
            return tx.createdAt._seconds * 1000;
          } else {
            return new Date(tx.createdAt).getTime();
          }
        });
        
        const isDescending = fechas.every((fecha, i) => i === 0 || fechas[i - 1] >= fecha);
        console.log(`\n📊 Ordenamiento descendente: ${isDescending ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
        
      } else {
        console.log('❌ Error en la respuesta:', response);
      }
    } catch (error) {
      console.error('❌ Error parseando respuesta:', error.message);
      console.log('Datos recibidos:', data.substring(0, 200));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error.message);
});

req.on('timeout', () => {
  console.error('⏱️ Timeout - El servidor no respondió');
  req.destroy();
});

req.end();