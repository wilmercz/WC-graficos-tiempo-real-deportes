// 🎥 modules/webrtc-manager.js
// Responsabilidad: Gestionar la conexión P2P con la App Kotlin para video en vivo (B-Roll)

export class WebRTCManager {
    constructor(app) {
        this.app = app;
        this.peerConnection = null;
        this.videoElement = null;
        this.containerElement = null;
        
        // Estado solicitado por Firebase vs Estado real de conexión
        this.firebaseRequestedVisible = false;
        this.firebaseRequestedMuted = true; // ✅ Rastrea si Firebase quiere el audio encendido
        this.isConnected = false;
        this.isManualMode = false; // ✅ Identifica si el modo manual tiene el control
        this._processedCandidates = new Set();  // ✅ Evita procesar IPs duplicadas
        this.pendingCandidates = []; // ✅ Sala de espera para IPs de Android

        // Rutas de Firebase para la Señalización (Signaling)
        this.SIGNALING_PATH = 'ARKI_DEPORTES/WEBRTC';
    }

    init() {
        console.log('🎥 Inicializando WebRTC Manager...');
        this.createDOMElement();
        this.setupFirebaseSignaling();
        this.setupManualTesting(); // 🛠️ MANUAL: Inicializar el panel de pruebas
    }

    /**
     * Crear los elementos DOM para el video si no existen
     */
    createDOMElement() {
        this.containerElement = document.getElementById('grafico-envivo');
        
        if (!this.containerElement) {
            this.containerElement = document.createElement('div');
            this.containerElement.id = 'grafico-envivo';
            
            this.videoElement = document.createElement('video');
            this.videoElement.id = 'envivo-video';
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            this.videoElement.muted = true; // Por defecto muteado
            
            // Atributos obligatorios para decodificación móvil/WebRTC en Chrome/Safari:
            this.videoElement.setAttribute('autoplay', '');
            this.videoElement.setAttribute('playsinline', '');
            this.videoElement.setAttribute('muted', '');
            this.videoElement.style.pointerEvents = 'none'; // Evita bloqueos de clicks del sistema
            this.videoElement.style.width = '100%';
            this.videoElement.style.height = '100%';
            this.videoElement.style.objectFit = 'cover';
            
            this.containerElement.appendChild(this.videoElement);
            // Insertar justo al principio del body (debajo de todo)
            document.body.insertBefore(this.containerElement, document.body.firstChild);
            
            console.log('🎥 Contenedor WebRTC B-Roll creado dinámicamente');

            // -------------------------------------------------------------------
            // 🔓 DETECCIÓN GLOBAL DE CLIC EN PANTALLA (INVISIBLE)
            // Cualquier clic en la pantalla validará el permiso de humano para el audio.
            // -------------------------------------------------------------------
            const unlockAudioOnInteraction = () => {
                if (!window.webrtcHumanClickDone) {
                    console.log('👆 ¡CLIC DETECTADO! Registrando humano en Chrome...');
                    window.webrtcHumanClickDone = true;
                    
                    // 1. 📢 FEEDBACK VISUAL: Activar "Síguenos" (Redes) respetando el tiempo global (15 segundos)
                    if (this.app) {
                        // Assuming app has a method to update Firebase visibility for 'redes'
                        // This part needs to be adapted to your app's specific Firebase update mechanism
                        // For now, it's commented out or uses a placeholder if app.updateFirebaseVisibility is not defined
                        // this.app.updateFirebaseVisibility('redes', true);
                        // const duracionRedes = (window.currentConfig?.duracionRedes || 7) * 1000;
                        // setTimeout(() => this.app.updateFirebaseVisibility('redes', false), duracionRedes);
                    }

                    // 2. Reactivar audio/video si el WebRTC ya estaba esperando
                    if (this.videoElement && this.isConnected && this.firebaseRequestedVisible) {
                        this.videoElement.muted = this.firebaseRequestedMuted;
                        this.videoElement.play().catch(e => console.warn('🎥 Falló reactivación por toque:', e));
                    }
                }
            };
            document.addEventListener('click', unlockAudioOnInteraction);
            document.addEventListener('touchstart', unlockAudioOnInteraction, { passive: true });
            // -------------------------------------------------------------------
        } else {
            this.videoElement = this.containerElement.querySelector('video');
        }
    }

