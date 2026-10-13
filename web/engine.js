import { normalizeTime, parseQuantity } from './score-input.js';
/** Pure scorekeeping transitions. Competition time is always entered by a judge. */
const clone = value => structuredClone(value);
const now = () => new Date().toISOString();
function fail(message) { throw new Error(message); }
function partOf(session, partId) {
  const definition = session.workout.parts.find(part => part.id === partId);
  const state = session.parts[partId];
  if (!definition || !state) fail('Parte del workout no encontrada.');
  return [definition, state];
}
function update(session, partId, operation, {allowClosed = false} = {}) {
  const draft = clone(session);
  const [definition, state] = partOf(draft, partId);
  if (!allowClosed && (draft.status === 'finalized' || state.status !== 'active')) fail('Reabre el resultado antes de corregirlo.');
  operation(definition, state, draft);
  draft.updatedAt = now(); draft.revision = (session.revision ?? 0) + 1;
  return draft;
}
function remember(state) { state.history.push({index: state.index, counts: [...state.counts]}); }
export function createAttempt(workout, team) {
  if (!String(team?.number ?? '').trim() || !String(team?.name ?? '').trim()) fail('Introduce número y nombre del equipo.');
  if (!workout?.parts?.length) fail('Workout no válido.');
  const cleaned = {};
  for (const field of ['number', 'name', 'heat', 'lane', 'judge']) {
    cleaned[field] = String(team[field] ?? '').trim();
    if (cleaned[field].length > 120) fail('Los datos del equipo no pueden superar 120 caracteres.');
  }
  if (!/^[0-9]+$/.test(cleaned.number)) fail('El número de equipo solo puede contener dígitos del 0 al 9.');
  const date = now();
  return {id: crypto.randomUUID(), schemaVersion: 1, revision: 0, createdAt: date, updatedAt: date,
    team: cleaned, workout: clone(workout), status: 'active',
    parts: Object.fromEntries(workout.parts.map(p => [p.id, {index: 0, counts: p.blocks.map(() => 0), history: [], status: 'active', result: null}]))};
}
export function total(state) { return state.counts.reduce((sum, count) => sum + count, 0); }
export function isPartComplete(definition, state) {
  return definition.kind !== 'calories' && definition.blocks.length > 0 && definition.blocks.every((b, i) => state.counts[i] === b.target);
}
export function increment(session, partId) {
  return update(session, partId, (definition, state) => {
    const block = definition.blocks[state.index];
    if (!block) fail('Esta parte se registra al finalizar.');
    if (state.counts[state.index] >= block.target) fail('Todos los bloques están completados. Registra el resultado.');
    remember(state); state.counts[state.index] += 1;
    if (state.counts[state.index] === block.target && state.index < definition.blocks.length - 1) state.index += 1;
  });
}
export function setBlockCount(session, partId, count) {
  return update(session, partId, (definition, state) => {
    const block = definition.blocks[state.index];
    if (!block || !Number.isInteger(count) || count < 0 || count > block.target) fail('Cantidad fuera del objetivo de este bloque.');
    remember(state); state.counts[state.index] = count;
    if (count === block.target && state.index < definition.blocks.length - 1) state.index += 1;
  });
}
export function nextBlock(session, partId) {
  return update(session, partId, (definition, state) => {
    const block = definition.blocks[state.index];
    if (!block || state.counts[state.index] !== block.target) fail('Completa el bloque actual antes de avanzar.');
    if (state.index >= definition.blocks.length - 1) fail('Ya estás en el último bloque.');
    state.index += 1;
  });
}
export function undo(session, partId) {
  return update(session, partId, (_definition, state) => {
    if (!state.history.length) fail('No hay anotaciones que deshacer.');
    const before = state.history.pop(); state.index = before.index; state.counts = before.counts;
  });
}
export function closePart(session, partId, input = {}) {
  return update(session, partId, (definition, state) => {
    if (definition.kind === 'calories') {
      if (input.calories === '' || input.calories === null || input.calories === undefined) fail('Introduce las calorías del monitor; cero también es un resultado válido.');
      const calories = parseQuantity(input.calories);
      if (!Number.isSafeInteger(calories) || calories < 0 || calories > 99999) fail('Introduce un número entero de calorías válido.');
      state.result = {outcome: 'recorded', time: null, score: calories, unit: 'calories'};
    } else {
      if (!['completed', 'cap'].includes(input.outcome)) fail('Selecciona completado o time cap.');
      if (input.outcome === 'completed' && !isPartComplete(definition, state)) fail('Faltan unidades por completar. Revisa el conteo o elige time cap.');
      if (input.outcome === 'cap' && isPartComplete(definition, state)) fail('Todos los bloques están completos. Registra el tiempo de pista.');
      state.result = {outcome: input.outcome, time: input.outcome === 'completed' ? normalizeTime(input.time) : null, score: total(state), unit: definition.unit ?? 'reps'};
    }
    state.status = 'closed';
  });
}
export function reopenPart(session, partId) {
  return update(session, partId, (_definition, state, draft) => {
    state.previousResult = state.result ? {...state.result} : state.previousResult ?? null;
    state.status = 'active'; state.result = null; draft.status = 'active';
  }, {allowClosed: true});
}
export function resetPart(session, partId) {
  return update(session, partId, (definition, state) => {
    state.index = 0; state.counts = definition.blocks.map(() => 0); state.history = []; state.result = null;
  });
}
export function finalizeAttempt(session) {
  if (session.status === 'finalized') fail('Este resultado ya está confirmado.');
  if (!session.workout.parts.every(p => session.parts[p.id]?.status === 'closed')) fail('Registra todas las partes antes de confirmar el resultado.');
  const draft = clone(session); draft.status = 'finalized'; draft.updatedAt = now(); draft.revision = (session.revision ?? 0) + 1;
  return draft;
}
