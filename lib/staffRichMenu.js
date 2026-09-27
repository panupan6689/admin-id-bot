import sharp from 'sharp';
import { STAFF_PAYMENT_BANNER } from './staffPaymentBanner.js';

const API = 'https://api.line.me/v2/bot';
const DATA = 'https://api-data.line.me/v2/bot';
const PREFIX = 'admin-id-payment-v1:';
async function request(url, options = {}, missing = false) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, ...options.headers },
  });
  if (missing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Staff menu request failed: ${response.status}`);
  return response;
}

export function extendMenu(original) {
  if (!original?.size || !Array.isArray(original.areas) || original.areas.length >= 20) {
    throw new Error('Cannot safely extend existing rich menu');
  }
  const scaleX = 2500 / original.size.width;
  const scaleY = 1400 / original.size.height;
  const areas = original.areas.map(({ bounds: b, action }) => ({
    bounds: {
      x: Math.round(b.x * scaleX), y: Math.round(b.y * scaleY),
      width: Math.round((b.x + b.width) * scaleX) - Math.round(b.x * scaleX),
      height: Math.round((b.y + b.height) * scaleY) - Math.round(b.y * scaleY),
    },
    action,
  }));
  areas.push({ bounds: { x: 0, y: 1400, width: 2500, height: 286 }, action: { type: 'message', label: 'รับชำระ', text: 'รับชำระ' } });
  return { size: { width: 2500, height: 1686 }, selected: true,
    name: PREFIX + original.richMenuId, chatBarText: original.chatBarText || 'เมนูเจ้าหน้าที่', areas };
}

// Only per-user links are changed. Original menus, actions and the default remain intact.
export async function syncStaffPaymentMenu(lineUserId, allowed) {
  const userUrl = `${API}/user/${encodeURIComponent(lineUserId)}/richmenu`;
  const linked = await request(userUrl, {}, true);
  const linkedId = linked ? (await linked.json()).richMenuId : '';
  let originalId = linkedId;
  if (!originalId) {
    const fallback = await request(`${API}/user/all/richmenu`, {}, true);
    originalId = fallback ? (await fallback.json()).richMenuId : '';
  }
  // An OA Manager menu is not exposed by these APIs. Never overwrite an unknown menu.
  if (!originalId) return false;
  const original = await (await request(`${API}/richmenu/${encodeURIComponent(originalId)}`)).json();
  if (original.name?.startsWith(PREFIX)) {
    if (!allowed) {
      const restoreId = original.name.slice(PREFIX.length);
      await request(`${userUrl}/${encodeURIComponent(restoreId)}`, { method: 'POST' });
    }
    return allowed;
  }
  if (!allowed) return false;
  const definition = extendMenu(original);
  const list = await (await request(`${API}/richmenu/list`)).json();
  let id = list.richmenus?.find(menu => menu.name === definition.name)?.richMenuId;
  if (!id) {
    // Download and compose before creating anything, so unsupported images leave the old menu intact.
    const source = await request(`${DATA}/richmenu/${encodeURIComponent(originalId)}/content`);
    const resized = await sharp(Buffer.from(await source.arrayBuffer())).resize(2500, 1400, { fit: 'fill' }).png().toBuffer();
    const image = await sharp({ create: { width: 2500, height: 1686, channels: 3, background: '#086C6A' } })
      .composite([{ input: resized, top: 0, left: 0 }, { input: Buffer.from(STAFF_PAYMENT_BANNER, 'base64'), top: 1400, left: 0 }])
      .png().toBuffer();
    if (image.length > 1000000) throw new Error('Extended menu image exceeds LINE limit');
    id = (await (await request(`${API}/richmenu`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(definition),
    })).json()).richMenuId;
    try {
      await request(`${DATA}/richmenu/${encodeURIComponent(id)}/content`, {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image,
      });
    } catch (error) {
      await request(`${API}/richmenu/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      throw error;
    }
  }
  // Check image readiness before replacing the current user's link.
  await request(`${DATA}/richmenu/${encodeURIComponent(id)}/content`);
  await request(`${userUrl}/${encodeURIComponent(id)}`, { method: 'POST' });
  return true;
}
