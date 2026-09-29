package com.arkideportes.overlay.futbol

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** Lo que dibuja la UI: el estado del marcador (null = oculto) y el tema. */
data class MarcadorFutbolUi(
    val estado: MarcadorFutbolEstado? = null,
    val tema: TemaOverlay = TemaOverlay(),
)

/**
 * Escucha Firebase igual que el overlay web:
 * - /ARKI_DEPORTES/PARTIDOACTUAL   → datos del partido
 * - /CONFIGURACION_OVERLAYWEB      → colores y escala
 * - /.info/serverTimeOffset        → sincroniza el reloj con el servidor
 * y recalcula el cronómetro cada segundo.
 */
class MarcadorFutbolViewModel(
    db: FirebaseDatabase = FirebaseDatabase.getInstance(),
    rutaPartido: String = "ARKI_DEPORTES/PARTIDOACTUAL",
    rutaConfiguracion: String = "CONFIGURACION_OVERLAYWEB",
) : ViewModel() {

    private val partido: Flow<PartidoFutbol?> = db.getReference(rutaPartido).valores()
        .map { snap -> (snap.value as? Map<*, *>)?.let(PartidoFutbol::desdeMapa) }

    private val tema: Flow<TemaOverlay> = db.getReference(rutaConfiguracion).valores()
        .map { snap -> TemaOverlay.desdeMapa(snap.value as? Map<*, *>) }

    private val offsetServidor: Flow<Long> = db.getReference(".info/serverTimeOffset").valores()
        .map { snap -> (snap.value as? Number)?.toLong() ?: 0L }

    private val tic: Flow<Unit> = flow {
        while (true) {
            emit(Unit)
            delay(1000)
        }
    }

    val ui: StateFlow<MarcadorFutbolUi> =
        combine(partido, tema, offsetServidor, tic) { p, t, offset, _ ->
            MarcadorFutbolUi(
                estado = calcularEstadoMarcador(p, System.currentTimeMillis() + offset),
                tema = t,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MarcadorFutbolUi())
}

private fun DatabaseReference.valores(): Flow<DataSnapshot> = callbackFlow {
    val listener = object : ValueEventListener {
        override fun onDataChange(snapshot: DataSnapshot) {
            trySend(snapshot)
        }

        override fun onCancelled(error: DatabaseError) {
            Log.e("MarcadorFutbol", "Firebase cancelado en $path: ${error.message}")
        }
    }
    addValueEventListener(listener)
    awaitClose { removeEventListener(listener) }
}
