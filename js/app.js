'use strict';
(function(){
  /* ===== 1. Estado y utilidades ===== */
  let sesion = { usuario:null, rol:'invitado', sub:null, nombre:'Invitado' };
  let vista = 'tablero';
  let filtroSubPA = 'Todas';
  const estado = { pi:{}, pa:{}, tab:{} };  // parches cargados/editados (tab = medidores manuales del tablero)
  const SUBS = ['Planeación Local y Presupuesto Participativo','Formación Ciudadana','Organización Social','Unidad Administrativa'];

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const nfNum = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  const nfMill = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  const fmtNum = (n) => (n==null || n===''|| isNaN(n)) ? '—' : nfNum.format(Number(n));
  const fmtMill = (n) => (n==null || isNaN(n)) ? '—' : '$'+nfMill.format(Number(n))+' M';
  // es-CO: la gente escribe coma decimal; normalizamos a punto
  const parseNum = (v) => {
    if (v==null) return null;
    const s = String(v).trim().replace(/\./g,'').replace(',', '.');
    if (s==='') return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
  };

  // valor efectivo: parche (si existe el campo) sobre la base
  const valTexto = (col, fila, campo) => {
    const p = estado[col][fila.id];
    if (p && campo in p) return p[campo];
    return fila[campo];
  };

  // semáforo por porcentaje de cumplimiento
  function colorPct(p){
    if (p==null || isNaN(p)) return ['—','txt-suave',''];
    if (p < 30)  return [nfNum.format(p)+'%','text-red-500','bg-red-500/10'];
    if (p < 70)  return [nfNum.format(p)+'%','text-amber-500','bg-amber-500/10'];
    if (p < 100) return [nfNum.format(p)+'%','text-lime-600 dark:text-lime-400','bg-lime-500/10'];
    if (p <= 110)return [nfNum.format(p)+'%','text-green-600 dark:text-green-400','bg-green-500/10'];
    return [nfNum.format(p)+'%','text-sky-600 dark:text-sky-400','bg-sky-500/10'];
  }

  /* ===== 2. Sesión y roles =====
     No hay pantalla de ingreso: la app abre en modo Invitado (solo lectura).
     El rol se elige en el selector de la barra superior; al escoger un rol con
     permisos se pide la contraseña en un modal (si se cancela, se revierte). */
  const ROL_INVITADO = '__invitado__';
  let claveObjetivo = null;        // clave (nombre) de USUARIOS_DEFAULT por verificar
  let rolAnterior = ROL_INVITADO;  // para revertir el selector si se cancela

  function pintarSelectorRol(){
    const sel = $('#rol-select');
    if (!sel) return;
    const opts = [`<option value="${ROL_INVITADO}">Invitado (solo lectura)</option>`]
      .concat(Object.keys(USUARIOS_DEFAULT).map(n =>
        `<option value="${esc(n)}">${esc(USUARIOS_DEFAULT[n].label || USUARIOS_DEFAULT[n].nombre || n)}</option>`));
    sel.innerHTML = opts.join('');
    sel.onchange = manejarCambioRol;
    actualizarBadges();
  }

  function manejarCambioRol(e){
    const val = e.target.value;
    if (val===ROL_INVITADO){
      aplicarSesion({ rol:'invitado', sub:null, nombre:'Invitado' }, null);
      toast('Modo solo lectura', 'ok');
      return;
    }
    abrirModalClave(val);
  }

  function aplicarSesion(s, usuarioKey){
    sesion = { usuario: usuarioKey || null, rol:s.rol, sub:s.sub, nombre:s.nombre };
    if (sesion.rol==='invitado') sessionStorage.removeItem('sesionPC');
    else sessionStorage.setItem('sesionPC', JSON.stringify(sesion));
    rolAnterior = sesion.usuario || ROL_INVITADO;
    filtroSubPA = sesion.rol==='sub' && sesion.sub ? sesion.sub : 'Todas';
    actualizarBadges();
    render();
  }

  function actualizarBadges(){
    const sel = $('#rol-select');
    if (sel) sel.value = (sesion.rol==='invitado') ? ROL_INVITADO : (sesion.usuario || ROL_INVITADO);
    const bu = $('#badge-user');
    if (bu){
      bu.textContent = sesion.rol==='invitado' ? 'Solo lectura'
        : (sesion.rol==='admin' ? 'Edición total' : 'Edita: '+(sesion.sub||sesion.nombre));
      bu.classList.toggle('opacity-60', sesion.rol==='invitado');
    }
  }

  /* --- Modal de contraseña --- */
  function abrirModalClave(usuarioKey){
    claveObjetivo = usuarioKey;
    const reg = USUARIOS_DEFAULT[usuarioKey];
    $('#modal-rol').textContent = reg ? (reg.label || reg.nombre) : usuarioKey;
    const inp = $('#modal-clave-input');
    inp.type = 'password'; inp.value = '';
    $('#modal-ver-clave').textContent = 'ver';
    $('#modal-error').textContent = '';
    $('#modal-clave').style.display = 'flex';
    setTimeout(()=>inp.focus(), 50);
  }
  function cerrarModalClave(revertir){
    $('#modal-clave').style.display = 'none';
    claveObjetivo = null;
    if (revertir){ const sel=$('#rol-select'); if (sel) sel.value = rolAnterior; }
  }
  function verificarClave(){
    const reg = USUARIOS_DEFAULT[claveObjetivo];
    const c = $('#modal-clave-input').value.trim();
    if (!reg || reg.clave !== c){
      $('#modal-error').textContent = 'Contraseña incorrecta.';
      const inp = $('#modal-clave-input');
      inp.classList.add('ring-2','ring-red-500');
      setTimeout(()=>inp.classList.remove('ring-2','ring-red-500'), 1200);
      return;
    }
    const key = claveObjetivo;
    $('#modal-clave').style.display = 'none';
    claveObjetivo = null;
    aplicarSesion({ rol:reg.rol, sub:reg.sub, nombre:reg.nombre }, key);
    toast('Sesión: '+(reg.label || reg.nombre), 'ok');
  }
  function enlazarModalClave(){
    $('#modal-acceder').onclick = verificarClave;
    $('#modal-cancelar').onclick = () => cerrarModalClave(true);
    $('#modal-ver-clave').onclick = () => {
      const i = $('#modal-clave-input'); i.type = i.type==='password' ? 'text':'password';
      $('#modal-ver-clave').textContent = i.type==='password' ? 'ver':'ocultar';
    };
    $('#modal-clave-input').addEventListener('keydown', e => {
      if (e.key==='Enter') verificarClave();
      else if (e.key==='Escape') cerrarModalClave(true);
    });
    $('#modal-clave').addEventListener('click', e => { if (e.target.id==='modal-clave') cerrarModalClave(true); });
  }

  // Configuración única de la app (visible desde el inicio); idempotente.
  let appLista = false;
  async function iniciarApp(){
    await window.DB.init();
    const bm = $('#badge-modo');
    if (bm){
      bm.classList.remove('hidden');
      if (window.DB.modo==='firebase'){ bm.textContent='● Conectado (Firebase)'; bm.classList.add('text-green-600'); }
      else { bm.textContent='● Modo local (este navegador)'; bm.classList.add('text-amber-500'); }
    }

    filtroSubPA = sesion.rol==='sub' && sesion.sub ? sesion.sub : 'Todas';

    try{
      const datos = await window.DB.cargarTodo();
      estado.pi = datos.pi || {}; estado.pa = datos.pa || {}; estado.tab = datos.tab || {};
    }catch(e){ console.warn(e); }

    if (!appLista){
      appLista = true;
      window.DB.suscribir('pi', m => { estado.pi = m; if (vista==='indicativo' || vista==='tablero') render(); });
      window.DB.suscribir('pa', m => { estado.pa = m; if (vista==='accion' || vista==='tablero') render(); });
      $$('.btn-tab').forEach(b => b.onclick = () => { vista = b.dataset.vista; render(); });
      $('#btn-tema').onclick = alternarTema;
      $('#btn-exportar').onclick = exportarExcel;
      pintarSelectorRol();
      enlazarModalClave();
    }
    actualizarBadges();
    render();
  }

  /* ===== 3. Reglas de edición por rol ===== */
  const EDIT_ADMIN = {
    pi: ['nom','fc','metaPlan','m24','l24','m25','l25','m26','l0204','l3006','obs','evid','lider'],
    pa_bien: ['desc','unidad','plan','ej0204','ej3006','descBPS','justVE','evid'],
    pa_proy: ['desc','pptoIni','pptoAj','ej0204','ej3006'],
  };
  function esEditable(col, fila, campo){
    if (!sesion || sesion.rol==='invitado') return false;
    if (sesion.rol==='admin'){
      if (col==='pi') return EDIT_ADMIN.pi.includes(campo);
      if (col==='pa') return (fila.nivel==='BIEN' ? EDIT_ADMIN.pa_bien : EDIT_ADMIN.pa_proy).includes(campo);
      return false;
    }
    // Subsecretaría: Valor estadístico, Observaciones/Justificación y Evidencias NAS
    if (col==='pi') return campo==='l3006' || campo==='obs' || campo==='evid';
    if (col==='pa') return fila.nivel==='BIEN' && fila.sub===sesion.sub && (campo==='ej3006' || campo==='justVE' || campo==='evid');
    return false;
  }

  /* ===== 4. Render: resumen + filtros ===== */
  function render(){
    $$('.btn-tab').forEach(b => b.classList.toggle('tab-activa', b.dataset.vista===vista));
    if (vista==='tablero'){
      // Tablero: 100% solo lectura; calcula todo desde PI_DATA/PA_DATA + estado.
      // No usa las barras #resumen/#filtros (asumen indicativo/accion): se limpian
      // y se ocultan, y NO se llama enlazarEdicion (el tablero no emite inputs).
      const r = $('#resumen'); if (r){ r.innerHTML = ''; r.classList.add('hidden'); }
      const f = $('#filtros'); if (f){ f.innerHTML = ''; f.classList.add('hidden'); }
      renderTablero();
      return;
    }
    const r = $('#resumen'); if (r) r.classList.remove('hidden');
    const f = $('#filtros'); if (f) f.classList.remove('hidden');
    pintarResumen();
    pintarFiltros();
    if (vista==='indicativo') renderPI(); else renderPA();
    enlazarEdicion();
  }

  function tarjeta(t, v, sub, cls){
    return `<div class="panel borde border rounded-xl px-3.5 py-2.5 anim-up">
      <div class="text-[11px] txt-suave">${esc(t)}</div>
      <div class="text-xl font-bold ${cls||''}">${v}</div>
      ${sub?`<div class="text-[11px] txt-suave">${esc(sub)}</div>`:''}</div>`;
  }

  function pintarResumen(){
    const cont = $('#resumen');
    if (vista==='indicativo'){
      const res = PI_DATA.filter(p=>p.tipo==='Resultado').length;
      const prod = PI_DATA.length - res;
      let con=0, suma=0, n=0;
      PI_DATA.forEach(p => {
        const v = parseNum(valTexto('pi',p,'l3006'));
        if (v!=null){ con++; if (p.m26){ suma += Math.min(v/p.m26*100, 200); n++; } }
      });
      const prom = n? (suma/n):null;
      cont.innerHTML =
        tarjeta('Indicadores', PI_DATA.length, res+' de resultado · '+prod+' de producto') +
        tarjeta('Con valor 30/06', con+'/'+PI_DATA.length, 'reportados este corte', con<PI_DATA.length?'text-amber-500':'text-green-600') +
        tarjeta('% avance promedio', prom==null?'—':nfNum.format(prom)+'%','sobre meta 2026') +
        tarjeta('Corte', '30/06/2026','vigencia 2026');
    } else {
      const biens = PA_DATA.filter(p=>p.nivel==='BIEN');
      const mios = filtroSubPA==='Todas' ? biens : biens.filter(b=>b.sub===filtroSubPA);
      let con=0; mios.forEach(b => { if (parseNum(valTexto('pa',b,'ej3006'))!=null) con++; });
      const proy = new Set(PA_DATA.filter(p=>p.nivel==='Proyecto' && (filtroSubPA==='Todas'||p.sub===filtroSubPA)).map(p=>p.cod)).size;
      cont.innerHTML =
        tarjeta('Proyectos', proy, filtroSubPA==='Todas'?'todas las subsecretarías':filtroSubPA) +
        tarjeta('Productos (bienes)', mios.length, 'a reportar') +
        tarjeta('Con valor 30/06', con+'/'+mios.length, 'capturados', con<mios.length?'text-amber-500':'text-green-600') +
        tarjeta('Corte', '30/06/2026','vigencia 2026');
    }
  }

  function pintarFiltros(){
    const f = $('#filtros');
    if (vista==='accion'){
      const opts = ['Todas', ...SUBS].map(s =>
        `<option value="${esc(s)}" ${s===filtroSubPA?'selected':''}>${s==='Todas'?'Todas las subsecretarías':esc(s)}</option>`).join('');
      f.innerHTML = `
        <span class="text-xs txt-suave">Subsecretaría:</span>
        <select id="f-sub" class="panel borde border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">${opts}</select>
        <select id="f-nivel" class="panel borde border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
          <option value="">Todos los niveles</option>
          <option value="Programa">Solo programas</option>
          <option value="Proyecto">Solo proyectos</option>
          <option value="BIEN">Solo productos</option>
        </select>
        <input id="f-busca" placeholder="Buscar producto o proyecto…" class="panel borde border rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none" />`;
      $('#f-sub').onchange = e => { filtroSubPA = e.target.value; render(); };
      $('#f-nivel').onchange = aplicarFiltrosPA;
      $('#f-busca').oninput = aplicarFiltrosPA;
    } else {
      f.innerHTML = `
        <select id="f-tipo" class="panel borde border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
          <option value="">Todos los indicadores</option>
          <option value="Resultado">Solo resultado</option>
          <option value="Producto">Solo producto</option>
        </select>
        <input id="f-busca" placeholder="Buscar indicador…" class="panel borde border rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none" />`;
      $('#f-tipo').onchange = () => renderPIfiltrado();
      $('#f-busca').oninput = e => filtrarTexto(e.target.value);
    }
  }

  function filtrarTexto(q){
    q = (q||'').toLowerCase().trim();
    $$('#contenido tr[data-busca]').forEach(tr => {
      tr.style.display = !q || tr.dataset.busca.includes(q) ? '' : 'none';
    });
  }

  /* ===== 5. Render: Plan Indicativo ===== */
  function celdaNum(col, fila, campo, extra=''){
    const v = valTexto(col, fila, campo);
    if (esEditable(col, fila, campo)){
      return `<input class="edit edit-num editable-marca" data-col="${col}" data-id="${esc(fila.id)}" data-campo="${campo}" data-num="1" value="${v==null?'':esc(v)}" />`;
    }
    return `<span class="px-1">${fmtNum(v)}</span>`;
  }
  function celdaTxt(col, fila, campo, ph=''){
    const v = valTexto(col, fila, campo);
    if (esEditable(col, fila, campo)){
      return `<textarea rows="1" class="edit editable-marca" data-col="${col}" data-id="${esc(fila.id)}" data-campo="${campo}" placeholder="${esc(ph)}">${esc(v==null?'':v)}</textarea>`;
    }
    return `<span class="px-1 text-[.8rem] txt-suave">${v? esc(v):'—'}</span>`;
  }

  function renderPI(){
    const filas = PI_DATA.map(p => {
      const v = parseNum(valTexto('pi',p,'l3006'));
      const pct = (v!=null && p.m26) ? (v/p.m26*100) : null;
      const [txt,cls,bg] = colorPct(pct);
      const tipoBadge = p.tipo==='Resultado'
        ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-semibold">R</span>'
        : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold">P</span>';
      const busca = (p.cod+' '+p.nom+' '+(p.lider||'')).toLowerCase();
      return `<tr data-busca="${esc(busca)}" data-tipo="${p.tipo}" class="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
        <td class="celda col-fija px-2 py-1.5 text-xs font-mono whitespace-nowrap">${esc(p.cod)}</td>
        <td class="celda px-2 py-1.5 text-xs min-w-[260px] max-w-[420px]">
          <div class="flex items-start gap-1.5">${tipoBadge}<span>${esc(p.nom)}</span></div>
        </td>
        <td class="celda px-2 py-1.5 text-center text-[10px]">${p.fc==='A'?'<span class="text-amber-500" title="Factor clave">★</span>':'<span class="txt-suave">·</span>'}</td>
        <td class="celda px-2 py-1.5 text-right text-xs whitespace-nowrap">${fmtNum(p.m26)}</td>
        <td class="celda px-2 py-1.5 text-right text-xs txt-suave whitespace-nowrap">${fmtNum(p.l0204)}</td>
        <td class="celda px-1 py-1 w-28">${celdaNum('pi',p,'l3006')}</td>
        <td class="celda px-2 py-1.5 text-center"><span id="pct-${esc(p.id)}" class="text-xs font-semibold px-2 py-0.5 rounded ${cls} ${bg}">${txt}</span></td>
        <td class="celda px-1 py-1 min-w-[220px]">${celdaTxt('pi',p,'obs','Observaciones del avance…')}</td>
        <td class="celda px-1 py-1 min-w-[200px]">${celdaTxt('pi',p,'evid','Enlace o ruta NAS…')}</td>
        <td class="celda px-2 py-1.5 text-[11px] txt-suave whitespace-nowrap">${esc(p.lider||'—')}</td>
      </tr>`;
    }).join('');

    const editaTodo = sesion.rol==='admin';
    $('#contenido').innerHTML = `
      <div class="panel borde border rounded-xl overflow-hidden">
        <div class="overflow-x-auto" style="max-height:72vh">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[11px] uppercase tracking-wide" style="background:var(--panel)">
                <th class="celda col-fija px-2 py-2 z-10">Código</th>
                <th class="celda px-2 py-2">Indicador</th>
                <th class="celda px-2 py-2 text-center" title="Factor clave">FC</th>
                <th class="celda px-2 py-2 text-right">Meta 2026</th>
                <th class="celda px-2 py-2 text-right">Logro 30/04</th>
                <th class="celda px-2 py-2 ${'text-blue-600 dark:text-blue-400'}">Valor 30/06 ✎</th>
                <th class="celda px-2 py-2 text-center">% Avance</th>
                <th class="celda px-2 py-2 text-blue-600 dark:text-blue-400">Observaciones ✎</th>
                <th class="celda px-2 py-2 text-blue-600 dark:text-blue-400">Evidencias NAS ✎</th>
                <th class="celda px-2 py-2">Líder</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>
      <p class="text-[11px] txt-suave mt-2">✎ columnas editables${editaTodo?' (como administrador puede editar todas las celdas)':' para su rol'}. El % de avance se calcula automáticamente sobre la meta 2026.</p>`;
  }
  function renderPIfiltrado(){
    const t = $('#f-tipo') ? $('#f-tipo').value : '';
    $$('#contenido tr[data-tipo]').forEach(tr => {
      tr.style.display = (!t || tr.dataset.tipo===t) ? '' : 'none';
    });
  }

  /* ===== 6. Render: Plan de Acción ===== */
  function arbolPA(){
    const prog = [];
    let curProg=null, curProy=null;
    PA_DATA.forEach(f => {
      if (f.nivel==='Programa'){ curProg={...f, proyectos:[]}; prog.push(curProg); curProy=null; }
      else if (f.nivel==='Proyecto'){ curProy={...f, productos:[]}; if(curProg) curProg.proyectos.push(curProy); }
      else if (f.nivel==='BIEN'){ if(curProy) curProy.productos.push(f); }
    });
    return prog;
  }

  function badgeSub(s){
    const colores = {
      'Planeación Local y Presupuesto Participativo':'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
      'Formación Ciudadana':'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      'Organización Social':'bg-orange-500/15 text-orange-600 dark:text-orange-300',
      'Unidad Administrativa':'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    };
    const corto = { 'Planeación Local y Presupuesto Participativo':'Planeación Local y PP','Formación Ciudadana':'Formación Ciudadana','Organización Social':'Organización Social','Unidad Administrativa':'Unidad Administrativa' };
    return `<span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${colores[s]||'bg-slate-500/15'}">${esc(corto[s]||s||'—')}</span>`;
  }

  function badgeNivel(n){
    const m = {
      'Programa':'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      'Proyecto':'bg-slate-500/20 text-slate-700 dark:text-slate-200',
      'BIEN':'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    };
    const txt = n==='BIEN' ? 'Producto' : n;
    return `<span class="text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${m[n]||'bg-slate-500/15'}">${esc(txt)}</span>`;
  }

  // Plan de Acción como una sola tabla plana (Programa › Proyecto › Producto)
  function renderPA(){
    const prog = arbolPA();
    const filas = [];
    prog.forEach(pr => {
      const proyectos = pr.proyectos.filter(p => filtroSubPA==='Todas' || p.sub===filtroSubPA);
      if (!proyectos.length) return;
      filas.push(filaPA_prog(pr, proyectos.length));
      proyectos.forEach(py => {
        filas.push(filaPA_proy(py));
        py.productos.forEach(b => filas.push(filaPA_bien(b)));
      });
    });

    const cuerpo = filas.join('') ||
      `<tr><td colspan="12" class="celda px-3 py-6 text-center txt-suave">No hay registros para el filtro seleccionado.</td></tr>`;

    $('#contenido').innerHTML = `
      <div class="panel borde border rounded-xl overflow-hidden">
        <div class="overflow-x-auto" style="max-height:72vh">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[11px] uppercase tracking-wide" style="background:var(--panel)">
                <th class="celda px-2 py-2">Nivel</th>
                <th class="celda px-2 py-2">Código</th>
                <th class="celda px-2 py-2">Descripción / Producto</th>
                <th class="celda px-2 py-2">Subsec.</th>
                <th class="celda px-2 py-2">Unidad</th>
                <th class="celda px-2 py-2 text-right">Planeada</th>
                <th class="celda px-2 py-2 text-right">Ejec. 30/04</th>
                <th class="celda px-2 py-2 text-blue-600 dark:text-blue-400">Valor 30/06 ✎</th>
                <th class="celda px-2 py-2 text-center">Eficacia</th>
                <th class="celda px-2 py-2 text-right">Ppto aj. (M)</th>
                <th class="celda px-2 py-2 text-blue-600 dark:text-blue-400">Justificación / Obs. ✎</th>
                <th class="celda px-2 py-2 text-blue-600 dark:text-blue-400">Evidencias NAS ✎</th>
              </tr>
            </thead>
            <tbody>${cuerpo}</tbody>
          </table>
        </div>
      </div>
      <p class="text-[11px] txt-suave mt-2">✎ columnas editables. La eficacia se calcula automáticamente (Valor 30/06 ÷ Planeada). Valores <b>&lt;30%</b> o <b>&gt;100%</b> requieren justificación. ${sesion.rol==='sub'?'Solo puede editar los productos de <b>'+esc(sesion.sub)+'</b>.':''}</p>`;
  }

  // Fila de Programa: encabezado de sección dentro de la tabla
  function filaPA_prog(pr, nProy){
    const busca = (pr.cod+' '+pr.desc).toLowerCase();
    return `<tr data-busca="${esc(busca)}" data-nivel="Programa" class="bg-blue-500/[.06]">
      <td class="celda px-2 py-2">${badgeNivel('Programa')}</td>
      <td class="celda px-2 py-2 text-xs font-mono whitespace-nowrap font-semibold">${esc(pr.cod)}</td>
      <td class="celda px-2 py-2 text-sm font-semibold" colspan="7">${esc(pr.desc)} <span class="txt-suave font-normal text-[11px]">· ${nProy} proyecto(s)</span></td>
      <td class="celda px-2 py-2 text-right text-xs whitespace-nowrap font-semibold">${fmtMill(pr.pptoAj)}</td>
      <td class="celda px-2 py-2"></td>
      <td class="celda px-2 py-2"></td>
    </tr>`;
  }

  // Fila de Proyecto: subtotal de presupuesto y % de ejecución presupuestal
  function filaPA_proy(py){
    const pa = parseNum(valTexto('pa',py,'pptoAj')) ?? py.pptoAj;
    const ej = parseNum(valTexto('pa',py,'ej3006')) ?? py.ej3006;
    const pejec = (pa && ej!=null) ? (ej/pa*100) : null;
    const [ptxt,pcls,pbg] = colorPct(pejec);
    const busca = (py.cod+' '+py.desc+' '+(py.sub||'')).toLowerCase();
    return `<tr data-busca="${esc(busca)}" data-nivel="Proyecto" class="bg-black/[.02] dark:bg-white/[.04]">
      <td class="celda px-2 py-1.5">${badgeNivel('Proyecto')}</td>
      <td class="celda px-2 py-1.5 text-xs font-mono whitespace-nowrap">${esc(py.cod)}</td>
      <td class="celda px-2 py-1.5 text-sm" colspan="6">
        <span class="font-medium">${esc(py.desc)}</span>
        <span class="ml-1 align-middle">${badgeSub(py.sub)}</span>
      </td>
      <td class="celda px-2 py-1.5 text-center"><span class="text-[11px] font-semibold px-2 py-0.5 rounded ${pcls} ${pbg}" title="Ejecución presupuestal 30/06">${ptxt}</span></td>
      <td class="celda px-2 py-1.5 text-right text-xs whitespace-nowrap font-medium">${fmtMill(py.pptoAj)}</td>
      <td class="celda px-2 py-1.5"></td>
      <td class="celda px-2 py-1.5"></td>
    </tr>`;
  }

  // Fila de Producto (BIEN): celdas editables de Valor 30/06 y Justificación
  function filaPA_bien(b){
    const v = parseNum(valTexto('pa',b,'ej3006'));
    const plan = parseNum(valTexto('pa',b,'plan')) ?? b.plan;
    const ef = (v!=null && plan) ? (v/plan*100) : null;
    const [txt,cls,bg] = colorPct(ef);
    const requiere = (ef!=null && (ef<30 || ef>100));
    const propio = sesion.rol==='admin' || b.sub===sesion.sub;
    const busca = (b.cod+' '+b.desc+' '+(b.descBPS||'')+' '+(b.sub||'')).toLowerCase();
    return `<tr data-busca="${esc(busca)}" data-nivel="BIEN" class="hover:bg-black/[.02] dark:hover:bg-white/[.03] ${propio?'':'opacity-90'}">
      <td class="celda px-2 py-1.5">${badgeNivel('BIEN')}</td>
      <td class="celda px-2 py-1.5 text-[10px] font-mono whitespace-nowrap">${esc(b.cod)}</td>
      <td class="celda px-2 py-1.5 text-xs min-w-[230px] max-w-[360px]">
        <div class="font-medium">${esc(b.desc)}</div>
        ${b.descBPS?`<div class="text-[10px] txt-suave mt-0.5 line-clamp-2" title="${esc(b.descBPS)}">${esc(b.descBPS)}</div>`:''}
      </td>
      <td class="celda px-2 py-1.5">${badgeSub(b.sub)}</td>
      <td class="celda px-2 py-1.5 text-[11px] whitespace-nowrap">${esc(b.unidad||'—')}</td>
      <td class="celda px-2 py-1.5 text-right text-xs whitespace-nowrap">${fmtNum(b.plan)}</td>
      <td class="celda px-2 py-1.5 text-right text-xs txt-suave whitespace-nowrap">${fmtNum(b.ej0204)}</td>
      <td class="celda px-1 py-1 w-28">${celdaNum('pa',b,'ej3006')}</td>
      <td class="celda px-2 py-1.5 text-center">
        <span id="pct-${esc(b.id)}" class="text-xs font-semibold px-2 py-0.5 rounded ${cls} ${bg}">${txt}</span>
        ${requiere?`<div id="req-${esc(b.id)}" class="text-[9px] text-red-500 mt-0.5">justificar</div>`:`<div id="req-${esc(b.id)}"></div>`}
      </td>
      <td class="celda px-2 py-1.5"></td>
      <td class="celda px-1 py-1 min-w-[220px]">${celdaTxt('pa',b,'justVE','Justificación del valor…')}</td>
      <td class="celda px-1 py-1 min-w-[200px]">${celdaTxt('pa',b,'evid','Enlace o ruta NAS…')}</td>
    </tr>`;
  }

  // Filtros combinados (nivel + texto) para la tabla del Plan de Acción
  function aplicarFiltrosPA(){
    const niv = $('#f-nivel') ? $('#f-nivel').value : '';
    const q = ($('#f-busca') ? $('#f-busca').value : '').toLowerCase().trim();
    $$('#contenido tr[data-busca]').forEach(tr => {
      const okNiv = !niv || tr.dataset.nivel===niv;
      const okQ = !q || (tr.dataset.busca||'').includes(q);
      tr.style.display = (okNiv && okQ) ? '' : 'none';
    });
  }

  /* ===== 6.b Render: Tablero (dashboard ejecutivo, solo lectura) =====
     Se calcula 100% desde PI_DATA/PA_DATA + parches en vivo (estado.pi/estado.pa)
     leídos vía valTexto. No emite inputs/textarea ni atributos data-campo:
     enlazarEdicion() nunca corre en esta vista. Respeta el tema con variables CSS
     (--panel/--texto/--suave/--borde/--acento) y las mismas clases de colorPct. */
  function renderTablero(){
    // Helper numérico-seguro: NO usar parseNum aquí. La base ya trae números
    // (0.468, 62.7) y parseNum borraría el punto (0.468 -> 468). numTab devuelve
    // el number tal cual si ya es number, y solo parsea cadenas es-CO de parches.
    const numTab = (v) => {
      if (v==null || v==='') return null;
      if (typeof v==='number') return isNaN(v) ? null : v;
      const s = String(v).trim().replace(/\./g,'').replace(',', '.').trim();
      if (s==='') return null;
      const n = Number(s);
      return isNaN(n) ? null : n;
    };
    const pctSeguro = (v, base) => (v!=null && base!=null && base!==0) ? (v/base*100) : null;
    const valPI  = (p) => { const l3 = numTab(valTexto('pi',p,'l3006')); return l3!=null ? l3 : numTab(valTexto('pi',p,'l0204')); };
    // Patch-aware: un 0 REPORTADO por el usuario (parche en estado.pa con el campo
    // 'ej3006' presente) se respeta; solo el 0 placeholder de la base cae a abril.
    const valBIEN= (b) => {
      const parch = estado.pa[b.id] && ('ej3006' in estado.pa[b.id]);
      const e3 = numTab(valTexto('pa',b,'ej3006'));
      if (parch && e3!=null) return e3;
      if (e3!=null && e3>0) return e3;
      return numTab(valTexto('pa',b,'ej0204'));
    };
    const reduce = (typeof window!=='undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const pct1 = (p) => (p==null || isNaN(p)) ? '—' : nfNum.format(p)+'%';

    /* ---- Agregados (todos con numTab; división protegida) ---- */
    const totalPI = PI_DATA.length;
    const res = PI_DATA.filter(p=>p.tipo==='Resultado').length;
    const prod = totalPI - res;

    let captura=0, s26=0, n26=0;
    const catCount = [0,0,0,0,0]; // <30, 30-70, 70-100, 100-110, >110
    const filasPI = PI_DATA.map(p => {
      if (numTab(valTexto('pi',p,'l3006'))!=null) captura++;
      const v = valPI(p), m = numTab(p.m26);
      const pct = pctSeguro(v, m);
      if (pct!=null){ s26 += Math.min(pct,200); n26++;
        if (pct<30) catCount[0]++; else if (pct<70) catCount[1]++;
        else if (pct<100) catCount[2]++; else if (pct<=110) catCount[3]++; else catCount[4]++; }
      return { cod:p.cod, nom:p.nom, tipo:p.tipo, pct };
    });
    const avance2026 = n26 ? s26/n26 : null;
    const reportados = totalPI ? captura/totalPI*100 : 0;

    // 2024 / 2025 (sin cap; usan logros oficiales anuales)
    const promAnio = (campoL, campoM) => {
      let s=0,n=0; PI_DATA.forEach(p => { const l=numTab(p[campoL]), m=numTab(p[campoM]); const pc=pctSeguro(l,m); if(pc!=null){s+=pc;n++;} });
      return n ? s/n : null;
    };
    const meta2024 = promAnio('l24','m24');
    const meta2025 = promAnio('l25','m25');

    // Conteos de contexto para KPIs y ranking de productos
    const proyectos = PA_DATA.filter(f=>f.nivel==='Proyecto');
    const biens = PA_DATA.filter(f=>f.nivel==='BIEN');
    // Cumplimiento por producto (BIEN) con fallback a ej0204 — alimenta el ranking "Productos"
    const filasPA = biens.map(b => {
      const v = valBIEN(b), plan = numTab(valTexto('pa',b,'plan'));
      return { cod:b.cod, nom:b.desc, sub:b.sub, pct: pctSeguro(v, plan) };
    });

    // Medidores de gestión de CAPTURA MANUAL: los escribe el Equipo de Contratación.
    // Se guardan como un parche en la colección 'tab' (doc 'gestion'). En modo local
    // viven en este navegador; con Firebase se compartirían entre usuarios.
    const gestion = (estado.tab && estado.tab['gestion']) || {};
    const valGestion = (campo) => (campo in gestion) ? numTab(gestion[campo]) : null;
    const ejecFin = valGestion('ejecFin');
    const ejecFis = valGestion('ejecFis');
    const ponderadoFF = valGestion('ff');
    const puedeEditarTab = !!(sesion && sesion.rol==='admin');   // solo Equipo de Contratación

    /* ---- Pieza: KPI (mismo patrón visual que tarjeta()) ----
       Acepta clsCard extra para concatenar clases en el ÚNICO atributo class del
       literal. NO inyectar un segundo class= por extraAttr: el parser HTML lo
       descartaría y perdería, p. ej., el foco accesible de .tb-kpi-captura. */
    const kpi = (t, v, sub, cls, clsCard='', extraAttr='') => `
      <div class="tb-card panel borde border rounded-xl px-3.5 py-2.5 anim-up ${clsCard}" ${extraAttr}>
        <div class="text-[11px] txt-suave uppercase tracking-wide">${esc(t)}</div>
        <div class="text-xl sm:text-2xl font-bold tabular-nums ${cls||''}">${v}</div>
        ${sub?`<div class="text-[11px] txt-suave mt-0.5">${esc(sub)}</div>`:''}
      </div>`;
    const kpisHTML = `
      <div id="tb-kpis" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        ${kpi('Indicadores', String(totalPI), res+' de resultado · '+prod+' de producto')}
        ${kpi('Productos', String(biens.length), 'bienes en '+proyectos.length+' proyectos')}
        ${kpi('Captura 30/06', captura+'/'+totalPI, 'indicadores reportados', (captura<totalPI?'text-amber-500':'text-green-600 dark:text-green-400'), 'tb-kpi-captura', 'id="tb-kpi-captura" role="link" tabindex="0" title="Ir al ranking" style="cursor:pointer"')}
      </div>`;

    /* ---- Pieza: Gauge semicircular SVG (fluido con viewBox) ----
       opts.campo => medidor de captura manual (colección 'tab'); si el rol es
       Equipo de Contratación, se muestra un input para escribir el porcentaje. */
    const gauge = (titulo, pctVal, aria, opts) => {
      opts = opts || {};
      const c = colorPct(pctVal);
      const clsTxt = (pctVal==null) ? 'txt-suave' : c[1];
      const R = 80, LEN = Math.PI*R;
      const frac = (pctVal==null) ? 0 : Math.max(0, Math.min(1, pctVal/100));
      const offInicial = reduce ? LEN*(1-frac) : LEN;
      const offFinal = LEN*(1-frac);
      const path = `M 20 100 A ${R} ${R} 0 0 1 180 100`;
      const label = pct1(pctVal);
      const idAttr = opts.campo ? `id="tb-g-${esc(opts.campo)}" data-aria="${esc(aria)}"` : '';
      // Editor SOLO para admin. Usa data-gauge (no data-campo) para no chocar con
      // enlazarEdicion(), que además no corre en la vista tablero.
      const editor = (opts.campo && puedeEditarTab) ? `
          <div class="mt-1 flex items-center justify-center gap-1">
            <input type="text" inputmode="decimal" autocomplete="off" placeholder="—" aria-label="Editar ${esc(aria)} en porcentaje"
                   class="tb-gedit panel borde border rounded-md px-2 py-0.5 text-xs text-right tabular-nums" style="width:76px"
                   data-gauge="${esc(opts.campo)}" value="${pctVal==null?'':esc(nfNum.format(pctVal))}" />
            <span class="text-[11px] txt-suave">%</span>
          </div>` : '';
      const marca = (opts.campo && puedeEditarTab) ? ' <span class="tb-editmark" title="Editable por el Equipo de Contratación">✎</span>' : '';
      return `
        <div class="tb-gauge flex flex-col items-center anim-pop" ${idAttr}>
          <svg viewBox="0 0 200 118" style="width:100%;max-width:150px" role="img" aria-label="${esc(aria)}: ${esc(label)}">
            <path d="${path}" fill="none" stroke="var(--suave)" stroke-opacity=".2" stroke-width="14" stroke-linecap="round" aria-hidden="true"/>
            <path class="tb-arc ${clsTxt}" d="${path}" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round"
                  stroke-dasharray="${LEN.toFixed(2)}" stroke-dashoffset="${offInicial.toFixed(2)}" data-off="${offFinal.toFixed(2)}" data-len="${LEN.toFixed(2)}" aria-hidden="true"/>
            <text class="tb-gnum ${clsTxt}" x="100" y="92" text-anchor="middle" fill="currentColor" font-size="30" font-weight="700" style="font-variant-numeric:tabular-nums">${esc(label)}</text>
          </svg>
          <div class="text-[11px] txt-suave text-center mt-0.5 leading-tight">${esc(titulo)}${marca}</div>
          ${editor}
        </div>`;
    };
    const gaugesHTML = `
      <div class="tb-card panel borde border rounded-xl p-3 lg:col-span-2 anim-up">
        <div class="text-sm font-bold mb-2">Medidores clave del corte</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          ${gauge('Avance meta 2026', avance2026, 'Avance meta 2026')}
          ${gauge('Reportados 30/06', reportados, 'Indicadores reportados')}
          ${gauge('Ejec. financiera', ejecFin, 'Ejecución financiera', {campo:'ejecFin'})}
          ${gauge('Ejec. física', ejecFis, 'Ejecución física', {campo:'ejecFis'})}
          ${gauge('Índice físico-financiero', ponderadoFF, 'Índice físico-financiero', {campo:'ff'})}
        </div>
        <p class="text-[11px] txt-suave mt-2">Avance y reportados se calculan de los ${totalPI} indicadores. La ejecución financiera, la física y el índice físico-financiero ${puedeEditarTab?'los registra usted (Equipo de Contratación) en las casillas de cada medidor':'los registra el Equipo de Contratación'}.</p>
      </div>`;

    /* ---- Pieza: Dona de categorías (SVG stroke-dasharray) ---- */
    const CATS = [
      { nom:'Crítico (<30%)',        c:catCount[0], cls:'text-red-500',                     stroke:'#ef4444' },
      { nom:'Bajo (30-70%)',         c:catCount[1], cls:'text-amber-500',                   stroke:'#f59e0b' },
      { nom:'En avance (70-100%)',   c:catCount[2], cls:'text-lime-600 dark:text-lime-400', stroke:'#84cc16' },
      { nom:'Cumplido (100-110%)',   c:catCount[3], cls:'text-green-600 dark:text-green-400',stroke:'#22c55e' },
      { nom:'Sobrecumplido (>110%)', c:catCount[4], cls:'text-sky-600 dark:text-sky-400',   stroke:'#0ea5e9' },
    ];
    const clasificados = CATS.reduce((a,x)=>a+x.c,0) || 1;
    const RD = 60, CIRC = 2*Math.PI*RD;
    let acum = 0;
    // Segmentos aria-hidden: el <svg> contenedor ya es role="img" con aria-label,
    // y la leyenda de botones aporta el detalle accesible (evita role="img" anidado).
    const segs = CATS.filter(x=>x.c>0).map(x => {
      const frac = x.c/clasificados;
      const len = CIRC*frac;
      const gap = CIRC - len;
      const dashoffset = reduce ? (-acum) : CIRC;
      const seg = `<circle class="tb-seg" cx="90" cy="90" r="${RD}" fill="none" stroke="${x.stroke}" stroke-width="20"
        stroke-dasharray="${len.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${dashoffset.toFixed(2)}"
        data-off="${(-acum).toFixed(2)}" transform="rotate(-90 90 90)" aria-hidden="true"></circle>`;
      acum += len;
      return seg;
    }).join('');
    const leyendaDona = CATS.map(x => `
      <button type="button" class="tb-leg flex items-center gap-2 w-full text-left rounded-lg px-2 py-1 hover:bg-black/[.02] dark:hover:bg-white/[.03] focus:outline-none" data-cat="${esc(x.nom)}" aria-pressed="false">
        <span class="inline-block h-3 w-3 rounded-sm shrink-0" style="background:${x.stroke}" aria-hidden="true"></span>
        <span class="text-[11px] flex-1 ${x.cls}">${esc(x.nom)}</span>
        <span class="text-[11px] tabular-nums txt-suave">${x.c} · ${nfNum.format(x.c/clasificados*100)}%</span>
      </button>`).join('');
    const donaHTML = `
      <div id="tb-dona" class="tb-card panel borde border rounded-xl p-3 lg:col-span-1 anim-up">
        <div class="text-sm font-bold mb-2">Indicadores por categoría de avance</div>
        <div class="flex items-center gap-3">
          <svg viewBox="0 0 180 180" style="width:44%;max-width:150px" role="img" aria-label="Distribución de ${clasificados} indicadores clasificados por categoría de avance">
            <circle cx="90" cy="90" r="${RD}" fill="none" stroke="var(--suave)" stroke-opacity=".15" stroke-width="20" aria-hidden="true"></circle>
            ${segs}
            <text x="90" y="86" text-anchor="middle" fill="currentColor" font-size="34" font-weight="700" style="font-variant-numeric:tabular-nums">${clasificados}</text>
            <text x="90" y="108" text-anchor="middle" fill="var(--suave)" font-size="13">clasificados</text>
          </svg>
          <div class="flex-1 space-y-0.5">${leyendaDona}</div>
        </div>
        <p class="text-[10px] txt-suave mt-1">Clic en una categoría para filtrar el ranking.${clasificados<totalPI?' '+(totalPI-clasificados)+' sin dato clasificable.':''}</p>
      </div>`;

    /* ---- Pieza: Metas por vigencia ---- */
    const barraMeta = (anio, val) => {
      const c = colorPct(val);
      const w = (val==null) ? 0 : Math.max(0, Math.min(100, val));
      return `
        <div class="mb-2.5">
          <div class="flex items-baseline justify-between text-xs mb-1">
            <span class="font-semibold">${anio}</span>
            <span class="tabular-nums ${c[1]}">${esc(pct1(val))}</span>
          </div>
          <div class="w-full h-3 rounded-full overflow-hidden" style="background:color-mix(in srgb, var(--suave) 18%, transparent)" role="img" aria-label="Cumplimiento ${anio}: ${esc(pct1(val))}">
            <div class="tb-meta h-full rounded-full ${c[1]}" style="width:${reduce?w.toFixed(2):'0'}%;background:currentColor" data-w="${w.toFixed(2)}"></div>
          </div>
        </div>`;
    };
    const metasHTML = `
      <div id="tb-metas" class="tb-card panel borde border rounded-xl p-3 anim-up">
        <div class="text-sm font-bold mb-2">Cumplimiento por vigencia</div>
        ${barraMeta(2024, meta2024)}
        ${barraMeta(2025, meta2025)}
        ${barraMeta(2026, avance2026)}
        <p class="text-[11px] txt-suave mt-1">2024 y 2025 pueden superar 100% porque varios logros superaron su meta anual (p. ej. 3.2.7: l25=54,39 vs. m25=39,5). 2026 es corte parcial al 30/06.</p>
      </div>`;

    /* ---- Pieza: Ranking con toggle PI / PA ---- */
    const filaRank = (r) => {
      const c = colorPct(r.pct);
      const w = (r.pct==null) ? 0 : Math.max(0, Math.min(100, r.pct));
      return `
        <div class="tb-rrow flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-black/[.02] dark:hover:bg-white/[.03]">
          <span class="text-[10px] font-mono txt-suave w-16 shrink-0 whitespace-nowrap">${esc(r.cod)}</span>
          <span class="text-[11px] flex-1 min-w-0 truncate" title="${esc(r.nom)}">${esc(r.nom)}</span>
          <span class="hidden sm:block w-24 shrink-0"><span class="block h-2 rounded-full ${c[1]}" style="width:${reduce?w.toFixed(1):'0'}%;background:currentColor" data-w="${w.toFixed(1)}"></span></span>
          <span class="tb-chip text-[11px] font-semibold px-2 py-0.5 rounded ${c[1]} ${c[2]} tabular-nums w-16 text-center shrink-0">${c[0]}</span>
        </div>`;
    };
    const ordPI = filasPI.filter(r=>r.pct!=null).sort((a,b)=>b.pct-a.pct);
    const ordPA = filasPA.filter(r=>r.pct!=null).sort((a,b)=>b.pct-a.pct);
    const rankingHTML = `
      <div id="tb-ranking" class="tb-card panel borde border rounded-xl p-3 anim-up scroll-mt-24">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div class="text-sm font-bold">Ranking de cumplimiento</div>
          <div class="flex items-center gap-1" role="group" aria-label="Fuente del ranking">
            <button type="button" id="tb-tg-pi" class="tb-toggle text-[11px] px-3 py-1.5 rounded-lg borde border font-medium tab-activa" aria-pressed="true" style="min-height:40px">Indicadores</button>
            <button type="button" id="tb-tg-pa" class="tb-toggle text-[11px] px-3 py-1.5 rounded-lg borde border font-medium" aria-pressed="false" style="min-height:40px">Productos</button>
          </div>
        </div>
        <div class="flex items-center gap-2 mb-2 text-[11px]">
          <label class="txt-suave" for="tb-topn">Mostrar:</label>
          <select id="tb-topn" class="panel borde border rounded-lg px-2 py-1.5 text-[11px] focus:outline-none" style="min-height:40px">
            <option value="all">Todos</option>
            <option value="top5">Top 5</option>
            <option value="top10">Top 10</option>
            <option value="bot5">Bottom 5</option>
            <option value="bot10">Bottom 10</option>
          </select>
          <span id="tb-rank-count" class="txt-suave ml-auto"></span>
        </div>
        <div id="tb-rank-list" class="overflow-y-auto pr-1" style="max-height:60vh"></div>
      </div>`;

    /* ---- Ensamblado en #contenido (orden = orden de lectura) ---- */
    $('#contenido').innerHTML = `
      <div class="space-y-3">
        ${kpisHTML}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          ${gaugesHTML}
          ${donaHTML}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${metasHTML}
          ${rankingHTML}
        </div>
      </div>`;

    /* ---- Estado local del ranking (NO toca filtroSubPA global) ---- */
    let rkFuente = 'pi';        // 'pi' | 'pa'
    let rkTopN = 'all';
    let rkCat = null;           // filtro por categoría desde la dona (solo aplica a 'pi')

    const enCat = (pct) => {
      if (rkCat==null) return true;
      if (pct==null) return false;
      const idx = pct<30?0 : pct<70?1 : pct<100?2 : pct<=110?3 : 4;
      return CATS[idx] && CATS[idx].nom===rkCat;
    };
    function pintarRanking(){
      const base = (rkFuente==='pi') ? ordPI : ordPA;
      let lista = (rkFuente==='pi') ? base.filter(r=>enCat(r.pct)) : base.slice();
      if (rkTopN==='top5') lista = lista.slice(0,5);
      else if (rkTopN==='top10') lista = lista.slice(0,10);
      else if (rkTopN==='bot5') lista = lista.slice(-5).reverse();
      else if (rkTopN==='bot10') lista = lista.slice(-10).reverse();
      const cont = $('#tb-rank-list');
      if (cont){
        cont.classList.remove('anim-fade'); void cont.offsetWidth; cont.classList.add('anim-fade');
        cont.innerHTML = lista.length ? lista.map(filaRank).join('')
          : `<div class="text-[11px] txt-suave px-2 py-3 text-center">Sin registros para el filtro.</div>`;
      }
      const cnt = $('#tb-rank-count');
      // El sufijo de categoría solo se muestra en fuente 'pi' (enCat no filtra 'pa'),
      // evitando anunciar un filtro que no está aplicado sobre productos.
      if (cnt) cnt.textContent = lista.length + (rkFuente==='pi' ? ' indicadores' : ' productos') + ((rkCat && rkFuente==='pi')?(' · '+rkCat):'');
      if (!reduce && typeof requestAnimationFrame==='function') requestAnimationFrame(animarBarras);
    }

    /* ---- Animaciones de entrada (respetan prefers-reduced-motion) ---- */
    function animarBarras(){
      if (reduce) return;
      $$('#contenido .tb-arc').forEach(el => { const o=el.getAttribute('data-off'); if(o!=null) el.style.strokeDashoffset=o; });
      $$('#contenido .tb-seg').forEach(el => { const o=el.getAttribute('data-off'); if(o!=null) el.style.strokeDashoffset=o; });
      $$('#contenido .tb-bseg, #contenido .tb-meta, #tb-rank-list [data-w]').forEach(el => { const w=el.getAttribute('data-w'); if(w!=null) el.style.width=w+'%'; });
    }

    /* ---- Enganche de controles LOCALES (re-hechos tras cada render) ---- */
    const bPI = $('#tb-tg-pi'), bPA = $('#tb-tg-pa');
    if (bPI && bPA){
      const setTog = (f) => {
        rkFuente = f;
        // Al pasar a 'pa' el filtro por categoría (solo aplicable a 'pi') se limpia
        // para no dejar un sufijo/estado de leyenda engañoso en el contador.
        if (f==='pa' && rkCat!=null){
          rkCat = null;
          $$('#tb-dona .tb-leg').forEach(b => { b.classList.remove('tb-leg-on'); b.setAttribute('aria-pressed','false'); });
        }
        bPI.classList.toggle('tab-activa', f==='pi'); bPI.setAttribute('aria-pressed', String(f==='pi'));
        bPA.classList.toggle('tab-activa', f==='pa'); bPA.setAttribute('aria-pressed', String(f==='pa'));
        pintarRanking();
      };
      bPI.onclick = () => setTog('pi');
      bPA.onclick = () => setTog('pa');
    }
    const selN = $('#tb-topn');
    if (selN) selN.onchange = (e) => { rkTopN = e.target.value; pintarRanking(); };
    $$('#tb-dona .tb-leg').forEach(btn => {
      btn.onclick = () => {
        const cat = btn.getAttribute('data-cat');
        rkCat = (rkCat===cat) ? null : cat;
        if (rkFuente!=='pi'){ rkFuente='pi'; if(bPI&&bPA){ bPI.classList.add('tab-activa'); bPI.setAttribute('aria-pressed','true'); bPA.classList.remove('tab-activa'); bPA.setAttribute('aria-pressed','false'); } }
        $$('#tb-dona .tb-leg').forEach(b => { const on = (b===btn && rkCat!=null); b.classList.toggle('tb-leg-on', on); b.setAttribute('aria-pressed', String(on)); });
        pintarRanking();
      };
    });
    const capEl = $('#tb-kpi-captura');
    if (capEl){
      const irRanking = () => { const t=$('#tb-ranking'); if(t) t.scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'}); };
      capEl.onclick = irRanking;
      capEl.onkeydown = (e) => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); irRanking(); } };
    }

    /* ---- Medidores manuales (Equipo de Contratación): guarda y redibuja en sitio ---- */
    function refrescarGauge(campo){
      const v = valGestion(campo);
      const wrap = $('#tb-g-'+campo); if (!wrap) return;
      const arc = wrap.querySelector('.tb-arc'), num = wrap.querySelector('.tb-gnum'), svg = wrap.querySelector('svg');
      const clsTxt = (v==null) ? 'txt-suave' : colorPct(v)[1];
      const LEN = parseFloat(arc && arc.getAttribute('data-len')) || Math.PI*80;
      const frac = (v==null) ? 0 : Math.max(0, Math.min(1, v/100));
      if (arc){ arc.setAttribute('class','tb-arc '+clsTxt); arc.style.strokeDashoffset = (LEN*(1-frac)).toFixed(2); }
      if (num){ num.setAttribute('class','tb-gnum '+clsTxt); num.textContent = pct1(v); }
      if (svg){ svg.setAttribute('aria-label', (wrap.dataset.aria||'')+': '+pct1(v)); }
    }
    $$('#contenido input[data-gauge]').forEach(inp => {
      inp.addEventListener('change', () => {
        const campo = inp.dataset.gauge, v = numTab(inp.value);
        estado.tab = estado.tab || {};
        if (!estado.tab['gestion']) estado.tab['gestion'] = gestion;   // enlaza el objeto local a estado
        gestion[campo] = v; gestion._por = sesion.nombre; gestion._fecha = Date.now();
        refrescarGauge(campo);
        window.DB.guardar('tab','gestion', { [campo]: v, _por: gestion._por, _fecha: gestion._fecha })
          .then(()=>toast('Guardado','ok')).catch(()=>toast('No se pudo guardar','err'));
      });
    });

    pintarRanking();
    if (!reduce && typeof requestAnimationFrame==='function') requestAnimationFrame(() => requestAnimationFrame(animarBarras));
  }

  /* ===== 7. Edición y guardado ===== */
  function enlazarEdicion(){
    // recálculo en vivo de % al escribir un valor
    $$('input[data-num="1"]').forEach(inp => {
      inp.addEventListener('input', () => recalcFila(inp));
      inp.addEventListener('change', () => guardarCampo(inp));
    });
    // textareas autoajustables + guardado
    $$('textarea[data-campo]').forEach(t => {
      autoAltura(t);
      t.addEventListener('input', () => autoAltura(t));
      t.addEventListener('change', () => guardarCampo(t));
    });
    // inputs de texto no numéricos del admin (nom, lider, unidad, desc, descBPS)
    $$('input[data-campo]:not([data-num])').forEach(inp => {
      inp.addEventListener('change', () => guardarCampo(inp));
    });
  }
  function autoAltura(t){ t.style.height='auto'; t.style.height=(t.scrollHeight+2)+'px'; }

  function recalcFila(inp){
    const col = inp.dataset.col, id = inp.dataset.id, campo = inp.dataset.campo;
    const fila = (col==='pi') ? PI_DATA.find(x=>x.id===id) : PA_DATA.find(x=>x.id===id);
    if (!fila) return;
    const v = parseNum(inp.value);
    let base, pct;
    if (col==='pi'){ base = fila.m26; pct = (v!=null && base) ? v/base*100 : null; }
    else { base = parseNum(valTexto('pa',fila,'plan')) ?? fila.plan; pct = (v!=null && base) ? v/base*100 : null; }
    const span = $('#pct-'+CSS.escape(id));
    if (span){
      const [txt,cls,bg] = colorPct(pct);
      span.className = 'text-xs font-semibold px-2 py-0.5 rounded '+cls+' '+bg;
      span.textContent = txt;
    }
    const req = $('#req-'+CSS.escape(id));
    if (req){ req.innerHTML = (pct!=null && (pct<30||pct>100)) ? '<span class="text-[9px] text-red-500">justificar</span>' : ''; }
  }

  async function guardarCampo(el){
    const col = el.dataset.col, id = el.dataset.id, campo = el.dataset.campo;
    const esNum = el.dataset.num==='1';
    let valor = esNum ? parseNum(el.value) : el.value;
    estado[col][id] = Object.assign({}, estado[col][id], { [campo]: valor, _por: sesion.nombre, _fecha: Date.now() });
    try{
      await window.DB.guardar(col, id, { [campo]: valor, _por: sesion.nombre, _fecha: Date.now() });
      toast('Guardado', 'ok');
    }catch(e){ toast('No se pudo guardar', 'err'); }
    // si fue el valor, refrescar resumen
    if (campo==='l3006' || campo==='ej3006') pintarResumen();
  }

  /* ===== 8. Exportar a Excel (plan B: CSV) ===== */
  function datosPIparaExport(){
    const filas = [['Código','Indicador','Tipo','FC','Meta Plan','Meta 2024','Logro 2024','Meta 2025','Logro 2025','Meta 2026','Logro 30/04/2026','Valor 30/06/2026','% Avance','Observaciones','Evidencias NAS','Líder']];
    PI_DATA.forEach(p => {
      const v = parseNum(valTexto('pi',p,'l3006'));
      const pct = (v!=null && p.m26) ? +(v/p.m26*100).toFixed(2) : '';
      filas.push([p.cod,p.nom,p.tipo,p.fc, p.metaPlan,p.m24,p.l24,p.m25,p.l25,p.m26, p.l0204, (v==null?'':v), pct, valTexto('pi',p,'obs')||'', valTexto('pi',p,'evid')||'', p.lider||'']);
    });
    return filas;
  }
  function datosPAparaExport(){
    const filas = [['Nivel','Código','Descripción','Subsecretaría','Unidad','Cant. Planeada','Ejec. 30/04','Valor 30/06','Eficacia %','Ppto Ajustado (M)','Justificación/Obs.','Evidencias NAS']];
    PA_DATA.forEach(f => {
      if (f.nivel==='BIEN'){
        const v = parseNum(valTexto('pa',f,'ej3006'));
        const plan = f.plan;
        const ef = (v!=null && plan)? +(v/plan*100).toFixed(2):'';
        filas.push([f.nivel,f.cod,f.desc,f.sub,f.unidad,f.plan,f.ej0204,(v==null?'':v),ef,'',valTexto('pa',f,'justVE')||'',valTexto('pa',f,'evid')||'']);
      } else if (['Pilar','Componente','Programa','Proyecto'].includes(f.nivel)){
        filas.push([f.nivel,f.cod,f.desc,f.sub||'', '','','','','', (f.pptoAj!=null?f.pptoAj:''),'','']);
      }
    });
    return filas;
  }
  function exportarExcel(){
    const piF = datosPIparaExport();
    const paF = datosPAparaExport();
    const fecha = new Date().toISOString().slice(0,10);
    if (typeof XLSX !== 'undefined'){
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(piF);
      const ws2 = XLSX.utils.aoa_to_sheet(paF);
      // anchos básicos
      ws1['!cols'] = [{wch:10},{wch:48},{wch:11},{wch:5},{wch:10},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:12},{wch:12},{wch:9},{wch:40},{wch:30},{wch:24}];
      ws2['!cols'] = [{wch:11},{wch:10},{wch:46},{wch:24},{wch:10},{wch:11},{wch:10},{wch:11},{wch:9},{wch:14},{wch:44},{wch:30}];
      // encabezados en negrita
      [ws1,ws2].forEach(ws => {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let c=range.s.c;c<=range.e.c;c++){
          const ref = XLSX.utils.encode_cell({r:0,c});
          if (ws[ref]) ws[ref].s = { font:{bold:true,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'1D4ED8'}}, alignment:{wrapText:true,vertical:'center'} };
        }
      });
      XLSX.utils.book_append_sheet(wb, ws1, 'Plan Indicativo');
      XLSX.utils.book_append_sheet(wb, ws2, 'Plan de Acción');
      XLSX.writeFile(wb, 'Seguimiento_ParticipacionCiudadana_'+fecha+'.xlsx');
      toast('Excel generado', 'ok');
    } else {
      // Plan B: CSV
      const aCSV = (m) => m.map(r => r.map(c => '"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\n');
      descargar('PlanIndicativo_'+fecha+'.csv', '\ufeff'+aCSV(piF));
      descargar('PlanAccion_'+fecha+'.csv', '\ufeff'+aCSV(paF));
      toast('Excel no disponible: se exportó CSV', 'ok');
    }
  }
  function descargar(nombre, contenido){
    const blob = new Blob([contenido], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  /* ===== 9. Misceláneos ===== */
  function alternarTema(){
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('tema', dark?'dark':'light');
  }
  function toast(msg, tipo){
    const d = document.createElement('div');
    d.className = 'toast '+(tipo||'');
    d.textContent = msg;
    $('#toasts').appendChild(d);
    setTimeout(()=>{ d.style.opacity='0'; setTimeout(()=>d.remove(), 250); }, 1600);
  }

  // volver arriba
  const arriba = $('#arriba');
  window.addEventListener('scroll', () => { arriba.classList.toggle('ver', window.scrollY>320); });
  arriba.onclick = () => window.scrollTo({top:0, behavior:'smooth'});

  /* ===== Arranque ===== */
  let arrancado = false;
  async function arranque(){
    if (arrancado) return; arrancado = true;   // arranque() se invoca por DOMContentLoaded y por el chequeo inmediato
    // tema guardado
    if (localStorage.getItem('tema')==='dark') document.documentElement.classList.add('dark');
    // sesión persistida (rol con permisos) o Invitado por defecto
    const guardada = sessionStorage.getItem('sesionPC');
    if (guardada){ try{ const s = JSON.parse(guardada); if (s && s.rol) sesion = s; }catch(e){} }
    await iniciarApp();
  }
  window.addEventListener('DOMContentLoaded', arranque);
  // por si DOMContentLoaded ya pasó (scripts defer)
  if (document.readyState!=='loading') arranque();
})();
