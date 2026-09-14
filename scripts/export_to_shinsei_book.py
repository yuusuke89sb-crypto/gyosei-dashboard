# -*- coding: utf-8 -*-
"""
車庫証明申請簿（R7(2025)年度）.xlsx へのダッシュボード完了案件（今月分: 2026-08-26〜）自動転記スクリプト
"""
import os
import sys
import shutil
import json
import re
import datetime
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from copy import copy

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

EXCEL_PATH = r"D:\行政書士\開業\gyosei-dashboard\請求書\車庫証明申請簿（R7(2025)年度）.xlsx"
DATA_PATH = r"C:\Users\yuusu\.gemini\antigravity-ide\brain\4898e3cc-8664-4464-adf9-08975979f6f1\scratch\all_data.json"
REPORT_OUTPUT = r"D:\行政書士\開業\gyosei-dashboard\scratch_export_report.txt"

# 店舗名正規化マッピング（トヨタ）
STORE_MAP = {
    '一宮店': 'ＡＴＷ一宮', '一宮': 'ＡＴＷ一宮',
    '江南店': 'ＡＴＷ江南', '江南': 'ＡＴＷ江南',
    '稲沢店': 'ＡＴＷ稲沢', '稲沢天池店': 'ＡＴＷ稲沢', '稲沢天池': 'ＡＴＷ稲沢', '稲沢': 'ＡＴＷ稲沢',
    '開明店': 'ＡＴＷ開明', '一宮開明店': 'ＡＴＷ開明', '開明': 'ＡＴＷ開明',
    '一宮三条店': 'ATW一宮三条', '三条店': 'ATW一宮三条', '三条': 'ATW一宮三条',
    '昭和橋店': 'ＡＴＷ昭和橋', '昭和橋': 'ＡＴＷ昭和橋',
    '西店': 'ＡＴＷ西', '西': 'ＡＴＷ西',
    '北名古屋店': 'ＡＴＷ北名古屋', '北名古屋': 'ＡＴＷ北名古屋',
    '小牧南インター店': 'ＡＴＷ小牧南インター', '小牧南インター': 'ＡＴＷ小牧南インター', '小牧南': 'ＡＴＷ小牧南インター',
    '小牧村中店': 'ＡＴＷ小牧村中', '小牧村中': 'ＡＴＷ小牧村中',
    '小田井店': 'ＡＴＷ小田井', '小田井': 'ＡＴＷ小田井',
    '西春店': 'ＡＴＷ西春', '西春': 'ＡＴＷ西春',
    'キャラット小牧店': 'キャラット小牧', 'キャラット小牧': 'キャラット小牧',
    'キャラット一宮店': 'キャラット一宮', 'キャラット一宮': 'キャラット一宮',
    '一宮インター店': '一宮インター', '一宮インター': '一宮インター',
    'おりづマイカーセンター': 'おりづマイカー', 'おりづマイカー': 'おりづマイカー', 'おりづ': 'おりづマイカー',
    '桜井店': '桜井', '桜井': '桜井',
    '津島店': '津島', '津島': '津島',
    '蟹江店': '蟹江', '蟹江': '蟹江',
    '北店': '北', '北': '北',
    '高辻店': '高辻', '高辻': '高辻',
    '中村店': '中村', '中村': '中村',
    '中店': '中', '中': '中',
}

def clean_police(name):
    if not name:
        return ''
    p = str(name).strip()
    p = p.replace('警察署', '').replace('署', '').strip()
    return p

def clean_store_toyota(raw_store, title):
    combined = (str(raw_store or '') + ' ' + str(title or '')).replace('愛知トヨタ', '').replace('WEST', '').strip()
    for key, val in STORE_MAP.items():
        if key in combined:
            return val
    # Fallback
    m = re.search(r'ATW([^\s　]+)', str(title or ''))
    if m:
        st = m.group(1)
        for key, val in STORE_MAP.items():
            if key in st:
                return val
        return f"ＡＴＷ{st}"
    return str(raw_store or 'ＡＴＷ').strip()

