from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
import threading
from PIL import Image, ImageOps
from io import BytesIO
import base64, os
import numpy as np

app = Flask(__name__, static_folder="static")
# Render terminates HTTPS at one trusted reverse proxy.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
Image.MAX_IMAGE_PIXELS = 50_000_000
# Public deployment guardrails. AI endpoints are intentionally rate-limited because
# each request runs CPU-heavy inference. Use one Gunicorn worker to share these caches.
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")
_model_lock = threading.Lock()
_rembg_session = None
_segmentation_pipeline = None

def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        with _model_lock:
            if _rembg_session is None:
                from rembg import new_session
                _rembg_session = new_session("u2net")
    return _rembg_session

def get_segmentation_pipeline():
    global _segmentation_pipeline
    if _segmentation_pipeline is None:
        with _model_lock:
            if _segmentation_pipeline is None:
                from transformers import pipeline
                _segmentation_pipeline = pipeline(
                    "image-segmentation",
                    model="nvidia/segformer-b0-finetuned-ade-512-512",
                    device=-1,
                )
    return _segmentation_pipeline

@app.errorhandler(429)
def rate_limit_error(_error):
    return jsonify(error="ใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"), 429
RAW_EXTENSIONS = {".3fr", ".ari", ".arw", ".bay", ".cr2", ".cr3", ".cap", ".data", ".dcs", ".dcr", ".dng", ".drf", ".eip", ".erf", ".fff", ".gpr", ".iiq", ".k25", ".kdc", ".mdc", ".mef", ".mos", ".mrw", ".nef", ".nrw", ".obm", ".orf", ".pef", ".ptx", ".pxn", ".r3d", ".raf", ".raw", ".rw2", ".rwl", ".sr2", ".srf", ".srw", ".x3f"}

def decode_image(data, filename):
    ext = os.path.splitext(filename.lower())[1]
    if ext in RAW_EXTENSIONS:
        try: import rawpy
        except ImportError: raise ValueError("ไฟล์ RAW ต้องติดตั้ง rawpy ก่อน: pip install rawpy")
        with rawpy.imread(BytesIO(data)) as raw: rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, output_bps=8)
        return Image.fromarray(rgb, "RGB")
    image = Image.open(BytesIO(data))
    return ImageOps.exif_transpose(image).convert("RGB")

@app.get("/")
def home(): return send_from_directory("static", "index.html")

@app.post("/decode")
@limiter.limit("30 per minute")
def decode():
    file = request.files.get("file")
    if not file: return jsonify(error="ไม่พบไฟล์ภาพ"), 400
    try:
        image = decode_image(file.read(), file.filename); image.thumbnail((2200, 2200))
        output = BytesIO(); image.save(output, format="JPEG", quality=94)
        return jsonify(data="data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii"), width=image.width, height=image.height, original_name=file.filename)
    except Exception as exc: return jsonify(error=str(exc)), 415

@app.post("/ai-mask")
@limiter.limit("3 per minute")
def ai_mask():
    file = request.files.get("file"); target = request.form.get("target", "person")
    if not file: return jsonify(error="ไม่พบภาพต้นฉบับ"), 400
    try:
        image = ImageOps.exif_transpose(Image.open(file.stream)).convert("RGB")
        if target in ("person", "background"):
            try: from rembg import remove
            except ImportError: return jsonify(error="ยังไม่ได้ติดตั้ง AI Subject Mask — รัน py -m pip install -r requirements-ai.txt แล้วเปิดโปรแกรมใหม่"), 503
            cutout = remove(image, session=get_rembg_session(), only_mask=True)
            mask = cutout.convert("L")
            if target == "background": mask = ImageOps.invert(mask)
        elif target == "sky":
            try:
                segmenter = get_segmentation_pipeline()
            except ImportError: return jsonify(error="AI Sky Mask ต้องติดตั้ง requirements-ai.txt และ requirements-sky.txt ก่อน"), 503
            results = segmenter(image)
            sky = next((x["mask"].convert("L") for x in results if x.get("label", "").lower() == "sky"), None)
            if sky is None: return jsonify(error="โมเดลไม่พบพื้นที่ท้องฟ้าในภาพนี้"), 422
            mask = sky
        else: return jsonify(error="ชนิดมาสก์ไม่ถูกต้อง"), 400
        mask = mask.resize(image.size, Image.Resampling.BILINEAR)
        out = BytesIO(); mask.save(out, format="PNG")
        return jsonify(mask="data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii"), width=mask.width, height=mask.height, target=target)
    except Exception as exc: return jsonify(error=f"สร้าง AI Mask ไม่สำเร็จ: {exc}"), 500


