// Pega este bloque al final del Apps Script del bot.
// Usa SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y supabaseRequest() ya existentes.
//
// Script Properties adicionales:
// NEWSLETTER_SITE_URL   -> URL publica de Vercel, por ejemplo https://alfeicon-games.vercel.app
// NEWSLETTER_IMAGE_URL  -> URL publica de la imagen/banner del correo (opcional)
// NEWSLETTER_TEST_EMAIL -> tu correo para probar antes del primer envio

function escaparHtmlNewsletter(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function obtenerSuscriptoresNewsletter() {
  const rows = supabaseRequest(
    "newsletter_subscribers?select=email&subscribed=eq.true&order=created_at.asc",
    "get",
  );

  const seen = {};
  return (rows || [])
    .map((row) => String(row.email || "").trim().toLowerCase())
    .filter((email) => {
      if (!email || seen[email]) return false;
      seen[email] = true;
      return true;
    });
}

function obtenerPacksNuevosNewsletter(desde) {
  const iso = encodeURIComponent(desde.toISOString());
  return supabaseRequest(
    `packs?select=id,title,price,image_url,created_at,pack_items(title,sort_order)&is_active=eq.true&created_at=gte.${iso}&order=created_at.asc`,
    "get",
  ) || [];
}

function obtenerUltimosPacksNewsletter() {
  return supabaseRequest(
    "packs?select=id,title,price,image_url,created_at,pack_items(title,sort_order)&is_active=eq.true&order=created_at.desc&limit=3",
    "get",
  ) || [];
}

function obtenerJuegosDelPackNewsletter(pack) {
  return (pack.pack_items || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((item) => String(item.title || "").trim())
    .filter(Boolean);
}

function obtenerVentanaNewsletter() {
  const lastSent = PropertiesService.getScriptProperties().getProperty("NEWSLETTER_LAST_SENT_AT");
  if (lastSent) return new Date(lastSent);

  // Primera ejecucion: solo considera los ultimos siete dias.
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function crearHtmlNovedadesPacks(packs) {
  const properties = PropertiesService.getScriptProperties();
  const siteUrl = (properties.getProperty("NEWSLETTER_SITE_URL") || "").replace(/\/$/, "");
  const imageUrl = properties.getProperty("NEWSLETTER_IMAGE_URL") || `${siteUrl}/newsletter-banner.jpg`;

  const packPreview = packs.slice(0, 3).map((pack) => {
    const games = obtenerJuegosDelPackNewsletter(pack);
    const visibleGames = games.slice(0, 6);
    const extraGames = Math.max(0, games.length - visibleGames.length);
    const image = pack.image_url
      ? `<img src="${escaparHtmlNewsletter(pack.image_url)}" alt="" width="170" style="display:block;width:100%;max-width:170px;height:120px;object-fit:cover;border-radius:10px;margin:0 auto 12px;">`
      : "";
    const gamesHtml = visibleGames.length > 0
      ? `<div style="margin-top:10px;padding-top:9px;border-top:1px solid #e5e7eb;text-align:left;">
          <div style="margin-bottom:5px;color:#9ca3af;font-size:9px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Incluye</div>
          <ul style="margin:0;padding:0;list-style:none;color:#4b5563;font-size:11px;line-height:1.4;word-break:break-word;">${visibleGames.map((game) => `<li style="margin:2px 0;">&#8226;&nbsp; ${escaparHtmlNewsletter(game)}</li>`).join("")}${extraGames > 0 ? `<li style="margin-top:6px;color:#111827;font-weight:bold;">+${extraGames} juegos</li>` : ""}</ul>
        </div>`
      : "";
    return `<div style="display:inline-block;vertical-align:top;width:30%;min-width:175px;max-width:190px;box-sizing:border-box;margin:8px;padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-top:4px solid #ef4444;border-radius:14px;box-shadow:0 5px 14px rgba(15,23,42,.1);text-align:center;color:#252525;font-family:Arial,sans-serif;">
      ${image}
      <div style="margin-bottom:7px;color:#ef4444;font-size:9px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">Pack destacado</div>
      <strong style="display:block;font-size:13px;line-height:1.25;">${escaparHtmlNewsletter(pack.title)}</strong>
      <div style="margin-top:7px;color:#111827;font-size:15px;font-weight:bold;">$${Number(pack.price || 0).toLocaleString("es-CL")}</div>
      ${gamesHtml}
    </div>`;
  }).join("");

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f4f5;padding:24px 12px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#202124;">
      <img src="${escaparHtmlNewsletter(imageUrl)}" alt="Alfeicon Games" style="display:block;width:100%;max-height:220px;object-fit:cover;">
      <div style="padding:30px 24px;text-align:center;">
        <h1 style="margin:0 0 14px;font-size:25px;">Tenemos novedades</h1>
        <p style="margin:0 auto 22px;max-width:460px;font-size:16px;line-height:1.6;color:#555;">
          Tenemos nuevos packs disponibles. Estos son solo algunos destacados; entra a nuestra página para revisar todos los packs disponibles.
        </p>
        ${packPreview ? `<div style="margin:0 -4px 24px;padding:8px 2px;background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;text-align:center;"><div style="padding:4px 0 10px;color:#6b7280;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Algunos packs destacados</div>${packPreview}</div>` : ""}
        <a href="${escaparHtmlNewsletter(siteUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;">
          Ver todos los packs
        </a>
        <p style="margin:28px 0 0;font-size:11px;color:#888;">
          Recibes este aviso porque tienes una cuenta en Alfeicon Games.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function crearTextoNovedadesPacks(packs) {
  const properties = PropertiesService.getScriptProperties();
  const siteUrl = properties.getProperty("NEWSLETTER_SITE_URL") || "";
  const listado = packs
    .slice(0, 5)
    .map((pack) => `- ${pack.title}: $${Number(pack.price || 0).toLocaleString("es-CL")}`)
    .join("\n");

  return `Tenemos nuevos packs disponibles. Estos son solo algunos destacados.\n\n${listado}\n\nEntra a nuestra página para revisar todos los packs disponibles:\n${siteUrl}`;
}

// Ejecutar manualmente para probar el correo solo en NEWSLETTER_TEST_EMAIL.
function probarNovedadesPacks() {
  const properties = PropertiesService.getScriptProperties();
  const testEmail = properties.getProperty("NEWSLETTER_TEST_EMAIL");
  if (!testEmail) throw new Error("Falta NEWSLETTER_TEST_EMAIL en Script Properties.");

  const packs = obtenerUltimosPacksNewsletter();
  if (packs.length === 0) {
    Logger.log("No hay packs nuevos en la ventana de prueba.");
    return;
  }

  MailApp.sendEmail({
    to: testEmail,
    subject: "Nuevos packs disponibles en Alfeicon Games",
    body: crearTextoNovedadesPacks(packs),
    htmlBody: crearHtmlNovedadesPacks(packs),
    name: "Alfeicon Games",
  });

  Logger.log(`Prueba enviada a ${testEmail}.`);
}

// Ejecutar los lunes despues de comprobar probarNovedadesPacks().
function enviarNovedadesPacksSemanales() {
  const properties = PropertiesService.getScriptProperties();
  const siteUrl = properties.getProperty("NEWSLETTER_SITE_URL");
  if (!siteUrl) throw new Error("Falta NEWSLETTER_SITE_URL en Script Properties.");

  const packs = obtenerPacksNuevosNewsletter(obtenerVentanaNewsletter());
  if (packs.length === 0) {
    Logger.log("No hay packs nuevos para avisar esta semana.");
    return;
  }

  const recipients = obtenerSuscriptoresNewsletter();
  if (recipients.length === 0) {
    Logger.log("No hay suscriptores activos.");
    return;
  }

  const remaining = MailApp.getRemainingDailyQuota();
  if (remaining < recipients.length) {
    throw new Error(`Cuota insuficiente de Gmail: quedan ${remaining} y se necesitan ${recipients.length}.`);
  }

  const subject = "Nuevos packs disponibles en Alfeicon Games";
  const htmlBody = crearHtmlNovedadesPacks(packs);
  const textBody = crearTextoNovedadesPacks(packs);

  recipients.forEach((email) => {
    MailApp.sendEmail({
      to: email,
      subject,
      body: textBody,
      htmlBody,
      name: "Alfeicon Games",
    });
  });

  properties.setProperty("NEWSLETTER_LAST_SENT_AT", new Date().toISOString());
  Logger.log(`Aviso semanal enviado a ${recipients.length} suscriptores.`);
}

// ── Control del newsletter desde el menú de Telegram ───────────────────────
// Agrega el botón y las dos condiciones indicadas en las instrucciones de uso.

function newsletterEsAdmin(chatID) {
  const adminID = PropertiesService.getScriptProperties().getProperty("ADMIN_TELEGRAM_ID");
  return Boolean(adminID) && String(chatID) === String(adminID);
}

function prepararAvisoPacksDesdeTelegram(chatID) {
  if (!newsletterEsAdmin(chatID)) {
    enviarMensaje(chatID, "⛔ Esta acción está disponible solo para el administrador.");
    return;
  }

  const packs = obtenerPacksNuevosNewsletter(obtenerVentanaNewsletter());
  if (packs.length === 0) {
    enviarMensaje(chatID, "📭 No hay packs nuevos desde el último aviso.");
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
    return;
  }

  const recipients = obtenerSuscriptoresNewsletter();
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("NEWSLETTER_PENDING_CHAT_ID", String(chatID));
  properties.setProperty("NEWSLETTER_PENDING_UNTIL", String(Date.now() + 10 * 60 * 1000));

  enviarTeclado(
    chatID,
    `📣 Hay ${packs.length} pack${packs.length === 1 ? " nuevo" : "s nuevos"} para avisar a ${recipients.length} suscriptor${recipients.length === 1 ? "" : "es"}.\n\n¿Quieres enviar el correo ahora?`,
    [["✅ Confirmar aviso"], ["❌ Cancelar aviso"]],
  );
}

function confirmarAvisoPacksDesdeTelegram(chatID) {
  if (!newsletterEsAdmin(chatID)) {
    enviarMensaje(chatID, "⛔ Esta acción está disponible solo para el administrador.");
    return;
  }

  const properties = PropertiesService.getScriptProperties();
  const pendingChatID = properties.getProperty("NEWSLETTER_PENDING_CHAT_ID");
  const pendingUntil = Number(properties.getProperty("NEWSLETTER_PENDING_UNTIL") || 0);
  if (String(chatID) !== String(pendingChatID) || Date.now() > pendingUntil) {
    enviarMensaje(chatID, "⌛ La confirmación expiró. Vuelve a presionar Notificar packs nuevos.");
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
    return;
  }

  try {
    enviarMensaje(chatID, "⏳ Enviando novedades por correo...");
    enviarNovedadesPacksSemanales();
    enviarMensaje(chatID, "✅ Aviso enviado correctamente a los suscriptores.");
  } catch (error) {
    enviarMensaje(chatID, `❌ No se pudo enviar el aviso: ${error.message}`);
  } finally {
    properties.deleteProperty("NEWSLETTER_PENDING_CHAT_ID");
    properties.deleteProperty("NEWSLETTER_PENDING_UNTIL");
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
  }
}

function cancelarAvisoPacksDesdeTelegram(chatID) {
  if (!newsletterEsAdmin(chatID)) return;
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty("NEWSLETTER_PENDING_CHAT_ID");
  properties.deleteProperty("NEWSLETTER_PENDING_UNTIL");
  enviarMensaje(chatID, "👌 Aviso cancelado. No se envió ningún correo.");
  mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
}
