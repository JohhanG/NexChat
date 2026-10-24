import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const coloresWhatsApp = {
  fondo: '#0E1621',
  panel: '#17212B',
  header: '#17212B',
  input: '#242F3D',
  primario: '#00A884',
  primarioOscuro: '#008069',
  burbujaMia: '#005C4B',
  burbujaOtro: '#182533',
  texto: '#F5F5F5',
  textoSecundario: '#8A9AA9',
  borde: '#232E3C',
  peligro: '#EF4444',
  leidoAzul: '#53BDEB',
};

const darkColors = {
  bg: '#0E1621',           // Fondo profundo estilo Telegram Dark
  card: '#17212B',         // Tarjetas elevadas elegantes
  headerBg: '#17212B',     // Barra superior limpia y moderna
  tabBar: '#17212B',       // Barra inferior uniforme
  inputBg: '#242F3D',      // Campos de entrada suaves
  primary: '#00A884',      // Verde esmeralda oficial WhatsApp
  accent: '#38BDF8',       // Azul celeste Telegram para detalles
  text: '#F8FAFC',         // Texto blanco nítido
  textMuted: '#8A9AA9',    // Subtítulos gris azulado
  border: '#232E3C',       // Bordes sutiles
  danger: '#EF4444',       // Rojo alerta moderno
  chatWallpaper: '#0E1621',
  bubbleOut: '#005C4B',
  bubbleIn: '#182533',
  bubbleOutText: '#FFFFFF',
  bubbleInText: '#F8FAFC',
};

const lightColors = {
  bg: '#F1F5F9',
  card: '#FFFFFF',
  headerBg: '#008069',
  tabBar: '#FFFFFF',
  inputBg: '#F1F5F9',
  primary: '#00A884',
  accent: '#0284C7',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
  chatWallpaper: '#EFEAE2',
  bubbleOut: '#D9FDD3',
  bubbleIn: '#FFFFFF',
  bubbleOutText: '#0F172A',
  bubbleInText: '#0F172A',
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => setIsDark((prev) => !prev);
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, colores: coloresWhatsApp, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
