import { clasificarAlineacion } from './alineacion-utils.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANEL ALINEACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pantalla completa (estilo panel-resumen-final): fondo negro semitransparente
 * cubriendo la cámara, con una tarjeta centrada por equipo mostrando escudo,
 * nombre, titulares, suplentes y cuerpo técnico.
 *
 * Se activa de forma independiente por equipo con:
 *   MOSTRAR_ALINEACION1  -> muestra la tarjeta del equipo1 (local)
 *   MOSTRAR_ALINEACION2  -> muestra la tarjeta del equipo2 (visitante)
 *
 * Si ambos están en true al mismo tiempo, se muestran las dos tarjetas lado
 * a lado (útil para un "alineaciones confirmadas" de ambos equipos a la vez).
 *
 * Fuente de datos: /ARKI_DEPORTES/PARTIDOACTUAL/alineaciones/local y
 * .../visitante (mismo nodo que ya consume panel-tactica.js).
 */
class PanelAlineacion {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        // Inyección dinámica al DOM (mismo patrón que panel-resumen-final / panel-comparativa)
        let existingPanel = document.getElementById('panel-alineacion');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-alineacion';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;

        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.alineacionRef = {
            1: this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL/alineaciones/local'),
            2: this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL/alineaciones/visitante')
        };

        this.mostrar = { 1: false, 2: false };
        this.isVisible = false;

        console.log('📋 PanelAlineacion: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenPartido();
        this.listenAlineaciones();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="alineacion-tarjetas" id="alineacion-tarjetas">
                ${this.generarTarjeta(1)}
                ${this.generarTarjeta(2)}
            </div>
        `;
    }

    generarTarjeta(numEquipo) {
        return `
            <div class="alineacion-tarjeta" id="alineacion-tarjeta-${numEquipo}">
                <div class="alineacion-header">
                    <img class="alineacion-escudo" id="alineacion-escudo-${numEquipo}" alt="Escudo">
                    <div class="alineacion-nombre-equipo" id="alineacion-nombre-${numEquipo}">EQUIPO</div>
                </div>

                <div class="alineacion-titulo-seccion">TITULARES</div>
                <div class="alineacion-lista" id="alineacion-titulares-${numEquipo}"></div>

                <div class="alineacion-titulo-seccion alineacion-titulo-supl">SUPLENTES</div>
                <div class="alineacion-lista alineacion-lista-supl" id="alineacion-suplentes-${numEquipo}"></div>

                <div class="alineacion-titulo-seccion alineacion-titulo-cuerpo" id="alineacion-titulo-cuerpotecnico-${numEquipo}">CUERPO TÉCNICO</div>
                <div class="alineacion-lista alineacion-lista-cuerpo" id="alineacion-cuerpotecnico-${numEquipo}"></div>
            </div>
        `;
    }

    listenPartido() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            document.getElementById('alineacion-nombre-1').textContent = data.EQUIPO1 || 'EQUIPO 1';
            document.getElementById('alineacion-nombre-2').textContent = data.EQUIPO2 || 'EQUIPO 2';
            this.toggleEscudo('alineacion-escudo-1', data.ESCUDO1_URL);
            this.toggleEscudo('alineacion-escudo-2', data.ESCUDO2_URL);

            this.mostrar[1] = data.MOSTRAR_ALINEACION1 === true || data.MOSTRAR_ALINEACION1 === 'true';
            this.mostrar[2] = data.MOSTRAR_ALINEACION2 === true || data.MOSTRAR_ALINEACION2 === 'true';

            this.actualizarVisibilidad();
        });
    }

    listenAlineaciones() {
        [1, 2].forEach(numEquipo => {
            this.alineacionRef[numEquipo].on('value', (snapshot) => {
                this.renderizarTarjeta(numEquipo, snapshot.val() || {});
            });
        });
    }

    renderizarTarjeta(numEquipo, mapaJugadores) {
        const { titulares, suplentes, cuerpoTecnico } = clasificarAlineacion(mapaJugadores);

        const armarFilas = (lista) => lista.map(j =>
            `<div class="alineacion-fila"><span class="alineacion-numero">${j.numero}</span><span class="alineacion-jugador-nombre">${j.nombre}</span></div>`
        ).join('');

        const contTitulares = document.getElementById(`alineacion-titulares-${numEquipo}`);
        const contSuplentes = document.getElementById(`alineacion-suplentes-${numEquipo}`);
        const contCuerpoTecnico = document.getElementById(`alineacion-cuerpotecnico-${numEquipo}`);

        if (contTitulares) contTitulares.innerHTML = armarFilas(titulares) || '<div class="alineacion-vacio">Sin confirmar</div>';
        if (contSuplentes) contSuplentes.innerHTML = armarFilas(suplentes);
        if (contCuerpoTecnico) contCuerpoTecnico.innerHTML = armarFilas(cuerpoTecnico);

        // El título "CUERPO TÉCNICO" solo aparece si hay DT/asistentes cargados
        const tituloCuerpoTecnico = document.getElementById(`alineacion-titulo-cuerpotecnico-${numEquipo}`);
        if (tituloCuerpoTecnico) tituloCuerpoTecnico.style.display = cuerpoTecnico.length ? 'block' : 'none';
        if (contCuerpoTecnico) contCuerpoTecnico.style.display = cuerpoTecnico.length ? 'flex' : 'none';
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

    actualizarVisibilidad() {
        const algunoActivo = this.mostrar[1] || this.mostrar[2];
        const cantidadActivos = (this.mostrar[1] ? 1 : 0) + (this.mostrar[2] ? 1 : 0);

        // Cada tarjeta se muestra/oculta de forma independiente según su bandera
        const tarjeta1 = document.getElementById('alineacion-tarjeta-1');
        const tarjeta2 = document.getElementById('alineacion-tarjeta-2');
        if (tarjeta1) tarjeta1.classList.toggle('mostrar', this.mostrar[1]);
        if (tarjeta2) tarjeta2.classList.toggle('mostrar', this.mostrar[2]);

        // Layout: una sola tarjeta se centra distinto que dos lado a lado
        const contenedor = document.getElementById('alineacion-tarjetas');
        if (contenedor) contenedor.classList.toggle('una-tarjeta', cantidadActivos === 1);

        // Oculta el marcador de fútbol mientras se muestra la alineación, para
        // no competir por atención (mismo patrón que panel-resumen-final).
        const marcadorFutbol = document.getElementById('panel-marcador');

        if (algunoActivo) {
            if (marcadorFutbol) marcadorFutbol.classList.add('oculto-forzado');
            this.container.style.display = 'flex';
            void this.container.offsetWidth; // fuerza reflow para que la transición de entrada corra
            this.container.classList.add('visible');
            this.isVisible = true;
        } else if (this.isVisible) {
            this.container.classList.remove('visible');
            this.isVisible = false;
            if (marcadorFutbol) marcadorFutbol.classList.remove('oculto-forzado');
            setTimeout(() => {
                if (!this.isVisible) this.container.style.display = 'none';
            }, 500);
        }
    }
}

export default PanelAlineacion;
