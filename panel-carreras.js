/**
 * PANEL CARRERAS
 * Renderiza el marcador unificado para Automovilismo, Motociclismo, Ciclismo y Patinaje.
 */

class PanelCarreras {
    constructor(configManager, firebaseDB) {
        this.configManager = configManager;
        this.db = firebaseDB;

        // Crear contenedor dinámicamente si no existe
        let existingPanel = document.getElementById('panel-carreras');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-carreras';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;

        // Nueva ruta exclusiva para deportes de motor/carreras
        this.carreraRef = this.db.ref('/ARKI_DEPORTES/CARRERA_ACTUAL');
        
        this.serverTimeOffset = 0;
        this.intervalTimer = null;
        this.currentData = null;

        console.log('🏁 PanelCarreras: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenServerTime();
        this.listenCarrera();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="carreras-wrapper scaled">
                <!-- FILA 1 -->
                <div class="carreras-row-top">
                    <div class="carreras-col" id="carreras-dato1">MANGA 1</div>
                    <div class="carreras-col" id="carreras-dato2">GRUPO A</div>
                    <div class="carreras-col col-crono" id="carreras-crono">00:00:00</div>
                    <div class="carreras-col col-progreso">
                        <span class="progreso-label" id="carreras-label-progreso">VUELTAS</span>
                        <span class="progreso-valor" id="carreras-valor-progreso">0/0</span>
                    </div>
                </div>
                <!-- FILA 2 -->
                <div class="carreras-row-bottom" id="carreras-subtitulo">
                    CATEGORIA / CAMPEONATO
                </div>
            </div>
        `;
    }

    listenServerTime() {
        this.db.ref('.info/serverTimeOffset').on('value', snap => {
            this.serverTimeOffset = snap.val() || 0;
        });
    }

    listenCarrera() {
        this.carreraRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            this.currentData = data;

            const mostrar = data.MOSTRAR_PANEL === true || data.MOSTRAR_PANEL === 'true';

            if (mostrar) {
                this.container.style.display = 'block';
                this.updateVisuals(data);
                this.manageTimer(data);
            } else {
                this.container.style.display = 'none';
                this.stopTimer();
            }
        });
    }

    updateVisuals(data) {
        // Si vienen vacíos o null, ocultamos la columna (opcional) o mostramos un valor por defecto
        document.getElementById('carreras-dato1').textContent = data.DATO_1 || '---';
        document.getElementById('carreras-dato2').textContent = data.DATO_2 || '---';
        
        document.getElementById('carreras-label-progreso').textContent = data.LABEL_PROGRESO || 'PROGRESO';
        document.getElementById('carreras-valor-progreso').textContent = data.VALOR_PROGRESO || '-/-';
        
        document.getElementById('carreras-subtitulo').textContent = data.SUBTITULO || 'CARRERA';
    }

    manageTimer(data) {
        const timerEl = document.getElementById('carreras-crono');
        
        const startMs = this.parseFechaToMs(data.FECHA_PLAY);
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';
        const inicioPausaMs = this.parseFechaToMs(data.CRONO_INICIO_PAUSA);
        
        const pausaAcumuladaMs = (Number(data.CRONO_PAUSA_ACUMULADA) || 0) * 1000;
        const offsetMs = (Number(data.CRONO_OFFSET) || 0) * 1000;

        if (!startMs) {
            timerEl.textContent = "00:00:00";
            this.stopTimer();
            return;
        }

        const updateClock = () => {
            let now = Date.now() + this.serverTimeOffset;
            if (enPausa && inicioPausaMs) now = inicioPausaMs;

            const elapsedMs = (now - startMs) - pausaAcumuladaMs + offsetMs;
            const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

            // Formato HH:MM:SS
            const h = Math.floor(elapsedSeconds / 3600);
            const m = Math.floor((elapsedSeconds % 3600) / 60);
            const s = elapsedSeconds % 60;
            
            timerEl.textContent = `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            timerEl.style.color = enPausa ? 'var(--color-primario)' : '#FFFFFF';
        };

        if (enPausa) {
            this.stopTimer();
            updateClock();
        } else if (!this.intervalTimer) {
            this.intervalTimer = setInterval(updateClock, 500);
            updateClock();
        }
    }

    stopTimer() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    parseFechaToMs(fecha) {
        if (!fecha) return null;
        if (typeof fecha === 'number') return fecha;
        const ms = new Date(fecha).getTime();
        return Number.isFinite(ms) ? ms : null;
    }
}

export default PanelCarreras;