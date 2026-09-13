import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Todo texto que venga del cliente (mensajes, nombres) pasa por aquí: un "<" o
 * un "&" sueltos rompen el parse_mode "HTML" de Telegram y el aviso no llega.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  try {
    const { action, order, message, pago, photo_url } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ error: "Telegram no configurado" }, { status: 500 });
    }

    let texts: string[] = [];
    let photoToSend: { url: string; caption: string } | null = null;

    const shortCode = order?.short_code || "Desconocido";
    const gameName = order?.game_name || "Desconocido";
    const salePrice = order?.sale_price || 0;

    // Obtener los juegos si la orden incluye packs
    let packContents = "";
    if (
      order?.pack_ids &&
      order.pack_ids.length > 0 &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: packsData } = await supabase
        .from("packs")
        .select("source_message, title")
        .in("id", order.pack_ids);

      if (packsData && packsData.length > 0) {
        packContents = packsData
          .map((p: any) => p.source_message || `---- List Game ----\n${p.title}\n----End Game List ----`)
          .join("\n\n");
      }
    }

    switch (action) {
      case "CODE_SUBMITTED": {
        const rawCode = String(order?.console_code || "").trim().toUpperCase();
        texts.push(
          `🎮 <b>CÓDIGO SWITCH RECIBIDO</b>\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}\n\n` +
          `Código de vinculación (toca para copiar):\n` +
          `<code>${rawCode}</code>\n\n` +
          `<i>💡 Opciones desde Telegram:\n` +
          `• Responder con <code>/preparar</code> para avisarle (barra al 85%)\n` +
          `• Responder con <code>[5 dígitos] [contraseña]</code> para entregar</i>`
        );
        break;
      }
      case "SUPPORT_REQUEST": {
        const body = escapeHtml(String(message || "")).slice(0, 400);
        texts.push(
          `🙋 <b>NUEVA CONSULTA DESDE LA TIENDA</b>\n\n` +
          `<b>De:</b> ${escapeHtml(gameName)}\n` +
          `<b>Contacto:</b> ${escapeHtml(shortCode)}\n\n` +
          `"${body}"`
        );
        break;
      }
      case "MP_REJECTED":
        texts.push(
          `❌ <b>PAGO RECHAZADO (MERCADO PAGO)</b>\n\n` +
          `El cliente intentó pagar y no se aprobó. Está esperando en su portal — conviene escribirle.\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}`
        );
        break;
      case "ORDER_CANCELLED": {
        const clp = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
        const requiereDevolucion = order?.payment_status === "approved";
        texts.push(
          `🚫 <b>ORDEN CANCELADA POR EL CLIENTE</b>\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}\n` +
          `<b>Monto:</b> ${clp(salePrice)}\n` +
          `<b>Método:</b> ${order?.payment_method || "sin método"}\n\n` +
          (requiereDevolucion
            ? `💸 <b>Requiere gestionar devolución.</b> El cliente ya había pagado.`
            : `No registra pago aprobado al momento de cancelar.`)
        );
        break;
      }
      case "WAITING_TOO_LONG":
        texts.push(
          `⏰ <b>UN CLIENTE LLEVA RATO ESPERANDO</b>\n\n` +
          `Ya mandó su código y sigue con la página abierta esperando sus credenciales.\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}\n` +
          `<b>Esperando:</b> ${message || "un buen rato"}\n\n` +
          `<i>💡 Responde a este aviso con <code>[5 dígitos] [contraseña]</code> para entregar.</i>`
        );
        break;
      case "MP_APPROVED": {
        const clp = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
        const pagado = Number(pago?.monto ?? 0);
        const esperado = salePrice;
        const rebaja = Number(order?.discount_amount ?? 0);

        const lineas = [
          `💳 <b>RECIBIÓ UNA COMPRA (MERCADO PAGO)</b>`,
          `- ${gameName} - ${clp(esperado)}`,
          ``,
          `<b>Monto:</b> ${clp(pagado)}`,
          ``,
          `<b>Orden:</b> <code>${shortCode}</code>`,
        ];
        if (pago?.pagador) lineas.push(`<b>Pagó:</b> ${pago.pagador}`);
        lineas.push(``, `<b>Pagado:</b> ${clp(pagado)}`, `<b>Esperado:</b> ${clp(esperado)}`);
        if (rebaja > 0) {
          lineas.push(`<b>Descuento:</b> −${clp(rebaja)} (${order?.discount_code || "código"})`);
        }

        if (esperado > 0 && pagado > esperado) {
          lineas.push(
            ``,
            `🔵 <b>PAGÓ DE MÁS</b> — sobran ${clp(pagado - esperado)}.`,
            `Puedes entregar igual. Pregúntale si lo deja como abono para su próxima compra o se lo devuelves.`
          );
        } else if (esperado > 0 && pagado < esperado) {
          lineas.push(
            ``,
            `⚠️ <b>NO CUADRA</b> — faltan ${clp(esperado - pagado)}.`,
            `Revisa antes de entregar la cuenta.`
          );
        } else if (esperado > 0) {
          lineas.push(``, `✅ Cuadra. La orden ya está activa y el cliente puede instalar.`);
        }

        if (pago?.medio) lineas.push(``, `<i>${pago.medio}${pago.id ? ` · pago ${pago.id}` : ""}</i>`);

        texts.push(lineas.join("\n"));
        if (packContents) texts.push(packContents);
        break;
      }
      case "RECEIPT_UPLOADED": {
        const titular = (order?.client_name || "").trim();
        const clp = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;

        const caption =
          `🧾 <b>COMPROBANTE SUBIDO (POR VALIDAR)</b>\n\n` +
          `<b>Juego:</b> ${gameName}\n` +
          `<b>Monto:</b> ${clp(salePrice)}\n` +
          `<b>Orden:</b> <code>${shortCode}</code>` +
          (titular ? `\n<b>Transfiere:</b> ${escapeHtml(titular)}` : "") +
          `\n\n<i>💡 Responde a este mensaje con <code>/aprobar</code> para validar el pago.</i>`;

        if (order?.receipt_url) {
          photoToSend = { url: order.receipt_url, caption };
        } else {
          texts.push(caption);
        }
        if (packContents) texts.push(packContents);
        break;
      }
      case "COMPLETED":
        texts.push(
          `✅ <b>ENTREGA COMPLETADA</b>\n\n` +
          `El cliente confirmó que instaló el juego correctamente.\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}`
        );
        break;
      case "ISSUE":
        texts.push(
          `🆘 <b>PROBLEMA REPORTADO (SOPORTE)</b>\n\n` +
          `El cliente presionó el botón de Soporte porque tuvo un problema durante la instalación.\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>\n` +
          `<b>Juego:</b> ${gameName}\n\n` +
          `<i>💡 Responde a este aviso para hablar directamente con el cliente en su pantalla.</i>`
        );
        break;
      case "NEW_MESSAGE": {
        const raw = String(message || "");
        if (photo_url || raw.startsWith("[img]")) {
          const img = photo_url || raw.slice(5).trim();
          photoToSend = {
            url: img,
            caption:
              `📷 <b>FOTO DEL CLIENTE (SOPORTE)</b>\n\n` +
              `<b>Orden:</b> <code>${shortCode}</code>\n` +
              `<b>Juego:</b> ${gameName}\n\n` +
              `<i>💡 Responde a este mensaje para contestarle al cliente.</i>`,
          };
        } else {
          const messageBody = escapeHtml(raw).slice(0, 300);
          texts.push(
            `💬 <b>NUEVO MENSAJE DE SOPORTE</b>\n\n` +
            `<b>Orden:</b> <code>${shortCode}</code>\n` +
            `<b>Juego:</b> ${gameName}\n\n` +
            `"${messageBody}"\n\n` +
            `<i>💡 Responde a este mensaje para contestarle al cliente.</i>`
          );
        }
        break;
      }
      default:
        texts.push(`ℹ️ <b>Actualización de Orden</b>\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
    }

    const timestamp = `\n\n<i>${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</i>`;

    // Si hay una foto para enviar (comprobante o imagen de soporte), intentamos sendPhoto
    if (photoToSend) {
      const fullCaption = (photoToSend.caption + timestamp).slice(0, 1024);
      const resPhoto = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoToSend.url,
          caption: fullCaption,
          parse_mode: "HTML",
        }),
      });

      if (!resPhoto.ok) {
        console.warn("[notify-order] Error en sendPhoto, enviando como texto:", await resPhoto.text());
        texts.unshift(photoToSend.caption);
      }
    }

    if (texts.length > 0 && !photoToSend) {
      texts[0] += timestamp;
    }

    for (const text of texts) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });

      if (!res.ok) {
        console.error("[notify-order] Error Telegram:", await res.text());
        return NextResponse.json({ error: "Error enviando a Telegram" }, { status: 502 });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[notify-order] Error interno:", error);
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 });
  }
}
