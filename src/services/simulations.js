import { marqeta } from '../config/marqeta.js';

/**
 * Simular compra para disparar autorización + JIT + webhooks en sandbox.
 * En 2025 Marqeta impulsa "Simulations 2.0" (single endpoint). Si tu tenant
 * aún expone legacy, usa /simulations/cardtransactions/purchase.*
 * (según tu colección de Postman).
 * Docs (2025): Postman Simulations 2.0. :contentReference[oaicite:15]{index=15}
 */
export async function simulatePurchase(req) {
  try {
    
    const { data } = await marqeta.post('/simulations/cardtransactions/authorization', req);

    // Ejemplo 2 (comentado): Simulations 2.0 (consulta tu spec/tenant):
    // const body2 = { event_type: 'authorization.purchase', card_token, amount, merchant: { mid } };
    // const { data } = await marqeta.post('/simulations', body2);

    return data;
  } catch (e) {
    throw e;
  }
}
