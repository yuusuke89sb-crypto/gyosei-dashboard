import json
import csv
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 5月度 (18店舗)
data_5 = [
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮店", "cases_count": 63, "reward_ex": 268500, "tax": 26850, "reward_in": 295350, "advance": 47250, "grand_total": 342600},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢天池店", "cases_count": 62, "reward_ex": 226500, "tax": 22650, "reward_in": 249150, "advance": 64610, "grand_total": 313760},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "江南店", "cases_count": 42, "reward_ex": 165000, "tax": 16500, "reward_in": 181500, "advance": 14550, "grand_total": 196050},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮三条店", "cases_count": 26, "reward_ex": 140000, "tax": 14000, "reward_in": 154000, "advance": 11500, "grand_total": 165500},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "昭和橋店", "cases_count": 31, "reward_ex": 127000, "tax": 12700, "reward_in": 139700, "advance": 2300, "grand_total": 142000},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮開明店", "cases_count": 28, "reward_ex": 111500, "tax": 11150, "reward_in": 122650, "advance": 13900, "grand_total": 136550},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧村中店", "cases_count": 19, "reward_ex": 76500, "tax": 7650, "reward_in": 84150, "advance": 2300, "grand_total": 86450},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西店", "cases_count": 13, "reward_ex": 71000, "tax": 7100, "reward_in": 78100, "advance": 9000, "grand_total": 87100},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北名古屋店", "cases_count": 13, "reward_ex": 58500, "tax": 5850, "reward_in": 64350, "advance": 2400, "grand_total": 66750},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "キャラット小牧店", "cases_count": 10, "reward_ex": 50000, "tax": 5000, "reward_in": 55000, "advance": 0, "grand_total": 55000},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢おりづマイカー", "cases_count": 7, "reward_ex": 35000, "tax": 3500, "reward_in": 38500, "advance": 0, "grand_total": 38500},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧南インター店", "cases_count": 4, "reward_ex": 23000, "tax": 2300, "reward_in": 25300, "advance": 0, "grand_total": 25300},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "蟹江店", "cases_count": 3, "reward_ex": 21000, "tax": 2100, "reward_in": 23100, "advance": 700, "grand_total": 23800},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北店", "cases_count": 4, "reward_ex": 20000, "tax": 2000, "reward_in": 22000, "advance": 0, "grand_total": 22000},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮インター店", "cases_count": 2, "reward_ex": 19000, "tax": 1900, "reward_in": 20900, "advance": 0, "grand_total": 20900},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "津島店", "cases_count": 2, "reward_ex": 10000, "tax": 1000, "reward_in": 11000, "advance": 0, "grand_total": 11000},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小田井店", "cases_count": 2, "reward_ex": 8500, "tax": 850, "reward_in": 9350, "advance": 0, "grand_total": 9350},
    {"month": "2026-05", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西春店", "cases_count": 1, "reward_ex": 7000, "tax": 700, "reward_in": 7700, "advance": 0, "grand_total": 7700}
]

