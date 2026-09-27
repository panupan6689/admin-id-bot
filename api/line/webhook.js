export const maxDuration = 60;
import crypto from "node:crypto";
import { notifyCustomerSlip, serveSlipImage, slipImageToken, verifyResendSlipToken } from "../../lib/customerSlipAlerts.js";
import { syncStaffPaymentMenu } from "../../lib/staffRichMenu.js";
import { callSheetsBridge, formatCustomerMatches } from "../../lib/sheetsBridge.js";
import { parseCommand, formatCustomerInfo, formatHistory } from "../../lib/commands.js";
import { linkVerifiedCustomerMenu } from "../../lib/customerRichMenu.js";
import { paymentQrUrl } from "../../lib/paymentQr.js";
import { createWebSession } from "../../lib/webAuth.js";

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function replyMessage(replyToken, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${text}`);
  }
}

async function pushMessage(to, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !to) return;

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE push failed: ${response.status} ${text}`);
  }
}

async function fetchLineMessageContent(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !messageId) throw new Error("LINE content token/messageId missing");

  const response = await fetch(
    "https://api-data.line.me/v2/bot/message/" + encodeURIComponent(messageId) + "/content",
    { headers: { Authorization: "Bearer " + token } }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error("LINE content fetch failed: " + response.status + " " + text);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());
  return { contentType, bytes };
}

async function readThaiIdFromRecentImages(items, context) {
  const candidates = Array.isArray(items) ? items.slice(0, 5) : [];
  const attempts = [];

  for (const item of candidates) {
    const messageId = item?.messageId;
    if (!messageId) continue;

    try {
      const content = await fetchLineMessageContent(messageId);
      if (content.bytes.length > 5 * 1024 * 1024) {
        attempts.push({ messageId, skipped: true, reason: "รูปใหญ่เกิน 5 MB" });
        continue;
      }

      const result = await callSheetsBridge({
        action: "ocrThaiIdCardImage",
        lineUserId: context.lineUserId,
        sourceType: context.sourceType,
        groupId: context.groupId,
        imageBase64: content.bytes.toString("base64"),
        mimeType: content.contentType.split(";")[0] || "image/jpeg",
      });

      attempts.push({
        messageId,
        isThaiIdCard: !!result?.isThaiIdCard,
        hasUsableName: !!result?.hasUsableName,
        message: result?.message || "",
      });

      if (result?.isThaiIdCard) {
        return { found: true, result, attempts };
      }
    } catch (error) {
      attempts.push({ messageId, error: String(error?.message || error) });
    }
  }

  return { found: false, attempts };
}

async function getGroupSummary(groupId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !groupId) return null;
  try {
    const response = await fetch("https://api.line.me/v2/bot/group/" + encodeURIComponent(groupId) + "/summary", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("LINE group summary failed", error);
    return null;
  }
}

async function safeLogAction(payload) {
  try {
    await callSheetsBridge({
      action: "logAction",
      ...payload,
    });
  } catch (error) {
    console.warn("Audit log failed", error);
  }
}

async function logCustomerOutcome(lineUserId, command, result, status, note = "", query = "") {
  await safeLogAction({
    lineUserId, staffName: "", role: "ลูกค้า", command, query,
    source: "LINE ส่วนตัว", result, actionName: "customerSelfService", status, note,
  });
}

const customerMenuCheckedUsers = new Set();

async function safeLinkCustomerMenu(lineUserId) {
  if (!lineUserId || customerMenuCheckedUsers.has(lineUserId)) return;
  try {
    // A person can be in both sheets. Never replace an owner's or staff member's menu.
    const staff = await callSheetsBridge({
      action: "checkAccess", lineUserId, sourceType: "user", groupId: "",
      permission: "ดูข้อมูลลูกค้า",
    });
    // A disabled or permission-limited staff account also returns allowed=false.
    // Only a LINE ID absent from the staff sheet may receive the customer menu.
    if (!staff.allowed && staff.message === "บัญชี LINE นี้ยังไม่มีสิทธิ์ใช้งาน Admin ID") {
      await linkVerifiedCustomerMenu(lineUserId);
    }
    customerMenuCheckedUsers.add(lineUserId);
  } catch (error) {
    console.warn("Could not link customer rich menu", error);
  }
}

async function startLoading(chatId, loadingSeconds = 60) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !chatId) return;

  try {
    const response = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        chatId,
        loadingSeconds,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`LINE loading failed: ${response.status} ${text}`);
      return false;
    }
    console.info("LINE loading started", { chatId, loadingSeconds });
    return true;
  } catch (error) {
    console.warn("LINE loading error", error);
    return false;
  }
}

async function showCustomerProgress(chatId) {
  try {
    await pushMessage(chatId, [{
      type: "text",
      text: "กำลังตรวจสอบ"
    }]);
  } catch (error) {
    console.warn("Customer progress message failed", error);
  }
}

function menuQuickReply(role) {
  const base = [
    ["ค้นลูกค้า", "ช่วยเหลือ"],
    ["ครบกำหนดวันนี้", "ครบกำหนดวันนี้"],
    ["ใกล้ครบกำหนด", "ใกล้ครบกำหนด"],
    ["ค้างชำระ", "ค้างชำระทั้งหมด"],
    ["คิวตรวจสอบ", "คิวตรวจสอบ"],
    ["อ่านบัตร", "อ่านบัตรล่าสุด"],
    ["กรอกชื่อเอง", "กรอกชื่อเอง"],
    ["รายงานวันนี้", "รายงานวันนี้"],
  ];

  const ownerOnly = [
    ["ส่งแจ้งทันที", "ส่งแจ้งเตือนทันที"],
    ["เจ้าหน้าที่", "เจ้าหน้าที่"],
    ["ลูกค้ารออนุมัติ", "ลูกค้ารออนุมัติ"],
    ["กิจกรรมวันนี้", "กิจกรรมวันนี้"],
    ["สถานะระบบ", "สถานะระบบ"],
    ["เช็กพร้อมใช้", "เช็กพร้อมใช้"],
    ["ตรวจชีต", "ตรวจชีตต้นทาง"],
    ["แจ้งเตือน", "สถานะแจ้งเตือน"],
  ];

  const items = (role === "เจ้าของ" ? base.concat(ownerOnly) : base)
    .slice(0, 13)
    .map(([label, text]) => ({
      type: "action",
      action: { type: "message", label, text },
    }));

  return { items };
}

function staffImageQuickReply() {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "อ่านบัตรรูปล่าสุด", text: "อ่านบัตรล่าสุด" },
      },
      {
        type: "action",
        action: { type: "message", label: "กรอกชื่อเอง", text: "กรอกชื่อเอง" },
      },
      {
        type: "action",
        action: { type: "message", label: "เมนู", text: "เมนู" },
      },
    ],
  };
}

const CUSTOMER_SELF_ACTIONS = [
  ["ชำระยอด", "ชำระยอด"],
  ["ยอดปิด", "ยอดปิด"],
  ["สถานะ", "สถานะ"],
  ["ข้อมูล", "ข้อมูล"],
  ["สิทธิ์ส่วนลด", "สิทธิ์ส่วนลด"],
  ["ติดต่อแอดมิน", "ติดต่อแอดมิน"],
];

function customerSelfQuickReply() {
  return {
    items: CUSTOMER_SELF_ACTIONS.map(([label, text]) => ({
      type: "action",
      action: { type: "message", label, text },
    })),
  };
}

function customerPersistentButtons() {
  const buttons = CUSTOMER_SELF_ACTIONS.map(([label, text]) => ({
    type: "button",
    style: "secondary",
    height: "sm",
    flex: 1,
    action: { type: "message", label, text },
  }));
  return [0, 2, 4].map((start) => ({
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    contents: buttons.slice(start, start + 2),
  }));
}

function customerPersistentFooter(title = "เลือกดูข้อมูล") {
  return {
    type: "box", layout: "vertical", paddingAll: "14px", spacing: "sm", backgroundColor: "#F1F8F8",
    contents: [
      { type: "text", text: title, size: "sm", color: "#0D5D65", weight: "bold" },
      ...customerPersistentButtons(),
      { type: "text", text: "ปุ่มในบัตรนี้กดซ้ำได้ตลอด", size: "xs", color: "#73848B", wrap: true },
    ],
  };
}

function customerResultMessage(text, title = "ข้อมูลล่าสุด") {
  const value = String(text || "ไม่พบข้อมูล");
  return {
    type: "flex",
    altText: value.replace(/\s*\n\s*/g, " • ").slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "text", text: title, size: "md", color: "#0D5D65", weight: "bold" },
          { type: "text", text: value, size: "sm", color: "#173B46", wrap: true },
        ],
      },
      footer: customerPersistentFooter(),
    },
    quickReply: customerSelfQuickReply(),
  };
}

function customerFieldForText(value) {
  const text = String(value || "").trim().replace(/\s+/g, "");
  const exact = {
    "ชำระยอด": "payment",
    "จ่ายยอด": "payment",
    "ยอดปิด": "close",
    "วันครบกำหนดชำระ": "due",
    "วันครบกำหนด": "due",
    "วันจ่าย": "due",
    "กำหนดจ่าย": "due",
    "กำหนดชำระ": "due",
    "จ่าย": "due",
    "ยอดค้าง": "outstanding",
    "สถานะ": "status",
    "สถานะทั้งหมด": "status",
    "ข้อมูล": "info",
    "ข้อมูลลูกค้า": "info",
    "สิทธิ์ส่วนลด": "discount",
    "ค่าเช่า": "fee",
  };
  if (exact[text]) return exact[text];
  if (/(?:ชำระ|จ่าย).*(?:ยอด|เงิน)|(?:ยอด|เงิน).*(?:ชำระ|จ่าย)/.test(text)) return "payment";
  if (/(?:จ่าย|ชำระ).*(?:วัน|เมื่อไหร่|ไหนดี)|วัน.*(?:จ่าย|ชำระ)|กำหนด.*(?:จ่าย|ชำระ)/.test(text)) return "due";
  if (/ยอด.*ปิด|ปิด.*ยอด/.test(text)) return "close";
  if (/ยอด.*ค้าง|ค้าง.*(?:เท่า|ยอด)/.test(text)) return "outstanding";
  if (/ส่วนลด|ลดค่าเช่า/.test(text)) return "discount";
  if (/ค่าเช่า/.test(text)) return "fee";
  if (/สถานะ/.test(text)) return "status";
  if (/ข้อมูล/.test(text)) return "info";
  return "";
}

