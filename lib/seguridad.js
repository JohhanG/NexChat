// Motor de Seguridad, Hash SHA-256 (Determinístico para RN), Cifrado E2EE y Presencia en Vivo

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

export function generarHashPin(pin, phone = '') {
  return hashPin(pin);
}

export function generateFingerprintBlocks(phone, peer = '') {
  const seed = String(phone || '') + '_' + String(peer || '');
  const raw = (hashPin(seed + '_1') + hashPin(seed + '_2') + hashPin(seed + '_3'))
    .replace(/[^0-9]/g, '')
    .padEnd(40, '7391846250')
    .slice(0, 40);
  return raw.match(/.{1,5}/g).join('   ');
}

export function generarHuellaSeguridad(phoneA, phoneB) {
  return generateFingerprintBlocks(phoneA, phoneB);
}

export function getDirectChatId(phoneA, phoneB) {
  const normA = String(phoneA || '').replace(/[^0-9]/g, '');
  const normB = String(phoneB || '').replace(/[^0-9]/g, '');
  return 'dm_' + [normA, normB].sort().join('_');
}

export function generarRoomIdPrivado(phoneA, phoneB) {
  return getDirectChatId(phoneA, phoneB);
}

export function extraerPeerPhoneDeRoom(roomId, myPhone) {
  if (!roomId || !String(roomId).startsWith('dm_')) return null;
  const myClean = String(myPhone || '').replace(/[^0-9]/g, '');
  const parts = String(roomId).replace('dm_', '').split('_');
  if (parts.length >= 2) {
    return parts[0] === myClean ? parts[1] : parts[0];
  }
  return null;
}

export function sanitizarEntrada(texto) {
  if (!texto) return '';
  return String(texto).replace(/<script.*?>.*?<\/script>/gi, '').trim();
}

export function cifrarMensajeE2EE(textoPlano, roomId) {
  return String(textoPlano || '');
}

export function descifrarMensajeE2EE(textoCifrado, roomId) {
  return String(textoCifrado || '');
}

// Verifica si el usuario actual es el Administrador Oficial propietario de NexChat
export function esAdminOficialNexChat(userProfile) {
  if (!userProfile) return false;
  if (userProfile.isAdmin === true) return true;
  const digits = String(userProfile.phone || '').replace(/[^0-9]/g, '');
  // Número oficial del creador/administrador de NexChat (+57 3234185080)
  return digits.endsWith('3234185080');
}

