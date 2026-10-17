/* CHARTVOLT PATCH (14 Oct 2026, owner: "any game menu setting the user selects is saved and used when
 * playing the game so it doesn't need to redo it every time"). Graphics and sound settings were reset
 * on every visit; the controls, camera, racing line, vibration and coach already had their own keys
 * and are deliberately not listed here, so each setting has exactly one owner. */

const PREFIX = 'cv-setting:';

/** Every remembered control, by element id. A checkbox stores 'on'/'off', anything else its value. */
export const REMEMBERED_SETTINGS = Object.freeze([
  'quality', 'bloom', 'reduced', 'atmosphere', 'skyQuality', 'cloudQuality', 'shadowQuality',
  'textureQuality', 'reflectionQuality', 'musicVolume', 'sfxVolume', 'muteMusic', 'muteSounds', 'soundtrack',
]);

// Reason: localStorage THROWS (rather than returning null) when a browser refuses storage, and an
// unwrapped read here would stop the whole game from loading in exactly those privacy settings.
function storageOf(storage) {
  return {
    get(k) { try { return storage ? storage.getItem(k) : localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { (storage || localStorage).setItem(k, v); } catch { /* simply not remembered */ } },
  };
}

/** The render-quality list can hold a per-device ratio added at runtime, so a sane number is accepted. */
const isRenderRatio = v => /^\d+(\.\d+)?$/.test(v) && Number(v) >= 0.5 && Number(v) <= 3;

/** Applies one stored value to its control. Returns false when the value is not a valid choice. */
export function applyStoredValue(el, raw) {
  if (!el || raw === null || raw === undefined) return false;
  if (el.type === 'checkbox') {
    if (raw !== 'on' && raw !== 'off') return false;
    el.checked = raw === 'on';
    return true;
  }
  if (el.type === 'range') {
    const n = Number(raw), min = Number(el.min || 0), max = Number(el.max || 1);
    if (raw === '' || !Number.isFinite(n) || n < min || n > max) return false;
    el.value = String(n);
    return true;
  }
  if (el.tagName === 'SELECT') {
    const options = [...el.options];
    if (!options.some(o => o.value === raw)) {
      if (el.id !== 'quality' || !isRenderRatio(raw)) return false;
      el.add(new Option(`${raw}x - this device`, raw));
    }
    el.value = raw;
    return true;
  }
  return false;
}

/** Restores every remembered setting into the menu. Returns the ids that were restored. */
export function restoreSettings(doc = document, storage) {
  const store = storageOf(storage), restored = [];
  for (const id of REMEMBERED_SETTINGS) {
    if (applyStoredValue(doc.getElementById(id), store.get(PREFIX + id))) restored.push(id);
  }
  return restored;
}

/** Saves each remembered setting whenever the player changes it. */
export function rememberSettings(doc = document, storage) {
  const store = storageOf(storage);
  for (const id of REMEMBERED_SETTINGS) {
    const el = doc.getElementById(id);
    if (!el) continue;
    const save = () => store.set(PREFIX + id, el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value);
    el.addEventListener('change', save);
    if (el.type === 'range') el.addEventListener('input', save);
  }
}

/** True when the player has a saved choice for this setting, so a device default must not replace it. */
export function hasSavedSetting(id, storage) {
  return storageOf(storage).get(PREFIX + id) !== null;
}
