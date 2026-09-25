/* ═════════════════════════════════════════════
   Calculadora Térmica RITE — lógica de la aplicación
   Depende de js/data.js
═════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const num = id => parseFloat(String($(id).value).replace(',', '.'));
const fmt = (v, d = 1) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const RAD = Math.PI / 180;

const LAPSE = 0.0065;     // gradiente térmico con la altitud [°C/m]
const CP_AIRE = 1006;     // calor específico del aire [J/(kg·K)]
const HFG = 2.45e6;       // calor latente de vaporización [J/kg]
const FG1 = 1.45;         // UNE-EN 12831: variación anual de la temperatura exterior
const MARGEN = 1.15;      // margen de seguridad sobre la carga calculada
const REC_UMBRAL = 0.5;   // RITE IT 1.2.4.5.2: caudal expulsado a partir del cual se exige recuperación [m³/s]
const F_PROT = 0.55;      // factor de la protección solar exterior sobre la ganancia por ventanas

const ZONAS = ['α3', 'A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'E1'];
const TIPOS = ['muro', 'cub', 'sue', 'ven'];

const freshState = () => ({
  step: 1, zone: '', shading: false, tempsEdited: false,
  sel: { muro: null, cub: null, sue: null, ven: null }
});
let S = freshState();

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const ps = $('provincia');
  PROV.forEach((p, i) => ps.add(new Option(p.name, i)));
  const zo = $('zOver');
  ZONAS.forEach(z => zo.add(new Option(z, z)));

  buildFacadeRows();
  TIPOS.forEach(t => buildOpts(t));
  onUso();
  onAnio();
  onPos();
  setStep(1);
});

/* ═══════════════════════════════════════════
   LOCALIZACIÓN Y CLIMA
═══════════════════════════════════════════ */
const curProv = () => { const v = $('provincia').value; return v === '' ? null : PROV[+v]; };
const curStation = () => { const p = curProv(); return p && p.st.length ? p.st[+$('estacion').value || 0] : null; };
const TEMP_IDS = ['tWin', 'tSum', 'tWet', 'tDr', 'tMed', 'tLat'];

function onProv() {
  const p = curProv();
  const es = $('estacion');
  es.innerHTML = '';
  $('e-prov').classList.remove('show');
  if (!p) { $('alti').value = ''; S.zone = ''; showZone(); return; }
  if (p.st.length) {
    p.st.forEach((s, i) => es.add(new Option(`${s.name} · ${s.h} m${i === 0 ? ' (capital)' : ''}`, i)));
    es.disabled = false;
  } else {
    es.add(new Option('Sin estación en la guía IDAE: introduce las temperaturas manualmente', ''));
    es.disabled = true;
    $('tempsBox').open = true;
  }
  $('alti').value = p.h;
  $('altiHint').textContent = `Capital: ${p.cap.split('/')[0]} (${p.h} m)`;
  onSite();
}

// Cambio de estación o de altitud: se recalculan las condiciones de proyecto
function onSite() {
  S.tempsEdited = false;
  fillTemps();
  refreshZone();
}

function onZone() { refreshZone(); }

function onTempEdit() {
  S.tempsEdited = true;
  $('tempsNote').textContent = 'Condiciones introducidas manualmente.';
  showZone();
}

function onUso() {
  const u = $('tipoEdi').value;
  const res = u === 'residencial';
  $('wrap-nviv').classList.toggle('hidden', !res);
  $('wrap-ndor').classList.toggle('hidden', !res);
  $('wrap-ida').classList.toggle('hidden', res);
  if (!res) $('ida').value = USO[u].ida;
  $('tWinHint').textContent = USO[u].w996 ? 'Percentil 99,6 % (uso sanitario)' : 'Percentil 99 %';
  if (!S.tempsEdited) fillTemps();
  refreshZone();
  updVent();
}

function zoneFromTable(p, h) {
  let z = '';
  p.zones.forEach(([lo, zz]) => { if (h >= lo) z = zz; });
  return z;
}

function fillTemps() {
  const p = curProv(), st = curStation(), h = num('alti');
  if (!p || !st || !isFinite(h)) {
    TEMP_IDS.forEach(id => { $(id).value = ''; });
    if (p && p.lat) $('tLat').value = p.lat;
    $('tempsNote').textContent = p && !p.st.length
      ? 'Esta provincia no tiene estación en la guía del IDAE. Usa datos de una estación cercana o de AEMET.' : '';
    return;
  }
  const corr = -LAPSE * (h - st.h);
  const w996 = USO[$('tipoEdi').value].w996;
  $('tWin').value = ((w996 ? st.w996 : st.w99) + corr).toFixed(1);
  $('tSum').value = (st.s1 + corr).toFixed(1);
  $('tWet').value = (st.wb1 + corr).toFixed(1);
  $('tDr').value = st.dr.toFixed(1);
  $('tMed').value = (st.tm + corr).toFixed(1);
  $('tLat').value = st.lat.toFixed(2);
  const dh = h - st.h;
  $('tempsNote').textContent = `Estación IDAE ${st.name} (${st.h} m).` +
    (Math.abs(dh) >= 1 ? ` Corrección por altitud: ${corr >= 0 ? '+' : '−'}${fmt(Math.abs(corr), 1)} °C (${dh > 0 ? '+' : '−'}${Math.abs(dh)} m respecto a la estación).` : '') +
    (Math.abs(dh) > 300 ? ' Diferencia de altitud grande: conviene usar datos de una estación más próxima.' : '');
}

