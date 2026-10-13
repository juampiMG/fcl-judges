import { PARTICIPANTS, searchParticipants, participantSelection } from './participants.js';
import { digitsOnly, maskTime, normalizeTime, parseQuantity } from './score-input.js';
import { LEVELS, COMPOSITIONS, listWorkouts, getWorkout } from './catalog.js';
import { createAttempt, increment, setBlockCount, nextBlock, undo, closePart, reopenPart, resetPart, finalizeAttempt, total, isPartComplete } from './engine.js';
import { loadAttempts, saveAttempt, exportCSV } from './storage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#confirmation');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = value => ({elite:'Elite',rx:'RX',open:'Open',teams:'Teams',parejas:'Parejas',masculino:'Masculino',femenino:'Femenino',mixto:'Mixto'}[value] || value);
let attempts = [], current = null, selectedPartId = null, screen = 'prepare', pending = 0, saveError = '', queue = Promise.resolve(), onConfirm, storageReady = false;
let selection = { modality:'teams',level:'rx',composition:'mixto',wodId:'1' };
let teamQuery='';
let teamDraft = { number:'',name:'',heat:'',lane:'',judge:'' };
const VIEW_KEY='fcl-judge-view-v1';
function saveView(){
  if(!storageReady)return;
  try{sessionStorage.setItem(VIEW_KEY,JSON.stringify({version:1,screen,attemptId:current?.id,selectedPartId,selection,teamDraft,teamQuery,scrollY:window.scrollY,wodOpen:document.querySelector('#workout-viewer').open}));}
  catch{showError('No se puede conservar la pantalla al recargar. El conteo sigue guardándose en este dispositivo.');}
}
function restoreView(){
  try{
    const view=JSON.parse(sessionStorage.getItem(VIEW_KEY)||'null');
    if(!view||view.version!==1)return null;
    if(view.selection){getWorkout(view.selection);selection=view.selection;}
    teamQuery=String(view.teamQuery??'').slice(0,100);
    if(view.teamDraft)for(const key of Object.keys(teamDraft))teamDraft[key]=String(view.teamDraft[key]??'').slice(0,100);
    teamDraft.number=digitsOnly(teamDraft.number);
    current=attempts.find(a=>a.id===view.attemptId)||null;
    if(['prepare','history'].includes(view.screen))screen=view.screen;
    else if(current&&['counter','result'].includes(view.screen)){
      screen=view.screen==='result'&&current.status!=='finalized'?'counter':view.screen;
      selectedPartId=current.workout.parts.some(p=>p.id===view.selectedPartId)?view.selectedPartId:current.workout.parts[0].id;
    }
    return view;
  }catch{return null;}
}
const button = (action,label,cls='',disabled=false,extra='') => `<button type="button" data-action="${action}" class="${cls}" ${disabled?'disabled':''} ${extra}>${escape(label)}</button>`;
function showError(message) { const element=document.querySelector('#error'); element.textContent=message; element.hidden=!message; }
function storageStatus(){document.querySelector('#save-status').textContent=saveError?`Error de guardado: ${saveError}. Conserva esta pestaña abierta y descarga una copia.`:pending?'Guardando en este dispositivo…':attempts.length?'Guardado en este dispositivo · Sin envío externo':'';}
function remember(session){current=session;const i=attempts.findIndex(a=>a.id===session.id);if(i<0)attempts.unshift(session);else attempts[i]=session;}
function persist(session){pending++;storageStatus();queue=queue.catch(()=>{}).then(async()=>{try{await saveAttempt(session);}catch(error){saveError=error.message||'No se pudo guardar';showError('No se ha confirmado el guardado. Puedes reintentar o descargar una copia desde el historial.');}finally{pending--;storageStatus();}});return queue;}
function update(operation){try{const result=operation(current);remember(result);persist(result);render();}catch(error){showError(error.message);}}
function choices(key,values){return `<fieldset><legend>${{modality:'Modalidad',composition:'Subsección',level:'Categoría'}[key]}</legend><div class="choices">${values.map(v=>button('choice',title(v),selection[key]===v?'selected':'',false,`data-key="${key}" data-value="${v}" aria-pressed="${selection[key]===v}"`)).join('')}</div></fieldset>`;}
function teamInput(key,label,required=false){return `<label class="field">${label}<input name="${key}" value="${escape(teamDraft[key])}" ${required?'required':''} maxlength="100" ${key==='number'?'inputmode="numeric" pattern="[0-9]+"':''}></label>`;}
function header(showDownload=true){return `<div class="top-actions">${button('home','Cargar Nuevo')}${showDownload?button('backup','Descargar copia'):button('view-wod','Ver WOD')}</div><div class="meta"><h1>${escape(current.team.number)} · ${escape(current.team.name)}</h1><p class="muted">${escape(current.workout.categoryLabel)}</p><p><strong>${escape(current.workout.title)}</strong></p></div>`;}
function showWorkout(){
  const workout=current.workout;
  const viewer=document.querySelector('#workout-viewer');
  document.querySelector('#workout-title').textContent=workout.title;
  document.querySelector('#workout-content').innerHTML=`<p class="badge">${escape(workout.categoryLabel)}</p><p class="muted">${escape(workout.location||'')} · El tiempo lo marca el reloj de pista.</p>${workout.parts.map(part=>`<section class="wod-part"><h3>${escape(part.label)}</h3><p><strong>Time cap: ${escape(part.capMinutes)} min</strong></p>${part.notes.length?`<ul class="review-list">${part.notes.map(note=>`<li>${escape(note)}</li>`).join('')}</ul>`:''}${part.kind==='calories'?'<p>Registrar las calorías finales del monitor al cerrar esta parte.</p>':`<ol class="wod-blocks">${part.blocks.map(block=>`<li><strong>${escape(block.target)} ${escape(block.unit)} · ${escape(block.label)}</strong>${block.round?`<p>Ronda ${escape(block.round)}</p>`:''}${block.athletes?`<p>${escape(block.athletes)}</p>`:''}${block.note?`<p class="note">${escape(block.note)}</p>`:''}</li>`).join('')}</ol>`}</section>`).join('')}`;
  viewer.showModal();
  document.querySelector('#workout-content').scrollTop=0;
  document.querySelector('#close-workout').focus();
  saveView();
}
document.querySelector('#close-workout').addEventListener('click',()=>{document.querySelector('#workout-viewer').close();saveView();});
document.querySelector('#workout-viewer').addEventListener('close',saveView);
function render(){saveView();const focused=document.activeElement;const action=focused?.dataset?.action;const priorKey=focused?.dataset?.value;showError('');if(screen==='prepare')renderPrepare();else if(screen==='history')renderHistory();else if(screen==='result')renderResult();else renderCounter();if(action){const candidate=[...app.querySelectorAll('[data-action]')].find(e=>e.dataset.action===action&&e.dataset.value===priorKey&&!e.disabled);candidate?.focus({preventScroll:true});}}
function renderPrepare(){app.innerHTML=`<div class="top-actions"><span class="badge">Cargar Nuevo</span>${button('history','Historial local')}</div><h1>Todo listo antes de pista</h1><p class="muted">Selecciona la hoja y el equipo. El tiempo lo marca el reloj de pista.</p><form id="prepare-form"><section class="team-search"><label class="field" for="team-search">Buscar equipo o pareja por número o nombre<input id="team-search" type="search" name="teamSearch" value="${escape(teamQuery)}" placeholder="Número o nombre del equipo o pareja" autocomplete="off" maxlength="100" aria-describedby="team-search-help"></label><p class="note" id="team-search-help">Teams y Parejas · Selecciona un resultado para cargar dorsal, nombre, modalidad, subsección y categoría.</p><div id="team-matches"></div></section><div class="form-grid"><div>${choices('modality',['teams','parejas'])}${selection.modality==='parejas'?choices('composition',COMPOSITIONS):''}${choices('level',LEVELS)}</div><div><label class="field">Workout<select name="wodId">${listWorkouts(selection.modality).map(w=>`<option value="${escape(w.id)}" ${selection.wodId===w.id?'selected':''}>${escape(w.title)}</option>`).join('')}</select></label><div class="team-fields">${teamInput('number','Nº equipo',true)}${teamInput('name','Nombre del equipo',true)}</div><details><summary>Datos opcionales de pista</summary>${teamInput('heat','Heat')}${teamInput('lane','Carril')}${teamInput('judge','Juez')}</details></div></div><button type="submit" class="primary full" ${storageReady?'':'disabled'}>Ir al contador</button></form>`;renderTeamMatches();}
function renderTeamMatches(){
  const container=document.querySelector('#team-matches');
  if(!container)return;
  if(!teamQuery.trim()){container.innerHTML='';return;}
  const matches=searchParticipants(teamQuery);
  container.innerHTML=`<p class="note" role="status">${matches.length?matches.length+(matches.length===1?' participante encontrado':' participantes encontrados')+(matches.length>20?' · Se muestran los primeros 20; concreta la búsqueda.':''):'No hay coincidencias. Puedes introducir el equipo manualmente.'}</p><ul class="team-results">${matches.slice(0,20).map(team=>`<li><button type="button" data-action="select-team" data-participant="${escape(team.id)}"><strong>${escape(team.number)} · ${escape(team.name)}</strong><span>${escape(title(team.modality))}${team.composition?' · '+escape(title(team.composition)):''} · ${escape(title(team.level))}</span></button></li>`).join('')}</ul>`;
}
function attemptCard(a){return `<article class="history-item"><strong>${escape(a.team.number)} · ${escape(a.team.name)}</strong><p>${escape(a.workout.title)} · ${escape(a.workout.categoryLabel)}</p><p class="muted">${a.status==='finalized'?'Resultado cerrado':'Borrador conservado'} · ${escape(new Date(a.updatedAt||a.createdAt).toLocaleString('es-ES'))}</p>${button('open',a.status==='finalized'?'Ver resultado':'Retomar conteo','',false,`data-id="${escape(a.id)}"`)}</article>`;}
function renderHistory(){app.innerHTML=`<div class="top-actions">${button('home','Cargar Nuevo')}${button('backup','Descargar CSV','primary')}</div><h1>Historial de este dispositivo</h1><p class="muted">Estos resultados no se han enviado a Drive. Descarga una copia antes de borrar los datos del navegador.</p>${saveError?button('retry','Reintentar guardado','full'):''}${attempts.length?attempts.map(attemptCard).join(''):'<p class="empty">Todavía no hay intentos guardados.</p>'}`;}
function partTabs(){return current.workout.parts.length>1?`<div class="choices" aria-label="Partes del workout">${current.workout.parts.map(p=>button('part',`${p.label}${current.parts[p.id].status==='closed'?' · Cerrada':''}`,p.id===selectedPartId?'selected':'',false,`data-part="${escape(p.id)}"`)).join('')}</div>`:'';}
function partResult(def,state){const r=state.result;return `<div class="score-card"><p class="eyebrow">${escape(def.label)} · ${r.outcome==='cap'?'Cap alcanzado · Sin terminar':r.outcome==='recorded'?'Calorías registradas':'Completado'}</p><div class="counter${r.time?' time-score':''}">${escape(r.time?( /^[0-9]{2}:[0-9]{2}$/.test(r.time)?r.time+':00':r.time):r.score)} <small>${r.time?'':escape(r.unit==='calories'?'calorías':r.unit||def.unit)}</small></div>${r.time?`<p>${escape(r.score)} ${escape(r.unit==='calories'?'calorías':r.unit||def.unit)} registradas</p>`:''}</div>`;}
function renderCounter(){const def=current.workout.parts.find(p=>p.id===selectedPartId)||current.workout.parts[0];selectedPartId=def.id;const state=current.parts[def.id];if(state.status==='active'&&current.status==='active'&&state.index<def.blocks.length-1&&state.counts[state.index]===def.blocks[state.index].target){const resumed=nextBlock(current,def.id);remember(resumed);persist(resumed);renderCounter();return;}app.innerHTML=header(false)+partTabs();if(state.status==='closed'){app.innerHTML+=partResult(def,state)+button('reopen','Editar esta parte','full')+button('finish-attempt','Revisar y cerrar resultado','dark full',!current.workout.parts.every(p=>current.parts[p.id].status==='closed'));return;}const block=def.blocks[state.index];app.innerHTML+=`<p class="eyebrow">${escape(def.label)}${block?` / Bloque ${state.index+1} de ${def.blocks.length}`:''}</p>${(def.notes||[]).length?`<details><summary>Indicaciones de la hoja</summary><ul class="review-list">${def.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul></details>`:''}`;if(def.kind==='calories'){app.innerHTML+='<h2>Calorías SkiErg</h2><p class="instructions">Lee las calorías del monitor al terminar e introdúcelas al cerrar esta parte. Sigue siempre el reloj de pista.</p>';}else if(block){const count=state.counts[state.index]||0;app.innerHTML+=`<h2>${escape(block.label)}</h2>${block.athletes?`<p class="badge">${escape(block.athletes)}</p>`:''}${block.note?`<p class="instructions">${escape(block.note)}</p>`:''}<div class="counter" aria-label="${count} de ${block.target}">${count} <small>/ ${block.target}</small></div><progress value="${count}" max="${block.target}" aria-label="Progreso del bloque"></progress><p><strong>TOTAL: ${total(state)} ${escape(def.unit||'reps').toUpperCase()}</strong></p>${button('increment',block.buttonLabel||'+1 REP','tap',count>=block.target)}${button('complete-block','Finalizar ejercicio','full',count>=block.target)}<p class="note">Avance automático al completar el bloque. Deshacer permite corregir la última pulsación.</p><div class="toolbar">${button('subtract','−1','',count<=0)}${button('undo','Deshacer',!state.history?.length?'disabled':'',!state.history?.length)}</div>`;}app.innerHTML+=button('close-part',current.workout.parts.length>1?'Cerrar esta parte':'Finalizar resultado','dark full')+button('reset','Reiniciar esta parte','full');}
function renderResult(){app.innerHTML=header()+`<span class="badge">03 / REVISAR</span><h2>${current.status==='finalized'?'Resultado cerrado':'Revisión del resultado'}</h2>`+current.workout.parts.map(p=>current.parts[p.id].result?partResult(p,current.parts[p.id]):`<p>${escape(p.label)}: pendiente de cierre</p>`).join('')+`<p class="instructions">Consulta el estado de guardado al pie de la pantalla. Drive pendiente · Sin envío externo.</p>`+button('edit-result','Editar resultado','full')+button('backup','Descargar copia CSV','primary full');}
function ask(titleText,body,confirmLabel,callback){onConfirm=callback;document.querySelector('#dialog-title').textContent=titleText;document.querySelector('#dialog-body').innerHTML=(current?'<p class="badge">'+escape(current.team.number)+' · '+escape(current.team.name)+'</p>':'')+body;document.querySelector('#confirm-dialog').textContent=confirmLabel;document.querySelector('#dialog-error').textContent='';refreshConfirmation();dialog.showModal();document.querySelector('#cancel-dialog').focus();}
function refreshConfirmation(){
  const time=dialog.querySelector('input[name="time"]');
  const quantity=dialog.querySelector('input[name="calories"]');
  let valid=true;
  try {if(time)normalizeTime(time.value);if(quantity)parseQuantity(quantity.value);} catch {valid=false;}
  document.querySelector('#confirm-dialog').disabled=!valid;
}
function confirmChange(titleText,description,callback){ask(titleText,`<p>${escape(description)}</p>`,'Confirmar',callback);}
function closeDialog(){dialog.close();onConfirm=null;}
document.querySelector('#cancel-dialog').addEventListener('click',closeDialog);
dialog.addEventListener('cancel',()=>{onConfirm=null;});
document.querySelector('#dialog-form').addEventListener('submit',event=>{event.preventDefault();refreshConfirmation();if(document.querySelector('#confirm-dialog').disabled)return;try{onConfirm?.(new FormData(event.currentTarget));closeDialog();}catch(error){document.querySelector('#dialog-error').textContent=error.message;}});
function closePartDialog(){
  const def=current.workout.parts.find(p=>p.id===selectedPartId);
  const complete=isPartComplete(def,current.parts[def.id]);
  const body=`<p>Revisa ${escape(def.label)}. El cierre es manual y utiliza el reloj de pista.</p>${def.kind==='calories'
    ? '<label class="field">Añadir calorías registradas<input name="calories" type="text" required inputmode="numeric" pattern="[0-9]{1,5}" maxlength="5" data-digits autocomplete="off"></label>'
    : complete
      ? '<p><strong>Completado</strong></p><input type="hidden" name="outcome" value="completed"><label class="field">Añadir tiempo<input name="time" type="text" required inputmode="numeric" maxlength="8" placeholder="00:00" aria-describedby="time-help" autocomplete="off"></label><p class="note" id="time-help">Minutos : segundos : centésimas. Escribe solo números; los dos puntos se añaden automáticamente. Si omites las centésimas, se guardarán como 00.</p>' + `<p class="note">${total(current.parts[def.id])} ${escape(def.unit)} registradas</p>`
      : `<p><strong>No completado · Cap alcanzado</strong></p><input type="hidden" name="outcome" value="cap"><p class="score-card"><strong>${total(current.parts[def.id])} ${escape(def.unit)} registradas</strong></p><p class="note">Se guardará la cantidad contada. Cancela para corregirla con los botones de conteo.</p>`}`;
  ask(current.workout.parts.length>1?'Confirmar cierre de esta parte':'Confirmar resultado',body,'Confirmar cierre',data=>{
    let updated=closePart(current,def.id,{outcome:data.get('outcome'),time:data.get('time')||'',calories:def.kind==='calories'?data.get('calories'):undefined});
    if(updated.workout.parts.every(p=>updated.parts[p.id].status==='closed')){updated=finalizeAttempt(updated);screen='result';}
    remember(updated);persist(updated);render();
  });
}
dialog.addEventListener('beforeinput',event=>{
  const field=event.target;
  if(field.name!=='time'&&!field.hasAttribute('data-digits'))return;
  if(event.inputType==='insertText'&&event.data&&/[^0-9]/.test(event.data)){event.preventDefault();return;}
  if(field.name==='time'&&field.selectionStart===field.selectionEnd){
    const position=field.selectionStart;
    if(event.inputType==='deleteContentBackward'&&position>0&&field.value[position-1]===':')field.setSelectionRange(position-1,position-1);
    if(event.inputType==='deleteContentForward'&&field.value[position]===':')field.setSelectionRange(position+1,position+1);
  }
});
dialog.addEventListener('input',event=>{
  const field=event.target;
  if(field.name!=='time'&&!field.hasAttribute('data-digits'))return;
  const digitPosition=digitsOnly(field.value.slice(0,field.selectionStart)).length;
  field.value=field.name==='time'?maskTime(field.value):digitsOnly(field.value).slice(0,5);
  const position=field.name==='time'?Math.min(field.value.length,digitPosition+(digitPosition>=2?1:0)+(digitPosition>=4?1:0)):Math.min(field.value.length,digitPosition);
  field.setSelectionRange(position,position);
  field.setCustomValidity('');
  refreshConfirmation();
  document.querySelector('#dialog-error').textContent='';
});
dialog.addEventListener('focusout',event=>{
  if(event.target.name!=='time'||!event.target.value)return;
  try{event.target.value=normalizeTime(event.target.value);}catch{/* Keep incomplete input editable. */}
  refreshConfirmation();
});
function backup(){const csv=exportCSV(attempts);const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fcl-resultados.csv';a.click();URL.revokeObjectURL(url);}
app.addEventListener('keydown',event=>{
  if(event.target.name==='teamSearch'&&event.key==='Enter'){event.preventDefault();document.querySelector('#team-matches button')?.focus();}
});
app.addEventListener('beforeinput',event=>{
  if(event.target.name==='number'&&event.target.closest('#prepare-form')&&event.inputType==='insertText'&&event.data&&/[^0-9]/.test(event.data))event.preventDefault();
});
app.addEventListener('input',event=>{
  const field=event.target;
  if(field.name==='teamSearch'){teamQuery=field.value;renderTeamMatches();saveView();return;}
  if(!field.closest('#prepare-form')||!(field.name in teamDraft))return;
  if(field.name==='number'){
    const position=digitsOnly(field.value.slice(0,field.selectionStart)).length;
    field.value=digitsOnly(field.value);
    field.setSelectionRange(position,position);
  }
  teamDraft[field.name]=field.value;
  saveView();
});
app.addEventListener('change',event=>{if(event.target.name==='wodId'){selection.wodId=event.target.value;saveView();}});
app.addEventListener('submit',event=>{if(event.target.id!=='prepare-form')return;event.preventDefault();if(!storageReady)return;try{const workout=getWorkout(selection);const session=createAttempt(workout,{...teamDraft,number:teamDraft.number.trim(),name:teamDraft.name.trim()});remember(session);selectedPartId=workout.parts[0].id;screen='counter';persist(session);render();}catch(error){showError(error.message);}});
app.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b||b.disabled)return;try{switch(b.dataset.action){case 'select-team':{
 const team=PARTICIPANTS.find(t=>t.id===b.dataset.participant);if(!team)break;
 teamDraft={...teamDraft,number:team.number,name:team.name};
 selection=participantSelection(team,selection);
 if(!listWorkouts(selection.modality).some(w=>w.id===selection.wodId))selection.wodId='1';
 teamQuery='';render();document.querySelector('select[name="wodId"]').focus();break;
}case 'view-wod':showWorkout();break;case 'choice':selection[b.dataset.key]=b.dataset.value;if(!listWorkouts(selection.modality).some(w=>w.id===selection.wodId))selection.wodId='1';render();break;case 'history':screen='history';render();break;case 'home':if(screen==='counter'&&current.status==='active')confirmChange('Salir del conteo','Se conservará el borrador. Podrás retomarlo desde el historial.',()=>{screen='prepare';render();});else{screen='prepare';render();}break;case 'open':current=attempts.find(a=>a.id===b.dataset.id);selectedPartId=current.workout.parts.find(p=>current.parts[p.id].status==='active')?.id||current.workout.parts[0].id;screen=current.status==='finalized'?'result':'counter';render();break;case 'part':selectedPartId=b.dataset.part;render();break;case 'complete-block':{
 const partId=selectedPartId,def=current.workout.parts.find(p=>p.id===partId),state=current.parts[partId],block=def.blocks[state.index];
 if(!block||state.counts[state.index]>=block.target)break;
 const remaining=block.target-state.counts[state.index];
 const next=state.index<def.blocks.length-1?' Se pasará al siguiente ejercicio.':' Es el último ejercicio; después podrás registrar el resultado.';
 confirmChange('Finalizar ejercicio',`${block.label}: se añadirán las ${remaining} ${def.unit||'reps'} que faltan para completar ${block.target}.`+next,()=>update(s=>setBlockCount(s,partId,block.target)));
 break;
}case 'increment':update(s=>increment(s,selectedPartId));break;case 'subtract':update(s=>setBlockCount(s,selectedPartId,Math.max(0,s.parts[selectedPartId].counts[s.parts[selectedPartId].index]-1)));break;case 'undo':update(s=>undo(s,selectedPartId));break;case 'close-part':closePartDialog();break;case 'reset':confirmChange('Reiniciar esta parte','Se pondrán a cero los registros de esta parte. Las demás partes se conservarán.',()=>update(s=>resetPart(s,selectedPartId)));break;case 'reopen':confirmChange('Reabrir esta parte','Volverás al conteo para revisar el resultado. Después deberás confirmar el cierre de nuevo.',()=>update(s=>reopenPart(s,selectedPartId)));break;case 'edit-result':confirmChange('Editar resultado cerrado','Se abrirá la revisión. Selecciona la parte que quieras reabrir y corregir.',()=>{screen='counter';render();});break;case 'finish-attempt':if(current.status==='finalized'){screen='result';render();break;}confirmChange('Cerrar resultado','Se conservarán los resultados de todas las partes. No se enviarán a Drive.',()=>{update(finalizeAttempt);screen='result';render();});break;case 'backup':backup();break;case 'retry':saveError='';attempts.forEach(persist);render();break;}}catch(error){showError(error.message);}});
function connectivity(){document.querySelector('#connection').textContent=navigator.onLine?'Con conexión · Los resultados se guardan en este dispositivo':'Sin conexión · Puedes seguir contando; para abrir o recargar necesitas conexión';}
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);
window.addEventListener('pagehide',saveView);
window.addEventListener('beforeunload',event=>{saveView();if(pending||saveError){event.preventDefault();event.returnValue='';}});
connectivity();
try{attempts=await loadAttempts();const view=restoreView();storageReady=true;render();storageStatus();if(view){if(view.wodOpen&&current&&screen==='counter')showWorkout();requestAnimationFrame(()=>window.scrollTo(0,Math.max(0,Number(view.scrollY)||0)));}}catch(error){render();saveError=error.message;storageStatus();showError('No se ha podido abrir el almacenamiento local. No comiences un intento hasta resolverlo.');document.querySelector('#prepare-form button[type="submit"]').disabled=true;}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{document.querySelector('#connection').textContent+=' · Actualización de acceso no disponible';});
