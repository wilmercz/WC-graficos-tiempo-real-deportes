/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCALE MANAGER - Gestión de Escala Global
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Aplicar escala global a todos los elementos
 * - Actualizar variable CSS --escala
 * - Recalcular cuando cambia ESCALA_GLOBAL
 */

class ScaleManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.currentScale = 1.0;
        
        console.log('📏 ScaleManager: Inicializando...');
    }

    /**
     * Inicializar y escuchar cambios de escala
     */
    initialize() {
        // Aplicar escala inicial
        this.updateScale();

        // Escuchar cambios de configuración
        this.configManager.onUpdate(() => {
            this.updateScale();
        });

        console.log('✅ ScaleManager: Inicializado');
    }

    /**
     * Actualizar escala desde configuración
     */
    updateScale() {
        const newScale = this.configManager.getEscala();
        
        if (newScale !== this.currentScale) {
            this.currentScale = newScale;
            this.applyScale(newScale);
            
            console.log(`📏 ScaleManager: Escala actualizada a ${newScale}x`);
        }
    }

    /**
     * Aplicar escala al CSS
     */
    applyScale(scale) {
        // Validar escala (entre 0.5 y 2.0)
        const validScale = Math.max(0.5, Math.min(2.0, scale));
        
        if (validScale !== scale) {
            console.warn(`⚠️ ScaleManager: Escala ${scale} fuera de rango. Usando ${validScale}`);
        }

        // Actualizar variable CSS
        document.documentElement.style.setProperty('--escala', validScale);
    }

    /**
     * Obtener escala actual
     */
    getCurrentScale() {
        return this.currentScale;
    }

    /**
     * Aplicar escala a un elemento específico (opcional)
     */
    applyScaleToElement(element, customScale = null) {
        const scale = customScale || this.currentScale;
        element.style.transform = `scale(${scale})`;
    }

    /**
     * Resetear escala a 1.0
     */
    resetScale() {
        this.applyScale(1.0);
        console.log('📏 ScaleManager: Escala reseteada a 1.0x');
    }
}

// Exportar
export default ScaleManager;