    /**
     * Escuchar las ofertas y candidatos de Kotlin en Firebase
     */
    setupFirebaseSignaling() {
        if (!this.app.modules.firebaseClient) {
            console.error('🎥 Error: FirebaseClient no está disponible para WebRTC');
            return;
        }

        const fb = this.app.modules.firebaseClient;

        // 1. Función compartida: Distingue si viene de "OFERTA" (Manual) o "offer" (Kotlin)
        const processOffer = async (rawOffer, isManualPath) => {
            console.log(`🎥 ✉️ Datos de Oferta WebRTC recibidos (Ruta Manual: ${isManualPath}):`, rawOffer);
            if (!rawOffer) return;
            
            // Adaptación por si Kotlin lo envía como texto o usa nombres diferentes
            let offer = rawOffer;
            if (typeof rawOffer === 'string') {
                try { offer = JSON.parse(rawOffer); } catch(e) { console.error('Error parseando OFERTA', e); }
            }
            
            // Extraer si viene anidado (ej. Kotlin manda { offer: { type: 'offer', sdp: '...' } })
            if (offer && offer.offer) offer = offer.offer;
            if (offer && offer.OFERTA) offer = offer.OFERTA;

            // Android WebRTC a veces usa "description" en lugar de "sdp"
            if (offer && offer.description && !offer.sdp) offer.sdp = offer.description;
            if (offer && typeof offer.type === 'string') offer.type = offer.type.toLowerCase();

            // 🤖 SEMI-AUTOMÁTICO: Llenar la caja de texto SIEMPRE para que veas qué llegó
            window.lastManualOffer = offer;
            const manualOfferBox = document.getElementById('webrtc-manual-offer');
            if (manualOfferBox) {
                // 🔄 CAMBIO: Poner solo el texto puro de la oferta, igual que el receptor de pruebas
                manualOfferBox.value = JSON.stringify(window.lastManualOffer, null, 2);
            }

            if (offer && offer.type && offer.sdp) {
                // Solo pausar si la oferta vino por la ruta manual Y el panel está visible
                if (isManualPath) {
                    const manualPanel = document.getElementById('webrtc-manual-panel');
                    if (manualPanel && manualPanel.style.display !== 'none') {
                        console.log('🛑 [MODO SEMI-AUTOMÁTICO] Esperando clic en "Procesar y Enviar Respuesta"...');
                        return;
                    }
                }

                console.log('🎥 Preparando conexión automática...');
                await this.handleOffer(offer);
            } else {
                console.warn('⚠️ La OFERTA llegó, pero no tiene un formato WebRTC válido.', offer);
            }
        };

        // Asignar el mismo procesador a ambas rutas
        fb.onDataChange(`${this.SIGNALING_PATH}/OFERTA`, (data) => processOffer(data, true));
        fb.onDataChange(`${this.SIGNALING_PATH}/offer`, (data) => processOffer(data, false));

        // 2. Escuchar los "CANDIDATOS" (Rutas de red/IPs) de Kotlin (Ajustado al español)
        fb.onDataChange(`${this.SIGNALING_PATH}/CANDIDATOS/android`, (candidatesData) => {
            if (!candidatesData) return; // ❌ Eliminamos el bloqueo de peerConnection
            
            // 🤖 SEMI-AUTOMÁTICO: Guardar candidatos y actualizar la caja de texto
            window.lastAndroidCandidates = candidatesData;

            const manualPanel = document.getElementById('webrtc-manual-panel');
            if (manualPanel && manualPanel.style.display !== 'none') {
                return; // 🛑 En modo semi-automático, no procesar candidatos en segundo plano
            }

            Object.entries(candidatesData).forEach(([id, candidate]) => {
                if (this._processedCandidates.has(id)) return;  // Ya fue procesado, ignorar
                this._processedCandidates.add(id);
                
                // 🛡️ SALA DE ESPERA: Si la oferta aún no se termina de procesar, guardar IP
                if (!this.peerConnection || !this.peerConnection.remoteDescription) {
                    console.log('⏳ Guardando candidato de Android en sala de espera...');
                    this.pendingCandidates.push(candidate);
                } else {
                    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(e => console.error('🎥 Error añadiendo ICE candidate:', e));
                }
            });
        });
    }

