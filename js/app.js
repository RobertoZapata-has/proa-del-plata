// Proa del Plata · la aplicación (pantallas, turnos, compu y juego online)
import * as R from './reglas.js';
import { elegirJugada, NIVELES } from './ia.js';
import { crearEscena } from './escena.js';
import { Sonido } from './sonido.js';
import { crearRed, nuevaSala, extraLink } from './red.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const leer = (k, def = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const borrar = k => { try { localStorage.removeItem(k); } catch (e) {} };
const esperar = ms => new Promise(r => setTimeout(r, ms));
const bandoDe = q => (q === 'h' ? 'p' : 'r');
const nombreBarco = (q, rol) => R.NOMBRES[bandoDe(q)][rol];
const corto = rol => ({ fragata: 'Fragata', bergantin: 'Bergantín', goleta: 'Goleta', canonera: 'Cañonera', falucho: 'Falucho' })[rol];
const cortoBando = (q, rol) => bandoDe(q) === 'r' ? ({ fragata: 'Corbeta', bergantin: 'Bergantín', goleta: 'Goleta', canonera: 'Balandra', falucho: 'Lancha' })[rol] : corto(rol);
const icono = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const fila = r => r + 1, col = c => R.LETRAS[c];

// ---------- Ajustes ----------
const A = Object.assign({ sonido: true, calidad: 'auto', noche: false, nivel: 'marinero' }, leer('pdp-ajustes', {}));
const guardarAjustes = () => escribir('pdp-ajustes', A);
Sonido.activo = A.sonido;

// ---------- Escena ----------
const esc = crearEscena($('lienzo'));
window.__esc = esc;
esc.setCalidad(A.calidad);

// ---------- Estado ----------
const S = {
  modo: null, yo: 'h', cfg: null, flota: [], log: [], est: null,
  fase: 'portada', listo: false, rivalListo: false,
  nivel: A.nivel, flotaCpu: null,
  sala: null, red: null, pend: null, rivalFlota: null, chat: [], chatNuevo: false, conectado: false,
  poder: null, orient: true, mira: null, sel: null, dir: 1,
  ocupado: false, vista: 'mio',
};
window.__S = S;
const rival = () => R.otro(S.yo);
const nombreRival = () => S.modo === 'cpu' ? 'Romarate' : 'tu amigo';
const NombreRival = () => S.modo === 'cpu' ? 'Romarate' : 'Tu amigo';

function estado() { S.est = R.reconstruir(S.cfg, S.yo, S.flota, S.log); return S.est; }

function guardar() {
  if (S.modo === 'cpu') escribir('pdp-cpu', { cfg: S.cfg, flota: S.flota, flotaCpu: S.flotaCpu, log: S.log, nivel: S.nivel, listo: S.listo });
  if (S.modo === 'online' && S.sala) {
    escribir('pdp-sala-' + S.sala, { yo: S.yo, cfg: S.cfg, flota: S.flota, log: S.log, listo: S.listo, rivalListo: S.rivalListo, pend: S.pend, rivalFlota: S.rivalFlota, chat: S.chat.slice(-60) });
    escribir('pdp-ultima', { sala: S.sala, yo: S.yo, fin: !!(S.est && S.est.fin) });
  }
}

// =====================================================================
//  AVISOS Y GRITOS
// =====================================================================
function aviso(txt, tipo = '', ms = 2600) {
  const d = document.createElement('div'); d.className = 'aviso ' + tipo; d.innerHTML = txt;
  const cont = $('avisos'); cont.appendChild(d);
  while (cont.children.length > 3) cont.firstChild.remove();
  setTimeout(() => { d.classList.add('sale'); setTimeout(() => d.remove(), 450); }, ms);
}
function grito(txt, sub = '', azul = false) {
  const g = $('grito'); g.hidden = false; g.className = azul ? 'azul' : '';
  g.innerHTML = `<div class="g">${txt}${sub ? `<small>${sub}</small>` : ''}</div>`;
  clearTimeout(g._t); g._t = setTimeout(() => { g.hidden = true; }, 1650);
  if (navigator.vibrate) try { navigator.vibrate(azul ? [80, 40, 160] : [40]); } catch (e) {}
}

// =====================================================================
//  ARRIBA (cartel y flotas)
// =====================================================================
function cartel(t, s = '', mio = false) { $('cartelT').textContent = t; $('cartelS').textContent = s; $('cartel').classList.toggle('mio', mio); }
function pintarFlotas() {
  const est = S.est;
  const yoB = bandoDe(S.yo), elB = bandoDe(rival());
  $('flotaYo').className = 'flota ' + yoB; $('flotaEl').className = 'flota ' + elB;
  $('flotaYoN').textContent = yoB === 'p' ? 'Patriotas' : 'Realistas';
  $('flotaElN').textContent = S.modo === 'cpu' ? 'Romarate' : (elB === 'p' ? 'Patriotas' : 'Realistas');
  const pip = (rolId, hundida) => `<span class="nave${hundida ? ' hundida' : ''}" title="${rolId}">${'<i></i>'.repeat(R.rol(rolId).largo)}</span>`;
  const mios = R.ROLES.map(Ro => { const b = est && est.mia.barcos.find(x => x.rol === Ro.id); return pip(Ro.id, b && b.hundido); }).join('');
  const hund = new Set(est ? est.hundidosRival.map(h => h.rol) : []);
  const suyos = R.ROLES.map(Ro => pip(Ro.id, hund.has(Ro.id))).join('');
  $('flotaYo').querySelector('.pips').innerHTML = mios;
  $('flotaEl').querySelector('.pips').innerHTML = suyos;
}

// =====================================================================
//  ABAJO (tabla de acciones)
// =====================================================================
const OLA_SVG = `<svg class="ola-anim" viewBox="0 0 34 20"><path d="M1 12c4-6 8-6 12 0s8 6 12 0 6-4 8-2" fill="none" stroke="#2f5d8a" stroke-width="2"><animate attributeName="d" dur="1.6s" repeatCount="indefinite" values="M1 12c4-6 8-6 12 0s8 6 12 0 6-4 8-2;M1 10c4 6 8 6 12 0s8-6 12 0 6 4 8 2;M1 12c4-6 8-6 12 0s8 6 12 0 6-4 8-2"/></path></svg>`;

