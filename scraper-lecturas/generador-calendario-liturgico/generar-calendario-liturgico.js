/**
 * =============================================================
 * GENERADOR DE CALENDARIO LITÚRGICO - MCMApp
 * Genera JSON estático con todos los tiempos litúrgicos
 * y fechas especiales del año 2025 al 2100
 * =============================================================
 * 
 * Fuentes de las reglas:
 * - Computus (algoritmo gregoriano de Pascua)
 * - divvol.org/recursos/fecha_adviento.htm
 * - divvol.org/recursos/fecha_pascua.htm
 * - Normas generales del calendario litúrgico romano
 * 
 * Configurado para ESPAÑA:
 * - Epifanía siempre el 6 de enero
 * - Ascensión trasladada al domingo (en la mayoría de diócesis)
 * - Corpus Christi el jueves (festivo en muchas CCAA)
 */

const fs = require('fs');

// =====================================================
// UTILIDADES DE FECHA
// =====================================================

function formatoFecha(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sumarDias(date, dias) {
  const nueva = new Date(date);
  nueva.setDate(nueva.getDate() + dias);
  return nueva;
}

function diaSemana(date) {
  return date.getDay(); // 0=domingo, 6=sábado
}

function siguienteDomingo(date) {
  const d = new Date(date);
  const dia = d.getDay();
  if (dia === 0) return d; // ya es domingo
  d.setDate(d.getDate() + (7 - dia));
  return d;
}

function domingoSiguienteEstricto(date) {
  // El siguiente domingo DESPUÉS de la fecha (no incluye la misma fecha)
  const d = new Date(date);
  const dia = d.getDay();
  const diasHastaDomingo = dia === 0 ? 7 : (7 - dia);
  d.setDate(d.getDate() + diasHastaDomingo);
  return d;
}

// =====================================================
// CÁLCULO DE PASCUA (Computus - Algoritmo Gregoriano)
// =====================================================

function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

// =====================================================
// FECHAS DERIVADAS DE PASCUA
// =====================================================

function miercolesCeniza(pascua) {
  return sumarDias(pascua, -46);
}

function domingoRamos(pascua) {
  return sumarDias(pascua, -7);
}

function lunesSanto(pascua) {
  return sumarDias(pascua, -6);
}

function martesSanto(pascua) {
  return sumarDias(pascua, -5);
}

function miercolesSanto(pascua) {
  return sumarDias(pascua, -4);
}

function juevesSanto(pascua) {
  return sumarDias(pascua, -3);
}

function viernesSanto(pascua) {
  return sumarDias(pascua, -2);
}

function sabadoSanto(pascua) {
  return sumarDias(pascua, -1);
}

function ascensionJueves(pascua) {
  // 40 días después de Pascua = Pascua + 39 (Pascua es día 1)
  return sumarDias(pascua, 39);
}

function ascensionDomingo(pascua) {
  // Trasladada al domingo siguiente (7º domingo de Pascua)
  return sumarDias(pascua, 42);
}

function pentecostes(pascua) {
  // 50 días después de Pascua = Pascua + 49
  return sumarDias(pascua, 49);
}

function santisimaTrinidad(pascua) {
  // Domingo siguiente a Pentecostés
  return sumarDias(pascua, 56);
}

function corpusChristiJueves(pascua) {
  // Jueves después de la Santísima Trinidad
  return sumarDias(pascua, 60);
}

function corpusChristiDomingo(pascua) {
  // Donde no es precepto: domingo después de la Santísima Trinidad
  return sumarDias(pascua, 63);
}

// =====================================================
// FECHAS DE ADVIENTO Y NAVIDAD
// =====================================================

function primerDomingoAdviento(anio) {
  // El domingo más cercano al 30 de noviembre
  // que cae entre el 27 de noviembre y el 3 de diciembre
  const nov27 = new Date(anio, 10, 27); // 27 noviembre
  const dia = nov27.getDay();
  const diasHastaDomingo = dia === 0 ? 0 : (7 - dia);
  return new Date(anio, 10, 27 + diasHastaDomingo);
}

function domingoAdviento(anio, numero) {
  // numero: 1, 2, 3 o 4
  const primero = primerDomingoAdviento(anio);
  return sumarDias(primero, (numero - 1) * 7);
}

function sagradaFamilia(anio) {
  // Domingo siguiente a Navidad (entre 26 y 31 dic)
  // Si Navidad (25 dic) es domingo → 30 de diciembre
  const navidad = new Date(anio, 11, 25);
  const diaSem = navidad.getDay();

  if (diaSem === 0) {
    // Navidad es domingo → Sagrada Familia el 30 de diciembre
    return new Date(anio, 11, 30);
  }

  // Siguiente domingo después del 25
  return domingoSiguienteEstricto(navidad);
}

function bautismoDelSenor(anio) {
  // En España, Epifanía es el 6 de enero (fijo)
  const epifania = new Date(anio, 0, 6);
  const diaSem = epifania.getDay();

  if (diaSem === 0) {
    // Epifanía es domingo → Bautismo el lunes 7 de enero
    return new Date(anio, 0, 7);
  }

  // Siguiente domingo después del 6 de enero
  return domingoSiguienteEstricto(epifania);
}

// =====================================================
// DOMINGOS DE CUARESMA
// =====================================================

function domingosCuaresma(pascua) {
  // 5 domingos de Cuaresma (sin contar Domingo de Ramos que es el 6º)
  // 1er domingo = Ceniza + 4 días = Pascua - 42
  const domingos = [];
  for (let i = 0; i < 5; i++) {
    domingos.push(formatoFecha(sumarDias(pascua, -42 + i * 7)));
  }
  return domingos;
}

// =====================================================
// CICLO LITÚRGICO
// =====================================================

function cicloDominical(anio) {
  // Año A: anio % 3 === 1 (2023, 2026, 2029...)
  // Año B: anio % 3 === 2 (2024, 2027, 2030...)
  // Año C: anio % 3 === 0 (2025, 2028, 2031...)
  const resto = anio % 3;
  if (resto === 1) return 'A';
  if (resto === 2) return 'B';
  return 'C';
}

function cicloFerial(anio) {
  return anio % 2 === 0 ? 'II' : 'I';
}

// =====================================================
// GENERAR DATOS DE UN AÑO CIVIL
// =====================================================

function generarAnio(anio) {
  const pascua = calcularPascua(anio);

  // --- Fechas clave ---
  const ceniza = miercolesCeniza(pascua);
  const ramos = domingoRamos(pascua);
  const bautismo = bautismoDelSenor(anio);
  const adviento1 = primerDomingoAdviento(anio);
  const cristoRey = sumarDias(adviento1, -7);
  const pente = pentecostes(pascua);

  // --- Tiempos litúrgicos (cubren todo el año civil) ---
  const tiempos = [];

  // 1. Navidad (viene del 25 dic del año anterior, acaba con Bautismo)
  tiempos.push({
    id: 'navidad',
    nombre: 'Tiempo de Navidad',
    inicio: formatoFecha(new Date(anio - 1, 11, 25)),
    fin: formatoFecha(bautismo)
  });

  // 2. Tiempo Ordinario I (del día después del Bautismo hasta víspera de Ceniza)
  const inicioOrd1 = sumarDias(bautismo, 1);
  const finOrd1 = sumarDias(ceniza, -1);
  if (inicioOrd1 <= finOrd1) {
    tiempos.push({
      id: 'ordinario',
      nombre: 'Tiempo Ordinario',
      inicio: formatoFecha(inicioOrd1),
      fin: formatoFecha(finOrd1)
    });
  }

  // 3. Cuaresma (Miércoles de Ceniza hasta el sábado antes de Ramos)
  tiempos.push({
    id: 'cuaresma',
    nombre: 'Cuaresma',
    inicio: formatoFecha(ceniza),
    fin: formatoFecha(sumarDias(ramos, -1))
  });

  // 4. Semana Santa (Domingo de Ramos hasta Sábado Santo)
  tiempos.push({
    id: 'semana_santa',
    nombre: 'Semana Santa',
    inicio: formatoFecha(ramos),
    fin: formatoFecha(sabadoSanto(pascua))
  });

  // 5. Tiempo de Pascua (Domingo de Resurrección hasta Pentecostés)
  tiempos.push({
    id: 'pascua',
    nombre: 'Tiempo de Pascua',
    inicio: formatoFecha(pascua),
    fin: formatoFecha(pente)
  });

  // 6. Tiempo Ordinario II (día después de Pentecostés hasta sábado antes de Adviento)
  tiempos.push({
    id: 'ordinario',
    nombre: 'Tiempo Ordinario',
    inicio: formatoFecha(sumarDias(pente, 1)),
    fin: formatoFecha(sumarDias(adviento1, -1))
  });

  // 7. Adviento (1er domingo de Adviento hasta 24 de diciembre)
  tiempos.push({
    id: 'adviento',
    nombre: 'Adviento',
    inicio: formatoFecha(adviento1),
    fin: formatoFecha(new Date(anio, 11, 24))
  });

  // 8. Navidad (25 dic de este año, acaba con Bautismo del año siguiente)
  const bautismoSiguiente = bautismoDelSenor(anio + 1);
  tiempos.push({
    id: 'navidad',
    nombre: 'Tiempo de Navidad',
    inicio: formatoFecha(new Date(anio, 11, 25)),
    fin: formatoFecha(bautismoSiguiente)
  });

  // --- Fechas especiales ---
  const fechas = [];

  // Tiempo de Navidad (principio del año)
  fechas.push({
    id: 'santa_maria_madre_de_dios',
    fecha: `${anio}-01-01`,
    nombre: 'Santa María Madre de Dios'
  });

  fechas.push({
    id: 'epifania',
    fecha: `${anio}-01-06`,
    nombre: 'Epifanía del Señor'
  });

  fechas.push({
    id: 'bautismo_del_senor',
    fecha: formatoFecha(bautismo),
    nombre: 'Bautismo del Señor'
  });

  const sf = sagradaFamilia(anio - 1); // La Sagrada Familia del año anterior (cae en dic del año anterior o principios de este)
  // Solo incluirla si cae en enero de este año (raro, solo si Navidad es lunes → SF = 31 dic, no cae en enero)
  // En realidad, la Sagrada Familia siempre cae entre el 26 y 31 de diciembre
  // Así que la incluyo como parte del año anterior
  // PERO necesito incluir la Sagrada Familia de ESTE diciembre
  const sfEsteAnio = sagradaFamilia(anio);
  fechas.push({
    id: 'sagrada_familia',
    fecha: formatoFecha(sfEsteAnio),
    nombre: 'Sagrada Familia'
  });

  // Cuaresma
  fechas.push({
    id: 'miercoles_ceniza',
    fecha: formatoFecha(ceniza),
    nombre: 'Miércoles de Ceniza'
  });

  // Semana Santa
  fechas.push({
    id: 'domingo_ramos',
    fecha: formatoFecha(ramos),
    nombre: 'Domingo de Ramos'
  });

  fechas.push({
    id: 'lunes_santo',
    fecha: formatoFecha(lunesSanto(pascua)),
    nombre: 'Lunes Santo'
  });

  fechas.push({
    id: 'martes_santo',
    fecha: formatoFecha(martesSanto(pascua)),
    nombre: 'Martes Santo'
  });

  fechas.push({
    id: 'miercoles_santo',
    fecha: formatoFecha(miercolesSanto(pascua)),
    nombre: 'Miércoles Santo'
  });

  fechas.push({
    id: 'jueves_santo',
    fecha: formatoFecha(juevesSanto(pascua)),
    nombre: 'Jueves Santo'
  });

  fechas.push({
    id: 'viernes_santo',
    fecha: formatoFecha(viernesSanto(pascua)),
    nombre: 'Viernes Santo'
  });

  fechas.push({
    id: 'sabado_santo',
    fecha: formatoFecha(sabadoSanto(pascua)),
    nombre: 'Sábado Santo'
  });

  fechas.push({
    id: 'domingo_resurreccion',
    fecha: formatoFecha(pascua),
    nombre: 'Domingo de Resurrección'
  });

  // Post-Pascua
  fechas.push({
    id: 'ascension_jueves',
    fecha: formatoFecha(ascensionJueves(pascua)),
    nombre: 'Ascensión del Señor (jueves)'
  });

  fechas.push({
    id: 'ascension_domingo',
    fecha: formatoFecha(ascensionDomingo(pascua)),
    nombre: 'Ascensión del Señor (domingo)'
  });

  fechas.push({
    id: 'pentecostes',
    fecha: formatoFecha(pente),
    nombre: 'Pentecostés'
  });

  fechas.push({
    id: 'santisima_trinidad',
    fecha: formatoFecha(santisimaTrinidad(pascua)),
    nombre: 'Santísima Trinidad'
  });

  fechas.push({
    id: 'corpus_christi_jueves',
    fecha: formatoFecha(corpusChristiJueves(pascua)),
    nombre: 'Corpus Christi (jueves)'
  });

  fechas.push({
    id: 'corpus_christi_domingo',
    fecha: formatoFecha(corpusChristiDomingo(pascua)),
    nombre: 'Corpus Christi (domingo)'
  });

  // Fin del año litúrgico
  fechas.push({
    id: 'cristo_rey',
    fecha: formatoFecha(cristoRey),
    nombre: 'Cristo Rey'
  });

  // Presentación del Señor / Purificación (2 de febrero - fija)
  fechas.push({
    id: 'presentacion_del_senor',
    fecha: `${anio}-02-02`,
    nombre: 'Presentación del Señor (La Candelaria)'
  });

  // Navidad (25 dic)
  fechas.push({
    id: 'navidad',
    fecha: `${anio}-12-25`,
    nombre: 'Natividad del Señor'
  });

  // Ordenar fechas cronológicamente
  fechas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // --- Domingos especiales ---
  const domAdviento = [1, 2, 3, 4].map(n => formatoFecha(domingoAdviento(anio, n)));
  const domCuaresma = domingosCuaresma(pascua);

  return {
    pascua: formatoFecha(pascua),
    ciclo_dominical: cicloDominical(anio),
    ciclo_ferial: cicloFerial(anio),
    tiempos: tiempos,
    fechas_especiales: fechas,
    domingos_adviento: domAdviento,
    domingos_cuaresma: domCuaresma
  };
}

// =====================================================
// GENERAR CALENDARIO COMPLETO 2025-2100
// =====================================================

function generarCalendarioCompleto() {
  const calendario = {};

  for (let anio = 2025; anio <= 2100; anio++) {
    calendario[anio] = generarAnio(anio);
  }

  return calendario;
}

// =====================================================
// VALIDACIÓN: Comparar con fechas conocidas
// =====================================================

function validar() {
  console.log('🔍 Validando fechas conocidas...\n');

  const casosConocidos = [
    { anio: 2025, pascua: '2025-04-20', ceniza: '2025-03-05' },
    { anio: 2026, pascua: '2026-04-05', ceniza: '2026-02-18' },
    { anio: 2027, pascua: '2027-03-28', ceniza: '2027-02-10' },
    { anio: 2028, pascua: '2028-04-16', ceniza: '2028-03-01' },
    { anio: 2029, pascua: '2029-04-01', ceniza: '2029-02-14' },
    { anio: 2030, pascua: '2030-04-21', ceniza: '2030-03-06' },
  ];

  let todoBien = true;

  for (const caso of casosConocidos) {
    const p = calcularPascua(caso.anio);
    const c = miercolesCeniza(p);
    const pStr = formatoFecha(p);
    const cStr = formatoFecha(c);

    const okP = pStr === caso.pascua;
    const okC = cStr === caso.ceniza;

    console.log(`  ${caso.anio}: Pascua ${pStr} ${okP ? '✅' : '❌ (esperado: ' + caso.pascua + ')'}`);
    console.log(`  ${caso.anio}: Ceniza ${cStr} ${okC ? '✅' : '❌ (esperado: ' + caso.ceniza + ')'}`);

    if (!okP || !okC) todoBien = false;
  }

  // Validar Sagrada Familia
  console.log('\n  Sagrada Familia:');
  // 2025: Navidad 25 dic (jueves) → SF = domingo 28 dic
  const sf2025 = sagradaFamilia(2025);
  console.log(`  2025: ${formatoFecha(sf2025)} (esperado: 2025-12-28, Navidad=jueves) ${formatoFecha(sf2025) === '2025-12-28' ? '✅' : '❌'}`);

  // 2022: Navidad 25 dic (domingo) → SF = 30 dic
  const sf2022 = sagradaFamilia(2022);
  console.log(`  2022: ${formatoFecha(sf2022)} (esperado: 2022-12-30, Navidad=domingo) ${formatoFecha(sf2022) === '2022-12-30' ? '✅' : '❌'}`);

  // Validar 1er domingo de Adviento
  console.log('\n  Primer Domingo de Adviento:');
  const adv2025 = primerDomingoAdviento(2025);
  console.log(`  2025: ${formatoFecha(adv2025)} (esperado: 2025-11-30) ${formatoFecha(adv2025) === '2025-11-30' ? '✅' : '❌'}`);
  const adv2026 = primerDomingoAdviento(2026);
  console.log(`  2026: ${formatoFecha(adv2026)} (esperado: 2026-11-29) ${formatoFecha(adv2026) === '2026-11-29' ? '✅' : '❌'}`);

  // Validar Bautismo del Señor
  console.log('\n  Bautismo del Señor:');
  const baut2025 = bautismoDelSenor(2025);
  console.log(`  2025: ${formatoFecha(baut2025)} (6 ene=lunes → domingo 12) ${formatoFecha(baut2025) === '2025-01-12' ? '✅' : '❌'}`);
  const baut2028 = bautismoDelSenor(2028);
  console.log(`  2028: ${formatoFecha(baut2028)} (6 ene=jueves → domingo 9) ${formatoFecha(baut2028) === '2028-01-09' ? '✅' : '❌'}`);

  // Ciclo litúrgico
  console.log('\n  Ciclos litúrgicos:');
  console.log(`  2025: ${cicloDominical(2025)} (esperado: C) ${cicloDominical(2025) === 'C' ? '✅' : '❌'}`);
  console.log(`  2026: ${cicloDominical(2026)} (esperado: A) ${cicloDominical(2026) === 'A' ? '✅' : '❌'}`);
  console.log(`  2027: ${cicloDominical(2027)} (esperado: B) ${cicloDominical(2027) === 'B' ? '✅' : '❌'}`);

  console.log('\n' + (todoBien ? '✅ Todas las validaciones OK' : '❌ Hay errores en las validaciones'));
  return todoBien;
}

// =====================================================
// EJECUCIÓN
// =====================================================

console.log('📅 Generador de Calendario Litúrgico MCMApp');
console.log('==========================================\n');

// 1. Validar
const ok = validar();

if (!ok) {
  console.error('\n⛔ Abortando: hay errores en la validación');
  process.exit(1);
}

// 2. Generar
console.log('\n🔨 Generando calendario 2025-2100...');
const calendario = generarCalendarioCompleto();

// 3. Guardar
const json = JSON.stringify(calendario, null, 2);
const ruta = '/home/claude/calendario-liturgico.json';
fs.writeFileSync(ruta, json, 'utf-8');

const tamKB = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);
console.log(`\n✅ Generado: ${ruta}`);
console.log(`📦 Tamaño: ${tamKB} KB`);
console.log(`📆 Años: 2025 - 2100 (${Object.keys(calendario).length} años)`);

// 4. Mostrar ejemplo
console.log('\n📋 Ejemplo - Año 2026:');
console.log(JSON.stringify(calendario['2026'], null, 2));
