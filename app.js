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

// Layers of the dome frame, switched off in this order to measure what each one costs.
const CAPAS = [/_Domo_Nudos_N01$/, /_Domo_Tapetas_M02$/, /_Domo_Juntas_G01$/, /_Domo_Perfiles_M01$/];
const NIVELES = ['completa', 'sin nudos', 'sin nudos ni tapetas', 'sin nudos, tapetas ni juntas', 'sin estructura'];
const VIDRIO = /_Domo_Cristal_G01$|_Cristal$|_Baranda_Vidrio$|_Ascensor_Vidrio$/;
// What the visitor bumps into: floors, railings, glass and frames. The thin dome frame is left out.
const COLISION = /_Losa_PB$|_Semipiso$|Pavimento|_Acceso_|_Piso$|_Baranda_|_Domo_Cristal_G01$|_Portada_|_Marco_Corte_|_Anillo_Basal$|_Estructura$|_Cristal$|^FUENTE_(Borde|Vaso|Isla)|_Jardinera_\d$|_Ascensor_(Vidrio|Collares)$|_Baliza_/;

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

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
lienzoHud.width = 640;
lienzoHud.height = 200;
const pincelHud = lienzoHud.getContext('2d');
const texturaHud = new THREE.CanvasTexture(lienzoHud);
texturaHud.colorSpace = THREE.SRGBColorSpace;
const placaHud = new THREE.Mesh(
  new THREE.PlaneGeometry(0.4, 0.125),
  new THREE.MeshBasicMaterial({ map: texturaHud, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
);
placaHud.position.set(-0.16, -0.17, -0.65);
placaHud.renderOrder = 999;
placaHud.visible = false;
camara.add(placaHud);

const grupos = { capas: CAPAS.map(() => []), vidrio: [] };
const inicio = { posicion: new THREE.Vector3(), giro: 0 };
let colision = null;
let ejesAscensor = [];
let nivelEstructura = 0;
let vidrioVisible = true;
let hudVisible = true;
let velocidadVertical = 0;
let enSuelo = false;
let cabeceo = 0;

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
    const nombres = [o.name, o.parent ? o.parent.name : ''];
    const coincide = (patron) => nombres.some((n) => patron.test(n));
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => liviano(m, convertidos))
      : liviano(o.material, convertidos);
    const transparente = [].concat(o.material).some((m) => m.transparent);
    o.castShadow = !transparente;
    o.receiveShadow = true;
    o.matrixAutoUpdate = false;
    CAPAS.forEach((patron, i) => { if (coincide(patron)) grupos.capas[i].push(o); });
    if (coincide(VIDRIO)) grupos.vidrio.push(o);
  });

  colision = construirColisiones(modelo);
  ejesAscensor = ['D1', 'D2', 'D3']
    .map((domo) => modelo.getObjectByName(`${domo}_Ascensor_Cabina`))
    .filter(Boolean)
    .map((o) => o.getWorldPosition(new THREE.Vector3()).setY(0));
  ubicarInicio(modelo);

  carga.hidden = true;
  controles.hidden = false;
  hud.hidden = !hudVisible;
  renderer.setAnimationLoop(cuadro);
}

