package com.arkideportes.overlay.logos

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** Lo que dibuja la UI: el logo actual (null = panel oculto) y la escala global. */
data class LogosUi(
    val urlActual: String? = null,
    val escala: Float = 1f,
)

/**
 * Escucha Firebase igual que el overlay web:
 * - /ARKI_DEPORTES/LOGOS_AI_AIRE                        → lista de logos ({ url })
 * - /ARKI_DEPORTES/PARTIDOACTUAL/PANEL_LOGOS            → mostrar/ocultar
 * - /ARKI_DEPORTES/PARTIDOACTUAL/MOSTRAR_PUBLICIDAD_VIDEOS → oculta todo el overlay
 * - /CONFIGURACION_OVERLAYWEB/ESCALA_GLOBAL             → escala
 * Cada cambio en la lista o la visibilidad reinicia la rotación desde el primer logo.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LogosViewModel(
    db: FirebaseDatabase = FirebaseDatabase.getInstance(),
    intervaloMs: Long = INTERVALO_ROTACION_MS,
) : ViewModel() {

    private val config: Flow<ConfigLogos> = combine(
        db.getReference("ARKI_DEPORTES/LOGOS_AI_AIRE").valores()
            .map { snap -> extraerUrlsLogos(snap.children.map { it.value }) },
        db.getReference("ARKI_DEPORTES/PARTIDOACTUAL/PANEL_LOGOS").valores()
            .map { panelLogosActivo(it.value) },
        db.getReference("ARKI_DEPORTES/PARTIDOACTUAL/MOSTRAR_PUBLICIDAD_VIDEOS").valores()
            .map { it.value == true },
    ) { urls, activo, publicidad -> ConfigLogos(urls, activo, publicidad) }
        .distinctUntilChanged()

    private val urlActual: Flow<String?> = config.flatMapLatest { c ->
        when {
            !c.visible -> flowOf(null)
            !c.rota -> flowOf(c.urls.first())
            else -> flow {
                var i = 0
                while (true) {
                    emit(c.urls[i])
                    delay(intervaloMs)
                    i = siguienteIndiceLogo(i, c.urls.size)
                }
            }
        }
    }

    private val escala: Flow<Float> = db.getReference("CONFIGURACION_OVERLAYWEB/ESCALA_GLOBAL")
        .valores().map { escalaGlobal(it.value) }

    val ui: StateFlow<LogosUi> = combine(urlActual, escala, ::LogosUi)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LogosUi())
}

private fun DatabaseReference.valores(): Flow<DataSnapshot> = callbackFlow {
    val listener = object : ValueEventListener {
        override fun onDataChange(snapshot: DataSnapshot) {
            trySend(snapshot)
        }

        override fun onCancelled(error: DatabaseError) {
            Log.e("PanelLogos", "Firebase cancelado en $path: ${error.message}")
        }
    }
    addValueEventListener(listener)
    awaitClose { removeEventListener(listener) }
}
