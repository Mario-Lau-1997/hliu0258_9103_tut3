/* AI assistance: ChatGPT/Codex helped separate scene data from rendering state.
 * This small plain-data snapshot can be copied without retaining object aliases.
 */
class SceneState {
  static capture(field, flow, selectedId) {
    return {sources: field.sources.map(({id,nx,ny,amplitude,phase}) => ({id,nx,ny,amplitude,phase})),
      nextId: field.nextId, spacing: field.spacing, seed: flow.seed, drift: flow.amount, selectedId};
  }
  static apply(state, field, flow) {
    field.sources = []; field.nextId = 1;
    for (const saved of state.sources) {
      const source = field.addSource(saved.nx, saved.ny, saved.amplitude, saved.phase);
      source.id = saved.id;
    }
    field.nextId = state.nextId; field.spacing = state.spacing;
    flow.reseed(state.seed); flow.amount = state.drift;
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = {SceneState};