def clean_store_fuso(raw_store, title):
    combined = str(raw_store or '') + ' ' + str(title or '')
    if '岐阜' in combined:
        return '岐阜支店'
    if '小牧' in combined:
        return '小牧支店'
    return '小牧支店'

def clean_applicant(c):
    car_name = str(c.get('carName') or '').strip()
    if car_name and car_name != 'None':
        return car_name
    title = str(c.get('title') or '').strip()
    # Remove prefix like "ATW一宮　" or "三菱小牧　"
    m = re.sub(r'^(ATW|愛知トヨタ|三菱ふそう|三菱|日産)[^\s　]*[\s　]+', '', title)
    return m.strip() or title

def classify_dealer(c, customers):
    client = customers.get(c.get('clientId'), {})
    cl_name = client.get('name', '')
    title = str(c.get('title') or '')
    order_no = str(c.get('orderNo') or c.get('注文書№') or '')
    
    combined = (cl_name + ' ' + title).upper()
    if any(k in combined for k in ['トヨタ', 'ATW', 'キャラット', 'TOYOTA', 'WEST']) or re.match(r'^5\d{7}$', order_no):
        return 'トヨタ'
    if any(k in combined for k in ['三菱', 'ふそう', 'FUSO']) or order_no.startswith('A0'):
        return '三菱'
    return '日産・その他'

