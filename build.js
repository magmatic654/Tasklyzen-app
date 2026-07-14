import fs from 'fs';

// Si el archivo ya existe (por ejemplo, en tu computadora local), no lo sobreescribimos
if (fs.existsSync('firebase-env.js')) {
    console.log('firebase-env.js ya existe en local. Omitiendo generación.');
    process.exit(0);
}

// Si no existe (estamos en Netlify), lo generamos usando las variables de entorno
const firebaseConfig = `
window.TASKLYZEN_FIREBASE_CONFIG = {
    apiKey: "${process.env.FIREBASE_API_KEY}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
    projectId: "${process.env.FIREBASE_PROJECT_ID}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${process.env.FIREBASE_APP_ID}",
    measurementId: "${process.env.FIREBASE_MEASUREMENT_ID}"
};
`;

fs.writeFileSync('firebase-env.js', firebaseConfig);
console.log('firebase-env.js generado correctamente para producción!');
