# Proa del Plata

Batalla naval en el Río de la Plata, 1814. Patriotas contra realistas, en 3D y con estética de animé de barcos, con los vigías Chirola y Bermúdez que comentan cada tiro.

**Jugar:** https://robertozapata-has.github.io/proa-del-plata/

- **Online con un amigo:** se comparte un link por WhatsApp (PeerJS, sin servidor propio).
- **Contra la compu:** cinco rangos, de Grumete a Almirante.
- **Poderes:** cada barco tiene uno (andanada, bengala, sondaleza, fuego cruzado, mina flotante).
- **Combate nocturno:** las marcas de agua se borran, los fuegos se ven y los barcos tocados pueden maniobrar.
- Se instala en el celular como una app.

## Archivos

- `index.html`: pantalla y estilos.
- `js/reglas.js`: reglas, mapas y flota. Todo el estado sale del registro de jugadas.
- `js/ia.js`: la compu.
- `js/escena.js`: el río en 3D (agua con reflejos y cielo real), las animaciones y el hundimiento de película.
- `js/vigias.js`: las viñetas de historieta de los vigías. Las caras van en `vigias/`.
- `js/barcos.js`: carga los barcos de `modelos/barcos.glb` y les pone banderas y texturas (si el archivo no llega, los arma con código).
- `herramientas/barcos_blender.py`: genera los cinco barcos en Blender (`pip install bpy`, después `python3 herramientas/barcos_blender.py modelos/barcos.glb`).
- `arte/`: la ilustración y el logo de la portada (Canva). `texturas/`: madera y lona (Gemini).
- `js/sonido.js`: sonidos generados con código.
- `js/red.js`: la conexión online por link.
- `sw.js`: para que se pueda instalar y abrir sin internet. Cambiar `VERSION` en cada publicación.
