/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL CONTROLLER - Control de Paneles y Transiciones
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Controlar qué panel se muestra según PANEL_ACTIVO
 * - Gestionar animaciones de entrada/salida
 * - Transiciones suaves entre paneles
 */

class PanelController {
    constructor(configManager) {
        this.configManager = configManager;
        this.currentPanel = null;
        this.panels = {};
        this.isTransitioning = false;
        
        console.log('🎛️ PanelController: Inicializando...');
    }

    /**
     * Inicializar controller
     */
    initialize() {
        // Obtener referencias a los paneles del DOM
        this.panels = {
            logos: document.getElementById('panel-logos'),
            marcador: document.getElementById('panel-marcador'),
            penales: document.getElementById('panel-penales'),
            tercios: document.getElementById('panel-tercios')
        };

        // Verificar que existen
        Object.keys(this.panels).forEach(key => {
            if (!this.panels[key]) {
                console.warn(`⚠️ PanelController: Panel "${key}" no encontrado en DOM`);
            }
        });

        // Ocultar todos los paneles inicialmente
        this.hideAllPanels(false); // Sin animación

        // Escuchar cambios de PANEL_ACTIVO
        this.configManager.onUpdate((config) => {
            this.handlePanelChange(config.panelActivo);
        });

        // Mostrar panel inicial
        const initialPanel = this.configManager.getPanelActivo();
        if (initialPanel !== 'oculto') {
            this.showPanel(initialPanel, false); // Sin animación inicial
        }

        console.log('✅ PanelController: Inicializado');
    }

    /**
     * Manejar cambio de panel
     */
    handlePanelChange(newPanel) {
        if (this.isTransitioning) {
            console.log('⏳ PanelController: Transición en progreso, esperando...');
            return;
        }

        if (newPanel === this.currentPanel) {
            console.log(`ℹ️ PanelController: Panel "${newPanel}" ya está activo`);
            return;
        }

        console.log(`🔄 PanelController: Cambio de panel "${this.currentPanel}" → "${newPanel}"`);

        if (newPanel === 'oculto') {
            this.hideAllPanels(true);
        } else {
            this.transitionToPanel(newPanel);
        }
    }

    /**
     * Transición entre paneles
     */
    async transitionToPanel(targetPanel) {
        this.isTransitioning = true;

        try {
            // Paso 1: Ocultar panel actual (si existe)
            if (this.currentPanel && this.currentPanel !== 'oculto') {
                await this.hidePanel(this.currentPanel, true);
            }

            // Paso 2: Pequeña pausa entre transiciones
            await this.sleep(100);

            // Paso 3: Mostrar nuevo panel
            await this.showPanel(targetPanel, true);

            this.currentPanel = targetPanel;
        } catch (error) {
            console.error('❌ PanelController: Error en transición', error);
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Mostrar un panel
     */
    async showPanel(panelName, animated = true) {
        const panel = this.panels[panelName];
        if (!panel) {
            console.warn(`⚠️ PanelController: Panel "${panelName}" no existe`);
            return;
        }

        const animConfig = this.configManager.getAnimaciones();
        const animationType = animConfig.tipo;
        const duration = animConfig.duracion;

        console.log(`👁️ PanelController: Mostrando panel "${panelName}"${animated ? ' (animado)' : ''}`);

        // Hacer visible
        panel.style.display = 'block';

        if (animated) {
            // Aplicar animación de entrada
            panel.classList.remove('panel-exit');
            panel.classList.add('panel-enter', `panel-enter-${animationType}`);

            // Esperar a que termine la animación
            await this.sleep(duration);

            // Limpiar clases de animación
            panel.classList.remove('panel-enter', `panel-enter-${animationType}`);
        }

        this.currentPanel = panelName;
    }

    /**
     * Ocultar un panel
     */
    async hidePanel(panelName, animated = true) {
        const panel = this.panels[panelName];
        if (!panel) return;

        const animConfig = this.configManager.getAnimaciones();
        const animationType = animConfig.tipo;
        const duration = animConfig.duracion;

        console.log(`🙈 PanelController: Ocultando panel "${panelName}"${animated ? ' (animado)' : ''}`);

        if (animated) {
            // Aplicar animación de salida
            panel.classList.remove('panel-enter');
            panel.classList.add('panel-exit', `panel-exit-${animationType}`);

            // Esperar a que termine la animación
            await this.sleep(duration);

            // Limpiar clases de animación
            panel.classList.remove('panel-exit', `panel-exit-${animationType}`);
        }

        // Ocultar
        panel.style.display = 'none';
    }

    /**
     * Ocultar todos los paneles
     */
    hideAllPanels(animated = true) {
        console.log('🙈 PanelController: Ocultando todos los paneles');
        
        Object.keys(this.panels).forEach(panelName => {
            if (this.panels[panelName]) {
                this.hidePanel(panelName, animated);
            }
        });

        this.currentPanel = 'oculto';
    }

    /**
     * Obtener panel actual
     */
    getCurrentPanel() {
        return this.currentPanel;
    }

    /**
     * Verificar si un panel está visible
     */
    isPanelVisible(panelName) {
        const panel = this.panels[panelName];
        return panel && panel.style.display !== 'none';
    }

    /**
     * Utilidad: Sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Exportar
export default PanelController;
