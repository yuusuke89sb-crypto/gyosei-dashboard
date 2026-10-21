"""
店舗送付パック作成エンジン（行政書士法人フェリス）

実物のテンプレート（DocuWorks・Excel）をそのまま土台にして、
  1枚目: 書類確認書（表紙）  … Excel に記入 → Excel 自身で PDF 化
  2枚目〜: 依頼書            … PDF / FAX(TIF) から選んだページ（耳消し・回転）
  所在図・配置図             … DocuWorks テンプレートの文字を書き換え、地図を枠内に貼付 → PDF 化
を1つの PDF にまとめる。所在図・配置図の .xdw と表紙の .xlsx も保存する。

必要環境: DocuWorks（xdwapi.dll）/ Microsoft Excel / Python: xdwlib, PyMuPDF(fitz), Pillow, pywin32
"""

import base64
import datetime
import io
import os
import re
import shutil
import tempfile
import threading

import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageOps, ImageSequence

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates', 'oss_dw')
TPL_SOZAI = os.path.join(TEMPLATE_DIR, 'sozai_template.xdw')
TPL_HAICHI = os.path.join(TEMPLATE_DIR, 'haichi_template.xdw')
TPL_COVER = os.path.join(TEMPLATE_DIR, 'cover_template.xlsx')
OUTPUT_ROOT = r"D:\行政書士\OSS送付"
WORK_DIR = os.path.join(tempfile.gettempdir(), 'oss_pack_work')

STAFF_NAME = '吉村'  # 表紙「作成担当」（この方式で出力する場合は吉村）

# ── テンプレート上の記載欄（枠線の内側, mm）: 300dpi 実測値 ──
FRAME_SOZAI = (24.55, 43.52, 271.78, 192.62)
FRAME_HAICHI = (24.55, 42.08, 271.78, 181.19)
FRAME_MARGIN_MM = 0.6   # 枠線に地図が被らないよう内側に空ける
MAP_DPI = 300

# 配置図テンプレートの文字位置（mm）: 位置で特定するので文言が変わっても動く
POS_DEALER = (201.46, 181.68)     # 連絡先の店名
POS_DEALER_TEL = (242.36, 181.46)  # 連絡先の電話番号
POS_REGNO = (217.30, 187.90)      # 登録番号
DEALER_RIGHT_EDGE = 236.27        # 店名の右端（℡マークに被らない位置）
DEALER_MAX_WIDTH = 35.8           # 店名に使える幅（「連絡先」と「℡」の間）
REGNO_CELL = (223.0, 271.0)       # 登録番号セルの左右端（中央寄せ用）

_xdw_lock = threading.Lock()


# ════════════════════════════════════════════════════════════
# 共通
# ════════════════════════════════════════════════════════════
def sanitize(name, default='無題'):
    name = (name or '').strip() or default
    return re.sub(r'[\\/:*?"<>|\r\n\t]', '_', name)[:40]


def b64_to_bytes(data):
    if not data:
        return None
    if ',' in data[:100]:
        data = data.split(',', 1)[1]
    return base64.b64decode(data)


def order_digits8(order_no):
    d = re.sub(r'\D', '', str(order_no or ''))
    if len(d) > 8:
        d = d[-8:]
    return d.zfill(8)


def reiwa_date_text(date=None):
    date = date or datetime.date.today()
    return f"令　和　{date.year - 2018}　年　{date.month}月{date.day}日　"


