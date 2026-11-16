# Willy — Portafolio de Video Editor

Página de portafolio en un solo archivo (`index.html`), con animaciones de GSAP + ScrollTrigger y desplazamiento suave con Lenis. Las librerías están dentro de `vendor/`, así que no depende de CDNs externos.

## Animaciones incluidas
- Pantalla de carga con contador y salida tipo telón
- Entrada del hero: la foto se revela desde abajo, el título aparece letra por letra y el resplandor rojo crece
- Parallax con el mouse (resplandor, foto y título) y al hacer scroll
- Barra de navegación tipo píldora con indicador que sigue la sección activa
- Botones magnéticos y cursor personalizado (solo en computadora)
- Cinta de texto infinita que reacciona a la velocidad del scroll
- Títulos que aparecen palabra por palabra, contadores, barras de habilidades
- Tarjetas de servicios con inclinación 3D y luz que sigue al mouse
- Línea del proceso que se dibuja con el scroll
- Nombre gigante animado en el pie de página

## Editar el contenido (panel admin)
1. Abre la página y presiona **Ctrl + Shift + A** (o entra a `.../#admin`).
2. Sube tu foto (ideal **PNG sin fondo** para el efecto de la referencia), cambia textos, añade proyectos (link de YouTube, Shorts, Vimeo o .mp4) y testimonios.
3. Los cambios se guardan **solo en tu navegador**. Para que todos los vean: pestaña **Social → Exportar data.json**, y reemplaza el archivo `data.json` de este repositorio con el descargado.

## Ver en local
```bash
python -m http.server 5510
# abre http://localhost:5510
```
