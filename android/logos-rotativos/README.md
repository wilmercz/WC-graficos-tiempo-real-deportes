# Logos rotativos — Android (Kotlin + Compose)

Réplica de `modules/panel-logos.js` + `styles/panel-logos.css` del overlay web.

## Cómo funciona en la web

- **Origen de los logos:** no se usa el SDK de Firebase Storage. Los logos se leen de la
  Realtime Database en `/ARKI_DEPORTES/LOGOS_AI_AIRE`, una lista de objetos `{ url: "https://…" }`.
  La `url` es el link público de la imagen (Storage u otro hosting), así que basta con cargarla
  por HTTP. Se descartan los elementos sin `url` de texto.
- **Visibilidad:** se muestra si hay al menos un logo y `PARTIDOACTUAL/PANEL_LOGOS` es
  `true`/`"true"` **o no existe**. No depende del deporte. `MOSTRAR_PUBLICIDAD_VIDEOS == true`
  lo oculta junto con todo el overlay.
- **Rotación:** cada logo dura **60 s** (fijo en código). Con un solo logo no rota.
  Al llegar al último vuelve al primero. Cualquier cambio en la lista o en la visibilidad
  reinicia desde el primer logo.
- **Transición entre logos:** salida 300 ms (fade + sube 10px + escala 1.05), luego entrada
  400 ms ease-out (fade + sube desde 10px abajo + escala 0.95 → 1).
- **Mostrar/ocultar el panel:** fade de 500 ms al aparecer; al ocultar se corta a los 300 ms.
- **Posición:** esquina superior derecha, `top: 30px; right: 50px`, padding 10px,
  caja mínima 100×50, logo con alto máximo 65px y ancho proporcional. Sin fondo ni sombra.
- **Escala:** `CONFIGURACION_OVERLAYWEB/ESCALA_GLOBAL` (0.5–2.0).
- El panel táctico usa la misma lista con su propia rotación de 60 s.
- `CONFIGURACION_OVERLAYWEB/LOGOS/Activar_Video_Logo` y `url_VideoLogo` se leen en la web
  pero **nunca se usan** (no hay logo en video), por eso no se replican.

## Archivos

| Archivo | Qué hace |
|---|---|
| `LogosLogica.kt` | Lógica pura: filtrado de URLs, visibilidad, escala e índice de rotación. |
| `LogosViewModel.kt` | Listeners de Firebase y rotación con coroutines (`flatMapLatest` + `delay`). |
| `PanelLogos.kt` | Composable con `AnimatedVisibility` + `AnimatedContent` y carga con Coil. |

## Dependencias extra (además de las del marcador)

```kotlin
implementation("io.coil-kt.coil3:coil-compose:<versión>")
implementation("io.coil-kt.coil3:coil-network-okhttp:<versión>")
```

Requiere el permiso `INTERNET` en el `AndroidManifest.xml`.

## Uso

```kotlin
Box(Modifier.fillMaxSize()) {
    // video de fondo …
    PanelMarcadorFutbol()
    PanelLogos()
}
```
