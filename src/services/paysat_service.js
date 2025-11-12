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
 * Obtiene el Marqeta User Token desde Firebase
 */
export async function getMarqetaUserToken(paysatUID) {
  // console.log('🔍 Buscando usuario Marqeta para paysatUID:', paysatUID);
  
  // Buscar el usuario en Marqeta por external_id (que es paysatUID)
  const cardProductDoc = await db.collection('Marqeta_Users').where('paysatUID', '==', paysatUID).limit(1).get();
  if (!cardProductDoc.empty) {
    const userToken = cardProductDoc.docs[0].data().marqetaUser["token"] || "";
    // console.log('✅ Usuario Marqeta encontrado, token:', userToken);
    return userToken;
  } else {
    console.error('❌ Usuario Marqeta no encontrado para paysatUID:', paysatUID);
    throw new Error(`Marqeta user not found for paysatUID: ${paysatUID}`);
  }
}


/**
 * Obtiene el numeroCuentaPAYSAT de un usuario
 */
export async function getUserAccountNumber(paysatUID) {
  try {
    const userDoc = await db.collection('PaySat_Users').doc(paysatUID).get();
    if (!userDoc.exists) {
      throw new Error(`Usuario no encontrado: ${paysatUID}`);
    }
    
    const userData = userDoc.data();
    if (!userData.numeroCuentaPAYSAT) {
      throw new Error(`numeroCuentaPAYSAT no encontrado para usuario: ${paysatUID}`);
    }

    return userDoc.data().numeroCuentaPAYSAT;

  } catch (error) {
    console.error('❌ Error obteniendo numeroCuentaPAYSAT:', error);
    throw error;
  }
}


/**
 * Obtiene el Funding Source Token de Firestore
 */
export async function getFundingSourceToken() {
  try {
    const fundingSourcesRef = db.collection('Marqeta_FundingSources');
    const snapshot = await fundingSourcesRef.limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('No se encontró funding source en Firebase');
    }
    
    const token = snapshot.docs[0].data().marqeta_funding_source_data["token"];
    return token; // El token está como ID del documento

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
    const fundingSourcesRef = db.collection('Marqeta_CardProducts');
    const snapshot = await fundingSourcesRef.limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('No se encontró card product en Firebase');
    }
    
    const token = snapshot.docs[0].data().marqeta_card_product_data["token"];
    return token; // El token está como ID del documento
    
  } catch (error) {
    console.error('Error obteniendo card product token:', error);
    return null;
  }
}


