import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  persistReserva,
  updateReservaDb,
  persistCliente,
  persistCajaSesion,
  persistCajaMovimiento,
} from '../components/DbSync';
import type {
  Court,
  Client,
  Reservation,
  Product,
  CartItem,
  CashSession,
  CashMovement,
  SystemConfig,
  User,
  ViewId,
  PaymentMethod,
} from '../types';

const initialCourts: Court[] = [
  { id: 'c1', negocioId: 'giovanni', name: 'Cancha 1', type: 'cancha', status: 'libre' },
  { id: 'c2', negocioId: 'giovanni', name: 'Cancha 2', type: 'cancha', status: 'reservada', currentReservationId: 'r1' },
  { id: 'c3', negocioId: 'giovanni', name: 'Cancha 3', type: 'cancha', status: 'en_juego', currentReservationId: 'r2' },
  { id: 'c4', negocioId: 'giovanni', name: 'Cancha 4', type: 'cancha', status: 'libre' },
  { id: 's1', negocioId: 'giovanni', name: 'Salón de Eventos', type: 'salon', status: 'mantenimiento' },
];

const initialClients: Client[] = [
  {
    id: 'cl1',
    negocioId: 'giovanni',
    name: 'Juan Pérez',
    phone: '11-2345-6789',
    email: 'juan@email.com',
    isFrequent: true,
    isSanctioned: false,
    totalReservations: 24,
    noShows: 1,
    createdAt: '2025-01-15',
  },
  {
    id: 'cl2',
    negocioId: 'giovanni',
    name: 'María González',
    phone: '11-9876-5432',
    isFrequent: false,
    isSanctioned: false,
    totalReservations: 5,
    noShows: 0,
    createdAt: '2025-06-20',
  },
  {
    id: 'cl3',
    negocioId: 'giovanni',
    name: 'Carlos Rodríguez',
    phone: '11-5555-1234',
    isFrequent: true,
    isSanctioned: true,
    totalReservations: 18,
    noShows: 4,
    createdAt: '2024-11-03',
  },
];

const today = new Date().toISOString().split('T')[0];

const initialReservations: Reservation[] = [
  {
    id: 'r1',
    negocioId: 'giovanni',
    courtId: 'c2',
    clientId: 'cl1',
    clientName: 'Juan Pérez',
    clientPhone: '11-2345-6789',
    date: today,
    startTime: '18:00',
    endTime: '19:00',
    paymentStatus: 'senado',
    paymentMethod: 'transferencia',
    amount: 15000,
    paidAmount: 5000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'r2',
    negocioId: 'giovanni',
    courtId: 'c3',
    clientId: 'cl2',
    clientName: 'María González',
    clientPhone: '11-9876-5432',
    date: today,
    startTime: '17:00',
    endTime: '18:30',
    paymentStatus: 'pagado',
    paymentMethod: 'efectivo',
    amount: 20000,
    paidAmount: 20000,
    createdAt: new Date().toISOString(),
  },
];

