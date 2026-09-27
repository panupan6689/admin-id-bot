import crypto from 'node:crypto';
import sharp from 'sharp';
import { callSheetsBridge } from './sheetsBridge.js';

const roles = new Set(['เจ้าของ', 'แอดมิน', 'admin', 'Admin']);
function signature(value) {
  const secret = process.env.SHEETS_BRIDGE_SECRET;
  if (!secret) throw new Error('Missing slip signing secret');
  return crypto.createHmac('sha256', secret).update('customer-slip:' + value).digest('base64url');
}
export function slipImageToken(messageId, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ id: messageId, exp: Math.floor(now / 1000) + 86400 })).toString('base64url');
  return value + '.' + signature(value);
}
export function verifySlipImageToken(token, now = Date.now()) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [value, signed] = parts;
    const expected = Buffer.from(signature(value));
    const supplied = Buffer.from(signed);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    return /^\d+$/.test(data.id) && Number.isFinite(data.exp) && data.exp > now / 1000 ? data.id : null;
  } catch { return null; }
}
export async function serveSlipImage(req, res) {
  const id = verifySlipImageToken(req.query?.slip);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!id) return res.status(403).json({ ok: false });
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${id}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ ok: false });
  const type = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg','image/png'].includes(type)) return res.status(415).json({ ok: false });
  res.setHeader('Content-Type', type);
  const image = await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer();
  if (image.length > 1000000) return res.status(413).json({ok:false});
  res.setHeader('Content-Type', 'image/jpeg');
  return res.status(200).send(image);
}
function retryKey(event, userId) {
  const bytes = crypto.createHash('sha256').update(`slip:${event.message.id}:${userId}`).digest().subarray(0,16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function notifyCustomerSlip(event) {
  if (event.source?.type !== 'user' || event.message?.type !== 'image') return { handled: false };
  const lineUserId = event.source.userId;
  // Only verified customer bindings can identify the sender. Staff image workflows remain unchanged.
  const staff = await callSheetsBridge({ action:'checkAccess', lineUserId, sourceType:'user', permission:'ดูข้อมูลลูกค้า' });
  if (staff.allowed || staff.message !== 'บัญชี LINE นี้ยังไม่มีสิทธิ์ใช้งาน Admin ID') return { handled: false };
  const self = await callSheetsBridge({ action:'getCustomerSelf', lineUserId, field:'info' });
  if (!self.bound || self.suspended) return { handled: false };
  const customers = Array.isArray(self.items) ? self.items : [];
  // Reuse the existing authenticated recipient lookup; it also keeps the customer-contact audit trail.
  const contact = await callSheetsBridge({ action:'getCustomerContactRecipients', lineUserId });
  if (!contact.bound) return { handled: false };
  const recipients = [...new Set(contact.recipients || [])];
  const base = String(process.env.PUBLIC_BASE_URL || 'https://admin-id-bot.vercel.app').replace(/\/$/, '');
  const imageUrl = `${base}/api/line/webhook?slip=${encodeURIComponent(slipImageToken(event.message.id))}`;
  const time = new Date(event.timestamp || Date.now()).toLocaleString('th-TH', { timeZone:'Asia/Bangkok' });
  const details = customers.length ? customers.map(x => `${x.name || '-'} | คิว ${x.queue || '-'}${x.source ? ' | ' + x.source : ''}`) : ['ยังระบุรายการลูกค้าไม่ได้'];
  const query = customers.length === 1 && customers[0].queue && customers[0].source
    ? `${customers[0].source}:${customers[0].queue}` : '';
  let sent = 0, failed = 0;
  for (const to of recipients) {
    const access = await callSheetsBridge({ action:'checkAccess', lineUserId:to, sourceType:'user', permission:'ยืนยันสลิป' });
    if (!access.allowed || !roles.has(access.role)) continue;
    const payment = await callSheetsBridge({ action:'checkAccess', lineUserId:to, sourceType:'user', permission:'บันทึกชำระ' });
    const messages = [
      { type:'text', text: ['ได้รับรูปจากลูกค้า — รอตรวจสอบ', ...details, 'ส่งเมื่อ: ' + time,
        'ยังไม่ยืนยันว่าเป็นสลิปจริงหรือได้รับเงินแล้ว', 'ยังไม่ได้แก้ยอดในชีตต้นทาง'].join('\n').slice(0,4900) },
      { type:'image', originalContentUrl:imageUrl, previewImageUrl:imageUrl },
    ];
    if (payment.allowed) messages.push({ type:'template', altText:'รับชำระ / ส่งเข้าคิวตรวจสอบ', template:{ type:'buttons',
      text:'ตรวจรูปและยอดเงินจริงก่อนรับชำระ' + (customers.length > 1 ? '\nลูกค้ามีหลายรายการ กรุณาเลือกคิวให้ถูกต้อง' : ''),
      actions:[{ type:'message', label:'รับชำระ', text:'รับชำระ' + (query ? ' ' + query : '') }] } });
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, 'X-Line-Retry-Key':retryKey(event,to)},
        body:JSON.stringify({to,messages}), signal:AbortSignal.timeout(10000),
      });
      if (response.ok || (response.status === 409 && response.headers.get('x-line-accepted-request-id'))) sent++;
      else failed++;
    } catch { failed++; }
  }
  await callSheetsBridge({ action:'logAction', lineUserId, role:'ลูกค้า', command:'ส่งรูปให้ตรวจสอบ',
    actionName:'customerSlipAlert', source:'LINE ส่วนตัว', result:`แจ้งสำเร็จ ${sent} ไม่สำเร็จ ${failed}`, status:failed || !sent ? 'รอดำเนินการ' : 'สำเร็จ', note:'รูปที่ยังไม่ยืนยันว่าเป็นสลิป' }).catch(()=>{});
  return { handled:true, sent, failed };
}
