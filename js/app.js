'use strict';
(function(){
  /* ===== 1. Estado y utilidades ===== */
  let sesion = null;
  let vista = 'indicativo';
  let filtroSubPA = 'Todas';
  const estado = { pi:{}, pa:{} };          // parches cargados/editados
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

  /* ===== 2. Sesión / ingreso ===== */
  function pintarLogin(){
    const sel = $('#in-usuario');
    sel.innerHTML = Object.keys(USUARIOS_DEFAULT).map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    $('#btn-ver-clave').onclick = () => {
      const i = $('#in-clave'); i.type = i.type==='password' ? 'text':'password';
      $('#btn-ver-clave').textContent = i.type==='password' ? 'ver':'ocultar';
    };
    const intentar = () => {
      const u = $('#in-usuario').value;
      // .trim(): evita el fallo de ingreso por espacios al inicio/fin
      // (muy común al copiar/pegar o al autocompletar la contraseña).
      const c = $('#in-clave').value.trim();
      const reg = USUARIOS_DEFAULT[u];
      if (!reg || reg.clave !== c){
        $('#login-error').textContent = 'Usuario o contraseña incorrectos.';
        $('#in-clave').classList.add('ring-2','ring-red-500');
        setTimeout(()=>$('#in-clave').classList.remove('ring-2','ring-red-500'), 1200);
        return;
      }
      sesion = { usuario:u, rol:reg.rol, sub:reg.sub, nombre:reg.nombre };
      sessionStorage.setItem('sesionPC', JSON.stringify(sesion));
      iniciarApp();
    };
    $('#btn-ingresar').onclick = intentar;
    $('#in-clave').addEventListener('keydown', e => { if (e.key==='Enter') intentar(); });
  }

  async function iniciarApp(){
    await window.DB.init();           // idempotente: fija DB.modo aunque el login sea muy rápido
    $('#pantalla-login').classList.add('hidden');
    $('#app').classList.remove('hidden');

    // badge usuario + modo
    $('#badge-user').textContent = sesion.rol==='admin' ? 'Administrador' : (sesion.sub||sesion.nombre);
    const modo = window.DB.modo;
    const bm = $('#badge-modo');
    bm.classList.remove('hidden');
    if (modo==='firebase'){ bm.textContent='● Conectado (Firebase)'; bm.classList.add('text-green-600'); }
    else { bm.textContent='● Modo local (este navegador)'; bm.classList.add('text-amber-500'); }

    // filtro por defecto: la subsecretaría del usuario
    filtroSubPA = sesion.rol==='sub' && sesion.sub ? sesion.sub : 'Todas';

    // cargar parches
    try{
      const datos = await window.DB.cargarTodo();
      estado.pi = datos.pi || {}; estado.pa = datos.pa || {};
    }catch(e){ console.warn(e); }

    // tiempo real (si Firebase)
    window.DB.suscribir('pi', m => { estado.pi = m; if (vista==='indicativo') render(); });
    window.DB.suscribir('pa', m => { estado.pa = m; if (vista==='accion') render(); });

    // pestañas
    $$('.btn-tab').forEach(b => b.onclick = () => { vista = b.dataset.vista; render(); });
    $('#btn-tema').onclick = alternarTema;
    $('#btn-salir').onclick = salir;
    $('#btn-exportar').onclick = exportarExcel;

    render();
  }

  function salir(){
    sessionStorage.removeItem('sesionPC');
    location.reload();
  }

  /* ===== 3. Reglas de edición por rol ===== */
  const EDIT_ADMIN = {
    pi: ['nom','fc','metaPlan','m24','l24','m25','l25','m26','l0204','l3006','obs','evid','lider'],
    pa_bien: ['desc','unidad','plan','ej0204','ej3006','descBPS','justVE','evid'],
    pa_proy: ['desc','pptoIni','pptoAj','ej0204','ej3006'],
  };
  function esEditable(col, fila, campo){
    if (!sesion) return false;
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
    pintarLogin();
    await window.DB.init();
    $('#login-modo').textContent = window.DB.modo==='firebase'
      ? 'Conectado a Firebase: los datos se comparten entre usuarios.'
      : 'Modo local (este navegador). Para compartir datos entre usuarios, configure Firebase en el archivo.';
    // sesión persistida
    const guardada = sessionStorage.getItem('sesionPC');
    if (guardada){ try{ sesion = JSON.parse(guardada); iniciarApp(); }catch(e){} }
  }
  window.addEventListener('DOMContentLoaded', arranque);
  // por si DOMContentLoaded ya pasó (scripts defer)
  if (document.readyState!=='loading') arranque();
})();
