import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';

const MODELO = 'modelo/campus.glb';
const RESUMEN = 'Modelo: 1.331.474 triángulos · 2.774.249 vértices · 177 objetos';
// "Enviar al registro" opens this page with the finished run packed into the link's #anchor.
const REGISTRO = 'https://claude.ai/artifact/P9jMQ3kxwHXsCPuJ23dNsJ';

// Layers of the dome frame, switched off in this order to measure what each one costs.
const CAPAS = [/_Domo_Nudos_N01$/, /_Domo_Tapetas_M02$/, /_Domo_Juntas_G01$/, /_Domo_Perfiles_M01$/];
const NIVELES = ['completa', 'sin nudos', 'sin nudos ni tapetas', 'sin nudos, tapetas ni juntas', 'sin estructura'];
const VIDRIO = /_Domo_Cristal_G01$|_Cristal$|_Baranda_Vidrio$|_Ascensor_Vidrio$/;
// What the visitor bumps into: floors, railings, glass and frames. The thin dome frame is left out.
const COLISION = /_Losa_PB$|_Semipiso$|Pavimento|_Acceso_|_Piso$|_Baranda_|_Domo_Cristal_G01$|_Portada_|_Marco_Corte_|_Anillo_Basal$|_Estructura$|_Cristal$|^FUENTE_(Borde|Vaso|Isla)|_Jardinera_\d$|_Ascensor_(Vidrio|Collares)$|_Baliza_/;

// Stress-test settings. Every measurement stores them as a short code such as e0x0s0i0l0o0v1m0t0r100f10:
// e dome frame level, x extra dome frames, s chairs, i chairs drawn as instances, l point lights, o sun shadows,
// v glass, m materials as exported from Blender, t 2K images held in memory, r resolution x100, f foveation x10.
const BASE = { e: 0, x: 0, s: 0, i: 0, l: 0, o: 0, v: 1, m: 0, t: 0 };
const OPCIONES = {
  e: [0, 1, 2, 3, 4],
  x: [0, 1, 2, 4, 6, 8],
  s: [0, 250, 500, 1000, 2000],
  l: [0, 4, 8, 16],
  t: [0, 10, 20, 40, 80],
  r: [50, 75, 100, 150, 200],
};
// The same list lives in the results log page; keep both in step when it changes.
const PROTOCOLO = [
  { id: 'A1', serie: 'A', cfg: { e: 4 }, texto: 'Sin estructura' },
  { id: 'A2', serie: 'A', cfg: { e: 3 }, texto: 'Sin nudos, tapetas, juntas' },
  { id: 'A3', serie: 'A', cfg: { e: 2 }, texto: 'Sin nudos ni tapetas' },
  { id: 'A4', serie: 'A', cfg: { e: 1 }, texto: 'Sin nudos' },
  { id: 'A5', serie: 'A', cfg: {}, texto: 'Campus completo' },
  { id: 'A6', serie: 'A', cfg: { x: 1 }, texto: '+1 estructura' },
  { id: 'A7', serie: 'A', cfg: { x: 2 }, texto: '+2 estructuras' },
  { id: 'A8', serie: 'A', cfg: { x: 4 }, texto: '+4 estructuras' },
  { id: 'A9', serie: 'A', cfg: { x: 6 }, texto: '+6 estructuras' },
  { id: 'A10', serie: 'A', cfg: { x: 8 }, texto: '+8 estructuras' },
  { id: 'B1', serie: 'B', cfg: { s: 250 }, texto: '250 sillas sueltas' },
  { id: 'B2', serie: 'B', cfg: { s: 500 }, texto: '500 sillas sueltas' },
  { id: 'B3', serie: 'B', cfg: { s: 1000 }, texto: '1000 sillas sueltas' },
  { id: 'B4', serie: 'B', cfg: { s: 2000 }, texto: '2000 sillas sueltas' },
  { id: 'B5', serie: 'B', cfg: { s: 2000, i: 1 }, texto: '2000 sillas instanciadas' },
  { id: 'C1', serie: 'C', cfg: { l: 4 }, texto: '4 luces' },
  { id: 'C2', serie: 'C', cfg: { l: 8 }, texto: '8 luces' },
  { id: 'C3', serie: 'C', cfg: { l: 16 }, texto: '16 luces' },
  { id: 'D1', serie: 'D', cfg: { o: 1 }, texto: 'Sombras' },
  { id: 'D2', serie: 'D', cfg: { v: 0 }, texto: 'Sin vidrio' },
  { id: 'D3', serie: 'D', cfg: { m: 1 }, texto: 'Materiales Blender' },
  { id: 'D4', serie: 'D', cfg: { f: 0 }, texto: 'Sin foveación', solo: 'vr' },
  { id: 'D5', serie: 'D', cfg: { r: 100 }, texto: 'Resolución ×1', solo: 'pc' },
  { id: 'D6', serie: 'D', cfg: { r: 200 }, texto: 'Resolución ×2', solo: 'pc' },
  { id: 'E1', serie: 'E', cfg: { e: 4, s: 2000 }, texto: 'Sin estr. + 2000 sillas' },
  { id: 'E2', serie: 'E', cfg: { e: 4, l: 16 }, texto: 'Sin estr. + 16 luces' },
  { id: 'E3', serie: 'E', cfg: { e: 4, o: 1 }, texto: 'Sin estr. + sombras' },
  { id: 'E4', serie: 'E', cfg: { e: 4, m: 1 }, texto: 'Sin estr. + mat. Blender' },
  { id: 'F1', serie: 'F', cfg: { t: 10 }, texto: '10 imágenes 2K' },
  { id: 'F2', serie: 'F', cfg: { t: 20 }, texto: '20 imágenes 2K' },
  { id: 'F3', serie: 'F', cfg: { t: 40 }, texto: '40 imágenes 2K' },
  { id: 'F4', serie: 'F', cfg: { t: 80 }, texto: '80 imágenes 2K' },
];
const CUENTA = 3;
const ASENTAR = 1.5;
const MEDIR = 3;

const ALTURA_OJOS = 1.6;
const RADIO = 0.3;
const VELOCIDAD = 3;
const PISO_ALTO = 15;
const EJE_Y = new THREE.Vector3(0, 1, 0);

const carga = document.getElementById('carga');
const barra = document.getElementById('barra-llena');
const estado = document.getElementById('estado');
const hud = document.getElementById('hud');
const controles = document.getElementById('controles');
const botonVR = document.getElementById('entrar-vr');
const botonResultados = document.getElementById('ver-resultados');
const selectorEscala = document.getElementById('escala-casco');
const panel = document.getElementById('resultados');
const panelMeta = document.getElementById('res-meta');
const panelFilas = document.getElementById('res-filas');
const enlaceRegistro = document.getElementById('res-enviar');
const botonCopiar = document.getElementById('res-copiar');
const avisoCopia = document.getElementById('res-aviso');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const resolucionPantalla = Math.round(Math.min(window.devicePixelRatio, 1.5) * 100);
const porDefecto = { r: resolucionPantalla, f: 10 };
let cfg = { ...BASE, ...porDefecto };
renderer.setPixelRatio(cfg.r / 100);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const escena = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
escena.environmentIntensity = 0.7;

