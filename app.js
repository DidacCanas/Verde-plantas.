const $ = s => document.querySelector(s);
let symptom = 'manchas';
let installPrompt;
let imageFile;
let previewUrl;
let photoAnalysisResult = null;

const db = {
  manchas: {name:'Mancha foliar (posible hongo)', icon:'◌', confidence:'Patrón compatible · confirmar de cerca', copy:'Las manchas suelen aparecer cuando las hojas permanecen húmedas o el aire circula poco. Retira las hojas muy afectadas y observa si las lesiones avanzan.', check:'Comprueba el reverso de las hojas y evita tratar si hay lluvia, mucho calor o viento.', steps:[['Hoy','Sanea y aísla','Retira hojas afectadas con tijeras limpias. No las compostes. Riega solo el sustrato.'],['Día 3','Tratamiento preventivo','Si el problema avanza, consulta un producto fungicida autorizado para tu planta (por ejemplo, cobre o bicarbonato potásico) y sigue estrictamente la etiqueta.'],['Día 10','Revisión y repetición','Revisa los brotes nuevos. Repite solo si la etiqueta del producto y el estado de la planta lo indican.']], prevent:['Riega a primera hora y siempre a nivel del sustrato.','Deja espacio entre plantas para que circule el aire.','Revisa hojas nuevas una vez a la semana y retira las caídas.']},
  polvo: {name:'Oídio (posible hongo)', icon:'◒', confidence:'Patrón compatible · confirmar de cerca', copy:'El aspecto blanquecino y pulverulento es compatible con oídio. Suele avanzar con humedad ambiental y ventilación limitada.', check:'No pulverices productos bajo sol directo. Verifica que el polvo no sea residuo de riego.', steps:[['Hoy','Poda suave y ventilación','Retira las hojas más cubiertas, limpia las herramientas y mejora la circulación de aire.'],['Día 3','Tratamiento indicado','Consulta un fungicida autorizado para oídio en este cultivo. Azufre o bicarbonato potásico son opciones habituales según el cultivo; respeta siempre etiqueta y plazo de seguridad.'],['Día 10','Control de progreso','Mira los brotes nuevos. Si siguen limpios, mantén cuidados; si reaparece, consulta el uso repetido indicado en la etiqueta.']], prevent:['Mantén la planta con buena ventilación y luz apropiada.','Evita exceso de abonado nitrogenado.','Inspecciona semanalmente los brotes tiernos.']},
  amarilleo: {name:'Estrés de riego o nutrición', icon:'◐', confidence:'Síntoma inespecífico · revisa raíces', copy:'El amarilleo puede deberse a exceso de riego, falta de luz o carencias. Antes de añadir productos, conviene descartar un sustrato encharcado.', check:'Toca el sustrato a 3–4 cm de profundidad y busca raíces oscuras o blandas antes de abonar.', steps:[['Hoy','Ajusta el riego','Riega solo cuando la capa superior esté seca y deja que el agua drene. Retira el agua acumulada del plato.'],['Día 5','Observa el crecimiento','Pon la planta en luz adecuada y comprueba si el amarilleo llega a hojas nuevas.'],['Día 12','Nutrición si procede','Solo si el riego está equilibrado, utiliza un abono equilibrado apto para la especie, a la dosis mínima indicada por el fabricante.']], prevent:['Usa macetas con drenaje y un sustrato adecuado.','No abones una planta débil o con raíces dañadas.','Adapta la frecuencia de riego a la estación.']},
  insectos: {name:'Plaga de insectos chupadores', icon:'◉', confidence:'Necesita confirmación visual', copy:'Pulgones, cochinillas o mosca blanca pueden deformar hojas y dejar melaza. Identificar el insecto concreto mejora mucho el tratamiento.', check:'Mira el envés de las hojas y los tallos. Aísla la planta mientras confirmas la plaga.', steps:[['Hoy','Retirada mecánica','Ducha suave sobre el envés o retira insectos con un paño húmedo. Aísla la planta y revisa las cercanas.'],['Día 3','Control dirigido','Para plagas leves, consulta jabón potásico o aceite de neem autorizados para tu cultivo. Aplica al atardecer y según la etiqueta.'],['Día 10','Revisión completa','Revisa brotes y envés. Repite solo según la etiqueta; si persiste, consulta un vivero o técnico.']], prevent:['Inspecciona el envés de las hojas al regar.','Aísla las plantas nuevas durante una o dos semanas.','Evita excesos de fertilizante que atraen brotes muy tiernos.']}
};

function selectedData(){ return db[symptom]; }

function renderModal(){
  const d = selectedData();
  $('#diagnosisIcon').textContent = d.icon;
  $('#resultTitle').textContent = d.name;
  $('#confidence').textContent = d.confidence;
  $('#diagnosisCopy').textContent = d.copy;
  $('#checkFirst').textContent = d.check;
  $('#timeline').innerHTML = d.steps.map(s =>
    `<li><span class="day">${s[0]}</span><div class="step"><b>${s[1]}</b><p>${s[2]}</p></div></li>`
  ).join('');
  $('#preventionList').innerHTML = d.prevent.map(p => `<li>${p}</li>`).join('');
}

