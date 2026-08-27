import os
import glob
import sys
import re
import io
import json
import fitz  # PyMuPDF
from rapidocr_onnxruntime import RapidOCR
import numpy as np
from PIL import Image
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

out_json = r"d:\行政書士\開業\gyosei-dashboard\data\store_codes_7month.json"
out_txt = r"d:\行政書士\開業\gyosei-dashboard\data\store_codes_7month.txt"

def extract_store_codes(target_dir):
    engine = RapidOCR()
    pdf_files = sorted(glob.glob(os.path.join(target_dir, "*.pdf")))
    
    results = {}
    
    with open(out_txt, "w", encoding="utf-8") as f_txt:
        f_txt.write(f"Target Directory: {target_dir}\n")
        f_txt.write(f"Total PDFs: {len(pdf_files)}\n\n")
        f_txt.flush()
        
        for pdf_path in pdf_files:
            fname = os.path.basename(pdf_path)
            store_name = fname.replace("　7月分.pdf", "").replace(".pdf", "")
            doc = fitz.open(pdf_path)
            
            all_order_numbers = []
            all_text_lines = []
            
            # OCR each page
            for p_idx in range(len(doc)):
                pix = doc[p_idx].get_pixmap(dpi=150)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                img_np = np.array(img)
                ocr_result, _ = engine(img_np)
                
                if not ocr_result:
                    continue
                    
                for item in ocr_result:
                    text = item[1].strip()
                    all_text_lines.append(text)
                    
                    # 8-digit order number check
                    # Patterns: 5xxxxxxx, 6xxxxxxx, 7xxxxxxx, 8xxxxxxx, etc.
                    m = re.findall(r'(?<!\d)(\d{8})(?!\d)', text)
                    for num in m:
                        if not (num.startswith('202') or num.startswith('201') or num.startswith('080') or num.startswith('090') or num.startswith('058') or num.startswith('052') or num.startswith('056')):
                            all_order_numbers.append(num)
                            
                    # Lines with keywords
                    if any(k in text for k in ["注文", "№", "No", "NO", "No.", "NO."]):
                        m2 = re.findall(r'(\d{6,10})', text)
                        for num in m2:
                            if not (num.startswith('202') or num.startswith('201') or num.startswith('080') or num.startswith('090') or num.startswith('058') or num.startswith('052') or num.startswith('056')):
                                all_order_numbers.append(num)
            
            # Prefixes
            prefixes = [num[:3] for num in all_order_numbers if len(num) >= 3]
            prefix_counts = Counter(prefixes)
            order_counts = Counter(all_order_numbers)
            
            results[store_name] = {
                "filename": fname,
                "pages": len(doc),
                "order_numbers": sorted(list(set(all_order_numbers))),
                "prefix_counts": dict(prefix_counts.most_common(5)),
                "common_prefix": prefix_counts.most_common(1)[0][0] if prefix_counts else "なし",
                "sample_orders": [num for num, _ in order_counts.most_common(5)],
                "sample_lines": [l for l in all_text_lines if any(k in l for k in ["注文", "№", "No", "NO"])][:6]
            }
            
            log_line = f"店舗: {store_name:20s} | 店舗コード(先頭3桁): {results[store_name]['common_prefix']} | 注文書№サンプル: {results[store_name]['sample_orders']} | 候補頻度: {dict(prefix_counts.most_common(3))}\n"
            print(log_line, end="")
            sys.stdout.flush()
            f_txt.write(log_line)
            f_txt.flush()
            
            with open(out_json, "w", encoding="utf-8") as f_json:
                json.dump(results, f_json, ensure_ascii=False, indent=2)
                
    return results

if __name__ == "__main__":
    target = r"d:\行政書士\開業\gyosei-dashboard\7月請求書"
    extract_store_codes(target)
