const DB_NAME = 'fcl-judge-desk';
const STORE = 'attempts';
let connection;
const knownSnapshots = new Map();
function openDB() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: 'id'});
    request.onsuccess = () => { request.result.onversionchange = () => {request.result.close(); connection = null;}; resolve(request.result); };
    request.onerror = () => {connection = null; reject(new Error('No se puede abrir el guardado local. Conserva esta pantalla y descarga una copia.'));};
    request.onblocked = () => {connection = null; reject(new Error('Cierra otras pestañas de esta aplicación y vuelve a intentarlo.'));};
  });
  return connection;
}
export async function loadAttempts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly'); const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const rows = request.result;
      if (rows.some(row => row.schemaVersion !== 1 || !row.workout?.parts || !row.parts || !row.team)) {reject(new Error('Hay datos locales de un formato no compatible. No se han borrado.'));return;}
      for (const row of rows) knownSnapshots.set(row.id, JSON.stringify(row));
      resolve(rows.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
    };
    request.onerror = () => reject(new Error('No se pudieron recuperar los resultados locales.'));
  });
}
export async function saveAttempt(attempt) {
  const snapshot = structuredClone(attempt); const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); const store = tx.objectStore(STORE); const existing = store.get(snapshot.id);
    let conflict = false;
    existing.onsuccess = () => {
      const previous = existing.result;
      const actual = previous ? JSON.stringify(previous) : undefined;
      if (actual === JSON.stringify(snapshot)) return;
      if (actual !== knownSnapshots.get(snapshot.id)) {
        conflict = true; tx.abort(); return;
      }
      store.put(snapshot);
    };
    tx.oncomplete = () => {knownSnapshots.set(snapshot.id, JSON.stringify(snapshot)); resolve();};
    tx.onabort = tx.onerror = () => reject(new Error(conflict ? 'Otra pestaña contiene una versión distinta. No se ha sobrescrito. Descarga tu copia antes de recargar.' : 'No se ha podido guardar en este dispositivo. Descarga una copia antes de salir.'));
  });
}
function cell(value) {
  let text = String(value ?? '');
  // Team names can be opened in spreadsheet software. Never permit formula execution.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportCSV(attempts) {
  const rows = [['intento_id','revision','estado','fecha','equipo_numero','equipo_nombre','heat','carril','juez','categoria','workout','version_workout','parte','resultado','tiempo_manual','unidades_completadas','unidad','envio']];
  for (const attempt of attempts) for (const definition of attempt.workout.parts) {
    const state = attempt.parts[definition.id]; const result = state.result;
    rows.push([attempt.id,attempt.revision,attempt.status,attempt.createdAt,attempt.team.number,attempt.team.name,attempt.team.heat,attempt.team.lane,attempt.team.judge,attempt.workout.categoryLabel,attempt.workout.title,attempt.workout.version,definition.label,result?.outcome ?? 'pendiente',result?.time ?? '',result?.score ?? state.counts.reduce((a,b)=>a+b,0),result?.unit ?? definition.unit,'sin_envio_externo']);
  }
  return '\uFEFF' + rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
