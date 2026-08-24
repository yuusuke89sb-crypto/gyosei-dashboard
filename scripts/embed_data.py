import json
import re

with open(r"d:\行政書士\開業\gyosei-dashboard\data\dealer_invoices_5_6_7.json", "r", encoding="utf-8") as f:
    json_data = f.read()

with open(r"d:\行政書士\開業\gyosei-dashboard\ディーラー月次請求書_集計レポート_5月-7月.html", "r", encoding="utf-8") as f:
    html_content = f.read()

replacement = f"let rawRecords = {json_data}['records'];"
html_content = html_content.replace("let rawRecords = [];", replacement)

with open(r"d:\行政書士\開業\gyosei-dashboard\ディーラー月次請求書_集計レポート_5月-7月.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("Embedded data into HTML report successfully.")
