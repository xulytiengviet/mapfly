import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js";

const get = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const CITIES = {
  hcm: { title: "TP. Hồ Chí Minh", lat: 10.77595, lng: 106.70103, zoom: 16.2 },
  hanoi: { title: "Hà Nội", lat: 21.02851, lng: 105.85203, zoom: 16.2 },
  vinhlong: { title: "Vĩnh Long", lat: 10.25277, lng: 105.97222, zoom: 16.0 }
};
const settings = { speed: 12, altitude: 5, odor: 65, threat: 30, wind: 20, follow: true, buildings: true, trail: true };
const state = {
  running: false, loaded: false, time: 0, wallTime: 0, distance: 0, lat: 0, lng: 0, heading: 0,
  velocity: 0, behavior: "chờ lệnh xuất phát", waypoints: [], targetIndex: 1, trajectory: [],
  city: "hcm", lastMapUpdate: 0, lastFollow: 0
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const radToBearing = (a) => (90 - a / DEG + 360) % 360;
function localToGeo(lat, lng, east, north) {
  return { lat: lat + north / 111320, lng: lng + east / (111320 * Math.cos(lat * DEG)) };
}
function displacement(a, b) {
  const n = (b.lat - a.lat) * 111320;
  const e = (b.lng - a.lng) * 111320 * Math.cos(a.lat * DEG);
  return { east: e, north: n, length: Math.hypot(n, e) };
}
function announce(value) { get("announcer").textContent = value; }
function coordinatePair(p) { return [p.lng, p.lat]; }
function featureLine(coords, kind) { return { type: "Feature", properties: { kind: kind }, geometry: { type: "LineString", coordinates: coords } }; }
function featureCollection(features) { return { type: "FeatureCollection", features: features }; }

function buildWaypoints(place) {
  const offsets = [[-70,-50],[45,-80],[140,0],[75,115],[-100,105],[-130,10],[-70,-50]];
  return offsets.map((xy) => localToGeo(place.lat, place.lng, xy[0], xy[1]));
}
function updateNumbers() {
  get("position").textContent = state.lat.toFixed(5) + "° N";
  get("position-lng").textContent = state.lng.toFixed(5) + "° E";
  get("distance").textContent = state.distance.toFixed(1) + " m";
  get("velocity").textContent = state.velocity.toFixed(2) + " m/s";
  get("height-readout").textContent = "Cao " + settings.altitude + " m · giả định";
  const elapsedSeconds = Math.floor(state.time);
  get("elapsed").textContent = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0") + ":" + String(elapsedSeconds % 60).padStart(2, "0");
  get("heading").textContent = "Hướng " + String(Math.round(radToBearing(state.heading))).padStart(3, "0") + "°";
  get("run-status").classList.toggle("active", state.running);
  get("run-status").lastElementChild.textContent = state.running ? "ĐANG MÔ PHỎNG" : "ĐANG TẠM DỪNG";
  get("behavior").textContent = "◉ Trạng thái: " + state.behavior;
  const vision = clamp(Math.round(53 + 16 * Math.sin(state.time * 0.19) + settings.wind * .10), 0, 100);
  const smell = clamp(Math.round(settings.odor * (0.78 + 0.18 * Math.sin(state.time * .13))), 0, 100);
  const avoid = clamp(Math.round(settings.threat * (0.77 + 0.14 * Math.cos(state.time * .37))), 0, 100);
  for (const [id, number] of [["vision",vision],["smell",smell],["avoid",avoid]]) {
    get(id + "-number").textContent = number + "%";
    get(id + "-bar").style.width = number + "%";
  }
  get("street-external").href = streetUrl();
}
function setCity(city, moveCamera = true) {
  state.city = city;
  const place = CITIES[city];
  state.waypoints = buildWaypoints(place);
  state.lat = state.waypoints[0].lat;
  state.lng = state.waypoints[0].lng;
  state.heading = -.3;
  state.time = 0;
  state.distance = 0;
  state.velocity = 0;
  state.targetIndex = 1;
  state.trajectory = [coordinatePair(state)];
  state.behavior = "chờ lệnh xuất phát";
  state.running = false;
  if (map && moveCamera) map.flyTo({ center: [place.lng, place.lat], zoom: place.zoom, pitch: 57, bearing: -17, speed: 1.1 });
  if (vMap && moveCamera) vMap.setView([place.lat, place.lng], place.zoom, { animate: true });
  updateNumbers();
  refreshGeography();
}
function setRunning(running) {
  state.running = running;
  state.behavior = running ? "định hướng mục tiêu và tìm đường" : "tạm dừng mô phỏng";
  updateNumbers();
}

let map, vMap, vBase, vRoute, vTrack, vMarkers;
let mapEngine = "vietflex";
function vfPoint(p) { return [p.lat, p.lng]; }
function showEngineNote() {
  const threeD = mapEngine === "maplibre";
  get("renderer").value = mapEngine;
  get("engine-note").textContent = threeD
    ? "OSM 3D · MapLibre hiển thị công trình khi có dữ liệu chiều cao. Không cần API key."
    : "Vietflex + OSM nhẹ · ruồi 3D nổi trên bản đồ 2D. Không dùng Google Tiles không chính thức.";
  get("buildings").disabled = !threeD;
  get("pitch").title = threeD ? "Chuyển góc nhìn 2D / 3D" : "Chuyển sang OSM 3D (MapLibre)";
}
function refreshVietflex() {
  if (!vMap) return;
  if (vRoute) vRoute.setLatLngs(state.waypoints.map(vfPoint));
  if (vTrack) vTrack.setLatLngs(state.trajectory.map(p => [p[1], p[0]]));
  if (vMarkers) {
    vMarkers.clearLayers();
    const all = state.waypoints.map((p,i) => ({
      location: p, color: i === state.targetIndex ? "#ffc674" : "#1c7f94",
      label: i === state.targetIndex ? "Điểm đích" : "Điểm hành trình", radius: i === state.targetIndex ? 8 : 5
    }));
    const place = CITIES[state.city];
    all.push({ location: localToGeo(place.lat,place.lng,120,-24), color:"#5dddb6", label:"Nguồn mùi mô phỏng", radius:9 });
    all.push({ location: localToGeo(place.lat,place.lng,-46,114), color:"#f88b72", label:"Vùng nguy cơ mô phỏng", radius:9 });
    for (const p of all) {
      const marker = new Vietflex.CircleMarker(vfPoint(p.location), {
        radius:p.radius, color:"#e7ffff",weight:2,fillColor:p.color,fillOpacity:.92,bubblingMouseEvents:false
      });
      marker.bindPopup(p.label);
      marker.addTo(vMarkers);
    }
  }
}
function createVietflex() {
  if (!window.Vietflex || !window.Vietflex.vietflexMap) {
    get("map-tip").textContent = "Không tải được Vietflex. Đang chuyển sang bản đồ 3D MapLibre.";
    mapEngine = "maplibre";showEngineNote();createMap();return;
  }
  try {
    const place = CITIES[state.city];
    vMap = Vietflex.vietflexMap("map", {
      googleMaps:false, useLegacyGoogleTiles:false, center:[state.lat,state.lng],
      zoom:place.zoom, minZoom:3, maxZoom:19, zoomControl:false, attributionControl:true,
      maxBounds:[[-85,-180],[85,180]]
    });
    vBase = new Vietflex.TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:19, minZoom:2,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(vMap);
    vRoute = new Vietflex.Polyline([], { color:"#1b8d9c",dashArray:"5 7",weight:3,opacity:.8 }).addTo(vMap);
    vTrack = new Vietflex.Polyline([], { color:"#ffca73",weight:4,opacity:.96 }).addTo(vMap);
    vMarkers = new Vietflex.LayerGroup().addTo(vMap);
    vMap.on("click",(event)=>{
      const clicked = {lat:event.latlng.lat,lng:event.latlng.lng};
      state.waypoints = [{lat:state.lat,lng:state.lng}, clicked];
      state.targetIndex = 1; refreshGeography();
      announce("Đã đặt điểm đích mới tại "+clicked.lat.toFixed(5)+", "+clicked.lng.toFixed(5));
      get("map-tip").textContent = "✓ Đã chọn điểm đích mới · Nhấn Bắt đầu bay để di chuyển";
    });
    get("map-tip").textContent = "✓ Vietflex + OpenStreetMap miễn phí · Chạm vào bản đồ để chọn điểm đích";
    state.loaded = true;
    refreshGeography();
    requestAnimationFrame(()=>vMap?.invalidateSize());
  } catch(err) {
    console.error("Không khởi tạo được Vietflex",err);
    if (vMap) {try{vMap.remove();}catch(e){console.warn(e);}}
    vMap=null;mapEngine="maplibre";showEngineNote();createMap();
  }
}
function switchMapEngine(next) {
  if (next !== "vietflex" && next !== "maplibre") return;
  if (next===mapEngine && (map || vMap)) return;
  if (map) {map.remove();map=null;}
  if (vMap) {vMap.remove();vMap=null;}
  vBase=vRoute=vTrack=vMarkers=null;
  state.loaded=false;
  const el=get("map");
  el.replaceChildren();el.className="map";el.removeAttribute("style");
  mapEngine=next;
  showEngineNote();
  if (mapEngine==="vietflex") createVietflex();
  else createMap();
}
function sourceData(id, data) {
  if (map && state.loaded && map.getSource(id)) map.getSource(id).setData(data);
}
function waypointFeatures() {
  const items = state.waypoints.map((p, i) => ({
    type: "Feature", properties: { role: i === state.targetIndex ? "goal" : "waypoint", label: i + 1 },
    geometry: { type: "Point", coordinates: coordinatePair(p) }
  }));
  const place = CITIES[state.city];
  const odorPoint = localToGeo(place.lat, place.lng, 120, -24);
  const riskPoint = localToGeo(place.lat, place.lng, -46, 114);
  items.push({ type: "Feature", properties: { role: "odor", label: "Mùi giả lập" }, geometry: { type: "Point", coordinates: coordinatePair(odorPoint) } });
  items.push({ type: "Feature", properties: { role: "risk", label: "Nguy cơ giả lập" }, geometry: { type: "Point", coordinates: coordinatePair(riskPoint) } });
  return featureCollection(items);
}
function refreshGeography() {
  refreshVietflex();
  sourceData("mapfly-route", featureCollection([featureLine(state.waypoints.map(coordinatePair), "Tuyến mục tiêu")]));
  sourceData("mapfly-track", featureCollection([featureLine(state.trajectory, "Hành trình mô phỏng")]));
  sourceData("mapfly-waypoints", waypointFeatures());
}
function createMap() {
  if (!window.maplibregl || !maplibregl.supported()) {
    get("map-tip").textContent = "Trình duyệt thiếu WebGL hoặc không tải được thư viện MapLibre. Hãy bật tăng tốc phần cứng.";
    return;
  }
  try {
    map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [CITIES.hcm.lng, CITIES.hcm.lat],
      zoom: CITIES.hcm.zoom,
      pitch: 57,
      bearing: -17,
      maxPitch: 80,
      antialias: true,
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), "bottom-left");
    map.on("load", () => {
      state.loaded = true;
      const layers = map.getStyle().layers || [];
      const firstSymbol = layers.find((item) => item.type === "symbol");
      try {
        map.addSource("mapfly-osm-buildings", { type: "vector", url: "https://tiles.openfreemap.org/planet" });
        map.addLayer({
          id: "mapfly-osm-3d", type: "fill-extrusion", source: "mapfly-osm-buildings",
          "source-layer": "building", minzoom: 14,
          paint: {
            "fill-extrusion-color": "#90adad",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 9],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": .68
          },
          layout: { visibility: settings.buildings ? "visible" : "none" }
        }, firstSymbol ? firstSymbol.id : undefined);
      } catch (err) { console.warn("Không tạo được lớp nhà 3D", err); }
      map.addSource("mapfly-route", { type: "geojson", data: featureCollection([]) });
      map.addSource("mapfly-track", { type: "geojson", data: featureCollection([]) });
      map.addSource("mapfly-waypoints", { type: "geojson", data: featureCollection([]) });
      map.addLayer({ id: "mapfly-route-line", type: "line", source: "mapfly-route", paint: { "line-color": "#1a8795", "line-opacity": .8, "line-width": 3, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "mapfly-track-glow", type: "line", source: "mapfly-track", paint: { "line-color": "#ffbd62", "line-opacity": .20, "line-width": 11 }, layout: { visibility: settings.trail ? "visible" : "none" } });
      map.addLayer({ id: "mapfly-track-line", type: "line", source: "mapfly-track", paint: { "line-color": "#ffca73", "line-opacity": .97, "line-width": 3 }, layout: { visibility: settings.trail ? "visible" : "none" } });
      map.addLayer({
        id: "mapfly-waypoint-circles", type: "circle", source: "mapfly-waypoints",
        paint: {
          "circle-radius": ["match", ["get", "role"], "goal", 8, "odor", 10, "risk", 10, 5],
          "circle-color": ["match", ["get", "role"], "goal", "#ffc674", "odor", "#5dddb6", "risk", "#f88b72", "#1c7f94"],
          "circle-stroke-width": 2, "circle-stroke-color": "#e7ffff"
        }
      });
      map.on("click", (e) => {
        const clicked = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        state.waypoints = [{ lat: state.lat, lng: state.lng }, clicked];
        state.targetIndex = 1;
        refreshGeography();
        announce("Đã đặt mục tiêu mới tại " + clicked.lat.toFixed(5) + ", " + clicked.lng.toFixed(5));
        get("map-tip").textContent = "✓ Đã đặt điểm đích mới · Nhấn Bắt đầu bay để di chuyển";
      });
      refreshGeography();
    });
    map.on("error", (e) => {
      if (e && e.error) console.warn("MapLibre:", e.error.message || e.error);
    });
  } catch (err) {
    get("map-tip").textContent = "Không khởi tạo được bản đồ: " + (err.message || String(err));
  }
}
function updateAgent(dt) {
  if (!state.running) return;
  const simDt = dt * settings.speed;
  state.time += simDt;
  let target = state.waypoints[state.targetIndex];
  if (!target) return;
  let delta = displacement(state, target);
  if (delta.length < 11) {
    state.targetIndex = state.targetIndex + 1 >= state.waypoints.length ? (state.waypoints.length === 2 ? 0 : 1) : state.targetIndex + 1;
    target = state.waypoints[state.targetIndex];
    delta = displacement(state, target);
    refreshGeography();
  }
  let desired = Math.atan2(delta.north, delta.east);
  state.behavior = "bám điểm đích · định hướng thị giác";
  const place = CITIES[state.city];
  const odor = localToGeo(place.lat, place.lng, 120, -24);
  const risk = localToGeo(place.lat, place.lng, -46, 114);
  const scentDelta = displacement(state, odor);
  if (settings.odor > 25 && scentDelta.length < 145) {
    const bearingToOdor = Math.atan2(scentDelta.north, scentDelta.east);
    desired += wrap(bearingToOdor - desired) * (settings.odor / 100) * .22;
    state.behavior = "tìm nguồn mùi · thiên hướng khứu giác";
  }
  const hazard = displacement(state, risk);
  const riskRadius = 17 + settings.threat * .5;
  if (settings.threat > 10 && hazard.length < riskRadius) {
    desired = Math.atan2(-hazard.north, -hazard.east);
    state.behavior = "né vùng nguy cơ · phản xạ tránh";
  }
  desired += Math.sin(state.time * .24) * (settings.wind / 100) * .12;
  state.heading += clamp(wrap(desired - state.heading), -1.8 * simDt, 1.8 * simDt);
  const speed = state.behavior.includes("né") ? 1.35 : .92;
  const travel = speed * simDt;
  const moving = localToGeo(state.lat, state.lng, Math.cos(state.heading) * travel, Math.sin(state.heading) * travel);
  state.lat = moving.lat;
  state.lng = moving.lng;
  state.velocity = speed;
  state.distance += travel;
  if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) { setCity(state.city, true); return; }
  state.trajectory.push([state.lng, state.lat]);
  if (state.trajectory.length > 1500) state.trajectory.splice(0, state.trajectory.length - 1500);
}

