/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL PUBLICIDAD - Gestión de anuncios (Imagen, Video, HTML)
 * ═══════════════════════════════════════════════════════════════════════════
 */

class PanelPublicidad {
    constructor(firebaseDB) {

        this.db = firebaseDB;
        this.panel = document.getElementById('panel-publicidad');
        
        // Estado interno
        this.colaPublicidad = [];
        this.timerDuracion = null;
        this.timerTransicion = null;
        this.lastMostrarState = false; // Rastreador del estado del interruptor
        this.lastActivationId = null;  // Rastreador para forzar la reactivación
        this.pubRef = this.db.ref('/ARKI_DEPORTES/PUBLICIDAD');
        
        this.dbPath = '/ARKI_DEPORTES/PUBLICIDAD';
        console.warn('📺 PanelPublicidad: Constructor llamado. Instancia creada.');
    }

    initialize() {
        if (!this.panel) {
            console.error('❌ PanelPublicidad: Contenedor #panel-publicidad no encontrado.');
            return;
        }

        console.warn(`📡 PanelPublicidad: Escuchando cambios en ${this.dbPath}`);

        this.pubRef.on('value', 

            (snapshot) => {
                const data = snapshot.val();
                console.warn("🔥 [FIREBASE RAW] Datos recibidos en PanelPublicidad:", data);
                this.procesarDatos(data);
            },
            (error) => {
                console.error(`⛔ [ERROR CRÍTICO] Firebase rechazó la conexión a ${this.dbPath}:`, error);
            }
        );

    }

    /**
     * Procesa los datos que llegan de Firebase
     */
    procesarDatos(data) {
        console.log('➡️ procesarDatos: Iniciando con data:', data);

        if (!data) {
            console.log('➡️ procesarDatos: Datos nulos, deteniendo secuencia.');
            this.detenerSecuencia();
            return;
        }

        const mostrar = data.mostrar === true || data.mostrar === 'true';
        const activationId = data.activar_id;

        // Si el interruptor está apagado, nos aseguramos de que todo esté detenido.
        if (!mostrar) {
            if (this.lastMostrarState) { // Solo actuar si antes estaba encendido
                console.warn("🛑 Orden recibida: mostrar = false. Publicidad detenida.");
                this.detenerSecuencia();
            }
            this.lastMostrarState = false;
            this.lastActivationId = null;
            return;
        }

        // Detectar si se debe iniciar la secuencia:
        // 1. El interruptor acaba de pasar de false a true.
        // 2. O el ID de activación ha cambiado (para repetir el mismo anuncio).
        const justoActivado = mostrar && !this.lastMostrarState;
        const contenidoNuevo = activationId && activationId !== this.lastActivationId;

        if (justoActivado || contenidoNuevo) {
            console.log(`▶️ INICIANDO SECUENCIA (Activación: ${activationId})`);
            this.lastActivationId = activationId;
            
            // Limpiamos timers y cola, pero no ocultamos el panel ni tocamos Firebase aún.
            if (this.timerDuracion) clearTimeout(this.timerDuracion);
            if (this.timerTransicion) clearTimeout(this.timerTransicion);
            this.colaPublicidad = [];

            // --- LÓGICA DE PARSEO MEJORADA ---
            let items = [];
            if (Array.isArray(data.items)) {
                items = data.items;
            } else if (typeof data === 'object') {
                items = Object.values(data).filter(item => typeof item === 'object' && item !== null && item.contenido && item.tipo);
            }

            // Filtrar solo los elementos que son válidos para mostrar
            this.colaPublicidad = items.filter(item => item && item.contenido && item.tipo);
            
            console.log(`📋 Elementos válidos en cola: ${this.colaPublicidad.length}`, JSON.parse(JSON.stringify(this.colaPublicidad)));


            // Iniciar la secuencia si hay elementos en la cola
            if (this.colaPublicidad.length > 0) {
                this.mostrarSiguiente();
            } else {
                console.log('▶️ Secuencia iniciada pero sin elementos válidos en la cola.');
            }
        }
        this.lastMostrarState = mostrar;
    }

    /**
     * Detiene la secuencia actual, limpia timers y oculta el panel.
     */
    detenerSecuencia() {
        console.log('🔴 detenerSecuencia: Limpiando timers y ocultando panel.');
        if (this.timerDuracion) clearTimeout(this.timerDuracion);
        if (this.timerTransicion) clearTimeout(this.timerTransicion);
        this.timerDuracion = null;
        this.timerTransicion = null;
        this.colaPublicidad = [];

        this.panel.classList.remove('mostrar');

        // Después de la transición de salida, limpiar el contenido.
        this.timerTransicion = setTimeout(() => {
            if (!this.panel.classList.contains('mostrar')) {
                this.panel.innerHTML = '';
            }
        }, 800); // Coincide con la duración de la transición en CSS

        // Como último paso, nos aseguramos de que el estado en Firebase sea 'false'.
        // Esta acción puede causar un evento de Firebase, pero la lógica en procesarDatos
        // debería manejarlo correctamente sin reiniciar el bucle.
    }

