/*
 * Verde Data Layer
 * Encapsula todo el acceso a localStorage para que el resto
 * de la aplicación no necesite saber dónde ni cómo se almacenan los datos.
 * En el futuro la implementación interna puede sustituirse por Supabase
 * sin cambiar la interfaz pública.
 */

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

const VerdeData = {
  getPlans() {
    return safeGetStorage('verdePlans', []);
  },

  setPlans(plans) {
    safeSetStorage('verdePlans', plans);
  },

  getCasaPlants() {
    return safeGetStorage('verdeCasaPlants', []);
  },

  setCasaPlants(plants) {
    safeSetStorage('verdeCasaPlants', plants);
  },

  getTheme() {
    return localStorage.getItem('verdeTheme') || 'light';
  },

  setTheme(theme) {
    localStorage.setItem('verdeTheme', theme);
  },

  getPlantNetApiKey() {
    return localStorage.getItem('plantnetApiKey') || '';
  },

  setPlantNetApiKey(key) {
    localStorage.setItem('plantnetApiKey', key);
  },

  getGeminiApiKey() {
    return localStorage.getItem('geminiApiKey') || '';
  },

  setGeminiApiKey(key) {
    localStorage.setItem('geminiApiKey', key);
  }
};
