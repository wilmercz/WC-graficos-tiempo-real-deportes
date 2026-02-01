/**
 * PANEL MARCADOR
 * Renderiza y controla el marcador principal del partido
 */

class PanelMarcador {
    constructor(configManager, firebaseDB) {
        this.configManager = configManager;
        this.db = firebaseDB;

        this.container = document.getElementById('panel-marcador');

        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        this.serverTimeOffset = 0;
        this.intervalTimer = null;

        console.log('⚽ PanelMarcador: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenServerTime();
        this.listenPartido();
    }

    /**
     * HTML base del marcador
     */
    renderBase() {
        this.container.innerHTML = `
            <div class="marcador-wrapper scaled">

                <!-- BARRA ESTADO -->
                <div class="marcador-estado bg-tertiary text-secondary" id="marcador-estado">
                    POR JUGARSE
                </div>

                <!-- CUERPO MARCADOR -->
                <div class="marcador-body">

                    <div class="marcador-equipo equipo-izq bg-primary text-primary" id="equipo-1">
                        EQUIPO 1
                    </div>

                    <div class="marcador-score bg-secondary text-secondary">
                        <span id="goles-1">0</span>
                        <span class="score-separador">-</span>
                        <span id="goles-2">0</span>
                    </div>

                    <div class="marcador-equipo equipo-der bg-primary text-primary" id="equipo-2">
                        EQUIPO 2
                    </div>

                </div>
            </div>
        `;
    }

    /**
     * Escuchar offset de tiempo del servidor
     */
    listenServerTime() {
        this.db.ref('.info/serverTimeOffset').on('value', snap => {
            this.serverTimeOffset = snap.val() || 0;
        });
    }

    /**
     * Escuchar datos del partido
     */
    listenPartido() {
        this.partidoRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            this.updateEquipos(data);
            this.updateGoles(data);
            this.updateEstadoTiempo(data);
        });
    }

    updateEquipos(data) {
        document.getElementById('equipo-1').textContent = data.EQUIPO1 || 'EQUIPO 1';
        document.getElementById('equipo-2').textContent = data.EQUIPO2 || 'EQUIPO 2';
    }

    updateGoles(data) {
        document.getElementById('goles-1').textContent = data.GOLES1 ?? 0;
        document.getElementById('goles-2').textContent = data.GOLES2 ?? 0;
    }

    /**
     * Manejo del estado y cronómetro
     */
    updateEstadoTiempo(data) {
        const estadoEl = document.getElementById('marcador-estado');

        if (!data.CRONOMETRANDO) {
            if (data.TIEMPOSJUGADOS === 0) {
                estadoEl.textContent = 'POR JUGARSE';
            } else {
                estadoEl.textContent = 'ENTRETIEMPO';
            }
            this.stopTimer();
            return;
        }

        this.startTimer(data);
    }

    
    startTimer(data) {
    this.stopTimer();

    // ✅ Decide unidades (minutos vs segundos)
    // Si TIEMPOJUEGO viene en minutos (45), lo convertimos a segundos
    let tiempoJuego = Number(data.TIEMPOJUEGO ?? 45);
    // Si tu Android ya lo guarda en segundos (2700), esto lo detecta
    if (tiempoJuego > 200) { 
        // probablemente ya está en segundos (ej: 2700)
        // lo dejamos tal cual
    } else {
        // probablemente está en minutos (ej: 45)
        tiempoJuego = tiempoJuego * 60;
    }

    // ✅ Nombre del tiempo (ajusta a tu campo real)
    const numeroTiempo = data.NUMERO_TIEMPO || data.NumeroDeTiempo || '1T';

    // ✅ Parse FECHA_PLAY string -> ms
    const startMs = parseFechaPlayToMs(data.FECHA_PLAY);
    if (startMs == null) {
        console.warn('⛔ FECHA_PLAY inválida:', data.FECHA_PLAY);
        document.getElementById('marcador-estado').textContent = `${numeroTiempo}   00:00`;
        return;
    }

    this.intervalTimer = setInterval(() => {
        const now = Date.now() + this.serverTimeOffset;
        const elapsed = Math.max(0, Math.floor((now - startMs) / 1000)); // ✅ ya no NaN

        const minutos = Math.floor(elapsed / 60);
        const segundos = elapsed % 60;

        let texto = `${numeroTiempo} • ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        // ✅ Tiempo extra cuando supera TIEMPOJUEGO
        if (elapsed > tiempoJuego) {
            const extra = Math.floor((elapsed - tiempoJuego) / 60);
            if (extra > 0) texto += ` +${extra}`;
        }

        document.getElementById('marcador-estado').textContent = texto;
    }, 1000);
}


    stopTimer() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }
}

function parseFechaPlayToMs(fechaPlay) {
    if (!fechaPlay) return null;

    // Si ya viene numérico (ms), úsalo
    if (typeof fechaPlay === 'number') return fechaPlay;

    if (typeof fechaPlay !== 'string') return null;

    // Caso típico: "2026-01-13T22:51:15.102" (sin zona)
    // new Date() lo interpreta como local y suele funcionar bien.
    const ms = new Date(fechaPlay).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export default PanelMarcador;
