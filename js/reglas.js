// Proa del Plata · reglas del juego (sin pantalla: se puede probar suelto)
// Todo el estado de una partida sale de: la configuración, mi flota y el registro de jugadas.

export const N = 10;
export const LETRAS = 'ABCDEFGHIJ';

// ---------- El río: mapas ----------
// '.' agua · '~' banco de arena (solo barcos chicos) · '#' isla
export const MAPAS = [
  { id: 'martin-garcia', nombre: 'Isla Martín García', texto: 'La isla que custodia la entrada de los ríos. Rodeada de bajíos.', t: [
    '..........',
    '..........',
    '...~~.....',
    '..~##~....',
    '..~###~...',
    '...~##~...',
    '....~~....',
    '..........',
    '.......~~.',
    '..........'] },
  { id: 'banco-ortiz', nombre: 'Banco Ortiz', texto: 'Una larga lengua de arena cruza el río en diagonal.', t: [
    '..........',
    '.~~.......',
    '..~~......',
    '...~~.....',
    '....~~....',
    '.....~~...',
    '......~~..',
    '.......#..',
    '..........',
    '..........'] },
  { id: 'banco-ingles', nombre: 'Banco Inglés', texto: 'El bajío más temido del Plata, frente a Montevideo.', t: [
    '..........',
    '......~~~.',
    '.....~~~~.',
    '......~~..',
    '..........',
    '.#........',
    '.##~......',
    '..~~......',
    '..........',
    '..........'] },
  { id: 'delta', nombre: 'Bocas del Paraná', texto: 'Islitas y canales: buen lugar para esconderse.', t: [
    '..........',
    '.#.....#..',
    '.~~...~~..',
    '..........',
    '....##....',
    '....~#~...',
    '..........',
    '.~~....~~.',
    '.#......#.',
    '..........'] },
];
export const mapaPorId = id => MAPAS.find(m => m.id === id) || MAPAS[0];
export function terreno(mapa, r, c) { const ch = mapa.t[r][c]; return ch === '#' ? 'isla' : ch === '~' ? 'banco' : 'agua'; }
export const dentro = (r, c) => r >= 0 && c >= 0 && r < N && c < N;

// ---------- La flota ----------
export const ROLES = [
  { id: 'fragata',  largo: 4, poder: 'andanada' },
  { id: 'bergantin', largo: 3, poder: 'bengala' },
  { id: 'goleta',   largo: 3, poder: 'sondeo' },
  { id: 'canonera', largo: 2, poder: 'cruz' },
  { id: 'falucho',  largo: 2, poder: 'mina' },
];
export const rol = id => ROLES.find(r => r.id === id);
export const BANDOS = {
  h: { id: 'p', nombre: 'Patriotas', jefe: 'Brown' },
  g: { id: 'r', nombre: 'Realistas', jefe: 'Romarate' },
};
export const NOMBRES = {
  p: { fragata: 'Fragata Hércules', bergantin: 'Bergantín Nancy', goleta: 'Goleta Juliet', canonera: 'Cañonera Americana', falucho: 'Falucho San Martín' },
  r: { fragata: 'Corbeta Mercurio', bergantin: 'Bergantín San José', goleta: 'Goleta Paloma', canonera: 'Balandra Potrera', falucho: 'Lancha realista' },
};
export const PODERES = {
  andanada: { nombre: 'Andanada', corto: '3 tiros en línea', texto: 'La fragata descarga un costado entero: tres tiros seguidos en línea.' },
  bengala:  { nombre: 'Bengala',  corto: 'Ilumina 3×3',      texto: 'Ilumina un cuadro de 3×3. Los barcos se ven unos segundos… y hay que acordarse.' },
  sondeo:   { nombre: 'Sondaleza', corto: 'Cuenta una línea', texto: 'Sondeás una fila o columna: te dice cuántas partes de barco sanas hay.' },
  cruz:     { nombre: 'Fuego cruzado', corto: '5 tiros en cruz', texto: 'La cañonera dispara en cruz: el centro y sus cuatro vecinos.' },
  mina:     { nombre: 'Mina flotante', corto: 'Esconde una mina', texto: 'Escondés una mina en tus aguas. Si el enemigo le tira, pierde su próximo turno.' },
};
export const otro = q => (q === 'h' ? 'g' : 'h');

export function celdasDe(b) {
  const L = rol(b.rol).largo, out = [];
  for (let i = 0; i < L; i++) out.push(b.h ? [b.r, b.c + i] : [b.r + i, b.c]);
  return out;
}

