## 2026-09-27 — Payment source write + rollback
- Renamed the approved-payment rollback UX from `ย้อนคิว <เลข>` / “ย้อนรายการ” to `ยกเลิกรายการ <เลข>` / “ยกเลิก / ทำรายการใหม่”.

- Restricted receive-payment lookup to `V6/10-69` and `v3/10-69`.
- Approved payment now writes the actual paid amount into the calendar date, clears the old scheduled due cell, advances the due date by 10 days, and schedules the next fee while leaving principal/fee unchanged.
- Added pre-write validation and cell snapshots before every financial source write.
- Added owner-only `ย้อนคิว <เลข>` rollback to restore the exact pre-approval source cells when no later edit has changed them.
- Added an in-LINE “ย้อนรายการ” quick action after a successful approved payment write.
- Apps Script bridge target version: `2026.09.27-114`.
- Financial source writes remain controlled by `FINANCIAL_SOURCE_WRITES_ENABLED` and must not be enabled until bridge v114 is deployed live.

# บันทึกการแก้ไขระบบ Admin ID

ไฟล์นี้ใช้บันทึกการเปลี่ยนแปลงของระบบ LINE OA → Vercel → Google Apps Script → Google Sheets

## 26 กันยายน 2569

### Deploy ระบบแจ้งเตือนลูกค้าเวอร์ชัน 111

- แก้ฟังก์ชันทริกเกอร์จากฟังก์ชัน private ที่ลงท้าย `_` เป็น public wrapper `triggerDailyReminder` เพื่อให้เลือกสร้าง Time-driven trigger ใน Apps Script UI ได้
- รองรับการตรวจและลบทริกเกอร์ชื่อเก่า `triggerDailyReminder_` เพื่อไม่ให้เกิดทริกเกอร์ซ้ำหลังอัปเกรด
- Deploy Apps Script เป็นเวอร์ชัน `2026.09.26-111` (Deployment version 34) โดยคง Web App URL เดิม
- ติดตั้งทริกเกอร์ `triggerDailyReminder` แบบรายวัน ช่วงเวลา 09:00–10:00 น. เขตเวลาเอเชีย/กรุงเทพ
- ตั้งชีตนำร่องแจ้งเตือนอัตโนมัติเป็น `v6|V6/10-69`
- Vercel deployment สำเร็จ และ `/api/health` รายงาน `appVersion`/`bridgeVersion` ตรงกันที่ `2026.09.26-111`
- ผล health: `readyForFullTest: true`, self-test ผ่าน 18/19 และ critical checks ผ่าน 15/15
- รายการไม่บังคับที่ยังไม่ได้เชื่อม: OK Slip (ไม่กระทบระบบแจ้งเตือนลูกค้า)
- ผลการทดสอบในเครื่อง: ผ่าน `customer binding safety`, `automatic reminder requires explicit sheet selection`, `notification selection and duplicate protection` และตรวจ syntax ผ่าน
- Commit โค้ดทริกเกอร์: `4ba10b9e45018722a505b3250f2d07edfa787cec`
- Commit health version: `22d71a19d554280022c13f271f6084c76b9732e3`
- สถานะ: Deploy และเปิดใช้งานจริงแล้ว

### ระบบแจ้งเตือนลูกค้าแบบเลือกแหล่งและชีต

- ยืนยัน Flow เจ้าของ: เลือกแหล่งข้อมูล → เลือกชีต → ส่งรายคน / ส่งทุกคน / เปิดแจ้งอัตโนมัติ
- เอาค่าเริ่มต้นแบบ hard-code ที่เปิดแจ้งอัตโนมัติให้ `v6/V6/10-69` ออก
- หากเจ้าของยังไม่ได้เลือกชีต ระบบอัตโนมัติจะไม่สร้างรายการส่ง
- ระบบอัตโนมัติอ่านวันครบกำหนดจากชีตของลูกค้าแต่ละราย และส่งเฉพาะลูกค้าที่ผูก LINE สถานะ `ใช้งาน` และเปิดรับแจ้งเตือน
- เพิ่ม Log ผลการส่งรายลูกค้า ทั้ง `ส่งสำเร็จ` และ `ส่งไม่สำเร็จ`
- ใช้ชีต `คิวแจ้งเตือน` ป้องกันการส่งซ้ำ และเก็บผู้รับ เวลา ประเภท แหล่ง/ชีต และสถานะการส่ง
- ไม่แสดงแถบ Google Sheets ที่ถูกซ่อนในรายการเลือก
- ปรับเวอร์ชันเตรียม Deploy เป็น `2026.09.26-110`
- ไฟล์ที่แก้: `apps-script/AdminIdBridge.gs`, `api/health.js`, `tests/customer-safety.cjs`
- ผลการทดสอบ: ผ่าน `customer binding safety`, `automatic reminder requires explicit sheet selection`, `notification selection and duplicate protection` และตรวจ syntax ผ่าน
- สถานะ: อัปโค้ดเข้า GitHub หลังรวมงานชุดนี้ แต่ยังไม่ได้ Deploy Apps Script

### แก้ชื่อแถบลูกค้า v1/v3

- เปลี่ยนชื่อแถบใน `CUSTOMER_BINDING_TARGETS` จาก `v3/10` เป็น `v3/10-69`
- แหล่งข้อมูล: `v1/v3`
- ไฟล์ที่แก้: `apps-script/AdminIdBridge.gs`
- เหตุผล: `getSheetByName()` ต้องใช้ชื่อแถบตรงกับ Google Sheets ทุกตัวอักษร
- ผลกระทบ: ทำให้ระบบผูกลูกค้าสามารถค้นข้อมูลจากแถบ `v3/10-69` ได้หลัง Deploy Apps Script
- Commit งานแก้: `49a8c9572b7c3a6fb06379963b7da394544752da`
- สถานะ: อัปโค้ดเข้า GitHub แล้ว แต่ยังไม่ได้ Deploy Apps Script

## รูปแบบบันทึกครั้งต่อไป

แต่ละรายการควรระบุ:

- วันที่และเวลา
- สิ่งที่แก้
- เหตุผล
- ไฟล์หรือระบบที่กระทบ
- Commit
- ผลการทดสอบ
- สถานะ Deploy