const sol = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(150));
const cielo = new Sky();
cielo.scale.setScalar(1500);
const uniformes = cielo.material.uniforms;
uniformes.turbidity.value = 5;
uniformes.rayleigh.value = 1.2;
uniformes.mieCoefficient.value = 0.004;
uniformes.mieDirectionalG.value = 0.8;
uniformes.sunPosition.value.copy(sol);
escena.add(cielo);

const hemisferio = new THREE.HemisphereLight(0xdfeeff, 0x5d5a4e, 0.9);
const luzSol = new THREE.DirectionalLight(0xfff4e5, 2.6);
luzSol.position.copy(sol).multiplyScalar(150);
luzSol.castShadow = false;
luzSol.shadow.mapSize.set(2048, 2048);
Object.assign(luzSol.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 });
luzSol.shadow.bias = -0.0005;
luzSol.shadow.normalBias = 0.02;
escena.add(hemisferio, luzSol, luzSol.target);

// Ground around the campus; it starts at the patio edge so it never shows inside the fountain.
const suelo = new THREE.Mesh(
  new THREE.RingGeometry(19.4, 600, 96, 1),
  new THREE.MeshStandardMaterial({ color: 0x7d8471, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
suelo.position.y = -0.03;
suelo.receiveShadow = true;
escena.add(suelo);

const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camara.position.set(0, ALTURA_OJOS, 0);
const visitante = new THREE.Group();
visitante.add(camara);
escena.add(visitante);

const fabricaMandos = new XRControllerModelFactory();
for (let i = 0; i < 2; i++) {
  const agarre = renderer.xr.getControllerGrip(i);
  agarre.add(fabricaMandos.createControllerModel(agarre));
  visitante.add(agarre);
}

// Readout shown inside the headset, where the HTML overlay does not exist.
const lienzoHud = document.createElement('canvas');
lienzoHud.width = 840;
lienzoHud.height = 290;
const pincelHud = lienzoHud.getContext('2d');
const texturaHud = new THREE.CanvasTexture(lienzoHud);
texturaHud.colorSpace = THREE.SRGBColorSpace;
const placaHud = new THREE.Mesh(
  new THREE.PlaneGeometry(0.52, 0.52 * 290 / 840),
  new THREE.MeshBasicMaterial({ map: texturaHud, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
);
placaHud.position.set(-0.17, -0.2, -0.7);
placaHud.renderOrder = 999;
placaHud.visible = false;
camara.add(placaHud);

// Results board for the headset, left standing in the world in front of the visitor.
const lienzoTablero = document.createElement('canvas');
lienzoTablero.width = 1024;
lienzoTablero.height = 1024;
const pincelTablero = lienzoTablero.getContext('2d');
const texturaTablero = new THREE.CanvasTexture(lienzoTablero);
texturaTablero.colorSpace = THREE.SRGBColorSpace;
const tablero = new THREE.Mesh(
  new THREE.PlaneGeometry(1.3, 1.3),
  new THREE.MeshBasicMaterial({ map: texturaTablero, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
);
tablero.renderOrder = 998;
tablero.visible = false;
escena.add(tablero);

const grupos = { capas: CAPAS.map(() => []), vidrio: [] };
const mallas = [];
const copias = [];
const referencia = { fuente: new THREE.Vector3(), domo1: new THREE.Vector3(0, 0, -50), pisoDomo1: 0, radioDomo1: 30 };
const inicio = { posicion: new THREE.Vector3(), giro: 0 };
let colision = null;
let ejesAscensor = [];
let hudVisible = true;
let velocidadVertical = 0;
let enSuelo = false;
let cabeceo = 0;
let pasoActual = null;
let indiceManual = -1;

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const cargador = new GLTFLoader().setDRACOLoader(draco);
cargador.load(
  MODELO,
  (gltf) => preparar(gltf.scene).catch(fallo),
  (progreso) => {
    if (!progreso.total) return;
    const fraccion = progreso.loaded / progreso.total;
    barra.style.width = `${90 * fraccion}%`;
    estado.textContent = `Cargando el campus… ${Math.round(100 * fraccion)} % de ${(progreso.total / 1048576).toFixed(1)} MB`;
  },
  fallo
);

function fallo(error) {
  estado.textContent = 'No se pudo cargar el campus: ' + (error && error.message ? error.message : error);
  console.error(error);
}

async function preparar(modelo) {
  estado.textContent = 'Preparando materiales y colisiones…';
  barra.style.width = '95%';
  await new Promise((listo) => setTimeout(listo, 30));

  escena.add(modelo);
  modelo.updateMatrixWorld(true);
  const convertidos = new Map();
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    const coincide = (patron) => [o.name, o.parent ? o.parent.name : ''].some((n) => patron.test(n));
    o.userData.original = o.material;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => liviano(m, convertidos))
      : liviano(o.material, convertidos);
    o.userData.liviano = o.material;
    const transparente = [].concat(o.material).some((m) => m.transparent);
    o.castShadow = !transparente;
    o.receiveShadow = true;
    o.matrixAutoUpdate = false;
    mallas.push(o);
    CAPAS.forEach((patron, i) => { if (coincide(patron)) grupos.capas[i].push(o); });
    if (coincide(VIDRIO)) grupos.vidrio.push(o);
  });

  colision = construirColisiones(modelo);
  ejesAscensor = ['D1', 'D2', 'D3']
    .map((domo) => modelo.getObjectByName(`${domo}_Ascensor_Cabina`))
    .filter(Boolean)
    .map((o) => o.getWorldPosition(new THREE.Vector3()).setY(0));
  medirReferencias(modelo);
  prepararCopias();
  ubicarInicio();

  carga.hidden = true;
  controles.hidden = false;
  hud.hidden = !hudVisible;
  botonResultados.disabled = !ultimaCorrida;
  renderer.setAnimationLoop(cuadro);
}

// Glass and water become plain transparency and the anisotropic aluminium a standard metal:
// transmission and anisotropy are the most expensive shaders three.js has, and this is a performance test.
// The originals stay on each mesh for the "materiales Blender" step.
function liviano(m, cache) {
  if (cache.has(m)) return cache.get(m);
  const nombre = m.name || '';
  let nuevo = m;
  if (nombre.startsWith('GLASS')) {
    nuevo = new THREE.MeshStandardMaterial({
      name: nombre, color: m.color.clone(), roughness: 0.05, metalness: 0,
      transparent: true, opacity: nombre === 'GLASS_RAIL' ? 0.28 : 0.16, depthWrite: false,
    });
  } else if (nombre === 'WATER') {
    nuevo = new THREE.MeshStandardMaterial({
      name: nombre, color: m.color.clone(), normalMap: m.normalMap, roughness: 0.1, metalness: 0,
      transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    });
    if (m.normalScale) nuevo.normalScale.copy(m.normalScale);
  } else {
    nuevo = new THREE.MeshStandardMaterial({
      name: nombre, color: m.color.clone(), map: m.map, normalMap: m.normalMap,
      roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, roughness: m.roughness, metalness: m.metalness,
      emissive: m.emissive.clone(), emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity,
    });
    if (m.normalScale) nuevo.normalScale.copy(m.normalScale);
  }
  // Every solid in the model is closed (the report lists 0 open solids except the water), so back faces never show.
  if (nombre !== 'WATER') nuevo.side = THREE.FrontSide;
  cache.set(m, nuevo);
  return nuevo;
}

function construirColisiones(modelo) {
  const piezas = [];
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    const nombres = [o.name, o.parent ? o.parent.name : ''];
    if (!nombres.some((n) => COLISION.test(n)) || nombres.some((n) => /LED/.test(n))) return;
    piezas.push(soloPosicion(o.geometry, o.matrixWorld));
  });
  suelo.updateMatrixWorld(true);
  piezas.push(soloPosicion(suelo.geometry, suelo.matrixWorld));
  const unida = mergeGeometries(piezas, false);
  unida.boundsTree = new MeshBVH(unida);
  console.info(`Colisiones: ${piezas.length} piezas, ${unida.attributes.position.count / 3} triángulos`);
  return unida;
}

function soloPosicion(geometria, matriz) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', geometria.attributes.position.clone());
  if (geometria.index) g.setIndex(geometria.index.clone());
  if (g.index) g = g.toNonIndexed();
  g.applyMatrix4(matriz);
  return g;
}

function domoDe(o) {
  const nombres = `${o.name} ${o.parent ? o.parent.name : ''}`;
  const hallado = nombres.match(/(?:^|\s)(D[123])_/);
  return hallado ? hallado[1] : null;
}

function medirReferencias(modelo) {
  const fuente = modelo.getObjectByName('FUENTE_Borde_FO01');
  if (fuente) new THREE.Box3().setFromObject(fuente).getCenter(referencia.fuente);
  const caja = new THREE.Box3();
  for (const o of grupos.capas.flat()) if (domoDe(o) === 'D1') caja.expandByObject(o);
  if (!caja.isEmpty()) {
    caja.getCenter(referencia.domo1);
    referencia.radioDomo1 = (caja.max.x - caja.min.x) / 2;
  }
  const losa = modelo.getObjectByName('D1_Losa_PB');
  referencia.pisoDomo1 = losa ? new THREE.Box3().setFromObject(losa).max.y : 0;
}

// Extra dome frames: the same geometry drawn again, a little smaller, inside each dome. They share
// the original buffers, so they add drawing work but no memory.
function prepararCopias() {
  const cajas = {};
  for (const o of grupos.capas.flat()) {
    const domo = domoDe(o);
    if (domo) (cajas[domo] ||= new THREE.Box3()).expandByObject(o);
  }
  const escala = new THREE.Matrix4();
  const regreso = new THREE.Matrix4();
  for (let nivel = 1; nivel <= OPCIONES.x[OPCIONES.x.length - 1]; nivel++) {
    const s = 1 - 0.03 * nivel;
    for (const o of grupos.capas.flat()) {
      const caja = cajas[domoDe(o)];
      if (!caja) continue;
      const c = caja.getCenter(new THREE.Vector3());
      c.y = caja.min.y;
      const copia = new THREE.Mesh(o.geometry, o.material);
      copia.matrixAutoUpdate = false;
      copia.matrix.makeTranslation(c.x, c.y, c.z)
        .multiply(escala.makeScale(s, s, s))
        .multiply(regreso.makeTranslation(-c.x, -c.y, -c.z))
        .multiply(o.matrixWorld);
      copia.matrixWorldNeedsUpdate = true;
      copia.visible = false;
      copia.userData.fuente = o;
      copias.push({ malla: copia, nivel });
      escena.add(copia);
    }
  }
}

// Start in the patio, 14 m from the fountain, looking at dome 1 across it.
function ubicarInicio() {
  const centro = referencia.fuente;
  const domo = ejesAscensor[0] || referencia.domo1;
  const hacia = new THREE.Vector3(domo.x - centro.x, 0, domo.z - centro.z).normalize();
  inicio.posicion.set(centro.x - hacia.x * 14, 0.05, centro.z - hacia.z * 14);
  inicio.giro = Math.atan2(-hacia.x, -hacia.z);
  volverAlInicio();
}

function volverAlInicio() {
  visitante.position.copy(inicio.posicion);
  visitante.rotation.set(0, inicio.giro, 0);
  velocidadVertical = 0;
}

// Back to the test point, looking at dome 1. In the headset it is the real head that lands there.
function irAlPuntoDePrueba() {
  cabeceo = 0;
  volverAlInicio();
  if (!renderer.xr.isPresenting) return;
  const giroCabeza = new THREE.Euler().setFromQuaternion(camara.quaternion, 'YXZ').y;
  visitante.rotation.set(0, inicio.giro - giroCabeza, 0);
  const desvio = new THREE.Vector3(camara.position.x, 0, camara.position.z).applyAxisAngle(EJE_Y, visitante.rotation.y);
  visitante.position.set(inicio.posicion.x - desvio.x, inicio.posicion.y, inicio.posicion.z - desvio.z);
}

// ---------- Test settings ----------

function codigo(c) {
  return `e${c.e}x${c.x}s${c.s}i${c.i}l${c.l}o${c.o}v${c.v}m${c.m}t${c.t}r${c.r}f${c.f}`;
}

function configDelPaso(paso) {
  return { ...BASE, ...porDefecto, ...paso.cfg };
}

function fijar(nueva) {
  const antes = cfg;
  cfg = nueva;
  if (cfg.e !== antes.e) aplicarEstructura();
  if (cfg.x !== antes.x) aplicarExtras();
  if (cfg.s !== antes.s || cfg.i !== antes.i) aplicarSillas();
  if (cfg.l !== antes.l) aplicarLuces();
  if (cfg.o !== antes.o) luzSol.castShadow = cfg.o === 1;
  if (cfg.v !== antes.v) aplicarVidrio();
  if (cfg.m !== antes.m) aplicarMateriales();
  if (cfg.t !== antes.t) aplicarImagenes();
  if (cfg.r !== antes.r && !renderer.xr.isPresenting) renderer.setPixelRatio(cfg.r / 100);
  if (cfg.f !== antes.f) renderer.xr.setFoveation(cfg.f / 10);
}

function cambiar(clave, valor) {
  pasoActual = null;
  fijar({ ...cfg, [clave]: valor });
}

function ciclar(clave) {
  const lista = OPCIONES[clave] || [0, 1];
  const siguiente = lista.find((v) => v > cfg[clave]);
  cambiar(clave, siguiente === undefined ? lista[0] : siguiente);
}

function pasosDelDispositivo() {
  const modo = renderer.xr.isPresenting ? 'vr' : 'pc';
  return PROTOCOLO.filter((p) => !p.solo || p.solo === modo);
}

function pasoManual(delta) {
  const pasos = pasosDelDispositivo();
  indiceManual = (indiceManual + delta + pasos.length) % pasos.length;
  pasoActual = pasos[indiceManual];
  fijar(configDelPaso(pasoActual));
}

function aplicarEstructura() {
  grupos.capas.forEach((lista, i) => lista.forEach((o) => { o.visible = i >= cfg.e; }));
}

function aplicarVidrio() {
  grupos.vidrio.forEach((o) => { o.visible = cfg.v === 1; });
}

function aplicarExtras() {
  for (const { malla, nivel } of copias) malla.visible = nivel <= cfg.x;
}

function aplicarMateriales() {
  for (const o of mallas) o.material = cfg.m ? o.userData.original : o.userData.liviano;
  for (const { malla } of copias) malla.material = malla.userData.fuente.material;
}

// Chairs in rows on the ground floor of dome 1, which the test point looks at.
let sillas = null;
function prepararSillas() {
  if (sillas) return sillas;
  const caja = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const geometria = mergeGeometries([
    caja(0.46, 0.05, 0.46, 0, 0.45, 0),
    caja(0.46, 0.42, 0.04, 0, 0.69, -0.21),
    caja(0.04, 0.43, 0.04, -0.2, 0.215, -0.2),
    caja(0.04, 0.43, 0.04, 0.2, 0.215, -0.2),
    caja(0.04, 0.43, 0.04, -0.2, 0.215, 0.2),
    caja(0.04, 0.43, 0.04, 0.2, 0.215, 0.2),
  ], false);
  const material = new THREE.MeshStandardMaterial({ color: 0xc8742f, roughness: 0.55 });
  const centro = referencia.domo1;
  const haciaPatio = new THREE.Vector3(referencia.fuente.x - centro.x, 0, referencia.fuente.z - centro.z).normalize();
  const costado = new THREE.Vector3(-haciaPatio.z, 0, haciaPatio.x);
  const radio = Math.min(23, referencia.radioDomo1 - 6);
  const ascensor = ejesAscensor[0];
  const puestos = [];
  for (let b = -radio; b <= radio; b += 0.95) {
    for (let a = -radio; a <= radio; a += 0.75) {
      if (a * a + b * b > radio * radio) continue;
      const x = centro.x + costado.x * a + haciaPatio.x * b;
      const z = centro.z + costado.z * a + haciaPatio.z * b;
      if (ascensor && Math.hypot(x - ascensor.x, z - ascensor.z) < 4) continue;
      puestos.push({ x, z, d: a * a + b * b });
    }
  }
  puestos.sort((p, q) => p.d - q.d);
  const total = Math.min(OPCIONES.s[OPCIONES.s.length - 1], puestos.length);
  const giro = new THREE.Quaternion().setFromAxisAngle(EJE_Y, Math.atan2(haciaPatio.x, haciaPatio.z));
  const unidad = new THREE.Vector3(1, 1, 1);
  const lugar = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const sueltas = new THREE.Group();
  const instancias = new THREE.InstancedMesh(geometria, material, total);
  for (let k = 0; k < total; k++) {
    matriz.compose(lugar.set(puestos[k].x, referencia.pisoDomo1, puestos[k].z), giro, unidad);
    instancias.setMatrixAt(k, matriz);
    const silla = new THREE.Mesh(geometria, material);
    silla.matrixAutoUpdate = false;
    silla.matrix.copy(matriz);
    silla.matrixWorldNeedsUpdate = true;
    silla.visible = false;
    sueltas.add(silla);
  }
  instancias.instanceMatrix.needsUpdate = true;
  instancias.computeBoundingSphere();
  instancias.visible = false;
  escena.add(sueltas, instancias);
  sillas = { sueltas, instancias, total };
  return sillas;
}

function aplicarSillas() {
  if (!cfg.s && !sillas) return;
  const { sueltas, instancias, total } = prepararSillas();
  const n = Math.min(cfg.s, total);
  sueltas.children.forEach((silla, k) => { silla.visible = !cfg.i && k < n; });
  instancias.count = n;
  instancias.visible = cfg.i === 1 && n > 0;
}

// Warm lamps without shadows: eight around the fountain, eight inside dome 1.
let luces = null;
function prepararLuces() {
  if (luces) return luces;
  luces = [];
  const bombilla = new THREE.SphereGeometry(0.12, 12, 8);
  const vidrioBombilla = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
  const lugares = [];
  for (const k of [0, 4, 2, 6, 1, 5, 3, 7]) {
    const a = (k / 8) * Math.PI * 2;
    lugares.push(new THREE.Vector3(referencia.fuente.x + Math.cos(a) * 9, 3.5, referencia.fuente.z + Math.sin(a) * 9));
  }
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    lugares.push(new THREE.Vector3(referencia.domo1.x + Math.cos(a) * 12, referencia.pisoDomo1 + 3.5, referencia.domo1.z + Math.sin(a) * 12));
  }
  for (const lugar of lugares) {
    const luz = new THREE.PointLight(0xffc98a, 40, 25, 2);
    luz.position.copy(lugar);
    luz.add(new THREE.Mesh(bombilla, vidrioBombilla));
    luz.visible = false;
    escena.add(luz);
    luces.push(luz);
  }
  return luces;
}

