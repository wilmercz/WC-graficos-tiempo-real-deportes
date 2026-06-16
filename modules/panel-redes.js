/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL REDES SOCIALES - Controla la píldora lateral de redes
 * ═══════════════════════════════════════════════════════════════════════════
 */

class PanelRedes {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.container = document.getElementById('grafico-redes');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        this.lastMostrarRedes = false;
        this.hideTimeout = null;
        this.displayDuration = 15000; // 15 segundos antes de ocultarse

        console.log('📢 PanelRedes: Inicializando...');
    }

    initialize() {
        if (!this.container) {
            console.error('❌ PanelRedes: Contenedor #grafico-redes no encontrado en el HTML.');
            return;
        }
        this.listenForActions();
        console.log('✅ PanelRedes: Escuchando órdenes.');
    }

    listenForActions() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Capturamos los campos exactos
            const mostrar = data.Mostrar_Redes === true || data.Mostrar_Redes === 'true';
            const texto = data.Texto_Redes || 'ArkiMedes TV';

            const justoActivado = mostrar && !this.lastMostrarRedes;

            // Si se ordenó apagar (o ya se acabó el tiempo)
            if (!mostrar) {
                if (this.container.classList.contains('visible')) {
                    this.hidePanel();
                }
                this.lastMostrarRedes = false;
                return;
            }

            // Si se acaba de encender, mostramos el panel
            if (justoActivado) {
                this.showPanel(texto);
            }

            this.lastMostrarRedes = mostrar;
        });
    }

    showPanel(texto) {
        const textoEl = document.getElementById('texto-redes-dinamico');
        if (textoEl) textoEl.innerText = texto;

        this.container.classList.add('visible');

        if (this.hideTimeout) clearTimeout(this.hideTimeout);

        // Auto-apagar en Firebase tras finalizar (igual que el panel de tercios)
        this.hideTimeout = setTimeout(() => {
            this.partidoRef.child('Mostrar_Redes').set(false)
                .then(() => this.hidePanel())
                .catch(err => console.error('Error al ocultar redes en Firebase:', err));
        }, this.displayDuration);
    }

    hidePanel() {
        this.container.classList.remove('visible');
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
    }
}

export default PanelRedes;