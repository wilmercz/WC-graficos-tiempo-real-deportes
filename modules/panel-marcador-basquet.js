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
            '2T': 'Fin 1',
            '3T': 'Q2',
            '4T': 'MT',
            '5T': 'Q3',
            '6T': 'Fin 3',
            '7T': 'Q4',
            '8T': 'Fin Reg',
            '9T': 'OT1',
            '10T': 'Fin OT1',
            '11T': 'OT2',
            '12T': 'Fin OT2',
            '13T': 'OT3'
        };

        const textoPeriodo = mapPeriodos[nTiempo] || nTiempo || 'JP';
        periodoEl.textContent = textoPeriodo;

        // Lógica de Cronómetro (Cuenta Regresiva)
        this.manageTimer(data);
    }

    manageTimer(data) {
        const timerEl = document.getElementById('bq-timer');
        
        // 1. LEER DATOS
        const cronometrando = data.CRONOMETRANDO === true || data.CRONOMETRANDO === 'true';
        const tiempoJuegoMin = Number(data.TIEMPOJUEGO) || 10;
        
        // 2. DEFINIR SI ESTAMOS EN TIEMPO DE JUEGO O PAUSA
        // Extraemos el número del tiempo (ej: "1T" -> 1)
        const nTiempoStr = data.NumeroDeTiempo || '0T';
        const nTiempoVal = parseInt(nTiempoStr); // Devuelve NaN si no hay numero, o el numero
        
        let esTiempoDeJuego = false;
        if (!isNaN(nTiempoVal)) {
            // Lógica: Impares (1,3,5...) son JUEGO. Pares (0,2,4...) son PAUSA.
            esTiempoDeJuego = (nTiempoVal % 2 !== 0);
        }

        // Invertimos para obtener flag de pausa
        const esEstadoPausa = !esTiempoDeJuego;

        // 3. LÓGICA DE DETENCIÓN (Pausa o Periodo de descanso)
        if (!cronometrando || esEstadoPausa) {
            this.stopTimer();
            
            // Diagnóstico en consola (F12)
            if (cronometrando && esEstadoPausa) {
                console.log(`🏀 Timer detenido: El tiempo actual (${nTiempoStr}) se considera de DESCANSO/PAUSA. El reloj corre en tiempos impares (1T, 3T, etc).`);
            }

            // Visualización
            if (nTiempoStr === '0T' || nTiempoStr === 'JP') {
                // En JP (0T) mostramos el tiempo completo de juego inicial
                timerEl.textContent = `${String(tiempoJuegoMin).padStart(2,'0')}:00`;
                timerEl.classList.remove('tiempo-rojo');
            }
            return;
        }

        // 4. INICIAR CUENTA REGRESIVA
        const fechaPlay = data.FECHA_PLAY;
        
        if (!fechaPlay) {
            console.warn("🏀 Error: CRONOMETRANDO=true, pero falta FECHA_PLAY.");
            return;
        }

        // Parsear fecha
        const startMs = typeof fechaPlay === 'number' ? fechaPlay : new Date(fechaPlay).getTime();
        
        if (isNaN(startMs)) {
            console.error("🏀 Error: FECHA_PLAY inválida:", fechaPlay);
            return;
        }

        // Cálculo de Meta: Inicio + (Minutos * 60 * 1000)
        const duracionMs = tiempoJuegoMin * 60 * 1000;
        const endMs = startMs + duracionMs;

        // Reiniciar intervalo
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const now = Date.now() + this.serverTimeOffset;
            const diff = endMs - now;

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