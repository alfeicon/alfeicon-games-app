// Bot Telegram Alfeicon Games conectado a Supabase.
// Copia este archivo completo en Apps Script.
// Requiere estas Script Properties:
// TELEGRAM_BOT_TOKEN
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// WEB_APP_URL (URL /exec de la aplicacion web, necesaria para setWebhook)
// ADMIN_TELEGRAM_ID (opcional, para alerta de inactividad)

// ==========================================
// ⚙️ CONFIGURACIÓN PRINCIPAL
// ==========================================
// Configuracion principal
const DEFAULT_AUMENTO_CLP = 15000;
// 🔑 TOKEN DE TELEGRAM
const TELEGRAM_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");

// 📋 TUS DISTRIBUIDORES
const DISTRIBUIDORES = [
  ["@ShopeG_Seller", "@Mr_waluigi"],
  ["@PlatanoPsn", "@Engmina"],
  ["@im_evAn", "@EvolutionLion"],
  ["@Cristofer_2020", "Otro"]
];

// 📱 TUS PLATAFORMAS DE VENTA
const PLATAFORMAS = [
  ["💚 WhatsApp", "💜 Instagram"],
  ["💙 Messenger", "🌐 Otro"]
];

/** * ==========================================
 * 🚀 MANEJADOR PRINCIPAL (CEREBRO MEJORADO)
 * ==========================================
 */
const SUPABASE_URL = PropertiesService.getScriptProperties().getProperty("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_ROLE_KEY");

function obtenerRolSupabaseKey(key) {
  if (!key || !key.includes(".")) return "secret-key";

  try {
    const payload = key.split(".")[1];
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString();
    const json = JSON.parse(decoded);
    return json.role || "sin-role";
  } catch (error) {
    return "no-decodificable";
  }
}

