import { db } from '../config/firebase.js';

/**
 * Obtiene los datos de un usuario
 */
export async function getPaySatUserData(paysatUID) {
  try {
    const userDoc = await db.collection('PaySat_Users')
                            .doc(paysatUID)
                            .get();
    if (!userDoc.exists) {
      throw new Error(`Usuario no encontrado: ${paysatUID}`);
    }
    
    return userDoc.data();

  } catch (error) {
    console.error('❌ Error obteniendo datos de usuario PAYSAT:', error);
    throw error;
  }
}

/**
 * Obtiene el PAYSATAccountNumber de un usuario
 */
export async function getUserAccountNumber(paysatUID) {
  try {
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      throw new Error(`Usuario no encontrado: ${paysatUID}`);
    }
    
    const userData = userDoc.data();
    if (!userData.PAYSATAccountNumber) {
      throw new Error(`PAYSATAccountNumber no encontrado para usuario: ${paysatUID}`);
    }

    return userDoc.data().PAYSATAccountNumber;

  } catch (error) {
    console.error('❌ Error obteniendo PAYSATAccountNumber:', error);
    throw error;
  }
}

/**
 * Obtiene el Funding Source Token de Firestore
 */
export async function getFundingSourceToken() {
  try {
    const snapshot = await db.collection('Stripe_FundingSources').limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('No se encontró funding source en Firebase');
    }
    
    const fundingData = snapshot.docs[0].data();
    const token = fundingData.token || snapshot.docs[0].id;
    
    return token;

  } catch (error) {
    console.error('Error obteniendo funding source token:', error);
    return null;
  }
}

/**
 * Obtiene el Card Product Token de Firestore
 */
export async function getCardProductToken() {
  try {
    const snapshot = await db.collection('Stripe_CardProducts').limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('No se encontró card product en Firebase');
    }
    
    const cardProductData = snapshot.docs[0].data();
    const token = cardProductData.token || snapshot.docs[0].id;
    
    return token;
    
  } catch (error) {
    console.error('Error obteniendo card product token:', error);
    return null;
  }
}

