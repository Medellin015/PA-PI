# PA-PI — Seguimiento Plan Indicativo y Plan de Acción

Herramienta interna de captura y seguimiento de la Secretaría de Participación
Ciudadana (Plan Indicativo y Plan de Acción · corte 30/06/2026).

Aplicación 100 % de navegador (HTML + CSS + JavaScript). No necesita compilación
ni servidor: basta con abrir `index.html`. Opcionalmente puede conectarse a
Firebase para compartir los datos entre usuarios; si no se configura, funciona en
**modo local** (guarda en el `localStorage` del navegador).

## Estructura del proyecto

Antes todo el código vivía dentro de un único `index.html`. Ahora está separado:

```
PA-PI/
├── index.html              Estructura de la página (HTML) y enlaces a CSS/JS
├── css/
│   └── estilos.css         Estilos propios (variables de tema, animaciones, tablas…)
└── js/
    ├── datos.js            Datos base: PI_DATA, PA_DATA y USUARIOS_DEFAULT
    ├── firebase-config.js  Configuración opcional de Firebase (window.authReady)
    ├── db.js               Capa de datos: window.DB (Firestore o localStorage)
    └── app.js              Estado e interfaz (login, render, edición, exportar)
```

El orden de carga de los scripts en `index.html` es importante:
`datos.js → firebase-config.js → db.js → app.js`.

## Vistas

La app tiene tres pestañas:

- **📈 Tablero** (vista por defecto): panel ejecutivo de solo lectura que se
  calcula en vivo desde `PI_DATA`/`PA_DATA` y los datos editados. Incluye
  medidores tipo semáforo (avance de meta, reportados, ejecución financiera y
  física, índice físico-financiero), KPIs de presupuesto con barra de ejecución,
  dona de indicadores por categoría de avance, cumplimiento por vigencia y un
  ranking de cumplimiento con conmutador Indicadores/Productos, Top/Bottom y
  filtro por categoría. Se recalcula al editar en las otras vistas.
- **📊 Plan Indicativo** y **📋 Plan de Acción**: captura y edición de datos.

## Cómo usarla

1. Abrir `index.html` en el navegador (doble clic) o publicarla en cualquier
   hosting estático.
2. Abre en modo **Invitado (solo lectura)** en la vista **Tablero**. Para editar,
   elegir un rol en el selector de la barra superior e ingresar su contraseña.

## Roles y contraseñas

**No hay pantalla de ingreso.** La aplicación abre directamente en modo
**Invitado (solo lectura)**. Para editar, se elige un rol en el **selector de la
barra superior**; al escoger un rol con permisos aparece un **modal que pide la
contraseña** (si se cancela o es incorrecta, se mantiene el modo solo lectura).

Definidos en `js/datos.js` (`USUARIOS_DEFAULT`).

| Rol (en el selector)     | Contraseña      | Permisos                                           |
|--------------------------|-----------------|----------------------------------------------------|
| Invitado (solo lectura)  | —               | Solo ver (sin contraseña)                          |
| Equipo de Contratación   | `EquipoContrat` | Edita todo                                         |
| Subsec. Formación        | `Formacion`     | Edita los productos de Formación Ciudadana         |
| Subsec. Organización     | `OrgSocial`     | Edita los productos de Organización Social         |
| Subsec. Planeación       | `LocalPP26`     | Edita los de Planeación Local y PP                 |
| Unidad Administrativa    | `UnidadAdmin`   | Edita los de Unidad Administrativa                 |

La contraseña distingue mayúsculas/minúsculas (se ignoran espacios al inicio/fin).
El rol elegido se recuerda al recargar (mientras dure la pestaña).

> Estas credenciales son del lado del cliente (no son un mecanismo de seguridad
> robusto): cualquiera con acceso al archivo puede leerlas. Cámbielas en
> `js/datos.js` según sea necesario (campo `clave`).

## Firebase (modo compartido)

La app ya trae la configuración del proyecto `pa-pi-80daa` en
`js/firebase-config.js` (es config **de cliente**, pública por diseño). Guarda en
las colecciones `seg_pi`, `seg_pa` y `seg_tab` de Firestore, sobre una sesión
anónima de Firebase. Para que funcione en línea hay que dejar habilitado en la
consola de Firebase (una sola vez):

1. **Firestore Database** → *Crear base de datos* (modo producción, región p. ej.
   `southamerica-east1` o `nam5`).
2. **Authentication** → *Sign-in method* → habilitar **Anónimo**.
3. **Firestore → Reglas** → pegar el contenido de [`firestore.rules`](firestore.rules)
   y *Publicar*.

Si no hay red o Firebase no está disponible, la app **degrada a modo local**
(localStorage) automáticamente, sin romperse.

> **Seguridad:** la config de cliente es pública y va en el repo; eso es
> correcto. En cambio, **el archivo de cuenta de servicio (Admin SDK) es un
> secreto** y NO debe subirse al repositorio ni al navegador (el `.gitignore` ya
> lo bloquea). La app cliente no lo necesita.

## Nota sobre un error corregido

En la versión anterior, el bloque de comentario que antecedía a la capa de datos
se cerraba con `*/` en lugar de `-->`, dejando el comentario HTML abierto. Eso
"tragaba" el `<script>` que define `window.DB`, por lo que **al ingresar con la
contraseña correcta la aplicación fallaba** (`window.DB` quedaba `undefined`) y la
pantalla de ingreso no avanzaba. Al separar el código en archivos `.js` reales el
problema desaparece.
