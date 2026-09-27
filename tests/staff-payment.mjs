import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import handler from '../api/line/webhook.js';
process.env.LINE_CHANNEL_SECRET='test';
process.env.LINE_CHANNEL_ACCESS_TOKEN='test';
process.env.SHEETS_BRIDGE_SECRET='test';
process.env.GOOGLE_APPS_SCRIPT_URL='https://bridge.test';
let role='เจ้าของ', allowed=true, result={queued:true,message:'ส่งเข้าคิวตรวจสอบแล้ว'};
let calls=[], replies=[];
globalThis.fetch=async(url, options={})=>{
 const body=JSON.parse(options.body||'{}');
 let data={ok:true};
 if(url.startsWith('https://bridge.test')) {
  calls.push(body);
  if(body.action==='checkAccess') data={ok:true,allowed:body.permission==='บันทึกชำระ'?allowed:true,role,staffName:'staff'};
  if(body.action==='queuePayment') data={ok:true,...result};
 }
 if(url.endsWith('/message/reply')) replies.push(body.messages);
 return {ok:true,status:200,text:async()=>JSON.stringify(data)};
};
async function send(text, type='user') {
 calls=[];replies=[];
 const raw=Buffer.from(JSON.stringify({events:[{type:'message',message:{type:'text',text},replyToken:'test',source:{type,userId:'U-test'}}]}));
 const req=Readable.from([raw]);req.method='POST';req.headers={'x-line-signature':crypto.createHmac('sha256','test').update(raw).digest('base64')};
 const res={status(code){assert.equal(code,200);return this},json(){}};
 await handler(req,res);
 return replies.at(-1);
}
const oldBase=['ช่วยเหลือ','ครบกำหนดวันนี้','ใกล้ครบกำหนด','ค้างชำระทั้งหมด','คิวตรวจสอบ','อ่านบัตรล่าสุด','กรอกชื่อเอง','รายงานวันนี้'];
for(role of ['เจ้าของ','แอดมิน','พนักงาน','เจ้าหน้าที่']) {
 const menu=await send('เมนู');
 assert.equal(menu[0].template.actions[0].label,'รับชำระ');
 const expected=role==='เจ้าของ'?oldBase.concat(['ส่งแจ้งเตือนทันที','เจ้าหน้าที่','ลูกค้ารออนุมัติ','กิจกรรมวันนี้','สถานะระบบ']):oldBase;
 assert.deepEqual(menu.at(-1).quickReply.items.map(x=>x.action.text),expected);
 const help=await send('รับชำระ');assert.match(help[0].text,/ยอดชำระจริง/);assert.ok(!calls.some(x=>x.action==='queuePayment'));
 await send('รับชำระ v6:101 500');
 const payments=calls.filter(x=>x.action==='queuePayment');assert.equal(payments.length,1);assert.equal(payments[0].amount,500);assert.equal(payments[0].query,'v6:101');
 assert.ok(calls.some(x=>x.action==='checkAccess'&&x.permission==='บันทึกชำระ'));
 assert.ok(calls.every(x=>['checkAccess','queuePayment','logAction'].includes(x.action)));
}
for(const text of ['รับชำระ 101 0','รับชำระ 101 -10','รับชำระ 101 abc','รับชำระ 101 Infinity']) {
 await send(text);assert.ok(!calls.some(x=>x.action==='queuePayment'));
}
allowed=false;
assert.equal((await send('เมนู')).length,1);
await send('รับชำระ 101 500');assert.ok(!calls.some(x=>x.action==='queuePayment'));
allowed=true;
assert.equal((await send('เมนู','group')).length,1);
await send('รับชำระ 101 500','group');assert.ok(!calls.some(x=>x.action==='queuePayment'));
result={queued:false,duplicate:true,message:'มีคิวซ้ำที่ยังรอตรวจ #9'};
assert.match((await send('รับชำระ 101 500'))[0].text,/คิวซ้ำ/);
result={queued:false,needsSelection:true,matches:[{name:'A',queue:'101',source:'v6'}]};
assert.match((await send('รับชำระ 101 500'))[0].text,/พบหลายรายการ/);
await send('บันทึกชำระ 101 500');assert.ok(calls.some(x=>x.action==='queuePayment'));
console.log('Staff payment tests passed');
