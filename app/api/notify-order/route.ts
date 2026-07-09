import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { action, order } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ error: "Telegram no configurado" }, { status: 500 });
    }

    let texts: string[] = [];
    const shortCode = order?.short_code || "Desconocido";
    const gameName = order?.game_name || "Desconocido";

    switch (action) {
      case "CREATED":
        texts.push(`🛒 <b>NUEVA CONSULTA EN LA TIENDA</b>\n\nEl cliente generó un borrador de entrega y probablemente te escriba por WhatsApp.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "CODE_SUBMITTED":
        texts.push(`🎮 <b>CÓDIGO DE CONSOLA RECIBIDO</b>\n\nEste es el código de la entrega ${shortCode}\n<b>Juego:</b> ${gameName}`);
        texts.push(`<code>${order?.console_code || ""}</code>`);
        break;
      case "COMPLETED":
        texts.push(`✅ <b>ENTREGA COMPLETADA</b>\n\nEl cliente confirmó que instaló el juego correctamente.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
      case "ISSUE":
        texts.push(`🆘 <b>PROBLEMA REPORTADO (SOPORTE)</b>\n\nEl cliente presionó el botón de Soporte porque tuvo un problema durante la instalación.\n\n<b>Orden:</b> <code>${shortCode}</code>\n<b>Juego:</b> ${gameName}`);
        break;
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