function closeAllModals(){
  document.querySelectorAll('.modal-backdrop').forEach(modal => { modal.hidden = true; });
  document.body.style.overflow = '';
}

function open(id){
  closeAllModals();
  if (id === 'historyModal') renderHistory();
  $('#' + id).hidden = false;
  document.body.style.overflow = 'hidden';
}

function close(){
  closeAllModals();
}

document.querySelectorAll('.chip').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    symptom = b.dataset.value;
  })
);

$('#photoInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    $('#photoAnalysisStatus').textContent =
      'Selecciona una imagen válida.';
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    $('#photoAnalysisStatus').textContent =
      'La imagen es demasiado grande. Máximo recomendado: 8 MB.';
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  imageFile = file;
  previewUrl = URL.createObjectURL(file);

  const image = $('#preview');
  image.src = previewUrl;
  image.hidden = false;

  $('#photoPlaceholder').hidden = true;

  $('#photoAnalysisStatus').textContent =
    'Foto recibida. Analizando síntomas…';

  await analyzePhotoLocally();

  updateIdentifyButton();

  identifySpeciesAutomatically();
});
async function analyzePhotoLocally() {
  if (!imageFile) {
    return;
  }

  try {
    const image = new Image();

    image.src = previewUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const maxSize = 320;
    const scale = Math.min(
      maxSize / image.width,
      maxSize / image.height,
      1
    );

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const pixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;

    let yellowPixels = 0;
    let whitePixels = 0;
    let darkPixels = 0;
    let totalPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      const red = pixels[i];
      const green = pixels[i + 1];
      const blue = pixels[i + 2];

      const isYellow =
        red > 120 &&
        green > 100 &&
        red > blue * 1.25 &&
        green > blue * 1.15;

      const isWhite =
        red > 175 &&
        green > 175 &&
        blue > 175 &&
        Math.abs(red - green) < 45 &&
        Math.abs(green - blue) < 45;

      const isDark =
        red < 80 &&
        green < 80 &&
        blue < 80;

      if (isYellow) yellowPixels++;
      if (isWhite) whitePixels++;
      if (isDark) darkPixels++;
    }

    const yellowRatio = yellowPixels / totalPixels;
    const whiteRatio = whitePixels / totalPixels;
    const darkRatio = darkPixels / totalPixels;

    /*
     * Es una orientación visual básica, no un diagnóstico médico
     * ni un sistema profesional de detección de enfermedades.
     */
    if (whiteRatio > 0.18) {
      symptom = 'polvo';
    } else if (yellowRatio > 0.12) {
      symptom = 'amarilleo';
    } else if (darkRatio > 0.2) {
      symptom = 'manchas';
    } else {
      symptom = 'manchas';
    }

    document.querySelectorAll('.chip').forEach(chip => {
      chip.classList.toggle(
        'selected',
        chip.dataset.value === symptom
      );
    });

    photoAnalysisResult = symptom;

    const symptomNames = {
      manchas: 'posibles manchas',
      polvo: 'posible polvo blanco',
      amarilleo: 'posible amarilleo',
      insectos: 'posibles daños de insectos'
    };

    $('#photoAnalysisStatus').textContent =
      `Análisis preliminar: ${symptomNames[symptom]}. ` +
      'Puedes corregirlo manualmente.';
  } catch (error) {
    console.error('Error analizando la fotografía:', error);

    $('#photoAnalysisStatus').textContent =
      'No se pudo analizar automáticamente. Selecciona el síntoma manualmente.';
  }
}

const keyInput = $('#plantnetKey');

if (keyInput) {
  keyInput.value = localStorage.getItem('plantnetApiKey') || '';
  keyInput.addEventListener('input', () => {
    localStorage.setItem('plantnetApiKey', keyInput.value.trim());
    updateIdentifyButton();
  });
}

function updateIdentifyButton() {
  const button = $('#identifySpeciesBtn');

  if (!button || !keyInput) {
    return;
  }

  button.disabled = !(imageFile && keyInput.value.trim());
}

function plantNameFromResult(result){
  const species = result.species || {};
  const scientific = species.scientificNameWithoutAuthor || species.scientificName || 'Especie sin nombre disponible';
  const common = Array.isArray(species.commonNames) && species.commonNames[0] ? species.commonNames[0] : '';
  return { scientific, common };
}

function setDetectedPlant(name){
  const select = $('#plant');
  let option = [...select.options].find(o => o.text === name);
  if (!option) {
    option = document.createElement('option');
    option.value = `detect:${name}`;
    option.text = name;
    select.add(option, 0);
  }
  select.value = option.value;
}

