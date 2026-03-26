class PanelLogos {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.container = null;
        this.currentIndex = 0;
        this.validLogos = [];
        this.rotationInterval = null;
        this.isRotating = false;
        this.partidoPanelLogos = true;

        // Config fija (sin depender de Firebase externo)
        this.intervaloMs = 60000; // 60 segundos por logo
        this.transicion = 'fade';

        console.log('🎨 PanelLogos: Inicializando...');
    }

    initialize() {
        this.container = document.getElementById('panel-logos');

        if (!this.container) {
            console.error('❌ PanelLogos: Contenedor no encontrado');
            return;
        }

        this.createStructure();

        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.5s ease-in-out';

        this.db.ref('/').once('value').then(s => {
    console.log('🔥 ROOT COMPLETO:', s.val());
});

        // 🔥 ESCUCHAR LOGOS
        this.db.ref('/ARKI_DEPORTES/LOGOS_AI_AIRE').on('value', (snapshot) => {
            const data = snapshot.val();
            console.log('📡 LOGOS RAW:', data);

            if (!data) {
                this.validLogos = [];
                this.updateLogos();
                return;
            }

            // ✅ SOLO URLs válidas
            this.validLogos = Object.values(data)
                .filter(item => item?.url && typeof item.url === 'string')
                .map(item => item.url);

            console.log(`🎨 ${this.validLogos.length} logos listos`);

            this.updateLogos();
        });

        // 🔥 VISIBILIDAD DESDE PARTIDO
        this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL/PANEL_LOGOS').on('value', (snapshot) => {
            const val = snapshot.val();
            this.partidoPanelLogos = (val === null) ? true : (val === true || val === 'true');

            console.log(`👁️ Visibilidad partido: ${this.partidoPanelLogos}`);
            this.updateLogos();
        });

        console.log('✅ PanelLogos listo');
    }

    createStructure() {
        this.container.innerHTML = `
            <div class="logos-wrapper">
                <div class="logo-display" id="logo-display"></div>
            </div>
        `;
    }

    updateLogos() {
        const hasLogos = this.validLogos.length > 0;
        const visible = this.partidoPanelLogos;

        console.log(`🔍 Estado → Logos:${hasLogos} (${this.validLogos.length}) | Partido:${visible}`);

        if (!hasLogos || !visible) {
            this.container.style.opacity = '0';
            this.stopRotation();

            setTimeout(() => {
                this.container.style.display = 'none';
            }, 300);

            return;
        }

        // Mostrar
        this.container.style.display = 'block';
        this.container.offsetHeight;
        this.container.style.opacity = '1';

        // Mostrar primero
        this.currentIndex = 0;
        this.showLogo(this.currentIndex);

        // Rotación
        if (this.validLogos.length > 1) {
            this.startRotation();
        } else {
            this.stopRotation();
        }
    }

    showLogo(index) {
        const logoDisplay = document.getElementById('logo-display');
        if (!logoDisplay) return;

        const url = this.validLogos[index];

        logoDisplay.innerHTML = `
            <img src="${url}" class="logo-image" />
        `;

        console.log(`🎨 Mostrando ${index + 1}/${this.validLogos.length}`);
    }

    startRotation() {
        this.stopRotation();

        console.log(`🔄 Rotación cada ${this.intervaloMs}ms`);

        this.isRotating = true;
        this.rotationInterval = setInterval(() => {
            this.nextLogo();
        }, this.intervaloMs);
    }

    stopRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
            this.isRotating = false;
        }
    }

    async nextLogo() {
        if (this.validLogos.length === 0) return;

        const logoDisplay = document.getElementById('logo-display');
        if (!logoDisplay) return;

        // salida
        logoDisplay.classList.add('logo-exit-fade');
        await this.sleep(300);

        this.currentIndex = (this.currentIndex + 1) % this.validLogos.length;
        this.showLogo(this.currentIndex);

        // entrada
        logoDisplay.classList.remove('logo-exit-fade');
        logoDisplay.classList.add('logo-enter-fade');

        await this.sleep(300);
        logoDisplay.classList.remove('logo-enter-fade');
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

export default PanelLogos;