import { stripe } from '../config/stripe.js';
import { db } from '../config/firebase.js';

export class CardholderRequirementsError extends Error {
  constructor(cardholder, message = 'El cardholder tiene requisitos pendientes en Stripe Issuing. Completa la verificación antes de crear la tarjeta.') {
    super(message);
    this.name = 'CardholderRequirementsError';
    this.code = 'cardholder_requirements';
    this.cardholderId = cardholder?.id;
    this.requirements = cardholder?.requirements || null;
    this.status = cardholder?.status;
  }
}

const TERMS_REQUIREMENTS = [
  'individual.card_issuing.user_terms_acceptance.ip',
  'individual.card_issuing.user_terms_acceptance.date',
];

const hasOutstandingRequirements = (cardholder) => {
  if (!cardholder) return false;
  const req = cardholder.requirements || {};

  return Boolean(
    req.disabled_reason ||
    (Array.isArray(req.currently_due) && req.currently_due.length) ||
    (Array.isArray(req.past_due) && req.past_due.length) ||
    cardholder.status !== 'active'
  );
};

const isTermsAcceptancePending = (requirements = {}) => {
  const pastDue = requirements.past_due || [];
  const currentlyDue = requirements.currently_due || [];
  const combined = [...pastDue, ...currentlyDue];

  return TERMS_REQUIREMENTS.some((field) => combined.includes(field));
};

const acceptCardholderTerms = async (cardholderId, termsAcceptance) => {
  if (!termsAcceptance?.ip || !termsAcceptance?.date) return null;

  return stripe.issuing.cardholders.update(cardholderId, {
    individual: {
      card_issuing: {
        user_terms_acceptance: {
          ip: termsAcceptance.ip,
          date: termsAcceptance.date,
        },
      },
    },
  });
};

/**
 * Asegura que el usuario tenga un cardholder de Stripe Issuing.
 * Guarda el cardholderId en el documento de PaySat_Users.
 */
export async function ensureCardholderForUser(paysatUID, options = {}) {
  const { termsAcceptance } = options;
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
    const cardholderId = cardHolderDoc.id;
    
    // Verificar si el cardholder tiene requisitos pendientes
    try {
      const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);

      // Mantener en Firestore la versión más reciente del cardholder
      await cardHolderDoc.ref.set({ data: cardholder, updatedAt: new Date() }, { merge: true });

      if (hasOutstandingRequirements(cardholder)) {
        console.log('⚠️ Cardholder con requisitos pendientes:', cardholder.requirements);

        if (isTermsAcceptancePending(cardholder.requirements) && termsAcceptance) {
          try {
            const updated = await acceptCardholderTerms(cardholderId, termsAcceptance);
            if (updated) {
              await cardHolderDoc.ref.set({ data: updated, updatedAt: new Date() }, { merge: true });
              if (!hasOutstandingRequirements(updated)) {
                console.log('✅ Cardholder activado tras aceptar términos');
                return { cardholderId, userData };
              }
            }
          } catch (acceptErr) {
            console.log('⚠️ No se pudo aceptar términos automáticamente:', acceptErr.message);
          }
        }

        throw new CardholderRequirementsError(cardholder);
      }

      // Ya existe y está OK, lo reutilizamos
      console.log('✅ Cardholder existente OK:', cardholderId);
      return { cardholderId, userData };
    } catch (err) {
      if (err instanceof CardholderRequirementsError) {
        throw err;
      }
      console.log('⚠️ Error verificando cardholder, se eliminará y creará uno nuevo:', err.message);
      // Eliminar documento de Firestore
      await cardHolderDoc.ref.delete();
    }
  }

  // Si lastName tiene más de una palabra, toma solo la primera
  const safeLastName = (userData.apellidos || '').split(' ')[0];
  const fullName = [userData.primerNombre || '', safeLastName].join(' ').trim() || 'PAYSAT USER';

  // console.log("APELLIDO: ", safeLastName, "--- NOMBRE COMPLETO: ", fullName);

  const cardIssuing = termsAcceptance?.ip && termsAcceptance?.date ? {
    user_terms_acceptance: {
      ip: termsAcceptance.ip,
      date: termsAcceptance.date,
    },
  } : undefined;

  const individualData = {
    first_name: userData.nombres || 'Test',
    last_name: userData.apellidos || 'User',
    dob: {
      day: userData.dobDiaNacimiento || 1,
      month: userData.dobMesNacimiento || 1,
      year: userData.dobAnioNacimiento || 1990,
    },
    ...(cardIssuing ? { card_issuing: cardIssuing } : {}),
  };

  let cardholder = await stripe.issuing.cardholders.create({
    type: 'individual',
    individual: individualData,
    name: fullName,
    email: userData.correo || undefined,
    phone_number: userData.telefono || undefined,
    billing: {
      address: {
        line1: '136 West 9th Street',
        city: 'Bayonne',
        state: "NJ",
        postal_code: '07002',
        country: 'US',
      },
    },
    status: 'active',
    metadata: {
      paysatUID,
      paysatNumeroCuenta: userData.numeroCuentaPAYSAT || '',
    },
    // Agregar spending_controls para definir límites (opcional pero recomendado)
    spending_controls: {
      spending_limits: [
        {
          amount: 1000000, // $10,000 USD en centavos
          interval: 'per_authorization',
        },
      ],
    },
  });

  console.log('✅ Cardholder creado:', cardholder.id);
  
  // Verificar requisitos del cardholder recién creado
  if (hasOutstandingRequirements(cardholder)) {
    console.log('⚠️ Cardholder creado pero tiene requisitos:', cardholder.requirements);

    if (isTermsAcceptancePending(cardholder.requirements) && termsAcceptance) {
      try {
        const updated = await acceptCardholderTerms(cardholder.id, termsAcceptance);
        if (updated) {
          await db.collection('Stripe_CardHolders').doc(cardholder.id).set({ data: updated, updatedAt: new Date() }, { merge: true });
          cardholder = updated;
        }
      } catch (acceptErr) {
        console.log('⚠️ No se pudo aceptar términos automáticamente en creación:', acceptErr.message);
      }
    }
  }

  // Guardar en Firestore
  await db.collection('Stripe_CardHolders').doc(cardholder.id).set({
    paysatUID,
    data: cardholder,    
    createdAt: new Date(),
  });

  if (hasOutstandingRequirements(cardholder)) {
    throw new CardholderRequirementsError(cardholder);
  }

  return { cardholderId: cardholder.id, userData };
}

/**
 * Crea una tarjeta virtual para el usuario y la guarda en Firestore.
 */
export async function createVirtualCardForUser(paysatUID, options = {}) {
  const { termsAcceptance } = options;
  const { cardholderId, userData } = await ensureCardholderForUser(paysatUID, { termsAcceptance });

  const card = await stripe.issuing.cards.create({
    cardholder: cardholderId,
    currency: 'usd',   //<--- Cambiar si es necesario
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
