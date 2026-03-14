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
            
            // DIAGNÓSTICO: Ver si llegan datos y qué goles trae
            if (!data) {
                console.warn("⚽ PanelMarcador: Datos vacíos (null) en /PARTIDOACTUAL");
                return;
            }
            
            console.log(`⚽ MARCADOR UPDATE: ${data.EQUIPO1} (${data.GOLES1}) - (${data.GOLES2}) ${data.EQUIPO2}`);

            try {
                this.updateEquipos(data);
                this.updateGoles(data);
                this.updateEstadoTiempo(data);
            } catch (error) {
                console.error("⛔ Error actualizando visuales del Marcador:", error);
            }
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
        const numeroDeTiempo = data.NumeroDeTiempo;

        this.stopTimer(); // Detener siempre el timer anterior para evitar duplicados

        // Gestionar color del texto. Usamos .style.color para tener máxima prioridad
        // y evitar problemas de especificidad si el ID #marcador-estado tiene un color en CSS.
        if (numeroDeTiempo === '1T' || numeroDeTiempo === '3T') {
            // Color normal (gris claro) para el cronómetro
            estadoEl.style.color = 'var(--color-texto-secundario)';
        } else {
            // Color naranja de acento para los demás estados
            estadoEl.style.color = 'var(--color-primario)';
        }

        switch (numeroDeTiempo) {
            case '0T':
                estadoEl.textContent = 'POR JUGARSE';
                break;
            
            case '1T':
                // Inicia el cronómetro para el primer tiempo, mostrando "1T"
                this.startTimer(data, '1T');
                break;

            case '2T':
                estadoEl.textContent = 'ENTRETIEMPO';
                break;

            case '3T':
                // Inicia el cronómetro para el segundo tiempo, mostrando "2T"
                this.startTimer(data, '2T');
                break;

            case '4T':
                estadoEl.textContent = 'FINALIZÓ';
                break;

            case '5T':
                estadoEl.textContent = 'PENALES';
                break;

            default:
                // Si el valor no es ninguno de los esperados, mostramos "POR JUGARSE" como estado inicial.
                estadoEl.textContent = 'POR JUGARSE';
                break;
        }
    }

    
    startTimer(data, periodText) {
        this.stopTimer();

        // 1. LEER Y VALIDAR TIEMPOJUEGO
        // Se asume que viene en minutos. Por defecto es 45.
        let tiempoJuegoEnMinutos = Number(data.TIEMPOJUEGO);

        // Si no es un número válido o está vacío, usar 45.
        if (isNaN(tiempoJuegoEnMinutos) || tiempoJuegoEnMinutos <= 0) {
            tiempoJuegoEnMinutos = 45;
        }

        // Si es mayor a 45 (ej. 90), lo limitamos a 45 para un solo tiempo.
        if (tiempoJuegoEnMinutos > 45) {
            tiempoJuegoEnMinutos = 45;
        }
        
        const tiempoJuegoLimiteEnSegundos = tiempoJuegoEnMinutos * 60;

        // Nombre del tiempo (1T, 2T)
        const numeroTiempo = periodText || data.NumeroDeTiempo || '1T';

        // Parsear la fecha de inicio
        const startMs = parseFechaPlayToMs(data.FECHA_PLAY);
        if (startMs == null) {
            console.warn('⛔ FECHA_PLAY inválida:', data.FECHA_PLAY);
            document.getElementById('marcador-estado').textContent = `${numeroTiempo} • 00:00`;
            return;
        }

        this.intervalTimer = setInterval(() => {
            const now = Date.now() + this.serverTimeOffset;
            const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));

            // 2. LÍMITE DE SEGURIDAD (1 HORA)
            if (elapsed > 3600) {
                console.warn('⌛ Cronómetro detenido por superar 1 hora.');
                this.stopTimer();
                document.getElementById('marcador-estado').textContent = `${numeroTiempo} • ${String(tiempoJuegoEnMinutos).padStart(2, '0')}:00`;
                return;
            }

            let texto;

            // 3. LÓGICA DE TIEMPO REGULAR VS TIEMPO EXTRA
            if (elapsed <= tiempoJuegoLimiteEnSegundos) {
                const minutos = Math.floor(elapsed / 60);
                const segundos = elapsed % 60;
                texto = `${numeroTiempo} • ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
            } else {
                const textoBase = `${numeroTiempo} • ${String(tiempoJuegoEnMinutos).padStart(2, '0')}:00`;
                const segundosDeTiempoExtra = elapsed - tiempoJuegoLimiteEnSegundos;
                const minutosDeTiempoExtra = Math.ceil(segundosDeTiempoExtra / 60);

                texto = (minutosDeTiempoExtra > 0) ? `${textoBase} +${minutosDeTiempoExtra}` : textoBase;
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
