/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURACIÓN FIREBASE - ARKI DEPORTES OVERLAY
 * ═══════════════════════════════════════════════════════════════════════════
 */

const firebaseConfig = {
    apiKey: "AIzaSyDKwl9vKCPc-2w81_EDCAONU603Agr8YOs",
    authDomain: "futbolwc-cec45.firebaseapp.com",
    databaseURL: "https://futbolwc-cec45-default-rtdb.firebaseio.com",
    projectId: "futbolwc-cec45",
    storageBucket: "futbolwc-cec45.firebasestorage.app",
    messagingSenderId: "88548687167",
    appId: "1:88548687167:web:a4fc51f571226ddde2678a"
};

// Ruta del nodo en Firebase Realtime Database
const FIREBASE_PATH = {
    CONFIGURACION_OVERLAYWEB: '/CONFIGURACION_OVERLAYWEB',
    PARTIDO_ACTUAL: '/ARKI_DEPORTES/PARTIDOACTUAL'
};

// Exportar configuración
export { firebaseConfig, FIREBASE_PATH };