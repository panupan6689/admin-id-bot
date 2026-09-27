import { callSheetsBridge } from "../../lib/sheetsBridge.js";
import { sessionFromRequest } from "../../lib/webAuth.js";

async function pushText(to, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  if (!response.ok) throw new Error("LINE push failed: " + response.status);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const session = sessionFromRequest(req);
    if (!session) return res.status(401).json({ ok: false, error: "กรุณาเข้าเว็บผ่าน LINE OA ใหม่" });

    const body = typeof req.body === "object" && req.body ? req.body : {};

    if (String(body.action || "").trim() === "record_payment") {
      const customerQuery = String(body.queue || "").trim();
      const amount = Number(body.amount);
      if (!customerQuery || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "กรุณาระบุคิวและยอดชำระให้ถูกต้อง" });
      }
      const result = await callSheetsBridge({ action: "queuePayment", lineUserId: session.sub, query: customerQuery, amount });
      if (result?.needsSelection) {
        return res.status(409).json({ ok: false, needsSelection: true, matches: Array.isArray(result.matches) ? result.matches : [], error: "พบลูกค้าหลายรายการ กรุณาระบุคิวให้ชัดเจน" });
      }
      if (result?.queued === false) {
        return res.status(400).json({ ok: false, duplicate: !!result.duplicate, duplicateRowNo: result.duplicateRowNo || null, error: result.message || "ยังส่งเข้าคิวตรวจสอบไม่ได้" });
      }
      return res.status(200).json({ ok: true, queued: true, rowNo: result?.rowNo || null, customer: result?.customer || null, amount, message: result?.message || "ส่งเข้าคิวตรวจสอบแล้ว" });
    }
    const field = String(body.field || "").trim();
    const queue = String(body.queue || "").trim();
    const queues = Array.isArray(body.queues) ? body.queues.map(String).join(",") : String(body.queues || "").trim();

    let targets = Array.isArray(body.targets) ? body.targets : [];
    if (!targets.length && body.source && body.sheet) {
      targets = [{ source: body.source, sheet: body.sheet }];
    }
    targets = targets
      .map((x) => ({ source: String(x?.source || "").trim(), sheet: String(x?.sheet || "").trim() }))
      .filter((x) => x.source && x.sheet);

    const seenTargets = new Set();
    targets = targets.filter((x) => {
      const key = x.source + "|" + x.sheet;
      if (seenTargets.has(key)) return false;
      seenTargets.add(key);
      return true;
    });

    if (!targets.length || !["close","outstanding","due"].includes(field)) {
      return res.status(400).json({ ok: false, error: "ข้อมูลส่งแจ้งเตือนไม่ครบ" });
    }

    let prepared = 0, sent = 0, failed = 0;
    const details = [];

    for (const target of targets) {
      const batch = await callSheetsBridge({
        action: "buildCustomerNotificationBatch",
        lineUserId: session.sub,
        source: target.source,
        sheet: target.sheet,
        field,
        queue,
        queues,
      });

      if (batch?.allowed === false) {
        details.push({ ...target, prepared: 0, sent: 0, failed: 0, error: batch.message || "ไม่มีสิทธิ์" });
        continue;
      }

      const items = Array.isArray(batch?.items) ? batch.items : [];
      prepared += items.length;
      let targetSent = 0, targetFailed = 0;

      for (const item of items) {
        let ok = false;
        try {
          await pushText(item.lineUserId, item.message);
          ok = true;
          sent++;
          targetSent++;
        } catch (error) {
          failed++;
          targetFailed++;
          console.warn("Web customer notification failed", target.source, target.sheet, item.queue, error);
        }
        try {
          await callSheetsBridge({ action: "markCustomerReminderSent", rowNo: item.rowNo, sent: ok });
        } catch (error) {
          console.warn("Web notification mark failed", item.rowNo, error);
        }
      }

      details.push({
        ...target,
        prepared: items.length,
        sent: targetSent,
        failed: targetFailed,
        message: batch?.message || "",
      });
    }

    return res.status(200).json({
      ok: true,
      field,
      targetCount: targets.length,
      prepared,
      sent,
      failed,
      details,
      message: prepared
        ? ("ส่งสำเร็จ " + sent + " / " + prepared + " ราย จาก " + targets.length + " ชีต")
        : ("ไม่มีรายการใหม่ใน " + targets.length + " ชีต"),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error?.message || error).slice(0, 180) });
  }
}
