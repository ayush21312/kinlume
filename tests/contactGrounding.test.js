import test from 'node:test';
import assert from 'node:assert/strict';
import {readModelReply} from '../server/assistant.js';
test('AI contact numbers must match catalog facts and placeholders never reach users',()=>{
  const read=answer=>readModelReply({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer,steps:[],resourceIds:['known']})}]}]},[{id:'known',phone:'201-329-9600'}]).answer;
  assert.equal(read('Call 201-329-9600.'),'Call 201-329-9600.');
  assert.equal(read('Call 1‑800‑….'),'Call the contact number in the official listing.');
  assert.equal(read('Call 800-555-1212.'),'Call the contact number in the official listing.');
  assert.equal(read('Visit on 2026-10-22 at 09:00.'),'Visit on 2026-10-22 at 09:00.');
});
