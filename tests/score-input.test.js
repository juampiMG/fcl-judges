import test from 'node:test';
import assert from 'node:assert/strict';
import { maskTime, normalizeTime, digitsOnly, parseQuantity } from '../web/score-input.js';
test('time mask inserts separators and keeps only six digits',()=>{
  assert.deepEqual(['','0','09','093','0932','09321','093212','0932129'].map(maskTime),['','0','09:','09:3','09:32:','09:32:1','09:32:12','09:32:12']);
  assert.equal(maskTime('ab09:32:12xyz'),'09:32:12');
});
test('time validates seconds and defaults only omitted hundredths',()=>{
  for(const value of ['09:32','09:32:']) assert.equal(normalizeTime(value),'09:32:00');
  assert.equal(normalizeTime('09:32:07'),'09:32:07');
  assert.equal(normalizeTime('00:00:01'),'00:00:01');
  for(const value of ['', '09:', '09:32:1', '09:60:00','00:00:00','9:32:00','093200','09:32:ab','-1:00:00','09:32:001'])assert.throws(()=>normalizeTime(value),value);
});
test('quantities cannot accept signs, decimals, exponent notation or letters',()=>{
  assert.equal(parseQuantity('0'),0);assert.equal(parseQuantity('123'),123);
  assert.equal(digitsOnly('1a2.3+-e'),'123');
  for(const value of ['', '1e2','-1','+2','2.5','12x',' 12','999999'])assert.throws(()=>parseQuantity(value),value);
});
