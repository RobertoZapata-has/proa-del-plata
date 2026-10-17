# Proa del Plata

Batalla naval en el Río de la Plata, 1814. Patriotas contra realistas, en 3D y pintada al óleo.

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
- `js/escena.js`: el río en 3D, el filtro de óleo, las animaciones.
- `js/barcos.js`: los barcos, hechos con código.
- `js/sonido.js`: sonidos generados con código.
- `js/red.js`: la conexión online por link.
- `sw.js`: para que se pueda instalar y abrir sin internet. Cambiar `VERSION` en cada publicación.
