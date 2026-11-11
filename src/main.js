import './style.css';
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const $ = (id) => document.getElementById(id);
const mount = $('threeMount');
const video = $('webcam');
const handCanvas = $('handCanvas');
const handCtx = handCanvas.getContext('2d');
const gestureVisualCanvas = document.getElementById('gestureVisualCanvas');
const gestureVisualCtx = gestureVisualCanvas.getContext('2d');
let visualHands = [];
let visualParticles = [];
let visualWidth = window.innerWidth;
let visualHeight = window.innerHeight;
const visualLinks = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function resizeGestureVisual(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  visualWidth=window.innerWidth;visualHeight=window.innerHeight;
  gestureVisualCanvas.width=Math.round(visualWidth*dpr);gestureVisualCanvas.height=Math.round(visualHeight*dpr);
  gestureVisualCanvas.style.width=visualWidth+'px';gestureVisualCanvas.style.height=visualHeight+'px';
  gestureVisualCtx.setTransform(dpr,0,0,dpr,0,0);
  if(!visualParticles.length){
    visualParticles=Array.from({length:0},()=>({x:Math.random()*visualWidth,y:Math.random()*visualHeight,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,size:Math.random()<.035?1.7:.45+Math.random()*.75,phase:Math.random()*Math.PI*2}));
  } else {
    visualParticles.forEach(p=>{p.x=Math.min(p.x,visualWidth);p.y=Math.min(p.y,visualHeight);});
  }
}
window.addEventListener('resize',resizeGestureVisual);resizeGestureVisual();
function renderGestureVisual(t){
  const ctx=gestureVisualCtx,w=visualWidth,h=visualHeight;
  ctx.clearRect(0,0,w,h);
  // A fine cyan particle field subtly flows across the screen.
  const hands=visualHands.map(hand=>({label:hand.label,joints:hand.landmarks.map(p=>({x:(1-p.x)*w,y:p.y*h}))}));
  const allJoints=hands.flatMap(hand=>hand.joints);
  for(const p of visualParticles){
    p.x+=p.vx+Math.sin(t*.00035+p.phase)*.12;p.y+=p.vy+Math.cos(t*.0003+p.phase)*.12;
    if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;
    let near=Infinity,tx=0,ty=0;
    for(const j of allJoints){const dx=j.x-p.x,dy=j.y-p.y,d=Math.hypot(dx,dy);if(d<near){near=d;tx=dx;ty=dy;}}
    if(near<190){const force=(1-near/190)*.055;p.x+=tx*force;p.y+=ty*force;}
    const glow=near<130?.85:.34+(Math.sin(t*.001+p.phase)+1)*.12;
    ctx.fillStyle=near<130?`rgba(0,220,255,${glow})`:`rgba(0,160,255,${glow})`;
    ctx.fillRect(p.x,p.y,p.size*(near<130?1.35:1),p.size*(near<130?1.35:1));
  }
  if(!hands.length)return;
  // Left hand is cyan; right hand is violet. Both are visualized simultaneously.
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=1.35;
  for(const hand of hands){
    const isLeft=hand.label.toLowerCase()==='left';
    const stroke=isLeft?'rgba(0,235,255,.95)':'rgba(196,120,255,.95)';
    const pointColor=isLeft?'#8ffaff':'#e3c2ff';
    ctx.shadowColor=isLeft?'#00dfff':'#bf65ff';ctx.shadowBlur=12;ctx.strokeStyle=stroke;
    for(const [a,b] of visualLinks){const A=hand.joints[a],B=hand.joints[b];if(!A||!B)continue;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();}
    for(let i=0;i<hand.joints.length;i++){
      const p=hand.joints[i];ctx.beginPath();ctx.arc(p.x,p.y,i===0||[4,8,12,16,20].includes(i)?2.4:1.55,0,Math.PI*2);
      ctx.fillStyle=[4,8,12,16,20].includes(i)?pointColor:stroke;ctx.fill();
    }
    ctx.shadowBlur=0;ctx.font='12px monospace';ctx.fillStyle=pointColor;
    const wrist=hand.joints[0];ctx.fillText(`${hand.label.toUpperCase()} HAND`,wrist.x+8,wrist.y-8);
  }
  ctx.restore();
}

let handLandmarker = null;
let cameraStream = null;
let tracking = false;
let lastVideoTime = -1;
let lastFrame = performance.now();
let frameCount = 0;
let fps = 60;
let currentGesture = 'MOUSE CONTROL';
let targetRotX = -0.08;
let targetRotY = 0.35;
let targetScale = 1;
let currentScale = 1;
let energyMode = false;
let lastGesture = '';
let gestureStableAt = 0;
let pinchStartDistance = null;
let pinchArmed = false;
let pinchStartScale = 1;
let pinchZoomTriggered = false; let previousZoomPose = null; let zoomNeutralSince = 0; let zoomNeedsNeutral = false;
let zoomCandidatePose = null; let zoomCandidateFrames = 0; let zoomHasNeutralBaseline = false;
let fistZoomTriggered = false;
let thumbIndexOpenZoomTriggered = false;
let previousHand = null;
let previousIndexTip = null;
let rightSwipeSpinSpeed = 0;
let rightSwipeTiltSpeed = 0;
let rightSwipeAnchor = null;
let previousSwipeFinger = null;
let corePower = 78;
let animationTime = 0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070913, 0.055);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.15, 8.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
mount.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xb4c6ee, 2.6));
// Soft light from the viewer's side so the CENTER of the Earth is as bright as the edges.
const frontLight = new THREE.DirectionalLight(0xffffff, 2.4); frontLight.position.set(0, 0.4, 6); scene.add(frontLight);
const keyLight = new THREE.PointLight(0x53f5ff, 38, 20); keyLight.position.set(3, 3, 4); scene.add(keyLight);
const purpleLight = new THREE.PointLight(0xa66bff, 6, 15); purpleLight.position.set(-4, 1, 3); scene.add(purpleLight);
const rimLight = new THREE.PointLight(0x2266ff, 30, 12); rimLight.position.set(0, -3, -2); scene.add(rimLight);

