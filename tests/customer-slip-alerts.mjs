import assert from 'node:assert/strict';
import { notifyCustomerSlip, slipImageToken, verifySlipImageToken, serveSlipImage } from '../lib/customerSlipAlerts.js';
process.env.SHEETS_BRIDGE_SECRET='test-secret';
process.env.GOOGLE_APPS_SCRIPT_URL='https://bridge.test';
process.env.LINE_CHANNEL_ACCESS_TOKEN='test-token';
let calls=[], pushes=[], bound=true, staff=false, suspended=false;
const event={source:{type:'user',userId:'customer'},message:{type:'image',id:'123456'},timestamp:1790495585600};
const json=data=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,...data})});
globalThis.fetch=async(url,opts={})=>{
 const b=JSON.parse(opts.body||'{}');
 if(url.startsWith('https://bridge.test')) {
  calls.push(b);
  if(b.action==='checkAccess') {
   if(b.lineUserId==='customer') return json({allowed:staff,message:staff?'':'บัญชี LINE นี้ยังไม่มีสิทธิ์ใช้งาน Admin ID'});
   const roles={owner:'เจ้าของ',admin:'แอดมิน',employee:'พนักงาน',disabled:'เจ้าของ',viewer:'แอดมิน'};
   return json({allowed:b.lineUserId!=='disabled'&&!(b.lineUserId==='viewer'&&b.permission==='บันทึกชำระ'),role:roles[b.lineUserId]});
  }
  if(b.action==='getCustomerSelf') return json({bound,suspended,items:[{name:'ลูกค้าทดสอบ',queue:'101',source:'v6'}]});
  if(b.action==='getCustomerContactRecipients') return json({bound:true,recipients:['owner','admin','employee','disabled','viewer','owner']});
  return json({});
 }
 pushes.push({body:b,headers:opts.headers});return json({});
};
const token=slipImageToken('123456',1000000);
assert.equal(verifySlipImageToken(token,1000000),'123456');
assert.equal(verifySlipImageToken(token+'x',1000000),null);
assert.equal(verifySlipImageToken(token,1000000+86400000),null);
const result=await notifyCustomerSlip(event);
assert.equal(result.sent,3);
assert.deepEqual(pushes.map(x=>x.body.to),['owner','admin','viewer']);
assert.equal(pushes[0].body.messages[2].template.actions[0].text,'รับชำระ v6:101');
assert.equal(pushes[2].body.messages.length,2);
assert.match(pushes[0].body.messages[0].text,/ยังไม่ยืนยัน/);
assert.ok(!calls.some(x=>['queuePayment','queueSlipReview','resolveReviewQueue'].includes(x.action)));
const key=pushes[0].headers['X-Line-Retry-Key'];pushes=[];
await notifyCustomerSlip(event);assert.equal(pushes[0].headers['X-Line-Retry-Key'],key);
for(const mode of ['unbound','staff','suspended','group']) {
 bound=mode!=='unbound';staff=mode==='staff';suspended=mode==='suspended';pushes=[];
 const e=mode==='group'?{...event,source:{...event.source,type:'group'}}:event;
 assert.equal((await notifyCustomerSlip(e)).handled,false);assert.equal(pushes.length,0);
}
let code;
await serveSlipImage({query:{slip:'invalid'}},{setHeader(){},status(c){code=c;return this},json(){}});
assert.equal(code,403);
console.log('PASS: authorized recipients only, payment permissions, retry deduplication, signed image expiry, no financial writes');
// Exercise the signed webhook route rather than only the alert helper.
const {default:handler}=await import('../api/line/webhook.js');
const {Readable}=await import('node:stream');
const {default:crypto}=await import('node:crypto');
process.env.LINE_CHANNEL_SECRET='webhook-secret';
const savedFetch=globalThis.fetch;
bound=true;staff=false;suspended=false;pushes=[];
globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/message/reply')) { return json({}); }
 return savedFetch(url,options);
};
const raw=Buffer.from(JSON.stringify({events:[{...event,type:'message',replyToken:'reply'}]}));
const req=Readable.from([raw]);req.method='POST';req.headers={'x-line-signature':crypto.createHmac('sha256','webhook-secret').update(raw).digest('base64')};
let status;
await handler(req,{status(c){status=c;return this},json(){}});
assert.equal(status,200);assert.equal(pushes.length,3);
console.log('PASS: signed LINE image webhook dispatches recipient alerts');
