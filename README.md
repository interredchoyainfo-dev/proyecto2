# Complejo Giovanni – Plataforma SaaS Multi-Tenant

Sistema de administración y operación para complejos deportivos, gastronómicos y de entretenimiento.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (dark mode)
- Zustand + React Context (Auth + Config tenant)
- React Router v7 (path-based multi-tenancy `/:negocioId/*`)
- PWA ready (vite-plugin-pwa)
- Material Symbols + Manrope

## Arranque rápido

```bash
npm install
npm run dev
```

Abrí: **http://localhost:5175/giovanni/dashboard**

### Usuarios demo

| Email | Password | PIN | Rol |
|-------|----------|-----|-----|
| admin@complejogiovanni.com | admin123 | 1234 | admin |
| mozo@complejogiovanni.com | mozo123 | 5678 | mozo |
| cocina@complejogiovanni.com | cocina123 | 9012 | cocina |
| super@giovanni.com | super123 | - | superadmin |

## Arquitectura implementada (Fase 1)

```
src/
├── App.tsx                     # Router maestro (SuperAdmin + Tenant)
├── context/AuthContext.tsx     # Login email/PIN + roles
├── core/
│   ├── guards/
│   │   ├── AdminGuard.tsx
│   │   ├── RoleGuard.tsx
│   │   └── ModuleGuard.tsx     # Feature-flag por plan
│   └── services/ConfigContext.tsx  # Tenant dinámico
├── layouts/AdminLayout.tsx     # Sidebar + Header con módulos filtrados
├── modules/admin/LoginPage.tsx
├── components/                 # Módulos de negocio (Dashboard, Reservas, POS, Caja…)
└── types/index.ts              # Modelos multi-tenant completos
```

### Rutas principales

- `/:negocioId/login` – Login
- `/:negocioId/dashboard` – Dashboard admin
- `/:negocioId/reservas` – Reservas (ModuleGuard)
- `/:negocioId/pos` – Punto de Venta
- `/:negocioId/caja` – Control de Caja
- `/:negocioId/clientes`
- `/:negocioId/app/mozos` – (placeholder) App Mozos
- `/:negocioId/cocina` – (placeholder) KDS
- `/superadmin/*` – (placeholder) Consola SaaS

## Próximas fases

2. Mesas + Pedidos + KDS real
3. App Mozos PWA + WebSockets
4. Delivery + Tracking
5. IoT Smart Center
6. SuperAdmin + Marketplace de módulos
7. TV Signage

## Multi-Tenant

Tenants mock actuales: `giovanni` (full) y `demo` (básico).  
El `ConfigProvider` carga branding y módulos activos según el `negocioId` de la URL.

## Fase 2 – Mesas + Pedidos + Cocina KDS (implementado)

- **Mesas / Salón** (`/:negocioId/mesas`): grilla visual de mesas por sector, estados (Libre / Ocupada / Reservada / Cuenta pedida), apertura de pedido, carga de productos y cierre de mesa.
- **Cocina KDS** (`/:negocioId/cocina`): pantalla de comandas en tiempo real. Tocá un ítem para ciclar su estado (pendiente → en marcha → listo → entregado).
- Store dedicado `useMesasStore` con persistencia.
- Productos ampliados (hamburguesas, milanesas, etc.) con destino de comanda (cocina/bar).

### Flujo típico
1. En Mesas → tocá una mesa Libre → se abre pedido.
2. Agregá productos (hamburguesa, papas, etc.).
3. Los ítems de cocina aparecen automáticamente en **Cocina KDS**.
4. El cocinero avanza el estado tocando la tarjeta.
5. Cuando el cliente pide la cuenta → "Pedir cuenta".
6. Cobrá y "Cerrar mesa".

## Fase 3 – App Mozos PWA (implementado)

Ruta: `/:negocioId/app/mozos`

### Características
- **Layout móvil** optimizado (max-width, bottom navigation)
- **Mesas**: grilla táctil grande con estados de color
- **Tomar pedido**: carta de productos + lista del pedido actual
- **Enviar a Cocina**: cambia estado del pedido → aparece en KDS
- **Pedir Cuenta**
- **Cobrar y Cerrar**: genera movimiento de ingreso en Caja (si la caja está abierta) y libera la mesa
- **Venta de mostrador** (sin mesa)
- Login con rol `mozo` (PIN 5678) redirige naturalmente

### Cómo probar el flujo completo
1. Login como mozo: `mozo@complejogiovanni.com` / `mozo123` o PIN `5678`
2. Ir a `/giovanni/app/mozos`
3. Tocar una mesa libre → agregar productos → "Enviar a Cocina"
4. En otra pestaña abrir `/giovanni/cocina` → ver la comanda
5. Volver al mozo → "Cobrar y Cerrar"
6. Verificar en **Caja** que se registró el ingreso

## Fase 4 – Delivery App + Notificaciones en tiempo real

### Notificaciones
- Toast system global con sonido (Web Audio API)
- Cuando Cocina marca un ítem como **listo** → suena beep + toast “¡Pedido listo! Mesa X”
- Notificaciones de entrega completada

### App Delivery (`/:negocioId/app/delivery`)
- Layout móvil (igual estilo que Mozos)
- **Pedidos listos** para retirar
- **Tomar pedido** → pasa a “En camino”
- **Entregado** → registra ingreso en Caja + notificación
- Historial de entregas
- Botón “+ Demo” para generar pedido de prueba