function aplicarLuces() {
  if (!cfg.l && !luces) return;
  prepararLuces().forEach((luz, k) => { luz.visible = k < cfg.l; });
}

// Unique 2K images uploaded to the graphics card, to find how much image memory the device holds.
// They hang on a wall behind the test point, so they do not change what the test view draws.
const imagenes = [];
let lienzoImagen = null;
let geometriaPanel = null;

function aplicarImagenes() {
  while (imagenes.length > cfg.t) {
    const panelImagen = imagenes.pop();
    panelImagen.material.map.dispose();
    panelImagen.material.dispose();
    escena.remove(panelImagen);
  }
}

function imagenesPendientes() {
  return Math.max(0, cfg.t - imagenes.length);
}

function crearImagen() {
  if (!lienzoImagen) {
    lienzoImagen = document.createElement('canvas');
    lienzoImagen.width = 2048;
    lienzoImagen.height = 2048;
    geometriaPanel = new THREE.PlaneGeometry(1.6, 0.9);
  }
  const n = imagenes.length;
  pintarImagen(n);
  // Each texture gets its own copy on the graphics card at upload, so the canvas is reused for the next one.
  const textura = new THREE.CanvasTexture(lienzoImagen);
  textura.colorSpace = THREE.SRGBColorSpace;
  renderer.initTexture(textura);
  const panelImagen = new THREE.Mesh(geometriaPanel, new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  const adelante = new THREE.Vector3(-Math.sin(inicio.giro), 0, -Math.cos(inicio.giro));
  const costado = new THREE.Vector3(-adelante.z, 0, adelante.x);
  panelImagen.position.copy(inicio.posicion).addScaledVector(adelante, -6).addScaledVector(costado, ((n % 10) - 4.5) * 1.75);
  panelImagen.position.y = 0.9 + Math.floor(n / 10) * 1.02;
  panelImagen.rotation.y = Math.atan2(adelante.x, adelante.z);
  escena.add(panelImagen);
  imagenes.push(panelImagen);
}

function pintarImagen(n) {
  const p = lienzoImagen.getContext('2d');
  const tono = (n * 47) % 360;
  const degradado = p.createLinearGradient(0, 0, 2048, 2048);
  degradado.addColorStop(0, `hsl(${tono}, 55%, 30%)`);
  degradado.addColorStop(1, `hsl(${(tono + 70) % 360}, 65%, 55%)`);
  p.fillStyle = degradado;
  p.fillRect(0, 0, 2048, 2048);
  p.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  p.lineWidth = 4;
  p.beginPath();
  for (let k = 0; k <= 2048; k += 128) {
    p.moveTo(k, 0);
    p.lineTo(k, 2048);
    p.moveTo(0, k);
    p.lineTo(2048, k);
  }
  p.stroke();
  p.fillStyle = '#ffffff';
  p.font = 'bold 420px system-ui, sans-serif';
  p.textAlign = 'center';
  p.textBaseline = 'middle';
  p.fillText(String(n + 1), 1024, 1024);
}

// ---------- Input ----------

const teclas = new Set();
const PERILLAS = { Digit1: 'e', Digit2: 'v', Digit3: 'o', Digit4: 'x', Digit5: 's', Digit6: 'i', Digit7: 'l', Digit8: 'm', Digit9: 't', Digit0: 'r' };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  teclas.add(e.code);
  if (e.repeat || !colision) return;
  if (e.code === 'KeyH') alternarHud();
  if (e.code === 'KeyT') alternarPanel();
  if (e.code === 'KeyP') alternarPrueba();
  if (prueba.activa) return;
  if (e.code === 'Space') { e.preventDefault(); usarAscensor(); }
  if (e.code === 'KeyR') irAlPuntoDePrueba();
  if (e.code === 'Comma') pasoManual(-1);
  if (e.code === 'Period') pasoManual(1);
  if (PERILLAS[e.code]) ciclar(PERILLAS[e.code]);
});
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

