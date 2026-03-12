/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIO MANAGER - Control de Música de Fondo / Cortinas
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Reproducir música de fondo (loop).
 * - Controlar Play/Stop/Pause desde Firebase.
 * - Gestionar VOLUMEN en tiempo real (para hacer fader cuando hablen los locutores).
 * - Independiente de los efectos de sonido del panel de tercios.
 */

class AudioManager {
    constructor(firebaseDB) {
        this.db = firebaseDB;
        this.ref = this.db.ref('/ARKI_DEPORTES/CONTROL_AUDIO');
        
        this.audioElement = new Audio();
        this.audioElement.loop = true; // La música de fondo siempre en loop por defecto
        
        this.currentUrl = '';
        this.targetVolume = 1.0;
        
        console.log('🎵 AudioManager: Inicializando...');
    }

    initialize() {
        this.listenToAudioControl();
    }

    listenToAudioControl() {
        this.ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.handleUrlChange(data.URL);
            this.handleStateChange(data.ESTADO); // PLAY, STOP, PAUSE
            this.handleVolumeChange(data.VOLUMEN); // 0 a 100
        });
    }

    handleUrlChange(newUrl) {
        // Si la URL es diferente y válida, cambiamos la fuente
        if (newUrl && newUrl !== this.currentUrl) {
            console.log('🎵 AudioManager: Nueva pista cargada', newUrl);
            this.currentUrl = newUrl;
            
            const wasPlaying = !this.audioElement.paused;
            
            this.audioElement.src = this.currentUrl;
            
            // Si estaba sonando, intentamos reanudar con la nueva pista
            if (wasPlaying) {
                this.playAudio();
            }
        }
    }

    handleStateChange(state) {
        if (!state) return;
        const cmd = state.toUpperCase();

        if (cmd === 'PLAY') {
            this.playAudio();
        } else if (cmd === 'STOP') {
            this.stopAudio();
        } else if (cmd === 'PAUSE') {
            this.audioElement.pause();
        }
    }

    handleVolumeChange(volInput) {
        // Convertir de 0-100 a 0.0-1.0
        let vol = Number(volInput);
        if (isNaN(vol)) vol = 100;
        if (vol < 0) vol = 0;
        if (vol > 100) vol = 100;

        const normalizedVol = vol / 100;
        
        // Aplicar volumen suavemente (opcional, pero el navegador lo hace casi instantáneo)
        this.audioElement.volume = normalizedVol;
        // console.log(`🎵 Volumen ajustado a: ${vol}%`);
    }

    playAudio() {
        if (!this.currentUrl) return;

        // Promesa de play para evitar errores de "User Interaction"
        const playPromise = this.audioElement.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('⚠️ AudioManager: Autoplay bloqueado o error.', error);
            });
        }
    }

    stopAudio() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0; // Reiniciar al principio
    }
}

export default AudioManager;
