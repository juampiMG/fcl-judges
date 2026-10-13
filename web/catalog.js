// Scoresheets Costa Brava 2026 + explicit organiser clarifications.
// Every countable block increments by exactly one official scoring unit.
export const LEVELS = Object.freeze(['elite', 'rx', 'open']);
export const COMPOSITIONS = Object.freeze(['masculino', 'femenino', 'mixto']);
const VERSION = 'costa-brava-2026-v1';
const LABELS = { elite: 'Elite', rx: 'RX', open: 'Open', masculino: 'Masculino', femenino: 'Femenino', mixto: 'Mixto' };

export function listWorkouts(modality) {
  if (!['teams', 'parejas'].includes(modality)) throw new Error('Modalidad no válida');
  return [
    { id: '1', title: 'WOD 1 · Greenland', location: 'Greenland' },
    { id: '2', title: 'WOD 2 · Coliseum', location: 'Coliseum' },
    { id: '3', title: 'WOD 3 · Arena', location: 'Arena' },
    { id: '4', title: 'WOD 4 · Playa', location: 'Playa' },
    { id: '5', title: 'WOD 5', location: modality === 'teams' ? 'Coliseum / Arena' : 'Greenland' },
    ...(modality === 'teams' ? [{ id: 'final', title: 'Final', location: 'Según pista' }] : []),
  ];
}

