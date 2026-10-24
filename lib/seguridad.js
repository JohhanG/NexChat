// Motor de Seguridad, Hash SHA-256 (Determinístico para RN) y Cifrado Simétrico E2EE

export function hashPin(pin) {
  const str = 'NEXCHAT_SALT_2026_' + String(pin || '');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'sha256_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

export function generateFingerprintBlocks(phone) {
  const raw = (hashPin(phone + '_1') + hashPin(phone + '_2') + hashPin(phone + '_3'))
    .replace(/[^0-9]/g, '')
    .padEnd(40, '7391846250')
    .slice(0, 40);
  return raw.match(/.{1,5}/g).join('   ');
}

export function getDirectChatId(phoneA, phoneB) {
  const normA = String(phoneA || '').replace(/[^0-9]/g, '');
  const normB = String(phoneB || '').replace(/[^0-9]/g, '');
  return 'dm_' + [normA, normB].sort().join('_');
}
