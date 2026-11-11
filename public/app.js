import {TAU, MAX_SPEED, advance, angleDelta, strokeSamples} from './physics.js';

const canvas=document.querySelector('#disc'), ctx=canvas.getContext('2d',{alpha:false});
const ink=document.createElement('canvas');
ink.width=ink.height=1536;
const brush=ink.getContext('2d');
const buttons=Object.fromEntries([...document.querySelectorAll('button')].map(b=>[b.id,b]));
const pointers=new Map(), history=[];
let width=0,height=0,cx=0,cy=0,r=0,dpr=1;
let angle=0,speed=0,lastTime=performance.now(),tool='pen',size=0;
let dirty=false,saveTimer,db,restoring=true,installPrompt;
const widths=[0.009,0.018,0.035];

function resize(){
  // Cancel contacts when orientation changes; keep the full-resolution drawing.
  pointers.clear();
  width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const landscape=width>height && height<=600;
  const areaW=width-(landscape?90:0),areaH=height-(landscape?0:100);
  cx=areaW/2;cy=areaH/2;r=Math.max(30,Math.min(areaW-24,areaH-24)/2-24);
}
function position(e){return {x:(e.clientX-cx)/r,y:(e.clientY-cy)/r};}
function snapshot(){
  history.push(brush.getImageData(0,0,ink.width,ink.height));
  if(history.length>6)history.shift();
  buttons.undo.disabled=false;
}
function changed(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(save,700);}
function save(){
  if(!db || !dirty)return;
  dirty=false;
  ink.toBlob(blob=>{
    if(!blob)return;
    const tx=db.transaction('art','readwrite');
    tx.objectStore('art').put(blob,'drawing');
    tx.onerror=()=>{dirty=true;};
  });
}
function drawContact(p){
  if(p.kind!=='draw')return;
  const points=strokeSamples(p.previous,p.pos,p.angle,angle,Math.max(Math.hypot(p.previous.x,p.previous.y),Math.hypot(p.pos.x,p.pos.y)));
  brush.save();
  brush.translate(ink.width/2,ink.height/2);brush.scale(ink.width/2,ink.height/2);
  brush.beginPath();brush.arc(0,0,1,0,TAU);brush.clip();
  brush.globalCompositeOperation=p.tool==='eraser'?'destination-out':'source-over';
  brush.strokeStyle=brush.fillStyle='#fff';brush.lineCap=brush.lineJoin='round';
  const pressure=p.type==='pen'?Math.max(.2,p.pressure):1;
  brush.lineWidth=widths[p.size]*(p.tool==='eraser'?5:1)*pressure;
  brush.beginPath();brush.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)brush.lineTo(points[i].x,points[i].y);
  brush.stroke();
  const end=points.at(-1);brush.beginPath();brush.arc(end.x,end.y,brush.lineWidth/2,0,TAU);brush.fill();
  brush.restore();
  p.previous={...p.pos};p.angle=angle;
  changed();
}
function step(now){
  const dt=Math.min(Math.max((now-lastTime)/1000,0),.05);lastTime=now;
  const held=[...pointers.values()].some(p=>p.kind==='spin');
  const next=advance(angle,speed,dt,held?4.5:undefined);
  angle=next.angle;speed=Math.abs(next.speed)<.003?0:next.speed;
  for(const p of pointers.values())drawContact(p);
  // Bound numerical growth only when there are no active drawing coordinates.
  if(!pointers.size)angle%=TAU;
}
canvas.addEventListener('pointerdown',e=>{
  if(restoring || (e.pointerType==='mouse' && e.button!==0))return;
  const pos=position(e),distance=Math.hypot(pos.x,pos.y);
  if(distance>1+50/r)return;
  if(e.pointerType==='touch' && distance<1 && [...pointers.values()].some(p=>p.type==='pen'))return;
  if(e.pointerType==='pen')for(const [id,p] of pointers)if(p.kind==='draw' && p.type==='touch')pointers.delete(id);
  e.preventDefault();step(performance.now());canvas.setPointerCapture(e.pointerId);
  const kind=distance>1?'spin':'draw';
  if(kind==='spin' && [...pointers.values()].some(p=>p.kind==='spin'))return;
  if(kind==='draw' && ![...pointers.values()].some(p=>p.kind==='draw'))snapshot();
  const p={kind,type:e.pointerType,pos,previous:pos,angle,tool:(e.button===5 || e.buttons===32)?'eraser':tool,size,pressure:e.pressure||.5,time:performance.now()};
  pointers.set(e.pointerId,p);drawContact(p);
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;
  e.preventDefault();
  const now=performance.now(),pos=position(e);
  // Interpolate position and rotation together; drawing a radial jump after
  // advancing the old position would leave stair steps in fast spirals.
  if(p.kind==='draw'){
    p.pos=pos;p.pressure=e.pressure||p.pressure;step(now);return;
  }
  step(now);
  if(p.kind==='spin'){
    const delta=angleDelta(Math.atan2(pos.y,pos.x),Math.atan2(p.pos.y,p.pos.x));
    if(Math.hypot(pos.x,pos.y)>.6){
      // Tangential gesture acts as torque. Repeated flicks build momentum.
      speed=Math.max(-MAX_SPEED,Math.min(MAX_SPEED,speed+delta*24));
      angle+=delta*.35;
    }
    p.time=now;
  }
  p.pos=pos;p.pressure=e.pressure||p.pressure;
  drawContact(p);
});
function release(e){
  if(!pointers.has(e.pointerId))return;
  step(performance.now());pointers.delete(e.pointerId);save();
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{
  e.preventDefault();step(performance.now());
  const delta=(e.deltaY+e.deltaX)*(e.deltaMode===1?16:e.deltaMode===2?height:1);
  speed=Math.max(-MAX_SPEED,Math.min(MAX_SPEED,speed+delta*.025));
},{passive:false});

