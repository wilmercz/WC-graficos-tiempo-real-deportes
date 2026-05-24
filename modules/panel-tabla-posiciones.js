/**
 * PANEL TABLA DE POSICIONES
 * Renderiza la tabla de posiciones dinámicamente con animaciones
 */

class PanelTablaPosiciones {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        // Crear contenedor dinámicamente si no existe en HTML estático
        let existingPanel = document.getElementById('panel-tabla-posiciones');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-tabla-posiciones';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;

        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.isVisible = false;
        
        console.log('📊 PanelTablaPosiciones: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenPartido();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="tabla-posiciones-wrapper scaled">
                <div class="tabla-header text-primary">
                    <h2>TABLA DE POSICIONES</h2>
                </div>
                <div class="tabla-body" id="tabla-body">
                    <!-- Las filas se inyectarán aquí -->
                </div>
            </div>
        `;
    }

    listenPartido() {
        this.partidoRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            const mostrar = data.MOSTRAR_TABLAPOSICIONES === true || data.MOSTRAR_TABLAPOSICIONES === 'true';

            // Control de visibilidad y actualización de datos
            if (mostrar) {
                this.updateTable(data.TablaPosiciones);
                
                if (!this.isVisible) {
                    this.container.style.display = 'flex'; // Flex para centrar en pantalla completa
                    void this.container.offsetWidth; // Forzar reflow para animación
                    this.container.classList.add('visible');
                    this.isVisible = true;

                    // Ocultar marcador de fútbol localmente
                    const marcadorFutbol = document.getElementById('panel-marcador');
                    if (marcadorFutbol) marcadorFutbol.classList.add('oculto-forzado');
                }
            } else {
                if (this.isVisible) {
                    this.container.classList.remove('visible');
                    this.isVisible = false;

                    // Restaurar marcador de fútbol
                    const marcadorFutbol = document.getElementById('panel-marcador');
                    if (marcadorFutbol) marcadorFutbol.classList.remove('oculto-forzado');

                    // Ocultar del DOM después de la animación de salida
                    setTimeout(() => {
                        if (!this.isVisible) this.container.style.display = 'none';
                    }, 500);
                }
            }
        });
    }

    updateTable(tablaData) {
        const tbody = document.getElementById('tabla-body');
        if (!tbody) return;

        if (!tablaData) {
            tbody.innerHTML = '<div class="tabla-no-data">Sin datos disponibles...</div>';
            return;
        }

        // Convertir objeto de Firebase a array y ordenar
        let equipos = Object.values(tablaData);
        equipos.sort((a, b) => {
            if (b.PTS !== a.PTS) return b.PTS - a.PTS; // Ordenar por puntos (Descendente)
            if (b.DG !== a.DG) return b.DG - a.DG;     // Si hay empate, por diferencia de goles
            return (b.GF ?? 0) - (a.GF ?? 0);          // Último recurso: goles a favor
        });

        // Limitar a máximo 10 equipos para asegurar que entre visualmente en pantalla
        equipos = equipos.slice(0, 10);

        let html = `
            <div class="tabla-row header-row">
                <div class="col-pos">POS</div>
                <div class="col-equipo">EQUIPO</div>
                <div class="col-stat">PJ</div>
                <div class="col-stat">G</div>
                <div class="col-stat">E</div>
                <div class="col-stat">P</div>
                <div class="col-stat">DG</div>
                <div class="col-pts">PTS</div>
            </div>
        `;

        equipos.forEach((eq, index) => {
            // Delay secuencial para animación de cada fila (0.1s entre cada uno)
            const delay = index * 0.1; 
            
            html += `
                <div class="tabla-row data-row" style="animation-delay: ${delay}s">
                    <div class="col-pos">${index + 1}</div>
                    <div class="col-equipo">${eq.EQUIPO_NOMBRE || '---'}</div>
                    <div class="col-stat">${eq.PJ ?? 0}</div>
                    <div class="col-stat">${eq.PG ?? 0}</div>
                    <div class="col-stat">${eq.PE ?? 0}</div>
                    <div class="col-stat">${eq.PP ?? 0}</div>
                    <div class="col-stat">${eq.DG ?? 0}</div>
                    <div class="col-pts">${eq.PTS ?? 0}</div>
                </div>
            `;
        });

        tbody.innerHTML = html;
    }
}

export default PanelTablaPosiciones;