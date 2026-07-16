import { DATA_IMAGENES } from "@/app/data/imagenes";

export const PARTNER_PCT_KEY = "partner_split_pct";
export const PARTNER_NAME_KEY = "partner_name";
export const DEFAULT_PARTNER_NAME = "Diego";

export const fmt = (n: number) => n.toLocaleString("es-CL");
export const toPrice = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
export const toPct = (v: string) => Math.min(100, Math.max(0, Number(v.replace(/[^0-9]/g, "")) || 0));
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

const normalizeStr = (v: string) =>
  v.normalize("NFD")
   .replace(/[̀-ͯ]/g, "")
   .toLowerCase()
   .replace(/[™®©]/g, "")
   .replace(/&/g, " and ")
   .replace(/[^a-z0-9]+/g, " ")
   .trim();

const candidates = DATA_IMAGENES.map(i => ({ ...i, norm: normalizeStr(i.name) }));

export function findImage(title: string) {
  const t = normalizeStr(title);
  if (!t) return null;
  const exact = candidates.find(i => i.norm === t);
  if (exact) return exact;
  return (
    candidates
      .map(i => {
        const s =
          (i.norm.startsWith(t) ? 80 : 0) +
          (t.startsWith(i.norm) ? 70 : 0) +
          (i.norm.includes(t) ? 40 : 0) +
          (t.includes(i.norm) ? 30 : 0) -
          Math.abs(i.norm.length - t.length) * 0.5;
        return { i, s };
      })
      .filter(x => x.s > 25)
      .sort((a, b) => b.s - a.s)[0]?.i || null
  );
}
