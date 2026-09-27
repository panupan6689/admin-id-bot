export const COMMANDS = [
  { prefix: "อ่านบัตรล่าสุด", action: "getRecentIdentityImages", permission: "ดูข้อมูลลูกค้า", requiresQuery: false },
  { prefix: "กรอกชื่อเอง", action: "verifyCustomerIdentity", permission: "ดูข้อมูลลูกค้า" },
  { prefix: "บัตรประชาชน", action: "verifyCustomerIdentity", permission: "ดูข้อมูลลูกค้า" },
  { prefix: "ลูกค้ารออนุมัติ", action: "listPendingCustomerBindings", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "อนุมัติลูกค้า", action: "resolveCustomerBinding", permission: "จัดการเจ้าหน้าที่", decision: "อนุมัติ" },
  { prefix: "ไม่อนุมัติลูกค้า", action: "resolveCustomerBinding", permission: "จัดการเจ้าหน้าที่", decision: "ไม่อนุมัติ" },
  { prefix: "เช็กพร้อมใช้", action: "readinessCheck", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "เปิดระบบ", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_MASTER_ENABLED", enabled: true, requiresQuery: false },
  { prefix: "ปิดระบบ", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_MASTER_ENABLED", enabled: false, requiresQuery: false },
  { prefix: "เปิดพนักงาน", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_STAFF_ENABLED", enabled: true, requiresQuery: false },
  { prefix: "ปิดพนักงาน", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_STAFF_ENABLED", enabled: false, requiresQuery: false },
  { prefix: "เปิดกลุ่มทั้งหมด", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_GROUP_ENABLED", enabled: true, requiresQuery: false },
  { prefix: "ปิดกลุ่มทั้งหมด", action: "setBotSwitch", permission: "จัดการเจ้าหน้าที่", switchKey: "BOT_GROUP_ENABLED", enabled: false, requiresQuery: false },
  { prefix: "เวอร์ชันระบบ", action: "getBridgeVersion", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "กิจกรรมวันนี้", action: "getStaffActivity", permission: "ดูรายงาน", activityToday: true, requiresQuery: false },
  { prefix: "กิจกรรม", action: "getStaffActivity", permission: "ดูรายงาน" },
  { prefix: "ทดสอบแจ้งเตือน", action: "getReminderBatch", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "ตรวจชีตต้นทาง", action: "auditSourceSchemas", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "ตรวจเขียนต้นทาง", action: "auditSourceWriteCapabilities", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "สิทธิ์เจ้าหน้าที่", action: "getStaffPermissions", permission: "จัดการเจ้าหน้าที่" },
  { prefix: "ให้สิทธิ์", action: "setStaffPermission", permission: "จัดการเจ้าหน้าที่", permissionEnabled: true },
  { prefix: "ถอนสิทธิ์", action: "setStaffPermission", permission: "จัดการเจ้าหน้าที่", permissionEnabled: false },
  { prefix: "ติดตั้งแจ้งเตือน", action: "installReminderTrigger", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "สถานะแจ้งเตือน", action: "getReminderTriggerStatus", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "เปิดแจ้งเตือนกลุ่ม", action: "setGroupNotification", permission: "จัดการเจ้าหน้าที่", enabled: true, requiresQuery: false },
  { prefix: "ปิดแจ้งเตือนกลุ่ม", action: "setGroupNotification", permission: "จัดการเจ้าหน้าที่", enabled: false, requiresQuery: false },
  { prefix: "ครบกำหนดวันนี้", action: "listDueCustomers", permission: "ดูรายงาน", dueMode: "today", requiresQuery: false },
  { prefix: "ใกล้ครบกำหนด", action: "listDueCustomers", permission: "ดูรายงาน", dueMode: "upcoming", requiresQuery: false },
  { prefix: "ค้างชำระทั้งหมด", action: "listDueCustomers", permission: "ดูรายงาน", dueMode: "overdue", requiresQuery: false },
  { prefix: "เปิดกลุ่ม", action: "setGroupEnabled", permission: "จัดการเจ้าหน้าที่", enabled: true, requiresQuery: false },
  { prefix: "ปิดกลุ่ม", action: "setGroupEnabled", permission: "จัดการเจ้าหน้าที่", enabled: false, requiresQuery: false },
  { prefix: "สถานะกลุ่ม", action: "getGroupStatus", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "รายงานวันนี้", action: "dailyOwnerReport", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "สถานะระบบ", action: "systemStatus", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "เจ้าหน้าที่", action: "listStaff", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "ระงับ", action: "setStaffEnabled", permission: "จัดการเจ้าหน้าที่", enabled: false },
  { prefix: "เปิดใช้", action: "setStaffEnabled", permission: "จัดการเจ้าหน้าที่", enabled: true },
  { prefix: "คิวตรวจสอบ", action: "listReviewQueue", permission: "ดูรายงาน", requiresQuery: false },
  { prefix: "ดูคิว", action: "getReviewQueueItem", permission: "ดูรายงาน" },
  { prefix: "ยกเลิกคิว", action: "cancelReviewQueue", permission: "ดูรายงาน" },
  { prefix: "จำลองบันทึก", action: "planSourceWrite", permission: "ดูรายงาน" },
  { prefix: "ผ่านคิว", action: "resolveReviewQueue", permission: "ดูรายงาน", decision: "ผ่าน" },
  { prefix: "ไม่ผ่านคิว", action: "resolveReviewQueue", permission: "ดูรายงาน", decision: "ไม่ผ่าน" },
  { prefix: "รออนุมัติ", action: "listPendingStaff", permission: "จัดการเจ้าหน้าที่", requiresQuery: false },
  { prefix: "ไม่อนุมัติ", action: "rejectStaff", permission: "จัดการเจ้าหน้าที่" },
  { prefix: "อนุมัติ", action: "approveStaff", permission: "จัดการเจ้าหน้าที่" },
  { prefix: "ประวัติ", action: "getHistory", permission: "ดูประวัติ" },
  { prefix: "ดูโน้ต", action: "getHistory", permission: "ดูประวัติ", eventType: "โน้ตลูกค้า" },
  { prefix: "โน้ต", action: "addNote", permission: "บันทึกโน้ต" },
  { prefix: "รับชำระ", action: "queuePayment", permission: "บันทึกชำระ", privateOnly: true },
  { prefix: "บันทึกชำระ", action: "queuePayment", permission: "บันทึกชำระ" },
  { prefix: "ยืนยันสลิป", action: "queueSlipReview", permission: "ยืนยันสลิป" },
  { prefix: "ปิดยอด", action: "queueClose", permission: "ปิดยอด" },
  { prefix: "สรุปยอด", action: "getCalculatedSummary", permission: "ดูข้อมูลลูกค้า" },
  { prefix: "สิทธิ์ส่วนลด", action: "getCalculatedSummary", permission: "ดูข้อมูลลูกค้า", summaryField: "discount" },
  { prefix: "ยอดปิด", action: "getCustomerInfo", permission: "ดูข้อมูลลูกค้า", field: "closeAmount" },
  { prefix: "ค่าเช่า", action: "getCustomerInfo", permission: "ดูข้อมูลลูกค้า", field: "fee" },
  { prefix: "วันจ่าย", action: "getCustomerInfo", permission: "ดูข้อมูลลูกค้า", field: "dueDate" },
  { prefix: "ยอดค้าง", action: "getCustomerInfo", permission: "ดูข้อมูลลูกค้า", field: "outstanding" },
  { prefix: "สถานะ", action: "getCustomerInfo", permission: "ดูข้อมูลลูกค้า", field: "status" },
];

export function parseCommand(text) {
  const input = String(text || "").trim();
  for (const cmd of COMMANDS) {
    if (input === cmd.prefix || input.startsWith(cmd.prefix + " ")) {
      const rest = input.slice(cmd.prefix.length).trim();
      if (cmd.action === "verifyCustomerIdentity") {
        const m = rest.match(/^(\S+)\s+(\S+)\s+(\S+)(?:\s+(\d{4}))?$/);
        const firstToken = rest.match(/^(\S+)/);
        return {
          ...cmd,
          query: m ? m[1] : (firstToken ? firstToken[1] : ""),
          firstName: m ? m[2] : "",
          lastName: m ? m[3] : "",
          idLast4: m && m[4] ? m[4] : "",
        };
      }
      if (cmd.action === "addNote") {
        const m = rest.match(/^(\S+)\s+(.+)$/s);
        return {
          ...cmd,
          query: m ? m[1] : "",
          note: m ? m[2].trim() : "",
        };
      }
      if (cmd.action === "queuePayment") {
        const m = rest.match(/^(\S+)\s+([0-9,]+(?:\.\d{1,2})?)$/);
        return {
          ...cmd,
          query: m ? m[1] : "",
          amount: m ? Number(m[2].replace(/,/g, "")) : null,
        };
      }
      if (cmd.action === "setStaffPermission") {
        const m = rest.match(/^(\S+)\s+(.+)$/s);
        return {
          ...cmd,
          query: m ? m[1] : "",
          targetPermission: m ? m[2].trim() : "",
        };
      }
      return { ...cmd, query: rest };
    }
  }
  return null;
}

export function formatCustomerInfo(info = {}, field) {
  const name = info.name || "-";
  const queue = info.queue ? `คิว ${info.queue}` : "";
  const head = [name, queue].filter(Boolean).join(" / ");

  const labels = {
    fee: ["ค่าเช่า", info.fee],
    dueDate: ["วันจ่าย", info.dueDate],
    outstanding: ["ยอดค้าง", info.outstanding],
    status: ["สถานะ", info.status],
    closeAmount: ["ยอดปิด", info.closeAmount],
  };

  const pair = labels[field];
  if (!pair) return "ไม่พบข้อมูล";

  return `${head}\n${pair[0]}: ${pair[1] || "-"}`;
}

export function formatHistory(items = []) {
  if (!items.length) return "ไม่พบประวัติลูกค้า";
  return items.slice(0, 10).map((x, i) => {
    const parts = [
      `${i + 1}. ${x.eventType || "-"}`,
      x.dateTime || null,
      x.amount ? `ยอด ${x.amount}` : null,
      x.note || null,
      x.staff || null,
    ].filter(Boolean);
    return parts.join(" | ");
  }).join("\n");
}
