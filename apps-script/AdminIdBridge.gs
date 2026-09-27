const CONFIG = {
  VERSION: '2026.09.27-115',
  CUSTOMER_PILOT_SOURCE: 'v6',
  CUSTOMER_PILOT_SHEET: 'V6/10-69',
  CUSTOMER_BINDING_TARGETS: [
    { source: 'v6', sheet: 'V6/10-69' },
    { source: 'v1/v3', sheet: 'v3/10-69' }
  ],
  SOURCE_SHEET: 'ลิ้งชีต',
  STAFF_SHEET: 'เจ้าหน้าที่',
  HISTORY_SHEET: 'ประวัติลูกค้า',
  SETTINGS_SHEET: 'ตั้งค่าบอต',
  LOG_SHEET: 'Log ระบบ',
  REVIEW_QUEUE_SHEET: 'คิวตรวจสอบ',
  GROUP_SHEET: 'กลุ่ม LINE',
  NOTIFICATION_QUEUE_SHEET: 'คิวแจ้งเตือน',
  CUSTOMER_LINE_SHEET: 'ลูกค้า LINE',
  CUSTOMER_IDENTITY_SHEET: 'ยืนยันตัวตนลูกค้า',
  MAX_RESULTS: 20,
  MAX_ROWS_PER_TAB: 3000,
  HEADER_SCAN_ROWS: 20,
  HEADER_SCAN_COLS: 40,
  SEARCH_CACHE_SECONDS: 300,
  CUSTOMER_CACHE_SECONDS: 20,
  SETTINGS_CACHE_SECONDS: 30,
  REMINDER_ENDPOINT: 'https://admin-id-bot.vercel.app/api/reminders/run',
  EXCLUDED_TAB_PATTERNS: [
    /^LINE แจ้งค่าเช่า$/i,
    /สรุป/i,
    /^Mail/i,
    /รายงาน/i,
    /Dashboard/i
  ]
};

let SETTINGS_MEMORY_CACHE_ = null;

function doGet() {
  return json_({
    ok: true,
    service: 'Admin ID Google Sheets Bridge',
    version: CONFIG.VERSION
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const savedSecret = PropertiesService.getScriptProperties().getProperty('SHEETS_BRIDGE_SECRET');

    if (!savedSecret || body.secret !== savedSecret) {
      return json_({ ok: false, error: 'Unauthorized' });
    }

    let result;
    switch (body.action) {
      case 'getBridgeVersion':
        result = { ok: true, version: CONFIG.VERSION }; break;
      case 'postDeploySelfTest':
        result = postDeploySelfTest_(); break;
      case 'readinessCheck':
        result = readinessCheck_(body); break;
      case 'setBotSwitch':
        result = setBotSwitch_(body); break;
      case 'getCustomerConversationPause':
        result = getCustomerConversationPause_(body); break;
      case 'setCustomerConversationPause':
        result = setCustomerConversationPause_(body); break;
      case 'checkAccess':
        result = checkAccess_(body); break;
      case 'registerStaff':
        result = registerStaff_(body); break;
      case 'approveStaff':
        result = approveStaff_(body); break;
      case 'rejectStaff':
        result = rejectStaff_(body); break;
      case 'listPendingStaff':
        result = listPendingStaff_(body); break;
      case 'listStaff':
        result = listStaff_(body); break;
      case 'setStaffEnabled':
        result = setStaffEnabled_(body); break;
      case 'getStaffPermissions':
        result = getStaffPermissions_(body); break;
      case 'setStaffPermission':
        result = setStaffPermission_(body); break;
      case 'setGroupEnabled':
        result = setGroupEnabled_(body); break;
      case 'getGroupStatus':
        result = getGroupStatus_(body); break;
      case 'setGroupNotification':
        result = setGroupNotification_(body); break;
      case 'installReminderTrigger':
        result = installReminderTrigger_(body); break;
      case 'getReminderTriggerStatus':
        result = getReminderTriggerStatus_(body); break;
      case 'getReminderBatch':
        result = getReminderBatch_(body); break;
      case 'markReminderSent':
        result = markReminderSent_(body); break;
      case 'getCustomerReminderBatch':
        result = getCustomerReminderBatch_(body); break;
      case 'markCustomerReminderSent':
        result = markCustomerReminderSent_(body); break;
      case 'listCustomerNotificationSheets':
        result = listCustomerNotificationSheets_(body); break;
      case 'setCustomerAutoReminderSheet':
        result = setCustomerAutoReminderSheet_(body); break;
      case 'buildCustomerNotificationBatch':
        result = buildCustomerNotificationBatch_(body); break;
      case 'getCustomerContactRecipients':
        result = getCustomerContactRecipients_(body); break;
      case 'getStaffSlipRecipients':
        result = getStaffSlipRecipients_(body); break;
      case 'requestCustomerBinding':
        result = requestCustomerBinding_(body); break;
      case 'getCustomerSelf':
        result = getCustomerSelf_(body); break;
      case 'cancelCustomerBindings':
        result = cancelCustomerBindings_(body); break;
      case 'listPendingCustomerBindings':
        result = listPendingCustomerBindings_(body); break;
      case 'resolveCustomerBinding':
        result = resolveCustomerBinding_(body); break;
      case 'searchCustomer':
        result = { ok: true, matches: searchCustomer_(String(body.query || '').trim()) }; break;
      case 'getCustomerInfo':
        result = getCustomerInfo_(body); break;
      case 'getCalculatedSummary':
        result = getCalculatedSummary_(body); break;
      case 'dailyOwnerReport':
        result = dailyOwnerReport_(body); break;
      case 'getStaffActivity':
        result = getStaffActivity_(body); break;
      case 'systemStatus':
        result = systemStatus_(body); break;
      case 'auditSourceSchemas':
        result = auditSourceSchemas_(body); break;
      case 'auditSourceWriteCapabilities':
        result = auditSourceWriteCapabilities_(body); break;
      case 'listDueCustomers':
        result = listDueCustomers_(body); break;
      case 'getHistory':
        result = getHistory_(body); break;
      case 'addNote':
        result = addNote_(body); break;
      case 'verifyCustomerIdentity':
        result = verifyCustomerIdentity_(body); break;
      case 'queuePayment':
        result = queueFinancialReview_(body, 'บันทึกชำระ'); break;
      case 'queueSlipReview':
        result = queueFinancialReview_(body, 'ตรวจสลิป'); break;
      case 'rememberSlipMessage':
        result = rememberSlipMessage_(body); break;
      case 'rememberRecentImage':
        result = rememberRecentImage_(body); break;
      case 'getRecentIdentityImages':
        result = getRecentIdentityImages_(body); break;
      case 'ocrThaiIdCardImage':
        result = ocrThaiIdCardImage_(body); break;
      case 'queueClose':
        result = queueFinancialReview_(body, 'ปิดยอด'); break;
      case 'listReviewQueue':
        result = listReviewQueue_(body); break;
      case 'getReviewQueueItem':
        result = getReviewQueueItem_(body); break;
      case 'cancelReviewQueue':
        result = cancelReviewQueue_(body); break;
      case 'planSourceWrite':
        result = planSourceWrite_(body); break;
      case 'resolveReviewQueue':
        result = resolveReviewQueue_(body); break;
      case 'rollbackReviewQueue':
        result = rollbackReviewQueue_(body); break;
      case 'logAction':
        result = logAction_(body); break;
      default:
        result = { ok: false, error: 'Unknown action' };
    }
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function postDeploySelfTest_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checks = [];
  const warnings = [];

  function add(name, pass, detail, critical) {
    checks.push({
      name: name,
      pass: !!pass,
      detail: detail || '',
      critical: critical !== false
    });
  }

  add('version', CONFIG.VERSION === '2026.09.27-115', CONFIG.VERSION, true);
  add('เจ้าหน้าที่', !!ss.getSheetByName(CONFIG.STAFF_SHEET), CONFIG.STAFF_SHEET, true);
  add('ลิ้งชีต', !!ss.getSheetByName(CONFIG.SOURCE_SHEET), CONFIG.SOURCE_SHEET, true);
  add('ประวัติลูกค้า', !!ss.getSheetByName(CONFIG.HISTORY_SHEET), CONFIG.HISTORY_SHEET, true);
  add('Log ระบบ', !!ss.getSheetByName(CONFIG.LOG_SHEET), CONFIG.LOG_SHEET, true);
  add('คิวตรวจสอบ', !!ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET), CONFIG.REVIEW_QUEUE_SHEET, true);
  add('ตั้งค่าบอต', !!ss.getSheetByName(CONFIG.SETTINGS_SHEET), CONFIG.SETTINGS_SHEET, true);
  add('กลุ่ม LINE', !!ss.getSheetByName(CONFIG.GROUP_SHEET), CONFIG.GROUP_SHEET, false);
  add('คิวแจ้งเตือน', !!ss.getSheetByName(CONFIG.NOTIFICATION_QUEUE_SHEET), CONFIG.NOTIFICATION_QUEUE_SHEET, false);
  add('ลูกค้า LINE', !!ss.getSheetByName(CONFIG.CUSTOMER_LINE_SHEET), CONFIG.CUSTOMER_LINE_SHEET, true);
  add('ยืนยันตัวตนลูกค้า', !!ss.getSheetByName(CONFIG.CUSTOMER_IDENTITY_SHEET), CONFIG.CUSTOMER_IDENTITY_SHEET, true);

  const src = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  let enabledSources = 0;
  if (src && src.getLastRow() >= 2) {
    const values = src.getRange(2, 1, src.getLastRow() - 1, 3).getValues();
    enabledSources = values.filter(function(r) {
      return String(r[1] || '').trim() && isTrue_(r[2]);
    }).length;
  }
  add('แหล่งข้อมูลเปิดใช้', enabledSources >= 8, enabledSources + ' แหล่ง', true);

  const staff = ss.getSheetByName(CONFIG.STAFF_SHEET);
  let ownerCount = 0;
  if (staff && staff.getLastRow() >= 2) {
    const values = staff.getRange(2, 1, staff.getLastRow() - 1, 20).getValues();
    ownerCount = values.filter(function(r) {
      return String(r[8] || '').trim() === 'เจ้าของ' &&
        String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
        r[19] === true &&
        String(r[1] || '').trim();
    }).length;
  }
  add('เจ้าของระบบพร้อมใช้', ownerCount >= 1, ownerCount + ' คน', true);

  const master = isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true));
  const staffEnabled = isTrue_(getSettingValue_('BOT_STAFF_ENABLED', true));
  const writesEnabled = isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false));
  const reminderInternal = isTrue_(getSettingValue_('REMINDER_INTERNAL_ONLY', true));
  const okSlip = isTrue_(getSettingValue_('OKSLIP_ENABLED', false));

  add('BOT_MASTER_ENABLED', master, String(master), true);
  add('BOT_STAFF_ENABLED', staffEnabled, String(staffEnabled), true);
  add('BOT_CUSTOMER_ENABLED', isTrue_(getSettingValue_('BOT_CUSTOMER_ENABLED', true)), String(getSettingValue_('BOT_CUSTOMER_ENABLED', true)), true);
  add('Safety เขียนต้นทางปิด', writesEnabled === false, writesEnabled ? 'เปิด' : 'ปิด', true);
  add('แจ้งเตือนลูกค้า', reminderInternal === false, reminderInternal ? 'ยังเป็นภายในเท่านั้น' : 'เปิดส่งลูกค้า', false);
  add('OK Slip', okSlip, okSlip ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม', false);

  try {
    const triggers = ScriptApp.getProjectTriggers().filter(function(t) {
      return ['triggerDailyReminder', 'triggerDailyReminder_'].indexOf(t.getHandlerFunction()) !== -1;
    });
    if (!triggers.length) warnings.push('ยังไม่ได้ติดตั้งแจ้งเตือนรายวัน');
  } catch (err) {
    warnings.push('Web App ไม่มีสิทธิ์ตรวจ trigger อัตโนมัติ ให้เช็ก trigger ใน Apps Script UI');
  }
  if (!okSlip) warnings.push('OK Slip ยังไม่เชื่อม จึงยังไม่ตรวจสลิปกับ API ภายนอก');
  if (writesEnabled) warnings.push('FINANCIAL_SOURCE_WRITES_ENABLED เปิดอยู่');

  const critical = checks.filter(function(x){ return x.critical; });
  const criticalPassed = critical.filter(function(x){ return x.pass; }).length;
  const passed = checks.filter(function(x){ return x.pass; }).length;

  return {
    ok: criticalPassed === critical.length,
    version: CONFIG.VERSION,
    passed: passed,
    total: checks.length,
    criticalPassed: criticalPassed,
    criticalTotal: critical.length,
    checks: checks,
    warnings: warnings
  };
}

function setSettingValue_(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh) return false;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;
  const values = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== key) continue;
    sh.getRange(i + 2, 2).setValue(value);
    sh.getRange(i + 2, 5).setValue(true);
    SETTINGS_MEMORY_CACHE_ = null;
    try { CacheService.getScriptCache().remove('admin-id-settings-v109'); } catch (err) {}
    return true;
  }
  return false;
}

function setBotSwitch_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่',
    allowSystemControl: true
  });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, changed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const allowed = {
    'BOT_MASTER_ENABLED': true,
    'BOT_STAFF_ENABLED': true,
    'BOT_GROUP_ENABLED': true
  };
  const key = String(body.switchKey || '').trim();
  if (!allowed[key]) return { ok: true, changed: false, message: 'ไม่อนุญาตให้เปลี่ยนสวิตช์นี้' };

  const enabled = body.enabled === true;
  const changed = setSettingValue_(key, enabled ? 'TRUE' : 'FALSE');
  if (!changed) return { ok: true, changed: false, message: 'ไม่พบตัวแปรตั้งค่า ' + key };

  const label = key === 'BOT_MASTER_ENABLED'
    ? 'ระบบหลัก'
    : key === 'BOT_STAFF_ENABLED'
      ? 'ระบบพนักงาน'
      : 'ระบบกลุ่ม LINE';

  return {
    ok: true,
    changed: true,
    key: key,
    enabled: enabled,
    message: (enabled ? 'เปิด' : 'ปิด') + label + 'แล้ว'
  };
}


function customerConversationPauseKey_(lineUserId) {
  const raw = String(lineUserId || '').trim();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return 'customer-chat-pause:' + Utilities.base64EncodeWebSafe(digest).slice(0, 40);
}

function getCustomerConversationPause_(body) {
  const lineUserId = String(body.lineUserId || '').trim();
  if (!lineUserId) return { ok: true, paused: false };

  const raw = PropertiesService.getScriptProperties().getProperty(customerConversationPauseKey_(lineUserId));
  if (!raw) return { ok: true, paused: false };

  try {
    const state = JSON.parse(raw);
    return {
      ok: true,
      paused: state && state.paused === true,
      pausedAt: state && state.pausedAt ? state.pausedAt : '',
      pausedBy: state && state.pausedBy ? state.pausedBy : ''
    };
  } catch (err) {
    return { ok: true, paused: false };
  }
}

function setCustomerConversationPause_(body) {
  const requesterLineUserId = String(body.lineUserId || '').trim();
  const targetLineUserId = String(body.targetLineUserId || requesterLineUserId).trim();
  const paused = body.paused === true;

  if (!requesterLineUserId || !targetLineUserId) {
    return { ok: true, changed: false, message: 'ไม่พบ LINE User ID' };
  }

  let actorName = '';
  let actorRole = '';

  if (paused && requesterLineUserId === targetLineUserId) {
    const self = getCustomerSelf_({ lineUserId: targetLineUserId, field: 'status' });
    if (!self || !self.bound || self.suspended) {
      return { ok: true, changed: false, message: 'ยังไม่พบลูกค้าที่ผูกบัญชีและใช้งานอยู่' };
    }
    actorName = (self.items && self.items[0] && self.items[0].name) || 'ลูกค้า';
    actorRole = 'ลูกค้า';
  } else {
    const access = checkAccess_({
      lineUserId: requesterLineUserId,
      permission: 'ดูข้อมูลลูกค้า'
    });
    if (!access.allowed) {
      return { ok: true, changed: false, message: access.message || 'ไม่มีสิทธิ์จัดการการสนทนาลูกค้า' };
    }
    actorName = access.staffName || '';
    actorRole = access.role || '';
  }

  const props = PropertiesService.getScriptProperties();
  const key = customerConversationPauseKey_(targetLineUserId);

  if (paused) {
    props.setProperty(key, JSON.stringify({
      paused: true,
      pausedAt: new Date().toISOString(),
      pausedBy: actorName || actorRole || requesterLineUserId
    }));
  } else {
    props.deleteProperty(key);
  }

  return {
    ok: true,
    changed: true,
    paused: paused,
    targetLineUserId: targetLineUserId,
    actorName: actorName,
    actorRole: actorRole,
    message: paused
      ? 'พักการตอบอัตโนมัติของลูกค้ารายนี้แล้ว'
      : 'เปิดการตอบอัตโนมัติของลูกค้ารายนี้แล้ว'
  };
}

function readinessCheck_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'ดูรายงาน',
    allowSystemControl: true
  });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checks = [];
  function add(name, pass, detail) {
    checks.push({ name: name, pass: !!pass, detail: detail || '' });
  }

  add('Apps Script version', CONFIG.VERSION === '2026.09.27-115', CONFIG.VERSION);
  add('BOT_MASTER_ENABLED', isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true)), String(getSettingValue_('BOT_MASTER_ENABLED', true)));
  add('BOT_STAFF_ENABLED', isTrue_(getSettingValue_('BOT_STAFF_ENABLED', true)), String(getSettingValue_('BOT_STAFF_ENABLED', true)));

  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  let enabledSources = 0;
  if (sourceSheet && sourceSheet.getLastRow() >= 2) {
    const vals = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, 3).getValues();
    enabledSources = vals.filter(function(r){ return String(r[1] || '').trim() && isTrue_(r[2]); }).length;
  }
  add('แหล่งข้อมูล', enabledSources >= 8, enabledSources + ' แหล่ง');

  const staffSheet = ss.getSheetByName(CONFIG.STAFF_SHEET);
  let ownerCount = 0, activeStaff = 0;
  if (staffSheet && staffSheet.getLastRow() >= 2) {
    const vals = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 20).getValues();
    ownerCount = vals.filter(function(r){ return String(r[8] || '').trim() === 'เจ้าของ' && String(r[2] || '').trim() === 'เจ้าหน้าที่' && r[19] === true; }).length;
    activeStaff = vals.filter(function(r){ return String(r[2] || '').trim() === 'เจ้าหน้าที่' && r[19] === true; }).length;
  }
  add('เจ้าของระบบ', ownerCount >= 1, ownerCount + ' คน');
  add('เจ้าหน้าที่ใช้งาน', activeStaff >= 1, activeStaff + ' คน');

  const history = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  const log = ss.getSheetByName(CONFIG.LOG_SHEET);
  const review = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  add('ประวัติลูกค้า', !!history, history ? 'พร้อม' : 'ไม่พบชีต');
  add('Log ระบบ', !!log, log ? 'พร้อม' : 'ไม่พบชีต');
  add('คิวตรวจสอบ', !!review, review ? 'พร้อม' : 'ไม่พบชีต');

  let reminderTriggerCount = -1;
  try {
    reminderTriggerCount = ScriptApp.getProjectTriggers().filter(function(t) {
      return ['triggerDailyReminder', 'triggerDailyReminder_'].indexOf(t.getHandlerFunction()) !== -1;
    }).length;
    add('แจ้งเตือนรายวัน', reminderTriggerCount > 0, reminderTriggerCount ? 'ติดตั้งแล้ว' : 'ยังไม่ติดตั้ง');
  } catch (err) {
    add('แจ้งเตือนรายวัน', true, 'ตรวจ trigger จาก Web App ไม่ได้ ให้เช็กจาก Apps Script UI', false);
  }

  const writesEnabled = isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false));
  add('Safety: เขียนต้นทางปิด', writesEnabled === false, writesEnabled ? 'เปิดอยู่' : 'ปิดอยู่');

  const okSlipEnabled = isTrue_(getSettingValue_('OKSLIP_ENABLED', false));
  add('OK Slip', true, okSlipEnabled ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม (ไม่บังคับ)');

  const passed = checks.filter(function(x){ return x.pass; }).length;
  return {
    ok: true,
    version: CONFIG.VERSION,
    passed: passed,
    total: checks.length,
    percent: Math.round((passed / checks.length) * 100),
    checks: checks
  };
}

