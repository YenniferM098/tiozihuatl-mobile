import { API_URL } from './api.config';

export const environment = {
  production: true,
  // API institucional desplegada (definida en api.config.ts).
  apiUrl: API_URL,
  // Plataforma web institucional (términos, privacidad y seguridad que se aceptan al registrarse).
  webUrl: 'https://frontiozihuatl.netlify.app',
  // Página institucional con el procedimiento para eliminar la cuenta y los datos (derechos ARCO).
  accountDeletionUrl: 'https://sites.google.com/view/iest-tiozihuatl-app/eliminaci%C3%B3n-de-cuenta',
};