function supabaseRequest(path, method, body) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Script Properties.");
  }

  const keyRole = obtenerRolSupabaseKey(SUPABASE_SERVICE_ROLE_KEY);
  if (keyRole !== "service_role") {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY no es service_role. Rol detectado: ${keyRole}. Copia la legacy service_role key, no anon ni publishable.`);
  }

  const options = {
    method: method.toUpperCase(),
    muteHttpExceptions: true,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Prefer: "return=representation",
      "User-Agent": "AlfeiconGamesBot/1.0",
      Accept: "application/json",
    },
  };

  if (!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) {
    options.headers.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/${path}`, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`Supabase ${status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function obtenerAumentoPackCLP() {
  try {
    const rows = supabaseRequest("app_settings?select=value&key=eq.pack_price_increase&limit=1", "get");
    const value = rows && rows.length > 0 ? Number(rows[0].value) : 0;
    return value > 0 ? value : DEFAULT_AUMENTO_CLP;
  } catch (error) {
    Logger.log(`No se pudo leer pack_price_increase, usando default: ${error.message}`);
    return DEFAULT_AUMENTO_CLP;
  }
}

function hashMensaje(texto) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return bytes.map((byte) => (`0${(byte & 0xff).toString(16)}`).slice(-2)).join("");
}

function obtenerSiguienteNumeroPack() {
  const rows = supabaseRequest("packs?select=bot_pack_number&bot_pack_number=not.is.null&order=bot_pack_number.desc&limit=1", "get");
  return rows && rows.length > 0 ? Number(rows[0].bot_pack_number) + 1 : 1;
}

function buscarPackPorHash(sourceHash) {
  const rows = supabaseRequest(`packs?select=id,bot_pack_number&source_hash=eq.${encodeURIComponent(sourceHash)}&limit=1`, "get");
  return rows && rows.length > 0 ? rows[0] : null;
}

function crearPackEnSupabase(packNumber, juegos, precioFinal, mensajeOriginal) {
  const sourceHash = hashMensaje(mensajeOriginal);
  const duplicado = buscarPackPorHash(sourceHash);

  if (duplicado) {
    return { duplicado: true, packNumber: duplicado.bot_pack_number };
  }

  const packRows = supabaseRequest("packs", "post", {
    title: `Pack ${packNumber}`,
    price: precioFinal,
    console: "switch",
    is_new: true,
    is_active: true,
    bot_pack_number: packNumber,
    source_message: mensajeOriginal,
    source_hash: sourceHash,
  });

  const pack = packRows[0];

  const items = juegos.map((title, index) => ({
    pack_id: pack.id,
    title,
    sort_order: index,
  }));

  try {
    if (items.length > 0) {
      supabaseRequest("pack_items", "post", items);
    }
  } catch (error) {
    supabaseRequest(`packs?id=eq.${encodeURIComponent(pack.id)}`, "delete");
    throw error;
  }

  return { duplicado: false, packNumber, packId: pack.id };
}

function esMensajeReenviado(message) {
  return Boolean(
    message?.forward_origin ||
    message?.forward_from ||
    message?.forward_from_chat ||
    message?.forward_sender_name ||
    message?.forward_date
  );
}

function pareceMensajeDePack(texto) {
  if (!texto) return false;
  const bloqueTexto = extraerTextoLimpio(texto);
  const juegos = limpiarJuegos(bloqueTexto);
  const precio = extraerPrecioCLP(texto, DEFAULT_AUMENTO_CLP);
  return juegos.length >= 2 && Boolean(precio);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("doPost no se ejecuta manualmente. Usa probarStart() o configura setWebhook y prueba desde Telegram.");
  }

  const payload = JSON.parse(e.postData.contents);
  const message = payload.message || payload.edited_message || {};
  const mensajeCrudo = (message.text || message.caption || "").trim();
  const chatID = message.chat?.id;

  if (!chatID) {
    throw new Error("Telegram no envio chat.id en el evento.");
  }

  // ── RESPONDER AL CLIENTE DESDE TELEGRAM ──────────────────────────────────
  // Basta con usar "Responder" sobre cualquier aviso que traiga el código de
  // la orden (ALF-XXXX). Lo escrito se inserta en order_messages como si lo
  // hubieras escrito desde el admin, y le llega al cliente al instante.
  if (message.reply_to_message && mensajeCrudo) {
    const citado = message.reply_to_message.text || message.reply_to_message.caption || "";
    const match = citado.match(/ALF-[A-Z0-9]{4}/i);
    if (match) {
      responderAlCliente(match[0].toUpperCase(), mensajeCrudo, chatID);
      return;
    }
  }

  if (esMensajeReenviado(message) && pareceMensajeDePack(mensajeCrudo)) {
    subirPackLogica(mensajeCrudo, chatID);
    return;
  }

  // 1. RESET Y EMERGENCIA (Prioridad Máxima)
  if (mensajeCrudo === "/start" || mensajeCrudo.includes("Restablecer Bot") || mensajeCrudo.includes("Volver al Menú") || mensajeCrudo.toLowerCase() === "cancelar") {
    resetBot();
    mostrarMenuPrincipal(chatID, "👋 Menú Principal (Bot Reiniciado):");
    return;
  }

  // 2. REPORTES (Usamos includes para ignorar diferencias de emojis)
  if (mensajeCrudo.includes("Estadísticas")) { mostrarMenuEstadisticas(chatID); return; }
  if (mensajeCrudo.includes("Historial Ventas")) { verUltimasVentas(chatID); return; }

  // 3. INICIADORES DE ACCIÓN (Buscar / Borrar / Vender)
  if (mensajeCrudo.toLowerCase().includes("buscar pack")) {
    resetBot();
    setEstadoVenta({ tipo: "SOLO_VER", paso: "ESPERANDO_ID" });
    enviarMensaje(chatID, "🔢 Escribe el ID del Pack, o el nombre de un juego para buscarlo:");
    return;
  }
  if (mensajeCrudo.includes("Gestión Stock")) {
    resetBot();
    setEstadoVenta({ tipo: "MENU_BORRADO", paso: "SELECCIONAR_OPCION" });
    mostrarMenuBorrado(chatID);
    return;
  }
  if (mensajeCrudo.includes("Deshacer Venta")) { deshacerUltimaVenta(chatID); return; }
  
  if (mensajeCrudo.includes("Registrar Venta")) {
    resetBot(); 
    const nuevoEstado = { tipo: "VENTA_CARRITO", paso: "MENU_CARRITO", carrito: [] };
    setEstadoVenta(nuevoEstado);
    mostrarMenuCarrito(chatID, "🛒 NUEVA VENTA INICIADA\nEl carrito está vacío. ¿Qué deseas agregar?");
    return;
  }

  // 4. FLUJO ACTIVO (Solo si no es un comando de arriba)
  const estado = getEstadoVenta();
  if (estado) {
    manejarFlujoVenta(chatID, mensajeCrudo, estado);
    return;
  }
}

/** * ==========================================
 * 🛒 FLUJO DE VENTA Y STOCK
 * ==========================================
 */
function manejarFlujoVenta(chatID, input, estado) {
  
  // --- GESTIÓN DE BORRADO / EDICIÓN ---
  if (estado.tipo === "MENU_BORRADO") {
    if (estado.paso === "SELECCIONAR_OPCION") {
      if (input.includes("Borrar 1 Pack")) {
        estado.paso = "ESPERANDO_ID_BORRAR"; actualizarEstadoVenta(estado);
        enviarMensaje(chatID, "🔢 Escribe el ID del Pack que quieres ELIMINAR:", true);
      } else if (input.includes("Editar Precio")) {
        estado.paso = "ESPERANDO_ID_EDITAR_PRECIO"; actualizarEstadoVenta(estado);
        enviarMensaje(chatID, "🔢 Escribe el ID del Pack cuyo precio quieres cambiar:", true);
      } else if (input.includes("Borrar TODO")) {
        estado.paso = "CONFIRMAR_BORRADO_TOTAL"; actualizarEstadoVenta(estado);
        enviarMensaje(chatID, "⚠️ PELIGRO CRÍTICO ⚠️\n\nEsto borra TODOS los packs y no se puede deshacer.\nEscribe: BORRAR AHORA", true);
      } else { resetBot(); mostrarMenuPrincipal(chatID, "🏠 Menú Principal:"); }
      return;
    }
    if (estado.paso === "ESPERANDO_ID_BORRAR") {
      eliminarPackLogica(parseInt(input), chatID); resetBot(); return;
    }
    if (estado.paso === "ESPERANDO_ID_EDITAR_PRECIO") {
      const id = parseInt(input.replace(/\D/g, ""));
      const datos = obtenerDatosPack(id);
      if (!datos) {
        enviarMensaje(chatID, "❌ ID no encontrado. Intenta de nuevo:");
        return;
      }
      estado.idEditarPrecio = id;
      estado.paso = "ESPERANDO_NUEVO_PRECIO"; actualizarEstadoVenta(estado);
      enviarMensaje(chatID, `✏️ Pack ${id} — Precio actual: $${Number(datos.precio).toLocaleString()}\n\n💰 Escribe el NUEVO precio (solo números):`);
      return;
    }
    if (estado.paso === "ESPERANDO_NUEVO_PRECIO") {
      const nuevoPrecio = parseInt(input.replace(/\D/g, ""));
      if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
        enviarMensaje(chatID, "❌ Precio inválido. Escribe solo números (Ejemplo: 15000):");
        return;
      }
      actualizarPrecioPack(estado.idEditarPrecio, nuevoPrecio, chatID);
      resetBot(); return;
    }
    if (estado.paso === "CONFIRMAR_BORRADO_TOTAL") {
      if (input === "BORRAR AHORA") { limpiarBaseDeDatos(chatID); }
      else { enviarMensaje(chatID, "❌ Cancelado."); mostrarMenuPrincipal(chatID, "🏠 Menú:"); }
      resetBot(); return;
    }
  }

  // --- BUSQUEDA (POR ID O POR NOMBRE DE JUEGO) ---
  if (estado.tipo === "SOLO_VER" && estado.paso === "ESPERANDO_ID") {
    const textoBuscado = input.trim();
    const esNumerico = /^\d+$/.test(textoBuscado);

    if (esNumerico) {
      mostrarDetallePack(chatID, parseInt(textoBuscado));
      resetBot(); return;
    }

    if (textoBuscado.length < 3) {
      enviarMensaje(chatID, "❌ Escribe el ID del Pack (Ejemplo: 5) o el nombre de un juego (mínimo 3 letras):");
      return;
    }

    const resultados = buscarPacksPorJuego(textoBuscado);

    if (resultados.length === 0) {
      enviarMensaje(chatID, `❌ No encontré ningún pack activo con "${textoBuscado}".`);
      mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
      resetBot(); return;
    }

    if (resultados.length === 1) {
      mostrarDetallePack(chatID, resultados[0].packNumber);
      resetBot(); return;
    }

    let msg = `🔎 Encontré ${resultados.length} packs con "${textoBuscado}":\n`;
    resultados.forEach((r) => { msg += `\n📦 Pack ${r.packNumber} — $${Number(r.precio).toLocaleString()} (${r.juego})`; });
    msg += "\n\n👇 Escribe el ID del pack que quieres ver:";
    enviarMensaje(chatID, msg);
    return;
  }

  // --- CARRITO DE VENTAS ---
  if (estado.paso === "MENU_CARRITO") {
    if (input.includes("Agregar Pack")) {
      estado.paso = "BUSCAR_PACK_ID"; actualizarEstadoVenta(estado);
      enviarMensaje(chatID, "🔢 Ingresa el ID del Pack:", true);
    } 
    else if (input.includes("Agregar Juego")) {
      estado.paso = "BUSCAR_UNITARIO_NOM"; actualizarEstadoVenta(estado);
      enviarMensaje(chatID, "🔍 Escribe el nombre del juego:", true);
    }
    else if (input.includes("Autopack")) {
      estado.paso = "AUTOPACK_NOMBRES"; actualizarEstadoVenta(estado);
      enviarMensaje(chatID, "✍️ Escribe los juegos (Ej: 'Smash + Mario'):", true);
    }
    else if (input.includes("Finalizar Venta")) {
      if (!estado.carrito || estado.carrito.length === 0) { enviarMensaje(chatID, "❌ Carrito vacío."); return; }
      estado.paso = "SELECCIONAR_PLATAFORMA"; actualizarEstadoVenta(estado);
      mostrarMenuPlataformas(chatID);
    }
    else if (input.includes("Cancelar")) { resetBot(); mostrarMenuPrincipal(chatID, "🏠 Cancelado."); }
    else { enviarMensaje(chatID, "Usa los botones."); }
    return;
  }

  // LÓGICA INTERNA DEL CARRITO (Pack, Unitario, Autopack, Costos...)
  if (estado.paso === "BUSCAR_PACK_ID") {
    const datos = obtenerDatosPack(parseInt(input));
    if (!datos) { enviarMensaje(chatID, "❌ ID no existe. Intenta de nuevo:"); return; }
    estado.itemTemporal = { tipo: "PACK", id: datos.id, detalle: `Pack ${datos.id} (${datos.juegos})`, precioVenta: datos.precio, consola: datos.consola };
    estado.paso = "CONFIRMAR_COSTO"; actualizarEstadoVenta(estado);
    enviarMensaje(chatID, `✅ Seleccionado: Pack ${datos.id}\n💰 Venta Sugerida: $${datos.precio}\n\n📉 Ingresa el COSTO de compra (Solo números):`);
    return;
  }
  if (estado.paso === "BUSCAR_UNITARIO_NOM") {
    const res = buscarJuegoEnExcel(input);
    if (res.length === 0) { enviarMensaje(chatID, `❌ Nada con "${input}". Intenta otro:`); return; }
    setResultadosTemporales(res);
    let msg = "🔎 Encontrados:\n";
    res.forEach((r, i) => msg += `\n${i + 1}. ${r.nombre} ➡️ $${r.precio}`);
    msg += "\n\n👇 Responde con el número (1, 2...):";
    estado.paso = "SELECCIONAR_UNITARIO_IDX"; actualizarEstadoVenta(estado); enviarMensaje(chatID, msg);
    return;
  }
  if (estado.paso === "SELECCIONAR_UNITARIO_IDX") {
    const idx = parseInt(input) - 1;
    const res = getResultadosTemporales();
    if (isNaN(idx) || idx < 0 || idx >= res.length) { enviarMensaje(chatID, "❌ Opción inválida."); return; }
    estado.itemTemporal = { tipo: "UNITARIO", detalle: res[idx].nombre, precioVenta: res[idx].precio, consola: "N/A" };
    estado.paso = "CONFIRMAR_COSTO"; actualizarEstadoVenta(estado);
    enviarMensaje(chatID, `✅ ${estado.itemTemporal.detalle}\n💰 Venta: $${estado.itemTemporal.precioVenta}\n\n📉 Ingresa el COSTO de compra:`);
    return;
  }
  if (estado.paso === "AUTOPACK_NOMBRES") {
    estado.itemTemporal = { tipo: "AUTOPACK", detalle: input + " (Autopack)", consola: "N/A" };
    estado.paso = "AUTOPACK_PRECIO_VENTA"; actualizarEstadoVenta(estado);
    enviarMensaje(chatID, "💰 PRECIO TOTAL de Venta (Solo números):", true);
    return;
  }
  if (estado.paso === "AUTOPACK_PRECIO_VENTA") {
    const venta = parseInt(input.replace(/\D/g, ""));
    estado.itemTemporal.precioVenta = venta;
    estado.paso = "CONFIRMAR_COSTO"; actualizarEstadoVenta(estado);
    enviarMensaje(chatID, `✅ Venta: $${venta}.\n\n📉 Ingresa el COSTO de compra:`);
    return;
  }
  if (estado.paso === "CONFIRMAR_COSTO") {
    const yaConfirmado = estado.costoPendiente !== undefined;
    const costo = (input.toUpperCase() === "SI" && yaConfirmado) ? estado.costoPendiente : parseInt(input.replace(/\D/g, ""));
    const venta = estado.itemTemporal.precioVenta;
    if (costo > venta && !yaConfirmado) {
       estado.costoPendiente = costo; actualizarEstadoVenta(estado);
       enviarMensaje(chatID, `⚠️ ALERTA: Pierdes $${costo - venta}.\nEscribe "SI" para confirmar.`);
       return;
    }
    delete estado.costoPendiente;
    estado.itemTemporal.costo = costo;
    estado.itemTemporal.ganancia = venta - costo;
    estado.paso = "SELECCIONAR_PROVEEDOR_ITEM"; actualizarEstadoVenta(estado);
    mostrarMenuProveedores(chatID);
    return;
  }
  if (estado.paso === "SELECCIONAR_PROVEEDOR_ITEM") {
    if (input === "Otro") {
      estado.paso = "PROVEEDOR_MANUAL_ITEM"; actualizarEstadoVenta(estado);
      enviarMensaje(chatID, "✍️ Escribe el nombre del proveedor:", true);
      return;
    }
    agregarItemAlCarro(chatID, estado, input);
    return;
  }
  if (estado.paso === "PROVEEDOR_MANUAL_ITEM") {
    agregarItemAlCarro(chatID, estado, input);
    return;
  }
  if (estado.paso === "SELECCIONAR_PLATAFORMA") {
     estado.plataformaGlobal = input; 
     estado.paso = "FINALIZAR_CON_CLIENTE"; actualizarEstadoVenta(estado);
     enviarMensaje(chatID, `📱 Red: ${input}\n\n🧑‍💻 Nombre del CLIENTE:`, true);
     return;
  }
  if (estado.paso === "FINALIZAR_CON_CLIENTE") {
    finalizarVentaCarrito(chatID, estado, input); 
    return;
  }
}

/** * ==========================================
 * 🔧 FUNCIONES AUXILIARES
 * ==========================================
 */
function agregarItemAlCarro(chatID, estado, proveedor) {
  estado.itemTemporal.proveedor = proveedor;
  estado.carrito.push(estado.itemTemporal);
  delete estado.itemTemporal;
  estado.paso = "MENU_CARRITO"; actualizarEstadoVenta(estado);
  
  let total = 0;
  let resumen = "🛒 TU CARRITO:\n";
  estado.carrito.forEach((it, i) => { 
    resumen += `${i+1}. ${it.detalle}\n   └ Prov: ${it.proveedor} | $${it.precioVenta}\n`; 
    total += it.precioVenta; 
  });
  resumen += `\n💰 TOTAL: $${total.toLocaleString()}\n\n¿Qué deseas hacer?`;
  mostrarMenuCarrito(chatID, resumen);
}

function finalizarVentaCarrito(chatID, estado, cliente) {
  try {
    let totalVenta = 0;
    let mensajeDetalle = "";

    estado.carrito.forEach((item) => {
      const venta = Number(item.precioVenta) || 0;
      const costo = Number(item.costo) || 0;

      supabaseRequest("sales", "post", {
        item_type: item.tipo === "PACK" ? "pack" : "game",
        item_title: item.detalle,
        price_sold: venta,
        cost_price: costo,
        payment_method: estado.plataformaGlobal || "Otro",
        provider: item.proveedor || null,
        notes: cliente ? `Cliente: ${cliente}` : null,
      });

      if (item.tipo === "PACK") {
        supabaseRequest(`packs?bot_pack_number=eq.${encodeURIComponent(item.id)}`, "delete");
      }

      totalVenta += venta;
      mensajeDetalle += `▫️ ${item.detalle}\n`;
    });

    enviarMensaje(chatID, `✅ VENTA GUARDADA EN SUPABASE\n\n${mensajeDetalle}\n💵 Total: $${totalVenta.toLocaleString()}\n👤 Cliente: ${cliente}`);
    enviarComprobante(chatID, cliente, estado.carrito.length > 1 ? "Varios Productos" : estado.carrito[0].detalle, totalVenta);
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
    resetBot();
  } catch (error) {
    enviarMensaje(chatID, `❌ Error guardando venta: ${error.message}`);
  }
}

function deshacerUltimaVenta(chatID) {
  try {
    const rows = supabaseRequest("sales?select=id,item_title,notes&order=created_at.desc&limit=1", "get");

    if (!rows || rows.length === 0) {
      enviarMensaje(chatID, "❌ No hay ventas.");
      mostrarMenuPrincipal(chatID, "🏠 Menú:");
      return;
    }

    const venta = rows[0];
    supabaseRequest(`sales?id=eq.${encodeURIComponent(venta.id)}`, "delete");
    enviarMensaje(chatID, `↩️ VENTA ELIMINADA:\n❌ ${venta.item_title} (${venta.notes || "Sin datos"})`);
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
  } catch (error) {
    enviarMensaje(chatID, `❌ Error deshaciendo venta: ${error.message}`);
  }
}

function mostrarMenuPrincipal(chatID, texto) {
  const teclado = { keyboard: [[{text: "💰 Registrar Venta"}, {text: "🔍 Buscar Pack"}], [{text: "📊 Estadísticas"}, {text: "🗑️ Gestión Stock"}], [{text: "↩️ Deshacer Venta"}, {text: "🔄 Restablecer Bot"}]], resize_keyboard: true };
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatID, text: texto, reply_markup: teclado }) });
}
function mostrarMenuEstadisticas(chatID) {
  const teclado = [[{text: "📋 Historial Ventas"}], [{text: "🔙 Volver al Menú"}]];
  enviarTeclado(chatID, "📊 ESTADÍSTICAS:", teclado);
}
function mostrarMenuBorrado(chatID) { enviarTeclado(chatID, "🗑️ GESTIÓN STOCK:", [[{text: "📦 Borrar 1 Pack"}, {text: "✏️ Editar Precio"}], [{text: "🔥 Borrar TODO"}], [{text: "🔙 Volver"}]]); }
function mostrarMenuCarrito(chatID, texto) { enviarTeclado(chatID, texto, [[{text: "📦 Agregar Pack"}, {text: "🎮 Agregar Juego"}], [{text: "🚀 Autopack"}, {text: "✅ Finalizar Venta"}], [{text: "❌ Cancelar"}]]); }
function mostrarMenuProveedores(chatID) { enviarTeclado(chatID, "👤 Selecciona PROVEEDOR:", DISTRIBUIDORES); }
function mostrarMenuPlataformas(chatID) { enviarTeclado(chatID, "📱 ¿Por dónde se vendió?", PLATAFORMAS); }
function enviarTeclado(chatID, texto, teclado) { UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatID, text: texto, reply_markup: { keyboard: teclado, resize_keyboard: true, one_time_keyboard: true } }) }); }
function enviarComprobante(chatID, cliente, producto, precio) {
  const msg = `🧾 *COMPROBANTE*\n👤 *Cliente:* ${cliente}\n🎮 *Item:* ${producto}\n💰 *Total:* $${precio.toLocaleString()}\n📅 *Fecha:* ${new Date().toLocaleDateString('es-CL')}`;
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatID, text: msg, parse_mode: "Markdown" }) });
}

function verUltimasVentas(chatID) {
  try {
    const ventas = supabaseRequest(
      "sales?select=item_title,price_sold,cost_price,created_at&order=created_at.desc&limit=10",
      "get",
    );

    if (!ventas || ventas.length === 0) {
      enviarMensaje(chatID, "📭 Vacío.");
      mostrarMenuPrincipal(chatID, "🏠 Menú:");
      return;
    }

    let msg = "📋 ÚLTIMAS VENTAS:\n";
    ventas.forEach((venta) => {
      const ganancia = Number(venta.price_sold || 0) - Number(venta.cost_price || 0);
      msg += `\n📅 ${new Date(venta.created_at).toLocaleDateString("es-CL")} | ${venta.item_title}\n💵 +$${ganancia.toLocaleString()}`;
    });

    enviarMensaje(chatID, msg);
    mostrarMenuPrincipal(chatID, "🏠 Menú:");
  } catch (error) {
    enviarMensaje(chatID, `❌ Error leyendo ventas: ${error.message}`);
  }
}

/** * ==========================================
 * 🛠️ UTILS Y LÓGICA DE SUBIDA
 * ==========================================
 */
// EXTRACTORES DE DATOS
function extraerTextoLimpio(texto) {
  const matchLista = texto.match(/List Game\s*[-=]*\s*([\s\S]*?)----End/i); if (matchLista) return matchLista[1];
  const matchTransaccion = texto.match(/Transaction=+\s*([\s\S]*?)=+PRICE/i); if (matchTransaccion) return matchTransaccion[1];
  return texto; 
}
function limpiarJuegos(textoBloque) {
  return textoBloque
    .replace(/<br>/g, "\n").replace(/<[^>]*>/g, "").split("\n")
    .map(l => l.replace(/\p{Extended_Pictographic}/gu, "").trim())
    .filter(linea => {
      // 1. Si la línea es muy corta, o son solo guiones/separadores decorativos, fuera.
      if (linea.length < 3 || /^[-=_─-╿\s]+$/.test(linea)) return false;

      // 2. Filtros de Precios y Totales
      if (/Price|Precio|Valor|Monto|Total|^\d+\s*\$/i.test(linea)) return false;

      // 3. Filtros de Datos de Cuenta (ID, Country, etc.)
      if (/^(ID|Country|For buy|Buy product|Nickname|Date of|Gender|Wallet|PayPal|Linked|Gold Point|Membership|Details|Transaction|Vendedor|Seller|Vendor|NINTENDO SWITCH ACCOUNT|Balance|CC|Orders|Devices|Active Plan|Game Voucher|Child|IsChild)/i.test(linea)) return false;
      if (/waluigi store chile|nintendo primarias|store chile/i.test(linea)) return false;

      // 4. NUEVO FILTRO: Elimina "no games found" y variantes
      if (/no games found|no active membership|no linked paypal/i.test(linea)) return false;

      // 5. Elimina usuarios de Telegram (@usuario)
      if (linea.startsWith("@")) return false;

      // 6. Elimina encabezados decorativos sin emojis (ej: "NUEVA CUENTA DISPONIBLE", "NINTENDO SWITCH")
      if (/^(NUEVA CUENTA DISPONIBLE|NINTENDO SWITCH)$/i.test(linea)) return false;

      return true;
    })
    .map(j => j.replace(/^\d+[\.\)\-]\s*/, "").replace(/&apos;/g, "'").replace(/["“”]/g, "").replace(/DLC only/gi, "(DLC)").trim());
}
function extraerPrecioCLP(texto, aumento) {
  const parseMontoCLP = (valor) => parseInt(valor.replace(/[^\d]/g, ""), 10);

  let match = texto.match(/(?:Precio|Valor|Monto|Total|CLP|🇨🇱)[^\d]{0,20}([0-9]{1,3}(?:[.\s]?[0-9]{3})+)/i);
  if (match) return parseMontoCLP(match[1]) + aumento;

  match = texto.match(/(?:^|\n)\s*\$?\s*([0-9]{1,3}(?:[.\s]?[0-9]{3})+)(?:\s*CLP)?/i);
  if (match) return parseMontoCLP(match[1]) + aumento;

  match = texto.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:USDT|USD)\b/i);
  if (match) return Math.round(parseFloat(match[1].replace(",", ".")) * 1000) + aumento;

  match = texto.match(/Price[^\n0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
  if (match) return Math.round(parseFloat(match[1].replace(",", ".")) * 1000) + aumento;

  // Línea suelta tipo "10$" sin ninguna palabra clave antes (Price/Precio/USD).
  match = texto.match(/(?:^|\n)\s*([0-9]+(?:[.,][0-9]+)?)\$\s*(?:\n|$)/);
  if (match) return Math.round(parseFloat(match[1].replace(",", ".")) * 1000) + aumento;

  return null;
}
function subirPackLogica(mensaje, chatID) {
  try {
    const mensajeLimpio = mensaje.trim();
    const bloqueTexto = extraerTextoLimpio(mensajeLimpio);
    const juegos = limpiarJuegos(bloqueTexto);

    if (juegos.length === 0) {
      enviarMensaje(chatID, "❌ Error: No encontré juegos.");
      return;
    }

    const precioFinal = extraerPrecioCLP(mensajeLimpio, obtenerAumentoPackCLP());

    if (!precioFinal) {
      enviarMensaje(chatID, "❌ Error: No encontré precio.");
      return;
    }

    const packNumber = obtenerSiguienteNumeroPack();
    const result = crearPackEnSupabase(packNumber, juegos, precioFinal, mensajeLimpio);

    if (result.duplicado) {
      enviarMensaje(chatID, `⚠️ Pack duplicado. Ya existe como Pack ${result.packNumber}.`);
      return;
    }

    enviarMensaje(chatID, `✅ PACK ${result.packNumber} SUBIDO A SUPABASE\n🎮 Juegos: ${juegos.length}\n💰 Venta: $${precioFinal.toLocaleString()}`);
  } catch (error) {
    enviarMensaje(chatID, `❌ Error Supabase: ${error.message}`);
  }
}

// PROPIEDADES Y SOPORTE
const props = PropertiesService.getScriptProperties();
function setEstadoVenta(o) { props.setProperty("venta_estado", JSON.stringify(o)); }
function getEstadoVenta() { const j = props.getProperty("venta_estado"); return j ? JSON.parse(j) : null; }
function actualizarEstadoVenta(o) { setEstadoVenta(o); }
function setResultadosTemporales(res) { props.setProperty("resultados_temp", JSON.stringify(res)); }
function getResultadosTemporales() { const j = props.getProperty("resultados_temp"); return j ? JSON.parse(j) : []; }
function resetBot() {
  props.deleteProperty("venta_estado");
  props.deleteProperty("resultados_temp");
}
function buscarJuegoEnExcel(q) {
  const term = encodeURIComponent(`*${q.trim()}*`);
  const rows = supabaseRequest(
    `games?select=title,price,is_offer,offer_price,is_active&is_active=eq.true&title=ilike.${term}&order=title.asc&limit=8`,
    "get",
  );

  return (rows || []).map((game) => ({
    nombre: game.title,
    precio: game.is_offer && game.offer_price ? game.offer_price : game.price,
  }));
}
function obtenerDatosPack(idBuscado) {
  const rows = supabaseRequest(
    `packs?select=id,title,price,console,source_message,pack_items(title,sort_order)&bot_pack_number=eq.${encodeURIComponent(idBuscado)}&limit=1`,
    "get",
  );

  if (!rows || rows.length === 0) return null;

  const pack = rows[0];
  const juegos = (pack.pack_items || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => item.title)
    .join("\n");

  return {
    id: idBuscado,
    juegos,
    precio: pack.price,
    consola: pack.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2",
    mensajeOriginal: pack.source_message || juegos,
  };
}
function buscarPacksPorJuego(query) {
  const term = encodeURIComponent(`*${query.trim()}*`);
  const rows = supabaseRequest(
    `pack_items?select=title,packs!inner(bot_pack_number,price,is_active)&title=ilike.${term}&packs.is_active=eq.true&order=title.asc&limit=15`,
    "get",
  );

  const vistos = new Set();
  const resultados = [];
  (rows || []).forEach((item) => {
    const pack = item.packs;
    if (!pack || !pack.bot_pack_number || vistos.has(pack.bot_pack_number)) return;
    vistos.add(pack.bot_pack_number);
    resultados.push({ packNumber: pack.bot_pack_number, precio: pack.price, juego: item.title });
  });
  return resultados;
}
function mostrarDetallePack(chatID, id) {
  const datos = obtenerDatosPack(id);

  if (!datos) {
    enviarMensaje(chatID, `❌ El ID ${id} no existe.`);
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
    return;
  }

  // 1. Título corto
  enviarMensaje(chatID, `📂 Pack ${datos.id} (Precio: $${datos.precio})`);

  // 2. Limpieza de comilla y envío de mensaje original
  let mensajeRaw = datos.mensajeOriginal.toString();
  if (mensajeRaw.startsWith("'")) {
    mensajeRaw = mensajeRaw.substring(1);
  }
  enviarMensaje(chatID, mensajeRaw);

  mostrarMenuPrincipal(chatID, "🏠 Búsqueda finalizada.");
}
function actualizarPrecioPack(id, nuevoPrecio, chatID) {
  try {
    supabaseRequest(`packs?bot_pack_number=eq.${encodeURIComponent(id)}`, "patch", { price: nuevoPrecio });
    enviarMensaje(chatID, `✅ Pack ${id} actualizado.\n💰 Nuevo precio: $${nuevoPrecio.toLocaleString()}`);
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
  } catch (error) {
    enviarMensaje(chatID, `❌ Error actualizando precio: ${error.message}`);
  }
}
function eliminarPackLogica(id, chatID) {
  try {
    const datos = obtenerDatosPack(id);

    if (!datos) {
      enviarMensaje(chatID, "❌ ID no encontrado.");
      mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
      return;
    }

    supabaseRequest(`packs?bot_pack_number=eq.${encodeURIComponent(id)}`, "delete");
    enviarMensaje(chatID, `✅ Pack ${id} eliminado de Supabase.`);
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
  } catch (error) {
    enviarMensaje(chatID, `❌ Error eliminando pack: ${error.message}`);
  }
}
function limpiarBaseDeDatos(chatID) {
  try {
    supabaseRequest("pack_items?id=not.is.null", "delete");
    supabaseRequest("packs?id=not.is.null", "delete");
    if (!chatID) {
      Logger.log("Todos los packs fueron borrados en Supabase.");
      return;
    }

    enviarMensaje(chatID, "🔥 TODOS LOS PACKS FUERON BORRADOS EN SUPABASE.");
    mostrarMenuPrincipal(chatID, "🏠 Menú Principal:");
  } catch (error) {
    if (!chatID) {
      throw error;
    }

    enviarMensaje(chatID, `❌ Error borrando packs: ${error.message}`);
  }
}

function limpiarBaseDeDatosManual() {
  limpiarBaseDeDatos(null);
}
// Inserta un mensaje del admin en el chat de soporte de una orden. El cliente
// lo recibe en su burbuja por realtime, sin recargar.
function responderAlCliente(shortCode, texto, chatID) {
  try {
    const orders = supabaseRequest(
      `orders?short_code=eq.${encodeURIComponent(shortCode)}&select=id,game_name&limit=1`,
      "get",
    );

    if (!orders || orders.length === 0) {
      enviarMensaje(chatID, `⚠️ No encontré la orden ${shortCode}. ¿Sigue existiendo?`);
      return;
    }

    supabaseRequest("order_messages", "post", {
      order_id: orders[0].id,
      sender: "admin",
      body: texto,
    });

    enviarMensaje(chatID, `✅ Enviado al cliente de ${shortCode} (${orders[0].game_name}).`);
  } catch (error) {
    Logger.log(`responderAlCliente: ${error.message}`);
    enviarMensaje(chatID, `❌ No se pudo enviar: ${error.message}`);
  }
}

function enviarMensaje(chatId, texto, borrarTeclado = false) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en Script Properties.");
  }

  const payload = { chat_id: chatId, text: texto }; if (borrarTeclado) payload.reply_markup = { remove_keyboard: true };
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
}
function setWebhook() {
  const webAppUrl = PropertiesService.getScriptProperties().getProperty("WEB_APP_URL");
  if (!webAppUrl) throw new Error("Falta WEB_APP_URL en Script Properties.");
  if (!TELEGRAM_BOT_TOKEN) throw new Error("Falta TELEGRAM_BOT_TOKEN en Script Properties.");
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webAppUrl)}`;
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}

