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

            // VALIDACIÓN DE VISIBILIDAD (FUTBOL)
            const mostrarMarcador = data.MARCADOR_FUTBOL === true || data.MARCADOR_FUTBOL === 'true';
            const mostrarPenales = data.MARCADOR_PENALES === true || data.MARCADOR_PENALES === 'true';

            // REGLA: Mostrar si la bandera está activa Y NO hay penales activos (Penales tiene prioridad visual)
            if (mostrarMarcador && !mostrarPenales) {
                this.container.style.display = 'block';
            } else {
                this.container.style.display = 'none';
                this.stopTimer();
                return; 
            }

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

        // Validar si está en pausa según el motor nuevo
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';

        this.stopTimer(); // Detener siempre el timer anterior para evitar duplicados

        // Gestionar color del texto. Usamos .style.color para tener máxima prioridad
        // Si está en pausa, lo ponemos en naranja/rojo, si corre en gris.
        if (enPausa) {
             estadoEl.style.color = 'var(--color-primario)'; // Naranja para pausa
        } else if (numeroDeTiempo === '1T' || numeroDeTiempo === '2T' || numeroDeTiempo === '3T' || numeroDeTiempo === '4T') {
            // Tiempo corriendo
            estadoEl.style.color = 'var(--color-texto-secundario)';
        }

        switch (numeroDeTiempo) {
            case '0T':
                estadoEl.textContent = 'POR JUGARSE';
                break;
            
            case '1T':
            case '2T': 
            case '3T': // Prorrogas si las hubiera
            case '4T':
                // Inicia o muestra el cronómetro
                this.startTimer(data, '1T');
                // Si está en pausa, el startTimer calculará el tiempo pero no arrancará el intervalo
                if (enPausa) {
                    this.stopTimer();
                    // Forzar una actualización visual estática para que se vea el tiempo donde se quedó
                    this.updateTimerVisuals(data, data.NumeroDeTiempo); 
                }
                break;

            case '5T':
            case 'PENALES':
                estadoEl.textContent = 'DEFINICIÓN PENALES';
                break;

            default:
                // Si el valor no es ninguno de los esperados, mostramos "POR JUGARSE" como estado inicial.
                estadoEl.textContent = 'POR JUGARSE';
                break;
        }
    }

    
    startTimer(data, periodText) {
        this.stopTimer();
        // Se asume que viene en minutos. Por defecto es 45.
        let tiempoJuegoEnMinutos = Number(data.TIEMPOJUEGO);

        // Si no es un número válido o está vacío, usar 45.
        if (isNaN(tiempoJuegoEnMinutos) || tiempoJuegoEnMinutos <= 0) {
            tiempoJuegoEnMinutos = 45;
        }

        // Iniciar intervalo
        this.intervalTimer = setInterval(() => {
            this.updateTimerVisuals(data, data.NumeroDeTiempo || '1T', tiempoJuegoEnMinutos);
        }, 1000);
        
        // Ejecutar inmediatamente una vez para no esperar 1s
        this.updateTimerVisuals(data, data.NumeroDeTiempo || '1T', tiempoJuegoEnMinutos);
    }

    /**
     * Cálculo puro y visualización
     */
    updateTimerVisuals(data, numeroTiempo, tiempoJuegoEnMinutos = 45) {
        const estadoEl = document.getElementById('marcador-estado');

        // Parsear la fecha de inicio
        const startMs = parseFechaPlayToMs(data.FECHA_PLAY);
        
        // Datos del nuevo motor
        const pausaAcumuladaMs = (Number(data.CRONO_PAUSA_ACUMULADA) || 0) * 1000;
        const offsetMs = (Number(data.CRONO_OFFSET) || 0) * 1000;
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';
        const inicioPausaMs = parseFechaPlayToMs(data.CRONO_INICIO_PAUSA);

        // Limite para tiempo extra (ej: 45 o 90)
        // NOTA: Si es 2T, el tiempoJuego suele ser 90, pero el cronómetro corre lineal desde el inicio del 2T?
        // Depende de cómo lo maneje el backend. 
        // Si FECHA_PLAY se resetea en el 2T, tiempoJuego base es 45.
        // Asumiremos que FECHA_PLAY es el inicio del tiempo actual.
        
        const tiempoJuegoLimiteEnSegundos = tiempoJuegoEnMinutos * 60;

        if (startMs == null) {
            console.warn('⛔ FECHA_PLAY inválida:', data.FECHA_PLAY);
            document.getElementById('marcador-estado').textContent = `${numeroTiempo} • 00:00`;
            return;
        }

        let now = Date.now() + this.serverTimeOffset;
        
        if (enPausa && inicioPausaMs) {
            now = inicioPausaMs;
        }

        // FÓRMULA DE MOTOR: (Ahora - Inicio) - Pausas + Offset
        const elapsedMs = (now - startMs) - pausaAcumuladaMs + offsetMs;
        const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

            // 2. LÍMITE DE SEGURIDAD (1 HORA)
            if (elapsedSeconds > 7200) { // 2 Horas
                // console.warn('⌛ Cronómetro muy alto.');
                this.stopTimer();
            }

            let texto;

            // 3. LÓGICA DE TIEMPO REGULAR VS TIEMPO EXTRA
            if (elapsedSeconds <= tiempoJuegoLimiteEnSegundos) {
                const minutos = Math.floor(elapsedSeconds / 60);
                const segundos = elapsedSeconds % 60;
                texto = `${numeroTiempo} • ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
            } else {
                // Tiempo Extra (ej: 45:00 +2)
                // Mostramos el tiempo reglamentario clavado
                const textoBase = `${numeroTiempo} • ${String(tiempoJuegoEnMinutos).padStart(2, '0')}:00`;
                
                const segundosDeTiempoExtra = elapsedSeconds - tiempoJuegoLimiteEnSegundos;
                const minutosDeTiempoExtra = Math.ceil(segundosDeTiempoExtra / 60);

                texto = (minutosDeTiempoExtra > 0) ? `${textoBase} +${minutosDeTiempoExtra}` : textoBase;
            }

            estadoEl.textContent = texto;
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
