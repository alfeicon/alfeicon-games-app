// Integra el newsletter con el menú de Telegram.
// Pegar al final de Código.gs después de las funciones del newsletter.

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
