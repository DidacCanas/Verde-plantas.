const $ = s => document.querySelector(s);
let symptom = 'manchas';
let installPrompt;
let imageFile;
let previewUrl;
let photoAnalysisResult = null;
let diseaseCatalogPromise = null;
let selectedInsects = new Set();
let cameraStream = null;

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeGetStorage(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch (e) {
    console.warn(`Error al leer localStorage[${key}]:`, e);
    return fallback;
  }
}

function safeSetStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn(`Error al guardar localStorage[${key}]:`, e);
  }
}

const db = {
  manchas: {name:'Mancha foliar (posible hongo)', icon:'◌', confidence:'Patrón compatible · confirmar de cerca', copy:'Las manchas suelen aparecer cuando las hojas permanecen húmedas o el aire circula poco. Retira las hojas muy afectadas y observa si las lesiones avanzan.', check:'Comprueba el reverso de las hojas y evita tratar si hay lluvia, mucho calor o viento.', steps:[['Hoy','Sanea y aísla','Retira hojas afectadas con tijeras limpias. No las compostes. Riega solo el sustrato.'],['Día 3','Tratamiento preventivo','Si el problema avanza, consulta un producto fungicida autorizado para tu planta (por ejemplo, cobre o bicarbonato potásico) y sigue estrictamente la etiqueta.'],['Día 10','Revisión y repetición','Revisa los brotes nuevos. Repite solo si la etiqueta del producto y el estado de la planta lo indican.']], prevent:['Riega a primera hora y siempre a nivel del sustrato.','Deja espacio entre plantas para que circule el aire.','Revisa hojas nuevas una vez a la semana y retira las caídas.']},
  polvo: {name:'Oídio (posible hongo)', icon:'◒', confidence:'Patrón compatible · confirmar de cerca', copy:'El aspecto blanquecino y pulverulento es compatible con oídio. Suele avanzar con humedad ambiental y ventilación limitada.', check:'No pulverices productos bajo sol directo. Verifica que el polvo no sea residuo de riego.', steps:[['Hoy','Poda suave y ventilación','Retira las hojas más cubiertas, limpia las herramientas y mejora la circulación de aire.'],['Día 3','Tratamiento indicado','Consulta un fungicida autorizado para oídio en este cultivo. Azufre o bicarbonato potásico son opciones habituales según el cultivo; respeta siempre etiqueta y plazo de seguridad.'],['Día 10','Control de progreso','Mira los brotes nuevos. Si siguen limpios, mantén cuidados; si reaparece, consulta el uso repetido indicado en la etiqueta.']], prevent:['Mantén la planta con buena ventilación y luz apropiada.','Evita exceso de abonado nitrogenado.','Inspecciona semanalmente los brotes tiernos.']},
  amarilleo: {name:'Estrés de riego o nutrición', icon:'◐', confidence:'Síntoma inespecífico · revisa raíces', copy:'El amarilleo puede deberse a exceso de riego, falta de luz o carencias. Antes de añadir productos, conviene descartar un sustrato encharcado.', check:'Toca el sustrato a 3–4 cm de profundidad y busca raíces oscuras o blandas antes de abonar.', steps:[['Hoy','Ajusta el riego','Riega solo cuando la capa superior esté seca y deja que el agua drene. Retira el agua acumulada del plato.'],['Día 5','Observa el crecimiento','Pon la planta en luz adecuada y comprueba si el amarilleo llega a hojas nuevas.'],['Día 12','Nutrición si procede','Solo si el riego está equilibrado, utiliza un abono equilibrado apto para la especie, a la dosis mínima indicada por el fabricante.']], prevent:['Usa macetas con drenaje y un sustrato adecuado.','No abones una planta débil o con raíces dañadas.','Adapta la frecuencia de riego a la estación.']},
  insectos: {name:'Plaga de insectos chupadores', icon:'◉', confidence:'Necesita confirmación visual', copy:'Pulgones, cochinillas o mosca blanca pueden deformar hojas y dejar melaza. Identificar el insecto concreto mejora mucho el tratamiento.', check:'Mira el envés de las hojas y los tallos. Aísla la planta mientras confirmas la plaga.', steps:[['Hoy','Retirada mecánica','Ducha suave sobre el envés o retira insectos con un paño húmedo. Aísla la planta y revisa las cercanas.'],['Día 3','Control dirigido','Para plagas leves, consulta jabón potásico o aceite de neem autorizados para tu cultivo. Aplica al atardecer y según la etiqueta.'],['Día 10','Revisión completa','Revisa brotes y envés. Repite solo según la etiqueta; si persiste, consulta un vivero o técnico.']], prevent:['Inspecciona el envés de las hojas al regar.','Aísla las plantas nuevas durante una o dos semanas.','Evita excesos de fertilizante que atraen brotes muy tiernos.']}
};