const initialProducts: Product[] = [
  // CAFETERÍA / DESAYUNOS
  { id: '1000', negocioId: 'giovanni', name: 'Promo merienda', price: 3500, stock: 50, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1001', name: 'De campo (desayuno-merienda)', price: 4000, stock: 50, category: 'cafeteria', icon: 'coffee', destinoComanda: 'cocina', disponible: true },
  { id: '1002', name: 'Promo licuado', price: 5000, stock: 50, category: 'cafeteria', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1003', name: 'Promo baguette', price: 6000, stock: 40, category: 'cafeteria', icon: 'bakery_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1004', name: 'Promo burger', price: 11000, stock: 40, category: 'cafeteria', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1005', name: 'Sorrentinos + lata Pepsi', price: 13000, stock: 30, category: 'cafeteria', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1006', name: 'POSTRE shot', price: 5000, stock: 40, category: 'cafeteria', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1007', name: 'Vaso jugo de naranja', price: 3500, stock: 40, category: 'cafeteria', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '1008', name: 'Naranja', price: 500, stock: 100, category: 'cafeteria', icon: 'nutrition', destinoComanda: 'bar', disponible: true },
  { id: '1009', name: 'Rogelito', price: 1500, stock: 50, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1010', name: 'Pan de campo', price: 2000, stock: 40, category: 'cafeteria', icon: 'bakery_dining', destinoComanda: 'bar', disponible: true },
  { id: '1011', name: 'Torta rellena', price: 7500, stock: 20, category: 'cafeteria', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1012', name: 'Tronco relleno', price: 7000, stock: 20, category: 'cafeteria', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1013', name: 'Masas finas x6', price: 6500, stock: 25, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1014', name: 'Alfajor relleno', price: 2500, stock: 40, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1015', name: 'Bombones Rocher unidad', price: 3000, stock: 30, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1016', name: 'Bombones Rocher x8', price: 19000, stock: 15, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1017', name: 'Budín', price: 5000, stock: 25, category: 'cafeteria', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1018', name: 'Té de manzanilla', price: 3000, stock: 50, category: 'cafeteria', icon: 'emoji_food_beverage', destinoComanda: 'bar', disponible: true },
  { id: '1019', name: 'Pionono', price: 4000, stock: 25, category: 'cafeteria', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1020', name: 'Café con leche chico', price: 2500, stock: 80, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1021', name: 'Medialuna', price: 1000, stock: 60, category: 'cafeteria', icon: 'bakery_dining', destinoComanda: 'bar', disponible: true },
  { id: '1022', name: 'Alfajón Dolcce', price: 2500, stock: 40, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1023', name: 'Café en jarrito + 2 tortillas', price: 3000, stock: 50, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1024', name: 'Postre individual grande', price: 5000, stock: 30, category: 'cafeteria', icon: 'icecream', destinoComanda: 'bar', disponible: true },
  { id: '1025', name: 'Postre individual chico', price: 4500, stock: 30, category: 'cafeteria', icon: 'icecream', destinoComanda: 'bar', disponible: true },
  { id: '1026', name: 'Leche', price: 3000, stock: 40, category: 'cafeteria', icon: 'water_drop', destinoComanda: 'bar', disponible: true },
  { id: '1027', name: 'Caja corazón', price: 13000, stock: 10, category: 'cafeteria', icon: 'favorite', destinoComanda: 'bar', disponible: true },
  { id: '1028', name: 'Mini alfajor maicena', price: 1500, stock: 50, category: 'cafeteria', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1029', name: 'Agua caliente', price: 1000, stock: 100, category: 'cafeteria', icon: 'water_drop', destinoComanda: 'bar', disponible: true },
  { id: '1030', name: 'Promo smoothie', price: 5000, stock: 40, category: 'cafeteria', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1031', name: 'Frappuccino', price: 3500, stock: 40, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1032', name: 'Café doble', price: 3500, stock: 60, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1033', name: 'Café mediano calle', price: 3000, stock: 60, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1034', name: 'Tazón café con leche', price: 4000, stock: 50, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1035', name: 'Café con leche', price: 3000, stock: 60, category: 'cafeteria', icon: 'coffee', destinoComanda: 'bar', disponible: true },
  { id: '1036', name: 'Tostada jamón y queso', price: 1500, stock: 40, category: 'cafeteria', icon: 'breakfast_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1037', name: 'Sándwich miga llevar', price: 3000, stock: 40, category: 'cafeteria', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1038', name: 'Pebete llevar', price: 2500, stock: 40, category: 'cafeteria', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  // LICUADOS
  { id: '1100', name: 'Licuado ananá', price: 4500, stock: 40, category: 'licuados', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1101', name: 'Licuado frutilla durazno', price: 4500, stock: 40, category: 'licuados', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1102', name: 'Licuado durazno naranja', price: 4500, stock: 40, category: 'licuados', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1103', name: 'Licuado tutti', price: 4500, stock: 40, category: 'licuados', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1104', name: 'Licuado promo + carlito', price: 5000, stock: 30, category: 'licuados', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  // TORTAS Y TARTAS
  { id: '1200', name: 'Cheesecake', price: 8000, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1201', name: 'Tarta Cabsha', price: 5500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1202', name: 'Tarta Frutal', price: 5500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1203', name: 'Tarta Lemon Pie', price: 5500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1204', name: 'Tarta Ricota', price: 5000, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1205', name: 'Selva Negra', price: 7000, stock: 12, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1206', name: 'Tarta manzana', price: 5500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1207', name: 'Torta Brownie', price: 7500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1208', name: 'Alfajor santiagueño', price: 5500, stock: 20, category: 'tortas', icon: 'cookie', destinoComanda: 'bar', disponible: true },
  { id: '1209', name: 'Tarta Oreo', price: 5500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1210', name: 'Tiramisú', price: 6500, stock: 15, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1211', name: 'Mini tartas', price: 5000, stock: 20, category: 'tortas', icon: 'cake', destinoComanda: 'bar', disponible: true },
  { id: '1212', name: 'Shots', price: 5000, stock: 25, category: 'tortas', icon: 'icecream', destinoComanda: 'bar', disponible: true },
  // BEBIDAS SIN ALCOHOL
  { id: '1300', name: 'Lata gaseosa Pepsi', price: 3500, stock: 48, category: 'bebidas', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1301', name: 'Gaseosa 500cc línea Pepsi', price: 3500, stock: 36, category: 'bebidas', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1302', name: 'Gaseosa 500cc Coca', price: 4000, stock: 36, category: 'bebidas', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1303', name: 'Gaseosa 1lt', price: 5000, stock: 24, category: 'bebidas', icon: 'local_cafe', destinoComanda: 'bar', disponible: true },
  { id: '1304', name: 'Agua mineral 500cc', price: 3500, stock: 48, category: 'bebidas', icon: 'water_drop', destinoComanda: 'bar', disponible: true },
  { id: '1305', name: 'Agua saborizada 500cc', price: 3500, stock: 36, category: 'bebidas', icon: 'water_drop', destinoComanda: 'bar', disponible: true },
  { id: '1306', name: 'Limonada frutos rojos', price: 6000, stock: 20, category: 'bebidas', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '1307', name: 'Limonada litro', price: 5000, stock: 20, category: 'bebidas', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '1308', name: 'Soda 500ml', price: 3500, stock: 30, category: 'bebidas', icon: 'water_drop', destinoComanda: 'bar', disponible: true },
  { id: '1309', name: 'Speed 250cc', price: 3000, stock: 24, category: 'bebidas', icon: 'bolt', destinoComanda: 'bar', disponible: true },
  { id: '1310', name: 'Speed 500ml', price: 5000, stock: 20, category: 'bebidas', icon: 'bolt', destinoComanda: 'bar', disponible: true },
  { id: '1311', name: 'Exprimido naranja 1lt', price: 6000, stock: 15, category: 'bebidas', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '1312', name: 'Gatorade', price: 5000, stock: 20, category: 'bebidas', icon: 'sports', destinoComanda: 'bar', disponible: true },
  // CERVEZAS
  { id: '1400', name: 'Brahma 1L', price: 6000, stock: 24, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1401', name: 'Corona 330cc', price: 4500, stock: 24, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1402', name: 'Patagonia botella', price: 8000, stock: 18, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1403', name: 'Stella 975cc', price: 9000, stock: 18, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1404', name: 'Stella 330cc', price: 4500, stock: 24, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1405', name: 'Budweiser 1L', price: 6000, stock: 20, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1406', name: 'Quilmes negra', price: 7000, stock: 18, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1407', name: 'Andes roja', price: 7000, stock: 18, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  { id: '1408', name: 'Imperial Golden litro', price: 9000, stock: 15, category: 'cervezas', icon: 'sports_bar', destinoComanda: 'bar', disponible: true },
  // CARNES
  { id: '1500', name: 'Carne al horno con verdura', price: 18000, stock: 20, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1501', name: 'Lomo a la pimienta', price: 15000, stock: 20, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1502', name: 'Lomo al verdeo', price: 15000, stock: 20, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1503', name: 'Matambre pizza', price: 15000, stock: 15, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1504', name: 'Milanesa al plato', price: 12000, stock: 25, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1505', name: 'Milanesa napolitana', price: 14000, stock: 25, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1506', name: 'Bife de chorizo', price: 14000, stock: 20, category: 'carnes', icon: 'dinner_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1507', name: 'Parrillada', price: 30000, stock: 10, category: 'carnes', icon: 'outdoor_grill', destinoComanda: 'cocina', disponible: true },
  // LOMOS
  { id: '1600', name: 'Lomito clásico', price: 10000, stock: 30, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1601', name: 'Lomito con cheddar', price: 11000, stock: 30, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1602', name: 'Lomito cheddar panceta', price: 11000, stock: 30, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1603', name: 'Lomito vegetariano', price: 11000, stock: 20, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1604', name: 'Lomito roquefort', price: 11500, stock: 25, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1605', name: 'Lomito al plato', price: 9500, stock: 25, category: 'lomos', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  // BURGERS
  { id: '1700', name: 'Burger clásica', price: 9000, stock: 40, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1701', name: 'Burger triple', price: 12000, stock: 30, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1702', name: 'Burger Mamba', price: 10000, stock: 30, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1703', name: 'Burger cheddar', price: 9500, stock: 30, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1704', name: 'Burger panceta', price: 9500, stock: 30, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1705', name: 'Burger vegetariana', price: 9500, stock: 25, category: 'burgers', icon: 'lunch_dining', destinoComanda: 'cocina', disponible: true },
  // PIZZAS
  { id: '1800', name: 'Pizza muzzarella', price: 9500, stock: 25, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1801', name: 'Pizza especial', price: 10000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1802', name: 'Pizza napolitana', price: 12000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1803', name: 'Pizza 4 quesos', price: 12000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1804', name: 'Pizza calabresa', price: 12000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1805', name: 'Pizza fugazeta', price: 12000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1806', name: 'Pizza rucula', price: 13000, stock: 15, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  { id: '1807', name: 'Media pizza especial', price: 6000, stock: 20, category: 'pizzas', icon: 'local_pizza', destinoComanda: 'cocina', disponible: true },
  // PASTAS
  { id: '1900', name: 'Fideos', price: 11000, stock: 25, category: 'pastas', icon: 'ramen_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1901', name: 'Ñoquis', price: 12000, stock: 25, category: 'pastas', icon: 'ramen_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1902', name: 'Ravioles', price: 12000, stock: 25, category: 'pastas', icon: 'ramen_dining', destinoComanda: 'cocina', disponible: true },
  { id: '1903', name: 'Sorrentinos', price: 12000, stock: 25, category: 'pastas', icon: 'ramen_dining', destinoComanda: 'cocina', disponible: true },
  // ENSALADAS
  { id: '2000', name: 'Ensalada César', price: 8000, stock: 20, category: 'ensaladas', icon: 'eco', destinoComanda: 'cocina', disponible: true },
  { id: '2001', name: 'Ensalada clásica', price: 6500, stock: 20, category: 'ensaladas', icon: 'eco', destinoComanda: 'cocina', disponible: true },
  { id: '2002', name: 'Ensalada Mamba', price: 8000, stock: 20, category: 'ensaladas', icon: 'eco', destinoComanda: 'cocina', disponible: true },
  { id: '2003', name: 'Ensalada Fit', price: 7000, stock: 20, category: 'ensaladas', icon: 'eco', destinoComanda: 'cocina', disponible: true },
  { id: '2004', name: 'Ensalada Atún', price: 9000, stock: 15, category: 'ensaladas', icon: 'eco', destinoComanda: 'cocina', disponible: true },
  // PAPAS
  { id: '2100', name: 'Papas clásicas', price: 7000, stock: 40, category: 'papas', icon: 'restaurant', destinoComanda: 'cocina', disponible: true },
  { id: '2101', name: 'Papas cheddar', price: 8500, stock: 35, category: 'papas', icon: 'restaurant', destinoComanda: 'cocina', disponible: true },
  { id: '2102', name: 'Papas cheddar panceta', price: 9000, stock: 30, category: 'papas', icon: 'restaurant', destinoComanda: 'cocina', disponible: true },
  { id: '2103', name: 'Papas a caballo', price: 8000, stock: 30, category: 'papas', icon: 'restaurant', destinoComanda: 'cocina', disponible: true },
  // TACOS
  { id: '2200', name: 'Tacos carne', price: 9500, stock: 25, category: 'tacos', icon: 'tapas', destinoComanda: 'cocina', disponible: true },
  { id: '2201', name: 'Tacos pollo', price: 9500, stock: 25, category: 'tacos', icon: 'tapas', destinoComanda: 'cocina', disponible: true },
  { id: '2202', name: 'Tacos veggie', price: 9000, stock: 20, category: 'tacos', icon: 'tapas', destinoComanda: 'cocina', disponible: true },
  // TRAGOS
  { id: '2300', name: 'Aperol', price: 7000, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2301', name: 'Campari', price: 6000, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2302', name: 'Caipirinha', price: 6500, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2303', name: 'Daikiri', price: 6500, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2304', name: 'Mojito', price: 6500, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2305', name: 'Gin Tonic clásico', price: 6000, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2306', name: 'Margarita', price: 6000, stock: 30, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2307', name: 'Negroni', price: 7000, stock: 25, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
  { id: '2308', name: 'Fernet medida', price: 6000, stock: 40, category: 'tragos', icon: 'local_bar', destinoComanda: 'bar', disponible: true },
];

const initialConfig: SystemConfig = {
  openTime: '08:00',
  closeTime: '00:00',
  nightStartHour: 18,
  schedules: [
    { day: 0, open: '09:00', close: '23:00' }, // Domingo
    { day: 1, open: '08:00', close: '00:00' },
    { day: 2, open: '08:00', close: '00:00' },
    { day: 3, open: '08:00', close: '00:00' },
    { day: 4, open: '08:00', close: '00:00' },
    { day: 5, open: '08:00', close: '01:00' }, // Viernes
    { day: 6, open: '09:00', close: '01:00' }, // Sábado
  ],
  prices: [
    { courtId: 'c1', dayPrice: 12000, nightPrice: 15000, nightStartHour: 18 },
    { courtId: 'c2', dayPrice: 12000, nightPrice: 15000, nightStartHour: 18 },
    { courtId: 'c3', dayPrice: 14000, nightPrice: 18000, nightStartHour: 18 },
    { courtId: 'c4', dayPrice: 14000, nightPrice: 18000, nightStartHour: 18 },
    { courtId: 's1', dayPrice: 50000, nightPrice: 70000, nightStartHour: 18 },
  ],
};

const currentUser: User = {
  id: 'u1',
  name: 'Admin Giovanni',
  email: 'admin@complejogiovanni.com',
  role: 'admin',
};

interface AppState {
  currentView: ViewId;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  setView: (view: ViewId) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  currentUser: User;
  courts: Court[];
  updateCourtStatus: (id: string, status: Court['status'], reservationId?: string) => void;
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalReservations' | 'noShows'>) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  reservations: Reservation[];
  addReservation: (res: Omit<Reservation, 'id' | 'createdAt'>) => void;
  updateReservation: (id: string, data: Partial<Reservation>) => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  cart: CartItem[];
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  checkoutCart: (method: PaymentMethod, reservationId?: string) => void;
  cashSession: CashSession | null;
  cashMovements: CashMovement[];
  openCash: (amount: number, negocioId?: string) => void;
  closeCash: (closingAmount: number) => void;
  addCashMovement: (mov: Omit<CashMovement, 'id' | 'sessionId' | 'createdAt' | 'createdBy'>) => void;
  config: SystemConfig;
  updateConfig: (cfg: Partial<SystemConfig>) => void;
  // ─── Tenant-scoped getters ─────────────────────────────
  getCourtsByTenant: (negocioId: string) => Court[];
  getClientsByTenant: (negocioId: string) => Client[];
  getReservationsByTenant: (negocioId: string) => Reservation[];
  getProductsByTenant: (negocioId: string) => Product[];
  getCashSessionByTenant: (negocioId: string) => CashSession | null;
  getCashMovementsByTenant: (negocioId: string) => CashMovement[];
  resetTenantData: (negocioId: string) => void;
  getTodayStats: (negocioId?: string) => {
    revenue: number;
    occupiedSlots: number;
    newClients: number;
    cashBalance: number;
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'dashboard',
      sidebarCollapsed: false,
      darkMode: true,
      currentUser,
      courts: initialCourts,
      clients: initialClients,
      reservations: initialReservations,
      products: initialProducts,
      cart: [],
      cashSession: null,
      cashMovements: [],
      config: initialConfig,

      setView: (view) => set({ currentView: view }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode;
          document.documentElement.classList.toggle('dark', next);
          return { darkMode: next };
        }),

      updateCourtStatus: (id, status, reservationId) =>
        set((s) => ({
          courts: s.courts.map((c) =>
            c.id === id ? { ...c, status, currentReservationId: reservationId } : c
          ),
        })),

      addClient: (client) => {
        const id = `cl${Date.now()}`;
        const newClient = {
          ...client,
          id,
          negocioId: (client as any).negocioId || 'giovanni',
          createdAt: new Date().toISOString().split('T')[0],
          totalReservations: 0,
          noShows: 0,
        };
        set((s) => ({
          clients: [...s.clients, newClient],
        }));
        persistCliente(newClient, true);
      },

      updateClient: (id, data) => {
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
        persistCliente({ id, ...data }, false);
      },

      addReservation: (res) => {
        const id = `r${Date.now()}`;
        const full = { ...res, id, negocioId: res.negocioId || 'giovanni', createdAt: new Date().toISOString() };
        set((s) => ({
          reservations: [...s.reservations, full],
        }));
        const courtOrEspacio = res.courtId || res.espacioId;
        if (courtOrEspacio) get().updateCourtStatus(courtOrEspacio, 'reservada', id);
        persistReserva(full).catch(() => {});
      },

      updateReservation: (id, data) => {
        set((s) => ({
          reservations: s.reservations.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }));
        updateReservaDb(id, data);
      },

      addToCart: (product, qty = 1) =>
        set((s) => {
          const existing = s.cart.find((i) => i.productId === product.id);
          if (existing) {
            return {
              cart: s.cart.map((i) =>
                i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i
              ),
            };
          }
          return {
            cart: [...s.cart, { productId: product.id, name: product.name, price: product.price, quantity: qty }],
          };
        }),

      removeFromCart: (productId) =>
        set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId) })),

      updateCartQty: (productId, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((i) => i.productId !== productId)
              : s.cart.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
        })),

      clearCart: () => set({ cart: [] }),

      addProduct: (product) => {
        const id = `prod-${Date.now()}`;
        set((s) => ({ products: [...s.products, { ...product, id }] }));
      },
      updateProduct: (id, data) => {
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)) }));
      },
      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
      },

      checkoutCart: (method, reservationId) => {
        const { cart, cashSession } = get();
        if (!cashSession || cart.length === 0) return;
        const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
        set((s) => ({
          products: s.products.map((p) => {
            const item = cart.find((c) => c.productId === p.id);
            return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
          }),
          cart: [],
        }));
        get().addCashMovement({
          type: 'ingreso',
          amount: total,
          method,
          description: `Venta POS: ${cart.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
          relatedReservationId: reservationId,
        });
      },

      openCash: (amount, negocioId) => {
        const sesion: CashSession = {
          id: `cs${Date.now()}`,
          negocioId: negocioId || 'giovanni',
          openedAt: new Date().toISOString(),
          openingAmount: amount,
          status: 'abierta' as const,
          openedBy: get().currentUser.name || get().currentUser.nombre || 'Admin',
        };
        set({
          cashSession: sesion,
          cashMovements: [],
        });
        persistCajaSesion(sesion);
      },

      closeCash: (closingAmount) =>
        set((s) => {
          if (!s.cashSession) return s;
          const ingresos = s.cashMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
          const egresos = s.cashMovements.filter((m) => m.type === 'egreso').reduce((sum, m) => sum + m.amount, 0);
          const expected = s.cashSession.openingAmount + ingresos - egresos;
          const closed = {
            ...s.cashSession,
            closedAt: new Date().toISOString(),
            closingAmount,
            expectedAmount: expected,
            status: 'cerrada' as const,
          };
          persistCajaSesion(closed);
          return {
            cashSession: closed,
          };
        }),

      addCashMovement: (mov) => {
        const session = get().cashSession;
        if (!session || session.status !== 'abierta') return;
        const full = {
          ...mov,
          id: `cm${Date.now()}`,
          sessionId: session.id,
          createdAt: new Date().toISOString(),
          createdBy: get().currentUser.name || get().currentUser.nombre || 'Admin',
        };
        set((s) => ({
          cashMovements: [...s.cashMovements, full],
        }));
        persistCajaMovimiento(full);
      },

      updateConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } })),

      // ─── Tenant-scoped getters ─────────────────────────────
      getCourtsByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().courts.filter((c) => (c.negocioId || 'giovanni').toLowerCase() === clean);
      },
      getClientsByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().clients.filter((c) => (c.negocioId || 'giovanni').toLowerCase() === clean);
      },
      getReservationsByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().reservations.filter((r) => (r.negocioId || 'giovanni').toLowerCase() === clean);
      },
      getProductsByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().products.filter((p) => (p.negocioId || 'giovanni').toLowerCase() === clean);
      },
      getCashSessionByTenant: (negocioId) => {
        const session = get().cashSession;
        if (!session) return null;
        const clean = (negocioId || 'giovanni').toLowerCase();
        if ((session.negocioId || 'giovanni').toLowerCase() === clean) return session;
        return null;
      },
      getCashMovementsByTenant: (negocioId) => {
        const clean = (negocioId || 'giovanni').toLowerCase();
        return get().cashMovements.filter((m) => (m.negocioId || 'giovanni').toLowerCase() === clean);
      },

      resetTenantData: (negocioId: string) => {
        const clean = (negocioId || "giovanni").toLowerCase();
        set((s) => ({
          reservations: s.reservations.filter((r) => (r.negocioId || "giovanni").toLowerCase() !== clean),
          cashMovements: s.cashMovements.filter((m) => (m.negocioId || "giovanni").toLowerCase() !== clean),
          cashSession: s.cashSession && (s.cashSession.negocioId || "giovanni").toLowerCase() === clean ? null : s.cashSession,
        }));
      },

      getTodayStats: (negocioId) => {
        const { cashSession } = get();
        const clean = (negocioId || 'giovanni').toLowerCase();
        const reservations = get().getReservationsByTenant(clean);
        const clients = get().getClientsByTenant(clean);
        const cashMovements = get().getCashMovementsByTenant(clean);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRes = reservations.filter((r) => r.date === todayStr);
        const revenue =
          todayRes.reduce((sum, r) => sum + r.paidAmount, 0) +
          cashMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
        const occupiedSlots = todayRes.length;
        const newClients = clients.filter((c) => c.createdAt === todayStr).length;
        const ingresos = cashMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
        const egresos = cashMovements.filter((m) => m.type === 'egreso').reduce((sum, m) => sum + m.amount, 0);
        const sessionForTenant = cashSession && (cashSession.negocioId || 'giovanni').toLowerCase() === clean ? cashSession : null;
        const cashBalance = sessionForTenant ? sessionForTenant.openingAmount + ingresos - egresos : 0;
        return { revenue, occupiedSlots, newClients, cashBalance };
      },
    }),
    {
      name: 'giovanni-admin-storage-v2',
      partialize: (state) => ({
        darkMode: state.darkMode,
        clients: state.clients,
        reservations: state.reservations,
        products: state.products,
        config: state.config,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('giovanni-admin-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.state?.darkMode !== false) {
        document.documentElement.classList.add('dark');
      }
    } catch {
      document.documentElement.classList.add('dark');
    }
  } else {
    document.documentElement.classList.add('dark');
  }
}
