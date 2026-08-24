import os
import glob
import sys
import json
import re
import io
import fitz  # PyMuPDF
from rapidocr_onnxruntime import RapidOCR
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

def parse_month_invoices(target_dir):
    if not os.path.exists(target_dir):
        print(f"Error: Directory not found: {target_dir}")
        return

    pdf_files = sorted(glob.glob(os.path.join(target_dir, "*.pdf")))
    if not pdf_files:
        print(f"No PDF files found in {target_dir}")
        return

    print(f"Found {len(pdf_files)} PDF files in {target_dir}. Starting OCR analysis...")
    engine = RapidOCR()

    records = []

    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        doc = fitz.open(pdf_path)
        
        # Analyze Page 1 (Cover / Main invoice)
        p1 = doc[0]
        pix = p1.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        img_np = np.array(img)
        
        result, _ = engine(img_np)
        lines = []
        if result:
            for item in result:
                box = item[0]
                text = item[1]
                score = item[2]
                y_center = (box[0][1] + box[2][1]) / 2.0
                x_center = (box[0][0] + box[2][0]) / 2.0
                lines.append({"text": text, "score": score, "box": box, "x": x_center, "y": y_center})
        
        sorted_lines = sorted(lines, key=lambda it: (round(it['y'] / 15) * 15, it['x']))
        all_text = " ".join([l["text"] for l in sorted_lines])

        # Categorize
        if "ふそう" in fname or "三菱" in fname:
            group = "三菱"
        elif "日産" in fname:
            group = "日産"
        else:
            group = "トヨタ"

        records.append({
            "filename": fname,
            "group": group,
            "pages": len(doc),
            "lines": sorted_lines,
            "all_text": all_text
        })

    return records

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_directory = sys.argv[1]
    else:
        target_directory = r"d:\行政書士\開業\gyosei-dashboard\7月請求書"
    parse_month_invoices(target_directory)
