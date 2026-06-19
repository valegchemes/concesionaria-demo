# Diseño de Correcciones de Seguridad

## Fecha: 2026-06-18

## Resumen
Este documento especifica las correcciones de seguridad identificadas durante la auditoría, organizadas en dos secciones principales:
1. Corrección crítica de implementación de middleware
2. Mejoras de alta prioridad: protección CSRF, manejo estandarizado de errores y limitación de tasa mejorada

---

## Sección 1: Corrección Crítica de Middleware

### Problema
El archivo `proxy.ts` que contiene la lógica de autenticación, inyección de headers multi-tenant y seguridad no está siendo ejecutado por Next.js, lo que potencialmente deja las rutas sin autenticación y sin aislamiento de tenant.

### Solución
Renombrar `proxy.ts` a `middleware.ts` y colocarlo en el directorio raíz del proyecto (mismo nivel que `app/`).

### Detalles de Implementación

#### Archivo a Mover/renombrar
- Desde: `E:\proyectos\Backup\consencionaria windsurf\proxy.ts`
- Hacia: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`

#### Funcionalidades Clave que se Restaurarán
1. **Autenticación JWT**: Validación de tokens para rutas `/api/` y `/app/`
2. **Inyección de Headers Multi-Tenant**:
   - `x-company-id` desde el token JWT
   - `x-user-id` desde el token JWT
   - `x-user-role` desde el token JWT
3. **Protección de Rutas**:
   - Rutas públicas: `/login`, `/register`, `/api/auth`, `/api/webhooks`, `/api/health`, `/_next`, `/favicon.ico`, `/public`, `/catalog`, `/api/email/gmail/callback`, `/api/cron`
   - Rutas API (`/api/`) requieren autenticación válida
   - Rutas de aplicación (`/app/*`) requieren autenticación válida
4. **Headers de Seguridad**:
   - CSP estricto con nonces
   - Headers de seguridad tradicionales (X-Frame-Options, X-Content-Type-Options, etc.)
   - HSTS en producción
   - Deshabilitación de cache

#### Flujo de Request
1. Request llega al servidor
2. Middleware verifica si la ruta es pública
3. Si es pública, continúa sin autenticación pero agrega headers de seguridad
4. Si no es pública:
   - Extrae y valida token JWT de NextAuth
   - Si es ruta API o `/app/*` y token es inválido → 401 Unauthorized
   - Si token es válido:
     - Inyecta headers `x-user-id`, `x-company-id`, `x-user-role`
     - Continúa con la request
     - Agrega headers de seguridad a la response

### Impacto Esperado
- ✅ Restauración del aislamiento multi-tenant mediante inyección automática de `x-company-id`
- ✅ Reactivación de protección de rutas API y de aplicación
- ✅ Reactivación de headers de seguridad (CSP, HSTS, etc.)
- ✅ Base segura para implementaciones adicionales de seguridad

---

## Sección 2: Mejoras de Alta Prioridad

### 2.1 Protección CSRF para APIs

#### Problema
Las rutas API que modifican estado (POST, PUT, PATCH, DELETE) carecen de protección CSRF, haciendo vulnerable a los usuarios autenticados a ataques CSRF.

#### Solución
Implementar middleware de validación CSRF específico para rutas API usando el patrón de doble envío de cookie.

#### Detalles de Implementación

##### Extensión al Middleware Existente
Agregar validación CSRF en `middleware.ts` para:
- Métodos: POST, PUT, PATCH, DELETE
- Rutas: Todas que comiencen con `/api/` (excepto las explícitamente configuradas como exentas mediante variable de entorno CSRF_EXEMPT_ROUTES)
- Mecanismo: Doble envío de cookie
  - Cookie: `X-CSRF-Token` (HttpOnly, SameSite=Strict, Secure en producción)
  - Header: `X-CSRF-Token` (mismo valor que la cookie)
  - Validación: Comparación timing-safe del header vs cookie

##### Flujo CSRF
1. En cualquier respuesta exitoso del servidor, establecer cookie `X-CSRF-Token` con valor aleatorio (excepto para rutas exentas)
2. Para requests no-GET a `/api/*`:
   - Verificar si la ruta está en la lista de exentas (CSRF_EXEMPT_ROUTES)
   - Si no está exenta:
     * Extraer token del header `X-CSRF-Token`
     * Extraer token de cookie `X-CSRF-Token`
     * Comparar usando función timing-safe
     * Si no coinciden → 403 Forbidden
3. Rutas exentas por defecto (webhooks de servicios conocidos): se definirán en CSRF_EXEMPT_ROUTES

#### Manejo de Errores CSRF
- Respuesta: 403 Forbidden
- Cuerpo: `{ error: "Invalid CSRF token" }` (mensaje genérico para evitar información útil a atacantes)
- Headers: Estándar (Content-Type: application/json)

### 2.2 Manejo Estandarizado de Errores

#### Problema
El manejo de errores es inconsistente, con algunas rutas exponiendo stack traces o detalles internos, dificultando la depuración segura y creando riesgos de divulgación de información.

#### Solución
Crear un wrapper centralizado `withErrorHandling` que capture excepciones, las registre de forma segura interna y devuelva respuestas genéricas al cliente.

#### Detalles de Implementación

##### Nuevo Archivo: `lib/shared/error-handling.ts`
```typescript
// Definir clases de error personalizadas para uso consistente
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    defaultErrorMessage?: string;
    logError?: boolean;
    exposeDetailsInDev?: boolean;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Logging interno seguro
    console.error('[Error Handling]', {
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && options?.exposeDetailsInDev ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Determinar mensaje de respuesta
    if (process.env.NODE_ENV === 'development' && options?.exposeDetailsInDev) {
      throw error; // Re-throw en dev si se configuró para exponer detalles
    }

    // Errores conocidos con mensajes específicos
    if (error instanceof ValidationError) {
      throw new Error(error.message);
    }
    if (error instanceof AuthenticationError) {
      throw new Error('Authentication required');
    }
    if (error instanceof PermissionError) {
      throw new Error('Insufficient permissions');
    }

    // Error por defecto
    throw new Error(options?.defaultErrorMessage ?? 'Internal server error');
  }
}
```

##### Integración con Existing Wrappers
Modificar `withErrorHandling` existente en `lib/shared/api-response.ts` para usar este patrón centralizado o asegurar consistencia importando las clases de error y la función desde `lib/shared/error-handling`.

##### Uso en Rutas API
```typescript
import { withErrorHandling } from '@/lib/shared/error-handling';
import { ValidationError } from '@/lib/shared/error-handling'; // Ejemplo de uso

export const POST = withTenantHandler(
  withErrorHandling(async (request) => {
    // lógica de la ruta
    // Ejemplo de lanzamiento de error conocido:
    // if (!valid) throw new ValidationError('Datos de entrada inválidos');
  }, {
    defaultErrorMessage: 'Error procesando la solicitud',
    exposeDetailsInDev: true
  })
)
```

##### Beneficios
- ✅ Evita fugas de stack traces y detalles internos en producción
- ✅ Proporciona mensajes de error consistentes
- ✅ Permite logging detallado interno para depuración
- ✅ Fácil de mantener y extender con nuevos tipos de error
- ✅ Clases de error estandarizadas para uso consistente en toda la aplicación

### 2.3 Mejora de Limitación de Tasa

#### Problema
El identificador de solicitud para limitación de tasa usa únicamente la dirección IP (x-forwarded-for), lo que puede ser falsificado y no proporciona suficiente granularidad para bloquear efectivamente ataques distribuidos sofisticados.

#### Solución
Mejorar `getRequestIdentifier` para incluir validación de proxy confiable y combinar IP con hash de user-agent para crear identificadores más robustos.

#### Detalles de Implementación

##### Archivo a Modificar: `lib/shared/rate-limit-memory.ts`

###### Mejora de `getRequestIdentifier`
```typescript
export function getRequestIdentifier(request: NextRequest): string {
  // Obtener IP con validación de proxy confiable
  const ip = getTrustedIp(request);
  
  // Obtener user-agent y crear hash limitado para evitar valores muy largos
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const uaHash = simpleHash(userAgent.substring(0, 100)); // Primeros 100 chars
  
  // Combinar IP y hash de user-agent
  return `ip:${ip}:ua:${uaHash}`;
}

function getTrustedIp(request: NextRequest): string {
  // Lista de proxies confiables (configurable via env)
  // Formato: lista de IPs separados por coma (ej: "10.0.0.1,10.0.0.2")
  // Para soportar CIDR en el futuro, se podría extender esta función
  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') ?? [];
  
  // Obtener todas las IPs del header x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return request.headers.get('x-real-ip') ?? 'unknown';
  }
  
  const ips = forwardedFor.split(',').map(ip => ip.trim());
  
  // Si tenemos proxies confiables configurados, ir desde el final hacia atrás
  // hasta encontrar una IP no en la lista de proxies confiables
  if (trustedProxies.length > 0) {
    for (let i = ips.length - 1; i >= 0; i--) {
      const ip = ips[i];
      if (!trustedProxies.includes(ip)) {
        return ip;
      }
    }
    // Si todas las IPs son de proxies confiables, usar la primera
    return ips[0];
  }
  
  // Sin proxies confiables configurados, usar la primera IP (comportamiento original)
  return ips[0] ?? 'unknown';
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}
```

###### Configuración de Proxies Confiables
Agregar a `.env.example` y documentación:
```env
# Lista de IPs de proxies confiables (separadas por coma)
# Ejemplo: TRUSTED_PROXIES=10.0.0.1,10.0.0.2 (para entornos detrás de load balancer)
# Dejar vacío si no se usan proxies confiables (comportamiento original)
TRUSTED_PROXIES=
```

###### Nota sobre CIDR
La implementación actual asume IPs exactas en TRUSTED_PROXIES. Para soportar notación CIDR en el futuro, se necesitaría extender la función `getTrustedIp` con una biblioteca de validación de CIDR (como `ip-range-check`). Esta mejora se puede considerar en una iteración futura si se requiere.

#### Beneficios
- ✅ Más resistente a suplantación de IP mediante validación de cadena de proxies
- ✅ Mejor granularidad al incorporar user-agent (diferentes navegadores/dispositivos tienen diferentes user-agents)
- ✅ Reduce falsos positivos/negativos en limitación de tasa
- ✅ Configurable según infraestructura de despliegue
- ✅ Mantiene compatibilidad hacia atrás si TRUSTED_PROXIES no está configurado

---

## Consideraciones de Implementación y Pruebas

### Orden de Implementación
1. **Primero**: Corregir middleware (renombrar proxy.ts → middleware.ts en raíz)
2. **Segundo**: Verificar que la autenticación y inyección de headers funcione correctamente
3. **Tercero**: Implementar middleware CSRF
4. **Cuarto**: Implementar manejo estandarizado de errores
5. **Quinto**: Mejorar limitación de tasa

### Pruebas Requeridas
Después de cada cambio:
1. Verificar que rutas públicas sigan siendo accesibles sin autenticación
2. Verificar que rutas protegidas requieran autenticación válida
3. Verificar que headers `x-company-id`, `x-user-id`, `x-user-role` estén presentes en requests a rutas protegidas
4. Verificar que headers de seguridad estén presentes en todas las responses
5. Probar CSRF:
   - Verificar que requests válidos con token correcto funcionen
   - Verificar que requests sin token o token incorrecto retornen 403
6. Probar manejo de errores:
   - Verificar que errores no expongan stack traces en producción
   - Verificar que mensajes de error sean apropiados
   - Verificar que los errores personalizados (ValidationError, etc.) se manejen correctamente
7. Probar limitación de tasa:
   - Verificar que los límites se apliquen correctamente
   - Verificar que el nuevo identificador funcione como esperado
   - Probar con diferentes valores de TRUSTED_PROXIES

### Riesgos y Mitigaciones
- **Riesgo**: Cambiar middleware podría romper la aplicación si hay errores de configuración
  - **Mitigación**: Implementar en staging primero, tener rollback rápido, probar exhaustivamente en entorno de desarrollo
- **Riesgo**: CSRF podría romper integraciones de terceros
  - **Mitigación**: 
    * Excluir explícitamente webhooks de terceros conocidos mediante CSRF_EXEMPT_ROUTES
    * Ofrecer forma de exentar rutas específicas mediante variable de entorno
    * Implementar en modo de reporte primero (log pero no bloquear) si es necesario
- **Riesgo**: Manejo de errores podría cambiar comportamiento esperado por el frontend
  - **Mitigación**:
    * Comunicar cambios al equipo frontend con anticipación
    * Mantener mensajes de error existentes cuando sea posible (mapear nuevos errores a mensajes antiguos)
    * Probar exhaustivamente las respuestas de error con el frontend

### Métricas de Éxito
- ✅ Todas las requests a rutas protegidas tienen headers `x-company-id`, `x-user-id`, `x-user-role`
- ✅ Todas las responses tienen headers de seguridad (CSP, HSTS, etc.)
- ✅ Requests CSRF inválidos a rutas API modificantes retornan 403
- ✅ Errores no exponen información interna en producción
- ✅ Limitación de tasa efectivamente limita abusos basados en IP+user-agent
- ✅ No hay regresiones en funcionalidad existente verificadas mediante pruebas automatizadas y manuales
- ✅ Los errores personalizados se manejan y devuelven mensajes apropiados al cliente