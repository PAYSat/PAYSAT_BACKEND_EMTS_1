import { admin } from '../config/firebase.js';

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
          nombreCompleto: userData.data().nombreCompleto ?? userReq.fullName ?? null,
          primerNombre: userData.data().primerNombre ?? userReq.firstName ?? null,
          nombres: userData.data().nombres ?? null,
          apellidos: userData.data().apellidos ?? null,
          telefono: userData.data().telefono ?? userReq.phoneNumber ?? null,
          email: userRecord.email ?? userReq.email ?? null,
          role: userData.data().rol ?? userReq.role ?? null,
          dniDocType: userData.data().dniDocType ?? null,
          dniPersonalNumber: userData.data().dniPersonalNumber ?? null,
          dniExpirationDate: userData.data().dniExpirationDate ?? null,
          pais: userData.data().pais ?? null,
          ciudad: userData.data().ciudad ?? null,
          direccion: userData.data().direccionPersonalOCR ?? null,
          numeroCuentaPAYSAT: userData.data().numeroCuentaPAYSAT ?? null
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