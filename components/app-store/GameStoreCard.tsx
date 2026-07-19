"use client";

// Tarjeta de juego estilo tienda (clases cat2-* de CatalogSection.css).
// Reutilizable: catálogo público y admin. onClick abre el detalle (tienda) o
// el editor (admin).
import Image from "next/image";
import { Gamepad2, Heart } from "lucide-react";
import { getNintendoThumb } from "@/lib/catalog";
import "./CatalogSection.css";

const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23181a1e' width='1' height='1'/%3E%3C/svg%3E";

type Props = {
  titulo: string;
  img: string | null;
  consoleName?: string | null;
  precio: number;
  precioOriginal?: number | null;
  ahorro?: string | null;
  code?: string;
  onClick?: () => void;
  ariaLabel?: string;
  saved?: boolean;
  onToggleSaved?: () => void;
  priority?: boolean;
};

export default function GameStoreCard({
  titulo,
  img,
  consoleName,
  precio,
  precioOriginal,
  ahorro,
  code = "CLP",
  onClick,
  ariaLabel,
  saved,
  onToggleSaved,
  priority,
}: Props) {
  const isSwitch2Only = (consoleName || "").toLowerCase().replace(/\s+/g, "").includes("switch2");
  const consoleLabel = consoleName ? (isSwitch2Only ? "Solo Switch 2" : "Switch 1 y 2") : "Juego digital";
  const hasDiscount = Boolean(precioOriginal && precioOriginal > precio);

  return (
    <button
      type="button"
      onClick={onClick}
      className="cat2-card w-full"
      aria-label={ariaLabel ?? `Ver detalles de ${titulo}`}
    >
      <span className="cat2-img">
        {img ? (
          <Image
            src={getNintendoThumb(img) ?? img}
            alt={titulo}
            fill
            className="object-cover"
            sizes="136px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            priority={priority}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Gamepad2 size={26} strokeWidth={1.4} className="text-gray-600" />
          </span>
        )}
        {ahorro && <span className="cat2-badge">{ahorro.replace(/[¡!]/g, "")}</span>}
      </span>

      <span className="cat2-body">
        <span className="cat2-title pr-8">{titulo}</span>
        <span className="cat2-platform">{consoleLabel}</span>

        <span className="cat2-bottom">
          <span className="cat2-price-wrap">
            {hasDiscount && (
              <span className="cat2-old-price">${(precioOriginal ?? 0).toLocaleString("es-CL")}</span>
            )}
            <span className={`cat2-price${hasDiscount ? " cat2-price-sale" : ""}`}>
              ${precio.toLocaleString("es-CL")}
              <sup className="cat2-clp">{code}</sup>
            </span>
          </span>
        </span>
      </span>
      {onToggleSaved && (
        <span
          className={`absolute top-3 right-3 flex items-center justify-center h-8 w-8 rounded-full bg-black/40 backdrop-blur-md transition-colors ${saved ? 'text-red-500' : 'text-white/50 active:text-white'} z-20`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSaved();
          }}
        >
          <Heart size={15} strokeWidth={2.5} fill={saved ? "currentColor" : "none"} />
        </span>
      )}
    </button>
  );
}
