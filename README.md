# Concesionaria SaaS

CRM + Inventario + Operaciones para concesionarias de vehículos usados (autos, motos, náutica) en Argentina.

## Stack Tecnológico

- **Framework**: Next.js 14+ (App Router) + TypeScript
- **Base de datos**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Credenciales email/password) con bcrypt
- **UI**: Tailwind CSS + shadcn/ui
- **Tablas**: TanStack Table
- **Forms**: react-hook-form + zod

## Características Principales

### Multi-tenant
- Cada concesionaria tiene su propia cuenta aislada
- Soporte de subdominio (`{slug}.tuapp.com`) y dominio personalizado
- Roles: ADMIN y SELLER

### CRM + Leads
- Pipeline: NEW → CONTACTED → VISIT_SCHEDULED → OFFER → RESERVED → SOLD → LOST
- Tareas obligatorias con alertas de seguimiento
- Integración WhatsApp (wa.me) con plantillas variables
- Fuentes: Instagram, Facebook Marketplace, Referidos, etc.

### Inventario (Unidades)
- Tipos: Autos, Motos, Lanchas
- Atributos dinámicos por tipo
- Precios en ARS y USD
- Control de costos y margen real

### Catálogo Público
- Mini-sitio por concesionaria
- URL pública por unidad
- Tracking de clicks a WhatsApp

### Operaciones (Deals)
- Registro de ventas y permutas
- Comisiones a vendedores
- Gastos de cierre
- Conversión de permuta a stock

## Requisitos

- Node.js 18+
- PostgreSQL 15+
- Docker (opcional)

## Instalación Local

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concesionaria?schema=public"
NEXTAUTH_SECRET="tu-secret-key-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Iniciar base de datos con Docker

```bash
docker-compose up -d db
```

O usar PostgreSQL local.

### 4. Migrar y seedear la base de datos

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Cuentas de Demo

Después de correr el seed, puedes ingresar con:

- **Admin**: admin@demo.com / admin123
- **Vendedor**: vendedor@demo.com / seller123
- **Company slug**: demo

## Estructura del Proyecto

```
app/
├── (public)/          # Catálogo público (por host)
│   ├── page.tsx       # Listado de unidades
│   └── u/[id]/        # Detalle de unidad
├── app/               # Panel privado (requiere auth)
│   ├── dashboard/     # Dashboard principal
│   ├── leads/         # Gestión de leads
│   ├── units/         # Inventario
│   ├── deals/         # Operaciones
│   └── settings/      # Configuración
├── api/               # API routes
│   ├── auth/          # NextAuth
│   ├── units/         # CRUD unidades
│   └── leads/         # CRUD leads
├── login/             # Página de login
components/
├── ui/                # Componentes shadcn/ui
├── app-sidebar.tsx    # Navegación
└── app-header.tsx     # Header
lib/
├── prisma.ts          # Cliente Prisma
├── auth.ts            # Helpers de auth
├── tenant.ts          # Resolución multi-tenant
└── utils.ts           # Utilidades
prisma/
├── schema.prisma      # Esquema de BD
└── seed.ts            # Datos de demo
```

## Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run db:generate` - Generar Prisma Client
- `npm run db:migrate` - Crear migración
- `npm run db:seed` - Seedear base de datos
- `npm run db:reset` - Reset + seed

## Deploy con Docker

```bash
docker-compose up -d
```

Esto inicia:
- App en http://localhost:3000
- PostgreSQL en puerto 5432
- Adminer en http://localhost:8080

## Roadmap

- [x] Scaffold Next.js + Prisma
- [x] Auth con NextAuth
- [x] CRUD Unidades
- [x] CRUD Leads
- [x] Catálogo público por host
- [x] Docker + docker-compose
- [ ] Importación/Exportación Excel
- [ ] Vista planilla (TanStack Table)
- [ ] Tracking clicks WhatsApp
- [ ] API WhatsApp Business (futuro)

## Licencia

MIT
