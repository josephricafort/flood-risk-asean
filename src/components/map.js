import deck from "npm:deck.gl";

const {DeckGL, AmbientLight, GeoJsonLayer, HexagonLayer, LightingEffect, PointLight} = deck;

// const world = await fetch("https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/50m.json").then(d => d.json());
const topo = import.meta.resolve("npm:visionscarto-world-atlas/world/50m.json");
const world = fetch(topo).then((response) => response.json());
const countries = world.then((world) => topojson.feature(world, world.objects.countries));

function deckGlMap(data){
    function getTooltip({object}) {
        if (!object) return null;
        const [lng, lat] = object.position;
        const count = object.points.length;
        return `latitude: ${lat.toFixed(2)}
            longitude: ${lng.toFixed(2)}
            ${count} collisions`;
    }

    const initialViewState = {
        longitude: -2,
        latitude: 53.5,
        zoom: 5.7,
        minZoom: 5,
        maxZoom: 15,
        pitch: 40.5,
        bearing: -5
    };

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

    const deckInstance = new DeckGL({
        container,
        initialViewState,
        getTooltip,
        effects,
        controller: true
    });

    deckInstance.setProps({
    layers: [
        new GeoJsonLayer({
        id: "base-map",
        data: countries,
        lineWidthMinPixels: 1,
        getLineColor: [60, 60, 60],
        getFillColor: [9, 16, 29]
        }),
        new HexagonLayer({
          id: "heatmap",
          data,
          coverage,
          radius,
          upperPercentile,
          colorRange,
          elevationScale: 50,
          elevationRange: [0, 5000 * t],
          extruded: true,
          getPosition: (d) => d,
          pickable: true,
          material: {
            ambient: 0.64,
            diffuse: 0.6,
            shininess: 32,
            specularColor: [51, 51, 51]
          }
        })
    ]
    });

    // // clean up if this code re-runs
    // invalidation.then(() => {
    //   deckInstance.finalize();
    //   container.innerHTML = "";
    // });
}

export default deckGlMap;