// Revisa una flota completa. Devuelve { ok, malos: Set de índices con problema, motivo }
export function validarFlota(mapa, flota) {
  const malos = new Set(); let motivo = '';
  const ocup = {};
  flota.forEach((b, i) => {
    const L = rol(b.rol).largo;
    for (const [r, c] of celdasDe(b)) {
      if (!dentro(r, c)) { malos.add(i); motivo = motivo || 'Un barco se sale del mapa'; continue; }
      const t = terreno(mapa, r, c);
      if (t === 'isla') { malos.add(i); motivo = motivo || 'Un barco está sobre una isla'; }
      if (t === 'banco' && L > 2) { malos.add(i); motivo = motivo || 'Los barcos grandes encallan en los bancos de arena'; }
      const k = r * N + c;
      if (ocup[k] !== undefined) { malos.add(i); malos.add(ocup[k]); motivo = motivo || 'Dos barcos se pisan'; }
      ocup[k] = i;
    }
  });
  // no se pueden tocar (ni en diagonal)
  flota.forEach((b, i) => {
    for (const [r, c] of celdasDe(b)) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const k = (r + dr) * N + (c + dc); if (!dentro(r + dr, c + dc)) continue;
      const j = ocup[k]; if (j !== undefined && j !== i) { malos.add(i); malos.add(j); motivo = motivo || 'Los barcos no se pueden tocar'; }
    }
  });
  return { ok: malos.size === 0 && flota.length === ROLES.length, malos, motivo };
}

export function rngDesde(seed) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) : seed) >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function flotaAlAzar(mapa, rng = Math.random) {
  for (let intento = 0; intento < 400; intento++) {
    const flota = [];
    let ok = true;
    for (const R of ROLES) {
      let puesto = false;
      for (let k = 0; k < 200 && !puesto; k++) {
        const h = rng() < .5;
        const b = { rol: R.id, h, r: Math.floor(rng() * (h ? N : N - R.largo + 1)), c: Math.floor(rng() * (h ? N - R.largo + 1 : N)) };
        if (validarFlota(mapa, [...flota, b]).malos.size === 0) { flota.push(b); puesto = true; }
      }
      if (!puesto) { ok = false; break; }
    }
    if (ok) return flota;
  }
  throw new Error('No pude acomodar la flota');
}

// ---------- Formas de los poderes ----------
export function areaDe(tipo, r, c, h = true) {
  let cs = [];
  if (tipo === 'cruz') cs = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  else if (tipo === 'andanada') cs = h ? [[r, c - 1], [r, c], [r, c + 1]] : [[r - 1, c], [r, c], [r + 1, c]];
  else if (tipo === 'bengala') { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) cs.push([r + dr, c + dc]); }
  else if (tipo === 'sondeo') { for (let i = 0; i < N; i++) cs.push(h ? [r, i] : [i, c]); }
  else cs = [[r, c]];
  return cs.filter(([a, b]) => dentro(a, b));
}

// ---------- Estado de mi flota (lo que solo yo sé) ----------
function flotaViva(flota) {
  return flota.map(b => ({ rol: b.rol, h: b.h, r: b.r, c: b.c, danio: Array(rol(b.rol).largo).fill(false), hundido: false, maniobro: false, tHund: -1 }));
}
export const celdasBarco = b => celdasDe(b);
function barcoEn(mia, r, c) {
  for (let i = 0; i < mia.barcos.length; i++) {
    const cs = celdasDe(mia.barcos[i]);
    for (let s = 0; s < cs.length; s++) if (cs[s][0] === r && cs[s][1] === c) return { i, s };
  }
  return null;
}