@app.post("/separate-layers")
@limiter.limit("2 per minute")
def separate_layers():
    """Create transparent semantic layers plus an inpainted background."""
    file = request.files.get("file")
    if not file: return jsonify(error="ไม่พบภาพต้นฉบับ"), 400
    try:
        image = ImageOps.exif_transpose(Image.open(file.stream)).convert("RGB")
        # Keep processing size aligned with the editor's 2200px preview.
        image.thumbnail((2200, 2200))
        import numpy as np
        src = np.array(image)
        segments = []
        union = np.zeros((image.height, image.width), dtype=np.uint8)

        # High-quality foreground/person alpha matte.
        try:
            from rembg import remove
            rgba = remove(image, session=get_rembg_session())
            rgba = rgba.convert("RGBA").resize(image.size)
            alpha = np.array(rgba.getchannel("A"))
            if alpha.max() > 0:
                # Person layer uses original RGB with rembg's soft alpha.
                person = Image.fromarray(np.dstack((src, alpha)).astype(np.uint8), "RGBA")
                buf=BytesIO(); person.save(buf, format="PNG")
                segments.append({"name":"Person / Foreground", "kind":"person", "image":"data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode("ascii")})
                union=np.maximum(union, (alpha>24).astype(np.uint8)*255)
        except ImportError:
            return jsonify(error="ต้องติดตั้ง AI ก่อน: py -m pip install -r requirements-ai.txt"), 503

        # Semantic classes provide separate object layers (car, chair, tree, etc.).
        try:
            segmenter = get_segmentation_pipeline()
            results = segmenter(image)
        except ImportError:
            return jsonify(error="ต้องติดตั้งโมเดลแยกวัตถุ: py -m pip install -r requirements-ai.txt"), 503
        except Exception as exc:
            return jsonify(error=f"โหลดโมเดลแยกวัตถุไม่สำเร็จ: {exc}"), 500

        seen=set()
        for item in results:
            label=str(item.get("label", "Object")).strip()
            key=label.lower()
            if key in ("person", "sky", "wall", "floor", "ceiling") or key in seen: continue
            seen.add(key)
            mask_img=item.get("mask")
            if mask_img is None: continue
            mask=np.array(mask_img.convert("L").resize(image.size, Image.Resampling.BILINEAR))
            # Avoid duplicate foreground pixels where the person matte already exists.
            if union.max(): mask=np.where(union>24, 0, mask).astype(np.uint8)
            if int((mask>80).sum()) < max(120, int(image.width*image.height*0.001)): continue
            rgba_arr=np.dstack((src, mask)).astype(np.uint8)
            obj=Image.fromarray(rgba_arr, "RGBA")
            buf=BytesIO(); obj.save(buf, format="PNG")
            segments.append({"name":label.title(), "kind":"object", "image":"data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode("ascii")})
            union=np.maximum(union, (mask>24).astype(np.uint8)*255)

        # Build a clean-ish background by inpainting all extracted foreground regions.
        try:
            import cv2
            bg=cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), union, 5, cv2.INPAINT_TELEA)
            bg=Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB))
        except ImportError:
            bg=image.copy()
        buf=BytesIO(); bg.save(buf, format="PNG")
        return jsonify(background="data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode("ascii"), layers=segments, width=image.width, height=image.height, note="ผลลัพธ์ขึ้นกับภาพและโมเดล AI; พื้นหลังที่ลบวัตถุเป็นการเติมภาพโดยประมาณ")
    except Exception as exc:
        return jsonify(error=f"แยกเลเยอร์ไม่สำเร็จ: {exc}"), 500

@app.get("/health")
def health(): return jsonify(ok=True)

if __name__ == "__main__": app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
