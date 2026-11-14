export function setupGallery({getDB,isReady,ink,pause,open}){
  const dialog=document.createElement('dialog');
  dialog.className='gallery';
  dialog.setAttribute('aria-labelledby','gallery-title');
  dialog.innerHTML='<header><h1 id="gallery-title">Galerie</h1><button aria-label="Galerie schließen">×</button></header><p>Auf diesem Gerät gespeichert. PNG-Dateien bleiben auch nach dem Löschen der App-Daten erhalten.</p><button class="gallery-save">Aktuelle Zeichnung speichern</button><p role="status" aria-live="polite"></p><section class="gallery-grid" aria-label="Gespeicherte Bilder"></section>';
  document.body.append(dialog);
  const trigger=document.createElement('button');
  trigger.id='gallery';trigger.setAttribute('aria-label','Galerie öffnen');
  trigger.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-3 5 5"/></svg>';
  document.querySelector('main').append(trigger);
  const grid=dialog.querySelector('section'),status=dialog.querySelector('[role=status]'),saveButton=dialog.querySelector('.gallery-save');
  let urls=[],busy=false;
  const message=text=>{status.textContent=text;};
  function operation(mode,action){
    return new Promise((resolve,reject)=>{
      const db=getDB();if(!db){reject(new Error('Speicher nicht verfügbar. Bitte alle App-Fenster schließen und neu öffnen.'));return;}
      const tx=db.transaction('gallery',mode),request=action(tx.objectStore('gallery'));
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Speichern fehlgeschlagen. Möglicherweise ist der Gerätespeicher voll.'));
    });
  }
  const blobFrom=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Bild konnte nicht erstellt werden.')),'image/png'));
  function cleanup(){urls.forEach(URL.revokeObjectURL);urls=[];grid.replaceChildren();}
  async function run(action){
    if(busy)return;busy=true;saveButton.disabled=true;
    try{await action();}catch(error){message(error.message||'Aktion fehlgeschlagen. Bitte erneut versuchen.');}
    finally{busy=false;saveButton.disabled=false;}
  }
  async function render(){
    const records=await operation('readonly',store=>store.getAll());
    cleanup();
    if(!records.length){grid.textContent='Noch keine Bilder gespeichert.';return;}
    for(const record of records.reverse()){
      const card=document.createElement('article'),img=document.createElement('img');
      const date=new Date(record.created).toLocaleString('de-DE');
      const url=URL.createObjectURL(record.preview);urls.push(url);
      img.src=url;img.alt=`Zeichnung vom ${date}`;img.loading='lazy';
      const label=document.createElement('p');label.textContent=date;
      const actions=document.createElement('div');actions.className='gallery-actions';
      function button(text,action){const b=document.createElement('button');b.textContent=text;b.onclick=()=>run(action);actions.append(b);}
      button('Öffnen',async()=>{
        const bitmap=await createImageBitmap(record.ink);
        try{open(bitmap);}finally{bitmap.close();}
        dialog.close();
      });
      button('PNG',async()=>{
        const bitmap=await createImageBitmap(record.ink),canvas=document.createElement('canvas');
        canvas.width=canvas.height=1536;const ctx=canvas.getContext('2d');
        ctx.fillStyle='#000';ctx.fillRect(0,0,1536,1536);ctx.drawImage(bitmap,0,0);bitmap.close();
        const url=URL.createObjectURL(await blobFrom(canvas)),link=document.createElement('a');
        link.href=url;link.download=`rotator-${record.id}.png`;document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        message('PNG-Download gestartet.');
      });
      button('Löschen',async()=>{
        if(!confirm('Dieses Bild aus der Galerie löschen?'))return;
        await operation('readwrite',store=>store.delete(record.id));await render();message('Bild gelöscht.');
      });
      card.append(img,label,actions);grid.append(card);
    }
  }
  trigger.onclick=()=>{
    if(!isReady())return;
    pause();dialog.showModal();message('');run(render);
  };
  dialog.querySelector('header button').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',cleanup);
  saveButton.onclick=()=>run(async()=>{
    const blob=await blobFrom(ink),preview=document.createElement('canvas');preview.width=preview.height=256;
    const ctx=preview.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,256,256);ctx.drawImage(ink,0,0,256,256);
    const previewBlob=await blobFrom(preview);
    await operation('readwrite',store=>store.add({created:Date.now(),ink:blob,preview:previewBlob}));
    await render();message('Bild in der Galerie gespeichert.');
    navigator.storage?.persist?.().catch(()=>{});
  });
}
