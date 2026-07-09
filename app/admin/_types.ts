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
  account_email: string | null;
  account_password: string | null;
  sale_price?: number;
  cost_price?: number;
  provider?: string | null;
  created_at: string;
};

export type AdminSection = "inicio" | "juegos" | "packs" | "noticias" | "ventas" | "entregas" | "ajustes";
