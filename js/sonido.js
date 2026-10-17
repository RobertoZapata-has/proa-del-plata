// Proa del Plata · sonidos hechos con código (sin archivos)
let ctx = null, master = null, mar = null, activo = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = activo ? .9 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let _ruido = null;
function ruido() {
  if (_ruido) return _ruido;
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (_ruido = b);
}
function fuenteRuido() { const s = ctx.createBufferSource(); s.buffer = ruido(); s.loop = true; return s; }
function env(g, t, a, peak, d, fin = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(fin, t + a + d); }
function filtro(tipo, f, q = 1) { const x = ctx.createBiquadFilter(); x.type = tipo; x.frequency.value = f; x.Q.value = q; return x; }

function estruendo(t, vol = 1, grave = 1, lejos = 0) {
  const s = fuenteRuido(), f = filtro('lowpass', 1400 - lejos * 900), g = ctx.createGain();
  f.frequency.setValueAtTime(1400 - lejos * 900, t); f.frequency.exponentialRampToValueAtTime(140, t + .7);
  env(g, t, .005, .9 * vol, .9 + grave * .3);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 1.6);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(70 * grave, t); o.frequency.exponentialRampToValueAtTime(32, t + .5);
  env(og, t, .004, .9 * vol, .6); o.connect(og); og.connect(master); o.start(t); o.stop(t + .8);
}
function chapoteo(t, vol = 1) {
  const s = fuenteRuido(), f = filtro('bandpass', 900, .7), g = ctx.createGain();
  f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(400, t + .7);
  env(g, t, .01, .7 * vol, .8); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 1.2);
  for (let i = 0; i < 6; i++) gota(t + .25 + Math.random() * .6, .12 * vol);
}
function gota(t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f0 = 500 + Math.random() * 900;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + .05);
  env(g, t, .002, vol, .06); o.connect(g); g.connect(master); o.start(t); o.stop(t + .1);
}
function crujido(t, vol = 1, dur = .5) {
  for (let i = 0; i < 9; i++) {
    const tt = t + Math.random() * dur, s = fuenteRuido(), f = filtro('bandpass', 1800 + Math.random() * 2500, 3), g = ctx.createGain();
    env(g, tt, .001, .5 * vol, .05 + Math.random() * .05); s.connect(f); f.connect(g); g.connect(master); s.start(tt); s.stop(tt + .15);
  }
}
function quejido(t, dur = 2.2, vol = .5) { // la madera del casco que se queja
  const o = ctx.createOscillator(), f = filtro('bandpass', 300, 8), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(52, t + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
  env(g, t, .3, vol, dur); o.connect(f); f.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + .4); lfo.stop(t + dur + .4);
}
function silbido(t, dur = .9, vol = .08) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(1300, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function campana(t, f = 880, vol = .25, dur = 1.6) {
  for (const [m, a] of [[1, 1], [2.76, .4], [5.4, .2]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m;
    env(g, t, .003, vol * a, dur / m); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
}

export const Sonido = {
  set activo(v) { activo = v; if (master) master.gain.value = v ? .9 : 0; if (v) this.mar(); else if (mar) { try { mar.stop(); } catch (e) {} mar = null; } },
  get activo() { return activo; },
  desbloquear() { if (activo) { ac(); this.mar(); } },
  mar() {
    if (!activo || mar || !ac()) return;
    const s = fuenteRuido(), f = filtro('lowpass', 420), g = ctx.createGain(); g.gain.value = .05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .11; lg.gain.value = .035; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(master); s.start(); lfo.start(); mar = s;
  },
  disparo(lejos = false) { if (!activo || !ac()) return; const t = ctx.currentTime; estruendo(t, lejos ? .5 : .8, 1, lejos ? 1 : 0); silbido(t + .15); },
  agua() { if (!activo || !ac()) return; chapoteo(ctx.currentTime); },
  impacto() { if (!activo || !ac()) return; const t = ctx.currentTime; estruendo(t, .7, 1.4); crujido(t, 1, .4); },
  hundido() { if (!activo || !ac()) return; const t = ctx.currentTime; estruendo(t, 1, .8); crujido(t, 1.2, 1); quejido(t + .2); chapoteo(t + 1.6, 1.3); for (let i = 0; i < 14; i++) gota(t + 1.8 + Math.random() * 2, .1); },
  mina() { if (!activo || !ac()) return; const t = ctx.currentTime; estruendo(t, 1.2, .6); chapoteo(t + .1, 1.4); },
  bengala() {
    if (!activo || !ac()) return; const t = ctx.currentTime;
    const s = fuenteRuido(), f = filtro('highpass', 900), g = ctx.createGain(); f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(4000, t + 1);
    env(g, t, .05, .25, 1); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 1.2);
    const s2 = fuenteRuido(), f2 = filtro('bandpass', 3000, 2), g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t + 1); g2.gain.exponentialRampToValueAtTime(.18, t + 1.15); g2.gain.exponentialRampToValueAtTime(0.0001, t + 5.2);
    s2.connect(f2); f2.connect(g2); g2.connect(master); s2.start(t + 1); s2.stop(t + 5.3);
  },
  sondeo() { if (!activo || !ac()) return; const t = ctx.currentTime; gota(t, .35); chapoteo(t, .25); campana(t + .5, 660, .15); campana(t + .9, 660, .12); },
  turno() { if (!activo || !ac()) return; const t = ctx.currentTime; campana(t, 1046, .16, 1.2); campana(t + .32, 1046, .13, 1.2); },
  tic() { if (!activo || !ac()) return; const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 520; o.type = 'triangle'; env(g, t, .002, .08, .05); o.connect(g); g.connect(master); o.start(t); o.stop(t + .08); },
  maniobra() { if (!activo || !ac()) return; const t = ctx.currentTime; quejido(t, 1.4, .25); chapoteo(t + .3, .4); },
  botella() { if (!activo || !ac()) return; const t = ctx.currentTime; gota(t, .25); gota(t + .12, .2); campana(t + .2, 1568, .05, .6); },
  burla() { // la risa del hornero: chillidos rápidos que bajan
    if (!activo || !ac()) return; const t0 = ctx.currentTime;
    for (let i = 0; i < 11; i++) {
      const t = t0 + i * (.085 - i * .002), f = 2300 - i * 70;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f * .78, t + .06);
      env(g, t, .004, .11, .06); o.connect(g); g.connect(master); o.start(t); o.stop(t + .09);
    }
  },
  victoria() {
    if (!activo || !ac()) return; const t = ctx.currentTime;
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; env(g, t + i * .18, .01, .18, i === 5 ? 1.4 : .3); o.connect(g); g.connect(master); o.start(t + i * .18); o.stop(t + i * .18 + 1.6); });
    estruendo(t + 1.1, .4, 1, 1); estruendo(t + 1.5, .4, 1, 1);
  },
  derrota() {
    if (!activo || !ac()) return; const t = ctx.currentTime;
    [392, 349, 311, 262].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; env(g, t + i * .35, .02, .16, i === 3 ? 1.8 : .5); o.connect(g); g.connect(master); o.start(t + i * .35); o.stop(t + i * .35 + 2); });
  },
};