function refreshZone() {
  const p = curProv(), h = num('alti');
  const over = $('zOver').value;
  S.zone = over || (p && isFinite(h) ? zoneFromTable(p, h) : '');
  showZone();
  applyCteBadges();
  updateCtePanel();
}

function climate() {
  return { Tw: num('tWin'), Ts: num('tSum'), Twb: num('tWet'), dr: num('tDr'), Tm: num('tMed'), lat: num('tLat') };
}

function showZone() {
  const box = $('zoneDisp');
  const z = S.zone;
  if (!z) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('zCode').textContent = z;
  $('zName').textContent = `${ZW[z[0]]} · ${ZS[z[1]]}` + ($('zOver').value ? ' (fijada manualmente)' : '');
  const c = climate();
  $('zTemps').textContent = [c.Tw, c.Ts, c.Tm].every(isFinite)
    ? `Invierno: ${fmt(c.Tw)} °C  ·  Verano: ${fmt(c.Ts)} °C (húmeda ${fmt(c.Twb)} °C)  ·  Media anual: ${fmt(c.Tm)} °C`
    : 'Faltan las temperaturas de proyecto';
}

/* ═══════════════════════════════════════════
   GEOMETRÍA Y FACHADAS
═══════════════════════════════════════════ */
const DERIVED_EMPTY = 'Introduce los datos para ver el resumen geométrico.';
const rumbo = az => RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

