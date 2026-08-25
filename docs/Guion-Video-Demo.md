# Guion del video — Alliance Supply Command

Duración objetivo: **4:50** (máximo permitido: 5:00). Vos leés el texto en voz alta desde este documento (segundo monitor) mientras yo hago clic en la pantalla principal siguiendo la columna "Qué hago yo". No hace falta que sincronicemos por chat: los tiempos ya están calculados para tu ritmo de lectura, con margen.

**Cómo grabamos:** vos activás la grabación de pantalla (Windows: `Win + G` abre el Game Bar → botón de grabar; o el grabador que prefieras) apenas estemos listos, y yo empiezo a ejecutar los clics apenas veas que arrancó. Grabá pantalla completa (no solo una ventana) para que se vea todo con margen.

Si en algún segmento terminás de leer antes de que yo termine de hacer clic, quedate en silencio un segundo, no pasa nada — se ve natural. Si te quedás leyendo y yo ya pasé de pantalla, no te apures: seguí leyendo tranquilo, lo importante es que el audio se entienda bien; después se puede recortar si hace falta.

---

## Segmento 1 — Problema y contexto (0:00 – 0:40)

**Decís:**

> Hola, soy Matías. Esto es Alliance Supply Command, mi Proyecto Final de Máster. Las bases de la Alianza Rebelde necesitaban un sistema para controlar el inventario de piezas, armas y suministros: saber qué stock hay en cada base, cuándo se agota, y quién movió qué. Antes no existía nada de esto, todo se manejaba sin ningún control real.

**Qué hago yo:** dejo la pantalla quieta en la landing/login del sitio (`proyecto-final-conquerblocks-1.onrender.com`).

---

## Segmento 2 — Stack tecnológico (0:40 – 1:15)

**Decís:**

> El backend está hecho con Django y Django REST Framework, con base de datos PostgreSQL. El frontend es una aplicación React que consume esa API mediante JWT. Todo el proyecto está desplegado de forma real: el backend en Render, la base de datos en Neon, y el frontend como sitio estático, también en Render.

**Qué hago yo:** sigo en la misma pantalla (login), sin acción.

---

## Segmento 3 — Login (1:15 – 1:40)

**Decís:**

> Empiezo iniciando sesión como usuario Command, que es el rol con más permisos del sistema. Cada usuario tiene un rol distinto, con permisos distintos sobre qué puede ver y qué puede modificar.

**Qué hago yo:** completo Callsign = `command`, Access Code = la contraseña de demo, y hago clic en "Transmit credentials". Cae en el Dashboard.

---

## Segmento 4 — Dashboard y Componentes (1:40 – 2:15)

**Decís:**

> Esto es el Dashboard. Muestra el valor total del inventario, cuántos componentes están por debajo del mínimo, y los últimos movimientos de stock. Y aquí, en Componentes, está el catálogo completo: cada pieza con su costo, su precio, y su stock mínimo configurado.

**Qué hago yo:** muestro el Dashboard un segundo, después voy a "Components" en el menú lateral y muestro la tabla del catálogo.

---

## Segmento 5 — Crear y despachar una Orden de Despliegue (2:15 – 3:20)

**Decís:**

> Ahora voy a crear una Orden de Despliegue real: es el documento que registra el envío de suministros desde una base hacia un escuadrón. Elijo el escuadrón, la base de origen, el componente, y la cantidad. La creo. Queda en estado Borrador. La confirmo, y pasa a Confirmada. Y ahora la despacho. Al despachar, el sistema descuenta el stock automáticamente, genera un manifiesto en PDF, y deja registrado el movimiento en el historial. Todo esto pasa por la API real de Django, no son datos simulados.

**Qué hago yo (ya ensayado, funciona bien):**
1. Voy a "Deployment Orders".
2. Lleno el formulario: número, escuadrón, base de origen, componente, cantidad.
3. Clic en "Create order" → queda en DRAFT.
4. Clic en "Confirm" → pasa a CONFIRMED.
5. Clic en "Dispatch" → pasa a DISPATCHED, aparece el toast de confirmación y el link al manifiesto PDF.

Este es el segmento más largo — es la demo funcional principal, no hay apuro.

---

## Segmento 6 — Prueba de datos reales (3:20 – 4:00)

**Decís:**

> Si vuelvo a Stock y Ledger, veo que la cantidad de este componente bajó exactamente lo que acabo de despachar, y aparece una nueva fila en el historial de movimientos. Esta es la prueba de que React está mostrando datos reales que vienen del backend en Django, no datos fijos ni de prueba.

**Qué hago yo:** voy a "Stock & Ledger" y muestro la tabla de stock actual (cantidad reducida) y la fila nueva en el ledger, con la fecha/hora de recién.

*(Esto es lo que cubre el punto obligatorio de "ejemplo de React obteniendo/mostrando datos reales del backend": la cantidad cambió porque hubo un POST real a la API de Django, no es un dato hardcodeado.)*

---

## Segmento 7 — Seguridad (4:00 – 4:30)

**Decís:**

> En cuanto a seguridad: la autenticación es con JWT, con expiración corta y renovación de tokens. Las contraseñas están hasheadas, el login tiene límite de intentos, y en producción todo corre bajo HTTPS con los headers de seguridad correspondientes.

**Qué hago yo:** sin acción, o vuelvo al Dashboard como pantalla neutra.

---

## Segmento 8 — Cierre (4:30 – 4:50)

**Decís:**

> Eso es Alliance Supply Command. El código está en GitHub, la aplicación está desplegada y accesible públicamente, y toda la documentación está en la memoria técnica. Gracias.

**Qué hago yo:** pantalla quieta en el Dashboard.

---

## Después de grabar

1. Cortá el video si sobró algo al principio/final (cualquier editor simple sirve, o incluso el recorte nativo de Windows/Fotos).
2. Subilo a Google Drive.
3. Click derecho → Compartir → cambiar a **"Cualquier persona con el enlace"** → copiar el enlace.
4. Ese enlace va en el campo "Evidencia" de la entrega en `academia.conquerblocks.com`, junto con el link del repo de GitHub y la memoria técnica.