const robot = new THREE.Group(); scene.add(robot);
const bodyGroup = new THREE.Group(); robot.add(bodyGroup);
const mat = (color, metalness=0.65, roughness=0.28, emissive=0x000000, intensity=0) => new THREE.MeshStandardMaterial({color, metalness, roughness, emissive, emissiveIntensity:intensity});
const cyan = mat(0x53f5ff, .45, .2, 0x21eaff, 2.2);
const purple = mat(0xa66bff, .45, .2, 0x7228ff, 1.9);
const dark = mat(0x090f20, .65, .36, 0x0b1633, .4);
function mesh(geometry, material, parent=bodyGroup, pos=[0,0,0], rot=[0,0,0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m;
}
function torus(r,t,material,parent=bodyGroup,pos=[0,0,0],rot=[0,0,0]) {
  return mesh(new THREE.TorusGeometry(r,t,8,96),material,parent,pos,rot);
}

// Build an Earth-like equirectangular texture locally so the globe does not depend on a texture URL.
function makeEarthTexture(){
  const c=document.createElement('canvas'); c.width=1024; c.height=512;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,'#061a42');g.addColorStop(.5,'#087bb4');g.addColorStop(1,'#04132f');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
  // Ocean glow and subtle bathymetric bands
  for(let i=0;i<18;i++){ctx.beginPath();ctx.strokeStyle=`rgba(66,210,255,${.025+i*.0015})`;ctx.lineWidth=2;ctx.ellipse(512,256,90+i*25,38+i*12,0,0,Math.PI*2);ctx.stroke();}
  const land='#4cba83',edge='#9affc5';
  const continents=[
   [[.06,.24],[.12,.14],[.20,.13],[.24,.20],[.21,.28],[.18,.34],[.16,.44],[.12,.51],[.10,.42],[.07,.34]], // N America
   [[.20,.48],[.24,.51],[.26,.61],[.24,.73],[.22,.85],[.19,.75],[.18,.62]], // S America
   [[.43,.18],[.48,.13],[.54,.16],[.58,.24],[.56,.32],[.51,.36],[.49,.44],[.45,.39],[.43,.29]], // Europe/Africa north
   [[.48,.38],[.54,.36],[.57,.46],[.55,.61],[.52,.75],[.49,.69],[.47,.55],[.45,.45]], // Africa
   [[.59,.20],[.67,.13],[.78,.16],[.87,.25],[.83,.35],[.74,.38],[.68,.32],[.62,.31]], // Asia
   [[.72,.43],[.78,.40],[.82,.47],[.80,.57],[.76,.61],[.73,.54]], // SE Asia
   [[.80,.64],[.87,.61],[.91,.68],[.88,.78],[.83,.80],[.79,.72]], // Australia
   [[.35,.13],[.39,.10],[.41,.15],[.38,.19]], [[.03,.58],[.06,.55],[.08,.59],[.06,.63]],
   [[.91,.42],[.94,.39],[.96,.45],[.93,.49]]
  ];
  for(const poly of continents){ctx.beginPath();poly.forEach((pt,i)=>{const x=pt[0]*1024,y=pt[1]*512;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle=land;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=2;ctx.stroke();}
  // Polar ice
  ctx.fillStyle='#d6fbff';ctx.fillRect(0,0,1024,22);ctx.fillRect(0,490,1024,22);
  // Fine cloud wisps
  for(let i=0;i<150;i++){const x=Math.random()*1024,y=35+Math.random()*442;ctx.beginPath();ctx.ellipse(x,y,8+Math.random()*26,1+Math.random()*4,Math.random()*.5,0,Math.PI*2);ctx.fillStyle=`rgba(220,250,255,${.04+Math.random()*.12})`;ctx.fill();}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const earthGroup=new THREE.Group();bodyGroup.add(earthGroup);
const earthRadius=1.22;
// NASA Blue Marble Next Generation (January global base map, 5400x2700).
// The procedural map remains as a fallback if the NASA asset cannot be reached.
const earthMat=new THREE.MeshStandardMaterial({map:makeEarthTexture(),roughness:.82,metalness:.02,emissive:0xffffff,emissiveIntensity:.45});
earthMat.fog=false;
// Ocean boost: the NASA map's sea is very dark navy, and tone mapping turns it grey.
// Detect ocean pixels (blue clearly above red, not ice/snow) and give them a vivid blue.
// The self-glow (emissive) follows the same recoloured texture, so land keeps its true colours.
const OCEAN_BLUE='vec3(0.005,0.10,0.50)';   // linear RGB of the deep-sea colour (raise 0.50 for lighter blue)
earthMat.onBeforeCompile=(sh)=>{
  sh.fragmentShader=sh.fragmentShader
    .replace('#include <map_fragment>',`#include <map_fragment>
      {
        vec3 c0=diffuseColor.rgb;
        float oceanMask=smoothstep(0.004,0.05,c0.b-c0.r)*(1.0-smoothstep(0.35,0.6,c0.r));
        float lum=dot(c0,vec3(0.3333));
        vec3 oceanCol=${OCEAN_BLUE}*(0.65+3.0*lum);
        diffuseColor.rgb=mix(c0,oceanCol,oceanMask);
      }`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance*=diffuseColor.rgb;');
};
const nasaEarthTextureUrl='https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg';
const nasaTextureLoader=new THREE.TextureLoader();
nasaTextureLoader.setCrossOrigin('anonymous');
nasaTextureLoader.load(nasaEarthTextureUrl,(texture)=>{
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  earthMat.map=texture;
  earthMat.needsUpdate=true;
  const sourceLabel=document.getElementById('textureSource');
  if(sourceLabel) sourceLabel.textContent='CREATE BY BERYL DUMANAO';
},undefined,()=>{
  const sourceLabel=document.getElementById('textureSource');
  if(sourceLabel) sourceLabel.textContent='LOCAL FALLBACK MAP // NASA TEXTURE UNAVAILABLE';
});
const earth=mesh(new THREE.SphereGeometry(earthRadius,128,96),earthMat,earthGroup);
// ---------------------------------------------------------------------------
// COUNTRY LABELS: names stick to the globe surface and rotate with it.
// Only the hemisphere facing the camera is shown, big countries first; smaller ones appear
// as you zoom in, and labels that would overlap on screen are hidden automatically.
// Press N to switch the labels on/off.
// ---------------------------------------------------------------------------
// [name, latitude, longitude, tier]  (tier 1 = always, 2 = zoom >= LABEL_TIER2_ZOOM, 3 = zoom >= LABEL_TIER3_ZOOM)
const COUNTRIES=[
 ['Amerika Serikat',39,-98,1],['Kanada',58,-105,1],['Meksiko',23,-102,1],['Brasil',-10,-52,1],['Argentina',-35,-65,1],
 ['Rusia',61,95,1],['Tiongkok',35,103,1],['India',22,79,1],['Indonesia',-2,118,1],['Australia',-25,134,1],
 ['Aljazair',28,3,1],['Libya',27,17,1],['Mesir',26,30,1],['Afrika Selatan',-30,25,1],['Arab Saudi',24,45,1],
 ['Iran',32,53,1],['Kazakhstan',48,67,1],['Nigeria',9,8,1],['RD Kongo',-3,23,1],['Peru',-9,-75,1],
 ['Kolombia',4,-73,1],['Sudan',15,30,1],['Mongolia',46,105,1],['Ethiopia',9,40,1],
 ['Jepang',36,138,2],['Prancis',46.5,2.5,2],['Jerman',51,10,2],['Inggris',54,-2,2],['Spanyol',40,-4,2],['Italia',42.5,12.5,2],
 ['Turki',39,35,2],['Pakistan',30,70,2],['Chili',-30,-71,2],['Venezuela',7,-66,2],['Mali',17,-3,2],['Niger',17,9,2],
 ['Chad',15,19,2],['Angola',-12,18,2],['Mozambik',-18,35,2],['Zambia',-14,28,2],['Namibia',-22,17,2],['Tanzania',-6,35,2],
 ['Thailand',15,101,2],['Vietnam',16,107,2],['Filipina',12.5,122,2],['Malaysia',4,102,2],['Myanmar',21,96,2],
 ['Bangladesh',24,90,2],['Afghanistan',33,66,2],['Irak',33,44,2],['Ukraina',49,32,2],['Polandia',52,19,2],
 ['Swedia',62,15,2],['Norwegia',62,9,2],['Finlandia',64,26,2],['Kenya',0.5,38,2],['Maroko',32,-6,2],
 ['Bolivia',-17,-64.5,2],['Selandia Baru',-41,174,2],['Papua Nugini',-6,144,2],['Korea Selatan',36.5,128,2],
 ['Madagaskar',-19,47,2],['Somalia',5,46,2],['Yaman',15.5,48,2],['Uzbekistan',41,64,2],['Kamerun',6,12,2],
 ['Ghana',8,-1,2],['Uganda',1.3,32.3,2],['Zimbabwe',-19,30,2],['Botswana',-22,24,2],['Mauritania',20,-10.5,2],
 ['Kuba',22,-79.5,3],['Paraguay',-23,-58,3],['Uruguay',-33,-56,3],['Ekuador',-1.5,-78,3],['Guyana',5,-59,3],
 ['Korea Utara',40,127,3],['Turkmenistan',39,59,3],['Rumania',46,25,3],['Yunani',39,22,3],['Portugal',39.5,-8,3],
 ['Islandia',65,-18,3],['Irlandia',53,-8,3],['Belarus',53.5,28,3],['Pantai Gading',7.5,-5.5,3],['Kamboja',12.5,105,3],
 ['Laos',19,103,3],['Nepal',28,84,3],['Sri Lanka',7.5,80.7,3],['Tunisia',34,9,3],['Suriah',35,38,3],
 ['Yordania',31,36.5,3],['Austria',47.5,14,3],['Swiss',47,8,3],['Belanda',52.3,5.5,3],['Belgia',50.6,4.7,3],
 ['Denmark',56,10,3],['Hongaria',47,19.5,3],['Serbia',44,21,3],['Bulgaria',42.7,25,3],['Georgia',42,43.5,3],
 ['Azerbaijan',40.3,47.7,3],['Kirgistan',41.5,74.5,3],['Tajikistan',39,71,3],['Guatemala',15.5,-90.3,3],
 ['Honduras',15,-86.5,3],['Nikaragua',13,-85,3],['Kosta Rika',10,-84,3],['Panama',8.5,-80,3],['Taiwan',23.7,121,3],
 ['Senegal',14.5,-14.5,3],['Gabon',-0.8,11.8,3],['Malawi',-13.5,34,3],['Oman',21,57,3],['Singapura',1.35,103.8,3],
 ['Timor Leste',-8.8,125.7,3],['Qatar',25.3,51.2,3],['UEA',24,54,3],['Kuwait',29.3,47.5,3],['Siprus',35,33,3],
 ['Slovakia',48.7,19.7,3],['Ceko',49.8,15.5,3],['Kroasia',45.1,15.2,3],['Lituania',55.3,23.9,3],['Fiji',-17.7,178,3],
 ['Jamaika',18.1,-77.3,3],['Togo',8.6,1.2,3],['Guinea',10.9,-10.9,3],['Liberia',6.4,-9.4,3],['Rwanda',-2,29.9,3]
];
const LABEL_TIER2_ZOOM=1.2, LABEL_TIER3_ZOOM=1.7;
const LABEL_FONT_PX=[0,50,38,30];        // text height in texture pixels per tier (4096x2048 map: 1° ≈ 11.4 px)
let showCountryLabels=true;
// The names are PAINTED onto transparent shells that sit just above the Earth surface (one per tier),
// so every label lies on the land itself, wraps with the curvature and can never leave the globe.
const labelShells=[null,null,null,null];
let labelBoxes=[];                        // already-used rectangles (texture px) so labels never overlap
function buildLabelTier(tier){
 const W=4096,H=2048,c=document.createElement('canvas');c.width=W;c.height=H;
 const g=c.getContext('2d');
 g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
 const fpx=LABEL_FONT_PX[tier];
 g.font=`600 ${fpx}px Rajdhani, Arial, sans-serif`;
 for(const [name,lat,lon,t] of COUNTRIES){
  if(t!==tier)continue;
  const x=(lon+180)/360*W,y=(90-lat)/180*H;
  // Equirectangular maps squeeze east-west distances toward the poles: pre-stretch the text to look normal.
  const sx=1/Math.max(Math.cos(lat*Math.PI/180),0.5);
  const tw=g.measureText(name).width*sx+fpx*0.4,th=fpx*1.05;
  if(!labelBoxes.some(b=>Math.abs(x-b.x)<(tw+b.w)/2&&Math.abs(y-b.y)<(th+b.h)/2)){
   labelBoxes.push({x,y,w:tw,h:th});
   for(const dx of [0,-W,W]){                      // repeat across the date line so nothing is cut off
    if(x+dx+tw/2<0||x+dx-tw/2>W)continue;
    g.save();g.translate(x+dx,y);g.scale(sx,1);
    g.lineWidth=fpx*0.16;g.strokeStyle='rgba(0,8,20,.9)';g.strokeText(name,0,2);
    g.fillStyle='#ffffff';g.fillText(name,0,2);
    g.restore();
   }
  }
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 const shell=new THREE.Mesh(
  new THREE.SphereGeometry(earthRadius*(1.003+tier*0.0006),128,96),
  new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,fog:false}));
 shell.renderOrder=5+tier;shell.raycast=()=>{};
 earthGroup.add(shell);labelShells[tier]=shell;
}
function updateCountryLabels(){
 // Tiers are built in order (1 -> 2 -> 3) the first time the zoom needs them, so later tiers avoid earlier ones.
 const need=currentScale>=LABEL_TIER3_ZOOM?3:currentScale>=LABEL_TIER2_ZOOM?2:1;
 for(let t=1;t<=need;t++)if(!labelShells[t])buildLabelTier(t);
 for(let t=1;t<=3;t++)if(labelShells[t])labelShells[t].visible=showCountryLabels&&t<=need;
}
// Atmospheric shells removed: no grey outline rings around the Earth.
// Latitude/longitude wireframe overlay removed for a clean satellite-texture Earth.
// Decorative orbital and floor rings removed for a clean Earth-only scene.
const particlesCount=0;
const particlePositions=new Float32Array(particlesCount*3);
const particleColors=new Float32Array(particlesCount*3);
for(let i=0;i<particlesCount;i++){
  const a=Math.random()*Math.PI*2;
  // Most particles form a tilted orbital dust belt; the rest float around the globe.
  const orbital=i<Math.floor(particlesCount*.72);
  const r=orbital?1.62+Math.random()*.72:1.25+Math.random()*1.45;
  const y=orbital?(Math.random()-.5)*.16:(Math.random()-.5)*3.8;
  const tilt=.42;
  particlePositions[i*3]=Math.cos(a)*r;
  particlePositions[i*3+1]=y*Math.cos(tilt)-Math.sin(a)*r*Math.sin(tilt);
  particlePositions[i*3+2]=Math.sin(a)*r*Math.cos(tilt)+y*Math.sin(tilt);
  const c=new THREE.Color(i%5===0?0xa66bff:0x53f5ff);
  particleColors.set([c.r,c.g,c.b],i*3);
}
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
const particleMat=new THREE.PointsMaterial({size:.025,vertexColors:true,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});
const particles=new THREE.Points(particleGeo,particleMat);scene.add(particles);
const starGeo=new THREE.BufferGeometry();const starPos=[];for(let i=0;i<0;i++){starPos.push((Math.random()-.5)*15,(Math.random()-.5)*10,-2-Math.random()*8);}starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x6686c9,size:.012,transparent:true,opacity:.45})));