function customerPaymentMessage(result, field) {
  const item = Array.isArray(result?.items) ? result.items[0] : null;
  if (!result?.bound || !item) return { type: "text", text: formatCustomerSelfResult(result, field) };
  const isClose = field === "close";
  const total = isClose
    ? Number(item.calculatedClose || 0)
    : Number(item.paymentTotal || (Number(item.accumulatedFee || 0) + Number(item.lateFee || 0)));
  const qrUrl = paymentQrUrl(item.source, total);
  const discountAmount = Number(item.discountAmount || 0);
  const rows = isClose
    ? [
        ["ชื่อ", item.name || "-"], ["คิว", item.queue || "-"],
        ["เงินต้น", formatMoney(item.principal) + " บาท"],
        ["ค่าเช่า", formatMoney(item.accumulatedFee) + " บาท"],
        ...(discountAmount > 0 ? [["ส่วนลด", "−" + formatMoney(discountAmount) + " บาท"]] : []),
        ["ค่าปรับ", formatMoney(item.lateFee) + " บาท"],
        ["รวมยอดปิดวันนี้", formatMoney(total) + " บาท"],
      ]
    : [
        ["ชื่อ", item.name || "-"], ["คิว", item.queue || "-"],
        ["ค่าเช่าที่ต้องชำระ", formatMoney(item.accumulatedFee) + " บาท"],
        ["ค่าปรับ", formatMoney(item.lateFee) + " บาท"],
        ["รวมยอดชำระวันนี้", formatMoney(total) + " บาท"],
        ["วันครบกำหนด", item.dueDate || "-"],
      ];
  const bodyRows = rows.map(([label, value], index) => ({
    type: "box", layout: "horizontal", spacing: "md", margin: index ? "sm" : "none",
    contents: [
      { type: "text", text: label, size: "sm", color: "#60717B", flex: 5, wrap: true },
      { type: "text", text: String(value), size: "sm", color: index === rows.length - 1 ? "#C2413B" : "#173B46", weight: "bold", align: "end", flex: 5, wrap: true },
    ],
  }));
  return {
    type: "flex",
    altText: `${isClose ? "ยอดปิด" : "ชำระยอด"} คิว ${item.queue || "-"} รวม ${formatMoney(total)} บาท`,
    contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", paddingAll: "18px", backgroundColor: isClose ? "#7B3F00" : "#0D5D65", contents: [
        { type: "text", text: isClose ? "สรุปยอดปิดวันนี้" : "สรุปยอดชำระวันนี้", color: "#FFFFFF", size: "lg", weight: "bold" },
        { type: "text", text: "กรุณาตรวจสอบยอดก่อนชำระ", color: "#F3FAFA", size: "xs", margin: "sm" },
      ] },
      ...(qrUrl ? { hero: { type: "image", url: qrUrl, size: "full", aspectRatio: "1:1", aspectMode: "fit", backgroundColor: "#FFFFFF" } } : {}),
      body: { type: "box", layout: "vertical", paddingAll: "18px", contents: [
        ...bodyRows,
        { type: "separator", margin: "lg", color: "#DDE9EA" },
        { type: "text", text: qrUrl ? `QR นี้กำหนดยอด ${formatMoney(total)} บาทแล้ว` : "ยังไม่ได้ตั้งค่า QR สำหรับแหล่งข้อมูลนี้ กรุณาติดต่อแอดมิน", size: "xs", color: qrUrl ? "#0D5D65" : "#C2413B", wrap: true, margin: "lg", align: "center" },
      ] },
      footer: { type: "box", layout: "vertical", paddingAll: "14px", spacing: "sm", backgroundColor: "#F1F8F8", contents: [
        ...(qrUrl ? [{ type: "button", style: "primary", color: "#0D5D65", height: "sm", action: { type: "uri", label: "เปิด/บันทึก QR", uri: qrUrl } }] : []),
        ...customerPersistentButtons(),
      ] },
    },
    quickReply: customerSelfQuickReply(),
  };
}

function customerTermsMessage() {
  const rules = [
    "ชำระค่าเช่าตามยอดและวันครบกำหนดที่ระบบ LINE แจ้ง โดยนับรอบจากวันที่รับเงิน",
    "หากยังไม่คืนเงินต้น ต้องชำระค่าเช่าต่อเนื่องจนกว่าจะปิดยอด และต้องปิดยอดภายใน 6 เดือน",
    "กรุณาชำระภายในเวลา 18:00 น. ของวันครบกำหนด",
    "ชำระล่าช้ามีค่าปรับวันละ 50 บาท และเครื่องอาจถูกระงับตามข้อตกลง",
    "ยอดปิด = เงินต้น + ค่าเช่า + ค่าปรับ − ส่วนลด (ถ้ามี)",
    "หากเครื่องถูกล็อก อาจเข้าใช้งานหรือออกจากบัญชี iCloud ไม่ได้ และข้อมูลภายในเครื่องอาจมีความเสี่ยง",
    "หลังชำระ กรุณาส่งสลิปผ่าน LINE และรอเจ้าหน้าที่ตรวจสอบ",
    "หากมีข้อสงสัย กรุณากด ติดต่อแอดมิน ก่อนถึงวันครบกำหนด",
  ];
  return {
    type: "flex", altText: "เงื่อนไขการชำระค่าเช่าฝาก กรุณาอ่านให้ครบถ้วน",
    contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", paddingAll: "18px", backgroundColor: "#7B3F00", contents: [
        { type: "text", text: "เงื่อนไขการชำระค่าเช่าฝาก", color: "#FFFFFF", size: "lg", weight: "bold", wrap: true },
      ] },
      body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: [
        ...rules.map((rule, index) => ({ type: "text", text: `${index + 1}. ${rule}`, size: "sm", color: "#173B46", wrap: true })),
        { type: "separator", margin: "md", color: "#E6D7C7" },
        { type: "text", text: "กรุณาชำระให้ตรงเวลา เพื่อหลีกเลี่ยงค่าปรับและการระงับการใช้งานเครื่อง", size: "sm", color: "#C2413B", weight: "bold", wrap: true, margin: "md" },
      ] },
      footer: { type: "box", layout: "vertical", paddingAll: "14px", contents: [
        { type: "button", style: "primary", color: "#0D5D65", action: { type: "message", label: "ยืนยันรับทราบ", text: "ยืนยันรับทราบเงื่อนไข" } },
      ] },
    },
  };
}

function publicAssetUrl(path) {
  const host = process.env.PUBLIC_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://admin-id-bot.vercel.app");
  return host.replace(/\/$/, "") + "/" + String(path || "").replace(/^\//, "");
}

function customerTermsImageMessage() {
  const url = publicAssetUrl("api/assets/customer-terms");
  return { type: "image", originalContentUrl: url, previewImageUrl: url };
}

function customerTermsAckMessage() {
  return {
    type: "text",
    text: "กรุณาอ่านเงื่อนไขให้ครบถ้วน แล้วกด “ยืนยันรับทราบ”\nเมื่อต้องการชำระ กรุณากด “ชำระยอด” หรือ “ยอดปิด” เพื่อรับ QR ที่กำหนดยอดถูกต้อง",
    quickReply: { items: [{ type: "action", action: { type: "message", label: "ยืนยันรับทราบ", text: "ยืนยันรับทราบเงื่อนไข" } }] },
  };
}

function customerWelcomeAmount(value, present = true) {
  if (!present || value === null || value === undefined || String(value).trim() === "") return "ไม่มีข้อมูล";
  const raw = String(value).replace(/[,฿]|บาท/g, "").trim();
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount.toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " บาท" : String(value).trim();
}

function customerWelcomeMessage(overview) {
  if (overview?.name && overview?.queue) {
    const fields = [
      ["ชื่อ", String(overview.name)],
      ["คิว", String(overview.queue)],
      ["รุ่น", String(overview.model || "ไม่มีข้อมูล")],
      ["เบอร์โทร", String(overview.phoneMasked || overview.phone || "ไม่มีข้อมูล")],
      ["ยอด", customerWelcomeAmount(overview.principal, overview.principalPresent !== false)],
      ["ค่าเช่า", customerWelcomeAmount(overview.fee, overview.feePresent !== false)],
      ["วันขาย/ฝาก", String(overview.saleDate || "ไม่มีข้อมูล")],
    ];
    const rows = fields.map(([label, value]) => ({
      type: "box", layout: "horizontal", spacing: "md",
      contents: [
        { type: "text", text: label, size: "sm", color: "#60717B", flex: 3 },
        { type: "text", text: value, size: "sm", color: "#173B46", weight: "bold", wrap: true, flex: 5 },
      ],
    }));
    return {
      type: "flex",
      altText: "ผูกบัญชีสำเร็จ • ข้อมูลรายการคิว " + overview.queue,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box", layout: "vertical", paddingAll: "20px", spacing: "sm", backgroundColor: "#0D5D65",
          contents: [
            { type: "text", text: "ผูกบัญชีสำเร็จ", size: "lg", color: "#FFFFFF", weight: "bold" },
            { type: "text", text: "ข้อมูลรายการของคุณ", size: "sm", color: "#D8F2EF" },
          ],
        },
        body: {
          type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
          contents: [
            ...rows,
            { type: "separator", margin: "md", color: "#DDE9EA" },
            { type: "text", text: "ยอดและค่าเช่าอ้างอิงจากรายการในชีต ณ วันที่ตรวจสอบ", size: "xs", color: "#73848B", wrap: true, margin: "md" },
          ],
        },
        footer: customerPersistentFooter(),
      },
      quickReply: customerSelfQuickReply(),
    };
  }
  return customerResultMessage([
      "ผูกบัญชีสำเร็จแล้ว เริ่มใช้งานได้เลยครับ 👇",
      "กดปุ่มด้านล่างเพื่อดูข้อมูลของตัวเอง:",
      "• ชำระยอด — ค่าเช่า ค่าปรับ และ QR ระบุยอด",
      "• ยอดปิด — ยอดสำหรับปิดรายการวันนี้",
      "• สถานะ — สถานะรายการปัจจุบัน",
      "• ข้อมูล — ตรวจข้อมูลรายการที่ผูกไว้",
      "• สิทธิ์ส่วนลด — ตรวจสิทธิ์ลดค่าเช่าเมื่อปิดยอด",
      "• ติดต่อแอดมิน — ส่งคำขอถึงเจ้าหน้าที่",
      "บนมือถือยังมีเมนูลูกค้าด้านล่างแชทด้วย",
    ].join("\n"), "เริ่มใช้งาน");
}

function ownerNotificationFieldQuickReply(source, sheet, autoEnabled = false) {
  const key = source + "|" + sheet;
  return {
    items: [
      ["ยอดปิดทั้งหมด", "ส่งแจ้ง " + key + " close"],
      ["ยอดค้างทั้งหมด", "ส่งแจ้ง " + key + " outstanding"],
      ["กำหนดชำระทั้งหมด", "ส่งแจ้ง " + key + " due"],
      [autoEnabled ? "ปิดแจ้งอัตโนมัติ" : "เปิดแจ้งอัตโนมัติ", "แจ้งอัตโนมัติ " + key + " " + (autoEnabled ? "ปิด" : "เปิด")],
    ].map(([label, text]) => ({
      type: "action",
      action: { type: "message", label, text },
    })),
  };
}

function formatMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "0";
}

function formatCustomerSelfResult(result, field) {
  const items = Array.isArray(result?.items) ? result.items : [];
  if (!result?.bound) return result?.message || "ยังไม่ได้ผูกบัญชี";
  if (!items.length) return "บัญชีผูกแล้ว แต่ไม่พบข้อมูลลูกค้าต้นทาง กรุณาติดต่อเจ้าหน้าที่";

  const blocks = items.slice(0, 5).map((x) => {
    const head = (x.name || "ลูกค้า") + (x.queue ? " | คิว " + x.queue : "");
    if (field === "payment") {
      return [head, "ค่าเช่า: " + formatMoney(x.accumulatedFee) + " บาท", "ค่าปรับ: " + formatMoney(x.lateFee) + " บาท", "รวมยอดชำระวันนี้: " + formatMoney(x.paymentTotal) + " บาท", "วันครบกำหนด: " + (x.dueDate || "-")].join("\n");
    }
    if (field === "close") {
      return [head, "ยอดปิดวันนี้: " + formatMoney(x.calculatedClose) + " บาท", x.discountEligible ? "มีสิทธิ์ลดค่าเช่า " + x.discountPercent + "%" : null, "คำนวณ ณ " + x.calculatedAt].filter(Boolean).join("\n");
    }
    if (field === "fee") {
      return [head, "ค่าเช่า: " + formatMoney(x.accumulatedFee) + " บาท", x.lateFee ? "ค่าปรับ: " + formatMoney(x.lateFee) + " บาท" : null].filter(Boolean).join("\n");
    }
    if (field === "due") {
      return [head, "วันครบกำหนดชำระ: " + (x.dueDate || "-"), x.overdueDays > 0 ? "เกินกำหนด " + x.overdueDays + " วัน" : null].filter(Boolean).join("\n");
    }
    if (field === "outstanding") {
      const outstanding = Number(x.outstanding || 0) > 0 ? Number(x.outstanding || 0) : Number(x.accumulatedFee || 0) + Number(x.lateFee || 0);
      return [head, "ยอดค้าง: " + formatMoney(outstanding) + " บาท"].join("\n");
    }
    if (field === "status") {
      return [head, "สถานะ: " + (x.status || "-"), x.overdueDays > 0 ? "ค้าง " + x.overdueDays + " วัน" : "ยังไม่เกินกำหนด"].join("\n");
    }
    if (field === "info") {
      return [
        "ชื่อ: " + (x.name || "-"),
        "คิว: " + (x.queue || "-"),
        "รุ่น: " + (x.model || "-"),
        "เบอร์โทร: " + (x.phoneMasked || x.phone || "-"),
        "ยอด: " + formatMoney(x.principal) + " บาท",
        "ค่าเช่า: " + formatMoney(x.fee) + " บาท",
        "วันขาย/ฝาก: " + (x.saleDate || "-"),
        "สถานะ: " + (x.status || "-"),
      ].join("\n");
    }
    if (field === "discount") {
      return [
        head,
        x.discountEligible
          ? "มีสิทธิ์ลดค่าเช่า " + x.discountPercent + "%"
          : "ตอนนี้ยังไม่มีสิทธิ์ส่วนลดปิดยอด",
        "ยอดปิดวันนี้: " + formatMoney(x.calculatedClose) + " บาท"
      ].join("\n");
    }
    return [
      head,
      "ยอดปิดวันนี้: " + formatMoney(x.calculatedClose) + " บาท",
      "วันจ่าย: " + (x.dueDate || "-"),
      x.overdueDays > 0 ? "ค้าง " + x.overdueDays + " วัน" : null,
    ].filter(Boolean).join("\n");
  });

  return blocks.join("\n\n");
}