function checkAccess_(body) {
  const lineUserId = String(body.lineUserId || '').trim();
  if (!lineUserId) return { ok: true, allowed: false, message: 'ไม่พบ LINE User ID' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sheet) return { ok: true, allowed: false, message: 'ไม่พบชีตเจ้าหน้าที่' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, allowed: false, message: 'ยังไม่มีเจ้าหน้าที่ที่ได้รับอนุมัติ' };

  const values = sheet.getRange(2, 1, lastRow - 1, 20).getValues();
  const permCol = {
    'ดูข้อมูลลูกค้า': 9,
    'ตอบลูกค้า': 10,
    'ยืนยันสลิป': 11,
    'บันทึกชำระ': 12,
    'ปิดยอด': 13,
    'แก้ข้อมูลลูกค้า': 14,
    'ดูรายงาน': 15,
    'จัดการเจ้าหน้าที่': 16,
    'ดูประวัติ': 17,
    'บันทึกโน้ต': 18
  };

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[1] || '').trim() !== lineUserId) continue;

    if (String(row[2] || '').trim() !== 'เจ้าหน้าที่') {
      return { ok: true, allowed: false, message: 'บัญชีนี้ยังไม่ได้รับอนุมัติเป็นเจ้าหน้าที่' };
    }

    const role = String(row[8] || '').trim();
    const isOwner = role === 'เจ้าของ';
    const allowSystemControl = body.allowSystemControl === true && isOwner;

    if (row[19] !== true && !allowSystemControl) {
      return { ok: true, allowed: false, message: 'บัญชีนี้ถูกปิดการใช้งานบอต' };
    }

    const masterEnabled = isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true));
    const staffBotEnabled = isTrue_(getSettingValue_('BOT_STAFF_ENABLED', true));

    if (!masterEnabled && !allowSystemControl) {
      return { ok: true, allowed: false, message: 'ระบบปิดใช้งานชั่วคราว' };
    }
    if (!staffBotEnabled && !allowSystemControl) {
      return { ok: true, allowed: false, message: 'ระบบเจ้าหน้าที่ปิดใช้งานชั่วคราว' };
    }

    const sourceType = String(body.sourceType || '').trim();
    const groupId = String(body.groupId || '').trim();

    if ((sourceType === 'group' || sourceType === 'room') && !body.allowGroupSetup && !allowSystemControl) {
      if (!isTrue_(getSettingValue_('BOT_GROUP_ENABLED', true))) {
        return { ok: true, allowed: false, message: 'ระบบกลุ่ม LINE ปิดใช้งานชั่วคราว' };
      }
      if (sourceType === 'group') {
        const group = getGroupConfig_(groupId);
        if (!group || !group.botEnabled) {
          return { ok: true, allowed: false, message: 'กลุ่มนี้ยังไม่ได้เปิดใช้งาน Admin ID' };
        }
        if (!group.replyEnabled && !isOwner) {
          return { ok: true, allowed: false, message: 'กลุ่มนี้ปิดการตอบข้อความ' };
        }
      }
    }

    const p = String(body.permission || '').trim();
    if (p && permCol[p] != null && row[permCol[p]] !== true && !allowSystemControl) {
      return { ok: true, allowed: false, message: 'บัญชีนี้ไม่มีสิทธิ์ ' + p };
    }

    return {
      ok: true,
      allowed: true,
      staffName: String(row[0] || '').trim(),
      role: role
    };
  }

  return { ok: true, allowed: false, message: 'บัญชี LINE นี้ยังไม่มีสิทธิ์ใช้งาน Admin ID' };
}

function registerStaff_(body) {
  const lineUserId = String(body.lineUserId || '').trim();
  const staffName = String(body.staffName || '').trim();
  if (!lineUserId || !staffName) {
    return { ok: true, registered: false, message: 'กรุณาพิมพ์ชื่อเจ้าหน้าที่ให้ตรงกับที่ลงทะเบียนไว้' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh) return { ok: false, error: 'ไม่พบชีตเจ้าหน้าที่' };

  const lastRow = Math.max(sh.getLastRow(), 2);
  const values = sh.getRange(2, 1, lastRow - 1, 20).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const name = String(row[0] || '').trim();
    const existingId = String(row[1] || '').trim();
    if (existingId === lineUserId) {
      const status = String(row[2] || '').trim();
      const ownerLineUserIds = values
        .filter(function(r) {
          return String(r[8] || '').trim() === 'เจ้าของ' &&
            String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
            r[19] === true &&
            String(r[1] || '').trim();
        })
        .map(function(r) { return String(r[1] || '').trim(); });

      return {
        ok: true,
        registered: false,
        alreadyRegistered: true,
        pendingApproval: status !== 'เจ้าหน้าที่',
        staffName: name || staffName,
        ownerLineUserIds: ownerLineUserIds,
        message: status === 'เจ้าหน้าที่'
          ? 'LINE นี้ลงทะเบียนเป็นเจ้าหน้าที่แล้ว'
          : 'รออนุมัติ'
      };
    }
    if (name !== staffName) continue;
    if (existingId && existingId !== lineUserId) {
      return { ok: true, registered: false, message: 'ชื่อนี้ถูกผูกกับ LINE อื่นแล้ว' };
    }

    const rowNo = i + 2;
    sh.getRange(rowNo, 2).setValue(lineUserId);
    sh.getRange(rowNo, 3).setValue('รอยืนยัน');
    sh.getRange(rowNo, 5).setValue(new Date());
    sh.getRange(rowNo, 9).setValue(sh.getRange(rowNo, 9).getValue() || 'พนักงาน');
    sh.getRange(rowNo, 20).setValue(false);

    const ownerLineUserIds = values
      .filter(function(r) {
        return String(r[8] || '').trim() === 'เจ้าของ' &&
          String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
          r[19] === true &&
          String(r[1] || '').trim();
      })
      .map(function(r) { return String(r[1] || '').trim(); });

    return {
      ok: true,
      registered: true,
      staffName: staffName,
      ownerLineUserIds: ownerLineUserIds,
      message: 'รออนุมัติ'
    };
  }

  return {
    ok: true,
    registered: false,
    message: 'ไม่พบชื่อเจ้าหน้าที่นี้ในรายการที่เจ้าของเตรียมไว้'
  };
}

function getGroupConfig_(groupId) {
  const id = String(groupId || '').trim();
  if (!id) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.GROUP_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][1] || '').trim() !== id) continue;
    return {
      rowNo: i + 2,
      name: String(values[i][0] || '').trim(),
      groupId: id,
      botEnabled: isTrue_(values[i][2]),
      replyEnabled: isTrue_(values[i][3]),
      notificationsEnabled: isTrue_(values[i][4]),
      mode: String(values[i][5] || '').trim()
    };
  }
  return null;
}

function setGroupEnabled_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'จัดการเจ้าหน้าที่',
    allowGroupSetup: true
  });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, changed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }
  if (String(body.sourceType || '').trim() !== 'group' || !String(body.groupId || '').trim()) {
    return { ok: true, changed: false, message: 'คำสั่งนี้ต้องใช้ในกลุ่ม LINE' };
  }

  const enabled = body.enabled === true;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.GROUP_SHEET);
  if (!sh) return { ok: false, error: 'ไม่พบชีตกลุ่ม LINE' };

  const groupId = String(body.groupId || '').trim();
  const groupName = String(body.groupName || '').trim() || 'LINE Group';
  const current = getGroupConfig_(groupId);

  if (current) {
    sh.getRange(current.rowNo, 1).setValue(groupName || current.name);
    sh.getRange(current.rowNo, 3).setValue(enabled);
    sh.getRange(current.rowNo, 4).setValue(enabled);
    sh.getRange(current.rowNo, 6).setValue(enabled ? 'ตอบทุกข้อความ' : 'ปิด');
    sh.getRange(current.rowNo, 7).setValue(access.staffName || 'เจ้าของ');
    if (enabled && !sh.getRange(current.rowNo, 8).getValue()) sh.getRange(current.rowNo, 8).setValue(new Date());
  } else {
    sh.appendRow([
      groupName, groupId, enabled, enabled, false,
      enabled ? 'ตอบทุกข้อความ' : 'ปิด',
      access.staffName || 'เจ้าของ', new Date(), ''
    ]);
  }

  return {
    ok: true,
    changed: true,
    enabled: enabled,
    groupName: groupName,
    message: enabled ? 'เปิดใช้ Admin ID ในกลุ่มนี้แล้ว' : 'ปิดใช้ Admin ID ในกลุ่มนี้แล้ว'
  };
}

function getGroupStatus_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'จัดการเจ้าหน้าที่',
    allowGroupSetup: true
  });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }
  if (String(body.sourceType || '').trim() !== 'group' || !String(body.groupId || '').trim()) {
    return { ok: true, message: 'คำสั่งนี้ต้องใช้ในกลุ่ม LINE' };
  }

  const group = getGroupConfig_(body.groupId);
  return {
    ok: true,
    group: group || {
      name: String(body.groupName || '').trim() || 'LINE Group',
      groupId: String(body.groupId || '').trim(),
      botEnabled: false,
      replyEnabled: false,
      notificationsEnabled: false,
      mode: 'ยังไม่ลงทะเบียน'
    }
  };
}

function setGroupNotification_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'จัดการเจ้าหน้าที่',
    allowGroupSetup: true
  });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, changed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }
  if (String(body.sourceType || '').trim() !== 'group' || !String(body.groupId || '').trim()) {
    return { ok: true, changed: false, message: 'คำสั่งนี้ต้องใช้ในกลุ่ม LINE' };
  }

  const group = getGroupConfig_(body.groupId);
  if (!group) return { ok: true, changed: false, message: 'ต้องเปิดกลุ่มก่อนด้วยคำสั่ง เปิดกลุ่ม' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.GROUP_SHEET);
  const enabled = body.enabled === true;
  sh.getRange(group.rowNo, 5).setValue(enabled);
  return {
    ok: true,
    changed: true,
    enabled: enabled,
    message: enabled ? 'เปิดรับแจ้งเตือนในกลุ่มนี้แล้ว' : 'ปิดรับแจ้งเตือนในกลุ่มนี้แล้ว'
  };
}

function getReminderOwnerLineIds_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  return values.filter(function(r) {
    return String(r[8] || '').trim() === 'เจ้าของ' &&
      String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
      r[19] === true &&
      isTrue_(r[3]) &&
      String(r[1] || '').trim();
  }).map(function(r){ return String(r[1] || '').trim(); });
}

function getReminderGroupIds_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.GROUP_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  return values.filter(function(r) {
    return String(r[1] || '').trim() && isTrue_(r[2]) && isTrue_(r[4]);
  }).map(function(r){ return String(r[1] || '').trim(); });
}

function reminderDayKey_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

function getReminderDeliveryState_() {
  const props = PropertiesService.getScriptProperties();
  return {
    lastDay: String(props.getProperty('LAST_REMINDER_SENT_DAY') || ''),
    lastAt: String(props.getProperty('LAST_REMINDER_SENT_AT') || '')
  };
}

function markReminderSent_(body) {
  const sent = Number(body.sent || 0);
  const failed = Number(body.failed || 0);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_REMINDER_SENT_DAY', reminderDayKey_());
  props.setProperty('LAST_REMINDER_SENT_AT', new Date().toISOString());
  props.setProperty('LAST_REMINDER_SENT_COUNT', String(sent));
  props.setProperty('LAST_REMINDER_FAILED_COUNT', String(failed));
  return {
    ok: true,
    marked: true,
    day: reminderDayKey_(),
    sent: sent,
    failed: failed
  };
}

function getReminderBatch_(body) {
  const deliveryState = getReminderDeliveryState_();
  const todayKey = reminderDayKey_();
  const alreadySent = deliveryState.lastDay === todayKey;
  if (alreadySent && body.force !== true) {
    return {
      ok: true,
      alreadySent: true,
      lastSentAt: deliveryState.lastAt,
      recipients: [],
      digest: null
    };
  }

  const owners = getReminderOwnerLineIds_();
  if (!owners.length) return { ok: true, recipients: [], digest: null };

  const fakeOwner = owners[0];
  const base = { lineUserId: fakeOwner, sourceType: 'user', groupId: '' };
  const upcoming = listDueCustomers_(Object.assign({}, base, { dueMode: 'upcoming' }));
  const today = listDueCustomers_(Object.assign({}, base, { dueMode: 'today' }));
  const overdue = listDueCustomers_(Object.assign({}, base, { dueMode: 'overdue' }));

  return {
    ok: true,
    alreadySent: alreadySent,
    lastSentAt: deliveryState.lastAt,
    recipients: owners.concat(getReminderGroupIds_()).filter(function(v, i, a){ return a.indexOf(v) === i; }),
    digest: {
      upcoming: (upcoming.items || []).slice(0, 10),
      today: (today.items || []).slice(0, 10),
      overdue: (overdue.items || []).slice(0, 10),
      upcomingCount: (upcoming.items || []).length,
      todayCount: (today.items || []).length,
      overdueCount: (overdue.items || []).length,
      generatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
    }
  };
}


function getAllActiveStaffLineIds_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  return values.filter(function(r) {
    return String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
      r[19] === true &&
      String(r[1] || '').trim();
  }).map(function(r) {
    return String(r[1] || '').trim();
  }).filter(function(v, i, a) {
    return a.indexOf(v) === i;
  });
}

function getStaffSlipRecipients_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType || 'user',
    groupId: body.groupId || '',
    permission: 'ดูข้อมูลลูกค้า'
  });
  if (!access || !access.allowed) {
    return { ok: true, allowed: false, recipients: [], message: access && access.message ? access.message : 'ไม่มีสิทธิ์' };
  }
  return {
    ok: true,
    allowed: true,
    staffName: access.staffName || '',
    role: access.role || '',
    recipients: getAllActiveStaffLineIds_()
  };
}

function ownerAccessForCustomerNotification_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType || 'user',
    groupId: body.groupId || '',
    permission: 'ดูรายงาน'
  });
  return access && access.allowed && String(access.role || '').trim() === 'เจ้าของ'
    ? access
    : null;
}

function customerNotificationSheetKey_(source, sheet) {
  return String(source || '').trim() + '|' + String(sheet || '').trim();
}

function getCustomerAutoReminderSheetKeys_() {
  const props = PropertiesService.getScriptProperties();
  const raw = String(props.getProperty('CUSTOMER_AUTO_REMINDER_SHEETS') || '').trim();
  // No implicit pilot sheet: the owner must explicitly choose each source/tab
  // before automatic customer reminders are allowed to run.
  const keys = raw
    ? raw.split(',').map(function(x){ return String(x || '').trim(); }).filter(Boolean)
    : [];
  return keys.filter(function(v, i, a){ return a.indexOf(v) === i; });
}

function setCustomerAutoReminderSheet_(body) {
  const access = ownerAccessForCustomerNotification_(body);
  if (!access) return { ok: true, allowed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };

  const source = String(body.source || '').trim();
  const sheet = String(body.sheet || '').trim();
  if (!source || !sheet) return { ok: true, allowed: true, changed: false, message: 'กรุณาเลือกชีตก่อน' };
  if (!isConfiguredCustomerNotificationSheet_(source, sheet)) {
    return { ok: true, allowed: true, changed: false, message: 'ไม่พบแหล่งข้อมูลหรือชีตที่เลือก' };
  }

  const key = customerNotificationSheetKey_(source, sheet);
  let keys = getCustomerAutoReminderSheetKeys_();
  const enabled = body.enabled === true;

  if (enabled && keys.indexOf(key) === -1) keys.push(key);
  if (!enabled) keys = keys.filter(function(x){ return x !== key; });

  PropertiesService.getScriptProperties().setProperty('CUSTOMER_AUTO_REMINDER_SHEETS', keys.join(','));

  logAction_({
    lineUserId: body.lineUserId || '',
    staffName: access.staffName || '',
    role: 'เจ้าของ',
    command: enabled ? 'เปิดแจ้งอัตโนมัติ' : 'ปิดแจ้งอัตโนมัติ',
    query: source + '/' + sheet,
    source: source + '/' + sheet,
    result: enabled ? 'เปิดแล้ว' : 'ปิดแล้ว',
    actionName: 'customerAutoReminderSheet',
    status: 'สำเร็จ',
    note: ''
  });

  return {
    ok: true,
    allowed: true,
    changed: true,
    enabled: enabled,
    source: source,
    sheet: sheet,
    message: (enabled ? 'เปิด' : 'ปิด') + 'แจ้งเตือนอัตโนมัติแล้ว\nชีต: ' + sheet
  };
}

function isConfiguredCustomerNotificationSheet_(source, sheet) {
  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const links = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!links || links.getLastRow() < 2) return false;
  const rows = links.getRange(2, 1, links.getLastRow() - 1, 3).getDisplayValues();
  const row = rows.find(function(r) { return String(r[0] || '').trim() === source && isTrue_(r[2]); });
  if (!row) return false;
  const id = extractSpreadsheetId_(row[1]);
  if (!id) return false;
  return !!SpreadsheetApp.openById(id).getSheetByName(sheet);
}

function listCustomerNotificationSheets_(body) {
  const access = ownerAccessForCustomerNotification_(body);
  if (!access) return { ok: true, allowed: false, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };

  const sh = customerLineSheet_();
  const rows = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 13).getDisplayValues() : [];
  const map = {};
  const links = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SOURCE_SHEET);
  if (links && links.getLastRow() >= 2) {
    links.getRange(2, 1, links.getLastRow() - 1, 3).getDisplayValues().forEach(function(r) {
      if (!isTrue_(r[2])) return;
      const source = String(r[0] || '').trim();
      const id = extractSpreadsheetId_(r[1]);
      if (!source || !id) return;
      const sourceBook = SpreadsheetApp.openById(id);
      sourceBook.getSheets().forEach(function(tab) {
        if (tab.isSheetHidden()) return;
        const sheet = tab.getName();
        if (CONFIG.EXCLUDED_TAB_PATTERNS.some(function(p) { return p.test(sheet); })) return;
        map[customerNotificationSheetKey_(source, sheet)] = { source: source, sheet: sheet, count: 0 };
      });
    });
  }
  rows.forEach(function(r) {
    if (String(r[7] || '').trim() !== 'ใช้งาน') return;
    const source = String(r[4] || '').trim();
    const sheet = String(r[5] || '').trim();
    if (!source || !sheet) return;
    const key = source + '|' + sheet;
    if (!map[key]) map[key] = { source: source, sheet: sheet, count: 0 };
    map[key].count++;
  });
  const autoKeys = getCustomerAutoReminderSheetKeys_();
  return {
    ok: true,
    allowed: true,
    items: Object.keys(map).sort().map(function(k){
      map[k].autoEnabled = autoKeys.indexOf(k) !== -1;
      return map[k];
    })
  };
}

function notificationFieldLabel_(field) {
  if (field === 'close') return 'ยอดปิด';
  if (field === 'outstanding') return 'ยอดค้าง';
  if (field === 'due') return 'กำหนดครบวันชำระ';
  return '';
}

function buildCustomerNotificationMessage_(summary, field) {
  const head = 'แจ้งข้อมูลลูกค้า';
  const name = String(summary.name || '').trim();
  const queue = String(summary.queue || '').trim();
  if (field === 'close') {
    return [
      head,
      'ชื่อ: ' + name,
      'คิว: ' + queue,
      'ยอดปิดวันนี้: ' + Number(summary.calculatedClose || 0).toLocaleString('th-TH') + ' บาท',
      summary.discountEligible ? 'สิทธิ์ส่วนลด: ลดค่าเช่า ' + summary.discountPercent + '%' : ''
    ].filter(Boolean).join('\n');
  }
  if (field === 'outstanding') {
    const outstanding = Number(summary.outstanding || 0) > 0
      ? Number(summary.outstanding || 0)
      : Number(summary.accumulatedFee || 0) + Number(summary.lateFee || 0);
    return [
      head,
      'ชื่อ: ' + name,
      'คิว: ' + queue,
      'ยอดค้าง: ' + outstanding.toLocaleString('th-TH') + ' บาท'
    ].join('\n');
  }
  return [
    head,
    'ชื่อ: ' + name,
    'คิว: ' + queue,
    'กำหนดครบวันชำระ: ' + (summary.dueDate || '-'),
    summary.overdueDays > 0 ? 'เกินกำหนด ' + summary.overdueDays + ' วัน' : ''
  ].filter(Boolean).join('\n');
}

function buildCustomerNotificationBatch_(body) {
  const access = ownerAccessForCustomerNotification_(body);
  if (!access) return { ok: true, allowed: false, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return buildCustomerNotificationBatchLocked_(body, access);
  } finally {
    lock.releaseLock();
  }
}

