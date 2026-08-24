"""
かんたんクラウド会計 取引先マスター CSV変換スクリプト
UTF-8のCSVをShift-JIS(CP932)に変換する

使い方:
  python convert_to_sjis.py 取引先マスタ_UTF8_2026-08-12.csv
  → 同じフォルダに「取引先マスタ_かんたんクラウド会計_2026-08-12.csv」が生成される
"""
import sys
import os
import re
from datetime import date

def convert(input_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 出力ファイル名を生成
    dir_name = os.path.dirname(input_path)
    today = date.today().isoformat()
    output_name = f'取引先マスタ_かんたんクラウド会計_{today}.csv'
    output_path = os.path.join(dir_name, output_name) if dir_name else output_name

    # Shift-JIS (CP932) で書き出し
    with open(output_path, 'wb') as f:
        f.write(content.encode('cp932'))

    print(f'変換完了: {output_path}')
    print(f'  行数: {len(content.strip().splitlines())}')
    print(f'  エンコード: Shift-JIS (CP932)')
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        # 引数なしの場合、同フォルダの最新UTF8ファイルを自動検出
        pattern = re.compile(r'取引先マスタ_UTF8_.*\.csv$')
        candidates = [f for f in os.listdir('.') if pattern.match(f)]
        if candidates:
            candidates.sort(reverse=True)
            input_file = candidates[0]
            print(f'自動検出: {input_file}')
            convert(input_file)
        else:
            print('使い方: python convert_to_sjis.py <UTF-8のCSVファイル>')
            sys.exit(1)
    else:
        convert(sys.argv[1])
