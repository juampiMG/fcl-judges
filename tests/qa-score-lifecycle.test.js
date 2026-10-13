import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, COMPOSITIONS, listWorkouts, getWorkout } from '../web/catalog.js';
import { createAttempt, increment, undo, closePart, reopenPart, resetPart, finalizeAttempt, total } from '../web/engine.js';

test('QA: every catalog variant can resume from JSON and finish with independent manual results', () => {
  let variants = 0;
  for (const modality of ['teams', 'parejas']) {
    for (const composition of modality === 'teams' ? ['mixto'] : COMPOSITIONS) {
      for (const level of LEVELS) for (const entry of listWorkouts(modality)) {
        const workout = getWorkout({ modality, composition, level, wodId: entry.id });
        let attempt = createAttempt(workout, { number: '42', name: 'Lifecycle fixture' });
        for (const [partIndex, part] of workout.parts.entries()) {
          if (part.kind === 'calories') {
            attempt = closePart(attempt, part.id, { calories: 57 });
          } else {
            for (const [blockIndex, block] of part.blocks.entries()) {
              for (let count = 0; count < block.target; count++) attempt = increment(attempt, part.id);
              attempt = JSON.parse(JSON.stringify(attempt));
              assert.equal(attempt.parts[part.id].index, Math.min(blockIndex + 1, part.blocks.length - 1));
            }
            const time = partIndex === 0 ? '03:12' : '03:45';
            attempt = closePart(attempt, part.id, { outcome: 'completed', time });
            assert.equal(attempt.parts[part.id].result.time, time + ":00", workout.id);
            assert.equal(attempt.parts[part.id].result.score, part.blocks.reduce((n, b) => n + b.target, 0));
          }
          for (const later of workout.parts.slice(partIndex + 1)) {
            assert.equal(attempt.parts[later.id].status, 'active');
            assert.equal(attempt.parts[later.id].result, null);
          }
          assert.throws(() => increment(attempt, part.id));
          assert.throws(() => resetPart(attempt, part.id));
        }
        attempt = finalizeAttempt(attempt);
        assert.equal(attempt.status, 'finalized');
        const results = structuredClone(attempt.parts);
        const first = workout.parts[0].id;
        attempt = reopenPart(attempt, first);
        assert.equal(attempt.status, 'active');
        for (const other of workout.parts.slice(1)) assert.deepEqual(attempt.parts[other.id], results[other.id]);
        attempt = resetPart(attempt, first);
        assert.equal(total(attempt.parts[first]), 0);
        for (const other of workout.parts.slice(1)) assert.deepEqual(attempt.parts[other.id], results[other.id]);
        variants++;
      }
    }
  }
  assert.equal(variants, 63);
});

test('QA: JSON recovery preserves undo across an automatically advanced block and cap score', () => {
  const workout = getWorkout({ modality: 'parejas', composition: 'mixto', level: 'rx', wodId: '5' });
  let attempt = createAttempt(workout, { number: '42', name: 'Recovery fixture' });
  const part = workout.parts[1];
  for (let count = 0; count < 15; count++) attempt = increment(attempt, part.id);
  attempt = JSON.parse(JSON.stringify(attempt));
  attempt = undo(attempt, part.id);
  assert.equal(attempt.parts[part.id].index, 0);
  assert.equal(total(attempt.parts[part.id]), 14);
  attempt = closePart(attempt, part.id, { outcome: 'cap' });
  assert.equal(attempt.parts[part.id].result.score, 14);
  assert.equal(attempt.parts[part.id].result.time, null);
  assert.equal(attempt.parts[workout.parts[0].id].status, 'active');
});
