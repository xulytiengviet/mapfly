import fs from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {buildDemoGraph,buildDemoRoute,NeuralController,DriveWorld,CITY_ROUTES,validateGraph,geoDistance} from "../sim-core.mjs";

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("driver.css","utf8");
const js=fs.readFileSync("driver.js","utf8");
const classic=fs.readFileSync("legacy.html","utf8");
assert.match(html,/<html lang="vi">/);
assert.match(html,/MAPFLY/);
for(const id of ["go","pause","reset","sceneCanvas","map","neuralCanvas","rasterCanvas","legCanvas","connectomeFile","roadRoute","speedLive","city","steerChart"]){
  assert.match(html,new RegExp('id="'+id+'"'),"Missing dashboard element "+id);
}
assert.match(html,/legacy.html/);
assert.match(html,/vietflex.js/);
assert.match(classic,/legacy.js/);
assert.ok(css.length>5000);
assert.match(js,/googleMaps:false,useLegacyGoogleTiles:false/);
assert.match(js,/https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
assert.match(js,/sim-core\.mjs/);
assert.match(js,/router\.project-osrm\.org/);
assert.match(js,/function requestOSRM/);
assert.match(js,/function renderNeural/);
assert.match(js,/function renderScene/);
assert.match(js,/world\.update\(simDt,neural\.steer/);
assert.doesNotMatch(js,/google\.com\/vt\//);
for(const file of ["driver.js","sim-core.mjs","legacy.js"])execFileSync(process.execPath,["--check",file],{stdio:"inherit"});

const graph=buildDemoGraph();
assert.ok(graph.nodes.length>60);
assert.ok(graph.edges.length>120);
const brain=new NeuralController(graph);
const output1=brain.step(.03,{turn:-1,odor:.4,wind:0});
const output2=brain.step(.03,{turn:1,odor:.9,wind:.4});
assert.ok(Number.isFinite(output1.steer));
assert.ok(Number.isFinite(output2.steer));
assert.ok(output2.rates.visual>0);

const city="hcm";
const world=new DriveWorld(city);
assert.ok(world.route.length>6);
assert.ok(geoDistance(world.position,world.route.at(-1))>10);
for(let i=0;i<800;i++){
  const guidance=world.guidance();
  const neural=brain.step(.04,{turn:guidance.error,odor:.4,wind:.15});
  world.update(.04,neural.steer*.55,0,true);
}
assert.ok(world.distance>50,"Agent should move forward");
assert.ok(world.track.length>50);
assert.ok(world.distance<800);
assert.ok(Number.isFinite(world.position[0])&&Number.isFinite(world.position[1]));
assert.equal(world.city,city);
const uploaded=validateGraph({
  name:"test",nodes:[
    {id:"v1",region:"visual"},{id:"c1",region:"central"},{id:"m1",region:"motor"},{id:"m2",region:"motor"}
  ],
  edges:[{source:"v1",target:"c1",weight:10},{source:"c1",target:"m1",weight:6}]
});
brain.install(uploaded);
assert.equal(brain.graph.source,"uploaded");
assert.throws(()=>validateGraph({nodes:[],edges:[]}));
for(const name of Object.keys(CITY_ROUTES))assert.ok(buildDemoRoute(name).length>2);
console.log("✓ MapFly neuro-GIS smoke: DOM, OSM, WebGL source, neural graph, trajectory and uploaded graph.");