function buildCustomerNotificationBatchLocked_(body, access) {

  const source = String(body.source || '').trim();
  const sheet = String(body.sheet || '').trim();
  const field = String(body.field || '').trim();
  const queueFilter = normalizeGeneral_(body.queue || '');
  const queueFilters = String(body.queues || '').split(',').map(normalizeGeneral_).filter(Boolean);
  if (!source || !sheet) return { ok: true, allowed: true, items: [], message: 'กรุณาเลือกชีตก่อน' };
  if (!isConfiguredCustomerNotificationSheet_(source, sheet)) {
    return { ok: true, allowed: true, items: [], message: 'ไม่พบแหล่งข้อมูลหรือชีตที่เลือก' };
  }
  if (queueFilter && queueFilters.length) return { ok: true, allowed: true, items: [], message: 'เลือกรายคนหรือหลายคนอย่างใดอย่างหนึ่ง' };
  if (['close','outstanding','due'].indexOf(field) === -1) {
    return { ok: true, allowed: true, items: [], message: 'เลือกได้เฉพาะ ยอดปิด / ยอดค้าง / กำหนดครบวันชำระ' };
  }

  const lineSheet = customerLineSheet_();
  if (lineSheet.getLastRow() < 2) return { ok: true, allowed: true, items: [] };
  const bindings = lineSheet.getRange(2, 1, lineSheet.getLastRow() - 1, 13).getDisplayValues();
  const notifySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.NOTIFICATION_QUEUE_SHEET);
  if (!notifySheet) throw new Error('ไม่พบชีต ' + CONFIG.NOTIFICATION_QUEUE_SHEET);
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const type = 'เจ้าของ-' + notificationFieldLabel_(field);
  const existing = notifySheet.getLastRow() >= 2
    ? notifySheet.getRange(2, 1, notifySheet.getLastRow() - 1, 11).getValues() : [];
  const sentToday = {};
  existing.forEach(function(r) {
    if (String(r[1] || '') !== type || String(r[10] || '') !== source + '/' + sheet) return;
    const date = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : '';
    if (date === today && ['ส่งแล้ว', 'รอส่ง'].indexOf(String(r[8] || '').trim()) !== -1) {
      sentToday[String(r[4] || '').trim() + '|' + normalizeGeneral_(r[2])] = true;
    }
  });

  const items = [];
  const seen = {};
  for (let i = 0; i < bindings.length; i++) {
    const r = bindings[i];
    if (String(r[7] || '').trim() !== 'ใช้งาน') continue;
    if (String(r[4] || '').trim() !== source || String(r[5] || '').trim() !== sheet) continue;
    if (queueFilter && normalizeGeneral_(r[6]) !== queueFilter) continue;
    if (queueFilters.length && queueFilters.indexOf(normalizeGeneral_(r[6])) === -1) continue;

    const lineUserId = String(r[1] || '').trim();
    const queue = String(r[6] || '').trim();
    if (!lineUserId || !queue) continue;
    const uniqueKey = lineUserId + '|' + normalizeGeneral_(queue);
    if (seen[uniqueKey] || sentToday[uniqueKey]) continue;
    seen[uniqueKey] = true;

    const c = findCustomerIdentity_(source, sheet, queue);
    if (!c || normalizeGeneral_(c.name) !== normalizeGeneral_(r[2])) continue;
    const summary = calculateCustomerSelfSummary_(c);
    const message = buildCustomerNotificationMessage_(summary, field);
    notifySheet.appendRow([
      new Date(),
      type,
      queue,
      summary.name || '',
      lineUserId,
      summary.dueDate || '',
      field === 'close' ? summary.calculatedClose : (field === 'outstanding' ? (Number(summary.outstanding || 0) || Number(summary.accumulatedFee || 0) + Number(summary.lateFee || 0)) : ''),
      message,
      'รอส่ง',
      '',
      source + '/' + sheet
    ]);
    items.push({
      rowNo: notifySheet.getLastRow(),
      lineUserId: lineUserId,
      queue: queue,
      name: summary.name || '',
      field: field,
      message: message
    });
  }

  logAction_({
    lineUserId: body.lineUserId || '',
    staffName: access.staffName || '',
    role: 'เจ้าของ',
    command: 'ส่งแจ้งลูกค้า',
    query: source + '/' + sheet + ' ' + notificationFieldLabel_(field) + (queueFilter ? ' ' + body.queue : queueFilters.length ? ' ' + queueFilters.join(',') : ' ทั้งหมด'),
    source: source + '/' + sheet,
    result: 'เตรียมส่ง ' + items.length + ' ราย',
    actionName: 'customerNotificationBatch',
    status: 'เตรียมส่ง',
    note: ''
  });

  return {
    ok: true,
    allowed: true,
    items: items,
    count: items.length,
    source: source,
    sheet: sheet,
    field: field,
    message: items.length ? 'เตรียมส่ง ' + items.length + ' ราย' : 'ไม่พบผู้รับใหม่ (รายการวันนี้อาจส่งแล้วหรือกำลังส่ง)'
  };
}

function getCustomerContactRecipients_(body) {
  const lineUserId = String(body.lineUserId || '').trim();
  const bindings = getActiveCustomerBindings_(lineUserId);
  if (!bindings.length) {
    return { ok: true, bound: false, recipients: [], message: 'ยังไม่ได้ผูกบัญชี' };
  }
  const b = bindings[0];
  let c = null;
  try { c = findCustomerIdentity_(b.source, b.sheet, b.queue); } catch (err) {}
  const recipients = getAllActiveStaffLineIds_();
  logAction_({
    lineUserId: lineUserId,
    staffName: c ? c.name : b.name,
    role: 'ลูกค้า',
    command: 'ติดต่อแอดมิน',
    query: b.queue,
    source: b.source + '/' + b.sheet,
    result: 'แจ้งเจ้าหน้าที่ ' + recipients.length + ' คน',
    actionName: 'customerContactAdmin',
    status: recipients.length ? 'สำเร็จ' : 'ไม่พบผู้รับ',
    note: ''
  });
  return {
    ok: true,
    bound: true,
    recipients: recipients,
    customer: {
      name: c ? c.name : b.name,
      queue: b.queue,
      source: b.source,
      sheet: b.sheet,
      lineUserId: lineUserId
    }
  };
}

function getCustomerReminderBatch_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return getCustomerReminderBatchLocked_(body);
  } finally {
    lock.releaseLock();
  }
}

function getCustomerReminderBatchLocked_(body) {
  if (!isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true)) ||
      !isTrue_(getSettingValue_('BOT_CUSTOMER_ENABLED', true))) {
    return { ok: true, items: [], message: 'ระบบลูกค้าปิดใช้งานชั่วคราว' };
  }

  const lineSheet = customerLineSheet_();
  if (lineSheet.getLastRow() < 2) return { ok: true, items: [] };

  const notifySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.NOTIFICATION_QUEUE_SHEET);
  if (!notifySheet) throw new Error('ไม่พบชีต ' + CONFIG.NOTIFICATION_QUEUE_SHEET);

  const enabledKeys = getCustomerAutoReminderSheetKeys_();
  const enabledMap = {};
  enabledKeys.forEach(function(k){ enabledMap[k] = true; });

  const todayText = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const todayParts = todayText.split('-').map(Number);
  const todaySerial = Math.floor(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]) / 86400000);
  const bindings = lineSheet.getRange(2, 1, lineSheet.getLastRow() - 1, 13).getDisplayValues();

  const existing = notifySheet.getLastRow() >= 2
    ? notifySheet.getRange(2, 1, notifySheet.getLastRow() - 1, 11).getDisplayValues()
    : [];

  const existingMap = {};
  existing.forEach(function(r, i) {
    if (String(r[1] || '').trim() !== 'ลูกค้า-ครบกำหนด') return;
    const key = [
      String(r[10] || '').trim(),
      normalizeGeneral_(r[2]),
      String(r[4] || '').trim(),
      String(r[5] || '').trim()
    ].join('|');
    const previous = existingMap[key];
    if (previous && ['ส่งแล้ว', 'รอส่ง'].indexOf(previous.status) !== -1) return;
    existingMap[key] = {
      rowNo: i + 2,
      status: String(r[8] || '').trim()
    };
  });

  const items = [];
  for (let i = 0; i < bindings.length; i++) {
    const r = bindings[i];
    if (String(r[7] || '').trim() !== 'ใช้งาน') continue;
    if (!isTrue_(r[10])) continue;

    const source = String(r[4] || '').trim();
    const sheet = String(r[5] || '').trim();
    const sheetKey = customerNotificationSheetKey_(source, sheet);
    if (!enabledMap[sheetKey]) continue;

    const lineUserId = String(r[1] || '').trim();
    const queue = String(r[6] || '').trim();
    if (!lineUserId || !queue) continue;

    const c = findCustomerIdentity_(source, sheet, queue);
    if (!c || normalizeGeneral_(c.name) !== normalizeGeneral_(r[2])) continue;
    const due = parseDateFlexible_(c.dueDate);
    if (!due) continue;

    const dueText = Utilities.formatDate(due, 'Asia/Bangkok', 'yyyy-MM-dd');
    const dueParts = dueText.split('-').map(Number);
    const dueSerial = Math.floor(Date.UTC(dueParts[0], dueParts[1] - 1, dueParts[2]) / 86400000);
    const daysFromDue = todaySerial - dueSerial;

    // The payment cycle is anchored to the source due date and repeats every 10 days.
    if (daysFromDue < 0 || daysFromDue % 10 !== 0) continue;

    const cycleDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const cycleDisplay = formatThaiDate_(cycleDate);
    const sourceKey = source + '/' + sheet;
    const key = [sourceKey, normalizeGeneral_(c.queue), lineUserId, cycleDisplay].join('|');
    const found = existingMap[key];
    if (found && ['ส่งแล้ว', 'รอส่ง'].indexOf(found.status) !== -1) continue;

    const message = [
      'แจ้งเตือนวันครบกำหนดชำระ',
      'ชื่อ: ' + String(c.name || '').trim(),
      'คิว: ' + String(c.queue || '').trim(),
      'วันครบกำหนดชำระ: ' + cycleDisplay,
      '',
      'กดปุ่มด้านล่างเพื่อตรวจสอบยอดและรายละเอียด'
    ].join('\n');

    let rowNo = found ? found.rowNo : 0;
    if (!rowNo) {
      notifySheet.appendRow([
        new Date(),
        'ลูกค้า-ครบกำหนด',
        String(c.queue || '').trim(),
        String(c.name || '').trim(),
        lineUserId,
        cycleDisplay,
        parseMoney_(c.fee),
        message,
        'รอส่ง',
        '',
        sourceKey
      ]);
      rowNo = notifySheet.getLastRow();
      existingMap[key] = { rowNo: rowNo, status: 'รอส่ง' };
    } else {
      notifySheet.getRange(rowNo, 8).setValue(message);
      notifySheet.getRange(rowNo, 9).setValue('รอส่ง');
    }

    items.push({
      rowNo: rowNo,
      lineUserId: lineUserId,
      queue: String(c.queue || '').trim(),
      name: String(c.name || '').trim(),
      dueDate: cycleDisplay,
      fee: parseMoney_(c.fee),
      source: source,
      sheet: sheet,
      message: message
    });
  }

  if (items.length) {
    logAction_({
      lineUserId: '',
      staffName: 'ระบบ',
      role: 'ระบบ',
      command: 'เตรียมแจ้งเตือนอัตโนมัติ',
      query: items.length + ' ราย',
      source: enabledKeys.join(','),
      result: 'เตรียมส่ง ' + items.length + ' ราย',
      actionName: 'customerAutoReminderBatch',
      status: 'เตรียมส่ง',
      note: ''
    });
  }

  return {
    ok: true,
    items: items,
    enabledSheets: enabledKeys,
    generatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
  };
}

function markCustomerReminderSent_(body) {
  const rowNo = Number(body.rowNo || 0);
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: false, error: 'rowNo ไม่ถูกต้อง' };
  }
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.NOTIFICATION_QUEUE_SHEET);
  if (!sh || rowNo > sh.getLastRow()) return { ok: false, error: 'ไม่พบรายการแจ้งเตือน' };
  const row = sh.getRange(rowNo, 1, 1, 11).getDisplayValues()[0];
  const currentStatus = String(row[8] || '').trim();
  if (currentStatus !== 'รอส่ง') return { ok: false, error: 'รายการนี้ไม่ได้รอส่งแล้ว', rowNo: rowNo };

  const sent = body.sent === true;
  sh.getRange(rowNo, 9).setValue(sent ? 'ส่งแล้ว' : 'ส่งไม่สำเร็จ');
  if (sent) sh.getRange(rowNo, 10).setValue(new Date());
  logAction_({
    lineUserId: String(row[4] || '').trim(),
    staffName: String(row[3] || '').trim(),
    role: 'ลูกค้า',
    command: 'ผลส่งแจ้งลูกค้า',
    query: [String(row[2] || '').trim(), String(row[1] || '').trim()].filter(Boolean).join(' '),
    source: String(row[10] || '').trim(),
    result: sent ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ',
    actionName: 'customerNotificationDelivery',
    status: sent ? 'สำเร็จ' : 'ไม่สำเร็จ',
    note: 'คิวแจ้งเตือนแถว ' + rowNo
  });
  return { ok: true, rowNo: rowNo, sent: sent };
}

function triggerDailyReminder_() {
  const secret = PropertiesService.getScriptProperties().getProperty('SHEETS_BRIDGE_SECRET');
  if (!secret) throw new Error('SHEETS_BRIDGE_SECRET missing');
  const response = UrlFetchApp.fetch(CONFIG.REMINDER_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: secret }),
    muteHttpExceptions: true
  });
  console.log('Reminder endpoint: ' + response.getResponseCode() + ' ' + response.getContentText().slice(0, 500));
}

// Public wrapper: Apps Script hides functions ending with "_" from the
// manual trigger picker. Keep the private implementation above for internal
// calls, and expose this stable handler for the daily time-driven trigger.
function triggerDailyReminder() {
  return triggerDailyReminder_();
}

function installReminderTrigger_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, installed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  let triggers;
  try {
    triggers = ScriptApp.getProjectTriggers();
  } catch (err) {
    return {
      ok: true,
      installed: false,
      manualRequired: true,
      message: 'ต้องติดตั้ง Trigger จาก Apps Script UI: triggerDailyReminder แบบ Time-driven วันละครั้ง'
    };
  }
  triggers.forEach(function(t) {
    if (['triggerDailyReminder', 'triggerDailyReminder_'].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });

  const timeText = String(getSettingValue_('REMIND_TIME', '09:00'));
  const m = timeText.match(/^(\d{1,2}):/);
  let hour = m ? Number(m[1]) : 9;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) hour = 9;

  ScriptApp.newTrigger('triggerDailyReminder')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();

  return {
    ok: true,
    installed: true,
    hour: hour,
    message: 'ติดตั้งแจ้งเตือนรายวันแล้ว ประมาณ ' + String(hour).padStart(2, '0') + ':00'
  };
}

function getReminderTriggerStatus_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }
  try {
    const triggers = ScriptApp.getProjectTriggers().filter(function(t) {
      return ['triggerDailyReminder', 'triggerDailyReminder_'].indexOf(t.getHandlerFunction()) !== -1;
    });
    return {
      ok: true,
      installed: triggers.length > 0,
      count: triggers.length,
      remindTime: String(getSettingValue_('REMIND_TIME', '09:00'))
    };
  } catch (err) {
    return {
      ok: true,
      installed: null,
      manualRequired: true,
      remindTime: String(getSettingValue_('REMIND_TIME', '09:00')),
      message: 'เช็ก Trigger จาก Web App ไม่ได้ ให้ดูใน Apps Script > Triggers'
    };
  }
}

function staffPermissionMap_() {
  return {
    'ดูข้อมูลลูกค้า': 10,
    'ตอบลูกค้า': 11,
    'ยืนยันสลิป': 12,
    'บันทึกชำระ': 13,
    'ปิดยอด': 14,
    'แก้ข้อมูลลูกค้า': 15,
    'ดูรายงาน': 16,
    'จัดการเจ้าหน้าที่': 17,
    'ดูประวัติ': 18,
    'บันทึกโน้ต': 19
  };
}

function findStaffByName_(staffName) {
  const name = String(staffName || '').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) return { sheet: sh, matches: [] };
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  const matches = [];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === name) {
      matches.push({ rowNo: i + 2, row: values[i] });
    }
  }
  return { sheet: sh, matches: matches };
}

function getStaffPermissions_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const found = findStaffByName_(body.query);
  if (!found.matches.length) return { ok: true, message: 'ไม่พบชื่อเจ้าหน้าที่: ' + String(body.query || '') };
  if (found.matches.length > 1) return { ok: true, message: 'พบชื่อซ้ำ กรุณาแก้ชื่อในชีตก่อน' };

  const target = found.matches[0].row;
  const map = staffPermissionMap_();
  const permissions = {};
  Object.keys(map).forEach(function(name) {
    permissions[name] = target[map[name] - 1] === true;
  });

  return {
    ok: true,
    staffName: String(target[0] || '').trim(),
    role: String(target[8] || '').trim(),
    status: String(target[2] || '').trim(),
    botEnabled: target[19] === true,
    permissions: permissions
  };
}

function setStaffPermission_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, changed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const permissionName = String(body.targetPermission || '').trim();
  const map = staffPermissionMap_();
  if (!map[permissionName]) {
    return {
      ok: true,
      changed: false,
      message: 'ไม่พบสิทธิ์นี้\nใช้ได้: ' + Object.keys(map).join(' / ')
    };
  }

  const found = findStaffByName_(body.query);
  if (!found.matches.length) return { ok: true, changed: false, message: 'ไม่พบชื่อเจ้าหน้าที่: ' + String(body.query || '') };
  if (found.matches.length > 1) return { ok: true, changed: false, message: 'พบชื่อซ้ำ กรุณาแก้ชื่อในชีตก่อน' };

  const target = found.matches[0];
  if (String(target.row[8] || '').trim() === 'เจ้าของ') {
    return { ok: true, changed: false, message: 'ไม่แก้สิทธิ์บัญชีเจ้าของผ่านคำสั่งนี้' };
  }
  if (String(target.row[2] || '').trim() !== 'เจ้าหน้าที่' || target.row[19] !== true) {
    return { ok: true, changed: false, message: 'เจ้าหน้าที่คนนี้ยังไม่ได้เปิดใช้งาน' };
  }

  const enabled = body.permissionEnabled === true;
  found.sheet.getRange(target.rowNo, map[permissionName]).setValue(enabled);

  return {
    ok: true,
    changed: true,
    staffName: String(target.row[0] || '').trim(),
    permissionName: permissionName,
    enabled: enabled,
    staffLineUserId: String(target.row[1] || '').trim(),
    message: (enabled ? 'ให้สิทธิ์ ' : 'ถอนสิทธิ์ ') + permissionName + ' สำหรับ ' + String(target.row[0] || '').trim() + ' แล้ว'
  };
}

function listStaff_(body) {
  const requester = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่'
  });
  if (!requester.allowed || String(requester.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, allowed: false, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: [] };

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getDisplayValues();
  const raw = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  const items = values.map(function(row, i) {
    return {
      staffName: String(row[0] || '').trim(),
      status: String(row[2] || '').trim(),
      role: String(row[8] || '').trim(),
      botEnabled: raw[i][19] === true,
      lineBound: !!String(row[1] || '').trim()
    };
  }).filter(function(x) { return x.staffName; });

  return { ok: true, items: items };
}

function setStaffEnabled_(body) {
  const requester = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่'
  });
  if (!requester.allowed || String(requester.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, changed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const staffName = String(body.query || '').trim();
  const enabled = body.enabled === true;
  if (!staffName) return { ok: true, changed: false, message: 'กรุณาระบุชื่อเจ้าหน้าที่' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: true, changed: false, message: 'ไม่พบเจ้าหน้าที่' };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  const matches = [];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === staffName) {
      matches.push({ rowNo: i + 2, row: values[i] });
    }
  }

  if (!matches.length) return { ok: true, changed: false, message: 'ไม่พบชื่อเจ้าหน้าที่: ' + staffName };
  if (matches.length > 1) return { ok: true, changed: false, message: 'พบชื่อซ้ำ กรุณาแก้ชื่อในชีตก่อน' };

  const target = matches[0];
  const row = target.row;
  if (String(row[8] || '').trim() === 'เจ้าของ') {
    return { ok: true, changed: false, message: 'ไม่อนุญาตให้ระงับบัญชีเจ้าของด้วยคำสั่งนี้' };
  }
  if (!String(row[1] || '').trim()) {
    return { ok: true, changed: false, message: 'เจ้าหน้าที่คนนี้ยังไม่ได้ผูก LINE' };
  }

  sh.getRange(target.rowNo, 3).setValue(enabled ? 'เจ้าหน้าที่' : 'ระงับ');
  sh.getRange(target.rowNo, 20).setValue(enabled);

  return {
    ok: true,
    changed: true,
    enabled: enabled,
    staffName: staffName,
    staffLineUserId: String(row[1] || '').trim(),
    message: enabled ? 'เปิดใช้งาน ' + staffName + ' แล้ว' : 'ระงับ ' + staffName + ' แล้ว'
  };
}

function listPendingStaff_(body) {
  const requester = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่'
  });
  if (!requester.allowed) {
    return { ok: true, allowed: false, message: requester.message || 'ไม่มีสิทธิ์จัดการเจ้าหน้าที่' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: [] };

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getDisplayValues();
  const items = values
    .filter(function(row) { return String(row[2] || '').trim() === 'รอยืนยัน'; })
    .map(function(row) {
      return {
        staffName: String(row[0] || '').trim(),
        registeredAt: String(row[4] || '').trim()
      };
    });

  return { ok: true, items: items };
}