function buildFacadeRows() {
  const tb = $('facadeRows');
  FACHADAS.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td id="fl-${f.id}"></td>
      <td><input type="number" id="len-${f.id}" min="0" max="9999" step="0.1" value="0" oninput="updDerived()" aria-label="Longitud total de muro"></td>
      <td><input type="number" id="int-${f.id}" min="0" max="9999" step="0.1" value="0" oninput="updDerived()" aria-label="Longitud de muro interior o medianera"></td>
      <td><input type="number" id="pct-${f.id}" min="0" max="90" step="1" value="15" oninput="updDerived()" aria-label="Porcentaje de acristalamiento"></td>
      <td><input type="number" id="obs-${f.id}" min="0" max="80" step="1" value="0" aria-label="Ángulo de obstrucción"></td>`;
    tb.appendChild(tr);
  });
  updFacades();
}

function updFacades() {
  const g = num('giro') || 0;
  FACHADAS.forEach(f => {
    const az = (((f.az + g) % 360) + 360) % 360;
    $('fl-' + f.id).innerHTML = `${rumbo(az)}<small>normal a ${fmt(az, 0)}°</small>`;
  });
  updDerived();
}

const posFlags = () => {
  const v = $('posicion').value;
  const floor = v === 'completo' || v === 'baja';
  return { roof: v === 'completo' || v === 'ultima', floor, suelo: floor ? $('sueloTipo').value : null };
};
const activeTypes = () => {
  const f = posFlags();
  return TIPOS.filter(t => (t !== 'cub' || f.roof) && (t !== 'sue' || f.floor));
};

function geometry() {
  const sup = num('sup'), npl = +$('npl').value, alt = num('alt'), giro = num('giro') || 0;
  const f = posFlags();
  const faces = FACHADAS.map(fc => {
    const len = Math.max(num('len-' + fc.id) || 0, 0);
    // Parte del muro que no da al exterior: medianeras y paredes con otras viviendas o locales
    // calefactados. No transmite carga (a ambos lados hay la misma temperatura) y no se le exige
    // transmitancia límite, así que se descuenta del cerramiento exterior.
    const lenInt = Math.min(Math.max(num('int-' + fc.id) || 0, 0), len);
    const lenExt = len - lenInt;
    const pct = Math.min(Math.max(num('pct-' + fc.id) || 0, 0), 90);
    const obs = Math.min(Math.max(num('obs-' + fc.id) || 0, 0), 80);
    const fac = lenExt * alt * npl, win = fac * pct / 100;
    return { id: fc.id, az: fc.az + giro, len, lenInt, lenExt, pct, obs, fac, win, wall: fac - win };
  });
  const sum = k => faces.reduce((a, x) => a + x[k], 0);
  const supT = sup * npl;
  return {
    sup, npl, alt, supT, vol: supT * alt, faces,
    per: sum('lenExt'), perTot: sum('len'), perInt: sum('lenInt'),
    facadeInt: sum('lenInt') * alt * npl,
    fac: sum('fac'), winA: sum('win'), wallA: sum('wall'),
    roofA: f.roof ? sup : 0, floorA: f.floor ? sup : 0
  };
}

function onPos() {
  $('wrap-suelo').classList.toggle('hidden', !posFlags().floor);
  onSuelo();
}

function updDerived() {
  const g = geometry();
  if (g.sup > 0 && g.alt > 0 && g.per > 0) {
    const pv = g.fac > 0 ? g.winA / g.fac * 100 : 0;
    const intra = g.perInt > 0
      ? `<br>Muro interior o medianera: <strong>${fmt(g.perInt)} m</strong> &nbsp;·&nbsp; superficie no expuesta: <strong>${fmt(g.facadeInt, 0)} m²</strong> — no transmite carga ni se le exige transmitancia límite`
      : '';
    $('derivedTxt').innerHTML =
      `Fachada exterior: ${fmt(g.per)} m × ${fmt(g.alt)} m × ${g.npl} ${g.npl === 1 ? 'planta' : 'plantas'} = <strong>${fmt(g.fac, 0)} m²</strong>
       (muros <strong>${fmt(g.wallA, 0)} m²</strong> + ventanas <strong>${fmt(g.winA, 0)} m²</strong>, ${fmt(pv, 0)} %)<br>
       Superficie útil total: <strong>${fmt(g.supT, 0)} m²</strong> &nbsp;·&nbsp; Volumen: <strong>${fmt(g.vol, 0)} m³</strong>
       &nbsp;·&nbsp; Cubierta: <strong>${fmt(g.roofA, 0)} m²</strong> &nbsp;·&nbsp; Suelo inferior: <strong>${fmt(g.floorA, 0)} m²</strong>${intra}`;
  } else {
    $('derivedTxt').textContent = DERIVED_EMPTY;
  }
}

/* ═══════════════════════════════════════════
   ENVOLVENTE
═══════════════════════════════════════════ */
const curSuelo = () => $('sueloTipo').value;
const listFor = t => t === 'sue' ? ENV[SUELO[curSuelo()].opts] : ENV[t];
const limKey = t => t === 'sue' ? SUELO[curSuelo()].lim : t;

function buildOpts(type) {
  const cols = type === 'muro' || type === 'ven' ? 2 : 3;
  const g = $(type + '-grid');
  g.className = 'opts opts-' + cols;
  g.innerHTML = '';
  const add = (id, html, cls = '') => {
    const d = document.createElement('div');
    d.className = 'opt ' + cls;
    d.id = 'o-' + type + '-' + id;
    d.tabIndex = 0;
    d.setAttribute('role', 'radio');
    d.setAttribute('aria-checked', 'false');
    d.onclick = () => pickOpt(type, id);
    d.onkeydown = e => {
      if (e.target === d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickOpt(type, id); }
    };
    d.innerHTML = html;
    g.appendChild(d);
  };
  listFor(type).forEach(it => add(it.id, `<div class="opt__title">${it.title}</div>
      <div class="opt__sub">${it.sub}</div>
      <div class="opt__u">U = ${fmt(it.U, 2)} W/m²K${it.g !== undefined ? ' · g = ' + fmt(it.g, 2) : ''}</div>`));
  // Valor personalizado (por ejemplo, calculado por capas o tomado del proyecto)
  add('x', `<div class="opt__title">Otro valor</div>
      <div class="opt__sub">Transmitancia conocida del cerramiento</div>
      <div class="opt__inputs">
        <label>U <input type="number" id="u-${type}" min="0.05" max="6" step="0.01" placeholder="0,50" oninput="onCustom('${type}')"> W/m²K</label>
        ${type === 'ven' ? `<label>g <input type="number" id="g-ven" min="0.05" max="0.9" step="0.01" placeholder="0,60" oninput="onCustom('ven')"></label>` : ''}
      </div>`, 'opt-custom');
}

function onCustom(type) {
  if (S.sel[type] !== 'x') pickOpt(type, 'x');
  else { applyCteBadges(); updateCtePanel(); }
}

// Elemento seleccionado de cada tipo ({ U, g } o null)
function item(t) {
  const id = S.sel[t];
  if (!id) return null;
  if (id === 'x') {
    const U = num('u-' + t), g = t === 'ven' ? num('g-ven') : undefined;
    return { U, g, title: 'Valor introducido', custom: true };
  }
  return listFor(t).find(x => x.id === id) || null;
}
const customOk = it => it && isFinite(it.U) && it.U >= 0.05 && it.U <= 6 && (it.g === undefined || (isFinite(it.g) && it.g >= 0.05 && it.g <= 0.9));

function onSuelo() {
  const s = SUELO[curSuelo()];
  $('sueHead').textContent = s.label;
  const prev = S.sel.sue;
  const uPrev = $('u-sue') ? $('u-sue').value : '';
  buildOpts('sue');
  $('u-sue').value = uPrev;
  // Mantiene el nivel de aislamiento equivalente al cambiar de lista
  const idx = prev && prev !== 'x' ? +prev.slice(1) : null;
  if (prev === 'x') pickOpt('sue', 'x');
  else if (idx !== null) pickOpt('sue', listFor('sue')[Math.min(idx, listFor('sue').length - 1)].id);
  else S.sel.sue = null;
  const f = posFlags();
  $('grp-sue').classList.toggle('hidden', !f.floor);
  $('grp-cub').classList.toggle('hidden', !f.roof);
  applyCteBadges();
  updateCtePanel();
  updDerived();
}

function pickOpt(type, id) {
  $(type + '-grid').querySelectorAll('.opt').forEach(el => {
    el.classList.remove('sel');
    el.setAttribute('aria-checked', 'false');
  });
  const el = $('o-' + type + '-' + id);
  el.classList.add('sel');
  el.setAttribute('aria-checked', 'true');
  S.sel[type] = id;
  $('e-' + type).classList.remove('show');
  applyCteBadges();
  updateCtePanel();
}

function onAnio() {
  const d = ENV_BY_YEAR[$('anio').value];
  ['muro', 'cub', 'ven'].forEach(t => pickOpt(t, d[t]));
  const list = listFor('sue');
  pickOpt('sue', list[Math.min(+d.sue.slice(1), list.length - 1)].id);
  $('estanq').value = d.inf;
}

function applyCteBadges() {
  document.querySelectorAll('.cte-badge').forEach(b => b.remove());
  const lim = CTE_LIM[S.zone[0]];
  if (!lim) return;
  const badge = (el, ok) => {
    const b = document.createElement('span');
    b.className = 'cte-badge ' + (ok ? 'cte-ok' : 'cte-ko');
    b.textContent = ok ? '✓ CTE' : '✗ CTE';
    el.appendChild(b);
  };
  TIPOS.forEach(type => {
    const L = lim[limKey(type)];
    listFor(type).forEach(it => badge($('o-' + type + '-' + it.id), it.U <= L));
    const U = num('u-' + type);
    if (isFinite(U)) badge($('o-' + type + '-x'), U <= L);
  });
}

const CTE_NAMES = { muro: 'Muros (UM)', cub: 'Cubierta (UC)', ven: 'Huecos (UH)' };
const cteName = t => t !== 'sue' ? CTE_NAMES[t] : ({ terreno: 'Suelo sobre terreno (UT)', aire: 'Suelo sobre aire exterior (US)', nocal: 'Suelo sobre local no habitable (UT)' })[curSuelo()];

function updateCtePanel() {
  const lim = CTE_LIM[S.zone[0]];
  if (!lim) { $('ctePanel').classList.add('hidden'); return; }
  let html = '';
  activeTypes().forEach(t => {
    const it = item(t);
    if (!it || !isFinite(it.U)) return;
    const L = lim[limKey(t)], ok = it.U <= L;
    html += `<div class="cte-row"><span class="cte-row__name">${cteName(t)}</span>
      <div class="cte-row__vals">
        <span class="cte-row__u">U = ${fmt(it.U, 2)} W/m²K</span>
        <span class="cte-row__lim">Límite: ${fmt(L, 2)}</span>
        <span class="cte-tag ${ok ? 'cte-ok' : 'cte-ko'}">${ok ? '✓ Cumple' : '✗ No cumple'}</span>
      </div></div>`;
  });
  $('ctePanelRows').innerHTML = html;
  $('ctePanel').classList.toggle('hidden', !html);
}

function toggleSh() {
  S.shading = !S.shading;
  $('shTog').classList.toggle('on', S.shading);
  $('shBtn').setAttribute('aria-checked', String(S.shading));
}

/* ═══════════════════════════════════════════
   VENTILACIÓN
═══════════════════════════════════════════ */
// Caudal de ventilación de una vivienda según DB-HS3 tabla 2.1 [l/s]
function hs3Vivienda(nd) {
  const admision = 8 + 4 * Math.max(nd - 1, 0) + HS3.sala(nd);
  return Math.max(admision, HS3.extMin(nd));
}

function ventilation() {
  const u = $('tipoEdi').value;
  const g = geometry();
  let qv, desc;
  if (u === 'residencial') {
    const nv = Math.max(1, Math.round(num('nviv')) || 1), nd = +$('ndor').value;
    const q1 = hs3Vivienda(nd);
    qv = nv * q1;
    desc = `DB-HS3: ${q1} l/s por vivienda${nv > 1 ? ` × ${nv} viviendas` : ''}`;
  } else {
    const ida = $('ida').value, np = num('nper') || 0;
    qv = np * IDA[ida].qp;
    desc = `RITE ${ida.replace('IDA', 'IDA ')}: ${fmt(IDA[ida].qp)} l/s·persona × ${np} personas`;
  }
  const qi = isFinite(g.vol) ? +$('estanq').value * g.vol / 3.6 : 0;   // l/s
  const rec = $('vsis').value === 'rec';
  const eta = rec ? Math.min(Math.max(num('eta') || 0, 0), 95) / 100 : 0;
  return { qv, qi, rec, eta, desc };
}

function updVent() {
  const v = ventilation();
  $('wrap-eta').classList.toggle('hidden', !v.rec);
  $('ventTxt').innerHTML =
    `Ventilación: <strong>${fmt(v.qv)} l/s</strong> (${v.desc}) &nbsp;·&nbsp; Infiltraciones: <strong>${fmt(v.qi)} l/s</strong>`;
  $('recWarn').classList.toggle('hidden', v.rec || v.qv / 1000 <= REC_UMBRAL);
}

/* ═══════════════════════════════════════════
   NAVEGACIÓN Y VALIDACIÓN
═══════════════════════════════════════════ */
function setStep(n) {
  for (let i = 1; i <= 5; i++) {
    const el = $('si' + i);
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
  S.step = n;
}

function nav(to) {
  const cur = S.step;
  if (to !== 'R' && to > cur && !validate(cur)) return;
  if (to === 3) onSuelo();
  if (to === 4) updVent();
  document.querySelectorAll('.step').forEach(s => s.classList.add('hidden'));
  $(to === 'R' ? 'step-results' : 'step-' + to).classList.remove('hidden');
  setStep(to === 'R' ? 5 : to);
  // Sube hasta el inicio del asistente (sin volver a mostrar todo el hero)
  const top = $('main').getBoundingClientRect().top + window.scrollY - 12;
  if (window.scrollY > top) window.scrollTo(0, top);
}

function validate(step) {
  const flag = (id, bad) => { $(id).classList.toggle('show', bad); return !bad; };
  const range = (id, lo, hi) => { const v = num(id); return isFinite(v) && v >= lo && v <= hi; };
  let ok = true;
  if (step === 1) {
    ok = flag('e-prov', !curProv()) && ok;
    ok = flag('e-alti', !range('alti', 0, 3500)) && ok;
    const c = climate();
    const badT = ![c.Tw, c.Ts, c.Twb, c.Tm].every(isFinite) || c.Twb > c.Ts ||
      !range('tDr', 0, 30) || !range('tLat', 27, 44);
    if (badT) $('tempsBox').open = true;
    ok = flag('e-temps', badT) && ok;
  }
  if (step === 2) {
    ok = flag('e-sup', !range('sup', 10, 1e6)) && ok;
    ok = flag('e-alt', !range('alt', 2, 20)) && ok;
    ok = flag('e-giro', !range('giro', -45, 45)) && ok;
    const g = geometry();
    const badF = g.per < 4 || FACHADAS.some(f =>
      !range('len-' + f.id, 0, 1e5) || !range('pct-' + f.id, 0, 90) || !range('obs-' + f.id, 0, 80) ||
      !range('int-' + f.id, 0, 1e5) || (num('int-' + f.id) || 0) > (num('len-' + f.id) || 0));
    ok = flag('e-per', badF) && ok;
  }
  if (step === 3) {
    activeTypes().forEach(t => {
      const it = item(t);
      ok = flag('e-' + t, !it || (it.custom && !customOk(it))) && ok;
    });
  }
  if (step === 4) {
    ok = flag('e-nper', !range('nper', 1, 1e5)) && ok;
    ok = flag('e-tiW', !range('tiW', 18, 25)) && ok;
    ok = flag('e-tiS', !range('tiS', 21, 28)) && ok;
    ok = flag('e-hrS', !range('hrS', 30, 70)) && ok;
    if ($('tipoEdi').value === 'residencial') ok = flag('e-nviv', !range('nviv', 1, 999)) && ok;
    if ($('vsis').value === 'rec') ok = flag('e-eta', !range('eta', 0, 95)) && ok;
  }
  const banner = $('eb' + step);
  if (banner) banner.classList.toggle('show', !ok);
  return ok;
}

/* ═══════════════════════════════════════════
   PSICROMETRÍA
═══════════════════════════════════════════ */
const pAtm = z => 101325 * Math.pow(1 - 2.25577e-5 * z, 5.2559);            // Pa (guía IDAE)
const pSat = t => 610.94 * Math.exp(17.625 * t / (t + 243.04));              // Pa (Magnus)
// Humedad específica a partir de temperatura seca y húmeda [kg/kg]
function wFromWb(tdb, twb, P) {
  const ws = 0.622 * pSat(twb) / (P - pSat(twb));
  return ((2501 - 2.326 * twb) * ws - 1.006 * (tdb - twb)) / (2501 + 1.86 * tdb - 4.186 * twb);
}
// Humedad específica a partir de temperatura seca y humedad relativa [kg/kg]
const wFromRh = (t, rh, P) => 0.622 * rh * pSat(t) / (P - rh * pSat(t));

/* ═══════════════════════════════════════════
   RADIACIÓN SOLAR (día de proyecto, hora solar)
═══════════════════════════════════════════ */
// Devuelve, para cada hora 1–24, la radiación sobre la cubierta y sobre cada fachada
function solarDay(lat, faces) {
  const dec = 23.45 * Math.sin(360 * (284 + SOL.dia) / 365 * RAD);
  const out = [];
  for (let h = 1; h <= 24; h++) {
    const H = 15 * (h - 12);
    const sb = Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(H * RAD) + Math.sin(lat * RAD) * Math.sin(dec * RAD);
    const hour = { h, roof: 0, faces: {} };
    if (sb <= 0.01) { faces.forEach(f => { hour.faces[f.id] = { opaque: 0, glass: 0 }; }); out.push(hour); continue; }
    const beta = Math.asin(sb), cb = Math.cos(beta);
    // Azimut solar desde el norte, sentido horario
    const sinAz = Math.cos(dec * RAD) * Math.sin(H * RAD) / cb;
    const cosAz = (sb * Math.sin(lat * RAD) - Math.sin(dec * RAD)) / (cb * Math.cos(lat * RAD));
    const azSun = 180 + Math.atan2(sinAz, cosAz) / RAD;
    const Edn = SOL.A / Math.exp(SOL.B / sb);
    const Edh = SOL.C * Edn;                                   // difusa horizontal
    const Eg = SOL.rhoSuelo * (Edn * sb + Edh) * 0.5;           // reflejada por el suelo sobre un plano vertical
    hour.roof = Edn * sb + Edh;
    faces.forEach(f => {
      const gam = (azSun - f.az) * RAD;
      const cosT = cb * Math.cos(gam);                          // incidencia sobre plano vertical
      let dir = 0, iam = 0;
      if (cosT > 0) {
        // Ángulo de perfil: el sol queda oculto si está por debajo de la obstrucción
        const perfil = Math.atan(Math.tan(beta) / Math.cos(gam)) / RAD;
        if (perfil > f.obs) {
          dir = Edn * cosT;
          iam = Math.max(0, 1 - 0.1 * (1 / cosT - 1));          // modificador por ángulo de incidencia del vidrio
        }
      }
      const dif = Edh * 0.5 * (1 - Math.sin(f.obs * RAD));      // difusa del cielo con la parte visible del cielo
      hour.faces[f.id] = { opaque: dir + dif + Eg, glass: dir * iam + dif + Eg };
    });
    out.push(hour);
  }
  return out;
}

/* ═══════════════════════════════════════════
   CÁLCULO
═══════════════════════════════════════════ */
function doCalc() {
  // Se validan todos los pasos; si alguno falla, se vuelve a él mostrando los errores
  for (const s of [1, 2, 3, 4]) {
    if (!validate(s)) {
      if (s !== S.step) { nav(s); validate(s); }
      return;
    }
  }
  const c = climate(), g = geometry(), v = ventilation(), f = posFlags();
  const h = num('alti');
  const TiW = num('tiW'), TiS = num('tiS'), hr = num('hrS') / 100;
  const dTc = Math.max(TiW - c.Tw, 0);

  const Uw = item('muro').U, Uv = item('ven').U, gv = item('ven').g;
  const Uc = f.roof ? item('cub').U : 0;
  const Us = f.floor ? item('sue').U : 0;
  const suelo = f.floor ? SUELO[f.suelo] : null;

  const qv = v.qv / 1000, qi = v.qi / 1000;   // m³/s
  // Densidad del aire según la altitud (a 20 °C): 1,20 kg/m³ al nivel del mar, 1,11 kg/m³ en Madrid
  const P = pAtm(h);
  const RHO = P / (287.05 * 293.15), RHO_CP = RHO * CP_AIRE;
  // Aire exterior: la ventilación y las infiltraciones entran por las mismas aberturas, así que el
  // caudal de referencia es el mayor de los dos. El recuperador de doble flujo es sensible: su
  // eficiencia se aplica a la fracción de ese caudal que pasa por el intercambiador (la ventilación),
  // ponderada sobre el caudal de referencia. No recupera humedad, así que la carga latente no varía.
  const qAirL = Math.max(qi, qv);
  const qAirS = v.rec ? Math.max(qAirL - v.eta * qv, 0) : qAirL;

  // ─── CALEFACCIÓN (UNE-EN 12831 simplificada, régimen estacionario)
  const Qwc = Uw * g.wallA * dTc;
  const Qcc = Uc * g.roofA * dTc;
  const Qvc = Uv * g.winA * dTc;
  let Qfc = 0, fg2 = 0;
  if (suelo && suelo.b === null) {
    // Suelo sobre el terreno: fg1 · fg2 · U · A · ΔT, con fg2 = (θint − θm,e) / (θint − θe)
    fg2 = dTc > 0 ? Math.max(TiW - c.Tm, 0) / dTc : 0;
    Qfc = FG1 * fg2 * Us * g.floorA * dTc;
  } else if (suelo) {
    Qfc = suelo.b * Us * g.floorA * dTc;
  }
  const Qtr = Qwc + Qcc + Qvc + Qfc;
  const Qpt = Qtr * 0.10;
  const Qac = qAirS * RHO_CP * dTc;
  const Qcal = Qtr + Qpt + Qac;

  // ─── REFRIGERACIÓN (hora a hora, 21 de julio)
  const alfa = COLOR[$('color').value];
  const inr = INERCIA[$('inercia').value];
  const shF = S.shading ? F_PROT : 1;
  const sun = solarDay(c.lat, g.faces);
  const To = sun.map(s => c.Ts - c.dr * PERFIL_T[s.h - 1]);

  // Temperatura sol-aire y onda amortiguada y desfasada para cada opaco
  const damp = tsa => {
    const m = tsa.reduce((a, x) => a + x, 0) / 24;
    return tsa.map((_, i) => m + inr.lam * (tsa[(i - inr.lag + 24) % 24] - m));
  };
  const wallQ = new Array(24).fill(0);
  g.faces.forEach(fc => {
    if (fc.wall <= 0) return;
    const te = damp(sun.map((s, i) => To[i] + alfa * s.faces[fc.id].opaque / H_EXT));
    te.forEach((t, i) => { wallQ[i] += Uw * fc.wall * (t - TiS); });
  });
  const roofTe = damp(sun.map((s, i) => To[i] + alfa * s.roof / H_EXT - DR_CIELO));
  const roofQ = roofTe.map(t => Uc * g.roofA * (t - TiS));

  // Ganancia solar por ventanas: una parte es carga inmediata y el resto se reparte a lo largo del día
  const solInst = sun.map(s => g.faces.reduce((a, fc) => a + fc.win * gv * shF * s.faces[fc.id].glass, 0));
  const solMean = solInst.reduce((a, x) => a + x, 0) / 24;
  const solQ = solInst.map(q => inr.f * q + (1 - inr.f) * solMean);

  const bSum = suelo && suelo.b !== null ? suelo.b : 0;       // en verano, el terreno no aporta carga
  const We = wFromWb(c.Ts, c.Twb, P), Wi = wFromRh(TiS, hr, P);
  const Qalr = Math.max(qAirL * RHO * HFG * (We - Wi), 0);
  const nper = num('nper'), gW = +$('gains').value;
  const Qps = nper * PERSONA.sens, Qpl = nper * PERSONA.lat;
  const Qeq = gW * g.supT;

  const hours = sun.map((s, i) => {
    const dT = To[i] - TiS;
    const o = {
      h: s.h, To: To[i],
      Qwr: wallQ[i], Qcr: roofQ[i],
      Qvtr: Uv * g.winA * dT,
      Qsol: solQ[i],
      Qfr: bSum * Us * g.floorA * dT,
      Qasr: Math.max(qAirS * RHO_CP * dT, 0)
    };
    o.Qsens = o.Qwr + o.Qcr + o.Qvtr + o.Qsol + o.Qfr + o.Qasr + Qps + Qeq;
    return o;
  });
  const pk = hours.reduce((a, x) => x.Qsens > a.Qsens ? x : a, hours[0]);
  const Qlat = Qalr + Qpl;
  const Qref = Math.max(pk.Qsens, 0) + Qlat;

  render({
    c, g, v, f, h, suelo, TiW, TiS, hr, dTc, fg2, Uw, Uc, Us, Uv, gv, nper, gW, qAirS, qAirL, We, Wi,
    Qwc, Qcc, Qvc, Qfc, Qpt, Qac, Qcal,
    pk, hours, Qalr, Qps, Qpl, Qeq, Qsens: pk.Qsens, Qlat, Qref,
    Prc: Qcal * MARGEN / 1000, Prr: Qref * MARGEN / 1000
  });
  nav('R');
}

/* ═══════════════════════════════════════════
   RESULTADOS
═══════════════════════════════════════════ */
const kw = v => fmt(v / 1000, 2);

function render(r) {
  const { c, g, v, pk } = r;

  $('rCalKw').textContent = kw(r.Qcal);
  $('rCalRec').textContent = `Potencia recomendada (+15 %): ${fmt(r.Prc, 2)} kW`;
  $('rCalWm2').textContent = `${fmt(r.Qcal / g.supT)} W/m²`;
  $('rRefKw').textContent = kw(r.Qref);
  $('rRefRec').textContent = `Potencia recomendada (+15 %): ${fmt(r.Prr, 2)} kW · máximo a las ${pk.h} h solares`;
  $('rRefWm2').textContent = `${fmt(r.Qref / g.supT)} W/m² · sensible ${kw(r.Qsens)} kW · latente ${kw(r.Qlat)} kW`;

  const floorLbl = r.suelo ? r.suelo.label : 'Suelo';
  const airLbl = v.rec ? `Aire exterior (ventilación con recuperador sensible ${fmt(v.eta * 100, 0)} %)` : 'Aire exterior (ventilación o infiltraciones)';
  $('heatBk').innerHTML = mkBk([
    { n: 'Muros exteriores', v: r.Qwc },
    { n: 'Cubierta', v: r.Qcc },
    { n: floorLbl, v: r.Qfc },
    { n: 'Ventanas', v: r.Qvc },
    { n: 'Puentes térmicos (10 %)', v: r.Qpt },
    { n: airLbl, v: r.Qac }
  ], r.Qcal, 'fill-heat');

  $('coolBk').innerHTML = `<p class="adv__note" style="margin:0 0 10px">Hora de carga máxima: <strong>${pk.h} h solares</strong> · temperatura exterior ${fmt(pk.To)} °C</p>` + mkBk([
    { n: 'Muros exteriores (sol-aire, con inercia)', v: pk.Qwr },
    { n: 'Cubierta (sol-aire, con inercia)', v: pk.Qcr },
    { n: 'Ventanas (transmisión)', v: pk.Qvtr },
    { n: 'Ganancia solar por ventanas', v: pk.Qsol },
    { n: floorLbl, v: pk.Qfr },
    { n: 'Aire exterior — sensible', v: pk.Qasr },
    { n: 'Aire exterior — latente', v: r.Qalr },
    { n: `Personas — sensible (${r.nper} × ${PERSONA.sens} W)`, v: r.Qps },
    { n: `Personas — latente (${r.nper} × ${PERSONA.lat} W)`, v: r.Qpl },
    { n: `Iluminación y equipos (${r.gW} W/m²)`, v: r.Qeq }
  ], r.Qref, 'fill-cool');

  const p = curProv(), st = curStation();
  const pos = $('posicion').selectedOptions[0].text.split(' (')[0];
  const row = (a, b, hc = '', rc = '') => `<tr><td>${a}</td><td>${b}</td><td class="r">${hc}</td><td class="r">${rc}</td></tr>`;
  const Uwm = u => `U = ${fmt(u, 2)} W/m²K`;
  const facTxt = g.faces.filter(fc => fc.lenExt > 0 || fc.lenInt > 0)
    .map(fc => `${rumbo(fc.az)} ${fmt(fc.lenExt)} m${fc.lenInt > 0 ? ` (+${fmt(fc.lenInt)} m interior)` : ''} · ${fmt(fc.pct, 0)} %${fc.obs ? ` · obstr. ${fmt(fc.obs, 0)}°` : ''}`).join('<br>');
  const floorHc = !r.suelo ? '' : r.suelo.b === null ? `${Uwm(r.Us)} · fg1·fg2 = ${fmt(FG1 * r.fg2, 2)}` : `${Uwm(r.Us)} · b = ${fmt(r.suelo.b, 1)}`;
  $('sumTable').innerHTML = `
    <thead><tr><th>Parámetro</th><th>Valor</th><th class="r heat-c">Calefacción</th><th class="r cool-c">Refrigeración</th></tr></thead>
    <tbody>
    ${row('Emplazamiento', `${p.name} · ${fmt(r.h, 0)} m · lat. ${fmt(c.lat, 2)}°`)}
    ${row('Zona climática CTE', `${S.zone} — ${ZW[S.zone[0]]}`)}
    ${row('Datos climáticos', S.tempsEdited || !st ? 'Introducidos manualmente' : `IDAE: ${st.name}`)}
    ${row('Temperatura exterior', '—', `${fmt(c.Tw)} °C`, `${fmt(c.Ts)} °C máx. · oscilación ${fmt(c.dr)} °C · húm. ${fmt(c.Twb)} °C`)}
    ${row('Temperatura interior', '—', `${fmt(r.TiW)} °C`, `${fmt(r.TiS)} °C · ${fmt(r.hr * 100, 0)} % HR`)}
    ${row('ΔT de diseño', '—', `${fmt(r.dTc)} °C`, `${fmt(pk.To - r.TiS)} °C a las ${pk.h} h`)}
    ${row('Posición', pos)}
    ${row('Superficie útil total', `${fmt(g.supT, 0)} m² (${g.npl} × ${fmt(g.sup, 0)} m²)`)}
    ${row('Volumen', `${fmt(g.vol, 0)} m³`)}
    ${row('Fachadas exteriores', facTxt)}
    ${row('Muros exteriores', `${fmt(g.wallA, 0)} m²`, Uwm(r.Uw), `absortividad ${fmt(COLOR[$('color').value], 1)}`)}
    ${row('Ventanas', `${fmt(g.winA, 0)} m² (${fmt(g.fac ? g.winA / g.fac * 100 : 0, 0)} % fachada)`, Uwm(r.Uv), `g = ${fmt(r.gv, 2)}${S.shading ? ' · con protección' : ''}`)}
    ${g.roofA ? row('Cubierta', `${fmt(g.roofA, 0)} m²`, Uwm(r.Uc), `absortividad ${fmt(COLOR[$('color').value], 1)}`) : ''}
    ${g.floorA ? row(r.suelo.label, `${fmt(g.floorA, 0)} m²`, floorHc, r.suelo.b === null ? '—' : `b = ${fmt(r.suelo.b, 1)}`) : ''}
    ${row('Ventilación', `${fmt(v.qv)} l/s`, v.desc, '')}
    ${row('Infiltraciones', `${$('estanq').value.replace('.', ',')} ren/h → ${fmt(v.qi)} l/s`)}
    ${row('Aire exterior de cálculo', v.rec ? `Mayor de ventilación e infiltraciones · recuperador sensible ${fmt(v.eta * 100, 0)} %` : 'Mayor de ventilación e infiltraciones', `${fmt(r.qAirS * 1000)} l/s${v.rec ? ' equivalentes' : ''}`, `${fmt(r.qAirS * 1000)} l/s sens. · ${fmt(r.qAirL * 1000)} l/s lat.`)}
    ${row('Humedad específica', '—', '', `ext. ${fmt(r.We * 1000)} g/kg · int. ${fmt(r.Wi * 1000)} g/kg`)}
    ${row('Ocupación y equipos', `${r.nper} personas · ${r.gW} W/m²`, '', `${kw(r.Qps + r.Qpl + r.Qeq)} kW`)}
    <tr class="total"><td colspan="2">Carga total de diseño</td><td class="r heat-c">${kw(r.Qcal)} kW</td><td class="r cool-c">${kw(r.Qref)} kW</td></tr>
    <tr class="total"><td colspan="2">Potencia recomendada (+15 %)</td><td class="r heat-c">${fmt(r.Prc, 2)} kW</td><td class="r cool-c">${fmt(r.Prr, 2)} kW</td></tr>
    </tbody>`;

  const lim = CTE_LIM[S.zone[0]];
  const Uvals = { muro: r.Uw, cub: r.Uc, sue: r.Us, ven: r.Uv };
  let cteHTML = '<thead><tr><th>Elemento</th><th class="r">U seleccionada</th><th class="r">U límite CTE</th><th class="r">Estado</th></tr></thead><tbody>';
  activeTypes().forEach(t => {
    const L = lim[limKey(t)], ok = Uvals[t] <= L;
    cteHTML += `<tr><td>${cteName(t)}</td><td class="r">${fmt(Uvals[t], 2)} W/m²K</td><td class="r">${fmt(L, 2)} W/m²K</td>
      <td class="r"><span class="cte-tag ${ok ? 'cte-ok' : 'cte-ko'}">${ok ? '✓ Cumple' : '✗ No cumple'}</span></td></tr>`;
  });
  $('resCte').innerHTML = cteHTML + '</tbody>';
}

function mkBk(items, total, cls) {
  let h = '';
  items.forEach(it => {
    if (Math.abs(it.v) < 5) return;
    if (it.v < 0) {
      // Partida que en esa hora reduce la carga (por ejemplo, muros aún fríos por la inercia)
      h += `<div class="breakdown-row">
        <div class="bk-name">${it.n}</div>
        <div class="bk-bar"></div>
        <div class="bk-kw">−${kw(-it.v)} kW</div>
        <div class="bk-pct"></div>
      </div>`;
      return;
    }
    const p = total > 0 ? it.v / total * 100 : 0;
    h += `<div class="breakdown-row">
      <div class="bk-name">${it.n}</div>
      <div class="bk-bar"><div class="bk-fill ${cls}" style="width:${Math.min(p, 100).toFixed(1)}%"></div></div>
      <div class="bk-kw">${kw(it.v)} kW</div>
      <div class="bk-pct">${p.toFixed(0)}%</div>
    </div>`;
  });
  h += `<div class="breakdown-row bk-total">
    <div class="bk-name">Total</div>
    <div class="bk-bar" style="background:none"></div>
    <div class="bk-kw">${kw(total)} kW</div>
    <div class="bk-pct">100%</div>
  </div>`;
  return h;
}

/* ═══════════════════════════════════════════
   NUEVO CÁLCULO
═══════════════════════════════════════════ */
function reset() {
  S = freshState();
  // Cada select vuelve a su opción marcada como "selected" en el HTML (o la primera)
  document.querySelectorAll('select').forEach(el => {
    const i = [...el.options].findIndex(o => o.defaultSelected);
    el.selectedIndex = i >= 0 ? i : 0;
  });
  document.querySelectorAll('input[type=number]').forEach(el => { el.value = el.defaultValue; });
  $('estacion').innerHTML = '';
  $('altiHint').textContent = 'Por defecto, la de la capital';
  $('tempsNote').textContent = '';
  $('tempsBox').open = false;
  $('shTog').classList.remove('on');
  $('shBtn').setAttribute('aria-checked', 'false');
  document.querySelectorAll('.err-txt.show, .err-banner.show').forEach(e => e.classList.remove('show'));
  updFacades();
  onUso();
  onPos();
  onAnio();
  refreshZone();
  nav(1);
}
