export function setupColorPicker(initial,onChange){
  const field=document.querySelector('#color-field'),cursor=document.querySelector('#color-cursor');
  const hue=document.querySelector('#color-hue'),value=document.querySelector('#color-value'),preview=document.querySelector('#color-preview');
  let h=0,s=0,v=1;
  function hex(){
    const f=n=>{const k=(n+h/60)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');};
    return '#'+f(5)+f(3)+f(1);
  }
  function render(emit=false){
    const color=hex();field.style.setProperty('--hue',h);
    cursor.style.left=`${s*100}%`;cursor.style.top=`${(1-v)*100}%`;cursor.style.background=color;
    hue.value=h;value.value=v*100;
    hue.setAttribute('aria-valuetext',`${Math.round(h)} Grad`);
    value.setAttribute('aria-valuetext',`${Math.round(v*100)} Prozent`);
    value.style.background=`linear-gradient(to right,#000,hsl(${h} ${s/(2-s)*100}% ${100-s*50}%))`;
    preview.style.background=color;
    if(emit)onChange(color);
  }
  function setColor(color){
    const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255),[r,g,b]=rgb;
    const max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
    if(d)h=((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
    s=max?d/max:0;v=max;render();
  }
  function position(event){const rect=field.getBoundingClientRect();s=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));v=1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));render(true);}
  field.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();field.focus();field.setPointerCapture(event.pointerId);position(event);});
  field.addEventListener('pointermove',event=>{if(field.hasPointerCapture(event.pointerId))position(event);});
  field.addEventListener('pointerup',event=>{if(field.hasPointerCapture(event.pointerId)){position(event);field.releasePointerCapture(event.pointerId);}});
  field.addEventListener('keydown',event=>{
    const step=event.shiftKey?.1:.01;
    if(event.key==='ArrowLeft')s=Math.max(0,s-step);else if(event.key==='ArrowRight')s=Math.min(1,s+step);
    else if(event.key==='ArrowUp')v=Math.min(1,v+step);else if(event.key==='ArrowDown')v=Math.max(0,v-step);else return;
    event.preventDefault();render(true);
  });
  hue.addEventListener('input',()=>{h=Number(hue.value);render(true);});
  value.addEventListener('input',()=>{v=Number(value.value)/100;render(true);});
  setColor(initial);return {setColor};
}
