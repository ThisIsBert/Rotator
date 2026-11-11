import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,angleDelta,toDisc,strokeSamples,TAU,MAX_SPEED} from '../public/physics.js';
test('inertia is frame-rate independent',()=>{
  const one=advance(0,40,1);let many={angle:0,speed:40};
  for(let i=0;i<120;i++)many=advance(many.angle,many.speed,1/120);
  assert.ok(Math.abs(one.angle-many.angle)<1e-10);
  assert.ok(Math.abs(one.speed-many.speed)<1e-10);
  assert.ok(one.speed<40 && one.speed>35);
});
test('finger angle crosses seam without jumping',()=>assert.ok(Math.abs(angleDelta(-Math.PI+.01,Math.PI-.01)-.02)<1e-10));
test('surface counter-rotates',()=>{
  const p=toDisc(1,0,Math.PI/2);assert.ok(Math.abs(p.x)<1e-10);assert.equal(p.y,-1);
});
test('stationary contact draws a complete circle',()=>{
  const points=strokeSamples({x:.5,y:0},{x:.5,y:0},0,TAU,.5);
  assert.ok(points.length>1500);
  for(const p of points)assert.ok(Math.abs(Math.hypot(p.x,p.y)-.5)<1e-10);
  assert.ok(points.some(p=>p.x<-.499));
});
test('radial motion makes a continuous spiral at maximum speed',()=>{
  const points=strokeSamples({x:.8,y:0},{x:.1,y:0},0,MAX_SPEED*.05,.8);
  for(let i=1;i<points.length;i++)assert.ok(Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)<.0021);
  assert.ok(Math.abs(Math.hypot(points.at(-1).x,points.at(-1).y)-.1)<1e-10);
});