// Resolver en mi flota un ataque del rival. Modifica `mia`. Devuelve el evento (sin n/by).
export function resolverAtaque(cfg, mia, act) {
  const mapa = mapaPorId(cfg.mapa);
  if (act.k === 'tiro') {
    const res = [], hund = []; let mina = false;
    const celdas = (act.celdas || []).filter(([r, c]) => dentro(r, c));
    for (const [r, c] of celdas) {
      if (terreno(mapa, r, c) === 'isla') { res.push({ r, c, o: 'nada' }); continue; }
      if (mia.mina && mia.mina.r === r && mia.mina.c === c) { mia.mina = null; mia.minaExploto = true; mina = true; res.push({ r, c, o: 'mina' }); continue; }
      const hit = barcoEn(mia, r, c);
      if (!hit) { res.push({ r, c, o: 'agua' }); continue; }
      const b = mia.barcos[hit.i]; b.danio[hit.s] = true;
      if (!b.hundido && b.danio.every(Boolean)) {
        b.hundido = true; res.push({ r, c, o: 'hundido' });
        hund.push({ rol: b.rol, h: b.h, r: b.r, c: b.c });
      } else res.push({ r, c, o: 'impacto' });
    }
    const fin = mia.barcos.every(b => b.hundido);
    return { k: 'tiro', p: act.p || null, celdas, res, hund, mina, fin };
  }
  if (act.k === 'bengala') {
    const vistos = [];
    for (const [r, c] of areaDe('bengala', act.r, act.c)) if (barcoEn(mia, r, c) && !mia.barcos[barcoEn(mia, r, c).i].hundido) vistos.push([r, c]);
    return { k: 'bengala', p: 'bengala', r: act.r, c: act.c, vistos };
  }
  if (act.k === 'sondeo') {
    let cuenta = 0;
    for (const [r, c] of areaDe('sondeo', act.r, act.c, act.h)) { const x = barcoEn(mia, r, c); if (x && !mia.barcos[x.i].danio[x.s]) cuenta++; }
    return { k: 'sondeo', p: 'sondeo', r: act.r, c: act.c, h: act.h, cuenta };
  }
  throw new Error('Ataque desconocido');
}

// Acciones sobre mi propia flota (las resuelvo yo mismo)
export function minaLegal(cfg, mia, r, c) {
  const mapa = mapaPorId(cfg.mapa);
  return dentro(r, c) && terreno(mapa, r, c) !== 'isla' && !barcoEn(mia, r, c) && !(mia.mina);
}
export function maniobraLegal(cfg, mia, i, d) {
  if (!cfg.noche) return false;
  const b = mia.barcos[i]; if (!b || b.hundido || b.maniobro || !b.danio.some(Boolean)) return false;
  const mapa = mapaPorId(cfg.mapa), L = rol(b.rol).largo;
  const nb = { ...b, r: b.h ? b.r : b.r + d, c: b.h ? b.c + d : b.c };
  for (const [r, c] of celdasDe(nb)) {
    if (!dentro(r, c)) return false;
    const t = terreno(mapa, r, c);
    if (t === 'isla' || (t === 'banco' && L > 2)) return false;
    const x = barcoEn(mia, r, c); if (x && x.i !== i) return false;
    if (mia.mina && mia.mina.r === r && mia.mina.c === c) return false;
  }
  return true;
}
function aplicarPropia(mia, ev) {
  if (ev.k === 'mina') { mia.mina = ev.sec ? { r: ev.sec.r, c: ev.sec.c } : null; mia.minaPuesta = true; }
  if (ev.k === 'maniobra' && ev.sec) {
    const b = mia.barcos[ev.sec.i];
    if (b.h) b.c += ev.sec.d; else b.r += ev.sec.d;
    b.maniobro = true;
  }
}

