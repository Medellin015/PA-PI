'use strict';
(function(){
  const LS_KEY = 'segPC_datos_v1';

  const leerLocal = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{"pi":{},"pa":{}}'); }
    catch(e){ return {pi:{}, pa:{}}; }
  };
  const escribirLocal = (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch(e){} };

  const DB = {
    modo: 'local',

    async init(){
      const ok = await window.authReady;
      this.modo = ok ? 'firebase' : 'local';
      return this.modo;
    },

    // Devuelve { pi:{id:parche}, pa:{id:parche} }
    async cargarTodo(){
      if (this.modo === 'firebase'){
        const res = {pi:{}, pa:{}};
        for (const col of ['pi','pa']){
          try{
            const snap = await window.db.collection('seg_'+col).get();
            snap.forEach(doc => { res[col][doc.id] = doc.data(); });
          }catch(e){ console.warn('Lectura '+col+' falló:', e); }
        }
        return res;
      }
      return leerLocal();
    },

    // Guarda (merge) un parche para una fila
    async guardar(col, id, parche){
      if (this.modo === 'firebase'){
        try{
          await window.db.collection('seg_'+col).doc(id).set(parche, {merge:true});
          enviarPowerAutomate(col, id, parche);
          return true;
        }catch(e){ console.warn('Guardado Firestore falló, respaldo local:', e); }
      }
      // Respaldo / modo local
      const d = leerLocal();
      d[col] = d[col] || {};
      d[col][id] = Object.assign({}, d[col][id], parche);
      escribirLocal(d);
      enviarPowerAutomate(col, id, parche);
      return true;
    },

    // Suscripción en tiempo real (solo Firebase); en local no aplica.
    suscribir(col, cb){
      if (this.modo === 'firebase'){
        try{
          return window.db.collection('seg_'+col).onSnapshot(snap => {
            const m = {}; snap.forEach(doc => m[doc.id] = doc.data()); cb(m);
          });
        }catch(e){ console.warn('Suscripción falló:', e); }
      }
      return () => {};
    }
  };

  // Envío opcional a Power Automate (text/plain evita preflight CORS).
  function enviarPowerAutomate(col, id, parche){
    const url = window.POWER_AUTOMATE_URL;
    if (!url) return; // sin URL configurada -> no-op
    try{
      fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain' },
        body: JSON.stringify({ coleccion:col, id, parche, fecha:new Date().toISOString() })
      }).catch(()=>{});
    }catch(e){}
  }

  window.DB = DB;
})();
