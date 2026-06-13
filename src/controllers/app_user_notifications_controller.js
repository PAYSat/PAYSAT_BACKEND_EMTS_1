import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';


class AppUserNotificationsController {

  // Método para listar notificaciones de transferencias de un usuario
  async listTransferNotifications(req, res) {
    try {
      // 1. VALIDAR AUTENTICACIÓN
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          ok: false,
          message: 'Usuario no autenticado'
        });
      }

      const uid = req.user.uid;
      const { fechaInicio, fechaFin } = req.body;

    //   console.log(`[RANGO DE FECHAS] Usuario ${uid} solicitó notificaciones desde ${fechaInicio} hasta ${fechaFin}`);

      // 2. VALIDAR FECHAS
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          ok: false,
          message: 'Los campos fechaInicio y fechaFin son requeridos'
        });
      }

      // Convertir strings de fecha a objetos Date
      const startDate = new Date(fechaInicio);
      const endDate = new Date(fechaFin);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          ok: false,
          message: 'Las fechas proporcionadas no son válidas'
        });
      }

      // 3. OBTENER DOCUMENTO DE NOTIFICACIONES DEL USUARIO
      const userNotificationsRef = db.collection('PaySat_User_Notifications').doc(uid);
      const userNotificationsDoc = await userNotificationsRef.get();

      if (!userNotificationsDoc.exists) {
        return res.status(200).json({
          ok: true,
          notifications: [],
          count: 0,
          message: 'No se encontraron notificaciones para este usuario'
        });
      }

      const userData = userNotificationsDoc.data();
      const allNotifications = userData.notifications || [];

    //   console.log(`[NOTIFICACIONES TOTALES] Usuario ${uid} tiene ${allNotifications.length} notificaciones`);
      
      // Mostrar ejemplo de fecha si hay notificaciones
      if (allNotifications.length > 0) {
        // console.log(`[EJEMPLO FECHA] Primera notificación createdAt: "${allNotifications[0].createdAt}"`);
      }

      // 4. FILTRAR POR RANGO DE FECHAS
      const filteredNotifications = allNotifications.filter(notification => {
        if (!notification.createdAt) {
        //   console.log('[FILTRO] Notificación sin createdAt, descartada');
          return false;
        }

        // Parsear la fecha en formato español a un objeto Date
        // Formatos esperados: 
        // - "21 de abril de 2026 a las 1:19:08 p.m. UTC-5"
        // - "12 de junio de 2026, 10:30:15 a. m."
        try {
          const dateStr = notification.createdAt;
          
          // Regex más flexible para manejar diferentes formatos
          // Captura: día, mes, año, hora, minuto, segundo, am/pm
          const dateMatch = dateStr.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d+)(?:,?\s+a\s+las?)?\s+(\d+):(\d+):(\d+)\s+(a\.\s?m\.|p\.\s?m\.)/i);
          
          if (!dateMatch) {
            // console.log(`[FILTRO] No se pudo parsear la fecha: "${dateStr}"`);
            return false;
          }

          const day = parseInt(dateMatch[1]);
          const monthName = dateMatch[2].toLowerCase();
          const year = parseInt(dateMatch[3]);
          let hour = parseInt(dateMatch[4]);
          const minute = parseInt(dateMatch[5]);
          const second = parseInt(dateMatch[6]);
          const ampm = dateMatch[7].toLowerCase().replace(/\s/g, ''); // Eliminar espacios

          // Convertir mes español a número
          const monthMap = {
            'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
            'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
          };

          const month = monthMap[monthName];
          if (month === undefined) {
            // console.log(`[FILTRO] Mes no reconocido: "${monthName}"`);
            return false;
          }

          // Convertir hora a formato 24h
          if (ampm === 'p.m.' && hour !== 12) {
            hour += 12;
          } else if (ampm === 'a.m.' && hour === 12) {
            hour = 0;
          }

          // Crear objeto Date (UTC-5 se maneja como hora local Ecuador)
          const notificationDate = new Date(year, month, day, hour, minute, second);

          // console.log(`[FILTRO] Fecha parseada: ${notificationDate.toISOString()}, Rango: ${startDate.toISOString()} - ${endDate.toISOString()}`);

          // Comparar con el rango de fechas (incluir todo el día final)
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          endDatePlusOne.setMilliseconds(-1); // Final del día
          
          const isInRange = notificationDate >= startDate && notificationDate <= endDatePlusOne;
          // console.log(`[FILTRO] Notificación ${isInRange ? 'INCLUIDA' : 'EXCLUIDA'}`);
          
          return isInRange;
        } catch (error) {
          console.error('[FILTRO] Error parseando fecha de notificación:', error);
          return false;
        }
      });

      // 5. ORDENAR DE FORMA DESCENDENTE (más recientes primero)
      filteredNotifications.sort((a, b) => {
        try {
          // Parsear fechas para ordenar
          const parseSpanishDate = (dateStr) => {
            // Regex más flexible
            const dateMatch = dateStr.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d+)(?:,?\s+a\s+las?)?\s+(\d+):(\d+):(\d+)\s+(a\.\s?m\.|p\.\s?m\.)/i);
            if (!dateMatch) return new Date(0);

            const day = parseInt(dateMatch[1]);
            const monthName = dateMatch[2].toLowerCase();
            const year = parseInt(dateMatch[3]);
            let hour = parseInt(dateMatch[4]);
            const minute = parseInt(dateMatch[5]);
            const second = parseInt(dateMatch[6]);
            const ampm = dateMatch[7].toLowerCase().replace(/\s/g, '');

            const monthMap = {
              'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
              'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
            };

            const month = monthMap[monthName];
            if (month === undefined) return new Date(0);

            if (ampm === 'p.m.' && hour !== 12) {
              hour += 12;
            } else if (ampm === 'a.m.' && hour === 12) {
              hour = 0;
            }

            return new Date(year, month, day, hour, minute, second);
          };

          const dateA = parseSpanishDate(a.createdAt);
          const dateB = parseSpanishDate(b.createdAt);

          return dateB.getTime() - dateA.getTime(); // Descendente
        } catch (error) {
          return 0;
        }
      });

      console.log(`[RESULTADO FINAL] ${filteredNotifications.length} notificaciones filtradas de ${allNotifications.length} totales`);

      // Visualizar los datos que se van a enviar
    //   console.log('\n========== DATOS A ENVIAR AL FRONTEND ==========');
    //   console.log('Usuario UID:', uid);
    //   console.log('Rango de fechas:', { fechaInicio, fechaFin });
    //   console.log('Total notificaciones:', filteredNotifications.length);
    //   console.log('\n--- NOTIFICACIONES FILTRADAS ---');
    //   filteredNotifications.forEach((notif, index) => {
    //     console.log(`\nNotificación ${index + 1}:`);
    //     console.log('  Title:', notif.title);
    //     console.log('  Body:', notif.body);
    //     console.log('  Token Transaction:', notif.tokenTransaction);
    //     console.log('  Created At:', notif.createdAt);
    //   });
    //   console.log('\n================================================\n');

      // 6. MARCAR NOTIFICACIONES COMO LEÍDAS
      if (filteredNotifications.length > 0) {
        // Actualizar todas las notificaciones para marcar las filtradas como leídas
        const updatedNotifications = allNotifications.map(notification => {
          // Verificar si esta notificación está en las filtradas
          const isFiltered = filteredNotifications.some(
            filtered => filtered.tokenTransaction === notification.tokenTransaction
          );
          
          if (isFiltered) {
            return { ...notification, read: true };
          }
          return notification;
        });

        // Actualizar el documento en Firestore
        await userNotificationsRef.update({
          notifications: updatedNotifications
        });

        console.log(`✅ Marcadas ${filteredNotifications.length} notificaciones como leídas`);
      }

      // 7. RESPUESTA EXITOSA
      return res.status(200).json({
        ok: true,
        notifications: filteredNotifications,
        count: filteredNotifications.length,
        rangoFechas: {
          inicio: fechaInicio,
          fin: fechaFin
        }
      });

    } catch (error) {
      console.error('Error en listTransferNotifications:', error);
      return res.status(500).json({
        ok: false,
        message: 'Error al obtener las notificaciones',
        error: error.message
      });
    }
  }

  async saveLoginNotification(req, res) {
    try {
      // 1. VALIDAR AUTENTICACIÓN
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          ok: false,
          message: 'Usuario no autenticado'
        });
      }

      const uid = req.user.uid;
      const { email, deviceInfo } = req.body;

      console.log(`[SAVE LOGIN NOTIFICATION] Usuario ${uid} inició sesión con email: ${email}, dispositivo: ${deviceInfo || 'N/A'}`);

      // 2. VALIDAR DATOS REQUERIDOS
      if (!email) {
        return res.status(400).json({
          ok: false,
          message: 'El campo email es requerido'
        });
      }

      // 3. CONSTRUIR NOTIFICACIÓN
      const title = 'Has iniciado sesión en PAYSAT';
      let body = `Has iniciado sesión con:\n${email}`;
      
      // Agregar información del dispositivo si está disponible
      if (deviceInfo) {
        body += `\n\nDispositivo: ${deviceInfo}`;
      }

      // Generar token de transacción único para el login
      const tokenTransaction = `login_${uuidv4()}`;

      // Crear timestamp en formato legible español Ecuador
      const createdAt = new Date().toLocaleString('es-EC', { 
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });

      const notificationEntry = {
        title,
        body,
        tokenTransaction,
        createdAt,
        read: false
      };

      // 4. GUARDAR NOTIFICACIÓN EN FIRESTORE
      const userNotificationsRef = db.collection('PaySat_User_Notifications').doc(uid);
      
      await userNotificationsRef.set({
        notifications: admin.firestore.FieldValue.arrayUnion(notificationEntry)
      }, { merge: true });

      console.log(`✅ Notificación de login guardada para usuario ${uid}`);
      console.log('Notificación:', notificationEntry);

      // 5. RESPUESTA EXITOSA
      return res.status(200).json({
        ok: true,
        message: 'Notificación de login guardada exitosamente',
        notification: notificationEntry
      });

    } catch (error) {
      console.error('Error en saveLoginNotification:', error);
      return res.status(500).json({
        ok: false,
        message: 'Error al guardar la notificación de login',
        error: error.message
      });
    }
  }

  async getUnreadNotificationsCount(req, res) {
    try {
      // 1. VALIDAR AUTENTICACIÓN
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          ok: false,
          message: 'Usuario no autenticado'
        });
      }

      const uid = req.user.uid;

      // 2. OBTENER DOCUMENTO DE NOTIFICACIONES DEL USUARIO
      const userNotificationsRef = db.collection('PaySat_User_Notifications').doc(uid);
      const userNotificationsDoc = await userNotificationsRef.get();

      // Si no existe el documento, retornar 0
      if (!userNotificationsDoc.exists) {
        return res.status(200).json({
          ok: true,
          unreadCount: 0,
          message: 'No hay notificaciones para este usuario'
        });
      }

      const userData = userNotificationsDoc.data();
      const allNotifications = userData.notifications || [];

      // 3. CONTAR NOTIFICACIONES NO LEÍDAS (read === false)
      const unreadNotifications = allNotifications.filter(
        notification => notification.read === false
      );

      const unreadCount = unreadNotifications.length;

      // 4. RESPUESTA EXITOSA
      return res.status(200).json({
        ok: true,
        unreadCount: unreadCount,
        totalNotifications: allNotifications.length
      });

    } catch (error) {
      console.error('Error en getUnreadNotificationsCount:', error);
      return res.status(500).json({
        ok: false,
        message: 'Error al obtener el conteo de notificaciones no leídas',
        error: error.message
      });
    }
  }
}

export default AppUserNotificationsController;