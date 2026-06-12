/**
 * =============================================================
 * HELPER: Calendario Litúrgico para MCMApp
 * =============================================================
 * 
 * Ejemplo de uso en tu app Expo/React Native.
 * Importa el JSON estático y consulta el tiempo litúrgico del día.
 * 
 * Uso:
 *   import { obtenerTiempoLiturgico, obtenerFechaEspecial, esDomingoCuaresma } from './calendario-liturgico-helper';
 *   
 *   const hoy = obtenerTiempoLiturgico(); 
 *   // → { id: 'cuaresma', nombre: 'Cuaresma', inicio: '2026-02-18', fin: '2026-03-28' }
 *   
 *   const especial = obtenerFechaEspecial();
 *   // → null (o el objeto de la fecha especial si hoy es una)
 */

// En tu proyecto Expo, ajusta la ruta según donde pongas el JSON:
// import calendario from '../data/calendario-liturgico.json';
const calendario = require('./calendario-liturgico.json');

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD
 */
function fechaHoy() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Obtiene el tiempo litúrgico para una fecha dada (o hoy por defecto).
 * 
 * @param {string} [fecha] - Fecha en formato YYYY-MM-DD. Si no se pasa, usa hoy.
 * @returns {{ id: string, nombre: string, inicio: string, fin: string } | null}
 */
function obtenerTiempoLiturgico(fecha) {
  const f = fecha || fechaHoy();
  const anio = parseInt(f.substring(0, 4));
  const datos = calendario[anio];

  if (!datos) return null;

  return datos.tiempos.find(t => f >= t.inicio && f <= t.fin) || null;
}

/**
 * Obtiene la fecha especial del día (si la hay).
 * 
 * @param {string} [fecha] - Fecha en formato YYYY-MM-DD.
 * @returns {{ id: string, fecha: string, nombre: string } | null}
 */
function obtenerFechaEspecial(fecha) {
  const f = fecha || fechaHoy();
  const anio = parseInt(f.substring(0, 4));
  const datos = calendario[anio];

  if (!datos) return null;

  return datos.fechas_especiales.find(fe => fe.fecha === f) || null;
}

/**
 * Comprueba si una fecha es domingo de Cuaresma.
 */
function esDomingoCuaresma(fecha) {
  const f = fecha || fechaHoy();
  const anio = parseInt(f.substring(0, 4));
  const datos = calendario[anio];

  if (!datos) return false;

  return datos.domingos_cuaresma.includes(f);
}

/**
 * Comprueba si una fecha es domingo de Adviento.
 */
function esDomingoAdviento(fecha) {
  const f = fecha || fechaHoy();
  const anio = parseInt(f.substring(0, 4));
  const datos = calendario[anio];

  if (!datos) return false;

  return datos.domingos_adviento.includes(f);
}

/**
 * Devuelve los datos completos del año litúrgico.
 */
function obtenerAnioLiturgico(anio) {
  return calendario[anio] || null;
}

/**
 * Devuelve el color litúrgico sugerido para el tiempo actual.
 * (Simplificado — no cubre memorias ni fiestas de santos)
 */
function colorLiturgico(fecha) {
  const f = fecha || fechaHoy();
  const especial = obtenerFechaEspecial(f);
  const tiempo = obtenerTiempoLiturgico(f);

  if (!tiempo) return null;

  // Días específicos con color propio
  if (especial) {
    switch (especial.id) {
      case 'domingo_ramos': return 'rojo';
      case 'viernes_santo': return 'rojo';
      case 'pentecostes': return 'rojo';
      case 'domingo_resurreccion': return 'blanco';
      case 'jueves_santo': return 'blanco';
      case 'navidad': return 'blanco';
      case 'epifania': return 'blanco';
      case 'bautismo_del_senor': return 'blanco';
      case 'santisima_trinidad': return 'blanco';
      case 'corpus_christi_jueves':
      case 'corpus_christi_domingo': return 'blanco';
      case 'ascension_jueves':
      case 'ascension_domingo': return 'blanco';
      case 'cristo_rey': return 'blanco';
      case 'sagrada_familia': return 'blanco';
      case 'santa_maria_madre_de_dios': return 'blanco';
      case 'presentacion_del_senor': return 'blanco';
    }
  }

  // Por tiempo litúrgico
  switch (tiempo.id) {
    case 'adviento': return 'morado';
    case 'navidad': return 'blanco';
    case 'cuaresma': return 'morado';
    case 'semana_santa': return 'morado';
    case 'pascua': return 'blanco';
    case 'ordinario': return 'verde';
    default: return 'verde';
  }
}

// =====================================================
// DEMO: Ejecutar directamente para probar
// =====================================================

if (require.main === module) {
  const hoy = fechaHoy();
  console.log(`📅 Hoy es: ${hoy}`);
  console.log('');

  const tiempo = obtenerTiempoLiturgico();
  console.log(`⛪ Tiempo litúrgico: ${tiempo ? tiempo.nombre : 'Desconocido'}`);
  console.log(`   Desde: ${tiempo?.inicio} hasta: ${tiempo?.fin}`);
  console.log('');

  const especial = obtenerFechaEspecial();
  if (especial) {
    console.log(`🌟 Fecha especial: ${especial.nombre}`);
  } else {
    console.log('📌 No hay fecha especial hoy');
  }

  console.log(`🎨 Color litúrgico: ${colorLiturgico()}`);
  console.log('');

  const anio = new Date().getFullYear();
  const datos = obtenerAnioLiturgico(anio);
  if (datos) {
    console.log(`📊 Ciclo dominical: ${datos.ciclo_dominical}`);
    console.log(`📊 Ciclo ferial: ${datos.ciclo_ferial}`);
  }

  console.log(`\n🔮 ¿Es domingo de Cuaresma? ${esDomingoCuaresma() ? 'Sí' : 'No'}`);
  console.log(`🔮 ¿Es domingo de Adviento? ${esDomingoAdviento() ? 'Sí' : 'No'}`);

  // Próximas fechas especiales
  console.log('\n📋 Próximas fechas especiales:');
  if (datos) {
    const proximas = datos.fechas_especiales.filter(f => f.fecha >= hoy).slice(0, 5);
    for (const f of proximas) {
      console.log(`   ${f.fecha} — ${f.nombre}`);
    }
  }
}

module.exports = {
  obtenerTiempoLiturgico,
  obtenerFechaEspecial,
  esDomingoCuaresma,
  esDomingoAdviento,
  obtenerAnioLiturgico,
  colorLiturgico,
};
