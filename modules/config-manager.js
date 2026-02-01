/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG MANAGER - Gestión de Configuración del Overlay
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Leer CONFIGURACION_OVERLAYWEB desde Firebase
 * - Proveer API de acceso a configuración
 * - Actualizar variables CSS en tiempo real
 * - Notificar cambios mediante eventos
 */

class ConfigManager {
    constructor(firebaseDB, configPath) {
        this.db = firebaseDB;
        this.configPath = configPath;
        this.config = null;
        this.listeners = {
            onUpdate: [],
            onError: []
        };
        
        console.log('⚙️ ConfigManager: Inicializando...');
    }

    /**
     * Inicializar y escuchar cambios de configuración
     */
    initialize() {
        console.log("📌 ConfigManager leyendo configPath =", this.configPath);
        const configRef = this.db.ref(this.configPath);
        
        configRef.on('value', (snapshot) => {
            const data = snapshot.val();
            
            if (data) {
                console.log('⚙️ ConfigManager: Configuración recibida', data);
                this.config = this.normalizeConfig(data);
                this.updateCSSVariables();
                this.notifyUpdate();
            } else {
                console.warn('⚠️ ConfigManager: No hay datos en', this.configPath);
                this.config = this.getDefaultConfig();
                this.updateCSSVariables();
            }
        }, (error) => {
            console.error('❌ ConfigManager: Error leyendo configuración', error);
            this.notifyError(error);
        });
    }

    /**
     * Normalizar configuración con valores por defecto
     */
    normalizeConfig(data) {
        return {
            panelActivo: data.PANEL_ACTIVO || 'oculto',
            brandingActivo: data.BRANDING_ACTIVO || 'default',
            colores: {
                primario: data.COLORES?.PRIMARIO || '#FF6B00',
                secundario: data.COLORES?.SECUNDARIO || '#000000',
                terciario: data.COLORES?.TERCIARIO || '#000000',
                textoPrimario: data.COLORES?.TEXTO_PRIMARIO || '#FFFFFF',
                textoSecundario: data.COLORES?.TEXTO_SECUNDARIO || '#CCCCCC'
            },
            logos: {
                activo: data.LOGOS?.ACTIVO !== false,
                rotacionActiva: data.LOGOS?.ROTACION_ACTIVA !== false,
                intervaloMs: data.LOGOS?.INTERVALO_MS || 5000,
                transicion: data.LOGOS?.TRANSICION || 'fade',
                urls: data.LOGOS?.URLS || ['', '', '', '', '']
            },
            escalaGlobal: data.ESCALA_GLOBAL || 1.0,
            animaciones: {
                duracion: data.ANIMACIONES?.DURACION || 500,
                tipo: data.ANIMACIONES?.TIPO || 'fade'
            }
        };
    }

    /**
     * Configuración por defecto
     */
    getDefaultConfig() {
        return {
            panelActivo: 'oculto',
            brandingActivo: 'default',
            colores: {
                primario: '#FF6B00',
                secundario: '#000000',
                terciario: '#000000',
                textoPrimario: '#FFFFFF',
                textoSecundario: '#CCCCCC'
            },
            logos: {
                activo: true,
                rotacionActiva: true,
                intervaloMs: 5000,
                transicion: 'fade',
                urls: ['', '', '', '', '']
            },
            escalaGlobal: 1.0,
            animaciones: {
                duracion: 500,
                tipo: 'fade'
            }
        };
    }

    /**
     * Actualizar variables CSS en :root
     */
    updateCSSVariables() {
        if (!this.config) return;

        const root = document.documentElement;
        const { colores, escalaGlobal, animaciones } = this.config;

        // Colores
        root.style.setProperty('--color-primario', colores.primario);
        root.style.setProperty('--color-secundario', colores.secundario);
        root.style.setProperty('--color-terciario', colores.terciario);
        root.style.setProperty('--color-texto-primario', colores.textoPrimario);
        root.style.setProperty('--color-texto-secundario', colores.textoSecundario);

        // Escala
        root.style.setProperty('--escala', escalaGlobal);

        // Animaciones
        root.style.setProperty('--animacion-duracion', `${animaciones.duracion}ms`);

        console.log('✅ ConfigManager: Variables CSS actualizadas', {
            colores,
            escala: escalaGlobal,
            animacion: animaciones
        });
    }

    /**
     * API: Obtener colores
     */
    getColores() {
        return this.config?.colores || this.getDefaultConfig().colores;
    }

    /**
     * API: Obtener escala global
     */
    getEscala() {
        return this.config?.escalaGlobal || 1.0;
    }

    /**
     * API: Obtener panel activo
     */
    getPanelActivo() {
        return this.config?.panelActivo || 'oculto';
    }

    /**
     * API: Obtener configuración de logos
     */
    getConfigLogos() {
        return this.config?.logos || this.getDefaultConfig().logos;
    }

    /**
     * API: Obtener configuración de animaciones
     */
    getAnimaciones() {
        return this.config?.animaciones || this.getDefaultConfig().animaciones;
    }

    /**
     * API: Obtener toda la configuración
     */
    getConfig() {
        return this.config || this.getDefaultConfig();
    }

    /**
     * Registrar listener de actualización
     */
    onUpdate(callback) {
        this.listeners.onUpdate.push(callback);
    }

    /**
     * Registrar listener de error
     */
    onError(callback) {
        this.listeners.onError.push(callback);
    }

    /**
     * Notificar actualización
     */
    notifyUpdate() {
        this.listeners.onUpdate.forEach(callback => {
            try {
                callback(this.config);
            } catch (error) {
                console.error('❌ ConfigManager: Error en callback onUpdate', error);
            }
        });
    }

    /**
     * Notificar error
     */
    notifyError(error) {
        this.listeners.onError.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                console.error('❌ ConfigManager: Error en callback onError', err);
            }
        });
    }
}

// Exportar
export default ConfigManager;
