/* AI-assisted tests for reversible scene exploration. */
const test=require('node:test'), assert=require('node:assert/strict');
const {SceneHistory}=require('../js/scene-history.js');
const {SceneState}=require('../js/scene-state.js');
const {WaveField}=require('../js/wave-field.js');
function fixture(limit=30) {
  let state={sources:[{id:1,nx:.3,ny:.5}],spacing:.18,selectedId:1};
  const history=new SceneHistory(()=>state, value=>{state=value;},()=>{},limit);
  return {history,get:()=>state};
}
test('a long drag is one undo step and redo restores its end',()=>{
  const {history,get}=fixture(); history.begin('Move source');
  for(let i=0;i<40;i++){history.begin('Move source');get().sources[0].nx+=.01;}
  history.commit();assert.equal(history.status().undoCount,1);
  const end=get().sources[0].nx;
  history.undo();assert.equal(get().sources[0].nx,.3);
  history.redo();assert.equal(get().sources[0].nx,end);
});
test('editing after undo discards the old redo branch',()=>{
  const {history,get}=fixture();history.perform('Move',()=>{get().sources[0].nx=.6;});
  history.undo();history.perform('Spacing',()=>{get().spacing=.25;});
  assert.equal(history.status().redoCount,0);history.redo();assert.equal(get().spacing,.25);
});
test('selection and no-op gestures do not add artwork edits',()=>{
  const {history,get}=fixture();history.begin('Select');get().selectedId=2;history.commit();
  history.perform('No change',()=>{});assert.equal(history.status().undoCount,0);
});
test('history is capped and does not retain live references',()=>{
  const {history,get}=fixture();
  for(let i=1;i<=35;i++) history.perform('Move',()=>{get().sources[0].nx=i/100;});
  assert.equal(history.status().undoCount,30);
  for(let i=0;i<31;i++) history.undo();assert.equal(get().sources[0].nx,.05);
  get().sources[0].nx=.9; history.redo(); assert.equal(get().sources[0].nx,.06);
});
test('undo finalises a still-open slider edit before reverting it',()=>{
  const {history,get}=fixture();history.begin('Spacing');get().spacing=.27;
  history.undo();assert.equal(get().spacing,.18);assert.equal(history.status().redoCount,1);
});
test('snapshot restore keeps source IDs, phase and seeded settings',()=>{
  const field=new WaveField();field.restore();
  const flow={seed:7321,amount:.28,reseed(seed){this.seed=seed;}};
  const saved=SceneState.capture(field,flow,2);
  const before=field.sample(200,170,1,800,600);
  field.sources[0].nx=.9;field.sources[0].reversePhase();field.spacing=.3;
  flow.seed=5;flow.amount=1;
  SceneState.apply(saved,field,flow);
  assert.equal(field.sample(200,170,1,800,600),before);
  assert.deepEqual(SceneState.capture(field,flow,2),saved);
  assert.equal(field.addSource(.2,.2).id,3);
});
