/**
 * URL base de la API institucional desplegada (backend Tiozihuatl).
 * Es el único lugar donde se define: los environments la reexportan como `apiUrl`
 * y los servicios HTTP la leen desde ahí. Se usa igual en `ionic serve`,
 * en el build de Capacitor y en la APK instalada.
 */
export const API_URL = 'https://backend-tiozihuatl-h8ig.onrender.com/api';
