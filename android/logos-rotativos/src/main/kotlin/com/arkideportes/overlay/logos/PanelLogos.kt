package com.arkideportes.overlay.logos

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.EaseIn
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage

/**
 * Panel de logos rotativos (esquina superior derecha).
 *
 * Medidas del CSS web (px en un lienzo de 1920×1080) escaladas al ancho real de la pantalla:
 * top 30px, right 50px, padding 10px, caja mínima 100×50, logo de alto máximo 65px.
 */
@Composable
fun PanelLogos(
    modifier: Modifier = Modifier,
    viewModel: LogosViewModel = viewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    PanelLogos(ui, modifier)
}

@Composable
fun PanelLogos(ui: LogosUi, modifier: Modifier = Modifier) {
    // Conserva el último logo para que la salida en fade no quede vacía
    var ultimaUrl by remember { mutableStateOf(ui.urlActual) }
    if (ui.urlActual != null && ui.urlActual != ultimaUrl) ultimaUrl = ui.urlActual

    BoxWithConstraints(modifier.fillMaxSize()) {
        val px = maxWidth / ANCHO_REFERENCIA
        AnimatedVisibility(
            visible = ui.urlActual != null,
            enter = fadeIn(tween(500)),
            exit = fadeOut(tween(300)),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = px * 30, end = px * 50),
        ) {
            ultimaUrl?.let { LogoRotativo(it, u = px * ui.escala) }
        }
    }
}

@Composable
private fun LogoRotativo(url: String, u: Dp) {
    val desplazamiento = with(LocalDensity.current) { (u * 10).roundToPx() }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .padding(u * 10)
            .sizeIn(minWidth = u * 100, minHeight = u * 50),
    ) {
        AnimatedContent(
            targetState = url,
            label = "logo",
            contentAlignment = Alignment.Center,
            transitionSpec = {
                // Entrada: sube 10px desde abajo y crece de 0.95 a 1 (400ms, tras la salida)
                (fadeIn(tween(400, delayMillis = 300, easing = EaseOut)) +
                    slideInVertically(tween(400, delayMillis = 300, easing = EaseOut)) { desplazamiento } +
                    scaleIn(tween(400, delayMillis = 300, easing = EaseOut), initialScale = 0.95f))
                    .togetherWith(
                        // Salida: sube 10px y crece a 1.05 mientras desaparece (300ms)
                        fadeOut(tween(300, easing = EaseIn)) +
                            slideOutVertically(tween(300, easing = EaseIn)) { -desplazamiento } +
                            scaleOut(tween(300, easing = EaseIn), targetScale = 1.05f),
                    )
                    .using(SizeTransform(clip = false))
            },
        ) { actual ->
            AsyncImage(
                model = actual,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.heightIn(max = u * 65),
            )
        }
    }
}

private const val ANCHO_REFERENCIA = 1920f
