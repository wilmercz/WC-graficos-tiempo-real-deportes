/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL TERCIOS - Muestra notificaciones de jugadas (Gol, Esquina, etc.)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Escuchar el campo ACCION_JUGADA_MINUTO en Firebase.
 * - Mostrar el panel con una animación cuando hay una nueva acción.
 * - Ocultar el panel automáticamente después de unos segundos.
 * - Funcionar de forma independiente al PanelController.
 */

class PanelTercios {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        this.container = document.getElementById('panel-tercios');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        this.lastActionText = null;
        this.lastActionTimestamp = null;
        this.lastMostrarManual = false; // Rastreador de estado previo
        this.hideTimeout = null;
        this.displayDuration = 8000; // 8 segundos de visibilidad antes de apagar el switch

        console.log('📢 PanelTercios: Inicializando...');
    }

    initialize() {
        if (!this.container) {
            console.error('❌ PanelTercios: Contenedor #panel-tercios no encontrado.');
            return;
        }

        this.renderBase();
        this.listenForActions();

        console.log('✅ PanelTercios: Inicializado y escuchando acciones.');
    }

    /**
     * Crea la estructura HTML base dentro del panel.
     */
    renderBase() {
        this.container.innerHTML = `
            <div class="tercio-wrapper scaled">
                <div class="tercio-texto-container">
                    <div class="tercio-linea" id="tercio-linea1"></div>
                    <div class="tercio-linea" id="tercio-linea2"></div>
                </div>
            </div>
        `;
    }

    /**
     * Escucha los cambios en los datos del partido en Firebase.
     */
    listenForActions() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 1. Control de visibilidad mediante interruptor booleano
            const mostrarManual = data.MOSTRAR_TERCIO === true || data.MOSTRAR_TERCIO === 'true';
            const actionText = data.ACCION_JUGADA_MINUTO;
            // 🔥 IMPORTANTE: No usar ULTIMA_ACTUALIZACION aquí, porque el reloj del marcador 
            // lo actualiza cada segundo y reiniciaría el temporizador de 8s infinitamente.
            const actionTimestamp = data.ACCION_TIMESTAMP; 
            const audioUrl = data.ACCION_AUDIO_URL;

            // Detectar si estamos en modo básquet para subir el panel
            const mostrarBasquet = data.MARCADOR_BASQUET === true || data.MARCADOR_BASQUET === 'true';
            if (mostrarBasquet) {
                this.container.classList.add('modo-basquet');
            } else {
                this.container.classList.remove('modo-basquet');
            }

            // Detectar si el switch acaba de ser encendido (de false a true)
            const justoActivado = mostrarManual && !this.lastMostrarManual;
            
            // Detectar si el contenido es realmente nuevo (cambió el texto o el ID de la acción)
            const contenidoNuevo = (actionText !== this.lastActionText || (actionTimestamp && actionTimestamp !== this.lastActionTimestamp)) 
                                   && (actionText && actionText.trim() !== "");

            // Si el interruptor está apagado, ocultamos inmediatamente
            if (!mostrarManual) {
                if (this.container.classList.contains('visible')) {
                    this.hideAction();
                }
                this.lastMostrarManual = false;
                return;
            }

            // 2. Disparar solo si se acaba de activar el switch O si llega contenido nuevo estando activado
            if (justoActivado || contenidoNuevo) {
                console.log(`📢 PanelTercios: Ejecutando acción - "${actionText}"`);
                this.lastActionText = actionText;
                this.lastActionTimestamp = actionTimestamp;
                this.showAction(actionText, audioUrl);
            }

            this.lastMostrarManual = mostrarManual;
        });
    }

    /**
     * Muestra el panel de tercios con el texto de la acción.
     * @param {string} text - El texto a mostrar.
     * @param {string|null} audioUrl - La URL del audio a reproducir.
     */
    showAction(text, audioUrl) {
        const linea1El = document.getElementById('tercio-linea1');
        const linea2El = document.getElementById('tercio-linea2');
        if (!linea1El || !linea2El) return;

        // Dividir el texto por '|' para manejar una o dos líneas
        const [linea1, linea2] = text.split('|').map(s => s.trim());

        linea1El.textContent = linea1 || '';
        linea2El.textContent = linea2 || '';

        // Reproducir audio si se proporciona una URL
        if (audioUrl) {
            try {
                const audio = new Audio(audioUrl);
                audio.volume = 0.7; // Ajustar volumen al 70%
                audio.play().catch(e => {
                    // La reproducción automática puede ser bloqueada por el navegador
                    console.warn(`⚠️ No se pudo reproducir el audio (${audioUrl}):`, e.message);
                });
            } catch (e) {
                console.error(`❌ Error al crear el objeto de audio con la URL: ${audioUrl}`, e);
            }
        }

        // Cancelar cualquier temporizador de ocultado previo
        if (this.hideTimeout) clearTimeout(this.hideTimeout);

        this.container.classList.add('visible');

        // Programar el apagado automático en Firebase tras 8 segundos
        this.hideTimeout = setTimeout(() => {
            console.log('🕒 PanelTercios: Tiempo agotado, intentando apagar MOSTRAR_TERCIO en Firebase...');
            
            // Intentamos apagar el campo. 
            this.partidoRef.child('MOSTRAR_TERCIO').set(false)
                .then(() => {
                    console.log('✅ Firebase: MOSTRAR_TERCIO desactivado correctamente.');
                    this.hideAction(); // Ocultamos visualmente tras confirmar éxito
                })
                .catch(err => {
                    console.error('❌ ERROR de Firebase: No se pudo cambiar MOSTRAR_TERCIO a false. Revisa las reglas de escritura (Database Rules).', err);
                    this.hideAction(); // Ocultamos de todos modos para que no se quede pegado en pantalla
                });
        }, this.displayDuration);
    }

    /**
     * Oculta el panel de tercios.
     */
    hideAction() {
        this.container.classList.remove('visible');
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        
        // Opcional: Limpiar texto después de que termine la transición de salida (500ms)
        setTimeout(() => {
            if (!this.container.classList.contains('visible')) {
                document.getElementById('tercio-linea1').textContent = '';
                document.getElementById('tercio-linea2').textContent = '';
            }
        }, 600);
    }
}

export default PanelTercios;