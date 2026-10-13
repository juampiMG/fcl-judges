import test from 'node:test';
import assert from 'node:assert/strict';
import { PAIRS } from '../web/pairs.js';
import { PARTICIPANTS,searchParticipants,participantSelection } from '../web/participants.js';
import { getWorkout } from '../web/catalog.js';
test('231 pairs and 228 teams retain unique identity and official divisions',()=>{
 assert.equal(PAIRS.length,231);assert.equal(PARTICIPANTS.length,459);
 assert.equal(new Set(PARTICIPANTS.map(p=>p.id)).size,459);
 assert.deepEqual(PAIRS.map(p=>+p.number),Array.from({length:231},(_,i)=>235+i));
 assert.deepEqual(['masculino','femenino','mixto'].map(c=>['elite','rx','open'].map(l=>PAIRS.filter(p=>p.composition===c&&p.level===l).length)),[[12,13,13],[12,26,39],[13,39,64]]);
 assert.ok(PAIRS.every(p=>Object.keys(p).sort().join(',')==='composition,level,modality,name,number'));
});
test('search selects exact dorsal and accent-insensitive pair names',()=>{
 assert.equal(searchParticipants('235')[0].name,'Tiburón CrossFit');
 assert.equal(searchParticipants('tiburon crossfit')[0].number,'235');
 assert.equal(searchParticipants('465')[0].name,'Team Bubu');
 assert.equal(searchParticipants('42')[0].name,'Lacoste Brava');
 assert.deepEqual(searchParticipants(' '),[]);
});
test('selection replaces stale modality, subsection and category for all roster entries',()=>{
 for(const p of PARTICIPANTS){
  const selection=participantSelection(p,{modality:'teams',composition:'masculino',level:'elite',wodId:'final'});
  assert.equal(selection.modality,p.modality);assert.equal(selection.level,p.level);
  if(p.modality==='parejas'){assert.equal(selection.composition,p.composition);assert.equal(selection.wodId,'1');}
  assert.doesNotThrow(()=>getWorkout(selection));
 }
});
