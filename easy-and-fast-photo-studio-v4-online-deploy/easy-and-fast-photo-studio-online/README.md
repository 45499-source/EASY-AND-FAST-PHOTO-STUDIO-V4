# EASY AND FAST PHOTO STUDIO V3

โปรแกรมแต่งภาพแบบ local-first บน Flask + HTML Canvas ต่อจาก V2 พร้อม Brush Mask, Light Direction, Smart Layers, AI Subject Mask, Undo/Redo และ Interactive Help

## ฟีเจอร์

- ปรับ Exposure, Contrast, Highlights, Shadows, Temperature, Saturation, Vibrance และ Fade
- Looks และเทมเพลตสำหรับเริ่มแต่งภาพอย่างรวดเร็ว
- Brush Mask พร้อมยางลบ ขนาดแปรง ขอบฟุ้ง และการปรับสีเฉพาะจุด
- Light Direction: ลากกำหนดต้นทางและทิศทางได้ 360 องศา ปรับสี ความแรง ความฟุ้ง และระยะ
- Layers: สร้าง Brush/Light Layer, เลือกเลเยอร์, ซ่อน/แสดง, ปรับความทึบ, จัดลำดับ และลบ
- Undo/Redo ประวัติการแก้ไขสูงสุด 35 สถานะ
- AI Mask สำหรับบุคคลและฉากหลังผ่าน rembg; ท้องฟ้าผ่าน SegFormer
- AI Layer Separation: แยกคนและวัตถุตามคลาสเป็น PNG โปร่งใสหลายเลเยอร์ พร้อมสร้างพื้นหลังเติมส่วนที่ถูกบังโดยประมาณ (OpenCV inpainting)
- คู่มือเริ่มต้นครั้งแรกและปุ่ม Help ที่เปิดคู่มือซ้ำได้
- ประมวลผลภาพหลักในเบราว์เซอร์ ไม่อัปโหลดภาพไปบริการคลาวด์ภายนอก

## Prerequisites

- Python 3.10+
- Windows, macOS หรือ Linux
- สำหรับไฟล์ RAW: rawpy และไลบรารีที่รองรับไฟล์กล้อง
- สำหรับ AI person/background mask และ AI Layer Separation: ติดตั้ง `requirements-ai.txt` (ดาวน์โหลด PyTorch/โมเดลค่อนข้างใหญ่ และครั้งแรกต้องใช้อินเทอร์เน็ต)
- สำหรับ AI sky mask: ติดตั้ง `requirements-sky.txt` และ PyTorch build ที่เข้ากันได้จาก https://pytorch.org/get-started/locally/

## Build / Install

```bash
py -m venv .venv
.venv\\Scripts\\activate
py -m pip install -r requirements.txt
```

ติดตั้งตัวเลือก AI เพิ่มเติม:

```bash
py -m pip install -r requirements-ai.txt
```

สำหรับ AI ท้องฟ้า ติดตั้ง PyTorch ตามระบบก่อน แล้วรัน:

```bash
py -m pip install -r requirements-sky.txt
```

## Usage

```bash
py app.py
```

เปิด `http://127.0.0.1:5000` ในเบราว์เซอร์

1. อัปโหลด JPG, PNG, WEBP หรือไฟล์ RAW ที่ rawpy รองรับ
2. ปรับสีด้วย Looks, Templates และ Adjustments
3. เพิ่ม Brush หรือ Light Layer เพื่อแก้ไขเฉพาะจุด
4. ลากเส้นบนภาพเพื่อกำหนดทิศทางแสงได้อิสระ 360 องศา
5. เลือกเลเยอร์และใช้ AI Subject Mask ตามชนิดที่ต้องการ
6. ใช้ Undo/Redo เพื่อย้อนหรือคืนค่าการแก้ไข และ Export เป็น JPG

## Offset / model disclaimer

โปรเจกต์นี้ไม่ใช้ game offsets, process injection หรือ memory patching. AI mask relies on locally installed third-party models; the first run may download model weights and requires adequate RAM/CPU (or a compatible PyTorch accelerator for sky segmentation). Segmentation quality varies with image content. RAW support depends on rawpy/libraw and camera format support.
