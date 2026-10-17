// Proa del Plata · los vigías: viñetas de historieta que gritan, se burlan y lloran
// Las caras van en vigias/<personaje>-<cara>.webp (dibujadas con Gemini). Si falta alguna, se dibuja una de prueba.

export const PERSONAJES = {
  p: { id: 'chirola', nombre: 'Chirola' },
  r: { id: 'bermudez', nombre: 'Bermúdez' },
};

const FRASES = {
  chirola: {
    burla: ['¡Agua! ¿Le estás tirando a las mojarritas?', '¡Ni cerca, maturrango!', '¡Uy, qué puntería! Le diste al río entero.', 'Con esa puntería no le pegás ni a la costa.', '¡Agua, agua! Ahí solo hay bagres.', '¡Mandale saludos a los pescados!', '¿Eso fue un cañonazo o un estornudo?'],
    festejo: ['¡Tomá! ¡Justo en el casco!', '¡Adentro! ¡Grande, cañonero!', '¡Así se tira, señores!', '¡Le dimos! ¡Le dimos!'],
    alarma: ['¡Nos dieron! ¡Traigan baldes!', '¡Ay, ay, ay! ¡Eso dolió!', '¡Agujero en el casco, mi capitán!'],
    averiado: ['¡Averiado, pero no vencido!', '¡Me quemaron la camisa nueva!', '¡Esto no queda así!'],
    hundido: ['¡Mi barquito! ¡Noooo!', '¡Glu, glu, glu…!', '¡Nos hundieron! ¡Avísenle a Brown!'],
    victoria: ['¡El río es nuestro!', '¡Viva la patria!', '¡Volvé a Montevideo nadando!'],
    trampa: ['¡Cayó en la mina! ¡Jajajá!', '¡Pisaste el palito, maturrango!'],
    catalejo: ['A ver, a ver… ¡te tengo, maturrango!', 'Mirá vos lo que encontré…', 'Anoto todo, eh. No me olvido de nada.'],
  },
  bermudez: {
    burla: ['¡Ni cerca, chaval!', '¡Agua! ¿Apuntas con los ojos cerrados?', '¡Mi abuela tira mejor, y está en Cádiz!', '¡Le has dado a una sardina, enhorabuena!', '¿Eso era un cañonazo o un estornudo?', '¡Ja! ¡Vuelve a la escuela, insurgente!'],
    festejo: ['¡Toma ya! ¡Al centro!', '¡Olé! ¡Eso es puntería!', '¡Chúpate esa, insurgente!'],
    alarma: ['¡Rayos y centellas! ¡Nos han dado!', '¡Por todos los santos! ¡Los baldes!', '¡Por las barbas de Neptuno!'],
    averiado: ['¡Me han chamuscado el bigote!', '¡Esto lo pagarás, insurgente!', '¡Averiado! ¡Rediez!'],
    hundido: ['¡Mi pipa no, mi pipa no!', '¡Glu… glu… por el Rey!', '¡Me hundo! ¡Que alguien salve el ron!'],
    victoria: ['¡El Plata es del Rey!', '¡Volved a casa, insurgentes!', '¡Olé y olé!'],
    trampa: ['¡Ha caído en la mina! ¡Ja!', '¡Bum! ¡Mira por dónde navegas!'],
    catalejo: ['Ajá… ya te veo, insurgente.', 'Nada se le escapa a este catalejo.', 'Apuntado queda, chaval.'],
  },
};
const ONO = {
  burla: ['¡AGUA!', '¡SPLASH!', '¡PLAF!'],
  festejo: ['¡BRAAAM!', '¡CRASH!', '¡PUM!'],
  alarma: ['¡CRASH!', '¡BRAAAM!'],
  averiado: ['¡AVERIADO!'],
  hundido: ['¡HUNDIDO!'],
  victoria: ['¡VICTORIA!'],
  trampa: ['¡BUUUM!'],
  catalejo: ['¡AJÁ!', '¡ZOOM!'],
};
const azar = a => a[Math.floor(Math.random() * a.length)];
const ultima = {};
function frase(pid, cara) {
  const lista = FRASES[pid][cara] || FRASES[pid].burla;
  let f; do { f = azar(lista); } while (lista.length > 1 && f === ultima[pid + cara]);
  ultima[pid + cara] = f; return f;
}

