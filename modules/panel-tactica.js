/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL TÁCTICA (CANCHA VIRTUAL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pantalla exclusiva de FÚTBOL: una cancha grande con 22 puntos (11 por
 * equipo) simulando jugadores. Reacciona a los mismos campos de Firebase
 * que ya usan panel-marcador.js / panel-tercios.js:
 *
 *   - NumeroDeTiempo: '0T' por jugarse, '1T' primer tiempo, '2T' entretiempo,
 *     '3T' segundo tiempo, '4T' finalizado, '5T'/'PENALES' definición penales.
 *   - CRONO_EN_PAUSA, CRONO_OFFSET, CRONO_PAUSA_ACUMULADA, CRONO_INICIO_PAUSA,
 *     FECHA_PLAY, TIEMPOJUEGO: motor del cronómetro (igual que el marcador).
 *   - GOLES1 / GOLES2, ESQUINAS1 / ESQUINAS2, TAMARILLAS1 / TAMARILLAS2,
 *     TROJAS1 / TROJAS2: se detecta cuándo SUBEN respecto al valor anterior
 *     para disparar la animación correspondiente (gol, córner, tarjeta).
 *     TAMARILLAS y TROJAS además quedan mostradas de forma permanente junto
 *     al nombre del equipo (contador acumulado), no solo como flash.
 *   - CAMPEONATO (nuevo campo, agrégalo en tu control): texto pequeño arriba
 *     del cronómetro.
 *   - ESTADIO (ya existe, lo usa panel-resumen-final.js) y LUGAR (nuevo
 *     campo): cintillo en la parte inferior de la cancha.
 *
 * Visibilidad: se activa con el interruptor MOSTRAR_TACTICA (nuevo campo,
 * agrégalo en tu panel de control igual que MOSTRAR_PORTADA) y solo se
 * muestra si DEPORTE === 'FUTBOL'.
 *
 * MOVIMIENTO: cada jugador es un <g> SVG con transform: translate(x,y).
 * Cambiar ese transform por JS + una transición CSS logra el desplazamiento
 * animado sin ninguna librería externa.
 */

// Numeración de posiciones (igual para ambos equipos, 0 a 10):
//   0        -> Arquero (GK)
//   1 a 4    -> Defensas
//   5 a 7    -> Mediocampistas
//   8 a 10   -> Delanteros
const ORDEN_POSICIONES = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];

// Formación base del equipo 1 (ataca hacia la derecha, arco propio a la izquierda)
const FORMACION_EQUIPO1 = [
    { x: 90, y: 450 },                                             // 0  GK
    { x: 260, y: 150 }, { x: 260, y: 350 }, { x: 260, y: 550 }, { x: 260, y: 750 }, // 1-4 DEF
    { x: 520, y: 230 }, { x: 520, y: 450 }, { x: 520, y: 670 },    // 5-7 MID
    { x: 700, y: 230 }, { x: 700, y: 450 }, { x: 700, y: 670 }     // 8-10 FWD
];
// Formación equipo 2: espejo horizontal (viewBox de ancho 1600)
const FORMACION_EQUIPO2 = FORMACION_EQUIPO1.map(p => ({ x: 1600 - p.x, y: p.y }));

// Posiciones de "banca" (descanso), franja inferior del viewBox (y = 930)
const BANCA_EQUIPO1 = Array.from({ length: 11 }, (_, i) => ({ x: 70 + i * 46, y: 930 }));
const BANCA_EQUIPO2 = BANCA_EQUIPO1.map(p => ({ x: 1600 - p.x, y: p.y }));

const CENTRO_CANCHA = { x: 800, y: 450 };
const ARCO_EQUIPO1_X = 40;   // arco que defiende el equipo 1
const ARCO_EQUIPO2_X = 1560; // arco que defiende el equipo 2

function parseFechaPlayToMs(fechaPlay) {
    if (!fechaPlay) return null;
    if (typeof fechaPlay === 'number') return fechaPlay;
    if (typeof fechaPlay !== 'string') return null;
    const ms = new Date(fechaPlay).getTime();
    return Number.isFinite(ms) ? ms : null;
}

class PanelTactica {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.container = document.getElementById('panel-tactica');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

        this.serverTimeOffset = 0;
        this.intervalTimer = null;   // cronómetro (texto)
        this.wanderInterval = null;  // "vida" de los jugadores en juego
        this.currentData = null;
        this.prevData = null;        // snapshot anterior, para detectar goles/córners/tarjetas
        this.primeraCarga = true;    // evita disparar animaciones con los valores iniciales

        this.estadoCancha = 'BANCA'; // 'BANCA' | 'JUEGO'
        this.expulsados = { 1: new Set(), 2: new Set() };

