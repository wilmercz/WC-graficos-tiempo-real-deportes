/**
 * PANEL PENALES
 * Renderiza y controla la tanda de penales
 */

class PanelPenales {
  constructor(configManager, firebaseDB) {
    this.configManager = configManager;
    this.db = firebaseDB;

    this.container = document.getElementById('panel-penales');
    this.partidoRef = this.db.ref('/ARKI_DEPORTES/PARTIDOACTUAL');

    console.log('🥅 PanelPenales: Inicializando...');
  }

  initialize() {
    // Ajuste de posicionamiento y tamaño
    this.container.style.top = 'auto';           // Desactiva el margen superior
    this.container.style.bottom = '40px';        // Lo pega más al margen inferior (ajustable)
    this.container.style.left = '50%';           // Centrado horizontal
    this.container.style.transform = 'translateX(-50%)'; // Centrado exacto

    this.renderBase();
    this.listenPartido();
  }

  renderBase() {
    this.container.innerHTML = `
      <!-- Aumentamos el tamaño multiplicando la escala por 1.2 (aprox 2 puntos más) -->
      <div class="penales-wrapper scaled" style="transform: scale(calc(var(--escala) * 1.2)); transform-origin: bottom center; border-radius: 10px; overflow: hidden; box-shadow: var(--sombra-media);">

        <div class="penales-row" id="penales-row-1">
          <div class="penales-equipo" id="penales-equipo-1" style="border-radius: 4px; margin: 2px;">EQUIPO 1</div>
          <div class="penales-score" id="penales-score-1" style="border-radius: 4px; margin: 2px;">0</div>
          <div class="penales-shots" id="penales-shots-1"></div>
        </div>

        <div class="penales-row" id="penales-row-2">
          <div class="penales-equipo" id="penales-equipo-2" style="border-radius: 4px; margin: 2px;">EQUIPO 2</div>
          <div class="penales-score" id="penales-score-2" style="border-radius: 4px; margin: 2px;">0</div>
          <div class="penales-shots" id="penales-shots-2"></div>
        </div>

      </div>
    `;

    // Crear 6 puntos por defecto (0..5)
    this.renderDots('penales-shots-1', 6);
    this.renderDots('penales-shots-2', 6);
  }

  renderDots(containerId, count) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'penal-dot';
      dot.dataset.index = String(i);
      el.appendChild(dot);
    }
  }

  listenPartido() {
    this.partidoRef.on('value', snap => {
      const data = snap.val();
      if (!data) return;

      // VALIDACIÓN DE VISIBILIDAD (PENALES)
      const mostrarPenales = data.MARCADOR_PENALES === true || data.MARCADOR_PENALES === 'true';

      if (mostrarPenales) {
        // Corrección de animación:
        // Si tiene display: none (por inicialización), lo quitamos y forzamos un 'reflow'
        if (this.container.style.display === 'none') {
            this.container.style.display = '';
            void this.container.offsetWidth; // 👈 Truco clave: obliga al navegador a pintar el estado inicial antes de animar
        }
        this.container.classList.add('visible');
      } else {
        this.container.classList.remove('visible');
        return; // Detenemos actualización si está oculto
      }

      // Equipos
      document.getElementById('penales-equipo-1').textContent = (data.EQUIPO1 || 'EQUIPO 1').toUpperCase();
      document.getElementById('penales-equipo-2').textContent = (data.EQUIPO2 || 'EQUIPO 2').toUpperCase();

      // Goles penales (número)
      document.getElementById('penales-score-1').textContent = String(data.PENALES1 ?? 0);
      document.getElementById('penales-score-2').textContent = String(data.PENALES2 ?? 0);

      // Series
      this.updateSerieDots('penales-shots-1', data.PENALES_SERIE1);
      this.updateSerieDots('penales-shots-2', data.PENALES_SERIE2);
    });
  }

  updateSerieDots(containerId, serieObj) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const dots = el.querySelectorAll('.penal-dot');

    dots.forEach(dot => {
      dot.classList.remove('is-goal', 'is-miss');
      // por defecto queda “pendiente” (oscuro)
    });

    if (!serieObj) return;

    // Firebase a veces guarda como objeto {0:1,1:0...} o como array
    for (let i = 0; i < dots.length; i++) {
      const v = Array.isArray(serieObj) ? serieObj[i] : serieObj[i] ?? serieObj[String(i)];

      if (v === 1 || v === '1' || v === true) {
        dots[i].classList.add('is-goal');
      } else if (v === 0 || v === '0' || v === false) {
        dots[i].classList.add('is-miss');
      }
    }
  }
}

export default PanelPenales;
