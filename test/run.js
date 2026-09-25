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
           setBase, quitarBase, renderCmp, parametros, diffParametros, kLimite,
           D: () => ({ PROV, ZONAS, ENV, ENV_BY_YEAR, CTE_LIM, USO, IDA, SUELO, HS3, PERFIL_T, SOL, INERCIA, RUMBOS, K_LIM }),
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
test('el HTML no tiene etiquetas sin cerrar ni mal anidadas', () => {
  const src = html.replace(/<!--[\s\S]*?-->/g, '');
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr', 'path', 'rect', 'circle', 'stop', 'use', 'polygon', 'line', 'polyline', 'ellipse']);
  const pila = [], errores = [];
  for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[4]) continue;
    if (!m[1]) pila.push(name);
    else {
      if (!pila.length) { errores.push(`</${name}> sobra`); continue; }
      const abierta = pila.pop();
      if (abierta !== name) errores.push(`<${abierta}> cerrada por </${name}>`);
    }
  }
  pila.forEach(t => errores.push(`<${t}> sin cerrar`));
  eq(errores.join('; '), '');
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
grupoDe('G · comparación con la línea base');

test('sin línea base la tarjeta está oculta', () => {
  escenarioMadrid();
  API.doCalc();
  eq(API.S.base, null, 'no debe haber línea base');
  assert(get('cmpCard').classList.contains('hidden'), 'la tarjeta debe estar oculta');
});

test('fijar la línea base la muestra y no inventa diferencias', () => {
  escenarioMadrid();
  API.doCalc();
  API.setBase();
  assert(!get('cmpCard').classList.contains('hidden'), 'la tarjeta debe mostrarse');
  assert(/No ha cambiado ningún dato/.test(htmlDe('cmpDiff')), 'no debe haber datos modificados');
});

test('el efecto de una medida de mejora se calcula y se colorea', () => {
  escenarioMadrid({ anio: 'pre1980' });
  set('anio', 'pre1980'); API.onAnio(); set('estanq', '0.80');
  API.doCalc();
  API.setBase();
  const baseCal = API.S.base.r.Qcal, baseRef = API.S.base.r.Qref;

  // medida: cambiar la envolvente por una de obra nueva
  set('anio', 'post19'); API.onAnio(); set('estanq', '0.30');
  API.doCalc();
  const ahoraCal = API.S.last.Qcal, ahoraRef = API.S.last.Qref;

  assert(ahoraCal < baseCal, `la calefacción debe bajar: ${ahoraCal} vs ${baseCal}`);
  assert(ahoraRef < baseRef, `la refrigeración debe bajar: ${ahoraRef} vs ${baseRef}`);
  assert(/cmp-mejora/.test(htmlDe('cmpTable')), 'las mejoras deben marcarse en verde');
  assert(!/cmp-empeora/.test(htmlDe('cmpTable')), 'no debería haber empeoramientos');

  // el porcentaje mostrado debe coincidir con el calculado
  const pct = (baseCal - ahoraCal) / baseCal * 100;
  const esperado = pct.toFixed(1).replace('.', ',');
  assert(htmlDe('cmpTable').includes(esperado), `no aparece el porcentaje ${esperado} % en la tabla`);
});

test('la tabla de la línea base conserva los valores de partida', () => {
  escenarioMadrid({ anio: 'pre1980' });
  set('anio', 'pre1980'); API.onAnio(); set('estanq', '0.80');
  API.doCalc();
  const baseCal = API.S.last.Qcal / 1000;
  API.setBase();
  set('anio', 'post19'); API.onAnio(); API.doCalc();
  const texto = baseCal.toFixed(2).replace('.', ',');
  assert(htmlDe('cmpTable').includes(texto), `la tabla no muestra el valor de la línea base ${texto}`);
});

test('los datos modificados se listan', () => {
  escenarioMadrid();
  API.doCalc();
  API.setBase();
  set('pct-S', 60);
  set('int-N', 4);
  API.doCalc();
  const d = htmlDe('cmpDiff');
  assert(/Datos que han cambiado/.test(d), 'no aparece el bloque');
  assert(/Acristalamiento Sur/.test(d), 'no detecta el cambio de acristalamiento');
  assert(/Muro interior o medianera Norte/.test(d), 'no detecta el muro interior');
});

