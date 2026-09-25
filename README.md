# Campus Ecotec · prueba de rendimiento

Visor web del campus Ecotec (tres domos geodésicos, galerías y patio central) hecho con Three.js y WebXR.
Funciona en el navegador de la computadora y en el navegador de Meta Quest (botón **Entrar en VR**).

## Controles

- **Computadora:** W A S D o flechas para caminar, arrastrar con el mouse para mirar, Shift para ir más rápido,
  Espacio junto al ascensor para subir o bajar al semipiso.
- **Casco:** joystick izquierdo camina, joystick derecho gira, apretar el izquierdo para ir más rápido, A: ascensor.

## Pruebas de rendimiento

El medidor muestra cuadros por segundo, milisegundos por cuadro, triángulos dibujados y llamadas de dibujo.

- **Prueba automática:** P en la compu, grip derecho en el casco. Se para en el patio mirando el domo 1 y recorre
  31 pasos (unos 3 minutos): geometría, objetos, luces, efectos, contenido sin estructura y memoria de imágenes.
  Al terminar muestra la tabla y la guarda en el navegador. «Enviar al registro» la manda a la página de registro.
- **A mano en la compu:** 1 estructura · 2 vidrio · 3 sombras · 4 estructuras extra · 5 sillas · 6 sillas sueltas o
  instanciadas · 7 luces · 8 materiales como en Blender · 9 imágenes 2K · 0 resolución · coma y punto: pasos ·
  R: volver al punto de prueba · T: resultados · H: medidor.
- **A mano en el casco:** X estructura · Y vidrio · B sombras · gatillos: paso anterior y siguiente ·
  grip izquierdo: tablero de resultados · apretar el joystick derecho: volver al punto de prueba.
- La resolución del casco se elige antes de entrar en VR (0,8× a 1,4×).

Modelo: 1.331.474 triángulos, 177 objetos, `modelo/campus.glb` comprimido con Draco (12,9 MB).

Hecho por Ocarina Digital.
