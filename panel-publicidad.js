// Referencia al panel
const panel = document.getElementById('panel-publicidad');
let timerDuracion = null; // Timer para la duración del anuncio
let timerTransicion = null; // Timer para la transición de salida
let colaPublicidad = [];   // Cola de anuncios por mostrar

// Configuración de rutas de Firebase
const DB_PATH = '/ARKI_DEPORTES/PUBLICIDAD';

/**
 * Inicializar listener de Firebase
 * Se asume que 'firebase' ya está inicializado en el head del HTML
 */
function initPublicidad() {
    if (typeof firebase === 'undefined') {
        console.error("Firebase no está cargado.");
        return;
    }

    const db = firebase.database();
    const pubRef = db.ref(DB_PATH);

    pubRef.on('value', (snapshot) => {
        const data = snapshot.val();
        procesarDatos(data);
    });
}

/**
 * Procesa los datos que llegan de Firebase
 */
function procesarDatos(data) {
    // 1. Detener cualquier secuencia actual y limpiar
    detenerSecuencia();

    if (!data) return;

    // 2. Si llega una orden explícita de "no mostrar", terminamos aquí
    if (data.mostrar === false) return;

    // 3. Convertir la entrada en un array (Cola de reproducción)
    let items = [];
    
    if (Array.isArray(data)) {
        // Si ya es un array (Lista enviada desde Kotlin)
        items = data;
    } else if (typeof data === 'object') {
        // Si es un objeto...
        if (data.contenido && data.tipo) {
            // ...es un anuncio único, lo convertimos en lista de 1
            items = [data];
        } else {
            // ...o es un mapa de objetos (Firebase a veces guarda arrays así: {0:.., 1:..})
            items = Object.values(data);
        }
    }

    // 4. Filtrar elementos válidos
    colaPublicidad = items.filter(item => item && item.contenido && item.mostrar !== false);

    // 5. Iniciar la secuencia si hay elementos en la cola
    if (colaPublicidad.length > 0) {
        mostrarSiguiente();
    }
}

/**
 * Detiene timers y resetea el estado
 */
function detenerSecuencia() {
    if (timerDuracion) clearTimeout(timerDuracion);
    if (timerTransicion) clearTimeout(timerTransicion);
    timerDuracion = null;
    timerTransicion = null;
    colaPublicidad = [];
    
    panel.classList.remove('mostrar');
    
    // Limpieza de seguridad
    setTimeout(() => {
        if (!panel.classList.contains('mostrar')) {
            panel.innerHTML = '';
        }
    }, 800);
}

/**
 * Lógica principal del Playlist (Recursiva)
 */
function mostrarSiguiente() {
    if (colaPublicidad.length === 0) {
        // Fin de la cola
        return;
    }

    // Extraer el primer anuncio de la cola
    const anuncio = colaPublicidad.shift();

    // 1. Renderizar contenido
    renderizarContenido(anuncio.tipo, anuncio.contenido);

    // 2. Mostrar panel (Animación de entrada)
    // RequestAnimationFrame asegura que el navegador esté listo para pintar
    requestAnimationFrame(() => {
        panel.classList.add('mostrar');
    });

    // 3. Calcular duración
    // Usa 'duracion' personalizada del anuncio, o 10 segundos (10000ms) por defecto
    const tiempo = (anuncio.duracion ? anuncio.duracion * 1000 : 10000);

    // 4. Programar la salida
    timerDuracion = setTimeout(() => {
        // Ocultar panel (Animación de salida)
        panel.classList.remove('mostrar');

        // Esperar a que termine la animación CSS (800ms) antes de cargar el siguiente
        timerTransicion = setTimeout(() => {
            panel.innerHTML = ''; // Limpiar memoria (importante para videos)
            mostrarSiguiente();   // LLAMADA RECURSIVA: Cargar el siguiente
        }, 800); // Este tiempo debe coincidir con el 'transition' de tu CSS (0.8s)

    }, tiempo);
}

function renderizarContenido(tipo, contenido) {
    panel.innerHTML = ''; // Limpiar anterior para ahorrar recursos

    if (tipo === 'imagen') {
        const img = document.createElement('img');
        img.src = contenido;
        panel.appendChild(img);

    } else if (tipo === 'video') {
        const video = document.createElement('video');
        video.src = contenido;
        video.autoplay = true;
        video.muted = true; // Necesario para autoplay sin interacción
        video.loop = false;
        panel.appendChild(video);
        // Nota: En modo playlist, el timer manda sobre la duración del video
        // pero podríamos forzar el salto si el video termina antes:
        // video.onended = () => { clearTimeout(timerSecuencia); mostrarSiguiente(); };

    } else if (tipo === 'html') {
        const div = document.createElement('div');
        div.className = 'html-content';
        div.innerHTML = contenido;
        panel.appendChild(div);
    }
}

// Arrancar
initPublicidad();