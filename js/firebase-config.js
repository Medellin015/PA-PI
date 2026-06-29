'use strict';

// >>> PEGUE AQUÍ la configuración de su proyecto Firebase para habilitar el modo compartido <<<
const firebaseConfig = {
  apiKey: "PEGUE_SU_API_KEY",
  authDomain: "PEGUE_SU_PROYECTO.firebaseapp.com",
  projectId: "PEGUE_SU_PROYECTO",
  storageBucket: "PEGUE_SU_PROYECTO.appspot.com",
  messagingSenderId: "PEGUE_SENDER_ID",
  appId: "PEGUE_APP_ID"
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
