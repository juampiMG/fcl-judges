import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, COMPOSITIONS, listWorkouts, getWorkout } from '../web/catalog.js';

const fixture = JSON.parse(readFileSync(new URL('../../output/judge-app-analysis/catalog-review.json', import.meta.url)));
const get = (wodId, level = 'elite', modality = 'teams', composition = 'masculino') => getWorkout({ wodId, level, modality, composition });

test('all 63 official variants have exact independent scoresheet totals', () => {
  assert.equal(fixture.variants.length, 63);
  for (const variant of fixture.variants) {
    const workout = getWorkout({ modality: variant.modality, level: variant.category, composition: variant.composition, wodId: variant.wod });
    assert.equal(workout.parts.length, variant.components.length, variant.id);
    for (const expected of variant.components) {
      const part = workout.parts.find(p => p.id === expected.id);
      assert.ok(part, `${variant.id} ${expected.id}`);
      if (expected.target_score_units === null) { assert.equal(part.kind, 'calories'); assert.equal(part.blocks.length, 0); }
      else assert.equal(part.blocks.reduce((sum, block) => sum + block.target, 0), expected.target_score_units, `${variant.id} ${part.id}`);
      assert.equal(new Set(part.blocks.map(b => b.id)).size, part.blocks.length);
      part.blocks.forEach(b => { assert.ok(Number.isInteger(b.target) && b.target > 0); assert.ok(b.buttonLabel); });
    }
  }
});

test('selection matrix exposes 18 teams and 45 pairs, no pairs final', () => {
  assert.equal(LEVELS.length * listWorkouts('teams').length, 18);
  assert.equal(LEVELS.length * COMPOSITIONS.length * listWorkouts('parejas').length, 45);
  assert.throws(() => get('final', 'elite', 'parejas'));
  assert.throws(() => getWorkout({ modality: 'teams', level: 'unknown', wodId: '1' }));
});

test('worm sequence interleaves exactly four shuttle blocks', () => {
  const blocks = get('1', 'open', 'parejas', 'mixto').parts[0].blocks;
  assert.deepEqual(blocks.map(b => b.target), [16, 3, 8, 3, 16, 3, 8, 3, 16]);
  assert.deepEqual(blocks.map(b => b.label), ['Worm Squats', 'Synchro Shuttle Run', 'Worm Push Press', 'Synchro Shuttle Run', 'Worm Squats', 'Synchro Shuttle Run', 'Worm Push Press', 'Synchro Shuttle Run', 'Worm Squats']);
});

test('rope variants preserve legless exceptions and teams rotation', () => {
  assert.deepEqual(get('2', 'elite').parts[0].blocks.filter(b => b.label.includes('Climb')).map(b => [b.label, b.target]), Array(5).fill(['Legless Rope Climb', 2]));
  for (const composition of ['femenino', 'mixto']) {
    assert.deepEqual(get('2', 'elite', 'parejas', composition).parts[0].blocks.slice(0, 2).map(b => [b.label, b.target]), [['Legless Rope Climb', 1], ['Rope Climb', 1]]);
  }
  assert.equal(get('2', 'rx', 'parejas', 'femenino').parts[0].blocks[0].label, 'Rope Climb');
  assert.equal(get('2', 'rx', 'parejas', 'femenino').parts[0].blocks[0].target, 2);
  assert.deepEqual(get('2').parts[0].blocks.filter(b => b.label.includes('Climb')).map(b => b.athletes), ['A + B', 'C + D', 'A + B', 'C + D', 'Pareja libre']);
});

test('arena preserves 9/6/9 order, rotation and separate simultaneous calories', () => {
  const p = get('3', 'rx', 'parejas').parts;
  assert.deepEqual(p[0].blocks.map(b => b.target), [9, 6, 9, 9, 6, 9, 9, 6, 9, 9, 6, 9]);
  assert.equal(p[0].blocks[0].athletes, 'Barra A · Ski B');
  assert.equal(p[0].blocks[3].athletes, 'Barra B · Ski A');
  assert.equal(p[1].kind, 'calories');
  assert.equal(p[1].blocks.length, 0);
});

test('carry is one complete unit per athlete with four burpee blocks only', () => {
  const b = get('4').parts[0].blocks;
  assert.deepEqual(b.slice(0, 4).map(x => [x.target, x.athletes]), [[1, 'Atleta A'], [1, 'Atleta B'], [1, 'Atleta C'], [1, 'Atleta D']]);
  assert.equal(b.filter(x => x.label.includes('Burpees')).length, 4);
  assert.deepEqual(b.filter(x => x.label.includes('Snatch')).map(x => x.target), [18, 15, 12, 15, 18]);
  assert.ok(b.slice(-4).every(x => x.label.endsWith('Buy-out')));
  assert.equal(get('4', 'elite', 'parejas').parts[0].blocks[2].label, 'KB Swing');
});

test('gymnastics score HSW segments and giro separately before each athlete HSPU', () => {
  const b = get('5').parts[0].blocks;
  assert.equal(b.length, 36);
  assert.deepEqual(b.slice(0, 9).map(x => x.target), [1, 1, 1, 1, 1, 1, 8, 8, 8]);
  assert.deepEqual(b.slice(0, 3).map(x => x.label), ['Handstand Walk · 4 m de ida', 'Handstand Walk · Giro', 'Handstand Walk · 4 m de vuelta']);
  assert.match(b[6].athletes, /atleta 1$/);
  assert.match(b[7].athletes, /atleta 2$/);
  assert.equal(get('5', 'rx').parts[0].blocks[6].label, 'HSPU');
});

test('pairs 5 has two independent four minute parts and complete lunges units', () => {
  const p = get('5', 'rx', 'parejas').parts;
  assert.deepEqual(p.map(x => x.capMinutes), [4, 4]);
  assert.equal(p[0].unit, 'vueltas');
  assert.deepEqual(p[0].blocks.map(x => x.athletes), ['Atleta A', 'Atleta B', 'Atleta libre']);
  assert.deepEqual(p[1].blocks.map(x => x.target), [15, 1, 15, 1, 15, 1]);
  assert.ok(get('5', 'open', 'parejas').parts[1].blocks.every(x => x.label.startsWith('1 DB')));
});

test('open final uses strict HSPU, non-synchro shared second phase pull-ups, complete complex', () => {
  const b = get('final', 'open').parts[0].blocks;
  assert.deepEqual(b.slice(0, 3).map(x => [x.label, x.target]), [['SkiErg', 8], ['Strict HSPU', 8], ['Synchro Pull-Ups', 16]]);
  assert.deepEqual(b.slice(9, 11).map(x => [x.label, x.target]), [['Pull-Ups · a repartir', 12], ['Synchro Bar Complex', 6]]);
  assert.ok(b.slice(0, 9).every(x => x.athletes === 'A + B'));
  assert.ok(b.slice(9).every(x => x.athletes === 'C + D'));
});

test('catalog calls return independent data and keep cap informational', () => {
  const first = get('1');
  first.parts[0].blocks[0].target = 0;
  assert.equal(get('1').parts[0].blocks[0].target, 20);
  assert.equal(get('2', 'elite', 'parejas').capMinutes, 10);
  assert.equal(get('2').capMinutes, 13);
});
