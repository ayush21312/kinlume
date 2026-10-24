import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {CommunityStore} from '../server/communityStore.js';
import {communityApi} from '../server/communityApi.js';
import {validatePersonalProfile,assistantProfile} from '../server/personalProfile.js';
import {buildModelRequest} from '../server/assistant.js';
import {chatIntent} from '../server/chat.js';

const answers={purpose:'help',preferredName:'  NeverSendName  ',needs:['food','programs'],location:' Hackensack, NJ ',circumstances:['income'],householdSize:'three-five',transport:'transit',maxTravelMinutes:30,startTime:'09:00',endTime:'17:00',stepFree:true,notes:'NeverSendNote',aiConsent:false};
const password='Disposable-test-passphrase';
test('the questionnaire validates required answers and drops unrelated personal identifiers',()=>{
 const profile=validatePersonalProfile({...answers,email:'private@example.invalid',ssn:'123-45-6789',dateOfBirth:'2000-01-01',completed:true,userId:'somebody-else'});
 assert.equal(profile.preferredName,'NeverSendName');assert.equal(profile.location,'Hackensack, NJ');
 for(const key of ['email','ssn','dateOfBirth','completed','userId'])assert.ok(!(key in profile));
 for(const update of [{needs:[]},{needs:['invalid']},{location:''},{endTime:'08:00'},{startTime:'25:00'},{circumstances:['diagnosis']},{householdSize:'invalid'},{maxTravelMinutes:0},{notes:'My number is 123-45-6789'}])assert.throws(()=>validatePersonalProfile({...answers,...update}));
});
test('donors and organization managers are not asked to save hardship information',()=>{
 for(const purpose of ['give','organization'])assert.deepEqual(validatePersonalProfile({...answers,purpose,aiConsent:true}),{purpose,preferredName:'NeverSendName',aiConsent:false});
});
test('AI context requires opt-in and never contains names, emails or private notes',()=>{
 const profile=validatePersonalProfile(answers);
 assert.equal(assistantProfile(profile),null);
 const context=assistantProfile({...profile,aiConsent:true,email:'private@example.invalid'});
 assert.deepEqual(context.needs,['food','programs']);assert.equal(context.transport,'transit');
 const serialized=JSON.stringify(context);for(const sensitive of ['NeverSendName','NeverSendNote','private@example.invalid'])assert.ok(!serialized.includes(sensitive));
 const request=buildModelRequest({messages:[{role:'user',content:'What should I check?'}],profile:{city:'Hackensack, NJ'},personalContext:context},'test',[]);
 assert.ok(request.instructions.includes('SAVED_PREFERENCES:'));
 assert.ok(request.instructions.includes('Income does not cover essentials'));
 assert.ok(!request.instructions.includes('NeverSendName'));assert.ok(!request.instructions.includes('NeverSendNote'));
 assert.equal(assistantProfile({...profile,aiConsent:'false'}),null);
});
test('profiles can only be read and changed through the signed-in account identity',async t=>{
 const store=new CommunityStore(':memory:');t.after(()=>store.close());
 const alice=await store.authenticate('profile-a@example.invalid',password,true),bob=await store.authenticate('profile-b@example.invalid',password,true);
 assert.throws(()=>store.saveProfile(null,answers),error=>error.status===401);
 store.saveProfile(alice,answers);
 assert.equal(store.view(null).profile,null);assert.equal(store.view(bob).profile,null);
 store.saveProfile(bob,{purpose:'give',preferredName:'Bob',userId:alice.id});
 assert.equal(store.profile(alice).preferredName,'NeverSendName');assert.equal(store.profile(bob).preferredName,'Bob');
 store.saveProfile(alice,{...answers,preferredName:'',circumstances:[],notes:'',aiConsent:false});
 assert.equal(store.profile(alice).notes,'');assert.equal(store.profile(alice).aiConsent,false);
});
test('account setup is enforced by the server before organization or donation writes',async t=>{
 const store=new CommunityStore(':memory:');t.after(()=>store.close());
 const user=await store.authenticate('needs-setup@example.invalid',password,true);
 assert.equal(store.profile(user),null);
 assert.throws(()=>store.act(user,{type:'organization',name:'Example',city:'Town'}),error=>error.status===409);
 assert.throws(()=>store.saveProfile(user,{...answers,needs:[]}));
 assert.equal(store.profile(user),null);
 store.saveProfile(user,{purpose:'organization',preferredName:''});
 store.act(user,{type:'organization',name:'Example',city:'Town'});
 assert.equal(store.view(user).organization.name,'Example');
});
test('saved needs initialize matching while an explicit chat request overrides them',()=>{
 assert.equal(chatIntent({profile:{city:'Hackensack, NJ',need:'food'},messages:[{role:'user',content:'What can I access nearby?'}]}).category,'food');
 assert.equal(chatIntent({profile:{city:'Hackensack, NJ',need:'food'},messages:[{role:'user',content:'Find utility assistance'}]}).category,'programs');
});
test('HTTP profile saving requires a session, validates answers and returns only the owners profile',async t=>{
 const store=new CommunityStore(':memory:');
 const handler=communityApi(store,{json:(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));},requestBody:async req=>{let body='';for await(const chunk of req)body+=chunk;return JSON.parse(body);}});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost')))res.end();});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();});
 const url=`http://127.0.0.1:${server.address().port}/api/community`;
 const post=(path,body,cookie='',origin='http://127.0.0.1:5173')=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});
 assert.equal((await post('/profile',{profile:answers})).status,401);
 const registered=await post('/register',{email:'http-profile@example.invalid',password});
 const cookie=registered.headers.get('set-cookie').split(';')[0];
 assert.equal((await registered.json()).profile,null);
 assert.equal((await post('/profile',{profile:answers},cookie,'https://attacker.invalid')).status,403);
 assert.equal((await post('/profile',{profile:{...answers,needs:[]}},cookie)).status,400);
 const response=await post('/profile',{profile:answers},cookie);
 assert.equal(response.status,200);assert.equal((await response.json()).profile.preferredName,'NeverSendName');
 assert.equal((await fetch(url).then(r=>r.json())).profile,null);
 assert.equal((await fetch(url,{headers:{Cookie:cookie}}).then(r=>r.json())).profile.location,'Hackensack, NJ');
});