function pintarTabla() {
  const t = $('tabla'); let h = '';
  const est = S.est;
  if (S.fase === 'conectando') {
    h = `<div class="espera">${OLA_SVG}<span>Conectando con tu amigo…</span></div>`;
  } else if (S.fase === 'armado') {
    const v = R.validarFlota(R.mapaPorId(S.cfg.mapa), S.flota);
    h = `<h3>Acomodá tu escuadra <small>${bandoDe(S.yo) === 'p' ? 'Patriotas · Brown' : 'Realistas · Romarate'}</small></h3>
    <div id="msjAbajo">${v.ok ? 'Tocá un barco y arrastralo. Tocalo de nuevo para girarlo.' : `<b>${v.motivo}.</b>`}</div>
    <div class="fichas">${S.flota.map((b, i) => `<button class="ficha${S.sel === i ? ' sel' : ''}${v.malos.has(i) ? ' mal' : ''}" data-act="elegir" data-i="${i}">
      <div class="n">${cortoBando(S.yo, b.rol)}</div><div class="nave">${'<i></i>'.repeat(R.rol(b.rol).largo)}</div><div class="d">${R.PODERES[R.rol(b.rol).poder].nombre}</div></button>`).join('')}</div>
    <div class="botones"><button class="btn chico" data-act="girar" ${S.sel === null ? 'disabled' : ''}>${icono('girar')} Girar</button>
      <button class="btn chico" data-act="azar">${icono('dado')} Al azar</button>
      <button class="btn fuego" data-act="zarpar" ${v.ok ? '' : 'disabled'}>${icono('ancla')} ¡Zarpar!</button></div>`;
  } else if (S.fase === 'espera') {
    h = `<div class="espera">${OLA_SVG}<span>${S.conectado ? 'Tu amigo todavía está acomodando su flota…' : 'Esperando que tu amigo entre a la batalla…'}</span></div>
    <div class="botones" style="margin-top:8px">${S.yo === 'h' && !S.conectado ? `<button class="btn azul" data-act="invitar">${icono('botella')} Mandar el link</button>` : ''}<button class="btn" data-act="vista">${icono('ojo')} ${S.vista === 'mio' ? 'Aguas enemigas' : 'Mi flota'}</button></div>`;
  } else if (S.fase === 'combate' && est) {
    if (est.turno === S.yo && !S.ocupado) {
      const fichas = [`<button class="ficha${!S.poder ? ' sel' : ''}" data-act="poder" data-p=""><div class="n">${icono('tiro')} Tiro</div><div class="d">Un cañonazo</div></button>`];
      for (const Ro of R.ROLES) {
        const P = R.PODERES[Ro.poder], b = est.mia.barcos.find(x => x.rol === Ro.id);
        const ok = est.poderes[Ro.poder], tag = b && b.hundido ? 'hundido' : est.usados[S.yo][Ro.poder] ? 'usado' : '';
        fichas.push(`<button class="ficha${S.poder === Ro.poder ? ' sel' : ''}" data-act="poder" data-p="${Ro.poder}" ${ok ? '' : 'disabled'}>${tag ? `<span class="tag">${tag}</span>` : ''}<div class="n">${icono(Ro.poder)} ${P.nombre}</div><div class="d">${P.corto}</div></button>`);
      }
      if (S.cfg.noche) {
        const puede = est.mia.barcos.some((b, i) => R.maniobraLegal(S.cfg, est.mia, i, 1) || R.maniobraLegal(S.cfg, est.mia, i, -1));
        fichas.push(`<button class="ficha${S.poder === 'maniobra' ? ' sel' : ''}" data-act="poder" data-p="maniobra" ${puede ? '' : 'disabled'}><div class="n">${icono('maniobra')} Maniobrar</div><div class="d">Escabullir un barco tocado</div></button>`);
      }
      const { texto, ok } = textoFuego();
      const girar = S.poder === 'andanada' || S.poder === 'sondeo';
      h = `<div id="msjAbajo">${ayudaPoder()}</div><div class="fichas">${fichas.join('')}</div>
      <div class="botones">${S.poder === 'maniobra' && S.sel !== null ? `<button class="btn chico" data-act="dir" data-d="-1" ${R.maniobraLegal(S.cfg, est.mia, S.sel, -1) ? '' : 'disabled'}>◀ Atrás</button><button class="btn chico" data-act="dir" data-d="1" ${R.maniobraLegal(S.cfg, est.mia, S.sel, 1) ? '' : 'disabled'}>Adelante ▶</button>` :
        `<button class="btn chico" data-act="vista">${icono('ojo')} ${S.vista === 'mio' ? 'Enemigo' : 'Mi flota'}</button>`}
        ${girar ? `<button class="btn chico" data-act="orient">${icono('girar')}</button>` : ''}
        <button class="btn fuego" data-act="fuego" ${ok ? '' : 'disabled'}>${S.poder ? icono(S.poder === 'maniobra' ? 'maniobra' : S.poder) : icono('fuego')} ${texto}</button></div>`;
    } else if (est.turno === rival() && !S.ocupado) {
      h = `<div class="espera">${OLA_SVG}<span>${S.modo === 'cpu' ? 'Romarate prepara los cañones…' : (S.conectado ? 'Turno de tu amigo…' : 'Tu amigo se desconectó. Lo esperamos…')}</span></div>
      <div class="botones" style="margin-top:8px"><button class="btn" data-act="vista">${icono('ojo')} ${S.vista === 'mio' ? 'Ver aguas enemigas' : 'Ver mi flota'}</button></div>`;
    } else {
      h = `<div class="espera">${OLA_SVG}<span>${S.pend ? 'Disparando…' : '¡Fuego!'}</span></div>`;
    }
  } else if (S.fase === 'fin') {
    h = `<div class="botones"><button class="btn fuego" data-act="revancha">${icono('fuego')} Revancha</button><button class="btn" data-act="resultado">Resultado</button><button class="btn" data-act="inicio">Inicio</button></div>`;
  }
  t.innerHTML = h;
  requestAnimationFrame(ajustarMargenes);
}

let margenesPrev = [0, 0];
function ajustarMargenes() {
  if (S.fase === 'portada') return;
  const sup = $('arriba').hidden ? 20 : $('arriba').getBoundingClientRect().bottom + 8;
  const inf = $('abajo').hidden ? 20 : innerHeight - $('abajo').getBoundingClientRect().top + 8;
  $('avisos').style.top = sup + 'px';
  if (Math.abs(sup - margenesPrev[0]) > 6 || Math.abs(inf - margenesPrev[1]) > 24) { margenesPrev = [sup, inf]; esc.margenes(sup, inf); }
}
addEventListener('resize', () => setTimeout(() => { margenesPrev = [0, 0]; ajustarMargenes(); }, 120));

function ayudaPoder() {
  if (!S.poder) return S.vista === 'mio' ? 'Estás mirando tu flota. Tocá «Enemigo» para apuntar.' : 'Tocá una casilla del río enemigo. Tocala dos veces para disparar.';
  if (S.poder === 'mina') return 'Elegí una casilla <b>de tus aguas</b> sin barco para esconder la mina.';
  if (S.poder === 'maniobra') return S.sel === null ? 'Tocá uno de tus barcos tocados para moverlo una casilla.' : 'Elegí hacia dónde lo movés.';
  return R.PODERES[S.poder].texto;
}
function celdasApuntadas() {
  if (!S.mira) return [];
  const { r, c } = S.mira;
  if (!S.poder) return [[r, c]];
  if (S.poder === 'mina') return [[r, c]];
  return R.areaDe(S.poder, r, c, S.orient);
}
function apuntaValido() {
  if (!S.mira) return false;
  const est = S.est, { r, c } = S.mira;
  if (!S.poder) return R.tiroLegal(S.cfg, est.vista, r, c);
  if (S.poder === 'mina') return R.minaLegal(S.cfg, est.mia, r, c);
  if (S.poder === 'maniobra') return false;
  const mapa = R.mapaPorId(S.cfg.mapa);
  return celdasApuntadas().some(([a, b]) => R.terreno(mapa, a, b) !== 'isla');
}
function textoFuego() {
  if (S.poder === 'maniobra') return { texto: 'Maniobrar', ok: S.sel !== null && R.maniobraLegal(S.cfg, S.est.mia, S.sel, S.dir) };
  const ok = apuntaValido();
  if (!S.mira) return { texto: S.poder === 'mina' ? 'Elegí dónde' : S.poder ? R.PODERES[S.poder].nombre : '¡Fuego!', ok: false };
  const { r, c } = S.mira, nm = R.nombreCelda(r, c);
  const T = { andanada: '¡Andanada!', cruz: '¡Fuego cruzado!', bengala: 'Lanzar bengala', sondeo: S.orient ? `Sondear fila ${fila(r)}` : `Sondear columna ${col(c)}`, mina: `Fondear en ${nm}` };
  return { texto: S.poder ? T[S.poder] : `¡Fuego a ${nm}!`, ok };
}
function pintarMira() {
  if (S.fase === 'armado') return pintarArmado();
  esc.resaltar('rival', []); esc.resaltar('mio', []);
  if (S.fase !== 'combate' || !S.est || S.est.turno !== S.yo || S.ocupado) return;
  if (S.poder === 'maniobra') {
    const lista = [];
    S.est.mia.barcos.forEach((b, i) => {
      if (!(R.maniobraLegal(S.cfg, S.est.mia, i, 1) || R.maniobraLegal(S.cfg, S.est.mia, i, -1))) return;
      for (const [r, c] of R.celdasDe(b)) lista.push({ r, c, tipo: S.sel === i ? 'apunta' : 'sel' });
    });
    if (S.sel !== null && R.maniobraLegal(S.cfg, S.est.mia, S.sel, S.dir)) {
      const b = S.est.mia.barcos[S.sel], nb = { ...b, r: b.h ? b.r : b.r + S.dir, c: b.h ? b.c + S.dir : b.c };
      for (const [r, c] of R.celdasDe(nb)) lista.push({ r, c, tipo: 'area' });
    }
    esc.resaltar('mio', lista); return;
  }
  if (!S.mira) return;
  const tab = S.poder === 'mina' ? 'mio' : 'rival', ok = apuntaValido();
  const lista = celdasApuntadas().map(([r, c]) => ({ r, c, tipo: r === S.mira.r && c === S.mira.c ? (ok ? 'apunta' : 'nope') : 'area' }));
  esc.resaltar(tab, lista);
}