        // Cola simple para no solapar secuencias (gol/córner/expulsión)
        this.colaSecuencias = [];
        this.secuenciaActiva = false;
    }

    initialize() {
        if (!this.container) return;
        this.renderBase();
        this.listenServerTime();
        this.listenFirebase();
    }

    // ============================================================
    // RENDER BASE
    // ============================================================
    renderBase() {
        this.container.innerHTML = `
            <div class="tactica-content">

                <!-- BARRA SUPERIOR: escudos, nombres, goles y cronómetro -->
                <div class="tactica-topbar">
                    <div class="tactica-equipo-info equipo-izq">
                        <img class="tactica-escudo" id="tactica-escudo1" alt="Escudo equipo 1">
                        <div class="tactica-equipo-textos">
                            <span class="tactica-nombre" id="tactica-equipo1">EQUIPO 1</span>
                            <span class="tactica-tarjetas-persist" id="tactica-tarjetas-persist1"></span>
                        </div>
                        <div class="tactica-goles-box">
                            <span class="tactica-goles" id="tactica-goles1">0</span>
                        </div>
                        <div class="tactica-tarjeta-flash" id="tactica-tarjeta1"></div>
                    </div>

                    <div class="tactica-central-col">
                        <div class="tactica-campeonato" id="tactica-campeonato"></div>
                        <div class="tactica-estado-central" id="tactica-estado">POR JUGARSE</div>
                    </div>

                    <div class="tactica-equipo-info equipo-der">
                        <img class="tactica-escudo" id="tactica-escudo2" alt="Escudo equipo 2">
                        <div class="tactica-equipo-textos">
                            <span class="tactica-nombre" id="tactica-equipo2">EQUIPO 2</span>
                            <span class="tactica-tarjetas-persist" id="tactica-tarjetas-persist2"></span>
                        </div>
                        <div class="tactica-goles-box">
                            <span class="tactica-goles" id="tactica-goles2">0</span>
                        </div>
                        <div class="tactica-tarjeta-flash" id="tactica-tarjeta2"></div>
                    </div>
                </div>

                <!-- CANCHA -->
                <div class="tactica-cancha-wrap">
                    <div class="tactica-flash-central" id="tactica-flash-central">
                        <div class="tactica-flash-capa tactica-capa-blanca"></div>
                        <div class="tactica-flash-capa tactica-capa-naranja"></div>
                        <div class="tactica-flash-capa tactica-capa-azul"></div>
                        <span class="tactica-flash-texto" id="tactica-flash-texto"></span>
                    </div>

                    <!-- Hinchada: siluetas que entran desde las esquinas al celebrar un gol -->
                    <div class="tactica-hinchada esquina-tl" id="tactica-hinchada-tl">${this.generarSiluetas(3)}</div>
                    <div class="tactica-hinchada esquina-tr" id="tactica-hinchada-tr">${this.generarSiluetas(3)}</div>
                    <div class="tactica-hinchada esquina-bl" id="tactica-hinchada-bl">${this.generarSiluetas(3)}</div>
                    <div class="tactica-hinchada esquina-br" id="tactica-hinchada-br">${this.generarSiluetas(3)}</div>

                    <svg id="tactica-svg" class="tactica-svg" viewBox="0 0 1600 980" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <radialGradient id="tactica-grad" cx="50%" cy="45%" r="75%">
                                <stop offset="0%" stop-color="#1f8a4c" stop-opacity="0.6"/>
                                <stop offset="100%" stop-color="#0c3a20" stop-opacity="0.6"/>
                            </radialGradient>
                        </defs>

                        <rect class="tactica-fondo" x="0" y="0" width="1600" height="980" rx="0" fill="url(#tactica-grad)"></rect>

                        <g class="tactica-lineas">
                            <rect x="40" y="40" width="1520" height="820" rx="4"></rect>
                            <line x1="800" y1="40" x2="800" y2="860"></line>
                            <circle cx="800" cy="450" r="110"></circle>
                            <circle class="tactica-punto-centro" cx="800" cy="450" r="5"></circle>
                            <rect x="40" y="290" width="220" height="320"></rect>
                            <rect x="40" y="390" width="90" height="120"></rect>
                            <rect x="1340" y="290" width="220" height="320"></rect>
                            <rect x="1470" y="390" width="90" height="120"></rect>
                            <rect class="tactica-arco" x="30" y="410" width="10" height="80"></rect>
                            <rect class="tactica-arco" x="1560" y="410" width="10" height="80"></rect>
                        </g>

                        <circle class="tactica-balon" id="tactica-balon" r="10"></circle>

                        ${this.generarMarkupEquipo(1)}
                        ${this.generarMarkupEquipo(2)}
                    </svg>
                </div>

                <!-- Estadio + Lugar: por debajo del límite de la cancha, no encima -->
                <div class="tactica-sede" id="tactica-sede">
                    <svg class="tactica-sede-icono" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="12" cy="12" rx="10" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"></ellipse>
                        <rect x="6.5" y="9" width="11" height="6" rx="1.2" fill="currentColor"></rect>
                    </svg>
                    <span id="tactica-estadio"></span>
                    <span class="tactica-sede-sep" id="tactica-sede-sep"> • </span>
                    <svg class="tactica-sede-icono" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"></path>
                    </svg>
                    <span id="tactica-lugar"></span>
                </div>
            </div>
        `;

        // Posición inicial: todos en la banca (reposo), sin transición para evitar
        // que "vuelen" desde el origen (0,0) al cargar la página.
        this.aplicarPosiciones(1, BANCA_EQUIPO1, true);
        this.aplicarPosiciones(2, BANCA_EQUIPO2, true);
        this.moverBalon(CENTRO_CANCHA.x, CENTRO_CANCHA.y, 0);
    }

    /**
     * Genera el <g> de los 11 jugadores de un equipo.
     * Cada jugador incluye, ya preparados para el futuro:
     *   - <text class="tactica-dorsal">: número de camiseta (vacío por ahora)
     *   - <text class="tactica-nombre-jugador">: nombre/apellido corto (vacío por ahora)
     *   - <text class="tactica-expulsado-marca">: una "X" que se muestra solo
     *     si el jugador recibe roja (ver expulsarJugador()).
     */
    generarMarkupEquipo(numEquipo) {
        let html = `<g class="tactica-equipo tactica-equipo${numEquipo}">`;
        for (let idx = 0; idx <= 10; idx++) {
            html += `
                <g class="tactica-jugador" id="tactica-j-t${numEquipo}-${idx}" data-team="${numEquipo}" data-idx="${idx}" style="animation-delay:${(idx * 0.08).toFixed(2)}s">
                    <circle class="tactica-dot" r="15"></circle>
                    <text class="tactica-dorsal" id="tactica-dorsal-t${numEquipo}-${idx}" y="5"></text>
                    <text class="tactica-nombre-jugador" id="tactica-nombre-t${numEquipo}-${idx}" y="30"></text>
                    <text class="tactica-expulsado-marca">✕</text>
                </g>`;
        }
        html += `</g>`;
        return html;
    }

    /**
     * Genera N siluetas de "hinchas celebrando" (pictograma genérico: cabeza,
     * torso y brazos en alto), coloreadas por CSS mediante currentColor.
     * No representa a ninguna persona real ni personaje con derechos de autor.
     */
    generarSiluetas(cantidad) {
        let html = '';
        for (let i = 0; i < cantidad; i++) {
            html += `
                <svg class="tactica-silueta" viewBox="0 0 40 60" style="animation-delay:${(i * 0.13).toFixed(2)}s">
                    <line x1="14" y1="22" x2="3" y2="4"></line>
                    <line x1="26" y1="22" x2="37" y2="4"></line>
                    <circle cx="20" cy="9" r="7"></circle>
                    <path d="M20,18 C13,18 9,24 9,32 L9,50 C9,54 13,56 16,56 L24,56 C27,56 31,54 31,50 L31,32 C31,24 27,18 20,18 Z"></path>
                </svg>`;
        }
        return html;
    }



    /**
     * Muestra la hinchada del equipo que anotó, desde las 2 esquinas del
     * MISMO LADO de la pantalla donde está su nombre en la barra superior
     * (equipo 1 = bloque izquierdo → esquinas izquierdas; equipo 2 = bloque
     * derecho → esquinas derechas), sin importar hacia qué arco atacó.
     */
    mostrarHinchada(numEquipoAnota) {
        const esquinas = numEquipoAnota === 1
            ? ['tactica-hinchada-tl', 'tactica-hinchada-bl']  // nombre del equipo 1 está a la izquierda
            : ['tactica-hinchada-tr', 'tactica-hinchada-br']; // nombre del equipo 2 está a la derecha

        esquinas.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('equipo1', 'equipo2');
            el.classList.add(`equipo${numEquipoAnota}`);
            el.classList.add('mostrar');
        });
    }

    ocultarHinchada() {
        document.querySelectorAll('.tactica-hinchada').forEach(el => {
            el.classList.remove('mostrar', 'equipo1', 'equipo2');
        });
    }

    // ============================================================
    // FIREBASE
    // ============================================================
    listenServerTime() {
        this.db.ref('.info/serverTimeOffset').on('value', snap => {
            this.serverTimeOffset = snap.val() || 0;
        });
    }

    listenFirebase() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.currentData = data;

            const deporte = (data.DEPORTE || 'FUTBOL').toUpperCase();
            const mostrarTactica = data.MOSTRAR_TACTICA === true || data.MOSTRAR_TACTICA === 'true';
            const debeVerse = mostrarTactica && deporte === 'FUTBOL';

            if (debeVerse) {
                this.container.classList.add('visible');
            } else {
                this.container.classList.remove('visible');
            }

            // ============================================================
            // Suprimir el recuadro clásico de "panel-gol" MIENTRAS la Cancha
            // Virtual está en pantalla, para no duplicar la animación de gol
            // (esta ya tiene su propio flash central con el mismo efecto).
            // Importante: esto NO modifica panel-gol.js ni su CSS; solo le
            // forzamos un display:none por fuera mientras dura la táctica.
            // Al ocultar la táctica se le devuelve el control normal.
            // ============================================================
            this.suprimirPanelGol(debeVerse);

            this.actualizarEncabezado(data);
            this.actualizarEstadoJuego(data);

            // Solo procesamos eventos (gol/córner/tarjeta) si ya tuvimos una
            // primera carga; si no, cualquier marcador ya existente (ej. al
            // refrescar la página en un partido 2-1) dispararía animaciones
            // falsas.
            if (!this.primeraCarga) {
                this.detectarEventos(this.prevData, data);
            } else {
                this.primeraCarga = false;
            }

            this.prevData = data;
        });
    }

    /**
     * Fuerza display:none (con !important, vía JS) sobre #panel-gol mientras
     * la Cancha Virtual está visible, y se lo libera al ocultarla. No toca
     * panel-gol.js ni panel-gol.css: panel-gol sigue funcionando exactamente
     * igual que siempre para las transmisiones normales con panel-marcador.
     */
    suprimirPanelGol(tacticaVisible) {
        const panelGolEl = document.getElementById('panel-gol');
        if (!panelGolEl) return;

        if (tacticaVisible) {
            panelGolEl.style.setProperty('display', 'none', 'important');
        } else {
            panelGolEl.style.removeProperty('display');
        }
    }

    actualizarEncabezado(data) {
        document.getElementById('tactica-equipo1').textContent = data.EQUIPO1 || 'EQUIPO 1';
        document.getElementById('tactica-equipo2').textContent = data.EQUIPO2 || 'EQUIPO 2';
        document.getElementById('tactica-goles1').textContent = data.GOLES1 ?? 0;
        document.getElementById('tactica-goles2').textContent = data.GOLES2 ?? 0;
        this.toggleEscudo('tactica-escudo1', data.ESCUDO1_URL);
        this.toggleEscudo('tactica-escudo2', data.ESCUDO2_URL);

        // Campeonato (arriba del cronómetro, letra pequeña)
        document.getElementById('tactica-campeonato').textContent = data.CAMPEONATO || '';

        // Estadio + Lugar (cintillo en la parte inferior de la cancha)
        this.actualizarSede(data);

        // Tarjetas acumuladas (no desaparecen, a diferencia del flash momentáneo)
        this.actualizarTarjetasPersistentes(1, data.TAMARILLAS1, data.TROJAS1);
        this.actualizarTarjetasPersistentes(2, data.TAMARILLAS2, data.TROJAS2);

        // ============================================================
        // PENDIENTE (futuro): mismo mecanismo que en panel-portada.js.
        // Cuando definas los campos, descomenta:
        //
        // this.actualizarEtiquetasJugadores(1, data.ALINEACION1, data.DORSALES1);
        // this.actualizarEtiquetasJugadores(2, data.ALINEACION2, data.DORSALES2);
        // ============================================================
    }

    /** Estadio + Lugar. Si alguno falta, se oculta el separador " • " y, si no hay ninguno, se oculta todo el cintillo. */
    actualizarSede(data) {
        const estadio = (data.ESTADIO || '').trim();
        const lugar = (data.LUGAR || '').trim();

        document.getElementById('tactica-estadio').textContent = estadio;
        document.getElementById('tactica-lugar').textContent = lugar;
        document.getElementById('tactica-sede-sep').style.display = (estadio && lugar) ? 'inline' : 'none';
        document.getElementById('tactica-sede').style.display = (estadio || lugar) ? 'flex' : 'none';
    }

    /**
     * Contador persistente de tarjetas junto al nombre del equipo.
     * A diferencia de mostrarTarjeta() (el flash que aparece y desaparece),
     * esto queda siempre visible mientras el equipo tenga tarjetas sumadas,
     * para que no se "pierdan" de vista durante el partido.
     */
    actualizarTarjetasPersistentes(numEquipo, amarillas, rojas) {
        const el = document.getElementById(`tactica-tarjetas-persist${numEquipo}`);
        if (!el) return;

        const numAmarillas = Number(amarillas) || 0;
        const numRojas = Number(rojas) || 0;

        let html = '';
        if (numAmarillas > 0) {
            html += `<span class="mini-tarjeta mini-amarilla"></span><span class="mini-conteo">${numAmarillas}</span>`;
        }
        if (numRojas > 0) {
            html += `<span class="mini-tarjeta mini-roja"></span><span class="mini-conteo">${numRojas}</span>`;
        }

        el.innerHTML = html;
        el.style.display = html ? 'inline-flex' : 'none';
    }

    toggleEscudo(imgId, url) {
        const img = document.getElementById(imgId);
        if (!img) return;
        const urlValida = typeof url === 'string' && url.trim().length > 0;
        if (urlValida) {
            img.src = url;
            img.classList.add('visible');
        } else {
            img.classList.remove('visible');
            img.removeAttribute('src');
        }
    }

    // ============================================================
    // ESTADO DEL PARTIDO (cronómetro + banca/formación)
    // ============================================================
    actualizarEstadoJuego(data) {
        const estadoEl = document.getElementById('tactica-estado');
        const numeroDeTiempo = data.NumeroDeTiempo;
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';

        estadoEl.classList.remove('finalizado', 'entretiempo', 'por-jugarse');

        switch (numeroDeTiempo) {
            case '0T':
                estadoEl.textContent = 'POR JUGARSE';
                estadoEl.classList.add('por-jugarse');
                this.detenerCronometro();
                this.pasarABanca();
                // Nuevo partido: se limpian las expulsiones del encuentro anterior
                this.expulsados = { 1: new Set(), 2: new Set() };
                break;

            case '1T':
            case '3T':
                this.iniciarCronometro();
                if (enPausa) this.detenerCronometro();
                this.pasarAFormacion();
                break;

            case '2T': // Entretiempo
                estadoEl.textContent = 'ENTRETIEMPO';
                estadoEl.classList.add('entretiempo');
                this.detenerCronometro();
                this.pasarABanca();
                break;

            case '4T':
                estadoEl.textContent = 'FINALIZADO';
                estadoEl.classList.add('finalizado');
                this.detenerCronometro();
                this.pasarABanca();
                break;

            case '5T':
            case 'PENALES':
                estadoEl.textContent = 'DEFINICIÓN PENALES';
                this.detenerCronometro();
                this.pasarABanca();
                break;

            default:
                estadoEl.textContent = 'POR JUGARSE';
                estadoEl.classList.add('por-jugarse');
                this.detenerCronometro();
                this.pasarABanca();
                break;
        }
    }

    /** Cronómetro: misma lógica que panel-marcador.js, aplicada a #tactica-estado */
    iniciarCronometro() {
        if (this.intervalTimer) return;
        this.intervalTimer = setInterval(() => this.actualizarTextoCronometro(), 1000);
        this.actualizarTextoCronometro();
    }

    actualizarTextoCronometro() {
        const data = this.currentData;
        if (!data) return;

        const estadoEl = document.getElementById('tactica-estado');
        const numeroTiempo = data.NumeroDeTiempo || '1T';
        const tiempoJuegoEnMinutos = Number(data.TIEMPOJUEGO) || 45;

        const startMs = parseFechaPlayToMs(data.FECHA_PLAY);
        const pausaAcumuladaMs = (Number(data.CRONO_PAUSA_ACUMULADA) || 0) * 1000;
        const offsetMs = (Number(data.CRONO_OFFSET) || 0) * 1000;
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';
        const inicioPausaMs = parseFechaPlayToMs(data.CRONO_INICIO_PAUSA);
        const limiteSegundos = tiempoJuegoEnMinutos * 60;

        if (startMs == null) {
            estadoEl.textContent = `${numeroTiempo} • 00:00`;
            return;
        }

        let now = Date.now() + this.serverTimeOffset;
        if (enPausa && inicioPausaMs) now = inicioPausaMs;

        const nombresVisuales = { '1T': '1T', '3T': '2T' };
        const nombreAMostrar = nombresVisuales[numeroTiempo] || numeroTiempo;

        const elapsedMs = (now - startMs) - pausaAcumuladaMs + offsetMs;
        const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

        if (elapsedSeconds > 7200) this.detenerCronometro();

        let texto;
        if (elapsedSeconds <= limiteSegundos) {
            const minutos = Math.floor(elapsedSeconds / 60);
            const segundos = elapsedSeconds % 60;
            texto = `${nombreAMostrar} • ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        } else {
            const textoBase = `${nombreAMostrar} • ${String(tiempoJuegoEnMinutos).padStart(2, '0')}:00`;
            const segundosExtra = elapsedSeconds - limiteSegundos;
            const minutosExtra = Math.ceil(segundosExtra / 60);
            texto = (minutosExtra > 0) ? `${textoBase} +${minutosExtra}` : textoBase;
        }
        estadoEl.textContent = texto;
    }

    detenerCronometro() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    // ============================================================
    // DETECCIÓN DE EVENTOS (gol / córner / tarjetas)
    // ============================================================
    detectarEventos(anterior, actual) {
        if (!anterior) return;

        const subio = (campo) => (Number(actual[campo]) || 0) > (Number(anterior[campo]) || 0);

        if (subio('GOLES1')) this.encolar(() => this.secuenciaGol(1));
        if (subio('GOLES2')) this.encolar(() => this.secuenciaGol(2));

        if (subio('ESQUINAS1')) this.encolar(() => this.secuenciaCorner(1));
        if (subio('ESQUINAS2')) this.encolar(() => this.secuenciaCorner(2));

        if (subio('TAMARILLAS1')) this.mostrarTarjeta(1, 'amarilla');
        if (subio('TAMARILLAS2')) this.mostrarTarjeta(2, 'amarilla');

        if (subio('TROJAS1')) { this.mostrarTarjeta(1, 'roja'); this.encolar(() => this.secuenciaExpulsion(1)); }
        if (subio('TROJAS2')) { this.mostrarTarjeta(2, 'roja'); this.encolar(() => this.secuenciaExpulsion(2)); }
    }

    /** Cola simple: evita que dos secuencias (gol + córner, etc.) se pisen entre sí */
    encolar(fn) {
        this.colaSecuencias.push(fn);
        this.procesarCola();
    }

    async procesarCola() {
        if (this.secuenciaActiva) return;
        const siguiente = this.colaSecuencias.shift();
        if (!siguiente) return;

        this.secuenciaActiva = true;
        try {
            await siguiente();
        } catch (e) {
            console.error('⛔ PanelTactica: Error en secuencia', e);
        }
        this.secuenciaActiva = false;
        this.procesarCola();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================================
    // POSICIONAMIENTO BASE (banca / formación)
    // ============================================================
    pasarABanca() {
        if (this.estadoCancha === 'BANCA') return;
        this.estadoCancha = 'BANCA';
        this.detenerWander();
        this.aplicarPosiciones(1, BANCA_EQUIPO1);
        this.aplicarPosiciones(2, BANCA_EQUIPO2);
        this.moverBalon(CENTRO_CANCHA.x, CENTRO_CANCHA.y, 1200);
    }

    pasarAFormacion() {
        if (this.estadoCancha === 'JUEGO') return;
        this.estadoCancha = 'JUEGO';
        this.aplicarPosiciones(1, FORMACION_EQUIPO1);
        this.aplicarPosiciones(2, FORMACION_EQUIPO2);
        this.moverBalon(CENTRO_CANCHA.x, CENTRO_CANCHA.y, 1400);
        this.iniciarWander();
    }

    aplicarPosiciones(numEquipo, formacion, instantaneo = false) {
        formacion.forEach((pos, idx) => {
            if (this.expulsados[numEquipo].has(idx)) return; // se queda donde fue expulsado
            this.moverJugador(numEquipo, idx, pos.x, pos.y, instantaneo ? 0 : 1300);
        });
    }

    moverJugador(numEquipo, idx, x, y, duracionMs) {
        const el = document.getElementById(`tactica-j-t${numEquipo}-${idx}`);
        if (!el) return;
        el.style.transitionDuration = `${duracionMs}ms`;
        el.style.transform = `translate(${x}px, ${y}px)`;
    }

    moverBalon(x, y, duracionMs) {
        const balon = document.getElementById('tactica-balon');
        if (!balon) return;
        balon.style.transitionDuration = `${duracionMs}ms`;
        balon.style.transform = `translate(${x}px, ${y}px)`;
    }

    // ============================================================
    // "VIDA" DEL JUEGO: pequeños movimientos aleatorios en formación
    // ============================================================
    iniciarWander() {
        this.detenerWander();
        this.wanderInterval = setInterval(() => this.tickWander(), 3200);
    }

    detenerWander() {
        if (this.wanderInterval) {
            clearInterval(this.wanderInterval);
            this.wanderInterval = null;
        }
    }

    tickWander() {
        if (this.secuenciaActiva || this.estadoCancha !== 'JUEGO') return;

        [1, 2].forEach(numEquipo => {
            const formacion = numEquipo === 1 ? FORMACION_EQUIPO1 : FORMACION_EQUIPO2;
            formacion.forEach((base, idx) => {
                if (idx === 0) return; // el arquero casi no se mueve de su área
                if (this.expulsados[numEquipo].has(idx)) return;

                const rol = ORDEN_POSICIONES[idx];
                const rangoX = rol === 'DEF' ? 50 : (rol === 'MID' ? 90 : 110);
                const rangoY = 60;

                const x = this.clamp(base.x + (Math.random() * 2 - 1) * rangoX, 60, 1540);
                const y = this.clamp(base.y + (Math.random() * 2 - 1) * rangoY, 60, 840);
                this.moverJugador(numEquipo, idx, x, y, 2600);
            });
        });

        // El balón "viaja" hacia un jugador al azar, simulando un pase
        const equipoAzar = Math.random() < 0.5 ? 1 : 2;
        const idxAzar = 1 + Math.floor(Math.random() * 10); // evita al arquero
        const el = document.getElementById(`tactica-j-t${equipoAzar}-${idxAzar}`);
        if (el) {
            const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
            if (m) this.moverBalon(parseFloat(m[1]), parseFloat(m[2]), 1500);
        }
    }

    clamp(valor, min, max) {
        return Math.max(min, Math.min(max, valor));
    }

    // ============================================================
    // SECUENCIA: GOL
    // ============================================================
    async secuenciaGol(numEquipoAnota) {
        this.detenerWander();

        const arcoRivalX = numEquipoAnota === 1 ? ARCO_EQUIPO2_X : ARCO_EQUIPO1_X;
        const signo = numEquipoAnota === 1 ? -1 : 1; // de qué lado se agrupan respecto al arco
        const idxAtacantes = [7, 8, 9, 10].filter(i => !this.expulsados[numEquipoAnota].has(i));

        // 1) El equipo que anota avanza hacia el arco rival junto con el balón
        this.moverBalon(arcoRivalX, CENTRO_CANCHA.y, 1500);
        idxAtacantes.forEach((idx, i) => {
            this.moverJugador(numEquipoAnota, idx, arcoRivalX + signo * (70 + i * 25), CENTRO_CANCHA.y + (i - 1.5) * 45, 1500);
        });
        await this.sleep(1600);

        // 2) ¡Gol! Flash central + la hinchada entra desde las esquinas de inmediato
        this.mostrarFlashCentral('¡GOOOL!', 'gol');
        this.mostrarHinchada(numEquipoAnota);
        await this.sleep(1800);

        // 3) Festejo: se agrupan y "saltan" (clase CSS con animación de rebote),
        //    mientras el flash central y la hinchada se quedan celebrando
        const grupo = idxAtacantes.map(idx => document.getElementById(`tactica-j-t${numEquipoAnota}-${idx}`)).filter(Boolean);
        grupo.forEach(el => el.classList.add('celebrando'));
        idxAtacantes.forEach((idx, i) => {
            this.moverJugador(numEquipoAnota, idx, arcoRivalX + signo * 110, CENTRO_CANCHA.y + (i - 1.5) * 32, 900);
        });
        await this.sleep(3000);
        grupo.forEach(el => el.classList.remove('celebrando'));
        this.ocultarFlashCentral();
        this.ocultarHinchada();

        // 4) Vuelta a la formación normal
        this.aplicarPosiciones(1, FORMACION_EQUIPO1);
        this.aplicarPosiciones(2, FORMACION_EQUIPO2);
        this.moverBalon(CENTRO_CANCHA.x, CENTRO_CANCHA.y, 1300);
        await this.sleep(1300);

        if (this.estadoCancha === 'JUEGO') this.iniciarWander();
    }

    // ============================================================
    // SECUENCIA: TIRO DE ESQUINA
    // ============================================================
    async secuenciaCorner(numEquipoCobra) {
        this.detenerWander();

        const arcoRivalX = numEquipoCobra === 1 ? ARCO_EQUIPO2_X : ARCO_EQUIPO1_X;
        const esquinaArribaY = 55;
        const esquinaAbajoY = 845;
        const esquinaY = Math.random() < 0.5 ? esquinaArribaY : esquinaAbajoY;
        const signo = numEquipoCobra === 1 ? -1 : 1;

        const idxCobrador = this.expulsados[numEquipoCobra].has(9) ? 8 : 9;
        const idxAtacantes = [7, 8, 10].filter(i => i !== idxCobrador && !this.expulsados[numEquipoCobra].has(i));

        this.mostrarFlashCentral('TIRO DE ESQUINA', 'corner');

        // El cobrador va a la bandera de córner con el balón
        this.moverJugador(numEquipoCobra, idxCobrador, arcoRivalX + signo * -10, esquinaY, 1300);
        this.moverBalon(arcoRivalX + signo * -10, esquinaY, 1300);

        // El resto de atacantes se mete al área a esperar el centro
        idxAtacantes.forEach((idx, i) => {
            this.moverJugador(numEquipoCobra, idx, arcoRivalX + signo * (60 + i * 30), CENTRO_CANCHA.y + (i - 1) * 60, 1400);
        });
        await this.sleep(1500);
        this.ocultarFlashCentral();

        // Centro al área
        this.moverBalon(arcoRivalX + signo * 40, CENTRO_CANCHA.y, 900);
        await this.sleep(1100);

        // Todo vuelve a la formación
        this.aplicarPosiciones(1, FORMACION_EQUIPO1);
        this.aplicarPosiciones(2, FORMACION_EQUIPO2);
        this.moverBalon(CENTRO_CANCHA.x, CENTRO_CANCHA.y, 1200);
        await this.sleep(1200);

        if (this.estadoCancha === 'JUEGO') this.iniciarWander();
    }

    // ============================================================
    // TARJETAS
    // ============================================================
    mostrarTarjeta(numEquipo, tipo) {
        const el = document.getElementById(`tactica-tarjeta${numEquipo}`);
        if (!el) return;

        el.classList.remove('tarjeta-amarilla', 'tarjeta-roja', 'mostrar');
        void el.offsetWidth; // reinicia la animación
        el.classList.add(tipo === 'roja' ? 'tarjeta-roja' : 'tarjeta-amarilla');
        el.classList.add('mostrar');

        setTimeout(() => el.classList.remove('mostrar'), 3200);
    }

    /** Roja: además de la tarjeta, un jugador del equipo sancionado sale de la cancha */
    async secuenciaExpulsion(numEquipo) {
        // Elige un jugador todavía en cancha (evita arquero mientras haya otra opción)
        const candidatos = [8, 9, 10, 5, 6, 7, 1, 2, 3, 4].filter(idx => !this.expulsados[numEquipo].has(idx));
        const idx = candidatos.length ? candidatos[0] : 0;

        this.expulsados[numEquipo].add(idx);

        const el = document.getElementById(`tactica-j-t${numEquipo}-${idx}`);
        if (el) el.classList.add('expulsado');

        // Camina hacia la banca de su equipo (su mismo slot de banca)
        const banca = numEquipo === 1 ? BANCA_EQUIPO1 : BANCA_EQUIPO2;
        const destino = banca[idx];
        this.moverJugador(numEquipo, idx, destino.x, destino.y, 2200);

        await this.sleep(2200);
    }

    // ============================================================
    // FLASH CENTRAL (gol / córner)
    // ============================================================
    mostrarFlashCentral(texto, claseTipo) {
        const el = document.getElementById('tactica-flash-central');
        const textoEl = document.getElementById('tactica-flash-texto');
        if (!el || !textoEl) return;
        textoEl.textContent = texto;
        el.classList.remove('gol', 'corner', 'mostrar');
        void el.offsetWidth; // fuerza reflow para poder reiniciar las animaciones de las capas
        el.classList.add(claseTipo, 'mostrar');
    }

    ocultarFlashCentral() {
        const el = document.getElementById('tactica-flash-central');
        if (!el) return;
        el.classList.remove('mostrar');
    }

    // ============================================================
    // PENDIENTE (futuro): nombres/dorsales de jugadores
    // ============================================================
    // "nombres" y "dorsales" son arreglos de hasta 11 posiciones en el MISMO
    // ORDEN de la cancha (0=Arquero, 1-4=Defensas, 5-7=Mediocampistas,
    // 8-10=Delanteros). Prioridad: si hay nombre se muestra el nombre; si no
    // hay nombre pero sí dorsal, se muestra el número; si no hay nada, el
    // punto queda solo con su color.
    //
    // Ejemplo de campos esperados en Firebase (ajustar cuando definas los
    // nombres reales):
    //   data.ALINEACION1 = ["Corozo M.", "Perez J.", ...]
    //   data.DORSALES1   = [1, 4, 5, 7, ...]
    actualizarEtiquetasJugadores(numEquipo, nombres, dorsales) {
        for (let idx = 0; idx <= 10; idx++) {
            const nombreEl = document.getElementById(`tactica-nombre-t${numEquipo}-${idx}`);
            const dorsalEl = document.getElementById(`tactica-dorsal-t${numEquipo}-${idx}`);

            const nombre = Array.isArray(nombres) ? nombres[idx] : null;
            const dorsal = Array.isArray(dorsales) ? dorsales[idx] : null;

            if (nombreEl) nombreEl.textContent = nombre || '';
            if (dorsalEl) dorsalEl.textContent = (!nombre && dorsal != null) ? dorsal : '';
        }
    }
}

export default PanelTactica;