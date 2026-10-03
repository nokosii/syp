import test from 'node:test';
import assert from 'node:assert/strict';
import {canRead,canUseAI,demoGovernance} from '../lib/governance.ts';
const doc={status:'published',consent:true,isDemo:false,governance:{...demoGovernance}};
test('cultural visibility defaults closed for missing review metadata',()=>{
 assert.equal(canRead({...doc,governance:undefined}),false);
 for(const g of [{reviewState:'pending'},{reviewState:'withdrawn'},{accessLevel:'editor'}])assert.equal(canRead({...doc,governance:{...doc.governance,...g}}),false);
 assert.equal(canRead({...doc,consent:false}),false);
 assert.equal(canRead({...doc,status:'draft'}),false);
});
test('permission to read does not imply permission to use AI',()=>{
 assert.equal(canRead({...doc,governance:{...doc.governance,aiAllowed:false}}),true);
 assert.equal(canUseAI({...doc,governance:{...doc.governance,aiAllowed:false}}),false);
 assert.equal(canUseAI(doc),true);
 assert.equal(canUseAI({...doc,governance:{...doc.governance,accessLevel:'editor'}}),false);
});
test('explicit demos remain available but still require consent and published status',()=>{
 assert.equal(canUseAI({...doc,isDemo:true,governance:undefined}),true);
 assert.equal(canUseAI({...doc,isDemo:true,consent:false}),false);
});
