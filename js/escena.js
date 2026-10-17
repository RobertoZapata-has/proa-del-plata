// Proa del Plata · el río en 3D
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { crearBarco, flamear, crearSilueta, crearMina } from './barcos.js';
import { N, rol, celdasDe, terreno, LETRAS } from './reglas.js';

const SEP = 15;
export const CENTROS = { mio: new THREE.Vector3(0, 0, SEP), rival: new THREE.Vector3(0, 0, -SEP) };

// ---------- Olas (la misma cuenta en JS y en el shader) ----------
const OLAS = [[.95, .31, .9, .05, 1.1], [-.37, .93, 1.4, .03, 1.6], [.76, -.65, 2.3, .015, 2.2]];
export function ola(x, z, t) { let h = 0; for (const [dx, dz, k, a, w] of OLAS) h += a * Math.sin(k * (dx * x + dz * z) + w * t); return h; }
const GLSL_OLA = `float ola(vec2 p, float t){ float h=0.;
${OLAS.map(([dx, dz, k, a, w]) => `h += ${a.toFixed(4)}*sin(${k.toFixed(3)}*dot(vec2(${dx.toFixed(3)},${dz.toFixed(3)}),p)+${w.toFixed(3)}*t);`).join('\n')}
return h; }`;
const GLSL_RUIDO = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float ruido(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*ruido(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return v; }`;

// ---------- Paletas de día y de noche ----------
const PALETAS = {
  dia: {
    hondo: 0x2c4442, medio: 0x5f7563, cielo: 0xe2c592, sol: 0xffe2a8, niebla: 0xcaa982,
    zenit: 0x34506e, horizonte: 0xf2b877, nubeOsc: 0x3c4150, nubeLuz: 0xffe0b0,
    solDir: new THREE.Vector3(-.42, .42, -1).normalize(), luzSol: 0xfff0d8, intSol: 2.6, hemiA: 0xcfd8e0, hemiB: 0x3a3426, intHemi: 1.25,
    tinta: 0xf6ead0, tintaOp: .55, costa: 0x4a5a62, agua: 0x08486e, niebla3: 0xa6c4da, exp: .5,
  },
  noche: {
    hondo: 0x0c1a2a, medio: 0x1e3652, cielo: 0x3a5272, sol: 0xc8daf0, niebla: 0x142236,
    zenit: 0x08101e, horizonte: 0x26395a, nubeOsc: 0x101a2c, nubeLuz: 0x4a6286,
    solDir: new THREE.Vector3(.35, .32, -1).normalize(), luzSol: 0xb4cbea, intSol: 1.4, hemiA: 0x6a84ac, hemiB: 0x141c2c, intHemi: 1.35,
    tinta: 0xbdd0ea, tintaOp: .42, costa: 0x070b12, agua: 0x050d16, niebla3: 0x0b1422, exp: .95,
  },
};

// ---------- Partículas ----------
class Particulas {
  constructor(escena, max, aditivo) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.alf = new Float32Array(max); this.tam = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alf, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = { value: 400 };
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float aSize, aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC; varying float vS;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/max(.1,-mv.z); vA=aAlpha; vC=pow(aColor,vec3(2.2)); vS=fract(position.x*13.1+position.z*7.7); }`,
      fragmentShader: `varying float vA; varying vec3 vC; varying float vS;
        void main(){ vec2 p=gl_PointCoord-.5; float d=length(p) + (sin(atan(p.y,p.x)*5.+vS*20.)*.04);
          float a=smoothstep(.5,.12,d)*vA; if(a<.01) discard; gl_FragColor=vec4(vC,a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.obj = new THREE.Points(g, m); this.obj.frustumCulled = false; this.obj.renderOrder = aditivo ? 6 : 5;
    escena.add(this.obj);
    this.p = [];
  }
  emitir(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, vida: 0, max: o.vida || 1, t0: o.t0 ?? .2, t1: o.t1 ?? .4,
      c: o.c || [1, 1, 1], c1: o.c1 || o.c || [1, 1, 1], a0: o.a0 ?? 1, a1: o.a1 ?? 0, g: o.g || 0, roce: o.roce || 0, entra: o.entra || 0 });
  }
  actualizar(dt) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.vida += dt;
      if (q.vida >= q.max) { P.splice(i, 1); continue; }
      q.vy -= q.g * dt; const f = Math.max(0, 1 - q.roce * dt); q.vx *= f; q.vy *= f; q.vz *= f;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const q = P[i], k = q.vida / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.c[0] + (q.c1[0] - q.c[0]) * k; this.col[i * 3 + 1] = q.c[1] + (q.c1[1] - q.c[1]) * k; this.col[i * 3 + 2] = q.c[2] + (q.c1[2] - q.c[2]) * k;
      const ent = q.entra ? Math.min(1, q.vida / q.entra) : 1;
      this.alf[i] = (q.a0 + (q.a1 - q.a0) * k) * ent;
      this.tam[i] = q.t0 + (q.t1 - q.t0) * Math.sqrt(k);
    }
    const g = this.obj.geometry; g.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aAlpha', 'aSize']) g.attributes[k].needsUpdate = true;
  }
}
const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ---------- Texturas de marcas (tinta) ----------
function texMarca(tipo) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
  const trazo = (w, c, f) => { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); f(); g.stroke(); };
  if (tipo === 'agua') { trazo(16, 'rgba(20,14,8,.35)', () => g.arc(64, 64, 30, 0, 7)); trazo(9, '#f4ead2', () => g.arc(64, 64, 30, 0, 7)); }
  if (tipo === 'aguaMia') { trazo(7, 'rgba(230,240,250,.8)', () => g.arc(64, 64, 22, 0, 7)); }
  if (tipo === 'impacto' || tipo === 'hundido') {
    if (tipo === 'hundido') { g.fillStyle = 'rgba(70,8,4,.55)'; g.fillRect(6, 6, 116, 116); }
    const x = () => { g.moveTo(30, 30); g.lineTo(98, 98); g.moveTo(98, 30); g.lineTo(30, 98); };
    trazo(26, 'rgba(25,8,4,.6)', x); trazo(15, tipo === 'hundido' ? '#ff9a6a' : '#e2462c', x);
  }
  if (tipo === 'humo') { const w = () => { for (let i = 0; i < 3; i++) { g.moveTo(26, 44 + i * 20); g.bezierCurveTo(46, 30 + i * 20, 62, 58 + i * 20, 102, 44 + i * 20); } }; trazo(14, 'rgba(0,0,0,.35)', w); trazo(8, '#b9b4ac', w); }
  if (tipo === 'mina') { g.fillStyle = '#ffb347'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 24 : 54; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill(); g.strokeStyle = '#5a1d00'; g.lineWidth = 5; g.stroke(); }
  if (tipo === 'celda') { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); }
  if (tipo === 'marco') { g.strokeStyle = '#fff'; g.lineWidth = 14; g.strokeRect(7, 7, 114, 114); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(14, 14, 100, 100); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texTexto(txt, { color = '#f6ead0', sombra = 'rgba(0,0,0,.6)', fondo = null, tam = 84, ancho = 128 } = {}) {
  const cv = document.createElement('canvas'); cv.width = ancho; cv.height = 128;
  const g = cv.getContext('2d');
  if (fondo) { g.fillStyle = fondo; g.beginPath(); g.arc(ancho / 2, 64, 54, 0, 7); g.fill(); g.strokeStyle = '#3a2614'; g.lineWidth = 6; g.stroke(); }
  g.font = `${tam}px "IM Fell English SC", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (sombra) { g.fillStyle = sombra; g.fillText(txt, ancho / 2 + 3, 68); }
  g.fillStyle = color; g.fillText(txt, ancho / 2, 65);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const ease = { io: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t, lin: t => t };

// =====================================================================
export function crearEscena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .62;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const escena = new THREE.Scene();
  const capa = new THREE.Scene(); // marcas nítidas encima del cuadro
  const cam = new THREE.PerspectiveCamera(40, 1, .1, 700);
  cam.position.set(0, 14, SEP + 14);

  let pal = PALETAS.dia, noche = false, expBase = .62;
  let dormido = false;

  // ---------- Cielo ----------
  // de día: cielo físico (Sky) · de noche: cielo propio con luna y estrellas
  const cieloDia = new Sky(); cieloDia.scale.setScalar(500); escena.add(cieloDia);
  { const u = cieloDia.material.uniforms; u.turbidity.value = 2.2; u.rayleigh.value = 3.2; u.mieCoefficient.value = .003; u.mieDirectionalG.value = .82; }
  const uCielo = {
    uZenit: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uSol: { value: new THREE.Color() }, uSolDir: { value: new THREE.Vector3() },
    uNubeOsc: { value: new THREE.Color() }, uNubeLuz: { value: new THREE.Color() }, uNoche: { value: 0 }, uT: { value: 0 },
  };
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    uniforms: uCielo, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uZenit,uHorizonte,uSol,uSolDir,uNubeOsc,uNubeLuz; uniform float uNoche,uT; varying vec3 vD;
${GLSL_RUIDO}
void main(){ vec3 d=normalize(vD); float y=d.y;
  vec3 col=mix(uHorizonte,uZenit,smoothstep(0.,.45,pow(clamp(y,0.,1.),.7)));
  if(y<0.) col=uHorizonte;
  vec2 p=d.xz/(max(y,.03)+.18);
  float c=fbm(p*.7+vec2(uT*.006,0.)); c=smoothstep(.44,.8,c);
  float s=max(dot(d,uSolDir),0.);
  float lz=clamp(pow(s,3.)*1.4+(fbm(p*2.3+3.)-.5)*.9+.15,0.,1.);
  vec3 nube=mix(uNubeOsc,uNubeLuz,lz);
  col=mix(col,nube,c*smoothstep(-.02,.1,y)*.88);
  col+=uSol*(pow(s,2200.)*3.+pow(s,60.)*.35);
  vec2 q=floor(d.xz/(y+.35)*200.); float h=hash(q); col+=step(.998,h)*smoothstep(.15,.45,y)*.5*(1.-c);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  }));
  cielo.renderOrder = -10; escena.add(cielo);

  // ---------- Agua (reflejos reales del cielo y los barcos) ----------
  const normales = new THREE.TextureLoader().load('texturas/agua-normales.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  normales.wrapS = normales.wrapT = THREE.RepeatWrapping;
  const agua = new Water(new THREE.PlaneGeometry(900, 900), {
    textureWidth: 512, textureHeight: 512, waterNormals: normales,
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x22332c, distortionScale: 2.6, fog: true,
  });
  agua.rotation.x = -Math.PI / 2; agua.material.uniforms.size.value = 2.2;
  // más azul: el sol difuso se tiñe con el color del agua y el reflejo del cielo tira a celeste
  agua.material.fragmentShader = agua.material.fragmentShader.replace(
    'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);',
    'vec3 albedo = mix( ( sunColor * diffuseLight * 0.35 * ( waterColor * 3.0 + 0.08 ) + scatter * 1.5 ) * getShadowMask(), ( vec3( 0.02, 0.06, 0.1 ) + reflectionSample * vec3( 0.72, 0.86, 1.0 ) * 0.9 + reflectionSample * specularLight ), reflectance);');
  escena.add(agua);
  escena.fog = new THREE.Fog(0xb7bcb6, 70, 330);

  // costa lejana
  const costaGeo = new THREE.CylinderGeometry(240, 240, 1, 200, 1, true);
  { const p = costaGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); if (y > 0) { const a = Math.atan2(z, x); p.setY(i, 2 + 7 * Math.pow(Math.abs(Math.sin(a * 3.1) * Math.sin(a * 7.3 + 1)), 1.5) + 1.5 * Math.sin(a * 23) + 1.2 * Math.sin(a * 61)); } else p.setY(i, -1); } costaGeo.computeVertexNormals(); }
  const costa = new THREE.Mesh(costaGeo, new THREE.MeshLambertMaterial({ color: pal.costa, side: THREE.BackSide }));
  escena.add(costa);

  // luces
  const hemi = new THREE.HemisphereLight(pal.hemiA, pal.hemiB, pal.intHemi); escena.add(hemi);
  const sol = new THREE.DirectionalLight(pal.luzSol, pal.intSol); escena.add(sol); escena.add(sol.target);
  const luzBengala = new THREE.PointLight(0xfff0c8, 0, 22, 1.6); escena.add(luzBengala);
  const luzFogonazo = new THREE.PointLight(0xffb060, 0, 14, 2); escena.add(luzFogonazo);

  const humo = new Particulas(escena, 1400, false);
  const fuego = new Particulas(escena, 1400, true);

  // astillas (cajitas que saltan)
  const MAX_AST = 260;
  const astillas = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .025, .03), new THREE.MeshStandardMaterial({ color: 0x9c7a50, roughness: .9 }), MAX_AST);
  astillas.instanceMatrix.setUsage(THREE.DynamicDrawUsage); astillas.count = 0; astillas.frustumCulled = false; escena.add(astillas);
  const astP = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

  function setPaleta() {
    pal = noche ? PALETAS.noche : PALETAS.dia;
    uCielo.uZenit.value.set(pal.zenit); uCielo.uHorizonte.value.set(pal.horizonte); uCielo.uSol.value.set(pal.sol); uCielo.uSolDir.value.copy(pal.solDir);
    uCielo.uNubeOsc.value.set(pal.nubeOsc); uCielo.uNubeLuz.value.set(pal.nubeLuz); uCielo.uNoche.value = noche ? 1 : 0;
    cieloDia.visible = !noche; cielo.visible = noche;
    cieloDia.material.uniforms.sunPosition.value.copy(pal.solDir);
    agua.material.uniforms.sunDirection.value.copy(pal.solDir);
    agua.material.uniforms.sunColor.value.set(noche ? 0x9fb4d0 : 0xfff1d8);
    agua.material.uniforms.waterColor.value.set(pal.agua);
    escena.fog.color.set(pal.niebla3); escena.fog.near = noche ? 40 : 70; escena.fog.far = noche ? 220 : 330;
    expBase = pal.exp;
    hemi.color.set(pal.hemiA); hemi.groundColor.set(pal.hemiB); hemi.intensity = pal.intHemi;
    sol.color.set(pal.luzSol); sol.intensity = pal.intSol; sol.position.copy(pal.solDir).multiplyScalar(50); sol.target.position.set(0, 0, 0);
    costa.material.color.set(pal.costa);
    for (const t of Object.values(tableros)) { t.grilla.material.color.set(pal.tinta); t.grilla.material.opacity = pal.tintaOp; }
  }

  // ---------- Tableros: grilla, rótulos, islas, bancos ----------
  const tableros = {};
  const texM = { agua: texMarca('agua'), aguaMia: texMarca('aguaMia'), impacto: texMarca('impacto'), hundido: texMarca('hundido'), humo: texMarca('humo'), mina: texMarca('mina'), celda: texMarca('celda'), marco: texMarca('marco') };
  const geoCelda = new THREE.PlaneGeometry(.94, .94).rotateX(-Math.PI / 2);
  const centroCelda = (tab, r, c) => new THREE.Vector3(CENTROS[tab].x - 4.5 + c, 0, CENTROS[tab].z - 4.5 + r);

  for (const tab of ['mio', 'rival']) {
    const C = CENTROS[tab];
    const pts = [];
    for (let i = 0; i <= N; i++) {
      pts.push(C.x - 5 + i, .06, C.z - 5, C.x - 5 + i, .06, C.z + 5);
      pts.push(C.x - 5, .06, C.z - 5 + i, C.x + 5, .06, C.z - 5 + i);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grilla = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: pal.tinta, transparent: true, opacity: pal.tintaOp, depthTest: false }));
    capa.add(grilla);
    // marco grueso
    const marco = new THREE.Group();
    for (const [w, h, x, z] of [[10.16, .08, 0, -5], [10.16, .08, 0, 5], [.08, 10.16, -5, 0], [.08, 10.16, 5, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd9b46a, transparent: true, opacity: .7, depthTest: false }));
      m.position.set(C.x + x, .06, C.z + z); marco.add(m);
    }
    capa.add(marco);
    // rótulos
    const rot = new THREE.Group();
    for (let i = 0; i < N; i++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texTexto(LETRAS[i]), transparent: true, depthTest: false }));
      l.position.set(C.x - 4.5 + i, .06, C.z - 5.45); rot.add(l);
      const nn = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texTexto(String(i + 1), { tam: 70 }), transparent: true, depthTest: false }));
      nn.position.set(C.x - 5.45, .06, C.z - 4.5 + i); rot.add(nn);
    }
    capa.add(rot);
    const marcas = new THREE.Group(); capa.add(marcas);
    const resalte = new THREE.Group(); capa.add(resalte);
    const sondeos = new THREE.Group(); capa.add(sondeos);
    const terreno3d = new THREE.Group(); escena.add(terreno3d);
    tableros[tab] = { grilla, marco, rot, marcas, resalte, sondeos, terreno3d, mapaMarcas: new Map() };
  }

  // islas y bancos
  let mapaActual = null;
  function ponerMapa(mapa) {
    mapaActual = mapa;
    for (const tab of ['mio', 'rival']) {
      const T = tableros[tab]; T.terreno3d.clear();
      const rnd = semilla(mapa.id + tab);
      const matIsla = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
      const matArbol = new THREE.MeshStandardMaterial({ color: 0x4d6230, roughness: 1 });
      const matBanco = new THREE.MeshBasicMaterial({ map: texBanco(), color: 0xd9c08a, transparent: true, opacity: noche ? .25 : .42, depthWrite: false });
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = terreno(mapa, r, c), p = centroCelda(tab, r, c);
        if (t === 'isla') {
          const g = new THREE.IcosahedronGeometry(.78, 3);
          const pa = g.attributes.position, cols = [];
          for (let i = 0; i < pa.count; i++) {
            _v.fromBufferAttribute(pa, i);
            const n = 1 + .22 * Math.sin(_v.x * 5 + r) * Math.cos(_v.z * 4 + c) + .1 * Math.sin(_v.y * 9);
            _v.multiplyScalar(n); _v.y = Math.max(-.2, _v.y * .42);
            pa.setXYZ(i, _v.x, _v.y, _v.z);
            const col = new THREE.Color(_v.y < .05 ? 0xdcc38c : _v.y < .13 ? 0x9a9450 : 0x667a3a);
            cols.push(col.r, col.g, col.b);
          }
          g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
          const m = new THREE.Mesh(g, matIsla); m.position.copy(p); m.rotation.y = rnd() * 6; T.terreno3d.add(m);
          const na = 1 + Math.floor(rnd() * 3);
          for (let k = 0; k < na; k++) {
            const a = new THREE.Mesh(new THREE.ConeGeometry(.16 + rnd() * .1, .55 + rnd() * .35, 6), matArbol);
            a.position.set(p.x + (rnd() - .5) * .7, .32 + rnd() * .1, p.z + (rnd() - .5) * .7); T.terreno3d.add(a);
          }
        } else if (t === 'banco') {
          const g = new THREE.PlaneGeometry(1.5, 1.5); g.rotateX(-Math.PI / 2); g.rotateY(rnd() * 6);
          const m = new THREE.Mesh(g, matBanco); m.position.set(p.x, .09, p.z); m.renderOrder = 1; T.terreno3d.add(m);
        }
      }
    }
  }
  let _texBanco = null;
  function texBanco() {
    if (_texBanco) return _texBanco;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,95,50,${Math.random() * .25})`; g.beginPath(); g.ellipse(30 + Math.random() * 68, 30 + Math.random() * 68, 3 + Math.random() * 10, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }
    _texBanco = new THREE.CanvasTexture(cv); _texBanco.colorSpace = THREE.SRGBColorSpace; return _texBanco;
  }
  function semilla(s) { let a = [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Barcos ----------
  const barcos = { mio: new Map(), rival: new Map() }; // clave → { obj, desc }
  function posBarco(tab, d) {
    const L = rol(d.rol).largo, cs = celdasDe(d);
    const a = centroCelda(tab, cs[0][0], cs[0][1]), b = centroCelda(tab, cs[L - 1][0], cs[L - 1][1]);
    return { pos: a.add(b).multiplyScalar(.5), rotY: d.h ? 0 : -Math.PI / 2 };
  }
  function ponerBarco(tab, clave, d, bando) {
    let e = barcos[tab].get(clave);
    if (e && e.obj.userData.rol !== d.rol) { escena.remove(e.obj); e = null; }
    if (!e) {
      const obj = crearBarco(d.rol, bando, rol(d.rol).largo);
      e = { obj, desc: d }; barcos[tab].set(clave, e); escena.add(obj);
    }
    if (e.animando) return e;
    const { pos, rotY } = posBarco(tab, d);
    e.base = pos; e.rotY = rotY; e.desc = d;
    return e;
  }
  function propios(obj) { obj.traverse(m => { if (m.isMesh || m.isLine) m.material = m.material.clone(); }); }
  function quitarBarco(tab, clave) { const e = barcos[tab].get(clave); if (e && !e.animando) { escena.remove(e.obj); barcos[tab].delete(clave); } }

  // flota propia: lista de { rol, h, r, c, hundido }
  function flota(lista, bando) {
    const vivos = new Set();
    lista.forEach((d, i) => { if (!d.hundido) { ponerBarco('mio', 'b' + i, d, bando); vivos.add('b' + i); } });
    for (const k of [...barcos.mio.keys()]) if (!vivos.has(k)) quitarBarco('mio', k);
  }

  // ---------- Fuegos persistentes ----------
  const fuegos = new Map(); // clave → { pos, tipo, acc }
  function ponerFuegos(lista) {
    const vistos = new Set();
    for (const f of lista) {
      const k = f.clave; vistos.add(k);
      const p = f.pos || centroCelda(f.tab, f.r, f.c);
      const ex = fuegos.get(k);
      if (ex) { ex.pos.copy(p); ex.pos.y = f.y ?? .05; ex.tipo = f.tipo; ex.sigue = f.sigue; continue; }
      fuegos.set(k, { pos: p.clone().setY(f.y ?? .05), tipo: f.tipo, acc: Math.random(), sigue: f.sigue });
    }
    for (const k of [...fuegos.keys()]) if (!vistos.has(k)) fuegos.delete(k);
  }

  // ---------- Restos flotando ----------
  const restos = new Map(); // clave → [{ mesh, x, z, rot }]
  const matBarril = new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: .9 });
  const matTabla = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: .9 });
  const geoBarril = new THREE.CylinderGeometry(.07, .07, .17, 8), geoTabla = new THREE.BoxGeometry(.42, .035, .09);
  function ponerRestos(clave, centro, largo, h, rnd = Math.random, deriva = false) {
    if (restos.has(clave)) return;
    const lista = [];
    const n = 4 + largo * 2;
    for (let i = 0; i < n; i++) {
      const barril = rnd() < .35;
      const m = new THREE.Mesh(barril ? geoBarril : geoTabla, barril ? matBarril : matTabla);
      const along = (rnd() - .5) * largo * .95, across = (rnd() - .5) * .9;
      const x = centro.x + (h ? along : across), z = centro.z + (h ? across : along);
      const it = { mesh: m, x, z, rot: rnd() * 6, fase: rnd() * 6, barril };
      if (deriva) { it.vx = (rnd() - .5) * .6; it.vz = (rnd() - .5) * .6; }
      if (barril) m.rotation.z = Math.PI / 2;
      escena.add(m); lista.push(it);
    }
    restos.set(clave, lista);
  }
  function quitarRestos() { for (const l of restos.values()) for (const it of l) escena.remove(it.mesh); restos.clear(); }

  // ---------- Marcas de tinta ----------
  const matMarca = {};
  for (const k of Object.keys(texM)) matMarca[k] = () => new THREE.MeshBasicMaterial({ map: texM[k], transparent: true, depthTest: false, depthWrite: false });
  // matriz: N×N de { e, t } · opts.recientes: Set de 'r,c' recién llegadas · opts.mio: tablero propio
  let reloj = 0;
  function marcas(tab, matriz, opts = {}) {
    const T = tableros[tab];
    const vistas = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let e = matriz[r][c].e;
      if (e === '?' || e === 'visto') continue;
      if (opts.mio && e === 'impacto') continue; // en mi flota ya se ve el fuego
      if (opts.mio && e === 'agua') e = 'aguaMia';
      if (opts.mio && e === 'mina') continue;
      const k = r + ',' + c; vistas.add(k);
      const ex = T.mapaMarcas.get(k);
      if (ex && ex.e === e) continue;
      if (ex) T.marcas.remove(ex.mesh);
      const mesh = new THREE.Mesh(geoCelda, matMarca[e]());
      const p = centroCelda(tab, r, c); mesh.position.set(p.x, .07, p.z); mesh.renderOrder = 3;
      if (e === 'aguaMia') mesh.scale.setScalar(.8);
      const reciente = opts.recientes && opts.recientes.has(k);
      T.marcas.add(mesh);
      T.mapaMarcas.set(k, { e, mesh, t0: reciente ? reloj : (opts.restaurando ? -999 : reloj), noche: !!opts.noche, cuenta: matriz[r][c].t });
    }
    for (const [k, m] of [...T.mapaMarcas]) if (!vistas.has(k)) { T.marcas.remove(m.mesh); T.mapaMarcas.delete(k); }
  }
  function limpiarMarcas() { for (const tab of ['mio', 'rival']) { const T = tableros[tab]; T.marcas.clear(); T.mapaMarcas.clear(); T.sondeos.clear(); T.resalte.clear(); } }

  // insignias de sondaleza
  function insignias(tab, lista) {
    const T = tableros[tab]; T.sondeos.clear();
    for (const s of lista) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.72, .72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texTexto(String(s.cuenta), { color: '#2a1d0c', sombra: null, fondo: '#efdfb8', tam: 76 }), transparent: true, depthTest: false }));
      const C = CENTROS[tab];
      if (s.h) m.position.set(C.x + 5.5, .07, C.z - 4.5 + s.r); else m.position.set(C.x - 4.5 + s.c, .07, C.z + 5.5);
      T.sondeos.add(m);
    }
  }

  // resaltados: lista de { r, c, tipo } tipo: sel | mal | apunta | area | nope | visto
  const COL_RES = { sel: 0xf2c35a, mal: 0xff4a3a, apunta: 0xffd36b, area: 0xffe7a8, nope: 0xff4a3a, visto: 0xffe2a0, mina: 0xffa040 };
  function resaltar(tab, lista) {
    const T = tableros[tab]; T.resalte.clear();
    for (const x of lista || []) {
      const m = new THREE.Mesh(geoCelda, new THREE.MeshBasicMaterial({ map: x.tipo === 'apunta' || x.tipo === 'sel' ? texM.marco : texM.celda, color: COL_RES[x.tipo], transparent: true, opacity: x.tipo === 'apunta' ? .95 : x.tipo === 'sel' ? .9 : x.tipo === 'area' ? .35 : .4, depthTest: false }));
      const p = centroCelda(tab, x.r, x.c); m.position.set(p.x, .075, p.z); m.renderOrder = 4; m.userData.pulsa = x.tipo === 'apunta' || x.tipo === 'visto';
      T.resalte.add(m);
    }
  }

  // mina propia
  let minaObj = null;
  function ponerMina(m) {
    if (minaObj && (!m || minaObj.userData.r !== m.r || minaObj.userData.c !== m.c)) { escena.remove(minaObj); minaObj = null; }
    if (m && !minaObj) { minaObj = crearMina(); minaObj.userData = { r: m.r, c: m.c }; minaObj.position.copy(centroCelda('mio', m.r, m.c)); escena.add(minaObj); }
  }

  // ---------- Cámara ----------
  let margenSup = 120, margenInf = 160, mirando = 'mio';
  const camObj = { pos: new THREE.Vector3(), mira: new THREE.Vector3() };
  let temblor = 0;
  function encuadre(tab) {
    const C = CENTROS[tab], W = renderer.domElement.clientWidth || innerWidth, H = renderer.domElement.clientHeight || innerHeight;
    cam.aspect = W / H; cam.updateProjectionMatrix();
    const el = THREE.MathUtils.degToRad(W > H ? 46 : 52);
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const top = 1 - 2 * (margenSup / H), bot = -1 + 2 * (margenInf / H);
    const esquinas = [[-5.9, -6], [5.9, -6], [-5.9, 6.1], [5.9, 6.1]].map(([x, z]) => new THREE.Vector3(C.x + x, 0, C.z + z));
    let mira = C.clone(), dist = 20;
    const prueba = (d, m) => {
      cam.position.copy(m).addScaledVector(dir, d); cam.lookAt(m); cam.updateMatrixWorld();
      let ok = true, ymin = 9, ymax = -9;
      for (const e of esquinas) { const p = e.clone().project(cam); if (Math.abs(p.x) > .97) ok = false; ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
      if (ymax - ymin > top - bot) ok = false;
      return { ok, ymin, ymax };
    };
    for (let it = 0; it < 3; it++) {
      let lo = 6, hi = 120;
      for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (prueba(mid, mira).ok) hi = mid; else lo = mid; }
      dist = hi;
      const { ymin, ymax } = prueba(dist, mira);
      const desv = (ymin + ymax) / 2 - (top + bot) / 2;
      mira = mira.clone().add(new THREE.Vector3(0, 0, -desv * dist * .42));
    }
    return { pos: mira.clone().addScaledVector(dir, dist), mira };
  }
  function mirar(tab, inmediato = false, dur = 1.2) {
    mirando = tab;
    const dest = encuadre(tab);
    if (inmediato) { if (twCam) { const i = tweens.indexOf(twCam); if (i >= 0) tweens.splice(i, 1); twCam.res(); } camObj.pos.copy(dest.pos); camObj.mira.copy(dest.mira); return Promise.resolve(); }
    const p0 = camObj.pos.clone(), m0 = camObj.mira.clone();
    return tweenCam(dur, k => {
      camObj.pos.lerpVectors(p0, dest.pos, k); camObj.mira.lerpVectors(m0, dest.mira, k);
      camObj.pos.y += Math.sin(k * Math.PI) * 5;
    }, ease.io);
  }
  // acercar la cámara a un punto (para los golpes) y volver
  function enfocar(punto, cuanto = .45, dur = .8) {
    const base = encuadre(mirando);
    const dir = base.pos.clone().sub(base.mira);
    const mira = base.mira.clone().lerp(punto, .75);
    const pos = mira.clone().addScaledVector(dir, 1 - cuanto);
    const p0 = camObj.pos.clone(), m0 = camObj.mira.clone();
    return tweenCam(dur, k => { camObj.pos.lerpVectors(p0, pos, k); camObj.mira.lerpVectors(m0, mira, k); }, ease.io);
  }
  function volver(dur = 1) {
    const d = encuadre(mirando); const p0 = camObj.pos.clone(), m0 = camObj.mira.clone();
    return tweenCam(dur, k => { camObj.pos.lerpVectors(p0, d.pos, k); camObj.mira.lerpVectors(m0, d.mira, k); }, ease.io);
  }
  let cine = false, camFija = null, fijo = false, velocidad = 1;
  function grilla(v) { for (const t of Object.values(tableros)) { t.grilla.visible = v; t.marco.visible = v; t.rot.visible = v; t.marcas.visible = v; t.sondeos.visible = v; t.resalte.visible = v; } }
  function cinematica(v) { cine = v; }
  function margenes(sup, inf) { margenSup = sup; margenInf = inf; if (fijo) return; const d = encuadre(mirando); camObj.pos.copy(d.pos); camObj.mira.copy(d.mira); }

  // ---------- Tiempo y animaciones ----------
  const tweens = [];
  function tween(dur, fn, e = ease.lin) { return new Promise(res => tweens.push({ t: 0, dur, fn, e, res })); }
  let twCam = null;
  function tweenCam(dur, fn, e = ease.io) {
    if (twCam) { const i = tweens.indexOf(twCam); if (i >= 0) tweens.splice(i, 1); twCam.res(); }
    return new Promise(res => { twCam = { t: 0, dur, fn, e, res: () => { if (twCam === w) twCam = null; res(); } }; const w = twCam; tweens.push(w); });
  }
  const espera = s => tween(s, () => {});

  // ---------- Efectos ----------
  function chorro(p, fuerza = 1) { // columna de agua
    for (let i = 0; i < 70 * fuerza; i++) {
      const a = Math.random() * 6.28, r = Math.random() * .22;
      humo.emitir({ x: p.x + Math.cos(a) * r, y: .05, z: p.z + Math.sin(a) * r, vx: Math.cos(a) * (.4 + Math.random()) * .8, vy: 3 + Math.random() * 3.5 * fuerza, vz: Math.sin(a) * (.4 + Math.random()) * .8,
        vida: 1 + Math.random() * .6, t0: .22, t1: .5, c: noche ? [.7, .8, .95] : [.97, .95, .9], a0: .9, a1: 0, g: 7, roce: .4 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.28;
      humo.emitir({ x: p.x, y: .08, z: p.z, vx: Math.cos(a) * 1.4, vz: Math.sin(a) * 1.4, vida: 1.2, t0: .3, t1: .9, c: [.95, .93, .88], a0: .7, a1: 0, roce: 2.5 });
    }
    onda(p, 1.3 * fuerza);
  }
  const ondas = [];
  function onda(p, max = 1.2, col = 0xf4ecd8) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .7, depthWrite: false }));
    m.position.set(p.x, .1, p.z); m.scale.setScalar(.1); m.renderOrder = 2; escena.add(m);
    ondas.push({ m, t: 0, dur: 1.6, max });
  }
  function astillar(p, n = 26, fuerza = 1) {
    for (let i = 0; i < n; i++) {
      if (astP.length >= MAX_AST) astP.shift();
      const a = Math.random() * 6.28;
      astP.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * (1 + Math.random() * 2.5) * fuerza, vy: (2 + Math.random() * 4) * fuerza, vz: Math.sin(a) * (1 + Math.random() * 2.5) * fuerza,
        rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - .5) * 20, wz: (Math.random() - .5) * 20, s: .5 + Math.random() * 1.3, vida: 0, flota: false });
    }
  }
  function explosion(p, grande = 1) {
    for (let i = 0; i < 40 * grande; i++) {
      const a = Math.random() * 6.28, el = Math.random() * 1.4;
      fuego.emitir({ x: p.x, y: p.y + .2, z: p.z, vx: Math.cos(a) * Math.cos(el) * 2.4 * grande, vy: Math.sin(el) * 3 * grande, vz: Math.sin(a) * Math.cos(el) * 2.4 * grande, vida: .5 + Math.random() * .4, t0: .9 * grande, t1: .15, c: [1, .92, .6], c1: [1, .4, .08], a0: 1, a1: 0, roce: 3 });
    }
    for (let i = 0; i < 26 * grande; i++) {
      const a = Math.random() * 6.28;
      humo.emitir({ x: p.x + Math.cos(a) * .3, y: p.y + .3, z: p.z + Math.sin(a) * .3, vx: Math.cos(a) * .9, vy: 1 + Math.random() * 1.4, vz: Math.sin(a) * .9, vida: 2.5 + Math.random() * 2, t0: .6, t1: 2.2 * grande, c: [.18, .15, .13], c1: [.42, .4, .38], a0: .75, a1: 0, roce: 1.1, entra: .15 });
    }
    luzFogonazo.position.set(p.x, p.y + 1, p.z); luzFogonazo.intensity = 30 * grande;
    temblor = Math.max(temblor, .35 * grande);
  }
  let flash = 0;

  // bala de cañón con estela
  const geoBala = new THREE.SphereGeometry(.09, 10, 8), matBala = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4, metalness: .5 });
  function bala(desde, hasta, dur = .95, alto = 6) {
    const m = new THREE.Mesh(geoBala, matBala); escena.add(m);
    // fogonazo en la boca
    for (let i = 0; i < 14; i++) fuego.emitir({ x: desde.x, y: desde.y, z: desde.z, vx: (Math.random() - .5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - .5) * 2, vida: .25, t0: .9, t1: .2, c: [1, .9, .6], c1: [1, .4, .1], roce: 4 });
    for (let i = 0; i < 10; i++) humo.emitir({ x: desde.x, y: desde.y, z: desde.z, vx: (Math.random() - .5) * 1.2, vy: .4 + Math.random() * .6, vz: (Math.random() - .5) * 1.2, vida: 2.5, t0: .5, t1: 1.8, c: [.75, .72, .68], a0: .6, a1: 0, roce: 1.4 });
    return tween(dur, k => {
      m.position.lerpVectors(desde, hasta, k); m.position.y += Math.sin(k * Math.PI) * alto;
      if (Math.random() < .8) humo.emitir({ x: m.position.x, y: m.position.y, z: m.position.z, vy: .1, vida: .9, t0: .14, t1: .45, c: [.82, .8, .76], a0: .45, a1: 0 });
    }, ease.lin).then(() => escena.remove(m));
  }
  function origenDisparo(tab, destino) {
    // las balas que caen en el río rival salen de mi flota, y al revés
    const otroC = tab === 'rival' ? CENTROS.mio : CENTROS.rival;
    return new THREE.Vector3(otroC.x + (destino.x - CENTROS[tab].x) * .6 + (Math.random() - .5) * 3, .6, otroC.z + (tab === 'rival' ? -3 : 3));
  }

  // ---------- Animaciones del juego ----------
  // resultados: [{ r, c, o }] · hund: [{ rol, h, r, c }] · bando del barco hundido
  async function disparo(tab, resultados, hund = [], bandoBlanco = 'r', onCae) {
    const prom = [];
    const validos = resultados.filter(x => x.o !== 'nada');
    if (validos.length) {
      const c = new THREE.Vector3(); for (const x of validos) c.add(centroCelda(tab, x.r, x.c)); c.multiplyScalar(1 / validos.length);
      const fuerte = validos.some(x => x.o !== 'agua');
      enfocar(c, hund.length ? .5 : fuerte ? .4 : .28, 1);
    }
    resultados.forEach((x, i) => {
      if (x.o === 'nada') return;
      prom.push((async () => {
        await espera(i * .16);
        const dest = centroCelda(tab, x.r, x.c);
        const objetivo = buscarSegmento(tab, x.r, x.c);
        if (objetivo) dest.y = .35;
        await bala(origenDisparo(tab, dest), dest, .9 + Math.random() * .12, 5 + Math.random() * 1.5);
        if (onCae) onCae(x);
        if (x.o === 'agua') chorro(dest);
        else if (x.o === 'mina') { explosion(dest, 1.6); chorro(dest, 1.8); flash = .5; }
        else {
          explosion(dest, .7); astillar(dest, 26); chorro(dest, .4); flash = Math.max(flash, .18);
          if (objetivo) { const e = objetivo.e; e.golpe = 1; }
        }
      })());
    });
    await Promise.all(prom);
    if (hund.length) await espera(.25);
    for (const h of hund) await hundir(tab, h, bandoBlanco);
    await espera(hund.length ? .2 : .5);
    await volver(.9);
  }
  function buscarSegmento(tab, r, c) {
    for (const [clave, e] of barcos[tab]) {
      const cs = celdasDe(e.desc);
      if (cs.some(([a, b]) => a === r && b === c)) return { clave, e };
    }
    return null;
  }
  // opts.cine: la cámara baja al ras del agua, como en una película · opts.alGolpe: aviso del momento del estallido
  async function hundir(tab, h, bando, opts = {}) {
    let clave = null, e = null;
    for (const [k, x] of barcos[tab]) { const d = x.desc; if (d.rol === h.rol && d.r === h.r && d.c === h.c && d.h === h.h) { clave = k; e = x; } }
    if (!e) { clave = 'hundiendo-' + h.rol; e = ponerBarco(tab, clave, h, bando); propios(e.obj); e.obj.userData.aparece = opts.cine ? 1 : .2; }
    e.animando = true;
    const o = e.obj, ud = o.userData;
    const { pos, rotY } = posBarco(tab, h);
    o.position.copy(pos).setY(.04); o.rotation.set(0, rotY, 0);
    const L = ud.L;
    const centro = pos.clone().setY(.3);
    const eje = h.h ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const lado = h.h ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    if (opts.cine) {
      fijo = true; grilla(false);
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
      const dist = THREE.MathUtils.clamp((L * .62 + .9) / Math.tan(hfov / 2), 5, 17);
      const camPos = pos.clone().addScaledVector(lado, dist * .93).addScaledVector(eje, dist * .36).setY(.55 + dist * .02);
      const mira = pos.clone().setY(.95);
      const p0 = camObj.pos.clone(), m0 = camObj.mira.clone();
      await tweenCam(1.1, k => { camObj.pos.lerpVectors(p0, camPos, k); camObj.mira.lerpVectors(m0, mira, k); camObj.pos.y += Math.sin(k * Math.PI) * 2.5; }, ease.io);
      await espera(.35);
    }
    // ¡estalla!
    velocidad = opts.cine ? .4 : 1;
    explosion(centro, opts.cine ? 1 : 1.4); astillar(centro, 70, 1.4); flash = opts.cine ? .25 : .4; chorro(centro, .8);
    if (opts.alGolpe) opts.alGolpe();
    const y0 = camObj.pos.y; const desliz = opts.cine ? tweenCam(5.5, k => { camObj.pos.addScaledVector(lado, -.006); camObj.pos.y = y0 - k * .25; camObj.mira.y = .95 - k * .7; }, ease.lin) : null;
    await espera(.15);
    const caida = ud.mastiles.map(() => Math.random() < .5 ? 1 : -1);
    const ang = .45 + Math.random() * .25;
    const burb = setIntervalo(.04, () => {
      const p = o.localToWorld(new THREE.Vector3((Math.random() - .5) * L, 0, (Math.random() - .5) * .4)); p.y = .05;
      humo.emitir({ x: p.x, y: p.y, z: p.z, vy: .5 + Math.random() * .6, vida: .6, t0: .08, t1: .22, c: [.95, .97, 1], a0: .8 });
      if (Math.random() < .5) humo.emitir({ x: p.x, y: .3, z: p.z, vx: .2, vy: .8, vida: 3, t0: .5, t1: 1.8, c: [.2, .17, .15], c1: [.45, .43, .4], a0: .55, a1: 0, roce: .8, entra: .2 });
    });
    // se parte: la popa se va para atrás, la proa se levanta, caen los mástiles
    await tween(1.6, k => {
      ud.popa.rotation.z = -ang * .5 * ease.out(k); ud.popa.position.x = -k * .14;
      ud.proa.rotation.z = ang * .8 * ease.out(k); ud.proa.position.x = k * .14;
      ud.mastiles.forEach((m, i) => { m.rotation.x = caida[i] * 1.35 * ease.in(Math.min(1, k * 1.2)); });
      o.rotation.x = Math.sin(k * 3) * .05;
    });
    velocidad = opts.cine ? .75 : 1;
    onda(pos, 2.4);
    await tween(opts.cine ? 3.4 : 2.6, k => {
      o.position.y = .04 - k * k * 3;
      ud.popa.rotation.z = -ang * .5 - k * .55; ud.proa.rotation.z = ang * .8 + k * .65;
      o.rotation.x = k * .25;
    }, ease.lin);
    burb(); velocidad = 1;
    escena.remove(o); barcos[tab].delete(clave);
    ponerRestos(tab + ':' + h.rol, pos, rol(h.rol).largo, h.h, Math.random, true);
    if (opts.cine) { await espera(.7); fijo = false; await volver(1.4); grilla(true); }
  }
  function setIntervalo(cada, fn) { const it = { cada, fn, acc: 0 }; intervalos.add(it); return () => intervalos.delete(it); }
  const intervalos = new Set();

  async function bengala(tab, r, c, vistos) {
    const dest = centroCelda(tab, r, c);
    const desde = origenDisparo(tab, dest);
    const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffeebb }));
    escena.add(m);
    await tween(1.1, k => {
      m.position.lerpVectors(desde, dest, k); m.position.y = 4.5 * Math.sin(k * Math.PI * .5) + k * 1;
      fuego.emitir({ x: m.position.x, y: m.position.y, z: m.position.z, vx: (Math.random() - .5) * .3, vy: -.3, vz: (Math.random() - .5) * .3, vida: .5, t0: .35, t1: .05, c: [1, .95, .7], c1: [1, .5, .2] });
    });
    // estalla y baja despacio
    const altura = m.position.y;
    luzBengala.position.copy(m.position); flash = .25;
    const siluetas = vistos.map(([a, b]) => { const s = crearSilueta(); s.position.copy(centroCelda(tab, a, b)); s.rotation.y = Math.random() * .3; escena.add(s); return s; });
    resaltar(tab, vistos.map(([a, b]) => ({ r: a, c: b, tipo: 'visto' })));
    const dur = 4.2;
    await tween(dur, k => {
      m.position.y = altura - k * 2.2; luzBengala.position.copy(m.position);
      const brillo = k < .1 ? k / .1 : 1 - Math.pow(Math.max(0, (k - .7) / .3), 2);
      luzBengala.intensity = (noche ? 70 : 25) * brillo;
      if (Math.random() < .7) fuego.emitir({ x: m.position.x, y: m.position.y, z: m.position.z, vx: (Math.random() - .5) * .8, vy: -.4 - Math.random(), vz: (Math.random() - .5) * .8, vida: .7, t0: .22, t1: .04, c: [1, 1, .85], c1: [1, .6, .2], g: 1 });
      for (const s of siluetas) s.userData.mat.opacity = .82 * brillo;
      for (const x of tableros[tab].resalte.children) x.material.opacity = .55 * brillo;
    });
    luzBengala.intensity = 0; escena.remove(m);
    for (const s of siluetas) escena.remove(s);
    resaltar(tab, []);
  }

  async function sondeo(tab, r, c, h) {
    const cs = []; for (let i = 0; i < N; i++) cs.push(h ? [r, i] : [i, c]);
    for (let i = 0; i < cs.length; i++) {
      const p = centroCelda(tab, cs[i][0], cs[i][1]);
      setTimeout(() => onda(p, .55, 0xcfe4ff), i * 70);
    }
    const p0 = centroCelda(tab, cs[0][0], cs[0][1]);
    chorro(p0, .35);
    resaltar(tab, cs.map(([a, b]) => ({ r: a, c: b, tipo: 'area' })));
    await espera(1.2);
    resaltar(tab, []);
  }

  async function maniobrar(i, d, nuevo) {
    const e = barcos.mio.get('b' + i); if (!e) return;
    const desde = e.base.clone(); const { pos } = posBarco('mio', nuevo);
    e.desc = nuevo;
    const t0 = e.base;
    await tween(1.6, k => {
      e.base = desde.clone().lerp(pos, k);
      if (Math.random() < .6) { const p = e.obj.localToWorld(new THREE.Vector3(-e.obj.userData.L / 2, 0, (Math.random() - .5) * .4)); humo.emitir({ x: p.x, y: .08, z: p.z, vy: .1, vida: 1.4, t0: .2, t1: .6, c: [.92, .94, .96], a0: .6, a1: 0 }); }
    }, ease.io);
    e.base = pos;
  }

  async function revelar(lista, bando) {
    lista.forEach((d, i) => { if (!d.hundido && !barcos.rival.has('rev' + i)) { const e = ponerBarco('rival', 'rev' + i, d, bando); propios(e.obj); e.obj.userData.aparece = 0; } });
  }
  function limpiarRival() { for (const k of [...barcos.rival.keys()]) { const e = barcos.rival.get(k); escena.remove(e.obj); barcos.rival.delete(k); } }

  // ---------- Calidad (resolución) ----------
  const CALIDADES = [{ nombre: 'alta', pr: 2 }, { nombre: 'media', pr: 1.4 }, { nombre: 'baja', pr: 1 }];
  let calidad = 'auto', nivelCal = 0;
  function setCalidad(c) {
    calidad = ['auto', 'alta', 'media', 'baja'].includes(c) ? c : 'auto';
    nivelCal = calidad === 'auto' ? 0 : CALIDADES.findIndex(x => x.nombre === calidad);
    aplicarCalidad();
  }
  function aplicarCalidad() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CALIDADES[nivelCal].pr)); redimensionar(); }
  function redimensionar() {
    const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    const esc = (H * renderer.getPixelRatio() / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    humo.uScale.value = esc; fuego.uScale.value = esc;
    const d = encuadre(mirando); if (!fijo) { camObj.pos.copy(d.pos); camObj.mira.copy(d.mira); }
  }
  window.addEventListener('resize', () => setTimeout(redimensionar, 60));

  // ---------- Bucle ----------
  const reloj3 = new THREE.Clock();
  let tiempos = [], acumRev = 0, onCuadro = null;
  let pausa = false, unSolo = false;
  function cuadroUno() { unSolo = true; cuadro(); unSolo = false; }
  function cuadro() {
    if (pausa) return;
    if (!unSolo) requestAnimationFrame(cuadro);
    if (dormido && !unSolo) return; // tapado por la portada: no gastar batería
    const dt = Math.min(reloj3.getDelta(), .05) * velocidad, t = reloj3.elapsedTime; reloj = t;
    uCielo.uT.value = t;
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(w.e(k)); if (k >= 1) { tweens.splice(i, 1); w.res(); } }
    for (const it of intervalos) { it.acc += dt; while (it.acc >= it.cada) { it.acc -= it.cada; it.fn(); } }
    // barcos meciéndose
    for (const tab of ['mio', 'rival']) for (const e of barcos[tab].values()) {
      const o = e.obj, ud = o.userData;
      if (ud.aparece !== undefined && ud.aparece < 1) { ud.aparece = Math.min(1, ud.aparece + dt * .8); o.traverse(m => { if (m.isMesh) { m.material.transparent = ud.aparece < 1; m.material.opacity = ud.aparece; } else if (m.isLine) m.material.opacity = .75 * ud.aparece; }); }
      flamear(o, t);
      if (e.animando) continue;
      const b = e.base || o.position;
      const h = ola(b.x, b.z, t + ud.fase * .1);
      e.golpe = Math.max(0, (e.golpe || 0) - dt * 1.8);
      o.position.set(b.x, h * .9 + .04, b.z);
      o.rotation.set(Math.sin(t * 1.3 + ud.fase) * .04 + e.golpe * .12 * Math.sin(t * 30), e.rotY || 0, Math.sin(t * .9 + ud.fase) * .025, 'YXZ');
    }
    if (minaObj) { const p = minaObj.position; p.y = ola(p.x, p.z, t) - .05; minaObj.rotation.y += dt * .2; }
    for (const l of restos.values()) for (const it of l) {
      if (it.vx) { it.x += it.vx * dt; it.z += it.vz * dt; it.vx *= 1 - dt * .5; it.vz *= 1 - dt * .5; if (Math.abs(it.vx) < .01) it.vx = 0; }
      it.mesh.position.set(it.x, ola(it.x, it.z, t) + (it.barril ? .02 : .01), it.z);
      it.mesh.rotation.y = it.rot + Math.sin(t * .3 + it.fase) * .2; if (!it.barril) it.mesh.rotation.z = Math.sin(t * 1.4 + it.fase) * .08;
    }
    // fuegos
    for (const f of fuegos.values()) {
      f.acc += dt;
      const ritmo = f.tipo === 'fuego' ? .07 : .3;
      while (f.acc > ritmo) {
        f.acc -= ritmo;
        const p = f.pos;
        if (f.tipo === 'fuego') {
          fuego.emitir({ x: p.x + (Math.random() - .5) * .25, y: p.y + .02, z: p.z + (Math.random() - .5) * .25, vx: (Math.random() - .5) * .2, vy: .6 + Math.random() * .7, vz: (Math.random() - .5) * .2, vida: .55 + Math.random() * .4, t0: .62, t1: .12, c: [1, .88, .5], c1: [1, .35, .05], a0: 1, a1: 0 });
          if (Math.random() < .35) humo.emitir({ x: p.x, y: p.y + .45, z: p.z, vx: .25 + Math.random() * .1, vy: .55 + Math.random() * .3, vz: (Math.random() - .5) * .1, vida: 3.2 + Math.random(), t0: .35, t1: 1.6, c: noche ? [.12, .12, .14] : [.16, .14, .12], c1: noche ? [.22, .23, .27] : [.4, .38, .36], a0: .6, a1: 0, entra: .2 });
        } else {
          humo.emitir({ x: p.x + (Math.random() - .5) * .4, y: p.y + .1, z: p.z + (Math.random() - .5) * .4, vx: .2, vy: .35 + Math.random() * .2, vida: 3.5, t0: .4, t1: 1.5, c: [.25, .23, .22], c1: [.45, .44, .42], a0: .4, a1: 0, entra: .3 });
        }
      }
    }
    // astillas
    let n = 0;
    for (let i = astP.length - 1; i >= 0; i--) {
      const a = astP[i]; a.vida += dt;
      if (!a.flota) {
        a.vy -= 9 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; a.rx += a.wx * dt; a.rz += a.wz * dt;
        const h = ola(a.x, a.z, t);
        if (a.y < h && a.vy < 0) { a.flota = true; if (Math.random() < .4) humo.emitir({ x: a.x, y: h + .02, z: a.z, vy: .8, vida: .4, t0: .12, t1: .2, c: [.95, .95, .95], a0: .7 }); }
      } else { a.y = ola(a.x, a.z, t) - a.vida * .01; a.vx *= .97; a.vz *= .97; a.x += a.vx * dt * .2; a.z += a.vz * dt * .2; }
      if (a.vida > 9) { astP.splice(i, 1); continue; }
    }
    for (const a of astP) {
      _e.set(a.rx, a.ry, a.rz); _q.setFromEuler(_e); _v.set(a.x, a.y, a.z); const s = a.s * (a.vida > 7 ? Math.max(0, 1 - (a.vida - 7) / 2) : 1); _s.set(s, s, s);
      _m.compose(_v, _q, _s); astillas.setMatrixAt(n++, _m);
    }
    astillas.count = n; astillas.instanceMatrix.needsUpdate = true;
    for (let i = ondas.length - 1; i >= 0; i--) { const o = ondas[i]; o.t += dt; const k = o.t / o.dur; o.m.scale.setScalar(.1 + k * o.max); o.m.material.opacity = .7 * (1 - k); if (k >= 1) { escena.remove(o.m); ondas.splice(i, 1); } }
    humo.actualizar(dt); fuego.actualizar(dt);
    luzFogonazo.intensity *= Math.pow(.02, dt);
    flash *= Math.pow(.01, dt);
    // marcas que se borran de noche
    for (const tab of ['mio', 'rival']) {
      for (const m of tableros[tab].mapaMarcas.values()) {
        if (m.noche && (m.e === 'agua' || m.e === 'aguaMia')) { const edad = t - m.t0; m.mesh.material.opacity = edad < 4 ? 1 : Math.max(0, 1 - (edad - 4) / 3); m.mesh.visible = m.mesh.material.opacity > 0; }
      }
      for (const x of tableros[tab].resalte.children) if (x.userData.pulsa) x.material.opacity = (.65 + .3 * Math.sin(t * 6)) ;
    }
    // cámara
    temblor *= Math.pow(.04, dt);
    if (cine) {
      const C = CENTROS.rival, a = t * .05 + .6;
      camObj.pos.set(C.x + Math.sin(a) * 20, 3.8 + Math.sin(t * .2) * .3, C.z + Math.cos(a) * 20);
      camObj.mira.set(C.x, .5, C.z);
    }
    cam.position.copy(camObj.pos);
    if (temblor > .002) cam.position.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(temblor));
    cam.lookAt(camObj.mira);
    if (camFija) { cam.position.set(camFija.x, camFija.y, camFija.z); cam.lookAt(camFija.mx, camFija.my ?? .2, camFija.mz); }
    cielo.position.copy(cam.position);
    if (onCuadro) onCuadro(dt, t);
    // dibujar
    const t0 = performance.now();
    agua.material.uniforms.time.value = t * .45;
    renderer.toneMappingExposure = expBase * (1 + flash * 1.6);
    renderer.autoClear = true; renderer.render(escena, cam);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(capa, cam);
    // calidad automática
    tiempos.push(dt); acumRev += dt;
    if (calidad === 'auto' && acumRev > 2.5 && tiempos.length > 30) {
      const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      if (prom > .036 && nivelCal < CALIDADES.length - 1) { nivelCal++; aplicarCalidad(); }
      tiempos = []; acumRev = 0;
    }
  }

  // tocar el tablero
  const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
  function celdaEn(x, y) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), cam);
    if (!ray.ray.intersectPlane(plano, _hit)) return null;
    for (const tab of ['mio', 'rival']) {
      const C = CENTROS[tab], c = Math.floor(_hit.x - (C.x - 5)), r = Math.floor(_hit.z - (C.z - 5));
      if (r >= 0 && c >= 0 && r < N && c < N) return { tab, r, c };
    }
    return null;
  }

  setPaleta(); setCalidad('auto');
  { const d = encuadre('mio'); camObj.pos.copy(d.pos); camObj.mira.copy(d.mira); }
  requestAnimationFrame(cuadro);

  return {
    setNoche(v) { noche = !!v; setPaleta(); },
    setCalidad, calidadActual: () => CALIDADES[nivelCal].nombre,
    ponerMapa, margenes, mirar, mirando: () => mirando, enfocar, volver, grilla, cinematica,
    flota, ponerFuegos, ponerRestos: (clave, tab, d) => { const { pos } = posBarco(tab, d); ponerRestos(clave, pos, rol(d.rol).largo, d.h, semilla(clave)); },
    quitarRestos, marcas, limpiarMarcas, insignias, resaltar, ponerMina, limpiarRival,
    disparo, bengala, sondeo, maniobrar, revelar, hundir,
    explosion, chorro, temblar: f => { temblor = Math.max(temblor, f); }, destello: f => { flash = Math.max(flash, f); },
    celdaEn, centroCelda, espera,
    pantallaDe(tab, r, c) { const p = centroCelda(tab, r, c).project(cam); const rect = canvas.getBoundingClientRect(); return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }; },
    alCuadro: fn => { onCuadro = fn; },
    fijarCamara(c) { camFija = c; },
    dormir(v) { dormido = !!v; },
    pausar(v) { const antes = pausa; pausa = !!v; if (antes && !pausa) { reloj3.getDelta(); requestAnimationFrame(cuadro); } },
    avanzar(seg, paso = 1 / 30) { const p = pausa; pausa = false; const real = reloj3.getDelta; let tt = reloj3.elapsedTime; reloj3.getDelta = () => { tt += paso; reloj3.elapsedTime = tt; return paso; }; for (let i = 0; i < Math.round(seg / paso); i++) { pausa = false; cuadroUno(); } reloj3.getDelta = real; pausa = p; },
    portada(activa) { // la escuadra navegando para la portada
      const flotilla = [{ rol: 'fragata', h: true, r: 4, c: 3 }, { rol: 'bergantin', h: true, r: 1, c: 0 }, { rol: 'goleta', h: true, r: 7, c: 6 }, { rol: 'canonera', h: true, r: 2, c: 7 }, { rol: 'falucho', h: true, r: 8, c: 1 }];
      flotilla.forEach((d, i) => { if (activa) ponerBarco('rival', 'portada' + i, d, i % 2 ? 'r' : 'p'); else quitarBarco('rival', 'portada' + i); });
      grilla(!activa); cinematica(activa);
      if (!activa) { const d = encuadre(mirando); camObj.pos.copy(d.pos); camObj.mira.copy(d.mira); }
    },
  };
}
