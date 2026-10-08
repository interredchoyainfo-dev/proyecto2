import { z } from 'zod';

export const createEspacioSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  type: z.string().trim().min(1).max(50),
  precioDia: z.number().nonnegative('El precio día no puede ser negativo'),
  precioNoche: z.number().nonnegative('El precio noche no puede ser negativo'),
  isActive: z.boolean().default(true),
  usaCapacidad: z.boolean().default(false),
  capacidad: z.number().int().positive().optional(),
  precioPorPersona: z.boolean().default(false),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const updateEspacioSchema = createEspacioSchema.partial();

export const createReservaSchema = z.object({
  espacioId: z.string().min(1, 'Debe seleccionar un espacio'),
  clientName: z.string().trim().min(1, 'El nombre del cliente es obligatorio'),
  clientPhone: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  personas: z.number().int().positive().optional(),
  amount: z.number().nonnegative().optional(),
  senaPagada: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['efectivo', 'transferencia', 'mercadopago', 'tarjeta']).default('efectivo'),
  notes: z.string().optional(),
});

export const cajaMovimientoSchema = z.object({
  type: z.enum(['ingreso', 'egreso']),
  amount: z.number().positive('El importe debe ser mayor a 0'),
  method: z.enum(['efectivo', 'transferencia', 'mercadopago', 'tarjeta']),
  description: z.string().trim().min(1, 'La descripción es obligatoria'),
  categoria: z.string().optional(),
});

export const authLoginSchema = z.object({
  email: z.string().trim().min(1, 'Usuario o email requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
  negocioId: z.string().optional(),
});
