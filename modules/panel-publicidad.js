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

        // DEBUG: Verificar campos específicos si es un objeto único
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            console.log(`🔍 Inspección de campos recibidos:
                - tipo: "${data.tipo}"
                - contenido: "${data.contenido}"
                - duracion: ${data.duracion}
                - mostrar: ${data.mostrar}
            `);
        }

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
            console.log(`▶️ Reproduciendo ${this.colaPublicidad.length} anuncio(s)`);
            this.mostrarSiguiente();
        }
    }

    /**
     * Detiene timers y resetea el estado
     */
    detenerSecuencia() {
        if (this.timerDuracion) clearTimeout(this.timerDuracion);
        if (this.timerTransicion) clearTimeout(this.timerTransicion);
        this.timerDuracion = null;
        this.timerTransicion = null;
        this.colaPublicidad = [];
        
        this.panel.classList.remove('mostrar');
        // this.panel.classList.remove('mostrar');
        
        setTimeout(() => {
            if (!this.panel.classList.contains('mostrar')) {
                this.panel.innerHTML = '';
            }
        }, 800);
    }

    /**
     * Lógica principal del Playlist (Recursiva)
     */
    mostrarSiguiente() {
        if (this.colaPublicidad.length === 0) {
            console.log("🏁 Fin de la lista de reproducción.");
            return;
        }

        const anuncio = this.colaPublicidad.shift();
        console.log(`👁️ ACTIVANDO ANUNCIO: Tipo=${anuncio.tipo}, Duración=${anuncio.duracion || 10}s, URL=${anuncio.contenido}`);

        // 1. Renderizar contenido
        this.renderizarContenido(anuncio.tipo, anuncio.contenido);

        // 2. Mostrar panel
        // Bug Fix 1: Doble requestAnimationFrame para asegurar que el navegador
        // pinte el estado inicial antes de activar la transición de opacidad.
        this.panel.classList.add('mostrar');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // PRUEBA TEMPORAL: El panel ya es visible por CSS, no es necesario añadir la clase.
                // this.panel.classList.add('mostrar');
            });
        });

        const tiempo = (anuncio.duracion ? anuncio.duracion * 1000 : 20000);

        // 4. Programar la salida
        this.timerDuracion = setTimeout(() => {
            // PRUEBA TEMPORAL: No ocultar el panel desde JS
            // this.panel.classList.remove('mostrar');

            this.timerTransicion = setTimeout(() => {
                 this.panel.innerHTML = ''; 
                this.mostrarSiguiente();   
            }, 800);
        }, tiempo);
    }

    renderizarContenido(tipo, contenido) {
        this.panel.innerHTML = ''; 
        if (tipo === 'imagen') {
            const img = document.createElement('img');
            img.src = contenido;
            this.panel.appendChild(img);
        } else if (tipo === 'video') {
            const video = document.createElement('video');
            video.src = contenido;
            video.autoplay = true;
            video.muted = true;
            video.loop = false;
            this.panel.appendChild(video);
        }
        // HTML omitido por brevedad, agregar si es necesario
    }
}

export default PanelPublicidad;