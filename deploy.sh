#!/bin/bash
# Script de despliegue automatizado
# Requiere: valores de variables de entorno

set -e

echo "🚀 Despliegue Automatizado - Concesionaria"
echo "=========================================="
echo ""

# Verificar si Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI no instalado. Instalando..."
    npm i -g vercel
fi

# Verificar login
if ! vercel whoami &> /dev/null; then
    echo "🔐 Iniciando sesión en Vercel..."
    vercel login
fi

# Leer variables de entorno
echo ""
echo "📋 Configuración de Variables de Entorno"
echo "----------------------------------------"

read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_KEY
read -p "BLOB_READ_WRITE_TOKEN: " BLOB_TOKEN
read -p "NEXTAUTH_SECRET (dejar vacío para generar automático): " AUTH_SECRET

if [ -z "$AUTH_SECRET" ]; then
    AUTH_SECRET=$(openssl rand -base64 32)
    echo "🔑 NEXTAUTH_SECRET generado automáticamente"
fi

echo ""
echo "⚙️  Configurando variables en Vercel..."
echo "----------------------------------------"

vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$SUPABASE_KEY"
vercel env add BLOB_READ_WRITE_TOKEN production <<< "$BLOB_TOKEN"
vercel env add NEXTAUTH_SECRET production <<< "$AUTH_SECRET"

echo ""
echo "🚀 Iniciando deploy a producción..."
echo "----------------------------------------"
vercel --prod

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📌 Post-deploy:"
echo "1. Ejecutar SQL en Supabase Dashboard"
echo "2. Visitar: https://tu-app.vercel.app/login"
