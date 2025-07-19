---
toc: false
theme: [ocean-floor]
style: custom-style.css
---

```js
import { geoContains } from "d3-geo";
import {camelCaseToLocation} from "./components/utils.js"
import * as d3 from "d3"

const coverageForm = Inputs.range([0, 1], {value: 0.9, label: "Coverage", step: 0.01});
const radiusForm = Inputs.range([500, 20000], {value: 3800, label: "Radius", step: 100});
const upperPercentileForm = Inputs.range([0, 100], {value: 100, label: "Upper percentile", step: 1});

const coverage = view(coverageForm)
const radius = view(radiusForm)
const upperPercentile = view(upperPercentileForm)
```

<div style="margin: 0;">
<div class="inputs">
    ${coverageForm}
    ${radiusForm}
    ${upperPercentileForm}
</div>
<figure style="max-width: none; position: relative; margin: 0;">
  <div id="container" style="border-radius: 8px; overflow: hidden; background: rgb(18, 35, 48); height: 100vh; margin: 0; "></div>
  <div style="position: absolute; top: 1rem; right: 1rem; filter: drop-shadow(0 0 4px rgba(0,0,0,.5));">${colorLegend}</div>
  <figcaption>Data: <a href="https://www.data.gov.uk/dataset/cb7ae6f0-4be6-4935-9277-47e5ce24a11f/road-safety-data">Department for Transport</a></figcaption>
</figure>
</div>

```js
import deck from "npm:deck.gl";
const {DeckGL, AmbientLight, GeoJsonLayer, HexagonLayer, 
  LightingEffect, PointLight, TextLayer, ContourLayer, HeatmapLayer} = deck;

// Population data
const popData = FileAttachment("./data/ghs_points_pop_floods_admin.csv").csv({ typed: false}).then((pop) => {
  return pop.slice(1)
});

// Country boundaries
const countriesAdminTopo = FileAttachment("./data/admin_all_countries.json").json()
const countriesAdmin = countriesAdminTopo.then((countries) => topojson.feature(countries, countries.objects.admin_all_countries));

// Provincial and subdivisions admin boundaries
const seaAdminTopo = FileAttachment("./data/admin_boundaries.json").json()
const seaAdmin = seaAdminTopo.then((adminBoundaries) => topojson.feature(adminBoundaries, adminBoundaries.objects.admin_boundaries));

// Flooded areas GAUL
const floodAreasTopo = FileAttachment("./data/flood_areas.json").json()
const floodAreas = floodAreasTopo.then((flood) => topojson.feature(flood, flood.objects.flood_areas));

// Admin with flooded data in GADM
const adminFloodGADMTopo = FileAttachment("./data/flood_exposure_gadm_geojson.json").json();
const adminFloodGADM = adminFloodGADMTopo.then((adminFlood) => topojson.feature(adminFlood, adminFlood.objects.flood_exposure_gadm_geojson1));

// Rivers and lakes
const hydroRiversTopo = FileAttachment("./data/hydrorivers_sea.json").json();
const hydroRivers = hydroRiversTopo.then((rivers) => topojson.feature(rivers, rivers.objects.hydrorivers_sea));

const naturalearthLakesTopo = FileAttachment("./data/naturalearth_lakes.json").json();
const naturalearthLakes = naturalearthLakesTopo.then((lakes) => topojson.feature(lakes, lakes.objects.naturalearth_lakes));

// Example country boundaries from deck.gl
const topo = import.meta.resolve("npm:visionscarto-world-atlas/world/50m.json");
const world = fetch(topo).then((response) => response.json());
const countries = world.then((world) => topojson.feature(world, world.objects.countries));

const countryLabels = FileAttachment("./data/country_labels.csv")
  .csv({ typed: true })
  .then((data) => { return data.slice(1) });

const effects = [
  new LightingEffect({
    ambientLight: new AmbientLight({color: [255, 255, 255], intensity: 1.0}),
    pointLight: new PointLight({color: [255, 255, 255], intensity: 0.8, position: [-0.144528, 49.739968, 80000]}),
    pointLight2: new PointLight({color: [255, 255, 255], intensity: 0.8, position: [-3.807751, 54.104682, 8000]})
  })
];

const t = (function* () {
  const duration = 1000;
  const start = performance.now();
  const end = start + duration;
  let now;
  while ((now = performance.now()) < end) yield d3.easeCubicInOut(Math.max(0, (now - start) / duration));
  yield 1;
})();
```

