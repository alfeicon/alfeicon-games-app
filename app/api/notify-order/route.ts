import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
/**
 * Todo texto que venga del cliente (mensajes, nombres) pasa por aquí: un "<" o
 * un "&" sueltos rompen el parse_mode "HTML" de Telegram y el aviso no llega.
 */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  try {
    const { action, order, message, pago } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ error: "Telegram no configurado" }, { status: 500 });
    }

    let texts: string[] = [];
    const shortCode = order?.short_code || "Desconocido";
    const gameName = order?.game_name || "Desconocido";
    const salePrice = order?.sale_price || 0;

    // Obtener los juegos si la orden incluye packs
    let packContents = "";
    if (order?.pack_ids && order.pack_ids.length > 0 && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { data: packsData } = await supabase
        .from("packs")
        .select("source_message, title")
        .in("id", order.pack_ids);
        
      if (packsData && packsData.length > 0) {
        // Enviar el mensaje original crudo tal cual llegó del proveedor (o el título si no hay mensaje)
        packContents = packsData.map((p: any) => p.source_message || `---- List Game ----\n${p.title}\n----End Game List ----`).join("\n\n");
      }
    }

    switch (action) {
      case "CODE_SUBMITTED":
        texts.push(`🎮 <b>CÓDIGO DE CONSOLA RECIBIDO</b>\n\nEste es el código de la entrega ${shortCode}\n<b>Juego:</b> ${gameName}`);
        texts.push(`<code>${order?.console_code || ""}</code>`);
        break;
      case "SUPPORT_REQUEST": {
        // Viene de la tienda, no de una orden: `game_name` trae el nombre y
        // `short_code` el contacto que dejó la persona.
        const body = escapeHtml(String(message || "")).slice(0, 400);
        texts.push(`🙋 <b>NUEVA CONSULTA DESDE LA TIENDA</b>\n\n<b>De:</b> ${escapeHtml(gameName)}\n<b>Contacto:</b> ${escapeHtml(shortCode)}\n\n"${body}"`);
        break;
      }
      case "MP_REJECTED":
        texts.push(`❌ <b>PAGO RECHAZADO (MERCADO PAGO)</b>\n\nEl cliente intentó pagar y no se aprobó. Está esperando en su portal — conviene escribirle.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "WAITING_TOO_LONG":
        texts.push(`⏰ <b>UN CLIENTE LLEVA RATO ESPERANDO</b>\n\nYa mandó su código y sigue con la página abierta esperando sus credenciales.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}\n<b>Esperando:</b> ${message || "un buen rato"}`);
        break;
      case "MP_APPROVED": {
        // En transferencia ves el monto directo con el cliente; en Mercado Pago
        // no, así que el aviso cuadra la cuenta por ti: lo que pagó contra lo
        // que debía pagar. El monto pagado viene de MP, no del navegador.
        const clp = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
        const pagado = Number(pago?.monto ?? 0);
        const listaPrecio = salePrice;
        const rebaja = Number(order?.discount_amount ?? 0);
        // Lo que se le cobró ya viene con el descuento restado en `sale_price`.
        const esperado = listaPrecio;

        const lineas = [
          `💳 <b>RECIBIÓ UNA COMPRA DE:</b>`,
          `- ${gameName} - ${clp(esperado)}`,
        ];
        
        lineas.push(
          ``,
          `<b>Monto:</b> ${clp(pagado)}`,
          ``,
          `<b>Orden:</b> <code>${shortCode}</code>`
        );
        if (pago?.pagador) lineas.push(`<b>Pagó:</b> ${pago.pagador}`);
        lineas.push(``, `<b>Pagado:</b> ${clp(pagado)}`, `<b>Esperado:</b> ${clp(esperado)}`);
        if (rebaja > 0) {
          lineas.push(`<b>Descuento:</b> −${clp(rebaja)} (${order?.discount_code || "código"})`);
        }

        if (esperado > 0 && pagado > esperado) {
          // Pagar de más no bloquea la entrega: la orden está pagada. Solo hay
          // que ponerse de acuerdo con el cliente sobre el excedente.
          lineas.push(
            ``,
            `🔵 <b>PAGÓ DE MÁS</b> — sobran ${clp(pagado - esperado)}.`,
            `Puedes entregar igual. Pregúntale si lo deja como abono para su próxima compra o se lo devuelves.`,
          );
        } else if (esperado > 0 && pagado < esperado) {
          lineas.push(
            ``,
            `⚠️ <b>NO CUADRA</b> — faltan ${clp(esperado - pagado)}.`,
            `Revisa antes de entregar la cuenta.`,
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
        // El titular se incluye cuando viene: es el dato que permite calzar el
        // depósito del banco con esta orden sin abrir el panel.
        const titular = (order?.client_name || "").trim();
        const clp = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
        
        texts.push(
          `🧾 <b>RECIBIÓ UNA COMPRA DE: (POR VALIDAR)</b>\n` +
          `- ${gameName} - ${clp(salePrice)}\n\n` +
          `<b>Monto:</b> ${clp(salePrice)}\n\n` +
          `El cliente subió su comprobante de transferencia. Revísalo en Admin → Entregas → Validación.\n\n` +
          `<b>Orden:</b> <code>${shortCode}</code>` +
          (titular ? `\n<b>Transfiere:</b> ${escapeHtml(titular)}` : ""),
        );
        if (packContents) texts.push(packContents);
        break;
      }
      case "COMPLETED":
        texts.push(`✅ <b>ENTREGA COMPLETADA</b>\n\nEl cliente confirmó que instaló el juego correctamente.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "ISSUE":
        texts.push(`🆘 <b>PROBLEMA REPORTADO (SOPORTE)</b>\n\nEl cliente presionó el botón de Soporte porque tuvo un problema durante la instalación.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "NEW_MESSAGE": {
        const messageBody = escapeHtml(String(message || "")).slice(0, 300);
        texts.push(`💬 <b>NUEVO MENSAJE DE SOPORTE</b>\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}\n\n"${messageBody}"`);
        break;
      }
      default:
        texts.push(`ℹ️ <b>Actualización de Orden</b>\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
    }

    const timestamp = `\n\n<i>${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</i>`;
    if (texts.length > 0) {
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