function rejectStaff_(body) {
  const requester = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่'
  });
  if (!requester.allowed) {
    return { ok: true, rejected: false, message: requester.message || 'ไม่มีสิทธิ์จัดการเจ้าหน้าที่' };
  }

  const staffName = String(body.query || '').trim();
  if (!staffName) return { ok: true, rejected: false, message: 'รูปแบบ: ไม่อนุมัติ <ชื่อเจ้าหน้าที่>' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: true, rejected: false, message: 'ไม่พบเจ้าหน้าที่รออนุมัติ' };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();
  const matches = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[0] || '').trim() === staffName) matches.push({ rowNo: i + 2, row: row });
  }

  if (!matches.length) return { ok: true, rejected: false, message: 'ไม่พบชื่อเจ้าหน้าที่: ' + staffName };
  if (matches.length > 1) return { ok: true, rejected: false, message: 'พบชื่อซ้ำ กรุณาแก้ชื่อในชีตเจ้าหน้าที่ให้ไม่ซ้ำก่อน' };

  const target = matches[0];
  const row = target.row;
  if (String(row[2] || '').trim() !== 'รอยืนยัน') {
    return { ok: true, rejected: false, message: 'สถานะปัจจุบันไม่ใช่รอยืนยัน' };
  }

  const staffLineUserId = String(row[1] || '').trim();

  // Keep the pre-approved staff name, but clear the LINE binding so they can retry later.
  sh.getRange(target.rowNo, 2).clearContent();
  sh.getRange(target.rowNo, 3).setValue('ระงับ');
  sh.getRange(target.rowNo, 6).setValue(requester.staffName || 'เจ้าของ');
  sh.getRange(target.rowNo, 7).setValue(new Date());
  sh.getRange(target.rowNo, 10, 1, 11).setValues([[
    false, false, false, false, false, false, false, false, false, false, false
  ]]);

  return {
    ok: true,
    rejected: true,
    staffName: staffName,
    staffLineUserId: staffLineUserId,
    message: 'ไม่อนุมัติ ' + staffName + ' แล้ว'
  };
}

function approveStaff_(body) {
  const requester = checkAccess_({
    lineUserId: body.lineUserId,
    permission: 'จัดการเจ้าหน้าที่'
  });
  if (!requester.allowed) {
    return { ok: true, approved: false, message: requester.message || 'ไม่มีสิทธิ์อนุมัติเจ้าหน้าที่' };
  }

  const staffName = String(body.query || '').trim();
  if (!staffName) return { ok: true, approved: false, message: 'รูปแบบ: อนุมัติ <ชื่อเจ้าหน้าที่>' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh) return { ok: false, error: 'ไม่พบชีตเจ้าหน้าที่' };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, approved: false, message: 'ไม่พบเจ้าหน้าที่รออนุมัติ' };

  const values = sh.getRange(2, 1, lastRow - 1, 20).getValues();
  const matches = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[0] || '').trim() === staffName) matches.push({ rowNo: i + 2, row: row });
  }

  if (!matches.length) return { ok: true, approved: false, message: 'ไม่พบชื่อเจ้าหน้าที่: ' + staffName };
  if (matches.length > 1) return { ok: true, approved: false, message: 'พบชื่อซ้ำ กรุณาแก้ชื่อในชีตเจ้าหน้าที่ให้ไม่ซ้ำก่อน' };

  const target = matches[0];
  const row = target.row;
  if (!String(row[1] || '').trim()) {
    return { ok: true, approved: false, message: 'เจ้าหน้าที่คนนี้ยังไม่ได้ผูก LINE' };
  }
  if (String(row[2] || '').trim() === 'เจ้าหน้าที่' && row[19] === true) {
    return { ok: true, approved: false, alreadyApproved: true, message: staffName + ' ได้รับอนุมัติแล้ว' };
  }
  if (String(row[2] || '').trim() !== 'รอยืนยัน') {
    return { ok: true, approved: false, message: 'สถานะปัจจุบันไม่ใช่รอยืนยัน' };
  }

  sh.getRange(target.rowNo, 3).setValue('เจ้าหน้าที่');
  sh.getRange(target.rowNo, 6).setValue(requester.staffName || 'เจ้าของ');
  sh.getRange(target.rowNo, 7).setValue(new Date());
  sh.getRange(target.rowNo, 9).setValue('พนักงาน');

  sh.getRange(target.rowNo, 10).setValue(true);
  sh.getRange(target.rowNo, 18).setValue(true);
  sh.getRange(target.rowNo, 20).setValue(true);

  sh.getRange(target.rowNo, 11, 1, 7).setValues([[false, false, false, false, false, false, false]]);
  sh.getRange(target.rowNo, 19).setValue(false);

  return {
    ok: true,
    approved: true,
    staffName: staffName,
    staffLineUserId: String(row[1] || '').trim(),
    message: 'อนุมัติ ' + staffName + ' แล้ว\nสิทธิ์: ดูข้อมูลลูกค้า + ดูประวัติ\nยังไม่เปิดสิทธิ์การเงิน'
  };
}

function getSettingValue_(key, fallback) {
  if (!SETTINGS_MEMORY_CACHE_) {
    const cacheKey = 'admin-id-settings-v109';
    try {
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) SETTINGS_MEMORY_CACHE_ = JSON.parse(cached);
    } catch (err) {}

    if (!SETTINGS_MEMORY_CACHE_) {
      const map = {};
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
      if (sh && sh.getLastRow() >= 2) {
        const values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
        values.forEach(function(row) {
          const settingKey = String(row[0] || '').trim();
          if (!settingKey || row[4] === false) return;
          map[settingKey] = row[1];
        });
      }
      SETTINGS_MEMORY_CACHE_ = map;
      try {
        CacheService.getScriptCache().put(
          cacheKey,
          JSON.stringify(map),
          CONFIG.SETTINGS_CACHE_SECONDS
        );
      } catch (err) {}
    }
  }

  if (Object.prototype.hasOwnProperty.call(SETTINGS_MEMORY_CACHE_, key)) {
    const value = SETTINGS_MEMORY_CACHE_[key];
    return value == null || value === '' ? fallback : value;
  }
  return fallback;
  /* legacy direct-sheet lookup retained below for rollback reference
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return fallback;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== key) continue;
    if (values[i][4] === false) return fallback;
    return values[i][1] == null || values[i][1] === '' ? fallback : values[i][1];
  }
  return fallback;
  */
}

function parseMoney_(value) {
  const n = Number(String(value == null ? '' : value).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseDateFlexible_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const text = String(value || '').trim();
  if (!text) return null;

  let m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += (y >= 50 ? 2500 : 2000);
    if (y > 2400) y -= 543;
    return new Date(y, Number(m[2]) - 1, Number(m[1]));
  }

  const months = {
    'ม.ค.':0,'มค':0,'มกราคม':0,
    'ก.พ.':1,'กพ':1,'กุมภาพันธ์':1,
    'มี.ค.':2,'มีค':2,'มีนาคม':2,
    'เม.ย.':3,'เมย':3,'เมษายน':3,
    'พ.ค.':4,'พค':4,'พฤษภาคม':4,
    'มิ.ย.':5,'มิย':5,'มิถุนายน':5,
    'ก.ค.':6,'กค':6,'กรกฎาคม':6,
    'ส.ค.':7,'สค':7,'สิงหาคม':7,
    'ก.ย.':8,'กย':8,'กันยายน':8,
    'ต.ค.':9,'ตค':9,'ตุลาคม':9,
    'พ.ย.':10,'พย':10,'พฤศจิกายน':10,
    'ธ.ค.':11,'ธค':11,'ธันวาคม':11
  };
  m = text.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/);
  if (m) {
    let key = m[2].replace(/\s+/g, '');
    let month = months[key];
    if (month == null) month = months[key.replace(/\./g,'')];
    if (month != null) {
      let y = Number(m[3]);
      if (y < 100) y += (y >= 50 ? 2500 : 2000);
      if (y > 2400) y -= 543;
      return new Date(y, month, Number(m[1]));
    }
  }

  const d = new Date(text);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween_(later, earlier) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((later.getTime() - earlier.getTime()) / ms);
}

function formatThaiDate_(d) {
  if (!d) return '';
  return Utilities.formatDate(d, 'Asia/Bangkok', 'dd/MM/yyyy');
}

function latestDiscountStart_(customer, fallbackDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  if (!sh || sh.getLastRow() < 2) return fallbackDate;
  const allowed = { 'ชำระค่าเช่า': true, 'ค่าปรับ': true, 'ต่อรอบ': true };
  const queueText = String(customer.queue || '').trim();
  const queueKey = normalizeGeneral_(queueText);
  const queueRange = sh.getRange(2, 4, sh.getLastRow() - 1, 1);
  let rowNumbers = [];

  try {
    rowNumbers = queueRange.createTextFinder(queueText)
      .matchEntireCell(true)
      .matchCase(false)
      .useRegularExpression(false)
      .findAll()
      .map(function(cell) { return cell.getRow(); });
  } catch (err) {}

  if (!rowNumbers.length) {
    const queues = queueRange.getDisplayValues();
    for (let i = 0; i < queues.length; i++) {
      if (normalizeGeneral_(queues[i][0]) === queueKey) rowNumbers.push(i + 2);
    }
  }

  rowNumbers.sort(function(a, b) { return b - a; });
  for (let i = 0; i < rowNumbers.length; i++) {
    const row = sh.getRange(rowNumbers[i], 1, 1, 16).getValues()[0];
    const sameSource = String(row[1] || '').trim() === String(customer.source || '').trim();
    const sameSheet = String(row[2] || '').trim() === String(customer.sheet || '').trim();
    const sameQueue = normalizeGeneral_(row[3]) === queueKey;
    if (!(sameSource && sameSheet && sameQueue)) continue;
    if (!allowed[String(row[8] || '').trim()]) continue;
    const d = parseDateFlexible_(row[0]);
    if (d) return d;
  }
  return fallbackDate;
}

function verifyCustomerIdentity_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูข้อมูลลูกค้า' });
  if (!access.allowed) return { ok: true, verified: false, message: access.message || 'ไม่มีสิทธิ์' };

  const query = String(body.query || '').trim();
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const idLast4 = String(body.idLast4 || '').trim();

  if (!query || !firstName || !lastName) {
    return {
      ok: true,
      verified: false,
      message: 'รูปแบบ: บัตรประชาชน <คำค้น> <ชื่อ> <นามสกุล> [4ตัวท้าย]\nตัวอย่าง: บัตรประชาชน 101 สมชาย ใจดี 1234'
    };
  }

  if (idLast4 && !/^\d{4}$/.test(idLast4)) {
    return { ok: true, verified: false, message: 'ถ้าระบุเลขบัตร ให้ใส่เฉพาะ 4 ตัวท้ายเท่านั้น' };
  }

  const matches = searchCustomer_(query, true);
  if (!matches.length) return { ok: true, verified: false, message: 'ไม่พบลูกค้า' };
  if (matches.length > 1) {
    return { ok: true, verified: false, needsSelection: true, matches: matches.slice(0, 10) };
  }

  const m = matches[0];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.CUSTOMER_IDENTITY_SHEET);
  if (!sh) throw new Error('ไม่พบชีต ' + CONFIG.CUSTOMER_IDENTITY_SHEET);

  const fullName = (firstName + ' ' + lastName).trim();

  if (sh.getLastRow() >= 2) {
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--) {
      const r = values[i];
      const same =
        String(r[1] || '').trim() === String(m.source || '').trim() &&
        String(r[2] || '').trim() === String(m.sheet || '').trim() &&
        normalizeGeneral_(r[3]) === normalizeGeneral_(m.queue) &&
        String(r[10] || '').trim() === 'ใช้งาน';
      if (!same) continue;
      sh.getRange(i + 2, 11).setValue('ยกเลิก');
      sh.getRange(i + 2, 12).setValue('แทนที่ด้วยการยืนยันล่าสุด');
      break;
    }
  }

  sh.appendRow([
    new Date(),
    m.source,
    m.sheet,
    m.queue,
    firstName,
    lastName,
    fullName,
    idLast4,
    access.staffName || String(body.staffName || ''),
    String(body.lineUserId || ''),
    'ใช้งาน',
    'ยืนยันจากบัตรประชาชน; ไม่เก็บเลขเต็ม'
  ]);

  const history = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  if (history) {
    history.appendRow([
      new Date(), m.source, m.sheet, m.queue, fullName, m.phone, m.appleId, m.model,
      'ยืนยันตัวตน', '', '', '', '', '', access.staffName || String(body.staffName || ''),
      'ยืนยันชื่อ-นามสกุลจากบัตรประชาชน' + (idLast4 ? ' | 4 ตัวท้าย ' + idLast4 : '')
    ]);
  }

  return {
    ok: true,
    verified: true,
    source: m.source,
    sheet: m.sheet,
    queue: m.queue,
    firstName: firstName,
    lastName: lastName,
    fullName: fullName,
    idLast4: idLast4,
    message: 'บันทึกชื่อ-นามสกุลจากบัตรประชาชนแล้ว'
  };
}

function findVerifiedIdentity_(queue, fullName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CUSTOMER_IDENTITY_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const q = normalizeGeneral_(queue);
  const n = normalizeGeneral_(fullName);
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues();
  const out = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    if (String(r[10] || '').trim() !== 'ใช้งาน') continue;
    if (normalizeGeneral_(r[3]) !== q) continue;
    if (normalizeGeneral_(r[6]) !== n) continue;
    out.push({
      source: String(r[1] || '').trim(),
      sheet: String(r[2] || '').trim(),
      queue: String(r[3] || '').trim(),
      fullName: String(r[6] || '').trim()
    });
  }
  return out;
}

function customerLineSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CUSTOMER_LINE_SHEET);
  if (!sh) throw new Error('ไม่พบชีต ' + CONFIG.CUSTOMER_LINE_SHEET);
  return sh;
}

function customerBindingOwnerIds_() {
  return getReminderOwnerLineIds_();
}

function findExactCustomerForBinding_(queue, fullName) {
  const targets = (CONFIG.CUSTOMER_BINDING_TARGETS || [{
    source: CONFIG.CUSTOMER_PILOT_SOURCE,
    sheet: CONFIG.CUSTOMER_PILOT_SHEET
  }]).map(function(t) {
    return { source: String(t.source || '').trim(), sheet: String(t.sheet || '').trim() };
  }).filter(function(t) { return t.source && t.sheet; });

  function isTarget(source, sheet) {
    return targets.some(function(t) {
      return normalizeGeneral_(t.source) === normalizeGeneral_(source) &&
        normalizeGeneral_(t.sheet) === normalizeGeneral_(sheet);
    });
  }

  const verified = findVerifiedIdentity_(queue, fullName).filter(function(v) {
    return isTarget(v.source, v.sheet);
  });
  if (verified.length === 1) {
    const v = verified[0];
    const c = findCustomerIdentity_(v.source, v.sheet, v.queue);
    return c && normalizeGeneral_(c.name) === normalizeGeneral_(fullName) ? [c] : [];
  }
  if (verified.length > 1) {
    const found = [];
    verified.forEach(function(v) {
      const c = findCustomerIdentity_(v.source, v.sheet, v.queue);
      if (c && normalizeGeneral_(c.name) === normalizeGeneral_(fullName)) found.push(c);
    });
    return found;
  }

  const queueKey = normalizeGeneral_(queue);
  const nameKey = normalizeGeneral_(fullName);
  if (!queueKey || !nameKey) return [];
  const matches = [];
  targets.forEach(function(t) {
    let customer = null;
    try { customer = findCustomerIdentity_(t.source, t.sheet, queue); } catch (err) {}
    if (customer && normalizeGeneral_(customer.name) === nameKey) matches.push(customer);
  });
  const seen = {};
  return matches.filter(function(c) {
    const key = [c.source, c.sheet, normalizeGeneral_(c.queue)].join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return isTarget(c.source, c.sheet) &&
      normalizeGeneral_(c.queue) === queueKey &&
      normalizeGeneral_(c.name) === nameKey;
  });
}

function maskCustomerPhone_(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return raw;
  return digits.slice(0, 3) + '-xxx-' + digits.slice(-4);
}

function customerBindingOverview_(c) {
  const saleDate = parseDateFlexible_(c.saleDate);
  return {
    name: String(c.name || '').trim(),
    queue: String(c.queue || '').trim(),
    model: String(c.model || '').trim(),
    phoneMasked: maskCustomerPhone_(c.phone),
    principal: String(c.principal || '').trim(),
    fee: String(c.fee || '').trim(),
    saleDate: saleDate ? formatThaiDate_(saleDate) : String(c.saleDate || '').trim()
  };
}

function logCustomerBindingEvent_(lineUserId, queue, fullName, result, status, note) {
  try {
    logAction_({
      lineUserId: String(lineUserId || '').trim(),
      staffName: String(fullName || '').trim(),
      role: 'ลูกค้า',
      command: 'ผูกบัญชี',
      query: [String(queue || '').trim(), String(fullName || '').trim()].filter(Boolean).join(' '),
      source: (CONFIG.CUSTOMER_BINDING_TARGETS || []).map(function(t){ return t.source + '/' + t.sheet; }).join(',') ||
        String(CONFIG.CUSTOMER_PILOT_SOURCE || '') + '/' + String(CONFIG.CUSTOMER_PILOT_SHEET || ''),
      result: String(result || ''),
      actionName: 'customerBinding',
      status: String(status || ''),
      note: String(note || '')
    });
  } catch (err) {
    console.log('customer binding log failed: ' + err.message);
  }
}

function requestCustomerBinding_(body) {
  // Serialize the check and insert: concurrent LINE deliveries must never create two bindings.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return requestCustomerBindingLocked_(body);
  } finally {
    lock.releaseLock();
  }
}