# ════════════════════════════════════════════════════════════
# 地図画像 → 枠ぴったりの BMP
# ════════════════════════════════════════════════════════════
def make_map_bitmap(png_bytes, frame, out_path):
    """地図画像を枠（mm）の内側に縦横比を保って収め、余白は白で埋めた 300dpi BMP を作る。
    戻り値: (貼付位置x, y) mm"""
    x0, y0, x1, y1 = frame
    m = FRAME_MARGIN_MM
    w_mm, h_mm = (x1 - x0) - 2 * m, (y1 - y0) - 2 * m
    W, H = round(w_mm / 25.4 * MAP_DPI), round(h_mm / 25.4 * MAP_DPI)

    src = Image.open(io.BytesIO(png_bytes))
    if src.mode in ('RGBA', 'LA', 'P'):
        src = src.convert('RGBA')
        bg = Image.new('RGBA', src.size, (255, 255, 255, 255))
        bg.alpha_composite(src)
        src = bg
    src = src.convert('RGB')

    scale = min(W / src.width, H / src.height)
    nw, nh = max(1, round(src.width * scale)), max(1, round(src.height * scale))
    resized = src.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), 'white')
    canvas.paste(resized, ((W - nw) // 2, (H - nh) // 2))
    canvas.save(out_path, format='BMP', dpi=(MAP_DPI, MAP_DPI))
    return (x0 + m, y0 + m)


# ════════════════════════════════════════════════════════════
# DocuWorks（所在図・配置図）
# ════════════════════════════════════════════════════════════
def _nearest_text(annotations, pos, tol=4.0):
    best, best_d = None, tol
    for a in annotations:
        if a.type != 'TEXT':
            continue
        d = abs(a.position.x - pos[0]) + abs(a.position.y - pos[1])
        if d < best_d:
            best, best_d = a, d
    return best


def _set_order_digits(annotations, digits8):
    """注文番号は「3桁」「5桁」の2つの文字（数字の間に半角スペース）。左から順に置き換える。"""
    nums = [a for a in annotations
            if a.type == 'TEXT' and re.fullmatch(r'[\d ]+', a.text or '') and a.position.y < 30]
    nums.sort(key=lambda a: a.position.x)
    rest = digits8
    for a in nums:
        n = len(re.sub(r'\D', '', a.text))
        part, rest = rest[:n], rest[n:]
        trailing = ' ' if a.text.endswith(' ') else ''
        a.text = ' '.join(part) + trailing
    return len(nums)


def build_dw_page(kind, data, map_png, out_xdw, out_pdf):
    """kind: 'sozai' | 'haichi'"""
    import xdwlib
    from xdwlib import Point

    tpl = TPL_SOZAI if kind == 'sozai' else TPL_HAICHI
    frame = FRAME_SOZAI if kind == 'sozai' else FRAME_HAICHI
    os.makedirs(WORK_DIR, exist_ok=True)
    work_xdw = os.path.join(WORK_DIR, f'{kind}_{os.getpid()}_{threading.get_ident()}.xdw')
    shutil.copy(tpl, work_xdw)

    with _xdw_lock:
        doc = xdwlib.xdwopen(work_xdw)
        try:
            pg = doc.page(0)
            anns = [pg.annotation(i) for i in range(pg.annotations)]

            _set_order_digits(anns, order_digits8(data.get('orderNo8')))

            if kind == 'haichi':
                dealer = (data.get('dealerName') or '').strip()
                if dealer:
                    a = _nearest_text(anns, POS_DEALER)
                    if a:
                        a.text = dealer.replace(' ', '　')
                        fs = 10.0
                        while a.size.x > DEALER_MAX_WIDTH and fs > 6.0:
                            fs -= 0.5
                            a.font_size = fs
                        a.position = Point(DEALER_RIGHT_EDGE - a.size.x, a.position.y)
                tel = (data.get('dealerTel') or '').strip()
                a = _nearest_text(anns, POS_DEALER_TEL)
                if a and tel:
                    a.text = tel
                reg = (data.get('regNo') or '').strip()
                a = _nearest_text(anns, POS_REGNO)
                if a and reg:
                    if re.sub(r'\s', '', reg) == '増車':
                        a.text = '　　　　増　　　車'
                    else:
                        a.text = reg
                        cx = (REGNO_CELL[0] + REGNO_CELL[1]) / 2
                        a.position = Point(max(REGNO_CELL[0], cx - a.size.x / 2), a.position.y)

            if map_png:
                bmp = os.path.join(WORK_DIR, f'{kind}_{os.getpid()}_{threading.get_ident()}.bmp')
                pos = make_map_bitmap(map_png, frame, bmp)
                pg.add_bitmap(pos, path=bmp)

            doc.save()
        finally:
            doc.close()

        os.makedirs(os.path.dirname(out_xdw), exist_ok=True)
        shutil.copy(work_xdw, out_xdw)

        doc = xdwlib.xdwopen(work_xdw, readonly=True)
        try:
            tmp_pdf = doc.export_image(0, os.path.join(WORK_DIR, f'{kind}_{threading.get_ident()}.pdf'),
                                       dpi=300, format='pdf', color='color', compress='mrc_normal')
        finally:
            doc.close()
        shutil.move(tmp_pdf, out_pdf)
        try:
            os.remove(work_xdw)
        except OSError:
            pass
    return out_pdf


# ════════════════════════════════════════════════════════════
# 表紙（書類確認書 Excel）
# ════════════════════════════════════════════════════════════
def build_cover(cover, digits8, out_xlsx, out_pdf):
    import pythoncom
    import win32com.client as win32

    shutil.copy(TPL_COVER, out_xlsx)
    pythoncom.CoInitialize()
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    try:
        wb = xl.Workbooks.Open(out_xlsx)
        try:
            ws = wb.Worksheets('編集')
            dealer = (cover.get('dealerName') or '').replace(' ', '　')
            ws.Range('A3').Value = dealer
            ws.Range('A7').Value = cover.get('dateText') or reiwa_date_text()
            # 注文書番号はテキストボックス（数字の間隔付き表示）に入っている
            for shp in ws.Shapes:
                try:
                    if shp.Type == 17 and shp.TopLeftCell.Row == 9:
                        shp.TextFrame2.TextRange.Text = digits8
                except Exception:
                    pass
            ws.Range('F9').Value = "'" + digits8
            ws.Range('I9').Value = cover.get('contactName') or ''
            ws.Range('D10').Value = cover.get('usageLocation') or '申請者に同じ'
            ws.Range('D11').Value = cover.get('parkingLocation') or '同上'
            zip_digits = re.sub(r'\D', '', cover.get('zip') or '')
            ws.Range('D12').Value = int(zip_digits) if zip_digits else ''
            ws.Range('D13').Value = cover.get('address') or ''
            ws.Range('D14').Value = cover.get('applicantName') or ''
            ws.Range('K17').Value = STAFF_NAME
            ws.Activate()
            wb.Save()
            ws.ExportAsFixedFormat(0, out_pdf, 0, True, False)
        finally:
            wb.Close(False)
    finally:
        xl.Quit()
        pythoncom.CoUninitialize()
    return out_pdf


# ════════════════════════════════════════════════════════════
# 依頼書（PDF / FAX TIF）
# ════════════════════════════════════════════════════════════
def load_request_pages(path, dpi=200):
    """依頼書の各ページを PIL 画像（正方ピクセル）で返す。FAX は 1bit のまま。"""
    ext = os.path.splitext(path)[1].lower()
    pages = []
    if ext in ('.tif', '.tiff'):
        im = Image.open(path)
        for frame in ImageSequence.Iterator(im):
            f = frame.copy()
            xdpi, ydpi = f.info.get('dpi', (dpi, dpi))
            xdpi, ydpi = float(xdpi or dpi), float(ydpi or dpi)
            if abs(xdpi - ydpi) > 1:  # FAX 標準モード(204x98dpi) などを正方ピクセルに補正
                f = f.resize((f.width, round(f.height * xdpi / ydpi)), Image.NEAREST)
            f.info['dpi'] = (xdpi, xdpi)
            pages.append(f)
    else:
        doc = fitz.open(path)
        for p in doc:
            pix = p.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
            im = Image.frombytes('L', (pix.width, pix.height), pix.samples)
            im.info['dpi'] = (dpi, dpi)
            pages.append(im)
        doc.close()
    return pages


def page_thumbnails(path, max_px=360):
    out = []
    for i, im in enumerate(load_request_pages(path, dpi=100)):
        t = im.convert('L')
        t.thumbnail((max_px, max_px))
        buf = io.BytesIO()
        t.save(buf, format='PNG', optimize=True)
        out.append({'index': i, 'width': im.width, 'height': im.height,
                    'thumb': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()})
    return out


def process_request_page(im, rotate=0, ear=None):
    """回転 → 耳消し（上下左右を % 幅で白塗り）。ear 例: {'top': 3.0, 'left': 0}"""
    dpi = im.info.get('dpi', (200, 200))[0]
    if rotate:
        im = im.rotate(-int(rotate), expand=True, fillcolor=255)
    im = im.convert('L') if im.mode not in ('1', 'L') else im
    ear = ear or {}
    draw = ImageDraw.Draw(im)
    W, H = im.size
    white = 255
    t, b, l, r = (float(ear.get(k) or 0) / 100.0 for k in ('top', 'bottom', 'left', 'right'))
    if t > 0: draw.rectangle([0, 0, W, round(H * t)], fill=white)
    if b > 0: draw.rectangle([0, H - round(H * b), W, H], fill=white)
    if l > 0: draw.rectangle([0, 0, round(W * l), H], fill=white)
    if r > 0: draw.rectangle([W - round(W * r), 0, W, H], fill=white)
    im.info['dpi'] = (dpi, dpi)
    return im


def append_image_page(pdf, im):
    """画像を A4（縦横は画像に合わせる）いっぱいに収めたページを追加。白黒は 1bit で軽量化。"""
    portrait = im.height >= im.width
    page = pdf.new_page(width=595.28 if portrait else 841.89, height=841.89 if portrait else 595.28)
    if im.mode == 'L':
        # グレーの依頼書（メールPDF）は 2値化すると判読性が落ちるので JPEG グレーで保持
        buf = io.BytesIO()
        im.save(buf, format='JPEG', quality=70, optimize=True)
    else:
        buf = io.BytesIO()
        im.convert('1').save(buf, format='PNG', optimize=True)
    page.insert_image(page.rect, stream=buf.getvalue(), keep_proportion=True)


# ════════════════════════════════════════════════════════════
# 一括作成
# ════════════════════════════════════════════════════════════
def build_pack(data):
    """
    data = {
      orderNo8, dealerName, dealerTel, regNo, applicantName,
      cover: {dealerName, dateText, contactName, usageLocation, parkingLocation, zip, address, applicantName},
      sozaiPng, haichiPng  (dataURL / base64),
      request: {path, pages: [{index, rotate}], ear: {top,bottom,left,right}}  (任意)
    }
    """
    digits8 = order_digits8(data.get('orderNo8'))
    applicant = sanitize(data.get('applicantName') or (data.get('cover') or {}).get('applicantName'), '申請者')
    stamp = datetime.datetime.now().strftime('%Y%m%d')
    folder = os.path.join(OUTPUT_ROOT, f"{stamp}_【{digits8}】{applicant}")
    os.makedirs(folder, exist_ok=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    prefix = f"【{digits8}】{applicant}"

    res = {'folder': folder}

    # 1) 表紙
    cover = dict(data.get('cover') or {})
    cover.setdefault('dealerName', data.get('dealerName'))
    cover_xlsx = os.path.join(folder, f"{prefix}_書類確認書.xlsx")
    cover_pdf = os.path.join(WORK_DIR, f"cover_{threading.get_ident()}.pdf")
    build_cover(cover, digits8, cover_xlsx, cover_pdf)
    res['cover_xlsx'] = cover_xlsx

    # 2) 所在図・配置図
    sozai_xdw = os.path.join(folder, f"{prefix}_所在図.xdw")
    haichi_xdw = os.path.join(folder, f"{prefix}_配置図.xdw")
    sozai_pdf = os.path.join(WORK_DIR, f"sozai_out_{threading.get_ident()}.pdf")
    haichi_pdf = os.path.join(WORK_DIR, f"haichi_out_{threading.get_ident()}.pdf")
    build_dw_page('sozai', data, b64_to_bytes(data.get('sozaiPng')), sozai_xdw, sozai_pdf)
    build_dw_page('haichi', data, b64_to_bytes(data.get('haichiPng')), haichi_xdw, haichi_pdf)
    res['sozai_xdw'] = sozai_xdw
    res['haichi_xdw'] = haichi_xdw

    # 3) 結合（表紙 → 依頼書 → 所在図 → 配置図）
    final = fitz.open()
    with fitz.open(cover_pdf) as d:
        final.insert_pdf(d, from_page=0, to_page=0)

    req = data.get('request') or {}
    req_count = 0
    if req.get('path') and os.path.exists(req['path']) and req.get('pages'):
        src_pages = load_request_pages(req['path'], dpi=200)
        for sel in req['pages']:
            idx = int(sel.get('index', 0))
            if 0 <= idx < len(src_pages):
                im = process_request_page(src_pages[idx], sel.get('rotate', 0), req.get('ear'))
                append_image_page(final, im)
                req_count += 1
    res['request_pages'] = req_count

    for p in (sozai_pdf, haichi_pdf):
        with fitz.open(p) as d:
            final.insert_pdf(d)

    final_pdf = os.path.join(folder, f"{prefix}_送付用.pdf")
    final.save(final_pdf, garbage=4, deflate=True)
    final.close()
    res['pdf'] = final_pdf
    res['pdf_size'] = os.path.getsize(final_pdf)
    res['pages'] = 1 + req_count + 2

    for p in (cover_pdf, sozai_pdf, haichi_pdf):
        try:
            os.remove(p)
        except OSError:
            pass
    return res


def check_environment():
    issues = []
    for p, label in ((TPL_SOZAI, '所在図テンプレート'), (TPL_HAICHI, '配置図テンプレート'), (TPL_COVER, '表紙テンプレート')):
        if not os.path.exists(p):
            issues.append(f'{label}がありません: {p}')
    try:
        import xdwlib  # noqa: F401
    except Exception as e:
        issues.append(f'DocuWorks API(xdwlib)が使えません: {e}')
    try:
        import win32com.client  # noqa: F401
    except Exception as e:
        issues.append(f'Excel連携(pywin32)が使えません: {e}')
    return issues
