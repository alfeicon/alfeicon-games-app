import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message, source } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ error: "Telegram no configurado" }, { status: 500 });
    }

    const text = `🚨 <b>Error en Panel de Administrador</b>\n\n<b>Detalle:</b> ${message}\n<b>Ubicación:</b> <code>${source || "Desconocida"}</code>\n\n<i>${new Date().toLocaleString("es-CL")}</i>`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!res.ok) {
      console.error("[notify-error] Error Telegram:", await res.text());
      return NextResponse.json({ error: "Error enviando a Telegram" }, { status: 502 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[notify-error] Error interno:", error);
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 });
  }
}
