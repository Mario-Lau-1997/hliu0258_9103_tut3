/*
 * Files store plain settings, never executable code or particle trails.
 * File/Blob text(): https://developer.mozilla.org/en-US/docs/Web/API/Blob/text
 * Downloads: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
 */
class SceneFile {
  static MAX_BYTES = 64 * 1024;
  static validate(data) {
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    const integer = (value, min, max) => Number.isInteger(value) && number(value, min, max);
    if (!object(data) || data.format !== 'ripple-resonance' || data.version !== 1) {
      throw new Error('Choose a Ripple scene file with version 1.');
    }
    const scene = data.scene;
    if (!object(scene) || !Array.isArray(scene.sources) || scene.sources.length > 6) {
      throw new Error('The scene must contain between zero and six sources.');
    }
    const ids = new Set();
    const sources = scene.sources.map(source => {
      if (!object(source) || !integer(source.id,1,999999999) || ids.has(source.id) ||
          !number(source.nx,.025,.975) || !number(source.ny,.025,.975) ||
          !number(source.amplitude,.25,1.6) || ![0,Math.PI].includes(source.phase)) {
        throw new Error('A source has an invalid position, strength, phase or ID.');
      }
      ids.add(source.id);
      return {id:source.id,nx:source.nx,ny:source.ny,amplitude:source.amplitude,phase:source.phase};
    });
    if (!number(scene.spacing,.11,.30) || !number(scene.drift,0,1) ||
        !integer(scene.seed,0,99999) || !integer(scene.nextId,1,1000000000) ||
        scene.nextId <= Math.max(0,...ids)) {
      throw new Error('Wave spacing, drift, seed or the next source ID is outside its allowed range.');
    }
    if (sources.length ? !ids.has(scene.selectedId) : scene.selectedId !== null) {
      throw new Error('The selected source does not match the scene.');
    }
    // Copy only known fields. Extra JSON keys never enter the artwork state.
    return {sources,nextId:scene.nextId,spacing:scene.spacing,seed:scene.seed,drift:scene.drift,selectedId:scene.selectedId};
  }
  static parse(text) {
    if (typeof text !== 'string' || text.length > this.MAX_BYTES || new TextEncoder().encode(text).length > this.MAX_BYTES) {
      throw new Error('Scene files must be 64 KB or smaller.');
    }
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('This file is not valid JSON.'); }
    return this.validate(data);
  }
  static stringify(scene) {
    const data = {format:'ripple-resonance',version:1,scene};
    data.scene = this.validate(data);
    return JSON.stringify(data,null,2) + '\n';
  }
  static async read(file) {
    if (file.size > this.MAX_BYTES) throw new Error('Scene files must be 64 KB or smaller.');
    return this.parse(await file.text());
  }
  static download(scene) {
    const url = URL.createObjectURL(new Blob([this.stringify(scene)],{type:'application/json'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'ripple-resonance-scene.json';
    document.body.append(link); link.click(); link.remove();
    // Give the browser time to start the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = {SceneFile};
