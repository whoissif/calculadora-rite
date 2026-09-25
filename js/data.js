/* ═════════════════════════════════════════════
   Datos normativos y constructivos
   Fuentes:
   - CTE DB-HE 2019: tabla 3.1.1.a-HE1 (Ulim) y tabla a-Anejo B (zonas climáticas)
   - RITE IT 1.1.4.1 (condiciones interiores) e IT 1.1.4.2 (calidad del aire interior)
   - CTE DB-HS3 2019: tabla 2.1 (caudales de ventilación en viviendas)
   - IDAE / ATECYR (2010): Guía técnica de condiciones climáticas exteriores de proyecto
   - UNE-EN 12831: pérdidas por el terreno (factores fg1, fg2)
═════════════════════════════════════════════ */

// Nombre de la zona climática de invierno (letra) y de verano (número)
const ZW = {
  'α': 'Zona α — Muy suave (Canarias)',
  A: 'Zona A — Muy suave',
  B: 'Zona B — Suave',
  C: 'Zona C — Moderada',
  D: 'Zona D — Fría',
  E: 'Zona E — Muy fría'
};
const ZS = {
  '1': 'verano 1',
  '2': 'verano 2',
  '3': 'verano 3',
  '4': 'verano 4'
};

// Transmitancias límite CTE DB-HE 2019, tabla 3.1.1.a-HE1 [W/m²K]
//  muro: muros y suelos en contacto con el aire exterior (UM, US)
//  cub:  cubiertas en contacto con el aire exterior (UC)
//  sue:  elementos en contacto con el terreno o con espacios no habitables (UT)
//  ven:  huecos, conjunto de marco + vidrio (UH)
const CTE_LIM = {
  'α': { muro: 0.80, cub: 0.55, sue: 0.90, ven: 3.2 },
  A:   { muro: 0.70, cub: 0.50, sue: 0.80, ven: 2.7 },
  B:   { muro: 0.56, cub: 0.44, sue: 0.75, ven: 2.3 },
  C:   { muro: 0.49, cub: 0.40, sue: 0.70, ven: 2.1 },
  D:   { muro: 0.41, cub: 0.35, sue: 0.65, ven: 1.8 },
  E:   { muro: 0.37, cub: 0.33, sue: 0.59, ven: 1.8 }
};

// Coeficiente global de transmisión de calor de la envolvente: K = ΣHx / Aint [W/m²K]
// Valores límite de las tablas 3.1.1.b-HE1 (uso residencial privado) y 3.1.1.c-HE1 (resto de usos).
// Las filas son la compacidad V/A de la envolvente: para 1 < V/A < 4 el límite se interpola.
const K_LIM = {
  residencial: {
    // Edificios nuevos y ampliaciones
    nuevo: {
      va1: { 'α': 0.67, A: 0.60, B: 0.58, C: 0.53, D: 0.48, E: 0.43 },
      va4: { 'α': 0.86, A: 0.80, B: 0.77, C: 0.72, D: 0.67, E: 0.62 }
    },
    // Cambios de uso y reformas en las que se renueve más del 25 % de la envolvente
    reforma: {
      va1: { 'α': 1.00, A: 0.87, B: 0.83, C: 0.73, D: 0.63, E: 0.54 },
      va4: { 'α': 1.07, A: 0.94, B: 0.90, C: 0.81, D: 0.70, E: 0.62 }
    }
  },
  // Edificios nuevos, ampliaciones, cambios de uso y reformas (una sola tabla para todos)
  otros: {
    va1: { 'α': 0.96, A: 0.81, B: 0.76, C: 0.65, D: 0.54, E: 0.43 },
    va4: { 'α': 1.12, A: 0.98, B: 0.92, C: 0.82, D: 0.70, E: 0.59 }
  }
};

// Soluciones constructivas típicas de la envolvente (U en W/m²K, g factor solar del vidrio)
const ENV = {
  muro: [
    { id: 'm0', title: 'Sin aislamiento', sub: 'Fábrica ladrillo simple, anterior a 1980', U: 1.80 },
    { id: 'm1', title: 'Aislamiento básico (3–4 cm)', sub: 'Edificios años 80–90', U: 0.75 },
    { id: 'm2', title: 'Aislamiento medio (6–8 cm)', sub: 'Edificios años 90–2010', U: 0.50 },
    { id: 'm3', title: 'Aislamiento bueno (10–12 cm)', sub: 'Edificios 2010–2019', U: 0.35 },
    { id: 'm4', title: 'Aislamiento muy bueno (>15 cm)', sub: 'Post-2019 / Passivhaus', U: 0.20 }
  ],
  cub: [
    { id: 'c0', title: 'Sin aislamiento', sub: 'Cubierta plana sin aislamiento térmico', U: 2.50 },
    { id: 'c1', title: 'Aislamiento básico (3–5 cm)', sub: 'Edificios años 80–90', U: 0.50 },
    { id: 'c2', title: 'Aislamiento medio (8–10 cm)', sub: 'Estándar actual', U: 0.35 },
    { id: 'c3', title: 'Aislamiento bueno (>12 cm)', sub: 'Alta eficiencia energética', U: 0.25 }
  ],
  // Solera sobre el terreno
  sue: [
    { id: 's0', title: 'Sin aislamiento', sub: 'Solera en contacto con el terreno', U: 1.50 },
    { id: 's1', title: 'Aislamiento básico (5 cm XPS)', sub: 'Estándar bajo solera', U: 0.65 },
    { id: 's2', title: 'Aislamiento bueno (8–10 cm XPS)', sub: 'Alta eficiencia', U: 0.45 }
  ],
  // Forjado sobre el aire exterior o sobre un local no calefactado
  sueA: [
    { id: 'f0', title: 'Forjado sin aislamiento', sub: 'Forjado de hormigón, flujo descendente', U: 2.40 },
    { id: 'f1', title: 'Aislamiento básico (4–5 cm)', sub: 'Panel aislante bajo solado o en el techo del local inferior', U: 0.60 },
    { id: 'f2', title: 'Aislamiento bueno (8–10 cm)', sub: 'Alta eficiencia', U: 0.35 }
  ],
  ven: [
    { id: 'v0', title: 'Vidrio simple + carpintería metálica', sub: 'Sin RPT, anterior a 1990', U: 5.70, g: 0.85 },
    { id: 'v1', title: 'Doble vidrio + carpintería metálica', sub: 'Sin RPT, años 90–2000', U: 3.30, g: 0.75 },
    { id: 'v2', title: 'Doble vidrio + PVC / Al. RPT', sub: 'Estándar con rotura de puente térmico', U: 2.50, g: 0.70 },
    { id: 'v3', title: 'Doble vidrio bajo emisivo + RPT', sub: 'Argón, Low-e, alta eficiencia', U: 1.80, g: 0.60 },
    { id: 'v4', title: 'Triple vidrio + RPT', sub: 'Passivhaus / máxima eficiencia', U: 1.20, g: 0.50 }
  ]
};