function requestCustomerBindingLocked_(body) {
  const lineUserId = String(body.lineUserId || '').trim();
  const queue = String(body.queue || '').trim();
  const fullName = String(body.fullName || '').trim();
  if (!isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true)) ||
      !isTrue_(getSettingValue_('BOT_CUSTOMER_ENABLED', true))) {
    logCustomerBindingEvent_(lineUserId, queue, fullName, 'ระบบลูกค้าปิด', 'ไม่สำเร็จ', '');
    return { ok: true, bound: false, message: 'ระบบลูกค้าปิดใช้งานชั่วคราว' };
  }

  if (!lineUserId) {
    logCustomerBindingEvent_(lineUserId, queue, fullName, 'ไม่มี LINE User ID', 'ไม่สำเร็จ', '');
    return { ok: true, bound: false, message: 'ไม่พบ LINE User ID' };
  }
  if (!queue || !fullName) {
    logCustomerBindingEvent_(lineUserId, queue, fullName, 'ข้อมูลไม่ครบ', 'ไม่สำเร็จ', '');
    return { ok: true, bound: false, message: 'กรุณาแจ้ง คิว + ชื่อ + นามสกุล\nตัวอย่าง: 6101 สมชาย ใจดี' };
  }

  const sh = customerLineSheet_();
  const values = sh.getLastRow() >= 2
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 13).getDisplayValues()
    : [];

  // One LINE User ID may have only one active customer identity.
  // Once bound, it cannot be used to probe or bind another queue/name.
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const sameLine = String(r[1] || '').trim() === lineUserId;
    const status = String(r[7] || '').trim();
    if (!sameLine || !status || status === 'ไม่อนุมัติ') continue;

    const sameQueue = normalizeGeneral_(r[6]) === normalizeGeneral_(queue);
    const sameName = normalizeGeneral_(r[2]) === normalizeGeneral_(fullName);

    if (sameQueue && sameName && status === 'ใช้งาน') {
      try { sh.getRange(i + 2, 13).setValue(new Date()); } catch (err) {}
      logCustomerBindingEvent_(lineUserId, queue, fullName, 'ผูกอยู่แล้ว', 'สำเร็จ', 'ส่งข้อมูลเดิมซ้ำ');
      let existing = null;
      try { existing = findCustomerIdentity_(r[4], r[5], r[6]); } catch (err) {}
      return {
        ok: true,
        bound: true,
        alreadyBound: true,
        locked: true,
        customerName: String(r[2] || '').trim(),
        queue: String(r[6] || '').trim(),
        source: String(r[4] || '').trim(),
        sheet: String(r[5] || '').trim(),
        customerOverview: existing && normalizeGeneral_(existing.name) === normalizeGeneral_(r[2])
          ? customerBindingOverview_(existing) : null,
        message: 'บัญชี LINE นี้ผูกกับข้อมูลลูกค้าเรียบร้อยแล้ว\nชื่อ: ' +
          String(r[2] || '').trim() + '\nคิว: ' + String(r[6] || '').trim()
      };
    }

    logCustomerBindingEvent_(
      lineUserId,
      queue,
      fullName,
      'ปฏิเสธ: LINE ผูกลูกค้าอื่นแล้ว',
      'ปฏิเสธ',
      'ผูกอยู่กับ ' + String(r[2] || '').trim() + ' คิว ' + String(r[6] || '').trim() + ' | สถานะ ' + status
    );
    return {
      ok: true,
      bound: status === 'ใช้งาน',
      suspended: status !== 'ใช้งาน',
      alreadyBound: true,
      locked: true,
      rejectedNewIdentity: true,
      customerName: String(r[2] || '').trim(),
      queue: String(r[6] || '').trim(),
      source: String(r[4] || '').trim(),
      sheet: String(r[5] || '').trim(),
      message: (status === 'ใช้งาน' ? 'บัญชี LINE นี้ผูกกับลูกค้าแล้ว' : 'บัญชี LINE นี้ถูกระงับ กรุณาติดต่อแอดมิน') +
        '\nชื่อ: ' + String(r[2] || '').trim() + '\nคิว: ' + String(r[6] || '').trim() +
        '\nไม่สามารถใช้ LINE นี้ตรวจสอบชื่อหรือคิวอื่นได้'
    };
  }

  const matches = findExactCustomerForBinding_(queue, fullName);
  if (!matches.length) {
    logCustomerBindingEvent_(lineUserId, queue, fullName, 'ไม่พบข้อมูลตรง', 'ไม่สำเร็จ', 'V6/10-69 หรือ v1/v3/v3/10-69');
    return {
      ok: true,
      bound: false,
      message: 'ข้อมูลไม่ตรงหรือไม่พบในรายการที่เปิดใช้งาน กรุณาตรวจสอบคิว ชื่อ และนามสกุลอีกครั้ง'
    };
  }
  if (matches.length > 1) {
    logCustomerBindingEvent_(lineUserId, queue, fullName, 'พบข้อมูลซ้ำ', 'รอตรวจ', 'มากกว่า 1 รายการ');
    return {
      ok: true,
      bound: false,
      needsStaffHelp: true,
      message: 'พบข้อมูลซ้ำมากกว่า 1 รายการ กรุณาติดต่อเจ้าหน้าที่'
    };
  }

  const c = matches[0];
  let reusableRowNo = 0;

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const sameLine = String(r[1] || '').trim() === lineUserId;
    const sameCustomer =
      String(r[4] || '').trim() === String(c.source || '').trim() &&
      String(r[5] || '').trim() === String(c.sheet || '').trim() &&
      normalizeGeneral_(r[6]) === normalizeGeneral_(c.queue);
    const status = String(r[7] || '').trim();

    if (sameCustomer && status !== 'ไม่อนุมัติ' && !sameLine) {
      logCustomerBindingEvent_(lineUserId, queue, fullName, 'ปฏิเสธ: ลูกค้าผูก LINE อื่นแล้ว', 'ปฏิเสธ', '');
      return {
        ok: true,
        bound: false,
        needsStaffHelp: true,
        message: 'ข้อมูลลูกค้านี้ถูกผูกกับ LINE อื่นแล้ว กรุณาติดต่อเจ้าหน้าที่'
      };
    }

    if (sameLine && sameCustomer && status !== 'ใช้งาน' && !reusableRowNo) {
      reusableRowNo = i + 2;
    }
  }

  const now = new Date();
  const note = 'ยืนยันอัตโนมัติและล็อก LINE ID: คิว + ชื่อตรง ' +
    String(c.source || '') + '/' + String(c.sheet || '');

  let rowNo;
  if (reusableRowNo) {
    sh.getRange(reusableRowNo, 1, 1, 13).setValues([[
      now,
      lineUserId,
      String(c.name || '').trim(),
      String(c.phone || '').trim(),
      String(c.source || '').trim(),
      String(c.sheet || '').trim(),
      String(c.queue || '').trim(),
      'ใช้งาน',
      'ระบบ',
      now,
      true,
      note,
      now
    ]]);
    rowNo = reusableRowNo;
  } else {
    sh.appendRow([
      now,
      lineUserId,
      String(c.name || '').trim(),
      String(c.phone || '').trim(),
      String(c.source || '').trim(),
      String(c.sheet || '').trim(),
      String(c.queue || '').trim(),
      'ใช้งาน',
      'ระบบ',
      now,
      true,
      note,
      now
    ]);
    rowNo = sh.getLastRow();
  }

  logCustomerBindingEvent_(
    lineUserId,
    c.queue,
    c.name,
    'ผูกบัญชีสำเร็จ',
    'สำเร็จ',
    'ลูกค้า LINE แถว ' + rowNo + ' | สถานะ ใช้งาน'
  );

  return {
    ok: true,
    bound: true,
    autoApproved: true,
    locked: true,
    rowNo: rowNo,
    customerName: String(c.name || '').trim(),
    queue: String(c.queue || '').trim(),
    source: String(c.source || '').trim(),
    sheet: String(c.sheet || '').trim(),
    customerOverview: customerBindingOverview_(c),
    message: 'ตรวจสอบข้อมูลถูกต้องแล้ว\nชื่อ: ' + String(c.name || '').trim() +
      '\nคิว: ' + String(c.queue || '').trim() +
      '\nผูก LINE นี้เรียบร้อยแล้ว และไม่สามารถตรวจสอบชื่ออื่นด้วย LINE นี้ได้'
  };
}

function getActiveCustomerBindings_(lineUserId) {
  const id = String(lineUserId || '').trim();
  const sh = customerLineSheet_();
  if (!id || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getDisplayValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    if (String(r[1] || '').trim() !== id) continue;
    if (String(r[7] || '').trim() !== 'ใช้งาน') continue;
    out.push({
      rowNo: i + 2,
      name: String(r[2] || '').trim(),
      phone: String(r[3] || '').trim(),
      source: String(r[4] || '').trim(),
      sheet: String(r[5] || '').trim(),
      queue: String(r[6] || '').trim(),
      notifications: isTrue_(r[10])
    });
  }
  return out;
}

function calculateCustomerSelfSummary_(c) {
  const principal = parseMoney_(c.principal);
  const fee = parseMoney_(c.fee);
  const saleDate = parseDateFlexible_(c.saleDate);
  const dueDate = parseDateFlexible_(c.dueDate);
  const now = new Date();
  const asOf = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const latePerDay = Number(getSettingValue_('LATE_FEE_PER_DAY', 50)) || 50;
  const discountDays = Number(getSettingValue_('CLOSE_DISCOUNT_DAYS', 5)) || 5;
  const discountPercent = Number(getSettingValue_('CLOSE_FEE_DISCOUNT_PERCENT', 50)) || 50;
  const cycleDays = 10;

  const overdueDays = dueDate ? Math.max(0, daysBetween_(asOf, dueDate)) : 0;
  const cyclesCrossed = overdueDays > 0 ? Math.floor(overdueDays / cycleDays) : 0;
  const crossCycle = cyclesCrossed >= 1;
  const accumulatedFee = fee * (1 + cyclesCrossed);
  const lateFee = overdueDays * latePerDay;

  const discountStart = latestDiscountStart_(c, saleDate);
  const daysFromDiscountStart = discountStart ? daysBetween_(asOf, discountStart) : null;
  const discountEligible = !!discountStart && !crossCycle &&
    daysFromDiscountStart >= 0 && daysFromDiscountStart <= discountDays;

  const feeApplied = discountEligible
    ? accumulatedFee * (1 - discountPercent / 100)
    : accumulatedFee;
  const discountAmount = Math.max(0, accumulatedFee - feeApplied);

  return {
    name: String(c.name || '').trim(),
    queue: String(c.queue || '').trim(),
    model: String(c.model || '').trim(),
    phoneMasked: maskCustomerPhone_(c.phone),
    source: String(c.source || '').trim(),
    status: String(c.status || '').trim(),
    principal: principal,
    fee: fee,
    principalPresent: String(c.principal || '').trim() !== '',
    feePresent: String(c.fee || '').trim() !== '',
    saleDate: saleDate ? formatThaiDate_(saleDate) : String(c.saleDate || '').trim(),
    accumulatedFee: accumulatedFee,
    dueDate: dueDate ? formatThaiDate_(dueDate) : String(c.dueDate || ''),
    outstanding: parseMoney_(c.outstanding),
    overdueDays: overdueDays,
    lateFee: lateFee,
    paymentTotal: accumulatedFee + lateFee,
    discountEligible: discountEligible,
    discountPercent: discountEligible ? discountPercent : 0,
    discountAmount: discountAmount,
    feeApplied: feeApplied,
    calculatedClose: principal + feeApplied + lateFee,
    calculatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
  };
}

function getCustomerSelf_(body) {
  if (!isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true)) ||
      !isTrue_(getSettingValue_('BOT_CUSTOMER_ENABLED', true))) {
    return { ok: true, bound: false, message: 'ระบบลูกค้าปิดใช้งานชั่วคราว' };
  }

  const lineUserId = String(body.lineUserId || '').trim();
  const bindings = getActiveCustomerBindings_(lineUserId);
  if (!bindings.length) {
    return {
      ok: true,
      bound: false,
      message: 'ยังไม่ได้ผูกบัญชี\nพิมพ์: ผูกบัญชี <คิว> <ชื่อ นามสกุล>\nตัวอย่าง: ผูกบัญชี 101 สมชาย ใจดี'
    };
  }

  const items = [];
  const staleRows = [];
  for (let i = 0; i < bindings.length; i++) {
    const b = bindings[i];
    let c = null;
    try {
      c = findCustomerIdentity_(b.source, b.sheet, b.queue);
    } catch (err) {}
    if (!c || normalizeGeneral_(c.name) !== normalizeGeneral_(b.name)) {
      staleRows.push(b.rowNo);
      continue;
    }
    items.push(calculateCustomerSelfSummary_(c));
  }

  const sh = customerLineSheet_();
  bindings.forEach(function(b) {
    try { sh.getRange(b.rowNo, 13).setValue(new Date()); } catch (err) {}
  });

  return {
    ok: true,
    bound: true,
    items: items,
    staleCount: staleRows.length,
    field: String(body.field || 'menu').trim()
  };
}

function cancelCustomerBindings_(body) {
  return { ok: true, changed: false, message: 'บัญชีที่ผูกแล้วเปลี่ยนเองไม่ได้ กรุณาติดต่อแอดมิน' };
}

function listPendingCustomerBindings_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }
  const sh = customerLineSheet_();
  if (sh.getLastRow() < 2) return { ok: true, items: [] };
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getDisplayValues();
  const items = [];
  for (let i = values.length - 1; i >= 0 && items.length < 20; i--) {
    const r = values[i];
    if (String(r[7] || '').trim() !== 'รออนุมัติ') continue;
    items.push({
      rowNo: i + 2,
      dateTime: r[0],
      name: r[2],
      phone: r[3],
      source: r[4],
      sheet: r[5],
      queue: r[6]
    });
  }
  return { ok: true, items: items };
}

function resolveCustomerBinding_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'จัดการเจ้าหน้าที่' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, resolved: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, resolved: false, message: 'รูปแบบ: อนุมัติลูกค้า <เลข> หรือ ไม่อนุมัติลูกค้า <เลข>' };
  }

  const sh = customerLineSheet_();
  if (rowNo > sh.getLastRow()) return { ok: true, resolved: false, message: 'ไม่พบคำขอนี้' };

  const row = sh.getRange(rowNo, 1, 1, 13).getDisplayValues()[0];
  if (String(row[7] || '').trim() !== 'รออนุมัติ') {
    return { ok: true, resolved: false, message: 'คำขอนี้ไม่ได้อยู่สถานะรออนุมัติ' };
  }

  const decision = String(body.decision || '').trim();
  const approved = decision === 'อนุมัติ';
  sh.getRange(rowNo, 8).setValue(approved ? 'ใช้งาน' : 'ไม่อนุมัติ');
  sh.getRange(rowNo, 9).setValue(access.staffName || 'เจ้าของ');
  sh.getRange(rowNo, 10).setValue(new Date());
  sh.getRange(rowNo, 12).setValue(approved ? 'อนุมัติการผูก LINE ลูกค้า' : 'ไม่อนุมัติการผูก LINE ลูกค้า');

  return {
    ok: true,
    resolved: true,
    approved: approved,
    rowNo: rowNo,
    customerLineUserId: String(row[1] || '').trim(),
    customerName: String(row[2] || '').trim(),
    queue: String(row[6] || '').trim(),
    message: approved ? 'อนุมัติลูกค้าแล้ว' : 'ไม่อนุมัติลูกค้าแล้ว'
  };
}

function getCalculatedSummary_(body) {
  const query = String(body.query || '').trim();
  if (!query) return { ok: false, error: 'กรุณาระบุคำค้น' };

  const matches = searchCustomer_(query, true);
  if (!matches.length) return { ok: true, matches: [], summary: null };
  if (matches.length > 1) return { ok: true, needsSelection: true, matches: matches.slice(0, 10) };

  const c = matches[0];
  const principal = parseMoney_(c.principal);
  const fee = parseMoney_(c.fee);
  const saleDate = parseDateFlexible_(c.saleDate);
  const dueDate = parseDateFlexible_(c.dueDate);
  const today = new Date();
  const asOf = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const latePerDay = Number(getSettingValue_('LATE_FEE_PER_DAY', 50)) || 50;
  const discountDays = Number(getSettingValue_('CLOSE_DISCOUNT_DAYS', 5)) || 5;
  const discountPercent = Number(getSettingValue_('CLOSE_FEE_DISCOUNT_PERCENT', 50)) || 50;
  const cycleDays = 10;

  const overdueDays = dueDate ? Math.max(0, daysBetween_(asOf, dueDate)) : 0;
  const cyclesCrossed = overdueDays > 0 ? Math.floor(overdueDays / cycleDays) : 0;
  const crossCycle = cyclesCrossed >= 1;
  const accumulatedFee = fee * (1 + cyclesCrossed);
  const lateFee = overdueDays * latePerDay;

  const discountStart = latestDiscountStart_(c, saleDate);
  const daysFromDiscountStart = discountStart ? daysBetween_(asOf, discountStart) : null;
  const discountEligible = !!discountStart && !crossCycle &&
    daysFromDiscountStart >= 0 && daysFromDiscountStart <= discountDays;

  const feeApplied = discountEligible
    ? accumulatedFee * (1 - discountPercent / 100)
    : accumulatedFee;
  const calculatedClose = principal + feeApplied + lateFee;

  return {
    ok: true,
    summary: {
      customer: c,
      principal: principal,
      fee: fee,
      dueDate: dueDate ? formatThaiDate_(dueDate) : String(c.dueDate || ''),
      overdueDays: overdueDays,
      lateFee: lateFee,
      cyclesCrossed: cyclesCrossed,
      accumulatedFee: accumulatedFee,
      crossCycleOutstanding: crossCycle,
      discountEligible: discountEligible,
      discountPercent: discountEligible ? discountPercent : 0,
      discountStartDate: discountStart ? formatThaiDate_(discountStart) : '',
      calculatedClose: calculatedClose,
      sourceCloseAmount: parseMoney_(c.closeAmount),
      calculatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
    }
  };
}

function listDueCustomers_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'ดูรายงาน'
  });
  if (!access.allowed) return { ok: true, items: [], message: access.message || 'ไม่มีสิทธิ์ดูรายงาน' };

  const mode = String(body.dueMode || 'today').trim();
  const remindDays = Number(getSettingValue_('REMIND_BEFORE_DAYS', 1)) || 1;
  const cache = CacheService.getScriptCache();
  const cacheKey = 'due-list:' + mode + ':' + remindDays;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet || sourceSheet.getLastRow() < 2) return { ok: true, items: [] };

  const todayRaw = new Date();
  const today = new Date(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate());
  const sources = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, 7).getValues();
  const items = [];

  for (let i = 0; i < sources.length && items.length < 50; i++) {
    const sourceName = String(sources[i][0] || '').trim();
    const url = String(sources[i][1] || '').trim();
    if (!isTrue_(sources[i][2]) || !url) continue;
    try {
      const id = extractSpreadsheetId_(url);
      if (!id) continue;
      const ss = SpreadsheetApp.openById(id);
      let tabs = ss.getSheets().filter(function(sh) {
        if (sh.isSheetHidden()) return false;
        return !CONFIG.EXCLUDED_TAB_PATTERNS.some(function(rx){ return rx.test(sh.getName()); });
      });
      if (!isTrue_(sources[i][3])) tabs = tabs.slice(0, 1);

      for (let t = 0; t < tabs.length && items.length < 50; t++) {
        const sh = tabs[t];
        const h = detectHeaders_(sh);
        if (!h || !h.dueDate) continue;
        const lastRow = sh.getLastRow();
        const startRow = h.headerRow + 1;
        if (startRow > lastRow) continue;
        const rowCount = Math.min(lastRow - h.headerRow, CONFIG.MAX_ROWS_PER_TAB);
        const maxCol = Math.max.apply(null, Object.keys(h).filter(function(k){return k !== 'headerRow';}).map(function(k){return h[k];}).filter(function(v){return v > 0;}));
        const values = sh.getRange(startRow, 1, rowCount, maxCol).getDisplayValues();

        for (let r = 0; r < values.length && items.length < 50; r++) {
          const row = values[r];
          const dueText = getCell_(row, h.dueDate);
          const due = parseDateFlexible_(dueText);
          if (!due) continue;
          const delta = daysBetween_(due, today);
          let include = false;
          if (mode === 'today') include = delta === 0;
          else if (mode === 'upcoming') include = delta > 0 && delta <= remindDays;
          else if (mode === 'overdue') include = delta < 0;
          if (!include) continue;

          items.push({
            source: sourceName,
            sheet: sh.getName(),
            row: startRow + r,
            queue: getCell_(row, h.queue),
            name: getCell_(row, h.name),
            phone: getCell_(row, h.phone),
            dueDate: dueText,
            daysDelta: delta,
            principal: getCell_(row, h.principal),
            fee: getCell_(row, h.fee),
            status: getCell_(row, h.status)
          });
        }
      }
    } catch (err) {
      console.log('due scan failed: ' + sourceName + ' / ' + err.message);
    }
  }

  if (mode === 'overdue') {
    items.sort(function(a,b){ return a.daysDelta - b.daysDelta; });
  } else {
    items.sort(function(a,b){ return a.daysDelta - b.daysDelta; });
  }

  const result = { ok: true, mode: mode, items: items.slice(0, 50), totalShown: Math.min(items.length, 50) };
  try { cache.put(cacheKey, JSON.stringify(result), CONFIG.SEARCH_CACHE_SECONDS); } catch (err) {}
  return result;
}

function getStaffActivity_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const targetName = String(body.query || '').trim();
  const todayOnly = body.activityToday === true;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: [] };

  const raw = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  const display = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getDisplayValues();
  const todayKey = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const items = [];

  for (let i = raw.length - 1; i >= 0 && items.length < 20; i--) {
    const row = display[i];
    const staffName = String(row[2] || '').trim();
    if (targetName && normalizeGeneral_(staffName) !== normalizeGeneral_(targetName)) continue;

    if (todayOnly) {
      const d = raw[i][0] instanceof Date ? raw[i][0] : new Date(raw[i][0]);
      if (isNaN(d.getTime()) || Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd') !== todayKey) continue;
    }

    items.push({
      dateTime: row[0],
      staffName: staffName,
      role: row[3],
      command: row[4],
      query: row[5],
      result: row[7],
      actionName: row[8],
      status: row[9]
    });
  }

  return {
    ok: true,
    targetName: targetName,
    todayOnly: todayOnly,
    items: items
  };
}

function dailyOwnerReport_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, allowed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = 'Asia/Bangkok';
  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  let commandCount = 0, searchCount = 0, errorCount = 0;
  const log = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (log && log.getLastRow() >= 2) {
    const vals = log.getRange(2, 1, log.getLastRow() - 1, 11).getValues();
    for (let i = 0; i < vals.length; i++) {
      const d = vals[i][0] instanceof Date ? vals[i][0] : new Date(vals[i][0]);
      if (isNaN(d.getTime()) || Utilities.formatDate(d, tz, 'yyyy-MM-dd') !== todayKey) continue;
      commandCount++;
      if (String(vals[i][8] || '').trim() === 'searchCustomer') searchCount++;
      if (String(vals[i][9] || '').trim() === 'ผิดพลาด') errorCount++;
    }
  }

  let pendingReview = 0;
  const rq = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (rq && rq.getLastRow() >= 2) {
    const vals = rq.getRange(2, 9, rq.getLastRow() - 1, 1).getDisplayValues();
    pendingReview = vals.filter(function(r){ return String(r[0] || '').trim() === 'รอตรวจ'; }).length;
  }

  let pendingStaff = 0;
  const st = ss.getSheetByName(CONFIG.STAFF_SHEET);
  if (st && st.getLastRow() >= 2) {
    const vals = st.getRange(2, 3, st.getLastRow() - 1, 1).getDisplayValues();
    pendingStaff = vals.filter(function(r){ return String(r[0] || '').trim() === 'รอยืนยัน'; }).length;
  }

  return {
    ok: true,
    report: {
      commandCount: commandCount,
      searchCount: searchCount,
      errorCount: errorCount,
      pendingReview: pendingReview,
      pendingStaff: pendingStaff
    }
  };
}

function systemStatus_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, allowed: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  let enabledSources = 0;
  if (src && src.getLastRow() >= 2) {
    const vals = src.getRange(2, 1, src.getLastRow() - 1, 3).getValues();
    enabledSources = vals.filter(function(r){ return String(r[1] || '').trim() && isTrue_(r[2]); }).length;
  }

  return {
    ok: true,
    status: {
      botName: String(getSettingValue_('BOT_NAME', 'Admin ID')),
      masterEnabled: isTrue_(getSettingValue_('BOT_MASTER_ENABLED', true)),
      staffEnabled: isTrue_(getSettingValue_('BOT_STAFF_ENABLED', true)),
      groupEnabled: isTrue_(getSettingValue_('BOT_GROUP_ENABLED', true)),
      okSlipEnabled: isTrue_(getSettingValue_('OKSLIP_ENABLED', false)),
      webhookStatus: String(getSettingValue_('WEBHOOK_STATUS', 'ยังไม่เชื่อม')),
      financialSourceWrites: isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false)),
      reminderInternalOnly: isTrue_(getSettingValue_('REMINDER_INTERNAL_ONLY', true)),
      enabledSources: enabledSources
    }
  };
}

