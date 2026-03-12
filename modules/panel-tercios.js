/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL TERCIOS - Muestra notificaciones de jugadas (Gol, Esquina, etc.)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Escuchar el campo ACCION_JUGADA_MINUTO en Firebase.
 * - Mostrar el panel con una animación cuando hay una nueva acción.
 * - Ocultar el panel automáticamente después de unos segundos.
 * - Funcionar de forma independiente al PanelController.
 */

class PanelTercios {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        this.container = document.getElementById('panel-tercios');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        this.lastActionTimestamp = null;
        this.hideTimeout = null;
        this.displayDuration = 11000; // 11 segundos (8 + 3) para mostrar el tercio

        console.log('📢 PanelTercios: Inicializando...');
    }

    initialize() {
        if (!this.container) {
            console.error('❌ PanelTercios: Contenedor #panel-tercios no encontrado.');
            return;
        }

        this.renderBase();
        this.listenForActions();

        console.log('✅ PanelTercios: Inicializado y escuchando acciones.');
    }

    /**
     * Crea la estructura HTML base dentro del panel.
     */
    renderBase() {
        this.container.innerHTML = `
            <div class="tercio-wrapper scaled">
                <div class="tercio-texto-container">
                    <div class="tercio-linea" id="tercio-linea1"></div>
                    <div class="tercio-linea" id="tercio-linea2"></div>
                </div>
            </div>
        `;
    }

    /**
     * Escucha los cambios en los datos del partido en Firebase.
     */
    listenForActions() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const actionText = data.ACCION_JUGADA_MINUTO;
            const audioUrl = data.ACCION_AUDIO_URL; // Campo propuesto para el audio
            const actionTimestamp = data.ULTIMA_ACTUALIZACION;

            if (!actionText || !actionTimestamp) {
                return;
            }

            // Comprobar si es una acción nueva comparando el timestamp
            if (actionTimestamp !== this.lastActionTimestamp) {
                console.log(`📢 PanelTercios: Nueva acción detectada - "${actionText}" con audio: ${audioUrl || 'no'}`);
                this.lastActionTimestamp = actionTimestamp;
                this.showAction(actionText, audioUrl);
            }
        });
    }

    /**
     * Muestra el panel de tercios con el texto de la acción.
     * @param {string} text - El texto a mostrar.
     * @param {string|null} audioUrl - La URL del audio a reproducir.
     */
    showAction(text, audioUrl) {
        const linea1El = document.getElementById('tercio-linea1');
        const linea2El = document.getElementById('tercio-linea2');
        if (!linea1El || !linea2El) return;

        // Dividir el texto por '|' para manejar una o dos líneas
        const [linea1, linea2] = text.split('|').map(s => s.trim());

        linea1El.textContent = linea1 || '';
        linea2El.textContent = linea2 || '';

        // Reproducir audio si se proporciona una URL
        if (audioUrl) {
            try {
                const audio = new Audio(audioUrl);
                audio.play().catch(e => {
                    // La reproducción automática puede ser bloqueada por el navegador
                    console.warn(`⚠️ No se pudo reproducir el audio (${audioUrl}):`, e.message);
                });
            } catch (e) {
                console.error(`❌ Error al crear el objeto de audio con la URL: ${audioUrl}`, e);
            }
        }

        if (this.hideTimeout) clearTimeout(this.hideTimeout);

        this.container.classList.add('visible');

        this.hideTimeout = setTimeout(() => this.hideAction(), this.displayDuration);
    }

    /**
     * Oculta el panel de tercios.
     */
    hideAction() {
        this.container.classList.remove('visible');
    }
}

export default PanelTercios;