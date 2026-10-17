// Proa del Plata · la compu (el capitán realista)
import { N, ROLES, rol, celdasDe, terreno, mapaPorId, dentro, areaDe, tiroLegal, minaLegal, maniobraLegal } from './reglas.js';

export const NIVELES = [
  { id: 'grumete',       nombre: 'Grumete',       texto: 'Primer viaje. Tira donde le parece.',               memoria: 6,   poderes: .1, ruido: 1 },
  { id: 'marinero',      nombre: 'Marinero',      texto: 'Cuando acierta, insiste alrededor.',                 memoria: 10,  poderes: .25, ruido: 1 },
  { id: 'contramaestre', nombre: 'Contramaestre', texto: 'Barre el río con método y usa sus poderes.',         memoria: 20,  poderes: .6, ruido: .8 },
  { id: 'capitan',       nombre: 'Capitán',       texto: 'Calcula dónde es más probable que estés.',           memoria: 40,  poderes: .85, ruido: .6 },
  { id: 'almirante',     nombre: 'Almirante',     texto: 'Nivel Romarate: lee el río como nadie.',             memoria: 999, poderes: 1, ruido: 0 },
];

const cel = (r, c) => r * N + c;

// Lo que la compu "recuerda" del río enemigo (de noche se olvida de a poco)
function memoria(cfg, est, nivel) {
  const m = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => est.vista[r][c].e));
  if (cfg.noche) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = est.vista[r][c];
      if ((v.e === 'agua' || v.e === 'visto') && est.n - v.t > nivel.memoria) m[r][c] = v.e === 'agua' ? 'vago' : '?';
    }
  }
  // si un barco se escabulló, lo que sabía alrededor ya no vale
  for (const mv of est.maniobrasRival || []) for (const [r, c] of mv.humo) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const a = r + dr, b = c + dc; if (!dentro(a, b)) continue;
    const v = est.vista[a][b]; if ((v.e === 'agua' || v.e === 'visto') && v.t < mv.t) m[a][b] = '?';
  }
  return m;
}

function restantes(est) {
  const h = new Set(est.hundidosRival.map(x => x.rol));
  return ROLES.filter(R => !h.has(R.id));
}

// Mapa de probabilidad: en cuántas posiciones posibles cae cada casilla
function densidad(cfg, est, mem) {
  const mapa = mapaPorId(cfg.mapa);
  const D = Array.from({ length: N }, () => Array(N).fill(0));
  const prohibido = new Set();
  for (const h of est.hundidosRival) for (const [r, c] of celdasDe(h)) {
    prohibido.add(cel(r, c));
    if (!cfg.noche) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dentro(r + dr, c + dc)) prohibido.add(cel(r + dr, c + dc));
  }
  const abiertos = [], vistos = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (mem[r][c] === 'impacto') abiertos.push(cel(r, c));
    if (mem[r][c] === 'visto') vistos.push(cel(r, c));
  }
  const rest = restantes(est);
  for (const R of rest) {
    for (const h of [true, false]) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const cs = celdasDe({ rol: R.id, h, r, c });
      let ok = true, golpes = 0, vis = 0, vagos = 0;
      for (const [a, b] of cs) {
        if (!dentro(a, b)) { ok = false; break; }
        const t = terreno(mapa, a, b);
        if (t === 'isla' || (t === 'banco' && R.largo > 2)) { ok = false; break; }
        if (prohibido.has(cel(a, b))) { ok = false; break; }
        const e = mem[a][b];
        if (e === 'agua' || e === 'mina') { ok = false; break; }
        if (e === 'impacto') golpes++;
        if (e === 'visto') vis++;
        if (e === 'vago') vagos++;
      }
      if (!ok) continue;
      let w = (1 + vis * 8) * Math.pow(.3, vagos);
      if (abiertos.length) w *= golpes ? Math.pow(30, golpes) : .05;
      for (const [a, b] of cs) D[a][b] += w;
    }
  }
  // las sondalezas dan pistas por línea
  for (const s of est.sondeos) {
    if (cfg.noche && est.n - s.t > 40) continue;
    for (const [a, b] of areaDe('sondeo', s.r, s.c, s.h)) D[a][b] *= s.cuenta === 0 ? 0 : 1 + s.cuenta * .5;
  }
  return D;
}