// Envolvente típica según el año de construcción (se preselecciona; el usuario puede cambiarla)
const ENV_BY_YEAR = {
  pre1980: { muro: 'm0', cub: 'c0', sue: 's0', ven: 'v0', inf: '0.80' },
  '80_00': { muro: 'm1', cub: 'c1', sue: 's0', ven: 'v1', inf: '0.50' },
  '00_13': { muro: 'm2', cub: 'c1', sue: 's1', ven: 'v2', inf: '0.50' },
  '13_19': { muro: 'm3', cub: 'c2', sue: 's1', ven: 'v3', inf: '0.30' },
  post19:  { muro: 'm4', cub: 'c3', sue: 's2', ven: 'v3', inf: '0.30' }
};

// Uso del edificio: categoría IDA por defecto (RITE IT 1.1.4.2.1) y si se usa el percentil
// de invierno 99,6 % (guía IDAE: hospitales, clínicas, residencias de ancianos)
const USO = {
  residencial: { ida: null,   w996: false },
  oficinas:    { ida: 'IDA2', w996: false },
  comercial:   { ida: 'IDA3', w996: false },
  sanitario:   { ida: 'IDA1', w996: true },
  industrial:  { ida: 'IDA4', w996: false }
};

// RITE tabla 1.4.2.1 — caudal de aire exterior por persona [l/s·persona]
// RITE tabla 1.4.2.4 — caudal por unidad de superficie [l/s·m²] (IDA 1: no aplicable)
const IDA = {
  IDA1: { qp: 20,   qs: null },
  IDA2: { qp: 12.5, qs: 0.83 },
  IDA3: { qp: 8,    qs: 0.55 },
  IDA4: { qp: 5,    qs: 0.28 }
};

// CTE DB-HS3 tabla 2.1 — viviendas, caudal constante [l/s]
// Admisión: dormitorio principal 8, resto de dormitorios 4, salas de estar y comedores según tipo.
// Extracción mínima total en cuartos húmedos según tipo. Caudal de la vivienda = máx(admisión, extracción).
const HS3 = {
  sala:   n => n <= 1 ? 6 : n === 2 ? 8 : 10,
  extMin: n => n <= 1 ? 12 : n === 2 ? 24 : 33
};

// Tipo de suelo inferior
//  lim: fila de la tabla 3.1.1.a-HE1 con la que se compara (muro = US, suelos en contacto con el aire exterior)
//  b:   factor de reducción de temperatura del local inferior (UNE-EN 12831; valor orientativo para local cerrado)
const SUELO = {
  terreno: { opts: 'sue',  lim: 'sue',  b: null, label: 'Suelo sobre el terreno' },
  aire:    { opts: 'sueA', lim: 'muro', b: 1.0,  label: 'Forjado sobre espacio exterior' },
  nocal:   { opts: 'sueA', lim: 'sue',  b: 0.5,  label: 'Forjado sobre local no calefactado' }
};

// Ganancias por ocupante, actividad ligera (sentado / trabajo ligero) [W]
const PERSONA = { sens: 75, lat: 55 };

// ─── Refrigeración: cálculo hora a hora de un día de proyecto (21 de julio)
// Cielo despejado, modelo ASHRAE (julio): E_DN = A / exp(B / sen β); difusa horizontal = C · E_DN
const SOL = { dia: 202, A: 1085, B: 0.207, C: 0.136, rhoSuelo: 0.2 };
// Perfil de temperatura del día de proyecto: T(h) = T_máx − OMDR · fracción (ASHRAE; hora solar 1–24, máximo a las 15 h)
const PERFIL_T = [0.87, 0.92, 0.96, 0.99, 1.00, 0.98, 0.93, 0.84, 0.71, 0.56, 0.39, 0.23,
                  0.11, 0.03, 0.00, 0.03, 0.10, 0.21, 0.34, 0.47, 0.58, 0.68, 0.76, 0.82];
const H_EXT = 17;        // coeficiente superficial exterior [W/m²K]
const DR_CIELO = 3.9;    // corrección por radiación de onda larga en superficies horizontales [K]

// Absortividad solar de la superficie exterior según el color
const COLOR = { claro: 0.3, medio: 0.6, oscuro: 0.9 };

