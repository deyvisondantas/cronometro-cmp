let socket = null;
let timerState = null;
let serverOffset = 0;

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const connectionEl = document.getElementById("connection");
const connectionText = document.getElementById("connectionText");
const saveIndicatorEl = document.getElementById("saveIndicator");

const hoursEl = document.getElementById("hours");
const minutesEl = document.getElementById("minutes");
const secondsEl = document.getElementById("seconds");

const addHoursEl = document.getElementById("addHours");
const addMinutesEl = document.getElementById("addMinutes");
const addSecondsEl = document.getElementById("addSeconds");

const STATUS_LABELS = {
  idle: "AGUARDANDO",
  running: "EM ANDAMENTO",
  paused: "PAUSADO",
  stopped: "PARADO",
  finished: "FINALIZADO"
};

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

function getRemaining() {
  if (!timerState) return 0;

  if (timerState.status === "running" && timerState.endAt) {
    return Math.max(0, timerState.endAt - (Date.now() + serverOffset));
  }

  return Math.max(0, timerState.remainingMs || 0);
}

function setConfiguredTimeFields(durationMs) {
  const totalSeconds = Math.max(0, Math.floor((durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  hoursEl.value = hours;
  minutesEl.value = minutes;
  secondsEl.value = seconds;
}

function render() {
  if (!timerState) return;

  timerEl.textContent = formatTime(getRemaining());
  statusEl.textContent = STATUS_LABELS[timerState.status] || "AGUARDANDO";

  // Não sobrescreve o campo que o operador está editando.
  // Isso permite alterar horas, minutos e segundos normalmente.
  const active = document.activeElement;
  const editingConfiguredTime = [hoursEl, minutesEl, secondsEl].includes(active);
  if (!editingConfiguredTime) {
    setConfiguredTimeFields(timerState.durationMs);
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.addEventListener("open", () => {
    connectionEl.classList.add("online");
    connectionText.textContent = "CONECTADO";
    socket.send(JSON.stringify({ type: "get_state" }));
  });

  socket.addEventListener("message", (event) => {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("Mensagem não-JSON recebida do servidor:", event.data);
      return;
    }

    if (message.type === "state") {
      serverOffset = message.state.serverNow - Date.now();
      timerState = message.state;
      render();
    }

    if (message.type === "error") {
      alert(message.message);
    }
  });

  socket.addEventListener("close", () => {
    connectionEl.classList.remove("online");
    connectionText.textContent = "DESCONECTADO";
    setTimeout(connect, 1500);
  });

  socket.addEventListener("error", () => {
    connectionEl.classList.remove("online");
    connectionText.textContent = "ERRO DE CONEXÃO";
  });
}

function send(type, extra = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("O controle está desconectado do servidor.");
    return;
  }

  socket.send(JSON.stringify({ type, ...extra }));
}

let saveIndicatorTimer = null;

function saveConfiguredTime() {
  const hours = Math.min(99, Math.max(0, Number(hoursEl.value) || 0));
  const minutes = Math.min(59, Math.max(0, Number(minutesEl.value) || 0));
  const seconds = Math.min(59, Math.max(0, Number(secondsEl.value) || 0));

  hoursEl.value = hours;
  minutesEl.value = minutes;
  secondsEl.value = seconds;

  if (saveIndicatorEl) {
    saveIndicatorEl.textContent = "Salvando...";
    saveIndicatorEl.classList.remove("saved");
  }

  send("set_time", { hours, minutes, seconds });

  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => {
    if (saveIndicatorEl) {
      saveIndicatorEl.textContent = "✓ Tempo salvo";
      saveIndicatorEl.classList.add("saved");
    }
  }, 250);
}

let setTimeDebounce = null;

function scheduleSaveConfiguredTime() {
  if (setTimeDebounce) clearTimeout(setTimeDebounce);
  setTimeDebounce = setTimeout(saveConfiguredTime, 500);
}

[hoursEl, minutesEl, secondsEl].forEach((input) => {
  // Salva automaticamente, mas o render() não sobrescreve o campo que está
  // sendo digitado. Assim é possível alterar os três campos normalmente.
  input.addEventListener("input", scheduleSaveConfiguredTime);
  input.addEventListener("change", () => {
    if (setTimeDebounce) clearTimeout(setTimeDebounce);
    saveConfiguredTime();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (setTimeDebounce) clearTimeout(setTimeDebounce);
      saveConfiguredTime();
      input.blur();
    }
  });
});

document.getElementById("addTime").addEventListener("click", () => {
  const hours = Math.min(99, Math.max(0, Number(addHoursEl.value) || 0));
  const minutes = Math.min(59, Math.max(0, Number(addMinutesEl.value) || 0));
  const seconds = Math.min(59, Math.max(0, Number(addSecondsEl.value) || 0));

  addHoursEl.value = hours;
  addMinutesEl.value = minutes;
  addSecondsEl.value = seconds;

  const totalMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;

  if (totalMs <= 0) {
    alert("Informe um tempo maior que zero para adicionar.");
    return;
  }

  send("add_time", { hours, minutes, seconds });
});

document.getElementById("start").addEventListener("click", () => {
  send("start");
});

document.getElementById("pause").addEventListener("click", () => {
  send("pause");
});

document.getElementById("continue").addEventListener("click", () => {
  send("continue");
});

document.getElementById("stop").addEventListener("click", () => {
  if (confirm("Deseja realmente parar o cronômetro?")) {
    send("stop");
  }
});

document.getElementById("reset").addEventListener("click", () => {
  if (timerState?.status === "running") {
    if (!confirm("O cronômetro está em andamento. Deseja realmente zerá-lo?")) {
      return;
    }
  }

  send("reset");
});

setInterval(render, 100);
connect();
