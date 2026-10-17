# Proa del Plata · los barcos hechos en Blender
# Uso:  python3 herramientas/barcos_blender.py modelos/barcos.glb
# (necesita el módulo de Blender:  pip install bpy)
#
# Ejes de Blender: X a lo largo (proa hacia +X), Y a lo ancho, Z para arriba. La línea de flotación es Z=0.
# Al exportar, glTF pasa a Y arriba. Una casilla del tablero mide 1.
#
# Cada barco queda así (los nombres los usa js/barcos.js):
#   <rol>            vacío raíz
#     <rol>_popa     vacío: media popa (casco, cubierta, detalles)    → se parte al hundirse
#     <rol>_proa     vacío: media proa
#       <rol>_palo_N vacío en el pie de cada palo (con palos, vergas, velas y jarcias) → se cae al hundirse
#         <rol>_bandera_N  vacío donde el juego cuelga la bandera
# Los materiales llevan nombres (pdp_madera, pdp_banda, pdp_vela…): el juego los reemplaza por los suyos con texturas.
import sys, math
import bpy, bmesh
from mathutils import Vector, Matrix

SALIDA = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'barcos.glb'
pi = math.pi
lerp = lambda a, b, t: a + (b - a) * t
clamp = lambda x, a, b: max(a, min(b, x))

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
COLORES = {  # solo de referencia en Blender: el juego pone los suyos
    'madera': (.25, .16, .1), 'banda': (.6, .75, .85), 'negro': (.05, .045, .04), 'fondo': (.45, .22, .12), 'cubierta': (.55, .43, .3),
    'palo': (.35, .24, .14), 'vela': (.9, .86, .76), 'hierro': (.05, .05, .05), 'porta': (.02, .015, .01), 'tapa': (.55, .1, .08),
    'farol': (1, .8, .4), 'ventana': (1, .75, .35), 'dorado': (.7, .55, .2), 'astilla': (.8, .65, .45), 'bote': (.8, .78, .7),
}
def material(n):
    if n in MATS: return MATS[n]
    m = bpy.data.materials.new('pdp_' + n); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*COLORES[n], 1)
    m.use_backface_culling = False
    MATS[n] = m; return m


class Malla:
    """Junta vértices, caras (con material y UV) y líneas sueltas; al final crea un objeto."""
    def __init__(s): s.v, s.f, s.fm, s.fuv, s.fs, s.e = [], [], [], [], [], []
    def vx(s, p): s.v.append(tuple(p)); return len(s.v) - 1
    def cara(s, ids, mat, uvs=None, liso=True):
        s.f.append(list(ids)); s.fm.append(mat); s.fuv.append(uvs or [(0, 0)] * len(ids)); s.fs.append(liso)
    def linea(s, a, b): s.e.append((s.vx(a), s.vx(b)))
    def vacia(s): return not s.f and not s.e
    def objeto(s, nombre, padre=None, origen=(0, 0, 0), locales=False):
        # locales=True: los vértices ya están en coordenadas del padre
        o0 = Vector(origen)
        me = bpy.data.meshes.new(nombre)
        me.from_pydata([tuple(Vector(p) - (Vector() if locales else o0)) for p in s.v], s.e, s.f)
        nombres = sorted(set(s.fm))
        for n in nombres: me.materials.append(material(n))
        if s.f:
            uvl = me.uv_layers.new(name='UVMap')
            for i, pol in enumerate(me.polygons):
                pol.material_index = nombres.index(s.fm[i]); pol.use_smooth = s.fs[i]
                for k, li in enumerate(pol.loop_indices): uvl.data[li].uv = s.fuv[i][k]
        me.validate(); me.update()
        ob = bpy.data.objects.new(nombre, me); bpy.context.collection.objects.link(ob)
        ob.location = o0
        if padre: ob.parent = padre; ob.location = Vector() if locales else o0 - padre.matrix_world.translation
        return ob