function puedoTirar(cfg, est, mem, r, c) {
  if (!tiroLegal(cfg, est.vista, r, c)) return false;
  const e = mem[r][c];
  return e !== 'agua' && e !== 'impacto' && e !== 'hundido' && e !== 'mina';
}

function mejor(cands, rng) {
  let max = -Infinity, best = [];
  for (const x of cands) { if (x.v > max + 1e-9) { max = x.v; best = [x]; } else if (Math.abs(x.v - max) < 1e-9) best.push(x); }
  return best.length ? best[Math.floor(rng() * best.length)] : null;
}

function sumaArea(D, cfg, est, mem, cs) {
  let s = 0; for (const [a, b] of cs) if (puedoTirar(cfg, est, mem, a, b)) s += D[a][b]; return s;
}

// Devuelve la jugada: { k:'tiro'|'bengala'|'sondeo', ... } o propia { k:'mina', r, c } / { k:'maniobra', i, d }
export function elegirJugada(cfg, est, nivelId, rng = Math.random) {
  const nivel = NIVELES.find(n => n.id === nivelId) || NIVELES[1];
  const idx = NIVELES.indexOf(nivel);
  const mem = memoria(cfg, est, nivel);
  const legales = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (puedoTirar(cfg, est, mem, r, c)) legales.push([r, c]);
  if (!legales.length) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (tiroLegal(cfg, est.vista, r, c)) legales.push([r, c]);
  const abiertos = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (mem[r][c] === 'impacto') abiertos.push([r, c]);
  const P = est.poderes, quiere = rng() < nivel.poderes;

  // 1) De noche, escaparse si me están cazando un barco
  if (cfg.noche && idx >= 2) {
    for (let i = 0; i < est.mia.barcos.length; i++) {
      const b = est.mia.barcos[i];
      const sanas = b.danio.filter(x => !x).length;
      if (b.hundido || b.maniobro || !b.danio.some(Boolean) || sanas === 0) continue;
      const cazado = celdasDe(b).some(([r, c]) => est.recibidos[r][c].t >= est.n - 2 && est.recibidos[r][c].e === 'impacto');
      if (!cazado) continue;
      if (rng() > (idx >= 4 ? .75 : idx === 3 ? .5 : .3)) continue;
      const ds = [1, -1].filter(d => maniobraLegal(cfg, est.mia, i, d));
      if (ds.length) return { k: 'maniobra', i, d: ds[Math.floor(rng() * ds.length)] };
    }
  }
  // 2) La mina, temprano
  if (P.mina && quiere && est.n < 8 && rng() < (idx >= 3 ? .6 : .3)) {
    const ops = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (minaLegal(cfg, est.mia, r, c)) ops.push([r, c, idx >= 3 ? 1 - (Math.abs(r - 4.5) + Math.abs(c - 4.5)) / 9 : 1]);
    if (ops.length) {
      ops.sort((a, b) => b[2] - a[2]);
      const pick = ops[Math.floor(rng() * Math.min(ops.length, idx >= 3 ? 12 : ops.length))];
      return { k: 'mina', r: pick[0], c: pick[1] };
    }
  }

  // Niveles bajos: azar con algo de insistencia
  if (idx <= 1) {
    if (abiertos.length && (idx === 1 || rng() < .35)) {
      const cand = [];
      for (const [r, c] of abiertos) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (puedoTirar(cfg, est, mem, r + dr, c + dc)) cand.push([r + dr, c + dc]);
      if (cand.length) { const [r, c] = cand[Math.floor(rng() * cand.length)]; return tiroSimple(r, c, P, quiere && rng() < .3); }
    }
    const [r, c] = legales[Math.floor(rng() * legales.length)];
    return tiroSimple(r, c, P, quiere && rng() < .2);
  }

  const D = densidad(cfg, est, mem);
  const tot = legales.reduce((s, [r, c]) => s + D[r][c], 0) || 1;
  // Ruido para que no sea perfecto
  const val = (r, c) => D[r][c] / tot * (1 + (rng() - .5) * nivel.ruido * 2);

  // Contramaestre: barre en damero cuando no tiene pistas
  if (idx === 2 && !abiertos.length) {
    const minL = Math.min(...restantes(est).map(R => R.largo));
    const dam = legales.filter(([r, c]) => (r + c) % minL === 0);
    const pool = dam.length ? dam : legales;
    const pick = mejor(pool.map(([r, c]) => ({ r, c, v: val(r, c) })), rng);
    if (quiere && P.bengala && est.n > 4 && rng() < .3) return mejorBengala(D, cfg, est, mem, rng);
    return tiroSimple(pick.r, pick.c, P, false);
  }

  const simple = mejor(legales.map(([r, c]) => ({ r, c, v: val(r, c) })), rng);
  if (!simple) { const [r, c] = legales[0] || [0, 0]; return { k: 'tiro', p: null, celdas: [[r, c]] }; }
  const vSimple = D[simple.r][simple.c];

  if (quiere) {
    const ops = [];
    if (P.cruz) {
      const b = mejor(legales.map(([r, c]) => ({ r, c, v: sumaArea(D, cfg, est, mem, areaDe('cruz', r, c)) })), rng);
      if (b) ops.push({ v: b.v, act: { k: 'tiro', p: 'cruz', celdas: areaDe('cruz', b.r, b.c) } });
    }
    if (P.andanada) {
      const cands = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const h of [true, false]) cands.push({ r, c, h, v: sumaArea(D, cfg, est, mem, areaDe('andanada', r, c, h)) });
      const b = mejor(cands, rng);
      if (b) ops.push({ v: b.v, act: { k: 'tiro', p: 'andanada', celdas: areaDe('andanada', b.r, b.c, b.h) } });
    }
    const umbral = abiertos.length ? 1.6 : 2.4;
    const top = ops.sort((a, b) => b.v - a.v)[0];
    if (top && top.v > vSimple * umbral) return top.act;
    if (!abiertos.length && P.bengala && est.n >= 4 && rng() < .45) return mejorBengala(D, cfg, est, mem, rng);
    if (!abiertos.length && P.sondeo && est.n >= 2 && rng() < .4) {
      const cands = [];
      for (let i = 0; i < N; i++) {
        cands.push({ r: i, c: 0, h: true, v: sumaArea(D, cfg, est, mem, areaDe('sondeo', i, 0, true)) });
        cands.push({ r: 0, c: i, h: false, v: sumaArea(D, cfg, est, mem, areaDe('sondeo', 0, i, false)) });
      }
      const b = mejor(cands, rng);
      if (b) return { k: 'sondeo', r: b.r, c: b.c, h: b.h };
    }
  }
  return { k: 'tiro', p: null, celdas: [[simple.r, simple.c]] };
}

function mejorBengala(D, cfg, est, mem, rng) {
  const cands = [];
  for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) cands.push({ r, c, v: sumaArea(D, cfg, est, mem, areaDe('bengala', r, c)) });
  const b = mejor(cands, rng);
  return { k: 'bengala', r: b.r, c: b.c };
}

function tiroSimple(r, c, P, usarPoder) {
  if (usarPoder && P.cruz) return { k: 'tiro', p: 'cruz', celdas: areaDe('cruz', r, c) };
  if (usarPoder && P.andanada) return { k: 'tiro', p: 'andanada', celdas: areaDe('andanada', r, c, Math.random() < .5) };
  return { k: 'tiro', p: null, celdas: [[r, c]] };
}
