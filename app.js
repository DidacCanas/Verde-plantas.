const $ = s => document.querySelector(s);
let symptom = 'manchas';
let installPrompt;
let imageFile;
let previewUrl;
let photoAnalysisResult = null;
let diseaseCatalogPromise = null;

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
  identifyDiseaseAutomatically();
  analyzeWithGemini();
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
const geminiKeyInput = $('#geminiKey');
const aiResultBox = $('#aiResultBox');
const aiResultText = $('#aiResultText');
const geminiStatus = $('#geminiStatus');

if (keyInput) {
  keyInput.value = localStorage.getItem('plantnetApiKey') || '';
  keyInput.addEventListener('input', () => {
    localStorage.setItem('plantnetApiKey', keyInput.value.trim());
    updateIdentifyButton();
  });
}

if (geminiKeyInput) {
  geminiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
  geminiKeyInput.addEventListener('input', () => {
    localStorage.setItem('geminiApiKey', geminiKeyInput.value.trim());
  });
}

function updateIdentifyButton() {
  const button = $('#identifySpeciesBtn');

  if (!button || !keyInput) {
    return;
  }

  button.disabled = !(imageFile && keyInput.value.trim());
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeWithGemini() {
  if (!imageFile || !geminiKeyInput || !geminiKeyInput.value.trim()) {
    if (aiResultBox) aiResultBox.hidden = true;
    return;
  }

  if (geminiStatus) geminiStatus.textContent = 'Analizando síntomas con IA…';

  try {
    const base64 = await fileToBase64(imageFile);
    const base64Data = base64.split(',')[1];
    const mimeType = imageFile.type || 'image/jpeg';

    const prompt = 'Eres un experto en salud de plantas. Analiza esta foto de planta y responde en español, de forma breve (máximo 3 frases): 1) ¿Qué síntomas o problemas ves? (manchas, polvo blanco, amarilleo, insectos, etc.) 2) ¿Cuál es el problema más probable? 3) ¿Qué acción inmediata recomiendas? Responde solo en español.';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKeyInput.value.trim())}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'Error en la API de Gemini');
    }

    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      throw new Error('La IA no devolvió un análisis válido');
    }

    if (aiResultText) aiResultText.textContent = aiText;
    if (aiResultBox) aiResultBox.hidden = false;
    if (geminiStatus) geminiStatus.textContent = 'Análisis completado.';

    const lowerText = aiText.toLowerCase();
    if (lowerText.includes('polvo') || lowerText.includes('oídio') || lowerText.includes('oidio') || lowerText.includes('blanc')) {
      symptom = 'polvo';
    } else if (lowerText.includes('amarill') || lowerText.includes('clorosis') || lowerText.includes('nutri')) {
      symptom = 'amarilleo';
    } else if (lowerText.includes('insect') || lowerText.includes('pulg') || lowerText.includes('cochin') || lowerText.includes('plaga')) {
      symptom = 'insectos';
    } else {
      symptom = 'manchas';
    }

    document.querySelectorAll('.chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.value === symptom);
    });

    if (photoAnalysisResult) photoAnalysisResult = symptom;
  } catch (error) {
    if (aiResultBox) aiResultBox.hidden = true;
    if (geminiStatus) geminiStatus.textContent = `No se pudo analizar con IA: ${error.message}`;
    console.error('Error en análisis con Gemini:', error);
  }
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
  status.textContent = 'Enviando la foto a Pl@ntNet para identificar la especie.';
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
    status.textContent = `Especie detectada: ${plant.common ? plant.common + ' · ' : ''}${plant.scientific} · confianza ${confidence}%. Puedes corregirla en la lista si no coincide.`;
  } catch (error) {
    status.textContent = `No se pudo identificar la especie: ${error.message}.`;
  } finally {
    button.querySelector('span').textContent = 'Identificar especie en la foto';
    updateIdentifyButton();
  }
}

const diseaseBox = $('#diseaseResultBox');
const diseaseName = $('#diseaseName');
const diseaseConfidence = $('#diseaseConfidence');
const diseaseDescription = $('#diseaseDescription');