const insectDb = {
  pulgones: {
    name: 'Plaga de pulgones',
    icon: '●',
    confidence: 'Compatibilidad alta con pulgones · confirma con lupa',
    copy: 'Los pulgones son insectos pequeños (1-3 mm) que se agrupan en brotes tiernos y el envés de las hojas. Chupan la savia y dejan una melaza pegajosa que puede provocar hongos negros (negrilla).',
    check: 'Busca colonias en los brotes nuevos y bajo las hojas. La melaza pegajosa en hojas o suelo es una pista clave.',
    steps: [
      ['Hoy', 'Retirada y limpieza', 'Lava los brotes con agua a presión suave o frota con un paño húmedo. Retira hojas muy afectadas y aísla la planta.'],
      ['Día 2', 'Control biológico o jabón potásico', 'Aplica jabón potásico autorizado al atardecer, cubriendo bien el envés. Si prefieres control biológico, introduce mariquitas o crisopas si es posible.'],
      ['Día 7', 'Revisión y repetición', 'Revisa brotes nuevos. Repite el jabón si quedan colonias. Si la plaga es masiva, consulta un insecticida sistémico autorizado.']
    ],
    prevent: ['Revisa los brotes tiernos cada 3-4 días en primavera.', 'Evita exceso de nitrógeno que produce brotes muy suculentos.', 'Fomenta fauna auxiliar como mariquitas y crisopas.']
  },
  cochinillas: {
    name: 'Plaga de cochinillas',
    icon: '◐',
    confidence: 'Compatibilidad alta con cochinillas · confirma con lupa',
    copy: 'Las cochinillas aparecen como bultos blancos, marrones o algodonosos en tallos, nervios y envés de hojas. Son difíciles de ver como insectos porque suelen estar cubiertas de una capa protectora.',
    check: 'Rasca suavemente los bultos blancos: si se desprenden y hay un líquido amarillento o rosado, es cochinilla. Revisa uniones de hojas y tallos.',
    steps: [
      ['Hoy', 'Retirada manual', 'Retira las cochinillas con un bastoncillo empapado en alcohol o aceite. Lava la planta con agua y jabón suave. Aísla la planta.'],
      ['Día 3', 'Tratamiento con aceite de neem', 'Aplica aceite de neem autorizado al atardecer, cubriendo todos los bultos. Repite cada 7 días si es necesario.'],
      ['Día 14', 'Revisión profunda', 'Revisa tallos y envés. Las cochinillas pueden esconderse en oquedades. Si persiste, repite el tratamiento o consulta un profesional.']
    ],
    prevent: ['Inspecciona las uniones de hojas y tallos al regar.', 'Las cochinillas prefieren ambientes secos y con poca ventilación.', 'Mantén en cuarentena las plantas nuevas durante dos semanas antes de integrarlas.']
  },
  moscaBlanca: {
    name: 'Plaga de mosca blanca',
    icon: '○',
    confidence: 'Compatibilidad alta con mosca blanca · confirma visualmente',
    copy: 'La mosca blanca es una pequeña polilla blanca (1-2 mm) que se levanta al tocar la planta. Sus larvas se fijan en el envés y chupan la savia, debilitando la planta y transmitiendo virus.',
    check: 'Agita suavemente la planta: si vuelan pequeñas moscas blancas, confirma la plaga. Revisa el envés de las hojas para ver larvas.',
    steps: [
      ['Hoy', 'Trampas y limpieza', 'Coloca trampas cromáticas amarillas cerca de la planta. Lava el envés con agua o jabón potásico. Aísla la planta.'],
      ['Día 3', 'Aplicación de jabón potásico o neem', 'Aplica al atardecer cubriendo bien el envés. Repite cada 5-7 días, ya que las larvas son resistentes y eclosionan en oleadas.'],
      ['Día 14', 'Control continuo', 'La mosca blanca requiere constancia. Mantén las trampas y revisa cada semana. Si la plaga es severa, consulta un insecticida autorizado.']
    ],
    prevent: ['Coloca trampas amarillas desde primavera.', 'Revisa el envés de hojas nuevas semanalmente.', 'Evita el hacinamiento de plantas que dificulta la ventilación.']
  },
  arañaRoja: {
    name: 'Ácaro de la araña roja',
    icon: '◌',
    confidence: 'Compatibilidad alta con araña roja · confirma con lupa',
    copy: 'El ácaro de la araña roja es diminuto (0,5 mm) y difícil de ver a simple vista. Provoca puntos amarillos en las hojas, y en casos avanzados deja una fina telaraña en el envés. Prolifera en ambientes secos y calurosos.',
    check: 'Pasa un paño blanco por el envés: si hay puntos rojizos que se mueven, es araña roja. Busca telarañas finas entre las hojas.',
    steps: [
      ['Hoy', 'Aumentar humedad y limpieza', 'Pulveriza agua sobre el envés para aumentar la humedad (los ácaros la detestan). Lava las hojas afectadas. Aísla la planta.'],
      ['Día 2', 'Aceite de neem o acaricida autorizado', 'Aplica aceite de neem o un acaricida específico autorizado al atardecer. Cubre bien el envés, donde se esconden los ácaros.'],
      ['Día 7', 'Repetición obligatoria', 'Los huevos sobreviven al tratamiento. Repite a los 7 días para eliminar las nuevas eclosiones. Mantén la humedad alta.']
    ],
    prevent: ['Pulveriza agua en el envés en tiempo seco y caluroso.', 'Mantén la humedad ambiental por encima del 50%.', 'Revisa el envés de las hojas en verano cada pocos días.']
  },
  trips: {
    name: 'Plaga de trips',
    icon: '▹',
    confidence: 'Compatibilidad alta con trips · confirma con lupa',
    copy: 'Los trips son insectos muy finos (1-2 mm) que raspan la superficie de las hojas y absorben los jugos. Provocan manchas plateadas brillantes y puntos negros (sus excrementos) en hojas y flores.',
    check: 'Busca manchas plateadas y puntos negros en hojas y flores. Los trips son muy móviles y saltan al ser molestados.',
    steps: [
      ['Hoy', 'Limpieza y trampas azules', 'Lava las hojas afectadas con agua. Coloca trampas cromáticas azules, que atraen específicamente a los trips. Aísla la planta.'],
      ['Día 3', 'Jabón potásico o aceite de neem', 'Aplica al atardecer cubriendo bien flores y envés. Repite cada 5 días, ya que los trips tienen ciclo rápido y resisten en el sustrato.'],
      ['Día 12', 'Revisión y control del sustrato', 'Algunas larvas caen al sustrato. Retira hojas caídas y mantén el sustrato limpio. Si persiste, consulta un insecticida autorizado.']
    ],
    prevent: ['Coloca trampas azules desde primavera.', 'Retira hojas y flores caídas del sustrato.', 'Revisa flores y hojas jóvenes cada semana.']
  },
  minadores: {
    name: 'Plaga de minadores',
    icon: '≈',
    confidence: 'Compatibilidad alta con minadores · confirma visualmente',
    copy: 'Los minadores son larvas de pequeñas moscas que se introducen dentro de las hojas y excavan galerías sinuosas, dejando un camino visible en la superficie. La larva está dentro de la hoja, protegida.',
    check: 'Busca líneas sinuosas o zonas transparentes dentro de las hojas. Si ves el final de la galería, puede haber una larva o pupa visible.',
    steps: [
      ['Hoy', 'Retirada de hojas afectadas', 'Corta y destruye las hojas con galerías. No las compostes. Aísla la planta y revisa las cercanas.'],
      ['Día 5', 'Control del sustrato', 'Las larvas caen al sustrato para pupar. Cubre el sustrato con una capa de arena fina o retira hojas caídas para interrumpir el ciclo.'],
      ['Día 14', 'Revisión de nuevas galerías', 'Revisa hojas nuevas. Si aparecen galerías, repite la retirada de hojas. En casos severos, consulta un insecticida sistémico autorizado.']
    ],
    prevent: ['Retira rápidamente las hojas con galerías.', 'Mantén el sustrato limpio de hojas caídas.', 'Inspecciona hojas nuevas cada semana en primavera y otoño.']
  }
};

