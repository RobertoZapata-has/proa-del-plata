// Proa del Plata · barcos de madera hechos con código
import * as THREE from 'three';

const PALETA = {
  p: { franja: 0x7fb0d8, borde: 0xe9e1cc, vela: 0xeee4cb, bandera: ['#78b4e3', '#f4f1e8', '#78b4e3'] },
  r: { franja: 0xc9a33a, borde: 0x9c2b22, vela: 0xe8d6b0, bandera: ['#b8261e', '#f2c230', '#b8261e'] },
};
const CASCO = new THREE.Color(0x4b3423), FONDO = new THREE.Color(0x8c4a2c), CUBIERTA = new THREE.Color(0x8f714c), ASTILLA = new THREE.Color(0xd8b484);

const matCache = {};
function mat(key, make) { return matCache[key] || (matCache[key] = make()); }

// Ancho del casco a lo largo (u: 0 popa → 1 proa)
function ancho(u) {
  u = Math.min(1, Math.max(0, u));
  if (u < .2) return .78 + .22 * (u / .2);
  if (u < .58) return 1;
  const k = (u - .58) / .42; return Math.max(.03, Math.sqrt(Math.max(0, 1 - k * k)));
}

// Casco entre u0 y u1. Devuelve geometría con colores por vértice.
function cascoGeo(L, W, H, u0, u1, franja, borde, tapaRota) {
  const S = Math.max(4, Math.round((u1 - u0) * 18)), K = 10;
  const pos = [], col = [], idx = [];
  const deckY = u => H * .42 + .09 * Math.pow((u - .45) * 2, 2);
  const keelY = u => -H * .38 * (.55 + .45 * Math.sin(Math.min(1, Math.max(0, u)) * Math.PI));
  const cF = new THREE.Color(franja), cB = new THREE.Color(borde);
  const ring = [];
  for (let i = 0; i <= S; i++) {
    const u = u0 + (u1 - u0) * i / S, x = (u - .5) * L, w = W / 2 * ancho(u);
    const dY = deckY(u), kY = keelY(u), row = [];
    for (let j = 0; j <= K; j++) {
      const ph = Math.PI * j / K;
      const s = Math.sin(ph);
      const y = kY + (dY - kY) * Math.pow(1 - s, .55);
      const z = -Math.cos(ph) * w * (.82 + .18 * Math.pow(s, .4));
      row.push(pos.length / 3); pos.push(x, y, z);
      let c = CASCO;
      if (y < -.02) c = FONDO;
      else if (y > dY - .05) c = cB;
      else if (y > dY - .16) c = cF;
      col.push(c.r, c.g, c.b);
    }
    ring.push(row);
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < K; j++) {
    const a = ring[i][j], b = ring[i + 1][j], c = ring[i + 1][j + 1], d = ring[i][j + 1];
    idx.push(a, b, d, b, c, d);
  }
  // cubierta
  const deck = [];
  for (let i = 0; i <= S; i++) {
    const u = u0 + (u1 - u0) * i / S, x = (u - .5) * L, w = W / 2 * ancho(u) * .9, y = deckY(u) - .09;
    const l = pos.length / 3; pos.push(x, y, -w); col.push(CUBIERTA.r, CUBIERTA.g, CUBIERTA.b);
    const r = pos.length / 3; pos.push(x, y, w); col.push(CUBIERTA.r, CUBIERTA.g, CUBIERTA.b);
    deck.push([l, r]);
  }
  for (let i = 0; i < S; i++) { const [a, b] = deck[i], [c, d] = deck[i + 1]; idx.push(a, c, b, b, c, d); }
  // tapas en los extremos (popa plana, o corte astillado)
  const tapa = (row, u, rota) => {
    const x = (u - .5) * L, cy = (deckY(u) + keelY(u)) / 2;
    const cIdx = pos.length / 3; pos.push(x, cy, 0);
    const cc = rota ? ASTILLA : CASCO; col.push(cc.r, cc.g, cc.b);
    let vs = row;
    if (rota) { // corte dentado con vértices propios (no mancha el casco)
      vs = row.map((v, j) => { const k = pos.length / 3; pos.push(pos[v * 3] + Math.sin(j * 7.3 + u * 13) * .07 * (u < .5 ? 1 : -1), pos[v * 3 + 1], pos[v * 3 + 2]); col.push(ASTILLA.r, ASTILLA.g, ASTILLA.b); return k; });
    }
    for (let j = 0; j < K; j++) idx.push(cIdx, vs[j], vs[j + 1]), idx.push(cIdx, vs[j + 1], vs[j]);
  };
  if (u0 === 0) tapa(ring[0], u0, false);
  if (tapaRota) { if (u0 > 0) tapa(ring[0], u0, true); if (u1 < 1) tapa(ring[S], u1, true); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function velaCuadrada(w, h, color) {
  const g = new THREE.PlaneGeometry(w, h, 6, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getX(i);
    const bx = Math.cos((z / w) * Math.PI) * Math.cos((y / h) * Math.PI * .9) * h * .22;
    p.setXYZ(i, bx, y, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat('vela' + color, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .32, roughness: 1, side: THREE.DoubleSide })));
}
// vela de cuchillo (en el plano del barco): puntos (x,y) en orden
function velaCuchillo(pts, color, panza = .12) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape, 6);
  const p = g.attributes.position;
  let minX = Infinity, maxX = -Infinity; for (const [x] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = (x - minX) / (maxX - minX || 1); p.setZ(i, Math.sin(t * Math.PI) * panza); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat('vela' + color, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .32, roughness: 1, side: THREE.DoubleSide })));
}
const MADERA = () => mat('madera', () => new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: .9 }));
const HIERRO = () => mat('hierro', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6, metalness: .4 }));

