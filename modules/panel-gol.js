/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL GOL - Muestra una animación de GOL cuando cambia el marcador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

class PanelGol {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        this.container = document.getElementById('panel-gol');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        // Estado interno para detectar cambios
        this.lastGol1 = null;
        this.lastGol2 = null;

        this.hideTimeout = null;
        this.displayDuration = 3000; // 3 segundos de visibilidad

        console.log('⚽ PanelGol: Inicializando...');
    }

    initialize() {
        if (!this.container) {
            console.error('❌ PanelGol: Contenedor #panel-gol no encontrado.');
            return;
        }

        this.renderBase();
        this.listenForGoals();

        console.log('✅ PanelGol: Inicializado y escuchando goles.');
    }

    /**
     * Crea la estructura HTML base dentro del panel.
     */
    renderBase() {
        this.container.innerHTML = `
            <div class="gol-wrapper">
                <div class="gol-capa capa-blanca"></div>
                <div class="gol-capa capa-naranja"></div>
                <div class="gol-capa capa-azul"></div>
                <span class="gol-texto">GOL</span>
            </div>
        `;
    }

    /**
     * Escucha los cambios en los goles del partido en Firebase.
     */
   listenForGoals() {
    this.partidoRef.on('value', (snapshot) => {
        const data = snapshot.val();

        if (!data) {
            console.log('⚽ PanelGol: Datos de PARTIDOACTUAL son nulos.');
            return;
        }

        const currentGol1 = Number(data.GOLES1 ?? 0);
        const currentGol2 = Number(data.GOLES2 ?? 0);

        console.log(`⚽ PanelGol: Datos recibidos -> G1: ${currentGol1}, G2: ${currentGol2}`);

        // Primera lectura: solo guardar valores iniciales
        if (this.lastGol1 === null || this.lastGol2 === null) {
            this.lastGol1 = currentGol1;
            this.lastGol2 = currentGol2;

            console.log(`⚽ PanelGol: Estableciendo valores iniciales -> G1: ${currentGol1}, G2: ${currentGol2}`);
            return;
        }

        console.log(`⚽ PanelGol: Comparando... Actual(${currentGol1}, ${currentGol2}) vs Anterior(${this.lastGol1}, ${this.lastGol2})`);

        // ¿Hubo gol?
        if (currentGol1 !== this.lastGol1 || currentGol2 !== this.lastGol2) {

            console.log('✅⚽✅ PanelGol: ¡GOL DETECTADO!');

            // Actualizar referencia
            this.lastGol1 = currentGol1;
            this.lastGol2 = currentGol2;

            // Cancelar ocultación anterior
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
            }

            // Volver a crear el HTML para reiniciar las animaciones
            this.renderBase();

            // Reiniciar la animación CSS
            this.container.classList.remove('visible');
            void this.container.offsetWidth;
            this.container.classList.add('visible');

            console.log("👁️ PanelGol visible:", this.container.className);

            // Ocultar después del tiempo configurado
            this.hideTimeout = setTimeout(() => {
                console.log('🙈 PanelGol: Ocultando animación.');
                this.container.classList.remove('visible');
            }, this.displayDuration);
        }
    });
}
}

export default PanelGol;