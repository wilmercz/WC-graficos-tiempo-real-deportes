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
import PanelMarcadorBasquet from './modules/panel-marcador-basquet.js';
import PanelPenales from './modules/panel-penales.js';
import PanelTercios from './modules/panel-tercios.js';
import PanelPublicidad from './modules/panel-publicidad.js';
import PanelPortada from './modules/panel-portada.js';
import PanelTablaPosiciones from './modules/panel-tabla-posiciones.js';
import PanelComparativa from './modules/panel-comparativa.js';
import AudioManager from './modules/audio-manager.js'; // Tu nuevo módulo de audio
import PanelRedes from './modules/panel-redes.js';

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
    const panelLogos = new PanelLogos(db);
    panelLogos.initialize();

    // Panel Portada
    const panelPortada = new PanelPortada(db);
    panelPortada.initialize();

    // --- C. Módulos Específicos ---
    
    let panelMarcador, panelMarcadorBasquet, panelPenales, panelTercios, panelPublicidad;

    // Marcador
    try {
        panelMarcador = new PanelMarcador(configManager, db);
        panelMarcador.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelMarcador:", error);
    }

    // Marcador Basquet (Nuevo)
    try {
        panelMarcadorBasquet = new PanelMarcadorBasquet(configManager, db);
        panelMarcadorBasquet.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelMarcadorBasquet:", error);
    }

    // Penales
    try {
        panelPenales = new PanelPenales(configManager, db);
        panelPenales.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelPenales:", error);
    }

    // Tercios (Acciones de juego y Sonidos FX)
    try {
        panelTercios = new PanelTercios(db);
        panelTercios.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelTercios:", error);
    }

    // Publicidad (Lowerthirds Ads)
    try {
        console.log("👉 Intentando iniciar PanelPublicidad...");
        panelPublicidad = new PanelPublicidad(db);
        panelPublicidad.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelPublicidad:", error);
    }

    // Tabla de Posiciones
    try {
        const panelTablaPosiciones = new PanelTablaPosiciones(db);
        panelTablaPosiciones.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelTablaPosiciones:", error);
    }

    // Panel Comparativa Equipos (Head to Head)
    try {
        const panelComparativa = new PanelComparativa(db);
        panelComparativa.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelComparativa:", error);
    }

    // Panel Redes Sociales
    try {
        const panelRedes = new PanelRedes(db);
        panelRedes.initialize();
    } catch (error) {
        console.error("⛔ Error fatal iniciando PanelRedes:", error);
    }

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
        panelTercios,
        panelPublicidad
    };

    console.log('✅ Todo inicializado correctamente.');
});