function resize(){
 const w=mount.clientWidth||640,h=mount.clientHeight||420;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 const dpr=Math.min(window.devicePixelRatio||1,2);renderer.setPixelRatio(dpr);
 const rect=video.getBoundingClientRect();if(rect.width>0&&rect.height>0){handCanvas.width=Math.round(rect.width*dpr);handCanvas.height=Math.round(rect.height*dpr);handCtx.setTransform(dpr,0,0,dpr,0,0);}
}
new ResizeObserver(resize).observe(mount);window.addEventListener('resize',resize);resize();

function setGesture(name){
 if(name===currentGesture)return;
 currentGesture=name;$('gestureReadout').textContent=name;
 $('unitStatus').textContent=name==='ENERGY MODE'?'ENERGY':name==='OPEN PALM'?'ACTIVE':tracking?'TRACKING':'IDLE';
}
function setStatus(text){$('systemState').textContent=text;}

// ---------------------------------------------------------------------------
// LOW-LIGHT MODE: MediaPipe struggles on dark webcam frames, so when the scene is dark
// we brighten each frame (percentile contrast stretch + gamma) BEFORE detection, relax the
// detection thresholds, and ask the webcam for more exposure. In a bright scene nothing
// changes: the raw <video> goes straight to MediaPipe, exactly as before.
// ---------------------------------------------------------------------------
const LL_ON_LUMA=75, LL_OFF_LUMA=100;   // mean brightness (0-255): enter / leave low-light mode (hysteresis)
const LL_GAMMA=0.6;                     // < 1 lifts shadows (lower = brighter)
const LL_MIN_RANGE=28;                  // limits the max gain so pure sensor noise is not blown up
const LL_DETECT_W=640;                  // width of the enhanced frame given to MediaPipe
const NORMAL_CONF={minHandDetectionConfidence:.55,minHandPresenceConfidence:.5,minTrackingConfidence:.5};
const LOWLIGHT_CONF={minHandDetectionConfidence:.35,minHandPresenceConfidence:.35,minTrackingConfidence:.35};
const llProbe=document.createElement('canvas');llProbe.width=64;llProbe.height=36;
const llProbeCtx=llProbe.getContext('2d',{willReadFrequently:true});
const llCanvas=document.createElement('canvas');llCanvas.width=LL_DETECT_W;llCanvas.height=Math.round(LL_DETECT_W*9/16);
const llCtx=llCanvas.getContext('2d',{willReadFrequently:true});
const llLut=new Uint8ClampedArray(256);
let lowLight=false,llLo=0,llHi=255,llFrame=0,llOrigExposureComp=null;
for(let i=0;i<256;i++)llLut[i]=i;
function buildLowLightLut(){
 const range=Math.max(llHi-llLo,LL_MIN_RANGE);
 for(let i=0;i<256;i++){const x=Math.min(1,Math.max(0,(i-llLo)/range));llLut[i]=Math.round(Math.pow(x,LL_GAMMA)*255);}
}
function analyzeBrightness(){
 // Returns {mean, p2, p98} of the current video frame (cheap: 64x36 sample).
 llProbeCtx.drawImage(video,0,0,64,36);
 const d=llProbeCtx.getImageData(0,0,64,36).data,hist=new Uint16Array(256);let sum=0,n=0;
 for(let i=0;i<d.length;i+=4){const y=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;hist[y]++;sum+=y;n++;}
 const pct=(p)=>{let acc=0,t=n*p;for(let i=0;i<256;i++){acc+=hist[i];if(acc>=t)return i;}return 255;};
 return {mean:sum/n,p2:pct(.02),p98:pct(.98)};
}
function applyExposureBoost(on){
 // Best effort: not every webcam/browser exposes exposure controls.
 try{
  const track=cameraStream?.getVideoTracks?.()[0];if(!track?.getCapabilities)return;
  const caps=track.getCapabilities(),adv={};
  if(caps.exposureMode?.includes?.('continuous'))adv.exposureMode='continuous';
  if(caps.exposureCompensation){
   if(llOrigExposureComp===null)llOrigExposureComp=track.getSettings().exposureCompensation??0;
   const {min,max}=caps.exposureCompensation;
   adv.exposureCompensation=on?min+(max-min)*.8:llOrigExposureComp;
  }
  if(Object.keys(adv).length)track.applyConstraints({advanced:[adv]}).catch(()=>{});
 }catch(_){}
}
function setLowLight(on){
 if(lowLight===on)return;
 lowLight=on;
 try{handLandmarker?.setOptions(on?LOWLIGHT_CONF:NORMAL_CONF);}catch(_){}
 applyExposureBoost(on);
 if(!on)video.style.filter='';
 if(tracking){
  $('visionTag').textContent=on?'LOW-LIGHT BOOST':'ONLINE';
  $('cameraMessage').textContent=on?'Cahaya redup terdeteksi — mode cahaya rendah aktif (frame dicerahkan untuk deteksi tangan).':'Vision online. Tunjukkan satu tangan ke kamera untuk memutar Bumi 3D.';
 }
}
function getDetectionSource(){
 // Called once per processed frame; returns the image MediaPipe should look at.
 const vw=video.videoWidth,vh=video.videoHeight;
 if(!vw||!vh)return video;
 if(llFrame++%8===0){
  const s=analyzeBrightness();
  const wasLow=lowLight;
  if(!lowLight&&s.mean<LL_ON_LUMA)setLowLight(true);
  else if(lowLight&&s.mean>LL_OFF_LUMA)setLowLight(false);
  if(lowLight){
   // Snap to the measured range on entry, then smooth so the picture does not pump between frames.
   const k=wasLow?.25:1;
   llLo+=(Math.min(s.p2,60)-llLo)*k;llHi+=(Math.max(s.p98,llLo+LL_MIN_RANGE)-llHi)*k;
   buildLowLightLut();
   const gain=Math.min(4,Math.max(1,200/Math.max(llHi,1)));
   video.style.filter=`brightness(${gain.toFixed(2)}) contrast(1.1)`;  // brighter on-screen preview too
  }
 }
 if(!lowLight)return video;
 const h=Math.round(LL_DETECT_W*vh/vw);
 if(llCanvas.height!==h)llCanvas.height=h;
 llCtx.drawImage(video,0,0,LL_DETECT_W,h);
 const img=llCtx.getImageData(0,0,LL_DETECT_W,h),d=img.data;
 for(let i=0;i<d.length;i+=4){d[i]=llLut[d[i]];d[i+1]=llLut[d[i+1]];d[i+2]=llLut[d[i+2]];}
 llCtx.putImageData(img,0,0);
 return llCanvas;
}
function resetLowLight(){
 if(lowLight){lowLight=false;applyExposureBoost(false);}
 video.style.filter='';llLo=0;llHi=255;llFrame=0;llOrigExposureComp=null;
}
function drawHand(landmarks){
 const w=handCanvas.clientWidth,h=handCanvas.clientHeight;handCtx.clearRect(0,0,w,h);
 if(!landmarks)return;
 const links=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
 handCtx.lineWidth=2;handCtx.strokeStyle='rgba(83,245,255,.9)';handCtx.shadowColor='#53f5ff';handCtx.shadowBlur=7;
 for(const [a,b] of links){handCtx.beginPath();handCtx.moveTo(landmarks[a].x*w,landmarks[a].y*h);handCtx.lineTo(landmarks[b].x*w,landmarks[b].y*h);handCtx.stroke();}
 for(const p of landmarks){handCtx.beginPath();handCtx.arc(p.x*w,p.y*h,2.1,0,Math.PI*2);handCtx.fillStyle='#c9fbff';handCtx.fill();}
 handCtx.shadowBlur=0;
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function fingerExtended(l,tip,pip){
 // More tolerant extension check using wrist-to-tip distance.
 // For rotation, only index finger (tip 8 / PIP 6) is evaluated.
 const wrist=l[0];
 if(!wrist) return false;
 const ratio=dist(l[tip],wrist)/Math.max(dist(l[pip],wrist),0.001);
 return ratio > (tip===8 ? 1.05 : 1.18);
}
function classifyGesture(l){
 const index=fingerExtended(l,8,6),middle=fingerExtended(l,12,10),ring=fingerExtended(l,16,14),pinky=fingerExtended(l,20,18);
 const pinch=dist(l[4],l[8]);
 if(pinch<.075)return 'PINCH';
 if(!index&&!middle&&!ring&&!pinky)return 'FIST';
 if(index&&middle&&ring&&pinky)return 'OPEN PALM';
 return 'MOVE HAND';
}
// ---------------------------------------------------------------------------
// PINCH ZOOM (continuous), matching the reference image:
//   thumb + index tips moving CLOSER  -> ZOOM IN  (Earth grows)
//   thumb + index tips moving APART   -> ZOOM OUT (Earth shrinks)
// The zoom follows how the finger distance CHANGES, so it works smoothly while
// you move your fingers and stays put when you hold still. It works with any
// detected hand (MediaPipe's Left/Right label is unreliable on un-mirrored webcams).
// ---------------------------------------------------------------------------
const ROTATE_GAIN_Y=5.0;       // horizontal: radians of spin per full-frame fingertip travel
const ROTATE_GAIN_X=3.5;       // vertical tilt gain
const ZOOM_MIN=0.4, ZOOM_MAX=2.6;
const ZOOM_GAIN=6.0;          // zoom per finger movement (higher = more sensitive)
const ZOOM_DEADBAND=0.002;    // ignore tiny jitter (palm-size units per frame)
const ZOOM_HOLD_CLOSE=0.50;   // thumb-index closer than this (x palm size) = HOLD to zoom in
const ZOOM_HOLD_SPREAD=1.15;  // thumb-index wider than this = HOLD to zoom out
const ZOOM_THUMB_OUT=0.8;     // thumb tip must be this far from the pinky base (x palm size) to count as 'thumb out'
const ZOOM_HOLD_RATE=1.1;     // scale multiplier per second while holding a pose
let zoomRatioPrev=null;
let zoomHandKey=null;
let zoomActiveUntil=0;
let zoomLastT=0;
let zoomHoldFrames=0,zoomHoldDir=0;
// Two-finger rule: zoom only counts when BOTH thumb and index tip move (relative to the palm).
const ZOOM_EACH_MIN=0.03;     // EACH fingertip must travel at least this far within the window (x palm size)
const ZOOM_BALANCE=0.15;       // weaker finger must move >= 40% of the stronger one (thumb-only is rejected)
const ZOOM_WINDOW_MS=500;     // time window used to measure fingertip travel
let zoomHist=[];
const ZOOM_ARM_MS=900;        // hold-zoom stays allowed this long after a real two-finger move
let zoomPrevThumb=null,zoomPrevIndex=null,zoomThumbRad=0,zoomIndexRad=0,zoomArmedUntil=0,zoomArmedDir=0;
const zoomBusy=(now)=>now<zoomActiveUntil;
// ZOOM LOCK: zoom stays locked ONLY while the LEFT index finger is shown; lower it and zoom unlocks.
const LOCK_ON_MS=150;    // pose must be seen this long before locking (avoids accidental flicker)
const LOCK_OFF_MS=200;   // pose must be gone this long before unlocking (bridges dropped frames)
let zoomLocked=false,lockOnSince=0,lockOffSince=0;
// (The "ZOOM LOCKED" badge and status texts were removed on request; locking itself still works silently.)
function setZoomLock(v){zoomLocked=v;resetZoomTracking();}
function updateZoomLock(poseOn,now){
 if(poseOn){
   lockOffSince=0;if(!lockOnSince)lockOnSince=now;
   if(!zoomLocked&&now-lockOnSince>=LOCK_ON_MS)setZoomLock(true);
 }else{
   lockOnSince=0;if(!lockOffSince)lockOffSince=now;
   if(zoomLocked&&now-lockOffSince>=LOCK_OFF_MS)setZoomLock(false);
 }
}
function resetZoomTracking(){zoomRatioPrev=null;zoomHoldFrames=0;zoomHoldDir=0;zoomPrevThumb=null;zoomPrevIndex=null;zoomHist=[];zoomArmedUntil=0;zoomArmedDir=0;}
function updateZoom(l,now){
 if(zoomLocked){resetZoomTracking();return;}
 // Normalize by palm size so distance from the camera does not matter.
 const palm=Math.max((dist(l[5],l[17])+dist(l[0],l[9]))/2,0.001);
 const ratio=dist(l[4],l[8])/palm;
 // ONLY THUMB + INDEX may zoom: middle, ring and pinky must be folded (at least 2 of 3),
 // and the thumb must be out (not tucked), so plain pointing or an open palm never zooms.
 const foldedOthers=[[12,10],[16,14],[20,18]].filter(([t,p])=>!fingerExtended(l,t,p)).length;
 const thumbOut=dist(l[4],l[17])/palm>ZOOM_THUMB_OUT;
 if(foldedOthers<1||!thumbOut){resetZoomTracking();zoomLastT=now;return;}
 const dt=Math.min(Math.max((now-zoomLastT)/1000,0),0.1);zoomLastT=now;
 let dir=0; // +1 = zoom out, -1 = zoom in
 // --- Two-finger check over a short time window (cumulative, so jitter cannot fake it) ---
 const cx=(l[0].x+l[5].x+l[17].x)/3, cy=(l[0].y+l[5].y+l[17].y)/3;
 const th={x:(l[4].x-cx)/palm,y:(l[4].y-cy)/palm}, ix={x:(l[8].x-cx)/palm,y:(l[8].y-cy)/palm};
 zoomHist.push({t:now,th,ix});
 while(zoomHist.length>1&&now-zoomHist[0].t>ZOOM_WINDOW_MS)zoomHist.shift();
 let bothMoving=false, moveDir=0;
 if(zoomHist.length>=3){
   const o=zoomHist[0];
   let ax=ix.x-th.x, ay=ix.y-th.y; const al=Math.hypot(ax,ay)||1; ax/=al; ay/=al;   // axis thumb -> index
   const tD=(th.x-o.th.x)*ax+(th.y-o.th.y)*ay;   // + = thumb moved toward index
   const iD=(ix.x-o.ix.x)*ax+(ix.y-o.ix.y)*ay;   // + = index moved away from thumb
   const tA=Math.abs(tD), iA=Math.abs(iD);
   const balanced=Math.min(tA,iA)>=ZOOM_EACH_MIN && Math.min(tA,iA)/Math.max(tA,iA)>=ZOOM_BALANCE;
   if(balanced&&tD>0&&iD<0){bothMoving=true;moveDir=-1;}       // both closing
   else if(balanced&&tD<0&&iD>0){bothMoving=true;moveDir=1;}   // both opening
 }
 zoomPrevThumb=th;zoomPrevIndex=ix;
 if(bothMoving){zoomArmedUntil=now+ZOOM_ARM_MS;zoomArmedDir=moveDir;}
 const armed=now<zoomArmedUntil;
 // 1) HOLD mode: only after a real two-finger move, and only in that same direction.
 const holdDir=ratio<ZOOM_HOLD_CLOSE?-1:(ratio>ZOOM_HOLD_SPREAD?1:0);
 if(armed&&holdDir!==0&&holdDir===zoomArmedDir&&holdDir===zoomHoldDir)zoomHoldFrames++;else{zoomHoldDir=(armed&&holdDir===zoomArmedDir)?holdDir:0;zoomHoldFrames=zoomHoldDir?1:0;}
 if(armed&&holdDir!==0&&zoomHoldFrames>=3){
   targetScale=THREE.MathUtils.clamp(targetScale*Math.pow(ZOOM_HOLD_RATE,holdDir*dt*3),ZOOM_MIN,ZOOM_MAX);
   dir=holdDir;zoomArmedUntil=now+ZOOM_ARM_MS;
 }
 // 2) MOTION mode: both fingers moving together/apart zooms proportionally.
 if(zoomRatioPrev===null){zoomRatioPrev=ratio;}
 else{
   const smoothed=zoomRatioPrev+(ratio-zoomRatioPrev)*0.6;
   const delta=smoothed-zoomRatioPrev;zoomRatioPrev=smoothed;
   if(dir===0&&bothMoving&&Math.abs(delta)>=ZOOM_DEADBAND&&Math.abs(delta)<=0.6){
     targetScale=THREE.MathUtils.clamp(targetScale*Math.exp(delta*ZOOM_GAIN),ZOOM_MIN,ZOOM_MAX);
     dir=delta<0?-1:1;
   }
 }
 if(dir===0)return;
 zoomActiveUntil=now+150;
 // Pause finger-swipe rotation while zooming so the two controls do not fight.
 previousIndexTip=null;rightSwipeAnchor=null;previousSwipeFinger=null;rightSwipeSpinSpeed=rightSwipeSpinSpeed;
 const label=dir>0?'SPREAD — ZOOM IN':'PINCH — ZOOM OUT';
 $('gestureReadout').textContent=label;currentGesture=label;
 $('unitStatus').textContent=dir>0?'ZOOMING IN':'ZOOMING OUT';
}
// --- EARTH-ONLY TOUCH: the index fingertip must be ON the Earth to rotate it ---
// Camera x is mirrored (same as the preview), then mapped over the whole 3D stage and
// tested against the Earth's projected circle (follows zoom + bobbing automatically).
const EARTH_HIT_MARGIN=2.2;  // 1.0 = exact edge of the Earth
const _eC=new THREE.Vector3(),_eR=new THREE.Vector3(),_eS=new THREE.Vector3(),_eE=new THREE.Vector3();
function fingertipOnEarth(pt){
 const rect=renderer.domElement.getBoundingClientRect();
 if(!rect.width||!rect.height)return {on:false,x:0,y:0};
 const px=(1-pt.x)*rect.width, py=pt.y*rect.height;             // fingertip in stage pixels (mirrored)
 camera.updateMatrixWorld();earthGroup.getWorldPosition(_eC);earthGroup.getWorldScale(_eS);
 const c=_eC.clone().project(camera);
 _eR.setFromMatrixColumn(camera.matrixWorld,0).normalize();
 _eE.copy(_eC).addScaledVector(_eR,earthRadius*_eS.x).project(camera);
 const cx=(c.x*0.5+0.5)*rect.width, cy=(-c.y*0.5+0.5)*rect.height;
 const r=Math.abs(_eE.x-c.x)*0.5*rect.width*EARTH_HIT_MARGIN;
 return {on:Math.hypot(px-cx,py-cy)<=r,x:rect.left+px,y:rect.top+py};
}
// (Fingertip cursor circle removed on request; the Earth-only touch test still works silently.)
function showTipCursor(){}
function hideTipCursor(){}
function processLandmarks(l,confidence){
 drawHand(l);$('confidenceValue').textContent=`${Math.round(confidence*100)}%`;$('confidenceBar').style.width=`${Math.round(confidence*100)}%`;
 const gesture=classifyGesture(l);const now=performance.now();


 // ROTATION: drag the globe directly with the RIGHT index fingertip (landmark 8).
 // Move the fingertip left/right/up/down and the Earth follows; stop moving and it stops.
 // Requires an index-pointing pose (middle/ring/pinky folded) so an open palm never rotates.
 const pointing=fingerExtended(l,8,6);
 const tip={x:l[8].x,y:l[8].y};
 const earthHit=pointing?fingertipOnEarth(l[8]):{on:false,x:0,y:0};
 if(pointing)showTipCursor(earthHit);else hideTipCursor();
 if(!zoomBusy(now) && pointing && earthHit.on){
   if(previousIndexTip){
     const dx=tip.x-previousIndexTip.x, dy=tip.y-previousIndexTip.y;
     const DEAD=0.00035;
     if(Math.abs(dx)>DEAD||Math.abs(dy)>DEAD){
       const moveY=-dx*12.0, moveX=dy*9.0;
       targetRotY += moveY;
       targetRotX = THREE.MathUtils.clamp(targetRotX+moveX,-1.45,1.45);
       rightSwipeSpinSpeed=THREE.MathUtils.clamp(moveY*0.28,-0.045,0.045);
       rightSwipeTiltSpeed=THREE.MathUtils.clamp(moveX*0.28,-0.035,0.035);
       const horiz=Math.abs(dx)>=Math.abs(dy);
       const txt=horiz?(dx<0?'INDEX — ROTATE RIGHT':'INDEX — ROTATE LEFT'):(dy>0?'INDEX — ROTATE DOWN':'INDEX — ROTATE UP');
       $('gestureReadout').textContent=txt;currentGesture=txt;
       $('unitStatus').textContent=txt.replace('INDEX — ','');
     }
     previousIndexTip={x:tip.x,y:tip.y};
   }else{
     previousIndexTip={x:tip.x,y:tip.y};
   }
   energyMode=false;
   if(!currentGesture.startsWith('INDEX')) setGesture('INDEX POINT — MOVE TO ROTATE');
 }else{
   previousIndexTip=null; rightSwipeAnchor=null; previousSwipeFinger=null;
   energyMode=false;
   if(!zoomBusy(now)) setGesture(pointing?'TOUCH THE EARTH WITH INDEX TO ROTATE':'POINT INDEX TO ROTATE — ZOOM WITH THUMB + INDEX');
 }
 if(gesture!==lastGesture){lastGesture=gesture;gestureStableAt=now;}
 corePower=THREE.MathUtils.clamp(58+confidence*40+(energyMode?2:0),0,100);
 $('corePower').innerHTML=`${Math.round(corePower)}<span>%</span>`;
}
function clearTracking(){
 // Clear cached landmarks immediately when MediaPipe no longer detects a hand.
 visualHands=[];hideTipCursor();resetZoomTracking();lockOnSince=0;lockOffSince=0;if(zoomLocked)setZoomLock(false);
 pinchStartDistance=null; pinchArmed=false; previousIndexTip=null; rightSwipeAnchor=null; previousSwipeFinger=null;
 visualHandLandmarks=null;
 handCtx.clearRect(0,0,handCanvas.clientWidth,handCanvas.clientHeight);
 $('handCount').textContent='0 HANDS';$('confidenceValue').textContent='--';$('confidenceBar').style.width='0%';
 previousHand=null;previousIndexTip=null;pinchStartDistance=null;pinchArmed=false;
}
let cameraView=false;
function setCameraView(on){
 cameraView=on;
 document.body.classList.toggle('camera-view',on);
 $('cameraBtn').innerHTML=on
   ?'<span class="camera-icon">◉</span> CAMERA ON <span class="btn-arrow">●</span>'
   :'<span class="camera-icon">◎</span> CAMERA OFF <span class="btn-arrow">○</span>';
 if(tracking)$('cameraMessage').textContent=on?'Kamera ditampilkan. Hand tracking tetap berjalan.':'Latar hitam. Hand tracking tetap berjalan di belakang layar.';
}
function toggleCameraView(){setCameraView(!cameraView);}
async function activateCamera(){
 const button=$('cameraBtn');
 if(tracking){toggleCameraView();return;}
 button.disabled=true;
 button.innerHTML='<span class="camera-icon">◌</span> TURNING CAMERA ON...';
 $('cameraMessage').textContent='Memeriksa izin kamera dan memuat model hand tracking...';
 setStatus('INITIALIZING VISION');
 let stage='camera';
 try{
   if(!navigator.mediaDevices?.getUserMedia){
     throw new Error('Akses kamera tidak tersedia. Buka website melalui http://localhost:5173 atau HTTPS di Chrome/Edge.');
   }

   // Open the webcam first so camera errors are reported separately from model errors.
   cameraStream=await navigator.mediaDevices.getUserMedia({
     video:{facingMode:'user',width:{ideal:1920},height:{ideal:1080},aspectRatio:{ideal:16/9}},
     audio:false
   });
   video.srcObject=cameraStream;
   await video.play();
   video.classList.add('ready');
   $('cameraPlaceholder').style.display='none';

   stage='MediaPipe WASM';
   $('cameraMessage').textContent='Kamera aktif. Memuat runtime MediaPipe...';
   const vision=await FilesetResolver.forVisionTasks(
     'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
   );

   const options={
     runningMode:'VIDEO',
     numHands:2,
     ...NORMAL_CONF
   };

   // Try GPU first, then CPU if the GPU delegate is unavailable.
   stage='MediaPipe GPU model';
   try{
     handLandmarker=await HandLandmarker.createFromOptions(vision,{
       ...options,
       baseOptions:{
         modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
         delegate:'GPU'
       }
     });
   }catch(gpuError){
     console.warn('MediaPipe GPU initialization failed; retrying with CPU.',gpuError);
     if(handLandmarker){try{handLandmarker.close();}catch(_){}}
     handLandmarker=null;
     stage='MediaPipe CPU model';
     $('cameraMessage').textContent='GPU tidak tersedia. Mencoba mode CPU...';
     handLandmarker=await HandLandmarker.createFromOptions(vision,{
       ...options,
       baseOptions:{
         modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
         delegate:'CPU'
       }
     });
   }

   tracking=true;
   lastVideoTime=-1;
   button.disabled=false;
   document.body.classList.add('camera-on');
   setCameraView(false);   // start with a black background; tracking is already running
   $('visionTag').textContent='ONLINE';
   $('visionTag').classList.add('active');
   $('cameraMessage').textContent='Vision online. Tunjukkan satu tangan ke kamera untuk memutar Bumi 3D.';
   setStatus('VISION ONLINE');
   setGesture('SEARCHING HAND');
 }catch(err){
   console.error(`NEXUS GESTURE error at ${stage}:`,err);
   const detail = (err && typeof err.message==='string' && err.message.trim())
     ? err.message
     : (err && typeof err.type==='string')
       ? `Browser mengirim event ${err.type} tanpa detail error.`
       : String(err);
   stopCamera();
   $('cameraMessage').textContent=`Gagal pada tahap ${stage}: ${detail}. Periksa izin kamera dan koneksi internet, lalu coba lagi.`;
   setStatus('VISION ERROR');
   button.disabled=false;
   button.innerHTML='<span class="camera-icon">◎</span> CAMERA OFF <span class="btn-arrow">○</span>';
 }
}
function stopCamera(){
 tracking=false;
 resetLowLight();
 if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
 video.pause();video.srcObject=null;video.classList.remove('ready');$('cameraPlaceholder').style.display='flex';
 if(handLandmarker){handLandmarker.close();handLandmarker=null;}
 document.body.classList.remove('camera-on','camera-view');cameraView=false;
 $('visionTag').textContent='OFFLINE';$('visionTag').classList.remove('active');$('cameraBtn').disabled=false;$('cameraBtn').innerHTML='<span class="camera-icon">◎</span> CAMERA OFF <span class="btn-arrow">○</span>';
 $('cameraMessage').textContent='Kamera berhenti. Kamu tetap bisa memutar Bumi dengan mouse.';setStatus('SYSTEM STANDBY');setGesture('MOUSE CONTROL');clearTracking();
}
$('cameraBtn').addEventListener('click',activateCamera);
$('resetBtn').addEventListener('click',()=>{targetRotX=-.08;targetRotY=.35;rightSwipeSpinSpeed=0;rightSwipeTiltSpeed=0;targetScale=1;currentScale=1;robot.position.set(0,0,0);earthGroup.rotation.set(0,0,0);energyMode=false;setGesture(tracking?'SEARCHING HAND':'MOUSE CONTROL');});
$('helpBtn').addEventListener('click',()=>$('helpModal').hidden=false);
$('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))$('helpModal').hidden=true;});
const guideModal=$('guideModal');
const showGuide=(on)=>{guideModal.hidden=!on;};
$('guideBtn').addEventListener('click',()=>showGuide(true));
$('guideStart').addEventListener('click',()=>showGuide(false));
guideModal.addEventListener('click',e=>{if(e.target===guideModal)showGuide(false);});
showGuide(true);   // shown every time the website opens
window.addEventListener('keydown',e=>{if(e.key==='Escape')showGuide(false);if(e.key.toLowerCase()==='h')showGuide(guideModal.hidden);if(e.key==='Escape')$('helpModal').hidden=true;if(e.key.toLowerCase()==='r')$('resetBtn').click();if(e.key.toLowerCase()==='n')showCountryLabels=!showCountryLabels;});

// Mouse fallback: drag to rotate and wheel to zoom.
let dragging=false,lastMouse={x:0,y:0};
// Touchscreen / trackpad two-finger pinch also zooms (spread = bigger, like a phone map).
const touchPointers=new Map();let touchPinchPrev=null;
const touchPinchDist=()=>{const [a,b]=[...touchPointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
renderer.domElement.style.touchAction='none';
renderer.domElement.addEventListener('pointerdown',e=>{
  touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touchPointers.size===2){touchPinchPrev=touchPinchDist();dragging=false;}
  else{dragging=true;lastMouse={x:e.clientX,y:e.clientY};}
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(touchPointers.has(e.pointerId))touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touchPointers.size===2){
    const d=touchPinchDist();
    if(!zoomLocked&&touchPinchPrev&&d>0)targetScale=THREE.MathUtils.clamp(targetScale*(d/touchPinchPrev),ZOOM_MIN,ZOOM_MAX);
    touchPinchPrev=d;return;
  }
  if(!dragging||tracking)return;const dx=e.clientX-lastMouse.x,dy=e.clientY-lastMouse.y;targetRotY+=dx*.008;targetRotX+=dy*.006;lastMouse={x:e.clientX,y:e.clientY};
});
const endPointer=e=>{touchPointers.delete(e.pointerId);touchPinchPrev=null;dragging=false;};
renderer.domElement.addEventListener('pointerup',endPointer);renderer.domElement.addEventListener('pointercancel',endPointer);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();if(zoomLocked)return;targetScale=THREE.MathUtils.clamp(targetScale*Math.exp(-e.deltaY*.002),ZOOM_MIN,ZOOM_MAX);},{passive:false});
renderer.domElement.style.cursor='grab';

