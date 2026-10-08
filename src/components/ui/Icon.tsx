import {
  LayoutDashboard,
  Calendar,
  ShoppingBag,
  Wallet,
  Users,
  Settings as SettingsIcon,
  Clock,
  DollarSign,
  UserCog,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarX,
  PlusCircle,
  X,
  ShoppingCart,
  Minus,
  Trash2,
  ChevronsRight,
  ChevronsLeft,
  Smartphone,
  Sun,
  Moon,
  Banknote,
  CalendarCheck,
  UserPlus,
  Landmark,
  LayoutGrid,
  Search,
  Star,
  ShieldAlert,
  User,
  Lock,
  ArrowDown,
  ArrowUp,
  Droplets,
  Coffee,
  Beer,
  Utensils,
  Cookie,
  Shirt,
  Scissors,
  CheckCircle2,
  Wrench,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

const iconMap: Record<string, LucideIcon> = {
  // Navigation & Sections
  dashboard: LayoutDashboard,
  calendar_month: Calendar,
  point_of_sale: ShoppingBag,
  account_balance_wallet: Wallet,
  group: Users,
  settings: SettingsIcon,
  schedule: Clock,
  attach_money: DollarSign,
  manage_accounts: UserCog,

  // Actions & Controls
  add: Plus,
  add_circle: PlusCircle,
  close: X,
  remove: Minus,
  delete: Trash2,
  search: Search,
  star: Star,
  lock: Lock,
  gavel: ShieldAlert,
  person: User,
  person_add: UserPlus,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  keyboard_double_arrow_right: ChevronsRight,
  keyboard_double_arrow_left: ChevronsLeft,
  install_mobile: Smartphone,
  light_mode: Sun,
  dark_mode: Moon,

  // Stats & Dashboard
  payments: Banknote,
  event_available: CalendarCheck,
  event_busy: CalendarX,
  account_balance: Landmark,
  grid_view: LayoutGrid,

  // Court statuses
  check_circle: CheckCircle2,
  sports_soccer: Trophy,
  build: Wrench,

  // POS & Products
  shopping_cart: ShoppingCart,
  water_drop: Droplets,
  local_cafe: Coffee,
  sports_bar: Beer,
  restaurant: Utensils,
  bakery_dining: Cookie,
  checkroom: Shirt,
  apparel: Scissors,

  // Cash movements
  arrow_downward: ArrowDown,
  arrow_upward: ArrowUp,
};

export function Icon({ name, className = '', filled = false, size = 20, style }: IconProps) {
  const LucideComponent = iconMap[name];

  if (LucideComponent) {
    return (
      <LucideComponent
        size={size}
        className={`${className} ${filled ? 'fill-current' : ''}`}
        style={style}
      />
    );
  }

  return (
    <span
      translate="no"
      className={`material-symbols-outlined notranslate ${filled ? 'filled' : ''} ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
