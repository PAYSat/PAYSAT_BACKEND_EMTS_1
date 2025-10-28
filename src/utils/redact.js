// Remueve/oculta secretos antes de guardar en Firestore

export function redactEphemeralKey(eph) {
  if (!eph) return eph;
  const clone = structuredClone(eph);
  if (clone.secret) clone.secret = '***REDACTED***';
  return clone;
}

export function redactPaymentIntent(pi) {
  if (!pi) return pi;
  const clone = structuredClone(pi);
  // client_secret es sensible
  if (clone.client_secret) clone.client_secret = '***REDACTED***';
  // next_action si incluyera datos sensibles (raro), podrías sanitizar aquí
  return clone;
}

// Útil para respuestas del backend al cliente (no guardar secretos)
export function redactBackendResponseToClient(obj) {
  if (!obj) return obj;
  const clone = structuredClone(obj);
  // Si por error alguien intenta guardar la respuesta tal cual, evitamos client_secret y eph secret
  if (clone.paymentIntent && typeof clone.paymentIntent === 'string') {
    clone.paymentIntent = '***REDACTED***';
  }
  if (clone.ephemeralKey && typeof clone.ephemeralKey === 'string') {
    clone.ephemeralKey = '***REDACTED***';
  }
  return clone;
}