function selectedData(){
  if (symptom === 'insectos' && selectedInsects.size > 0) {
    return buildMultiInsectDiagnosis();
  }
  return db[symptom];
}

function buildMultiInsectDiagnosis() {
  const insects = [...selectedInsects];
  if (insects.length === 1) {
    return insectDb[insects[0]];
  }
  const names = insects.map(k => insectDb[k].name.replace('Plaga de ', '').replace('Ácaro de la ', ''));
  const combined = {
    name: `Plaga combinada: ${names.join(' + ')}`,
    icon: '◉',
    confidence: 'Múltiples plagas detectadas · requiere atención urgente',
    copy: `Se han identificado varios tipos de insectos: ${names.join(', ')}. Las plagas combinadas son más difíciles de controlar y pueden debilitar la planta rápidamente. Es importante actuar de forma coordinada.`,
    check: 'Revisa cada tipo de plaga por separado. Prioriza el control mecánico (retirada manual) antes de aplicar productos, y respeta los plazos de seguridad entre tratamientos.',
    steps: [
      ['Hoy', 'Retirada mecánica general', 'Lava la planta con agua suave cubriendo envés y tallos. Retira manualmente insectos visibles y bultos. Aísla la planta de forma inmediata.'],
      ['Día 2', 'Tratamiento combinado autorizado', 'Aplica jabón potásico o aceite de neem al atardecer, cubriendo toda la planta. Estos productos son compatibles con la mayoría de plagas listadas. Respeta la etiqueta.'],
      ['Día 7', 'Revisión por tipo de plaga', 'Revisa cada insecto por separado: pulgones en brotes, cochinillas en tallos, mosca en envés. Repite el tratamiento donde persista la plaga.']
    ],
    prevent: ['Inspecciona el envés de las hojas y los tallos cada 3-4 días.', 'Aísla las plantas nuevas durante al menos dos semanas.', 'Fomenta fauna auxiliar (mariquitas, crisopas) para control natural.']
  };
  return combined;
}

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
  casaEditingId = null;
  const casaErrorMsg = $('#casaErrorMsg');
  if (casaErrorMsg) casaErrorMsg.hidden = true;
}

