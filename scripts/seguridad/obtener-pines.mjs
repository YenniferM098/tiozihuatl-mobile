// Imprime el hash SHA-256 de la llave pública (SPKI) de cada certificado de la cadena
// de la API, en el formato de <pin digest="SHA-256"> de network_security_config.xml.
// Uso: node scripts/seguridad/obtener-pines.mjs [host]
import { X509Certificate, createHash } from 'node:crypto';
import tls from 'node:tls';

const host = process.argv[2] ?? 'backend-tiozihuatl-h8ig.onrender.com';

const socket = tls.connect({ host, port: 443, servername: host }, () => {
  let cert = socket.getPeerCertificate(true);
  const vistos = new Set();
  let nivel = 0;
  while (cert?.raw && !vistos.has(cert.fingerprint256)) {
    vistos.add(cert.fingerprint256);
    const x509 = new X509Certificate(cert.raw);
    const spki = x509.publicKey.export({ type: 'spki', format: 'der' });
    const pin = createHash('sha256').update(spki).digest('base64');
    const tipo = nivel === 0 ? 'servidor' : x509.issuer === x509.subject ? 'raíz' : 'intermedio';
    console.log(`${tipo.padEnd(10)} ${pin}  ${x509.subject.replace(/\n/g, ', ')}  (vence ${x509.validTo})`);
    cert = cert.issuerCertificate;
    nivel++;
  }
  socket.end();
});
socket.on('error', (error) => {
  console.error(`No fue posible conectar con ${host}: ${error.message}`);
  process.exit(1);
});
