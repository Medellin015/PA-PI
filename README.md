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

## Cómo usarla

1. Abrir `index.html` en el navegador (doble clic) o publicarla en cualquier
   hosting estático.
2. Seleccionar el usuario, escribir la contraseña y pulsar **Ingresar**.

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

## Conectar Firebase (opcional)

Para compartir datos entre usuarios, pegue su configuración real en
`js/firebase-config.js` (objeto `firebaseConfig`). Mientras tenga los valores de
ejemplo `PEGUE_…`, la app sigue en modo local.

## Nota sobre un error corregido

En la versión anterior, el bloque de comentario que antecedía a la capa de datos
se cerraba con `*/` en lugar de `-->`, dejando el comentario HTML abierto. Eso
"tragaba" el `<script>` que define `window.DB`, por lo que **al ingresar con la
contraseña correcta la aplicación fallaba** (`window.DB` quedaba `undefined`) y la
pantalla de ingreso no avanzaba. Al separar el código en archivos `.js` reales el
problema desaparece.
