มีหลายเรื่องที่จะทำ ขอสรุปและเรียงลำดับให้ก่อนนะครับ

## 1. แก้ปัญหาไฟล์สต็อก
- ทำให้ไฟล์ **.xlsx อ่านได้จริง** (ตอนนี้อ่านได้แค่ CSV) — ใช้ไลบรารี `xlsx` (SheetJS) parse ใน browser และ map header ภาษาไทย/อังกฤษอัตโนมัติ
- เพิ่มช่อง **"อัปโหลดรูปสินค้า"** ในหน้าจัดการสินค้า เก็บลง storage bucket `product-images` ที่มีอยู่แล้ว
- บอทจะดึง `image_url` ของสินค้าส่งกลับให้ลูกค้าในแชท (ทั้ง preview widget, LiveChat, voice assistant)

## 2. ลบ Shopify ออกทั้งหมด
- ลบหน้า/component/route ที่เหลือเกี่ยวกับ Shopify
- ลบ `shopify` ออกจาก provider ใน `integrations` (UI), ใน Overview channels, ใน seed demo data ไม่ต้องโชว์
- ลบ option Shopify ในหน้า Integrations / Connect

## 3. Multi-language Chat (40+ ภาษา)
- ปรับ system prompt ของ chat edge function ให้ **detect ภาษาลูกค้าและตอบกลับภาษาเดียวกัน** (ไทย, อังกฤษ, จีน, ญี่ปุ่น, เกาหลี, เวียดนาม, อินโดฯ, สเปน, ฝรั่งเศส, เยอรมัน, อาหรับ, ฯลฯ)
- อัปเดตทั้ง `chat`, `voice-recommend`, demo widget

## 4. In-Chat Checkout (ตะกร้า + ยืนยันออเดอร์)
- เพิ่ม **tool calling** ใน chat edge function: `add_to_cart`, `view_cart`, `confirm_order`
- UI ใน DemoChatDialog/ChatWidget แสดง cart card + ปุ่ม "ยืนยันสั่งซื้อ"
- เมื่อกดยืนยัน → insert ลง `orders` table + ส่งข้อความยืนยันกลับ
- (ยังไม่ผูก payment gateway — ใช้ mock "ชำระปลายทาง / โอน" ก่อน)

## 5. วิเคราะห์ลูกค้าลึกขึ้น
- บันทึก `customer_intent`, `interested_categories`, `budget_range` ลง conversation metadata
- ใช้ history + product catalog แนะนำสินค้าใน chat ผ่าน tool `recommend_products` (เรียก embed ของ catalog + match)

## 6. แจ้งเตือนอัตโนมัติ
- ตอนนี้มี trigger `check_low_stock` และ `notify_human_takeover` อยู่แล้ว
- เพิ่ม UI **bell icon** ใน DashboardLayout แสดง notifications แบบ realtime (subscribe Supabase realtime channel `notifications`)
- mark as read, click → ไปหน้าที่เกี่ยว

## 7. Web Chat Widget Snippet — ทำให้ใช้ได้จริง
- ปัจจุบัน snippet ชี้ไป `/chat-widget?botId=...` แต่ embed เป็น iframe เต็มจอ ไม่ใช่ widget bubble
- เขียน **`public/widget.js`** standalone: inject ปุ่ม bubble มุมขวาล่าง + iframe popup ที่โหลด `/chat-widget?botId=xxx`
- Snippet ใหม่:
```html
<script src="https://bot-buddy-globe.lovable.app/widget.js" data-bot-id="xxx" defer></script>
```
- ทดสอบใส่ในหน้า demo ว่าเปิดได้จริง

## 8. Feature Toggle ไม่ต้องรีหน้า
- หน้า bot features ตอนนี้อาจ refetch หลัง toggle — เปลี่ยนเป็น **optimistic update** ผ่าน react-query (`setQueryData` แทน `invalidateQueries` + refetch หนัก)
- ใช้ realtime subscription กับ `bot_features` ให้ทุกหน้าที่ใช้ feature flag อัปเดตทันที

## 9. Training Bot + LINE OA Logic
- ในหน้า Training เพิ่ม **3 mode ต่อ channel**:
  - 🤖 **บอทตอบอัตโนมัติ** (default)
  - 👤 **คนตอบเท่านั้น** — บอทเงียบสนิท ไม่ตอบอะไรเลย ไม่ส่ง "ขอโทษค่ะ บอทตอบไม่ได้"
  - 🔀 **ตอบอัตโนมัติเฉพาะคำถามที่สอน** — ถ้าไม่มี match → เงียบ ให้คนรับช่วง
- เก็บใน `bot_features` หรือเพิ่มคอลัมน์ `reply_mode` ใน `integrations` (per channel)
- แก้ chat edge function: ถ้า mode = `human_only` → return empty / ไม่ส่งข้อความ; ถ้า `trained_only` และไม่มีข้อมูล training match → return empty
- ลบ fallback message แบบ "ขออภัยค่ะ บอทไม่สามารถ..." ทุกที่

## ลำดับการทำ
จะเริ่มเรียงตามนี้ (เพราะมีของเยอะ อยากให้ใช้ได้ทีละชิ้น):
1. แก้ xlsx + ลบ Shopify (เร็ว, แก้ pain point ตรง ๆ)
2. Multi-language + ลบข้อความ "บอทตอบไม่ได้" + Reply mode (LINE OA logic)
3. Feature toggle realtime (ไม่รีหน้า)
4. Widget snippet ที่ใช้ได้จริง + รูปสินค้าในแชท
5. In-chat cart + checkout + notification bell
6. วิเคราะห์ลูกค้าลึกขึ้น

---

**คำถาม:** ทำทั้งหมดเลย หรือเอาแค่กลุ่ม 1-3 ก่อน (ของพื้นฐานที่งานพังอยู่) แล้วค่อยทำกลุ่ม 4-6 ทีหลัง? ผมแนะนำทำกลุ่ม 1-3 ก่อนเพราะของพังอยู่ตอนนี้ ส่วน checkout/widget/วิเคราะห์ลึก จะเป็น phase ต่อไป จะได้ทดสอบทีละชิ้น