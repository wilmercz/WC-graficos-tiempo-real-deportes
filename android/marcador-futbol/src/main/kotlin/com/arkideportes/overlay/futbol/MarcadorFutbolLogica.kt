package com.arkideportes.overlay.futbol

import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlin.math.max
import kotlin.math.roundToLong

/**
 * Lógica pura del marcador de fútbol (sin Android ni Compose).
 * Réplica de modules/panel-marcador.js y modules/config-manager.js del overlay web.
 */

// ─── Datos del partido: /ARKI_DEPORTES/PARTIDOACTUAL ─────────────────────────

data class PartidoFutbol(
    val deporte: String = "FUTBOL",
    val mostrarMarcador: Boolean = false,       // MARCADOR_FUTBOL
    val mostrarPenales: Boolean = false,        // MARCADOR_PENALES (tiene prioridad)
    val publicidadVideo: Boolean = false,       // MOSTRAR_PUBLICIDAD_VIDEOS (oculta todo)
    val equipo1: String = "EQUIPO 1",
    val equipo2: String = "EQUIPO 2",
    val goles1: String = "0",
    val goles2: String = "0",
    val numeroDeTiempo: String = "",            // 0T, 1T, 2T, 3T, 4T, 5T, PENALES
    val tiempoJuegoMin: Int = 45,               // TIEMPOJUEGO
    val fechaPlayMs: Long? = null,              // FECHA_PLAY
    val enPausa: Boolean = false,               // CRONO_EN_PAUSA
    val inicioPausaMs: Long? = null,            // CRONO_INICIO_PAUSA
    val pausaAcumuladaSeg: Long = 0,            // CRONO_PAUSA_ACUMULADA
    val offsetSeg: Long = 0,                    // CRONO_OFFSET
) {
    /** Misma regla que la web: bandera activa + deporte FUTBOL + sin penales. */
    val visible: Boolean
        get() = mostrarMarcador && deporte == "FUTBOL" && !mostrarPenales && !publicidadVideo

    companion object {
        fun desdeMapa(m: Map<*, *>): PartidoFutbol = PartidoFutbol(
            deporte = (m["DEPORTE"] as? String)?.takeIf { it.isNotEmpty() } ?: "FUTBOL",
            mostrarMarcador = m["MARCADOR_FUTBOL"].esVerdadero(),
            mostrarPenales = m["MARCADOR_PENALES"].esVerdadero(),
            // En la web solo cuenta el booleano true (no el texto "true")
            publicidadVideo = m["MOSTRAR_PUBLICIDAD_VIDEOS"] == true,
            equipo1 = m["EQUIPO1"].comoTexto() ?: "EQUIPO 1",
            equipo2 = m["EQUIPO2"].comoTexto() ?: "EQUIPO 2",
            goles1 = m["GOLES1"].comoGoles(),
            goles2 = m["GOLES2"].comoGoles(),
            numeroDeTiempo = m["NumeroDeTiempo"] as? String ?: "",
            // JS: Number(x) || 45  → 0, vacío o inválido = 45
            tiempoJuegoMin = m["TIEMPOJUEGO"].comoNumero()?.toInt()?.takeIf { it != 0 } ?: 45,
            fechaPlayMs = m["FECHA_PLAY"].comoEpochMs(),
            enPausa = m["CRONO_EN_PAUSA"].esVerdadero(),
            inicioPausaMs = m["CRONO_INICIO_PAUSA"].comoEpochMs(),
            pausaAcumuladaSeg = m["CRONO_PAUSA_ACUMULADA"].comoNumero()?.toLong() ?: 0,
            offsetSeg = m["CRONO_OFFSET"].comoNumero()?.toLong() ?: 0,
        )
    }
}

// ─── Tema: /CONFIGURACION_OVERLAYWEB ─────────────────────────────────────────

/** Colores en ARGB (0xAARRGGBB). En Compose: Color(tema.primario). */
data class TemaOverlay(
    val primario: Long = 0xFFFF6B00,
    val secundario: Long = 0xFF000000,
    val terciario: Long = 0xFF000000,
    val textoPrimario: Long = 0xFFFFFFFF,
    val textoSecundario: Long = 0xFFCCCCCC,
    val escala: Float = 1f,
) {
    /** color-mix(primario, #000 15%) */
    val primarioOscuro: Long get() = oscurecer(primario, 0.15f)

    /** color-mix(secundario, #000 25%) */
    val secundarioOscuro: Long get() = oscurecer(secundario, 0.25f)

    companion object {
        fun desdeMapa(m: Map<*, *>?): TemaOverlay {
            val def = TemaOverlay()
            if (m == null) return def
            val c = m["COLORES"] as? Map<*, *>
            return TemaOverlay(
                primario = parseHex(c?.get("PRIMARIO"), def.primario),
                secundario = parseHex(c?.get("SECUNDARIO"), def.secundario),
                terciario = parseHex(c?.get("TERCIARIO"), def.terciario),
                textoPrimario = parseHex(c?.get("TEXTO_PRIMARIO"), def.textoPrimario),
                textoSecundario = parseHex(c?.get("TEXTO_SECUNDARIO"), def.textoSecundario),
                // Rango válido 0.5–2.0 (igual que scale-manager.js)
                escala = (m["ESCALA_GLOBAL"].comoNumero()?.toFloat()?.takeIf { it != 0f } ?: 1f)
                    .coerceIn(0.5f, 2f),
            )
        }
    }
}