async function broadcastStaffSubmittedSlip(event) {
  if (event.source?.type !== "user" || event.message?.type !== "image") return { handled:false };
  const lineUserId = String(event.source?.userId || "").trim();
  if (!lineUserId) return { handled:false };

  const sender = await callSheetsBridge({
    action: "checkAccess",
    lineUserId,
    sourceType: "user",
    permission: "ดูข้อมูลลูกค้า",
  });
  const allowedRoles = new Set(["เจ้าของ","แอดมิน","admin","Admin","เจ้าหน้าที่","พนักงาน","staff","Staff"]);
  if (!sender?.allowed || !allowedRoles.has(sender.role)) return { handled:false };

  const lookup = await callSheetsBridge({
    action: "getStaffSlipRecipients",
    lineUserId,
    sourceType: "user",
  });
  if (!lookup?.allowed) return { handled:false };

  const recipients = [...new Set(lookup.recipients || [])];
  const base = String(process.env.PUBLIC_BASE_URL || "https://admin-id-bot.vercel.app").replace(/\/$/, "");
  const imageUrl = base + "/api/line/webhook?slip=" + encodeURIComponent(slipImageToken(event.message.id));
  const sentAt = new Date(event.timestamp || Date.now()).toLocaleString("th-TH", { timeZone:"Asia/Bangkok" });
  const senderName = sender.staffName || sender.role || "เจ้าหน้าที่";
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    const access = await callSheetsBridge({
      action: "checkAccess",
      lineUserId: to,
      sourceType: "user",
      permission: "ดูข้อมูลลูกค้า",
    });
    if (!access?.allowed || !allowedRoles.has(access.role)) continue;

    const payment = await callSheetsBridge({
      action: "checkAccess",
      lineUserId: to,
      sourceType: "user",
      permission: "บันทึกชำระ",
    });

    const messages = [
      {
        type: "text",
        text: [
          "ได้รับรูปสลิปจากทีม — รอตรวจสอบ",
          "ส่งโดย: " + senderName,
          "ส่งเมื่อ: " + sentAt,
          "ยังไม่ได้ระบุลูกค้า/คิวจากรูปนี้",
          "กรุณาตรวจยอดเงินจริงก่อนรับชำระ"
        ].join("\n"),
      },
      { type:"image", originalContentUrl:imageUrl, previewImageUrl:imageUrl },
    ];

    if (payment?.allowed) {
      messages.push({
        type:"flex",
        altText:"รับชำระ / ระบุลูกค้าและยอด",
        contents:{
          type:"bubble",
          size:"mega",
          header:{
            type:"box", layout:"vertical", paddingAll:"16px", backgroundColor:"#0D5D65",
            contents:[
              { type:"text", text:"ตรวจสอบการชำระ", color:"#FFFFFF", size:"lg", weight:"bold" },
              { type:"text", text:"รูปที่ส่งโดยทีม • ยังไม่ได้ระบุคิว", color:"#D8F2EF", size:"sm", margin:"sm", wrap:true },
            ],
          },
          body:{
            type:"box", layout:"vertical", paddingAll:"16px", spacing:"sm",
            contents:[
              { type:"text", text:"กดรับชำระ แล้วระบุเลขคิวและยอดชำระจริงในขั้นถัดไป", size:"sm", color:"#173B46", wrap:true },
              { type:"separator", margin:"md", color:"#DDE9EA" },
              { type:"text", text:"รายการจะเข้าคิวตรวจสอบก่อน และยังไม่แก้ยอดในชีตต้นทางอัตโนมัติ", size:"xs", color:"#73848B", wrap:true, margin:"md" },
            ],
          },
          footer:{
            type:"box", layout:"vertical", paddingAll:"14px", backgroundColor:"#F1F8F8",
            contents:[
              { type:"button", style:"primary", color:"#0D5D65", height:"sm",
                action:{ type:"message", label:"รับชำระ", text:"รับชำระ" } },
            ],
          },
        },
      });
    }

    try {
      await pushMessage(to, messages);
      sent++;
    } catch (error) {
      failed++;
      console.warn("Staff slip broadcast push failed", { to, error: error?.message });
    }
  }

  await safeLogAction({
    lineUserId,
    staffName: sender.staffName || "",
    role: sender.role || "",
    command: "ส่งรูปสลิปให้ทีม",
    query: "",
    source: "LINE ส่วนตัว",
    result: "แจ้งสำเร็จ " + sent + " ไม่สำเร็จ " + failed,
    actionName: "staffSlipBroadcast",
    status: failed || !sent ? "รอดำเนินการ" : "สำเร็จ",
    note: "รูปจากเจ้าหน้าที่ ยังไม่ได้ระบุลูกค้า/คิว",
  });

  return { handled:true, sent, failed };
}

async function handleSlipResendPostback(event) {
  if (event.type !== "postback" || event.source?.type !== "user") return false;
  const data = String(event.postback?.data || "");
  if (!data.startsWith("resendSlip=")) return false;

  const requesterLineUserId = String(event.source?.userId || "").trim();
  const token = decodeURIComponent(data.slice("resendSlip=".length));
  const payload = verifyResendSlipToken(token);
  if (!payload) {
    await replyMessage(event.replyToken, [{ type:"text", text:"ลิงก์ส่งซ้ำหมดอายุหรือไม่ถูกต้อง" }]);
    return true;
  }

  const access = await callSheetsBridge({
    action:"checkAccess",
    lineUserId:requesterLineUserId,
    sourceType:"user",
    permission:"ดูข้อมูลลูกค้า",
  });
  const allowedRoles = new Set(["เจ้าของ","แอดมิน","admin","Admin","เจ้าหน้าที่","พนักงาน","staff","Staff"]);
  if (!access?.allowed || !allowedRoles.has(access.role)) {
    await replyMessage(event.replyToken, [{ type:"text", text:"บัญชีนี้ไม่มีสิทธิ์ส่งสลิปซ้ำ" }]);
    return true;
  }

  const synthetic = {
    source:{ type:"user", userId:payload.customerLineUserId },
    message:{ type:"image", id:payload.messageId },
    timestamp:Date.now(),
    _retrySalt:"manual-resend:" + String(event.postback?.params?.datetime || event.replyToken || requesterLineUserId),
  };

  const result = await notifyCustomerSlip(synthetic);
  await safeLogAction({
    lineUserId:requesterLineUserId,
    staffName:access.staffName || "",
    role:access.role || "",
    command:"ส่งสลิปซ้ำ",
    query:"",
    source:"LINE ส่วนตัว",
    result:result?.handled ? ("ส่งซ้ำสำเร็จ " + (result.sent || 0) + " คน") : "ส่งซ้ำไม่สำเร็จ",
    actionName:"customerSlipResend",
    status:result?.handled && result.sent ? "สำเร็จ" : "ไม่สำเร็จ",
    note:"ส่งจากปุ่มสลิปเดิม",
  });

  await replyMessage(event.replyToken, [{
    type:"text",
    text: result?.handled && result.sent
      ? "ส่งสลิปซ้ำให้ทีมแล้ว " + result.sent + " คน"
      : "ยังส่งสลิปซ้ำไม่ได้ รูปอาจหมดอายุหรือข้อมูลลูกค้าไม่พร้อม"
  }]);
  return true;
}