let arrastrando = false;
let ultimoX = 0;
let ultimoY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  arrastrando = true;
  ultimoX = e.clientX;
  ultimoY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!arrastrando || prueba.activa) return;
  visitante.rotation.y -= (e.clientX - ultimoX) * 0.004;
  cabeceo = THREE.MathUtils.clamp(cabeceo - (e.clientY - ultimoY) * 0.004, -1.4, 1.4);
  ultimoX = e.clientX;
  ultimoY = e.clientY;
});
window.addEventListener('pointerup', () => { arrastrando = false; });

function leerTeclado(dt, deseado) {
  if (prueba.activa) return;
  let x = 0;
  let z = 0;
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) z -= 1;
  if (teclas.has('KeyS') || teclas.has('ArrowDown')) z += 1;
  if (teclas.has('KeyD') || teclas.has('ArrowRight')) x += 1;
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) x -= 1;
  const giro = (teclas.has('KeyQ') ? 1 : 0) - (teclas.has('KeyE') ? 1 : 0);
  visitante.rotation.y += giro * 1.6 * dt;
  if (!x && !z) return;
  const rapido = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
  deseado.set(x, 0, z).normalize().multiplyScalar(VELOCIDAD * (rapido ? 2 : 1)).applyAxisAngle(EJE_Y, visitante.rotation.y);
}