function getCustomerInfo_(body) {
  const query = String(body.query || '').trim();
  if (!query) return { ok: false, error: 'กรุณาระบุคำค้น' };
  const matches = searchCustomer_(query, true);
  if (!matches.length) return { ok: true, matches: [], info: null };
  if (matches.length > 1) return { ok: true, matches: matches.slice(0, 10), needsSelection: true };
  return { ok: true, matches: matches, info: matches[0] };
}

function parseQualifiedSearch_(query) {
  const text = String(query || '').trim();
  const idx = text.indexOf(':');
  if (idx <= 0) return { source: '', query: text };

  const source = text.slice(0, idx).trim();
  const inner = text.slice(idx + 1).trim();
  if (!source || !inner) return { source: '', query: text };

  return { source: source, query: inner };
}

function searchCustomer_(query, includeDetails) {
  const qualified = parseQualifiedSearch_(query);
  const sourceFilter = normalizeGeneral_(qualified.source);
  const effectiveQuery = qualified.query;

  const cache = CacheService.getScriptCache();
  const cacheKey = 'customer-search:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      normalizeGeneral_(sourceFilter + ':' + effectiveQuery)
    )
  );
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {}
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet) throw new Error('ไม่พบชีต "' + CONFIG.SOURCE_SHEET + '"');

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return [];

  const sources = sourceSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const results = [];

  for (let i = 0; i < sources.length && results.length < CONFIG.MAX_RESULTS; i++) {
    const sourceName = String(sources[i][0] || '').trim();
    const url = String(sources[i][1] || '').trim();
    const enabled = isTrue_(sources[i][2]);
    if (sourceFilter && normalizeGeneral_(sourceName) !== sourceFilter) continue;
    const searchAllTabs = isTrue_(sources[i][3]);
    if (!enabled || !url) continue;

    try {
      const id = extractSpreadsheetId_(url);
      if (!id) continue;
      const ss = SpreadsheetApp.openById(id);
      let tabs = ss.getSheets().filter(function(sh) {
        if (sh.isSheetHidden()) return false;
        return !CONFIG.EXCLUDED_TAB_PATTERNS.some(function(rx) { return rx.test(sh.getName()); });
      });
      if (!searchAllTabs) tabs = tabs.slice(0, 1);

      for (let t = 0; t < tabs.length && results.length < CONFIG.MAX_RESULTS; t++) {
        searchTab_(tabs[t], sourceName, effectiveQuery, results, true);
      }
    } catch (err) {
      console.log('ค้นไม่ได้: ' + sourceName + ' / ' + err.message);
    }
  }
  try {
    cache.put(cacheKey, JSON.stringify(results), CONFIG.SEARCH_CACHE_SECONDS);
  } catch (err) {
    console.log('cache put failed: ' + err.message);
  }
  return results;
}

function searchCustomerInConfiguredTab_(sourceName, sheetName, query) {
  const sourceKey = normalizeGeneral_(sourceName);
  const sheetKey = normalizeGeneral_(sheetName);
  const queryKey = normalizeGeneral_(query);
  if (!sourceKey || !sheetKey || !queryKey) return [];

  const cache = CacheService.getScriptCache();
  const cacheKey = 'customer-target-search:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      [sourceKey, sheetKey, queryKey].join('|')
    )
  );
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet || sourceSheet.getLastRow() < 2) return [];
  const rows = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, 3).getValues();
  const source = rows.find(function(row) {
    return normalizeGeneral_(row[0]) === sourceKey && isTrue_(row[2]);
  });
  const url = source ? String(source[1] || '').trim() : '';
  const id = extractSpreadsheetId_(url);
  if (!id) return [];

  const workbook = SpreadsheetApp.openById(id);
  const tab = workbook.getSheetByName(String(sheetName || '').trim());
  if (!tab || tab.isSheetHidden()) return [];

  const results = [];
  searchTab_(tab, String(sourceName || '').trim(), query, results, true);
  try {
    cache.put(cacheKey, JSON.stringify(results), CONFIG.SEARCH_CACHE_SECONDS);
  } catch (err) {
    console.log('target search cache put failed: ' + err.message);
  }
  return results;
}

function searchTab_(sheet, sourceName, query, results, includeDetails) {
  const lastRow = sheet.getLastRow();
  if (!lastRow || !sheet.getLastColumn()) return;

  const h = detectHeaders_(sheet);
  if (!h) return;

  const startRow = h.headerRow + 1;
  if (startRow > lastRow) return;

  const rowCount = Math.min(lastRow - h.headerRow, CONFIG.MAX_ROWS_PER_TAB);
  const needed = Object.keys(h).filter(k => k !== 'headerRow').map(k => h[k]).filter(v => v > 0);
  if (!needed.length) return;

  const maxCol = Math.max.apply(null, needed);
  const values = sheet.getRange(startRow, 1, rowCount, maxCol).getDisplayValues();

  const qGeneral = normalizeGeneral_(query);
  const qPhone = normalizePhone_(query);
  const qApple = normalizeApple_(query);

  for (let r = 0; r < values.length && results.length < CONFIG.MAX_RESULTS; r++) {
    const row = values[r];
    const queue = getCell_(row, h.queue);
    const name = getCell_(row, h.name);
    const phone = getCell_(row, h.phone);
    const appleId = getCell_(row, h.appleId);

    const match =
      matchesQueue_(queue, qGeneral) ||
      matchesGeneral_(name, qGeneral) ||
      matchesPhone_(phone, qPhone) ||
      matchesApple_(appleId, qApple);

    if (!match) continue;

    const item = {
      source: sourceName,
      sheet: sheet.getName(),
      row: startRow + r,
      queue: queue,
      name: name,
      phone: phone,
      appleId: appleId,
      model: getCell_(row, h.model)
    };

    if (includeDetails) {
      item.status = getCell_(row, h.status);
      item.principal = getCell_(row, h.principal);
      item.fee = getCell_(row, h.fee);
      item.saleDate = getCell_(row, h.saleDate);
      item.dueDate = getCell_(row, h.dueDate);
      item.outstanding = getCell_(row, h.outstanding);
      item.closeAmount = getCell_(row, h.closeAmount);
      item.note = getCell_(row, h.note);
    }
    results.push(item);
  }
}

function detectHeaders_(sheet) {
  const rows = Math.min(sheet.getLastRow(), CONFIG.HEADER_SCAN_ROWS);
  const cols = Math.min(sheet.getLastColumn(), CONFIG.HEADER_SCAN_COLS);
  if (!rows || !cols) return null;

  const data = sheet.getRange(1, 1, rows, cols).getDisplayValues();

  for (let r = 0; r < data.length; r++) {
    const headers = data[r].map(normalizeHeader_);
    const info = {
      headerRow: r + 1,
      queue: findHeader_(headers, ['คิว','queue']),
      name: findHeader_(headers, ['ชื่อ','ชื่อลูกค้า','customername']),
      phone: findHeader_(headers, ['เบอร์โทร','เบอร์','โทร','phone','tel']),
      appleId: findHeader_(headers, ['appleid','apple id','appleidลูกค้า','apple id ลูกค้า','icloud','ชื่อicloud']),
      model: findHeader_(headers, ['รุ่น','model']),
      status: findHeader_(headers, ['สถานะ','status']),
      principal: findHeader_(headers, ['ยอด','ยอดขายฝาก','ยอดฝาก','เงินต้น','principal']),
      fee: findHeader_(headers, ['ค่าเช่า','ค่่าเช่า','ดอก','เช่า','fee','rent']),
      saleDate: findHeader_(headers, ['วันขายฝาก','วันฝาก','วันรับ','วันที่ขาย','saledate']),
      dueDate: findHeader_(headers, ['กำหนดวันจ่ายถัดไปจ่าย','กำหนดจ่าย','วันจ่าย','due','วันส่ง']),
      outstanding: findHeader_(headers, ['ยอดค้าง','ยอดที่ต้องจ่าย','ค้างชำระ','outstanding']),
      closeAmount: findHeader_(headers, ['ยอดปิด','ปิดยอด','closeamount']),
      note: findHeader_(headers, ['โน๊ต','โน็ต','หมายเหตุ','note'])
    };

    const count = [info.queue, info.name, info.phone, info.appleId].filter(v => v > 0).length;
    if (count >= 2) return info;
  }
  return null;
}

function getHistory_(body) {
  const query = String(body.query || '').trim();
  if (!query) return { ok: false, error: 'กรุณาระบุคำค้น' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: [] };

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 16).getDisplayValues();
  const q = normalizeGeneral_(query);
  const items = [];

  for (let i = values.length - 1; i >= 0 && items.length < 50; i--) {
    const row = values[i];
    const hay = [row[3], row[4], row[5], row[6]].map(normalizeGeneral_);
    if (!hay.some(v => v && v.indexOf(q) !== -1)) continue;
    if (body.eventType && String(row[8] || '') !== body.eventType) continue;
    items.push({
      dateTime: row[0],
      source: row[1],
      sheet: row[2],
      queue: row[3],
      name: row[4],
      phone: row[5],
      appleId: row[6],
      model: row[7],
      eventType: row[8],
      amount: row[13],
      staff: row[14],
      note: row[15]
    });
  }
  return { ok: true, items: items };
}

function addNote_(body) {
  const query = String(body.query || '').trim();
  const note = String(body.note || '').trim();
  if (!query || !note) return { ok: false, error: 'รูปแบบ: โน้ต <คำค้น> <ข้อความ>' };

  const matches = searchCustomer_(query, true);
  if (!matches.length) return { ok: true, added: false, matches: [] };
  if (matches.length > 1) return { ok: true, added: false, needsSelection: true, matches: matches.slice(0, 10) };

  const m = matches[0];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  if (!sh) throw new Error('ไม่พบชีตประวัติลูกค้า');

  sh.appendRow([
    new Date(), m.source, m.sheet, m.queue, m.name, m.phone, m.appleId, m.model,
    'โน้ตลูกค้า', '', '', '', '', '', String(body.staffName || ''), note
  ]);

  return { ok: true, added: true, customer: m };
}

function auditSourceWriteCapabilities_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น', items: [] };
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const src = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!src || src.getLastRow() < 2) {
    return { ok: true, items: [], summary: { tabs: 0, safeRead: 0, paymentReady: 0, closeReady: 0 } };
  }

  const rows = src.getRange(2, 1, src.getLastRow() - 1, 7).getValues();
  const items = [];
  let tabCount = 0, safeRead = 0, paymentReady = 0, closeReady = 0;

  for (let i = 0; i < rows.length; i++) {
    if (!isTrue_(rows[i][2]) || !String(rows[i][1] || '').trim()) continue;
    const sourceName = String(rows[i][0] || '').trim();

    try {
      const id = extractSpreadsheetId_(rows[i][1]);
      const ss = SpreadsheetApp.openById(id);
      let tabs = ss.getSheets().filter(function(sh) {
        return !sh.isSheetHidden() &&
          !CONFIG.EXCLUDED_TAB_PATTERNS.some(function(rx){ return rx.test(sh.getName()); });
      });
      if (!isTrue_(rows[i][3])) tabs = tabs.slice(0, 1);

      for (let t = 0; t < tabs.length; t++) {
        tabCount++;
        const h = detectHeaders_(tabs[t]);
        if (!h) {
          items.push({
            source: sourceName,
            sheet: tabs[t].getName(),
            safeRead: false,
            paymentReady: false,
            closeReady: false,
            fields: []
          });
          continue;
        }

        const fields = [];
        if (h.queue) fields.push('คิว');
        if (h.name) fields.push('ชื่อ');
        if (h.status) fields.push('สถานะ');
        if (h.principal) fields.push('ยอด');
        if (h.fee) fields.push('ค่าเช่า/ดอก');
        if (h.saleDate) fields.push('วันเริ่ม');
        if (h.dueDate) fields.push('วันจ่าย');
        if (h.outstanding) fields.push('ยอดค้าง');
        if (h.closeAmount) fields.push('ยอดปิด');
        if (h.note) fields.push('โน้ต');

        const readOk = !!(h.queue && h.name && h.principal && h.fee && h.dueDate);
        const paymentOk = !!(readOk && h.status && h.note && h.dueDate);
        const closeOk = !!(readOk && h.status && h.note);

        if (readOk) safeRead++;
        if (paymentOk) paymentReady++;
        if (closeOk) closeReady++;

        items.push({
          source: sourceName,
          sheet: tabs[t].getName(),
          safeRead: readOk,
          paymentReady: paymentOk,
          closeReady: closeOk,
          fields: fields
        });
      }
    } catch (err) {
      tabCount++;
      items.push({
        source: sourceName,
        sheet: '',
        safeRead: false,
        paymentReady: false,
        closeReady: false,
        fields: [],
        error: String(err.message || err)
      });
    }
  }

  return {
    ok: true,
    writesEnabled: isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false)),
    summary: {
      tabs: tabCount,
      safeRead: safeRead,
      paymentReady: paymentReady,
      closeReady: closeReady
    },
    items: items.slice(0, 80)
  };
}

function findCustomerIdentity_(sourceName, sheetName, queueValue) {
  const cacheKey = 'customer-v109-' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      [sourceName, sheetName, normalizeGeneral_(queueValue)].join('|')
    )
  ).slice(0, 60);
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {}

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const src = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!src || src.getLastRow() < 2) return null;

  const rows = src.getRange(2, 1, src.getLastRow() - 1, 7).getValues();
  let sourceUrl = '';
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === String(sourceName || '').trim()) {
      sourceUrl = String(rows[i][1] || '').trim();
      break;
    }
  }
  if (!sourceUrl) return null;

  const id = extractSpreadsheetId_(sourceUrl);
  if (!id) return null;
  const ss = SpreadsheetApp.openById(id);
  const sh = ss.getSheetByName(String(sheetName || '').trim());
  if (!sh) return null;

  const h = detectHeaders_(sh);
  if (!h || !h.queue) return null;
  const startRow = h.headerRow + 1;
  const lastRow = sh.getLastRow();
  if (startRow > lastRow) return null;

  const rowCount = Math.min(lastRow - h.headerRow, CONFIG.MAX_ROWS_PER_TAB);
  const maxCol = Math.max.apply(null, Object.keys(h).filter(function(k){ return k !== 'headerRow'; }).map(function(k){ return h[k]; }).filter(function(v){ return v > 0; }));
  const targetQueue = normalizeGeneral_(queueValue);
  const queueRange = sh.getRange(startRow, h.queue, rowCount, 1);
  let rowNo = 0;

  // Search inside Sheets first so normal customer lookups don't download thousands of rows.
  try {
    const matches = queueRange.createTextFinder(String(queueValue || '').trim())
      .matchEntireCell(true)
      .matchCase(false)
      .useRegularExpression(false)
      .findAll();
    for (let i = 0; i < matches.length; i++) {
      if (normalizeGeneral_(matches[i].getDisplayValue()) === targetQueue) {
        rowNo = matches[i].getRow();
        break;
      }
    }
  } catch (err) {}

  // Preserve support for queues containing unusual spacing or formatting.
  if (!rowNo) {
    const queues = queueRange.getDisplayValues();
    for (let r = 0; r < queues.length; r++) {
      if (normalizeGeneral_(queues[r][0]) === targetQueue) {
        rowNo = startRow + r;
        break;
      }
    }
  }
  if (!rowNo) return null;

  const row = sh.getRange(rowNo, 1, 1, maxCol).getDisplayValues()[0];
  const customer = {
      source: String(sourceName || '').trim(),
      sheet: sh.getName(),
      row: rowNo,
      queue: getCell_(row, h.queue),
      name: getCell_(row, h.name),
      phone: getCell_(row, h.phone),
      appleId: getCell_(row, h.appleId),
      model: getCell_(row, h.model),
      status: getCell_(row, h.status),
      principal: getCell_(row, h.principal),
      fee: getCell_(row, h.fee),
      saleDate: getCell_(row, h.saleDate),
      dueDate: getCell_(row, h.dueDate),
      outstanding: getCell_(row, h.outstanding),
      closeAmount: getCell_(row, h.closeAmount)
  };
  try {
    CacheService.getScriptCache().put(
      cacheKey,
      JSON.stringify(customer),
      CONFIG.CUSTOMER_CACHE_SECONDS
    );
  } catch (err) {}
  return customer;
}

function auditSourceSchemas_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, message: 'เฉพาะเจ้าของระบบเท่านั้น', items: [] };
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const src = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!src || src.getLastRow() < 2) return { ok: true, items: [], summary: { sources: 0, tabs: 0, ready: 0, issues: 0 } };

  const rows = src.getRange(2, 1, src.getLastRow() - 1, 7).getValues();
  const items = [];
  let sourceCount = 0, tabCount = 0, readyCount = 0, issueCount = 0;

  for (let i = 0; i < rows.length; i++) {
    if (!isTrue_(rows[i][2]) || !String(rows[i][1] || '').trim()) continue;
    sourceCount++;
    const sourceName = String(rows[i][0] || '').trim();
    try {
      const id = extractSpreadsheetId_(rows[i][1]);
      const ss = SpreadsheetApp.openById(id);
      let tabs = ss.getSheets().filter(function(sh) {
        return !sh.isSheetHidden() && !CONFIG.EXCLUDED_TAB_PATTERNS.some(function(rx){ return rx.test(sh.getName()); });
      });
      if (!isTrue_(rows[i][3])) tabs = tabs.slice(0, 1);

      for (let t = 0; t < tabs.length; t++) {
        tabCount++;
        const h = detectHeaders_(tabs[t]);
        const missing = [];
        if (!h) {
          missing.push('หัวตาราง');
        } else {
          if (!h.queue) missing.push('คิว');
          if (!h.name) missing.push('ชื่อ');
          if (!h.status) missing.push('สถานะ');
          if (!h.principal) missing.push('ยอด');
          if (!h.fee) missing.push('ค่าเช่า/ดอก');
          if (!h.dueDate) missing.push('วันจ่าย');
        }
        const ready = missing.length === 0;
        if (ready) readyCount++; else issueCount++;
        items.push({
          source: sourceName,
          sheet: tabs[t].getName(),
          ready: ready,
          missing: missing
        });
      }
    } catch (err) {
      issueCount++;
      items.push({ source: sourceName, sheet: '', ready: false, missing: ['เปิดชีตไม่ได้'], error: err.message });
    }
  }

  return {
    ok: true,
    summary: { sources: sourceCount, tabs: tabCount, ready: readyCount, issues: issueCount },
    items: items.slice(0, 50)
  };
}

function cancelReviewQueue_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, cancelled: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, cancelled: false, message: 'รูปแบบ: ยกเลิกคิว <เลขคิว>' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh || rowNo > sh.getLastRow()) {
    return { ok: true, cancelled: false, message: 'ไม่พบคิวนี้' };
  }

  const row = sh.getRange(rowNo, 1, 1, 12).getDisplayValues()[0];
  if (String(row[8] || '').trim() !== 'รอตรวจ') {
    return { ok: true, cancelled: false, message: 'ยกเลิกไม่ได้ เพราะคิวนี้ไม่ได้อยู่สถานะรอตรวจ' };
  }

  sh.getRange(rowNo, 9).setValue('ยกเลิก');
  sh.getRange(rowNo, 10).setValue(access.staffName || 'เจ้าของ');
  sh.getRange(rowNo, 11).setValue(new Date());
  sh.getRange(rowNo, 12).setValue('ยกเลิกโดยเจ้าของ');

  return {
    ok: true,
    cancelled: true,
    rowNo: rowNo,
    requesterName: String(row[9] || '').trim(),
    message: 'ยกเลิกคิว #' + rowNo + ' แล้ว'
  };
}

