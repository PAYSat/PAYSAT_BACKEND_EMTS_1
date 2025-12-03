import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

/**
 * Asegura que el usuario tenga un cardholder de Stripe Issuing.
 * Guarda el cardholderId en el documento de PaySat_Users.
 */
export async function ensureCardholderForUser(paysatUID) {
  const userRef = db.collection('PaySat_Users').doc(paysatUID);
  const cardHolderSnap = await db.collection('Stripe_CardHolders')
    .where('paysatUID', '==', paysatUID)
    .limit(1)
    .get();

  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error(`Usuario PaySat_Users no encontrado: ${paysatUID}`);
  }

  const userData = userDoc.data();

  if (!cardHolderSnap.empty) {
    const cardHolderDoc = cardHolderSnap.docs[0];
    // Ya existe, lo reutilizamos
    return { cardholderId: cardHolderDoc.id, userData };
  }

  // Si lastName tiene más de una palabra, toma solo la primera
  const safeLastName = (userData.apellidos || '').split(' ')[0];
  const fullName = [userData.primerNombre || '', safeLastName].join(' ').trim() || 'PAYSAT USER';

  // console.log("APELLIDO: ", safeLastName, "--- NOMBRE COMPLETO: ", fullName);

  const cardholder = await stripe.issuing.cardholders.create({
    type: 'individual',
    individual: {
    first_name: userData.nombres || 'Test',
    last_name: userData.apellidos || 'User',
    dob: {
      day: 1,
      month: 1,
      year: 1990,
    },
  },
    name: fullName,
    email: userData.correo || undefined,
    phone_number: userData.telefono || undefined,
    billing: {
      address: {
        line1: '71-75 Shelton Street',
        city: 'Covent Garden',
        postal_code: 'WC2H 9JQ',
        country: 'GB',
      },
      // address: {
      //   line1: '136 West 9th Street',
      //   city: 'Bayonne',
      //   state: "NJ",
      //   postal_code: '07002',
      //   country: 'US',
      // },
      // address: {
      //   line1: userData.direccionPersonalOCR || 'Address not provided',
      //   city: (userData.ciudad || 'New York'),
      //   state: (userData.provincia || 'NY'),
      //   postal_code: userData.codigoPostal || '11375',
      //   country: (userData.paisCodigoISO || 'US').toLowerCase(),
      // },
    },
    status: 'active',
    metadata: {
      paysatUID,
      paysatNumeroCuenta: userData.numeroCuentaPAYSAT || '',
    },
  });

  // await userRef.update({ stripeCardholderId: cardholder.id });
  db.collection('Stripe_CardHolders').doc(cardholder.id).set({
    paysatUID,
    data: cardholder,    
    createdAt: new Date(),
  });

  return { cardholderId: cardholder.id, userData };
}

/**
 * Crea una tarjeta virtual para el usuario y la guarda en Firestore.
 */
export async function createVirtualCardForUser(paysatUID) {
  const { cardholderId, userData } = await ensureCardholderForUser(paysatUID);

  const card = await stripe.issuing.cards.create({
    cardholder: cardholderId,
    currency: 'gbp',   //<--- Cambiar si es necesario
    type: 'virtual',
    metadata: {
      paysatUID,
      paysatNumeroCuenta: userData.numeroCuentaPAYSAT || '',
      program: 'PAYSAT_MONEY',
    },
    status: 'active',
  });

  console.log("RESPUESTA DE LA CREACION DE TARJETA VIRTUAL:", card);

  // Guardar la tarjeta en una colección propia
  await db.collection('Stripe_Issuing_Cards').doc(card.id).set({
    stripeCard: card,
    paysatUID,
    createdAt: new Date(),
  });

  // Devolvemos sólo lo que el frontend necesita para mostrar info básica
  return {
    id: card.id,
    brand: card.brand,
    type: card.type,
    currency: card.currency,
    status: card.status,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    cardholderId,
  };
}
