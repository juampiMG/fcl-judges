import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt,increment,nextBlock,undo,closePart,reopenPart,finalizeAttempt,resetPart,setBlockCount,total} from '../web/engine.js';
import {exportCSV} from '../web/storage.js';
const workout={id:'test',title:'Prueba',version:'1',categoryLabel:'Parejas Mixto RX',parts:[{id:'a',label:'Barra',kind:'for-time',unit:'reps',blocks:[{target:2},{target:1}]},{id:'b',label:'Ski',kind:'calories',unit:'calories',blocks:[]}]};
const fresh=()=>createAttempt(workout,{number:'42',name:'Brava'});
test('one activation counts once without advancing or modifying original',()=>{const a=fresh(),b=increment(a,'a');assert.equal(total(a.parts.a),0);assert.equal(total(b.parts.a),1);assert.equal(b.parts.a.index,0);});
test('last rep automatically advances and undo restores previous block',()=>{let a=fresh();a=increment(increment(a,'a'),'a');assert.equal(a.parts.a.index,1);assert.deepEqual(a.parts.a.counts,[2,0]);assert.equal(a.parts.a.status,'active');a=undo(a,'a');assert.equal(a.parts.a.index,0);assert.deepEqual(a.parts.a.counts,[1,0]);});
test('rapid increments at full target cannot overflow',()=>{let a=increment(increment(increment(fresh(),'a'),'a'),'a');assert.throws(()=>increment(a,'a'));assert.equal(total(a.parts.a),3);assert.equal(a.parts.a.status,'active');assert.equal(a.parts.a.index,1);});
test('cap preserves units and other component remains open',()=>{let a=increment(fresh(),'a');a=closePart(a,'a',{outcome:'cap'});assert.deepEqual(a.parts.a.result,{outcome:'cap',time:null,score:1,unit:'reps'});assert.equal(a.parts.b.status,'active');assert.throws(()=>finalizeAttempt(a));});
test('zero calories differs from unentered and both parts required',()=>{let a=closePart(fresh(),'a',{outcome:'cap'});assert.throws(()=>closePart(a,'b',{calories:''}));a=closePart(a,'b',{calories:0});a=finalizeAttempt(a);assert.equal(a.parts.b.result.score,0);assert.equal(a.status,'finalized');assert.throws(()=>finalizeAttempt(a));});
test('completed needs target and manual valid time; no clock calculated',()=>{let a=fresh();assert.throws(()=>closePart(a,'a',{outcome:'completed',time:'01:05'}));a=setBlockCount(a,'a',2);a=increment(a,'a');assert.throws(()=>closePart(a,'a',{outcome:'completed',time:'04:60'}));assert.throws(()=>closePart(a,'a',{outcome:'completed',time:'00:00'}));a=closePart(a,'a',{outcome:'completed',time:'08:42'});assert.equal(a.parts.a.result.time,'08:42:00');});
test('reopening only chosen part preserves other result',()=>{let a=closePart(fresh(),'a',{outcome:'cap'});a=closePart(a,'b',{calories:83});a=finalizeAttempt(a);a=reopenPart(a,'a');assert.equal(a.status,'active');assert.equal(a.parts.b.result.score,83);assert.equal(a.parts.a.result,null);});
test('reset part does not reset other component',()=>{let a=increment(fresh(),'a');a=closePart(a,'b',{calories:45});a=resetPart(a,'a');assert.equal(total(a.parts.a),0);assert.equal(a.parts.b.result.score,45);});
test('identity is required; timestamps/IDs immutable under count',()=>{assert.throws(()=>createAttempt(workout,{name:'',number:'1'}));const a=fresh(),b=increment(a,'a');assert.equal(a.id,b.id);assert.equal(a.createdAt,b.createdAt);assert.equal(b.revision,a.revision+1);});
test('CSV prevents formulas and keeps each score separate',()=>{let a=fresh();a.team.name='=HYPERLINK("bad")';a=closePart(a,'a',{outcome:'cap'});a=closePart(a,'b',{calories:8});const csv=exportCSV([a]);assert.ok(csv.includes("'=HYPERLINK"));assert.equal(csv.split('\r\n').length,3);assert.ok(csv.includes('sin_envio_externo'));});

test('legacy completed block can resume automatically without counting another rep',()=>{let a=fresh();a.parts.a.counts[0]=2;a=nextBlock(a,'a');assert.equal(a.parts.a.index,1);assert.equal(total(a.parts.a),2);});
test('undo after counting in next block then across boundary restores exact state',()=>{let a=increment(increment(increment(fresh(),'a'),'a'),'a');a=undo(a,'a');assert.deepEqual(a.parts.a.counts,[2,0]);assert.equal(a.parts.a.index,1);a=undo(a,'a');assert.deepEqual(a.parts.a.counts,[1,0]);assert.equal(a.parts.a.index,0);});

test('team number rejects letters, symbols and exponent notation and preserves leading zeros',()=>{
  for(const number of ['ABC','42A','-42','+42','4.2','4e2','4 2','４２'])assert.throws(()=>createAttempt(workout,{number,name:'Team'}),/dígitos/);
  assert.equal(createAttempt(workout,{number:'0042',name:'Team'}).team.number,'0042');
});

test('bulk completion adds only missing reps, advances and undo survives reload',()=>{
 const w=structuredClone(workout);w.parts[0].blocks=[{target:10},{target:8}];
 let a=createAttempt(w,{number:'42',name:'Test'});a=increment(increment(a,'a'),'a');
 const before=structuredClone(a.parts.a);a=setBlockCount(a,'a',10);
 assert.deepEqual(a.parts.a.counts,[10,0]);assert.equal(a.parts.a.index,1);assert.equal(total(a.parts.a),10);
 a=undo(JSON.parse(JSON.stringify(a)),'a');assert.deepEqual(a.parts.a,before);
 a=setBlockCount(a,'a',10);a=setBlockCount(a,'a',8);
 assert.deepEqual(a.parts.a.counts,[10,8]);assert.equal(a.parts.a.index,1);assert.equal(a.parts.a.status,'active');assert.equal(a.status,'active');
 assert.throws(()=>setBlockCount(a,'b',10));
});
