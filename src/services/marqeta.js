import axios from 'axios';
import { marqeta } from '../config/marqeta.js';
import { db } from '../config/firebase.js';

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
export async function createGPAOrder({ user_token, amount, currency_code = 'USD', funding_source_token }) {
  const body = {
    user_token: user_token,
    amount: parseFloat(amount).toFixed(2),
    currency_code: currency_code,
    funding_source_token: funding_source_token
  };
  
  console.log('📊 GPA Order payload:', body);
  
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