# 6月度 (18店舗)
data_6 = [
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮店", "cases_count": 122, "reward_ex": 470000, "tax": 47000, "reward_in": 517000, "advance": 54120, "grand_total": 571120},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "江南店", "cases_count": 84, "reward_ex": 342000, "tax": 34200, "reward_in": 376200, "advance": 17880, "grand_total": 394080},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢天池店", "cases_count": 78, "reward_ex": 311500, "tax": 31150, "reward_in": 342650, "advance": 29260, "grand_total": 371910},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "昭和橋店", "cases_count": 47, "reward_ex": 228000, "tax": 22800, "reward_in": 250800, "advance": 24770, "grand_total": 275570},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮開明店", "cases_count": 47, "reward_ex": 179000, "tax": 17900, "reward_in": 196900, "advance": 9880, "grand_total": 206780},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧村中店", "cases_count": 32, "reward_ex": 156000, "tax": 15600, "reward_in": 171600, "advance": 14500, "grand_total": 186100},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西店", "cases_count": 23, "reward_ex": 115500, "tax": 11550, "reward_in": 127050, "advance": 12630, "grand_total": 139680},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮三条店", "cases_count": 29, "reward_ex": 114500, "tax": 11450, "reward_in": 125950, "advance": 9950, "grand_total": 135900},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "キャラット小牧店", "cases_count": 19, "reward_ex": 95000, "tax": 9500, "reward_in": 104500, "advance": 0, "grand_total": 104500},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧南インター店", "cases_count": 20, "reward_ex": 82000, "tax": 8200, "reward_in": 90200, "advance": 5590, "grand_total": 95790},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北名古屋店", "cases_count": 14, "reward_ex": 55000, "tax": 5500, "reward_in": 60500, "advance": 0, "grand_total": 60500},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢おりづマイカー", "cases_count": 10, "reward_ex": 52000, "tax": 5200, "reward_in": 57200, "advance": 0, "grand_total": 57200},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮インター店", "cases_count": 10, "reward_ex": 43000, "tax": 4300, "reward_in": 47300, "advance": 12860, "grand_total": 60160},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西春店", "cases_count": 4, "reward_ex": 33000, "tax": 3300, "reward_in": 36300, "advance": 6900, "grand_total": 43200},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小田井店", "cases_count": 4, "reward_ex": 26000, "tax": 2600, "reward_in": 28600, "advance": 0, "grand_total": 28600},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北店", "cases_count": 5, "reward_ex": 25000, "tax": 2500, "reward_in": 27500, "advance": 0, "grand_total": 27500},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "蟹江店", "cases_count": 5, "reward_ex": 25000, "tax": 2500, "reward_in": 27500, "advance": 0, "grand_total": 27500},
    {"month": "2026-06", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "津島店", "cases_count": 1, "reward_ex": 5000, "tax": 500, "reward_in": 5500, "advance": 0, "grand_total": 5500}
]

# 7月度 (22店舗・拠点)
data_7 = [
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮店", "cases_count": 90, "reward_ex": 350000, "tax": 35000, "reward_in": 385000, "advance": 55430, "grand_total": 440430},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢天池店", "cases_count": 74, "reward_ex": 286500, "tax": 28650, "reward_in": 315150, "advance": 42530, "grand_total": 357680},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "江南店", "cases_count": 72, "reward_ex": 278000, "tax": 27800, "reward_in": 305800, "advance": 9200, "grand_total": 315000},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮開明店", "cases_count": 46, "reward_ex": 160500, "tax": 16050, "reward_in": 176550, "advance": 43380, "grand_total": 219930},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "昭和橋店", "cases_count": 29, "reward_ex": 137500, "tax": 13750, "reward_in": 151250, "advance": 16020, "grand_total": 167270},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮三条店", "cases_count": 32, "reward_ex": 127500, "tax": 12750, "reward_in": 140250, "advance": 9200, "grand_total": 149450},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小田井店", "cases_count": 27, "reward_ex": 119500, "tax": 11950, "reward_in": 131450, "advance": 6900, "grand_total": 138350},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西店", "cases_count": 24, "reward_ex": 106000, "tax": 10600, "reward_in": 116600, "advance": 9200, "grand_total": 125800},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "キャラット小牧店", "cases_count": 19, "reward_ex": 95000, "tax": 9500, "reward_in": 104500, "advance": 0, "grand_total": 104500},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧南インター店", "cases_count": 20, "reward_ex": 87000, "tax": 8700, "reward_in": 95700, "advance": 8480, "grand_total": 104180},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "西春店", "cases_count": 17, "reward_ex": 68000, "tax": 6800, "reward_in": 74800, "advance": 6900, "grand_total": 81700},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北名古屋店", "cases_count": 14, "reward_ex": 60000, "tax": 6000, "reward_in": 66000, "advance": 4600, "grand_total": 70600},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "小牧村中店", "cases_count": 13, "reward_ex": 52500, "tax": 5250, "reward_in": 57750, "advance": 2300, "grand_total": 60050},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "一宮インター店", "cases_count": 12, "reward_ex": 46000, "tax": 4600, "reward_in": 50600, "advance": 16290, "grand_total": 66890},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "稲沢おりづマイカー", "cases_count": 8, "reward_ex": 40000, "tax": 4000, "reward_in": 44000, "advance": 0, "grand_total": 44000},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "蟹江店", "cases_count": 3, "reward_ex": 18000, "tax": 1800, "reward_in": 19800, "advance": 0, "grand_total": 19800},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "津島店", "cases_count": 3, "reward_ex": 15000, "tax": 1500, "reward_in": 16500, "advance": 0, "grand_total": 16500},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "北店", "cases_count": 3, "reward_ex": 15000, "tax": 1500, "reward_in": 16500, "advance": 0, "grand_total": 16500},
    {"month": "2026-07", "group": "トヨタ", "client": "愛知トヨタWEST(株)", "store": "桜井店", "cases_count": 1, "reward_ex": 5000, "tax": 500, "reward_in": 5500, "advance": 0, "grand_total": 5500},
    {"month": "2026-07", "group": "三菱", "client": "三菱ふそうトラック・バス(株)", "store": "小牧支店", "cases_count": 25, "reward_ex": 158000, "tax": 15800, "reward_in": 173800, "advance": 97036, "grand_total": 270836},
    {"month": "2026-07", "group": "三菱", "client": "三菱ふそうトラック・バス(株)", "store": "岐阜支店", "cases_count": 4, "reward_ex": 27000, "tax": 2700, "reward_in": 29700, "advance": 9500, "grand_total": 39200},
    {"month": "2026-07", "group": "日産", "client": "日産愛知販売(株)", "store": "松降店", "cases_count": 22, "reward_ex": 129364, "tax": 12936, "reward_in": 142300, "advance": 93170, "grand_total": 235470}
]

