/**
 * PANEL COMPARATIVA (Cara a Cara / Head to Head)
 * Extrae automáticamente las posiciones y puntos de la tabla local 
 * y los muestra para los dos equipos actuales en pantalla.
 */

class PanelComparativa {
    constructor(firebaseDB) {
        this.db = firebaseDB;

        // Inyección dinámica al DOM
        let existingPanel = document.getElementById('panel-comparativa');
        if (!existingPanel) {
            existingPanel = document.createElement('div');
            existingPanel.id = 'panel-comparativa';
            document.getElementById('overlay-container').appendChild(existingPanel);
        }
        this.container = existingPanel;
        
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.isVisible = false;
        this.hideTimeout = null;
        this.displayDuration = 15000; // 15 segundos de visibilidad
        
        console.log('⚔️ PanelComparativa: Inicializando...');
    }

    initialize() {
        this.renderBase();
        this.listenPartido();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="comparativa-wrapper scaled">
                <div class="comp-equipo">
                    <div class="comp-pos" id="comp-pos-1">POSICIÓN #--</div>
                    <div class="comp-nombre" id="comp-nombre-1">EQUIPO 1</div>
                    <div class="comp-pts" id="comp-pts-1">-- PTS</div>
                </div>

                <div class="comp-vs">VS</div>

                <div class="comp-equipo">
                    <div class="comp-pos" id="comp-pos-2">POSICIÓN #--</div>
                    <div class="comp-nombre" id="comp-nombre-2">EQUIPO 2</div>
                    <div class="comp-pts" id="comp-pts-2">-- PTS</div>
                </div>
            </div>
        `;
    }

    listenPartido() {
        this.partidoRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;

            // Bandera desde Kotlin para mostrar el panel
            const mostrar = data.MOSTRAR_COMPARATIVA === true || data.MOSTRAR_COMPARATIVA === 'true';

            if (mostrar) {
                // 🛡️ VALIDACIÓN: Si no hay tabla, abortar y apagar el interruptor
                if (!data.TablaPosiciones) {
                    console.warn('⚠️ No hay datos en la Tabla de Posiciones. Cancelando y apagando MOSTRAR_COMPARATIVA.');
                    this.partidoRef.child('MOSTRAR_COMPARATIVA').set(false);
                    return; // Detenemos la ejecución aquí, no se mostrará nada
                }

                this.procesarYMostrarDatos(data);
                
                if (!this.isVisible) {
                    this.container.style.display = 'block';
                    void this.container.offsetWidth; // Forzar reflow
                    this.container.classList.add('visible');
                    this.isVisible = true;

                    // Programar el apagado automático después de 15 segundos
                    if (this.hideTimeout) clearTimeout(this.hideTimeout);
                    this.hideTimeout = setTimeout(() => {
                        console.log('🕒 PanelComparativa: Tiempo agotado, apagando MOSTRAR_COMPARATIVA en Firebase...');
                        this.partidoRef.child('MOSTRAR_COMPARATIVA').set(false).catch(err => {
                            console.error('❌ Error al apagar MOSTRAR_COMPARATIVA', err);
                        });
                    }, this.displayDuration);
                }
            } else {
                if (this.isVisible) {
                    this.container.classList.remove('visible');
                    this.isVisible = false;
                    
                    // Limpiar el temporizador por si se apagó manualmente antes de tiempo
                    if (this.hideTimeout) clearTimeout(this.hideTimeout);
                    
                    setTimeout(() => {
                        if (!this.isVisible) this.container.style.display = 'none';
                    }, 500);
                }
            }
        });
    }

    procesarYMostrarDatos(data) {
        // Obtener nombres base
        const equipo1Nombre = data.EQUIPO1 || 'EQUIPO 1';
        const equipo2Nombre = data.EQUIPO2 || 'EQUIPO 2';

        let pos1 = '--', pts1 = '--';
        let pos2 = '--', pts2 = '--';

        // Si hay datos en la tabla, ordenarlos usando las mismas reglas que la tabla general
        if (data.TablaPosiciones) {
            let equipos = Object.values(data.TablaPosiciones);
            equipos.sort((a, b) => {
                if (b.PTS !== a.PTS) return b.PTS - a.PTS;
                if (b.DG !== a.DG) return b.DG - a.DG;
                return (b.GF ?? 0) - (a.GF ?? 0);
            });

            // Buscar la posición sumando 1 al Index del array
            const eq1Index = equipos.findIndex(e => e.EQUIPO_NOMBRE === equipo1Nombre);
            const eq2Index = equipos.findIndex(e => e.EQUIPO_NOMBRE === equipo2Nombre);

            if (eq1Index !== -1) { pos1 = eq1Index + 1; pts1 = equipos[eq1Index].PTS ?? 0; }
            if (eq2Index !== -1) { pos2 = eq2Index + 1; pts2 = equipos[eq2Index].PTS ?? 0; }
        }

        // Actualizar el DOM
        document.getElementById('comp-nombre-1').textContent = equipo1Nombre;
        document.getElementById('comp-pos-1').textContent = `POSICIÓN #${pos1}`;
        document.getElementById('comp-pts-1').textContent = `${pts1} PUNTOS`;

        document.getElementById('comp-nombre-2').textContent = equipo2Nombre;
        document.getElementById('comp-pos-2').textContent = `POSICIÓN #${pos2}`;
        document.getElementById('comp-pts-2').textContent = `${pts2} PUNTOS`;
    }
}

export default PanelComparativa;