// Glass and water become plain transparency and the anisotropic aluminium a standard metal:
// transmission and anisotropy are the most expensive shaders three.js has, and this is a performance test.
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
  } else if (m.isMeshPhysicalMaterial) {
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

// Start in the patio, 14 m from the fountain, looking at dome 1 across it.
function ubicarInicio(modelo) {
  const fuente = modelo.getObjectByName('FUENTE_Borde_FO01');
  const centro = fuente ? new THREE.Box3().setFromObject(fuente).getCenter(new THREE.Vector3()) : new THREE.Vector3();
  const domo = ejesAscensor[0] || new THREE.Vector3(0, 0, -50);
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

const teclas = new Set();
window.addEventListener('keydown', (e) => {
  teclas.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Digit1') cambiarEstructura();
  if (e.code === 'Digit2') alternarVidrio();
  if (e.code === 'Digit3') alternarSombras();
  if (e.code === 'KeyH') alternarHud();
  if (e.code === 'Space') { e.preventDefault(); usarAscensor(); }
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
  if (!arrastrando) return;
  visitante.rotation.y -= (e.clientX - ultimoX) * 0.004;
  cabeceo = THREE.MathUtils.clamp(cabeceo - (e.clientY - ultimoY) * 0.004, -1.4, 1.4);
  ultimoX = e.clientX;
  ultimoY = e.clientY;
});
window.addEventListener('pointerup', () => { arrastrando = false; });

function leerTeclado(dt, deseado) {
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

  for (const fuente of sesion.inputSources) {
    const mando = fuente.gamepad;
    if (!mando) continue;
    const ejeX = mando.axes.length > 3 ? mando.axes[2] : (mando.axes[0] || 0);
    const ejeY = mando.axes.length > 3 ? mando.axes[3] : (mando.axes[1] || 0);
    const antes = botonesAntes.get(fuente) || [];
    const recienPulsado = (i) => Boolean(mando.buttons[i] && mando.buttons[i].pressed && !antes[i]);

    if (fuente.handedness === 'left') {
      if (Math.hypot(ejeX, ejeY) > 0.15) {
        const rapido = Boolean(mando.buttons[3] && mando.buttons[3].pressed);
        deseado.addScaledVector(adelante, -ejeY).addScaledVector(derecha, ejeX);
        if (deseado.lengthSq() > 1) deseado.normalize();
        deseado.multiplyScalar(VELOCIDAD * (rapido ? 2 : 1));
      }
      if (recienPulsado(4)) cambiarEstructura();
      if (recienPulsado(5)) alternarVidrio();
    } else if (fuente.handedness === 'right') {
      if (giroArmado && Math.abs(ejeX) > 0.6) {
        girarAlrededor(cabeza, ejeX > 0 ? -Math.PI / 6 : Math.PI / 6);
        giroArmado = false;
      } else if (Math.abs(ejeX) < 0.3) {
        giroArmado = true;
      }
      if (recienPulsado(4)) usarAscensor();
      if (recienPulsado(5)) alternarSombras();
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

function cambiarEstructura() {
  nivelEstructura = (nivelEstructura + 1) % NIVELES.length;
  aplicarEstructura();
}

function aplicarEstructura() {
  grupos.capas.forEach((lista, i) => lista.forEach((o) => { o.visible = i >= nivelEstructura; }));
}

function alternarVidrio() {
  vidrioVisible = !vidrioVisible;
  grupos.vidrio.forEach((o) => { o.visible = vidrioVisible; });
}

function alternarSombras() {
  luzSol.castShadow = !luzSol.castShadow;
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

const reloj = new THREE.Clock();
let acumulado = 0;
let cuadros = 0;
let peor = 0;
function cuadro() {
  const dt = Math.min(reloj.getDelta(), 0.1);
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
  placaHud.visible = enVR && hudVisible;
  renderer.render(escena, camara);
  medirCuadro(dt, enVR);
}

function medirCuadro(dt, enVR) {
  acumulado += dt;
  peor = Math.max(peor, dt);
  cuadros++;
  if (acumulado < 0.5) return;
  const info = renderer.info.render;
  const lineas = [
    `${Math.round(cuadros / acumulado)} cuadros/s · ${(1000 * acumulado / cuadros).toFixed(1)} ms (peor ${Math.round(1000 * peor)} ms)`,
    `Dibujando ${miles(info.triangles)} triángulos · ${info.calls} llamadas${enVR ? ' (dos ojos)' : ''}`,
    `Estructura del domo: ${NIVELES[nivelEstructura]}`,
    `Vidrio: ${vidrioVisible ? 'sí' : 'no'} · Sombras: ${luzSol.castShadow ? 'sí' : 'no'}`,
    RESUMEN,
  ];
  hud.textContent = lineas.join('\n');
  if (enVR && hudVisible) dibujarHud(lineas.slice(0, 4));
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
  pincelHud.fillStyle = '#E8F4F2';
  pincelHud.font = '600 25px system-ui, sans-serif';
  lineas.forEach((linea, i) => pincelHud.fillText(linea, 20, 42 + i * 42));
  texturaHud.needsUpdate = true;
}

function miles(valor) {
  return Math.round(valor).toLocaleString('es-AR');
}

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
    const sesion = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(sesion);
  } catch (error) {
    console.error(error);
    botonVR.title = 'No se pudo entrar en VR: ' + error.message;
  }
});
renderer.xr.addEventListener('sessionstart', () => {
  cabeceo = 0;
  botonVR.textContent = 'Salir de VR';
});
renderer.xr.addEventListener('sessionend', () => {
  botonVR.textContent = 'Entrar en VR';
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
window.campus = {
  renderer, escena, camara, visitante, grupos, medir,
  fijarEstructura(n) { nivelEstructura = n; aplicarEstructura(); },
  fijarVidrio(v) { vidrioVisible = !v; alternarVidrio(); },
  fijarSombras(v) { luzSol.castShadow = v; },
  listo: () => colision !== null,
};
