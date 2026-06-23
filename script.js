const MAX_CAPACITY = 5;

let totalDetected = 0;
let currentInside = 0;
let serialPort = null;
let serialWriter = null;
let keepReadingSerial = false;

const hourlyData = [
  { hour: "08:00 - 09:00", people: 15 },
  { hour: "09:00 - 10:00", people: 24 },
  { hour: "10:00 - 11:00", people: 30 },
  { hour: "11:00 - 12:00", people: 40 }
];

const elements = {
  maxCapacity: document.getElementById("maxCapacity"),
  totalDetected: document.getElementById("totalDetected"),
  currentInside: document.getElementById("currentInside"),
  accessStatus: document.getElementById("accessStatus"),
  statusHint: document.getElementById("statusHint"),
  statusCard: document.getElementById("statusCard"),
  alertPanel: document.getElementById("alertPanel"),
  liveBadge: document.getElementById("liveBadge"),
  statusText: document.getElementById("statusText"),
  statusMessage: document.getElementById("statusMessage"),
  historyTable: document.getElementById("historyTable"),
  flowChart: document.getElementById("flowChart"),
  currentDate: document.getElementById("currentDate"),
  currentTime: document.getElementById("currentTime"),
  addPerson: document.getElementById("addPerson"),
  removePerson: document.getElementById("removePerson"),
  resetCounter: document.getElementById("resetCounter")
};

elements.connectArduino = document.getElementById("connectArduino");
elements.sensorStatus = document.getElementById("sensorStatus");

function getAccessState(people) {
  return people >= MAX_CAPACITY ? "blocked" : "allowed";
}

function getStateLabel(state) {
  return state === "blocked" ? "Bloqueado" : "Permitido";
}

function updateDashboard() {
  const state = getAccessState(currentInside);
  const isBlocked = state === "blocked";

  elements.maxCapacity.textContent = MAX_CAPACITY;
  elements.totalDetected.textContent = totalDetected;
  elements.currentInside.textContent = currentInside;
  elements.accessStatus.textContent = isBlocked ? "ENTRADA BLOQUEADA" : "ACCESO PERMITIDO";
  elements.statusHint.textContent = isBlocked ? "Capacidad superada" : "Ingreso habilitado";
  elements.statusText.textContent = isBlocked ? "BLOQUEADO" : "PERMITIDO";
  elements.statusMessage.textContent = isBlocked
    ? "El aforo máximo fue superado. El sistema debe bloquear nuevos ingresos hasta reducir la ocupación."
    : "El conteo se mantiene dentro del límite configurado. La puerta puede permitir ingresos.";
  elements.liveBadge.textContent = isBlocked ? "ALERTA" : "ONLINE";

  [elements.statusCard, elements.alertPanel, elements.liveBadge].forEach((element) => {
    element.classList.toggle("blocked", isBlocked);
    element.classList.toggle("allowed", !isBlocked);
  });

  drawChart();
}

function applyArduinoState(data) {
  if (Number.isFinite(data.totalDetected)) {
    totalDetected = data.totalDetected;
  }

  if (Number.isFinite(data.currentInside)) {
    currentInside = data.currentInside;
  }

  addLiveRecord();
  renderTable();
  updateDashboard();
}

function extractFallback(raw) {
  const td = raw.match(/"totalDetected"\s*:\s*(\d+)/);
  const ci = raw.match(/"currentInside"\s*:\s*(\d+)/);
  if (td && ci) {
    return { totalDetected: Number(td[1]), currentInside: Number(ci[1]) };
  }
  return null;
}

function handleSerialLine(line) {
  const cleanLine = line.trim();

  if (!cleanLine) {
    return;
  }

  console.log("[Serial RX]", cleanLine);

  let data = null;
  try {
    data = JSON.parse(cleanLine);
  } catch (_) {
    data = extractFallback(cleanLine);
    if (!data) {
      console.warn("Dato Serial no reconocido:", cleanLine);
      return;
    }
  }

  console.log("[Estado recibido]", data);
  updateSensorTimestamp();
  applyArduinoState(data);
}

function updateSensorTimestamp() {
  const el = document.getElementById("lastSensorUpdate");
  if (el) {
    el.textContent = "Último dato: " + new Date().toLocaleTimeString("es-PE", { hour12: false });
  }
}

