import React, { createContext, useContext } from 'react';

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

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ colores: coloresWhatsApp }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
