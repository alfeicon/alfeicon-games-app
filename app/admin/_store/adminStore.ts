import { create } from "zustand";
import type { ActivityLog, AdminGame, AdminPack, AdminNews, AdSpend, Provider, Sale, SettingsState, SupportRequest, Order } from "../_types";

type AdminState = {
  games: AdminGame[];
  packs: AdminPack[];
  news: AdminNews[];
  orders: Order[];
  sales: Sale[];
  adSpend: AdSpend[];
  views: { created_at: string; item_id: string | null; source: string | null }[];
  providers: Provider[];
  supportRequests: SupportRequest[];
  activityLogs: ActivityLog[];
  settings: SettingsState;
  
  setGames: (games: AdminGame[]) => void;
  setPacks: (packs: AdminPack[]) => void;
  setNews: (news: AdminNews[]) => void;
  setOrders: (orders: Order[]) => void;
  setSales: (sales: Sale[]) => void;
  setAdSpend: (adSpend: AdSpend[]) => void;
  setViews: (views: { created_at: string; item_id: string | null; source: string | null }[]) => void;
  setProviders: (providers: Provider[]) => void;
  setSupportRequests: (supportRequests: SupportRequest[]) => void;
  setActivityLogs: (activityLogs: ActivityLog[]) => void;
  setSettings: (settings: SettingsState) => void;

  resetAll: () => void;
};

export const useAdminStore = create<AdminState>((set) => ({
  games: [],
  packs: [],
  news: [],
  orders: [],
  sales: [],
  adSpend: [],
  views: [],
  providers: [],
  supportRequests: [],
  activityLogs: [],
  settings: {
    nintendoOnlinePrice: "0",
    garantiaJuegoDias: "0",
    garantiaPackDias: "0",
    profitGoal: "1000000",
    partnerSplitPct: "0",
    partnerName: "",
  },

  setGames: (games) => set({ games }),
  setPacks: (packs) => set({ packs }),
  setNews: (news) => set({ news }),
  setOrders: (orders) => set({ orders }),
  setSales: (sales) => set({ sales }),
  setAdSpend: (adSpend) => set({ adSpend }),
  setViews: (views) => set({ views }),
  setProviders: (providers) => set({ providers }),
  setSupportRequests: (supportRequests) => set({ supportRequests }),
  setActivityLogs: (activityLogs) => set({ activityLogs }),
  setSettings: (settings) => set({ settings }),

  resetAll: () => set({
    games: [], packs: [], news: [], orders: [], sales: [],
    adSpend: [], views: [], providers: [], supportRequests: [], activityLogs: []
  })
}));