async function connectArduino() {
  if (!("serial" in navigator)) {
    elements.sensorStatus.textContent = "Usa Chrome o Edge con localhost";
    alert("Tu navegador no soporta Web Serial. Abre la página en Chrome o Edge usando un servidor local.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });

    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(serialPort.writable);
    serialWriter = textEncoder.writable.getWriter();

    keepReadingSerial = true;
    elements.connectArduino.textContent = "Arduino conectado";
    elements.connectArduino.disabled = true;
    elements.sensorStatus.textContent = "Arduino conectado por USB";

    readSerialLoop();
  } catch (error) {
    elements.sensorStatus.textContent = "No se pudo conectar";
    console.error(error);
  }
}

async function readSerialLoop() {
  const textDecoder = new TextDecoderStream();
  const readableClosed = serialPort.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  let buffer = "";

  try {
    while (keepReadingSerial) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(handleSerialLine);
    }
  } catch (error) {
    console.error(error);
  } finally {
    reader.releaseLock();
    await readableClosed.catch(() => {});
    elements.connectArduino.textContent = "Conectar Arduino";
    elements.connectArduino.disabled = false;
    elements.sensorStatus.textContent = "Arduino desconectado";
  }
}

async function sendArduinoCommand(command) {
  if (!serialWriter) {
    return false;
  }

  await serialWriter.write(`${command}\n`);
  return true;
}

function renderTable() {
  elements.historyTable.innerHTML = "";

  hourlyData.forEach((row) => {
    const state = getAccessState(row.people);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.hour}</td>
      <td>${row.people}</td>
      <td><span class="tag ${state}">${getStateLabel(state)}</span></td>
    `;

    elements.historyTable.appendChild(tr);
  });
}

function addLiveRecord() {
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  const hourLabel = `${formatHour(now)} - ${formatHour(nextHour)}`;
  const existingLiveRow = hourlyData.find((row) => row.live);

  if (existingLiveRow) {
    existingLiveRow.hour = hourLabel;
    existingLiveRow.people = currentInside;
    return;
  }

  hourlyData.push({
    hour: hourLabel,
    people: currentInside,
    live: true
  });
}

function formatHour(date) {
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function updateClock() {
  const now = new Date();
  elements.currentDate.textContent = now.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "2-digit",
    month: "short"
  });
  elements.currentTime.textContent = now.toLocaleTimeString("es-PE", {
    hour12: false
  });
}

function drawChart() {
  const canvas = elements.flowChart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(300 * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = 300;
  const padding = 42;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxValue = Math.max(45, ...hourlyData.map((item) => item.people));
  const barWidth = chartWidth / hourlyData.length * 0.58;

  context.clearRect(0, 0, width, height);

  context.strokeStyle = "rgba(126, 231, 255, 0.12)";
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  const capacityY = padding + chartHeight - (MAX_CAPACITY / maxValue) * chartHeight;
  context.strokeStyle = "rgba(255, 200, 87, 0.8)";
  context.setLineDash([8, 8]);
  context.beginPath();
  context.moveTo(padding, capacityY);
  context.lineTo(width - padding, capacityY);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#ffc857";
  context.font = "12px Arial";
  context.fillText("Aforo " + MAX_CAPACITY, padding, capacityY - 8);

  hourlyData.forEach((item, index) => {
    const slot = chartWidth / hourlyData.length;
    const x = padding + slot * index + (slot - barWidth) / 2;
    const barHeight = (item.people / maxValue) * chartHeight;
    const y = padding + chartHeight - barHeight;
    const state = getAccessState(item.people);
    const gradient = context.createLinearGradient(0, y, 0, height - padding);

    if (state === "blocked") {
      gradient.addColorStop(0, "#ff4b5f");
      gradient.addColorStop(1, "rgba(255, 75, 95, 0.22)");
    } else {
      gradient.addColorStop(0, "#40d9ff");
      gradient.addColorStop(1, "rgba(54, 240, 138, 0.2)");
    }

    context.fillStyle = gradient;
    roundedRect(context, x, y, barWidth, barHeight, 8);
    context.fill();

    context.fillStyle = "#eef7ff";
    context.font = "bold 13px Arial";
    context.textAlign = "center";
    context.fillText(item.people, x + barWidth / 2, y - 10);

    context.fillStyle = "#8ea6b8";
    context.font = "11px Arial";
    context.fillText(item.hour.replace(" - ", "\n"), x + barWidth / 2, height - 18);
  });

  context.textAlign = "left";
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

elements.connectArduino.addEventListener("click", connectArduino);

elements.addPerson.addEventListener("click", async () => {
  if (await sendArduinoCommand("IN")) {
    return;
  }

  totalDetected += 1;
  currentInside += 1;
  addLiveRecord();
  renderTable();
  updateDashboard();
});

elements.removePerson.addEventListener("click", async () => {
  if (await sendArduinoCommand("OUT")) {
    return;
  }

  currentInside = Math.max(0, currentInside - 1);
  addLiveRecord();
  renderTable();
  updateDashboard();
});

elements.resetCounter.addEventListener("click", async () => {
  if (await sendArduinoCommand("RESET")) {
    return;
  }

  totalDetected = 0;
  currentInside = 0;
  addLiveRecord();
  renderTable();
  updateDashboard();
});

window.addEventListener("resize", drawChart);

updateClock();
renderTable();
updateDashboard();
setInterval(updateClock, 1000);