// =====================================================================
//  ESCENA ESTÁTICA (barcos, fuegos, marcas) a partir del estado
// =====================================================================
let recientes = new Set();
function sincronizar(restaurando = false) {
  const est = S.est; if (!est) return;
  esc.flota(est.mia.barcos, bandoDe(S.yo));
  const fuegos = [];
  est.mia.barcos.forEach((b, i) => {
    if (b.hundido) { const cs = R.celdasDe(b); fuegos.push({ clave: 'mh' + i, tab: 'mio', r: cs[Math.floor(cs.length / 2)][0], c: cs[Math.floor(cs.length / 2)][1], tipo: 'humo', y: .1 }); esc.ponerRestos('mio:' + b.rol, 'mio', b); return; }
    R.celdasDe(b).forEach(([r, c], s) => { if (b.danio[s]) fuegos.push({ clave: `m${i}-${s}`, tab: 'mio', r, c, tipo: 'fuego', y: .38 }); });
  });
  for (let r = 0; r < R.N; r++) for (let c = 0; c < R.N; c++) if (est.vista[r][c].e === 'impacto') fuegos.push({ clave: `r${r},${c}`, tab: 'rival', r, c, tipo: 'fuego', y: .1 });
  for (const h of est.hundidosRival) { const cs = R.celdasDe(h), m = cs[Math.floor(cs.length / 2)]; fuegos.push({ clave: 'rh' + h.rol, tab: 'rival', r: m[0], c: m[1], tipo: 'humo', y: .1 }); esc.ponerRestos('rival:' + h.rol, 'rival', h); }
  esc.ponerFuegos(fuegos);
  esc.marcas('rival', est.vista, { recientes, noche: S.cfg.noche, restaurando });
  esc.marcas('mio', est.recibidos, { mio: true, recientes, noche: S.cfg.noche, restaurando });
  esc.insignias('rival', est.sondeos);
  esc.ponerMina(est.mia.mina);
  if (S.rivalFlota && S.fase === 'fin') esc.revelar(S.rivalFlota, bandoDe(rival()));
}

function prepararTablero() {
  esc.portada(false);
  esc.setNoche(S.cfg.noche);
  esc.ponerMapa(R.mapaPorId(S.cfg.mapa));
  esc.limpiarMarcas(); esc.quitarRestos(); esc.limpiarRival(); esc.ponerFuegos([]);
  $('arriba').hidden = false; $('abajo').hidden = false; $('portada').hidden = true;
  $('bChat').hidden = S.modo !== 'online';
  margenesPrev = [0, 0];
}

// =====================================================================
//  PORTADA
// =====================================================================
let instalar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalar = e; if (S.fase === 'portada') pintarPortada(); });

function pintarPortada() {
  S.fase = 'portada';
  $('arriba').hidden = true; $('abajo').hidden = true; $('portada').hidden = false; $('chat').hidden = true;
  esc.resaltar('rival', []); esc.resaltar('mio', []);
  esc.setNoche(A.noche); esc.ponerMapa(R.MAPAS[1]); esc.limpiarMarcas(); esc.quitarRestos(); esc.limpiarRival(); esc.ponerFuegos([]); esc.flota([], 'p'); esc.ponerMina(null);
  esc.portada(true);
  const sala = params.get('sala');
  const cpu = leer('pdp-cpu'); const cpuViva = cpu && cpu.cfg && !R.reconstruir(cpu.cfg, 'h', cpu.flota, cpu.log).fin && cpu.listo;
  const ult = leer('pdp-ultima');
  let h = '';
  if (sala && !leer('pdp-sala-' + sala)) {
    h += `<div class="invitado"><b>Te desafiaron a una batalla</b><span style="font-style:italic">Vas a comandar la escuadra realista</span></div>
      <button class="btn fuego" data-p="entrar">${icono('ancla')} <span class="tx">Entrar a la batalla</span></button>`;
  } else if (sala) {
    h += `<button class="btn fuego" data-p="volverSala">${icono('ancla')} <span class="tx">Volver a la batalla<small>Sala ${sala}</small></span></button>`;
  }
  h += `<button class="btn ${sala ? '' : 'fuego'}" data-p="online">${icono('botella')} <span class="tx">Jugar con un amigo<small>Le mandás un link por WhatsApp</small></span></button>
    <button class="btn azul" data-p="cpu">${icono('fuego')} <span class="tx">Contra la compu<small>Romarate te espera en el río</small></span></button>`;
  if (cpuViva) h += `<button class="btn" data-p="seguirCpu">${icono('ancla')} <span class="tx">Seguir la partida con Romarate</span></button>`;
  if (!sala && ult && ult.sala && !ult.fin && leer('pdp-sala-' + ult.sala)) h += `<button class="btn" data-p="ultima" data-s="${ult.sala}">${icono('ancla')} <span class="tx">Volver a la partida online<small>Sala ${ult.sala}</small></span></button>`;
  h += `<div class="interruptor${A.noche ? ' on' : ''}" data-p="noche"><div class="t"><b>Combate nocturno</b><span>De noche no se ve nada: bengalas, memoria y maniobras</span></div><div class="llave"></div></div>
    <div class="pie"><button class="btn" data-p="reglas">Cómo se juega</button>${instalar ? `<button class="btn" data-p="instalar">Instalar</button>` : ''}<button class="btn" data-p="sonido">${A.sonido ? 'Sonido: sí' : 'Sonido: no'}</button></div>`;
  $('menuPortada').innerHTML = h;
}
$('menuPortada').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  Sonido.desbloquear(); Sonido.tic();
  const p = b.dataset.p;
  if (p === 'noche') { A.noche = !A.noche; guardarAjustes(); esc.setNoche(A.noche); pintarPortada(); }
  if (p === 'reglas') mostrarReglas();
  if (p === 'sonido') { A.sonido = !A.sonido; Sonido.activo = A.sonido; guardarAjustes(); pintarPortada(); }
  if (p === 'instalar' && instalar) { instalar.prompt(); instalar = null; pintarPortada(); }
  if (p === 'cpu') elegirNivel();
  if (p === 'seguirCpu') reanudarCpu();
  if (p === 'online') crearSalaOnline();
  if (p === 'entrar') entrarComoInvitado(params.get('sala'));
  if (p === 'volverSala') reanudarSala(params.get('sala'));
  if (p === 'ultima') { location.href = location.pathname + '?sala=' + b.dataset.s + extraLink(); }
});

// =====================================================================
//  MODALES
// =====================================================================
function modal(html, alCerrar) {
  $('modalC').innerHTML = `<button class="x" data-m="cerrar" aria-label="Cerrar">×</button>` + html;
  $('modal').hidden = false; $('modal')._cerrar = alCerrar;
}
function cerrarModal() { $('modal').hidden = true; const f = $('modal')._cerrar; $('modal')._cerrar = null; f && f(); }
$('modal').addEventListener('click', e => {
  if (e.target === $('modal')) return cerrarModal();
  const b = e.target.closest('[data-m]'); if (!b) return;
  Sonido.tic();
  const m = b.dataset.m;
  if (m === 'cerrar') cerrarModal();
  if (m === 'nivel') { S.nivel = b.dataset.n; A.nivel = S.nivel; guardarAjustes(); $('modalC').querySelectorAll('.nivel').forEach(x => x.classList.toggle('sel', x.dataset.n === S.nivel)); }
  if (m === 'zarparCpu') { $('modal').hidden = true; nuevaPartidaCpu(); }
  if (m === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent('¡Te desafío a una batalla naval en el Río de la Plata! ⚓ Entrá acá: ' + linkSala()), '_blank');
  if (m === 'copiar') { navigator.clipboard?.writeText(linkSala()).then(() => aviso('Link copiado', 'oro')).catch(() => {}); }
  if (m === 'compartir') navigator.share?.({ title: 'Proa del Plata', text: '¡Te desafío a una batalla naval!', url: linkSala() }).catch(() => {});
  if (m === 'calidad') { A.calidad = b.dataset.c; guardarAjustes(); esc.setCalidad(A.calidad); menu(); }
  if (m === 'reglas') mostrarReglas();
  if (m === 'inicio') { $('modal').hidden = true; irAlInicio(); }
  if (m === 'abandonar') { $('modal').hidden = true; if (S.modo === 'cpu') borrar('pdp-cpu'); irAlInicio(); }
  if (m === 'invitar') mostrarInvitacion();
  if (m === 'revancha') { $('modal').hidden = true; pedirRevancha(); }
  if (m === 'ver') cerrarModal();
});

