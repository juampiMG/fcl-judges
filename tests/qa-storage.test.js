import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttempt, increment } from '../web/engine.js';

// Small deterministic IDB boundary fake: requests are asynchronous, writes commit
// after request callbacks, and an abort never publishes staged data. Browser IDB
// scheduling and durability still require integration checks in a real browser.
function fakeIDB() {
  const rows = new Map();
  let failNextWrite = false;
  const db = {
    close() {},
    transaction() {
      let aborted = false;
      let staged;
      let fail = false;
      const tx = {
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore() {
          const request = value => {
            const r = {};
            queueMicrotask(() => {
              r.result = structuredClone(value());
              r.onsuccess?.();
              if (aborted) return;
              if (fail) { tx.onabort?.(); return; }
              if (staged) rows.set(staged.id, staged);
              tx.oncomplete?.();
            });
            return r;
          };
          return {
            get(id) { return request(() => rows.get(id)); },
            getAll() { return request(() => [...rows.values()]); },
            put(value) {
              staged = structuredClone(value);
              fail = failNextWrite;
              failNextWrite = false;
            },
          };
        },
      };
      return tx;
    },
  };
  return {
    rows,
    failWrite() { failNextWrite = true; },
    api: { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.(); }); return request; } },
  };
}

test('QA: separate tab snapshots reject stale writes even after revision surpasses stored data', async () => {
  const fake = fakeIDB();
  const original = globalThis.indexedDB;
  globalThis.indexedDB = fake.api;
  try {
    const tabA = await import('../web/storage.js?qa-tab-a');
    const tabB = await import('../web/storage.js?qa-tab-b');
    const workout = { id: 'test', parts: [{ id: 'a', blocks: [{ target: 100 }] }] };
    let a = createAttempt(workout, { number: '42', name: 'Storage fixture' });
    await tabA.saveAttempt(a);
    let [b] = await tabB.loadAttempts();
    a = increment(a, 'a');
    await tabA.saveAttempt(a);
    const committed = structuredClone(fake.rows.get(a.id));
    b.team.name = 'Conflicting tab';
    for (let i = 0; i < 5; i++) {
      b = increment(b, 'a');
      await assert.rejects(tabB.saveAttempt(b), /Otra pestaña/);
      assert.deepEqual(fake.rows.get(a.id), committed);
    }
    assert.ok(b.revision > a.revision);
    // Retrying a committed snapshot is safe and does not create another row.
    await tabA.saveAttempt(a);
    assert.equal(fake.rows.size, 1);
    // A real reload adopts the current baseline, after which editing is safe.
    [b] = await tabB.loadAttempts();
    b = increment(b, 'a');
    await tabB.saveAttempt(b);
    assert.equal(fake.rows.get(a.id).parts.a.counts[0], 2);
    // A failed commit must not advance the module's comparison baseline.
    const next = increment(b, 'a');
    fake.failWrite();
    await assert.rejects(tabB.saveAttempt(next), /No se ha podido guardar/);
    assert.deepEqual(fake.rows.get(a.id), b);
    await tabB.saveAttempt(next);
    assert.deepEqual(fake.rows.get(a.id), next);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
