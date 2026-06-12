## เป้าหมาย
ขยายหน้า Admin ที่มีอยู่ (`/dashboard/admin`) ให้แอดมินทำงานจริงได้ + เพิ่มประตูเข้าด้วย "รหัส Admin"

## สิ่งที่จะทำ

### 1. ประตูเข้า Admin ด้วยรหัส
- เพิ่มหน้า `/dashboard/admin/unlock` — กรอกรหัส
- ตรวจรหัสฝั่ง **server (Edge Function `admin-unlock`)** เทียบกับ secret `ADMIN_ACCESS_CODE` (เก็บไว้ใน Cloud Secrets ไม่ใช่ในโค้ด)
- ถ้าถูก → insert แถวใน `user_roles` ให้ผู้ใช้ปัจจุบันเป็น `admin`
- หน้า Admin ยังตรวจสิทธิ์ผ่าน `user_roles` + `has_role()` แบบเดิม (RLS ปลอดภัย)

> หมายเหตุความปลอดภัย: รหัส `Admin1245` ที่พี่ให้มา ผม **ไม่ฮาร์ดโค้ดในฝั่ง browser** เพราะใครเปิด DevTools ก็เห็น จะเก็บเป็น secret ฝั่ง backend แทน — ยังกรอกรหัสนี้ได้เหมือนเดิม แต่ปลอดภัยกว่ามาก

### 2. จัดการผู้ใช้ (Users)
ในหน้า Admin เพิ่มตาราง users พร้อมปุ่ม:
- เปลี่ยน role (customer ↔ admin)
- ระงับ/ปลดระงับ (เพิ่มคอลัมน์ `profiles.suspended boolean`)
- ลบบัญชี (ผ่าน Edge Function `admin-users` ใช้ service role)

ระบบจะบล็อก user ที่ `suspended=true` ตอน login (เช็คใน `useAuth`)

### 3. ปิด/ล็อกฟีเจอร์ทั่วระบบ (Platform-wide kill switch)
ตารางใหม่ `platform_features (feature_key text PK, enabled bool, locked_plans text[])`
- ปิด → ทุก user ใช้ไม่ได้ (แทน `bot_features` ของแต่ละ user)
- `locked_plans` → ระบุว่าฟีเจอร์นี้เปิดเฉพาะแพ็คเกจไหน (เช่น `['pro','business']`)
- หน้า BotFeatures ของลูกค้าจะเช็ค platform_features ก่อน — ถ้าปิด/ล็อค จะ disabled พร้อมแสดงเหตุผล

### 4. จัดการราคา/แพ็คเกจ
ตารางใหม่ `plans (key text PK, name, price_monthly, price_yearly, features jsonb, is_active)`
- หน้า Admin → CRUD ราคาและฟีเจอร์ของแต่ละแพ็ค
- หน้า Billing/Landing pricing → ดึงจากตาราง `plans` แทน hardcode

### 5. ดู Orders/Invoices ทั้งระบบ
แท็บใหม่ในหน้า Admin: ตาราง orders + invoices ของทุกร้าน (filter, search) — read-only

## โครงสร้าง Tabs ในหน้า Admin
```
Overview | Users | Plans & Pricing | Platform Features | Orders | Invoices
```

## ไฟล์ที่จะแตะ
- **DB migration**: เพิ่ม `platform_features`, `plans`, `profiles.suspended`, RLS, GRANT
- **Edge Functions**: `admin-unlock`, `admin-users` (suspend/delete/role)
- **Frontend**: `src/pages/dashboard/Admin.tsx` (รื้อใหม่ + tabs), `src/pages/dashboard/AdminUnlock.tsx`, แก้ `BotFeatures.tsx`, `Billing.tsx`, `Landing.tsx` ให้อ่านจากตาราง `plans`/`platform_features`
- **Secrets**: เพิ่ม `ADMIN_ACCESS_CODE` (พี่จะใส่ค่าตอน setup — default `Admin1245`)

---

ขอบเขตค่อนข้างใหญ่ ผมเริ่มลงมือเลยไหมครับ? หรือพี่อยากตัดส่วนไหนออกก่อน (เช่น เอาแค่ข้อ 1–3 ก่อน, ไว้ทำ Plans/Orders รอบหน้า)