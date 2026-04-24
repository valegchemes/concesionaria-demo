@echo off
chcp 65001 >nul

REM Despliegue Manual Windows Batch
REM Instrucciones: reemplaza los valores y ejecuta

echo 🚀 Despliegue Manual - Concesionaria
echo ====================================
echo.
echo IMPORTANTE: Reemplaza los valores antes de ejecutar
echo.

REM CONFIGURA TUS VALORES AQUI:
set SUPABASE_URL=https://tu-proyecto.supabase.co
set SUPABASE_KEY=tu-anon-key-aqui
set BLOB_TOKEN=vercel-blob-token-aqui

echo Valores configurados:
echo SUPABASE_URL: %SUPABASE_URL%
echo SUPABASE_KEY: ***
echo BLOB_TOKEN: ***
echo.

REM Descomenta las lineas de abajo quitando REM y reemplaza los valores arriba

REM echo Agregando variables...
REM echo %SUPABASE_URL% | vercel env add NEXT_PUBLIC_SUPABASE_URL production
REM echo %SUPABASE_KEY% | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production  
REM echo %BLOB_TOKEN% | vercel env add BLOB_READ_WRITE_TOKEN production
REM vercel --prod

echo.
echo Para ejecutar:
echo 1. Edita este archivo y reemplaza los valores
echo 2. Quita REM de las lineas de arriba
echo 3. Guarda y ejecuta de nuevo
echo.

pause
