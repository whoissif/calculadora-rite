/* ═════════════════════════════════════════════
   Simulador mínimo de DOM para ejecutar la app en Node.
   No pretende ser un navegador: solo lo justo para que js/app.js
   y js/data.js se ejecuten y se pueda leer lo que escriben en pantalla.

   Registra los elementos en dos vías:
     - los id declarados en index.html, que se le pasan al crearlo;
     - los id que el propio JS genera, detectados al asignar innerHTML
       y al añadir hijos con appendChild.
   Cualquier id que la app consulte y no se haya podido registrar en
   ninguna de las dos vías se apunta en `missing`: eso es exactamente
   un enlace roto entre la interfaz y el código.
═════════════════════════════════════════════ */
'use strict';

const NUMERICOS = Symbol('numericos');

function mkClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    contains: c => s.has(c),
    toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; },
    get length() { return s.size; }
  };
}

function createDom(htmlIds) {
  const registry = new Map();
  const numericos = new Set();
  const missing = new Set();
  const creados = new Set();

  const esNumerico = id => numericos.has(id);

  function registrarDesdeHtml(v, propietario) {
    const txt = String(v);
    // id="..." de las plantillas
    for (const m of txt.matchAll(/\bid="([^"]+)"/g)) {
      const id = m[1];
      if (!registry.has(id)) registry.set(id, mkEl(id));
      creados.add(id);
    }
    // inputs numéricos, para poder emular querySelectorAll('input[type=number]')
    for (const m of txt.matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      const id = /\bid="([^"]+)"/.exec(tag);
      const tipo = /\btype="([^"]+)"/.exec(tag);
      if (id && tipo && tipo[1] === 'number') numericos.add(id[1]);
    }
    // el valor por defecto de un input numérico es el que trae el HTML
    for (const m of txt.matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      const id = /\bid="([^"]+)"/.exec(tag);
      const val = /\bvalue="([^"]*)"/.exec(tag);
      if (id && registry.has(id[1]) && val) registry.get(id[1]).defaultValue = val[1];
    }
  }

  function mkEl(id) {
    const el = {
      id, value: '', textContent: '', disabled: false, open: false, className: '',
      tabIndex: 0, selectedIndex: 0, defaultValue: '', checked: false,
      options: [], _attrs: {}, classList: mkClassList(),
      setAttribute(k, v) { this._attrs[k] = v; },
      getAttribute(k) { return this._attrs[k] ?? null; },
      remove() {},
      focus() {},
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; },
      getBoundingClientRect() { return { top: 0 }; },
      add(o) { this.options.push(o); },
      appendChild(hijo) { if (hijo && hijo.id) registrar(hijo.id, hijo); },
      get innerHTML() { return this._html || ''; },
      set innerHTML(v) { this._html = String(v); registrarDesdeHtml(v, this); },
      get selectedOptions() {
        return this.options.length ? [this.options[this.selectedIndex] || this.options[0]] : [{ text: '—' }];
      }
    };
    return el;
  }

  function registrar(id, el) {
    if (!registry.has(id)) registry.set(id, el || mkEl(id));
    creados.add(id);
  }

  const document = {
    getElementById(id) {
      if (!registry.has(id)) {
        if (!htmlIds.has(id)) missing.add(id);
        registry.set(id, mkEl(id));
      }
      return registry.get(id);
    },
    createElement: () => mkEl(''),
    addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') document._ready = cb; },
    querySelectorAll: sel => {
      if (sel === 'select') return [...registry.values()].filter(e => e._esSelect);
      if (sel === 'input[type=number]') return [...numericos].map(id => document.getElementById(id));
      return [];
    }
  };

  const window = { scrollY: 0, scrollTo() {}, print() {} };

  const Option = function (text, value) {
    this.text = String(text);
    this.value = String(value === undefined ? text : value);
    this.defaultSelected = false;
  };

  /* Prepara un valor por defecto como el que el navegador tomaría de index.html.
     No añade opciones falsas: solo marca el elemento como <select> para poder
     emular querySelectorAll('select') sin alterar las opciones que carga la app. */
  function preset(id, valor, esSelect) {
    const el = document.getElementById(id);
    el.value = String(valor);
    el.defaultValue = String(valor);
    if (esSelect) el._esSelect = true;
    return el;
  }

  return {
    document, window, Option, registry, missing, creados, numericos, preset,
    get: id => document.getElementById(id),
    /** id consultados por la app que no existen ni en el HTML ni entre los generados */
    idsRotos: () => [...missing].filter(id => !creados.has(id)).sort()
  };
}

module.exports = { createDom };