export function getWorkout({ modality, level, composition, wodId }) {
  if (!LEVELS.includes(level)) throw new Error('Categoría no válida');
  if (modality === 'parejas' && !COMPOSITIONS.includes(composition)) throw new Error('Composición no válida');
  const entry = listWorkouts(modality).find(item => item.id === wodId);
  if (!entry) throw new Error('WOD no válido');
  const teams = modality === 'teams';
  const elite = level === 'elite';
  const open = level === 'open';
  const capMinutes = wodId === 'final' ? 12 : wodId === '5' || (!teams && ['2', '3'].includes(wodId)) ? 10 : 13;
  const parts = [];
  const part = (id, label, options = {}) => {
    const p = { id, label, kind: 'for-time', capMinutes, unit: 'reps', blocks: [], notes: [], ...options };
    parts.push(p);
    return p;
  };
  const add = (p, label, target, options = {}) => {
    p.blocks.push({ id: `${p.id}-${p.blocks.length + 1}`, label, target, unit: 'reps', buttonLabel: '+1 rep válida', round: null, athletes: '', note: '', ...options });
  };
  const pair = (round) => ['A + B', 'C + D', 'A + B', 'C + D', 'Pareja libre'][round - 1];
  if (wodId === '1') {
    const p = part('1', 'WOD 1 · Worm y shuttles');
    const amount = teams || composition === 'masculino' ? 20 : composition === 'mixto' ? 16 : 12;
    for (let i = 0; i < 5; i++) {
      const label = i % 2 === 0 ? (open ? 'Worm Squats' : 'Worm Thrusters') : open ? 'Worm Push Press' : elite ? 'Worm Clean & Jerk Over & Back' : 'Worm Clean & Jerk';
      add(p, label, i % 2 === 0 ? amount : amount / 2, { athletes: teams ? 'Todo el equipo' : 'Ambos atletas' });
      if (i < 4) add(p, 'Synchro Shuttle Run', 3, { unit: 'shuttles', buttonLabel: '+1 shuttle completo', athletes: teams ? 'Todo el equipo sincronizado' : 'Ambos atletas sincronizados' });
    }
  } else if (wodId === '2') {
    const p = part('2', 'WOD 2 · Cuerda, T2B y Devil Press', { notes: ['Avanzar las mancuernas después de cada ronda.'] });
    const split = level === 'rx' && (teams || composition !== 'femenino') || elite && !teams && composition !== 'masculino';
    for (let round = 1; round <= (teams ? 5 : 3); round++) {
      const base = { round, athletes: teams ? pair(round) : 'Pareja' };
      const rope = { ...base, unit: 'subidas', buttonLabel: '+1 subida válida' };
      if (split) { add(p, 'Legless Rope Climb', 1, rope); add(p, 'Rope Climb', 1, rope); }
      else add(p, elite ? 'Legless Rope Climb' : 'Rope Climb', 2, rope);
      add(p, 'Synchro Toes to Bar', elite ? 18 : 14, base);
      add(p, 'Synchro Devil Press', elite ? 9 : 7, { ...base, note: open ? '1 DB · 22,5/15 kg' : '22,5/15 kg' });
    }
  } else if (wodId === '3') {
    const notes = ['Rotación obligatoria en cada ronda.', 'Quien no está en barra sigue en SkiErg. Las calorías se registran manualmente en 3B, hasta el cap de pista.'];
    const p = part('3A', '3A · Barras', { notes });
    for (let round = 1; round <= (teams ? 6 : 4); round++) {
      const options = { round, athletes: teams ? '3 en barras · 1 en SkiErg' : round % 2 ? 'Barra A · Ski B' : 'Barra B · Ski A', note: `${elite ? '70/45' : open ? '50/35' : '60/40'} kg${teams ? ' · 2 barras de chico y 1 de chica' : ''}` };
      const prefix = teams ? 'Synchro ' : '';
      add(p, `${prefix}Front Squat`, 9, options);
      add(p, `${prefix}Shoulder to Overhead`, 6, options);
      add(p, `${prefix}Front Squat`, 9, options);
    }
    part('3B', '3B · Calorías SkiErg', { kind: 'calories', unit: 'calories', notes: ['Anotar las calorías del monitor al terminar el cap de pista. Trabajo simultáneo con 3A.'] });
  } else if (wodId === '4') {
    const p = part('4', 'WOD 4 · Carry, KB y burpees', { notes: ['En KB, un atleta en descanso mantiene Tombstone Hold; el hold no suma reps.', ...(teams ? ['Rotación libre. Burpees: 3 atletas sincronizados.'] : [])] });
    const carries = (phase) => {
      for (const athlete of (teams ? ['A', 'B', 'C', 'D'] : ['A', 'B'])) add(p, `Tombstone Carry · ${phase}`, 1, { athletes: `Atleta ${athlete}`, unit: 'tramos', buttonLabel: '20 m completados', note: '20 m completos = 1 rep por atleta.' });
    };
    carries('Buy-in');
    (open ? [15, 12, 9, 12, 15] : [18, 15, 12, 15, 18]).forEach((target, i) => {
      add(p, `${teams ? 'Synchro ' : ''}${teams && elite ? 'Hang KB Snatch' : 'KB Swing'}`, target, { round: i + 1, note: `${elite ? '32/24' : '24/16'} kg · Tombstone Hold del atleta en descanso` });
      if (i < 4) add(p, 'Synchro Burpees Over the Hurdle', 8, { round: i + 1, athletes: teams ? '3 atletas sincronizados' : 'Ambos atletas sincronizados' });
    });
    carries('Buy-out');
  } else if (wodId === '5' && !teams) {
    const a = part('5A', '5A · Carrera', { capMinutes: 4, unit: 'vueltas', notes: ['Contar solo vueltas completas.', 'Después de 5A: 2 minutos de descanso según el reloj de pista.'] });
    const b = part('5B', '5B · Deadlifts y walking lunges', { capMinutes: 4, notes: ['Tiempo manual independiente de 5A.', '20 m completos de lunges = 1 rep.'] });
    ['Atleta A', 'Atleta B', 'Atleta libre'].forEach((athletes, i) => {
      add(a, 'Run', 1, { athletes, round: i + 1, unit: 'vueltas', buttonLabel: 'Vuelta completada' });
      add(b, `${open ? '1' : '2'} DB Deadlift`, level === 'rx' ? 15 : 20, { athletes, round: i + 1 });
      add(b, `${open ? '1' : '2'} DB Walking Lunges`, 1, { athletes, round: i + 1, unit: 'tramos', buttonLabel: '20 m completados', note: 'Solo cuenta el tramo completo de 20 m.' });
    });
  } else if (wodId === '5') {
    const p = part('5', open ? 'WOD 5 · Comba, cajón y deadlift' : 'WOD 5 · Gimnásticos');
    if (open) {
      p.notes.push('Rotación libre, sin obligación de rotar.');
      add(p, 'Single Unders', 100); add(p, 'Box Jump Over', 75);
      add(p, 'Synchro Deadlift', 50, { athletes: '2 atletas sincronizados', note: '100/70 kg' });
      add(p, 'Box Jump Over', 75); add(p, 'Single Unders', 100);
    } else {
      p.notes.push('Cada tramo HSW de 4 m y el giro valen 1 rep. HSPU: 8 reps por atleta.');
      for (let round = 1; round <= 4; round++) {
        const athletes = round === 1 ? 'A + B' : round === 2 ? 'C + D' : 'Pareja libre';
        for (let athlete = 1; athlete <= 2; athlete++) {
          for (const step of ['4 m de ida', 'Giro', '4 m de vuelta']) add(p, `Handstand Walk · ${step}`, 1, { round, athletes: `${athletes} · atleta ${athlete}`, unit: 'tramos', buttonLabel: step === 'Giro' ? 'Giro completado' : '4 m completados' });
        }
        for (let athlete = 1; athlete <= 2; athlete++) add(p, elite ? 'Strict HSPU' : 'HSPU', 8, { round, athletes: `${athletes} · atleta ${athlete}` });
        add(p, 'Synchro Bar Muscle-Up', 8, { round, athletes });
      }
    }
  } else {
    const p = part('final', 'Final · Primero A+B, después C+D', { notes: ['1 complex = 2 snatch + 1 overhead squat. Contar solo complex completos.', ...(open ? ['En C+D, los Pull-Ups son a repartir, no sincronizados.'] : [])] });
    for (let round = 1; round <= 3; round++) {
      const base = { round, athletes: 'A + B' };
      add(p, 'SkiErg', elite ? 12 : open ? 8 : 10, { ...base, unit: 'calorías', buttonLabel: '+1 caloría' });
      add(p, level === 'rx' ? 'HSPU' : 'Strict HSPU', elite ? 12 : open ? 8 : 10, base);
      add(p, open ? 'Synchro Pull-Ups' : 'Synchro Chest to Bar', elite ? 24 : open ? 16 : 20, base);
    }
    for (let round = 4; round <= 6; round++) {
      const base = { round, athletes: 'C + D' };
      add(p, open ? 'Pull-Ups · a repartir' : 'Synchro Chest to Bar', elite ? 18 : 12, base);
      add(p, 'Synchro Bar Complex', 6, { ...base, unit: 'complex', buttonLabel: 'Complex completado', note: `2 snatch + 1 overhead squat · ${elite ? '70/45' : open ? '50/35' : '60/40'} kg` });
    }
  }
  return { ...entry, location: wodId === '5' && teams ? open ? 'Arena' : 'Coliseum' : entry.location, capMinutes, categoryLabel: `${teams ? 'Teams' : `Parejas · ${LABELS[composition]}`} · ${LABELS[level]}`, parts, version: VERSION };
}
