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
                        background: #000000;
                        color: #cad1d9;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      }
                      .wrapper { max-width: 420px; margin: 0 auto; }
                      .title { font-size: 18px; margin-bottom: 12px; }
                      .subtitle { font-size: 13px; opacity: 0.8; margin-bottom: 20px; line-height: 1.4; }
                      
                      .card-container {
                        position: relative;
                        border-radius: 18px;
                        padding: 24px 80px 7px 24px;
                        background-image: url('https://firebasestorage.googleapis.com/v0/b/paysatv2.firebasestorage.app/o/assets%2Fcard%2Fcard_security_view.png?alt=media&token=a0ed37a3-d28d-41b7-828a-477d0c9eb87a');
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;
                        box-shadow: 0 0 0 1px rgba(229, 199, 107, 0.12);
                        overflow: hidden;
                        aspect-ratio: 1.58 / 1; /* Mantiene la proporción estándar de una tarjeta de crédito */
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-end; /* Empuja los datos hacia la parte inferior simulando el diseño original */
                      }
                      
                      .card-label {
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        opacity: 0.7;
                        margin-bottom: 2px;
                      }
                      
                      .card-value {
                        font-size: 17px;
                        font-weight: 500;
                        /*margin-bottom: 14px;*/
                        min-height: 22px; /* Evita saltos de línea mientras carga Stripe */
                      }
                      
                      .card-row { 
                        display: flex; 
                        gap: 32px; 
                        margin-top: 15px;
                      }
                      
                      .card-col { 
                        flex: 1; 
                      }
                      
                      .card-footer {
                        display: flex;
                        position: absolute;
                        top: 20px;
                        right: 20px;    
                        align-items: center;
                        justify-content: space-between;
                        margin-top: 4px;
                      }
                      
                      .badge {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.15);
                        backdrop-filter: blur(4px);
                        -webkit-backdrop-filter: blur(4px);
                        font-size: 10px;
                        font-weight: 500;
                      }
                      
                      .hint { margin-top: 18px; font-size: 11px; opacity: 0.7; line-height: 1.4; }
                      #error-message { margin-top: 10px; font-size: 12px; color: #ffb3b3; }
                    </style>
                  </head>
                  <body>     
                    <div class="wrapper">
                      <div class="title">Tu tarjeta PAYSAT</div>
                      <div class="subtitle">
                        Estos datos son sensibles. No compartas capturas de pantalla y asegúrate de estar en un entorno seguro.
                      </div>
                
                      <div class="card-container">
                        <div>
                          <div class="card-label">Número de tarjeta</div>
                          <div id="card-number" class="card-value"></div>
                        </div>
                
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
                          <span></span>
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
                        var token = params.get('token'); 
                
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
                
                        var stripe = Stripe('${publishableKey}'); 
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
                              nonce: nonce,
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
                                  color: '#cad1d9',
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
                                  color: '#cad1d9',
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
                                  color: '#cad1d9',
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
