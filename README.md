# Willy — Portafolio (web + app)

Sitio y aplicación instalable (PWA) de portafolio para un editor de video. Hecho con **Next.js 16**, **Supabase** (base de datos, inicio de sesión y almacenamiento de videos) y **GSAP + Lenis** para las animaciones.

## Qué incluye
- **Sitio público**: portada estilo referencia (resplandor naranja, foto/video 3D que se inclina con el mouse o con el giro del teléfono), brasas interactivas que responden a **varios punteros a la vez** (multitáctil), showreel con reproducción automática, portafolio con filtros y **vista previa de video al pasar el mouse** (o al desplazarse en el celular), página propia por video, proceso, testimonios, contacto.
- **Panel admin** (`/admin`): subir videos con barra de progreso, miniatura automática, detección de formato vertical/horizontal, destacar, ocultar, reordenar y borrar; editar perfil, foto 3D, cifras, redes; testimonios; bandeja de mensajes.
- **App instalable**: manifiesto, íconos y modo pantalla completa en el celular.

## Seguridad
- Solo **un correo** puede administrar: se exige en el servidor (`ADMIN_EMAIL`) **y** en la base de datos (tabla `admin_users` + políticas RLS). Aunque alguien cree una cuenta o llame a la API directo, no puede escribir nada.
- Los archivos solo los puede subir/borrar el admin (políticas de Storage). Tipos y tamaño limitados (máx. 50 MB).
- Protección CSRF (rechaza peticiones de otros sitios), cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.), validación con zod en cada acción.
- Formulario de contacto con trampa anti-bots y límite de 3 mensajes cada 15 min por IP (la IP se guarda cifrada con hash).
- El panel no se indexa en buscadores y no se guarda en caché.

## Puesta en marcha
1. Crea un proyecto en Supabase y ejecuta `supabase/migrations/001_portafolio.sql`.
2. Agrega tu correo de admin: `insert into public.admin_users (email) values ('tu@correo.com');`
3. En Supabase → Authentication: crea tu usuario con contraseña y **desactiva los registros públicos** (Allow new users to sign up = off).
4. Copia `.env.example` a `.env.local` y completa las variables (las mismas van en Vercel).
5. `npm install` y `npm run dev` → http://localhost:3000

Sin Supabase configurado el sitio igual funciona con el contenido por defecto; el panel muestra un aviso.