function elegirNivel() {
  modal(`<h2>Contra la compu</h2><p class="sub">Elegí el rango de tu rival realista</p>
    <div class="niveles">${NIVELES.map((n, i) => `<button class="nivel${n.id === S.nivel ? ' sel' : ''}" data-m="nivel" data-n="${n.id}"><span class="rk">${n.nombre}</span><span class="tx">${n.texto}</span><span class="galon">${'<i></i>'.repeat(i + 1)}</span></button>`).join('')}</div>
    <p style="font-size:14px;font-style:italic;margin:0 0 10px;color:#6b5434">${A.noche ? 'Combate nocturno activado.' : 'Combate de día.'} Lo podés cambiar en la portada.</p>
    <button class="btn fuego" style="width:100%" data-m="zarparCpu">${icono('ancla')} ¡A la batalla!</button>`);
}
function mostrarReglas() {
  modal(`<h2>Cómo se juega</h2><p class="sub">Río de la Plata, 1814</p>
  <p>Cada uno esconde su escuadra en sus aguas. Por turnos, disparás a una casilla del río enemigo. Gana el primero que hunde los cinco barcos del otro.</p>
  <ul><li><b>Agua</b>: queda una marca blanca. <b>Impacto</b>: el barco se prende fuego.</li>
  <li>Los barcos no se pueden tocar, ni en diagonal.</li>
  <li>Las <b>islas</b> no se pueden usar. En los <b>bancos de arena</b> solo entran los barcos chicos (de 2).</li></ul>
  <p><b>Poderes.</b> Cada barco tiene uno, y lo podés usar una vez en vez de disparar. Si te hunden el barco, perdés su poder.</p>
  <ul>${R.ROLES.map(Ro => `<li><b>${R.PODERES[Ro.poder].nombre}</b> (${corto(Ro.id).toLowerCase()}): ${R.PODERES[Ro.poder].texto}</li>`).join('')}</ul>
  <p><b>Combate nocturno.</b> Las marcas de agua se borran a los pocos segundos: hay que acordarse. Los fuegos sí se ven. Y un barco tocado puede <b>maniobrar</b> una vez: se mueve una casilla, apaga los fuegos y el enemigo pierde su rastro.</p>`);
}
function menu() {
  const q = A.calidad;
  modal(`<h2>Menú</h2>
    <div class="pila">
      <div><b style="font-family:var(--sc);font-weight:400">Pintura al óleo</b> <span style="font-size:13px;font-style:italic;color:#6b5434">(si anda lento, bajala)</span>
      <div class="opciones" style="margin-top:5px">${[['auto', 'Auto'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja'], ['off', 'Sin filtro']].map(([k, n]) => `<button class="${q === k ? 'sel' : ''}" data-m="calidad" data-c="${k}">${n}</button>`).join('')}</div></div>
      ${S.modo === 'online' && S.yo === 'h' ? `<button class="btn azul" data-m="invitar">${icono('botella')} Volver a mandar el link</button>` : ''}
      <button class="btn" data-m="reglas">Cómo se juega</button>
      ${S.modo === 'cpu' && S.fase !== 'fin' ? `<button class="btn" data-m="abandonar">Abandonar esta partida</button>` : ''}
      <button class="btn" data-m="inicio">Volver a la portada</button>
    </div>`);
}
const linkSala = () => location.origin + location.pathname + '?sala=' + S.sala + extraLink();
function mostrarInvitacion() {
  modal(`<h2>Invitá a tu amigo</h2><p class="sub">Mandale este link. Mientras tanto, acomodá tu flota.</p>
    <div class="linkbox">${linkSala()}</div>
    <div class="pila" style="margin-top:12px">
      <button class="btn fuego" data-m="whatsapp">Invitar por WhatsApp</button>
      ${navigator.share ? `<button class="btn" data-m="compartir">Compartir…</button>` : ''}
      <button class="btn" data-m="copiar">Copiar link</button>
    </div>
    <p style="font-size:13.5px;font-style:italic;color:#6b5434;margin:10px 0 0">Vos comandás a los patriotas y tu amigo a los realistas. ${S.cfg && S.cfg.noche ? 'Es un combate nocturno.' : ''}</p>`);
}
function irAlInicio() {
  if (S.red) { S.red.cerrar(); S.red = null; }
  S.modo = null; S.cfg = null; S.est = null; S.log = []; S.ocupado = false;
  history.replaceState(null, '', location.pathname);
  params.delete('sala');
  pintarPortada();
}
$('bMenu').onclick = () => { Sonido.tic(); menu(); };
$('bSonido').onclick = () => { A.sonido = !A.sonido; Sonido.activo = A.sonido; guardarAjustes(); pintarBotonSonido(); };
function pintarBotonSonido() { $('bSonido').innerHTML = icono(A.sonido ? 'son' : 'mudo'); }
pintarBotonSonido();

// =====================================================================
//  ARMADO DE LA FLOTA
// =====================================================================
function empezarArmado() {
  S.fase = S.listo ? (S.modo === 'cpu' || S.rivalListo ? 'combate' : 'espera') : 'armado';
  if (S.fase === 'combate') return empezarCombate(true);
  prepararTablero(); estado(); sincronizar(true);
  S.sel = null; S.vista = 'mio'; esc.mirar('mio', true);
  actualizarTodo();
}
function pintarArmado() {
  const v = R.validarFlota(R.mapaPorId(S.cfg.mapa), S.flota);
  const lista = [];
  S.flota.forEach((b, i) => { for (const [r, c] of R.celdasDe(b)) if (R.dentro(r, c)) { if (v.malos.has(i)) lista.push({ r, c, tipo: 'mal' }); else if (S.sel === i) lista.push({ r, c, tipo: 'sel' }); } });
  esc.resaltar('mio', lista);
}
function moverBarco(i, r, c, h) {
  const b = S.flota[i], L = R.rol(b.rol).largo;
  h = h ?? b.h;
  r = Math.max(0, Math.min(R.N - (h ? 1 : L), r)); c = Math.max(0, Math.min(R.N - (h ? L : 1), c));
  S.flota[i] = { ...b, r, c, h };
  esc.flota(S.flota.map(x => ({ ...x, hundido: false })), bandoDe(S.yo));
}
function girarBarco(i, cr, cc) {
  const b = S.flota[i], L = R.rol(b.rol).largo, cs = R.celdasDe(b);
  const piv = cr !== undefined ? [cr, cc] : cs[Math.floor((L - 1) / 2)];
  const k = cs.findIndex(([r, c]) => r === piv[0] && c === piv[1]);
  const h = !b.h;
  moverBarco(i, h ? piv[0] : piv[0] - k, h ? piv[1] - k : piv[1], h);
}
let arrastre = null;
function barcoEn(r, c) { return S.flota.findIndex(b => R.celdasDe(b).some(([a, d]) => a === r && d === c)); }

