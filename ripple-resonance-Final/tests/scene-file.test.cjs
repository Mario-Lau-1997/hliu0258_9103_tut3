/* Tests: corrupt files must be rejected before state is applied. */
const test=require('node:test'),assert=require('node:assert/strict');
const {SceneFile}=require('../js/scene-file.js');
function scene() {return {sources:[{id:2,nx:.4,ny:.6,amplitude:.85,phase:Math.PI}],nextId:3,spacing:.18,seed:7321,drift:.28,selectedId:2};}
function wrap(s=scene()){return {format:'ripple-resonance',version:1,scene:s};}
test('saved settings round trip without changing phase or source IDs',()=>{
  assert.deepEqual(SceneFile.parse(SceneFile.stringify(scene())),scene());
});
test('zero-source scenes and valid boundary values can round trip',()=>{
  const s=scene();s.sources=[];s.selectedId=null;s.seed=0;s.drift=0;s.spacing=.11;
  assert.deepEqual(SceneFile.parse(SceneFile.stringify(s)),s);
  const b=scene();Object.assign(b.sources[0],{nx:.025,ny:.975,amplitude:1.6});b.spacing=.3;b.drift=1;
  assert.deepEqual(SceneFile.parse(SceneFile.stringify(b)),b);
});
test('malformed JSON and unsupported file versions are rejected',()=>{
  for(const text of ['{bad','null','[]','{"version":2}','{}']) assert.throws(()=>SceneFile.parse(text));
  const data=wrap();data.version=2;assert.throws(()=>SceneFile.parse(JSON.stringify(data)));
});
test('invalid numerical settings and source fields are rejected',()=>{
  for(const [key,value] of [['spacing',0],['spacing',1],['seed',-1],['seed',1.5],['drift',2],['nextId',2],['selectedId',6]]){
    const s=scene();s[key]=value;assert.throws(()=>SceneFile.validate(wrap(s)),key);
  }
  for(const [key,value] of [['nx',NaN],['ny',Infinity],['nx',-1],['amplitude',0],['phase',1],['id','2']]){
    const s=scene();s.sources[0][key]=value;assert.throws(()=>SceneFile.validate(wrap(s)),key);
  }
});
test('too many sources and duplicate IDs are rejected',()=>{
  const s=scene();s.sources.push({...s.sources[0]});assert.throws(()=>SceneFile.validate(wrap(s)));
  s.sources=Array.from({length:7},(_,i)=>({...s.sources[0],id:i+1}));s.nextId=8;
  assert.throws(()=>SceneFile.validate(wrap(s)));
});
test('large files are rejected before reading their bytes',async()=>{
  let read=false;
  await assert.rejects(SceneFile.read({size:65537,text:async()=>{read=true;return '{}';}}));
  assert.equal(read,false);assert.throws(()=>SceneFile.parse(' '.repeat(65537)));
  assert.throws(()=>SceneFile.parse('界'.repeat(22000)));
});
test('extra JSON fields are discarded and snapshots are independent',()=>{
  const data=wrap();data.scene.unexpected='<script>anything</script>';data.scene.sources[0].other=5;
  const clean=SceneFile.validate(data);assert.deepEqual(clean,scene());
  data.scene.sources[0].nx=.9;assert.equal(clean.sources[0].nx,.4);
});

test('the two example files demonstrate reinforcement and cancellation',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const {SceneState}=require('../js/scene-state.js'),{WaveField}=require('../js/wave-field.js');
  const flow={reseed(seed){this.seed=seed;}};
  const sample=name=>{
    const settings=SceneFile.parse(fs.readFileSync(path.join(__dirname,'../examples',name),'utf8'));
    const field=new WaveField();SceneState.apply(settings,field,flow);
    return field.sample(130,170,1,800,600);
  };
  assert.ok(Math.abs(sample('01-reinforcement.json'))>.01);
  assert.ok(Math.abs(sample('02-cancellation.json'))<1e-12);
});