all_records = data_5 + data_6 + data_7

tot_cases_5 = sum(x["cases_count"] for x in data_5)
tot_cases_6 = sum(x["cases_count"] for x in data_6)
tot_cases_7 = sum(x["cases_count"] for x in data_7)
grand_cases = tot_cases_5 + tot_cases_6 + tot_cases_7

print(f"5月総件数: {tot_cases_5} 件")
print(f"6月総件数: {tot_cases_6} 件")
print(f"7月総件数: {tot_cases_7} 件")
print(f"3ヶ月総件数: {grand_cases} 件")

out_dir = r"d:\行政書士\開業\gyosei-dashboard\data"
os.makedirs(out_dir, exist_ok=True)

# Save JSON
with open(os.path.join(out_dir, "dealer_invoices_5_6_7.json"), "w", encoding="utf-8") as f:
    json.dump({
        "records": all_records,
        "summary": {
            "2026-05": {"cases_count": tot_cases_5, "reward_ex": sum(x["reward_ex"] for x in data_5), "tax": sum(x["tax"] for x in data_5), "reward_in": sum(x["reward_in"] for x in data_5), "advance": sum(x["advance"] for x in data_5), "grand_total": sum(x["grand_total"] for x in data_5)},
            "2026-06": {"cases_count": tot_cases_6, "reward_ex": sum(x["reward_ex"] for x in data_6), "tax": sum(x["tax"] for x in data_6), "reward_in": sum(x["reward_in"] for x in data_6), "advance": sum(x["advance"] for x in data_6), "grand_total": sum(x["grand_total"] for x in data_6)},
            "2026-07": {"cases_count": tot_cases_7, "reward_ex": sum(x["reward_ex"] for x in data_7), "tax": sum(x["tax"] for x in data_7), "reward_in": sum(x["reward_in"] for x in data_7), "advance": sum(x["advance"] for x in data_7), "grand_total": sum(x["grand_total"] for x in data_7)},
            "total": {"cases_count": grand_cases, "reward_ex": sum(x["reward_ex"] for x in all_records), "tax": sum(x["tax"] for x in all_records), "reward_in": sum(x["reward_in"] for x in all_records), "advance": sum(x["advance"] for x in all_records), "grand_total": sum(x["grand_total"] for x in all_records)}
        }
    }, f, ensure_ascii=False, indent=2)

# Save CSV
csv_path = os.path.join(out_dir, "dealer_invoices_2026_05_06_07.csv")
with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["month", "group", "client", "store", "cases_count", "reward_ex", "tax", "reward_in", "advance", "grand_total"])
    writer.writeheader()
    writer.writerows(all_records)

print("Updated data files created successfully!")