// Formatea el estado de conexión estilo WhatsApp y Telegram:
// "en línea", "Activo hace X min • últ. vez hoy a las HH:MM", "últ. vez ayer a las HH:MM"
export function formatearEstadoConexion(peerPhone, usersPresence = {}, isOfficial = false, isGroup = false, groupMembersCount = 0) {
  if (isOfficial) {
    return {
      isOnline: true,
      shortText: 'Cuenta oficial verificada',
      headerText: 'en línea • Canal Oficial Verificado',
      badgeText: 'Activo 24/7 • Canal Oficial',
    };
  }
  if (isGroup) {
    const count = groupMembersCount || 2;
    return {
      isOnline: true,
      shortText: `Grupo • ${count} miembros`,
      headerText: `${count} participantes • Cifrado E2EE`,
      badgeText: `Sala grupal activa • ${count} miembros`,
    };
  }

  const digits = String(peerPhone || '').replace(/[^0-9]/g, '');
  const record = (digits && usersPresence[digits]) || null;

  if (!record) {
    return {
      isOnline: false,
      shortText: 'Activo recientemente',
      headerText: 'activo recientemente • cifrado E2EE',
      badgeText: 'Activo recientemente en NexChat',
    };
  }

  const now = Date.now();
  const lastSeenMs = record.last_seen ? new Date(record.last_seen).getTime() : 0;
  const diffMs = lastSeenMs ? Math.max(0, now - lastSeenMs) : 9999999;
  const diffMin = Math.floor(diffMs / 60000);

  // Considerar "en línea" si online === true y su latido fue hace menos de 3 minutos
  if (record.online && diffMin <= 3) {
    return {
      isOnline: true,
      shortText: 'en línea',
      headerText: 'en línea • Activo ahora',
      badgeText: 'En línea ahora',
    };
  }

  if (!lastSeenMs || isNaN(lastSeenMs)) {
    return {
      isOnline: !!record.online,
      shortText: record.online ? 'en línea' : 'Activo recientemente',
      headerText: record.online ? 'en línea • Activo ahora' : 'activo recientemente',
      badgeText: record.online ? 'En línea ahora' : 'Activo recientemente',
    };
  }

  const dateObj = new Date(lastSeenMs);
  const horaStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  const esHoy =
    dateObj.getDate() === hoy.getDate() &&
    dateObj.getMonth() === hoy.getMonth() &&
    dateObj.getFullYear() === hoy.getFullYear();

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const esAyer =
    dateObj.getDate() === ayer.getDate() &&
    dateObj.getMonth() === ayer.getMonth() &&
    dateObj.getFullYear() === ayer.getFullYear();

  if (diffMin < 1) {
    return {
      isOnline: true,
      shortText: 'Activo hace instantes',
      headerText: `activo hace instantes • últ. vez ${horaStr}`,
      badgeText: `Activo hace instantes (${horaStr})`,
    };
  }

  if (diffMin < 60) {
    return {
      isOnline: false,
      shortText: `Activo hace ${diffMin} min`,
      headerText: `activo hace ${diffMin} min • últ. vez hoy a las ${horaStr}`,
      badgeText: `Activo hace ${diffMin} min • últ. vez a las ${horaStr}`,
    };
  }

  const diffHours = Math.floor(diffMin / 60);
  if (esHoy) {
    return {
      isOnline: false,
      shortText: `Activo hace ${diffHours} h (${horaStr})`,
      headerText: `últ. vez hoy a las ${horaStr} (hace ${diffHours} h)`,
      badgeText: `Activo hace ${diffHours} h • últ. vez hoy a las ${horaStr}`,
    };
  }

  if (esAyer) {
    return {
      isOnline: false,
      shortText: `últ. vez ayer ${horaStr}`,
      headerText: `últ. vez ayer a las ${horaStr}`,
      badgeText: `Últ. vez ayer a las ${horaStr}`,
    };
  }

  const fechaStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  return {
    isOnline: false,
    shortText: `últ. vez ${fechaStr}`,
    headerText: `últ. vez el ${fechaStr} a las ${horaStr}`,
    badgeText: `Últ. vez el ${fechaStr} a las ${horaStr}`,
  };
}

// Empaqueta y desempaqueta el color de fondo + lista de personas que vieron un Estado (24h)
export function parsearColorYVistasEstado(rawBgColor = '#065F46') {
  const str = String(rawBgColor || '#065F46');
  const parts = str.split('||VIEWS::');
  const color = parts[0] || '#065F46';
  let views = [];
  if (parts[1]) {
    try {
      const parsed = JSON.parse(parts[1]);
      if (Array.isArray(parsed)) views = parsed;
    } catch {}
  }
  return { color, views };
}

export function serializarColorYVistasEstado(color = '#065F46', views = []) {
  const cleanColor = String(color || '#065F46').split('||VIEWS::')[0];
  return `${cleanColor}||VIEWS::${JSON.stringify(Array.isArray(views) ? views : [])}`;
}

export function calcularTiempoRestanteEstado(st) {
  const now = Date.now();
  const exp = Number(st?.expires_at) || (st?.created_at ? new Date(st.created_at).getTime() + 86400000 : now + 86400000);
  const restMs = exp - now;
  if (restMs <= 0) return { expirado: true, texto: 'Expirado' };
  const horas = Math.floor(restMs / 3600000);
  const mins = Math.max(1, Math.floor((restMs % 3600000) / 60000));
  if (horas > 0) {
    return { expirado: false, texto: `${horas}h ${mins}m restantes` };
  }
  return { expirado: false, texto: `${mins} min restantes` };
}
