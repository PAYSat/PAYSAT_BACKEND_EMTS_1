import axios from 'axios';

export const marqeta = axios.create({
  baseURL: process.env.MARQETA_BASE, // v3 Core API (2025)
  auth: {
    username: process.env.MARQETA_APP_TOKEN,
    password: process.env.MARQETA_ACCESS_TOKEN
  },
  headers: { 'Content-Type': 'application/json' }
});
// Core API 2025: emisión/gestión de tarjetas, usuarios, etc. :contentReference[oaicite:13]{index=13}
