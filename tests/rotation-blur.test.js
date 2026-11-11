import test from 'node:test';
import assert from 'node:assert/strict';
import {blurPlan, MAX_SAMPLES} from '../public/rotation-blur.js';
import {MAX_SPEED} from '../public/physics.js';

test('rest and subpixel travel use the sharp image',()=>{
  assert.equal(blurPlan(0,768).samples,1);
  assert.equal(blurPlan(.1,768).samples,1);
});
test('sample spacing stays within one source/display pixel at maximum speed',()=>{
  for(const radius of [100,170,340,600,768]){
    const plan=blurPlan(MAX_SPEED,radius);
    assert.ok(plan.samples<=MAX_SAMPLES);
    assert.ok(Math.abs(plan.step)*radius<=1);
    assert.ok(plan.samples>5);
  }
});
test('doubling passes cover the exposure uniformly, in either direction',()=>{
  for(const speed of [-MAX_SPEED,3,MAX_SPEED]){
    const plan=blurPlan(speed,600);
    let offsets=[0];
    for(let count=1;count<plan.samples;count*=2)offsets=[...offsets,...offsets.map(a=>a-plan.step*count)];
    offsets=offsets.map(a=>a-plan.step/2).sort((a,b)=>a-b);
    assert.equal(new Set(offsets.map(a=>a.toFixed(10))).size,plan.samples);
    for(let i=1;i<offsets.length;i++)assert.ok(Math.abs(offsets[i]-offsets[i-1]-Math.abs(plan.step))<1e-10);
    assert.ok(Math.abs(offsets.reduce((a,b)=>a+b,0)/offsets.length+plan.sweep/2)<1e-10);
  }
});