// ─── Estado visual calculado ─────────────────────────────────────────────────

enum class EstiloEstado { POR_JUGARSE, CORRIENDO, PAUSA, ENTRETIEMPO, FINALIZADO, PENALES }

data class MarcadorFutbolEstado(
    val equipo1: String,
    val equipo2: String,
    val goles1: String,
    val goles2: String,
    val textoEstado: String,
    val estilo: EstiloEstado,
)

/** Devuelve null cuando el panel debe estar oculto. */
fun calcularEstadoMarcador(p: PartidoFutbol?, ahoraServidorMs: Long): MarcadorFutbolEstado? {
    if (p == null || !p.visible) return null
    val (texto, estilo) = when (p.numeroDeTiempo) {
        "1T", "3T" -> textoReloj(p, ahoraServidorMs) to
            (if (p.enPausa) EstiloEstado.PAUSA else EstiloEstado.CORRIENDO)
        "2T" -> "ENTRETIEMPO" to EstiloEstado.ENTRETIEMPO
        "4T" -> "FINALIZADO" to EstiloEstado.FINALIZADO
        "5T", "PENALES" -> "DEFINICIÓN PENALES" to EstiloEstado.PENALES
        else -> "POR JUGARSE" to EstiloEstado.POR_JUGARSE
    }
    return MarcadorFutbolEstado(p.equipo1, p.equipo2, p.goles1, p.goles2, texto, estilo)
}

/**
 * Cronómetro: (ahora − FECHA_PLAY) − pausas + offset.
 * "1T • 23:07", o "1T • 45:00 +2" al pasar el tiempo reglamentario.
 * El 3T (segundo tiempo) se muestra como "2T".
 */
fun textoReloj(p: PartidoFutbol, ahoraServidorMs: Long): String {
    val nombre = if (p.numeroDeTiempo == "3T") "2T" else p.numeroDeTiempo.ifEmpty { "1T" }
    val inicio = p.fechaPlayMs ?: return "$nombre • 00:00"
    val ahora = if (p.enPausa && p.inicioPausaMs != null) p.inicioPausaMs else ahoraServidorMs

    val transcurridoMs = (ahora - inicio) - p.pausaAcumuladaSeg * 1000 + p.offsetSeg * 1000
    // La web detiene el reloj al pasar 2 horas
    val seg = max(0L, transcurridoMs / 1000).coerceAtMost(7200)
    val limite = p.tiempoJuegoMin * 60L

    if (seg <= limite) return "$nombre • %02d:%02d".format(seg / 60, seg % 60)

    val base = "$nombre • %02d:00".format(p.tiempoJuegoMin)
    val extraMin = (seg - limite + 59) / 60   // ceil
    return if (extraMin > 0) "$base +$extraMin" else base
}

// ─── Utilidades de lectura (Firebase entrega Long, Double, Boolean o String) ─

internal fun Any?.esVerdadero(): Boolean = this == true || this == "true"

internal fun Any?.comoTexto(): String? = when (this) {
    null -> null
    is String -> takeIf { it.isNotEmpty() }
    is Double -> if (this % 1.0 == 0.0) toLong().toString() else toString()
    else -> toString()
}

internal fun Any?.comoNumero(): Double? = when (this) {
    is Number -> toDouble()
    is String -> trim().toDoubleOrNull()
    else -> null
}

/** JS: data.GOLES1 ?? 0 */
internal fun Any?.comoGoles(): String = comoTexto() ?: if (this == "") "" else "0"

/** Número = milisegundos; texto ISO con o sin zona (sin zona = hora local del equipo). */
internal fun Any?.comoEpochMs(): Long? = when (this) {
    is Number -> toLong()
    is String -> runCatching { OffsetDateTime.parse(this).toInstant().toEpochMilli() }.getOrNull()
        ?: runCatching {
            LocalDateTime.parse(this).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }.getOrNull()
    else -> null
}

/** Acepta #RGB, #RRGGBB y #RRGGBBAA (formato CSS). Devuelve ARGB. */
internal fun parseHex(valor: Any?, porDefecto: Long): Long {
    val h = (valor as? String)?.trim()?.removePrefix("#") ?: return porDefecto
    val full = when (h.length) {
        3 -> h.map { "$it$it" }.joinToString("")
        6, 8 -> h
        else -> return porDefecto
    }
    val v = full.toLongOrNull(16) ?: return porDefecto
    return if (full.length == 6) 0xFF000000 or v
    else ((v and 0xFF) shl 24) or (v ushr 8)   // RRGGBBAA → AARRGGBB
}

internal fun oscurecer(argb: Long, negro: Float): Long {
    val f = 1f - negro
    val a = (argb ushr 24) and 0xFF
    val r = (((argb ushr 16) and 0xFF) * f).roundToLong()
    val g = (((argb ushr 8) and 0xFF) * f).roundToLong()
    val b = ((argb and 0xFF) * f).roundToLong()
    return (a shl 24) or (r shl 16) or (g shl 8) or b
}