// ---------- caras de prueba (hasta que lleguen las de Gemini) ----------
function caraPrueba(pid, cara) {
  const esCh = pid === 'chirola';
  const piel = esCh ? '#c98d5f' : '#e39a7a', fondo = esCh ? '#7cc3ec' : '#e8603a';
  const ojos = {
    burla: '<path d="M70 92 q10 -10 20 0 M110 92 q10 -10 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>',
    festejo: '<path d="M70 94 q10 -12 20 0 M110 94 q10 -12 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>',
    alarma: '<circle cx="80" cy="92" r="12" fill="#fff" stroke="#111" stroke-width="4"/><circle cx="120" cy="92" r="12" fill="#fff" stroke="#111" stroke-width="4"/><circle cx="80" cy="92" r="4" fill="#111"/><circle cx="120" cy="92" r="4" fill="#111"/>',
    averiado: '<path d="M68 84 l22 8 M132 84 l-22 8" stroke="#111" stroke-width="6" stroke-linecap="round"/><circle cx="82" cy="96" r="4" fill="#111"/><circle cx="118" cy="96" r="4" fill="#111"/>',
    hundido: '<path d="M70 94 q10 6 20 0 M110 94 q10 6 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M76 100 q-4 20 2 40 M124 100 q4 20 -2 40" stroke="#4fb3f0" stroke-width="7" fill="none" stroke-linecap="round"/>',
    victoria: '<path d="M70 94 q10 -12 20 0 M110 94 q10 -12 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>',
    trampa: '<path d="M70 92 q10 -10 20 0 M110 92 q10 -10 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>',
  }[cara] || '<path d="M70 92 q10 -10 20 0 M110 92 q10 -10 20 0" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>';
  const boca = {
    burla: '<path d="M78 124 q22 30 44 0 z" fill="#5a1010" stroke="#111" stroke-width="4"/><path d="M98 132 q4 14 12 2" fill="#e05a6a" stroke="#111" stroke-width="3"/>',
    festejo: '<path d="M76 122 q24 34 48 0 z" fill="#5a1010" stroke="#111" stroke-width="4"/>',
    alarma: '<ellipse cx="100" cy="132" rx="12" ry="16" fill="#5a1010" stroke="#111" stroke-width="4"/>',
    averiado: '<path d="M80 136 q20 -14 40 0" stroke="#111" stroke-width="5" fill="none"/><path d="M84 132 h32" stroke="#fff" stroke-width="4"/>',
    hundido: '<path d="M80 140 q20 -18 40 0 z" fill="#5a1010" stroke="#111" stroke-width="4"/>',
    victoria: '<path d="M74 120 q26 38 52 0 z" fill="#5a1010" stroke="#111" stroke-width="4"/>',
    trampa: '<path d="M78 124 q22 30 44 0 z" fill="#5a1010" stroke="#111" stroke-width="4"/>',
  }[cara] || '<path d="M80 130 q20 12 40 0" stroke="#111" stroke-width="5" fill="none"/>';
  const hollin = cara === 'averiado' ? '<circle cx="70" cy="118" r="10" fill="#222" opacity=".55"/><circle cx="132" cy="80" r="8" fill="#222" opacity=".5"/><circle cx="118" cy="126" r="6" fill="#222" opacity=".5"/>' : '';
  const sombrero = esCh
    ? '<ellipse cx="100" cy="56" rx="62" ry="12" fill="#d8b56a" stroke="#111" stroke-width="5"/><path d="M68 56 q4 -34 32 -34 q28 0 32 34 z" fill="#e2c27c" stroke="#111" stroke-width="5"/><path d="M70 50 h60" stroke="#2c6fa8" stroke-width="7"/>'
    : '<path d="M58 66 q8 -48 52 -44 q36 4 44 30 q-8 4 -18 0 l-6 14 z" fill="#c2261f" stroke="#111" stroke-width="5"/>';
  const bigote = esCh ? '' : '<path d="M66 116 q16 -14 34 -4 q18 -10 34 4 q-12 14 -34 2 q-22 12 -34 -2 z" fill="#ddd" stroke="#111" stroke-width="4"/>';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="pt-${pid}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="rgba(0,0,0,.16)"/></pattern></defs>
    <rect width="200" height="200" fill="${fondo}"/><rect width="200" height="200" fill="url(#pt-${pid})"/>
    <path d="M40 200 q0 -40 60 -44 q60 4 60 44 z" fill="${esCh ? '#f2efe6' : '#1f3b6e'}" stroke="#111" stroke-width="5"/>
    ${esCh ? '<path d="M78 160 l22 18 l22 -18" fill="#7cc3ec" stroke="#111" stroke-width="4"/>' : ''}
    <ellipse cx="100" cy="104" rx="50" ry="56" fill="${piel}" stroke="#111" stroke-width="5"/>
    ${hollin}${ojos}${bigote}${boca}${sombrero}
  </svg>`;
}

// ---------- la viñeta ----------
let raiz = null, timer = null, fin = null;
function asegurar() {
  if (raiz) return raiz;
  raiz = document.createElement('div'); raiz.id = 'vineta'; raiz.hidden = true;
  raiz.addEventListener('click', () => cerrar());
  document.body.appendChild(raiz);
  return raiz;
}
const cache = {};
function imagen(pid, cara) {
  const src = `vigias/${pid}-${cara}.webp`;
  if (cache[src] === false) return null;
  if (cache[src]) return src;
  const im = new Image();
  im.onload = () => { cache[src] = true; };
  im.onerror = () => { cache[src] = false; };
  im.src = src;
  return null;
}
export function precargar() { for (const P of Object.values(PERSONAJES)) for (const c of ['burla', 'festejo', 'alarma', 'averiado', 'hundido', 'victoria', 'catalejo', 'neutro']) imagen(P.id, c); }

function cerrar() {
  if (!raiz || raiz.hidden) return;
  clearTimeout(timer); raiz.classList.add('sale');
  setTimeout(() => { raiz.hidden = true; raiz.classList.remove('sale'); raiz.innerHTML = ''; if (fin) { const f = fin; fin = null; f(); } }, 260);
}

// bando: 'p' o 'r' · cara: burla|festejo|alarma|averiado|hundido|victoria|trampa · lado: 'arriba' | 'abajo'
export function vineta(bando, cara, { lado = 'arriba', texto = null, ono = null, dur = 2300 } = {}) {
  const P = PERSONAJES[bando]; const el = asegurar();
  clearTimeout(timer); if (fin) { const f = fin; fin = null; f(); }
  const caraImg = cara === 'trampa' ? 'burla' : cara;
  const src = imagen(P.id, caraImg);
  const dibujo = src ? `<img src="${src}" alt="">` : caraPrueba(P.id, cara);
  const t = texto || frase(P.id, cara), o = ono || azar(ONO[cara] || ['¡BRAAAM!']);
  el.className = `${lado} ${bando}`;
  el.innerHTML = `<div class="panel"><div class="cara">${dibujo}</div><div class="nombre">${P.nombre}</div></div>
    <div class="globo"></div><div class="ono" data-t=""></div>`;
  el.querySelector('.globo').textContent = t;
  const on = el.querySelector('.ono'); on.textContent = o; on.dataset.t = o;
  el.hidden = false;
  return new Promise(res => { fin = res; timer = setTimeout(cerrar, dur); });
}
// retrato fijo para la portada (no espera a que cargue: el navegador lo muestra cuando llega)
export function retrato(bando) {
  const P = PERSONAJES[bando];
  return `<figure class="retrato ${bando}"><img src="vigias/${P.id}-neutro.webp" alt="${P.nombre}" onerror="this.parentNode.remove()"><figcaption>${P.nombre}</figcaption></figure>`;
}
export const nombreVigia = bando => PERSONAJES[bando].nombre;