async function identifySpeciesAutomatically() {
  if (!imageFile || !keyInput || !keyInput.value.trim()) return;

  const button = $('#identifySpeciesBtn'), status = $('#speciesStatus');
  button.disabled = true;
  button.querySelector('span').textContent = 'Identificando especie…';
  status.textContent = 'Enviando la foto a Pl@ntNet para analizarla.';
  try {
    const data = new FormData();
    data.append('images', imageFile, imageFile.name);
    data.append('organs', 'auto');
    const url = `https://my-api.plantnet.org/v2/identify/all?lang=es&api-key=${encodeURIComponent(keyInput.value.trim())}`;
    const response = await fetch(url, { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo identificar la imagen');
    const top = result.results?.[0];
    if (!top) throw new Error('No se encontró una especie con suficiente coincidencia');
    const plant = plantNameFromResult(top);
    const confidence = Math.round((top.score || 0) * 100);
    setDetectedPlant(plant.common ? `${plant.common} (${plant.scientific})` : plant.scientific);
    status.textContent = `Detectada: ${plant.common ? plant.common + ' · ' : ''}${plant.scientific} · confianza ${confidence}%. Puedes corregirla en la lista si no coincide.`;
  } catch (error) {
    status.textContent = `No se pudo identificar: ${error.message}. Comprueba la clave, el dominio autorizado y la conexión.`;
  } finally {
    button.querySelector('span').textContent = 'Identificar especie en la foto';
    updateIdentifyButton();
  }
}

$('#identifySpeciesBtn').addEventListener('click', identifySpeciesAutomatically);

$('#analyzeBtn').addEventListener('click', () => {
  if (!imageFile) {
    $('#photoAnalysisStatus').textContent =
      'Primero haz una fotografía de la planta.';
    return;
  }

  renderModal();
  open('resultModal');
});

document.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', close)
);

document.querySelectorAll('.modal-backdrop').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) close(); })
);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') close();
});

$('#historyBtn').addEventListener('click', () => open('historyModal'));
$('#openHistory').addEventListener('click', () => open('historyModal'));

function getPlans(){ return JSON.parse(localStorage.getItem('verdePlans') || '[]'); }
function setPlans(v){ localStorage.setItem('verdePlans', JSON.stringify(v)); }

$('#savePlanBtn').addEventListener('click', () => {
  const d = selectedData();
  const p = {
    id: Date.now(),
    name: d.name,
    plant: $('#plant').options[$('#plant').selectedIndex].text,
    date: new Date().toLocaleDateString('es-ES'),
    steps: d.steps,
    done: []
  };
  const plans = getPlans();
  plans.unshift(p);
  setPlans(plans);
  close();
  renderTasks();
  $('#todaySection').scrollIntoView({ behavior: 'smooth' });
});

function renderTasks(){
  const plans = getPlans(), list = $('#taskList'), empty = $('#emptyState');
  const tasks = plans.flatMap(p => p.steps.map((s, i) => ({ ...p, s, i })));
  const undone = tasks.filter(t => !t.p.done.includes(t.i));
  $('#todayCount').textContent = `${undone.length} ${undone.length === 1 ? 'tarea' : 'tareas'}`;
  empty.hidden = plans.length > 0;
  list.innerHTML = undone.map(t =>
    `<article class="task"><button class="task-check" data-id="${t.p.id}" data-step="${t.i}" aria-label="Marcar como realizada"></button><div class="task-copy"><b>${t.s[1]}</b><span>${t.p.plant} · ${t.p.name}</span></div><span class="task-day">${t.s[0]}</span></article>`
  ).join('');
  document.querySelectorAll('.task-check').forEach(b =>
    b.addEventListener('click', () => {
      let all = getPlans();
      let p = all.find(x => x.id == b.dataset.id);
      let i = +b.dataset.step;
      p.done.includes(i) ? p.done = p.done.filter(x => x !== i) : p.done.push(i);
      setPlans(all);
      renderTasks();
    })
  );
  $('#historyDot').classList.toggle('show', plans.length > 0);
}

function renderHistory(){
  const p = getPlans(), h = $('#historyList');
  h.innerHTML = p.length
    ? p.map(x => `<div class="history-item"><div class="history-icon">⌁</div><div><b>${x.name}</b><span>${x.plant} · guardado el ${x.date} · ${x.done.length}/${x.steps.length} tareas</span></div></div>`).join('')
    : '<p class="no-history">Todavía no has guardado ninguna revisión.</p>';
}

renderTasks();

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('#installBtn').hidden = false;
});

$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBtn').hidden = true;
});

window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });

const plantnetToggle = $('#plantnetToggle');
const plantnetContent = $('#plantnetContent');

plantnetToggle.addEventListener('click', () => {
  const expanded = plantnetToggle.getAttribute('aria-expanded') === 'true';
  plantnetToggle.setAttribute('aria-expanded', String(!expanded));
  plantnetContent.hidden = expanded;
});
