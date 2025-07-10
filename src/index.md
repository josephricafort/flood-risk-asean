---
toc: false
theme: [ocean-floor]
style: custom-style.css
---

```js
import {camelCaseToLocation} from "./components/utils.js"

const coverageForm = Inputs.range([0, 1], {value: 0.5, label: "Coverage", step: 0.01});
const radiusForm = Inputs.range([500, 20000], {value: 5000, label: "Radius", step: 100});
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
const {DeckGL, AmbientLight, GeoJsonLayer, HexagonLayer, LightingEffect, PointLight, TextLayer} = deck;

const data = FileAttachment("./data/ghs_points_pop_floods_admin.csv").csv({ typed: false}).then((data) => {
  return data.slice(1)
});
const countriesAdminTopo = FileAttachment("./data/admin_all_countries.json").json()
const seaAdminTopo = FileAttachment("./data/admin_boundaries.json").json()

const topo = import.meta.resolve("npm:visionscarto-world-atlas/world/50m.json");
const world = fetch(topo).then((response) => response.json());
const countries = world.then((world) => topojson.feature(world, world.objects.countries));

const countriesAdmin = countriesAdminTopo.then((countries) => topojson.feature(countries, countries.objects.admin_all_countries));
const seaAdmin = seaAdminTopo.then((adminBoundaries) => topojson.feature(adminBoundaries, adminBoundaries.objects.admin_boundaries));

const countryLabels = FileAttachment("./data/country_labels.csv")
  .csv({ typed: true })
  .then((data) => {
    return data.slice(1)
  });

const colorRange = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
];

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

function getTooltip({object}) {
  if (!object) return null;
  const [lng, lat] = object.position;
  // const count = object.points?.length;
  return `latitude: ${lat.toFixed(2)}
    longitude: ${lng.toFixed(2)}`
    // ${count} collisions`;
}

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
console.log("seaAdmin: ", seaAdmin)
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

const deckInstance = new DeckGL({
  container,
  initialViewState,
  // getTooltip,
  effects,
  controller: true,
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
console.log("seaAdmin.features.props: ", seaAdmin.features.map(d => d.properties))

const COUNTRIES_ADMIN2 = ["Indonesia", "Malaysia", "Myanmar"]

deckInstance.setProps({
  layers: [
    new GeoJsonLayer({
      id: "base-map",
      data: countries,
      lineWidthMinPixels: 1,
      getLineColor: [200, 200, 200],
      getFillColor: [9, 16, 29, 255],
      getLineWidth: 100
    }),
    new GeoJsonLayer({
      id: "internal-boundaries",
      lineWidthMinPixels: 1,
      data: seaAdmin,
      getLineColor: [150, 150, 150],
      getFillColor: [9, 16, 29, 255],
    }),
    new HexagonLayer({
      id: "heatmap",
      data, 
      coverage,
      radius,
      upperPercentile,
      colorRange,
      colorAggregation: "MAX",
      getColorWeight: d => +d.flood_frequency_max,
      elevationScale: 100,
      elevationRange: [0, 5000 * t],
      elevationAggregation: "MAX",
      extruded: true,
      getPosition: (d) => [ +d.long, +d.lat ], // [long, lat]
      getElevationWeight: d => +d.pop_sum,
      pickable: true,
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      }
    }),
    new TextLayer({
      id: 'admin-labels',
      data: seaAdmin.features.map(d => d.properties),
      getPosition: d => [ +d.long, +d.lat ],
      getText: d => {
        const nameLevel = !COUNTRIES_ADMIN2.includes(d["COUNTRY"]) ? "NAME_1" : "NAME_2"
        return `${camelCaseToLocation(d[nameLevel]) || ""}`
      },
      getAlignmentBaseline: 'center',
      getColor: [255, 255, 255],
      getSize: 14,
      getTextAnchor: 'middle',
      pickable: true,
      parameters: {
        depthTest: false // <-- Forces it to render on top
      }
    }),
    new TextLayer({
      id: 'country-labels',
      data: countryLabels,
      getPosition: d => [ +d["long_c"], +d["lat_c"] ],
      getText: d => d["COUNTRY"],
      getAlignmentBaseline: 'center',
      getColor: [255, 128, 255],
      // getSize: 28,
      getTextAnchor: 'middle',
      pickable: true,
      parameters: {
        depthTest: false // <-- Forces it to render on top
      }
    }),
  ]
});

// clean up if this code re-runs
invalidation.then(() => {
  deckInstance.finalize();
  container.innerHTML = "";
});

```