function palo(h, r = .035) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r, h, 6), MADERA());
  m.position.y = h / 2; return m;
}
function verga(w) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, w, 5), MADERA());
  m.rotation.x = Math.PI / 2; return m;
}

const banderaTex = {};
function textBandera(bando) {
  if (banderaTex[bando]) return banderaTex[bando];
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 40;
  const g = cv.getContext('2d'), cs = PALETA[bando].bandera;
  if (bando === 'r') { g.fillStyle = cs[0]; g.fillRect(0, 0, 64, 40); g.fillStyle = cs[1]; g.fillRect(0, 10, 64, 20); g.fillStyle = '#9c2b22'; g.fillRect(14, 15, 7, 10); }
  else cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 40 / 3, 64, 40 / 3 + 1); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return (banderaTex[bando] = t);
}
function bandera(bando, w = .32) {
  const g = new THREE.PlaneGeometry(w, w * .62, 6, 2); g.translate(w / 2, 0, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: textBandera(bando), side: THREE.DoubleSide, roughness: 1 }));
  m.userData.base = Float32Array.from(g.attributes.position.array);
  m.userData.flamea = true;
  return m;
}

// Un mástil con sus velas cuadradas (fragata/bergantín)
function mastilCuadrado(h, anchoV, n, color, bando, conBandera, braza = .55) {
  const g = new THREE.Group();
  g.add(palo(h));
  const aparejo = new THREE.Group(); aparejo.rotation.y = braza; g.add(aparejo);
  let y = h * .26;
  for (let i = 0; i < n; i++) {
    const vh = (h * .68) / n * (1 - i * .08), vw = anchoV * 1.25 * (1 - i * .17);
    const yy = y + vh / 2;
    const v = velaCuadrada(vw, vh * .94, color); v.position.set(.03, yy, 0); aparejo.add(v);
    const vg = verga(vw * 1.08); vg.position.set(.02, yy + vh / 2 - .01, 0); aparejo.add(vg);
    y += vh;
  }
  if (conBandera) { const b = bandera(bando, .3); b.position.set(0, h + .1, 0); g.add(b); }
  return g;
}

