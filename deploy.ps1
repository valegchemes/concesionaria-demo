# Script de despliegue para PowerShell
# Ejecutar: .\deploy.ps1

Write-Host "🚀 Despliegue Automatizado - Concesionaria" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Vercel CLI
$vercelCheck = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCheck) {
    Write-Host "❌ Vercel CLI no instalado. Instalando..." -ForegroundColor Red
    npm i -g vercel
}

# Verificar login
try {
    $null = vercel whoami 2>&1
} catch {
    Write-Host "🔐 Iniciando sesión en Vercel..." -ForegroundColor Yellow
    vercel login
}

# Pedir variables
Write-Host ""
Write-Host "📋 Configuración de Variables de Entorno" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Green

$SUPABASE_URL = Read-Host "NEXT_PUBLIC_SUPABASE_URL (ej: https://xxx.supabase.co)"
$SUPABASE_KEY = Read-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY"
$BLOB_TOKEN = Read-Host "BLOB_READ_WRITE_TOKEN"
$AUTH_SECRET = Read-Host "NEXTAUTH_SECRET (dejar vacío para generar automático)"

if ([string]::IsNullOrWhiteSpace($AUTH_SECRET)) {
    $AUTH_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    Write-Host "🔑 NEXTAUTH_SECRET generado automáticamente" -ForegroundColor Green
}

Write-Host ""
Write-Host "⚙️  Configurando variables en Vercel..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

# Usar echo para pipe en vez de Here-String
$SUPABASE_URL | vercel env add NEXT_PUBLIC_SUPABASE_URL production
$SUPABASE_KEY | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
$BLOB_TOKEN | vercel env add BLOB_READ_WRITE_TOKEN production
$AUTH_SECRET | vercel env add NEXTAUTH_SECRET production

Write-Host ""
Write-Host "🚀 Iniciando deploy a producción..." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Green
vercel --prod

Write-Host ""
Write-Host "✅ Despliegue completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📌 Post-deploy:" -ForegroundColor Cyan
Write-Host "1. Ejecutar SQL en Supabase Dashboard" -ForegroundColor White
Write-Host "2. Visitar tu app en producción" -ForegroundColor White
