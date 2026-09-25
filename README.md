# Calculadora de Necesidades Térmicas RITE

Herramienta web interactiva para el cálculo de cargas térmicas de calefacción y refrigeración en edificios, según la normativa española **RITE** (Reglamento de Instalaciones Térmicas en los Edificios) y el **CTE DB-HE 2019**.

## Demo en vivo

**https://whoissif.github.io/calculadora-rite/**

El sitio se sirve directamente desde la rama `main` con GitHub Pages: sin compilación, sin dependencias y sin paso de despliegue. Código fuente en [github.com/whoissif/calculadora-rite](https://github.com/whoissif/calculadora-rite).

## Características

- **Asistente paso a paso**: cuatro pasos pensados para instaladores sin experiencia en cálculo.
- **Zona climática CTE** a partir de la provincia y la altitud (tabla a-Anejo B del DB-HE 2019), incluida la zona α de Canarias.
- **Temperaturas exteriores de proyecto** de la guía técnica del IDAE a la que remite el RITE (104 estaciones), con corrección por altitud. Son editables.
- **Envolvente térmica**: muros, cubierta, suelo y ventanas, con comprobación de la transmitancia límite del CTE DB-HE 2019. Se preselecciona una envolvente típica según el año de construcción, y cada elemento admite un valor de U (y g en ventanas) conocido.
- **Posición en el edificio**: edificio completo, última planta, planta más baja o planta intermedia.
- **Suelo inferior** sobre el terreno, sobre el aire exterior (porche, garaje abierto, voladizo) o sobre un local no calefactado.
- **Fachadas por orientación**: longitud total de muro, la parte que no da al exterior (medianeras y paredes con otros locales calefactados, que se descuentan solas), porcentaje de acristalamiento y ángulo de obstrucción de los edificios de enfrente en cada una de las cuatro fachadas, con giro del edificio respecto al norte.
- **Ventilación**: CTE DB-HS3 en viviendas, RITE IT 1.1.4.2 (IDA, caudal por persona) en el resto de usos, con o sin recuperador de calor.
- **Calefacción** (UNE-EN 12831 simplificada):
  - Transmisión por muros, cubierta y ventanas.
  - Suelo sobre el terreno con los factores fg1 y fg2; forjado sobre el aire exterior con U·A·ΔT; sobre local no calefactado con el factor b.
  - Puentes térmicos (10 % de la transmisión).
  - Aire exterior: el mayor entre ventilación e infiltraciones; con doble flujo se aplica la recuperación sensible a la fracción de caudal que pasa por el intercambiador (la carga latente no varía, porque el recuperador no recupera humedad).
- **Refrigeración**, calculada hora a hora para el 21 de julio, tomando la hora de carga máxima:
  - Posición del sol según la latitud y radiación de cielo despejado (ASHRAE) sobre cada fachada y la cubierta.
  - Sombras de edificios cercanos mediante el ángulo de obstrucción de cada fachada.
  - Temperatura exterior horaria a partir de la máxima y la oscilación diaria (guía IDAE).
  - Muros y cubierta con temperatura sol-aire, amortiguamiento y desfase según la inercia.
  - Ganancia solar por ventanas con factor solar, ángulo de incidencia, protección y almacenamiento en la masa del edificio.
  - Carga sensible y latente de ocupantes y aire exterior, con la densidad y la presión del aire según la altitud.
  - Iluminación y equipos.
- **Margen de seguridad** del 15 % sobre la carga calculada.
- **Informe imprimible** desde el navegador.
- **HTML, CSS y JavaScript sin dependencias**: sin frameworks, sin compilación, sin servidor.

## Metodología y fuentes

| Parámetro | Fuente |
|-----------|--------|
| Zona climática | CTE DB-HE 2019, tabla a-Anejo B (provincia y altitud) |
| Temperaturas exteriores | IDAE/ATECYR (2010), *Guía técnica de condiciones climáticas exteriores de proyecto*: invierno percentil 99 % (99,6 % en uso sanitario), verano percentil 1 % |
| Corrección por altitud | 0,65 °C cada 100 m de diferencia con la estación |
| Condiciones interiores | RITE IT 1.1.4.1, tabla 1.4.1.1: invierno 21–23 °C, verano 23–25 °C |
| Ventilación en viviendas | CTE DB-HS3, tabla 2.1 (caudal constante) |
| Ventilación en otros usos | RITE IT 1.1.4.2, tabla 1.4.2.1 (l/s por persona según IDA) |
| Recuperación de calor | RITE IT 1.2.4.5.2: obligatoria si el aire expulsado supera 0,5 m³/s |
| Transmitancias límite | CTE DB-HE 2019, tabla 3.1.1.a-HE1 |
| Pérdidas de calefacción | UNE-EN 12831 (simplificada) |
| Radiación solar | ASHRAE, cielo despejado de julio (A = 1085 W/m², B = 0,207, C = 0,136) |
| Perfil diario de temperatura | ASHRAE, fracciones de la oscilación diaria; oscilación de la guía IDAE |

La herramienta no calcula el coeficiente global K de la envolvente que también exige el CTE.

## Estructura del proyecto

```
calculadora-rite/
├── index.html        # Estructura de la interfaz (asistente de 4 pasos + resultados)
├── css/
│   └── styles.css    # Estilos y tokens de diseño
├── js/
│   ├── data.js       # Datos normativos: zonas CTE por provincia y altitud, estaciones IDAE, límites U, caudales, radiación
│   └── app.js        # Lógica: navegación, validación, cálculo de cargas y resultados
├── test/
│   ├── dom.js        # Simulador mínimo de DOM para ejecutar la app en Node
│   └── run.js        # Suite de tests: node test/run.js
├── .gitignore        # Excluye los documentos de referencia (*.pdf) y la configuración local
└── README.md
```

Para actualizar valores normativos (por ejemplo, una nueva tabla de límites del CTE) solo hay que tocar `js/data.js`.

### Ejecutar en local

Basta con abrir `index.html` en el navegador. Si prefieres servirlo:

```bash
python -m http.server 8000
```

### Tests

La lógica está cubierta por una suite de regresión que se ejecuta con Node, sin instalar nada:

```bash
node test/run.js
```

Cubre los datos normativos, los enlaces entre `index.html` y el código (detecta identificadores rotos), la geometría y los muros interiores, el cálculo de cargas (envolvente, recuperador de calor, desglose, caudales de ventilación), la zona climática y la verificación del CTE, y la psicrometría y la radiación solar. El barrido de envolvente está fijado como valor de referencia: si un cambio altera los resultados, la suite falla y hay que decidir a conciencia si el cambio es correcto.

## Publicación

El proyecto está publicado como sitio estático en GitHub Pages, sirviendo la raíz de la rama `main`:

| | |
|---|---|
| Sitio | https://whoissif.github.io/calculadora-rite/ |
| Repositorio | https://github.com/whoissif/calculadora-rite |
| Configuración | **Settings → Pages** · *Source*: `Deploy from a branch` · *Branch*: `main` · carpeta `/ (root)` |

Para publicar cambios basta con subirlos a `main`; GitHub Pages vuelve a construir el sitio en uno o dos minutos:

```bash
git add .
git commit -m "descripción del cambio"
git push
```

El PDF de referencia `TFG_CARGAS.pdf` (25 MB) no se publica: la regla `*.pdf` de `.gitignore` lo mantiene fuera del repositorio, y el sitio no lo necesita.

## Aviso

Esta herramienta es una **ayuda al cálculo** orientativa. Los resultados deben ser validados por un técnico competente antes de dimensionar la instalación definitiva. La normativa aplicable (RITE, CTE) puede actualizarse; comprueba siempre la versión vigente.

## Licencia

MIT — uso libre, sin garantías.
