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
        this.displayDuration = 8000; // 8 segundos para mostrar el tercio

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
                <div class="tercio-texto" id="tercio-texto"></div>
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
            const actionTimestamp = data.ULTIMA_ACTUALIZACION;

            if (!actionText || !actionTimestamp) {
                return;
            }

            // Comprobar si es una acción nueva comparando el timestamp.
            if (actionTimestamp !== this.lastActionTimestamp) {
                console.log(`📢 PanelTercios: Nueva acción detectada - "${actionText}"`);
                this.lastActionTimestamp = actionTimestamp;
                this.showAction(actionText);
            }
        });
    }

    /**
     * Muestra el panel de tercios con el texto de la acción.
     * @param {string} text - El texto a mostrar.
     */
    showAction(text) {
        const textoEl = document.getElementById('tercio-texto');
        if (!textoEl) return;

        textoEl.textContent = text;

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