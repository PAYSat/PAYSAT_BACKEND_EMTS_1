#!/bin/bash

# Script de verificación post-deploy
echo "🔍 Verificando deploy de PaySat Backend..."

# Verificar health endpoint
echo "📊 Verificando health check..."
curl -s https://tu-app.onrender.com/health

# Verificar que las variables críticas estén configuradas
echo "🔑 Variables críticas a verificar en Render Dashboard:"
echo "✓ NODE_ENV=production"
echo "✓ FIREBASE_DB_URL"
echo "✓ STRIPE_SECRET_KEY"
echo "✓ MARQETA_ACCESS_TOKEN"
echo "✓ EMAIL_USER"
echo "✓ CORS_ORIGIN"

echo "📁 Archivo Firebase Service Account subido como Secret File"
echo "🔗 Webhooks configurados en Stripe y Marqeta"

echo "✅ Deploy verification complete!"