const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#b77b38", roughness: .73, metalness: .02 });
const headMaterial = new THREE.MeshStandardMaterial({ color: "#daa056", roughness: .66 });
const amberMaterial = new THREE.MeshStandardMaterial({ color: "#c18b45", roughness: .57 });
const darkMaterial = new THREE.MeshStandardMaterial({ color: "#392820", roughness: .86 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#bc352f", roughness: .23, metalness: .16 });
const wingMaterial = new THREE.MeshPhysicalMaterial({ color: "#dfefe4", transparent: true, opacity: .62, side: THREE.DoubleSide, roughness: .22, depthWrite: false });
const veinMaterial = new THREE.MeshStandardMaterial({ color: "#987548", transparent: true, opacity: .65 });
function sphere(parent, material, position, scale, seg = 18) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(10, Math.floor(seg * .65))), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}
function rod(parent, a, b, radius, mat = amberMaterial) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const distance = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .75, radius, distance, 6), mat);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), end.sub(start).normalize());
  parent.add(mesh);
  return mesh;
}
function makeFly() {
  const fly = new THREE.Group();
  sphere(fly, headMaterial, [.74,.12,0], [.47,.43,.46]);
  sphere(fly, bodyMaterial, [-.05,0,0], [.60,.46,.45]);
  sphere(fly, amberMaterial, [-1.00,-.10,0], [.94,.35,.37]);
  sphere(fly, darkMaterial, [-1.72,-.14,0], [.16,.26,.26]);
  for (const x of [-.83,-1.14,-1.44]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.335, .026, 6, 28), darkMaterial);
    ring.position.set(x,-.10,0);
    ring.rotation.y = Math.PI/2;
    fly.add(ring);
  }
  for (const side of [-1,1]) {
    sphere(fly, eyeMaterial, [1.00,.18,side*.325], [.255,.31,.17]);
    sphere(fly, new THREE.MeshStandardMaterial({ color: "#f9ad77", roughness: .3 }), [1.1,.27,side*.465], [.045,.06,.02], 12);
    rod(fly, [1.05,.42,side*.15], [1.30,.80,side*.24], .016, darkMaterial);
    rod(fly, [1.30,.80,side*.24], [1.41,.88,side*.30], .01, darkMaterial);
  }
  const wings = [];
  for (const side of [-1,1]) {
    const hinge = new THREE.Group();
    hinge.position.set(-.13,.29,side*.32);
    sphere(hinge, wingMaterial, [-.38,.02,side*.78], [.77,.023,.40], 24).rotation.y = side*.30;
    rod(hinge, [0,.03,0], [-.77,.025,side*1.00], .015, veinMaterial);
    rod(hinge, [0,.03,0], [-.42,.022,side*1.11], .011, veinMaterial);
    fly.add(hinge);
    wings.push({ group: hinge, side: side });
    rod(fly, [-.52,-.07,side*.38], [-.75,-.24,side*.79], .025);
    sphere(fly, amberMaterial, [-.77,-.24,side*.79], [.08,.07,.08], 12);
  }
  for (const x of [.40,-.12,-.62]) {
    for (const side of [-1,1]) {
      const z = side * .35;
      rod(fly, [x,-.26,z], [x+.12,-.72,side*.64], .025);
      rod(fly, [x+.12,-.72,side*.64], [x+.25,-1.07,side*.81], .016);
    }
  }
  fly.userData.wings = wings;
  return fly;
}
function flap(fly, seconds) {
  for (const w of fly.userData.wings) w.group.rotation.x = w.side * (.23 + Math.sin(seconds * 52) * .51);
}
let specimenRenderer, specimenScene, specimenCamera, specimenFly;
let orbit = { a: .7, b: .4, radius: 4.9, down: false, x: 0, y: 0 };
function setupSpecimen() {
  const holder = get("specimen");
  try {
    specimenRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    specimenRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    specimenRenderer.outputColorSpace = THREE.SRGBColorSpace;
    holder.appendChild(specimenRenderer.domElement);
    specimenScene = new THREE.Scene();
    specimenScene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffddb3, 3.2);
    key.position.set(3,5,5);
    specimenScene.add(key);
    const fill = new THREE.DirectionalLight(0x87d8f7, 1.5);
    fill.position.set(-4,2,-3);
    specimenScene.add(fill);
    specimenFly = makeFly();
    specimenScene.add(specimenFly);
    specimenCamera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    holder.addEventListener("pointerdown", (e) => {
      orbit.down = true; orbit.x = e.clientX; orbit.y = e.clientY; holder.setPointerCapture(e.pointerId);
    });
    holder.addEventListener("pointermove", (e) => {
      if (!orbit.down) return;
      orbit.a += (e.clientX - orbit.x) * .008;
      orbit.b = clamp(orbit.b + (e.clientY - orbit.y) * .008, -.7, 1.3);
      orbit.x = e.clientX; orbit.y = e.clientY;
    });
    holder.addEventListener("pointerup", () => { orbit.down = false; });
    holder.addEventListener("pointercancel", () => { orbit.down = false; });
    holder.addEventListener("wheel", (e) => {
      e.preventDefault(); orbit.radius = clamp(orbit.radius + Math.sign(e.deltaY)*.35, 3.4, 8.5);
    }, { passive: false });
    const resize = () => {
      const { width, height } = holder.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      specimenRenderer.setSize(width, height, false);
      specimenCamera.aspect = width / height;
      specimenCamera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(holder);
    resize();
  } catch (err) { console.warn("WebGL specimen:", err); holder.textContent = "Không tải được mô hình 3D trên trình duyệt này."; }
}
let overlayRenderer, overlayScene, overlayCamera, overlayCarrier, overlayFly;
function setupOverlay() {
  try {
    const canvas = get("fly-overlay");
    overlayRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    overlayRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    overlayScene = new THREE.Scene();
    overlayScene.add(new THREE.AmbientLight(0xffffff, 2.3));
    const sun = new THREE.DirectionalLight(0xffddb0, 3.2); sun.position.set(4,5,10); overlayScene.add(sun);
    overlayCamera = new THREE.OrthographicCamera(-500,500,300,-300,.01,1000);
    overlayCamera.position.set(0,0,200);
    overlayCarrier = new THREE.Group();
    overlayFly = makeFly();
    overlayFly.rotation.x = Math.PI / 2;
    overlayCarrier.add(overlayFly);
    overlayCarrier.scale.setScalar(11.5);
    overlayScene.add(overlayCarrier);
    const holder = get("map");
    const resize = () => {
      const rect = holder.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (w < 1 || h < 1) return;
      overlayRenderer.setSize(w,h,false);
      overlayCamera.left = -w/2; overlayCamera.right = w/2; overlayCamera.top = h/2; overlayCamera.bottom = -h/2;
      overlayCamera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(holder);
    resize();
  } catch (err) { console.warn("WebGL overlay:", err); get("fly-overlay").style.display = "none"; }
}

let povRenderer=null, povScene=null, povCamera=null, povActive=false, povReady=false;
function ensurePOV() {
  if (povReady) return true;
  try {
    povRenderer = new THREE.WebGLRenderer({ alpha:false, antialias:true, powerPreference:"low-power" });
    povRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    povScene = new THREE.Scene();
    povScene.background = new THREE.Color("#8aafbd");
    povScene.fog = new THREE.Fog("#9bbfc8", 20, 105);
    povCamera = new THREE.PerspectiveCamera(66,1,.1,180);
    povScene.add(new THREE.HemisphereLight(0xf4f9ff,0x60717c,2.0));
    const sun=new THREE.DirectionalLight(0xffde9a,2.6);sun.position.set(-10,25,-26);povScene.add(sun);
    const asphalt=new THREE.MeshStandardMaterial({color:"#354850",roughness:.96});
    const concrete=new THREE.MeshStandardMaterial({color:"#a6b3b0",roughness:.95});
    const line=new THREE.MeshBasicMaterial({color:"#ffe9a8"});
    const green=new THREE.MeshStandardMaterial({color:"#578879",roughness:.98});
    const roads = new THREE.Mesh(new THREE.PlaneGeometry(17,220),asphalt);
    roads.rotation.x=-Math.PI/2;roads.position.set(0,-1.2,-65);povScene.add(roads);
    function box(width,height,depth,x,y,z,mat) {
      const obj = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);
      obj.position.set(x,y,z);povScene.add(obj);return obj;
    }
    for (const side of [-1,1]) {
      box(13,.22,220,side*15,-1.16,-65,concrete);
      box(.19,.08,220,side*8.4,-1.06,-65,line);
      for(let i=0;i<15;i++){
        const z=7-i*8.5;
        const h=5+((i*17+side*11+60)%9)*1.4;
        const col=["#cba989","#8c9b9d","#c2c5b4","#78969d","#e0c7a4"][(i+(side+1))%5];
        const mat=new THREE.MeshStandardMaterial({color:col,roughness:.91});
        box(8,h,6.5,side*(17+Math.sin(i*4.8)*1.6),h/2-1.18,z,mat);
        for(let row=1;row<Math.floor(h/3);row++){
          for(let j=0;j<3;j++){
            const windows=new THREE.MeshStandardMaterial({color:"#405e66",emissive:"#254653",emissiveIntensity:.13});
            box(.72,1.2,.05,side*(17+Math.sin(i*4.8)*1.6 + (j-1)*2.15),row*2.7-1.0,z+3.29,windows);
          }
        }
        box(1,4,1,side*10.8,.83,z-2,green);
      }
    }
    for(let i=0;i<27;i++){
      box(.23,.012,3,0,-1.065,9-i*7.8,line);
    }
    const resize=()=>{
      const rect=get("street-box").getBoundingClientRect();
      if (rect.width<=0||rect.height<=0)return;
      povRenderer.setSize(rect.width,rect.height,false);
      povCamera.aspect=rect.width/rect.height;povCamera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(get("street-box"));
    povReady=true;
    resize();
    return true;
  }catch(error){
    console.warn("Không dựng được góc nhìn ruồi 3D",error);
    return false;
  }
}
function showPOV() {
  if (!ensurePOV()) {
    get("street-box").innerHTML='<div class="street-empty"><b>Thiết bị không hỗ trợ WebGL</b>Vẫn có thể mở Google Maps theo liên kết bên dưới.</div>';
    povActive=false;
    return;
  }
  const tag=document.createElement("span");
  tag.className="pov-label";
  tag.textContent="PHỐ 3D GIẢ LẬP · KHÔNG PHẢI ẢNH THỰC";
  get("street-box").replaceChildren(povRenderer.domElement,tag);
  povActive=true;
  const rect=get("street-box").getBoundingClientRect();
  povRenderer.setSize(rect.width,rect.height,false);
  povCamera.aspect=rect.width/rect.height;povCamera.updateProjectionMatrix();
  announce("Đang xem đường phố 3D tạo từ hình học giả lập, không cần API key.");
}
function renderPOV() {
  if (!povReady || !povActive) return;
  const radians=state.heading;
  povCamera.position.set(Math.sin(radians)*.65,clamp(settings.altitude*.18+.9,1.4,5.4),11+Math.sin(state.time*.16)*.35);
  povCamera.lookAt(Math.sin(radians)*3,1.1,-22);
  povRenderer.render(povScene,povCamera);
}

function streetUrl() {
  return "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" +
    state.lat.toFixed(6) + "," + state.lng.toFixed(6) + "&heading=" + Math.round(radToBearing(state.heading));
}
function syncStreet() {
  const key = get("google-key").value.trim();
  if (!key) {
    get("street-box").innerHTML = '<div class="street-empty"><b>Chưa có khóa Google Maps</b>Bạn vẫn có thể chọn “Mở tại Google Maps” ở phía dưới để xem ảnh 360° trong thẻ mới.</div>';
    get("google-key").focus();
    return;
  }
  const params = new URLSearchParams({
    key: key, location: state.lat.toFixed(6) + "," + state.lng.toFixed(6),
    heading: String(Math.round(radToBearing(state.heading))), pitch: "5", fov: "85"
  });
  const frame = document.createElement("iframe");
  frame.title = "Google Street View tại vị trí hiện tại của ruồi";
  frame.loading = "lazy";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.src = "https://www.google.com/maps/embed/v1/streetview?" + params.toString();
  get("street-box").replaceChildren(frame);
  povActive=false;
  announce("Đã gửi tọa độ hiện tại tới Google Street View. Ảnh panorama có thể không khả dụng.");
}
function clearStreet() {
  get("google-key").value = "";
  showPOV();
}
function exportPath() {
  const features = [
    { type: "Feature", properties: { name: "Ruồi giấm hiện tại", altitude_m_simulated: settings.altitude, heading_deg: radToBearing(state.heading) }, geometry: { type: "Point", coordinates: coordinatePair(state) } },
    featureLine(state.trajectory, "Quỹ đạo Geo-ABM giả lập"),
    featureLine(state.waypoints.map(coordinatePair), "Lộ trình điểm đích")
  ];
  const payload = {
    type: "FeatureCollection",
    name: "MapFly Geo-ABM",
    properties: { simulated: true, connectome_driven: false, city: state.city, elapsed_simulated_seconds: state.time, distance_m: state.distance, coordinate_reference_system: "WGS84 / EPSG:4326" },
    features: features
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "mapfly-" + state.city + "-" + new Date().toISOString().slice(0,10) + ".geojson";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce("Đã xuất hành trình mô phỏng GeoJSON.");
}
function bind() {
  for (const [id, prop, suffix] of [["speed","speed","×"],["altitude","altitude"," m"],["odor","odor","%"],["threat","threat","%"],["wind","wind","%"]]) {
    get(id).addEventListener("input", (e) => {
      settings[prop] = Number(e.target.value);
      get((id === "altitude" ? "alt" : id) + "-value").textContent = settings[prop] + suffix;
      updateNumbers();
    });
  }
  get("city").addEventListener("change", (e) => setCity(e.target.value));
  get("renderer").addEventListener("change",(e)=>switchMapEngine(e.target.value));
  get("start").addEventListener("click", () => setRunning(true));
  get("pause").addEventListener("click", () => setRunning(false));
  get("reset").addEventListener("click", () => setCity(state.city));
  get("export").addEventListener("click", exportPath);
  get("follow").addEventListener("change", (e) => settings.follow = e.target.checked);
  get("buildings").addEventListener("change", (e) => {
    settings.buildings = e.target.checked;
    if (map && map.getLayer("mapfly-osm-3d")) map.setLayoutProperty("mapfly-osm-3d","visibility",settings.buildings ? "visible":"none");
  });
  get("trail").addEventListener("change", (e) => {
    settings.trail = e.target.checked;
    for (const id of ["mapfly-track-line","mapfly-track-glow"]) if (map && map.getLayer(id)) map.setLayoutProperty(id,"visibility",settings.trail ? "visible":"none");
    if (vTrack) settings.trail ? vTrack.addTo(vMap) : vMap.removeLayer(vTrack);
  });
  get("recenter").addEventListener("click", () => {
    if (map) map.flyTo({ center: [state.lng,state.lat], zoom: 16.6, pitch: 57, bearing: -17 });
    if (vMap) vMap.setView([state.lat,state.lng],16.6);
  });
  get("pitch").addEventListener("click", () => {
    if (vMap) switchMapEngine("maplibre");
    else if (map) map.easeTo({ pitch: map.getPitch() > 10 ? 0 : 58, duration: 700 });
  });
  get("zoom-in").addEventListener("click", () => { if (map) map.zoomIn(); else if(vMap) vMap.zoomIn(); });
  get("zoom-out").addEventListener("click", () => { if (map) map.zoomOut(); else if(vMap) vMap.zoomOut(); });
  get("street-sync").addEventListener("click", syncStreet);
  get("pov-btn").addEventListener("click", showPOV);
  get("street-clear").addEventListener("click", clearStreet);
}
let lastFrame = 0;
let displayTime = 0;
function loop(timestamp) {
  requestAnimationFrame(loop);
  const dt = clamp((timestamp - (lastFrame || timestamp)) / 1000, 0, .07);
  lastFrame = timestamp;
  displayTime += dt;
  if (dt > 0) updateAgent(dt);
  if (specimenRenderer && specimenFly) {
    flap(specimenFly, state.running ? state.time : displayTime*.36);
    if (!orbit.down) orbit.a += dt * .12;
    specimenCamera.position.set(
      Math.cos(orbit.b)*Math.cos(orbit.a)*orbit.radius,
      Math.sin(orbit.b)*orbit.radius + .2,
      Math.cos(orbit.b)*Math.sin(orbit.a)*orbit.radius
    );
    specimenCamera.lookAt(-.30,-.1,0);
    specimenRenderer.render(specimenScene,specimenCamera);
  }
  renderPOV();
  if (overlayRenderer && (map || vMap) && overlayCarrier) {
    const p = map ? map.project([state.lng, state.lat]) : vMap.latLngToContainerPoint([state.lat,state.lng]);
    const rect = get("map").getBoundingClientRect();
    overlayCarrier.position.set(p.x-rect.width/2,rect.height/2-p.y,0);
    overlayCarrier.rotation.z = state.heading - (map ? map.getBearing()*DEG : 0);
    flap(overlayFly, state.running ? state.time : displayTime*.36);
    overlayRenderer.render(overlayScene,overlayCamera);
  }
  if (timestamp - state.lastMapUpdate > 180) {
    state.lastMapUpdate = timestamp;
    sourceData("mapfly-track", featureCollection([featureLine(state.trajectory, "Đường bay đã đi")]));
    if (vTrack && settings.trail) vTrack.setLatLngs(state.trajectory.map(p=>[p[1],p[0]]));
    updateNumbers();
  }
  if (state.running && settings.follow && (map || vMap) && timestamp - state.lastFollow > 950) {
    state.lastFollow = timestamp;
    if (map && !map.isMoving()) map.easeTo({ center: [state.lng,state.lat], duration: 750 });
    if (vMap && !vMap._animatingZoom && !vMap._panAnim?._inProgress) vMap.panTo([state.lat,state.lng],{animate:true,duration:.7});
  }
}
bind();
setCity("hcm", false);
switchMapEngine("vietflex");
setupSpecimen();
setupOverlay();
showPOV();
requestAnimationFrame(loop);
