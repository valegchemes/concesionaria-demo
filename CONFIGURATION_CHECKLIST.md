# 📋 Checklist de Configuración

## Fase 1: Verificación de instalación ✅
- [x] Dependencias instaladas (`@supabase/supabase-js`, `@vercel/blob`)
- [x] Archivos de configuración creados
- [x] Componentes implementados
- [x] Rutas API configuradas

## Fase 2: Configurar Supabase 🔄
- [ ] 1. Crear proyecto en [supabase.com](https://supabase.com)
- [ ] 2. Obtener URL del proyecto
- [ ] 3. Obtener ANON_KEY (clave pública)
- [ ] 4. Obtener SERVICE_ROLE_KEY (clave privada)
- [ ] 5. Copiar credenciales a `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
  ```
- [ ] 6. Guardar `.env.local`
- [ ] 7. En Supabase SQL Editor, ejecutar script de `prisma/units-table.sql`
- [ ] 8. Verificar que tabla `units` se creó
- [ ] 9. Verificar que RLS policies se crearon

## Fase 3: Configurar Vercel Blob 🔄
- [ ] 1. Acceder a [vercel.com](https://vercel.com)
- [ ] 2. Ir a tu proyecto (o crear uno)
- [ ] 3. En **Settings** > **Storage** > **Blob**
- [ ] 4. Crear token de lectura/escritura o copiar existente
- [ ] 5. Agregar a `.env.local`:
  ```env
  BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxx..."
  ```
- [ ] 6. Guardar `.env.local`

## Fase 4: Testear localmente 🔄
- [ ] 1. Reiniciar servidor: `npm run dev`
- [ ] 2. Abrir http://localhost:3000/register
- [ ] 3. Crear cuenta con email de prueba
- [ ] 4. Ir a http://localhost:3000/login
- [ ] 5. Iniciar sesión
- [ ] 6. Ir a http://localhost:3000/app/units/new
- [ ] 7. Llenar formulario:
  - [ ] Marca: "Toyota"
  - [ ] Modelo: "Corolla"
  - [ ] Año: "2023"
  - [ ] Precio: "25000"
  - [ ] Descripción: "Auto en excelente estado"
- [ ] 8. Subir 1-2 imágenes de prueba
- [ ] 9. Hacer clic en "Guardar Unidad"
- [ ] 10. Verificar que se creó sin errores

## Fase 5: Verificar en Supabase 🔄
- [ ] 1. Abrir Supabase Dashboard
- [ ] 2. Ir a **Table Editor**
- [ ] 3. Buscar tabla `units`
- [ ] 4. Verificar que se creó una fila con los datos
- [ ] 5. Verificar que `images` contiene URLs de Vercel Blob

## Fase 6: Verificar en Vercel Blob 🔄
- [ ] 1. Abrir Vercel Dashboard
- [ ] 2. Ir a **Storage** > **Blob**
- [ ] 3. Verificar que las imágenes fueron subidas
- [ ] 4. Verificar que las URLs coinciden con las en Supabase

## Fase 7: Pruebas de seguridad 🔄
- [ ] 1. Crear segunda cuenta (otro email)
- [ ] 2. Iniciar sesión con primera cuenta
- [ ] 3. Crear unidad A
- [ ] 4. Iniciar sesión con segunda cuenta
- [ ] 5. Intentar editar unidad A (debería fallar con 403)
- [ ] 6. Intentar eliminar unidad A (debería fallar con 403)
- [ ] 7. Crear unidad B con segunda cuenta
- [ ] 8. Cambiar a primera cuenta
- [ ] 9. Verificar que puede VER unidad B (lectura pública)
- [ ] 10. Verificar que NO puede editar unidad B

## Fase 8: Limpieza y optimización 🔄
- [ ] 1. Revisar logs de la consola
- [ ] 2. Revisar errores en Network tab (F12)
- [ ] 3. Limpiar datos de prueba si es necesario
- [ ] 4. Documentar cualquier problema encontrado

## Fase 9: Deploy a producción (opcional) 🔄
- [ ] 1. Commit los cambios a git
- [ ] 2. Hacer push a rama principal
- [ ] 3. Vercel despliega automáticamente
- [ ] 4. Verificar que funciona en producción
- [ ] 5. Probar registro/login en URL en vivo

## ⚠️ Si algo no funciona

### Error: "Missing Supabase environment variables"
```bash
# Solución:
1. Verificar que .env.local tiene las 3 variables
2. Guardar archivo
3. Reiniciar: npm run dev
```

### Error: "Unauthorized" al crear unidad
```bash
# Solución:
1. Asegúrate de estar logueado
2. Revisa que el token en localStorage sea válido
3. Verifica que Supabase Auth está habilitado
```

### Imágenes no se suben
```bash
# Solución:
1. Verificar BLOB_READ_WRITE_TOKEN en .env.local
2. Verificar tamaño de imagen (máximo 5MB)
3. Verificar formato (JPG, PNG, GIF, WebP)
4. Revisar Console (F12) para mensajes de error
```

### No puedo crear tabla en Supabase
```bash
# Solución:
1. Copiar exactamente el contenido de prisma/units-table.sql
2. Pegar en SQL Editor de Supabase
3. Hacer clic en "Run"
4. Verificar que no hay errores en output
```

## 📞 Soporte

Si tienes preguntas, revisa:
- `SUPABASE_BLOB_SETUP.md` - Guía detallada
- `IMPLEMENTATION_SUMMARY.md` - Resumen técnico
- Console del navegador (F12) - Errores del cliente
- Vercel Function Logs - Errores del servidor