// Quest controller buttons: 0 trigger, 1 grip, 3 stick press, 4 A or X, 5 B or Y.
const botonesAntes = new WeakMap();
let giroArmado = true;
function leerMandos(deseado) {
  const sesion = renderer.xr.getSession();
  if (!sesion) return;
  const cabeza = posicionCabeza(new THREE.Vector3());
  const adelante = new THREE.Vector3();
  camara.getWorldDirection(adelante);
  adelante.y = 0;
  adelante.normalize();
  const derecha = new THREE.Vector3(-adelante.z, 0, adelante.x);
  const libre = !prueba.activa;

  for (const fuente of sesion.inputSources) {
    const mando = fuente.gamepad;
    if (!mando) continue;
    const ejeX = mando.axes.length > 3 ? mando.axes[2] : (mando.axes[0] || 0);
    const ejeY = mando.axes.length > 3 ? mando.axes[3] : (mando.axes[1] || 0);
    const antes = botonesAntes.get(fuente) || [];
    const recienPulsado = (i) => Boolean(mando.buttons[i] && mando.buttons[i].pressed && !antes[i]);

    if (fuente.handedness === 'left') {
      if (libre && Math.hypot(ejeX, ejeY) > 0.15) {
        const rapido = Boolean(mando.buttons[3] && mando.buttons[3].pressed);
        deseado.addScaledVector(adelante, -ejeY).addScaledVector(derecha, ejeX);
        if (deseado.lengthSq() > 1) deseado.normalize();
        deseado.multiplyScalar(VELOCIDAD * (rapido ? 2 : 1));
      }
      if (recienPulsado(1)) alternarTablero();
      if (libre && recienPulsado(4)) ciclar('e');
      if (libre && recienPulsado(5)) ciclar('v');
      if (libre && recienPulsado(0)) pasoManual(-1);
    } else if (fuente.handedness === 'right') {
      if (libre && giroArmado && Math.abs(ejeX) > 0.6) {
        girarAlrededor(cabeza, ejeX > 0 ? -Math.PI / 6 : Math.PI / 6);
        giroArmado = false;
      } else if (Math.abs(ejeX) < 0.3) {
        giroArmado = true;
      }
      if (recienPulsado(1)) alternarPrueba();
      if (libre && recienPulsado(3)) irAlPuntoDePrueba();
      if (libre && recienPulsado(4)) usarAscensor();
      if (libre && recienPulsado(5)) ciclar('o');
      if (libre && recienPulsado(0)) pasoManual(1);
    }
    botonesAntes.set(fuente, mando.buttons.map((b) => b.pressed));
  }
}

function girarAlrededor(punto, angulo) {
  visitante.position.sub(punto).applyAxisAngle(EJE_Y, angulo).add(punto);
  visitante.rotation.y += angulo;
}

function posicionCabeza(destino) {
  camara.updateMatrixWorld(true);
  return destino.setFromMatrixPosition(camara.matrixWorld);
}

// Capsule against the collision BVH, following the three-mesh-bvh character example.
const segmento = new THREE.Line3();
const caja = new THREE.Box3();
const cabezaTmp = new THREE.Vector3();
const inicioSegmento = new THREE.Vector3();
const puntoTriangulo = new THREE.Vector3();
const puntoCapsula = new THREE.Vector3();
const correccion = new THREE.Vector3();
function moverVisitante(dt, deseado) {
  const enVR = renderer.xr.isPresenting;
  const cabeza = posicionCabeza(cabezaTmp);
  const desvioX = enVR ? cabeza.x - visitante.position.x : 0;
  const desvioZ = enVR ? cabeza.z - visitante.position.z : 0;
  const alto = enVR ? THREE.MathUtils.clamp(cabeza.y - visitante.position.y, 1.0, 2.0) : 1.7;

  if (!enSuelo) velocidadVertical -= 9.81 * dt;
  visitante.position.addScaledVector(deseado, dt);
  visitante.position.y += velocidadVertical * dt;

  segmento.start.set(visitante.position.x + desvioX, visitante.position.y + RADIO, visitante.position.z + desvioZ);
  segmento.end.set(segmento.start.x, visitante.position.y + alto - RADIO, segmento.start.z);
  inicioSegmento.copy(segmento.start);
  caja.makeEmpty();
  caja.expandByPoint(segmento.start);
  caja.expandByPoint(segmento.end);
  caja.min.addScalar(-RADIO);
  caja.max.addScalar(RADIO);

  colision.boundsTree.shapecast({
    intersectsBounds: (b) => b.intersectsBox(caja),
    intersectsTriangle: (tri) => {
      const distancia = tri.closestPointToSegment(segmento, puntoTriangulo, puntoCapsula);
      if (distancia < RADIO) {
        const direccion = puntoCapsula.sub(puntoTriangulo).normalize();
        segmento.start.addScaledVector(direccion, RADIO - distancia);
        segmento.end.addScaledVector(direccion, RADIO - distancia);
      }
    },
  });

  correccion.subVectors(segmento.start, inicioSegmento);
  enSuelo = correccion.y > Math.abs(dt * velocidadVertical * 0.25);
  const largo = Math.max(0, correccion.length() - 1e-5);
  correccion.normalize().multiplyScalar(largo);
  visitante.position.add(correccion);
  if (enSuelo) velocidadVertical = 0;
  if (visitante.position.y < -10) volverAlInicio();
}

