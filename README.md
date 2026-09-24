# Campus Ecotec · prueba de rendimiento

Visor web del campus Ecotec (tres domos geodésicos, galerías y patio central) hecho con Three.js y WebXR.
Funciona en el navegador de la computadora y en el navegador de Meta Quest (botón **Entrar en VR**).

## Controles

- **Computadora:** W A S D o flechas para caminar, arrastrar con el mouse para mirar, Shift para ir más rápido,
  Espacio junto al ascensor para subir o bajar al semipiso.
- **Casco:** joystick izquierdo camina, joystick derecho gira, apretar el izquierdo para ir más rápido, A: ascensor.

## Pruebas de rendimiento

El medidor muestra cuadros por segundo, milisegundos por cuadro, triángulos dibujados y llamadas de dibujo.

- **1 / X:** apaga capas de la estructura del domo, en orden: nudos, tapetas, juntas y perfiles.
- **2 / Y:** vidrio sí o no. **3 / B:** sombras sí o no. **H:** oculta el medidor.

Modelo: 1.331.474 triángulos, 177 objetos, `modelo/campus.glb` comprimido con Draco (12,9 MB).

Hecho por Ocarina Digital.