function render(now){
  step(now);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080808';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(cx,cy);
  // A generous, subtly grooved flywheel rim doubles as the touch target.
  ctx.beginPath();ctx.arc(0,0,r+19,0,TAU);ctx.fillStyle='#171717';ctx.fill();
  ctx.beginPath();ctx.arc(0,0,r+19,0,TAU);ctx.strokeStyle='#303030';ctx.lineWidth=1;ctx.stroke();
  ctx.save();ctx.rotate(angle);
  for(let i=0;i<96;i++){
    const a=i*TAU/96;ctx.beginPath();ctx.moveTo(Math.cos(a)*(r+9),Math.sin(a)*(r+9));ctx.lineTo(Math.cos(a)*(r+13),Math.sin(a)*(r+13));ctx.strokeStyle=i%8===0?'#555':'#303030';ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fillStyle='#000';ctx.fill();ctx.save();ctx.clip();
  // Short exposure integrates several orientations, suppressing strobing at high RPM.
  const exposure=Math.min(Math.abs(speed)*.006,.25),samples=exposure>.025?5:1;
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1/samples;
  for(let i=0;i<samples;i++){
    ctx.save();ctx.rotate(angle-(samples===1?0:speed*.006*i/(samples-1)));
    ctx.drawImage(ink,-r,-r,r*2,r*2);ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,1.5,0,TAU);ctx.fillStyle='#555';ctx.fill();
  ctx.restore();requestAnimationFrame(render);
}
function select(value){tool=value;buttons.pen.setAttribute('aria-pressed',value==='pen');buttons.eraser.setAttribute('aria-pressed',value==='eraser');}
buttons.pen.onclick=()=>select('pen');buttons.eraser.onclick=()=>select('eraser');
buttons.size.onclick=()=>{size=(size+1)%widths.length;buttons.size.querySelector('circle').setAttribute('r',[2,3.5,5][size]);buttons.size.dataset.size=size;};
buttons.stop.onclick=()=>{step(performance.now());speed=0;};
buttons.undo.onclick=()=>{
  if(!history.length)return;pointers.clear();brush.putImageData(history.pop(),0,0);buttons.undo.disabled=!history.length;changed();
};
buttons.clear.onclick=()=>{pointers.clear();snapshot();brush.clearRect(0,0,ink.width,ink.height);changed();};
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();buttons.stop.click();}
  if((e.ctrlKey||e.metaKey) && e.key==='z'){e.preventDefault();buttons.undo.click();}
});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{pointers.clear();lastTime=performance.now();if(document.hidden)save();});
window.addEventListener('pagehide',save);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;buttons.install.hidden=false;});
buttons.install.onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;buttons.install.hidden=true;};
window.addEventListener('appinstalled',()=>{buttons.install.hidden=true;});

try{
  const request=indexedDB.open('rotator',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('art');
  request.onsuccess=()=>{
    db=request.result;
    const read=db.transaction('art').objectStore('art').get('drawing');
    read.onsuccess=async()=>{
      try{if(read.result){const bitmap=await createImageBitmap(read.result);brush.drawImage(bitmap,0,0,ink.width,ink.height);bitmap.close();}}catch{}finally{restoring=false;}
    };
    read.onerror=()=>{restoring=false;};
  };
  request.onerror=()=>{restoring=false;};
  request.onblocked=()=>{restoring=false;};
}catch{restoring=false;}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
resize();requestAnimationFrame(render);
