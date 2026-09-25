/* ═════════════════════════════════════════════
   Tests de la Calculadora Térmica RITE.
   Se ejecutan con:  node test/run.js
   Sin dependencias: usan el simulador de DOM de test/dom.js.
═════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const { createDom } = require('./dom');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/* ─── Lectura de los valores por defecto que declara index.html ─────────── */
const html = leer('index.html');

const idsDeHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

function selectsDeHtml(src) {
  const out = {};
  for (const m of src.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const opts = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
    if (!opts.length) { out[m[1]] = ''; continue; }
    const elegido = opts.find(o => /\bselected\b/.test(o[1])) || opts[0];
    const v = /\bvalue="([^"]*)"/.exec(elegido[1]);
    out[m[1]] = v ? v[1] : elegido[2].trim();
  }
  return out;
}
const valoresSelect = selectsDeHtml(html);

/* ─── Montaje del entorno ───────────────────────────────────────────────── */
const dom = createDom(idsDeHtml);
const { document, window, Option, get, preset } = dom;

Object.entries(valoresSelect).forEach(([id, v]) => preset(id, v, true));
for (const m of html.matchAll(/<input\b[^>]*>/g)) {
  const tag = m[0];
  const id = /\bid="([^"]+)"/.exec(tag);
  const tipo = /\btype="([^"]+)"/.exec(tag);
  if (!id || !tipo || tipo[1] !== 'number') continue;
  dom.numericos.add(id[1]);
  const val = /\bvalue="([^"]*)"/.exec(tag);
  preset(id[1], val ? val[1] : '');
}

const fuente = leer('js/data.js') + '\n' + leer('js/app.js');
const API = new Function('document', 'window', 'Option', fuente + `
  return { get S(){return S;}, doCalc, reset, geometry, ventilation, solarDay, pAtm, wFromWb, wFromRh,
           onProv, onUso, onAnio, onPos, onSuelo, onZone, onTempEdit, onAnio, refreshZone, updVent,
           updDerived, updFacades, pickOpt, item, toggleSh, validate, nav, setStep, climate,
           D: () => ({ PROV, ZONAS, ENV, ENV_BY_YEAR, CTE_LIM, USO, IDA, SUELO, HS3, PERFIL_T, SOL, INERCIA, RUMBOS }),
           LIM: () => CTE_LIM, ZW: () => ZW };
`)(document, window, Option);

if (document._ready) document._ready();

/* ─── Marco mínimo de tests ─────────────────────────────────────────────── */
let pasan = 0, fallan = 0;
const fallos = [];
let grupo = '';

const grupoDe = n => { grupo = n; console.log(`\n── ${n}`); };

