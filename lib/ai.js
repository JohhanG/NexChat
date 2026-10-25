/**
 * NexAI - Motor Inteligente de Asistente para NexChat
 * Proporciona Resúmenes de Conversación, Traducción en Tiempo Real,
 * Sugerencias de Respuestas y Optimización de Mensajes.
 */

export async function traducirTexto(texto, langDestino = 'es') {
  if (!texto || !texto.trim()) return '';
  const limpio = texto.trim();
  try {
    // Detectar si es español para traducir a inglés o viceversa
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(limpio)}&langpair=autodetect|${langDestino}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.responseData?.translatedText) {
      let resultado = data.responseData.translatedText;
      // Desescapar entidades HTML si hubiera
      resultado = resultado.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      return resultado;
    }
  } catch (e) {
    console.log('Error traduciendo:', e);
  }
  return limpio;
}

export function resumirConversacion(mensajes = [], peerName = 'Contacto') {
  if (!mensajes || mensajes.length === 0) {
    return {
      resumenGeneral: 'Aún no hay suficientes mensajes para generar un resumen.',
      puntosClave: [],
      acuerdos: [],
      preguntasPendientes: [],
      totalAnalizados: 0,
    };
  }

  // Filtrar mensajes de texto significativos (los últimos 25)
  const textos = mensajes
    .slice(-25)
    .filter((m) => m.text && typeof m.text === 'string' && m.text.trim().length > 1);

  if (textos.length === 0) {
    return {
      resumenGeneral: 'La conversación contiene principalmente notas de voz o stickers.',
      puntosClave: ['Se intercambiaron archivos multimedia y stickers.'],
      acuerdos: [],
      preguntasPendientes: [],
      totalAnalizados: 0,
    };
  }

  const puntosClave = [];
  const acuerdos = [];
  const preguntas = [];

  const patronesTiempo = /\b(hoy|mañana|ayer|lunes|martes|miércoles|jueves|viernes|sábado|domingo|semana|tarde|noche|hora|pm|am|a las|quedamos|nos vemos|reunión|cita|llegar|voy)\b/i;
  const patronesDineroOCompromiso = /\b(precio|pago|costo|dólares|pesos|transferir|enviar|listo|confirmado|cuenta|banco|pedido|trabajo)\b/i;

  textos.forEach((m) => {
    const raw = m.text.trim();
    const esPregunta = raw.includes('?') || raw.includes('¿') || /^(cómo|cuándo|dónde|por qué|qué|quién|puedes|tienes)\b/i.test(raw);

    if (esPregunta) {
      if (preguntas.length < 3 && !preguntas.includes(raw)) {
        preguntas.push(raw);
      }
    }

    if (patronesTiempo.test(raw) || patronesDineroOCompromiso.test(raw)) {
      if (acuerdos.length < 3 && !acuerdos.includes(raw)) {
        acuerdos.push(raw);
      }
    }
  });

  // Generar puntos destacados con los últimos temas tratados
  const ultimosMensajes = textos.slice(-4).map((m) => `"${m.text.trim()}"`);
  if (ultimosMensajes.length > 0) {
    puntosClave.push(`Último intercambio: ${ultimosMensajes.join(' ➔ ')}`);
  }

  let resumenGeneral = `Se analizaron ${textos.length} mensajes recientes con ${peerName}.`;
  if (acuerdos.length > 0) {
    resumenGeneral += ` Se detectaron acuerdos o menciones de horarios/citas.`;
  } else if (preguntas.length > 0) {
    resumenGeneral += ` Hay preguntas abiertas pendientes por resolver.`;
  } else {
    resumenGeneral += ` Conversación fluida activa.`;
  }

  return {
    resumenGeneral,
    puntosClave,
    acuerdos,
    preguntasPendientes: preguntas,
    totalAnalizados: textos.length,
  };
}

export function sugerirRespuestasRapidas(ultimoMensaje) {
  if (!ultimoMensaje || !ultimoMensaje.text) {
    return ['¡Hola! ¿Cómo estás?', '¡Listo, confirmado! 👍', 'Te aviso en un momento'];
  }

  const t = ultimoMensaje.text.toLowerCase();

  if (t.includes('hola') || t.includes('buenos') || t.includes('buenas')) {
    return ['¡Hola! ¿Todo bien?', '¡Buenas! ¿Cómo te va?', '¡Hola! ¿Qué tal tu día?'];
  }

  if (t.includes('?') || t.includes('¿') || t.includes('puedes')) {
    return ['¡Sí, claro que sí! 👍', 'Déjame revisar y te confirmo', 'Por ahora no puedo, te escribo luego'];
  }

  if (t.includes('gracias') || t.includes('agradezco')) {
    return ['¡Con mucho gusto! 😊', '¡Para servirte!', '¡De nada, un abrazo!'];
  }

  if (t.includes('donde') || t.includes('dónde')) {
    return ['Ya voy en camino 🚗', 'Estoy en la casa', 'En unos 15 minutos llego'];
  }

  if (t.includes('hora') || t.includes('cuándo') || t.includes('cuando')) {
    return ['A las 4:00 PM me queda perfecto', 'En una hora más o menos', 'Dime a qué hora te queda mejor'];
  }

  return ['¡Excelente, me parece bien! 👍', 'Entendido, muchas gracias', 'Dale, hablamos en un rato'];
}

export function optimizarMensaje(textoOriginal, estilo = 'profesional') {
  if (!textoOriginal || !textoOriginal.trim()) return '';
  const t = textoOriginal.trim();

  switch (estilo) {
    case 'profesional':
      return `Estimado/a, le escribo para comentar lo siguiente: ${t}. Quedo atento a su respuesta.`;
    case 'amable':
      return `¡Hola! Espero que estés muy bien ✨ Te escribía por esto: ${t} ¡Un abrazo!`;
    case 'conciso':
      return t.endsWith('.') ? t : `${t}.`;
    case 'entusiasta':
      return `¡Genial! 🚀 ${t} ¡Vamos con toda! 🔥`;
    default:
      return t;
  }
}
