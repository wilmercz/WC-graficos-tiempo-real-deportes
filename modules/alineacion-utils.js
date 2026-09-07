/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALINEACIÓN - UTILIDADES COMPARTIDAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Usado tanto por panel-tactica.js (listas a los lados de la cancha) como por
 * panel-alineacion.js (panel de alineación completo estilo resumen final).
 *
 * Fuente esperada: /ARKI_DEPORTES/PARTIDOACTUAL/alineaciones/{local|visitante}
 * Cada jugador: { numero, nombre, posicion, titular }
 *
 * "Cuerpo técnico" (DT, asistentes, PF, etc.) se detecta porque su "numero"
 * NO es puramente numérico (ej. "DT", "PF", "ASISTENTE") — así lo generan
 * generarPromptParaIAExterna()/importarDesdeTexto() del lado Kotlin.
 */

const ES_NUMERO_PURO = /^\d+$/;

// Logo del medio: usado como marca de agua en la cancha (panel-tactica.js),
// como logo permanente de la franja inferior (panel-tactica.js) y ahora
// también en la columna central del panel de alineación (panel-alineacion.js).
// Un solo lugar para cambiarlo si algún día es necesario.
export const LOGO_MEDIO_URL = 'https://res.cloudinary.com/dm5jp6bbj/image/upload/v1787145107/ARKI_DEPORTES/CONFIGURACION/LOGOS_DEPORTES/logo_medio_social_1787145105202.png';

/**
 * Convierte el mapa crudo de Firebase en tres listas ya ordenadas:
 * titulares, suplentes y cuerpoTecnico.
 * Lee también en MAYÚSCULA por defensividad (ver auditoría de datos legacy).
 */
export function clasificarAlineacion(mapaJugadores) {
    const jugadores = Object.values(mapaJugadores || {}).map(j => ({
        numero: String(j.numero ?? j.NUMERO ?? '').trim(),
        nombre: j.nombre ?? j.NOMBRE ?? j.JUGADOR ?? j.jugador ?? '',
        titular: j.titular === true || j.titular === 'true' || j.TITULAR === true || j.TITULAR === 'TITULAR'
    })).filter(j => j.nombre);

    const ordenar = (lista) => lista.slice().sort((a, b) => {
        const na = parseInt(a.numero, 10);
        const nb = parseInt(b.numero, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.numero.localeCompare(b.numero);
    });

    const jugadoresDeCancha = jugadores.filter(j => ES_NUMERO_PURO.test(j.numero));
    const cuerpoTecnico = jugadores.filter(j => !ES_NUMERO_PURO.test(j.numero));

    return {
        titulares: ordenar(jugadoresDeCancha.filter(j => j.titular)),
        suplentes: ordenar(jugadoresDeCancha.filter(j => !j.titular)),
        cuerpoTecnico: ordenar(cuerpoTecnico)
    };
}