async function handleEvent(event) {
  if (await handleSlipResendPostback(event)) return;

  if (event.type === "follow") {
    await replyMessage(event.replyToken, [{
      type: "text",
      text: [
        "ยินดีต้อนรับครับ",
        "กรุณาส่ง คิว + ชื่อ + นามสกุล ให้ตรงกับข้อมูลในระบบ",
        "ตัวอย่าง: 6101 สมชาย ใจดี"
      ].join("\n")
    }]);
    return;
  }

  if (event.type !== "message") return;

  if (process.env.CUSTOMER_TAKEOVER_PAUSE_ENABLED === "true" && event.source?.type === "user" && event.source?.userId) {
    const incomingText = event.message?.type === "text"
      ? String(event.message.text || "").trim()
      : "";
    const isResumeCommand = /^เปิดบอตลูกค้า\s+\S+$/.test(incomingText);
    if (!isResumeCommand) {
      try {
        const pauseState = await callSheetsBridge({
          action: "getCustomerConversationPause",
          lineUserId: event.source.userId,
        });
        if (pauseState?.paused) return;
      } catch (error) {
        console.warn("Customer pause lookup failed", error);
      }
    }
  }

  if (event.message?.type === "image") {
    const lineUserId = event.source?.userId || "";
    const sourceType = event.source?.type || "";
    const groupId = event.source?.groupId || "";
    if (!lineUserId) return;

    try {
      const alert = await notifyCustomerSlip(event);
      if (alert.handled) {
        await replyMessage(event.replyToken, [{ type: "text", text: alert.sent
          ? "ได้รับรูปแล้ว แจ้งแอดมิน/เจ้าของให้ตรวจสอบแล้วครับ\nยังไม่ยืนยันยอดชำระจนกว่าจะตรวจสอบเรียบร้อย"
          : "ได้รับรูปแล้ว แต่ยังแจ้งผู้ตรวจสอบไม่สำเร็จ กรุณาติดต่อแอดมินครับ" }]);
        return;
      }
      const staffAlert = await broadcastStaffSubmittedSlip(event);
      if (staffAlert.handled) {
        await replyMessage(event.replyToken, [{
          type: "text",
          text: staffAlert.sent
            ? "ส่งรูปสลิปให้ทีมตรวจสอบแล้ว " + staffAlert.sent + " คน\nผู้ที่มีสิทธิ์บันทึกชำระจะเห็นปุ่ม “รับชำระ”"
            : "รับรูปแล้ว แต่ยังส่งต่อให้ทีมไม่สำเร็จ"
        }]);
        return;
      }
      const [identityResult, slipResult] = await Promise.all([
        callSheetsBridge({
          action: "rememberRecentImage",
          lineUserId,
          sourceType,
          groupId,
          messageId: event.message?.id || "",
        }).catch(() => null),
        callSheetsBridge({
          action: "rememberSlipMessage",
          lineUserId,
          sourceType,
          groupId,
          messageId: event.message?.id || "",
        }).catch(() => null),
      ]);

      if (identityResult?.remembered) {
        await replyMessage(event.replyToken, [{
          type: "text",
          text: "รับรูปแล้ว เก็บไว้ชั่วคราว 10 นาที\nถ้าเป็นบัตรประชาชน กด “อ่านบัตรรูปล่าสุด”\nหรือกด “กรอกชื่อเอง”",
          quickReply: staffImageQuickReply(),
        }]);
        return;
      }

      if (slipResult?.remembered) {
        await replyMessage(event.replyToken, [{
          type: "text",
          text: "รับรูปสลิปแล้ว\nภายใน 10 นาที พิมพ์ ยืนยันสลิป <ชื่อ/เบอร์/คิว/Apple ID>",
        }]);
        return;
      }

      await replyMessage(event.replyToken, [{
        type: "text",
        text: identityResult?.message || slipResult?.message || "ยังไม่สามารถรับรูปได้",
      }]);
    } catch (error) {
      console.error("Image capture failed", error);
      await replyMessage(event.replyToken, [{
        type: "text",
        text: "รับรูปไม่สำเร็จ กรุณาลองใหม่"
      }]);
    }
    return;
  }

  if (event.message?.type !== "text") return;

  const text = String(event.message.text || "").trim();

  if (text.toLowerCase() === "ping") {
    await replyMessage(event.replyToken, [
      { type: "text", text: "Admin ID Bot: pong" },
    ]);
    return;
  }

  if (text.toLowerCase() === "myid") {
    const lineUserId = event.source?.userId || "";
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: lineUserId
          ? `LINE User ID ของคุณ:\n${lineUserId}`
          : "ไม่พบ LINE User ID",
      },
    ]);
    return;
  }

  if (!text) return;

  let auditAction = "รับข้อความ";
  try {
    const lineUserId = event.source?.userId || "";
    const sourceType = event.source?.type || "";
    const groupId = event.source?.groupId || "";

    const resumeCustomerMatch = text.match(/^เปิดบอตลูกค้า\s+(\S+)$/);
    if (sourceType === "user" && lineUserId && resumeCustomerMatch) {
      const targetLineUserId = resumeCustomerMatch[1];
      const resumed = await callSheetsBridge({
        action: "setCustomerConversationPause",
        lineUserId,
        targetLineUserId,
        paused: false,
      });
      await replyMessage(event.replyToken, [{
        type: "text",
        text: resumed?.changed
          ? "จบการคุยแล้ว เปิดบอตให้ลูกค้ารายนี้เรียบร้อย"
          : (resumed?.message || "ยังเปิดบอตให้ลูกค้ารายนี้ไม่ได้")
      }]);
      await safeLogAction({
        lineUserId,
        staffName: resumed?.actorName || "",
        role: resumed?.actorRole || "",
        command: "เปิดบอตลูกค้า",
        query: targetLineUserId,
        source: "LINE ส่วนตัว",
        result: resumed?.changed ? "เปิดตอบอัตโนมัติ" : "ไม่สำเร็จ",
        actionName: "customerHumanTakeoverResume",
        status: resumed?.changed ? "สำเร็จ" : "ไม่สำเร็จ",
        note: resumed?.message || "",
      });
      return;
    }

    if (sourceType === "user" && lineUserId && (text === "เข้าเว็บ" || text === "เปิดเว็บ")) {
      const webAccess = await callSheetsBridge({
        action: "checkAccess",
        lineUserId,
        sourceType,
        groupId,
        permission: "จัดการเจ้าหน้าที่",
        allowSystemControl: true,
      });
      if (!webAccess?.allowed || String(webAccess?.role || "").trim() !== "เจ้าของ") {
        await replyMessage(event.replyToken, [{ type: "text", text: "เมนูเว็บสำหรับเจ้าของระบบเท่านั้น" }]);
        return;
      }
      const token = createWebSession({
        lineUserId,
        staffName: webAccess.staffName || "เจ้าของ",
        role: "เจ้าของ",
      });
      const url = "https://admin-id-bot.vercel.app/?token=" + encodeURIComponent(token);
      await replyMessage(event.replyToken, [{
        type: "text",
        text: "ลิงก์เข้าเว็บหลังบ้าน (ใช้ได้ 4 ชั่วโมง)\n" + url + "\n\nห้ามส่งต่อลิงก์นี้ให้ผู้อื่น"
      }]);
      await safeLogAction({
        lineUserId,
        staffName: webAccess.staffName || "",
        role: "เจ้าของ",
        command: "เข้าเว็บ",
        query: "",
        source: "LINE ส่วนตัว",
        result: "ออกลิงก์เข้าเว็บ",
        actionName: "webLogin",
        status: "สำเร็จ",
        note: "session 4 ชั่วโมง",
      });
      return;
    }

    let command = parseCommand(text);

    // A bare "queue amount" message is unambiguous payment input.
    // Convert it before customer binding so "310-4 1200" can never become a name-binding attempt.
    if (!command && sourceType === "user" && lineUserId) {
      const barePayment = text.match(/^(\S+)\s+([0-9,]+(?:\.\d{1,2})?)$/);
      if (barePayment) {
        command = {
          prefix: "รับชำระ",
          action: "queuePayment",
          permission: "บันทึกชำระ",
          privateOnly: true,
          query: barePayment[1],
          amount: Number(barePayment[2].replace(/,/g, "")),
        };
      }
    }

    // Customer self-service must not consume text that has already been recognized as a staff command.
    if (sourceType === "user" && lineUserId && !command) {
      const customerField = customerFieldForText(text);

      const explicitBindingMatch = text.match(/^ผูกบัญชี\s+(\S+)\s+(.+\S)$/);
      const plainBindingMatch = text.match(/^(?:คิว\s*)?(\d{3,}(?:-\d+)*)\s+(.+\S)$/);
      const bindingMatch = explicitBindingMatch || plainBindingMatch;

      if (text === "ผูกบัญชี") {
        await logCustomerOutcome(lineUserId, "ผูกบัญชี", "ข้อมูลไม่ครบ", "รูปแบบไม่ถูกต้อง", "กรุณาระบุคิวและชื่อเต็ม");
        await replyMessage(event.replyToken, [{
          type: "text",
          text: "กรุณาแจ้ง คิว + ชื่อ + นามสกุล\nตัวอย่าง: 6101 สมชาย ใจดี"
        }]);
        return;
      }

      if (!bindingMatch && (/^ผูกบัญชี\s/.test(text) || /^(?:คิว\s*)?\d{3,}(?:-\d+)*$/.test(text))) {
        await logCustomerOutcome(lineUserId, "ผูกบัญชี", "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง", "รูปแบบไม่ถูกต้อง");
        await replyMessage(event.replyToken, [{
          type: "text", text: "กรุณาแจ้ง คิว + ชื่อ + นามสกุล\nตัวอย่าง: 610-21 สมชาย ใจดี"
        }]);
        return;
      }

      if (bindingMatch) {
        auditAction = "ผูกบัญชี";
        const queue = bindingMatch[1];
        const fullName = bindingMatch[2].trim();

        await startLoading(lineUserId, 60);
        const progressPromise = showCustomerProgress(lineUserId);

        // If this LINE account is already bound, lock it to that customer before any new lookup.
        const [result] = await Promise.all([callSheetsBridge({
          action: "requestCustomerBinding",
          lineUserId,
          queue,
          fullName,
        }), progressPromise]);

        // A binding can be committed even if the bridge omits its reply text.
        // Confirm the persisted identity before telling a real customer it failed.
        let confirmed = !!result?.bound && !result?.suspended && !result?.rejectedNewIdentity;
        let replyText = result?.message;
        if (!replyText) {
          console.warn("Customer binding returned without a message", {
            ok: result?.ok, bound: result?.bound, suspended: result?.suspended,
          });
          if (!confirmed) {
            try {
              const current = await callSheetsBridge({
                action: "getCustomerSelf", lineUserId, field: "status",
              });
              const customer = current?.items?.[0] || {};
              confirmed = !!current?.bound &&
                String(customer.queue || "").trim() === queue &&
                String(customer.name || "").trim().replace(/\s+/g, " ") === fullName.replace(/\s+/g, " ");
            } catch (error) {
              console.warn("Could not confirm customer binding after missing reply", error);
            }
          }
          replyText = confirmed
            ? "ผูกบัญชีสำเร็จแล้ว\nชื่อ: " + fullName + "\nคิว: " + queue
            : "ยังยืนยันการผูกบัญชีไม่ได้ กรุณาพิมพ์ สถานะ เพื่อตรวจสอบก่อนลองใหม่";
        }
        const overview = result?.customerOverview;
        const verifiedOverview = confirmed && overview &&
          String(overview.queue || "").trim() === queue &&
          String(overview.name || "").trim().replace(/\s+/g, " ") === fullName.replace(/\s+/g, " ")
          ? overview : null;
        await replyMessage(event.replyToken, confirmed && verifiedOverview
          ? [customerWelcomeMessage(verifiedOverview), customerTermsImageMessage(), customerTermsAckMessage()]
          : [
              { type: "text", text: replyText },
              ...(confirmed ? [customerWelcomeMessage(), customerTermsImageMessage(), customerTermsAckMessage()] : []),
            ]);
        if (confirmed) await safeLinkCustomerMenu(lineUserId);
        return;
      }

      if (text === "ยกเลิกผูกบัญชี") {
        await replyMessage(event.replyToken, [{ type: "text", text: "บัญชีที่ผูกแล้วเปลี่ยนเองไม่ได้ กรุณาติดต่อแอดมินเพื่อระงับหรือแก้ไขข้อมูล" }]);
        return;
      }

      if (text === "ยืนยันรับทราบเงื่อนไข") {
        const self = await callSheetsBridge({ action: "getCustomerSelf", lineUserId, field: "status" });
        if (!self?.bound) {
          await logCustomerOutcome(lineUserId, text, "ยังไม่ผูกบัญชี", "ไม่มีสิทธิ์");
          await replyMessage(event.replyToken, [{ type: "text", text: "ได้รับข้อมูลแล้ว กำลังรอตรวจสอบ กรุณารอสักครู่นะครับ" }]);
          return;
        }
        await logCustomerOutcome(lineUserId, text, "ลูกค้ายืนยันรับทราบเงื่อนไข", "สำเร็จ");
        await replyMessage(event.replyToken, [customerResultMessage("บันทึกการยืนยันรับทราบเงื่อนไขเรียบร้อยแล้ว\nกรุณาชำระให้ตรงตามวันและยอดที่ระบบแจ้ง", "ยืนยันเรียบร้อย")]);
        await safeLinkCustomerMenu(lineUserId);
        return;
      }

      if (text === "ติดต่อแอดมิน") {
        auditAction = "ติดต่อแอดมิน";
        const result = await callSheetsBridge({
          action: "getCustomerContactRecipients",
          lineUserId,
        });
        if (!result?.bound) {
          await logCustomerOutcome(lineUserId, text, result?.message || "ยังไม่ได้ผูกบัญชี", "ไม่มีสิทธิ์");
          await replyMessage(event.replyToken, [{ type: "text", text: result?.message || "ยังไม่ได้ผูกบัญชี" }]);
          return;
        }
        const c = result.customer || {};
        let pauseResult = null;
        try {
          pauseResult = await callSheetsBridge({
            action: "setCustomerConversationPause",
            lineUserId,
            targetLineUserId: lineUserId,
            paused: true,
          });
        } catch (error) {
          console.warn("Could not pause customer bot for human takeover", error);
        }
        const pausedForHuman = !!pauseResult?.changed && pauseResult?.paused === true;
        const alertText = [
          "ลูกค้าต้องการติดต่อแอดมิน",
          "ชื่อ: " + (c.name || "-"),
          "คิว: " + (c.queue || "-"),
          "ชีต: " + [c.source, c.sheet].filter(Boolean).join(" / "),
          "LINE User ID: " + (c.lineUserId || lineUserId),
          "เวลา: " + new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(new Date()),
          pausedForHuman ? "สถานะ: พักบอตแล้ว / แอดมินรับช่วง" : "สถานะ: ยังพักบอตไม่สำเร็จ",
        ].join("\n");
        const adminAlertMessage = {
          type: "text",
          text: alertText,
          ...(pausedForHuman ? {
            quickReply: {
              items: [{
                type: "action",
                action: {
                  type: "message",
                  label: "จบการคุย / เปิดบอต",
                  text: "เปิดบอตลูกค้า " + lineUserId,
                }
              }]
            }
          } : {})
        };
        const outcomes = await Promise.allSettled(
          (result.recipients || []).map((id) => pushMessage(id, [adminAlertMessage]))
        );
        const delivered = outcomes.filter((x) => x.status === "fulfilled").length;
        await safeLogAction({
          lineUserId, staffName: c.name || "", role: "ลูกค้า", command: "ติดต่อแอดมิน",
          query: c.queue || "", source: [c.source, c.sheet].join("/"),
          result: "ส่งสำเร็จ " + delivered + "/" + outcomes.length,
          actionName: "customerContactDelivery", status: delivered ? "สำเร็จ" : "ไม่สำเร็จ", note: ""
        });
        await replyMessage(event.replyToken, [{
          type: "text",
          text: delivered
            ? (pausedForHuman
                ? "ส่งแจ้งแอดมินแล้วครับ\nแอดมินกำลังรับช่วงการสนทนา บอตจะหยุดตอบชั่วคราวจนกว่าแอดมินจะเปิดกลับ"
                : "ส่งแจ้งแอดมินแล้วครับ กรุณารอสักครู่")
            : "ยังส่งแจ้งแอดมินไม่สำเร็จ กรุณาลองอีกครั้ง"
        }]);
        await safeLinkCustomerMenu(lineUserId);
        return;
      }

      if (customerField) {
        auditAction = text;
        const field = customerField;
        const lookupStartedAt = Date.now();
        await startLoading(lineUserId, 60);
        const progressPromise = showCustomerProgress(lineUserId);
        const [result] = await Promise.all([callSheetsBridge({
          action: "getCustomerSelf",
          lineUserId,
          field,
        }), progressPromise]);
        const resultText = formatCustomerSelfResult(result, field);
        const message = result.bound
          ? (["payment", "close"].includes(field) ? customerPaymentMessage(result, field) : customerResultMessage(resultText, field === "info" ? "ข้อมูลลูกค้า" : "ข้อมูลล่าสุด"))
          : { type: "text", text: resultText };
        const hasItems = Array.isArray(result?.items) && result.items.length > 0;
        await replyMessage(event.replyToken, [message]);
        console.info("Customer self response timing", {
          field,
          bridgeMs: Date.now() - lookupStartedAt,
        });
        await Promise.allSettled([
          logCustomerOutcome(
            lineUserId, text,
            !result?.bound ? (result?.message || "ยังไม่ได้ผูกบัญชี") :
              hasItems ? "แสดงข้อมูลลูกค้า" : "ไม่พบข้อมูลต้นทาง",
            !result?.bound ? "ไม่มีสิทธิ์" : hasItems ? "สำเร็จ" : "ข้อมูลไม่ตรง",
            hasItems ? "" : (result?.bound ? "ข้อมูลต้นทางหายหรือชื่อไม่ตรง" : "")
          ),
          result.bound && !result.suspended ? safeLinkCustomerMenu(lineUserId) : Promise.resolve(),
        ]);
        return;
      }
    }

    auditAction = command?.action || "ตรวจสิทธิ์";
    const directOwnerValidatedActions = new Set(["readinessCheck"]);
    let access;

    if (directOwnerValidatedActions.has(command?.action)) {
      // readinessCheck performs its own owner validation in Apps Script.
      // Avoid a second pre-check that can incorrectly route the owner into registration fallback.
      access = {
        allowed: true,
        staffName: "",
        role: "เจ้าของ",
      };
    } else {
      access = await callSheetsBridge({
        action: "checkAccess",
        lineUserId,
        sourceType,
        groupId,
        permission: command?.permission || "ดูข้อมูลลูกค้า",
        allowGroupSetup: ["setGroupEnabled", "getGroupStatus", "setGroupNotification"].includes(command?.action),
        allowSystemControl: ["setBotSwitch", "getBridgeVersion"].includes(command?.action),
      });
    }

    if (!access.allowed) {
      // A verified customer must stay in the customer experience even when the text
      // is not one of the known buttons; never show the staff/Admin-ID denial.
      try {
        const self = await callSheetsBridge({ action: "getCustomerSelf", lineUserId, field: "status" });
        if (self?.bound) {
          await logCustomerOutcome(lineUserId, text, "ไม่พบตัวเลือกลูกค้า", "ไม่เข้าใจคำสั่ง");
          await replyMessage(event.replyToken, [customerResultMessage("หากมีข้อสงสัยเพิ่มเติมนอกจากตัวเลือก กรุณากด “ติดต่อแอดมิน”", "เลือกบริการที่ต้องการ")]);
          await safeLinkCustomerMenu(lineUserId);
          return;
        }
      } catch (error) {
        console.warn("Customer fallback check failed", error);
      }
      const registration = await callSheetsBridge({
        action: "registerStaff",
        lineUserId,
        staffName: text,
      });

      if (registration?.registered || registration?.alreadyRegistered) {
        await safeLogAction({
          lineUserId, staffName: registration.staffName || "", role: "เจ้าหน้าที่",
          command: "ขอสิทธิ์เจ้าหน้าที่", query: "", source: sourceType,
          result: registration.message || "รออนุมัติ", actionName: "registerStaff",
          status: registration.pendingApproval ? "รออนุมัติ" : "ลงทะเบียนแล้ว", note: access.message || ""
        });
        if ((registration?.registered || registration?.pendingApproval) && Array.isArray(registration.ownerLineUserIds)) {
          const staffName = registration.staffName || text;
          const ownerText = [
            "มีเจ้าหน้าที่ขออนุมัติ",
            "ชื่อ: " + staffName
          ].filter(Boolean).join("\n");

          const ownerMessage = {
            type: "text",
            text: ownerText,
            quickReply: {
              items: [
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "อนุมัติ",
                    text: "อนุมัติ " + staffName
                  }
                },
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "ไม่อนุมัติ",
                    text: "ไม่อนุมัติ " + staffName
                  }
                }
              ]
            }
          };

          await Promise.all(
            registration.ownerLineUserIds.map((ownerId) =>
              pushMessage(ownerId, [ownerMessage]).catch((error) => {
                console.warn("Owner approval alert failed", error);
              })
            )
          );
        }

        await replyMessage(event.replyToken, [
          {
            type: "text",
            text: registration.message || "รออนุมัติ",
          },
        ]);
        return;
      }

      await safeLogAction({
        lineUserId, staffName: "", role: "ไม่พบสิทธิ์", command: command?.action || "ตรวจสิทธิ์",
        query: "", source: sourceType, result: access.message || registration?.message || "ไม่มีสิทธิ์",
        actionName: "checkAccess", status: "ไม่มีสิทธิ์", note: ""
      });
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: "ได้รับข้อมูลแล้ว กำลังรอตรวจสอบ กรุณารอสักครู่นะครับ",
        },
      ]);
      return;
    }

    // Reconcile only this authenticated staff account; never enumerate customers.
    if (sourceType === "user" && text !== "เมนู") {
      try {
        const paymentAccess = await callSheetsBridge({
          action: "checkAccess", lineUserId, sourceType, groupId, permission: "บันทึกชำระ",
        });
        await syncStaffPaymentMenu(lineUserId, !!paymentAccess.allowed);
      } catch (error) {
        console.warn("Staff payment menu could not be updated", error?.message);
      }
    }

    if (access.role === "เจ้าของ" && ["ส่งแจ้งลูกค้า", "ส่งแจ้งเตือนทันที"].includes(text)) {
      const result = await callSheetsBridge({
        action: "listCustomerNotificationSheets",
        lineUserId,
        sourceType,
        groupId,
      });
      const sources = [...new Set((result.items || []).map((x) => x.source))];
      const items = sources.slice(0, 13).map((source) => ({
        type: "action",
        action: {
          type: "message",
          label: String(source).slice(0, 20),
          text: "แจ้งแหล่ง " + source
        }
      }));
      await replyMessage(event.replyToken, [{
        type: "text",
        text: items.length
          ? "เลือกแหล่งข้อมูลก่อน แล้วเลือกชีตที่จะส่งแจ้งลูกค้า"
          : "ยังไม่พบแหล่งข้อมูลที่เปิดใช้งาน",
        ...(items.length ? { quickReply: { items } } : {})
      }]);
      return;
    }

    if (access.role === "เจ้าของ" && text.startsWith("แจ้งแหล่ง ")) {
      const selector = text.slice("แจ้งแหล่ง ".length).trim();
      const pageMatch = selector.match(/^(.*?)\s+(\d+)$/);
      const source = pageMatch ? pageMatch[1] : selector;
      const page = pageMatch ? Math.max(1, Number(pageMatch[2])) : 1;
      const result = await callSheetsBridge({ action: "listCustomerNotificationSheets", lineUserId, sourceType, groupId });
      const sheets = (result.items || []).filter((x) => x.source === source);
      const visible = sheets.slice((page - 1) * 12, page * 12);
      const choices = visible.map((x) => ({
        type: "action", action: { type: "message", label: String(x.sheet).slice(0, 20), text: "แจ้งชีต " + source + "|" + x.sheet }
      }));
      if (sheets.length > page * 12) {
        choices.push({ type: "action", action: { type: "message", label: "ชีตถัดไป", text: "แจ้งแหล่ง " + source + " " + (page + 1) } });
      }
      await replyMessage(event.replyToken, [{
        type: "text",
        text: choices.length ? "เลือกชีตในแหล่ง " + source + " (หน้า " + page + ")" : "ไม่พบชีตในหน้านี้",
        ...(choices.length ? { quickReply: { items: choices } } : {})
      }]);
      return;
    }

    if (access.role === "เจ้าของ" && text.startsWith("แจ้งชีต ")) {
      const key = text.slice("แจ้งชีต ".length).trim();
      const p = key.indexOf("|");
      if (p <= 0) {
        await replyMessage(event.replyToken, [{ type: "text", text: "รูปแบบชีตไม่ถูกต้อง" }]);
        return;
      }
      const source = key.slice(0, p);
      const sheet = key.slice(p + 1);
      const sheetList = await callSheetsBridge({
        action: "listCustomerNotificationSheets",
        lineUserId,
        sourceType,
        groupId,
      });
      const selected = (sheetList.items || []).find((x) => x.source === source && x.sheet === sheet) || {};
      await replyMessage(event.replyToken, [{
        type: "text",
        text: [
          "ชีต: " + sheet,
          "ลูกค้าที่ผูก LINE: " + (selected.count || 0) + " ราย",
          "แจ้งอัตโนมัติ: " + (selected.autoEnabled ? "เปิด" : "ปิด"),
          "",
          "ปุ่มด้านล่าง = ส่งทุกคนในชีต",
          "ส่งรายคน พิมพ์: ส่งแจ้ง " + key + " due <คิว>",
          "ส่งหลายคน พิมพ์: ส่งแจ้ง " + key + " due <คิว1>,<คิว2>",
          "เปลี่ยน due เป็น close หรือ outstanding ได้"
        ].join("\n"),
        quickReply: ownerNotificationFieldQuickReply(source, sheet, !!selected.autoEnabled)
      }]);
      return;
    }

    if (access.role === "เจ้าของ" && text.startsWith("แจ้งอัตโนมัติ ")) {
      const args = text.slice("แจ้งอัตโนมัติ ".length).trim().split(/\s+/);
      const key = args.shift() || "";
      const mode = args.shift() || "";
      const p = key.indexOf("|");
      if (p <= 0 || !["เปิด","ปิด"].includes(mode)) {
        await replyMessage(event.replyToken, [{ type: "text", text: "กรุณาเลือกชีตใหม่จากปุ่ม ส่งแจ้งลูกค้า" }]);
        return;
      }
      const source = key.slice(0, p);
      const sheet = key.slice(p + 1);
      const result = await callSheetsBridge({
        action: "setCustomerAutoReminderSheet",
        lineUserId,
        sourceType,
        groupId,
        source,
        sheet,
        enabled: mode === "เปิด",
      });
      await replyMessage(event.replyToken, [{
        type: "text",
        text: result.message || "ดำเนินการแล้ว",
        quickReply: ownerNotificationFieldQuickReply(source, sheet, mode === "เปิด")
      }]);
      return;
    }

    if (access.role === "เจ้าของ" && text.startsWith("ส่งแจ้ง ")) {
      const args = text.slice("ส่งแจ้ง ".length).trim().split(/\s+/);
      const key = args.shift() || "";
      const field = args.shift() || "";
      const selection = args.shift() || "";
      const p = key.indexOf("|");
      if (p <= 0 || !["close","outstanding","due"].includes(field)) {
        await replyMessage(event.replyToken, [{ type: "text", text: "เลือกรายการส่งใหม่จากปุ่ม ส่งแจ้งลูกค้า" }]);
        return;
      }
      const source = key.slice(0, p);
      const sheet = key.slice(p + 1);
      const batch = await callSheetsBridge({
        action: "buildCustomerNotificationBatch",
        lineUserId,
        sourceType,
        groupId,
        source,
        sheet,
        field,
        ...(selection.includes(",") ? { queues: selection } : { queue: selection }),
      });
      if (!batch?.allowed) {
        await replyMessage(event.replyToken, [{ type: "text", text: batch?.message || "ไม่มีสิทธิ์ส่งแจ้ง" }]);
        return;
      }
      const sentResults = await Promise.all((batch.items || []).map(async (item) => {
        try {
          await pushMessage(item.lineUserId, [{
            type: "text",
            text: item.message,
            quickReply: customerSelfQuickReply(),
          }]);
          await callSheetsBridge({ action: "markCustomerReminderSent", rowNo: item.rowNo, sent: true });
          return true;
        } catch (error) {
          console.warn("Manual customer notification failed", error);
          await callSheetsBridge({ action: "markCustomerReminderSent", rowNo: item.rowNo, sent: false }).catch(() => null);
          return false;
        }
      }));
      const sent = sentResults.filter(Boolean).length;
      const failed = sentResults.length - sent;
      await safeLogAction({
        lineUserId,
        staffName: access.staffName || "",
        role: "เจ้าของ",
        command: "ส่งแจ้งลูกค้า",
        query: source + "/" + sheet + " " + field + (selection ? " " + selection : " ทั้งหมด"),
        source: source + "/" + sheet,
        result: "ส่งสำเร็จ " + sent + " / ไม่สำเร็จ " + failed,
        actionName: "manualCustomerNotification",
        status: failed ? "บางส่วน" : "สำเร็จ",
        note: "",
      });
      await replyMessage(event.replyToken, [{
        type: "text",
        text: batch.items?.length
          ? "ส่งแจ้งลูกค้าแล้ว " + sent + " ราย" + (failed ? "\nส่งไม่สำเร็จ " + failed + " ราย" : "")
          : (batch.message || "ไม่พบลูกค้าที่ผูก LINE ในชีตนี้")
      }]);
      return;
    }

    if (text === "เมนู") {
      const messages = [];
      if (sourceType === "user") {
        const paymentAccess = await callSheetsBridge({
          action: "checkAccess", lineUserId, sourceType, groupId,
          permission: "บันทึกชำระ",
        });
        try {
          await syncStaffPaymentMenu(lineUserId, !!paymentAccess.allowed);
        } catch (error) {
          console.warn("Staff payment menu could not be updated", error?.message);
        }
        if (paymentAccess.allowed) messages.push({
          type: "template",
          altText: "รับชำระ — ส่งเข้าคิวตรวจสอบก่อน",
          template: {
            type: "buttons",
            text: "รับชำระจากลูกค้า\nส่งเข้าคิวตรวจสอบก่อน ยังไม่แก้ยอดในชีตต้นทาง",
            actions: [{ type: "message", label: "รับชำระ", text: "รับชำระ" }],
          },
        });
      }
      messages.push({
        type: "text",
        text: access.role === "เจ้าของ" ? "เมนูเจ้าของ Admin ID" : "เมนู Admin ID",
        quickReply: menuQuickReply(access.role || "")
      });
      await replyMessage(event.replyToken, messages);
      return;
    }

    if (text === "ช่วยเหลือ" || text === "แนะนำการใช้งาน") {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: [
            "คำสั่ง Admin ID",
            "• พิมพ์ชื่อ / เบอร์ / คิว / Apple ID เพื่อค้นหา",
            "• ถ้าคิวซ้ำ ใช้ แหล่ง:คิว เช่น v6:101",
            "• ประวัติ <คำค้น>",
            "• ดูโน้ต <คำค้น>",
            "• โน้ต <คำค้น> <ข้อความ>",
            "• สรุปยอด <คำค้น>",
            "• สิทธิ์ส่วนลด <คำค้น>",
            "• ยอดปิด <คำค้น>",
            "• ค่าเช่า <คำค้น>",
            "• วันจ่าย <คำค้น>",
            "• ยอดค้าง <คำค้น>",
            "• สถานะ <คำค้น>",
            access.role === "เจ้าของ" ? "• รายงานวันนี้ / สถานะระบบ / ตรวจชีตต้นทาง" : null,
            access.role === "เจ้าของ" ? "• คิวตรวจสอบ / ดูคิว <เลข> / ผ่านคิว <เลข> / ไม่ผ่านคิว <เลข>" : null,
            access.role === "เจ้าของ" ? "• เจ้าหน้าที่ / สิทธิ์เจ้าหน้าที่ <ชื่อ> / ระงับ <ชื่อ> / เปิดใช้ <ชื่อ>" : null,
            access.role === "เจ้าของ" ? "• ให้สิทธิ์ <ชื่อ> <สิทธิ์> / ถอนสิทธิ์ <ชื่อ> <สิทธิ์>" : null,
            access.role === "เจ้าของ" ? "• เปิดกลุ่ม / ปิดกลุ่ม / สถานะกลุ่ม" : null,
            access.role === "เจ้าของ" ? "• ติดตั้งแจ้งเตือน / สถานะแจ้งเตือน / ทดสอบแจ้งเตือน" : null
          ].join("\n")
        },
      ]);
      return;
    }

    if (command) {
      if (command.privateOnly && sourceType !== "user") {
        await replyMessage(event.replyToken, [{ type: "text", text: "กรุณากดรับชำระในแชทส่วนตัวกับบอต" }]);
        return;
      }
      if (command.action === "queuePayment" && (!command.query || !Number.isFinite(command.amount) || command.amount <= 0)) {
        await replyMessage(event.replyToken, [{
          type: "text",
          text: "รับชำระ\nพิมพ์: " + command.prefix + " <เลขคิว> <ยอดชำระจริง>\nตัวอย่าง: " + command.prefix + " " + (command.query || "v6:101") + " 500\nยอดต้องมากกว่า 0 บาท หากคิวซ้ำให้ระบุแหล่ง:คิว\nรายการจะเข้าคิวตรวจสอบก่อน ยังไม่แก้ยอดในชีตต้นทาง",
        }]);
        return;
      }
      if (command.action === "verifyCustomerIdentity" && command.prefix === "กรอกชื่อเอง" && command.query && (!command.firstName || !command.lastName)) {
        await replyMessage(event.replyToken, [{
          type: "text",
          text: "พิมพ์ตามนี้ครับ\nกรอกชื่อเอง " + command.query + " <ชื่อ> <นามสกุล> [4ตัวท้าย]\nตัวอย่าง: กรอกชื่อเอง " + command.query + " สมชาย ใจดี 1234"
        }]);
        return;
      }

      if (command.requiresQuery !== false && !command.query) {
        const usage =
          command.action === "verifyCustomerIdentity"
            ? "รูปแบบ: " + command.prefix + " <คำค้น> <ชื่อ> <นามสกุล> [4ตัวท้าย]\nตัวอย่าง: " + command.prefix + " 101 สมชาย ใจดี 1234"
            : command.action === "addNote"
            ? "รูปแบบ: โน้ต <คำค้น> <ข้อความ>"
            : command.action === "queuePayment"
              ? "รูปแบบ: บันทึกชำระ <คำค้น> <ยอด>"
              : command.action === "setStaffPermission"
                ? "รูปแบบ: " + command.prefix + " <ชื่อ> <สิทธิ์>"
                : `รูปแบบ: ${command.prefix} <คำค้น>`;
        await replyMessage(event.replyToken, [{ type: "text", text: usage }]);
        return;
      }

      let groupName = "";
      if (sourceType === "group" && ["setGroupEnabled", "getGroupStatus"].includes(command.action)) {
        const groupSummary = await getGroupSummary(groupId);
        groupName = groupSummary?.groupName || "";
      }

      const payload = {
        action: command.action,
        query: command.query,
        lineUserId,
        sourceType,
        groupId,
        staffName: access.staffName || "",
        role: access.role || "",
        groupName,
      };

      if (command.eventType) payload.eventType = command.eventType;
      if (command.firstName) payload.firstName = command.firstName;
      if (command.lastName) payload.lastName = command.lastName;
      if (command.idLast4) payload.idLast4 = command.idLast4;
      if (command.note) payload.note = command.note;
      if (command.amount != null) payload.amount = command.amount;
      if (command.decision) payload.decision = command.decision;
      if (command.enabled != null) payload.enabled = command.enabled;
      if (command.dueMode) payload.dueMode = command.dueMode;
      if (command.targetPermission) payload.targetPermission = command.targetPermission;
      if (command.permissionEnabled != null) payload.permissionEnabled = command.permissionEnabled;
      if (command.action === "getReminderBatch") payload.force = true;
      if (command.activityToday) payload.activityToday = true;
      if (command.switchKey) payload.switchKey = command.switchKey;

      let result = await callSheetsBridge(payload);

      // If a bare queue lookup returns multiple fuzzy matches, prefer one exact queue match.
      // This prevents queue 310-4 from being confused with a phone number containing 3104.
      if (
        command.action === "queuePayment" &&
        result?.needsSelection &&
        Array.isArray(result.matches) &&
        command.query
      ) {
        const targetQueue = String(command.query || "").trim().toLowerCase().replace(/\s+/g, "");
        const exactQueueMatches = result.matches.filter((m) =>
          String(m?.queue || "").trim().toLowerCase().replace(/\s+/g, "") === targetQueue
        );
        if (exactQueueMatches.length === 1) {
          const exact = exactQueueMatches[0];
          const exactIdentity = String(exact.appleId || exact.phone || exact.name || "").trim();
          const qualifiedQuery = exact.source && exactIdentity
            ? String(exact.source).trim() + ":" + exactIdentity
            : "";
          if (qualifiedQuery) {
            result = await callSheetsBridge({
              ...payload,
              query: qualifiedQuery,
            });
          }
        }
      }

      let responseText = "";
      if (command.action === "getRecentIdentityImages") {
        const items = Array.isArray(result.items) ? result.items : [];

        if (!items.length) {
          responseText = result.message || "ไม่พบรูปล่าสุด";
        } else if (!command.query) {
          responseText = [
            "พบรูปในช่วง 10 นาทีล่าสุด " + items.length + " รูป",
            "พิมพ์คิวต่อท้ายเพื่ออ่านบัตร เช่น",
            "อ่านบัตรล่าสุด 101",
          ].join("\n");
        } else {
          const ocr = await readThaiIdFromRecentImages(items, { lineUserId, sourceType, groupId });

          if (!ocr.found) {
            responseText = [
              "ไม่พบบัตรประชาชนไทยในรูปล่าสุด",
              "ตรวจสูงสุด " + Math.min(items.length, 5) + " รูป",
              "ใช้ปุ่ม “กรอกชื่อเอง” ได้ทันที",
            ].join("\n");
          } else {
            const card = ocr.result || {};
            if (card.hasUsableName && card.firstName && card.lastName) {
              responseText = [
                "พบบัตรประชาชน",
                "คิว: " + command.query,
                "ชื่อ: " + card.firstName,
                "นามสกุล: " + card.lastName,
                card.idLast4 ? "เลขบัตร 4 ตัวท้าย: " + card.idLast4 : null,
                "",
                "ตรวจชื่อให้ถูกต้องก่อนกดยืนยัน",
              ].filter(Boolean).join("\n");

              const confirmText = [
                "บัตรประชาชน",
                command.query,
                card.firstName,
                card.lastName,
                card.idLast4 || "",
              ].filter(Boolean).join(" ");

              await replyMessage(event.replyToken, [{
                type: "text",
                text: responseText,
                quickReply: {
                  items: [
                    {
                      type: "action",
                      action: { type: "message", label: "ยืนยันชื่อ", text: confirmText },
                    },
                    {
                      type: "action",
                      action: { type: "message", label: "กรอกชื่อเอง", text: "กรอกชื่อเอง " + command.query },
                    },
                    {
                      type: "action",
                      action: { type: "message", label: "อ่านใหม่", text: "อ่านบัตรล่าสุด " + command.query },
                    },
                  ],
                },
              }]);
              return;
            }

            responseText = [
              "พบบัตรประชาชน แต่ชื่ออ่านไม่ชัด",
              card.ocrPreview ? "อ่านข้อความได้บางส่วน: " + card.ocrPreview : null,
              "กด “กรอกชื่อเอง” เพื่อบันทึก",
            ].filter(Boolean).join("\n");

            await replyMessage(event.replyToken, [{
              type: "text",
              text: responseText,
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: { type: "message", label: "กรอกชื่อเอง", text: "กรอกชื่อเอง " + command.query },
                  },
                  {
                    type: "action",
                    action: { type: "message", label: "อ่านใหม่", text: "อ่านบัตรล่าสุด " + command.query },
                  },
                ],
              },
            }]);
            return;
          }
        }
      } else if (command.action === "verifyCustomerIdentity") {
        responseText = result.needsSelection
          ? "พบหลายรายการ กรุณาระบุคำค้นให้ชัดขึ้น\n\n" + formatCustomerMatches(result.matches || [])
          : (result.message || (result.verified ? "ยืนยันตัวตนแล้ว" : "ยืนยันตัวตนไม่ได้"));
      } else if (command.action === "listPendingCustomerBindings") {
        const items = Array.isArray(result.items) ? result.items : [];
        responseText = items.length
          ? "ลูกค้ารออนุมัติ (" + items.length + ")\n" + items.slice(0, 10).map((x) =>
              "#" + x.rowNo + " " + (x.name || "-") + " | คิว " + (x.queue || "-") + " | " + (x.source || "-")
            ).join("\n")
          : (result.message || "ไม่มีลูกค้ารออนุมัติ");
      } else if (command.action === "resolveCustomerBinding") {
        responseText = result.message || (result.resolved ? "ดำเนินการแล้ว" : "ดำเนินการไม่ได้");
        if (result.resolved && result.customerLineUserId) {
          const customerText = result.approved
            ? "ผูกบัญชีสำเร็จแล้ว\nพิมพ์ ยอดปิด เพื่อดูยอดปิดของคุณได้ทันที"
            : "คำขอผูกบัญชีไม่ได้รับการอนุมัติ กรุณาติดต่อเจ้าหน้าที่";
          let customerMessage = {
            type: "text", text: customerText,
            ...(result.approved ? { quickReply: customerSelfQuickReply() } : {}),
          };
          if (result.approved) {
            try {
              const self = await callSheetsBridge({ action: "getCustomerSelf", lineUserId: result.customerLineUserId, field: "menu" });
              const overview = (self?.items || []).find((item) =>
                String(item.queue || "").trim() === String(result.queue || "").trim() &&
                String(item.name || "").trim() === String(result.customerName || "").trim()
              );
              if (self?.bound && overview) customerMessage = customerWelcomeMessage(overview);
            } catch (error) {
              console.warn("Could not load approved customer overview", error);
            }
          }
          await pushMessage(result.customerLineUserId, result.approved ? [customerMessage, customerTermsImageMessage(), customerTermsAckMessage()] : [customerMessage])
            .catch((error) => console.warn("Customer binding result push failed", error));
          if (result.approved) await safeLinkCustomerMenu(result.customerLineUserId);
        }
      } else if (command.action === "readinessCheck") {
        if (!Array.isArray(result.checks)) {
          responseText = result.message || "ตรวจความพร้อมไม่ได้";
        } else {
          responseText = [
            "เช็กพร้อมใช้ Admin ID",
            "ผ่าน " + result.passed + "/" + result.total + " (" + result.percent + "%)",
            "",
            ...result.checks.map((x) => (x.pass ? "✓ " : "✗ ") + x.name + (x.detail ? " | " + x.detail : ""))
          ].join("\n");
        }
      } else if (command.action === "setBotSwitch") {
        responseText = result.message || (result.changed ? "อัปเดตระบบแล้ว" : "อัปเดตระบบไม่ได้");
      } else if (command.action === "getBridgeVersion") {
        responseText = "Admin ID\nApps Script version: " + (result.version || "ไม่ทราบ");
      } else if (result.needsSelection) {
        responseText =
          "พบหลายรายการ กรุณาใช้เบอร์โทร / Apple ID หรือระบุ แหล่ง:คิว เช่น v6:101\n\n" +
          formatCustomerMatches(result.matches || []);
      } else if (command.action === "getCustomerInfo") {
        responseText = result.info
          ? formatCustomerInfo(result.info, command.field)
          : "ไม่พบข้อมูลลูกค้า";
      } else if (command.action === "auditSourceWriteCapabilities") {
        const a = result.summary;
        if (!a) {
          responseText = result.message || "ตรวจความพร้อมเขียนต้นทางไม่ได้";
        } else {
          const notReady = (result.items || []).filter((x) => !x.paymentReady || !x.closeReady).slice(0, 8);
          responseText = [
            "ตรวจเขียนต้นทาง",
            "แท็บทั้งหมด: " + a.tabs,
            "อ่านข้อมูลหลักพร้อม: " + a.safeRead,
            "พร้อม mapping ชำระ: " + a.paymentReady,
            "พร้อม mapping ปิดยอด: " + a.closeReady,
            "เขียนจริง: " + (result.writesEnabled ? "เปิด" : "ปิดเพื่อความปลอดภัย"),
            ...(notReady.length ? ["", "ยังต้องตรวจ:", ...notReady.map((x) =>
              "• " + x.source + (x.sheet ? " / " + x.sheet : "") +
              " | พบ " + ((x.fields || []).join(", ") || "หัวตารางไม่ครบ")
            )] : [])
          ].join("\n");
        }
      } else if (command.action === "auditSourceSchemas") {
        const a = result.summary;
        if (!a) {
          responseText = result.message || "ตรวจชีตต้นทางไม่ได้";
        } else {
          const issues = (result.items || []).filter((x) => !x.ready).slice(0, 8);
          responseText = [
            "ตรวจชีตต้นทาง",
            "แหล่งข้อมูล: " + a.sources,
            "แท็บที่ตรวจ: " + a.tabs,
            "พร้อม: " + a.ready,
            "มีจุดต้องตรวจ: " + a.issues,
            ...(issues.length ? ["", "จุดที่ต้องตรวจ:", ...issues.map((x) => "• " + x.source + (x.sheet ? " / " + x.sheet : "") + " : " + (x.missing || []).join(", "))] : [])
          ].join("\n");
        }
      } else if (command.action === "listDueCustomers") {
        const items = Array.isArray(result.items) ? result.items : [];
        const title = command.dueMode === "overdue"
          ? "ค้างชำระ"
          : command.dueMode === "upcoming"
            ? "ใกล้ครบกำหนด"
            : "ครบกำหนดวันนี้";
        responseText = items.length
          ? title + " (" + items.length + ")\n" + items.slice(0, 10).map((x, i) => {
              const lag = x.daysDelta < 0 ? "ค้าง " + Math.abs(x.daysDelta) + " วัน" : (x.daysDelta > 0 ? "อีก " + x.daysDelta + " วัน" : "วันนี้");
              return (i + 1) + ". " + (x.name || "-") + (x.queue ? " | คิว " + x.queue : "") + " | " + (x.dueDate || "-") + " | " + lag;
            }).join("\n") + (items.length > 10 ? "\nแสดง 10 รายการแรก" : "")
          : "ไม่มีรายการ" + title;
      } else if (command.action === "getCalculatedSummary") {
        const s = result.summary;
        if (!s) {
          responseText = "ไม่พบข้อมูลลูกค้า";
        } else if (command.summaryField === "discount") {
          responseText = [
            (s.customer?.name || "-") + (s.customer?.queue ? " / คิว " + s.customer.queue : ""),
            "สิทธิ์ส่วนลด: " + (s.discountEligible ? "มีสิทธิ์" : "ไม่มีสิทธิ์"),
            s.discountEligible ? "ส่วนลดค่าเช่า: " + s.discountPercent + "%" : null,
            s.discountStartDate ? "เริ่มนับสิทธิ์: " + s.discountStartDate : null,
            s.crossCycleOutstanding ? "มีรายการข้ามรอบ จึงงดส่วนลด" : null
          ].filter(Boolean).join("\n");
        } else {
          responseText = [
            (s.customer?.name || "-") + (s.customer?.queue ? " / คิว " + s.customer.queue : ""),
            "เงินต้น: " + Number(s.principal || 0).toLocaleString("th-TH"),
            "ค่าเช่ารวมรอบ: " + Number(s.accumulatedFee || 0).toLocaleString("th-TH"),
            "ค้าง: " + Number(s.overdueDays || 0) + " วัน",
            "ค่าปรับ: " + Number(s.lateFee || 0).toLocaleString("th-TH"),
            "สิทธิ์ลด: " + (s.discountEligible ? s.discountPercent + "%" : "ไม่มี"),
            "ยอดปิดคำนวณ: " + Number(s.calculatedClose || 0).toLocaleString("th-TH"),
            "คำนวณ ณ " + s.calculatedAt
          ].join("\n");
        }
      } else if (command.action === "getStaffActivity") {
        const items = Array.isArray(result.items) ? result.items : [];
        const title = command.activityToday
          ? "กิจกรรมวันนี้"
          : "กิจกรรม " + (result.targetName || command.query || "");
        responseText = items.length
          ? title + "\n" + items.slice(0, 10).map((x, i) => {
              return (i + 1) + ". " + (x.dateTime || "-") + " | " + (x.staffName || "-") +
                " | " + (x.command || x.actionName || "-") +
                (x.query ? " | " + x.query : "") +
                " | " + (x.status || x.result || "-");
            }).join("\n") + (items.length > 10 ? "\nแสดง 10 รายการล่าสุด" : "")
          : (result.message || "ไม่พบกิจกรรม");
      } else if (command.action === "dailyOwnerReport") {
        const r = result.report;
        responseText = r ? [
          "รายงานวันนี้",
          "ใช้งานคำสั่ง: " + r.commandCount,
          "ค้นลูกค้า: " + r.searchCount,
          "ผิดพลาด: " + r.errorCount,
          "คิวรอตรวจ: " + r.pendingReview,
          "เจ้าหน้าที่รออนุมัติ: " + r.pendingStaff
        ].join("\n") : (result.message || "ไม่พบรายงาน");
      } else if (command.action === "systemStatus") {
        const x = result.status;
        responseText = x ? [
          "สถานะระบบ " + x.botName,
          "บอตหลัก: " + (x.masterEnabled ? "เปิด" : "ปิด"),
          "เจ้าหน้าที่: " + (x.staffEnabled ? "เปิด" : "ปิด"),
          "กลุ่ม LINE: " + (x.groupEnabled ? "เปิด" : "ปิด"),
          "แหล่งข้อมูลเปิดใช้: " + x.enabledSources,
          "OK Slip: " + (x.okSlipEnabled ? "เปิด" : "ยังไม่เชื่อม"),
          "Webhook: " + x.webhookStatus,
          "เขียนชีตต้นทาง: " + (x.financialSourceWrites ? "เปิด" : "ปิดเพื่อความปลอดภัย"),
          "แจ้งเตือนลูกค้าโดยตรง: " + (x.reminderInternalOnly ? "ยังปิด" : "เปิด")
        ].join("\n") : (result.message || "ไม่พบสถานะระบบ");
      } else if (command.action === "getHistory") {
        responseText = formatHistory(result.items || []);
      } else if (command.action === "addNote") {
        responseText = result.added
          ? `บันทึกโน้ตแล้ว: ${result.customer?.name || command.query}`
          : "ไม่พบข้อมูลลูกค้า";
      } else if (["queuePayment", "queueSlipReview", "queueClose"].includes(command.action)) {
        responseText = result.message || (result.queued ? "ส่งเข้าคิวตรวจสอบแล้ว" : "ไม่สามารถดำเนินการได้");

        if (result.queued && result.rowNo && Array.isArray(result.ownerLineUserIds)) {
          const customerName = result.customer?.name || command.query || "-";
          const queueText = [
            "มีรายการรอตรวจ",
            "#" + result.rowNo + " | " + (result.type || "-"),
            "ลูกค้า: " + customerName,
            result.amount ? "ยอด: " + result.amount : null,
            "ผู้ส่ง: " + (access.staffName || "-")
          ].filter(Boolean).join("\n");

          const ownerMessage = {
            type: "text",
            text: queueText,
            quickReply: {
              items: [
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "ผ่าน",
                    text: "ผ่านคิว " + result.rowNo
                  }
                },
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "ไม่ผ่าน",
                    text: "ไม่ผ่านคิว " + result.rowNo
                  }
                }
              ]
            }
          };

          await Promise.all(
            result.ownerLineUserIds.map((ownerId) =>
              pushMessage(ownerId, [ownerMessage]).catch((error) => {
                console.warn("Owner review alert failed", error);
              })
            )
          );
        }
      } else if (command.action === "cancelReviewQueue") {
        responseText = result.message || (result.cancelled ? "ยกเลิกคิวแล้ว" : "ยกเลิกคิวไม่ได้");
      } else if (command.action === "planSourceWrite") {
        const p = result.plan;
        responseText = p ? [
          "จำลองบันทึก #" + p.reviewRowNo,
          "ประเภท: " + (p.type || "-"),
          "ต้นทาง: " + (p.source || "-") + " / " + (p.sheet || "-") + " แถว " + (p.sourceRow || "-"),
          "ลูกค้า: " + (p.name || "-") + (p.queue ? " | คิว " + p.queue : ""),
          "สถานะล่าสุด: " + (p.currentStatus || "-"),
          p.requestedAmount ? "ยอดที่ขอ: " + p.requestedAmount : null,
          "เขียนต้นทางจริง: " + (p.writesEnabled ? "เปิด" : "ปิดเพื่อความปลอดภัย"),
          "ฟิลด์ต้นทางที่ตรวจพบ: " + ((p.detectedFields || []).join(", ") || "ไม่พบ"),
          "",
          ...(p.proposed || []).map((x) => "• " + x)
        ].filter(Boolean).join("\n") : (result.message || "จำลองไม่ได้");
      } else if (command.action === "getReviewQueueItem") {
        const x = result.item;
        const live = result.liveCustomer;
        responseText = x ? [
          "คิวตรวจสอบ #" + x.rowNo,
          "ประเภท: " + (x.type || "-"),
          "ลูกค้า: " + (x.name || "-"),
          x.queue ? "คิวลูกค้า: " + x.queue : null,
          x.amount ? "ยอด: " + x.amount : null,
          "แหล่ง: " + (x.source || "-"),
          "ผู้ส่ง: " + (x.staff || "-"),
          "สถานะ: " + (x.status || "-"),
          live ? "ต้นทางล่าสุด: " + (live.status || "-") + (live.dueDate ? " | วันจ่าย " + live.dueDate : "") : "ต้นทางล่าสุด: ไม่พบ/เปลี่ยนแปลง",
          x.note ? "หมายเหตุ: " + x.note : null
        ].filter(Boolean).join("\n") : (result.message || "ไม่พบคิวนี้");
      } else if (command.action === "listReviewQueue") {
        const items = Array.isArray(result.items) ? result.items : [];
        responseText = items.length
          ? "คิวตรวจสอบ:\n" + items.map((x) => {
              const parts = ["#" + x.rowNo, x.type || "-", x.name || "-", x.queue ? "คิว " + x.queue : "", x.amount ? "ยอด " + x.amount : "", x.staff ? "โดย " + x.staff : ""].filter(Boolean);
              return parts.join(" | ");
            }).join("\n")
          : "ไม่มีคิวรอตรวจ";
      } else if (command.action === "resolveReviewQueue") {
        responseText = result.message || (result.resolved ? "อัปเดตคิวแล้ว" : "ไม่สามารถดำเนินการได้");

        if (result.resolved && result.requesterLineUserId) {
          const staffText = result.decision === "ผ่าน"
            ? (result.type === "ปิดยอด"
                ? "คิว #" + result.rowNo + " ผ่านการตรวจสอบแล้ว\nรอรับรหัส***** สักครู่นะครับ ภายใน 24 ชม."
                : "คิว #" + result.rowNo + " ผ่านการตรวจสอบแล้ว\nบันทึกประวัติแล้ว แต่ยังไม่มีการแก้ยอดในชีตต้นทาง")
            : "คิว #" + result.rowNo + " ไม่ผ่านการตรวจสอบ";
          await pushMessage(result.requesterLineUserId, [
            { type: "text", text: staffText }
          ]).catch((error) => {
            console.warn("Review result notification failed", error);
          });
        }
      } else if (command.action === "getReminderBatch") {
        const d = result.digest;
        responseText = d ? [
          "ทดสอบแจ้งเตือน",
          "ใกล้ครบกำหนด: " + (d.upcomingCount || 0),
          "ครบกำหนดวันนี้: " + (d.todayCount || 0),
          "ค้างชำระ: " + (d.overdueCount || 0),
          "ผู้รับแจ้งเตือน: " + ((result.recipients || []).length),
          "อัปเดต: " + (d.generatedAt || "-")
        ].join("\n") : "ยังไม่มีข้อมูลแจ้งเตือน";
      } else if (command.action === "setGroupNotification") {
        responseText = result.message || (result.changed ? "อัปเดตการแจ้งเตือนกลุ่มแล้ว" : "ไม่สามารถดำเนินการได้");
      } else if (command.action === "installReminderTrigger") {
        responseText = result.message || (result.installed ? "ติดตั้งแจ้งเตือนแล้ว" : "ติดตั้งไม่สำเร็จ");
      } else if (command.action === "getReminderTriggerStatus") {
        responseText = result.installed
          ? "แจ้งเตือนรายวัน: ติดตั้งแล้ว\nเวลาเป้าหมาย: " + (result.remindTime || "09:00")
          : "แจ้งเตือนรายวัน: ยังไม่ได้ติดตั้ง";
      } else if (command.action === "setGroupEnabled") {
        responseText = result.message || (result.changed ? "อัปเดตกลุ่มแล้ว" : "ไม่สามารถดำเนินการได้");
      } else if (command.action === "getGroupStatus") {
        const g = result.group;
        responseText = g ? [
          "สถานะกลุ่ม: " + (g.name || "-"),
          "บอต: " + (g.botEnabled ? "เปิด" : "ปิด"),
          "ตอบข้อความ: " + (g.replyEnabled ? "เปิด" : "ปิด"),
          "แจ้งเตือน: " + (g.notificationsEnabled ? "เปิด" : "ปิด"),
          "โหมด: " + (g.mode || "-")
        ].join("\n") : (result.message || "ไม่พบข้อมูลกลุ่ม");
      } else if (command.action === "getStaffPermissions") {
        if (!result.permissions) {
          responseText = result.message || "ไม่พบข้อมูลสิทธิ์";
        } else {
          const enabled = Object.entries(result.permissions).filter(([,v]) => v).map(([k]) => "✓ " + k);
          const disabled = Object.entries(result.permissions).filter(([,v]) => !v).map(([k]) => "− " + k);
          responseText = [
            "สิทธิ์: " + (result.staffName || "-"),
            "สถานะ: " + (result.status || "-"),
            "เปิดอยู่:",
            ...(enabled.length ? enabled : ["ไม่มี"]),
            "ปิดอยู่:",
            ...(disabled.length ? disabled : ["ไม่มี"])
          ].join("\n");
        }
      } else if (command.action === "setStaffPermission") {
        responseText = result.message || (result.changed ? "อัปเดตสิทธิ์แล้ว" : "ไม่สามารถอัปเดตสิทธิ์ได้");
        if (result.changed && result.staffLineUserId) {
          await pushMessage(result.staffLineUserId, [{
            type: "text",
            text: (result.enabled ? "ได้รับสิทธิ์: " : "ถูกถอนสิทธิ์: ") + result.permissionName
          }]).catch((error) => console.warn("Permission notification failed", error));
        }
      } else if (command.action === "listStaff") {
        const items = Array.isArray(result.items) ? result.items : [];
        responseText = items.length
          ? "เจ้าหน้าที่:\n" + items.map((x, i) => {
              const state = x.status || (x.lineBound ? "ยังไม่อนุมัติ" : "ยังไม่ลงทะเบียน");
              const bot = x.botEnabled ? "บอตเปิด" : "บอตปิด";
              return (i + 1) + ". " + x.staffName + " | " + (x.role || "พนักงาน") + " | " + state + " | " + bot;
            }).join("\n")
          : "ยังไม่มีเจ้าหน้าที่";
      } else if (command.action === "setStaffEnabled") {
        responseText = result.message || (result.changed ? "อัปเดตเจ้าหน้าที่แล้ว" : "ไม่สามารถดำเนินการได้");

        if (result.changed && result.staffLineUserId) {
          const staffText = result.enabled
            ? "บัญชี Admin ID ของคุณถูกเปิดใช้งานแล้ว"
            : "บัญชี Admin ID ของคุณถูกระงับการใช้งาน";
          await pushMessage(result.staffLineUserId, [{ type: "text", text: staffText }]).catch((error) => {
            console.warn("Staff status notification failed", error);
          });
        }
      } else if (command.action === "listPendingStaff") {
        const items = Array.isArray(result.items) ? result.items : [];
        responseText = items.length
          ? "รออนุมัติ:\n" + items.map((x, i) => `${i + 1}. ${x.staffName}${x.registeredAt ? " | " + x.registeredAt : ""}`).join("\n")
          : "ไม่มีเจ้าหน้าที่รออนุมัติ";
      } else if (command.action === "rejectStaff") {
        responseText = result.message || (result.rejected ? "ไม่อนุมัติเจ้าหน้าที่แล้ว" : "ไม่สามารถดำเนินการได้");

        if (result.rejected && result.staffLineUserId) {
          await pushMessage(result.staffLineUserId, [
            {
              type: "text",
              text: "คำขอใช้งาน Admin ID ไม่ได้รับการอนุมัติ"
            }
          ]).catch((error) => {
            console.warn("Staff rejection notification failed", error);
          });
        }
      } else if (command.action === "approveStaff") {
        responseText = result.message || (result.approved ? "อนุมัติเจ้าหน้าที่แล้ว" : "ไม่สามารถอนุมัติได้");

        if (result.approved && result.staffLineUserId) {
          await pushMessage(result.staffLineUserId, [
            {
              type: "text",
              text: "อนุมัติแล้ว\nตอนนี้สามารถใช้งาน Admin ID ได้"
            }
          ]).catch((error) => {
            console.warn("Staff approval notification failed", error);
          });
        }
      }

      await replyMessage(event.replyToken, [{ type: "text", text: responseText || "ดำเนินการแล้ว" }]);

      await safeLogAction({
        lineUserId,
        staffName: access.staffName || "",
        role: access.role || "",
        command: command.prefix || text,
        query: command.query || "",
        source: sourceType,
        result: result?.needsSelection ? "หลายรายการ" : (result?.ok === false ? "ผิดพลาด" : "สำเร็จ"),
        actionName: command.action || "",
        status: result?.ok === false ? "ผิดพลาด" : "สำเร็จ",
        note: ""
      });
      return;
    }

    const result = await callSheetsBridge({
      action: "searchCustomer",
      query: text,
      lineUserId,
      sourceType,
      groupId,
    });

    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: formatCustomerMatches(result.matches || []),
      },
    ]);

    await safeLogAction({
      lineUserId,
      staffName: access.staffName || "",
      role: access.role || "",
      command: "ค้นหา",
      query: text,
      source: sourceType,
      result: Array.isArray(result.matches) ? String(result.matches.length) + " รายการ" : "0 รายการ",
      actionName: "searchCustomer",
      status: "สำเร็จ",
      note: ""
    });
  } catch (error) {
    console.error("LINE request failed", { action: auditAction, name: error?.name, message: error?.message });
    await safeLogAction({
      lineUserId: event.source?.userId || "", staffName: "", role: "ระบบ",
      command: auditAction, query: "", source: event.source?.type || "",
      result: "ทำรายการไม่สำเร็จ", actionName: "webhookError", status: "ผิดพลาด",
      note: String(error?.name || "Error").slice(0, 80)
    });
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: "ระบบค้นหาลูกค้ายังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
      },
    ]);
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (req.query?.slip) {
      try { return await serveSlipImage(req, res); }
      catch { return res.status(502).json({ ok: false }); }
    }
    return res.status(200).json({
      ok: true,
      service: "Admin ID LINE Webhook",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return res.status(500).json({
      ok: false,
      error: "LINE_CHANNEL_SECRET is not configured",
    });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["x-line-signature"];

    if (!verifyLineSignature(rawBody, signature, secret)) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    const body = JSON.parse(rawBody.toString("utf8") || "{}");
    const events = Array.isArray(body.events) ? body.events : [];

    await Promise.all(events.map(handleEvent));

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: "Webhook processing failed",
    });
  }
}