// Inercia térmica (valores orientativos):
//  f:   fracción de la ganancia solar por ventanas que se convierte en carga en la misma hora
//       (el resto se reparte a lo largo del día)
//  lam: amortiguamiento de la onda térmica en muros y cubierta
//  lag: desfase de la onda térmica [h]
const INERCIA = {
  ligera: { f: 0.85, lam: 0.80, lag: 2 },
  media:  { f: 0.70, lam: 0.40, lag: 6 },
  pesada: { f: 0.60, lam: 0.20, lag: 10 }
};

// Fachadas: orientación de la normal respecto al norte (sentido horario) antes del giro del edificio
const FACHADAS = [
  { id: 'N', az: 0 },
  { id: 'E', az: 90 },
  { id: 'S', az: 180 },
  { id: 'W', az: 270 }
];
const RUMBOS = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];

// Provincias: zona climática CTE por altitud (tabla a-Anejo B; cada par es [altitud mínima en m, zona]),
// altitud de la capital (CTE) y estaciones IDAE de la provincia (la primera es la de referencia de la capital).
//  w99 / w996: temperatura seca de invierno, percentiles 99 % y 99,6 % [°C]
//  s1 / wb1:   temperatura seca de verano (percentil 1 %) y húmeda coincidente [°C]
//  tm:         temperatura media anual (media de los valores mensuales) [°C]
//  lat / dr:   latitud [°] y oscilación media diaria de verano (OMDR) [°C]
const PROV = [
  { name: "Albacete", cap: "Albacete", h: 686,
    zones: [[0, "C3"], [451, "D3"], [951, "E1"]],
    st: [
      { code: '8175', name: "Albacete (Los Llanos-Base Aérea)", h: 704, w99: -3.0, w996: -4.7, s1: 34.2, wb1: 19.3, tm: 14.4, lat: 38.95, dr: 18.8 },
      { code: '7096B', name: "Hellín (Bomberos)", h: 520, w99: 1.5, w996: 0.0, s1: 36.7, wb1: 21.6, tm: 17.3, lat: 38.51, dr: 20.3 },
    ] },
  { name: "Alicante / Alacant", cap: "Alicante/Alacant", h: 8,
    zones: [[0, "B4"], [251, "C3"], [701, "D3"]],
    st: [
      { code: '8025', name: "Alicante (Ciudad Jardín)", h: 82, w99: 4.4, w996: 3.2, s1: 31.2, wb1: 22.8, tm: 18.3, lat: 38.37, dr: 11.8 },
      { code: '8019', name: "Alicante (El Altet)", h: 31, w99: 4.1, w996: 2.8, s1: 31.3, wb1: 21.4, tm: 18.3, lat: 38.29, dr: 12.5 },
    ] },
  { name: "Almería", cap: "Almería", h: 16,
    zones: [[0, "A4"], [101, "B4"], [251, "B3"], [401, "C3"], [801, "D3"]],
    st: [
      { code: '6325O', name: "Almería (Aeropuerto)", h: 20, w99: 7.5, w996: 6.5, s1: 32.4, wb1: 21.1, tm: 18.8, lat: 36.84, dr: 11.7 },
    ] },
  { name: "Araba / Álava", cap: "Vitoria-Gasteiz", h: 540,
    zones: [[0, "D1"], [601, "E1"]],
    st: [
      { code: '9091O', name: "Vitoria (Aeropuerto de Foronda)", h: 508, w99: -2.4, w996: -4.0, s1: 30.0, wb1: 21.4, tm: 11.7, lat: 42.88, dr: 20.0 },
    ] },
  { name: "Asturias", cap: "Oviedo", h: 232,
    zones: [[0, "C1"], [51, "D1"], [551, "E1"]],
    st: [
      { code: '1249I', name: "Oviedo (El Cristo)", h: 336, w99: 1.2, w996: 0.0, s1: 25.8, wb1: 21.4, tm: 13.0, lat: 43.35, dr: 13.6 },
      { code: '1212E', name: "Ranón (Aeropuerto de Asturias)", h: 127, w99: 3.0, w996: 1.8, s1: 23.5, wb1: 19.7, tm: 13.5, lat: 43.56, dr: 10.3 },
    ] },
  { name: "Ávila", cap: "Ávila", h: 1131,
    zones: [[0, "D2"], [551, "D1"], [851, "E1"]],
    st: [
      { code: '2444', name: "Ávila (Observatorio)", h: 1130, w99: -4.5, w996: -6.4, s1: 30.8, wb1: 18.0, tm: 11.4, lat: 40.65, dr: 16.8 },
    ] },
  { name: "Badajoz", cap: "Badajoz", h: 186,
    zones: [[0, "C4"], [401, "C3"], [451, "D3"]],
    st: [
      { code: '4452', name: "Badajoz (Talavera-Base Aérea)", h: 185, w99: 0.3, w996: -1.0, s1: 36.8, wb1: 22.9, tm: 16.9, lat: 38.88, dr: 19.7 },
    ] },
  { name: "Balears, Illes", cap: "Palma de Mallorca", h: 15,
    zones: [[0, "B3"], [251, "C3"]],
    st: [
      { code: 'B228', name: "Palma (Centro Meteorológico)", h: 3, w99: 6.3, w996: 5.2, s1: 30.4, wb1: 24.1, tm: 18.3, lat: 39.56, dr: 9.2 },
      { code: 'B013X', name: "Escorca (Monasterio Lluc-Automática)", h: 490, w99: -0.9, w996: -2.0, s1: 32.0, wb1: 22.5, tm: 14.3, lat: 39.82, dr: 16.6 },
      { code: 'B278', name: "Palma (Aeropuerto Son San Juan)", h: 4, w99: 1.5, w996: 0.3, s1: 32.2, wb1: 23.2, tm: 17.3, lat: 39.57, dr: 15.6 },
      { code: 'B434X', name: "Felanitx (Faro Portocolom-Automática)", h: 17, w99: 5.7, w996: 4.6, s1: 29.9, wb1: 25.7, tm: 17.9, lat: 39.41, dr: 9.3 },
      { code: 'B569X', name: "Capdepera (Faro-Automática)", h: 70, w99: 7.4, w996: 6.2, s1: 29.7, wb1: 25.1, tm: 18.2, lat: 39.72, dr: 7.2 },
      { code: 'B780X', name: "Pollensa (Aeródromo-Automática)", h: 2, w99: 4.1, w996: 3.0, s1: 30.8, wb1: 24.3, tm: 17.3, lat: 39.9, dr: 12.2 },
      { code: 'B893', name: "Mahón (Aeropuerto de Menorca)", h: 85, w99: 5.6, w996: 4.6, s1: 30.2, wb1: 22.6, tm: 17.4, lat: 39.87, dr: 9.7 },
      { code: 'B954', name: "San José (Aeropuerto de Ibiza)", h: 16, w99: 5.7, w996: 4.6, s1: 30.6, wb1: 24.1, tm: 18.4, lat: 38.88, dr: 9.7 },
    ] },
  { name: "Barcelona", cap: "Barcelona", h: 12,
    zones: [[0, "C2"], [251, "D2"], [451, "D1"], [751, "E1"]],
    st: [
      { code: '0076', name: "Aeroport de Barcelona (El Prat)", h: 6, w99: 2.7, w996: 1.3, s1: 30.0, wb1: 24.6, tm: 16.4, lat: 41.3, dr: 9.2 },
      { code: '0200E', name: "Barcelona (Fabra)", h: 412, w99: 2.1, w996: 0.7, s1: 30.3, wb1: 22.7, tm: 15.5, lat: 41.42, dr: 10.2 },
      { code: '0208', name: "Granollers", h: 154, w99: 1.2, w996: -0.2, s1: 32.2, wb1: 22.0, tm: 16.1, lat: 41.61, dr: 13.8 },
    ] },
  { name: "Bizkaia", cap: "Bilbao/Bilbo", h: 6,
    zones: [[0, "C1"], [251, "D1"]],
    st: [
      { code: '1082', name: "Bilbao (Aeropuerto Sondica)", h: 39, w99: 1.2, w996: -0.2, s1: 28.8, wb1: 21.3, tm: 14.5, lat: 43.3, dr: 16.3 },
    ] },
  { name: "Burgos", cap: "Burgos", h: 929,
    zones: [[0, "D1"], [601, "E1"]],
    st: [
      { code: '2331', name: "Burgos (Villafría)", h: 890, w99: -4.2, w996: -5.8, s1: 31.4, wb1: 19.6, tm: 10.7, lat: 42.36, dr: 21.5 },
    ] },
  { name: "Cáceres", cap: "Cáceres", h: 459,
    zones: [[0, "C4"], [601, "D3"], [1051, "E1"]],
    st: [
      { code: '3469A', name: "Cáceres (Carretera Trujillo)", h: 405, w99: 1.2, w996: 0.0, s1: 36.4, wb1: 21.3, tm: 16.4, lat: 39.47, dr: 16.6 },
    ] },
  { name: "Cádiz", cap: "Cádiz", h: 14,
    zones: [[0, "A3"], [151, "B3"], [451, "C3"], [601, "C2"], [851, "D2"]],
    st: [
      { code: '5973', name: "Cádiz (Cortadura)", h: 8, w99: 7.6, w996: 6.2, s1: 29.9, wb1: 22.8, tm: 18.5, lat: 36.5, dr: 8.9 },
      { code: '5910', name: "Rota (Base Naval)", h: 21, w99: 4.2, w996: 2.8, s1: 33.0, wb1: 22.9, tm: 18.0, lat: 36.64, dr: 15.6 },
      { code: '5960', name: "Jerez de la Frontera (Aeropuerto)", h: 27, w99: 2.9, w996: 1.5, s1: 35.7, wb1: 23.1, tm: 18.0, lat: 36.75, dr: 18.6 },
    ] },
  { name: "Cantabria", cap: "Santander", h: 11,
    zones: [[0, "C1"], [151, "D1"], [651, "E1"]],
    st: [
      { code: '1111', name: "Santander (CMT)", h: 52, w99: 4.7, w996: 3.6, s1: 24.2, wb1: 20.1, tm: 14.7, lat: 43.49, dr: 9.2 },
      { code: '1109', name: "Parayas (Aeropuerto)", h: 6, w99: 2.6, w996: 1.0, s1: 25.6, wb1: 20.5, tm: 14.6, lat: 43.43, dr: 12.3 },
    ] },
  { name: "Castellón / Castelló", cap: "Castellón/Castelló", h: 27,
    zones: [[0, "B3"], [101, "C3"], [501, "D3"], [601, "D2"], [1001, "E1"]],
    st: [
      { code: '8500A', name: "Castellón (Almazora)", h: 35, w99: 4.4, w996: 3.0, s1: 31.4, wb1: 23.5, tm: 17.9, lat: 39.95, dr: 11.4 },
    ] },
  { name: "Ceuta", cap: "Ceuta", h: 40, lat: 35.89,
    zones: [[0, "B3"]],
    st: [
    ] },
  { name: "Ciudad Real", cap: "Ciudad Real", h: 628,
    zones: [[0, "C4"], [451, "C3"], [501, "D3"]],
    st: [
      { code: '4121', name: "Ciudad Real (Escuela de Magisterio)", h: 627, w99: -1.3, w996: -2.6, s1: 36.2, wb1: 21.8, tm: 15.7, lat: 38.99, dr: 17.8 },
    ] },
  { name: "Córdoba", cap: "Córdoba", h: 106,
    zones: [[0, "B4"], [151, "C4"], [551, "D3"]],
    st: [
      { code: '5402', name: "Córdoba (Aeropuerto)", h: 91, w99: 1.4, w996: 0.0, s1: 38.2, wb1: 23.7, tm: 18.0, lat: 37.84, dr: 20.2 },
    ] },
  { name: "A Coruña", cap: "A Coruña", h: 26,
    zones: [[0, "C1"], [201, "D1"]],
    st: [
      { code: '1387', name: "A Coruña (Estación completa)", h: 58, w99: 5.6, w996: 4.4, s1: 24.3, wb1: 19.8, tm: 14.7, lat: 43.37, dr: 10.8 },
      { code: '1387E', name: "A Coruña (Aeroporto)", h: 97, w99: 1.4, w996: 0.0, s1: 26.0, wb1: 20.6, tm: 14.0, lat: 43.3, dr: 14.5 },
      { code: '1428', name: "Santiago de Compostela (Labacolla)", h: 364, w99: 1.2, w996: -0.1, s1: 28.4, wb1: 21.2, tm: 12.6, lat: 43.9, dr: 17.5 },
      { code: '1393', name: "Cabo Vilán", h: 50, w99: 5.3, w996: 3.9, s1: 21.9, wb1: 18.7, tm: 13.7, lat: 43.16, dr: 8.9 },
    ] },
  { name: "Cuenca", cap: "Cuenca", h: 999,
    zones: [[0, "D3"], [801, "D2"], [1051, "E1"]],
    st: [
      { code: '8096', name: "Cuenca", h: 956, w99: -3.1, w996: -4.9, s1: 33.1, wb1: 18.7, tm: 13.3, lat: 40.07, dr: 16.9 },
    ] },
  { name: "Gipuzkoa", cap: "San Sebastián", h: 12,
    zones: [[0, "D1"], [401, "E1"]],
    st: [
      { code: '1014', name: "San Sebastián (Aeropuerto Fuenterrabía)", h: 8, w99: 1.0, w996: -0.6, s1: 28.6, wb1: 22.3, tm: 15.0, lat: 43.36, dr: 14.7 },
      { code: '1024E', name: "San Sebastián (Igueldo)", h: 252, w99: 1.0, w996: -0.2, s1: 26.6, wb1: 20.8, tm: 13.6, lat: 43.31, dr: 13.1 },
    ] },
  { name: "Girona", cap: "Girona", h: 70,
    zones: [[0, "C2"], [101, "D2"], [601, "E1"]],
    st: [
      { code: '367', name: "Aeroport de Girona (Costa Brava)", h: 127, w99: -1.9, w996: -3.1, s1: 32.2, wb1: 22.0, tm: 14.7, lat: 41.9, dr: 17.2 },
    ] },
  { name: "Granada", cap: "Granada", h: 683,
    zones: [[0, "A4"], [51, "B4"], [351, "C4"], [601, "C3"], [801, "D3"], [1301, "E1"]],
    st: [
      { code: '5514', name: "Granada (Base Aérea)", h: 687, w99: -0.6, w996: -2.0, s1: 35.3, wb1: 20.6, tm: 15.5, lat: 37.14, dr: 18.5 },
      { code: '5530E', name: "Granada (Aeropuerto)", h: 570, w99: -2.4, w996: -3.8, s1: 36.0, wb1: 20.6, tm: 15.4, lat: 37.19, dr: 21.0 },
    ] },
  { name: "Guadalajara", cap: "Guadalajara", h: 685,
    zones: [[0, "D3"], [951, "D2"], [1001, "E1"]],
    st: [
      { code: '3013', name: "Molina de Aragón", h: 1063, w99: -8.0, w996: -10.6, s1: 31.8, wb1: 19.9, tm: 10.5, lat: 40.84, dr: 22.3 },
    ] },
  { name: "Huelva", cap: "Huelva", h: 30,
    zones: [[0, "A4"], [51, "B4"], [151, "B3"], [351, "C3"], [801, "D3"]],
    st: [
      { code: '4642E', name: "Huelva (Ronda Este)", h: 19, w99: 3.6, w996: 2.2, s1: 34.4, wb1: 23.0, tm: 17.9, lat: 37.28, dr: 16.9 },
    ] },
  { name: "Huesca", cap: "Huesca", h: 488,
    zones: [[0, "C3"], [201, "D3"], [401, "D2"], [701, "E1"]],
    st: [
      { code: '9898', name: "Huesca (Monflorite)", h: 541, w99: -2.5, w996: -4.3, s1: 33.4, wb1: 21.5, tm: 13.8, lat: 42.08, dr: 16.1 },
    ] },
  { name: "Jaén", cap: "Jaén", h: 568,
    zones: [[0, "B4"], [351, "C4"], [751, "D3"], [1251, "E1"]],
    st: [
      { code: '5270B', name: "Jaén (Cerro de los Lirios)", h: 580, w99: 2.6, w996: 0.8, s1: 35.0, wb1: 22.9, tm: 17.2, lat: 37.78, dr: 13.0 },
    ] },
  { name: "León", cap: "León", h: 838,
    zones: [[0, "E1"]],
    st: [
      { code: '2661', name: "León (Virgen del Camino)", h: 916, w99: -3.8, w996: -5.0, s1: 30.0, wb1: 18.7, tm: 10.9, lat: 42.59, dr: 16.9 },
      { code: '1549', name: "Ponferrada", h: 534, w99: -3.4, w996: -4.5, s1: 32.6, wb1: 22.0, tm: 12.9, lat: 42.56, dr: 20.0 },
    ] },
  { name: "Lleida", cap: "Lleida", h: 182,
    zones: [[0, "C3"], [101, "D3"], [601, "E1"]],
    st: [
      { code: '9771C', name: "Lleida (Observatori 2)", h: 192, w99: -2.8, w996: -4.4, s1: 34.0, wb1: 22.2, tm: 14.8, lat: 41.63, dr: 17.2 },
    ] },
  { name: "Lugo", cap: "Lugo", h: 454,
    zones: [[0, "D1"], [501, "E1"]],
    st: [
      { code: '1505', name: "Rozas (Aeródromo)", h: 444, w99: -2.5, w996: -3.8, s1: 28.0, wb1: 20.8, tm: 11.6, lat: 43.12, dr: 20.3 },
    ] },
  { name: "Madrid", cap: "Madrid", h: 655,
    zones: [[0, "C3"], [501, "D3"], [951, "D2"], [1001, "E1"]],
    st: [
      { code: '3195', name: "Madrid (Retiro)", h: 667, w99: 0.3, w996: -0.8, s1: 33.6, wb1: 21.1, tm: 14.9, lat: 40.41, dr: 13.9 },
      { code: '2462', name: "Navacerrada (Puerto)", h: 1890, w99: -8.2, w996: -9.8, s1: 24.8, wb1: 14.6, tm: 6.7, lat: 40.78, dr: 11.6 },
      { code: '3129', name: "Madrid (Barajas)", h: 582, w99: -2.4, w996: -3.8, s1: 35.2, wb1: 19.0, tm: 14.6, lat: 40.45, dr: 18.7 },
      { code: '3175', name: "Torrejón de Ardoz (Base Aérea)", h: 611, w99: -2.0, w996: -3.6, s1: 35.4, wb1: 20.8, tm: 14.7, lat: 40.48, dr: 18.6 },
      { code: '3191E', name: "Colmenar Viejo (FAMET)", h: 1004, w99: -1.0, w996: -2.4, s1: 31.8, wb1: 18.5, tm: 13.2, lat: 40.7, dr: 13.0 },
      { code: '3196', name: "Cuatro Vientos (Aeródromo)", h: 687, w99: -0.1, w996: -1.4, s1: 34.8, wb1: 19.8, tm: 15.1, lat: 40.38, dr: 15.9 },
      { code: '3200', name: "Getafe (Base Aérea)", h: 617, w99: -0.8, w996: -2.2, s1: 34.8, wb1: 20.0, tm: 15.2, lat: 40.3, dr: 15.8 },
      { code: '3100B', name: "Aranjuez (Comunidad)", h: 520, w99: -3.2, w996: -4.6, s1: 36.4, wb1: 23.5, tm: 14.9, lat: 40.07, dr: 20.1 },
      { code: '3110C', name: "Buitrago (Automática)", h: 974, w99: -3.5, w996: -5.2, s1: 31.1, wb1: 19.6, tm: 11.4, lat: 41.01, dr: 20.1 },
      { code: '3338', name: "Robledo de Chavela", h: 790, w99: -1.4, w996: -2.9, s1: 33.8, wb1: 22.0, tm: 14.2, lat: 40.43, dr: 16.2 },
    ] },
  { name: "Málaga", cap: "Málaga", h: 11,
    zones: [[0, "A3"], [101, "B3"], [301, "C3"], [701, "D3"]],
    st: [
      { code: '6155A', name: "Málaga (Aeropuerto)", h: 7, w99: 5.8, w996: 4.4, s1: 33.2, wb1: 21.8, tm: 18.5, lat: 36.67, dr: 14.7 },
    ] },
  { name: "Melilla", cap: "Melilla", h: 15,
    zones: [[0, "A3"]],
    st: [
      { code: '6000A', name: "Melilla", h: 55, w99: 8.4, w996: 7.4, s1: 30.2, wb1: 21.6, tm: 18.8, lat: 35.28, dr: 9.8 },
    ] },
  { name: "Murcia", cap: "Murcia", h: 39,
    zones: [[0, "B3"], [101, "C3"], [551, "D3"]],
    st: [
      { code: '7178I', name: "Murcia", h: 62, w99: 3.5, w996: 2.0, s1: 34.8, wb1: 22.2, tm: 18.6, lat: 38.0, dr: 16.1 },
      { code: '7002X', name: "Águilas (Parque de Bomberos-Automático)", h: 26, w99: 5.7, w996: 4.7, s1: 30.1, wb1: 22.6, tm: 18.3, lat: 37.42, dr: 10.1 },
      { code: '7012C', name: "Cartagena (Ciudad)", h: 17, w99: 7.1, w996: 5.9, s1: 31.3, wb1: 24.0, tm: 19.5, lat: 37.6, dr: 9.1 },
      { code: '7031', name: "Murcia (San Javier)", h: 2, w99: 4.0, w996: 2.5, s1: 30.2, wb1: 23.7, tm: 18.3, lat: 37.79, dr: 11.8 },
      { code: '7145D', name: "Cieza (Parque de Bomberos)", h: 265, w99: 1.5, w996: 0.1, s1: 34.7, wb1: 22.5, tm: 17.2, lat: 38.24, dr: 17.4 },
      { code: '7209', name: "Lorca (CCA)", h: 320, w99: 1.9, w996: 0.6, s1: 34.0, wb1: 22.9, tm: 17.2, lat: 37.65, dr: 16.9 },
      { code: '7228', name: "Murcia (Alcantarilla)", h: 85, w99: 2.2, w996: 0.8, s1: 35.0, wb1: 22.0, tm: 18.4, lat: 37.96, dr: 17.4 },
      { code: '7275B', name: "Yecla (Coop. Frutas)", h: 590, w99: 0.7, w996: -0.8, s1: 34.3, wb1: 21.9, tm: 15.8, lat: 38.61, dr: 17.6 },
    ] },
  { name: "Navarra", cap: "Pamplona/Iruña", h: 490,
    zones: [[0, "C2"], [101, "D2"], [351, "D1"], [601, "E1"]],
    st: [
      { code: '9263D', name: "Pamplona (Noain)", h: 452, w99: -2.0, w996: -3.8, s1: 32.4, wb1: 20.6, tm: 12.8, lat: 42.77, dr: 19.2 },
      { code: '9174X', name: "Sartaguda (Automática)", h: 310, w99: -1.1, w996: -2.8, s1: 32.4, wb1: 23.1, tm: 13.7, lat: 42.37, dr: 17.9 },
    ] },
  { name: "Ourense", cap: "Ourense", h: 139,
    zones: [[0, "C3"], [151, "C2"], [301, "D2"], [801, "E1"]],
    st: [
      { code: '1690A', name: "Ourense (Granxa Deputación)", h: 143, w99: -1.4, w996: -2.6, s1: 33.9, wb1: 22.5, tm: 14.5, lat: 42.33, dr: 21.5 },
    ] },
  { name: "Palencia", cap: "Palencia", h: 734,
    zones: [[0, "D1"], [801, "E1"]],
    st: [
      { code: '2400E', name: "Autilla del Pino (Observatorio Meteorológico)", h: 860, w99: -3.6, w996: -4.9, s1: 30.8, wb1: 19.1, tm: 10.8, lat: 42.0, dr: 17.7 },
    ] },
  { name: "Las Palmas", cap: "Las Palmas de Gran Canaria", h: 13,
    zones: [[0, "α3"], [351, "A2"], [751, "B2"], [1001, "C2"]],
    st: [
      { code: 'C649I', name: "Telde (Aeropuerto de Gran Canaria-Gando)", h: 24, w99: 14.4, w996: 13.8, s1: 28.4, wb1: 21.0, tm: 20.9, lat: 27.93, dr: 9.1 },
      { code: 'C689E', name: "San Bartolomé Tirajana (Hotel Faro Maspalomas)", h: 25, w99: 14.3, w996: 13.6, s1: 27.1, wb1: 18.5, tm: 20.6, lat: 27.73, dr: 8.4 },
      { code: 'C029O', name: "San Bartolomé (Aeropuerto Lanzarote)", h: 9, w99: 13.5, w996: 12.7, s1: 29.4, wb1: 21.9, tm: 20.8, lat: 28.95, dr: 10.5 },
      { code: 'C249I', name: "Puerto del Rosario (Aeropuerto El Matorral)", h: 29, w99: 13.2, w996: 12.4, s1: 28.7, wb1: 22.1, tm: 20.6, lat: 28.45, dr: 8.8 },
    ] },
  { name: "Pontevedra", cap: "Pontevedra", h: 27,
    zones: [[0, "C1"], [351, "D1"]],
    st: [
      { code: '1484C', name: "Pontevedra (Mourente)", h: 107, w99: 3.3, w996: 2.1, s1: 29.4, wb1: 22.0, tm: 14.5, lat: 42.44, dr: 16.1 },
      { code: '1495', name: "Vigo (Peinador)", h: 255, w99: 2.8, w996: 1.8, s1: 28.6, wb1: 21.1, tm: 13.8, lat: 42.22, dr: 14.3 },
    ] },
  { name: "La Rioja", cap: "Logroño", h: 385,
    zones: [[0, "C2"], [201, "D2"], [701, "E1"]],
    st: [
      { code: '9170', name: "Logroño (Agoncillo)", h: 352, w99: -1.1, w996: -3.0, s1: 33.2, wb1: 21.5, tm: 13.8, lat: 42.45, dr: 19.2 },
    ] },
  { name: "Salamanca", cap: "Salamanca", h: 800,
    zones: [[0, "D2"], [851, "E1"]],
    st: [
      { code: '2867', name: "Salamanca (Matacán)", h: 790, w99: -4.4, w996: -5.8, s1: 32.0, wb1: 19.5, tm: 12.0, lat: 40.95, dr: 20.9 },
    ] },
  { name: "Santa Cruz de Tenerife", cap: "Santa Cruz de Tenerife", h: 5,
    zones: [[0, "α3"], [351, "A2"], [751, "B2"], [1001, "C2"]],
    st: [
      { code: 'C449C', name: "Santa Cruz de Tenerife", h: 36, w99: 14.6, w996: 14.0, s1: 30.0, wb1: 22.1, tm: 21.2, lat: 28.45, dr: 9.5 },
      { code: 'C139E', name: "Mazo (Aeropuerto)", h: 40, w99: 14.6, w996: 13.9, s1: 27.0, wb1: 22.4, tm: 20.7, lat: 28.61, dr: 7.0 },
      { code: 'C429I', name: "Reina Sofía (Aeropuerto Tenerife Sur)", h: 64, w99: 14.1, w996: 13.5, s1: 30.0, wb1: 20.3, tm: 21.2, lat: 28.04, dr: 11.0 },
      { code: 'C447A', name: "Los Rodeos (Aeropuerto Tenerife Norte)", h: 617, w99: 8.9, w996: 8.2, s1: 28.6, wb1: 19.4, tm: 16.3, lat: 28.47, dr: 12.4 },
      { code: 'C929I', name: "Cangrejos (Aeropuerto)", h: 30, w99: 16.3, w996: 15.7, s1: 26.9, wb1: 22.8, tm: 21.0, lat: 27.81, dr: 6.0 },
    ] },
  { name: "Segovia", cap: "Segovia", h: 1002,
    zones: [[0, "D2"], [1051, "E1"]],
    st: [
      { code: '2465', name: "Segovia (Observatorio)", h: 1005, w99: -3.4, w996: -5.2, s1: 32.1, wb1: 18.2, tm: 12.3, lat: 40.95, dr: 16.0 },
    ] },
  { name: "Sevilla", cap: "Sevilla", h: 11,
    zones: [[0, "B4"], [201, "C4"]],
    st: [
      { code: '5783', name: "Sevilla (Aeropuerto)", h: 26, w99: 4.5, w996: 3.1, s1: 37.6, wb1: 23.6, tm: 19.3, lat: 37.42, dr: 17.4 },
      { code: '5796', name: "Morón de la Frontera (Base Aérea)", h: 87, w99: 2.0, w996: 0.6, s1: 37.2, wb1: 23.6, tm: 17.9, lat: 37.16, dr: 19.2 },
    ] },
  { name: "Soria", cap: "Soria", h: 1063,
    zones: [[0, "D2"], [751, "D1"], [801, "E1"]],
    st: [
      { code: '2030', name: "Soria (Observatorio)", h: 1082, w99: -4.8, w996: -6.4, s1: 31.0, wb1: 18.7, tm: 10.9, lat: 41.77, dr: 19.6 },
      { code: '2005X', name: "Vinuesa (Automática)", h: 1197, w99: -5.6, w996: -7.2, s1: 28.7, wb1: 19.0, tm: 8.9, lat: 41.97, dr: 20.2 },
    ] },
  { name: "Tarragona", cap: "Tarragona", h: 69,
    zones: [[0, "B3"], [101, "C3"], [501, "D3"]],
    st: [
      { code: '0016A', name: "Reus (Aeroport)", h: 68, w99: 0.5, w996: -1.2, s1: 30.8, wb1: 21.7, tm: 16.3, lat: 41.15, dr: 13.2 },
      { code: '9981A', name: "Tortosa (Observatorio del Ebro)", h: 48, w99: 2.4, w996: 1.0, s1: 33.4, wb1: 23.3, tm: 17.4, lat: 40.82, dr: 15.0 },
    ] },
  { name: "Teruel", cap: "Teruel", h: 912,
    zones: [[0, "C3"], [451, "C2"], [501, "D2"], [1001, "E1"]],
    st: [
      { code: '8368U', name: "Teruel", h: 900, w99: -6.1, w996: -8.1, s1: 32.6, wb1: 19.6, tm: 11.9, lat: 40.35, dr: 21.5 },
    ] },
  { name: "Toledo", cap: "Toledo", h: 629,
    zones: [[0, "C4"], [501, "D3"]],
    st: [
      { code: '3260B', name: "Toledo (Buenavista)", h: 516, w99: -1.2, w996: -2.6, s1: 36.6, wb1: 20.9, tm: 15.8, lat: 39.88, dr: 17.6 },
      { code: '4067', name: "Madridejos", h: 690, w99: -3.6, w996: -4.9, s1: 35.3, wb1: 22.6, tm: 13.9, lat: 39.47, dr: 20.4 },
    ] },
  { name: "Valencia / València", cap: "Valencia", h: 13,
    zones: [[0, "B3"], [51, "C3"], [501, "D2"], [951, "E1"]],
    st: [
      { code: '8416', name: "Valencia", h: 11, w99: 5.5, w996: 4.4, s1: 31.3, wb1: 22.6, tm: 18.4, lat: 39.48, dr: 12.3 },
      { code: '8414A', name: "Valencia (Manises)", h: 57, w99: 2.6, w996: 1.2, s1: 32.0, wb1: 21.9, tm: 17.7, lat: 39.49, dr: 13.9 },
    ] },
  { name: "Valladolid", cap: "Valladolid", h: 698,
    zones: [[0, "D2"], [801, "E1"]],
    st: [
      { code: '2422', name: "Valladolid (Observatorio)", h: 735, w99: -2.8, w996: -4.1, s1: 33.2, wb1: 19.3, tm: 12.5, lat: 41.65, dr: 19.1 },
      { code: '2539', name: "Valladolid (Villanubla)", h: 846, w99: -4.0, w996: -5.2, s1: 31.8, wb1: 18.9, tm: 11.4, lat: 41.7, dr: 18.9 },
    ] },
  { name: "Zamora", cap: "Zamora", h: 649,
    zones: [[0, "D2"], [801, "E1"]],
    st: [
      { code: '2614', name: "Zamora (Observatorio)", h: 656, w99: -3.2, w996: -4.6, s1: 33.0, wb1: 20.1, tm: 13.0, lat: 41.52, dr: 18.5 },
    ] },
  { name: "Zaragoza", cap: "Zaragoza", h: 199,
    zones: [[0, "C3"], [201, "D3"], [651, "E1"]],
    st: [
      { code: '9434', name: "Zaragoza (Aeropuerto)", h: 247, w99: -1.1, w996: -3.0, s1: 34.5, wb1: 21.7, tm: 15.2, lat: 41.66, dr: 17.1 },
      { code: '9390', name: "Daroca (Observatorio)", h: 779, w99: -4.6, w996: -6.5, s1: 33.6, wb1: 20.0, tm: 13.1, lat: 41.11, dr: 18.3 },
    ] },
];
