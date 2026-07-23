// Los mensajes del chat (order_messages.body) guardan solo texto. Para mandar
// una foto se guarda su URL con este prefijo; ambos lados la reconocen y la
// dibujan como imagen en vez de mostrar el enlace pelado. Así no hace falta
// una columna nueva ni tocar el realtime.
const PREFIJO_IMG = "[img]";

export function marcarImagen(url: string): string {
  return `${PREFIJO_IMG}${url}`;
}

/** URL de la foto si el mensaje es una imagen; null si es texto normal. */
export function urlImagen(body: string): string | null {
  return body.startsWith(PREFIJO_IMG) ? body.slice(PREFIJO_IMG.length) : null;
}