    /**
     * Toma el siguiente anuncio de la cola y lo renderiza.
     */
    mostrarSiguiente() {
        if (this.colaPublicidad.length === 0) {
            console.log("🏁 Fin de la lista de reproducción. APAGANDO en Firebase.");
            
            // 💡 CORRECCIÓN: Apagar en Firebase y LUEGO limpiar.
            this.pubRef.update({
                'mostrar': false,
                'activar_id': null
            }).catch(err => console.error('❌ Publicidad: Error al apagar el interruptor en Firebase.', err));
            
            this.detenerSecuencia();
            return;
        }

        const anuncio = this.colaPublicidad.shift();
        this.renderizarContenido(anuncio);
    }

    /**
     * Oculta el panel y llama a `mostrarSiguiente` para continuar la cola.
     */
    ocultarYContinuar() {
        console.log('🔄 ocultarYContinuar: Ocultando anuncio actual y preparando el siguiente.');
        this.panel.classList.remove('mostrar');

        if (this.timerDuracion) clearTimeout(this.timerDuracion);
        if (this.timerTransicion) clearTimeout(this.timerTransicion);

        // Esperar a que termine la animación de salida.
        this.timerTransicion = setTimeout(() => {
            this.panel.innerHTML = '';
            this.mostrarSiguiente();
        }, 800);
    }

    /**
     * Crea el elemento (imagen/video), espera a que cargue, y luego lo muestra.
     * @param {object} anuncio El objeto del anuncio con `tipo` y `contenido`.
     */
    renderizarContenido(anuncio) {
        this.panel.innerHTML = '';
        const { tipo, contenido, duracion } = anuncio; // Extraemos la duración

        const mostrarPanelYProgramarSalida = (duracionMs) => {
            this.panel.classList.add('mostrar');
            this.timerDuracion = setTimeout(() => {
                this.ocultarYContinuar();
            }, duracionMs);
        };

        if (tipo === 'imagen') {
            const img = document.createElement('img');
            img.onload = () => {
                // Usar duración de Kotlin si existe, si no, 25 segundos por defecto.
                const duracionMs = duracion ? duracion * 1000 : 25000;
                console.log(`🖼️ Imagen cargada. Mostrando por ${duracionMs / 1000}s.`);
                mostrarPanelYProgramarSalida(duracionMs);
            };
            img.onerror = () => {
                console.error(`❌ Error al cargar imagen: ${contenido}. Saltando al siguiente.`);
                this.mostrarSiguiente();
            };
            this.panel.appendChild(img);
            img.src = contenido;
        } else if (tipo === 'video') {
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.loop = false;

            video.onloadedmetadata = () => {
                const duracionVideo = video.duration;
                // Prioridad: 1. Duración de Kotlin (si es > 0), 2. Duración del video, 3. Fallback a 25s.
                const duracionMs = (duracion && duracion > 0) ? duracion * 1000 
                                 : (duracionVideo && isFinite(duracionVideo)) ? duracionVideo * 1000 
                                 : 25000;

                video.dataset.duracionMs = duracionMs;
            };

            video.oncanplay = () => {
                const duracionMs = parseInt(video.dataset.duracionMs, 10) || 25000;
                console.log(`▶️ Video listo. Mostrando por ${duracionMs / 1000}s.`);
                mostrarPanelYProgramarSalida(duracionMs);
                video.play().catch(e => console.warn("Autoplay de video bloqueado por el navegador.", e));
            };

            video.onerror = () => {
                console.error(`❌ Error al cargar video: ${contenido}. Saltando al siguiente.`);
                this.mostrarSiguiente();
            };

            this.panel.appendChild(video);
            video.src = contenido;
            video.load();
        } else if (tipo === 'html') {
            // NUEVO: Soporte para contenido HTML
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.scrolling = 'no';

            // Inyectamos el código HTML en el iframe.
            // srcdoc es la forma segura y estándar de hacer esto.
            iframe.srcdoc = contenido;
            this.panel.appendChild(iframe);

            const duracionMs = duracion ? duracion * 1000 : 25000;
            console.log(`📄 Contenido HTML cargado. Mostrando por ${duracionMs / 1000}s.`);
            mostrarPanelYProgramarSalida(duracionMs);
        } else {
            console.warn(`Tipo de contenido no soportado: "${tipo}". Saltando.`);
            setTimeout(() => this.mostrarSiguiente(), 50);
        }
    }
}

export default PanelPublicidad;