test('la detección de cambios funciona también con cambios de solución', () => {
  escenarioMadrid();
  API.doCalc();
  API.setBase();
  const antes = API.parametros();
  API.pickOpt('muro', 'm0');
  const despues = API.parametros();
  const camb = API.diffParametros(antes, despues);
  eq(camb.length, 1, 'solo debe cambiar el muro');
  eq(camb[0].etiqueta, 'Muro exterior');
  eq(camb[0].ahora[1], 'Sin aislamiento');
});

test('la línea base sobrevive al botón de nuevo cálculo', () => {
  escenarioMadrid();
  API.doCalc();
  API.setBase();
  API.reset();
  assert(API.S.base !== null, 'la línea base no debe borrarse');
  eq(API.S.last, null, 'el último cálculo sí se borra');
});

test('quitar la línea base oculta la tarjeta', () => {
  escenarioMadrid();
  API.doCalc();
  API.setBase();
  assert(!get('cmpCard').classList.contains('hidden'));
  API.quitarBase();
  assert(get('cmpCard').classList.contains('hidden'), 'debe ocultarse');
  eq(API.S.base, null);
});

test('la línea base se puede volver a fijar sobre el cálculo nuevo', () => {
  escenarioMadrid({ anio: 'pre1980' });
  set('anio', 'pre1980'); API.onAnio(); set('estanq', '0.80'); API.doCalc();
  API.setBase();
  const primera = API.S.base.r.Qcal;
  set('anio', 'post19'); API.onAnio(); set('estanq', '0.30'); API.doCalc();
  API.setBase();
  assert(API.S.base.r.Qcal < primera, 'la nueva línea base debe ser la del cálculo actual');
  assert(/No ha cambiado ningún dato/.test(htmlDe('cmpDiff')), 'debe quedar sin diferencias');
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('H · coeficiente global K (CTE DB-HE1)');

test('los valores Ulim de la app coinciden con la tabla 3.1.1.a-HE1', () => {
  // Valores transcritos de la tabla oficial: muro/suelo exterior, cubierta, suelo UT, huecos
  const oficial = {
    'α': [0.80, 0.55, 0.90, 3.2],
    A: [0.70, 0.50, 0.80, 2.7],
    B: [0.56, 0.44, 0.75, 2.3],
    C: [0.49, 0.40, 0.70, 2.1],
    D: [0.41, 0.35, 0.65, 1.8],
    E: [0.37, 0.33, 0.59, 1.80]
  };
  Object.entries(oficial).forEach(([z, [muro, cub, sue, ven]]) => {
    const L = API.LIM()[z];
    eq(L.muro, muro, `muro zona ${z}`);
    eq(L.cub, cub, `cubierta zona ${z}`);
    eq(L.sue, sue, `suelo zona ${z}`);
    eq(L.ven, ven, `huecos zona ${z}`);
  });
});

test('los límites de K son los de las tablas 3.1.1.b y 3.1.1.c', () => {
  eq(API.kLimite('D3', 0.5, 'residencial', 'nuevo'), 0.48, 'D residencial nuevo, V/A ≤ 1');
  eq(API.kLimite('D3', 6, 'residencial', 'nuevo'), 0.67, 'D residencial nuevo, V/A ≥ 4');
  eq(API.kLimite('D3', 0.5, 'residencial', 'reforma'), 0.63, 'D reforma, V/A ≤ 1');
  eq(API.kLimite('D3', 6, 'residencial', 'reforma'), 0.70, 'D reforma, V/A ≥ 4');
  eq(API.kLimite('E1', 1, 'residencial', 'nuevo'), 0.43, 'E residencial nuevo');
  eq(API.kLimite('α3', 1, 'residencial', 'nuevo'), 0.67, 'zona alfa residencial nuevo');
  eq(API.kLimite('D3', 1, 'otros', 'nuevo'), 0.54, 'D otros usos, V/A ≤ 1');
  eq(API.kLimite('D3', 4, 'otros', 'nuevo'), 0.70, 'D otros usos, V/A ≥ 4');
  eq(API.kLimite('', 1, 'residencial', 'nuevo'), null, 'sin zona no hay límite');
});

test('el límite de K se interpola entre V/A = 1 y V/A = 4', () => {
  near(API.kLimite('D3', 1, 'residencial', 'nuevo'), 0.48, 1e-9, 'extremo inferior');
  near(API.kLimite('D3', 4, 'residencial', 'nuevo'), 0.67, 1e-9, 'extremo superior');
  near(API.kLimite('D3', 2.5, 'residencial', 'nuevo'), (0.48 + 0.67) / 2, 1e-9, 'punto medio');
  const v = [1, 1.5, 2, 3, 4].map(x => API.kLimite('D3', x, 'residencial', 'nuevo'));
  for (let i = 1; i < v.length; i++) assert(v[i] >= v[i - 1], 'el límite no crece con la compacidad');
  eq(API.kLimite('D3', 0.2, 'residencial', 'nuevo'), API.kLimite('D3', 1, 'residencial', 'nuevo'), 'por debajo de 1 no baja');
});

test('K se calcula como la suma de U·A entre la superficie de intercambio', () => {
  escenarioMadrid();
  API.doCalc();
  const r = API.S.last, g = API.geometry();
  near(r.Aint, g.wallA + g.winA + g.roofA + g.floorA, 1e-9, 'Aint');
  const esperado = (0.20 * g.wallA + 1.80 * g.winA + 0.25 * g.roofA + 0.45 * g.floorA) * 1.10 / r.Aint;
  near(r.Kval, esperado, 1e-9, 'K');
  near(r.compacidad, g.vol / r.Aint, 1e-9, 'compacidad V/A');
});

test('una envolvente Passivhaus cumple K y una sin aislamiento no', () => {
  escenarioMadrid();
  ['m4', 'c3', 's2', 'v4'].forEach((id, i) => API.pickOpt(['muro', 'cub', 'sue', 'ven'][i], id));
  API.doCalc();
  assert(API.S.last.Kval <= API.S.last.kLim, `Passivhaus no cumple K: ${API.S.last.Kval} vs ${API.S.last.kLim}`);
  ['m0', 'c0', 's0', 'v0'].forEach((id, i) => API.pickOpt(['muro', 'cub', 'sue', 'ven'][i], id));
  API.doCalc();
  assert(API.S.last.Kval > API.S.last.kLim, 'sin aislamiento debería incumplir K');
});

test('el panel de resultados muestra K, la compacidad y el veredicto', () => {
  escenarioMadrid();
  API.doCalc();
  const t = htmlDe('resK');
  assert(/K = /.test(t), 'no muestra K');
  assert(/V\/A = /.test(t), 'no muestra la compacidad');
  assert(/Cumple/.test(t), 'no muestra veredicto');
  assert(/tabla 3\.1\.1\.b/.test(t), 'no cita la tabla del uso residencial');
  assert(/límite sube a/.test(t), 'no menciona la alternativa de reforma');
});

test('los usos no residenciales usan la tabla 3.1.1.c', () => {
  escenarioMadrid();
  set('tipoEdi', 'oficinas'); API.onUso(); set('nper', 90);
  API.doCalc();
  assert(/tabla 3\.1\.1\.c/.test(htmlDe('resK')), 'debería citar la tabla c');
  assert(!/límite sube a/.test(htmlDe('resK')), 'la tabla c no distingue reforma');
  eq(API.S.last.kLimRef, null, 'no debe haber límite de reforma separado');
});

test('el muro interior no entra en la superficie de intercambio de K', () => {
  escenarioMadrid();
  API.doCalc();
  const sinInterior = API.S.last.Aint;
  escenarioMadrid({ 'int-N': 6 });
  API.doCalc();
  assert(API.S.last.Aint < sinInterior, 'Aint debe bajar al declarar muro interior');
  near(sinInterior - API.S.last.Aint, 6 * 2.7, 1e-6, 'debe bajar en 6 m × 2,7 m');
});

/* ═══════════════════════════════════════════════════════════════════════ */
grupoDe('I · puentes térmicos, factor b y cargas internas configurables');

test('los puentes térmicos se pueden poner a cero', () => {
  escenarioMadrid(); set('pt', 0); API.doCalc();
  eq(API.S.last.Qpt, 0, 'la partida de puentes debe ser nula');
  escenarioMadrid(); set('pt', 10); API.doCalc();
  assert(API.S.last.Qpt > 0, 'con el 10 % debe haber puentes');
});

test('el porcentaje de puentes térmicos escala la partida', () => {
  const calc = pt => { escenarioMadrid(); set('pt', pt); API.doCalc(); return API.S.last.Qpt; };
  const a = calc(5), b = calc(10), c = calc(20);
  near(b / a, 2, 1e-9, '10 % frente a 5 %');
  near(c / a, 4, 1e-9, '20 % frente a 5 %');
});

test('los puentes térmicos entran en el coeficiente K', () => {
  escenarioMadrid(); set('pt', 0); API.doCalc();
  const sinPuentes = API.S.last.Kval;
  escenarioMadrid(); set('pt', 10); API.doCalc();
  near(API.S.last.Kval / sinPuentes, 1.10, 1e-9, 'K con un 10 % de puentes');
});

test('el factor b del suelo escala la carga del forjado', () => {
  const calc = b => {
    escenarioMadrid(); set('sueloTipo', 'nocal'); API.onSuelo(); set('fb', b); API.doCalc();
    return API.S.last.Qfc;
  };
  near(calc(1.0) / calc(0.5), 2, 1e-6, 'b = 1 frente a b = 0,5');
  assert(calc(0.8) > calc(0.3), 'más b, más pérdida');
});

test('el factor b solo se usa sobre un local no calefactado', () => {
  const calc = b => {
    escenarioMadrid(); set('sueloTipo', 'aire'); API.onSuelo(); set('fb', b); API.doCalc();
    return API.S.last.Qfc;
  };
  near(calc(0.2), calc(1.0), 1e-9, 'sobre aire exterior el campo no debe influir');
  escenarioMadrid(); set('sueloTipo', 'nocal'); API.onSuelo();
  assert(!get('wrap-fb').classList.contains('hidden'), 'el campo debe verse con local no calefactado');
  set('sueloTipo', 'aire'); API.onSuelo();
  assert(get('wrap-fb').classList.contains('hidden'), 'el campo debe ocultarse sobre aire exterior');
});

test('el factor b se valida', () => {
  escenarioMadrid(); set('sueloTipo', 'nocal'); API.onSuelo();
  set('fb', 0.5); eq(API.validate(2), true, 'valor correcto');
  set('fb', 0); eq(API.validate(2), false, 'fuera de rango');
});

test('las ganancias por ocupante son editables', () => {
  escenarioMadrid(); set('pSens', 75); set('pLat', 55); API.doCalc();
  const base = API.S.last;
  escenarioMadrid(); set('pSens', 100); set('pLat', 40); API.doCalc();
  const nuevo = API.S.last;
  near(nuevo.Qps / base.Qps, 100 / 75, 1e-9, 'sensible proporcional');
  near(nuevo.Qpl / base.Qpl, 40 / 55, 1e-9, 'latente proporcional');
});

test('las ganancias internas admiten cualquier densidad de potencia', () => {
  escenarioMadrid(); set('gains', 18.1); API.doCalc();
  near(API.S.last.Qeq, 18.1 * 120, 1e-6, 'W/m² por superficie útil');
});

test('los campos nuevos se validan', () => {
  escenarioMadrid();
  set('pt', 50); eq(API.validate(3), false, 'puentes fuera de rango');
  set('pt', 10); eq(API.validate(3), true, 'puentes correctos');
  set('pSens', 10); eq(API.validate(4), false, 'ganancia sensible fuera de rango');
  set('pSens', 75); eq(API.validate(4), true);
  set('pLat', 5); eq(API.validate(4), false, 'ganancia latente fuera de rango');
  set('pLat', 55);
  set('gains', 200); eq(API.validate(4), false, 'ganancias fuera de rango');
  set('gains', 8); eq(API.validate(4), true);
});

test('los cambios en estos campos se reflejan en la comparación', () => {
  escenarioMadrid(); API.doCalc(); API.setBase();
  set('pt', 0); set('pSens', 80); API.doCalc();
  const d = htmlDe('cmpDiff');
  assert(/Puentes térmicos/.test(d), 'no detecta los puentes térmicos');
  assert(/Ganancia sensible por ocupante/.test(d), 'no detecta las ganancias por ocupante');
});

/* ═══════════════════════════════════════════════════════════════════════ */
console.log(`\n${'─'.repeat(60)}`);
console.log(`${pasan} correctos, ${fallan} fallidos`);
if (fallan) {
  console.log('\nFallos:');
  fallos.forEach(f => console.log('  · ' + f));
}
process.exit(fallan ? 1 : 0);
