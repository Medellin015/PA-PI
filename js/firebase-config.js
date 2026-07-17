'use strict';

// Configuración del proyecto Firebase (cliente). Es pública por diseño: identifica
// el proyecto, no autoriza nada por sí sola. La seguridad real vive en las reglas
// de Firestore (ver firestore.rules), no en ocultar esta config.
const firebaseConfig = {
  apiKey: "AIzaSyDdu-OxQ62XyXxZcKi87KfiD-e7H_Wud6o",
  authDomain: "pa-pi-80daa.firebaseapp.com",
  projectId: "pa-pi-80daa",
  storageBucket: "pa-pi-80daa.firebasestorage.app",
  messagingSenderId: "246320771954",
  appId: "1:246320771954:web:9fc1148da3f7529571a3eb"
};

window.MODO_FIREBASE = firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf('PEGUE_') === -1;

window.authReady = new Promise((resolve) => {
  if (!window.MODO_FIREBASE) { resolve(false); return; }
  // firebase compat se carga con "defer"; esperamos a que esté disponible.
  const arranca = () => {
    try {
      firebase.initializeApp(firebaseConfig);
      window.db = firebase.firestore();
      window.auth = firebase.auth();
      // Robustez en redes institucionales (proxies / long-polling)
      window.db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
      window.db.enablePersistence({ synchronizeTabs: true })
        .catch(err => console.warn('Persistencia offline no disponible:', err && err.code));
      // Sesión anónima para que las reglas exijan request.auth != null
      window.auth.signInAnonymously()
        .then(() => resolve(true))
        .catch(err => { console.warn('Auth anónima falló, paso a modo local:', err); window.MODO_FIREBASE=false; resolve(false); });
    } catch (e) {
      console.warn('No se pudo iniciar Firebase, modo local:', e);
      window.MODO_FIREBASE = false; resolve(false);
    }
  };
  if (typeof firebase !== 'undefined') arranca();
  else window.addEventListener('load', arranca);
});
