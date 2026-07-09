"use client";

// Tarjeta de pack estilo tienda (las clases pack3-* viven en CatalogSection.css).
// Reutilizable: la usa el catálogo público y el admin. Al hacer clic dispara
// onClick (en la tienda abre el detalle; en el admin abre el editor).
import Image from "next/image";
import { Heart, Package2 } from "lucide-react";
import { getNintendoThumb } from "@/lib/catalog";
import "./CatalogSection.css";

const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23181a1e' width='1' height='1'/%3E%3C/svg%3E";

type Props = {
  titulo: string;
  img: string | null;
  juegos: string[];
  precio: number;
  code?: string;
  esNuevo?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  saved?: boolean;
  onToggleSaved?: () => void;
};

export default function PackStoreCard({
  titulo,
  img,
  juegos,
  precio,
  code = "CLP",
  esNuevo,
  onClick,
  ariaLabel,
  saved,
  onToggleSaved,
}: Props) {
  const shown = juegos.slice(0, 4);
  const extra = juegos.length - shown.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="pack3-card w-full"
      aria-label={ariaLabel ?? `Ver detalles de ${titulo}`}
    >
      {/* Imagen 16:9 con badge de cantidad */}
      <span className="pack3-visual">
        {img ? (
          <Image
            src={getNintendoThumb(img, 400, 225) ?? img}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 480px) 100vw, 400px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        ) : (
          <Package2 size={32} strokeWidth={1.2} className="pack3-placeholder-ico" />
        )}
        <span className="pack3-count-badge">{juegos.length} juegos</span>
      </span>

      {/* Contenido */}
      <span className="pack3-body">
        <span className="pack3-header-row">
          <span className="pack3-label">Pack de juegos</span>
          {esNuevo && <span className="pack3-new">NUEVO</span>}
        </span>
        <span className="pack3-title">{titulo}</span>
        <span className="pack3-games-list">
          {shown.join(" · ")}
          {extra > 0 ? ` +${extra} más` : ""}
        </span>
        <span className="pack3-footer">
          <span className="pack3-price">
            ${precio.toLocaleString("es-CL")}
            <sup className="pack3-clp">{code}</sup>
          </span>
          {onToggleSaved && (
            <span
              className={`pack3-heart${saved ? " pack3-heart-saved" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSaved();
              }}
            >
              <Heart size={14} strokeWidth={2.5} fill={saved ? "currentColor" : "none"} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
