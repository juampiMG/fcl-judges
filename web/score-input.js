export const digitsOnly = value => String(value ?? '').replace(/[^0-9]/g, '');
export function maskTime(value) {
  const digits = digitsOnly(value).slice(0, 6);
  if (digits.length < 2) return digits;
  if (digits.length < 4) return digits.slice(0, 2) + ':' + digits.slice(2);
  return digits.slice(0, 2) + ':' + digits.slice(2, 4) + ':' + digits.slice(4);
}
export function normalizeTime(value) {
  const text = String(value ?? '').trim();
  if (!/^[0-9]{2}:[0-5][0-9](?::[0-9]{0,2})?$/.test(text)) {
    throw new Error('Introduce dos dígitos de minutos y dos de segundos (00–59). Las centésimas deben tener dos dígitos o quedar vacías.');
  }
  const [minutes, seconds, fraction = ''] = text.split(':');
  if (fraction.length === 1) throw new Error('Completa los dos dígitos de centésimas o déjalos vacíos para usar 00.');
  const time = minutes + ':' + seconds + ':' + (fraction || '00');
  if (time === '00:00:00') throw new Error('El tiempo completado debe ser mayor que cero.');
  return time;
}
export function parseQuantity(value) {
  const text = String(value ?? '');
  if (!/^[0-9]{1,5}$/.test(text)) throw new Error('Introduce únicamente números enteros, sin letras, signos ni decimales.');
  return Number(text);
}