def main():
    report_lines = []
    def log(msg):
        print(msg)
        report_lines.append(msg)

    log("=== 車庫証明申請簿 自動転記処理開始 ===")

    # 1. バックアップ作成
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = EXCEL_PATH.replace(".xlsx", f"_backup_{ts}.xlsx")
    shutil.copy2(EXCEL_PATH, backup_path)
    log(f"✅ 元ファイルをバックアップしました:\n  -> {backup_path}")

    # 2. データ読み込み
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    cases = all_data.get('cases', [])
    customers = {c['id']: c for c in all_data.get('customers', [])}
    locations = {l['id']: l for l in all_data.get('locations', [])}
    client_contacts = {cc['id']: cc for cc in all_data.get('clientContacts', [])}

    log(f"案件総数: {len(cases)}件")

    # 3. 対象案件抽出 (status == 'done' & 日付 >= 2026-08-26)
    target_cases = []
    for c in cases:
        if c.get('status') != 'done':
            continue
        comp_date = (c.get('completedAt') or '')[:10]
        pol_deliv = (c.get('policeDeliveryDate') or '')[:10]
        store_deliv = (c.get('storeDeliveryDate') or '')[:10]
        apply_date = (c.get('applyDate') or '')[:10]
        created_date = (c.get('createdAt') or '')[:10]
        
        # 完了日付の決定
        date_str = comp_date or pol_deliv or store_deliv or apply_date or created_date
        if not date_str or date_str < '2026-08-26':
            continue

        c['_resolved_date'] = date_str
        c['_sheet_target'] = classify_dealer(c, customers)
        c['_client'] = customers.get(c.get('clientId'), {})
        c['_contact'] = client_contacts.get(c.get('clientContactId'), {})
        c['_loc'] = locations.get(c.get('policeLocationId') or c.get('locationId'), {})
        target_cases.append(c)

    log(f"転記対象件数 (完了 & 2026-08-26以降): {len(target_cases)}件")

    # 4. ソート: 完了日付昇順 -> 注文書No昇順
    target_cases.sort(key=lambda x: (
        x['_resolved_date'],
        str(x.get('orderNo') or x.get('注文書№') or '')
    ))

    # 5. シート別に振り分け
    toyota_list = [c for c in target_cases if c['_sheet_target'] == 'トヨタ']
    fuso_list = [c for c in target_cases if c['_sheet_target'] == '三菱']
    other_list = [c for c in target_cases if c['_sheet_target'] == '日産・その他']

    log(f"  ・トヨタシート対象: {len(toyota_list)}件")
    log(f"  ・三菱シート対象:   {len(fuso_list)}件")
    log(f"  ・その他シート対象: {len(other_list)}件")

    # 6. Excel 読み込み
    wb = openpyxl.load_workbook(EXCEL_PATH)

    # 共通フォント・スタイル定義
    font_main = Font(name="MS PGothic", size=12)
    font_oss = Font(name="MS PGothic", size=14)
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    align_center = Alignment(horizontal='center', vertical='center')
    align_left = Alignment(horizontal='left', vertical='center')
    align_right = Alignment(horizontal='right', vertical='center')

    # ──────────────────────────────────────────
    # A. トヨタ シートへの転記
    # ──────────────────────────────────────────
    ws_toyota = wb['トヨタ']
    
    # 既存の最大記入行を特定 (A列が空でない最終行)
    last_row_toyota = 2
    existing_orders_t = set()
    for r in range(4, ws_toyota.max_row + 1):
        v = ws_toyota.cell(r, 1).value
        ord_v = str(ws_toyota.cell(r, 2).value or '').strip()
        if v is not None and str(v).strip() != '':
            last_row_toyota = r
            if ord_v:
                existing_orders_t.add(ord_v)

    log(f"\n[トヨタ] 既存最終行: {last_row_toyota}行 (追記開始: {last_row_toyota + 1}行目〜)")

    added_toyota = 0
    skipped_toyota = 0
    cur_r = last_row_toyota + 1

    for c in toyota_list:
        ord_no = str(c.get('orderNo') or c.get('注文書№') or '').strip()
        d_val = datetime.date.fromisoformat(c['_resolved_date'])
        
        # 重複チェック (同一注文番号が既に存在すればスキップ)
        if ord_no and ord_no in existing_orders_t:
            skipped_toyota += 1
            continue

        app_name = clean_applicant(c)
        pol_name = clean_police(c.get('carPolice') or c['_loc'].get('name'))
        store_name = clean_store_toyota(c['_client'].get('name'), c.get('title'))
        contact_name = str(c['_contact'].get('name') or '').strip()
        cat = c.get('category', '')
        
        # OSS列の表記
        if cat == 'garage_oss':
            oss_str = '○'
        elif cat == 'garage_paper':
            oss_str = ''
        elif cat == 'seal':
            oss_str = '封印'
        elif cat == 'car_reg_standard':
            oss_str = '登録'
        elif cat == 'car_reg_light':
            oss_str = '軽'
        else:
            oss_str = ''

        # 1: 提出日
        cell_d = ws_toyota.cell(cur_r, 1, d_val)
        cell_d.number_format = r'[$-411]ge\.m\.d'
        cell_d.font = font_main
        cell_d.alignment = align_right
        cell_d.border = thin_border

        # 2: 注文No.
        cell_ord = ws_toyota.cell(cur_r, 2, ord_no)
        cell_ord.number_format = '@'
        cell_ord.font = font_main
        cell_ord.alignment = align_center
        cell_ord.border = thin_border

        # 3: 申請者名
        cell_app = ws_toyota.cell(cur_r, 3, app_name)
        cell_app.font = font_main
        cell_app.alignment = align_left
        cell_app.border = thin_border

        # 4: 管轄署
        cell_pol = ws_toyota.cell(cur_r, 4, pol_name)
        cell_pol.font = font_main
        cell_pol.alignment = align_center
        cell_pol.border = thin_border

        # 5: 提出者 (店舗)
        cell_st = ws_toyota.cell(cur_r, 5, store_name)
        cell_st.font = font_main
        cell_st.alignment = align_center
        cell_st.border = thin_border

        # 6: 担当
        cell_cnt = ws_toyota.cell(cur_r, 6, contact_name)
        cell_cnt.font = font_main
        cell_cnt.alignment = align_center
        cell_cnt.border = thin_border

        # 7: ＯＳＳ
        cell_oss = ws_toyota.cell(cur_r, 7, oss_str)
        cell_oss.font = font_oss
        cell_oss.alignment = align_center
        cell_oss.border = thin_border

        # 8〜11: 依頼先・代行料・県証紙・連絡先
        for col_idx in range(8, 12):
            cell_extra = ws_toyota.cell(cur_r, col_idx, None)
            cell_extra.font = font_main
            cell_extra.border = thin_border

        existing_orders_t.add(ord_no)
        cur_r += 1
        added_toyota += 1

    log(f"  -> トヨタ追記完了: {added_toyota}件 (重複スキップ: {skipped_toyota}件, 終了行: {cur_r - 1}行)")

    # ──────────────────────────────────────────
    # B. 三菱 シートへの転記
    # 列順: 1:提出日, 2:申請者名, 3:管轄署, 4:注文No., 5:提出者, 6:担当, 7:ＯＳＳ...
    # ──────────────────────────────────────────
    ws_fuso = wb['三菱']
    
    last_row_fuso = 1
    existing_orders_f = set()
    for r in range(3, ws_fuso.max_row + 1):
        v = ws_fuso.cell(r, 1).value
        ord_v = str(ws_fuso.cell(r, 4).value or '').strip()
        if v is not None and str(v).strip() != '':
            last_row_fuso = r
            if ord_v:
                existing_orders_f.add(ord_v)

    log(f"\n[三菱] 既存最終行: {last_row_fuso}行 (追記開始: {last_row_fuso + 1}行目〜)")

    added_fuso = 0
    skipped_fuso = 0
    cur_r_f = last_row_fuso + 1

    for c in fuso_list:
        ord_no = str(c.get('orderNo') or c.get('注文書№') or '').strip()
        d_val = datetime.date.fromisoformat(c['_resolved_date'])

        if ord_no and ord_no in existing_orders_f:
            skipped_fuso += 1
            continue

        app_name = clean_applicant(c)
        pol_name = clean_police(c.get('carPolice') or c['_loc'].get('name'))
        store_name = clean_store_fuso(c['_client'].get('name'), c.get('title'))
        contact_name = str(c['_contact'].get('name') or '').strip()
        cat = c.get('category', '')

        oss_str = '封印' if cat == 'seal' else ('登録' if cat == 'car_reg_standard' else '')

        # 1: 提出日
        cell_d = ws_fuso.cell(cur_r_f, 1, d_val)
        cell_d.number_format = r'[$-411]ge\.m\.d'
        cell_d.font = font_main
        cell_d.alignment = align_right
        cell_d.border = thin_border

        # 2: 申請者名
        cell_app = ws_fuso.cell(cur_r_f, 2, app_name)
        cell_app.font = font_main
        cell_app.alignment = align_left
        cell_app.border = thin_border

        # 3: 管轄署
        cell_pol = ws_fuso.cell(cur_r_f, 3, pol_name)
        cell_pol.font = font_main
        cell_pol.alignment = align_center
        cell_pol.border = thin_border

        # 4: 注文No.
        cell_ord = ws_fuso.cell(cur_r_f, 4, ord_no)
        cell_ord.number_format = '@'
        cell_ord.font = font_main
        cell_ord.alignment = align_center
        cell_ord.border = thin_border

        # 5: 提出者 (支店)
        cell_st = ws_fuso.cell(cur_r_f, 5, store_name)
        cell_st.font = font_main
        cell_st.alignment = align_center
        cell_st.border = thin_border

        # 6: 担当
        cell_cnt = ws_fuso.cell(cur_r_f, 6, contact_name)
        cell_cnt.font = font_main
        cell_cnt.alignment = align_center
        cell_cnt.border = thin_border

        # 7: ＯＳＳ
        cell_oss = ws_fuso.cell(cur_r_f, 7, oss_str)
        cell_oss.font = font_oss
        cell_oss.alignment = align_center
        cell_oss.border = thin_border

        # 8〜11
        for col_idx in range(8, 12):
            cell_extra = ws_fuso.cell(cur_r_f, col_idx, None)
            cell_extra.font = font_main
            cell_extra.border = thin_border

        existing_orders_f.add(ord_no)
        cur_r_f += 1
        added_fuso += 1

    log(f"  -> 三菱追記完了: {added_fuso}件 (重複スキップ: {skipped_fuso}件, 終了行: {cur_r_f - 1}行)")

    # ──────────────────────────────────────────
    # C. 日産・その他 シートへの転記
    # 既存の「Sheet2」を「日産・その他」に改名してヘッダーを設定
    # ──────────────────────────────────────────
    other_sheet_name = '日産・その他'
    if other_sheet_name in wb.sheetnames:
        ws_other = wb[other_sheet_name]
    elif 'Sheet2' in wb.sheetnames:
        ws_other = wb['Sheet2']
        ws_other.title = other_sheet_name
    else:
        ws_other = wb.create_sheet(title=other_sheet_name)

    # ヘッダー設置 (Row 2に設定)
    headers = ['提出日', '注文No.', '申 請 者 名', '管轄署', '提出者', '担当', 'ＯＳＳ', '依頼先', '代行料', '県証紙', '連絡先']
    header_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    font_header = Font(name="MS PGothic", size=11, bold=True)
    
    for col_idx, h_text in enumerate(headers, 1):
        cell_h = ws_other.cell(2, col_idx, h_text)
        cell_h.font = font_header
        cell_h.alignment = align_center
        cell_h.fill = header_fill
        cell_h.border = thin_border

    # 列幅設定
    col_widths = {1: 13, 2: 14, 3: 25, 4: 12, 5: 20, 6: 12, 7: 8, 8: 15, 9: 12, 10: 12, 11: 15}
    for col_idx, width in col_widths.items():
        ws_other.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    cur_r_o = 3
    added_other = 0

    for c in other_list:
        ord_no = str(c.get('orderNo') or c.get('注文書№') or '').strip()
        d_val = datetime.date.fromisoformat(c['_resolved_date'])
        app_name = clean_applicant(c)
        pol_name = clean_police(c.get('carPolice') or c['_loc'].get('name'))
        store_name = str(c['_client'].get('name') or c.get('title') or '').strip()
        contact_name = str(c['_contact'].get('name') or '').strip()
        cat = c.get('category', '')
        
        if cat == 'garage_oss':
            oss_str = '○'
        elif cat == 'seal':
            oss_str = '封印'
        elif cat == 'car_reg_standard':
            oss_str = '登録'
        elif cat == 'car_reg_light':
            oss_str = '軽'
        else:
            oss_str = ''

        cell_d = ws_other.cell(cur_r_o, 1, d_val)
        cell_d.number_format = r'[$-411]ge\.m\.d'
        cell_d.font = font_main
        cell_d.alignment = align_right
        cell_d.border = thin_border

        cell_ord = ws_other.cell(cur_r_o, 2, ord_no)
        cell_ord.number_format = '@'
        cell_ord.font = font_main
        cell_ord.alignment = align_center
        cell_ord.border = thin_border

        cell_app = ws_other.cell(cur_r_o, 3, app_name)
        cell_app.font = font_main
        cell_app.alignment = align_left
        cell_app.border = thin_border

        cell_pol = ws_other.cell(cur_r_o, 4, pol_name)
        cell_pol.font = font_main
        cell_pol.alignment = align_center
        cell_pol.border = thin_border

        cell_st = ws_other.cell(cur_r_o, 5, store_name)
        cell_st.font = font_main
        cell_st.alignment = align_center
        cell_st.border = thin_border

        cell_cnt = ws_other.cell(cur_r_o, 6, contact_name)
        cell_cnt.font = font_main
        cell_cnt.alignment = align_center
        cell_cnt.border = thin_border

        cell_oss = ws_other.cell(cur_r_o, 7, oss_str)
        cell_oss.font = font_oss
        cell_oss.alignment = align_center
        cell_oss.border = thin_border

        for col_idx in range(8, 12):
            cell_extra = ws_other.cell(cur_r_o, col_idx, None)
            cell_extra.font = font_main
            cell_extra.border = thin_border

        cur_r_o += 1
        added_other += 1

    log(f"\n[日産・その他] シート作成・追記完了: {added_other}件 (行番号: 3〜{cur_r_o - 1}行)")

    # 7. 保存
    wb.save(EXCEL_PATH)
    log(f"\n🎉 転記完了！Excelファイルを上書き保存しました:\n  -> {EXCEL_PATH}")

    total_added = added_toyota + added_fuso + added_other
    log(f"合計追記件数: {total_added}件")

    with open(REPORT_OUTPUT, "w", encoding="utf-8") as rf:
        rf.write("\n".join(report_lines))

if __name__ == '__main__':
    main()