```js
let hoveredBoundary = null
let ALPHA = hoveredBoundary ? 255 : 100;

const colorRange = [
  [1, 152, 189, ALPHA],     // blue-green
  [37, 190, 197, ALPHA],    // lighter blue-green
  [73, 227, 206, ALPHA],    // aqua
  [140, 240, 194, ALPHA],   // minty green
  [200, 250, 188, ALPHA],   // pastel green
  [216, 254, 181, ALPHA],   // yellow-green
  [235, 245, 179, ALPHA],   // pale yellow
  [254, 237, 177, ALPHA],   // soft yellow
  [254, 205, 130, ALPHA],   // peach
  [254, 173, 84, ALPHA],    // orange
  [209, 55, 78, ALPHA]      // deep red
];

function getColorRange(alpha) { 
  return [
  [0, 0, 0, 0],             // force value for zero values
  [1, 152, 189, alpha],     // blue-green
  [37, 190, 197, alpha],    // lighter blue-green
  [73, 227, 206, alpha],    // aqua
  [140, 240, 194, alpha],   // minty green
  [200, 250, 188, alpha],   // pastel green
  [216, 254, 181, alpha],   // yellow-green
  [235, 245, 179, alpha],   // pale yellow
  [254, 237, 177, alpha],   // soft yellow
  [254, 205, 130, alpha],   // peach
  [254, 173, 84, alpha],    // orange
  [209, 55, 78, alpha]      // deep red
  ]
}

const colorLegend = Plot.plot({
  margin: 0,
  marginTop: 20,
  width: 180,
  height: 35,
  style: "color: white;",
  x: {padding: 0, axis: null},
  marks: [
    Plot.cellX(colorRange, {fill: ([r, g, b]) => `rgb(${r},${g},${b})`, inset: 0.5}),
    Plot.text(["Fewer"], {frameAnchor: "top-left", dy: -12}),
    Plot.text(["More"], {frameAnchor: "top-right", dy: -12})
  ]
});

const popDataMap = new Map([...new Set(popData.map(d => d["GID_1"] || d["GID_2"]))]
  .map(gid => {
    const filtPopData = popData.filter(d => (d["GID_1"] || d["GID_2"]) === gid )
    const summFiltPopData = filtPopData.reduce((obj, d) => {
      const { pop_int, flood_frequency_mean, flood_frequency_max } = d
      const popInt = obj.popInt + +pop_int
      const floodFreqMean = (obj.floodFreqMean + +flood_frequency_mean) / 2
      const floodFreqMax = Math.max(obj.floodFreqMax, +flood_frequency_max)
      return { gid, popInt, floodFreqMean, floodFreqMax }
    }, { gid: "", popInt: 0, floodFreqMean: 0, floodFreqMax: 0 })
    return summFiltPopData
  })
  .map(d => {
    if (!d) return null
    const { gid, popInt, floodFreqMean, floodFreqMax } = d
    return [ gid, { popInt, floodFreqMean, floodFreqMax } ]
  })
)

console.log("popDataMap: ", popDataMap)
console.log("popData: ", popData)

function getTooltip({ object }) {
  if (!object) return null;
  const { properties } = object;
  if (!properties) return null;
  const { COUNTRY, NAME_1, NAME_2, GID_1, GID_2, area_sq_km } = properties;

  if (!popDataMap.get(GID_1 || GID_2)) return null
  const { popInt, floodFreqMean, floodFreqMax } = popDataMap.get(GID_1 || GID_2)

  return object && properties && {
    html: `<div>
        <h3>${NAME_2 ? NAME_2 + ", " : ""}${NAME_1 ? NAME_1 + ", " : ""}${COUNTRY}</h3>
        <ul>
          <li>Area: ${area_sq_km} sq. km</li>
          <li>Population: ${popInt}</li>
          <li>Flood frequency max: ${floodFreqMax}</li>
          <li>Flood frequency mean: ${floodFreqMean.toFixed(1)}</li>
        </ul>
      </div>`,
    style: {
      backgroundColor: '#000',
      fontSize: '0.8em'
    }
  };
}

// function hoveredFeature(hovBound) = seaAdmin.features.find(
//   f => (f.properties.GID_1 || "") + (f.properties.GID_2 || "") === hovBound
// );

const seaCoords = { long: 115.9539243, lat: 1.7673744 }

const initialViewState = {
  longitude: seaCoords.long,
  latitude: seaCoords.lat,
  zoom: 4.5,
  minZoom: 3,
  maxZoom: 15,
  pitch: 40.5,
  bearing: 0
};

const [
  CTRY_CODE, COUNTRY, GROUP, PATH,
  CTRY_LONG, CTRY_LAT
] = Array.from({ length: 6 }, (_, i) => i);

function getLayers(){
  return [
    new GeoJsonLayer({
      id: "base-map",
      data: countries,
      lineWidthMinPixels: 0,
      getLineColor: [200, 200, 200, 200],
      getFillColor: [9, 16, 29, 0],
      getLineWidth: 100,
    }),
    new GeoJsonLayer({
      id: "flood-areas",
      lineWidthMinPixels: 1,
      data: floodAreas,
      getLineColor: [150, 150, 150],
      getFillColor: [255, 165, 0, 25],
    }),
    // new GeoJsonLayer({
    //   id: "admin-flood-areas",
    //   lineWidthMinPixels: 1,
    //   data: adminFloodGADM,
    //   colorRange,
    //   getLineColor: [150, 150, 150],
    //   getFillColor: [255, 165, 0, 25],
    // }),
    new GeoJsonLayer({
      id: "rivers",
      lineWidthMinPixels: 5,
      data: hydroRivers,
      opacity: 0.8,
      // colorRange,
      getLineColor: [150, 150, 150],
      getFillColor: [255, 165, 0, 0],
    }),
    new GeoJsonLayer({
      id: "lakes",
      lineWidthMinPixels: 5,
      data: naturalearthLakes,
      opacity: 0.8,
      // colorRange,
      getLineColor: [150, 150, 150],
      getFillColor: [150, 150, 150, 255],
    }),
    // Entire map
    new HexagonLayer({
      id: "heatmap",
      data: popData, 
      coverage,
      radius,
      upperPercentile,
      opacity: 0.15,
      colorRange: colorRange,
      colorAggregation: "MAX",
      getColorWeight: d => +d.flood_frequency_max,
      elevationScale: 100,
      elevationRange: [0, 5000 * t],
      elevationAggregation: "MAX",
      extruded: true,
      getPosition: (d) => [ +d.long, +d.lat ], // [long, lat]
      getElevationWeight: d => +d.pop_sum,
      pickable: false,
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      },
    }),
    // Hovered layer
    new HexagonLayer({
      id: "hex-hovered",
      data: popData, 
      coverage,
      radius,
      upperPercentile,
      colorDomain: [0, 48],
      colorRange: hoveredBoundary ? getColorRange(255) : getColorRange(100),
      colorAggregation: "MAX",
      getColorWeight: d => { 
        const alphaHovered = hoveredBoundary === ((d.GID_1 || "") + (d.GID_2 || ""));
        return alphaHovered ? +d.flood_frequency_max : 0
      },
      elevationScale: 100,
      elevationRange: [0, 5000 * t],
      elevationAggregation: "MAX",
      extruded: true,
      getPosition: (d) => [ +d.long, +d.lat ], // [long, lat]
      getElevationWeight: d => +d.pop_sum,
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      },
      updateTriggers: {
        getColorWeight: [hoveredBoundary],
        colorRange: [hoveredBoundary]
      },
      parameters: {
        depthTest: false // <-- Forces it to render on top
      }
    }),
    new GeoJsonLayer({
      id: "internal-boundaries",
      data: seaAdmin,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 0.5,
      lineCapRounded: true,
      lineJointRounded: true,
      getLineColor: [255, 255, 255, 200],
      getFillColor: [9, 16, 29, 0],
      pickable: true,
      onHover: info => {
        if (info.object) {
          hoveredBoundary = (info.object.properties.GID_1 || "") + (info.object.properties.GID_2 || "");
        } else {
          hoveredBoundary = null;
        }
        deckInstance.setProps({ layers: getLayers() });
      },
      getLineWidth: d => {
        const isHovered = hoveredBoundary === ((d.properties.GID_1 || "") + (d.properties.GID_2 || ""));
        return isHovered ? 5 : 0;
      },
      updateTriggers: {
        getLineWidth: [hoveredBoundary]
      },
      parameters: {
        depthTest: false // <-- Forces it to render on top
      }
    }),
    // new TextLayer({
    //   id: 'admin-labels',
    //   data: adminFloodGADM.features.map(d => d.properties),
    //   getPosition: d => [ +d.long, +d.lat ],
    //   getText: d => {
    //     console.log("deckInstanceZoom: ", deckInstance.viewState.zoom)
    //     const nameLevel = !COUNTRIES_ADMIN2.includes(d["COUNTRY"]) ? "NAME_1" : "NAME_2"
    //     // return deckInstance.viewState.zoom > 8 ? `${camelCaseToLocation(d[nameLevel]) || ""}` : ""
    //     return `${camelCaseToLocation(d[nameLevel]) || ""}`
    //   },
    //   getAlignmentBaseline: 'center',
    //   getColor: [255, 255, 255],
    //   getSize: 14,
    //   getTextAnchor: 'middle',
    //   pickable: true,
    //   parameters: {
    //     depthTest: false // <-- Forces it to render on top
    //   },
    //   // updateTriggers: {
    //   //   getText: deckInstance.viewState.zoom
    //   // }
    // }),
    new TextLayer({
      id: 'country-labels',
      data: countryLabels,
      getPosition: d => [ +d["long_c"], +d["lat_c"] ],
      getText: d => d["COUNTRY"],
      getAlignmentBaseline: 'center',
      getColor: [255, 128, 255],
      // getSize: 28,
      getTextAnchor: 'middle',
      // pickable: true,
      parameters: {
        depthTest: false // <-- Forces it to render on top
      }
    }),
  ]
}

const deckInstance = new DeckGL({
  container,
  initialViewState,
  getTooltip,
  effects,
  controller: true,
  layers: getLayers()
});

const [
  FID, ID, ROW_INDEX, COL_INDEX,
  POP_SUM, POP_MEAN, POP_MEDIAN,
  POP_MIN, POP_MAX, LONG, LAT,
  POP_INT, FLOOD_FREQ
] = Array.from({ length: 14 }, (_, i) => i);

const seaAdminMap = new Map(seaAdmin.features.map(d => [ d.properties["GID_1" || "GID_2"], d.properties]))
// console.log("seaAdminMap: ", seaAdminMap)
// console.log("seaAdminMapProps: ", seaAdminMap.get("BRN.1_1"))
// console.log("seaAdmin.features.props: ", seaAdmin.features.map(d => d.properties))

const COUNTRIES_ADMIN2 = ["Indonesia", "Malaysia", "Myanmar"]

// deckInstance.setProps({
//   layers
// });

// clean up if this code re-runs
invalidation.then(() => {
  deckInstance.finalize();
  container.innerHTML = "";
});

```