// =====================================================================
//  COMBATE
// =====================================================================
function empezarCombate(restaurando = false) {
  S.fase = 'combate';
  prepararTablero(); estado();
  if (S.est.fin) { S.fase = 'fin'; }
  sincronizar(true);
  S.poder = null; S.mira = null; S.sel = null;
  S.vista = S.est.turno === S.yo ? 'rival' : 'mio';
  if (S.fase === 'fin') S.vista = 'rival';
  esc.mirar(S.vista, true);
  actualizarTodo();
  if (!restaurando) { aviso(S.est.turno === S.yo ? '¡Empezás vos! Elegí dónde disparar' : `Empieza ${nombreRival()}`, 'oro', 3000); if (S.est.turno === S.yo) Sonido.turno(); }
  if (S.fase === 'fin') setTimeout(mostrarFin, 600);
  else turnoCpuSiToca();
}
function actualizarTodo() {
  pintarFlotas();
  const est = S.est;
  if (S.fase === 'armado') cartel('Acomodá tu flota', 'Arrastrá los barcos a su lugar', false);
  else if (S.fase === 'espera') cartel('Flota lista', S.conectado ? 'Tu amigo está acomodando la suya…' : 'Esperando a tu amigo…', false);
  else if (S.fase === 'conectando') cartel('Proa del Plata', 'Conectando…', false);
  else if (S.fase === 'combate' && est) {
    if (S.ocupado) cartel(est.turno === S.yo ? 'Tu turno' : (S.modo === 'cpu' ? 'Turno de Romarate' : 'Turno de tu amigo'), '…', est.turno === S.yo);
    else if (est.turno === S.yo) cartel('Tu turno', S.poder ? R.PODERES[S.poder]?.nombre || 'Maniobra' : (S.cfg.noche ? 'Combate nocturno · ' : '') + 'Elegí dónde disparar', true);
    else cartel(S.modo === 'cpu' ? 'Turno de Romarate' : 'Turno de tu amigo', S.cfg.noche ? 'Combate nocturno' : R.mapaPorId(S.cfg.mapa).nombre, false);
  } else if (S.fase === 'fin' && est) cartel(est.fin === S.yo ? '¡Victoria!' : 'Derrota', est.fin === S.yo ? 'El río es tuyo' : `${NombreRival()} se quedó con el río`, est.fin === S.yo);
  pintarTabla(); pintarMira();
}

// ---------- tocar el río ----------
const lienzo = $('lienzo');
let toque = null;
lienzo.addEventListener('pointerdown', e => {
  Sonido.desbloquear();
  toque = { x: e.clientX, y: e.clientY, celda: esc.celdaEn(e.clientX, e.clientY), movio: false, id: e.pointerId };
  if (S.fase === 'armado' && toque.celda && toque.celda.tab === 'mio') {
    const i = barcoEn(toque.celda.r, toque.celda.c);
    if (i >= 0) { arrastre = { i, eraSel: S.sel === i, off: [toque.celda.r - S.flota[i].r, toque.celda.c - S.flota[i].c], movio: false }; S.sel = i; lienzo.setPointerCapture(e.pointerId); pintarTabla(); pintarArmado(); }
  }
});
lienzo.addEventListener('pointermove', e => {
  if (!toque) return;
  if (Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8) toque.movio = true;
  if (arrastre) {
    const c = esc.celdaEn(e.clientX, e.clientY);
    if (c && c.tab === 'mio') {
      const b = S.flota[arrastre.i], nr = c.r - arrastre.off[0], nc = c.c - arrastre.off[1];
      if (nr !== b.r || nc !== b.c) { moverBarco(arrastre.i, nr, nc); arrastre.movio = true; pintarArmado(); }
    }
  }
});
lienzo.addEventListener('pointerup', e => {
  if (!toque) return;
  const t = toque; toque = null;
  if (arrastre) {
    const a = arrastre; arrastre = null;
    if (!a.movio && a.eraSel && t.celda) { girarBarco(a.i, t.celda.r, t.celda.c); Sonido.tic(); }
    pintarTabla(); pintarArmado(); return;
  }
  if (t.movio || !t.celda) return;
  tocarCelda(t.celda);
});
lienzo.addEventListener('pointercancel', () => { toque = null; arrastre = null; });

function tocarCelda({ tab, r, c }) {
  if (S.fase === 'armado') {
    if (tab !== 'mio') return;
    if (S.sel !== null) {
      const L = R.rol(S.flota[S.sel].rol).largo, b = S.flota[S.sel], k = Math.floor((L - 1) / 2);
      moverBarco(S.sel, b.h ? r : r - k, b.h ? c - k : c); Sonido.tic(); pintarTabla(); pintarArmado();
    }
    return;
  }
  if (S.fase !== 'combate' || !S.est) return;
  const est = S.est;
  if (est.turno !== S.yo || S.ocupado) { if (tab === 'rival' && est.turno !== S.yo) aviso(`Esperá: es el turno de ${nombreRival()}`); return; }
  if (S.poder === 'maniobra') {
    if (tab !== 'mio') return;
    const i = est.mia.barcos.findIndex(b => !b.hundido && R.celdasDe(b).some(([a, d]) => a === r && d === c));
    if (i >= 0 && (R.maniobraLegal(S.cfg, est.mia, i, 1) || R.maniobraLegal(S.cfg, est.mia, i, -1))) { S.sel = i; S.dir = R.maniobraLegal(S.cfg, est.mia, i, 1) ? 1 : -1; Sonido.tic(); }
    else aviso('Ese barco no puede maniobrar');
    return actualizarTodo();
  }
  if (S.poder === 'mina') {
    if (tab !== 'mio') return;
    if (S.mira && S.mira.r === r && S.mira.c === c && apuntaValido()) return confirmar();
    S.mira = { r, c }; Sonido.tic();
    if (!apuntaValido()) aviso('Ahí no se puede: tiene que ser agua sin barco');
    return actualizarTodo();
  }
  if (tab !== 'rival') { if (S.vista === 'mio') aviso('Para disparar, mirá las aguas enemigas'); return; }
  if (S.mira && S.mira.r === r && S.mira.c === c && apuntaValido()) return confirmar();
  S.mira = { r, c }; Sonido.tic();
  if (!apuntaValido() && !S.poder) aviso(R.terreno(R.mapaPorId(S.cfg.mapa), r, c) === 'isla' ? 'Eso es una isla' : 'Ahí ya disparaste');
  actualizarTodo();
}

$('tabla').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  Sonido.desbloquear(); Sonido.tic();
  const a = b.dataset.act;
  if (a === 'elegir') { S.sel = +b.dataset.i; pintarTabla(); pintarArmado(); }
  if (a === 'girar' && S.sel !== null) { girarBarco(S.sel); pintarTabla(); pintarArmado(); }
  if (a === 'azar') { S.flota = R.flotaAlAzar(R.mapaPorId(S.cfg.mapa)); esc.flota(S.flota.map(x => ({ ...x, hundido: false })), bandoDe(S.yo)); pintarTabla(); pintarArmado(); }
  if (a === 'zarpar') zarpar();
  if (a === 'vista') { S.vista = S.vista === 'mio' ? 'rival' : 'mio'; esc.mirar(S.vista); if (S.poder === 'mina' || S.poder === 'maniobra') { S.poder = null; S.mira = null; S.sel = null; } actualizarTodo(); }
  if (a === 'poder') {
    const p = b.dataset.p || null;
    S.poder = S.poder === p ? null : p; S.sel = null;
    if (S.mira && (S.poder === 'mina' || S.poder === 'maniobra')) S.mira = null;
    if (!S.poder || !['mina', 'maniobra'].includes(S.poder)) { if (S.mira && S.vista !== 'rival') S.mira = null; }
    const quiere = S.poder === 'mina' || S.poder === 'maniobra' ? 'mio' : 'rival';
    if (S.vista !== quiere) { S.vista = quiere; S.mira = null; esc.mirar(quiere); }
    actualizarTodo();
  }
  if (a === 'orient') { S.orient = !S.orient; actualizarTodo(); }
  if (a === 'dir') { S.dir = +b.dataset.d; actualizarTodo(); }
  if (a === 'fuego') confirmar();
  if (a === 'invitar') mostrarInvitacion();
  if (a === 'revancha') pedirRevancha();
  if (a === 'resultado') mostrarFin();
  if (a === 'inicio') irAlInicio();
});

