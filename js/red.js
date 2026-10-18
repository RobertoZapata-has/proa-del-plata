// Proa del Plata · juego online por link (PeerJS, el mismo sistema que Jaque de Piedra y Mal Agüero)
const PREFIJO = 'proa-plata-v1-';
const params = new URLSearchParams(location.search);

function opciones() {
  const o = { debug: 0 };
  if (params.get('peerhost')) Object.assign(o, { host: params.get('peerhost'), port: +params.get('peerport') || 9000, path: '/', secure: false });
  return o;
}
export const extraLink = () => params.get('peerhost') ? `&peerhost=${params.get('peerhost')}&peerport=${params.get('peerport') || 9000}` : '';

export function nuevaSala() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = '';
  const r = crypto.getRandomValues(new Uint32Array(6));
  for (let i = 0; i < 6; i++) s += a[r[i] % a.length];
  return s;
}

export function crearRed({ sala, rol, alMensaje, alEstado, alConectar, tok = null, aceptar = () => true }) {
  let peer = null, conn = null, conectado = false, vivo = true, reintento = null, abrir = null;
  const pendientes = [];
  const estado = (txt, ok = false) => alEstado && alEstado(txt, ok);

  function enviar(d) {
    if (conn && conn.open) { try { conn.send(d); return true; } catch (e) {} }
    if (d.t === 'chat') pendientes.push(d);
    return false;
  }
  function enganchar(c) {
    if (conn && conn !== c) { try { conn.close(); } catch (e) {} }
    conn = c;
    c.on('open', () => {
      if (conn !== c) return;
      conectado = true; estado(rol === 'h' ? 'Tu amigo está conectado' : 'Conectado con tu amigo', true);
      while (pendientes.length) c.send(pendientes.shift());
      alConectar && alConectar();
    });
    c.on('data', d => { if (d && d.t) alMensaje(d); });
    c.on('close', () => {
      if (conn !== c) return; conectado = false;
      estado(rol === 'h' ? 'Tu amigo se desconectó… lo espero' : 'Se cortó. Reconectando…');
      if (rol === 'g') setTimeout(conectarAlAnfitrion, 2500);
    });
    c.on('error', e => console.warn('conn', e));
  }
  function crearPeer(id) {
    if (!window.Peer) { estado('No cargó el módulo online (¿sin internet?)'); return null; }
    const p = id ? new Peer(id, opciones()) : new Peer(opciones());
    p.on('disconnected', () => { if (!p.destroyed && vivo) { estado('Reconectando al servidor…'); setTimeout(() => { if (!p.destroyed && p.disconnected) p.reconnect(); }, 1500); } });
    return p;
  }
  function iniciarAnfitrion() {
    peer = crearPeer(PREFIJO + sala); if (!peer) return;
    estado('Abriendo la sala…');
    peer.on('open', () => { if (!conectado) estado('Esperando a tu amigo…'); });
    peer.on('connection', c => {
      // la sala queda atada al primer invitado: un link reenviado no le saca el lugar
      if (!aceptar(c.metadata && c.metadata.tok)) {
        c.on('open', () => { try { c.send({ t: 'ocupada' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 1500); });
        return;
      }
      enganchar(c);
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { estado('Recuperando la sala…'); peer.destroy(); setTimeout(() => vivo && iniciarAnfitrion(), 3000); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) estado('Sin conexión al servidor, reintento…');
      else console.warn(e);
    });
  }
  function iniciarInvitado() {
    peer = crearPeer(null); if (!peer) return;
    estado('Conectando…');
    peer.on('open', conectarAlAnfitrion);
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') { estado('Esperando que tu amigo abra la partida…'); clearTimeout(reintento); reintento = setTimeout(conectarAlAnfitrion, 4000); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) estado('Sin conexión al servidor, reintento…');
      else console.warn(e);
    });
  }
  function conectarAlAnfitrion() {
    if (!vivo || !peer || peer.destroyed) return;
    if (peer.disconnected) { peer.reconnect(); return; }
    if (conn && conn.open) return;
    const c = peer.connect(PREFIJO + sala, { reliable: true, metadata: { tok } }); enganchar(c);
    clearTimeout(abrir);
    abrir = setTimeout(() => { if (conn === c && !c.open) { estado('No conecta todavía, reintento…'); try { c.close(); } catch (e) {} conectarAlAnfitrion(); } }, 12000);
  }
  const alVolver = () => {
    if (document.visibilityState !== 'visible' || !peer || peer.destroyed) return;
    if (peer.disconnected) peer.reconnect();
    if (rol === 'g' && !(conn && conn.open)) conectarAlAnfitrion();
    if (conn && conn.open) alConectar && alConectar();
  };
  document.addEventListener('visibilitychange', alVolver);

  if (rol === 'h') iniciarAnfitrion(); else iniciarInvitado();

  return {
    enviar,
    get conectado() { return conectado; },
    cerrar() { vivo = false; document.removeEventListener('visibilitychange', alVolver); try { peer && peer.destroy(); } catch (e) {} },
  };
}