// ---------- Reconstruir todo desde el registro ----------
// yo: 'h' o 'g' · miFlota: colocación inicial · log: lista de eventos
export function reconstruir(cfg, yo, miFlota, log) {
  const rival = otro(yo);
  const mia = { barcos: flotaViva(miFlota || []), mina: null, minaPuesta: false, minaExploto: false };
  const vista = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ e: '?', t: -1 })));
  const recibidos = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ e: '?', t: -1 })));
  const maniobrasRival = [], hundidosRival = [], sondeos = [], bengalas = [], rivalSondeos = [], rivalBengalas = [];
  const usados = { h: {}, g: {} };
  const stats = { h: { tiros: 0, aciertos: 0, hundidos: 0 }, g: { tiros: 0, aciertos: 0, hundidos: 0 } };
  let turno = cfg.empieza || 'h', fin = null; const salto = { h: 0, g: 0 };

  for (const ev of log) {
    if (ev.p) usados[ev.by][ev.p] = true;
    if (ev.k === 'tiro') {
      const st = stats[ev.by];
      for (const x of ev.res) {
        if (x.o === 'nada') continue;
        st.tiros++; if (x.o === 'impacto' || x.o === 'hundido') st.aciertos++;
      }
      st.hundidos += ev.hund.length;
      if (ev.by === yo) {
        for (const x of ev.res) {
          if (x.o === 'nada') continue;
          vista[x.r][x.c] = { e: x.o === 'hundido' ? 'impacto' : x.o === 'mina' ? 'mina' : x.o, t: ev.n };
        }
        for (const h of ev.hund) {
          hundidosRival.push({ ...h, t: ev.n });
          for (const [r, c] of celdasDe(h)) vista[r][c] = { e: 'hundido', t: ev.n };
        }
      } else {
        // me atacaron: aplico el daño a mi flota (rehago la resolución para que todo cuadre)
        for (const x of ev.res) {
          if (x.o === 'nada') continue;
          if (x.o === 'mina') { mia.mina = null; mia.minaExploto = true; }
          const hit = barcoEn(mia, x.r, x.c);
          if (hit) { const b = mia.barcos[hit.i]; b.danio[hit.s] = true; if (b.danio.every(Boolean) && !b.hundido) { b.hundido = true; b.tHund = ev.n; } }
          recibidos[x.r][x.c] = { e: x.o === 'hundido' ? 'impacto' : x.o, t: ev.n };
        }
      }
      if (ev.mina) salto[ev.by]++;
      if (ev.fin) fin = ev.by;
    } else if (ev.k === 'bengala') {
      if (ev.by === yo) {
        bengalas.push({ r: ev.r, c: ev.c, vistos: ev.vistos, t: ev.n });
        const vis = new Set(ev.vistos.map(([r, c]) => r * N + c));
        for (const [r, c] of areaDe('bengala', ev.r, ev.c)) {
          const v = vista[r][c];
          if (vis.has(r * N + c)) { if (v.e === '?' || v.e === 'agua' || v.e === 'humo' || v.e === 'visto') vista[r][c] = { e: 'visto', t: ev.n }; }
          else if (v.e === '?' || v.e === 'visto' || v.e === 'humo') vista[r][c] = { e: 'agua', t: ev.n, luz: true };
        }
      } else rivalBengalas.push({ r: ev.r, c: ev.c, t: ev.n });
    } else if (ev.k === 'sondeo') {
      (ev.by === yo ? sondeos : rivalSondeos).push({ r: ev.r, c: ev.c, h: ev.h, cuenta: ev.cuenta, t: ev.n });
    } else if (ev.k === 'mina') {
      if (ev.by === yo) aplicarPropia(mia, ev);
    } else if (ev.k === 'maniobra') {
      if (ev.by === yo) aplicarPropia(mia, ev);
      else { maniobrasRival.push({ t: ev.n, humo: ev.humo || [] }); for (const [r, c] of ev.humo || []) if (vista[r][c].e === 'impacto') vista[r][c] = { e: 'humo', t: ev.n }; }
      if (ev.by === yo) for (const [r, c] of ev.humo || []) if (recibidos[r][c].e === 'impacto') recibidos[r][c] = { e: 'humo', t: ev.n };
    }
    // turno siguiente
    if (!fin) {
      let sig = otro(ev.by);
      if (salto[sig] > 0) { salto[sig]--; sig = ev.by; }
      turno = sig;
    }
  }
  if (fin) turno = null;

  // poderes disponibles para cada bando
  const mios = {};
  for (const R of ROLES) {
    const b = mia.barcos.find(x => x.rol === R.id);
    mios[R.poder] = !!b && !b.hundido && !usados[yo][R.poder];
  }
  const rivalHund = new Set(hundidosRival.map(h => h.rol));
  const delRival = {};
  for (const R of ROLES) delRival[R.poder] = !rivalHund.has(R.id) && !usados[rival][R.poder];

  return { yo, rival, turno, fin, mia, vista, recibidos, maniobrasRival, hundidosRival, sondeos, bengalas, rivalSondeos, rivalBengalas, usados, poderes: mios, poderesRival: delRival, stats, n: log.length };
}

// ¿Puedo apuntar acá? (para el tiro simple)
export function tiroLegal(cfg, vista, r, c) {
  if (!dentro(r, c) || terreno(mapaPorId(cfg.mapa), r, c) === 'isla') return false;
  const e = vista[r][c].e;
  if (cfg.noche) return e !== 'impacto' && e !== 'hundido' && e !== 'mina';
  return e === '?' || e === 'visto' || e === 'humo';
}

// Arma el evento completo para el registro
export function sellar(ev, n, by) { return { ...ev, n, by }; }
// Lo que viaja al rival (sin secretos)
export function publico(ev) { const { sec, ...rest } = ev; return rest; }

export function eventoMina(r, c) { return { k: 'mina', p: 'mina', sec: { r, c } }; }
export function eventoManiobra(mia, i, d) {
  const b = mia.barcos[i], cs = celdasDe(b);
  const humo = cs.filter((_, s) => b.danio[s]);
  return { k: 'maniobra', sec: { i, d }, humo };
}

export const nombreCelda = (r, c) => LETRAS[c] + (r + 1);
