import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, searchTeams } from '../web/teams.js';
test('roster contains 228 consecutive unique teams and correct division counts',()=>{
 assert.equal(TEAMS.length,228);
 assert.deepEqual(TEAMS.map(t=>Number(t.number)),Array.from({length:228},(_,i)=>i+1));
 assert.deepEqual(['elite','rx','open'].map(level=>TEAMS.filter(t=>t.level===level).length),[39,75,114]);
 assert.ok(TEAMS.every(t=>Object.keys(t).sort().join(',')==='level,name,number'));
});
test('search ranks exact number and matches case, accents and partial names',()=>{
 assert.equal(searchTeams('42')[0].name,'Lacoste Brava');
 assert.equal(searchTeams('1')[0].number,'1');
 assert.equal(searchTeams('cardiofobicos')[0].number,'52');
 assert.ok(searchTeams('BRAVA').some(t=>t.number==='42'));
 assert.equal(searchTeams('no-existing-team-xyz').length,0);
 assert.equal(searchTeams(' ').length,0);
 assert.equal(searchTeams('194')[0].name,'Ghost Wod Tiparrac@s');
});
