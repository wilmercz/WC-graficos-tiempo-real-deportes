class PanelPortada {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.container = document.getElementById('panel-portada');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.logoUrl = 'https://res.cloudinary.com/dm5jp6bbj/image/upload/v1773680088/LOGO_ARKI_MEDES_BLANCO_m2otas.png';
    }

    initialize() {
        if (!this.container) return;
        this.renderBase();
        this.listenFirebase();
    }

    renderBase() {
        this.container.innerHTML = `
            <div class="portada-content">
                <img src="${this.logoUrl}" alt="Logo Arki Deportes" class="portada-logo">
                
                <div class="portada-match-card">
                    <div class="portada-team" id="portada-equipo1">EQUIPO 1</div>
                    <div class="portada-vs">VS</div>
                    <div class="portada-team" id="portada-equipo2">EQUIPO 2</div>

                    <!-- El nuevo overlay para la etapa -->
                    <div class="portada-etapa-overlay" id="portada-etapa-texto"></div>
                </div>

                <div class="portada-score-wrapper" id="portada-score-final">
                    <span id="portada-goles1">0</span> - <span id="portada-goles2">0</span>
                </div>

                <div class="info-status" id="portada-estado">POR COMENZAR</div>
            </div>
        `;
    }

    listenFirebase() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Control de Visibilidad
            const mostrarPortada = data.MOSTRAR_PORTADA === true || data.MOSTRAR_PORTADA === 'true';
            
            if (mostrarPortada) {
                this.updatePanel(data);
                this.container.classList.add('visible');
            } else {
                this.container.classList.remove('visible');
            }
        });
    }

    updatePanel(data) {
        // Actualizar nombres de equipos
        document.getElementById('portada-equipo1').textContent = data.EQUIPO1 || 'EQUIPO 1';
        document.getElementById('portada-equipo2').textContent = data.EQUIPO2 || 'EQUIPO 2';

        // Actualizar goles (si aplica)
        document.getElementById('portada-goles1').textContent = data.GOLES1 ?? 0;
        document.getElementById('portada-goles2').textContent = data.GOLES2 ?? 0;

        // Actualizar estado (ej: POR COMENZAR, FINALIZADO)
        const estado = data.ESTADO_PARTIDO || 'POR COMENZAR';
        document.getElementById('portada-estado').textContent = estado;

        // --- LÓGICA DE LA ETAPA ---
        const etapaValue = data.ETAPA; // Puede ser 0, 1, 2, 3, 4 o undefined
        console.log(`[PORTADA-ETAPA] Valor leído de Firebase 'ETAPA':`, etapaValue, `(Tipo: ${typeof etapaValue})`);

        const etapaMap = {
            '0': 'Fase de Grupos',
            '1': 'Octavos de Final',
            '2': 'Semifinal',
            '3': 'Final',
            '4': 'Tercer Lugar'
        };
        const etapaTexto = etapaMap[etapaValue] || '';
        console.log(`[PORTADA-ETAPA] Texto de etapa resultante: "${etapaTexto}"`);

        const etapaEl = document.getElementById('portada-etapa-texto');
        const matchCardEl = this.container.querySelector('.portada-match-card');

        etapaEl.textContent = etapaTexto;

        // Activar la animación solo si hay un texto de etapa para mostrar
        const debeAlternar = !!etapaTexto;
        matchCardEl.classList.toggle('alternar', debeAlternar);
        console.log(`[PORTADA-ETAPA] ¿Debe animar la alternancia? -> ${debeAlternar}`);
    }
}

export default PanelPortada;