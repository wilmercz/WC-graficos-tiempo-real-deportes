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

            // 1. VERIFICAR SI ESTE PANEL DEBE MOSTRARSE
            // Solo si DEPORTE == 'BASQUET'
            const deporte = (data.DEPORTE || 'FUTBOL').toUpperCase();
            
            if (deporte === 'BASQUET') {
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
        document.getElementById('bq-score-1').textContent = data.GOLES1 ?? 0;
        document.getElementById('bq-score-2').textContent = data.GOLES2 ?? 0;

        // Periodo y Cronómetro
        this.updatePeriodoYTimer(data);
    }

    updatePeriodoYTimer(data) {
        const periodoEl = document.getElementById('bq-periodo');
        const nTiempo = data.NumeroDeTiempo; // 1T, 2T...
        
        // Mapeo según tu solicitud
        const mapPeriodos = {
            '1T': 'JP',  // Por jugarse
            '2T': 'Q1',
            '3T': 'B1',  // Break 1
            '4T': 'Q2',
            '5T': 'MT',  // Medio Tiempo
            '6T': 'Q3',
            '7T': 'B2',
            '8T': 'Q4',
            '9T': 'OT1',
            '10T': 'OT2',
            '11T': 'FT'  // Final
        };

        const textoPeriodo = mapPeriodos[nTiempo] || 'Q1';
        periodoEl.textContent = textoPeriodo;

        // Lógica de Cronómetro (Cuenta Regresiva)
        this.manageTimer(data);
    }

    manageTimer(data) {
        const timerEl = document.getElementById('bq-timer');
        
        // Si no se está cronometrando o es un estado de pausa (JP, B1, MT, B2, FT)
        // Mostramos el tiempo fijo o 00:00
        const cronometrando = data.CRONOMETRANDO === true || data.CRONOMETRANDO === 'true';
        const tiempoJuegoMin = Number(data.TIEMPOJUEGO) || 10;
        
        // Estados donde el reloj NO corre (Descansos)
        const estadosPausa = ['JP', 'B1', 'MT', 'B2', 'FT'];
        const periodoActual = document.getElementById('bq-periodo').textContent;

        if (!cronometrando || estadosPausa.includes(periodoActual)) {
            this.stopTimer();
            
            // Si estamos en "Por Jugarse" mostramos el tiempo full (ej: 10:00)
            // Si estamos en descansos, podríamos mostrar 00:00 o el tiempo de descanso si existiera campo
            if (periodoActual === 'JP') {
                timerEl.textContent = `${String(tiempoJuegoMin).padStart(2,'0')}:00`;
            } 
            // Si el cronómetro se detuvo manualmente durante el juego, necesitamos saber cuánto quedaba.
            // POR AHORA: Si se para, mostraremos "PAUSA" o el último cálculo si lo hiciéramos local,
            // pero como es stateless, calculamos lo que debería haber si FECHA_PLAY es el inicio.
            // NOTA: Para Basket real, idealmente Firebase debería enviar "TIEMPO_RESTANTE" cuando está parado.
            // Asumiremos que si está parado, mostramos 00:00 o lo que venga calculado si implementamos lógica de pausa compleja.
            return;
        }

        // INICIAR CUENTA REGRESIVA
        // Meta: FECHA_PLAY + TIEMPOJUEGO
        const fechaPlay = data.FECHA_PLAY; // Timestamp de inicio del cuarto
        if (!fechaPlay) return;

        const startMs = typeof fechaPlay === 'number' ? fechaPlay : new Date(fechaPlay).getTime();
        const duracionMs = tiempoJuegoMin * 60 * 1000;
        const endMs = startMs + duracionMs;

        // Evitar múltiples intervalos
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const now = Date.now() + this.serverTimeOffset;
            const diff = endMs - now;

            if (diff <= 0) {
                // Se acabó el tiempo
                timerEl.textContent = "00:00";
                timerEl.classList.add('tiempo-rojo');
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