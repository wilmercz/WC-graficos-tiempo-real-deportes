/**
 * ═══════════════════════════════════════════════════════════════════════════
 * APP.JS - Punto de entrada principal
 * ═══════════════════════════════════════════════════════════════════════════
 */

// 1. IMPORTAR MÓDULOS
// Importar configuración (ajusta la ruta si es necesario)
import { firebaseConfig, FIREBASE_PATH } from './config/firebase-config.js';

import ConfigManager from './modules/config-manager.js';
import ScaleManager from './modules/scale-manager.js';
import PanelController from './modules/panel-controller.js';
import PanelLogos from './modules/panel-logos.js';
import PanelMarcador from './modules/panel-marcador.js';
import PanelPenales from './modules/panel-penales.js';
import PanelTercios from './modules/panel-tercios.js';
import AudioManager from './modules/audio-manager.js'; // Tu nuevo módulo de audio

// 2. CONFIGURACIÓN DE FIREBASE
// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// 3. INICIALIZAR TODO CUANDO EL DOM ESTÉ LISTO
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando ARKI Deportes Overlay...');

    // --- A. Configuración y Estilos Globales ---
    // Ruta en Firebase donde está la config (ajusta si es necesario)
    const configManager = new ConfigManager(db, FIREBASE_PATH?.CONFIGURACION_OVERLAYWEB || '/ARKI_DEPORTES/CONFIGURACION_OVERLAYWEB');
    configManager.initialize();

    // Gestor de Escala (Zoom global)
    const scaleManager = new ScaleManager(configManager);
    scaleManager.initialize();

    // --- B. Controlador de Paneles (Logos, Marcador, Penales) ---
    const panelController = new PanelController(configManager);
    panelController.initialize();

    // Panel de Logos
    const panelLogos = new PanelLogos(configManager);
    panelLogos.initialize();

    // --- C. Módulos Específicos ---
    
    // Marcador
    const panelMarcador = new PanelMarcador(configManager, db);
    panelMarcador.initialize();

    // Penales
    const panelPenales = new PanelPenales(configManager, db);
    panelPenales.initialize();

    // Tercios (Acciones de juego y Sonidos FX)
    const panelTercios = new PanelTercios(db);
    panelTercios.initialize();

    // Audio Manager (Música de fondo / Cortinas)
    const audioManager = new AudioManager(db);
    audioManager.initialize();

    // --- Debugging Global (Opcional) ---
    window.appManagers = {
        configManager,
        scaleManager,
        panelController,
        panelLogos,
        panelMarcador,
        panelPenales,
        panelTercios
    };

    console.log('✅ Todo inicializado correctamente.');
});