function zarpar() {
  const v = R.validarFlota(R.mapaPorId(S.cfg.mapa), S.flota); if (!v.ok) return;
  S.listo = true; S.sel = null; esc.resaltar('mio', []);
  guardar();
  if (S.modo === 'cpu') return empezarCombate();
  enviar({ t: 'listo', gid: S.cfg.gid });
  if (S.rivalListo) empezarCombate();
  else { S.fase = 'espera'; actualizarTodo(); if (S.yo === 'h' && !S.conectado) mostrarInvitacion(); }
}

// ---------- confirmar la jugada ----------
function confirmar() {
  const est = S.est; if (!est || est.turno !== S.yo || S.ocupado) return;
  let act = null;
  if (S.poder === 'maniobra') {
    if (S.sel === null || !R.maniobraLegal(S.cfg, est.mia, S.sel, S.dir)) return;
    act = { k: 'maniobra', i: S.sel, d: S.dir };
  } else {
    if (!apuntaValido()) return;
    const { r, c } = S.mira;
    if (S.poder === 'mina') act = { k: 'mina', r, c };
    else if (S.poder === 'bengala') act = { k: 'bengala', r, c };
    else if (S.poder === 'sondeo') act = { k: 'sondeo', r, c, h: S.orient };
    else act = { k: 'tiro', p: S.poder || null, celdas: celdasApuntadas() };
  }
  S.poder = null; S.mira = null; S.sel = null;
  esc.resaltar('rival', []); esc.resaltar('mio', []);
  jugar(act);
}

// Ejecuta una jugada mía
function jugar(act) {
  const n = S.log.length;
  if (act.k === 'mina' || act.k === 'maniobra') {
    const ev = R.sellar(act.k === 'mina' ? R.eventoMina(act.r, act.c) : R.eventoManiobra(S.est.mia, act.i, act.d), n, S.yo);
    if (S.modo === 'online') enviar({ t: 'ev', gid: S.cfg.gid, ev: R.publico(ev) });
    encolar(ev);
    return;
  }
  if (S.modo === 'cpu') {
    const estCpu = R.reconstruir(S.cfg, 'g', S.flotaCpu, S.log);
    const ev = R.sellar(R.resolverAtaque(S.cfg, estCpu.mia, act), n, S.yo);
    encolar(ev);
  } else {
    S.pend = { n, act }; S.ocupado = true; guardar(); actualizarTodo();
    Sonido.disparo();
    enviar({ t: 'act', gid: S.cfg.gid, n, act });
  }
}

// ---------- procesar eventos (en fila, con animación) ----------
let cola = Promise.resolve();
function encolar(ev, animar = true) {
  cola = cola.then(() => procesar(ev, animar)).catch(e => console.error(e));
  return cola;
}
async function procesar(ev, animar) {
  if (ev.n !== S.log.length) return;
  if (S.pend && ev.by === S.yo && ev.n === S.pend.n) S.pend = null;
  const antes = S.est;
  S.log.push(ev); S.ocupado = true;
  const est = estado(); guardar();
  recientes = new Set();
  if (ev.res) ev.res.forEach(x => recientes.add(x.r + ',' + x.c));
  if (ev.k === 'bengala') R.areaDe('bengala', ev.r, ev.c).forEach(([a, b]) => recientes.add(a + ',' + b));
  actualizarTodo();
  if (animar) { try { await animarEvento(ev, antes, est); } catch (e) { console.error(e); } }
  sincronizar();
  S.ocupado = false;
  if (est.fin) return terminar();
  // de quién es el turno ahora
  if (est.turno === S.yo) {
    if (S.vista !== 'rival') { S.vista = 'rival'; esc.mirar('rival'); }
    Sonido.turno();
    if (antes && antes.turno === S.yo && ev.by === rival()) {}
    if (ev.by === S.yo && ev.mina) {}
  } else if (S.vista !== 'mio') { await esperar(350); S.vista = 'mio'; esc.mirar('mio'); }
  if (ev.by === rival() && ev.k === 'tiro' && ev.mina) aviso(`¡Tu mina explotó! ${NombreRival()} pierde su próximo turno`, 'oro', 3200);
  actualizarTodo();
  turnoCpuSiToca();
}

async function animarEvento(ev, antes, est) {
  const mio = ev.by === S.yo;
  const tab = mio ? 'rival' : 'mio';
  if (ev.k === 'tiro') {
    if (S.vista !== tab) { S.vista = tab; await esc.mirar(tab, false, .9); }
    if (!mio || S.modo === 'cpu') Sonido.disparo(!mio);
    let golpes = 0;
    await esc.disparo(tab, ev.res, [], bandoDe(mio ? rival() : S.yo), x => {
      if (x.o === 'agua') Sonido.agua();
      else if (x.o === 'mina') Sonido.mina();
      else if (x.o !== 'nada') { Sonido.impacto(); golpes++; if (!mio && navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} }
    });
    // hundimientos
    for (const h of ev.hund) {
      Sonido.hundido();
      if (mio) grito('¡Hundido!', nombreBarco(rival(), h.rol));
      else grito('¡Nos hundieron!', nombreBarco(S.yo, h.rol), true);
      await esc.hundir(tab, h, bandoDe(mio ? rival() : S.yo));
    }
    if (ev.hund.length) await esc.volver(.8);
    // avisos
    const P = ev.p ? R.PODERES[ev.p].nombre + ': ' : '';
    if (ev.mina && mio) aviso('¡Mina! Perdés tu próximo turno', 'rojo', 3200);
    if (!ev.hund.length) {
      const imp = ev.res.filter(x => x.o === 'impacto').length;
      if (mio) aviso(imp ? `${P}¡Impacto${imp > 1 ? `s (${imp})` : ''}!` : `${P}Agua…`, imp ? 'oro' : '');
      else aviso(imp ? `${P}Te dieron en ${ev.res.filter(x => x.o === 'impacto').map(x => R.nombreCelda(x.r, x.c)).join(', ')}` : `${NombreRival()} ${ev.p ? 'usó ' + R.PODERES[ev.p].nombre.toLowerCase() + ': ' : 'tiró a ' + R.nombreCelda(ev.res[0].r, ev.res[0].c) + ': '}agua`, imp ? 'rojo' : '');
    }
  } else if (ev.k === 'bengala') {
    if (S.vista !== tab) { S.vista = tab; await esc.mirar(tab, false, .9); }
    Sonido.bengala();
    if (mio) aviso(ev.vistos.length ? `La bengala ilumina ${ev.vistos.length} parte${ev.vistos.length > 1 ? 's' : ''} de barco… ¡acordate!` : 'La bengala no muestra nada: agua vacía', 'oro', 4200);
    else aviso(`${NombreRival()} lanzó una bengala sobre tus aguas`, 'rojo', 3500);
    await esc.bengala(tab, ev.r, ev.c, mio ? ev.vistos : []);
  } else if (ev.k === 'sondeo') {
    if (S.vista !== tab) { S.vista = tab; await esc.mirar(tab, false, .9); }
    Sonido.sondeo();
    await esc.sondeo(tab, ev.r, ev.c, ev.h);
    const linea = ev.h ? `la fila ${fila(ev.r)}` : `la columna ${col(ev.c)}`;
    if (mio) aviso(`Sondaleza: ${ev.cuenta} parte${ev.cuenta === 1 ? '' : 's'} de barco sana${ev.cuenta === 1 ? '' : 's'} en ${linea}`, 'oro', 4500);
    else aviso(`${NombreRival()} sondeó ${linea} de tus aguas`, 'rojo', 3200);
  } else if (ev.k === 'mina') {
    if (mio) { if (S.vista !== 'mio') { S.vista = 'mio'; await esc.mirar('mio', false, .9); } const p = esc.centroCelda('mio', ev.sec.r, ev.sec.c); esc.chorro(p, .3); Sonido.agua(); sincronizar(); aviso(`Mina escondida en ${R.nombreCelda(ev.sec.r, ev.sec.c)}`, 'oro'); await esperar(900); }
    else aviso(`${NombreRival()} escondió una mina en sus aguas`, 'rojo', 3200);
  } else if (ev.k === 'maniobra') {
    if (mio) {
      if (S.vista !== 'mio') { S.vista = 'mio'; await esc.mirar('mio', false, .9); }
      Sonido.maniobra();
      const b = est.mia.barcos[ev.sec.i];
      await esc.maniobrar(ev.sec.i, ev.sec.d, b);
      aviso(`La ${nombreBarco(S.yo, b.rol)} se escabulle en la oscuridad`, 'oro');
    } else { Sonido.maniobra(); aviso(`${NombreRival()} maniobró en la oscuridad: perdiste su rastro`, 'rojo', 3500); await esperar(600); }
  }
}