function openModal(id){
  closeAllModals();
  if (id === 'historyModal') renderHistory();
  const el = $('#' + id);
  if (el) el.hidden = false;
  document.body.style.overflow = 'hidden';
}

function open(id){
  openModal(id);
}

function closeModal(){
  closeAllModals();
}

document.querySelectorAll('.chip').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    symptom = b.dataset.value;
    updateInsectSelector();
  })
);

document.querySelectorAll('.species-pills [data-plant]').forEach(button => {
  button.addEventListener('click', () => {
    const select = $('#plant');
    if (!select) return;
    select.value = button.dataset.plant || '';
    document.querySelectorAll('.species-pills [data-plant]').forEach(item => {
      item.classList.toggle('selected', item === button);
    });
  });
});

function updateInsectSelector() {
  const selector = $('#insectSelector');
  if (!selector) return;
  if (symptom === 'insectos') {
    selector.hidden = false;
  } else {
    selector.hidden = true;
    selectedInsects.clear();
    document.querySelectorAll('#insectSelector input[type="checkbox"]').forEach(cb => cb.checked = false);
  }
}

document.querySelectorAll('#insectSelector input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) {
      selectedInsects.add(cb.value);
    } else {
      selectedInsects.delete(cb.value);
    }
  });
});

/* ── Cámara directa con getUserMedia ── */
const photoInput = $('#photoInput');
const cameraVideo = $('#cameraStream');
const cameraCanvas = $('#cameraCanvas');
const cameraControls = $('#cameraControls');
const captureBtn = $('#captureBtn');
const cancelCameraBtn = $('#cancelCameraBtn');
const cameraButton = document.querySelector('.camera-button');
const photoPlaceholder = $('#photoPlaceholder');
const photoArea = document.querySelector('.photo-area');

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    cameraVideo.hidden = false;
    cameraControls.hidden = false;
    if (cameraButton) cameraButton.style.display = 'none';
    if (photoPlaceholder) photoPlaceholder.style.display = 'none';
    const preview = $('#preview');
    if (preview) preview.hidden = true;
  } catch (err) {
    console.warn('No se pudo abrir la cámara directamente, usando selector de archivo:', err);
    if (photoInput) photoInput.click();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraVideo.hidden = true;
  cameraControls.hidden = true;
  if (cameraButton) cameraButton.style.display = '';
  if (imageFile) {
    const preview = $('#preview');
    if (preview) preview.hidden = false;
    if (photoPlaceholder) photoPlaceholder.style.display = 'none';
  } else {
    if (photoPlaceholder) photoPlaceholder.style.display = '';
  }
}

