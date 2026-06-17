# FORO-IOT - Sistema de Aforo TI

Proyecto web para monitorear un prototipo fisico de control de aforo con Arduino UNO.

La pagina se conecta al Arduino por USB usando Web Serial y actualiza el dashboard en tiempo real.

## Que incluye

- Pagina web: `index.html`, `style.css`, `script.js`
- Servidor local: `server.js`
- Codigo Arduino: `arduino/aforo_ti/aforo_ti.ino`
- Imagenes y documento del prototipo

## Requisitos

- Arduino UNO
- Arduino IDE
- Google Chrome o Microsoft Edge
- Node.js instalado en la laptop
- Cable USB para conectar el Arduino

## Por que usar `node server.js`

La pagina debe abrirse desde un servidor local para que Chrome o Edge permitan conectarse al Arduino por USB.

Si se abre `index.html` con doble clic, queda como `file:///...` y la conexion Serial puede fallar.

Con este comando:

```bash
node server.js
```

la pagina queda disponible en:

```txt
http://localhost:8000/
```

## Como probar en otra PC

1. Clonar el repositorio:

```bash
git clone https://github.com/luisdionicio-lgtm/FORO-IOT.git
```

2. Entrar a la carpeta:

```bash
cd FORO-IOT
```

3. Iniciar la pagina web:

```bash
node server.js
```

4. Abrir en Chrome o Edge:

```txt
http://localhost:8000/
```

## Como cargar el codigo al Arduino

1. Conectar el Arduino UNO a la laptop por USB.
2. Abrir Arduino IDE.
3. Abrir este archivo:

```txt
arduino/aforo_ti/aforo_ti.ino
```

4. Seleccionar la placa:

```txt
Herramientas > Placa > Arduino Uno
```

5. Seleccionar el puerto:

```txt
Herramientas > Puerto > COM...
```

6. Presionar `Subir`.
7. Cerrar el Monitor Serial si esta abierto.

## Como conectar la pagina con el prototipo

1. Abrir `http://localhost:8000/` en Chrome o Edge.
2. Presionar el boton `Conectar Arduino`.
3. Elegir el puerto COM del Arduino.
4. Pasar una persona o la mano frente al sensor ultrasonico.

La pagina debe actualizar:

- Personas detectadas
- Personas dentro actualmente
- Estado del acceso
- Historial
- Grafico de flujo

## Pines usados en el codigo

```txt
HC-SR04 TRIG  -> D9
HC-SR04 ECHO  -> D10
Servo SG90    -> D6
LED verde     -> D4
LED rojo      -> D5
Buzzer        -> D3
Boton salida  -> D7
```

Si el prototipo esta cableado con otros pines, cambiar esos valores al inicio de:

```txt
arduino/aforo_ti/aforo_ti.ino
```

## Funcionamiento esperado

- Si el sensor detecta ingreso, aumenta el contador.
- Si hay cupo, se permite el acceso.
- Si el aforo llega al limite, se bloquea la entrada.
- El Arduino controla LEDs, buzzer y servo.
- La pagina muestra los datos en tiempo real.

## Nota importante

Solo un programa puede usar el puerto Serial a la vez.

Antes de conectar la pagina al Arduino, cerrar el Monitor Serial de Arduino IDE.
