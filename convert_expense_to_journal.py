import csv
import sys
import os
import glob

# フォルダ内の最新の経費明細ファイルを自動検出
csv_files = glob.glob(r'D:\行政書士\開業\gyosei-dashboard\経費明細*.csv')
if not csv_files:
    print("エラー: 経費明細*.csv ファイルが見つかりません。")
    sys.exit(1)

# 更新日時が一番新しいファイルを取得
input_file = max(csv_files, key=os.path.getmtime)
output_file = r'D:\行政書士\開業\gyosei-dashboard\仕訳.csv'

print(f"対象ファイル: {input_file}")

# 法人設立日: 2026年8月8日
ESTABLISHMENT_DATE = '2026/08/08'

header = [
    "取引No", "取引日", "借方勘定科目", "借方補助科目", "借方部門", "借方取引先",
    "借方税区分", "借方インボイス", "借方金額(円)", "借方税額",
    "貸方勘定科目", "貸方補助科目", "貸方部門", "貸方取引先",
    "貸方税区分", "貸方インボイス", "貸方金額(円)", "貸方税額", "摘要"
]

rows = [header]

with open(input_file, 'r', encoding='cp932') as f:
    reader = csv.DictReader(f)
    for i, r in enumerate(reader, start=1):
        # 日付: YYYY-MM-DD -> YYYY/MM/DD
        raw_date = r.get('日付', '').strip()
        date_str = raw_date.replace('-', '/')

        # 元の科目名と支払先
        original_item = r.get('借方勘定科目', '').strip() or r.get('経費科目', '').strip()
        payee = r.get('支払先・内容', '').strip()
        memo = r.get('メモ', '').strip()

        # 摘要欄: 【元の科目名】 支払先・内容 (メモ)
        if memo:
            summary = f"【{original_item}】 {payee}（{memo}）"
        else:
            summary = f"【{original_item}】 {payee}"

        # 勘定科目の厳密日付判定
        # 設立日（2026/08/08）以前 ➔ 「創立費」
        # 設立日（2026/08/08）以降 ➔ 「開業費」
        if date_str <= ESTABLISHMENT_DATE:
            debit_item = "創立費"
        else:
            debit_item = "開業費"

        # 金額
        try:
            amount_val = float(r.get('金額（税込）', '0'))
            amount = str(int(amount_val))
        except ValueError:
            amount = '0'

        # 税額
        tax_val = r.get('消費税額', '').strip()
        try:
            tax = str(int(float(tax_val))) if tax_val else '0'
        except ValueError:
            tax = '0'

        tax_class = r.get('税区分', '').strip()
        invoice = r.get('インボイス経過措置', '').strip()

        # 貸方科目: 役員借入金
        credit_item = "役員借入金"
        credit_tax_class = "対象外"

        row = [
            str(i),             # 取引No
            date_str,           # 取引日
            debit_item,         # 借方勘定科目 (創立費 or 開業費)
            "",                 # 借方補助科目
            "",                 # 借方部門
            "",                 # 借方取引先
            tax_class,          # 借方税区分
            invoice,            # 借方インボイス
            amount,             # 借方金額(円)
            tax,                # 借方税額
            credit_item,        # 貸方勘定科目
            "",                 # 貸方補助科目
            "",                 # 貸方部門
            "",                 # 貸方取引先
            credit_tax_class,   # 貸方税区分
            "",                 # 貸方インボイス
            amount,             # 貸方金額(円)
            "0",                # 貸方税額
            summary             # 摘要: 【通信費】 Google Asia...
        ]
        rows.append(row)

with open(output_file, 'w', encoding='cp932', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f"OK: {len(rows)-1}件の経費明細を {output_file} に出力しました。")