export function crearBarco(rolId, bando, largoCeldas) {
  const P = PALETA[bando];
  const L = largoCeldas * .92, W = { fragata: .8, bergantin: .7, goleta: .62, canonera: .62, falucho: .52 }[rolId], H = { fragata: .56, bergantin: .48, goleta: .44, canonera: .4, falucho: .34 }[rolId];
  const barco = new THREE.Group();
  const matCasco = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide });
  // dos mitades, para que se pueda partir
  const popa = new THREE.Group(), proa = new THREE.Group();
  const mPopa = new THREE.Mesh(cascoGeo(L, W, H, 0, .5, P.franja, P.borde, true), matCasco);
  const mProa = new THREE.Mesh(cascoGeo(L, W, H, .5, 1, P.franja, P.borde, true), matCasco);
  popa.add(mPopa); proa.add(mProa);
  barco.add(popa, proa);
  const deckAt = u => H * .42 + .09 * Math.pow((u - .45) * 2, 2) - .09;
  const mastiles = [];
  const ponMastil = (m, u, mitad) => { const x = (u - .5) * L; m.position.set(x, deckAt(u), 0); (mitad || (u < .5 ? popa : proa)).add(m); mastiles.push(m); };
  const v = P.vela;
  if (rolId === 'fragata') {
    ponMastil(mastilCuadrado(2.55, .95, 3, v, bando, false), .2);
    ponMastil(mastilCuadrado(2.95, 1.1, 3, v, bando, true), .48);
    ponMastil(mastilCuadrado(2.6, 1.0, 3, v, bando, false), .74);
    const cang = velaCuchillo([[-.62, .3], [0, .3], [0, 1.25], [-.5, 1.0]], v, .08); cang.position.set((.2 - .5) * L, deckAt(.2), 0); popa.add(cang);
  } else if (rolId === 'bergantin') {
    ponMastil(mastilCuadrado(2.2, .9, 3, v, bando, true), .36);
    ponMastil(mastilCuadrado(2.35, .95, 3, v, bando, false), .7);
  } else if (rolId === 'goleta') {
    for (const [u, h] of [[.32, 2.1], [.68, 1.95]]) {
      const m = new THREE.Group(); m.add(palo(h));
      const s = velaCuchillo([[-.85, .25], [0, .25], [0, h * .92], [-.65, h * .72]], v, .12); m.add(s);
      if (u > .5) { const b = bandera(bando, .24); b.position.set(0, h + .08, 0); m.add(b); }
      m.rotation.z = -.08; ponMastil(m, u);
    }
  } else if (rolId === 'canonera' || rolId === 'falucho') {
    const h = rolId === 'canonera' ? 1.45 : 1.15;
    const m = new THREE.Group(); m.add(palo(h, .03));
    const s = velaCuchillo([[-.55, .22], [.45, .22], [.25, h * .98]], v, .1); m.add(s);
    const b = bandera(bando, .2); b.position.set(0, h + .06, 0); m.add(b);
    ponMastil(m, rolId === 'canonera' ? .42 : .5);
    if (rolId === 'canonera') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .42, 8), HIERRO()); c.rotation.z = -Math.PI / 2; c.position.set((.8 - .5) * L, deckAt(.8) + .07, 0); proa.add(c);
    } else {
      for (const s of [-1, 1]) for (const u of [.3, .55]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.01, .012, .62, 4), MADERA()); r.rotation.x = s * 1.15; r.position.set((u - .5) * L, deckAt(u), s * .28); popa.add(r); }
    }
  }
  // bauprés
  if (rolId !== 'falucho') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.015, .03, L * .3, 5), MADERA());
    b.rotation.z = -Math.PI / 2 + .35; b.position.set(L / 2 + L * .1, deckAt(1) + .08, 0); proa.add(b);
    if (rolId !== 'canonera') { const f = velaCuchillo([[L / 2 - .05, .05], [L / 2 + L * .24, .18], [L / 2 - .05, rolId === 'fragata' ? 1.2 : 1.0]].map(([x, y]) => [x, y]), v, .06); f.position.set(0, deckAt(1), 0); proa.add(f); }
  }
  // toldilla y escotillas
  const matCab = mat('cabina' + bando, () => new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: .9 }));
  const matEsc = mat('escotilla', () => new THREE.MeshStandardMaterial({ color: 0x2e2117, roughness: 1 }));
  if (rolId !== 'falucho') {
    const cw = W * .62, cl = L * (rolId === 'fragata' ? .2 : .16);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cl, .16, cw), matCab); cab.position.set((-.5 + .1) * L + cl * .2, deckAt(.08) + .08, 0); popa.add(cab);
    const techo = new THREE.Mesh(new THREE.BoxGeometry(cl * 1.05, .03, cw * 1.06), mat('techo', () => new THREE.MeshStandardMaterial({ color: 0x6b4c30, roughness: .9 }))); techo.position.copy(cab.position).y += .09; popa.add(techo);
    for (const u of rolId === 'fragata' ? [.36, .6] : [.55]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.16, .03, .2), matEsc); e.position.set((u - .5) * L, deckAt(u) + .015, 0); (u < .5 ? popa : proa).add(e); }
  }
  // cañones de costado (bocas oscuras)
  if (rolId === 'fragata' || rolId === 'bergantin') {
    const n = rolId === 'fragata' ? 5 : 3;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const u = .22 + i * (.56 / (n - 1));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .12, 6), HIERRO());
      c.rotation.x = Math.PI / 2; c.position.set((u - .5) * L, deckAt(u) - .06, s * (W / 2 * ancho(u) + .02));
      (u < .5 ? popa : proa).add(c);
    }
  }
  barco.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  barco.userData = { popa, proa, mastiles, L, W, H, rol: rolId, bando, fase: Math.random() * 10 };
  return barco;
}

// Flamear banderas (llamar cada cuadro)
export function flamear(obj, t) {
  obj.traverse(o => {
    if (!o.userData.flamea) return;
    const p = o.geometry.attributes.position, b = o.userData.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3];
      p.setZ(i, Math.sin(x * 14 - t * 7 + o.id) * x * .25);
    }
    p.needsUpdate = true;
  });
}

// Silueta oscura (lo que se ve con la bengala)
export function crearSilueta() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(.9, .35, .42), new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: 0 }));
  m.position.y = .15; g.add(m);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.4, .05), m.material); mast.position.y = .85; g.add(mast);
  const vela = new THREE.Mesh(new THREE.BoxGeometry(.04, .8, .7), m.material); vela.position.y = .9; g.add(vela);
  g.userData.mat = m.material;
  return g;
}

// Mina flotante
export function crearMina() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 10), HIERRO()); g.add(s);
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.012, .02, .12, 5), HIERRO());
    const th = i / 8 * Math.PI * 2; p.position.set(Math.cos(th) * .16, .06 + (i % 2) * .06, Math.sin(th) * .16); p.lookAt(0, 0, 0); p.rotateX(Math.PI / 2); g.add(p);
  }
  return g;
}

export const PALETA_BANDOS = PALETA;