if (cameraButton) {
  cameraButton.addEventListener('click', (e) => {
    e.preventDefault();
    startCamera();
  });
}

if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    if (!cameraStream) return;
    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    if (!vw || !vh) return;
    cameraCanvas.width = vw;
    cameraCanvas.height = vh;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, vw, vh);
    cameraCanvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      handlePhotoFile(file);
    }, 'image/jpeg', 0.9);
  });
}

if (cancelCameraBtn) {
  cancelCameraBtn.addEventListener('click', stopCamera);
}

async function handlePhotoFile(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    $('#photoAnalysisStatus').textContent = 'Selecciona una imagen válida.';
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    $('#photoAnalysisStatus').textContent = 'La imagen es demasiado grande. Máximo recomendado: 8 MB.';
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);

  imageFile = file;
  previewUrl = URL.createObjectURL(file);

  const image = $('#preview');
  image.src = previewUrl;
  image.hidden = false;

  $('#photoPlaceholder').hidden = true;

  $('#photoAnalysisStatus').textContent = 'Foto recibida. Analizando síntomas…';

  await analyzePhotoLocally();

  updateIdentifyButton();

  identifySpeciesAutomatically();
  identifyDiseaseAutomatically();
  analyzeWithGemini();
}

$('#photoInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  await handlePhotoFile(file);
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
    updateInsectSelector();

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
    updateIdentifyButton();
  });
}

const analyzeGeminiBtn = $('#analyzeGeminiBtn');
if (analyzeGeminiBtn) {
  analyzeGeminiBtn.addEventListener('click', () => {
    analyzeWithGemini();
  });
}

function updateIdentifyButton() {
  const button = $('#identifySpeciesBtn');
  if (button && keyInput) {
    button.disabled = !(imageFile && keyInput.value.trim());
  }

  const geminiBtn = $('#analyzeGeminiBtn');
  if (geminiBtn && geminiKeyInput) {
    geminiBtn.disabled = !(imageFile && geminiKeyInput.value.trim());
  }
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
    updateInsectSelector();

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
  b.addEventListener('click', closeModal)
);

document.querySelectorAll('.modal-backdrop').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) closeModal(); })
);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

$('#historyBtn').addEventListener('click', () => openModal('historyModal'));
$('#openHistory').addEventListener('click', () => openModal('historyModal'));

function getPlans(){ return safeGetStorage('verdePlans', []); }
function setPlans(v){ safeSetStorage('verdePlans', v); }

$('#savePlanBtn').addEventListener('click', () => {
  const d = selectedData();
  const selectEl = $('#plant');
  const rawPlant = selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex]?.text : '';
  const plantName = (!rawPlant || rawPlant === 'Selecciona una planta') ? 'Planta sin especificar' : rawPlant;

  const p = {
    id: Date.now(),
    name: d.name,
    plant: plantName,
    date: new Date().toLocaleDateString('es-ES'),
    steps: d.steps,
    done: []
  };
  const plans = getPlans();
  plans.unshift(p);
  setPlans(plans);
  closeModal();
  renderTasks();
  const todaySec = $('#todaySection');
  if (todaySec) todaySec.scrollIntoView({ behavior: 'smooth' });
});

