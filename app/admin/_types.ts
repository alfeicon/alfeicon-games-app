export type AdminGame = {
  id: string; title: string; price: number;
  image_url: string | null; storage_required: string | null;
  console: string | null; is_offer: boolean;
  offer_price: number | null; is_active: boolean;
  cost_price: number;
};

export type AdminPack = {
  id: string; title: string; price: number;
  image_url: string | null; console: string | null;
  is_new: boolean; is_active: boolean;
  pack_items: { title: string; sort_order: number }[] | null;
  cost_price: number;
};

export type Sale = {
  id: string;
  item_type: "game" | "pack";
  item_id: string | null;
  item_title: string;
  price_sold: number;
  cost_price: number;
  payment_method: string;
  provider: string | null;
  notes: string | null;
  partner_pct: number | null;
  created_at: string;
};

export type Provider = {
  id: string;
  name: string;
  is_active: boolean;
};

export type AdSpend = {
  id: string;
  platform: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
};

export type SettingsState = {
  nintendoOnlinePrice: string;
  packPriceIncrease: string;
  garantiaJuegoDias: string;
  garantiaPackDias: string;
  partnerSplitPct: string;
  partnerName: string;
};

export type AdminNews = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Order = {
  id: string;
  order_number?: number;
  short_code: string;
  game_name: string;
  status: 'draft' | 'pending_console_code' | 'pending_setup' | 'preparing' | 'ready' | 'completed' | 'issue';
  console_code: string | null;
  client_name?: string | null;
  client_email?: string | null;
  account_email: string | null;
  account_password: string | null;
  sale_price?: number;
  cost_price?: number;
  provider?: string | null;
  partner_pct?: number | null;
  pack_ids?: string[] | null;
  payment_method?: 'transferencia' | 'mercadopago' | null;
  payment_status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | null;
  receipt_url?: string | null;
  mp_preference_id?: string | null;
  mp_payment_id?: string | null;
  /** Cuándo confirmó el cliente la entrega. Inicio de la garantía. */
  completed_at?: string | null;
  created_at: string;
};

/**
 * Una cuenta entregada dentro de una orden. Un pack entero es un solo ítem
 * (va todo en la misma cuenta); un pack + un juego son dos ítems, y el cliente
 * instala cada uno por separado desde el mismo enlace.
 */
export type OrderItem = {
  id: string;
  order_id: string;
  /** 'recuperacion' = reposición por garantía, agregada después de la venta. */
  kind: 'compra' | 'recuperacion';
  /** Define la garantía: 7 días 'game', 3 días 'pack'. */
  item_type: 'game' | 'pack';
  item_id: string | null;
  title: string;
  sale_price: number;
  cost_price: number;
  provider: string | null;
  account_email: string | null;
  account_password: string | null;
  console_code: string | null;
  /** Cuándo confirmó el cliente esta instalación. Inicio de su garantía. */
  completed_at: string | null;
  /** Días de garantía congelados al crear el ítem (Ajustes solo rige para los nuevos). */
  dias_garantia: number | null;
  sort_order: number;
  created_at: string;
};

export type OrderMessage = {
  id: string;
  order_id: string;
  sender: 'customer' | 'admin';
  body: string;
  created_at: string;
  /** Cuándo lo vio la contraparte (null = aún no). Requiere order-messages-read.sql. */
  read_at?: string | null;
};

/** Código de descuento que el cliente escribe en el carrito antes de pagar. */
export type DiscountCode = {
  id: string;
  code: string;
  tipo: 'porcentaje' | 'monto';
  valor: number;
  aplica_a: 'todo' | 'juegos' | 'packs';
  /** null = sin límite de usos. */
  max_usos: number | null;
  usos: number;
  activo: boolean;
  expira_at: string | null;
  nota: string | null;
  created_at: string;
};

export type AdminSection = "inicio" | "juegos" | "packs" | "noticias" | "ventas" | "entregas" | "soporte" | "ajustes";

/** Consulta enviada desde la sección Soporte de la tienda (sin orden detrás). */
export type SupportRequest = {
  id: string;
  name: string;
  contact: string;
  message: string;
  status: "nueva" | "atendida";
  created_at: string;
};
