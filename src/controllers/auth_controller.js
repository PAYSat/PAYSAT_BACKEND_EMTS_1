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
          fullName: userData.data().fullName ?? userReq.fullName ?? null,
          firstName: userData.data().firstName ?? userReq.firstName ?? null,
          names: userData.data().names ?? null,
          lastName: userData.data().lastName ?? null,
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