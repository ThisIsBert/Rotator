export function setupGallery({getDB,isReady,ink,pause,open}){
  const icon='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-3 5 5"/></svg>';
  const dialog=document.createElement('dialog');
  dialog.className='gallery';dialog.setAttribute('aria-label','Bilder');
  dialog.innerHTML='<header><button class="gallery-back" aria-label="Gespeicherte Bilder anzeigen">'+icon+'</button><button class="gallery-close" aria-label="Ansicht schließen">×</button></header><section class="gallery-grid" aria-label="Gespeicherte Bilder" hidden></section><section class="gallery-zoom" aria-label="Bildansicht"><img alt="Aktuelle Zeichnung"><div class="gallery-actions"><button class="gallery-primary">Speichern</button><button class="gallery-download">Runterladen</button><button class="gallery-delete" disabled>Löschen</button></div></section><p role="status" aria-live="polite"></p>';
  document.body.append(dialog);
  const trigger=document.createElement('button');trigger.id='gallery';trigger.setAttribute('aria-label','Bilder öffnen');trigger.innerHTML=icon;document.querySelector('main').append(trigger);
  const grid=dialog.querySelector('.gallery-grid'),zoom=dialog.querySelector('.gallery-zoom'),image=zoom.querySelector('img'),status=dialog.querySelector('[role=status]');
  const primary=dialog.querySelector('.gallery-primary'),remove=dialog.querySelector('.gallery-delete'),back=dialog.querySelector('.gallery-back');
  let urls=[],busy=false,selected=null,zoomURL=null;
  const message=text=>{status.textContent=text;};
  const blobFrom=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Bild konnte nicht erstellt werden.')),'image/png'));
  function operation(mode,action){
    return new Promise((resolve,reject)=>{
      const db=getDB();if(!db){reject(new Error('Speicher nicht verfügbar. Bitte alle App-Fenster schließen und neu öffnen.'));return;}
      const tx=db.transaction('gallery',mode),request=action(tx.objectStore('gallery'));
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Speichern fehlgeschlagen. Möglicherweise ist der Gerätespeicher voll.'));
    });
  }
  function cleanupGrid(){urls.forEach(URL.revokeObjectURL);urls=[];grid.replaceChildren();}
  function updateButtons(){
    dialog.querySelectorAll('button').forEach(button=>button.disabled=busy);
    remove.disabled=busy||!selected?.id;
  }
  async function run(action){
    if(busy)return;busy=true;updateButtons();message('');
    try{await action();}catch(error){message(error.message||'Aktion fehlgeschlagen. Bitte erneut versuchen.');}
    finally{busy=false;updateButtons();if(dialog.open&&!zoom.hidden)primary.focus();}
  }
  function showZoom(record){
    selected=record;cleanupGrid();
    if(zoomURL)URL.revokeObjectURL(zoomURL);
    zoomURL=URL.createObjectURL(record.ink);image.src=zoomURL;image.alt=record.id?'Gespeicherte Zeichnung':'Aktuelle Zeichnung';
    primary.textContent=record.id?'Öffnen':'Speichern';grid.hidden=true;zoom.hidden=false;back.hidden=false;message('');
    updateButtons();primary.focus();
  }
  async function showGrid(){
    const records=await operation('readonly',store=>store.getAll());cleanupGrid();
    grid.hidden=false;zoom.hidden=true;back.hidden=true;message('');
    for(const record of records.reverse()){
      const button=document.createElement('button'),img=document.createElement('img');
      button.className='gallery-thumb';button.setAttribute('aria-label','Bild vergrößern');
      const url=URL.createObjectURL(record.preview);urls.push(url);img.src=url;img.alt='Gespeicherte Zeichnung';img.loading='lazy';
      button.append(img);button.onclick=()=>{if(!busy)showZoom(record);};grid.append(button);
    }
    if(!records.length)message('Noch keine Bilder gespeichert.');
    dialog.querySelector('.gallery-close').focus();
  }
  trigger.onclick=()=>{
    if(!isReady())return;pause();dialog.showModal();
    run(async()=>showZoom({ink:await blobFrom(ink)}));
  };
  back.onclick=()=>run(showGrid);
  dialog.querySelector('.gallery-close').onclick=()=>{if(busy)return;if(!zoom.hidden&&selected?.id)run(showGrid);else dialog.close();};
  dialog.addEventListener('cancel',event=>{if(busy){event.preventDefault();return;}if(!zoom.hidden&&selected?.id){event.preventDefault();run(showGrid);}});
  dialog.addEventListener('close',()=>{cleanupGrid();if(zoomURL)URL.revokeObjectURL(zoomURL);zoomURL=null;image.removeAttribute('src');selected=null;});
  primary.onclick=()=>run(async()=>{
    const bitmap=await createImageBitmap(selected.ink);
    if(selected.id){try{open(bitmap);}finally{bitmap.close();}dialog.close();return;}
    const preview=document.createElement('canvas');preview.width=preview.height=256;
    const ctx=preview.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,256,256);ctx.drawImage(bitmap,0,0,256,256);bitmap.close();
    const record={created:Date.now(),ink:selected.ink,preview:await blobFrom(preview)};
    record.id=await operation('readwrite',store=>store.add(record));
    showZoom(record);message('Gespeichert.');navigator.storage?.persist?.().catch(()=>{});
  });
  dialog.querySelector('.gallery-download').onclick=()=>run(async()=>{
    const bitmap=await createImageBitmap(selected.ink),canvas=document.createElement('canvas');canvas.width=canvas.height=1536;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,1536,1536);ctx.drawImage(bitmap,0,0);bitmap.close();
    const url=URL.createObjectURL(await blobFrom(canvas)),link=document.createElement('a');link.href=url;link.download=`rotator-${selected.id||'zeichnung'}.png`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  remove.onclick=()=>run(async()=>{
    if(!selected?.id||!confirm('Dieses Bild aus der Galerie löschen?'))return;
    await operation('readwrite',store=>store.delete(selected.id));await showGrid();
  });
}