def vacio(nombre, padre=None, pos=(0, 0, 0)):
    o = bpy.data.objects.new(nombre, None); bpy.context.collection.objects.link(o)
    o.location = Vector(pos) - (padre.matrix_world.translation if padre else Vector())
    if padre: o.parent = padre
    bpy.context.view_layer.update()
    return o

# ---------- piezas sueltas ----------
def caja(m, centro, tam, mat, ejes=None):
    c = Vector(centro); ex, ey, ez = ejes or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    hx, hy, hz = tam[0] / 2, tam[1] / 2, tam[2] / 2
    P = [c + ex * (sx * hx) + ey * (sy * hy) + ez * (sz * hz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    ids = [m.vx(p) for p in P]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        m.cara([ids[i] for i in f], mat, [(0, 0), (1, 0), (1, 1), (0, 1)], liso=False)

def cilindro(m, a, b, r0, r1, seg, mat, tapas=True, liso=True):
    a, b = Vector(a), Vector(b); d = (b - a); L = d.length; d.normalize()
    u = d.orthogonal().normalized(); w = d.cross(u)
    ra, rb = [], []
    for i in range(seg + 1):
        t = 2 * pi * i / seg; o = u * math.cos(t) + w * math.sin(t)
        ra.append(m.vx(a + o * r0)); rb.append(m.vx(b + o * r1))
    for i in range(seg):
        m.cara([ra[i], ra[i + 1], rb[i + 1], rb[i]], mat, [(i / seg, 0), ((i + 1) / seg, 0), ((i + 1) / seg, L * 2), (i / seg, L * 2)], liso)
    if tapas:
        m.cara(list(reversed(ra[:-1])), mat, liso=False); m.cara(rb[:-1], mat, liso=False)

def ejes_desde(z, x_aprox=Vector((1, 0, 0))):
    z = Vector(z).normalized(); x = (x_aprox - z * x_aprox.dot(z)).normalized(); y = z.cross(x)
    return x, y, z


# ---------- el casco ----------
class Casco:
    def __init__(s, L, B, K, D, sheer_proa=.10, sheer_popa=.07, espejo=.74, lanzamiento=.12):
        s.L, s.B, s.K, s.D = L, B, K, D            # largo, media manga, calado, altura de cubierta
        s.sp, s.spp, s.esp, s.lanz = sheer_proa, sheer_popa, espejo, lanzamiento
    def manga(s, u):  # media manga en la regala
        if u < .22: return s.B * (s.esp + (1 - s.esp) * math.sin(u / .22 * pi / 2))
        if u < .6: return s.B
        k = (u - .6) / .4; return s.B * max(0, 1 - k ** 2.3) ** .55
    def sh(s, u):  # arrufo: cuánto sube la borda hacia las puntas
        return s.sp * ((u - .45) / .55) ** 2 if u > .45 else s.spp * ((.45 - u) / .45) ** 2
    def regala(s, u): return s.D + .08 + s.sh(u)
    def cubierta(s, u): return s.D + s.sh(u) * .9
    def quilla(s, u):
        k = s.K * (1 - .25 * ((u - .5) / .5) ** 2)
        if u > .82: k *= 1 - .92 * ((u - .82) / .18) ** 1.6
        return k
    def x(s, u, t=1): return (u - .5) * s.L + s.lanz * t * max(0, (u - .85) / .15)
    def ancho(s, u, z):  # media manga a una altura z
        t = clamp((z + s.quilla(u)) / (s.regala(u) + s.quilla(u)), 0, 1)
        e = .35 + .55 * min(1, abs(u - .5) / .5) ** 2 + 1.1 * max(0, (.3 - u) / .3) ** 1.5
        f = math.sin(t * pi / 2) ** e
        return s.manga(u) * f * (1 - .13 * max(0, (t - .62) / .38) ** 2), t
    def niveles(s, u):
        sh, q, rg, cb = s.sh(u), s.quilla(u), s.regala(u), s.cubierta(u)
        zs = [(-q, 'fondo'), (-q * .8, 'fondo'), (-q * .55, 'fondo'), (-q * .3, 'fondo'), (-q * .1, 'fondo'), (0, 'madera'),
              (.035, 'madera'), (.07 + sh, 'negro'), (.10 + sh, 'banda'), (.15 + sh, 'banda'), (.20 + sh, 'madera'),
              (cb, 'madera'), (rg - .016, 'negro'), (rg, None)]
        return [(z, m) for z, m in zs]  # el material es el de la franja que arranca en ese nivel

    def armar(s, m, u0, u1, n, cubierta=True, tapa_corte=True):
        anillos = []
        for i in range(n + 1):
            r = i / n
            u = u0 + (u1 - u0) * (r if u1 <= .5 else 1 - (1 - r) ** 1.35)
            niv = s.niveles(u); fila = []
            for lado in (-1, 1):
                pts = []
                for z, mt in (reversed(niv) if lado < 0 else niv):
                    w, t = s.ancho(u, z)
                    pts.append((m.vx((s.x(u, t), lado * w, z)), z))
                fila.append(pts)
            # una sola tira: borda babor → quilla → borda estribor (la quilla no se repite)
            anillos.append((u, fila[0] + fila[1][1:], niv))
        nn = len(anillos[0][1])
        for i in range(n):
            ua, A, niv = anillos[i]; ub, Bb, _ = anillos[i + 1]
            for j in range(nn - 1):
                kk = (len(niv) - 2 - j) if j < len(niv) - 1 else j - (len(niv) - 1)
                mt = niv[kk][1]
                za, zb = A[j][1], A[j + 1][1]
                uv = [(s.x(ua) / 2, za * 2.2), (s.x(ua) / 2, zb * 2.2), (s.x(ub) / 2, Bb[j + 1][1] * 2.2), (s.x(ub) / 2, Bb[j][1] * 2.2)]
                m.cara([A[j][0], A[j + 1][0], Bb[j + 1][0], Bb[j][0]], mt, uv)
        # espejo de popa
        if u0 == 0:
            u, A, niv = anillos[0]
            m.cara([p[0] for p in A], 'madera', [(m.v[p[0]][1] * 2, p[1] * 2.2) for p in A], liso=False)
        # corte del medio (astillado), solo hasta la cubierta
        if tapa_corte:
            for (u, A, niv), sgn in ((anillos[0], -1), (anillos[-1], 1)):
                if abs(u - .5) > 1e-6: continue
                cb = s.cubierta(u)
                ids = [p[0] for p in A if p[1] <= cb + 1e-6]
                if sgn > 0: ids = ids[::-1]
                m.cara(ids, 'astilla', [(m.v[i][1] * 2, m.v[i][2] * 2) for i in ids], liso=False)
        # cubierta (con bombeo)
        if cubierta:
            prev = None
            for i in range(n + 1):
                u = anillos[i][0]; z = s.cubierta(u); w = s.ancho(u, z)[0] * .985; x = s.x(u, (z + s.quilla(u)) / (s.regala(u) + s.quilla(u)))
                fila = [m.vx((x, -w, z)), m.vx((x, 0, z + .012)), m.vx((x, w, z))]
                ys = (-w, 0, w)
                if prev:
                    (pf, px, pys) = prev
                    for j in range(2):
                        m.cara([pf[j], fila[j], fila[j + 1], pf[j + 1]], 'cubierta',
                               [(px / 1.6, pys[j] * 2.5), (x / 1.6, ys[j] * 2.5), (x / 1.6, ys[j + 1] * 2.5), (px / 1.6, pys[j + 1] * 2.5)])
                prev = (fila, x, ys)

    def borde(s, u, z, lado):  # punto sobre el costado
        w, t = s.ancho(u, z); return Vector((s.x(u, t), lado * w, z))
    def u_de(s, x): return x / s.L + .5


# ---------- velas ----------
def vela_cuadrada(m, zh, zf, wh, wf, panza, braza, x0=0, pie=.05):
    R = Matrix.Rotation(braza, 3, 'Z'); nx, ny = 8, 6; ids = []
    for j in range(ny + 1):
        r = j / ny; fila = []
        for i in range(nx + 1):
            sv = i / nx
            y = (-.5 + sv) * lerp(wh, wf, r)
            z = lerp(zh, zf, r) + pie * math.sin(pi * sv) * r ** 4
            x = x0 + panza * math.sin(pi * sv) * math.sin(pi * (.12 + .88 * r)) * (1 - .25 * r)
            fila.append(m.vx(R @ Vector((x, y, z))))
        ids.append(fila)
    for j in range(ny):
        for i in range(nx):
            m.cara([ids[j][i], ids[j + 1][i], ids[j + 1][i + 1], ids[j][i + 1]], 'vela',
                   [(i / nx, 1 - j / ny), (i / nx, 1 - (j + 1) / ny), ((i + 1) / nx, 1 - (j + 1) / ny), ((i + 1) / nx, 1 - j / ny)])

def vela_triangulo(m, A, B, C, panza, lado=1):
    """A puño de driza (arriba), B amura (adelante/abajo), C escota (atrás/abajo). Sopla hacia +Y·lado."""
    A, B, C = Vector(A), Vector(B), Vector(C); n = 6; ids = []
    for j in range(n + 1):
        r = j / n; fila = []
        for i in range(n + 1):
            sv = i / n
            p = (A.lerp(B, sv)).lerp(C, r * (1 - .0))
            p = p + Vector((0, lado * panza * math.sin(pi * sv) * math.sin(pi * min(1, r * 1.1)) * (1 - r * .5), 0))
            fila.append(m.vx(p))
        ids.append(fila)
    for j in range(n):
        for i in range(n):
            m.cara([ids[j][i], ids[j + 1][i], ids[j + 1][i + 1], ids[j][i + 1]], 'vela',
                   [(i / n, j / n), (i / n, (j + 1) / n), ((i + 1) / n, (j + 1) / n), ((i + 1) / n, j / n)])

def vela_cangreja(m, P, panza, lado=1):
    """Cuatro puntos: pie del palo, puño de boca (arriba palo), pico (arriba popa), escota (abajo popa)."""
    P = [Vector(p) for p in P]; n = 6; ids = []
    for j in range(n + 1):
        r = j / n; fila = []
        for i in range(n + 1):
            sv = i / n
            p = P[0].lerp(P[3], sv).lerp(P[1].lerp(P[2], sv), r)
            p = p + Vector((0, lado * panza * math.sin(pi * sv) * math.sin(pi * r), 0))
            fila.append(m.vx(p))
        ids.append(fila)
    for j in range(n):
        for i in range(n):
            m.cara([ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]], 'vela',
                   [(i / n, j / n), ((i + 1) / n, j / n), ((i + 1) / n, (j + 1) / n), (i / n, (j + 1) / n)])


# ---------- palos ----------
def palo_completo(rol, idx, padre, casco, u, h, ancho_v, velas_cuadradas, braza, bandera=False, cangreja=False, estays=(), tri_extra=()):
    """Palo con mastelero y mastelerillo, cofa, crucetas, vergas, velas y jarcias. Todo relativo al pie del palo."""
    zc = casco.cubierta(u); xm = casco.x(u); pie = Vector((xm, 0, zc))
    g = vacio(f'{rol}_palo_{idx}', padre, pie)
    m = Malla(); j = Malla()
    L = lambda p: Vector(p) - pie  # de coordenadas del barco a coordenadas del palo
    # palo macho, mastelero, mastelerillo
    cilindro(m, (0, 0, -.02), (0, 0, .47 * h), .036, .03, 8, 'palo')
    cilindro(m, (-.03, 0, .40 * h), (-.03, 0, .79 * h), .022, .018, 6, 'palo')
    cilindro(m, (-.045, 0, .74 * h), (-.045, 0, h), .014, .008, 6, 'palo')
    cilindro(m, (-.045, 0, h), (-.045, 0, h + .02), .016, .014, 6, 'palo')  # tope
    caja(m, (-.02, 0, .45 * h), (.17, .24, .014), 'palo')                     # cofa
    caja(m, (-.035, 0, .775 * h), (.05, .17, .01), 'palo')                     # crucetas
    # vergas y velas cuadradas
    R = Matrix.Rotation(braza, 3, 'Z')
    for (zh, zf, wh, wf) in velas_cuadradas:
        zh, zf = zh * h, zf * h
        a, b = R @ Vector((.012, -wh * .56, zh + .012)), R @ Vector((.012, wh * .56, zh + .012))
        mid = (a + b) / 2
        cilindro(m, a, mid, .007, .013, 5, 'palo', tapas=False); cilindro(m, mid, b, .013, .007, 5, 'palo', tapas=False)
        vela_cuadrada(m, zh, zf, wh, wf, panza=.1 + .06 * wh, braza=braza, x0=.03)
    # cangreja (mesana)
    if cangreja:
        p0 = Vector((-.02, 0, .17 * h)); p1 = Vector((-.02, 0, .46 * h)); p2 = Vector((-.78, 0, .62 * h)); p3 = Vector((-.86, 0, .16 * h))
        cilindro(m, p1, p2 + Vector((-.04, 0, .02)), .012, .007, 5, 'palo')
        cilindro(m, p0, p3 + Vector((-.06, 0, -.004)), .013, .009, 5, 'palo')
        vela_cangreja(m, (p0 + Vector((-.02, 0, .01)), p1, p2, p3), .07, lado=1)
        vacio(f'{rol}_bandera_{idx}b', g, pie + p2 + Vector((-.05, 0, .02)))
    for (A, B, C, panza) in tri_extra:
        vela_triangulo(m, L(A), L(B), L(C), panza)
    if bandera: vacio(f'{rol}_bandera_{idx}', g, pie + Vector((-.045, 0, h + .02)))
    # --- jarcias (líneas) ---
    def obenques(z_top, x_top, pies):
        for lado in (-1, 1):
            arriba = Vector((x_top, lado * .02, z_top)); prev = None
            ps = [L(p) for p in pies(lado)]
            for p in ps: j.linea(arriba, p)
            # flechadura: escalones horizontales entre obenques
            z = min(p.z for p in ps) + .035
            while z < z_top - .03:
                pts = []
                for p in ps:
                    t = (z - p.z) / (z_top - p.z)
                    if 0 < t < 1: pts.append(p.lerp(arriba, t))
                for a, b in zip(pts, pts[1:]): j.linea(a, b)
                z += .038
    def pies_bajos(lado):
        out = []
        for dx in (-.03, -.09, -.15, -.21):
            uu = casco.u_de(xm + dx); rg = casco.regala(uu) - .025
            out.append(casco.borde(uu, rg, lado) + Vector((0, lado * .03, 0)))
        return out
    obenques(.44 * h, 0, pies_bajos)
    def pies_cofa(lado): return [pie + Vector((dx, lado * .115, .455 * h)) for dx in (-.0, -.05, -.1)]
    obenques(.77 * h, -.03, pies_cofa)
    def pies_cruceta(lado): return [pie + Vector((dx, lado * .08, .78 * h)) for dx in (-.03, -.07)]
    for lado in (-1, 1):
        for p in pies_cruceta(lado): j.linea(Vector((-.045, 0, .97 * h)), L(p))
    # brandales (al costado, más atrás)
    for lado in (-1, 1):
        for dx, zt in ((-.42, .77), (-.52, .97)):
            uu = casco.u_de(xm + dx); rg = casco.regala(uu) - .02
            j.linea(Vector((-.04, 0, zt * h)), L(casco.borde(uu, rg, lado) + Vector((0, lado * .03, 0))))
    # estays hacia adelante
    for z_rel, destino in estays: j.linea(Vector((0, 0, z_rel * h)), L(destino))
    m.objeto(f'{rol}_palo_{idx}_m', g, pie, locales=True)
    if not j.vacia(): j.objeto(f'{rol}_palo_{idx}_jarcia', g, pie, locales=True)
    return g, pie


# ---------- la fragata ----------
def fragata():
    rol = 'fragata'
    L = 4 * .92
    C = Casco(L=L, B=.40, K=.21, D=.235)
    raiz = vacio(rol)
    mitades = {}
    for nombre, (u0, u1, n) in (('popa', (0, .5, 16)), ('proa', (.5, 1, 22))):
        g = vacio(f'{rol}_{nombre}', raiz); m = Malla()
        C.armar(m, u0, u1, n)
        mitades[nombre] = (g, m)
    def mit(x): return mitades['popa' if x < 0 else 'proa'][1]
    def grupo(x): return mitades['popa' if x < 0 else 'proa'][0]

    # portas con sus tapas abiertas y los cañones asomando
    n = 9
    for i in range(n):
        u = .2 + i * (.56 / (n - 1)); zc = .152 + C.sh(u)
        for lado in (-1, 1):
            p = C.borde(u, zc, lado); m = mit(p.x)
            caja(m, p + Vector((0, lado * .004, 0)), (.058, .012, .05), 'porta')
            bisagra = p + Vector((0, lado * .008, .027)); a = math.radians(115)
            d = Vector((0, lado * math.sin(a), -math.cos(a)))
            caja(m, bisagra + d * .026, (.06, .006, .052), 'tapa', (Vector((1, 0, 0)), d.cross(Vector((1, 0, 0))).normalized(), d))
            cilindro(m, p + Vector((0, -lado * .01, -.004)), p + Vector((0, lado * .055, -.002)), .014, .011, 7, 'hierro')
    # espejo de popa: ventanas, faroles y galerías
    u0 = 0.0; xs = C.x(0) - .004; zr = C.regala(0)
    for i in range(5):
        y = (-.5 + (i + .5) / 5) * C.manga(0) * 1.15
        caja(mit(-1), (xs, y, zr - .075), (.008, .045, .04), 'ventana')
    caja(mit(-1), (xs - .002, 0, zr - .028), (.01, C.manga(0) * 1.7, .018), 'dorado')
    caja(mit(-1), (xs - .002, 0, zr - .118), (.01, C.manga(0) * 1.6, .012), 'dorado')
    for y, alto in ((-.13, .1), (0, .14), (.13, .1)):
        cilindro(mit(-1), (xs + .02, y, zr), (xs + .02, y, zr + alto), .006, .006, 4, 'hierro', tapas=False)
        cilindro(mit(-1), (xs + .02, y, zr + alto), (xs + .02, y, zr + alto + .05), .022, .016, 8, 'farol')
    for lado in (-1, 1):  # galerías de los costados
        p = C.borde(.04, zr - .09, lado)
        caja(mit(-1), p + Vector((.02, lado * .02, 0)), (.14, .05, .08), 'madera')
        caja(mit(-1), p + Vector((.02, lado * .046, .005)), (.1, .006, .035), 'ventana')
    # bauprés y botalón, mascarón
    up = C.regala(1); proa = Vector((C.x(.97, 1), 0, up - .03))
    dirb = Vector((math.cos(math.radians(20)), 0, math.sin(math.radians(20))))
    cilindro(mit(1), proa - dirb * .25, proa + dirb * .75, .032, .022, 8, 'palo')
    cilindro(mit(1), proa + dirb * .6, proa + dirb * 1.35, .015, .009, 6, 'palo')
    cilindro(mit(1), proa + Vector((-.02, 0, -.08)), proa + Vector((.11, 0, -.02)), .018, .03, 7, 'dorado')
    for lado in (-1, 1):  # serviolas
        p = C.borde(.9, C.regala(.9) - .02, lado)
        cilindro(mit(1), p, p + Vector((.06, lado * .1, .01)), .012, .012, 5, 'madera')
    # cubierta: escotillas, cabrestante, bote y rueda
    for u in (.36, .63):
        x = C.x(u); z = C.cubierta(u)
        caja(mit(x), (x, 0, z + .016), (.16, .17, .03), 'negro')
    x = C.x(.43); z = C.cubierta(.43)
    cilindro(mit(x), (x, 0, z), (x, 0, z + .07), .03, .026, 10, 'palo')
    x = C.x(.15); z = C.cubierta(.15)
    cilindro(mit(x), (x, -.03, z + .07), (x, .03, z + .07), .05, .05, 12, 'madera')
    caja(mit(x), (x, 0, z + .03), (.03, .07, .06), 'madera')
    # el bote, boca arriba sobre la cubierta
    Cb = Casco(L=.3, B=.055, K=.03, D=.025, sheer_proa=.03, sheer_popa=.02, espejo=.6, lanzamiento=.02)
    mb = Malla(); Cb.armar(mb, 0, .5, 4, cubierta=False, tapa_corte=False); Cb.armar(mb, .5, 1, 6, cubierta=False, tapa_corte=False)
    xb = C.x(.6); zb = C.cubierta(.6) + .045
    for i, p in enumerate(mb.v): mb.v[i] = (p[0] + xb, p[1], p[2] + zb)
    mb.fm = ['bote' if f in ('banda', 'madera', 'negro', 'fondo') else f for f in mb.fm]
    mm = mit(xb); base = len(mm.v)
    mm.v += mb.v; mm.f += [[i + base for i in f] for f in mb.f]; mm.fm += mb.fm; mm.fuv += mb.fuv; mm.fs += mb.fs
    caja(mm, (xb - .07, 0, zb - .025), (.025, .16, .04), 'madera'); caja(mm, (xb + .07, 0, zb - .025), (.025, .16, .04), 'madera')

    # palos: mesana, mayor, trinquete
    br = .2
    um, ua, ut = .22, .48, .74
    xt = C.x(ut); zt = C.cubierta(ut)
    pie_t = Vector((xt, 0, zt)); pie_a = Vector((C.x(ua), 0, C.cubierta(ua)))
    punta_baupres = proa + dirb * .72; punta_boton = proa + dirb * 1.3
    h_m, h_a, h_t = 2.3, 2.95, 2.6
    # mesana (con cangreja)
    palo_completo(rol, 0, grupo(C.x(um)), C, um, h_m,
                  .8, [(.70, .47, .88, 1.08), (.93, .76, .6, .8)], br, cangreja=True,
                  estays=[(.44, pie_a + Vector((0, 0, .45 * h_a * .2))), (.76, pie_a + Vector((-.02, 0, .45 * h_a)))])
    # mayor (con la bandera)
    hA = h_a
    palo_completo(rol, 1, grupo(C.x(ua)), C, ua, hA,
                  1.1, [(.40, .14, 1.45, 1.6), (.70, .46, 1.15, 1.42), (.93, .76, .8, 1.05)], br, bandera=True,
                  estays=[(.44, pie_t + Vector((0, 0, .03))), (.76, pie_t + Vector((-.02, 0, .45 * h_t)))],
                  tri_extra=[(pie_a + Vector((.02, 0, .74 * hA)), pie_t + Vector((-.02, 0, .47 * h_t)), pie_t + Vector((-.32, 0, .27 * h_t)), .05)])
    # trinquete (con los foques hacia el bauprés)
    palo_completo(rol, 2, grupo(xt), C, ut, h_t,
                  1.0, [(.40, .15, 1.32, 1.46), (.70, .46, 1.05, 1.3), (.93, .76, .72, .95)], br,
                  estays=[(.44, punta_baupres), (.76, punta_boton)],
                  tri_extra=[(pie_t + Vector((.0, 0, .75 * h_t)), punta_boton, proa + Vector((.16, 0, .2)), .06),
                             (pie_t + Vector((.0, 0, .55 * h_t)), proa + dirb * .55, proa + Vector((.0, 0, .16)), .05)])
    for nombre, (g, m) in mitades.items(): m.objeto(f'{rol}_{nombre}_m', g)
    return raiz


fragata()
bpy.context.view_layer.update()
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
print('triángulos', tris)
bpy.ops.export_scene.gltf(filepath=SALIDA, export_format='GLB', use_mesh_edges=True, export_materials='EXPORT',
                          export_normals=True, export_tangents=False, export_yup=True, export_apply=False, export_extras=False)
print('listo', SALIDA)