### Usuarios nuevos
| Email | Password | PIN | Rol |
|-------|----------|-----|-----|
| delivery@complejogiovanni.com | delivery123 | 7890 | delivery |

### Flujo de prueba Delivery
1. Login como delivery (PIN 7890)
2. Tocá “+ Demo” → se crea un pedido listo
3. “Tomar pedido”
4. En “En camino” → “Entregado”
5. Verificá en Caja el ingreso

## Fase 5 – SuperAdmin SaaS Console

Ruta: `/superadmin` (solo rol `superadmin`)

### Funcionalidades
- **Dashboard** global: total negocios, activos, trials, usuarios
- **Negocios (Tenants)**: listado, búsqueda, crear nuevo, suspender/activar
- **Detalle de Tenant**: cambiar plan, activar/desactivar módulos uno por uno
- **Planes**: catálogo Trial / Basic / Pro / Enterprise
- **Módulos**: catálogo completo con conteo de adopción

### Login SuperAdmin
- Email: `super@giovanni.com`
- Password: `super123`
- Redirige automáticamente a `/superadmin`

## Fase 6 – Espacios, TV Signage y login simplificado

### Login simplificado
Todos los usuarios usan contraseña **admin**:

| Usuario | Rol | PIN |
|---------|-----|-----|
| admin | Admin panel | 1234 |
| mozo | App Mozos | 5678 |
| cocina | KDS Cocina | 9012 |
| delivery | App Delivery | 7890 |
| super | SuperAdmin | 0000 |
| recepcion | Recepción | 3456 |

### Espacios / Canchas (`/:negocioId/espacios`)
- Crear, editar, desactivar y eliminar espacios
- Tipos: Fútbol, Padel, Tenis, Quincho, etc.
- Precio por hora
- Integrado con Reservas y Dashboard

### TV Signage (`/:negocioId/pantalla/turnos`)
- Pantalla fullscreen para TV
- Estado en vivo de todas las canchas
- Reloj + próximos turnos del día
- Ideal para lobby / recepción

## Fase 7 – Portal del Cliente

Rutas públicas del tenant:

| Ruta | Descripción |
|------|-------------|
| `/:negocioId` | Home del cliente |
| `/:negocioId/reservar` | Flujo de reserva (espacio → fecha/hora → datos) |
| `/:negocioId/menu` | Menú + carrito + pedido mostrador |
| `/:negocioId/mis-reservas` | Consulta de turnos por teléfono |

- Diseño móvil (bottom nav)
- Las reservas aparecen en el panel admin y actualizan el estado del espacio
- Los pedidos del menú llegan a cocina/mostrador y generan notificación

## Base de datos SQLite + API

### Cómo arrancar

```bash
npm install
npm run dev:all
```

Esto levanta:
- **API** en `http://localhost:3001` (SQLite en `server/data/giovanni.sqlite`)
- **Frontend** en `http://localhost:5173` (o el puerto de Vite)

Solo frontend (modo offline con IndexedDB):
```bash
npm run dev
```

Solo API:
```bash
npm run server
```

### Qué se guarda en SQLite

| Tabla | Contenido |
|-------|-----------|
| productos | Inventario / bar |
| mesas | Mesas del salón |
| espacios | Canchas / salones |
| reservas | Turnos de canchas |
| pedidos + pedido_items | Pedidos de mesa/bar/delivery |
| clientes | Clientes |
| ofertas | Promociones |
| caja_sesion / caja_movimientos | Caja |

### Sync

Al abrir la app, `DbSync` baja un snapshot desde `/api/sync` y cada 5s refresca.
Los cambios de pedidos, mesas y reservas se envían a la API automáticamente.
Si la API no está, la app sigue con datos locales (IndexedDB).

## Producción: API, SuperAdmin y seguridad

La aplicación web (Vite/Vercel) y la API Express con SQLite son servicios distintos. **No configures la API como `localhost` en producción**: ese nombre apuntaría al dispositivo del visitante. En el entorno de compilación de Vercel definí `VITE_API_URL` con la URL pública del backend persistente, incluyendo `/api` (por ejemplo, `https://api.tu-dominio.com/api`). Si falta esta variable, el login muestra un aviso de configuración en lugar de informar credenciales incorrectas.

En el entorno privado del backend configurá:

- `JWT_SECRET`: secreto largo, aleatorio y exclusivo de producción.
- `OWNER_EMAIL`: usuario o correo del propietario para SuperAdmin.
- `OWNER_PASSWORD`: contraseña del propietario.
- `OWNER_PIN`: PIN opcional del propietario para el acceso SuperAdmin por PIN.

No pongas estas credenciales en variables `VITE_*`, no las guardes en Git y no reutilices contraseñas de demostración. El servidor rechaza el acceso SuperAdmin si las credenciales privadas no están configuradas. Las operaciones de administración de negocios requieren un token SuperAdmin válido.

**Persistencia:** no alojes SQLite en un filesystem efímero de funciones serverless. El backend debe ejecutarse en un servicio que conserve el archivo SQLite o migrarse a una base de datos administrada persistente. La base de datos existente no debe borrarse para aplicar estos cambios.