function alternarHud() {
  hudVisible = !hudVisible;
  hud.hidden = !hudVisible;
}

// Near a lift shaft: jump to the other stop, landing on the floor outside the shaft.
function usarAscensor() {
  const cabeza = posicionCabeza(new THREE.Vector3());
  for (const eje of ejesAscensor) {
    let dx = cabeza.x - eje.x;
    let dz = cabeza.z - eje.z;
    if (Math.hypot(dx, dz) > 2.6) continue;
    if (Math.hypot(dx, dz) < 0.3) {
      const mirada = new THREE.Vector3();
      camara.getWorldDirection(mirada);
      dx = mirada.x;
      dz = mirada.z;
    }
    const largo = Math.hypot(dx, dz) || 1;
    const arriba = visitante.position.y > eje.y + PISO_ALTO / 2;
    visitante.position.x += eje.x + (dx / largo) * 2.4 - cabeza.x;
    visitante.position.z += eje.z + (dz / largo) * 2.4 - cabeza.z;
    visitante.position.y = (arriba ? eje.y : eje.y + PISO_ALTO) + 0.05;
    velocidadVertical = 0;
    return;
  }
}

// ---------- Automatic test ----------

const prueba = { activa: false, pasos: [], indice: -1, fase: '', t: 0, estables: 0, dts: [], saltar: null, corrida: null };

function alternarPrueba() {
  if (prueba.activa) terminarPrueba(false);
  else iniciarPrueba();
}

function iniciarPrueba() {
  if (!colision) return;
  const enVR = renderer.xr.isPresenting;
  prueba.pasos = pasosDelDispositivo();
  prueba.indice = -1;
  prueba.saltar = null;
  prueba.corrida = nuevaCorrida(enVR);
  prueba.activa = true;
  prueba.fase = 'preparando';
  prueba.t = 0;
  pasoActual = null;
  fijar({ ...BASE, ...porDefecto });
  tablero.visible = false;
  panel.hidden = true;
  irAlPuntoDePrueba();
}

function siguientePasoPrueba() {
  do prueba.indice++;
  while (prueba.indice < prueba.pasos.length && prueba.pasos[prueba.indice].serie === prueba.saltar);
  if (prueba.indice >= prueba.pasos.length) {
    terminarPrueba(true);
    return;
  }
  pasoActual = prueba.pasos[prueba.indice];
  fijar(configDelPaso(pasoActual));
  prueba.fase = 'asentando';
  prueba.t = 0;
  prueba.estables = 0;
}

// Each step waits for shaders and uploads to settle, then measures three seconds of real frames.
function avanzarPrueba(dt) {
  if (!prueba.activa) return;
  prueba.t += dt;
  prueba.estables = dt < 0.1 ? prueba.estables + 1 : 0;
  if (prueba.fase === 'preparando') {
    if (prueba.t >= CUENTA) siguientePasoPrueba();
    return;
  }
  if (prueba.fase === 'asentando') {
    if (imagenesPendientes() > 0) {
      prueba.t = 0;
      return;
    }
    if ((prueba.t >= ASENTAR && prueba.estables >= 30) || prueba.t >= 8) {
      prueba.fase = 'midiendo';
      prueba.t = 0;
      prueba.dts = [];
    }
    return;
  }
  prueba.dts.push(dt);
  if (prueba.t < MEDIR) return;
  const fila = resumirMedicion(prueba.dts);
  // On a screen the frame rate stops at the monitor's refresh; this burst measures past that ceiling.
  if (!renderer.xr.isPresenting) fila.sinTope = medir(20).ms;
  prueba.corrida.filas.push(fila);
  guardarCorrida(prueba.corrida);
  if (fila.fps < 12) prueba.saltar = pasoActual.serie;
  siguientePasoPrueba();
}

function terminarPrueba(completa) {
  prueba.activa = false;
  pasoActual = null;
  fijar({ ...BASE, ...porDefecto });
  const corrida = prueba.corrida;
  if (!corrida || !corrida.filas.length) return;
  corrida.completa = completa;
  guardarCorrida(corrida);
  ultimaCorrida = corrida;
  botonResultados.disabled = false;
  if (renderer.xr.isPresenting) mostrarTablero(corrida);
  else mostrarPanel(corrida);
}

function resumirMedicion(dts) {
  const total = dts.reduce((a, b) => a + b, 0);
  const ordenados = [...dts].sort((a, b) => a - b);
  const p95 = ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))];
  const info = renderer.info.render;
  return {
    paso: pasoActual ? pasoActual.id : 'libre',
    cfg: codigo(cfg),
    fps: redondear(dts.length / total, 1),
    ms: redondear((1000 * total) / dts.length, 1),
    p95: redondear(1000 * p95, 1),
    peor: Math.round(1000 * ordenados[ordenados.length - 1]),
    tri: info.triangles,
    llamadas: info.calls,
    ojos: renderer.xr.isPresenting ? 2 : 1,
    sinTope: null,
  };
}

function nuevaCorrida(enVR) {
  const ahora = new Date();
  const sesion = renderer.xr.getSession();
  return {
    id: `${enVR ? 'casco' : 'pc'}-${sello(ahora)}`,
    dispositivo: nombreDispositivo(),
    gpu: nombreGPU(),
    modo: enVR ? 'casco' : 'pantalla',
    fecha: ahora.toISOString(),
    hz: enVR && sesion && sesion.frameRate ? Math.round(sesion.frameRate) : null,
    res: resolucionActual(enVR),
    protocolo: 1,
    completa: false,
    filas: [],
  };
}

function resolucionActual(enVR) {
  if (!enVR) return `${renderer.domElement.width}x${renderer.domElement.height}`;
  const capa = renderer.xr.getBaseLayer();
  const ancho = capa && (capa.framebufferWidth || capa.textureWidth);
  const alto = capa && (capa.framebufferHeight || capa.textureHeight);
  return ancho && alto ? `${ancho}x${alto}` : '';
}

function nombreDispositivo() {
  const ua = navigator.userAgent;
  const quest = ua.match(/Quest\s?(Pro|\d\w?)?/i);
  if (/OculusBrowser/i.test(ua) || quest) return quest ? quest[0].replace(/\s+/g, ' ') : 'Meta Quest';
  const sistema = /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'PC';
  const navegador = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return navegador ? `${sistema} · ${navegador}` : sistema;
}

function nombreGPU() {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).slice(0, 90);
  } catch {
    return '';
  }
}

function sello(d) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
}

// Runs survive a reload (the image steps can crash a headset tab), kept per device in this browser.
const CLAVE = 'campus-ecotec.corridas';
function leerCorridas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || [];
  } catch {
    return [];
  }
}
function guardarCorrida(corrida) {
  try {
    const lista = leerCorridas().filter((c) => c.id !== corrida.id);
    lista.unshift(corrida);
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, 8)));
  } catch {
    // Storage blocked: the run stays in memory for this visit.
  }
}
let ultimaCorrida = leerCorridas()[0] || null;

