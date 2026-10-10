// ===================== MULTI-TENANT CORE =====================
export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'encargado'
  | 'mozo'
  | 'cocina'
  | 'recepcion'
  | 'delivery'
  | 'mantenimiento'
  | 'cliente';

export type ModuleId =
  | 'bar'
  | 'reservas'
  | 'cocina'
  | 'caja'
  | 'inventario'
  | 'iot'
  | 'analytics_ai'
  | 'delivery'
  | 'mozos'
  | 'escuela'
  | 'torneos'
  | 'access_control'
  | 'smart_center'
  | 'finanzas'
  | 'empleados';

export interface ThemeConfig {
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  fontFamily?: string;
  preset?: string;
}

export interface Negocio {
  id: string;
  slug: string;
  nombre: string;
  subtitulo?: string;
  descripcion?: string;
  whatsapp?: string;
  logoUrl?: string;
  theme?: ThemeConfig;
  isActive: boolean;
  createdAt: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precioMensual: number;
  limiteCanchas: number;
  limiteMesas: number;
  modulosIncluidos: ModuleId[];
}

export interface Suscripcion {
  id: string;
  negocioId: string;
  planId: string;
  estado: 'trial' | 'active' | 'past_due' | 'canceled';
  fechaRenovacion: string;
}

export interface User {
  id: string;
  negocioId?: string | null; // null = superadmin
  email: string;
  nombre?: string;
  name?: string;
  telefono?: string;
  rol?: UserRole;
  role?: UserRole;
  pinAcceso?: string;
  isActive?: boolean;
  avatar?: string;
}

export interface TenantConfig {
  negocio: Negocio;
  modulos: Record<ModuleId, boolean>;
  activeModules: ModuleId[];
  theme?: ThemeConfig;
  openTime?: string;
  closeTime?: string;
}

// ===================== BUSINESS ENTITIES =====================
export type EspacioStatus = 'libre' | 'reservada' | 'en_juego' | 'mantenimiento';
export type CourtStatus = EspacioStatus;
export type PaymentStatus = 'pendiente' | 'senado' | 'pagado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercadopago' | 'tarjeta';
export type CashMovementType = 'ingreso' | 'egreso';
export type MesaEstado = 'libre' | 'ocupada' | 'reservada' | 'cuenta_pedida';

export interface Espacio {
  id: string;
  negocioId?: string;
  name: string;
  type: string; // cancha, salon, futbol, padel, tenis, quincho, piscina, etc.
  status: EspacioStatus;
  precioHora?: number;
  precioDia?: number;
  precioNoche?: number;
  currentReservationId?: string;
  isActive?: boolean;
  imageUrl?: string;
  description?: string;
  /** Si true, se usa capacidad y precio por persona */
  usaCapacidad?: boolean;
  capacidad?: number;
  precioPorPersona?: boolean;
}

export interface Client {
  id: string;
  negocioId?: string;
  name: string;
  phone: string;
  email?: string;
  isFrequent: boolean;
  isSanctioned: boolean;
  totalReservations: number;
  noShows: number;
  createdAt: string;
}

export interface Reservation {
  id: string;
  negocioId: string;
  espacioId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm
  endTime: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amount: number;
  paidAmount: number;
  senaPagada?: number;
  saldoPendiente?: number;
  personas?: number;          // capacidad
  qrToken?: string;
  notes?: string;
  estado: 'pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada';
  createdAt: string;
}

export interface Product {
  id: string;
  negocioId?: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  icon: string;
  destinoComanda?: 'cocina' | 'bar' | 'ambos';
  disponible?: boolean;
  description?: string;
  imageUrl?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Mesa {
  id: string;
  negocioId?: string;
  numero: number;
  sector: 'salon' | 'patio' | 'terraza' | 'canchas';
  capacidad: number;
  estado: MesaEstado;
  mozoAsignadoId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CashSession {
  id: string;
  negocioId?: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  status: 'abierta' | 'cerrada';
  openedBy: string;
  usuarioAperturaId?: string;
}

export interface CashMovement {
  id: string;
  sessionId?: string;
  negocioId?: string;
  type: CashMovementType;
  amount: number;
  method: PaymentMethod;
  description: string;
  categoria?: 'cobro_pedido' | 'cobro_reserva' | 'gasto_proveedor' | 'retiro';
  relatedReservationId?: string;
  relatedPedidoId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface PriceConfig {
  espacioId: string;
  dayPrice: number;
  nightPrice: number;
  nightStartHour: number;
}

export interface DaySchedule {
  day: number; // 0=Domingo ... 6=Sábado
  open: string; // HH:mm
  close: string;
  closed?: boolean;
}

export interface SystemConfig {
  openTime: string;
  closeTime: string;
  nightStartHour: number; // hora global inicio tarifa nocturna
  schedules: DaySchedule[];
  prices: PriceConfig[];
}

export type ViewId =
  | 'dashboard'
  | 'reservations'
  | 'pos'
  | 'cash'
  | 'clients'
  | 'settings'
  | 'mesas'
  | 'inventario'
  | 'empleados';

// ===================== PEDIDOS & MESAS =====================
export type PedidoTipo = 'salon' | 'delivery' | 'mostrador';
export type PedidoEstado = 'borrador' | 'confirmado' | 'en_preparacion' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
export type ItemEstado = 'pendiente' | 'en_marcha' | 'listo' | 'entregado';

export interface DetallePedido {
  id: string;
  pedidoId: string;
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas?: string;
  estadoItem: ItemEstado;
  /** True once this line has been dispatched to the kitchen/bar queue. */
  enviadoCocina?: boolean;
  destinoComanda?: 'cocina' | 'bar' | 'ambos';
}

export interface Pedido {
  id: string;
  negocioId: string;
  tipoPedido: PedidoTipo;
  mesaId?: string;
  mozoId?: string;
  repartidorId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  direccionDelivery?: string;
  estado: PedidoEstado;
  total: number;
  items: DetallePedido[];
  createdAt: string;
  updatedAt?: string;
}

export type { Oferta } from '../store/useOfertasStore';

