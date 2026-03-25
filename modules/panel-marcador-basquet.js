/**
 * PANEL MARCADOR BÁSQUET
 * Renderiza el marcador específico para Baloncesto con cuenta regresiva.
 */

class PanelMarcadorBasquet {
    constructor(configManager, firebaseDB) {
        this.configManager = configManager;
        this.db = firebaseDB;

        // Crear contenedor dinámicamente si no existe en HTML estático
        let existingPanel = document.getElementById('panel-marcador-basquet');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-marcador-basquet';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;

        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.serverTimeOffset = 0;
        this.timerInterval = null;
        
        console.log('🏀 PanelMarcadorBasquet: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenServerTime();
        this.listenPartido();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="basquet-wrapper scaled">
                <!-- EQUIPO 1 -->
                <div class="bq-bloque bq-equipo" id="bq-equipo-1">EQ1</div>
                
                <!-- SCORE 1 -->
                <div class="bq-bloque bq-score" id="bq-score-1">0</div>

                <!-- CENTRO (TIEMPO) -->
                <div class="bq-center">
                    <div class="bq-periodo" id="bq-periodo">Q1</div>
                    <div class="bq-timer" id="bq-timer">10:00</div>
                </div>

                <!-- SCORE 2 -->
                <div class="bq-bloque bq-score" id="bq-score-2">0</div>

                <!-- EQUIPO 2 -->
                <div class="bq-bloque bq-equipo" id="bq-equipo-2">EQ2</div>
            </div>
        `;
    }

    listenServerTime() {
        this.db.ref('.info/serverTimeOffset').on('value', snap => {
            this.serverTimeOffset = snap.val() || 0;
        });
    }

    listenPartido() {
        this.partidoRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            // 1. VERIFICAR VISIBILIDAD SEGÚN LA BANDERA 'MARCADOR_BASQUET'
            const mostrarBasquet = data.MARCADOR_BASQUET === true || data.MARCADOR_BASQUET === 'true';
            
            if (mostrarBasquet) {
                this.container.style.display = 'block';
                this.updateVisuals(data);
            } else {
                this.container.style.display = 'none';
                this.stopTimer(); // Detener timer si no estamos en basket
            }
        });
    }

    updateVisuals(data) {
        // Equipos
        document.getElementById('bq-equipo-1').textContent = data.EQUIPO1 || 'HOME';
        document.getElementById('bq-equipo-2').textContent = data.EQUIPO2 || 'AWAY';

        // Puntos (Usamos GOLES1/2 como genérico para puntos)
        // Formato 2 dígitos: 0 -> 00, 5 -> 05, 10 -> 10
        document.getElementById('bq-score-1').textContent = String(data.GOLES1 ?? 0).padStart(2, '0');
        document.getElementById('bq-score-2').textContent = String(data.GOLES2 ?? 0).padStart(2, '0');

        // Periodo y Cronómetro
        this.updatePeriodoYTimer(data);
    }

    updatePeriodoYTimer(data) {
        const periodoEl = document.getElementById('bq-periodo');
        const nTiempo = data.NumeroDeTiempo; // 1T, 2T...
        
        // Mapeo corregido: 0T=Previa, Impares=Juego, Pares=Descanso
        const mapPeriodos = {
            '0T': 'JP',
            '1T': 'Q1',
            '2T': 'B1',
            '3T': 'Q2',
            '4T': 'MT',
            '5T': 'Q3',
            '6T': 'B3',
            '7T': 'Q4',
            '8T': 'FP',
            '9T': 'OT1',
            '10T': 'B4',
            '11T': 'OT2',
            '12T': 'B5',
            '13T': 'OT3'
        };

        const textoPeriodo = mapPeriodos[nTiempo] || nTiempo || 'JP';
        periodoEl.textContent = textoPeriodo;

        // Lógica de Cronómetro (Cuenta Regresiva)
        this.manageTimer(data);
    }

    manageTimer(data) {
        const timerEl = document.getElementById('bq-timer');
        
        // 1. LEER DATOS DEL MOTOR KOTLIN
        // FECHA_PLAY: Timestamp de inicio (ms)
        // CRONO_PAUSA_ACUMULADA: Segundos acumulados en pausa
        // CRONO_OFFSET: Segundos ajustados manualmente
        // CRONO_EN_PAUSA: Boolean
        
        const fechaPlay = data.FECHA_PLAY;
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';
        const tiempoJuegoMin = Number(data.TIEMPOJUEGO) || 10;
        const inicioPausaVal = data.CRONO_INICIO_PAUSA; // Nuevo campo esperado
        
        if (!fechaPlay) {
            // Si no hay fecha de inicio, mostramos el tiempo total y salimos
            timerEl.textContent = `${String(tiempoJuegoMin).padStart(2,'0')}:00`;
            timerEl.classList.remove('tiempo-rojo');
            this.stopTimer();
            return;
        }

        // Parsear fecha de inicio
        const startMs = typeof fechaPlay === 'number' ? fechaPlay : new Date(fechaPlay).getTime();

        // Parsear inicio de pausa si existe
        const inicioPausaMs = typeof inicioPausaVal === 'number' ? inicioPausaVal : (inicioPausaVal ? new Date(inicioPausaVal).getTime() : null);
        
        // Obtener pausas y offset en MS (vienen en segundos desde Kotlin)
        const pausaAcumuladaMs = (Number(data.CRONO_PAUSA_ACUMULADA) || 0) * 1000;
        const offsetMs = (Number(data.CRONO_OFFSET) || 0) * 1000;

        // Calcular duración total del cuarto en MS
        const duracionCuartoMs = tiempoJuegoMin * 60 * 1000;

        // Función de cálculo para actualizar visualmente
        const actualizarVisual = () => {
            let now = Date.now() + this.serverTimeOffset;
            
            if (enPausa && inicioPausaMs) {
                now = inicioPausaMs;
            }

            // FÓRMULA: Tiempo Transcurrido Real = (Ahora - Inicio) - Pausas + Offset
            // (El offset suma tiempo al cronómetro recorrido, lo que en cuenta regresiva RESTA tiempo restante)
            const tiempoTranscurridoMs = (now - startMs) - pausaAcumuladaMs + offsetMs;
            
            // CUENTA REGRESIVA: Meta - Transcurrido
            const diff = duracionCuartoMs - tiempoTranscurridoMs;
            
            return diff;
        };

        // 2. LÓGICA DE PAUSA
        if (enPausa) {
            this.stopTimer();
            
            // FIX: Calcular y mostrar el tiempo estático exacto donde se pausó
            const diff = actualizarVisual();
            
            if (diff <= 0) {
                timerEl.textContent = "00:00";
            } else {
                const min = Math.floor(diff / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                timerEl.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
            }
            
            timerEl.classList.add('tiempo-rojo');
            
            // Si se refresca la página durante una pausa, el tiempo calculado podría variar 
            // si no tenemos el timestamp de pausa. Pero si solo es pausa momentánea, 
            // el usuario no verá el reloj moverse.
            
            // OPCIONAL: Si quisieras mostrar "--:--" o el último valor conocido.
            // Por ahora dejamos el cálculo estático (con el 'now' actual se verá correr si recargas, 
            // pero se congelará si solo pausas).
            return;
        }
        
        if (isNaN(startMs)) {
            console.error("🏀 Error: FECHA_PLAY inválida:", fechaPlay);
            return;
        }

        // Reiniciar intervalo
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const diff = actualizarVisual();

            if (diff <= 0) { 
                // TIEMPO AGOTADO
                timerEl.textContent = "00:00";
                timerEl.classList.add('tiempo-rojo');
                // console.log("🏀 Tiempo expirado (FECHA_PLAY + TIEMPOJUEGO < AHORA)");
                this.stopTimer();
                return;
            }

            // Formatear mm:ss (décimas si es último minuto es común en basket, pero dejemos mm:ss por ahora)
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            
            timerEl.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
            timerEl.classList.remove('tiempo-rojo');

        }, 200); // Actualización rápida
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

export default PanelMarcadorBasquet;