function planSourceWrite_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, plan: null, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, plan: null, message: 'รูปแบบ: จำลองบันทึก <เลขคิว>' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh || rowNo > sh.getLastRow()) {
    return { ok: true, plan: null, message: 'ไม่พบคิวนี้' };
  }

  const row = sh.getRange(rowNo, 1, 1, 12).getDisplayValues()[0];
  const type = String(row[1] || '').trim();
  const sourceParts = String(row[4] || '').split(' / ');
  const sourceName = String(sourceParts[0] || '').trim();
  const sourceSheet = sourceParts.slice(1).join(' / ').trim();
  const live = findCustomerIdentity_(sourceName, sourceSheet, row[2]);

  if (!live) {
    return { ok: true, plan: null, stale: true, message: 'ไม่พบรายการต้นทางล่าสุด' };
  }
  if (row[3] && normalizeGeneral_(live.name) !== normalizeGeneral_(row[3])) {
    return { ok: true, plan: null, stale: true, message: 'ชื่อลูกค้าในต้นทางเปลี่ยนแล้ว' };
  }

  const writesEnabled = isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false));
  const detectedFields = [];
  try {
    const backend = SpreadsheetApp.getActiveSpreadsheet();
    const src = backend.getSheetByName(CONFIG.SOURCE_SHEET);
    const srcRows = src && src.getLastRow() >= 2
      ? src.getRange(2, 1, src.getLastRow() - 1, 7).getValues()
      : [];
    let sourceUrl = '';
    for (let i = 0; i < srcRows.length; i++) {
      if (String(srcRows[i][0] || '').trim() === sourceName) {
        sourceUrl = String(srcRows[i][1] || '').trim();
        break;
      }
    }
    if (sourceUrl) {
      const sourceSs = SpreadsheetApp.openById(extractSpreadsheetId_(sourceUrl));
      const sourceSh = sourceSs.getSheetByName(sourceSheet);
      const headers = sourceSh ? detectHeaders_(sourceSh) : null;
      if (headers) {
        if (headers.status) detectedFields.push('สถานะ');
        if (headers.dueDate) detectedFields.push('วันจ่าย');
        if (headers.outstanding) detectedFields.push('ยอดค้าง');
        if (headers.closeAmount) detectedFields.push('ยอดปิด');
        if (headers.note) detectedFields.push('โน้ต');
      }
    }
  } catch (err) {}

  const proposed = [];
  if (type === 'บันทึกชำระ') {
    proposed.push('บันทึกเหตุการณ์ชำระลงประวัติลูกค้า');
    proposed.push('ยังไม่กำหนดคอลัมน์เขียนกลับต้นทางจนกว่า mapping แหล่งนี้จะผ่านการตรวจ');
  } else if (type === 'ปิดยอด') {
    proposed.push('บันทึกเหตุการณ์ปิดยอดลงประวัติลูกค้า');
    proposed.push('ยังไม่แก้สถานะ/ยอดในชีตต้นทางจนกว่า mapping แหล่งนี้จะผ่านการตรวจ');
  } else if (type === 'ตรวจสลิป') {
    proposed.push('ตรวจสลิปเท่านั้น ไม่มีการเขียนยอดต้นทาง');
  } else {
    proposed.push('ยังไม่มีแผนเขียนต้นทางสำหรับประเภทนี้');
  }

  return {
    ok: true,
    plan: {
      reviewRowNo: rowNo,
      type: type,
      source: sourceName,
      sheet: sourceSheet,
      sourceRow: live.row,
      queue: live.queue,
      name: live.name,
      currentStatus: live.status,
      currentPrincipal: live.principal,
      currentFee: live.fee,
      currentDueDate: live.dueDate,
      requestedAmount: row[6],
      writesEnabled: writesEnabled,
      detectedFields: detectedFields,
      proposed: proposed
    }
  };
}

function hasDuplicatePendingReview_(sh, type, customer, amount) {
  if (!sh || sh.getLastRow() < 2) return null;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues();
  const sourceKey = (String(customer.source || '').trim() + ' / ' + String(customer.sheet || '').trim()).trim();
  const amountKey = String(amount == null ? '' : amount).replace(/,/g, '').trim();

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (String(row[8] || '').trim() !== 'รอตรวจ') continue;
    if (String(row[1] || '').trim() !== String(type || '').trim()) continue;
    if (String(row[2] || '').trim() !== String(customer.queue || '').trim()) continue;
    if (String(row[4] || '').trim() !== sourceKey) continue;
    if (String(row[6] || '').replace(/,/g, '').trim() !== amountKey) continue;
    return i + 2;
  }
  return null;
}

function getReviewQueueItem_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, item: null, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, item: null, message: 'รูปแบบ: ดูคิว <เลขคิว>' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh || rowNo > sh.getLastRow()) return { ok: true, item: null, message: 'ไม่พบคิวนี้' };

  const row = sh.getRange(rowNo, 1, 1, 12).getDisplayValues()[0];
  const sourceParts = String(row[4] || '').split(' / ');
  const sourceName = String(sourceParts[0] || '').trim();
  const sourceSheet = sourceParts.slice(1).join(' / ').trim();
  let liveCustomer = null;
  try {
    liveCustomer = findCustomerIdentity_(sourceName, sourceSheet, row[2]);
  } catch (err) {
    console.log('live review lookup failed: ' + err.message);
  }
  return {
    ok: true,
    liveCustomer: liveCustomer,
    item: {
      rowNo: rowNo,
      dateTime: row[0],
      type: row[1],
      queue: row[2],
      name: row[3],
      source: row[4],
      detail: row[5],
      amount: row[6],
      slipRef: row[7],
      status: row[8],
      staff: row[9],
      closedAt: row[10],
      note: row[11]
    }
  };
}

function appendHistoryFromApprovedReview_(reviewRow, reviewRowNo, approver, sourceWritten) {
  const type = String(reviewRow[1] || '').trim();
  if (type !== 'บันทึกชำระ' && type !== 'ปิดยอด') return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.HISTORY_SHEET);
  if (!sh) return false;

  const sourceParts = String(reviewRow[4] || '').split(' / ');
  const source = String(sourceParts[0] || '').trim();
  const sourceSheet = sourceParts.slice(1).join(' / ').trim();
  const eventType = type === 'ปิดยอด' ? 'ปิดยอด' : 'ชำระค่าเช่า';
  const note = 'อนุมัติจากคิวตรวจสอบ #' + reviewRowNo + (sourceWritten ? ' / ซิงก์ชีตต้นทางแล้ว' : ' / ยังไม่ซิงก์ชีตต้นทาง');

  sh.appendRow([
    new Date(),
    source,
    sourceSheet,
    String(reviewRow[2] || '').trim(),
    String(reviewRow[3] || '').trim(),
    '',
    '',
    '',
    eventType,
    '',
    '',
    '',
    '',
    reviewRow[6] || '',
    approver || '',
    note
  ]);
  return true;
}

function listReviewQueue_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, allowed: false, items: [], message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: [] };

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues();
  const items = [];
  for (let i = values.length - 1; i >= 0 && items.length < 10; i--) {
    const row = values[i];
    if (String(row[8] || '').trim() !== 'รอตรวจ') continue;
    items.push({
      rowNo: i + 2, dateTime: row[0], type: row[1], queue: row[2], name: row[3],
      source: row[4], detail: row[5], amount: row[6], staff: row[9]
    });
  }
  return { ok: true, items: items };
}


function paymentSourceWriteKey_(reviewRowNo) {
  return 'payment-source-write:' + String(reviewRowNo);
}

function paymentNumber_(value) {
  if (typeof value === 'number') return value;
  const n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function dateKey_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return '';
  return Utilities.formatDate(value, 'Asia/Bangkok', 'yyyy-MM-dd');
}

function addDays_(value, days) {
  const d = new Date(value.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function sourceSpreadsheetFor_(sourceName) {
  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const src = backend.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!src || src.getLastRow() < 2) return null;
  const rows = src.getRange(2, 1, src.getLastRow() - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (normalizeGeneral_(rows[i][0]) !== normalizeGeneral_(sourceName)) continue;
    const id = extractSpreadsheetId_(rows[i][1]);
    if (!id) return null;
    return SpreadsheetApp.openById(id);
  }
  return null;
}

function paymentTabAllowed_(sourceName, sheetName) {
  const source = normalizeGeneral_(sourceName);
  const sheet = normalizeGeneral_(sheetName);
  return (source === normalizeGeneral_('v6') && sheet === normalizeGeneral_('V6/10-69')) ||
    (source === normalizeGeneral_('v1/v3') && sheet === normalizeGeneral_('v3/10-69'));
}

function findCalendarDateColumn_(sheet, headerRow, startCol, targetDate) {
  const target = dateKey_(targetDate);
  if (!target || startCol > sheet.getLastColumn()) return 0;
  const width = sheet.getLastColumn() - startCol + 1;
  const values = sheet.getRange(headerRow, startCol, 1, width).getValues()[0];
  for (let i = 0; i < values.length; i++) {
    if (dateKey_(values[i]) === target) return startCol + i;
  }
  return 0;
}

function packCellValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return { type: 'date', value: value.toISOString() };
  }
  if (typeof value === 'number') return { type: 'number', value: value };
  if (typeof value === 'boolean') return { type: 'boolean', value: value };
  return { type: 'string', value: value == null ? '' : String(value) };
}

function unpackCellValue_(packed) {
  if (!packed) return '';
  if (packed.type === 'date') return new Date(packed.value);
  if (packed.type === 'number') return Number(packed.value);
  if (packed.type === 'boolean') return packed.value === true;
  return String(packed.value == null ? '' : packed.value);
}

function snapshotCell_(range) {
  return {
    row: range.getRow(),
    col: range.getColumn(),
    a1: range.getA1Notation(),
    formula: range.getFormula() || '',
    value: packCellValue_(range.getValue()),
    numberFormat: range.getNumberFormat() || ''
  };
}

function restoreCellSnapshot_(sheet, snap) {
  const range = sheet.getRange(Number(snap.row), Number(snap.col));
  if (snap.formula) range.setFormula(snap.formula);
  else range.setValue(unpackCellValue_(snap.value));
  if (snap.numberFormat) range.setNumberFormat(snap.numberFormat);
}

function snapshotMatchesCurrent_(sheet, snap) {
  const range = sheet.getRange(Number(snap.row), Number(snap.col));
  const formula = range.getFormula() || '';
  if (formula !== String(snap.formula || '')) return false;
  if (formula) return true;
  const current = packCellValue_(range.getValue());
  if (current.type !== snap.value.type) return false;
  if (current.type === 'date') return dateKey_(new Date(current.value)) === dateKey_(new Date(snap.value.value));
  return String(current.value) === String(snap.value.value);
}


function persistPaymentBackupLog_(backup, actionName, status, note) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!sh) return false;
    sh.appendRow([
      new Date(),
      '',
      'ระบบ',
      'ระบบ',
      actionName === 'paymentSourceRollback' ? 'ยกเลิกรายการ' : 'สำรองก่อนลงยอด',
      String(backup.reviewRowNo || ''),
      String(backup.source || '') + (backup.sheet ? ' / ' + backup.sheet : ''),
      status || 'สำเร็จ',
      actionName || 'paymentSourceBackup',
      status || 'สำเร็จ',
      note || JSON.stringify(backup)
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

function loadPaymentBackupFromLog_(reviewRowNo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.LOG_SHEET);
    if (!sh || sh.getLastRow() < 2) return null;
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][8] || '').trim() !== 'paymentSourceBackup') continue;
      if (String(values[i][5] || '').trim() !== String(reviewRowNo)) continue;
      const raw = String(values[i][10] || '').trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Number(parsed.reviewRowNo) === Number(reviewRowNo)) return parsed;
      } catch (err) {}
    }
  } catch (err) {}
  return null;
}

function applyApprovedPaymentToSource_(reviewRow, rawReviewRow, reviewRowNo) {
  if (!isTrue_(getSettingValue_('FINANCIAL_SOURCE_WRITES_ENABLED', false))) {
    return { ok: false, message: 'ระบบเขียนชีตต้นทางยังปิดอยู่' };
  }

  const sourceParts = String(reviewRow[4] || '').split(' / ');
  const sourceName = String(sourceParts[0] || '').trim();
  const sourceSheet = sourceParts.slice(1).join(' / ').trim();

  if (!paymentTabAllowed_(sourceName, sourceSheet)) {
    return { ok: false, message: 'รับชำระเขียนได้เฉพาะ V6/10-69 และ v3/10-69' };
  }

  const customer = findCustomerIdentity_(sourceName, sourceSheet, reviewRow[2]);
  if (!customer) return { ok: false, message: 'ไม่พบลูกค้าในชีตต้นทาง' };
  if (reviewRow[3] && normalizeGeneral_(customer.name) !== normalizeGeneral_(reviewRow[3])) {
    return { ok: false, message: 'ชื่อลูกค้าในต้นทางเปลี่ยนแล้ว' };
  }

  const sourceSs = sourceSpreadsheetFor_(sourceName);
  if (!sourceSs) return { ok: false, message: 'เปิดไฟล์ต้นทางไม่ได้' };
  const sheet = sourceSs.getSheetByName(sourceSheet);
  if (!sheet) return { ok: false, message: 'ไม่พบแถบต้นทาง ' + sourceSheet };

  const headers = detectHeaders_(sheet);
  if (!headers || !headers.queue || !headers.dueDate || !headers.fee) {
    return { ok: false, message: 'หัวตารางต้นทางไม่ครบสำหรับรับชำระ' };
  }

  const sourceRow = Number(customer.row);
  const dueRange = sheet.getRange(sourceRow, headers.dueDate);
  const feeRange = sheet.getRange(sourceRow, headers.fee);
  const oldDue = dueRange.getValue();
  const fee = paymentNumber_(feeRange.getValue());
  const amount = paymentNumber_(rawReviewRow[6]);
  const paidAt = rawReviewRow[0] instanceof Date ? rawReviewRow[0] : new Date();

  if (!(oldDue instanceof Date) || isNaN(oldDue.getTime())) {
    return { ok: false, message: 'วันจ่ายเดิมไม่ใช่วันที่ จึงยังไม่เขียนต้นทาง' };
  }
  if (!(amount > 0)) return { ok: false, message: 'ยอดชำระไม่ถูกต้อง' };
  if (!(fee > 0)) return { ok: false, message: 'ค่าเช่าในต้นทางไม่ถูกต้อง' };
  if (Math.abs(amount - fee) > 0.005) {
    return {
      ok: false,
      message: 'ยอดชำระ ' + amount + ' ไม่เท่าค่าเช่า ' + fee + ' จึงยังไม่เลื่อนรอบอัตโนมัติ'
    };
  }

  const nextDue = addDays_(oldDue, 10);
  if (paidAt.getTime() >= nextDue.getTime()) {
    return {
      ok: false,
      message: 'รายการนี้เลยรอบถัดไปแล้ว จึงยังไม่เลื่อนวันจ่ายอัตโนมัติ กรุณาตรวจสอบรอบชำระก่อน'
    };
  }
  const calendarStartCol = headers.note ? headers.note + 1 : Math.max(headers.dueDate + 1, 15);
  const paidCol = findCalendarDateColumn_(sheet, headers.headerRow, calendarStartCol, paidAt);
  const oldDueCol = findCalendarDateColumn_(sheet, headers.headerRow, calendarStartCol, oldDue);
  const nextDueCol = findCalendarDateColumn_(sheet, headers.headerRow, calendarStartCol, nextDue);

  if (!paidCol) return { ok: false, message: 'ไม่พบช่องวันที่รับชำระในปฏิทิน' };
  if (!oldDueCol) return { ok: false, message: 'ไม่พบช่องวันจ่ายเดิมในปฏิทิน' };
  if (!nextDueCol) return { ok: false, message: 'ไม่พบช่องวันจ่ายรอบถัดไปในปฏิทิน' };

  const paidRange = sheet.getRange(sourceRow, paidCol);
  const oldDueRange = sheet.getRange(sourceRow, oldDueCol);
  const nextDueRange = sheet.getRange(sourceRow, nextDueCol);

  const paidExisting = paidRange.getValue();
  if (paidCol !== oldDueCol && String(paidExisting || '').trim() && paymentNumber_(paidExisting) !== amount) {
    return { ok: false, message: 'ช่องวันที่รับชำระมีข้อมูลเดิมอยู่ จึงไม่เขียนทับ' };
  }

  const nextExisting = nextDueRange.getValue();
  if (nextDueCol !== oldDueCol && nextDueCol !== paidCol && String(nextExisting || '').trim() && paymentNumber_(nextExisting) !== fee) {
    return { ok: false, message: 'ช่องรอบถัดไปมีข้อมูลเดิมอยู่ จึงไม่เขียนทับ' };
  }

  const unique = {};
  [dueRange, paidRange, oldDueRange, nextDueRange].forEach(function(range) {
    unique[range.getA1Notation()] = range;
  });
  const before = Object.keys(unique).map(function(key) { return snapshotCell_(unique[key]); });

  // Save before-state first. If any write fails, rollback can restore the exact cells.
  const backup = {
    version: 1,
    reviewRowNo: reviewRowNo,
    source: sourceName,
    sheet: sourceSheet,
    spreadsheetId: sourceSs.getId(),
    sourceRow: sourceRow,
    queue: customer.queue || '',
    name: customer.name || '',
    amount: amount,
    fee: fee,
    oldDue: oldDue.toISOString(),
    paidAt: paidAt.toISOString(),
    nextDue: nextDue.toISOString(),
    before: before,
    createdAt: new Date().toISOString()
  };
  PropertiesService.getScriptProperties().setProperty(paymentSourceWriteKey_(reviewRowNo), JSON.stringify(backup));
  persistPaymentBackupLog_(backup, 'paymentSourceBackup', 'สำเร็จ', JSON.stringify(backup));

  dueRange.setValue(nextDue);
  paidRange.setValue(amount);
  if (oldDueCol !== paidCol && oldDueCol !== nextDueCol) oldDueRange.clearContent();
  nextDueRange.setValue(fee);
  try {
    paidRange.setNumberFormat(feeRange.getNumberFormat());
    nextDueRange.setNumberFormat(feeRange.getNumberFormat());
  } catch (err) {}
  SpreadsheetApp.flush();

  backup.after = Object.keys(unique).map(function(key) { return snapshotCell_(unique[key]); });
  backup.writtenAt = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty(paymentSourceWriteKey_(reviewRowNo), JSON.stringify(backup));
  persistPaymentBackupLog_(backup, 'paymentSourceBackupAfter', 'สำเร็จ', JSON.stringify(backup));

  return {
    ok: true,
    written: true,
    source: sourceName,
    sheet: sourceSheet,
    sourceRow: sourceRow,
    paidDate: dateKey_(paidAt),
    nextDueDate: dateKey_(nextDue),
    amount: amount,
    fee: fee
  };
}

function rollbackReviewQueue_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, rolledBack: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, rolledBack: false, message: 'รูปแบบ: ย้อนคิว <เลขคิว>' };
  }

  const backend = SpreadsheetApp.getActiveSpreadsheet();
  const reviewSheet = backend.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!reviewSheet || rowNo > reviewSheet.getLastRow()) {
    return { ok: true, rolledBack: false, message: 'ไม่พบคิวนี้' };
  }

  const reviewRow = reviewSheet.getRange(rowNo, 1, 1, 12).getDisplayValues()[0];
  if (String(reviewRow[1] || '').trim() !== 'บันทึกชำระ') {
    return { ok: true, rolledBack: false, message: 'ย้อนอัตโนมัติได้เฉพาะรายการบันทึกชำระ' };
  }
  if (String(reviewRow[8] || '').trim() !== 'ผ่าน') {
    return { ok: true, rolledBack: false, message: 'คิวนี้ไม่ได้อยู่สถานะผ่าน' };
  }

  const props = PropertiesService.getScriptProperties();
  const key = paymentSourceWriteKey_(rowNo);
  const raw = props.getProperty(key);
  if (!raw) {
    return { ok: true, rolledBack: false, message: 'คิวนี้ไม่มีข้อมูลสำรองต้นทาง จึงไม่สามารถย้อนอัตโนมัติได้' };
  }

  let backup;
  try { backup = JSON.parse(raw); } catch (err) {
    return { ok: true, rolledBack: false, message: 'ข้อมูลสำรองของคิวนี้เสียหาย' };
  }
  if (backup.reversedAt) {
    return { ok: true, rolledBack: false, message: 'คิวนี้ถูกย้อนรายการไปแล้ว' };
  }

  const sourceSs = SpreadsheetApp.openById(String(backup.spreadsheetId || ''));
  const sourceSheet = sourceSs.getSheetByName(String(backup.sheet || ''));
  if (!sourceSheet) return { ok: true, rolledBack: false, message: 'ไม่พบชีตต้นทางสำหรับย้อนรายการ' };

  const after = Array.isArray(backup.after) ? backup.after : [];
  for (let i = 0; i < after.length; i++) {
    if (!snapshotMatchesCurrent_(sourceSheet, after[i])) {
      return {
        ok: true,
        rolledBack: false,
        stale: true,
        message: 'ต้นทางถูกแก้หลังจากกดผ่านแล้ว จึงไม่ย้อนทับอัตโนมัติ กรุณาตรวจชีตก่อน'
      };
    }
  }

  const before = Array.isArray(backup.before) ? backup.before : [];
  before.forEach(function(snap) { restoreCellSnapshot_(sourceSheet, snap); });
  SpreadsheetApp.flush();

  backup.reversedAt = new Date().toISOString();
  backup.reversedBy = access.staffName || 'เจ้าของ';
  props.setProperty(key, JSON.stringify(backup));

  reviewSheet.getRange(rowNo, 9).setValue('ย้อนรายการ');
  reviewSheet.getRange(rowNo, 10).setValue(access.staffName || 'เจ้าของ');
  reviewSheet.getRange(rowNo, 11).setValue(new Date());
  reviewSheet.getRange(rowNo, 12).setValue('ย้อนค่าชีตต้นทางกลับก่อนอนุมัติแล้ว');

  const history = backend.getSheetByName(CONFIG.HISTORY_SHEET);
  if (history) {
    history.appendRow([
      new Date(),
      backup.source || '',
      backup.sheet || '',
      backup.queue || '',
      backup.name || '',
      '',
      '',
      '',
      'ย้อนรายการชำระ',
      '',
      '',
      '',
      '',
      backup.amount || '',
      access.staffName || 'เจ้าของ',
      'ย้อนคิวตรวจสอบ #' + rowNo + ' และคืนค่าชีตต้นทาง'
    ]);
  }

  return {
    ok: true,
    rolledBack: true,
    rowNo: rowNo,
    queue: backup.queue || '',
    name: backup.name || '',
    amount: backup.amount || '',
    message: 'ย้อนคิว #' + rowNo + ' แล้ว และคืนค่าชีตต้นทางกลับก่อนกดผ่าน'
  };
}

