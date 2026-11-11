import {TAU, MAX_SPEED, advance, angleDelta, strokeSamples} from './physics.js';
import {WIDTHS, contactPressure, strokeWidth, nextHue, recentColors} from './brush.js';
import {RotationBlur} from './rotation-blur.js';

const canvas=document.querySelector('#disc'), ctx=canvas.getContext('2d',{alpha:false});
const ink=document.createElement('canvas');
ink.width=ink.height=1536;
const brush=ink.getContext('2d');
const rotationBlur=new RotationBlur();
let inkRevision=0;
const buttons=Object.fromEntries([...document.querySelectorAll('button')].map(b=>[b.id,b]));
const pointers=new Map(), history=[];
let width=0,height=0,cx=0,cy=0,r=0,dpr=1;
let angle=0,speed=0,lastTime=performance.now(),tool='pen',size=0;
let dirty=false,saveTimer,db,restoring=true,installPrompt;
let color='#ffffff',rainbow=false,rainbowHue=0,pressureEnabled=true,recents=[];
try {
  const prefs=JSON.parse(localStorage.getItem('rotator-brush')||'{}');
  if(/^#[\da-f]{6}$/i.test(prefs.color))color=prefs.color;
  if(Number.isInteger(prefs.size) && prefs.size>=0 && prefs.size<WIDTHS.length)size=prefs.size;
  pressureEnabled=prefs.pressure!==false;
  if(Array.isArray(prefs.recents))recents=[...new Set(prefs.recents.filter(c=>/^#[\da-f]{6}$/i.test(c)))].slice(0,6);
}catch{}
function savePreferences(){
  try{localStorage.setItem('rotator-brush',JSON.stringify({color,size,pressure:pressureEnabled,recents}));}catch{}
}

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
function changed(){inkRevision++;dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(save,700);}
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
  const points=strokeSamples(p.previous,p.pos,p.angle,angle,Math.max(Math.hypot(p.previous.x,p.previous.y),Math.hypot(p.pos.x,p.pos.y)),.004);
  brush.save();
  brush.translate(ink.width/2,ink.height/2);brush.scale(ink.width/2,ink.height/2);
  brush.beginPath();brush.arc(0,0,1,0,TAU);brush.clip();
  brush.globalCompositeOperation=p.tool==='eraser'?'destination-out':'source-over';
  brush.strokeStyle=brush.fillStyle=p.color;brush.lineCap=brush.lineJoin='round';
  const startWidth=strokeWidth(p.size,p.type,p.previousPressure,p.pressureEnabled,p.tool==='eraser');
  const endWidth=strokeWidth(p.size,p.type,p.pressure,p.pressureEnabled,p.tool==='eraser');
  const spectrum=p.rainbow && p.tool!=='eraser';
  if(!spectrum && Math.abs(startWidth-endWidth)<.00001){
    brush.lineWidth=endWidth;
    brush.beginPath();brush.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)brush.lineTo(points[i].x,points[i].y);
    brush.stroke();
  }else{
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(spectrum){
        p.hue=nextHue(p.hue,Math.hypot(b.x-a.x,b.y-a.y));
        brush.strokeStyle=brush.fillStyle=`hsl(${p.hue} 100% 65%)`;
      }
      brush.lineWidth=startWidth+(endWidth-startWidth)*i/(points.length-1);
      brush.beginPath();brush.moveTo(a.x,a.y);brush.lineTo(b.x,b.y);brush.stroke();
    }
  }
  brush.lineWidth=endWidth;
  const end=points.at(-1);brush.beginPath();brush.arc(end.x,end.y,brush.lineWidth/2,0,TAU);brush.fill();
  brush.restore();
  p.previous={...p.pos};p.angle=angle;p.previousPressure=p.pressure;
  if(spectrum)rainbowHue=p.hue;
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
  closePanels();
  if(restoring || (e.pointerType==='mouse' && e.button!==0))return;
  const pos=position(e),distance=Math.hypot(pos.x,pos.y);
  if(distance>1+50/r)return;
  if(e.pointerType==='touch' && distance<1 && [...pointers.values()].some(p=>p.type==='pen'))return;
  if(e.pointerType==='pen')for(const [id,p] of pointers)if(p.kind==='draw' && p.type==='touch')pointers.delete(id);
  e.preventDefault();step(performance.now());canvas.setPointerCapture(e.pointerId);
  const kind=distance>1?'spin':'draw';
  if(kind==='spin' && [...pointers.values()].some(p=>p.kind==='spin'))return;
  if(kind==='draw' && ![...pointers.values()].some(p=>p.kind==='draw'))snapshot();
  const pressure=contactPressure(e.pressure);
  const p={kind,type:e.pointerType,pos,previous:pos,angle,tool:(e.button===5 || e.buttons===32)?'eraser':tool,size,pressure,previousPressure:pressure,pressureEnabled,color,rainbow,hue:rainbowHue,time:performance.now()};
  pointers.set(e.pointerId,p);drawContact(p);
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;
  e.preventDefault();
  const now=performance.now(),pos=position(e);
  // Interpolate position and rotation together; drawing a radial jump after
  // advancing the old position would leave stair steps in fast spirals.
  if(p.kind==='draw'){
    p.pos=pos;p.pressure=contactPressure(e.pressure);step(now);return;
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
  p.pos=pos;p.pressure=contactPressure(e.pressure);
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
  const blurred=rotationBlur.frame(ink,speed,r*dpr,inkRevision);
  ctx.rotate(angle+blurred.offset);
  ctx.drawImage(blurred.canvas,-r,-r,r*2,r*2);
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,1.5,0,TAU);ctx.fillStyle='#555';ctx.fill();
  ctx.restore();requestAnimationFrame(render);
}
function select(value){tool=value;buttons.pen.setAttribute('aria-pressed',value==='pen');buttons.eraser.setAttribute('aria-pressed',value==='eraser');}
buttons.pen.onclick=()=>select('pen');buttons.eraser.onclick=()=>select('eraser');
const sizePanel=document.querySelector('#sizes'),palette=document.querySelector('#palette');
function closePanels(){
  sizePanel.hidden=palette.hidden=true;
  buttons.size.setAttribute('aria-expanded','false');buttons.color.setAttribute('aria-expanded','false');
}
function togglePanel(panel,button){const open=panel.hidden;closePanels();panel.hidden=!open;button.setAttribute('aria-expanded',String(open));}
buttons.size.onclick=()=>togglePanel(sizePanel,buttons.size);
buttons.color.onclick=()=>togglePanel(palette,buttons.color);
function updateBrushUI(){
  buttons.size.querySelector('circle').setAttribute('r',[2,3.5,5.5,8][size]);
  buttons.size.dataset.size=size;
  buttons.size.setAttribute('aria-label',`Strichstärke wählen, Stufe ${size+1}`);
  document.querySelectorAll('[data-width]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.width)===size)));
  buttons.pressure.setAttribute('aria-pressed',String(pressureEnabled));
  buttons.rainbow.setAttribute('aria-pressed',String(rainbow));
  buttons.color.classList.toggle('rainbow',rainbow);
  buttons.color.style.setProperty('--ink',color);
  document.querySelector('#custom-color').value=color;
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(!rainbow && b.dataset.color===color)));
}
document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>{
  size=Number(b.dataset.width);updateBrushUI();savePreferences();closePanels();
});
buttons.pressure.onclick=()=>{pressureEnabled=!pressureEnabled;updateBrushUI();savePreferences();};
function renderRecents(){
  const row=document.querySelector('#recents');row.replaceChildren();row.hidden=!recents.length;
  for(const c of recents){
    const b=document.createElement('button');b.className='swatch';b.dataset.color=c;
    b.style.setProperty('--ink',c);b.setAttribute('aria-label',`Letzte Farbe ${c}`);
    b.onclick=()=>chooseColor(c);row.append(b);
  }
}
function chooseColor(value){
  color=value.toLowerCase();rainbow=false;recents=recentColors(recents,color);
  renderRecents();updateBrushUI();savePreferences();select('pen');closePanels();
}
document.querySelectorAll('#presets [data-color]').forEach(b=>b.onclick=()=>chooseColor(b.dataset.color));
document.querySelector('#custom-color').addEventListener('input',e=>{
  color=e.target.value;rainbow=false;updateBrushUI();select('pen');
});
document.querySelector('#custom-color').addEventListener('change',e=>chooseColor(e.target.value));
buttons.rainbow.onclick=()=>{rainbow=!rainbow;select('pen');updateBrushUI();closePanels();};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('nav'))closePanels();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();});
renderRecents();updateBrushUI();
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
      try{if(read.result){const bitmap=await createImageBitmap(read.result);brush.drawImage(bitmap,0,0,ink.width,ink.height);bitmap.close();inkRevision++;}}catch{}finally{restoring=false;}
    };
    read.onerror=()=>{restoring=false;};
  };
  request.onerror=()=>{restoring=false;};
  request.onblocked=()=>{restoring=false;};
}catch{restoring=false;}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
resize();requestAnimationFrame(render);
