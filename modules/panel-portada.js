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
                <img src="${this.logoUrl}" class="portada-logo" />
                
                <div class="portada-match-card">
                    <div class="portada-team" id="portada-eq1">EQUIPO A</div>
                    <div class="portada-vs">VS</div>
                    <div class="portada-team" id="portada-eq2">EQUIPO B</div>
                </div>

                <div class="portada-score-wrapper">
                    <span id="portada-score1">0</span> - <span id="portada-score2">0</span>
                </div>

                <div class="info-status">Transmisión en Vivo</div>
            </div>
        `;
    }

    listenFirebase() {
        this.partidoRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Control de Visibilidad
            const mostrar = data.MOSTRAR_PORTADA === true || data.MOSTRAR_PORTADA === 'true';
            
            if (mostrar) {
                this.container.style.display = 'flex';
                // Forzar reflow para animación
                void this.container.offsetWidth;
                this.container.classList.add('visible');
            } else {
                this.container.classList.remove('visible');
                setTimeout(() => {
                    if (!this.container.classList.contains('visible')) {
                        this.container.style.display = 'none';
                    }
                }, 800);
            }

            // Actualizar Datos
            document.getElementById('portada-eq1').textContent = data.EQUIPO1 || 'EQUIPO 1';
            document.getElementById('portada-eq2').textContent = data.EQUIPO2 || 'EQUIPO 2';
            document.getElementById('portada-score1').textContent = data.GOLES1 ?? 0;
            document.getElementById('portada-score2').textContent = data.GOLES2 ?? 0;
        });
    }
}

export default PanelPortada;