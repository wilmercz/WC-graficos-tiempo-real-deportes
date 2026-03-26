/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL LOGOS - Gestión del Panel de Logos Rotatorios
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Mostrar hasta 5 logos
 * - Rotación automática configurable
 * - Transiciones entre logos
 * - Filtrar URLs vacías
 */

class PanelLogos {
    constructor(configManager, firebaseDB) {
        this.configManager = configManager;
        this.db = firebaseDB;
        this.container = null;
        this.currentIndex = 0;
        this.validLogos = [];
        this.rotationInterval = null;
        this.isRotating = false;
        
        console.log('🎨 PanelLogos: Inicializando...');
    }

    /**
     * Inicializar panel
     */
    initialize() {
        this.container = document.getElementById('panel-logos');
        
        if (!this.container) {
            console.error('❌ PanelLogos: Contenedor #panel-logos no encontrado');
            return;
        }

        // Crear estructura interna
        this.createStructure();

        // Inicializar oculto hasta que carguen los logos
        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.5s ease-in-out';

        // Escuchar la lista de logos al aire
        this.db.ref('/ARKI_DEPORTES/LOGOS_AI_AIRE').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Extraer URLs del objeto { ID_LOGO: { url: "..." } }
                this.validLogos = Object.values(data)
                    .map(item => item.url)
                    .filter(url => url && url.trim() !== '');
                
                console.log(`🎨 PanelLogos: ${this.validLogos.length} logos cargados desde Firebase`);
                this.updateLogos();
            }
        });

        // Escuchar cambios de configuración
        this.configManager.onUpdate(() => {
            this.updateLogos();
        });
        console.log('✅ PanelLogos: Inicializado');
    }

    /**
     * Crear estructura HTML del panel
     */
    createStructure() {
        this.container.innerHTML = `
            <div class="logos-wrapper">
                <div class="logo-display" id="logo-display"></div>
            </div>
        `;
    }

    /**
     * Actualizar logos desde configuración
     */
    updateLogos() {
        const config = this.configManager.getConfigLogos();
        
        // El panel solo aparece si está activo Y hay logos cargados
        const debeMostrarse = config.activo && this.validLogos.length > 0;

        if (!debeMostrarse) {
            console.log('ℹ️ PanelLogos: Ocultando panel (Inactivo o sin logos cargados)');
            this.container.style.opacity = '0';
            this.stopRotation();
            return;
        }

        // Mostrar panel
        this.container.style.opacity = '1';

        // Mostrar primer logo
        this.currentIndex = 0;
        this.showLogo(this.currentIndex);

        // Iniciar rotación si está activada y hay más de 1 logo
        if (config.rotacionActiva && this.validLogos.length > 1) {
            this.startRotation(config.intervaloMs, config.transicion);
        } else {
            this.stopRotation();
        }
    }

    /**
     * Mostrar un logo específico
     */
    showLogo(index) {
        const logoDisplay = document.getElementById('logo-display');
        if (!logoDisplay) return;

        const logoUrl = this.validLogos[index];
        
        // Verificar si es URL de imagen o emoji placeholder
        if (this.isImageUrl(logoUrl)) {
            logoDisplay.innerHTML = `<img src="${logoUrl}" alt="Logo ${index + 1}" class="logo-image">`;
        } else {
            // Emoji o texto
            logoDisplay.innerHTML = `<div class="logo-emoji">${logoUrl}</div>`;
        }

        console.log(`🎨 PanelLogos: Mostrando logo ${index + 1}/${this.validLogos.length}`);
    }

    /**
     * Iniciar rotación automática
     */
    startRotation(intervaloMs, transicion) {
        this.stopRotation(); // Detener rotación anterior

        console.log(`🔄 PanelLogos: Iniciando rotación cada ${intervaloMs}ms (${transicion})`);
        
        this.isRotating = true;
        this.rotationInterval = setInterval(() => {
            this.nextLogo(transicion);
        }, intervaloMs);
    }

    /**
     * Detener rotación
     */
    stopRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
            this.isRotating = false;
            console.log('⏸️ PanelLogos: Rotación detenida');
        }
    }

    /**
     * Ir al siguiente logo
     */
    async nextLogo(transicion = 'fade') {
        if (this.validLogos.length === 0) return;

        const logoDisplay = document.getElementById('logo-display');
        if (!logoDisplay) return;

        // Aplicar animación de salida
        logoDisplay.classList.add('logo-exit', `logo-exit-${transicion}`);
        
        // Esperar animación
        await this.sleep(300);

        // Cambiar al siguiente logo
        this.currentIndex = (this.currentIndex + 1) % this.validLogos.length;
        this.showLogo(this.currentIndex);

        // Aplicar animación de entrada
        logoDisplay.classList.remove('logo-exit', `logo-exit-${transicion}`);
        logoDisplay.classList.add('logo-enter', `logo-enter-${transicion}`);

        // Limpiar clases después de la animación
        await this.sleep(300);
        logoDisplay.classList.remove('logo-enter', `logo-enter-${transicion}`);
    }

    /**
     * Ir al logo anterior
     */
    async previousLogo(transicion = 'fade') {
        if (this.validLogos.length === 0) return;

        const logoDisplay = document.getElementById('logo-display');
        if (!logoDisplay) return;

        // Aplicar animación de salida
        logoDisplay.classList.add('logo-exit', `logo-exit-${transicion}`);
        
        await this.sleep(300);

        // Cambiar al logo anterior
        this.currentIndex = (this.currentIndex - 1 + this.validLogos.length) % this.validLogos.length;
        this.showLogo(this.currentIndex);

        // Aplicar animación de entrada
        logoDisplay.classList.remove('logo-exit', `logo-exit-${transicion}`);
        logoDisplay.classList.add('logo-enter', `logo-enter-${transicion}`);

        await this.sleep(300);
        logoDisplay.classList.remove('logo-enter', `logo-enter-${transicion}`);
    }

    /**
     * Verificar si es URL de imagen
     */
    isImageUrl(url) {
        return url.startsWith('http://') || 
               url.startsWith('https://') || 
               url.startsWith('data:image/');
    }

    /**
     * Obtener información del estado actual
     */
    getStatus() {
        return {
            isRotating: this.isRotating,
            currentIndex: this.currentIndex,
            totalLogos: this.validLogos.length,
            currentLogo: this.validLogos[this.currentIndex]
        };
    }

    /**
     * Destruir panel (limpiar recursos)
     */
    destroy() {
        this.stopRotation();
        console.log('🗑️ PanelLogos: Destruido');
    }

    /**
     * Utilidad: Sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Exportar
export default PanelLogos;
