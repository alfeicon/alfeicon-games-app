import fs from "node:fs/promises";
import Papa from "papaparse";

const SHEET_GAMES =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=1961555999&single=true&output=csv";

const SHEET_PACKS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=858783180&single=true&output=csv";

const sqlString = (value) => {
  if (!value) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const sqlBool = (value) => (value ? "true" : "false");

const cleanPrice = (value) => Number(String(value || "").replace(/[^0-9]/g, "")) || 0;

const getCol = (row, key) => {
  const realKey = Object.keys(row).find((itemKey) => itemKey.trim().toLowerCase() === key.toLowerCase());
  return realKey ? row[realKey] : undefined;
};

const fetchCsv = async (url) => {
  const response = await fetch(`${url}&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  const csv = await response.text();
  return Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
};

const games = await fetchCsv(SHEET_GAMES);
const packs = await fetchCsv(SHEET_PACKS);

const lines = [
  "-- Generated from Google Sheets.",
  "-- Run supabase/schema.sql first, then this seed.",
  "begin;",
  "truncate table public.pack_items, public.packs, public.games restart identity cascade;",
  "",
];

for (const row of games) {
  const title = getCol(row, "NOMBRE DE JUEGOS");
  if (!title) continue;

  const price = cleanPrice(getCol(row, "Precio"));
  const isOffer = String(getCol(row, "En Oferta") || "").trim().toUpperCase() === "SI";
  const offerPrice = cleanPrice(getCol(row, "Precio Oferta"));

  lines.push(
    `insert into public.games (title, price, image_url, description, trailer_url, storage_required, is_offer, offer_price, is_active) values (${sqlString(title)}, ${price}, ${sqlString(getCol(row, "imagen"))}, ${sqlString(getCol(row, "descripcion"))}, ${sqlString(getCol(row, "trailer"))}, ${sqlString(getCol(row, "Espacio necesario"))}, ${sqlBool(isOffer)}, ${isOffer && offerPrice ? offerPrice : "null"}, true);`,
  );
}

lines.push("");

for (const [index, row] of packs.entries()) {
  const price = cleanPrice(getCol(row, "Precio CLP"));
  if (!price) continue;

  const packTitle = `Pack ${getCol(row, "Pack ID") || index + 1}`;
  const includedGames = String(getCol(row, "Juegos Incluidos") || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  lines.push(
    `with new_pack as (insert into public.packs (title, price, console, is_new, is_active) values (${sqlString(packTitle)}, ${price}, ${sqlString(getCol(row, "Consola"))}, false, true) returning id)`,
  );

  if (includedGames.length > 0) {
    lines.push(
      `insert into public.pack_items (pack_id, title, sort_order) select new_pack.id, item.title, item.sort_order from new_pack, (values ${includedGames
        .map((title, itemIndex) => `(${sqlString(title)}, ${itemIndex})`)
        .join(", ")}) as item(title, sort_order);`,
    );
  } else {
    lines.push("select id from new_pack;");
  }
}

lines.push("", "commit;", "");

await fs.mkdir("supabase", { recursive: true });
await fs.writeFile("supabase/seed-from-sheets.sql", lines.join("\n"));

console.log(`Created supabase/seed-from-sheets.sql with ${games.length} game rows and ${packs.length} pack rows.`);
