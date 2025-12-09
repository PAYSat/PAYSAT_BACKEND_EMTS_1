import { Router } from 'express';
import { publishableKey } from '../config/stripe.js';

const router = Router();

/**
 * GET /secure-cards/view?card_id=...
 * Renderiza una página con Issuing Elements para mostrar PAN/EXP/CVC de la tarjeta.
 */
router.get('/view', (req, res) => {
  const cardId = req.query.card_id;

  if (!cardId) {
    return res.status(400).send('Missing card_id');
  }

  if (!publishableKey) {
    return res.status(500).send('Missing STRIPE_PUBLISHABLE_KEY');
  }

  // ✅ Configurar CSP como header HTTP (más prioritario que meta tag)
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' https://js.stripe.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  const html = `<!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="UTF-8" />
                    <title>PAYSAT - Tarjeta virtual</title>
                    <script src="https://js.stripe.com/v3/"></script>
                    <style>
                      * { box-sizing: border-box; }
                      body {
                        margin: 0;
                        padding: 16px;
                        background: #020b1a;
                        color: #ffffff;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      }
                      .wrapper { max-width: 420px; margin: 0 auto; }
                      .title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
                      .subtitle { font-size: 13px; opacity: 0.8; margin-bottom: 20px; }
                      .card-container {
                        position: relative;
                        border-radius: 18px;
                        padding: 16px 18px;
                        background: radial-gradient(circle at 0% 0%, #f1e07e 0%, #46c7f8 40%, #2147d9 100%);
                        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
                        overflow: hidden;
                        min-height: 190px;
                      }
                      .card-logo {
                        position: absolute;
                        top: 12px;
                        right: 18px;
                        font-weight: 700;
                        font-size: 16px;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                      }
                      .card-chip {
                        width: 42px;
                        height: 30px;
                        border-radius: 6px;
                        background: linear-gradient(135deg, #f1e07e, #ffe797);
                        margin-bottom: 18px;
                      }
                      .card-label {
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.15em;
                        opacity: 0.85;
                      }
                      .card-value {
                        font-size: 17px;
                        font-weight: 500;
                        margin-top: 4px;
                        margin-bottom: 10px;
                      }
                      .card-row { display: flex; gap: 16px; margin-top: 6px; }
                      .card-col { flex: 1; }
                      .card-footer {
                        position: absolute;
                        bottom: 10px;
                        left: 18px;
                        right: 18px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        font-size: 11px;
                        opacity: 0.9;
                      }
                      .visa-mark { font-size: 20px; font-weight: 700; }
                      .badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 999px;
                        background: rgba(0, 0, 0, 0.25);
                        font-size: 10px;
                      }
                      .hint { margin-top: 14px; font-size: 11px; opacity: 0.7; line-height: 1.4; }
                      #error-message { margin-top: 10px; font-size: 12px; color: #ffb3b3; }
                    </style>
                  </head>
                  <body>
                    <div class="wrapper">
                      <div class="title">Ver datos de tu tarjeta PAYSAT</div>
                      <div class="subtitle">
                        Estos datos son sensibles. No compartas capturas de pantalla y asegúrate de estar en un entorno seguro.
                      </div>

                      <div class="card-container">
                        <div class="card-logo">PAYSAT</div>
                        <div class="card-chip"></div>

                        <div class="card-label">Número de tarjeta</div>
                        <div id="card-number" class="card-value"></div>

                        <div class="card-row">
                          <div class="card-col">
                            <div class="card-label">Vence</div>
                            <div id="card-expiry" class="card-value"></div>
                          </div>
                          <div class="card-col">
                            <div class="card-label">CVC</div>
                            <div id="card-cvc" class="card-value"></div>
                          </div>
                        </div>

                        <div class="card-footer">
                          <span class="badge">Virtual • Stripe Issuing</span>
                          <span class="visa-mark">VISA</span>
                        </div>
                      </div>

                      <div id="error-message"></div>

                      <div class="hint">
                        Si no ves la información de la tarjeta, vuelve a intentarlo o cierra esta vista y ábrela nuevamente desde tu app PAYSAT.
                      </div>
                    </div>

                        <script>
                      (function () {
                        var params = new URLSearchParams(window.location.search);
                        var cardId = params.get('card_id');
                        var token = params.get('token'); // 👈 token de Firebase que viene desde Flutter

                        if (!cardId) {
                          document.getElementById('error-message').textContent =
                            'No se encontró card_id en la URL.';
                          return;
                        }

                        if (typeof Stripe === 'undefined') {
                          document.getElementById('error-message').textContent =
                            'No se pudo cargar Stripe.js. Revisa tu conexión a Internet desde este dispositivo.';
                          return;
                        }

                        var stripe = Stripe('${publishableKey}'); // ya la tienes en el template
                        var elements = stripe.elements();

                        function showError(message) {
                          var el = document.getElementById('error-message');
                          el.textContent =
                            message || 'Ocurrió un error cargando la información de la tarjeta.';
                        }

                        async function initIssuingElements() {
                          try {
                            console.log('➡️ creando nonce para card:', cardId);
                            var nonceResult = await stripe.createEphemeralKeyNonce({
                              issuingCard: cardId,
                            });

                            if (nonceResult.error) {
                              console.error('❌ Error nonce:', nonceResult.error);
                              showError('No se pudo inicializar la tarjeta (nonce).');
                              return;
                            }

                            var nonce = nonceResult.nonce;
                            console.log('🟢 Nonce OK:', nonce);

                            console.log('➡️ llamando a /api/issuing/ephemeral-keys');

                            var res = await fetch('/api/issuing/ephemeral-keys', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': token ? 'Bearer ' + token : '',
                              },
                              body: JSON.stringify({
                                card_id: cardId,
                                nonce: nonce,
                              }),
                            });

                            console.log('⬅️ respuesta /api/issuing/ephemeral-keys:', res.status);

                            if (!res.ok) {
                              var errorText = await res.text();
                              console.error('❌ Error HTTP:', res.status, errorText);
                              showError(
                                'No se pudo obtener autorización para ver la tarjeta. (' +
                                  res.status +
                                  ')',
                              );
                              return;
                            }

                            var data = await res.json();
                            var ephemeralKeySecret = data.ephemeralKeySecret;

                            if (!ephemeralKeySecret) {
                              showError('Respuesta inválida al obtener ephemeral key.');
                              return;
                            }

                            console.log('🟢 ephemeralKeySecret OK, montando Elements');

                            var numberEl = elements.create('issuingCardNumberDisplay', {
                              issuingCard: cardId,
                              nonce: nonce,
                              ephemeralKeySecret: ephemeralKeySecret,
                              style: {
                                base: {
                                  color: '#ffffff',
                                  fontSize: '17px',
                                  fontFamily:
                                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                  letterSpacing: '0.12em',
                                },
                              },
                            });
                            numberEl.mount('#card-number');

                            var expiryEl = elements.create('issuingCardExpiryDisplay', {
                              issuingCard: cardId,
                              nonce: nonce,
                              ephemeralKeySecret: ephemeralKeySecret,
                              style: {
                                base: {
                                  color: '#ffffff',
                                  fontSize: '14px',
                                  fontFamily:
                                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                },
                              },
                            });
                            expiryEl.mount('#card-expiry');

                            var cvcEl = elements.create('issuingCardCvcDisplay', {
                              issuingCard: cardId,
                              nonce: nonce,
                              ephemeralKeySecret: ephemeralKeySecret,
                              style: {
                                base: {
                                  color: '#ffffff',
                                  fontSize: '14px',
                                  fontFamily:
                                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                },
                              },
                            });
                            cvcEl.mount('#card-cvc');
                          } catch (err) {
                            console.error('💥 Error inicializando Issuing Elements', err);
                            showError();
                          }
                        }

                        initIssuingElements();
                      })();
                    </script>

                  </body>
                </html>`;

  res.send(html);
});

export default router;
