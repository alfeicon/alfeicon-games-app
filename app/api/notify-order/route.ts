import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { action, order, message } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ error: "Telegram no configurado" }, { status: 500 });
    }

    let texts: string[] = [];
    const shortCode = order?.short_code || "Desconocido";
    const gameName = order?.game_name || "Desconocido";

    switch (action) {
      case "CODE_SUBMITTED":
        texts.push(`🎮 <b>CÓDIGO DE CONSOLA RECIBIDO</b>\n\nEste es el código de la entrega ${shortCode}\n<b>Juego:</b> ${gameName}`);
        texts.push(`<code>${order?.console_code || ""}</code>`);
        break;
      case "SUPPORT_REQUEST": {
        // Viene de la tienda, no de una orden: `game_name` trae el nombre y
        // `short_code` el contacto que dejó la persona.
        const escape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const body = escape(String(message || "")).slice(0, 400);
        texts.push(`🙋 <b>NUEVA CONSULTA DESDE LA TIENDA</b>\n\n<b>De:</b> ${escape(gameName)}\n<b>Contacto:</b> ${escape(shortCode)}\n\n"${body}"`);
        break;
      }
      case "MP_REJECTED":
        texts.push(`❌ <b>PAGO RECHAZADO (MERCADO PAGO)</b>\n\nEl cliente intentó pagar y no se aprobó. Está esperando en su portal — conviene escribirle.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "WAITING_TOO_LONG":
        texts.push(`⏰ <b>UN CLIENTE LLEVA RATO ESPERANDO</b>\n\nYa mandó su código y sigue con la página abierta esperando sus credenciales.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}\n<b>Esperando:</b> ${message || "un buen rato"}`);
        break;
      case "MP_APPROVED":
        texts.push(`💳 <b>PAGO APROBADO (MERCADO PAGO)</b>\n\nMercado Pago confirmó el pago. La orden ya está activa y el cliente puede instalar.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "RECEIPT_UPLOADED":
        texts.push(`🧾 <b>COMPROBANTE POR VALIDAR</b>\n\nEl cliente subió su comprobante de transferencia. Revísalo en Admin → Entregas → Validación.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}\n<b>Monto:</b> $${Number(order?.sale_price ?? 0).toLocaleString("es-CL")}`);
        break;
      case "COMPLETED":
        texts.push(`✅ <b>ENTREGA COMPLETADA</b>\n\nEl cliente confirmó que instaló el juego correctamente.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "ISSUE":
        texts.push(`🆘 <b>PROBLEMA REPORTADO (SOPORTE)</b>\n\nEl cliente presionó el botón de Soporte porque tuvo un problema durante la instalación.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "NEW_MESSAGE": {
        // Escapamos el mensaje del cliente porque es texto libre: si no, un
        // "<" o "&" sueltos rompen el parse_mode "HTML" de Telegram.
        const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