function probarStart() {
  const chatID = PropertiesService.getScriptProperties().getProperty("ADMIN_TELEGRAM_ID");
  if (!chatID) throw new Error("Falta ADMIN_TELEGRAM_ID en Script Properties para usar probarStart().");

  doPost({
    postData: {
      contents: JSON.stringify({
        message: {
          chat: { id: chatID },
          text: "/start",
        },
      }),
    },
  });
}

/** * ==========================================
 * ⏰ SISTEMA DE ALARMA DE INACTIVIDAD
 * ==========================================
 * Instrucciones:
 * 1. Pega esto al final del archivo.
 * 2. Ve al relojito (Activadores) a la izquierda.
 * 3. Añade activador: funcion "verificarInactividad", fuente "Según tiempo", "Por días".
 */
function verificarInactividad() {
  const ADMIN_ID = PropertiesService.getScriptProperties().getProperty("ADMIN_TELEGRAM_ID");
  const DIAS_LIMITE = 4;
  if (!ADMIN_ID) return;

  const rows = supabaseRequest(
    "packs?select=created_at&bot_pack_number=not.is.null&order=created_at.desc&limit=1",
    "get",
  );

  if (!rows || rows.length === 0 || !rows[0].created_at) return;

  const hoy = new Date();
  const ultimaFecha = new Date(rows[0].created_at);
  const diferenciaTiempo = hoy.getTime() - ultimaFecha.getTime();
  const diasSinSubir = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

  if (diasSinSubir >= DIAS_LIMITE) {
    const mensaje = `⚠️ *ALERTA DE INACTIVIDAD* ⚠️\n\n` +
                    `Han pasado *${diasSinSubir} días* desde el último Pack subido.\n` +
                    `¡La web se ve desactualizada! Sube algo pronto. 🚀`;
    
    UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: ADMIN_ID, text: mensaje, parse_mode: "Markdown" })
    });
  }
}
