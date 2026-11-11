import test from 'node:test';
import assert from 'node:assert/strict';
import {WIDTHS,strokeWidth,contactPressure,nextHue,recentColors} from '../public/brush.js';
test('all four sizes remain distinct for pen, finger and mouse',()=>{
  for(const type of ['pen','touch','mouse']){
    const widths=WIDTHS.map((_,i)=>strokeWidth(i,type,.5));
    assert.deepEqual(widths,WIDTHS);
    assert.ok(widths.every((w,i)=>i===0 || w>widths[i-1]*1.8));
  }
});
test('pressure spans light to heavy, respects zero, and can be disabled',()=>{
  assert.equal(contactPressure(0),0);
  assert.equal(contactPressure(undefined),.5);
  assert.ok(strokeWidth(2,'pen',1)>strokeWidth(2,'pen',.1)*4);
  assert.equal(strokeWidth(2,'pen',0,false),WIDTHS[2]);
  assert.equal(strokeWidth(2,'touch',.1),strokeWidth(2,'touch',1));
});
test('rainbow depends on distance, never on frame count or a stationary hold',()=>{
  let hue=20;
  for(let i=0;i<100;i++)hue=nextHue(hue,.01);
  assert.ok(Math.abs(hue-nextHue(20,1))<1e-9);
  assert.equal(nextHue(20,0),20);
  assert.equal(nextHue(350,.1),14);
});
test('recent colors deduplicate, reorder, and retain six entries',()=>{
  assert.deepEqual(recentColors(['a','b','c'],'b'),['b','a','c']);
  assert.equal(recentColors(['a','b','c','d','e','f'],'g').length,6);
});
