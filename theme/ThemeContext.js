import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const coloresWhatsApp = {
  fondo: '#0b141a',
  panel: '#111b21',
  header: '#202c33',
  input: '#2a3942',
  primario: '#00a884',
  primarioOscuro: '#008069',
  burbujaMia: '#005c4b',
  burbujaOtro: '#202c33',
  texto: '#e9edef',
  textoSecundario: '#8696a0',
  borde: '#222d34',
  peligro: '#ef4444',
  leidoAzul: '#53bdeb',
};

const darkColors = {
  bg: '#0b141a',
  card: '#111b21',
  headerBg: '#075e54',
  tabBar: '#111b21',
  inputBg: '#202c33',
  primary: '#00a884',
  text: '#e9edef',
  textMuted: '#8696a0',
  border: '#222d34',
  danger: '#ef4444',
  chatWallpaper: '#0b141a',
  bubbleOut: '#005c4b',
  bubbleIn: '#202c33',
  bubbleOutText: '#e9edef',
  bubbleInText: '#e9edef',
};

const lightColors = {
  bg: '#f0f2f5',
  card: '#ffffff',
  headerBg: '#008069',
  tabBar: '#ffffff',
  inputBg: '#f0f2f5',
  primary: '#00a884',
  text: '#111b21',
  textMuted: '#667781',
  border: '#e9edef',
  danger: '#ef4444',
  chatWallpaper: '#efeae2',
  bubbleOut: '#d9fdd3',
  bubbleIn: '#ffffff',
  bubbleOutText: '#111b21',
  bubbleInText: '#111b21',
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
