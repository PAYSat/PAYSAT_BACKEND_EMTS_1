import { admin, db } from '../config/firebase.js';
import { emailService } from '../services/send_email_service.js';

export const userProfile = async (req, res) => {
  try {
    const userReq = req.user || {};
    if (!userReq.uid) {
      return res.status(401).json({ ok: false, message: 'No auth' });
    }

    // ¡OJO! Aquí siempre usa admin.auth(), JAMÁS db.auth()
    const userRecord = await admin.auth().getUser(userReq.uid);

    const userData = await admin.firestore().collection('PaySat_Users').doc(userReq.uid).get();    
    
    if (userData.exists) {
      // Formar el objeto de respuesta primero
      const dataProfile = {
        ok: true,
        data: {
          uid: userReq.uid,
          imageUrlUser: userData.data().imageUrlUser ?? userReq.imageUrlUser ?? null,
          fullName: userData.data().fullName ?? userReq.fullName ?? null,
          firstName: userData.data().firstName ?? userReq.firstName ?? null,
          names: userData.data().names ?? null,
          lastName: userData.data().lastNames ?? null,
          phoneNumber: userData.data().phoneNumber ?? userReq.phoneNumber ?? null,
          phoneCountryCode: userData.data().phoneCountryCode ?? userReq.phoneCountryCode ?? null,
          phoneCountryISO2: userData.data().phoneCountryISO2 ?? userReq.phoneCountryISO2 ?? null,
          phoneShort: userData.data().phoneShort ?? userReq.phoneShort ?? null,
          email: userRecord.email ?? userReq.email ?? null,
          role: userData.data().role ?? userReq.role ?? null,
          dniDocType: userData.data().dniDocType ?? null,
          dniPersonalNumber: userData.data().dniPersonalNumber ?? null,
          dniExpirationDate: userData.data().dniExpirationDate ?? null,
          country: userData.data().country ?? null,
          city: userData.data().city ?? null,
          ocrPersonalAddress: userData.data().ocrPersonalAddress ?? null,
          PAYSATAccountNumber: userData.data().PAYSATAccountNumber ?? null,
          firstLogin: userData.data().firstLogin ?? null,
        }
      };

      // Aquí puedes hacer cualquier manipulación adicional con dataProfile
      // console.log('Datos del perfil formados:', dataProfile);
      
      // Finalmente enviar la respuesta
      return res.json(dataProfile);
    }

    // Si el usuario no existe en Firestore, devolver error
    return res.status(404).json({ ok: false, message: 'Usuario no encontrado en Firestore' });

  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Error /auth/userprofile', details: e.message });
  }
};

export const sendWelcomeEmailToUser = async (req, res) => {
  try {
    let { firstName, email, loginMethod } = req.body;    
    
    // Validaciones
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'El campo "email" es requerido'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Formato de email inválido'
      });
    }

    // console.log(`UID-MARCE:`, req.user.uid);


    // Buscar usuario en la colección PaySat_Users
    const usersRef = db.collection('PaySat_Users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      // Si no existe en PaySat_Users, buscar por UID
      const snapshotByUid = await usersRef.where('uid', '==', req.user.uid).limit(1).get();
      
      if (snapshotByUid.empty) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuario no encontrado en la colección' 
        });
      }
      
      const userData = snapshotByUid.docs[0].data();
      firstName = userData.firstName || userData.names || 'Usuario';
      const result = await emailService.sendWelcomeEmail({ 
        firstName: firstName || email?.split('@')[0] || 'Usuario',
        email,
        loginMethod // Puedes usar esta info para personalizar el email según el método de login
      });
      
      if (result.success) {
        return res.status(200).json({
          ok: true,
          message: 'Email de bienvenida enviado exitosamente',
          data: {
            email,
            loginMethod,
            sentAt: new Date().toISOString()
          }
        });
      } else {
        return res.status(500).json({
          ok: false,
          error: 'Error al enviar el email de bienvenida',
          details: result.error?.message || result.error
        });
      }
    }

    const userData = snapshot.docs[0].data();
    firstName = userData.firstName || userData.names || 'Usuario';
    const result = await emailService.sendWelcomeEmail({ firstName, email, loginMethod });
    
    if (result.success) {
      return res.status(200).json({
        ok: true,
        message: 'Email de bienvenida enviado exitosamente',
        data: {
          email,
          loginMethod,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      return res.status(500).json({
        ok: false,
        error: 'Error al enviar el email de bienvenida',
        details: result.error?.message || result.error
      });
    }

  } catch (error) {
    console.error('Error en endpoint send-welcome-email:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};