// ---------- fin ----------
async function terminar() {
  S.fase = 'fin'; actualizarTodo();
  const gane = S.est.fin === S.yo;
  await esperar(500);
  if (gane) { Sonido.victoria(); grito('¡Victoria!', 'El río es tuyo'); } else { Sonido.derrota(); grito('Derrota', `${NombreRival()} domina el Plata`, true); }
  if (S.modo === 'cpu') { S.rivalFlota = R.reconstruir(S.cfg, 'g', S.flotaCpu, S.log).mia.barcos; esc.revelar(S.rivalFlota, bandoDe(rival())); }
  else enviarRevela();
  guardar();
  if (S.vista !== 'rival') { S.vista = 'rival'; esc.mirar('rival'); }
  await esperar(2400);
  mostrarFin();
}
function mostrarFin() {
  const est = S.est; if (!est) return;
  const gane = est.fin === S.yo, yo = est.stats[S.yo], el = est.stats[rival()];
  const prec = s => s.tiros ? Math.round(s.aciertos / s.tiros * 100) + '%' : '—';
  modal(`<h2>${gane ? '¡Victoria!' : 'Derrota'}</h2>
    <p class="sub">${gane ? (bandoDe(S.yo) === 'p' ? 'Brown se queda con el río.' : 'La escuadra realista domina el Plata.') : `${NombreRival()} ganó esta vez.`}</p>
    <table style="width:100%;border-collapse:collapse;font-size:16px;margin-bottom:12px">
      <tr style="font-family:var(--sc)"><td></td><td style="text-align:center">Vos</td><td style="text-align:center">${S.modo === 'cpu' ? 'Romarate' : 'Tu amigo'}</td></tr>
      <tr><td>Tiros</td><td style="text-align:center">${yo.tiros}</td><td style="text-align:center">${el.tiros}</td></tr>
      <tr><td>Aciertos</td><td style="text-align:center">${yo.aciertos} (${prec(yo)})</td><td style="text-align:center">${el.aciertos} (${prec(el)})</td></tr>
      <tr><td>Barcos hundidos</td><td style="text-align:center">${yo.hundidos}</td><td style="text-align:center">${el.hundidos}</td></tr>
    </table>
    <div class="pila"><button class="btn fuego" data-m="revancha">${icono('fuego')} Revancha</button><button class="btn" data-m="ver">Ver el río</button><button class="btn" data-m="inicio">Volver a la portada</button></div>`);
}

// =====================================================================
//  CONTRA LA COMPU
// =====================================================================
function cfgNueva(empieza, mapaPrev) {
  const opciones = R.MAPAS.filter(m => m.id !== mapaPrev);
  const mapa = opciones[Math.floor(Math.random() * opciones.length)];
  return { gid: Math.random().toString(36).slice(2, 10), mapa: mapa.id, noche: !!A.noche, empieza: empieza || (Math.random() < .5 ? 'h' : 'g') };
}
function nuevaPartidaCpu(prev) {
  S.modo = 'cpu'; S.yo = 'h'; S.cfg = cfgNueva(prev ? R.otro(prev.empieza) : null, prev && prev.mapa);
  if (prev) S.cfg.noche = prev.noche;
  const mapa = R.mapaPorId(S.cfg.mapa);
  S.flota = R.flotaAlAzar(mapa); S.flotaCpu = R.flotaAlAzar(mapa); S.log = []; S.listo = false; S.rivalListo = true; S.rivalFlota = null; S.pend = null;
  guardar(); empezarArmado();
  aviso(`${mapa.nombre}: ${mapa.texto}`, 'oro', 4500);
}
function reanudarCpu() {
  const g = leer('pdp-cpu'); if (!g) return;
  Object.assign(S, { modo: 'cpu', yo: 'h', cfg: g.cfg, flota: g.flota, flotaCpu: g.flotaCpu, log: g.log, nivel: g.nivel || S.nivel, listo: g.listo, rivalListo: true, rivalFlota: null, pend: null });
  empezarArmado();
}
let cpuPensando = false;
async function turnoCpuSiToca() {
  if (S.modo !== 'cpu' || S.fase !== 'combate' || cpuPensando) return;
  const est = S.est; if (!est || est.fin || est.turno !== 'g') return;
  cpuPensando = true;
  await esperar(900 + Math.random() * 700);
  cpuPensando = false;
  if (S.modo !== 'cpu' || S.fase !== 'combate' || S.ocupado) return;
  const n = S.log.length;
  const estCpu = R.reconstruir(S.cfg, 'g', S.flotaCpu, S.log);
  if (estCpu.turno !== 'g') return;
  const act = elegirJugada(S.cfg, estCpu, S.nivel);
  let ev;
  if (act.k === 'mina') ev = R.eventoMina(act.r, act.c);
  else if (act.k === 'maniobra') ev = R.eventoManiobra(estCpu.mia, act.i, act.d);
  else ev = R.resolverAtaque(S.cfg, R.reconstruir(S.cfg, 'h', S.flota, S.log).mia, act);
  encolar(R.sellar(ev, n, 'g'));
}