// Camera starts automatically when the page opens (the browser still asks for permission once).
// The webcam video stays hidden (black background); it is only used for hand detection.
window.addEventListener('load',()=>{ if(!tracking) activateCamera(); });


function animate(now){
 requestAnimationFrame(animate);animationTime=now*.001;frameCount++;
 renderGestureVisual(now);
 if(now-lastFrame>1000){fps=Math.round(frameCount*1000/(now-lastFrame));frameCount=0;lastFrame=now;$('fpsReadout').textContent=`${fps} FPS`;}
 if(tracking&&handLandmarker&&video.readyState>=2&&video.currentTime!==lastVideoTime){
   lastVideoTime=video.currentTime;
   try{
      const result=handLandmarker.detectForVideo(getDetectionSource(),now);
      const found=result.landmarks||[];
      if(found.length){
        visualHands=found.map((landmarks,i)=>{
          const info=result.handednesses?.[i]?.[0];
          return {landmarks,label:info?.categoryName||info?.displayName||`Hand ${i+1}`,score:info?.score??.8};
        });
        $('handCount').textContent=`${found.length} HAND${found.length===1?'':'S'}`;
        // Left index-only point is a dedicated STOP gesture.
        // Hand roles do not rely only on MediaPipe's Left/Right label: a single visible hand always controls the globe.
        const leftRaw=visualHands.find(h=>h.label.toLowerCase()==='left');
        const rightIdx0=visualHands.findIndex(h=>h.label.toLowerCase()==='right');
        const controlIdx=rightIdx0>=0?rightIdx0:(visualHands.length===1?0:-1);
        const leftHand=(visualHands.length>1&&leftRaw!==visualHands[controlIdx])?leftRaw:null;
        const leftIndexStop=()=>{
          if(!leftHand) return false;
          const l=leftHand.landmarks;
          return fingerExtended(l,8,6)&&!fingerExtended(l,12,10)&&!fingerExtended(l,16,14)&&!fingerExtended(l,20,18);
        };
        updateZoomLock(leftIndexStop(),now);
        if(leftIndexStop()){
          rightSwipeSpinSpeed=0;
          $('gestureReadout').textContent='LEFT INDEX — ROTATION STOPPED';
          $('unitStatus').textContent='STOPPED';
        }
        // Right hand controls directional swipe and pinch zoom.
        const rightIndex=controlIdx;
        if(rightIndex>=0){
          const hand=visualHands[rightIndex];
          processLandmarks(hand.landmarks,hand.score);
          // Left-index stop takes priority over right-hand control.
          if(leftIndexStop()){
            rightSwipeSpinSpeed=0;
            $('gestureReadout').textContent='LEFT INDEX — ROTATION STOPPED';
            $('unitStatus').textContent='STOPPED';
          }
        }else{
          previousIndexTip=null;pinchStartDistance=null;energyMode=false;hideTipCursor();
          if(leftHand){
            drawHand(leftHand.landmarks);
            $('confidenceValue').textContent=`${Math.round(leftHand.score*100)}%`;
            $('confidenceBar').style.width=`${Math.round(leftHand.score*100)}%`;
            setGesture('LEFT INDEX TO STOP');$('unitStatus').textContent='LEFT HAND READY';
          }else{
            const first=visualHands[0];drawHand(first.landmarks);
            $('confidenceValue').textContent=`${Math.round(first.score*100)}%`;
            $('confidenceBar').style.width=`${Math.round(first.score*100)}%`;
            setGesture('NO RIGHT HAND — VISUAL ONLY');$('unitStatus').textContent='VISUAL ONLY';
          }
        }
        // Pinch zoom works with whichever hand is visible (prefers the "Right" one).
        const zoomHand=visualHands[rightIndex>=0?rightIndex:0];
        if(zoomHandKey!==zoomHand.label){resetZoomTracking();zoomHandKey=zoomHand.label;}
        updateZoom(zoomHand.landmarks,now);
      }else{clearTracking();previousHand=null;setGesture('SEARCHING HAND');$('unitStatus').textContent='SEARCHING';}}
   catch(e){console.warn('Hand tracking frame skipped',e);}
 }
 if(Math.abs(rightSwipeSpinSpeed)>0.00006){targetRotY+=rightSwipeSpinSpeed;rightSwipeSpinSpeed*=0.965;}else rightSwipeSpinSpeed=0;
 if(Math.abs(rightSwipeTiltSpeed)>0.00006){targetRotX=THREE.MathUtils.clamp(targetRotX+rightSwipeTiltSpeed,-1.25,1.25);rightSwipeTiltSpeed*=0.965;}else rightSwipeTiltSpeed=0;
 robot.rotation.x+=(targetRotX-robot.rotation.x)*.085;robot.rotation.y+=(targetRotY-robot.rotation.y)*.085;
 currentScale+=(targetScale-currentScale)*.12;robot.scale.setScalar(currentScale);
 robot.position.y=Math.sin(animationTime*1.35)*.055;
 // Earth rotation is gesture-driven; no automatic spinning.
 
 particles.rotation.y=animationTime*(energyMode?.11:.035);
 particles.rotation.x=.16+Math.sin(animationTime*.28)*.035;
 const positions=particleGeo.attributes.position.array;
 for(let i=0;i<particlesCount;i++){const idx=i*3;positions[idx+1]+=(energyMode?Math.sin(animationTime*3+i)*.004:Math.sin(animationTime+i)*.0007);if(positions[idx+1]>2.3)positions[idx+1]=-2.3;}
 particleGeo.attributes.position.needsUpdate=true;
 particleMat.opacity=energyMode?.98:.55+Math.sin(animationTime*2)*.12;
 particleMat.size=energyMode?.045:.025;
 cyan.emissiveIntensity=energyMode?4.2:2.2;purple.emissiveIntensity=energyMode?3.5:1.9;earthMat.emissiveIntensity=energyMode?.65:.45;
 keyLight.intensity=energyMode?58:38;
 $('rotX').textContent=`${String(Math.round(((robot.rotation.x*180/Math.PI)%360+360)%360)).padStart(3,'0')}°`;
 $('rotY').textContent=`${String(Math.round(((robot.rotation.y*180/Math.PI)%360+360)%360)).padStart(3,'0')}°`;
 updateCountryLabels();
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
window.addEventListener('beforeunload',()=>{if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());});
