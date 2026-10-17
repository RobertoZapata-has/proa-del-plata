// Proa del Plata · barcos de madera hechos con código
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PALETA = {
  p: { franja: 0x9cc2dc, borde: 0x2a1f16, vela: 0xeee4cb, bandera: ['#78b4e3', '#f4f1e8', '#78b4e3'] },
  r: { franja: 0xd0a83e, borde: 0x6a1d16, vela: 0xe8d6b0, bandera: ['#b8261e', '#f2c230', '#b8261e'] },
};
const CASCO = new THREE.Color(0x4b3423), FONDO = new THREE.Color(0x8c4a2c), CUBIERTA = new THREE.Color(0x8f714c), ASTILLA = new THREE.Color(0xd8b484);

const matCache = {};

// ---------- texturas ----------
// Arrancan dibujadas con código (gris con detalle: el color lo pone el barco).
// Si existen texturas/<nombre>.webp (hechas con Gemini), las reemplazan sin tocar los materiales.
const rnd = (() => { let x = 1234567; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
function lienzo(n, dibujar) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  dibujar(cv.getContext('2d'), n);
  return cv;
}
function tablas(g, n, filas, base, var_, veta) {
  const h = n / filas;
  for (let i = 0; i < filas; i++) {
    let x = -rnd() * n;
    while (x < n) { // tablas de largo variable, con su tono
      const l = n * (.35 + rnd() * .5), t = base + (rnd() - .5) * var_;
      g.fillStyle = `rgb(${t},${t},${t})`; g.fillRect(x, i * h, l, h);
      for (let k = 0; k < veta; k++) { // vetas
        const y = i * h + rnd() * h, a = .04 + rnd() * .08;
        g.strokeStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${a})`; g.lineWidth = .6 + rnd() * 1.4;
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * .3, y + (rnd() - .5) * 3, x + l * .7, y + (rnd() - .5) * 3, x + l, y + (rnd() - .5) * 2); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, i * h, 1.5, h); // junta
      g.fillStyle = 'rgba(0,0,0,.35)'; for (const yy of [.3, .7]) { g.beginPath(); g.arc(x + 5, i * h + h * yy, 1.3, 0, 7); g.fill(); } // clavos
      if (x + l > n) { g.save(); g.translate(-n, 0); g.fillStyle = `rgb(${t},${t},${t})`; g.fillRect(x, i * h, l, h); g.restore(); }
      x += l;
    }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, i * h, n, 1.6); // calafateo
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, i * h + 2, n, 1);
  }
  // manchas de agua y brea
  for (let i = 0; i < 40; i++) {
    const x = rnd() * n, y = rnd() * n, r = 8 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${.04 + rnd() * .08})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
const DIBUJOS = {
  'madera-casco': () => lienzo(512, (g, n) => tablas(g, n, 8, 200, 46, 7)),
  'madera-cubierta': () => lienzo(512, (g, n) => tablas(g, n, 10, 222, 30, 5)),
  'lona-vela': () => lienzo(256, (g, n) => {
    g.fillStyle = '#eee'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2500; i++) { const t = 200 + rnd() * 55; g.fillStyle = `rgba(${t},${t},${t},.35)`; g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 3, 1); }
    for (let x = 0; x < n; x += n / 6) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(x, 0, 2, n); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 2, 0, 1, n); } // costuras de los paños
    for (let i = 0; i < 6; i++) { const x = rnd() * n, y = rnd() * n, r = 10 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,70,40,.10)'); gr.addColorStop(1, 'rgba(90,70,40,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }),
};
const DE_GEMINI = ['madera-casco', 'madera-cubierta', 'lona-vela']; // nombres de texturas/<nombre>.webp disponibles
const TEX = {};
function tex(nombre, repetir = true) {
  if (TEX[nombre]) return TEX[nombre];
  const t = new THREE.CanvasTexture(DIBUJOS[nombre]());
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX[nombre] = t;
  if (DE_GEMINI.includes(nombre)) {
    const im = new Image();
    im.onload = () => { t.dispose(); t.image = im; t.needsUpdate = true; }; // dispose: la de Gemini puede tener otro tamaño
    im.src = `texturas/${nombre}.webp`; // si falla, queda la dibujada
  }
  return t;
}
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
  const pos = [], col = [], idx = [], uv = [];
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
      row.push(pos.length / 3); pos.push(x, y, z); uv.push(x / 2, y * 2.2);
      let c = CASCO;
      if (y < -.02) c = FONDO;
      else if (y > dY - .035) c = cB; // regala
      else if (y > dY - .14) c = cF; // la banda pintada, a la altura de las portas
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
    const l = pos.length / 3; pos.push(x, y, -w); col.push(CUBIERTA.r, CUBIERTA.g, CUBIERTA.b); uv.push(x / 1.6 + 7.3, -w * 2.5);
    const r = pos.length / 3; pos.push(x, y, w); col.push(CUBIERTA.r, CUBIERTA.g, CUBIERTA.b); uv.push(x / 1.6 + 7.3, w * 2.5);
    deck.push([l, r]);
  }
  for (let i = 0; i < S; i++) { const [a, b] = deck[i], [c, d] = deck[i + 1]; idx.push(a, c, b, b, c, d); }
  // tapas en los extremos (popa plana, o corte astillado)
  const tapa = (row, u, rota) => {
    const x = (u - .5) * L, cy = (deckY(u) + keelY(u)) / 2;
    const cIdx = pos.length / 3; pos.push(x, cy, 0); uv.push(0, 0);
    const cc = rota ? ASTILLA : CASCO; col.push(cc.r, cc.g, cc.b);
    let vs = row;
    if (rota) { // corte dentado con vértices propios (no mancha el casco)
      vs = row.map((v, j) => { const k = pos.length / 3; pos.push(pos[v * 3] + Math.sin(j * 7.3 + u * 13) * .07 * (u < .5 ? 1 : -1), pos[v * 3 + 1], pos[v * 3 + 2]); col.push(ASTILLA.r, ASTILLA.g, ASTILLA.b); uv.push(uv[v * 2], uv[v * 2 + 1]); return k; });
    }
    for (let j = 0; j < K; j++) idx.push(cIdx, vs[j], vs[j + 1]), idx.push(cIdx, vs[j + 1], vs[j]);
  };
  if (u0 === 0) tapa(ring[0], u0, false);
  if (tapaRota) { if (u0 > 0) tapa(ring[0], u0, true); if (u1 < 1) tapa(ring[S], u1, true); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
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
  return new THREE.Mesh(g, matVela(color));
}
const matVela = color => mat('vela' + color, () => new THREE.MeshStandardMaterial({ color, map: tex('lona-vela'), emissive: color, emissiveMap: tex('lona-vela'), emissiveIntensity: .3, roughness: 1, side: THREE.DoubleSide }));
// vela de cuchillo (en el plano del barco): puntos (x,y) en orden
function velaCuchillo(pts, color, panza = .12) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape, 6);
  const p = g.attributes.position;
  let minX = Infinity, maxX = -Infinity; for (const [x] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = (x - minX) / (maxX - minX || 1); p.setZ(i, Math.sin(t * Math.PI) * panza); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, matVela(color));
}
const MADERA = () => mat('madera', () => new THREE.MeshStandardMaterial({ color: 0x4a3524, map: tex('madera-casco'), roughness: .9 }));
const CABO = () => mat('cabo', () => new THREE.LineBasicMaterial({ color: 0x1c140c, transparent: true, opacity: .75 }));
// jarcias: obenques desde lo alto del palo hasta las bordas
function obenques(h, w, n = 3) {
  const pts = [];
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) { const dx = (k - (n - 1) / 2) * .09 - .05; pts.push(0, h * .86, 0, dx, .03, s * w); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, CABO());
}
function linea(a, b) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b], 3)); return new THREE.LineSegments(g, CABO()); }
const FAROL = () => mat('farol', () => new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb04a, emissiveIntensity: 2.2, roughness: .4 }));
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

// ---------- barcos hechos en Blender (modelos/barcos.glb, ver herramientas/barcos_blender.py) ----------
const MODELOS = {};
export function cargarModelos(ms = 9000) {
  const carga = new Promise(res => {
    new GLTFLoader().load('modelos/barcos.glb', g => {
      for (const rol of ['fragata', 'bergantin', 'goleta', 'canonera', 'falucho']) { const o = g.scene.getObjectByName(rol); if (o) MODELOS[rol] = o; }
      res(Object.keys(MODELOS));
    }, undefined, e => { console.warn('sin modelos de Blender, uso los de código', e); res([]); });
  });
  return Promise.race([carga, new Promise(r => setTimeout(() => r([]), ms))]);
}
function matModelo(n, bando) {
  const P = PALETA[bando];
  const est = (color, map, extra = {}) => new THREE.MeshStandardMaterial({ color, map: map && tex(map), roughness: .85, side: THREE.DoubleSide, ...extra });
  switch (n) {
    case 'madera': return mat('m-madera', () => est(0x5c4130, 'madera-casco'));
    case 'banda': return mat('m-banda' + bando, () => est(P.franja, 'madera-casco'));
    case 'negro': return mat('m-negro', () => est(0x241c15, 'madera-casco'));
    case 'fondo': return mat('m-fondo', () => est(0x84442a, 'madera-casco', { roughness: .7 }));
    case 'cubierta': return mat('m-cubierta', () => est(0xa3845e, 'madera-cubierta'));
    case 'palo': return mat('m-palo', () => est(0x6e4d31, 'madera-casco'));
    case 'bote': return mat('m-bote', () => est(0xe2dccb, 'madera-casco'));
    case 'vela': return matVela(P.vela);
    case 'hierro': return HIERRO();
    case 'farol': return FAROL();
    case 'ventana': return mat('m-ventana', () => new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa040, emissiveIntensity: 1.1, roughness: .5 }));
    case 'porta': return mat('m-porta', () => new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 1 }));
    case 'tapa': return mat('m-tapa', () => est(0x9c2b22, 'madera-casco'));
    case 'dorado': return mat('m-dorado', () => new THREE.MeshStandardMaterial({ color: 0xc09a45, roughness: .45, metalness: .5 }));
    case 'astilla': return mat('m-astilla', () => est(0xd8b484, 'madera-cubierta'));
    default: return mat('m-madera', () => est(0x5c4130, 'madera-casco'));
  }
}
function desdeModelo(rolId, bando, largoCeldas) {
  const o = MODELOS[rolId].clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  const banderas = [], mastiles = [];
  o.traverse(x => {
    if (x.isLine) x.material = CABO();
    else if (x.isMesh) x.material = matModelo((x.material.name || '').replace('pdp_', ''), bando);
    if (/_bandera_/.test(x.name)) banderas.push(x);
    if (/_palo_\d+$/.test(x.name)) mastiles.push(x);
  });
  for (const b of banderas) b.add(bandera(bando, /b$/.test(b.name) ? .3 : .36));
  const W = { fragata: .8, bergantin: .7, goleta: .62, canonera: .62, falucho: .52 }[rolId], H = { fragata: .56, bergantin: .48, goleta: .44, canonera: .4, falucho: .34 }[rolId];
  o.userData = { popa: o.getObjectByName(rolId + '_popa'), proa: o.getObjectByName(rolId + '_proa'), mastiles, L: largoCeldas * .92, W, H, rol: rolId, bando, fase: Math.random() * 10, modelo: true };
  return o;
}

export function crearBarco(rolId, bando, largoCeldas) {
  if (MODELOS[rolId]) return desdeModelo(rolId, bando, largoCeldas);
  const P = PALETA[bando];
  const L = largoCeldas * .92, W = { fragata: .8, bergantin: .7, goleta: .62, canonera: .62, falucho: .52 }[rolId], H = { fragata: .56, bergantin: .48, goleta: .44, canonera: .4, falucho: .34 }[rolId];
  const barco = new THREE.Group();
  const matCasco = mat('casco', () => new THREE.MeshStandardMaterial({ vertexColors: true, map: tex('madera-casco'), roughness: .85, side: THREE.DoubleSide }));
  // dos mitades, para que se pueda partir
  const popa = new THREE.Group(), proa = new THREE.Group();
  const mPopa = new THREE.Mesh(cascoGeo(L, W, H, 0, .5, P.franja, P.borde, true), matCasco);
  const mProa = new THREE.Mesh(cascoGeo(L, W, H, .5, 1, P.franja, P.borde, true), matCasco);
  popa.add(mPopa); proa.add(mProa);
  barco.add(popa, proa);
  const deckAt = u => H * .42 + .09 * Math.pow((u - .45) * 2, 2) - .09;
  const mastiles = [];
  const ponMastil = (m, u, mitad) => {
    const x = (u - .5) * L; m.position.set(x, deckAt(u), 0); (mitad || (u < .5 ? popa : proa)).add(m); mastiles.push(m);
    let h = 0; m.traverse(o => { if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop > .015) h = Math.max(h, o.geometry.parameters.height); });
    if (h) { const ob = obenques(h, W / 2 * ancho(u) * .92, h > 2 ? 3 : 2); ob.rotation.z = -m.rotation.z; m.add(ob); }
  };
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
  // bauprés y estay al palo de proa
  if (rolId !== 'falucho') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.015, .03, L * .3, 5), MADERA());
    b.rotation.z = -Math.PI / 2 + .35; b.position.set(L / 2 + L * .1, deckAt(1) + .08, 0); proa.add(b);
    const m = mastiles[mastiles.length - 1];
    if (m) { let h = 0; m.traverse(o => { if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop > .015) h = Math.max(h, o.geometry.parameters.height); });
      const punta = [L / 2 + L * .23, deckAt(1) + .08 + Math.sin(.35) * L * .15, 0];
      proa.add(linea([m.position.x, m.position.y + h * .9, 0], punta)); }
    if (rolId !== 'canonera') { const f = velaCuchillo([[L / 2 - .05, .05], [L / 2 + L * .24, .18], [L / 2 - .05, rolId === 'fragata' ? 1.2 : 1.0]].map(([x, y]) => [x, y]), v, .06); f.position.set(0, deckAt(1), 0); proa.add(f); }
  }
  // toldilla y escotillas
  const matCab = mat('cabina' + bando, () => new THREE.MeshStandardMaterial({ color: 0x6a4a30, map: tex('madera-casco'), roughness: .9 }));
  const matEsc = mat('escotilla', () => new THREE.MeshStandardMaterial({ color: 0x2e2117, roughness: 1 }));
  if (rolId !== 'falucho') {
    const cw = W * .62, cl = L * (rolId === 'fragata' ? .2 : .16);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cl, .16, cw), matCab);
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .01), FAROL()); v.position.set(-cl * .2 + k * cl * .4, 0, s * (cw / 2 + .004)); cab.add(v); } // ventanitas de la cámara cab.position.set((-.5 + .1) * L + cl * .2, deckAt(.08) + .08, 0); popa.add(cab);
    const techo = new THREE.Mesh(new THREE.BoxGeometry(cl * 1.05, .03, cw * 1.06), mat('techo', () => new THREE.MeshStandardMaterial({ color: 0x8a6a48, map: tex('madera-cubierta'), roughness: .9 }))); techo.position.copy(cab.position).y += .09; popa.add(techo);
    for (const u of rolId === 'fragata' ? [.36, .6] : [.55]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.16, .03, .2), matEsc); e.position.set((u - .5) * L, deckAt(u) + .015, 0); (u < .5 ? popa : proa).add(e); }
  }
  // farol de popa (se ve de noche)
  if (rolId !== 'falucho') {
    const f = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 6), FAROL()); f.position.set(-L / 2 + .03, deckAt(0) + .25, 0); popa.add(f);
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .2, 4), HIERRO()); pf.position.set(-L / 2 + .03, deckAt(0) + .14, 0); popa.add(pf);
    f.userData.farol = true;
  }
  // cañones de costado, asomando por sus portas
  const matPorta = mat('porta', () => new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 1 }));
  if (rolId === 'fragata' || rolId === 'bergantin') {
    const n = rolId === 'fragata' ? 5 : 3;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const u = .22 + i * (.56 / (n - 1));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .09, 6), HIERRO());
      const borda = W / 2 * ancho(u) * .84; // el costado arriba está a ~0.82 del ancho
      c.rotation.x = Math.PI / 2; c.position.set((u - .5) * L, deckAt(u) - .02, s * (borda + .035));
      const pt = new THREE.Mesh(new THREE.BoxGeometry(.075, .065, .02), matPorta); pt.position.set(c.position.x, c.position.y, s * (borda + .004));
      (u < .5 ? popa : proa).add(c, pt);
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