// =====================================================================
//  ONLINE
// =====================================================================
function enviar(d) { if (S.red) return S.red.enviar(d); return false; }
function crearSalaOnline() {
  S.modo = 'online'; S.yo = 'h'; S.sala = nuevaSala();
  history.replaceState(null, '', location.pathname + '?sala=' + S.sala + extraLink());
  S.cfg = cfgNueva(); S.flota = R.flotaAlAzar(R.mapaPorId(S.cfg.mapa)); S.log = []; S.listo = false; S.rivalListo = false; S.rivalFlota = null; S.pend = null; S.chat = [];
  guardar(); conectar(); empezarArmado(); mostrarInvitacion();
}
function reanudarSala(sala) {
  const g = leer('pdp-sala-' + sala); if (!g) return entrarComoInvitado(sala);
  Object.assign(S, { modo: 'online', sala, yo: g.yo, cfg: g.cfg, flota: g.flota, log: g.log || [], listo: g.listo, rivalListo: g.rivalListo, pend: g.pend, rivalFlota: g.rivalFlota, chat: g.chat || [] });
  conectar();
  if (!S.cfg) { S.fase = 'conectando'; prepararSinCfg(); return; }
  empezarArmado();
}
function entrarComoInvitado(sala) {
  S.modo = 'online'; S.yo = 'g'; S.sala = sala; S.cfg = null; S.log = []; S.listo = false; S.rivalListo = false; S.chat = []; S.pend = null; S.rivalFlota = null;
  history.replaceState(null, '', location.pathname + '?sala=' + sala + extraLink());
  S.fase = 'conectando'; prepararSinCfg(); conectar();
}
function prepararSinCfg() {
  esc.portada(false);
  $('arriba').hidden = false; $('abajo').hidden = false; $('portada').hidden = true; $('bChat').hidden = false;
  esc.ponerMapa(R.MAPAS[0]); esc.grilla(true); esc.mirar('mio', true);
  actualizarTodo();
}
function conectar() {
  if (S.red) S.red.cerrar();
  S.conectado = false;
  S.red = crearRed({
    sala: S.sala, rol: S.yo,
    alMensaje: recibir,
    alEstado: (txt, ok) => { S.conectado = !!(S.red && S.red.conectado) || ok; if (S.fase !== 'portada') { if (ok || /desconect|cortó|No cargó/.test(txt)) aviso(txt, ok ? 'oro' : 'rojo', 2600); actualizarTodo(); } },
    alConectar: () => { S.conectado = true; enviarHola(); actualizarTodo(); },
  });
}
function enviarHola() {
  enviar({ t: 'hola', gid: S.cfg ? S.cfg.gid : null, len: S.log.length, listo: S.listo, cfg: S.yo === 'h' ? S.cfg : undefined });
  if (S.pend && S.pend.n === S.log.length) enviar({ t: 'act', gid: S.cfg.gid, n: S.pend.n, act: S.pend.act });
  if (S.est && S.est.fin && !S.rivalFlota) enviarRevela();
}
function adoptarCfg(cfg) {
  S.cfg = cfg; S.flota = R.flotaAlAzar(R.mapaPorId(cfg.mapa)); S.log = []; S.listo = false; S.rivalListo = false; S.rivalFlota = null; S.pend = null;
  guardar(); $('modal').hidden = true; empezarArmado();
  aviso(`${R.mapaPorId(cfg.mapa).nombre}${cfg.noche ? ' · combate nocturno' : ''}`, 'oro', 3500);
}
function enviarRevela() {
  const b = S.est.mia.barcos.map(x => ({ rol: x.rol, h: x.h, r: x.r, c: x.c, hundido: x.hundido }));
  enviar({ t: 'revela', gid: S.cfg.gid, flota: b });
}
function recibir(d) {
  if (d.t === 'chat') return llegaChat(d);
  if (d.t === 'hola') {
    if (S.yo === 'g' && d.cfg && (!S.cfg || S.cfg.gid !== d.cfg.gid)) { adoptarCfg(d.cfg); S.rivalListo = !!d.listo; guardar(); enviarHola(); actualizarTodo(); return; }
    if (!S.cfg || d.gid !== S.cfg.gid) return;
    const antes = S.rivalListo; S.rivalListo = !!d.listo;
    if (d.len < S.log.length) enviar({ t: 'evs', gid: S.cfg.gid, desde: d.len, evs: S.log.slice(d.len).map(R.publico) });
    else if (d.len > S.log.length) enviar({ t: 'sync', gid: S.cfg.gid, len: S.log.length });
    if (S.listo && S.rivalListo && S.fase === 'espera') empezarCombate();
    else { guardar(); actualizarTodo(); }
    return;
  }
  if (!S.cfg) return;
  if (d.t === 'cfg') { if (S.yo === 'g' && d.cfg && d.cfg.gid !== S.cfg.gid) adoptarCfg(d.cfg); return; }
  if (d.gid !== S.cfg.gid) { if (d.t === 'revancha' && S.yo === 'h') { if (S.log.length || S.listo) revanchaAnfitrion(); else enviar({ t: 'cfg', gid: d.gid, cfg: S.cfg }); } return; }
  if (d.t === 'listo') { const nuevo = !S.rivalListo; S.rivalListo = true; guardar(); if (nuevo && S.listo) enviar({ t: 'listo', gid: S.cfg.gid }); if (S.listo && S.fase === 'espera') empezarCombate(); else { aviso('Tu amigo ya tiene su flota lista', 'oro'); actualizarTodo(); } return; }
  if (d.t === 'act') {
    const n = S.log.length;
    if (d.n < n) { const ev = S.log[d.n]; if (ev) enviar({ t: 'ev', gid: S.cfg.gid, ev: R.publico(ev) }); return; }
    if (d.n > n) { enviar({ t: 'sync', gid: S.cfg.gid, len: n }); return; }
    // espero que terminen las animaciones pendientes antes de resolver
    cola = cola.then(() => {
      if (S.log.length !== d.n) return;
      const est = estado();
      if (est.turno !== rival() || est.fin) return;
      const ev = R.sellar(R.resolverAtaque(S.cfg, R.reconstruir(S.cfg, S.yo, S.flota, S.log).mia, d.act), d.n, rival());
      enviar({ t: 'ev', gid: S.cfg.gid, ev: R.publico(ev) });
      return procesar(ev, true);
    }).catch(e => console.error(e));
    return;
  }
  if (d.t === 'ev') {
    const ev = d.ev;
    if (ev.n < S.log.length) return;
    if (ev.n > S.log.length) { enviar({ t: 'sync', gid: S.cfg.gid, len: S.log.length }); return; }
    encolar(ev); return;
  }
  if (d.t === 'sync') { if (d.len < S.log.length) enviar({ t: 'evs', gid: S.cfg.gid, desde: d.len, evs: S.log.slice(d.len).map(R.publico) }); return; }
  if (d.t === 'evs') {
    const faltan = d.evs.filter(ev => ev.n >= S.log.length);
    faltan.forEach((ev, i) => encolar(ev, i === faltan.length - 1));
    return;
  }
  if (d.t === 'revela') { S.rivalFlota = d.flota; guardar(); if (S.fase === 'fin') esc.revelar(S.rivalFlota, bandoDe(rival())); return; }
  if (d.t === 'revancha') { if (S.yo === 'h') revanchaAnfitrion(); return; }
}
function pedirRevancha() {
  if (S.modo === 'cpu') return nuevaPartidaCpu(S.cfg);
  if (S.yo === 'h') revanchaAnfitrion();
  else { enviar({ t: 'revancha', gid: S.cfg.gid }); aviso('Pediste la revancha. Esperando a tu amigo…', 'oro'); }
}
function revanchaAnfitrion() {
  const prev = S.cfg;
  S.cfg = cfgNueva(R.otro(prev.empieza), prev.mapa); S.cfg.noche = prev.noche;
  S.flota = R.flotaAlAzar(R.mapaPorId(S.cfg.mapa)); S.log = []; S.listo = false; S.rivalListo = false; S.rivalFlota = null; S.pend = null;
  guardar(); $('modal').hidden = true;
  enviar({ t: 'cfg', gid: prev.gid, cfg: S.cfg });
  empezarArmado(); aviso('¡Revancha! Acomodá tu flota', 'oro');
}

// ---------- chat (mensajes en botella) ----------
const FRASES = ['¡Fuego a discreción!', '¡Buen tiro!', '¡Agua, agua!', 'Te tengo en la mira…', '¡Viva la patria!', '¡A los botes!', 'Esa dolió', '¿Revancha?'];
const EMOJIS = ['⚓', '🔥', '💥', '🌊', '😂', '😱', '👏', '🫡'];
$('frases').innerHTML = FRASES.map(f => `<button data-f="${f}">${f}</button>`).join('');
$('emojis').innerHTML = EMOJIS.map(f => `<button data-f="${f}">${f}</button>`).join('');
function pintarChat() {
  $('chatLog').innerHTML = S.chat.map(m => `<div class="msj ${m.mio ? 'mio' : 'suyo'}"></div>`).join('');
  [...$('chatLog').children].forEach((el, i) => { el.textContent = S.chat[i].txt; });
  $('chatLog').scrollTop = 1e6;
  $('chatPunto').hidden = !S.chatNuevo;
}
function mandarChat(txt) {
  txt = (txt || '').trim().slice(0, 140); if (!txt) return;
  const m = { t: 'chat', id: Math.random().toString(36).slice(2), txt };
  S.chat.push({ txt, mio: true }); pintarChat(); guardar();
  enviar(m); Sonido.botella();
}
function llegaChat(d) {
  S.chat.push({ txt: d.txt, mio: false }); guardar();
  if ($('chat').hidden) { S.chatNuevo = true; const el = document.createElement('span'); el.textContent = d.txt; aviso('Botella: «' + el.innerHTML + '»', 'botella', 4200); }
  pintarChat(); Sonido.botella();
}
$('bChat').onclick = () => { $('chat').hidden = false; S.chatNuevo = false; pintarChat(); };
$('chatX').onclick = () => { $('chat').hidden = true; };
$('frases').onclick = $('emojis').onclick = e => { const b = e.target.closest('[data-f]'); if (b) mandarChat(b.dataset.f); };
$('chatForm').onsubmit = e => { e.preventDefault(); mandarChat($('chatIn').value); $('chatIn').value = ''; };

// =====================================================================
//  ARRANQUE
// =====================================================================
function arrancar() {
  const sala = params.get('sala');
  if (sala && leer('pdp-sala-' + sala)) reanudarSala(sala);
  else pintarPortada();
  setTimeout(() => { $('cargando').style.opacity = 0; setTimeout(() => $('cargando').remove(), 700); }, 300);
}
arrancar();
window.__dbg = { encolar, R, estado };
window.__listo = true;

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
