package com.arkideportes.overlay.futbol

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * Panel del marcador de fútbol para el overlay.
 *
 * Las medidas son las del CSS web (px en un lienzo de 1920×1080) y se escalan al ancho real
 * de la pantalla. ESCALA_GLOBAL se aplica desde la esquina superior izquierda.
 */
@Composable
fun PanelMarcadorFutbol(
    modifier: Modifier = Modifier,
    viewModel: MarcadorFutbolViewModel = viewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    PanelMarcadorFutbol(ui, modifier)
}

@Composable
fun PanelMarcadorFutbol(ui: MarcadorFutbolUi, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val estado = ui.estado ?: return@BoxWithConstraints
        val px = maxWidth / ANCHO_REFERENCIA           // 1 px del diseño web
        MarcadorFutbol(
            estado = estado,
            tema = ui.tema,
            u = px * ui.tema.escala,
            modifier = Modifier.offset(x = px * 20, y = px * 20),   // top: 20px; left: 20px
        )
    }
}

@Composable
private fun MarcadorFutbol(
    estado: MarcadorFutbolEstado,
    tema: TemaOverlay,
    u: Dp,
    modifier: Modifier = Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        BarraEstado(estado, tema, u)
        Row(verticalAlignment = Alignment.CenterVertically) {
            CajaEquipo(estado.equipo1, izquierda = true, tema, u)
            CajaGoles(estado.goles1, estado.goles2, tema, u)
            CajaEquipo(estado.equipo2, izquierda = false, tema, u)
        }
    }
}

@Composable
private fun BarraEstado(estado: MarcadorFutbolEstado, tema: TemaOverlay, u: Dp) {
    val (fondo, texto, tamano) = when (estado.estilo) {
        EstiloEstado.POR_JUGARSE -> Triple(Color(0xFF006400), Color.White, 15)
        EstiloEstado.ENTRETIEMPO -> Triple(Color(0xFFA74402), Color(tema.textoPrimario), 15)
        EstiloEstado.FINALIZADO -> Triple(Color(0xFFB30000), Color.White, 15)
        EstiloEstado.PAUSA -> Triple(Color(tema.terciario), Color(tema.primario), 20)
        EstiloEstado.CORRIENDO,
        EstiloEstado.PENALES -> Triple(Color(tema.terciario), Color(tema.textoSecundario), 20)
    }
    Text(
        text = estado.textoEstado,
        color = texto,
        fontSize = (u * tamano).sp(),
        fontWeight = FontWeight.Bold,
        letterSpacing = (u * 0.5f).sp(),
        textAlign = TextAlign.Center,
        maxLines = 1,
        softWrap = false,
        modifier = Modifier
            .background(fondo, RoundedCornerShape(topStart = u * 6, topEnd = u * 6))
            .padding(horizontal = u * 16, vertical = u * 6),
    )
}

@Composable
private fun CajaEquipo(nombre: String, izquierda: Boolean, tema: TemaOverlay, u: Dp) {
    val corte = with(LocalDensity.current) { (u * 12).toPx() }
    val oscuro = Color(tema.primarioOscuro)
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .clip(corteEquipo(izquierda, corte))
            .background(Brush.verticalGradient(listOf(oscuro, Color(tema.primario), oscuro)))
            .widthIn(min = u * 160)
            .padding(horizontal = u * 18, vertical = u * 7),
    ) {
        Text(
            text = nombre,
            color = Color(tema.textoPrimario),
            fontSize = (u * 28).sp(),
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            softWrap = false,
        )
    }
}

@Composable
private fun CajaGoles(goles1: String, goles2: String, tema: TemaOverlay, u: Dp) {
    val oscuro = Color(tema.secundarioOscuro)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(Brush.verticalGradient(listOf(oscuro, Color(tema.secundario), oscuro)))
            .padding(horizontal = u * 22, vertical = u * 1),
    ) {
        TextoGoles(goles1, tema, u)
        TextoGoles("-", tema, u, Modifier.padding(horizontal = u * 8))
        TextoGoles(goles2, tema, u)
    }
}

@Composable
private fun TextoGoles(texto: String, tema: TemaOverlay, u: Dp, modifier: Modifier = Modifier) {
    Text(
        text = texto,
        color = Color(tema.textoSecundario),
        fontSize = (u * 40).sp(),
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        softWrap = false,
        modifier = modifier,
    )
}

/** Izquierda: corta la esquina inferior izquierda. Derecha: la inferior derecha. */
private fun corteEquipo(izquierda: Boolean, c: Float) = GenericShape { size, _ ->
    moveTo(0f, 0f)
    lineTo(size.width, 0f)
    if (izquierda) {
        lineTo(size.width, size.height)
        lineTo(c, size.height)
        lineTo(0f, size.height - c)
    } else {
        lineTo(size.width, size.height - c)
        lineTo(size.width - c, size.height)
        lineTo(0f, size.height)
    }
    close()
}

/** Convierte un tamaño en Dp a sp ignorando la escala de fuente del sistema (overlay fijo). */
@Composable
private fun Dp.sp(): TextUnit = with(LocalDensity.current) { this@sp.toSp() }

private const val ANCHO_REFERENCIA = 1920f

// ─── Preview (no necesita Firebase) ──────────────────────────────────────────

@Preview(widthDp = 960, heightDp = 540, backgroundColor = 0xFF2E7D32, showBackground = true)
@Composable
private fun PreviewMarcadorFutbol() {
    PanelMarcadorFutbol(
        MarcadorFutbolUi(
            estado = MarcadorFutbolEstado(
                equipo1 = "BARCELONA",
                equipo2 = "EMELEC",
                goles1 = "2",
                goles2 = "1",
                textoEstado = "2T • 45:00 +3",
                estilo = EstiloEstado.CORRIENDO,
            ),
        ),
    )
}
