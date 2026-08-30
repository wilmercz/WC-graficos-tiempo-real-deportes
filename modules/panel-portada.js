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
                    <div class="portada-team-block" id="portada-block1">
                        <img class="portada-escudo" id="portada-escudo1" alt="Escudo equipo 1">
                        <div class="portada-team" id="portada-equipo1">EQUIPO 1</div>
                    </div>

                    <div class="portada-vs">VS</div>

                    <div class="portada-team-block" id="portada-block2">
                        <img class="portada-escudo" id="portada-escudo2" alt="Escudo equipo 2">
                        <div class="portada-team" id="portada-equipo2">EQUIPO 2</div>
                    </div>

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

            const mostrarPortada = data.MOSTRAR_PORTADA === true || data.MOSTRAR_PORTADA === 'true';

            if (mostrarPortada) {
                this.updatePanel(data);
                this.container.classList.add('visible');
            } else {
                this.container.classList.remove('visible');
            }
        });
    }

    // Muestra u oculta el escudo de un equipo según si la URL existe y es válida
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

    updatePanel(data) {
        // Actualizar nombres de equipos
        document.getElementById('portada-equipo1').textContent = data.EQUIPO1 || 'EQUIPO 1';
        document.getElementById('portada-equipo2').textContent = data.EQUIPO2 || 'EQUIPO 2';

        // Actualizar escudos (solo si el link existe)
        this.toggleEscudo('portada-escudo1', data.ESCUDO1_URL);
        this.toggleEscudo('portada-escudo2', data.ESCUDO2_URL);

        // Actualizar goles (si aplica)
        document.getElementById('portada-goles1').textContent = data.GOLES1 ?? 0;
        document.getElementById('portada-goles2').textContent = data.GOLES2 ?? 0;

        // Actualizar estado (ej: POR COMENZAR, FINALIZADO)
        const estado = data.ESTADO_PARTIDO || 'POR COMENZAR';
        document.getElementById('portada-estado').textContent = estado;

        // --- LÓGICA DE LA ETAPA ---
        const etapaValue = data.ETAPA;
        const etapaMap = {
            '0': 'Fase de Grupos',
            '1': 'Octavos de Final',
            '2': 'Semifinal',
            '3': 'Final',
            '4': 'Tercer Lugar'
        };
        const etapaTexto = etapaMap[etapaValue] || '';

        const etapaEl = document.getElementById('portada-etapa-texto');
        const matchCardEl = this.container.querySelector('.portada-match-card');

        etapaEl.textContent = etapaTexto;

        const debeAlternar = !!etapaTexto;
        matchCardEl.classList.toggle('alternar', debeAlternar);
    }
}

export default PanelPortada;