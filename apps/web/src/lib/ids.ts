const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function newId(prefix = 'el') {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${s}`;
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
