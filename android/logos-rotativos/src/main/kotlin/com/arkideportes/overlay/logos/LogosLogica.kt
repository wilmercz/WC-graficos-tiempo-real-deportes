package com.arkideportes.overlay.logos

/**
 * Lógica pura del panel de logos rotativos (sin Android ni Compose).
 * Réplica de modules/panel-logos.js del overlay web.
 */

/** Tiempo que permanece cada logo en pantalla (fijo en la web, no viene de Firebase). */
const val INTERVALO_ROTACION_MS = 60_000L

/**
 * /ARKI_DEPORTES/LOGOS_AI_AIRE es una lista de objetos con campo `url`
 * (link público de Firebase Storage u otro hosting). Se descartan los que no
 * tienen `url` de texto no vacío. Recibe los hijos en el orden de Firebase (por clave).
 */
fun extraerUrlsLogos(hijos: Iterable<Any?>): List<String> =
    hijos.mapNotNull { (it as? Map<*, *>)?.get("url") as? String }
        .filter { it.isNotEmpty() }

/** /ARKI_DEPORTES/PARTIDOACTUAL/PANEL_LOGOS: si no existe, el panel se muestra. */
fun panelLogosActivo(valor: Any?): Boolean = valor == null || valor == true || valor == "true"

/** /CONFIGURACION_OVERLAYWEB/ESCALA_GLOBAL, limitada a 0.5–2.0. */
fun escalaGlobal(valor: Any?): Float {
    val n = when (valor) {
        is Number -> valor.toFloat()
        is String -> valor.trim().toFloatOrNull()
        else -> null
    }
    return (n?.takeIf { it != 0f } ?: 1f).coerceIn(0.5f, 2f)
}

data class ConfigLogos(
    val urls: List<String> = emptyList(),
    val panelActivo: Boolean = true,          // PANEL_LOGOS
    val publicidadVideo: Boolean = false,     // MOSTRAR_PUBLICIDAD_VIDEOS (oculta todo)
) {
    val visible: Boolean get() = urls.isNotEmpty() && panelActivo && !publicidadVideo

    /** Con un solo logo no hay rotación. */
    val rota: Boolean get() = visible && urls.size > 1
}

/** Índice del siguiente logo, volviendo al primero al llegar al final. */
fun siguienteIndiceLogo(actual: Int, total: Int): Int = if (total <= 0) 0 else (actual + 1) % total
