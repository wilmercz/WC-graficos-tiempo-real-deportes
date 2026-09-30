class PanelPortada {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.container = document.getElementById('panel-portada');
        this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');
        this.logoUrl = 'https://res.cloudinary.com/dm5jp6bbj/image/upload/v1773680088/LOGO_ARKI_MEDES_BLANCO_m2otas.png';

        this.serverTimeOffset = 0;
        this.intervalTimer = null; // cronómetro de la portada
        this.currentData = null;
    }

    initialize() {
        if (!this.container) return;
        this.renderBase();
        this.listenServerTime();
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
                    <span class="portada-gol" id="portada-goles1">0</span>

                    <!-- Estado / cronómetro real del partido (misma lógica que el marcador) -->
                    <div class="portada-crono por-jugarse solo-texto" id="portada-crono">
                        <div class="portada-crono-periodo">
                            <span class="portada-crono-dot"></span>
                            <span id="portada-crono-periodo"></span>
                        </div>
                        <div class="portada-crono-tiempo">
                            <span id="portada-crono-reloj">POR JUGARSE</span>
                            <span class="portada-crono-extra" id="portada-crono-extra"></span>
                        </div>
                    </div>

                    <span class="portada-gol" id="portada-goles2">0</span>
                </div>
            </div>
        `;
    }

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

            const mostrarPortada = data.MOSTRAR_PORTADA === true || data.MOSTRAR_PORTADA === 'true';

            if (mostrarPortada) {
                this.updatePanel(data);
                this.container.classList.add('visible');
            } else {
                this.container.classList.remove('visible');
                this.detenerCronometro();
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

        // Estado / cronómetro real (NumeroDeTiempo + motor FECHA_PLAY)
        this.updateEstadoTiempo(data);

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

    // ============================================================
    // ESTADO / CRONÓMETRO (misma lógica que panel-marcador.js)
    // ============================================================

    /**
     * estado: 'en-vivo' | 'pausa' | 'por-jugarse' | 'entretiempo' | 'finalizado' | 'penales'
     * Sin periodo (estados sin reloj) se oculta la línea superior y queda solo el texto.
     */
    setCrono(estado, reloj, periodo = '', extra = '') {
        const cronoEl = document.getElementById('portada-crono');
        cronoEl.className = `portada-crono ${estado}`;
        cronoEl.classList.toggle('solo-texto', !periodo);

        document.getElementById('portada-crono-periodo').textContent = periodo;
        document.getElementById('portada-crono-reloj').textContent = reloj;

        const extraEl = document.getElementById('portada-crono-extra');
        extraEl.textContent = extra;
        extraEl.classList.toggle('visible', !!extra);
    }

    updateEstadoTiempo(data) {
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';

        switch (data.NumeroDeTiempo) {
            case '1T':
            case '3T':
                this.iniciarCronometro();
                if (enPausa) {
                    this.detenerCronometro();
                    this.actualizarTextoCronometro();
                }
                break;

            case '2T':
                this.detenerCronometro();
                this.setCrono('entretiempo', 'ENTRETIEMPO');
                break;

            case '4T':
                this.detenerCronometro();
                this.setCrono('finalizado', 'FINALIZADO');
                break;

            case '5T':
            case 'PENALES':
                this.detenerCronometro();
                this.setCrono('penales', 'PENALES');
                break;

            default: // '0T' o sin valor
                this.detenerCronometro();
                this.setCrono('por-jugarse', 'POR JUGARSE');
                break;
        }
    }

    iniciarCronometro() {
        if (this.intervalTimer) return;
        this.intervalTimer = setInterval(() => this.actualizarTextoCronometro(), 1000);
        this.actualizarTextoCronometro();
    }

    actualizarTextoCronometro() {
        const data = this.currentData;
        if (!data) return;

        const numeroTiempo = data.NumeroDeTiempo || '1T';
        const tiempoJuegoEnMinutos = Number(data.TIEMPOJUEGO) || 45;

        const startMs = parseFechaPlayToMs(data.FECHA_PLAY);
        const pausaAcumuladaMs = (Number(data.CRONO_PAUSA_ACUMULADA) || 0) * 1000;
        const offsetMs = (Number(data.CRONO_OFFSET) || 0) * 1000;
        const enPausa = data.CRONO_EN_PAUSA === true || data.CRONO_EN_PAUSA === 'true';
        const inicioPausaMs = parseFechaPlayToMs(data.CRONO_INICIO_PAUSA);
        const limiteSegundos = tiempoJuegoEnMinutos * 60;

        const nombresVisuales = { '1T': '1T', '3T': '2T' };
        const periodo = nombresVisuales[numeroTiempo] || numeroTiempo;
        const estado = enPausa ? 'pausa' : 'en-vivo';

        if (startMs == null) {
            this.setCrono(estado, '00:00', periodo);
            return;
        }

        let now = Date.now() + this.serverTimeOffset;
        if (enPausa && inicioPausaMs) now = inicioPausaMs;

        const elapsedMs = (now - startMs) - pausaAcumuladaMs + offsetMs;
        const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

        if (elapsedSeconds > 7200) this.detenerCronometro();

        if (elapsedSeconds <= limiteSegundos) {
            const minutos = Math.floor(elapsedSeconds / 60);
            const segundos = elapsedSeconds % 60;
            this.setCrono(estado, `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`, periodo);
        } else {
            // Tiempo extra: reloj clavado en el reglamentario + minutos añadidos
            const reloj = `${String(tiempoJuegoEnMinutos).padStart(2, '0')}:00`;
            const minutosExtra = Math.ceil((elapsedSeconds - limiteSegundos) / 60);
            this.setCrono(estado, reloj, periodo, minutosExtra > 0 ? `+${minutosExtra}` : '');
        }
    }

    detenerCronometro() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }
}

function parseFechaPlayToMs(fechaPlay) {
    if (!fechaPlay) return null;
    if (typeof fechaPlay === 'number') return fechaPlay;
    if (typeof fechaPlay !== 'string') return null;
    const ms = new Date(fechaPlay).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export default PanelPortada;