function renderTasks(){
  const plans = getPlans(), list = $('#taskList'), empty = $('#emptyState');
  if (!list || !empty) return;

  const tasks = plans.flatMap(p => (p.steps || []).map((s, i) => ({
    planId: p.id,
    plant: p.plant || 'Planta sin especificar',
    diagnosis: p.name || 'Diagnóstico',
    step: s,
    stepIndex: i,
    isDone: Array.isArray(p.done) && p.done.includes(i)
  })));

  const undone = tasks.filter(t => !t.isDone);
  const countEl = $('#todayCount');
  if (countEl) {
    countEl.textContent = `${undone.length} ${undone.length === 1 ? 'tarea' : 'tareas'}`;
  }

  if (plans.length === 0) {
    empty.hidden = false;
    empty.innerHTML = '<span class="empty-icon material-symbols-outlined">water_drop</span><b>Todo en orden por ahora</b><p>Todavía no tienes tareas pendientes para hoy. Guarda un plan de cuidados después de analizar tu planta para activar recordatorios inteligentes de riego y poda.</p><button type="button" onclick="document.getElementById(\'camera-module\').scrollIntoView({behavior:\'smooth\'})"><span class="material-symbols-outlined">add_a_photo</span> Comenzar escaneo</button>';
  } else if (undone.length === 0) {
    empty.hidden = false;
    empty.innerHTML = '<span class="empty-icon material-symbols-outlined">check_circle</span><b>Cuidados completados</b><p>Has terminado todas las tareas de cuidados pendientes.</p>';
  } else {
    empty.hidden = true;
  }

  list.innerHTML = undone.map(t =>
    `<article class="task"><button class="task-check" data-id="${t.planId}" data-step="${t.stepIndex}" aria-label="Marcar como realizada"></button><div class="task-copy"><b>${escapeHtml(t.step[1])}</b><span>${escapeHtml(t.plant)} · ${escapeHtml(t.diagnosis)}</span></div><span class="task-day">${escapeHtml(t.step[0])}</span></article>`
  ).join('');

  document.querySelectorAll('.task-check').forEach(b =>
    b.addEventListener('click', () => {
      let all = getPlans();
      let p = all.find(x => x.id == b.dataset.id);
      if (!p) return;
      let i = +b.dataset.step;
      if (!Array.isArray(p.done)) p.done = [];
      p.done.includes(i) ? p.done = p.done.filter(x => x !== i) : p.done.push(i);
      setPlans(all);
      renderTasks();
    })
  );

  const dot = $('#historyDot');
  if (dot) dot.classList.toggle('show', plans.length > 0);
}

function renderHistory(){
  const p = getPlans(), h = $('#historyList'), clearBtn = $('#clearHistoryBtn');
  if (clearBtn) clearBtn.hidden = p.length === 0;
  if (!h) return;

  if (!p.length) {
    h.innerHTML = '<p class="no-history">Todavía no has guardado ninguna revisión.</p>';
    return;
  }

  h.innerHTML = p.map(x => `
    <div class="history-item">
      <div class="history-icon">⌁</div>
      <div class="history-content">
        <b>${escapeHtml(x.name)}</b>
        <span>${escapeHtml(x.plant)} · guardado el ${escapeHtml(x.date)} · ${(x.done || []).length}/${(x.steps || []).length} tareas</span>
      </div>
      <button class="history-delete-btn" data-id="${x.id}" aria-label="Eliminar del historial">✕</button>
    </div>
  `).join('');

  document.querySelectorAll('.history-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plans = getPlans().filter(item => item.id != btn.dataset.id);
      setPlans(plans);
      renderHistory();
      renderTasks();
    });
  });
}

const clearHistoryBtn = $('#clearHistoryBtn');
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('¿Deseas borrar todo el historial y sus tareas?')) {
      setPlans([]);
      renderHistory();
      renderTasks();
    }
  });
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
  if (metaTheme) metaTheme.content = dark ? '#0a1f17' : '#032517';
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
  return safeGetStorage('verdeCasaPlants', []);
}

