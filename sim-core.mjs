// MapFly NeuroGIS: deterministic connectome-inspired control demo.
// Default graph is SYNTHETIC. No MaleCNS synapse is fabricated as a real measurement.
export const CITY_ROUTES = {
  hcm: { title:"TP. Hồ Chí Minh", center:[106.70103,10.77595], destination:"Công viên Tao Đàn", points:[[106.70103,10.77595],[106.70055,10.77534],[106.69965,10.77492],[106.69799,10.77383],[106.69707,10.77477],[106.69547,10.77682]] },
  hanoi: {title:"Hà Nội",center:[105.85203,21.02851],destination:"Vườn hoa Lý Thái Tổ",points:[[105.85203,21.02851],[105.85280,21.02888],[105.85368,21.02863],[105.85401,21.02797],[105.85355,21.02671],[105.85244,21.02655]]},
  vinhlong: {title:"Vĩnh Long",center:[105.97222,10.25277],destination:"Bờ sông Cổ Chiên",points:[[105.97222,10.25277],[105.97355,10.25290],[105.97437,10.25252],[105.97519,10.25186],[105.97580,10.25116],[105.97555,10.25048]]}
};
const RAD = Math.PI / 180;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const wrapRad = a => Math.atan2(Math.sin(a),Math.cos(a));
export const bearingDegrees = r => (90-r / RAD+360)%360;
export function geoDistance(a,b) {
  const lat1=a[1]*RAD,lat2=b[1]*RAD,dlat=lat2-lat1,dlon=(b[0]-a[0])*RAD;
  const x=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(x)));
}
export function localDelta(a,b) {
  const lat=((a[1]+b[1])/2)*RAD;
  return { east:(b[0]-a[0])*111320*Math.cos(lat), north:(b[1]-a[1])*111320 };
}
export function moveGeo(p,east,north) {
  return [p[0]+east/(111320*Math.max(.01,Math.cos(p[1]*RAD))),p[1]+north/111320];
}
export function densify(points, spacing=7) {
  if(!Array.isArray(points) || points.length<2)throw Error("Cần tối thiểu hai điểm GPS.");
  const out=[points[0].slice()];
  for(let i=1;i<points.length;i++){
    const prev=points[i-1],next=points[i],dist=geoDistance(prev,next);
    const count=Math.min(350,Math.max(1,Math.ceil(dist/spacing)));
    for(let k=1;k<=count;k++){
      const t=k/count;
      out.push([prev[0]+(next[0]-prev[0])*t,prev[1]+(next[1]-prev[1])*t]);
    }
  }
  if(out.length>6000)throw Error("Tuyến quá dài cho phiên trình diễn.");
  return out;
}
export function routeLength(route) {
  let total=0;for(let i=1;i<route.length;i++)total+=geoDistance(route[i-1],route[i]);return total;
}
export function normalizedRoute(coords) {
  if(!Array.isArray(coords)||coords.length<2||coords.length>10000)throw Error("Hình học tuyến không hợp lệ.");
  const clean=coords.filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85);
  if(clean.length<2)throw Error("Tọa độ tuyến không hợp lệ.");
  const route=densify(clean,9);
  if(routeLength(route)>25000)throw Error("Chỉ hỗ trợ tuyến thử nghiệm không quá 25 km.");
  return route;
}
export function buildDemoRoute(city) {return normalizedRoute(CITY_ROUTES[city].points);}
function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}}
export const GROUPS = [
 {id:"visual",name:"Thị giác",color:"#32d9ff",position:[.25,.43]},
 {id:"olfactory",name:"Khứu giác",color:"#57e6a7",position:[.26,.76]},
 {id:"central",name:"Central complex",color:"#ffae52",position:[.52,.28]},
 {id:"motor",name:"Vận động",color:"#c28aff",position:[.77,.55]}
];
const VALID_GROUPS = new Set(GROUPS.map(g=>g.id));
export function buildDemoGraph() {
  const rand=seeded(135799),nodes=[],edges=[],sizes=[18,12,20,22];
  for(let g=0;g<GROUPS.length;g++)for(let i=0;i<sizes[g];i++){
    const reg=GROUPS[g],side= i%2?1:-1;
    nodes.push({id:reg.id+"-"+i,region:reg.id,side, x:clamp(reg.position[0]+(rand()-.5)*.24,.05,.95),y:clamp(reg.position[1]+(rand()-.5)*.34,.08,.91)});
  }
  function connect(a,b,weight){edges.push({source:a.id,target:b.id,weight});}
  for(const src of nodes){
    const peers=nodes.filter(n=>n.region===src.region&&n.id!==src.id);
    for(let i=0;i<2;i++)connect(src,peers[Math.floor(rand()*peers.length)],(.2+rand()*.55)*(rand()<.13?-1:1));
    const targets=src.region==="visual"?"central":src.region==="olfactory"?"central":src.region==="central"?"motor":"central";
    const next=nodes.filter(n=>n.region===targets);
    for(let j=0;j<3;j++)connect(src,next[Math.floor(rand()*next.length)],(.25+rand()*.55)*(rand()<.18?-1:1));
  }
  return {name:"Sơ đồ kết nối mô phỏng",source:"synthetic",nodes,edges};
}
function strId(v){return typeof v==="number"&&Number.isFinite(v)?String(v):typeof v==="string"&&v.length>0&&v.length<=110?v:null;}
export function validateGraph(payload) {
  if(!payload||typeof payload!=="object"||!Array.isArray(payload.nodes)||!Array.isArray(payload.edges))throw Error("JSON cần có mảng nodes và edges.");
  if(payload.nodes.length<4||payload.nodes.length>240||payload.edges.length<1||payload.edges.length>1600)throw Error("Hỗ trợ 4–240 neuron và 1–1600 cạnh.");
  const rand=seeded(176891),ids=new Set();
  const nodes=payload.nodes.map((n,i)=>{
    const id=strId(n.id);if(!id||ids.has(id))throw Error("Trùng hoặc thiếu ID neuron.");ids.add(id);
    const region=String(n.region||n.group||"").toLowerCase();
    if(!VALID_GROUPS.has(region))throw Error("Mỗi neuron cần region: visual, olfactory, central hoặc motor.");
    const g=GROUPS.find(g=>g.id===region);
    const side=n.side===-1?-1:n.side===1?1:i%2?-1:1;
    return {id,region,side,x:clamp(g.position[0]+(rand()-.5)*.22,.03,.97),y:clamp(g.position[1]+(rand()-.5)*.30,.04,.96)};
  });
  if(!nodes.some(n=>n.region==="motor")||!nodes.some(n=>n.region==="visual")||!nodes.some(n=>n.region==="central"))throw Error("Cần nhóm visual, central và motor để điều khiển.");
  const edges=payload.edges.map(e=>{
    const source=strId(e.source),target=strId(e.target),weight=Number(e.weight);
    if(!ids.has(source)||!ids.has(target)||!Number.isFinite(weight)||Math.abs(weight)>100000)throw Error("Cạnh có nguồn/đích/trọng số không hợp lệ.");
    return {source,target,weight:clamp(weight/Math.max(1,Math.abs(weight)), -1,1)};
  });
  return {name:String(payload.name||"Đồ thị tự nạp").slice(0,80),source:"uploaded",nodes,edges};
}
export class NeuralController {
  constructor(graph=buildDemoGraph()){this.install(graph);}
  install(graph){
    this.graph=graph;this.nodes=graph.nodes;this.edges=graph.edges;this.indices=new Map(this.nodes.map((n,i)=>[n.id,i]));
    this.inbound=Array.from({length:this.nodes.length},()=>[]);
    for(const edge of this.edges){
      const src=this.indices.get(edge.source),dst=this.indices.get(edge.target);
      if(src!==undefined&&dst!==undefined)this.inbound[dst].push([src,edge.weight]);
    }
    this.activity=new Float32Array(this.nodes.length);
    this.spike=new Uint8Array(this.nodes.length);
    this.rate={visual:0,olfactory:0,central:0,motor:0};
    this.lastSteer=0;this.time=0;
  }
  step(dt,sensors){
    this.time+=dt;
    const prev=this.activity;
    const next=new Float32Array(prev.length);
    let left=0,right=0,ln=0,rn=0;
    const counts={visual:0,olfactory:0,central:0,motor:0};
    const sum={visual:0,olfactory:0,central:0,motor:0};
    const turn=clamp(sensors.turn||0,-1,1),odor=clamp(sensors.odor||0,0,1),wind=clamp(sensors.wind||0,-1,1);
    for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i],incoming=this.inbound[i];
      let drive=0;
      if(n.region==="visual")drive=.28+.52*Math.max(0,turn*n.side)+.23*(1-Math.abs(turn));
      else if(n.region==="olfactory")drive=.20+.65*odor*(n.side===1?1:.8);
      else if(n.region==="central")drive=.18+.12*wind*n.side;
      else drive=.15;
      let integrated=0;
      for(let k=0;k<incoming.length;k++){const [from,w]=incoming[k];integrated+=prev[from]*w;}
      const target=clamp(drive+integrated/Math.max(1,Math.sqrt(incoming.length)*2),0,1);
      next[i]=clamp(prev[i]+(target-prev[i])*clamp(dt*10,.04,.72),0,1);
      const pulse=(Math.sin(this.time*13+i*1.791)*.5+.5);
      this.spike[i]=pulse<next[i]*.33?1:0;
      sum[n.region]+=next[i];counts[n.region]++;
      if(n.region==="motor"){
        if(n.side<0){left+=next[i];ln++;}else{right+=next[i];rn++;}
      }
    }
    this.activity=next;
    for(const key of Object.keys(this.rate))this.rate[key]=counts[key]?sum[key]/counts[key]:0;
    this.lastSteer=clamp(((right/Math.max(1,rn))-(left/Math.max(1,ln)))*1.65,-1,1);
    return {steer:this.lastSteer,rates:{...this.rate},meanSpike:Object.values(this.rate).reduce((a,b)=>a+b,0)*18};
  }
}
export class DriveWorld {
  constructor(city="hcm"){this.reset(city);}
  reset(city="hcm"){
    if(!CITY_ROUTES[city])throw Error("Thành phố không được hỗ trợ.");
    this.city=city;this.route=buildDemoRoute(city);this.routeKind="preset";
    this.position=this.route[0].slice();this.heading=Math.atan2(localDelta(this.route[0],this.route[1]).north,localDelta(this.route[0],this.route[1]).east);
    this.speed=0;this.distance=0;this.elapsed=0;this.steering=0;this.force=0;this.joint=0;this.nextIndex=1;this.track=[this.position.slice()];this.complete=false;this.deviation=0;
  }
  installRoute(route,kind="osm"){
    const path=normalizedRoute(route);
    this.route=path;this.routeKind=kind;
    this.position=path[0].slice();
    this.heading=Math.atan2(localDelta(path[0],path[1]).north,localDelta(path[0],path[1]).east);
    this.speed=0;this.distance=0;this.elapsed=0;this.steering=0;this.force=0;this.joint=0;this.nextIndex=1;this.track=[this.position.slice()];this.complete=false;this.deviation=0;
  }
  guidance(){
    let best=this.nextIndex,bestDist=1e9;
    const end=Math.min(this.route.length-1,this.nextIndex+32);
    for(let i=Math.max(0,this.nextIndex-6);i<=end;i++){
      const d=geoDistance(this.position,this.route[i]);
      if(d<bestDist){bestDist=d;best=i;}
    }
    this.nextIndex=Math.min(this.route.length-1,Math.max(this.nextIndex,best));
    const targetIndex=Math.min(this.route.length-1,this.nextIndex+7);
    const target=this.route[targetIndex],delta=localDelta(this.position,target);
    const desired=Math.atan2(delta.north,delta.east);
    const error=wrapRad(desired-this.heading);
    const remaining=geoDistance(this.position,this.route[this.route.length-1]);
    return {desired,error,remaining,target,targetIndex,nearestDistance:bestDist,progress:Math.round(100*this.nextIndex/Math.max(1,this.route.length-1))};
  }
  update(dt,neuralSteer,manual=0,enabled=true){
    if(this.complete)return this.guidance();
    const guidance=this.guidance();
    const turn=clamp(guidance.error,-1,1);
    const gain=enabled?clamp(neuralSteer,-1,1):0;
    const angle=clamp(36*turn+14*gain+20*manual,-34,34);
    const targetSpeed=guidance.remaining<18?5.5:8.3;
    this.speed+=clamp(targetSpeed-this.speed,-dt*5,dt*3.5);
    this.steering+=(angle-this.steering)*clamp(dt*6,0,1);
    const yawRate=this.speed/2.7*Math.tan(this.steering*RAD);
    this.heading=wrapRad(this.heading+yawRate*dt);
    const east=Math.cos(this.heading)*this.speed*dt,north=Math.sin(this.heading)*this.speed*dt;
    this.position=moveGeo(this.position,east,north);
    this.elapsed+=dt;this.distance+=this.speed*dt;
    this.deviation=guidance.nearestDistance;
    this.force=.23+Math.abs(this.steering)/34*.64;
    this.joint=this.steering*RAD*.83;
    if(this.elapsed<900 && this.track.length<12000)this.track.push(this.position.slice());
    if(guidance.remaining<6 && this.nextIndex>=this.route.length-11){this.complete=true;this.speed=0;}
    return guidance;
  }
}