function resolveReviewQueue_(body) {
  const access = checkAccess_({ lineUserId: body.lineUserId, permission: 'ดูรายงาน' });
  if (!access.allowed || String(access.role || '').trim() !== 'เจ้าของ') {
    return { ok: true, resolved: false, message: 'เฉพาะเจ้าของระบบเท่านั้น' };
  }

  const rowNo = Number(String(body.query || '').trim());
  const decision = String(body.decision || '').trim();
  if (!Number.isInteger(rowNo) || rowNo < 2) {
    return { ok: true, resolved: false, message: 'ระบุเลขแถวคิวให้ถูกต้อง' };
  }
  if (decision !== 'ผ่าน' && decision !== 'ไม่ผ่าน') {
    return { ok: true, resolved: false, message: 'ผลตรวจไม่ถูกต้อง' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh || rowNo > sh.getLastRow()) {
    return { ok: true, resolved: false, message: 'ไม่พบคิวนี้' };
  }

  const displayRow = sh.getRange(rowNo, 1, 1, 12).getDisplayValues()[0];
  const rawRow = sh.getRange(rowNo, 1, 1, 12).getValues()[0];
  if (String(displayRow[8] || '').trim() !== 'รอตรวจ') {
    return { ok: true, resolved: false, message: 'คิวนี้ถูกตรวจแล้ว' };
  }

  let liveCustomer = null;
  if (decision === 'ผ่าน') {
    const sourceParts = String(displayRow[4] || '').split(' / ');
    const sourceName = String(sourceParts[0] || '').trim();
    const sourceSheet = sourceParts.slice(1).join(' / ').trim();
    try {
      liveCustomer = findCustomerIdentity_(sourceName, sourceSheet, displayRow[2]);
    } catch (err) {}
    if (!liveCustomer || (displayRow[3] && normalizeGeneral_(liveCustomer.name) !== normalizeGeneral_(displayRow[3]))) {
      return {
        ok: true,
        resolved: false,
        stale: true,
        message: 'ต้นทางเปลี่ยนหรือไม่พบรายการ กรุณาใช้ ดูคิว ' + rowNo + ' ก่อน'
      };
    }
  }

  let sourceWrite = null;
  if (decision === 'ผ่าน' && String(displayRow[1] || '').trim() === 'บันทึกชำระ') {
    sourceWrite = applyApprovedPaymentToSource_(displayRow, rawRow, rowNo);
    if (!sourceWrite || !sourceWrite.ok || !sourceWrite.written) {
      return {
        ok: true,
        resolved: false,
        sourceWritten: false,
        message: sourceWrite && sourceWrite.message ? sourceWrite.message : 'ยังเขียนชีตต้นทางไม่ได้'
      };
    }
  }

  sh.getRange(rowNo, 9).setValue(decision);
  sh.getRange(rowNo, 10).setValue(access.staffName || 'เจ้าของ');
  sh.getRange(rowNo, 11).setValue(new Date());

  let historyRecorded = false;
  if (decision === 'ผ่าน') {
    historyRecorded = appendHistoryFromApprovedReview_(
      displayRow,
      rowNo,
      access.staffName || 'เจ้าของ',
      !!(sourceWrite && sourceWrite.written)
    );
    sh.getRange(rowNo, 12).setValue(
      sourceWrite && sourceWrite.written
        ? 'บันทึกประวัติแล้ว / ซิงก์ชีตต้นทางแล้ว'
        : historyRecorded
          ? 'บันทึกประวัติแล้ว / ยังไม่ซิงก์ชีตต้นทาง'
          : (String(displayRow[11] || '').trim() || 'ตรวจสอบแล้ว')
    );
  }

  const staffSheet = ss.getSheetByName(CONFIG.STAFF_SHEET);
  let requesterLineUserId = '';
  if (staffSheet && staffSheet.getLastRow() >= 2) {
    const staffValues = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 20).getValues();
    for (let i = 0; i < staffValues.length; i++) {
      if (String(staffValues[i][0] || '').trim() === String(displayRow[9] || '').trim()) {
        requesterLineUserId = String(staffValues[i][1] || '').trim();
        break;
      }
    }
  }

  return {
    ok: true,
    resolved: true,
    decision: decision,
    rowNo: rowNo,
    type: displayRow[1],
    name: displayRow[3],
    queue: displayRow[2],
    amount: displayRow[6],
    requesterLineUserId: requesterLineUserId,
    historyRecorded: historyRecorded,
    sourceWritten: !!(sourceWrite && sourceWrite.written),
    sourceWrite: sourceWrite,
    message: decision === 'ผ่าน'
      ? ('คิว #' + rowNo + ' ผ่านการตรวจสอบแล้ว' + (sourceWrite && sourceWrite.written ? ' และลงชีตต้นทางแล้ว' : ''))
      : 'คิว #' + rowNo + ' ไม่ผ่านการตรวจสอบ'
  };
}

function slipCacheKey_(lineUserId) {
  const raw = String(lineUserId || '').trim();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return 'recent-slip:' + Utilities.base64EncodeWebSafe(digest).slice(0, 40);
}

function recentImageCacheKey_(lineUserId) {
  return 'recent_images:' + String(lineUserId || '').trim();
}

function rememberRecentImage_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'ดูข้อมูลลูกค้า'
  });
  if (!access.allowed) {
    return { ok: true, remembered: false, message: access.message || 'ไม่มีสิทธิ์ใช้งานข้อมูลลูกค้า' };
  }

  const messageId = String(body.messageId || '').trim();
  if (!messageId) return { ok: true, remembered: false, message: 'ไม่พบรหัสรูป' };

  const cache = CacheService.getScriptCache();
  const key = recentImageCacheKey_(body.lineUserId);
  let items = [];
  const old = cache.get(key);
  if (old) {
    try { items = JSON.parse(old) || []; } catch (err) { items = []; }
  }

  items = items.filter(function(x) {
    return x && x.messageId && String(x.messageId) !== messageId;
  });
  items.push({
    messageId: messageId,
    receivedAt: new Date().toISOString()
  });
  if (items.length > 10) items = items.slice(items.length - 10);

  cache.put(key, JSON.stringify(items), 600);

  return {
    ok: true,
    remembered: true,
    count: items.length,
    staffName: access.staffName || '',
    message: 'เก็บรูปล่าสุดไว้ชั่วคราวแล้ว'
  };
}

function getRecentIdentityImages_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'ดูข้อมูลลูกค้า'
  });
  if (!access.allowed) {
    return { ok: true, items: [], message: access.message || 'ไม่มีสิทธิ์ใช้งานข้อมูลลูกค้า' };
  }

  const value = CacheService.getScriptCache().get(recentImageCacheKey_(body.lineUserId));
  if (!value) {
    return { ok: true, items: [], message: 'ไม่พบรูปในช่วง 10 นาทีล่าสุด' };
  }

  let items = [];
  try { items = JSON.parse(value) || []; } catch (err) { items = []; }

  return {
    ok: true,
    items: items.slice().reverse(),
    count: items.length,
    message: items.length ? 'พบรูปล่าสุด ' + items.length + ' รูป' : 'ไม่พบรูปในช่วง 10 นาทีล่าสุด'
  };
}

function concatBytes_(parts) {
  let out = [];
  parts.forEach(function(part) {
    const bytes = Array.isArray(part) ? part : Utilities.newBlob(String(part)).getBytes();
    out = out.concat(bytes);
  });
  return out;
}

function extractThaiIdCardFields_(text) {
  const raw = String(text || '').replace(/\r/g, '\n');
  const lines = raw.split(/\n+/).map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  const compact = lines.join('\n');

  const cardMarker = /(บัตร\s*(?:ประจำตัว)?\s*ประชาชน|บัตรประชาชน|thai\s*national\s*id|identification\s*card|เลข\s*ประจำตัว\s*ประชาชน|identification\s*number)/i;
  const isThaiIdCard = cardMarker.test(compact);

  let firstName = '';
  let lastName = '';
  let fullName = '';

  function cleanThaiName_(value) {
    return String(value || '')
      .replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s*/i, '')
      .replace(/[^ก-๙A-Za-z\-'.\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let m = line.match(/(?:ชื่อตัวและชื่อสกุล|ชื่อ\s*[-:]?|name\s*[-:]?)\s*(.+)$/i);
    if (m && !/นามสกุล|last\s*name/i.test(line)) {
      const candidate = cleanThaiName_(m[1]);
      if (candidate && !/^(thai|national|identification|เลข|เกิด|date|ศาสนา|ที่อยู่)/i.test(candidate)) {
        const parts = candidate.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
          fullName = (firstName + ' ' + lastName).trim();
          break;
        } else if (parts.length === 1) {
          firstName = parts[0];
        }
      }
    }
  }

  if (!lastName) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/(?:นามสกุล|last\s*name)\s*[-:]?\s*(.+)$/i);
      if (m) {
        lastName = cleanThaiName_(m[1]).split(/\s+/)[0] || '';
        break;
      }
    }
  }

  if (!firstName) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/(?:^|\s)(?:ชื่อ|name)\s*[-:]?\s*(.+)$/i);
      if (m && !/นามสกุล|last\s*name/i.test(lines[i])) {
        firstName = cleanThaiName_(m[1]).split(/\s+/)[0] || '';
        if (firstName) break;
      }
    }
  }

  fullName = (firstName + ' ' + lastName).trim();

  let idDigits = '';
  const idPatterns = [
    /(?:เลข\s*ประจำตัว\s*ประชาชน|identification\s*number)[^0-9]*(\d[\d\s\-]{10,20})/i,
    /\b(\d[\d\s\-]{11,20})\b/
  ];
  for (let i = 0; i < idPatterns.length; i++) {
    const m = compact.match(idPatterns[i]);
    if (!m) continue;
    const digits = String(m[1] || '').replace(/\D/g, '');
    if (digits.length === 13) {
      idDigits = digits;
      break;
    }
  }

  return {
    isThaiIdCard: isThaiIdCard,
    firstName: firstName,
    lastName: lastName,
    fullName: fullName,
    idLast4: idDigits ? idDigits.slice(-4) : '',
    hasUsableName: !!(firstName && lastName)
  };
}

function ocrThaiIdCardImage_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'ดูข้อมูลลูกค้า'
  });
  if (!access.allowed) {
    return { ok: true, read: false, message: access.message || 'ไม่มีสิทธิ์อ่านบัตร' };
  }

  const imageBase64 = String(body.imageBase64 || '').trim();
  const mimeType = String(body.mimeType || 'image/jpeg').trim();
  if (!imageBase64) return { ok: true, read: false, message: 'ไม่พบข้อมูลรูป' };

  let imageBytes;
  try {
    imageBytes = Utilities.base64Decode(imageBase64);
  } catch (err) {
    return { ok: true, read: false, message: 'ข้อมูลรูปไม่ถูกต้อง' };
  }

  if (!imageBytes || !imageBytes.length) return { ok: true, read: false, message: 'รูปว่าง' };
  if (imageBytes.length > 5 * 1024 * 1024) {
    return { ok: true, read: false, message: 'รูปใหญ่เกิน 5 MB กรุณาส่งรูปใหม่ให้เล็กลง' };
  }

  // Force Drive/Docs OAuth scopes so the web app can run OCR with the owner's authorization.
  DriveApp.getRootFolder().getName();

  const boundary = 'ocr_' + Utilities.getUuid().replace(/-/g, '');
  const metadata = JSON.stringify({
    title: 'AdminID_OCR_' + new Date().getTime(),
    mimeType: 'application/vnd.google-apps.document'
  });

  const head1 = '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata + '\r\n';
  const head2 = '--' + boundary + '\r\n' +
    'Content-Type: ' + mimeType + '\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';

  const payload = concatBytes_([
    Utilities.newBlob(head1).getBytes(),
    Utilities.newBlob(head2).getBytes(),
    imageBytes,
    Utilities.newBlob(tail).getBytes()
  ]);

  let createdId = '';
  try {
    const response = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true&ocr=true&ocrLanguage=th',
      {
        method: 'post',
        contentType: 'multipart/related; boundary=' + boundary,
        payload: payload,
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      }
    );

    const code = response.getResponseCode();
    const bodyText = response.getContentText();
    if (code < 200 || code >= 300) {
      return {
        ok: true,
        read: false,
        message: 'OCR ใช้งานไม่ได้ กรุณาใช้ “กรอกชื่อเอง”',
        detail: 'Drive OCR HTTP ' + code
      };
    }

    const created = JSON.parse(bodyText || '{}');
    createdId = String(created.id || '').trim();
    if (!createdId) {
      return { ok: true, read: false, message: 'OCR อ่านรูปไม่สำเร็จ กรุณาใช้ “กรอกชื่อเอง”' };
    }

    Utilities.sleep(600);
    let text = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        text = DocumentApp.openById(createdId).getBody().getText() || '';
      } catch (err) {}
      if (String(text || '').trim()) break;
      Utilities.sleep(700);
    }

    const parsed = extractThaiIdCardFields_(text);
    return {
      ok: true,
      read: true,
      isThaiIdCard: parsed.isThaiIdCard,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      fullName: parsed.fullName,
      idLast4: parsed.idLast4,
      hasUsableName: parsed.hasUsableName,
      ocrPreview: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      message: parsed.isThaiIdCard
        ? (parsed.hasUsableName ? 'อ่านบัตรประชาชนสำเร็จ' : 'พบบัตรประชาชน แต่ชื่ออ่านไม่ชัด')
        : 'รูปนี้ไม่ใช่บัตรประชาชนไทย'
    };
  } catch (err) {
    return {
      ok: true,
      read: false,
      message: 'OCR ใช้งานไม่ได้ กรุณาใช้ “กรอกชื่อเอง”',
      detail: String(err && err.message ? err.message : err)
    };
  } finally {
    if (createdId) {
      try { DriveApp.getFileById(createdId).setTrashed(true); } catch (err) {}
    }
  }
}

function rememberSlipMessage_(body) {
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    sourceType: body.sourceType,
    groupId: body.groupId,
    permission: 'ยืนยันสลิป'
  });
  if (!access.allowed) {
    return { ok: true, remembered: false, message: access.message || 'ไม่มีสิทธิ์ยืนยันสลิป' };
  }

  const messageId = String(body.messageId || '').trim();
  if (!messageId) return { ok: true, remembered: false, message: 'ไม่พบรหัสรูปสลิป' };

  CacheService.getScriptCache().put(
    slipCacheKey_(body.lineUserId),
    JSON.stringify({
      messageId: messageId,
      receivedAt: new Date().toISOString()
    }),
    600
  );

  return {
    ok: true,
    remembered: true,
    staffName: access.staffName || '',
    message: 'รับรูปสลิปแล้ว'
  };
}

function getRecentSlipMessage_(lineUserId) {
  const value = CacheService.getScriptCache().get(slipCacheKey_(lineUserId));
  if (!value) return null;
  try { return JSON.parse(value); } catch (err) { return null; }
}

function clearRecentSlipMessage_(lineUserId) {
  CacheService.getScriptCache().remove(slipCacheKey_(lineUserId));
}

function queueFinancialReview_(body, type) {
  const permissionMap = {
    'บันทึกชำระ': 'บันทึกชำระ',
    'ตรวจสลิป': 'ยืนยันสลิป',
    'ปิดยอด': 'ปิดยอด'
  };
  const access = checkAccess_({
    lineUserId: body.lineUserId,
    permission: permissionMap[type] || ''
  });
  if (!access.allowed) {
    return { ok: true, queued: false, message: access.message || 'ไม่มีสิทธิ์ดำเนินการ' };
  }

  const query = String(body.query || '').trim();
  if (!query) return { ok: true, queued: false, message: 'กรุณาระบุคำค้นลูกค้า' };

  const matches = searchCustomer_(query, true);
  if (!matches.length) return { ok: true, queued: false, message: 'ไม่พบข้อมูลลูกค้า' };
  if (matches.length > 1) {
    return { ok: true, queued: false, needsSelection: true, matches: matches.slice(0, 10) };
  }

  const customer = matches[0];
  let recentSlip = null;
  if (type === 'ตรวจสลิป') {
    recentSlip = getRecentSlipMessage_(body.lineUserId);
    if (!recentSlip || !recentSlip.messageId) {
      return {
        ok: true,
        queued: false,
        message: 'ยังไม่พบรูปสลิปล่าสุด กรุณาส่งรูปสลิปก่อน แล้วพิมพ์ ยืนยันสลิป <คำค้น> ภายใน 10 นาที'
      };
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REVIEW_QUEUE_SHEET);
  if (!sh) return { ok: false, error: 'ไม่พบชีตคิวตรวจสอบ' };

  const amount = body.amount == null ? '' : Number(body.amount);
  const duplicateRowNo = hasDuplicatePendingReview_(sh, type, customer, amount);
  if (duplicateRowNo) {
    return {
      ok: true,
      queued: false,
      duplicate: true,
      duplicateRowNo: duplicateRowNo,
      message: 'มีคิวซ้ำที่ยังรอตรวจ #' + duplicateRowNo
    };
  }

  const detail = type === 'บันทึกชำระ'
    ? 'คำขอบันทึกชำระจาก LINE'
    : type === 'ปิดยอด'
      ? 'คำขอปิดยอดจาก LINE'
      : 'คำขอตรวจสลิปจาก LINE';

  sh.appendRow([
    new Date(),
    type,
    customer.queue || '',
    customer.name || '',
    (customer.source || '') + (customer.sheet ? ' / ' + customer.sheet : ''),
    detail,
    amount,
    recentSlip && recentSlip.messageId ? recentSlip.messageId : '',
    'รอตรวจ',
    access.staffName || '',
    '',
    ''
  ]);

  const rowNo = sh.getLastRow();
  if (type === 'ตรวจสลิป') clearRecentSlipMessage_(body.lineUserId);
  const staffSheet = ss.getSheetByName(CONFIG.STAFF_SHEET);
  const staffValues = staffSheet && staffSheet.getLastRow() >= 2
    ? staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 20).getValues()
    : [];
  const ownerLineUserIds = staffValues
    .filter(function(r) {
      return String(r[8] || '').trim() === 'เจ้าของ' &&
        String(r[2] || '').trim() === 'เจ้าหน้าที่' &&
        r[19] === true &&
        isTrue_(r[3]) &&
        String(r[1] || '').trim();
    })
    .map(function(r) { return String(r[1] || '').trim(); });

  return {
    ok: true,
    queued: true,
    rowNo: rowNo,
    type: type,
    customer: customer,
    amount: amount,
    requesterLineUserId: String(body.lineUserId || '').trim(),
    ownerLineUserIds: ownerLineUserIds,
    message: 'ส่งเข้าคิวตรวจสอบแล้ว #' + rowNo
  };
}

function logAction_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sh) return { ok: true, logged: false };
  sh.appendRow([
    new Date(),
    body.lineUserId || '',
    body.staffName || '',
    body.role || '',
    body.command || '',
    body.query || '',
    body.source || '',
    body.result || '',
    body.actionName || '',
    body.status || '',
    body.note || ''
  ]);
  return { ok: true, logged: true };
}

function findHeader_(headers, aliases) {
  const a = aliases.map(normalizeHeader_);
  for (let i = 0; i < headers.length; i++) {
    for (let j = 0; j < a.length; j++) if (headers[i] === a[j]) return i + 1;
  }
  return 0;
}
function normalizeHeader_(v) { return String(v || '').toLowerCase().replace(/\s+/g,'').replace(/[._\-\/]/g,'').trim(); }
function normalizeGeneral_(v) { return String(v || '').toLowerCase().replace(/\s+/g,'').trim(); }
function normalizePhone_(v) { return String(v || '').replace(/\D/g,''); }
function normalizeApple_(v) { return String(v || '').toLowerCase().replace(/\s+/g,'').trim(); }
function matchesQueue_(v,q) { return !!v && !!q && normalizeGeneral_(v) === q; }
function matchesGeneral_(v,q) { if (!v || !q) return false; const x=normalizeGeneral_(v); return x === q || x.indexOf(q) !== -1; }
function matchesPhone_(v,q) { if (!v || !q) return false; const x=normalizePhone_(v); return x === q || x.indexOf(q) !== -1; }
function matchesApple_(v,q) { if (!v || !q) return false; const x=normalizeApple_(v); return x === q || x.indexOf(q) !== -1; }
function getCell_(row,col) { return (!col || col < 1) ? '' : String(row[col - 1] || '').trim(); }
function extractSpreadsheetId_(url) {
  const text=String(url||'');
  const m=text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)||text.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return m ? m[1] : '';
}
function isTrue_(v) { return v===true || String(v).toLowerCase()==='true' || String(v).trim()==='1'; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
