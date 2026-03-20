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
        
        this.dbPath = '/ARKI_DEPORTES/PUBLICIDAD';
        console.warn('📺 PanelPublicidad: Constructor llamado. Instancia creada.');
    }

    initialize() {
        if (!this.panel) {
            console.error('❌ PanelPublicidad: Contenedor #panel-publicidad no encontrado.');
            return;
        }

        console.warn(`📡 PanelPublicidad: Escuchando cambios en ${this.dbPath}`);
        const pubRef = this.db.ref(this.dbPath);

        pubRef.on('value', 

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
        console.log("⚙️ procesarDatos ejecutándose...");
        // 1. Detener cualquier secuencia actual y limpiar
        this.detenerSecuencia();

        if (!data) return;

        // 2. Si llega una orden explícita de "no mostrar", terminamos aquí
        if (data.mostrar === false) {
            console.warn("🛑 Orden recibida: mostrar = false. Publicidad detenida.");
            return;
        }

        // 3. Convertir la entrada en un array (Cola de reproducción)
        let items = [];
        
        if (Array.isArray(data)) {
            items = data;
        } else if (typeof data === 'object') {
            if (data.contenido && data.tipo) {
                items = [data];
            } else {
                items = Object.values(data);
            }
        }

        // 4. Filtrar elementos válidos
        this.colaPublicidad = items.filter(item => item && item.contenido && item.mostrar !== false);
        console.log(`📋 Elementos válidos en cola: ${this.colaPublicidad.length}`, this.colaPublicidad);

        // 5. Iniciar la secuencia si hay elementos en la cola
        if (this.colaPublicidad.length > 0) {
            console.log(`▶️ Iniciando secuencia con ${this.colaPublicidad.length} anuncio(s)`);
            this.mostrarSiguiente();
        }
    }

    /**
     * Detiene la secuencia actual, limpia timers y oculta el panel.
     */
    detenerSecuencia() {
        if (this.timerDuracion) clearTimeout(this.timerDuracion);
        if (this.timerTransicion) clearTimeout(this.timerTransicion);
        this.timerDuracion = null;
        this.timerTransicion = null;
        this.colaPublicidad = [];
        
        this.panel.classList.remove('mostrar');
        
        // Después de la transición de salida, limpiar el contenido.
        setTimeout(() => {
            if (!this.panel.classList.contains('mostrar')) {
                this.panel.innerHTML = '';
            }
        }, 800); // Coincide con la duración de la transición en CSS
    }

    /**
     * Toma el siguiente anuncio de la cola y lo renderiza.
     */
    mostrarSiguiente() {
        if (this.colaPublicidad.length === 0) {
            console.log("🏁 Fin de la lista de reproducción.");
            this.detenerSecuencia();
            return;
        }

        const anuncio = this.colaPublicidad.shift();
        console.log(`👁️ PREPARANDO ANUNCIO: Tipo=${anuncio.tipo}, URL=${anuncio.contenido}`);
        this.renderizarContenido(anuncio);
    }

    /**
     * Oculta el panel y llama a `mostrarSiguiente` para continuar la cola.
     */
    ocultarYContinuar() {
        this.panel.classList.remove('mostrar');

        if (this.timerDuracion) clearTimeout(this.timerDuracion);
        if (this.timerTransicion) clearTimeout(this.timerTransicion);

        // Esperar a que termine la animación de salida para continuar.
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
        const { tipo, contenido } = anuncio;

        const mostrarPanelYProgramarSalida = (duracionMs) => {
            this.panel.classList.add('mostrar');
            this.timerDuracion = setTimeout(() => {
                this.ocultarYContinuar();
            }, duracionMs);
        };

        if (tipo === 'imagen') {
            const img = document.createElement('img');
            img.onload = () => {
                console.log(`🖼️ Imagen cargada: ${contenido}. Mostrando por 25 segundos.`);
                // Duración fija de 25 segundos para imágenes.
                mostrarPanelYProgramarSalida(25000);
            };
            img.onerror = () => {
                console.error(`❌ Error al cargar imagen: ${contenido}. Saltando al siguiente.`);
                this.mostrarSiguiente(); // Continuar con el siguiente anuncio.
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
                console.log(`📹 Metadatos de video cargados. Duración: ${duracionVideo}s`);
                // Usar la duración del video. Fallback a 25s si no es válida (ej. stream).
                const duracionMs = (duracionVideo && isFinite(duracionVideo))
                    ? duracionVideo * 1000
                    : 25000;
                video.dataset.duracionMs = duracionMs;
            };

            video.oncanplay = () => {
                const duracionMs = parseInt(video.dataset.duracionMs, 10) || 25000;
                console.log(`▶️ Video listo para reproducir. Mostrando por ${duracionMs / 1000} segundos.`);
                mostrarPanelYProgramarSalida(duracionMs);
                video.play().catch(e => console.warn("Autoplay de video bloqueado por el navegador.", e));
            };

            video.onerror = () => {
                console.error(`❌ Error al cargar video: ${contenido}. Saltando al siguiente.`);
                this.mostrarSiguiente();
            };

            this.panel.appendChild(video);
            video.src = contenido;
            video.load(); // Iniciar la carga del video.
        } else {
            console.warn(`Tipo de contenido no soportado: "${tipo}". Saltando.`);
            setTimeout(() => this.mostrarSiguiente(), 50);
        }
    }
}

export default PanelPublicidad;