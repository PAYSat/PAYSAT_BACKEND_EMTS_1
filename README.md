# El webhook de STRIPE se ejecuta dentro de marqeta_webhook.js
# Se está utilizando NODEMAILER para el envío de correos.
# En frontend envía un token de comprobación para que middleware valide y se ejecuten las consultas.


# MATAR PROCESO E INICIAR SERVIDOR NODE
pkill -f "node.*server.js" && sleep 2 && npm start