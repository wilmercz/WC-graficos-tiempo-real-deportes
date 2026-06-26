/**
 * ===================================================================================
 * PANEL RESUMEN FINAL
 * Muestra una pantalla completa con el resumen de estadísticas al finalizar el partido.
 * ===================================================================================
 */

class PanelResumenFinal {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        // Inyección dinámica al DOM
        let existingPanel = document.getElementById('panel-resumen-final');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-resumen-final';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;

        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.isVisible = false;
        this.hideTimeout = null;
        this.displayDuration = 18000; // 18 segundos de visibilidad
        
        console.log('🏆 PanelResumenFinal: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenPartido();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="resumen-wrapper scaled">
                <div class="resumen-header">
                    <h2 id="resumen-titulo-principal">FINAL DEL PARTIDO</h2>
                    <p id="resumen-subtitulo">Estadio Centenario</p>
                </div>

                <div class="resumen-marcador-final">
                    <div class="resumen-equipo-nombre-wrapper">
                        <div class="resumen-equipo-nombre" id="resumen-equipo-1">EQUIPO 1</div>
                    </div>
                    <div class="resumen-goles">
                        <span id="resumen-goles-1">0</span>
                        <span>-</span>
                        <span id="resumen-goles-2">0</span>
                    </div>
                    <div class="resumen-equipo-nombre-wrapper">
                        <div class="resumen-equipo-nombre" id="resumen-equipo-2">EQUIPO 2</div>
                    </div>
                </div>

                <div class="resumen-detalles-grid">
                    <!-- Goleadores (siguen en dos columnas) -->
                    <div class="resumen-seccion-goles" id="resumen-goleadores-1"></div>
                    <div class="resumen-seccion-goles" id="resumen-goleadores-2"></div>

                    <!-- Estadísticas (nuevo formato centrado) -->
                    <div class="stat-row">
                        <span class="stat-valor" id="resumen-corners-1">0</span><span class="stat-label">Tiros de Esquina</span><span class="stat-valor" id="resumen-corners-2">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-valor" id="resumen-amarillas-1">0</span><span class="stat-label">Tarjetas Amarillas</span><span class="stat-valor" id="resumen-amarillas-2">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-valor" id="resumen-rojas-1">0</span><span class="stat-label">Tarjetas Rojas</span><span class="stat-valor" id="resumen-rojas-2">0</span>
                    </div>
                </div>
            </div>
        `;
    }

    listenPartido() {
        this.partidoRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            // Aseguramos que si el campo no existe, se tome como 'false' por defecto.
            const mostrar = (data.MOSTRAR_RESUMENFINAL ?? false) === true || data.MOSTRAR_RESUMENFINAL === 'true';

            if (mostrar) {
                this.updateData(data);
                if (!this.isVisible) {
                    // Ocultar el marcador de fútbol si está visible para evitar superposición
                    const marcadorFutbol = document.getElementById('panel-marcador');
                    if (marcadorFutbol && marcadorFutbol.style.display !== 'none') {
                        marcadorFutbol.classList.add('oculto-forzado');
                    }

                    this.container.style.display = 'flex';
                    void this.container.offsetWidth;
                    this.container.classList.add('visible');
                    this.isVisible = true;

                    // Programar el apagado automático
                    if (this.hideTimeout) clearTimeout(this.hideTimeout);
                    this.hideTimeout = setTimeout(() => {
                        console.log('🕒 PanelResumenFinal: Tiempo agotado, apagando MOSTRAR_RESUMENFINAL en Firebase...');
                        this.partidoRef.child('MOSTRAR_RESUMENFINAL').set(false).catch(err => {
                            console.error('❌ Error al apagar MOSTRAR_RESUMENFINAL', err);
                        });
                    }, this.displayDuration);
                }
            } else {
                if (this.isVisible) {
                    this.container.classList.remove('visible');
                    this.isVisible = false;

                    // Restaurar la visibilidad del marcador de fútbol
                    const marcadorFutbol = document.getElementById('panel-marcador');
                    if (marcadorFutbol) {
                        marcadorFutbol.classList.remove('oculto-forzado');
                    }

                    if (this.hideTimeout) clearTimeout(this.hideTimeout); // Limpiar si se apaga manualmente
                    setTimeout(() => {
                        if (!this.isVisible) this.container.style.display = 'none';
                    }, 500);
                }
            }
        });
    }

    updateData(data) {
        // Log para depuración
        // Log para inspeccionar los campos problemáticos y el objeto completo.
        console.log('🏆 PanelResumenFinal: Verificando campos ->', { TAMARILLAS2: data.TAMARILLAS2, TROJAS1: data.TROJAS1, TROJAS2: data.TROJAS2 }, 'Objeto completo:', data);

        // Títulos
        document.getElementById('resumen-titulo-principal').textContent = data.RESUMEN_TEXTO_SUPERIOR || 'FINAL DEL PARTIDO';
        document.getElementById('resumen-subtitulo').textContent = data.ESTADIO || '';

        // Marcador
        document.getElementById('resumen-equipo-1').textContent = data.EQUIPO1 || 'EQUIPO 1'; // Corregido
        document.getElementById('resumen-equipo-2').textContent = data.EQUIPO2 || 'EQUIPO 2'; // Corregido
        document.getElementById('resumen-goles-1').textContent = data.GOLES1 ?? 0;
        document.getElementById('resumen-goles-2').textContent = data.GOLES2 ?? 0;

        // Estadísticas (usando campos que podrías añadir a PARTIDOACTUAL)
        document.getElementById('resumen-corners-1').textContent = data['ESQUINAS1'] ?? 0;
        document.getElementById('resumen-amarillas-1').textContent = data['TAMARILLAS1'] ?? 0;
        document.getElementById('resumen-rojas-1').textContent = data['TROJAS1'] ?? 0;

        document.getElementById('resumen-corners-2').textContent = data['ESQUINAS2'] ?? 0;
        document.getElementById('resumen-amarillas-2').textContent = data['TAMARILLAS2'] ?? 0;
        document.getElementById('resumen-rojas-2').textContent = data['TROJAS2'] ?? 0;

        // NOTA: La sección de goleadores (resumen-goleadores-1 y 2) está lista en el HTML.
        // Cuando tengas los datos en Firebase, se puede añadir aquí la lógica para leerlos y mostrarlos.
    }
}

export default PanelResumenFinal;