    /**
     * Procesar la oferta y crear la respuesta
     */
    async handleOffer(offer) {
        this._processedCandidates.clear(); // ✅ Limpiar IPs de sesiones anteriores
        this.pendingCandidates = []; // ✅ Limpiar sala de espera

        // Limpiar conexión anterior si existía
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        // Crear nueva conexión
        // 🔄 CAMBIO: Usar conexión limpia, EXACTAMENTE igual que el modo manual de pruebas
        this.peerConnection = new RTCPeerConnection();

        // Escuchar cuando el video de Kotlin llega
        this.peerConnection.ontrack = (event) => {
            console.log(`🎥 📺 ¡Track de ${event.track.kind} recibido de Kotlin!`);
            
            // 🛡️ ESTÁNDAR PURO DE WEBRTC:
            // Asignar el stream directamente.
            if (event.streams && event.streams[0]) {
                if (this.videoElement.srcObject !== event.streams[0]) {
                    console.log('✅ Asignando stream completo al elemento video');
                    this.videoElement.srcObject = event.streams[0];
                }
            } else {
                if (!this.videoElement.srcObject) {
                    this.videoElement.srcObject = new MediaStream();
                }
                this.videoElement.srcObject.addTrack(event.track);
            }
            
            // 🚀 INTENTO SEGURO DE REPRODUCCIÓN (Anti-Autoplay Block)
            const safePlay = () => {
                // Si el humano ya hizo clic en el botón rojo, respetamos lo que diga Firebase
                if (window.webrtcHumanClickDone) {
                    this.videoElement.muted = this.firebaseRequestedMuted;
                }

                const playPromise = this.videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        if (e.name === 'NotAllowedError') {
                            console.warn('🔇 Chrome bloqueó el video. Necesitas hacer clic en el botón rojo de arriba.');
                            this.videoElement.muted = true;
                            this.videoElement.play().catch(err => console.error('🎥 Falló el play incluso silenciado:', err));
                        } else if (e.name !== 'AbortError') {
                            console.error('🎥 ❌ Error de Autoplay WebRTC:', e);
                        }
                    });
                }
            };
            
            safePlay(); // Intentar de inmediato
            this.videoElement.onloadedmetadata = () => safePlay();
            this.videoElement.onloadeddata = () => safePlay(); // Intentar al recibir el frame
            
            // 🔍 DEBUG: Monitorear resoluciones extrañas (Dummy Frames)
            this.videoElement.addEventListener('resize', () => {
                console.log(`🎥 📏 Resolución del video recibida: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
            });
        };

        // Monitorear estado de la conexión (NUESTRO DOBLE SEGURO)
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log(`🎥 Estado de conexión WebRTC: ${state}`);
            
            // 🌟 NUEVO: Detectar si el cambio es justo ahora una conexión exitosa
            const justConnected = (state === 'connected' && !this.isConnected);
            
            this.isConnected = (state === 'connected');
            this.evaluateVisibility(); // Re-evaluar si podemos mostrar la imagen
            
            // 🌟 Mostrar animación de éxito "Joven Sucumbios"
            // DESACTIVADO TEMPORALMENTE
            // if (justConnected) {
            //     this.showConnectionBadge();
            // }
            
            // 🧹 Limpieza automática si el celular se desconecta o se apaga la pantalla
            if (state === 'disconnected' || state === 'failed') {
                console.log('🎥 🧹 Limpiando reproductor por pérdida de señal');
                if (this.videoElement) this.videoElement.srcObject = null;
                
                // 🛡️ SEGURO AUTOMÁTICO: Apagar el interruptor en Firebase si se cae el WiFi
                if (this.app?.modules?.firebaseClient) {
                    this.app.modules.firebaseClient.writeData('ARKI_DEPORTES/PARTIDOACTUAL/Mostrar_EnVivo', false);
                }
            }
        };

        // 🚀 Generar ICE candidates y esperar a que termine (Igual que en manual)
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) return; // ⏳ Esperar
            
            // 🛑 CUANDO TERMINA: Mandar la respuesta completa a Kotlin con las IPs incluidas
            console.log('🎥 ✉️ Enviando Respuesta COMPLETA WebRTC al Emisor...');
            const localDesc = this.peerConnection.localDescription;
            
            if (this.app.modules.firebaseClient) {
                // Enviar a KOTLIN (Automático) como Objeto JSON puro
                const answerObject = {
                    type: localDesc.type,
                    sdp: localDesc.sdp
                };
                this.app.modules.firebaseClient.writeData(`${this.SIGNALING_PATH}/answer`, answerObject);
            }
        };

        // Aplicar la oferta de Kotlin
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Crear nuestra respuesta (Answer)
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
    }

    /**
     * Recibir comando de Firebase (Mostrar/Ocultar EnVivo y Audio)
     */
    handleCommand(mostrar, muted) {
        if (this.isManualMode) {
            console.log('🛠️ [MANUAL] Ignorando comando de Firebase porque el modo manual está activo.');
            return;
        }

        this.firebaseRequestedVisible = mostrar;
        this.firebaseRequestedMuted = muted;
        
        if (this.videoElement) {
            this.videoElement.muted = muted;
            
            // 🛡️ RECOVERY EXTREMO: Si CameraFi/Chrome apaga el video al intentar ponerle sonido
            if (mostrar) {
                const playPromise = this.videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        // Si el bloqueo ocurre, aceptamos el silencio pero salvamos la imagen
                        console.warn('🔇 CameraFi bloqueó el audio. Rescatando el video en Mute para evitar pantalla negra.');
                        this.videoElement.muted = true;
                        this.videoElement.play().catch(err => console.error('Error final:', err));
                    });
                }
            }
        }
        
        this.evaluateVisibility();
    }

    /**
     * EL DOBLE SEGURO: Evalúa si debe mostrar la capa basándose en Firebase Y la red
     */
    evaluateVisibility() {
        // Solo se hace visible si Firebase lo pide Y estamos realmente conectados
        const shouldShow = this.firebaseRequestedVisible && this.isConnected;
        this.containerElement.classList.toggle('visible', shouldShow);
    }

    /**
     * 🌟 Mostrar notificación de conexión WebRTC exitosa
     */
    showConnectionBadge() {
        let badge = document.getElementById('webrtc-connection-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'webrtc-connection-badge';
            
            const circle = document.createElement('div');
            circle.className = 'circle-logo';
            
            const img = document.createElement('img');
            circle.appendChild(img);
            
            const text = document.createElement('span');
            text.className = 'badge-text';
            text.innerText = 'Joven Sucumbios'; // Texto solicitado
            
            badge.appendChild(circle);
            badge.appendChild(text);
            document.body.appendChild(badge);
        }
        
        // Obtener el logo actual del DOM (el que ya se descargó en el main)
        const img = badge.querySelector('img');
        if (img) {
            const currentLogoUrl = window.lastFirebaseData?.urlLogo || document.getElementById('logo')?.src;
            if (currentLogoUrl) img.src = currentLogoUrl;
        }
        
        // Reiniciar animación y forzar reflow
        badge.classList.remove('show');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => badge.classList.add('show'));
        });
        
        // Desaparecer automáticamente a los 7 segundos
        if (this._badgeTimer) clearTimeout(this._badgeTimer);
        this._badgeTimer = setTimeout(() => {
            if (badge) badge.classList.remove('show');
        }, 7000);
    }

    // =======================================================================
    // 🛠️ FUNCIONES MANUALES (TEMPORALES PARA DEPURAR PANTALLA NEGRA)
    // =======================================================================
    
    setupManualTesting() {
        const btn = document.getElementById('webrtc-manual-btn');
        if (btn) {
            btn.onclick = async () => {
                const offerText = document.getElementById('webrtc-manual-offer').value;
                if (!offerText) {
                    alert('Por favor espera a que la Oferta llegue de Firebase o pégala manualmente.');
                    return;
                }
                try {
                    let offer = JSON.parse(offerText);
                    await this.processManualOffer(offer);
                } catch (e) {
                    alert('Error parseando JSON. Revisa la consola.');
                    console.error('🛠️ Error parseando oferta manual:', e);
                }
            };
        }

        const hideBtn = document.getElementById('webrtc-manual-hide-btn');
        if (hideBtn) {
            hideBtn.onclick = () => {
                const panel = document.getElementById('webrtc-manual-panel');
                if (panel) panel.style.display = 'none';
                
                // Actualizar en Firebase para apagar el interruptor
                if (this.app.modules.firebaseClient) {
                    this.app.modules.firebaseClient.writeData('ARKI_DEPORTES/PARTIDOACTUAL/Mostrar_WebRTCManual', false);
                }
            };
        }
    }

    async processManualOffer(offer) {
        console.log("🛠️ [MANUAL] Iniciando proceso manual WebRTC...");
        
        // 🚀 Forzar la visibilidad del reproductor principal de fondo (Overlay)
        this.isManualMode = true;
        this.firebaseRequestedVisible = true;
        this.isConnected = true;
        this.evaluateVisibility();

        // 🚀 Activar controles temporales en la pantalla grande para facilitar pruebas
        if (this.videoElement) {
            this.videoElement.controls = true;
            this.videoElement.style.pointerEvents = 'all'; // Permitir usar el mouse en manual
        }

        if (this.peerConnection) this.peerConnection.close();

        // 🔄 CAMBIO: Dejado completamente vacío para coincidir exactamente con el emisor HTML
        this.peerConnection = new RTCPeerConnection();

        this.peerConnection.ontrack = (event) => {
            console.log(`🛠️ [MANUAL] ¡Track de ${event.track.kind} recibido!`);
            const stream = event.streams && event.streams[0] ? event.streams[0] : null;
            
            // 2. Alimentar el reproductor PRINCIPAL (Pantalla completa / Fondo)
            if (this.videoElement) {
                if (stream) {
                    this.videoElement.srcObject = stream;
                } else {
                    if (!this.videoElement.srcObject) this.videoElement.srcObject = new MediaStream();
                    this.videoElement.srcObject.addTrack(event.track);
                }
                
                this.videoElement.muted = false; // El principal lleva el audio
                this.videoElement.play().then(() => {
                    console.log("🛠️ [MANUAL] Video PRINCIPAL reproduciendo con AUDIO correctamente.");
                }).catch(e => {
                    console.warn("🛠️ [MANUAL] Error forzando play principal con audio, intentando silenciado...", e);
                    this.videoElement.muted = true;
                    this.videoElement.play().catch(err => console.error("🛠️ [MANUAL] Fallo crítico play principal:", err));
                });
            }
        };

        // 🚀 Generar ICE candidates y esperar a que termine
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) return;

            // 🛑 CUANDO TERMINA (event.candidate es null): Mostrar Respuesta Completa
            const answerJson = this.peerConnection.localDescription;
            
            // 1. Mostrar en caja de texto
            document.getElementById('webrtc-manual-answer').value = JSON.stringify(answerJson);
            console.log("🛠️ [MANUAL] Respuesta lista con ICE candidates incluidos.");

            // 2. Enviar automáticamente a Firebase
            if (this.app.modules.firebaseClient) {
                console.log("🚀 [MANUAL] Enviando Respuesta Completa a Firebase automáticamente...");
                this.app.modules.firebaseClient.writeData(`${this.SIGNALING_PATH}/RESPUESTA`, JSON.stringify(answerJson));
            }
        };

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        document.getElementById('webrtc-manual-answer').value = "Generando respuesta y candidatos ICE... Por favor espera.";
    }
}