# Marcador de fútbol — Android (Kotlin + Compose)

Réplica del panel `modules/panel-marcador.js` + `styles/panel-marcador.css` del overlay web.

## Archivos

| Archivo | Qué hace |
|---|---|
| `MarcadorFutbolLogica.kt` | Lógica pura (sin Android): lectura de campos, visibilidad, estados, cronómetro y colores. |
| `MarcadorFutbolViewModel.kt` | Escucha Firebase (`PARTIDOACTUAL`, `CONFIGURACION_OVERLAYWEB`, `.info/serverTimeOffset`) y refresca cada segundo. |
| `PanelMarcadorFutbol.kt` | Composable del panel + `@Preview`. |

Copia los tres archivos a tu módulo de app y cambia el `package` por el tuyo.

## Dependencias (`build.gradle.kts` del módulo)

```kotlin
implementation(platform("com.google.firebase:firebase-bom:<versión actual>"))
implementation("com.google.firebase:firebase-database")
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:<versión>")
implementation("androidx.lifecycle:lifecycle-runtime-compose:<versión>")
// + Compose (material3, ui-tooling-preview) vía compose-bom
```

`java.time` requiere `minSdk 26`, o activar *core library desugaring* si usas un minSdk menor.

## Uso

```kotlin
Box(Modifier.fillMaxSize()) {
    // video / cámara de fondo …
    PanelMarcadorFutbol()   // se muestra u oculta solo según Firebase
}
```

## Reglas replicadas

- Visible si `MARCADOR_FUTBOL` es `true`/`"true"`, `DEPORTE == "FUTBOL"` (o vacío),
  `MARCADOR_PENALES` no está activo y `MOSTRAR_PUBLICIDAD_VIDEOS != true`.
- Posición `top: 20px; left: 20px` sobre un lienzo de 1920×1080, escalado al ancho de pantalla.
- `ESCALA_GLOBAL` entre 0.5 y 2.0, aplicada desde la esquina superior izquierda
  (en la web se aplica desde el centro).
- Cronómetro: `(ahora + offsetServidor − FECHA_PLAY) − CRONO_PAUSA_ACUMULADA + CRONO_OFFSET`,
  congelado en `CRONO_INICIO_PAUSA` durante la pausa; `3T` se muestra como `2T`;
  pasado `TIEMPOJUEGO` muestra `45:00 +N`.
- Colores de `CONFIGURACION_OVERLAYWEB/COLORES` (`#RGB`, `#RRGGBB`, `#RRGGBBAA`);
  nombres CSS o `rgb(...)` caen al color por defecto.