function setCasaPlants(v) {
  safeSetStorage('verdeCasaPlants', v);
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
  stopCamera();
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
navInicio.addEventListener('click', () => showView('inicio'));
casaBackBtn.addEventListener('click', () => showView('inicio'));

const casaBtn = $('#casaBtn');
if (casaBtn) {
  casaBtn.addEventListener('click', () => showView('casa'));
}

$('#saveToCasaBtn').addEventListener('click', () => {
  const plantSelect = $('#plant');
  const detectedName = plantSelect.selectedIndex >= 0 ? plantSelect.options[plantSelect.selectedIndex]?.text : '';
  const cleanName = (detectedName === 'Selecciona una planta' || detectedName === 'Planta sin especificar') ? '' : detectedName;

  closeModal();

  casaEditingId = null;
  $('#casaModalTitle').textContent = 'Guardar en Mi casa';
  casaPlantName.value = cleanName;
  casaSpaceSelect.value = 'terraza';
  casaDiameterInput.value = '';
  casaPlantTypeSelect.value = 'tropical';
  casaWaterPreview.hidden = true;
  const errMsg = $('#casaErrorMsg');
  if (errMsg) errMsg.hidden = true;
  openModal('casaModal');
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
  const errMsg = $('#casaErrorMsg');
  if (errMsg) errMsg.hidden = true;
  openModal('casaModal');
});

casaSaveBtn.addEventListener('click', () => {
  const name = casaPlantName.value.trim();
  const space = casaSpaceSelect.value;
  const diameter = parseFloat(casaDiameterInput.value);
  const plantType = casaPlantTypeSelect.value;
  const errMsg = $('#casaErrorMsg');

  if (!name) {
    if (errMsg) {
      errMsg.textContent = 'Por favor, ponle un nombre a tu planta.';
      errMsg.hidden = false;
    }
    casaPlantName.focus();
    return;
  }
  if (!diameter || diameter < 5 || isNaN(diameter)) {
    if (errMsg) {
      errMsg.textContent = 'Introduce un diámetro de maceta válido (mínimo 5 cm).';
      errMsg.hidden = false;
    }
    casaDiameterInput.focus();
    return;
  }
  if (errMsg) errMsg.hidden = true;

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
  closeModal();
  renderCasa();
});

function renderCasa() {
  const plants = getCasaPlants();
  const usedSpaces = [...new Set(plants.map(p => p.space || 'terraza'))];
  const allSpaces = SPACES.filter(s => usedSpaces.includes(s.value));
  const unknownSpaces = usedSpaces.filter(u => !SPACES.some(s => s.value === u));
  if (unknownSpaces.length > 0) {
    allSpaces.push({ value: 'otros', label: 'Otros espacios', icon: '✦' });
  }

  casaEmpty.hidden = plants.length > 0;
  casaSpacesContainer.innerHTML = allSpaces.map(space => {
    const spacePlants = plants.filter(p => (p.space === space.value) || (space.value === 'otros' && !SPACES.some(s => s.value === p.space)));
    const totalMl = spacePlants.reduce((sum, p) => sum + (p.weeklyMl || 0), 0);
    return `
      <div class="casa-space">
        <div class="casa-space-header">
          <span class="casa-space-icon">${space.icon}</span>
          <h3>${escapeHtml(space.label)}</h3>
          <span class="casa-space-count">${spacePlants.length} ${spacePlants.length === 1 ? 'planta' : 'plantas'}</span>
        </div>
        <div class="casa-space-total">💧 ${formatWater(totalMl)} / semana en total</div>
        <div class="casa-plant-grid">
          ${spacePlants.map(p => `
            <article class="casa-plant-card" data-id="${p.id}">
              <div class="casa-plant-info">
                <b>${escapeHtml(p.name)}</b>
                <span class="casa-plant-type">${escapeHtml(PLANT_TYPES[p.plantType]?.label || 'Planta')}</span>
                <span class="casa-plant-meta">Maceta ⌀ ${escapeHtml(String(p.diameter))} cm</span>
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
      const errMsg = $('#casaErrorMsg');
      if (errMsg) errMsg.hidden = true;
      updateCasaWaterPreview();
      openModal('casaModal');
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
