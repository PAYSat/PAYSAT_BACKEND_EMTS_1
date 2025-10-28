import axios from 'axios';

export const circle = axios.create({
  baseURL: process.env.CIRCLE_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` // 2025
  }
});
// Referencia pagos/listing + auth Bearer. :contentReference[oaicite:14]{index=14}
