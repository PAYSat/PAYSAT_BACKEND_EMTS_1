import axios from 'axios';
import { marqeta } from '../config/marqeta.js';

// ---------- USERS ----------
export async function createUser({ first_name, last_name, email, external_id }) {
  const body = {
    first_name,
    last_name,
    email,
    // external_id opcional para mapear con tu uid/app
    ...(external_id ? { external_id } : {}),
    // Puedes agregar address, phone, etc. si tu caso lo requiere
  };
  const { data } = await marqeta.post('/users', body);
  return { request: body, response: data };
}

// ---------- USER TOKEN ----------
export async function getMarqetaUserToken(paysatUID) {
  // Buscar el usuario en Marqeta por external_id (que es paysatUID)
  const cardProductDoc = await db.collection('Marqeta_Users').where('paysatUID', '==', paysatUID).limit(1).get();
  if (!cardProductDoc.empty) {
    return cardProductDoc.docs[0].data().marqetaUser["token"] || "";
  } else {
    throw new Error(`Marqeta user not found for paysatUID: ${paysatUID}`);
  }
}

// ---------- CARD PRODUCT TOKEN ----------
export async function getCardProductToken() {
  // Obtener el primer documento de CardProducts
  const cardProductDoc = await db.collection('Marqeta_CardProducts').limit(1).get();
  if (!cardProductDoc.empty) {
    return cardProductDoc.docs[0].data().marqeta_card_product_data["token"] || "";
  } else {
    throw new Error('No Marqeta Card Products found in Firestore');
  }
}

// ---------- CARDS (opcional) ----------
export async function createCard({ user_token, card_product_token }) {
  const body = {
    user_token,
    // En sandbox, pon tu card_product_token; si no tienes, deja uno por defecto de tu programa
    card_product_token,
    expedite: true,
    // Para “virtual”: plastic_code no aplica; Marqeta la marca virtual por card_product setup
  };
  const { data } = await marqeta.post('/cards', body);
  return { request: body, response: data };
}

// ---------- GPA TOP-UP ----------
export async function createGPAOrder({ user_token, amount, currency_code = 'USD', memo, tags }) {
  const body = {
    user_token,
    amount: Number(amount),
    currency_code,
    funding_source_token: 'sandbox_program_funding',
    memo,
    tags
  };
  const { data } = await marqeta.post('/gpaorders', body);
  return { request: body, response: data };
}

// ---------- Consultas ----------
export async function getBalances({ user_token }) {
  const { data } = await marqeta.get('/balances', { params: { user_token } });
  return data;
}
export async function listTransactions(params = {}) {
  const { data } = await marqeta.get('/transactions', { params });
  return data;
}
