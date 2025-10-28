import axios from 'axios';

const base64 = (s) => Buffer.from(s).toString('base64');

const client = axios.create({
  baseURL: process.env.MARQETA_BASE_URL,
  headers: {
    'Authorization': 'Basic ' + base64(`${process.env.MARQETA_APP_TOKEN}:${process.env.MARQETA_ACCESS_TOKEN}`),
    'Content-Type': 'application/json'
  },
  timeout: 15000,
});

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
  const { data } = await client.post('/users', body);
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
  const { data } = await client.post('/cards', body);
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
  const { data } = await client.post('/gpaorders', body);
  return { request: body, response: data };
}

// ---------- Consultas ----------
export async function getBalances({ user_token }) {
  const { data } = await client.get('/balances', { params: { user_token } });
  return data;
}
export async function listTransactions(params = {}) {
  const { data } = await client.get('/transactions', { params });
  return data;
}
