import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js";
import {CITY_ROUTES,GROUPS,NeuralController,DriveWorld,validateGraph,bearingDegrees,geoDistance,wrapRad} from "./sim-core.mjs";
const el=id=>document.getElementById(id);
const ctl={playing:false,scale:1,gain:.55,odor:.4,wind:.15,manual:0,follow:true,neural:true,city:"hcm",routeLoading:false};
const world=new DriveWorld("hcm");
const brain=new NeuralController();
const history={steer:[],force:[],joint:[],raster:[]};
let sceneRenderer=null,sceneCamera=null,scene=null,visualGroup=null,wheelGroup=null,wings=[],roadStreaks=[],buildings=[];
let map=null,mapRoute=null,mapTravel=null,mapFly=null,mapGoal=null,mapBase=null,renderOK=false;
let lastTime=0,lastUI=0,lastMap=0,lastNeuro=0,nowTick=0;
const fmt=(v,n=1)=>Number(v).toFixed(n);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function say(message){el("announcer").textContent=message;}
function resetHistories(){for(const k of Object.keys(history))history[k]=[];}
function setRunning(value){
  ctl.playing=Boolean(value)&&!world.complete;
  el("liveDot").classList.toggle("running",ctl.playing);
  el("liveText").textContent=world.complete?"ĐÃ ĐẾN ĐÍCH":ctl.playing?"MÔ PHỎNG TRỰC TIẾP":"TẠM DỪNG";
}
function setCity(city){
  if(!CITY_ROUTES[city])return;
  ctl.city=city;ctl.manual=0;world.reset(city);brain.install(brain.graph);resetHistories();setRunning(false);createMapRoute();updateReadout();
}
function comparePath(a,b){return a[0]===b[0]&&a[1]===b[1];}
function createMapRoute(){
  if(!map)return;
  const latlngs=world.route.map(p=>[p[1],p[0]]);
  mapRoute.setLatLngs(latlngs);
  mapTravel.setLatLngs(world.track.map(p=>[p[1],p[0]]));
  mapFly.setLatLng([world.position[1],world.position[0]]);
  mapGoal.setLatLng(latlngs[latlngs.length-1]);
  const bounds=mapRoute.getBounds();
  if(bounds.isValid())map.fitBounds(bounds.pad(.24),{animate:false,maxZoom:17});
  el("mapMode").textContent=world.routeKind==="osm"?"OSRM · OSM ROAD":"TUYẾN GIẢ LẬP";
  el("routeType").textContent=world.routeKind==="osm"?"OSM ROAD GEOMETRY":"SIMULATED ROUTE";
  el("routeSource").textContent=world.routeKind==="osm"?"Hình học đường từ dịch vụ OSRM":"Các điểm định trước · không bám đường OSM";
}
function initMap(){
  if(!window.Vietflex){
    el("map").textContent="Không tải được Vietflex Map. Mô phỏng vẫn hoạt động; thử tải lại trang.";
    el("map").style.cssText="padding:35px 12px;color:#a6ccd3;background:#0c2834";
    return;
  }
  try{
    map=Vietflex.vietflexMap("map",{
      googleMaps:false,useLegacyGoogleTiles:false,
      center:[world.position[1],world.position[0]],zoom:15.2,minZoom:3,maxZoom:19,
      zoomControl:false,attributionControl:true,maxBounds:[[-85,-180],[85,180]]
    });
    mapBase=new Vietflex.TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(map);
    mapRoute=new Vietflex.Polyline([], {color:"#29ceff",weight:5,opacity:.94,dashArray:"7 7"}).addTo(map);
    mapTravel=new Vietflex.Polyline([], {color:"#f9a95d",weight:4,opacity:.94}).addTo(map);
    mapFly=new Vietflex.CircleMarker([world.position[1],world.position[0]], {radius:8,color:"#fff",weight:3,fillColor:"#26e5ce",fillOpacity:1}).addTo(map).bindPopup("Tác tử ruồi giấm · tọa độ mô phỏng");
    mapGoal=new Vietflex.CircleMarker([world.position[1],world.position[0]], {radius:8,color:"#fff",weight:2,fillColor:"#ffad55",fillOpacity:1}).addTo(map).bindPopup("Đích điều hướng");
    map.on("click",evt=>{
      const point=[evt.latlng.lng,evt.latlng.lat];
      if(geoDistance(world.position,point)>4000){say("Vui lòng đặt đích trong bán kính 4 km.");return;}
      try{
        const start=world.position.slice();
        world.installRoute([start,point],"preset");
        setRunning(false);createMapRoute();updateReadout();say("Đã đặt điểm đích mới. Đây là đường thẳng giả lập, chưa phải đường thực tế.");
      }catch(error){say("Lỗi tọa độ: "+error.message);}
    });
    createMapRoute();
  }catch(err){
    console.warn("Vietflex initialization",err);
    el("mapMode").textContent="OSM KHÔNG TẢI";
  }
}
async function requestOSRM(){
  if(ctl.routeLoading)return;
  if(!navigator.onLine){say("Đang ngoại tuyến, sẽ sử dụng lộ trình giả lập.");return;}
  ctl.routeLoading=true;
  el("roadRoute").disabled=true;
  el("roadRoute").textContent="⌛ Đang lấy đường OSM…";
  const p0=world.position,p1=CITY_ROUTES[ctl.city].points.at(-1);
  const start=[p0[0].toFixed(6),p0[1].toFixed(6)].join(",");
  const finish=[p1[0].toFixed(6),p1[1].toFixed(6)].join(",");
  const url="https://router.project-osrm.org/route/v1/driving/"+start+";"+finish+"?overview=full&geometries=geojson&steps=false";
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch(url,{signal:abort.signal});
    if(!response.ok)throw Error("HTTP "+response.status);
    const data=await response.json();
    if(data.code!=="Ok"||!data.routes?.[0]?.geometry?.coordinates)throw Error("Không có tuyến");
    const coords=data.routes[0].geometry.coordinates;
    if(!Array.isArray(coords)||coords.length<2)throw Error("Tuyến trống");
    world.installRoute(coords,"osm");resetHistories();setRunning(false);createMapRoute();updateReadout();
    say("Đã tải tuyến đường thực từ bộ định tuyến OSRM. Điều khiển thần kinh và 3D vẫn là giả lập.");
  }catch(error){say("OSRM không khả dụng ("+error.message+"). Giữ tuyến giả lập; không dùng dịch vụ thương mại.");}
  finally{clearTimeout(timeout);el("roadRoute").disabled=false;el("roadRoute").textContent="⌖ Tạo tuyến OSM miễn phí";ctl.routeLoading=false;}
}
const palette={
  shell:new THREE.MeshStandardMaterial({color:0x192a30,roughness:.69}),
  black:new THREE.MeshStandardMaterial({color:0x07141b,metalness:.18,roughness:.8}),
  chrome:new THREE.MeshStandardMaterial({color:0x465d62,metalness:.66,roughness:.28}),
  glass:new THREE.MeshPhysicalMaterial({color:0xc7e7ea,metalness:.05,roughness:.14,transparent:true,opacity:.54,side:THREE.DoubleSide,depthWrite:false}),
  fly:new THREE.MeshStandardMaterial({color:0xb78939,roughness:.79}),
  head:new THREE.MeshStandardMaterial({color:0xd1a14b,roughness:.63}),
  eye:new THREE.MeshStandardMaterial({color:0xbe3e28,roughness:.22,metalness:.12}),
  leg:new THREE.MeshStandardMaterial({color:0xa7782b,roughness:.79}),
  orange:new THREE.MeshBasicMaterial({color:0xffae63}),
  cyan:new THREE.MeshBasicMaterial({color:0x44dafa}),
};
function mesh(geom,mat,parent,pos,rot){
  const m=new THREE.Mesh(geom,mat);m.position.set(...pos);if(rot)m.rotation.set(...rot);parent.add(m);return m;
}
function box(parent,w,h,d,xyz,mat,rot){return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,xyz,rot);}
function ball(parent,xyz,radii,mat){const m=mesh(new THREE.SphereGeometry(1,16,12),mat,parent,xyz);m.scale.set(...radii);return m;}
function tube(parent,a,b,r,mat){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dist=start.distanceTo(end);
  const obj=mesh(new THREE.CylinderGeometry(r*.72,r,dist,7),mat,parent,[(start.x+end.x)/2,(start.y+end.y)/2,(start.z+end.z)/2]);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return obj;
}
function makeFly(parent){
  const group=new THREE.Group();parent.add(group);
  ball(group,[0,0,.12],[.34,.37,.75],palette.fly);
  ball(group,[0,.12,-.58],[.37,.34,.39],palette.head);
  ball(group,[-.26,.13,-.75],[.17,.22,.18],palette.eye);
  ball(group,[.26,.13,-.75],[.17,.22,.18],palette.eye);
  for(let i=0;i<4;i++)ball(group,[0,-.03,.55+i*.13],[.26-i*.026,.28-i*.022,.115],i%2?palette.fly:palette.leg);
  const parts=[];
  for(const side of [-1,1]){
    const wing=new THREE.Group();wing.position.set(side*.22,.30,.07);
    const w=ball(wing,[side*.45,.09,.27],[.64,.028,.30],palette.glass);w.rotation.y=side*.25;parts.push({wing,side});group.add(wing);
    for(let i=0;i<3;i++){
      const root=[side*.29,-.19,-.38+i*.28],knee=[side*(.48+i*.02),-.55,-.5+i*.40],foot=[side*(.55+i*.06),-.97,-.75+i*.56];
      tube(group,root,knee,.035,palette.leg);tube(group,knee,foot,.017,palette.leg);
    }
    tube(group,[side*.13,.35,-.84],[side*.17,.59,-1.0],.016,palette.black);
  }
  group.userData.wings=parts;
  return group;
}
function createWorldScene(){
  const canvas=el("sceneCanvas");
  try{
    sceneRenderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance",alpha:false});
    sceneRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    sceneRenderer.outputColorSpace=THREE.SRGBColorSpace;
    sceneRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    sceneRenderer.toneMappingExposure=1.15;
    scene=new THREE.Scene();
    scene.background=new THREE.Color("#95b7c6");
    scene.fog=new THREE.Fog("#a5bfca",45,210);
    scene.add(new THREE.HemisphereLight(0xe1f5ff,0x46575e,2.3));
    const sunlight=new THREE.DirectionalLight(0xffe4b0,3.3);sunlight.position.set(-20,35,-45);scene.add(sunlight);
    const road=box(scene,18,.1,900,[0,-1.0,-315],new THREE.MeshStandardMaterial({color:0x394d54,roughness:.95}));
    box(scene,130,.1,900,[0,-1.12,-315],new THREE.MeshStandardMaterial({color:0x7c987c,roughness:.98}));
    // Preserve asphalt on top of the ground plane.
    road.position.y=-.94;
    for(const side of [-1,1]){
      box(scene,8,.2,900,[side*13,-.89,-315],new THREE.MeshStandardMaterial({color:0xadb3aa,roughness:.96}));
      box(scene,.17,.03,900,[side*8.85,-.81,-315],new THREE.MeshBasicMaterial({color:0xf4cf8f}));
      box(scene,.11,.035,900,[side*5.75,-.87,-315],new THREE.MeshBasicMaterial({color:0xe6e7dc}));
    }
    const white=new THREE.MeshBasicMaterial({color:0xe2e8dc});
    for(let i=0;i<65;i++){const o=box(scene,.25,.015,3.6,[0,-.85,-i*10],white);roadStreaks.push({mesh:o,z:-i*10});}
    const walls=[0x9daeb1,0xc5b4a0,0x718b9b,0xbccac9,0xc9b89b,0x859aa0];
    for(let i=0;i<34;i++)for(const side of [-1,1]){
      const z=-i*20-12,h=7+(i*7+(side+2)*5)%26,offset=side*(20+(i%3)*3);
      const mat=new THREE.MeshStandardMaterial({color:walls[(i+(side+1))%walls.length],roughness:.84});
      const b=box(scene,7.5,h,13,[offset,h/2-1,z],mat);
      buildings.push({mesh:b,z});
      const windows=new THREE.MeshBasicMaterial({color:i%3?0x64838a:0xc5dbca,transparent:true,opacity:.45});
      for(let floor=0;floor<Math.floor(h/4);floor++){
        for(let col=0;col<3;col++){
          box(b,.85,1.4,.055,[(col-1)*1.8,-h/2+2+floor*3.9,6.54],windows);
        }
      }
      if(i%4===0){
        tube(scene,[side*10,-.86,z],[side*10,5.1,z],.10,palette.chrome);
        ball(scene,[side*10,5.5,z],[.18,.23,.17],palette.orange);
      }
    }
    sceneCamera=new THREE.PerspectiveCamera(62,1,.1,1000);
    sceneCamera.position.set(0,2.9,6);
    sceneCamera.lookAt(0,1.9,-31);
    const cockpit=new THREE.Group();sceneCamera.add(cockpit);scene.add(sceneCamera);
    box(cockpit,6.1,.70,1.9,[0,-1.76,-2.5],palette.shell);
    box(cockpit,6.2,.12,1.8,[0,-1.35,-2.3],palette.black);
    box(cockpit,.21,3.4,.33,[-3.05,-.15,-2.7],palette.shell,[0,0,-.17]);
    box(cockpit,.21,3.4,.33,[3.05,-.15,-2.7],palette.shell,[0,0,.17]);
    box(cockpit,6.1,.20,.4,[0,1.52,-3.1],palette.shell);
    ball(cockpit,[1.38,-1.13,-2.0],[.76,.32,.11],palette.chrome);
    box(cockpit,.82,.37,.04,[1.35,-1.06,-1.89],new THREE.MeshBasicMaterial({color:0x174a58}));
    wheelGroup=new THREE.Group();wheelGroup.position.set(-.42,-1.16,-1.94);cockpit.add(wheelGroup);
    const wheel=mesh(new THREE.TorusGeometry(.67,.09,12,35),palette.black,wheelGroup,[0,0,0]);
    const ring=mesh(new THREE.TorusGeometry(.51,.025,6,35),palette.chrome,wheelGroup,[0,0,.03]);
    tube(wheelGroup,[-.62,0,0],[.62,0,0],.046,palette.chrome);
    tube(wheelGroup,[0,0,0],[0,-.55,0],.055,palette.chrome);
    ball(wheelGroup,[0,0,.08],[.18,.18,.07],palette.shell);
    const fly=makeFly(cockpit);
    fly.scale.set(.96,.96,.96);
    fly.position.set(-1.52,-.74,-1.03);fly.rotation.y=-.19;
    wings=fly.userData.wings;
    // Warm transparent windscreen HUD dashes suggest the intended motion, not measured street geometry.
    for(let i=-2;i<=2;i++){
      const obj=box(scene,.28,.019,1.6,[i*.92, -.78,-15],new THREE.MeshBasicMaterial({color:0x42cff5,transparent:true,opacity:.65}));
      obj.rotation.x=0;
      roadStreaks.push({mesh:obj,z:-15-i*4});
    }
    const resize=()=>{
      const bounds=canvas.getBoundingClientRect();
      if(bounds.width<10||bounds.height<10)return;
      sceneRenderer.setSize(bounds.width,bounds.height,false);
      sceneCamera.aspect=bounds.width/bounds.height;sceneCamera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas);resize();renderOK=true;
  }catch(error){
    console.warn("WebGL unavailable",error);el("sceneFallback").style.display="flex";renderOK=false;
  }
}
function renderScene(t){
  if(!renderOK)return;
  const animationDist=world.distance*.27;
  for(const item of roadStreaks){
    const z=item.z+animationDist;
    item.mesh.position.z = -(((Math.abs(item.z)-animationDist+680)%680+680)%680);
  }
  for(const b of buildings){
    b.mesh.position.z = -(((Math.abs(b.z)-animationDist+680)%680+680)%680);
  }
  for(const part of wings)part.wing.rotation.z=part.side*(.25+.22*Math.sin(t*29));
  if(wheelGroup)wheelGroup.rotation.z=-world.steering*Math.PI/180;
  if(sceneCamera)sceneCamera.position.x=Math.sin(world.elapsed*.6)*.035;
  sceneRenderer.render(scene,sceneCamera);
}
function drawCanvas(canvas,paint){
  if(!canvas)return;
  const box=canvas.getBoundingClientRect(),width=box.width,height=box.height;
  if(width<2||height<2)return;
  const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(width*ratio),h=Math.round(height*ratio);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext("2d");ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  paint(ctx,width,height);
}
function neuralColor(group){return GROUPS.find(g=>g.id===group)?.color||"#8ba6b2";}
function renderNeural(time){
  drawCanvas(el("neuralCanvas"),(ctx,w,h)=>{
    const nodes=brain.nodes,edge=brain.edges;
    // Anatomical lobes here are intentionally schematized, not a voxel reconstruction.
    ctx.globalAlpha=.19;ctx.fillStyle="#668a9c";
    ctx.beginPath();ctx.ellipse(w*.31,h*.43,w*.23,h*.37,-.12,0,Math.PI*2);ctx.ellipse(w*.69,h*.43,w*.23,h*.37,.12,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    const maxEdges=Math.min(1000,edge.length);
    for(let i=0;i<maxEdges;i++){
      const e=edge[i],a=nodes[brain.indices.get(e.source)],b=nodes[brain.indices.get(e.target)];if(!a||!b)continue;
      const ai=brain.indices.get(a.id),bi=brain.indices.get(b.id),activity=(brain.activity[ai]+brain.activity[bi])*.5;
      ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);
      const cx=(a.x+b.x)*w*.5,cy=(a.y+b.y)*h*.5-7;
      ctx.quadraticCurveTo(cx,cy,b.x*w,b.y*h);
      ctx.strokeStyle=neuralColor(a.region);ctx.globalAlpha=.065+activity*.23;
      ctx.lineWidth=e.weight<0?.5:.6+activity*.65;ctx.stroke();
    }
    ctx.globalAlpha=1;
    for(let i=0;i<nodes.length;i++){
      const n=nodes[i],a=brain.activity[i]||0;
      ctx.beginPath();ctx.arc(n.x*w,n.y*h,1.2+a*2.5,0,Math.PI*2);
      ctx.fillStyle=neuralColor(n.region);ctx.globalAlpha=.53+a*.47;ctx.fill();
      if(brain.spike[i]){
        ctx.beginPath();ctx.arc(n.x*w,n.y*h,3.5+a*2.5,0,Math.PI*2);
        ctx.strokeStyle=neuralColor(n.region);ctx.globalAlpha=.55;ctx.lineWidth=.7;ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    for(const g of GROUPS){
      const x=g.position[0]*w,y=g.position[1]*h;
      ctx.font="600 10px 'JetBrains Mono',monospace";
      ctx.fillStyle=g.color;ctx.textAlign="center";
      ctx.fillText(g.name,x,g.id==="olfactory"?Math.min(h-35,y+49):Math.max(12,y-59));
    }
    ctx.textAlign="left";
  });
}
function renderRaster(){
  drawCanvas(el("rasterCanvas"),(ctx,w,h)=>{
    const groups=GROUPS.map(g=>g.id),row=h/4,labelW=72;
    ctx.font="10px 'JetBrains Mono',monospace";
    groups.forEach((name,i)=>{
      const y=(i+.5)*row,g=GROUPS[i],hist=history.raster;
      ctx.fillStyle="#8fa5af";ctx.fillText(g.name==="central"?"Central":g.name==="olfactory"?"Khứu giác":g.name==="visual"?"Thị giác":"Vận động",3,y+3);
      ctx.strokeStyle="#1b3744";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(labelW,y);ctx.lineTo(w,y);ctx.stroke();
      ctx.strokeStyle=g.color;ctx.lineWidth=1.1;
      for(let j=0;j<hist.length;j++){
        const sample=hist[j][name],x=labelW+(w-labelW)*j/Math.max(1,hist.length-1);
        if(sample>.20 && Math.sin(j*7.92+i*3.7)>.15){
          ctx.globalAlpha=clamp(sample,.3,.95);
          ctx.beginPath();ctx.moveTo(x,y-row*.20);ctx.lineTo(x,y+row*.20);ctx.stroke();
        }
      }
      ctx.globalAlpha=1;
    });
  });
}
function drawLeg(){
  drawCanvas(el("legCanvas"),(ctx,w,h)=>{
    const steer=world.steering*Math.PI/180;
    ctx.save();ctx.translate(w*.49,h*.64);ctx.rotate(-steer);
    ctx.strokeStyle="#4b5e65";ctx.lineWidth=Math.min(w,h)*.10;
    ctx.beginPath();ctx.ellipse(0,0,w*.30,h*.42,0,0,2*Math.PI);ctx.stroke();
    ctx.strokeStyle="#afbbc1";ctx.lineWidth=6;
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*w*.27,Math.sin(a)*h*.36);ctx.stroke();}
    ctx.fillStyle="#536973";ctx.beginPath();ctx.arc(0,0,13,0,2*Math.PI);ctx.fill();ctx.restore();
    const knee=[w*.23,h*.20],ankle=[w*.47,h*.31],tip=[w*.51+world.steering*.25,h*.39];
    ctx.lineCap="round";
    ctx.strokeStyle="#b88d3a";ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-5,h*.02);ctx.lineTo(...knee);ctx.lineTo(...ankle);ctx.stroke();
    ctx.strokeStyle="#e3bd6b";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(...ankle);ctx.lineTo(...tip);ctx.stroke();
    for(const [x,y] of [knee,ankle,tip]){ctx.fillStyle="#e5a84f";ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#89eff0";ctx.font="10px 'JetBrains Mono',monospace";ctx.fillText("FORELEG / VÔ LĂNG",9,17);
  });
}
function trace(canvasId,values,color){
  drawCanvas(el(canvasId),(ctx,w,h)=>{
    const grid="#183542";ctx.strokeStyle=grid;ctx.lineWidth=.7;
    for(let i=0;i<3;i++){const y=(i+.5)*h/3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    if(values.length<2)return;
    let maximum=Math.max(1,...values.map(v=>Math.abs(v)));
    ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();
    values.forEach((v,i)=>{const x=i/(values.length-1)*w,y=h/2-(v/maximum)*h*.43;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
  });
}
function samplePlots(){
  const cap=125;
  const push=(arr,val)=>{arr.push(val);if(arr.length>cap)arr.shift();};
  push(history.steer,world.steering);
  push(history.force,world.force);
  push(history.joint,world.joint);
  push(history.raster,{...brain.rate});
  renderRaster();
  trace("steerChart",history.steer,"#f6a957");trace("forceChart",history.force,"#46dfff");trace("jointChart",history.joint,"#61efa6");
  el("steerTrace").textContent=(world.steering>=0?"+":"")+fmt(world.steering)+"°";
  el("forceTrace").textContent=fmt(world.force,2)+" mN";
  el("jointTrace").textContent=fmt(world.joint,2)+" rad";
}
function headingText(angle){return String(Math.round(bearingDegrees(angle))).padStart(3,"0")+"°";}
function updateReadout(){
  const g=world.guidance(),position=world.position;
  const headingDeg=bearingDegrees(world.heading);
  const errorDeg=wrapRad(g.error)*180/Math.PI;
  const simulatedSeconds=Math.floor(world.elapsed);
  el("clock").firstChild.nodeValue=[Math.floor(simulatedSeconds/3600),Math.floor(simulatedSeconds/60)%60,simulatedSeconds%60].map(v=>String(v).padStart(2,"0")).join(":");
  el("simClock").textContent="SIM × "+fmt(ctl.scale);
  el("speedLive").textContent=fmt(world.speed*3.6);
  el("headingLive").textContent=headingText(world.heading);
  el("steerLive").textContent=(world.steering>=0?"+":"")+fmt(world.steering)+"°";
  el("routeState").textContent=world.complete?"ĐÃ ĐẾN":ctl.playing?"ĐANG LÁI":"TẠM DỪNG";
  el("routeError").textContent="Lệch hướng "+fmt(errorDeg,1)+"°";
  el("gpsLat").textContent=fmt(position[1],5)+"° N";
  el("gpsLng").textContent=fmt(position[0],5)+"° E";
  el("distanceLive").textContent=fmt(world.distance)+" m";
  el("progressLive").textContent=g.progress+"% tiến độ tuyến";
  el("remainingLive").textContent=fmt(g.remaining,0)+" m";
  el("etaLive").textContent="Còn khoảng "+Math.round(g.remaining/Math.max(4,world.speed||8.3))+" giây";
  el("neuralRate").textContent=fmt(Object.values(brain.rate).reduce((a,b)=>a+b,0)*18)+" Hz";
  el("graphSize").textContent=brain.nodes.length+" nút · "+brain.edges.length+" cạnh";
  el("turnArrow").textContent=errorDeg>15?"↱":errorDeg< -15?"↰":"↑";
  el("turnInstruction").textContent=world.complete?"Đã đến điểm đích":errorDeg>15?"Điều chỉnh sang trái":errorDeg< -15?"Điều chỉnh sang phải":"Tiếp tục đi thẳng";
  el("destinationName").textContent=CITY_ROUTES[ctl.city].destination+" · "+fmt(g.remaining,0)+" m";
  el("visualSensor").textContent="TÍN HIỆU "+Math.round(brain.rate.visual*100)+"%";
  el("smellSensor").textContent="CƯỜNG ĐỘ "+Math.round(ctl.odor*100)+"%";
  el("imuSensor").textContent=headingDeg.toFixed(0)+"°";
  el("neuroMode").textContent=brain.graph.source==="uploaded"?"Graph tải lên · hoạt động mô phỏng":"Mạch nối giả lập";
}
function exportGeoJSON(){
  const p={
    type:"FeatureCollection",name:"MapFly NeuroGIS",
    properties:{data_kind:"simulation",model:"connectome-inspired graph; unvalidated dynamics",connectome_source:brain.graph.source,route_source:world.routeKind,city:world.city},
    features:[
      {type:"Feature",properties:{kind:"current-simulated-position",speed_kmh:world.speed*3.6,heading_deg:bearingDegrees(world.heading),steering_deg:world.steering},geometry:{type:"Point",coordinates:world.position}},
      {type:"Feature",properties:{kind:"simulated-trajectory"},geometry:{type:"LineString",coordinates:world.track}},
      {type:"Feature",properties:{kind:world.routeKind==="osm"?"OSRM-road-geometry":"preset-waypoint-polyline"},geometry:{type:"LineString",coordinates:world.route}}
    ]
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:"application/geo+json"}));
  const a=document.createElement("a");a.href=url;a.download="mapfly-neurogis-"+ctl.city+".geojson";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bindInputs(){
  el("go").addEventListener("click",()=>{if(world.complete)setCity(ctl.city);setRunning(true);say("Mô phỏng đang chạy. Tín hiệu thần kinh giả lập tác động tới điều hướng.");});
  el("pause").addEventListener("click",()=>setRunning(false));
  el("reset").addEventListener("click",()=>setCity(ctl.city));
  el("city").addEventListener("change",e=>setCity(e.target.value));
  el("roadRoute").addEventListener("click",requestOSRM);
  el("export").addEventListener("click",exportGeoJSON);
  el("simSpeed").addEventListener("input",e=>{ctl.scale=Number(e.target.value);el("simSpeedValue").textContent=fmt(ctl.scale,2)+"×";});
  el("neuralGain").addEventListener("input",e=>{ctl.gain=Number(e.target.value)/100;el("neuralGainValue").textContent=Math.round(ctl.gain*100)+"%";});
  for(const n of ["odor","wind"])el(n).addEventListener("input",e=>{ctl[n]=Number(e.target.value)/100;el(n+"Value").textContent=Math.round(ctl[n]*100)+"%";});
  el("follow").addEventListener("change",e=>ctl.follow=e.target.checked);
  el("neuralControl").addEventListener("change",e=>ctl.neural=e.target.checked);
  for(const [id,dir] of [["turnLeft",1],["turnRight",-1]]){
    el(id).addEventListener("pointerdown",()=>ctl.manual=dir);
    el(id).addEventListener("pointerup",()=>ctl.manual=0);
    el(id).addEventListener("pointercancel",()=>ctl.manual=0);
    el(id).addEventListener("pointerleave",()=>ctl.manual=0);
    el(id).addEventListener("click",()=>{ctl.manual=dir;setTimeout(()=>{if(ctl.manual===dir)ctl.manual=0;},380);});
  }
  document.addEventListener("keydown",e=>{
    if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
    if(e.code==="ArrowLeft"){e.preventDefault();ctl.manual=1;}
    if(e.code==="ArrowRight"){e.preventDefault();ctl.manual=-1;}
    if(e.code==="Space"&&!e.repeat){e.preventDefault();setRunning(!ctl.playing);}
  });
  document.addEventListener("keyup",e=>{if(["ArrowLeft","ArrowRight"].includes(e.code))ctl.manual=0;});
  document.addEventListener("visibilitychange",()=>{lastTime=performance.now();if(document.hidden&&ctl.playing){setRunning(false);say("Mô phỏng tự tạm dừng khi ẩn tab để tiết kiệm tài nguyên.");}});
  el("viewMap").addEventListener("click",()=>toggleMap(true));
  el("viewCockpit").addEventListener("click",()=>toggleMap(false));
  el("connectomeFile").addEventListener("change",async e=>{
    const f=e.target.files?.[0];if(!f)return;
    if(f.size>350000){say("Tệp đồ thị vượt 350 KB; hãy trích một tập con tối đa 240 nút.");return;}
    try{
      const candidate=validateGraph(JSON.parse(await f.text()));
      brain.install(candidate);resetHistories();
      el("connectomeBadge").textContent="GRAPH TẢI LÊN";
      el("connectomeBadge").className="chip green";
      el("neuroMode").textContent="Graph tự nạp · mô phỏng";
      say("Đã nạp "+candidate.nodes.length+" nút và "+candidate.edges.length+" cạnh. Trọng số, xung và ánh xạ phản ứng vẫn phải được kiểm định.");
    }catch(error){say("Không nạp được đồ thị: "+error.message);}
    finally{e.target.value="";}
  });
}
function toggleMap(expanded){
  el("stage").classList.toggle("map-expanded",expanded);
  el("viewMap").classList.toggle("active",expanded);
  el("viewCockpit").classList.toggle("active",!expanded);
  if(map){setTimeout(()=>{map.invalidateSize();if(expanded)map.setView([world.position[1],world.position[0]],Math.max(15,map.getZoom()));},250);}
}
function renderLoop(now){
  requestAnimationFrame(renderLoop);
  const dt=Math.min(.055,Math.max(0,(now-(lastTime||now))/1000));lastTime=now;
  nowTick=now;
  if(ctl.playing){
    const simDt=dt*ctl.scale;
    const guidance=world.guidance();
    const neural=brain.step(simDt,{turn:clamp(guidance.error/.75,-1,1),odor:ctl.odor,wind:Math.sin(world.elapsed*.4)*ctl.wind});
    world.update(simDt,neural.steer*ctl.gain,ctl.manual,ctl.neural);
    if(world.complete){setRunning(false);say("Đã tới gần điểm đích; tác tử tự dừng.");}
  }
  if(now-lastNeuro>120){
    lastNeuro=now;samplePlots();renderNeural(now);drawLeg();
  }
  if(now-lastUI>170){lastUI=now;updateReadout();}
  if(map&&now-lastMap>700){
    lastMap=now;
    mapFly.setLatLng([world.position[1],world.position[0]]);
    mapTravel.setLatLngs(world.track.map(p=>[p[1],p[0]]));
    if(ctl.playing&&ctl.follow&&world.distance>20){
      const center=map.getCenter(),dist=geoDistance([center.lng,center.lat],world.position);
      if(dist>75)map.panTo([world.position[1],world.position[0]],{animate:true,duration:.6});
    }
  }
  renderScene(now*.001);
}
bindInputs();
createWorldScene();
initMap();
updateReadout();
requestAnimationFrame(renderLoop);
