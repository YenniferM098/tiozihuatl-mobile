import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tiozihuatl.app',
  appName: 'IEST',
  webDir: 'www',
  // Fondo del WebView mientras carga la web: azul institucional en vez de negro.
  backgroundColor: '#3fa6e8',
  plugins: {
    // En Android las peticiones HTTP se hacen desde la capa nativa (incluida en @capacitor/core).
    // Así la API institucional no las trata como peticiones de navegador con Origin
    // `https://localhost`, que su lista de CORS no incluye.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