// The run travels to the log page in the link's anchor, which only admits letters, digits and . _ ~ -
function token(corrida) {
  const datos = {
    v: 1, id: corrida.id, d: corrida.dispositivo, g: corrida.gpu, f: corrida.fecha, hz: corrida.hz,
    res: corrida.res, c: corrida.completa ? 1 : 0,
    r: corrida.filas.map((f) => [f.paso, f.cfg, f.fps, f.ms, f.p95, f.peor, f.tri, f.llamadas, f.ojos, f.sinTope ?? -1]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(datos));
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return 'v1.' + btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textoCorrida(c) {
  const lineas = [
    `Campus Ecotec · prueba automática · ${c.dispositivo}${c.hz ? ` · ${c.hz} Hz` : ''} · ${c.res} · ${fechaCorta(c.fecha)}${c.completa ? '' : ' · incompleta'}`,
  ];
  if (c.gpu) lineas.push(`Placa: ${c.gpu}`);
  lineas.push(['Paso', 'Qué', 'cuadros/s', 'ms', 'ms sin tope', 'peor ms', 'triángulos', 'llamadas'].join('\t'));
  for (const f of c.filas) {
    const paso = PROTOCOLO.find((p) => p.id === f.paso);
    lineas.push([f.paso, paso ? paso.texto : f.cfg, f.fps, f.ms, f.sinTope ?? '', f.peor, f.tri, f.llamadas].join('\t'));
  }
  lineas.push('', 'Código para el registro:', token(c));
  return lineas.join('\n');
}

function fechaCorta(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function nivelFps(fps, hz) {
  if (hz) return fps >= hz * 0.95 ? 'bien' : fps >= 72 ? 'justo' : 'mal';
  return fps >= 58 ? 'bien' : fps >= 45 ? 'justo' : 'mal';
}

// ---------- Results on screen ----------

function mostrarPanel(corrida) {
  if (!corrida) return;
  panelMeta.textContent = [
    corrida.dispositivo, corrida.gpu, corrida.hz ? `${corrida.hz} Hz` : '', corrida.res, fechaCorta(corrida.fecha),
    corrida.completa ? '' : 'incompleta',
  ].filter(Boolean).join(' · ');
  panelFilas.replaceChildren(...corrida.filas.map((f) => {
    const tr = document.createElement('tr');
    const paso = PROTOCOLO.find((p) => p.id === f.paso);
    const celdas = [f.paso, paso ? paso.texto : f.cfg, f.fps.toFixed(1), f.ms.toFixed(1),
      f.sinTope == null || f.sinTope < 0 ? '—' : f.sinTope.toFixed(1), f.peor, miles(f.tri), f.llamadas];
    for (const valor of celdas) {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.append(td);
    }
    tr.children[2].dataset.nivel = nivelFps(f.fps, corrida.hz);
    return tr;
  }));
  enlaceRegistro.href = `${REGISTRO}#${token(corrida)}`;
  avisoCopia.textContent = '';
  panel.hidden = false;
}

function alternarPanel() {
  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }
  mostrarPanel(ultimaCorrida);
}

// Buttons give the keyboard back to the walk controls once clicked.
for (const boton of document.querySelectorAll('button')) boton.addEventListener('click', () => boton.blur());
botonResultados.addEventListener('click', alternarPanel);
selectorEscala.addEventListener('change', () => selectorEscala.blur());
document.getElementById('res-cerrar').addEventListener('click', () => { panel.hidden = true; });
botonCopiar.addEventListener('click', () => {
  if (!ultimaCorrida) return;
  const texto = textoCorrida(ultimaCorrida);
  const listo = () => { avisoCopia.textContent = 'Copiado. Pegalo en el registro o en el chat.'; };
  const aMano = () => {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    avisoCopia.textContent = ok ? 'Copiado. Pegalo en el registro o en el chat.' : 'No se pudo copiar en este navegador.';
  };
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(listo, aMano);
  else aMano();
});

// ---------- Headset readouts ----------

function mostrarTablero(corrida) {
  dibujarTablero(corrida);
  const cabeza = posicionCabeza(new THREE.Vector3());
  const adelante = new THREE.Vector3();
  camara.getWorldDirection(adelante);
  adelante.y = 0;
  adelante.normalize();
  tablero.position.copy(cabeza).addScaledVector(adelante, 1.7);
  tablero.position.y = cabeza.y - 0.1;
  tablero.lookAt(cabeza.x, tablero.position.y, cabeza.z);
  tablero.visible = true;
}

function alternarTablero() {
  if (tablero.visible) tablero.visible = false;
  else if (ultimaCorrida) mostrarTablero(ultimaCorrida);
}

const COLORES = { bien: '#6EE7A8', justo: '#F2C94C', mal: '#FF8A7A' };
function dibujarTablero(corrida) {
  const p = pincelTablero;
  p.clearRect(0, 0, 1024, 1024);
  p.fillStyle = 'rgba(11, 33, 36, 0.95)';
  p.beginPath();
  p.roundRect(0, 0, 1024, 1024, 28);
  p.fill();
  p.textAlign = 'left';
  p.fillStyle = '#E8F4F2';
  p.font = '700 40px system-ui, sans-serif';
  p.fillText('Resultados de la prueba', 40, 66);
  p.fillStyle = '#9FC3BE';
  p.font = '500 24px system-ui, sans-serif';
  p.fillText([corrida.dispositivo, corrida.hz ? `${corrida.hz} Hz` : '', fechaCorta(corrida.fecha), corrida.completa ? '' : 'incompleta']
    .filter(Boolean).join(' · '), 40, 104);
  const filas = corrida.filas;
  const porColumna = Math.max(1, Math.ceil(filas.length / 2));
  filas.forEach((f, k) => {
    const x = 40 + (k < porColumna ? 0 : 492);
    const y = 162 + (k % porColumna) * 48;
    const paso = PROTOCOLO.find((q) => q.id === f.paso);
    p.textAlign = 'left';
    p.fillStyle = '#9FC3BE';
    p.font = '600 22px ui-monospace, monospace';
    p.fillText(f.paso, x, y);
    p.fillStyle = '#E8F4F2';
    p.font = '500 22px system-ui, sans-serif';
    p.fillText(paso ? paso.texto : f.cfg, x + 62, y);
    p.textAlign = 'right';
    p.fillStyle = COLORES[nivelFps(f.fps, corrida.hz)];
    p.font = '700 26px ui-monospace, monospace';
    p.fillText(String(Math.round(f.fps)), x + 440, y);
  });
  p.textAlign = 'left';
  p.fillStyle = '#9FC3BE';
  p.font = '500 22px system-ui, sans-serif';
  p.fillText('Cuadros por segundo de cada paso · grip izquierdo: ocultar', 40, 996);
  texturaTablero.needsUpdate = true;
}

function describir(c, enVR) {
  const partes = [c.e === 4 ? 'Sin estructura del domo' : `Estructura ${NIVELES[c.e]}`];
  if (c.x) partes.push(`+${c.x} extra`);
  if (c.s) partes.push(`${c.s} sillas ${c.i ? 'instanciadas' : 'sueltas'}`);
  if (c.l) partes.push(`${c.l} luces`);
  partes.push(c.o ? 'con sombras' : 'sin sombras');
  partes.push(c.v ? 'con vidrio' : 'sin vidrio');
  if (c.m) partes.push('materiales Blender');
  if (c.t) partes.push(`${c.t} imágenes 2K (${Math.round(c.t * 21.3)} MB)`);
  if (!enVR && c.r !== resolucionPantalla) partes.push(`resolución ×${c.r / 100}`);
  if (enVR && c.f !== 10) partes.push(`foveación ${c.f / 10}`);
  return partes;
}

function envolver(partes, largo) {
  const lineas = [''];
  for (const parte of partes) {
    const actual = lineas[lineas.length - 1];
    if (actual && actual.length + parte.length + 3 > largo) lineas.push(parte);
    else lineas[lineas.length - 1] = actual ? `${actual} · ${parte}` : parte;
  }
  return lineas;
}

function estadoPrueba() {
  if (!prueba.activa) return null;
  const total = prueba.pasos.length;
  if (prueba.fase === 'preparando') return `Prueba automática: empieza en ${Math.max(1, Math.ceil(CUENTA - prueba.t))} s. Mirá el domo, sin moverte.`;
  const n = prueba.indice + 1;
  if (prueba.fase === 'asentando') return `Prueba automática ${n}/${total} · preparando${imagenesPendientes() ? ` imágenes (faltan ${imagenesPendientes()})` : ''}`;
  return `Prueba automática ${n}/${total} · midiendo ${Math.min(MEDIR, prueba.t).toFixed(1)} de ${MEDIR} s`;
}

// ---------- Frame loop ----------

const reloj = new THREE.Clock();
let acumulado = 0;
let cuadros = 0;
let peor = 0;
function cuadro() {
  const bruto = reloj.getDelta();
  const dt = Math.min(bruto, 0.1);
  const enVR = renderer.xr.isPresenting;
  const deseado = new THREE.Vector3();
  if (enVR) leerMandos(deseado);
  else leerTeclado(dt, deseado);

  const pasos = Math.max(1, Math.ceil(dt / 0.016));
  for (let i = 0; i < pasos; i++) moverVisitante(dt / pasos, deseado);

  if (!enVR) {
    camara.position.set(0, ALTURA_OJOS, 0);
    camara.rotation.set(cabeceo, 0, 0);
  }
  if (imagenesPendientes() > 0) crearImagen();
  placaHud.visible = enVR && hudVisible;
  renderer.render(escena, camara);
  avanzarPrueba(bruto);
  medirCuadro(bruto, enVR);
}

function medirCuadro(dt, enVR) {
  acumulado += dt;
  peor = Math.max(peor, dt);
  cuadros++;
  if (acumulado < 0.5) return;
  const info = renderer.info.render;
  const sesion = renderer.xr.getSession();
  const tope = enVR && sesion && sesion.frameRate ? ` · tope ${Math.round(sesion.frameRate)}` : '';
  const lineas = [
    `${Math.round(cuadros / acumulado)} cuadros/s · ${(1000 * acumulado / cuadros).toFixed(1)} ms (peor ${Math.round(1000 * peor)} ms)${tope}`,
    `Dibujando ${miles(info.triangles)} triángulos · ${info.calls} llamadas${enVR ? ' (dos ojos)' : ''}`,
    pasoActual ? `Paso ${pasoActual.id} · ${pasoActual.texto}` : 'Configuración libre',
    ...envolver(describir(cfg, enVR), enVR ? 62 : 90),
  ];
  const aviso = estadoPrueba();
  hud.textContent = [...lineas, aviso || (enVR ? '' : 'P: prueba automática · T: resultados'), RESUMEN].filter(Boolean).join('\n');
  if (enVR && hudVisible) dibujarHud([...lineas, aviso || 'Grip derecho: prueba automática · gatillos: pasos'].slice(0, 6));
  acumulado = 0;
  peor = 0;
  cuadros = 0;
}

function dibujarHud(lineas) {
  pincelHud.clearRect(0, 0, lienzoHud.width, lienzoHud.height);
  pincelHud.fillStyle = 'rgba(11, 33, 36, 0.86)';
  pincelHud.beginPath();
  pincelHud.roundRect(0, 0, lienzoHud.width, lienzoHud.height, 18);
  pincelHud.fill();
  pincelHud.textAlign = 'left';
  lineas.forEach((linea, i) => {
    pincelHud.fillStyle = i === 0 ? '#E8F4F2' : i === lineas.length - 1 && prueba.activa ? '#4FD1CB' : '#CFE5E1';
    pincelHud.font = i === 0 ? '700 27px system-ui, sans-serif' : '500 24px system-ui, sans-serif';
    pincelHud.fillText(linea, 20, 40 + i * 45);
  });
  texturaHud.needsUpdate = true;
}

function miles(valor) {
  return Math.round(valor).toLocaleString('es-AR');
}

function redondear(valor, decimales) {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

// ---------- Headset session ----------

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    botonVR.disabled = !ok;
    if (!ok) botonVR.title = 'Este navegador no tiene modo VR. Abrí el link desde el navegador del Quest.';
  }).catch(() => {});
}
botonVR.addEventListener('click', async () => {
  if (renderer.xr.isPresenting) {
    renderer.xr.getSession().end();
    return;
  }
  try {
    renderer.xr.setFramebufferScaleFactor(Number(selectorEscala.value) || 1);
    const sesion = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(sesion);
  } catch (error) {
    console.error(error);
    botonVR.title = 'No se pudo entrar en VR: ' + error.message;
  }
});
renderer.xr.addEventListener('sessionstart', () => {
  if (prueba.activa) terminarPrueba(false);
  cabeceo = 0;
  porDefecto.r = Math.round((Number(selectorEscala.value) || 1) * 100);
  cfg = { ...cfg, r: porDefecto.r };
  panel.hidden = true;
  botonVR.textContent = 'Salir de VR';
});
renderer.xr.addEventListener('sessionend', () => {
  if (prueba.activa) terminarPrueba(false);
  tablero.visible = false;
  porDefecto.r = resolucionPantalla;
  fijar({ ...cfg, r: resolucionPantalla });
  botonVR.textContent = 'Entrar en VR';
  if (ultimaCorrida && ultimaCorrida.modo === 'casco') mostrarPanel(ultimaCorrida);
});