async function identifyDiseaseAutomatically() {
  if (!imageFile || !keyInput || !keyInput.value.trim()) {
    if (diseaseBox) diseaseBox.hidden = true;
    return;
  }

  try {
    const data = new FormData();
    data.append('images', imageFile, imageFile.name);
    data.append('organs', 'auto');
    const url = `https://my-api.plantnet.org/v2/diseases/identify?lang=es&api-key=${encodeURIComponent(keyInput.value.trim())}`;
    const response = await fetch(url, { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo analizar la enfermedad');
    const top = result.results?.[0];
    if (!top) throw new Error('No se detectó ninguna enfermedad o plaga con suficiente coincidencia');
    const readableName = await getReadableDiseaseName(top, keyInput.value.trim());
    const confidence = Math.round((top.score || 0) * 100);
    const categories = Array.isArray(top.categories) ? top.categories.join(', ') : '';
    diseaseName.textContent = readableName;
    diseaseConfidence.textContent = `Confianza: ${confidence}%${categories ? ' · Categoría: ' + categories : ''}`;
    diseaseDescription.textContent = 'Posible enfermedad o plaga detectada mediante análisis visual. Confirma el diagnóstico con un especialista antes de aplicar cualquier tratamiento.';
    diseaseBox.hidden = false;
  } catch (error) {
    diseaseBox.hidden = true;
    console.error('No se pudo identificar la enfermedad o plaga:', error);
  }
}

function isDiseaseCode(value) {
  return /^[A-Z0-9]{4,10}$/.test(value);
}

async function getReadableDiseaseName(result, apiKey) {
  const directName = result.description || result.label || result.disease?.label;
  if (directName && !isDiseaseCode(directName)) {
    return directName;
  }

  if (!diseaseCatalogPromise) {
    const url = `https://my-api.plantnet.org/v2/diseases?lang=es&api-key=${encodeURIComponent(apiKey)}`;
    diseaseCatalogPromise = fetch(url)
      .then(response => response.ok ? response.json() : [])
      .catch(() => []);
  }

  const catalog = await diseaseCatalogPromise;
  const catalogEntry = Array.isArray(catalog)
    ? catalog.find(item => item.name === result.name)
    : null;
  const catalogName = catalogEntry?.label || catalogEntry?.description;

  if (catalogName && !isDiseaseCode(catalogName)) {
    return catalogName;
  }

  return 'Posible enfermedad o plaga no identificada';
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

const geminiToggle = $('#geminiToggle');
const geminiContent = $('#geminiContent');

if (geminiToggle) {
  geminiToggle.addEventListener('click', () => {
    const expanded = geminiToggle.getAttribute('aria-expanded') === 'true';
    geminiToggle.setAttribute('aria-expanded', String(!expanded));
    geminiContent.hidden = expanded;
  });
}

const themeToggle = $('#themeToggle');
const themeIconLight = document.querySelector('.theme-icon-light');
const themeIconDark = document.querySelector('.theme-icon-dark');

function applyTheme(dark) {
  document.body.classList.toggle('dark-theme', dark);
  themeIconLight.hidden = dark;
  themeIconDark.hidden = !dark;
  localStorage.setItem('verdeTheme', dark ? 'dark' : 'light');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = dark ? '#0a1f17' : '#1b4d3c';
}

const savedTheme = localStorage.getItem('verdeTheme');
applyTheme(savedTheme === 'dark');

themeToggle.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark-theme'));
});

/* ──────────────────────────────────────────────────────────
   Mi casa — registro de plantas por estancias
   ────────────────────────────────────────────────────────── */

const SPACES = [
  { value: 'terraza',   label: 'Terraza',   icon: '☀' },
  { value: 'comedor',   label: 'Comedor',    icon: '◇' },
  { value: 'habitacion', label: 'Habitación', icon: '☾' },
  { value: 'cocina',    label: 'Cocina',     icon: '⌂' },
  { value: 'bano',      label: 'Baño',       icon: '≈' },
  { value: 'oficina',   label: 'Oficina',    icon: '▢' }
];

const PLANT_TYPES = {
  tropical:  { label: 'Tropical',      factor: 1.0  },
  suculenta: { label: 'Suculenta',     factor: 0.35 },
  cactus:    { label: 'Cactus',         factor: 0.20 },
  helecho:   { label: 'Helecho',       factor: 1.3  },
  flor:      { label: 'Planta con flor', factor: 0.9 },
  arbol:     { label: 'Árbol/arbusto', factor: 1.2  },
  huerto:    { label: 'Huerto',        factor: 1.1  },
  otra:      { label: 'Otra',          factor: 0.8  }
};

function getSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'primavera';
  if (month >= 6 && month <= 8) return 'verano';
  if (month >= 9 && month <= 11) return 'otonio';
  return 'invierno';
}

