# EASY AND FAST PHOTO STUDIO V4 — Online deployment

ชุดนี้เตรียมสำหรับ Deploy เป็นเว็บไซต์สาธารณะด้วย Docker บน Render โดยใช้ Flask + Gunicorn และติดตั้ง AI models สำหรับแยกบุคคล/วัตถุ/ท้องฟ้าบนเซิร์ฟเวอร์

## สิ่งที่เปลี่ยนจาก V4 เดิม

- เพิ่ม Dockerfile สำหรับ production และ Gunicorn (ไม่ใช้ Flask development server)
- เพิ่ม `render.yaml` สำหรับสร้าง Web Service บน Render ใน Singapore
- เพิ่ม persistent disk สำหรับ cache โมเดล AI (`/var/data`)
- cache โมเดล rembg และ SegFormer ในหน่วยความจำ ไม่โหลดใหม่ทุกคำขอ
- จำกัดขนาดอัปโหลด 25 MB และจำกัดอัตราเรียก decode/AI ต่อ IP เบื้องต้น
- ปรับข้อความ privacy ให้ตรงกับการทำงานจริง: ภาพถูกส่งมายังเซิร์ฟเวอร์เพื่อ decode/AI inference และแอปไม่ได้บันทึกภาพเป็นไฟล์ถาวร

## Deploy แบบสาธารณะ (Render)

1. สร้างบัญชี GitHub และ Render ถ้ายังไม่มี
2. แตก ZIP นี้ แล้วอัปโหลด **ไฟล์ทั้งหมดภายในโฟลเดอร์** `easy-and-fast-photo-studio-online` ไปยัง repository ใหม่บน GitHub (ให้ `Dockerfile`, `render.yaml`, `app.py` อยู่ระดับบนสุดของ repo)
3. เข้า Render Dashboard → New → Blueprint แล้วเลือก repository นี้
4. ตรวจสอบ Blueprint: Web Service ชื่อ `easy-and-fast-photo-studio`, region Singapore, health check `/health`, persistent disk 10 GB
5. กดยืนยันสร้างบริการและรอ build/deploy ครั้งแรก
6. เมื่อสำเร็จ Render จะแสดง URL ประมาณ `https://easy-and-fast-photo-studio.onrender.com` (ชื่อจริงอาจมี suffix หากชื่อซ้ำ)
7. เปิด URL ทดสอบอัปโหลดรูป, ปรับสี, AI Mask และ AI Layer Separation

คู่มือ Render: https://render.com/docs/blueprints และ https://render.com/docs/docker

## ข้อกำหนดทรัพยากรและค่าใช้จ่าย

- Blueprint ตั้ง `plan: standard` และ disk 10 GB เป็นค่าเริ่มต้นสำหรับงาน AI บน CPU ไม่ใช่แพ็กเกจฟรี
- การโหลด PyTorch, rembg และ SegFormer ครั้งแรกอาจใช้เวลานานและใช้ RAM/CPU สูงมาก; การแยกวัตถุหลายคลาสอาจช้าเมื่อใช้ CPU
- หาก deploy แล้วเกิด out-of-memory, request timeout หรือมีผู้ใช้พร้อมกันมาก ต้องเพิ่ม RAM/CPU หรือย้าย inference ไป GPU worker เช่น RunPod/Modal แล้วให้เว็บเรียก API ของ worker
- ไม่มีการตั้งค่า custom domain ในไฟล์นี้; ใช้ URL `onrender.com` ก่อน แล้วค่อยเพิ่มโดเมนของตัวเองจาก Render Dashboard ได้

## ข้อจำกัดสำคัญก่อนเปิดให้คนทั่วไป

- Rate limit ใน Flask-Limiter ใช้ memory ของ instance เดียว เหมาะกับการเริ่มต้นเท่านั้น; ถ้าขยายหลาย instance ให้เปลี่ยนเป็น Redis-backed limiter
- แอปเวอร์ชันนี้ยังไม่มีระบบสมาชิก, quota ตามบัญชี, payment, job queue หรือ cloud project storage
- ไฟล์ภาพที่ส่งเข้ามาอยู่ในหน่วยความจำระหว่างประมวลผลและไม่ได้ถูกเก็บถาวรโดยแอป แต่ผู้ให้บริการโฮสติ้งอาจมีระบบ log/backup ตามนโยบายของเขา
- อย่าเก็บ API keys หรือรหัสผ่านไว้ใน GitHub; ให้ใส่เป็น Environment Variables ใน Render
- ก่อนประกาศใช้งานจริง ควรทดสอบกับภาพหลายชนิดและตรวจสอบค่าใช้จ่าย/การใช้ทรัพยากรจาก Dashboard

## ทดสอบในเครื่องด้วย Docker

```bash
docker build -t easy-fast-photo-studio .
docker run --rm -p 10000:10000 -v photo-model-cache:/var/data easy-fast-photo-studio
```

จากนั้นเปิด http://localhost:10000

## Health check

`GET /health` ควรตอบกลับ `{"ok": true}`