window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hooks for measuring without an animation loop (a hidden tab does not run requestAnimationFrame).
function medir(cantidad = 60) {
  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  renderer.render(escena, camara);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const t0 = performance.now();
  for (let i = 0; i < cantidad; i++) {
    renderer.render(escena, camara);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  }
  return {
    ms: Number(((performance.now() - t0) / cantidad).toFixed(2)),
    triangulos: renderer.info.render.triangles,
    llamadas: renderer.info.render.calls,
    lienzo: [renderer.domElement.width, renderer.domElement.height],
  };
}

function barridoSincronico(cantidad = 10) {
  const salida = [];
  irAlPuntoDePrueba();
  camara.position.set(0, ALTURA_OJOS, 0);
  camara.rotation.set(0, 0, 0);
  for (const paso of PROTOCOLO.filter((p) => p.solo !== 'vr')) {
    pasoActual = paso;
    fijar(configDelPaso(paso));
    while (imagenesPendientes() > 0) crearImagen();
    medir(3);
    salida.push({ paso: paso.id, cfg: codigo(cfg), ...medir(cantidad) });
  }
  pasoActual = null;
  fijar({ ...BASE, ...porDefecto });
  return salida;
}

window.campus = {
  renderer, escena, camara, visitante, grupos, medir, barridoSincronico, PROTOCOLO,
  fijar: (cambios) => fijar({ ...cfg, ...cambios }),
  config: () => ({ ...cfg, codigo: codigo(cfg) }),
  iniciarPrueba, prueba, textoCorrida, token,
  listo: () => colision !== null,
};