const SEASON_FACTORS = {
  primavera: 0.80,
  verano:    1.35,
  otonio:    0.65,
  invierno:  0.40
};

const SEASON_LABELS = {
  primavera: 'primavera',
  verano:    'verano',
  otonio:    'otoño',
  invierno:  'invierno'
};

function calculateWeeklyWater(diameterCm, plantType) {
  if (!diameterCm || diameterCm < 1) return 0;
  const radius = diameterCm / 2;
  const baseArea = Math.PI * radius * radius;
  const baseMl = baseArea * 0.6;
  const typeFactor = (PLANT_TYPES[plantType] || PLANT_TYPES.otra).factor;
  const seasonFactor = SEASON_FACTORS[getSeason()] || 1;
  const totalMl = baseMl * typeFactor * seasonFactor;
  return Math.round(totalMl / 10) * 10;
}

function formatWater(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${ml} ml`;
}

function getCasaPlants() {
  return JSON.parse(localStorage.getItem('verdeCasaPlants') || '[]');
}

function setCasaPlants(v) {
  localStorage.setItem('verdeCasaPlants', JSON.stringify(v));
}

const miCasaView = $('#miCasaView');
const mainShell = $('#mainShell');
const navCasa = $('#navCasa');
const navInicio = $('#navInicio');
const casaSpacesContainer = $('#casaSpaces');
const casaEmpty = $('#casaEmpty');
const casaModal = $('#casaModal');
const casaAddBtn = $('#casaAddBtn');
const casaBackBtn = $('#casaBackBtn');
const casaSaveBtn = $('#casaSaveBtn');
const casaPlantName = $('#casaPlantName');
const casaSpaceSelect = $('#casaSpace');
const casaDiameterInput = $('#casaDiameter');
const casaPlantTypeSelect = $('#casaPlantType');
const casaWaterPreview = $('#casaWaterPreview');
const casaWaterAmount = $('#casaWaterAmount');
const casaWaterDetail = $('#casaWaterDetail');

let casaEditingId = null;

function showView(view) {
  if (view === 'casa') {
    if (mainShell) mainShell.style.display = 'none';
    miCasaView.hidden = false;
    navInicio.classList.remove('active');
    navCasa.classList.add('active');
    renderCasa();
    window.scrollTo(0, 0);
  } else {
    miCasaView.hidden = true;
    if (mainShell) mainShell.style.display = '';
    navCasa.classList.remove('active');
    navInicio.classList.add('active');
  }
}

navCasa.addEventListener('click', () => showView('casa'));
casaBackBtn.addEventListener('click', () => showView('inicio'));

const casaBtn = $('#casaBtn');
if (casaBtn) {
  casaBtn.addEventListener('click', () => showView('casa'));
}

$('#saveToCasaBtn').addEventListener('click', () => {
  const plantSelect = $('#plant');
  const detectedName = plantSelect.options[plantSelect.selectedIndex].text;
  const cleanName = detectedName === 'Selecciona una planta' ? '' : detectedName;

  closeAllModals();

  casaEditingId = null;
  $('#casaModalTitle').textContent = 'Guardar en Mi casa';
  casaPlantName.value = cleanName;
  casaSpaceSelect.value = 'terraza';
  casaDiameterInput.value = '';
  casaPlantTypeSelect.value = 'tropical';
  casaWaterPreview.hidden = true;
  casaModal.hidden = false;
  document.body.style.overflow = 'hidden';
});

function updateCasaWaterPreview() {
  const diameter = parseFloat(casaDiameterInput.value);
  const plantType = casaPlantTypeSelect.value;
  if (diameter && diameter >= 5) {
    const ml = calculateWeeklyWater(diameter, plantType);
    casaWaterAmount.textContent = formatWater(ml) + ' / semana';
    casaWaterDetail.textContent = `Estimación para ${SEASON_LABELS[getSeason()]} en España · ${PLANT_TYPES[plantType].label.toLowerCase()}`;
    casaWaterPreview.hidden = false;
  } else {
    casaWaterPreview.hidden = true;
  }
}

casaDiameterInput.addEventListener('input', updateCasaWaterPreview);
casaPlantTypeSelect.addEventListener('change', updateCasaWaterPreview);

casaAddBtn.addEventListener('click', () => {
  casaEditingId = null;
  $('#casaModalTitle').textContent = 'Añadir planta';
  casaPlantName.value = '';
  casaSpaceSelect.value = 'terraza';
  casaDiameterInput.value = '';
  casaPlantTypeSelect.value = 'tropical';
  casaWaterPreview.hidden = true;
  open('casaModal');
});

casaSaveBtn.addEventListener('click', () => {
  const name = casaPlantName.value.trim();
  const space = casaSpaceSelect.value;
  const diameter = parseFloat(casaDiameterInput.value);
  const plantType = casaPlantTypeSelect.value;

  if (!name) {
    casaPlantName.focus();
    casaPlantName.placeholder = 'Ponle un nombre a tu planta';
    return;
  }
  if (!diameter || diameter < 5) {
    casaDiameterInput.focus();
    return;
  }

  const weeklyMl = calculateWeeklyWater(diameter, plantType);
  const plants = getCasaPlants();

  if (casaEditingId) {
    const idx = plants.findIndex(p => p.id === casaEditingId);
    if (idx >= 0) {
      plants[idx] = { ...plants[idx], name, space, diameter, plantType, weeklyMl };
    }
  } else {
    plants.push({
      id: Date.now(),
      name,
      space,
      diameter,
      plantType,
      weeklyMl,
      added: new Date().toLocaleDateString('es-ES')
    });
  }

  setCasaPlants(plants);
  close();
  renderCasa();
});

function renderCasa() {
  const plants = getCasaPlants();
  const usedSpaces = [...new Set(plants.map(p => p.space))];
  const allSpaces = SPACES.filter(s => usedSpaces.includes(s.value));

  casaEmpty.hidden = plants.length > 0;
  casaSpacesContainer.innerHTML = allSpaces.map(space => {
    const spacePlants = plants.filter(p => p.space === space.value);
    const totalMl = spacePlants.reduce((sum, p) => sum + (p.weeklyMl || 0), 0);
    return `
      <div class="casa-space">
        <div class="casa-space-header">
          <span class="casa-space-icon">${space.icon}</span>
          <h3>${space.label}</h3>
          <span class="casa-space-count">${spacePlants.length} ${spacePlants.length === 1 ? 'planta' : 'plantas'}</span>
        </div>
        <div class="casa-space-total">💧 ${formatWater(totalMl)} / semana en total</div>
        <div class="casa-plant-grid">
          ${spacePlants.map(p => `
            <article class="casa-plant-card" data-id="${p.id}">
              <div class="casa-plant-info">
                <b>${p.name}</b>
                <span class="casa-plant-type">${PLANT_TYPES[p.plantType]?.label || 'Planta'}</span>
                <span class="casa-plant-meta">Maceta ⌀ ${p.diameter} cm</span>
              </div>
              <div class="casa-plant-water">
                <span class="casa-plant-water-amount">${formatWater(p.weeklyMl)}</span>
                <span class="casa-plant-water-label">por semana</span>
              </div>
              <div class="casa-plant-actions">
                <button class="casa-edit-btn" data-id="${p.id}" aria-label="Editar planta">✎</button>
                <button class="casa-delete-btn" data-id="${p.id}" aria-label="Eliminar planta">✕</button>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.casa-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plant = getCasaPlants().find(p => p.id == btn.dataset.id);
      if (!plant) return;
      casaEditingId = plant.id;
      $('#casaModalTitle').textContent = 'Editar planta';
      casaPlantName.value = plant.name;
      casaSpaceSelect.value = plant.space;
      casaDiameterInput.value = plant.diameter;
      casaPlantTypeSelect.value = plant.plantType;
      updateCasaWaterPreview();
      open('casaModal');
    });
  });

  document.querySelectorAll('.casa-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plants = getCasaPlants().filter(p => p.id != btn.dataset.id);
      setCasaPlants(plants);
      renderCasa();
    });
  });
}