function test(nombre, fn) {
  try {
    fn();
    pasan++;
    console.log(`   ok   ${nombre}`);
  } catch (e) {
    fallan++;
    fallos.push(`${grupo} · ${nombre}: ${e.message}`);
    console.log(`   FALLA ${nombre}\n         ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'la condición no se cumple'); }
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg ? msg + ': ' : ''}esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
}
function near(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol)) {
    throw new Error(`${msg ? msg + ': ' : ''}esperado ${b} ± ${tol}, obtenido ${typeof a === 'number' ? a.toFixed(3) : a}`);
  }
}

/* ─── Utilidades de escenario ───────────────────────────────────────────── */
const set = (id, v) => { get(id).value = String(v); };
const val = id => get(id).value;
const out = id => get(id).textContent;
const htmlDe = id => get(id).innerHTML;
const numDe = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
const mismoSelect = () => Object.entries(valoresSelect).forEach(([id, v]) => set(id, v));

/** Escenario de partida: vivienda de 120 m2 en Madrid, envolvente post-2019. */
function escenarioMadrid(extra = {}) {
  API.reset();
  mismoSelect();
  set('provincia', get('provincia').options.findIndex(o => o.text === 'Madrid'));
  API.onProv();
  set('anio', 'post19'); set('tipoEdi', 'residencial'); set('vsis', 'ext');
  API.onAnio();
  set('sup', 120); set('npl', 1); set('alt', 2.7); set('giro', 0);
  set('len-N', 12); set('len-E', 10); set('len-S', 12); set('len-W', 10);
  set('pct-N', 10); set('pct-E', 15); set('pct-S', 25); set('pct-W', 15);
  ['N', 'E', 'S', 'W'].forEach(o => { set('int-' + o, 0); set('obs-' + o, 0); });
  set('nper', 4); set('tiW', 21); set('tiS', 25); set('hrS', 50); set('eta', 70);
  Object.entries(extra).forEach(([k, v]) => set(k, v));
  API.updDerived();
}
const cargas = () => ({
  cal: numDe(out('rCalKw')), ref: numDe(out('rRefKw')),
  sens: numDe(/sensible ([\d,]+) kW/.exec(out('rRefWm2'))[1]),
  lat: numDe(/latente ([\d,]+) kW/.exec(out('rRefWm2'))[1])
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('A · datos normativos (js/data.js)');

test('52 provincias', () => eq(API.D().PROV.length, 52));
test('104 estaciones IDAE', () => eq(API.D().PROV.reduce((a, p) => a + p.st.length, 0), 104));
test('ninguna provincia duplicada', () => {
  const n = API.D().PROV.map(p => p.name);
  eq(new Set(n).size, n.length);
});
test('toda tabla de zonas empieza en 0 m (la zona nunca queda vacía)', () => {
  const malas = API.D().PROV.filter(p => p.zones[0][0] !== 0).map(p => p.name);
  eq(malas.join(', '), '');
});
test('todas las zonas usadas tienen fila de límites del CTE', () => {
  const malas = [];
  API.D().PROV.forEach(p => p.zones.forEach(([, z]) => { if (!API.LIM()[z[0]]) malas.push(p.name + ':' + z); }));
  eq(malas.join(', '), '');
});
test('todas las zonas usadas están en la lista de zonas manuales', () => {
  const Z = API.D().ZONAS;
  const malas = [];
  API.D().PROV.forEach(p => p.zones.forEach(([, z]) => { if (!Z.includes(z)) malas.push(p.name + ':' + z); }));
  eq(malas.join(', '), '');
});
test('la envolvente por año apunta a soluciones existentes', () => {
  const malas = [];
  Object.entries(API.D().ENV_BY_YEAR).forEach(([a, d]) => {
    ['muro', 'cub', 'ven'].forEach(t => { if (!API.D().ENV[t].some(x => x.id === d[t])) malas.push(`${a}/${t}=${d[t]}`); });
    if (!API.D().ENV.sue.some(x => x.id === d.sue)) malas.push(`${a}/sue=${d.sue}`);
  });
  eq(malas.join(', '), '');
});
test('las estaciones están completas y son coherentes', () => {
  const malas = [];
  API.D().PROV.forEach(p => p.st.forEach(s => {
    ['h', 'w99', 'w996', 's1', 'wb1', 'tm', 'lat', 'dr'].forEach(f => {
      if (!isFinite(s[f])) malas.push(`${p.name}/${s.name}:${f}`);
    });
    if (s.wb1 > s.s1) malas.push(`${p.name}/${s.name}: húmeda > seca`);
  }));
  eq(malas.join(', '), '');
});
test('el perfil horario de temperatura tiene 24 valores', () => eq(API.D().PERFIL_T.length, 24));
test('el desfase de inercia cabe en un día', () => {
  assert(Math.max(...Object.values(API.D().INERCIA).map(i => i.lag)) <= 24);
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('B · enlaces entre index.html y el código');

test('no hay ningún id consultado que no exista en el HTML ni se genere', () => {
  const rotos = dom.idsRotos();
  eq(rotos.join(', '), '');
});
test('todos los manejadores inline del HTML están definidos', () => {
  const manejadores = new Set([...html.matchAll(/on(?:click|change|input)="([A-Za-z_$][\w$]*)\(/g)].map(m => m[1]));
  const definidos = new Set([...fuente.matchAll(/(?:^|\n)\s*(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/g)]
    .map(m => m[1] || m[2]));
  const faltan = [...manejadores].filter(h => !definidos.has(h));
  eq(faltan.join(', '), '');
});
test('todas las columnas de la tabla de fachadas tienen su campo', () => {
  API.geometry().faces.forEach(f => {
    assert(isFinite(parseFloat(val('len-' + f.id))) || val('len-' + f.id) === '', `len-${f.id}`);
    assert(val('int-' + f.id) !== undefined, `int-${f.id}`);
    assert(val('pct-' + f.id) !== undefined, `pct-${f.id}`);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('C · geometría y muros interiores');

test('sin muro interior, la fachada exterior es la total', () => {
  escenarioMadrid();
  const g = API.geometry();
  near(g.per, 12 + 10 + 12 + 10, 1e-9, 'perímetro exterior');
  near(g.fac, 44 * 2.7, 1e-9, 'superficie de fachada');
  eq(g.perInt, 0);
});

test('el muro interior se descuenta de la fachada exterior', () => {
  escenarioMadrid({ 'int-S': 4 });
  const g = API.geometry();
  near(g.perExt !== undefined ? g.perExt : g.per, 40, 1e-9, 'perímetro exterior');
  near(g.perInt, 4, 1e-9, 'perímetro interior');
  near(g.perTot, 44, 1e-9, 'perímetro total');
  near(g.facadeInt, 4 * 2.7, 1e-9, 'superficie no expuesta');
  const s = g.faces.find(f => f.id === 'S');
  near(s.lenExt, 8, 1e-9, 'longitud exterior de la fachada S');
  near(s.fac, 8 * 2.7, 1e-9, 'superficie exterior de la fachada S');
});

test('el acristalamiento se calcula sobre el muro exterior, no sobre el total', () => {
  escenarioMadrid({ 'int-S': 4, 'pct-S': 50 });
  const s = API.geometry().faces.find(f => f.id === 'S');
  near(s.win, 8 * 2.7 * 0.5, 1e-9, 'ventanas de la fachada S');
  near(s.wall, 8 * 2.7 * 0.5, 1e-9, 'muro ciego de la fachada S');
});

test('un muro enteramente interior no aporta perímetro exterior', () => {
  escenarioMadrid({ 'len-W': 10, 'int-W': 10 });
  const g = API.geometry();
  near(g.per, 34, 1e-9, 'perímetro exterior');
  const w = g.faces.find(f => f.id === 'W');
  eq(w.fac, 0);
  eq(w.win, 0);
  eq(w.wall, 0);
});

test('el muro interior no puede superar la longitud total', () => {
  escenarioMadrid({ 'int-S': 20 });
  eq(API.validate(2), false, 'debe fallar la validación');
  assert(get('e-per').classList.contains('show'), 'debe mostrarse el aviso de fachadas');
  escenarioMadrid({ 'int-S': 12 });
  eq(API.validate(2), true, 'con int = len debe pasar');
});

test('el resumen geométrico menciona el muro interior', () => {
  escenarioMadrid({ 'int-N': 5 });
  assert(/Muro interior o medianera/.test(htmlDe('derivedTxt')), 'el resumen no lo menciona');
  assert(/5,0 m/.test(htmlDe('derivedTxt')), `no aparece la longitud: ${htmlDe('derivedTxt').slice(0, 200)}`);
});
test('el porcentaje de acristalamiento se limita al 90 % del muro exterior', () => {
  escenarioMadrid({ 'pct-S': 90, 'int-S': 2 });
  const s = API.geometry().faces.find(f => f.id === 'S');
  near(s.win / s.fac, 0.9, 1e-9);
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('D · cálculo de cargas (regresión)');

const ESPERADO_ENVOLVENTE = { pre1980: 16.75, '80_00': 7.26, '00_13': 5.37, '13_19': 4.04, post19: 3.20 };

Object.entries(ESPERADO_ENVOLVENTE).forEach(([anio, esperado]) => {
  test(`calefacción de la envolvente ${anio} = ${esperado} kW`, () => {
    escenarioMadrid();
    set('anio', anio);
    API.onAnio();
    set('estanq', API.D().ENV_BY_YEAR[anio].inf);
    API.doCalc();
    near(numDe(out('rCalKw')), esperado, 0.005, 'calefacción');
  });
});

test('declarar muro interior reduce la carga de calefacción', () => {
  escenarioMadrid();
  API.doCalc();
  const sinInterior = numDe(out('rCalKw'));
  escenarioMadrid({ 'int-S': 6, 'int-N': 6 });
  API.doCalc();
  const conInterior = numDe(out('rCalKw'));
  assert(conInterior < sinInterior, `no baja: ${conInterior} vs ${sinInterior}`);
  const conductividad = numDe(/Muros exteriores<\/div>[\s\S]*?bk-kw">([\d.,]+)/.exec(get('heatBk').innerHTML)[1]);
  assert(conductividad >= 0, 'partida de muros negativa');
});

test('un edificio sin fachada exterior no valida', () => {
  escenarioMadrid();
  API.doCalc();
  const base = numDe(out('rCalKw'));
  assert(base > 0, 'la base debe tener carga');
  escenarioMadrid({ 'int-N': 12, 'int-S': 12, 'int-E': 10, 'int-W': 10 });
  eq(API.geometry().per, 0, 'perímetro exterior');
  eq(API.validate(2), false, 'sin muro exterior no debe validar');
});

test('sin muro interior los resultados son los de siempre', () => {
  escenarioMadrid({ 'int-N': 0, 'int-S': 0 });
  API.doCalc();
  near(numDe(out('rCalKw')), 3.20, 0.005);
  near(numDe(out('rRefKw')), 5.34, 0.005);
});

test('el recuperador reduce calefacción y refrigeración', () => {
  escenarioMadrid(); API.doCalc();
  const sin = cargas();
  escenarioMadrid(); set('vsis', 'rec'); set('eta', 70); API.doCalc();
  const con = cargas();
  assert(con.cal < sin.cal, `calefacción no baja: ${con.cal} vs ${sin.cal}`);
  assert(con.ref < sin.ref, `refrigeración no baja: ${con.ref} vs ${sin.ref}`);
  eq(con.lat, sin.lat, 'la carga latente no debe cambiar con un recuperador sensible');
});

test('la eficiencia del recuperador influye en todo su rango y nunca empeora', () => {
  const valores = [0, 50, 70, 90, 95].map(e => {
    escenarioMadrid(); set('vsis', 'rec'); set('eta', e); API.doCalc();
    return numDe(out('rCalKw'));
  });
  eq(new Set(valores).size, valores.length, `la eficiencia no influye: ${valores.join(' / ')}`);
  for (let i = 1; i < valores.length; i++) {
    assert(valores[i] <= valores[i - 1] + 1e-9, `no es monótona: ${valores.join(' / ')}`);
  }
  escenarioMadrid(); API.doCalc();
  const sinRec = numDe(out('rCalKw'));
  assert(Math.min(...valores) < sinRec, 'ninguna eficiencia mejora el caso sin recuperador');
});

test('el desglose de refrigeración suma el total', () => {
  escenarioMadrid({ 'int-S': 4 });
  API.doCalc();
  const html = get('coolBk').innerHTML;
  const total = numDe(/bk-total[\s\S]*?bk-kw">([\d.,]+)/.exec(html)[1]);
  const suma = [...html.matchAll(/bk-name">([^<]+)<[\s\S]*?bk-kw">(−?[\d.,]+) kW/g)]
    .filter(([n]) => !n.includes('Total'))
    .reduce((a, m) => a + numDe(m[2].replace('\u2212', '-')), 0);
  near(suma, total, 0.02, 'suma del desglose');
});

test('los caudales de ventilación por uso son los de la norma', () => {
  escenarioMadrid();
  const v = API.ventilation();
  near(v.qv, 33, 1e-9, 'DB-HS3 para 3 dormitorios (33 l/s)');
  escenarioMadrid({ tipoEdi: 'oficinas', nper: 4 });
  set('tipoEdi', 'oficinas'); set('ida', 'IDA2'); set('nper', 4);
  API.updVent();
  near(API.ventilation().qv, 4 * 12.5, 1e-9, 'RITE IDA 2 = 12,5 l/s por persona');
});

test('el aviso de recuperación obligatoria salta por encima de 0,5 m³/s', () => {
  escenarioMadrid({ nviv: 1 });
  API.updVent();
  assert(get('recWarn').classList.contains('hidden'), 'no debe avisar con 1 vivienda');
  set('nviv', 999);
  API.updVent();
  assert(!get('recWarn').classList.contains('hidden'), 'debe avisar con 999 viviendas');
});

test('los puentes térmicos suponen el 10 % de la transmisión', () => {
  escenarioMadrid();
  API.doCalc();
  const hueco = nombre => {
    const m = new RegExp(nombre + '[\\s\\S]*?bk-kw">([\\d.,]+) kW').exec(get('heatBk').innerHTML);
    return m ? numDe(m[1]) : 0;
  };
  const total = numDe(out('rCalKw'));
  const aire = hueco('Aire exterior');
  const puentes = hueco('Puentes t');
  near(puentes, (total - aire - puentes) * 0.1, 0.02, 'puentes = 10 % de la transmisión');
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('E · zona climática y CTE');

test('la zona climática sale de la provincia y la altitud', () => {
  escenarioMadrid();
  API.refreshZone();
  eq(API.S.zone, 'D3', 'Madrid capital a 655 m');
  set('alti', 1200); API.onSite ? API.onSite() : API.refreshZone(); API.refreshZone();
  eq(API.S.zone, 'E1', 'Madrid a 1.200 m');
});

test('Canarias usa la zona alfa', () => {
  API.reset(); mismoSelect();
  set('provincia', get('provincia').options.findIndex(o => o.text === 'Santa Cruz de Tenerife'));
  API.onProv(); API.refreshZone();
  eq(API.S.zone, 'α3');
  assert(API.ZW()['α'], 'falta el nombre de la zona alfa');
});

test('Ceuta no tiene estación y pide las temperaturas a mano', () => {
  API.reset(); mismoSelect();
  set('provincia', get('provincia').options.findIndex(o => o.text === 'Ceuta'));
  API.onProv();
  eq(get('estacion').disabled, true);
  assert(/IDAE/.test(out('tempsNote')), 'no avisa de la ausencia de estación');
  eq(API.validate(1), false, 'sin temperaturas no debe validar');
});

test('un edificio que cumple el CTE no marca ningún incumplimiento', () => {
  escenarioMadrid();
  API.pickOpt('muro', 'm4'); API.pickOpt('cub', 'c3'); API.pickOpt('sue', 's2'); API.pickOpt('ven', 'v4');
  API.doCalc();
  const tabla = get('resCte').innerHTML;
  assert(!/No cumple/.test(tabla), `marca incumplimiento con envolvente Passivhaus: ${tabla}`);
});

test('un edificio sin aislamiento incumple el CTE en todos los elementos', () => {
  escenarioMadrid();
  API.pickOpt('muro', 'm0'); API.pickOpt('cub', 'c0'); API.pickOpt('sue', 's0'); API.pickOpt('ven', 'v0');
  API.doCalc();
  const tabla = get('resCte').innerHTML;
  eq((tabla.match(/No cumple/g) || []).length, 4, 'deben incumplir los cuatro elementos');
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('F · psicrometría y radiación solar');

test('la presión atmosférica baja con la altitud', () => {
  near(API.pAtm(0), 101325, 5, 'nivel del mar');
  near(API.pAtm(655), 93700, 600, 'Madrid');
  assert(API.pAtm(2000) < API.pAtm(0));
});

test('el par seco/húmedo y la humedad específica son coherentes', () => {
  const P = API.pAtm(655);
  const w = API.wFromRh(24, 0.6, P);
  near(w * 1000, 12.11, 0.1, '24 °C y 60 % HR');
  const wb = API.wFromWb(32.7, 19.82, P);
  near(wb * 1000, 10.35, 0.15, '32,7 °C y twb 19,82 °C = 31 % HR');
});

test('el sol culmina al mediodía y no radia de noche', () => {
  const caras = [{ id: 'S', az: 180, obs: 0 }, { id: 'N', az: 0, obs: 0 }];
  const dia = API.solarDay(40.4, caras);
  eq(dia.length, 24);
  const sur = dia.map(h => h.faces.S.opaque);
  const pico = sur.indexOf(Math.max(...sur)) + 1;
  assert(pico >= 11 && pico <= 14, `el pico de la fachada sur es a las ${pico} h`);
  assert(dia[1].roof === 0 && dia[23].roof === 0, 'hay radiación solar de noche');
  eq(dia[14].roof > dia[6].roof, true, 'la cubierta debe radiar más a las 14 que a las 6');
});

test('la obstrucción reduce la radiación directa', () => {
  const libre = API.solarDay(40.4, [{ id: 'S', az: 180, obs: 0 }])[12].faces.S.opaque;
  const tapado = API.solarDay(40.4, [{ id: 'S', az: 180, obs: 60 }])[12].faces.S.opaque;
  assert(tapado < libre, `la obstrucción no reduce la radiación: ${tapado} vs ${libre}`);
});

/* ═══════════════════════════════════════════════════════════════════════ */
console.log(`\n${'─'.repeat(60)}`);
console.log(`${pasan} correctos, ${fallan} fallidos`);
if (fallan) {
  console.log('\nFallos:');
  fallos.forEach(f => console.log('  · ' + f));
}
process.exit(fallan ? 1 : 0);
