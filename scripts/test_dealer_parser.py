import re

def parse_dealer_document(text, metadata=None):
    if metadata is None: metadata = {}
    raw_text = text + "\n" + metadata.get("subject", "") + "\n" + metadata.get("body", "") + "\n" + metadata.get("sender", "")
    clean_text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

    result = {
        "orderNo": "",
        "isOss": False,
        "applicationType": "一般",
        "dealerName": "",
        "branchName": "",
        "storeFullName": "",
        "staffName": "",
        "staffPhone": "",
        "receivedDate": "",
        "applicantName": "",
        "applicantFurigana": "",
        "applicantPostal": "",
        "applicantAddress": "",
        "applicantPhone": "",
        "garageAddress": "",
        "carName": "",
        "carModel": "",
        "vin": "",
        "registrationNo": "",
        "replaceCar": "",
        "targetDeliveryDate": "",
        "suggestedTitle": "",
        "category": "車庫証明"
    }

    # 1. 注文No
    m = re.search(r'注文(?:NO|No|№|番号|コード)?\s*[:：]?\s*([5-9]\d{7})|\b([5-9]\d{7})\b', clean_text, re.IGNORECASE)
    if m: result["orderNo"] = m.group(1) or m.group(2)

    # 2. OSS判定
    if re.search(r'☑\s*OSS|\[x\]\s*OSS|【x】\s*OSS|■\s*OSS|レ\s*OSS', clean_text, re.IGNORECASE) or ("OSS" in clean_text and not re.search(r'☑\s*一般|\[x\]\s*一般', clean_text, re.IGNORECASE) and clean_text.count("OSS") >= 1):
        if re.search(r'☑\s*一般|\[x\]\s*一般', clean_text, re.IGNORECASE):
            result["isOss"] = False
            result["applicationType"] = "一般"
        else:
            result["isOss"] = True
            result["applicationType"] = "OSS"
    elif re.search(r'☑\s*一般|\[x\]\s*一般|■\s*一般', clean_text, re.IGNORECASE):
        result["isOss"] = False
        result["applicationType"] = "一般"
    elif "OSS" in clean_text:
        result["isOss"] = True
        result["applicationType"] = "OSS"

    # 3. ディーラー名・店舗名
    dealers = [
        ("愛知トヨタWEST", "愛知トヨタWEST株式会社"),
        ("愛知トヨタ", "愛知トヨタ自動車株式会社"),
        ("三菱ふそう", "三菱ふそうトラック・バス株式会社"),
        ("日産愛知", "日産愛知自動車販売株式会社"),
        ("オートステージM", "有限会社 オートステージM")
    ]
    for k, v in dealers:
        if k in clean_text:
            result["dealerName"] = v
            break

    known_branches = ['一宮店', '一宮三条店', '小牧村中店', '西春店', '津島店', '稲沢店', '江南店', '春日井店', '尾張旭店', '小牧店', '清須店']
    for br in known_branches:
        if br in clean_text:
            result["branchName"] = br
            break
    
    if result["dealerName"] or result["branchName"]:
        d_short = "愛知トヨタWEST" if "WEST" in result["dealerName"] else re.sub(r'株式会社|有限会社|\(株\)|\(有\)', '', result["dealerName"]).strip()
        result["storeFullName"] = f"{d_short} {result['branchName']}".strip()

    # 4. 担当者
    st_match = re.search(r'担当者名?\s*[:：]?\s*([^\s\n\d\(\)（）:：]{1,6}(?:\s+[^\s\n\d\(\)（）:：]{1,6})?)', clean_text)
    if st_match:
        st = re.sub(r'様|殿|係|携帯|TEL|連絡先', '', st_match.group(1)).strip()
        if len(st) >= 2 and st not in ['株式会社', '有限会社', '依頼書', '日来行政書士', '御中']:
            result["staffName"] = st

    ph_match = re.search(r'(?:連絡先|携帯|TEL|電話番号|担当携帯)?\s*[:：]?\s*(0[789]0[-ー\s]?\d{4}[-ー\s]?\d{4}|0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{4})', clean_text)
    if ph_match:
        result["staffPhone"] = re.sub(r'[\sー]', '-', ph_match.group(1))

    # 5. 受付日
    dt_match = re.search(r'(?:提出日|受付日|依頼日|日付)\s*[:：]?\s*([R令和H平成\d]{1,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', clean_text)
    if dt_match:
        y, m, d = dt_match.group(1), dt_match.group(2).zfill(2), dt_match.group(3).zfill(2)
        if "R" in y or "令和" in y or y == "8":
            r_num = int(re.sub(r'[^\d]', '', y)) if re.sub(r'[^\d]', '', y) else 8
            y = str(2018 + r_num)
        elif len(y) <= 2:
            y = str(2018 + int(y))
        result["receivedDate"] = f"{y}-{m}-{d}"

    # 6. 申請者
    app_match = re.search(r'(?:申請者|使用者(?:の氏名又は名称)?|氏名\s*(?:※1)?)\s*[:：]?\s*(?:氏名\s*(?:※1)?\s*[:：]?\s*)?([^\n\r]{2,40})', clean_text)
    if app_match:
        name = app_match.group(1).strip()
        name = re.sub(r'^(?:氏名\s*(?:※1)?|申請者名?|使用者名?)\s*[:：]?\s*', '', name).strip()
        name = re.sub(r'(フリガナ|電話番号|住所|生年月日|同上).*$', '', name).strip()
        if name and name not in ['トヨタ', 'ダイハツ', '日産', '同上', '日来行政書士事務所', '愛知トヨタ']:
            result["applicantName"] = name

    furi_match = re.search(r'フリガナ\s*[:：]?\s*([ァ-ンヴー\s\(\)（）]+)', clean_text)
    if furi_match:
        result["applicantFurigana"] = furi_match.group(1).strip()

    # 7. 住所
    post_match = re.search(r'〒\s*([0-9]{3})[-ー\s]?([0-9]{4})|(?<![\d\-])([1-9][0-9]{2})[-ー]([0-9]{4})(?![\d\-])', clean_text)
    if post_match:
        p1 = post_match.group(1) or post_match.group(3)
        p2 = post_match.group(2) or post_match.group(4)
        result["applicantPostal"] = f"{p1}-{p2}"

    addr_line_match = re.search(r'(?:住所|使用の本拠|本拠の位置|使用者の住所)\s*[:：]?\s*([^\n\r]+)', clean_text)
    if addr_line_match:
        addr = addr_line_match.group(1).strip()
        addr = re.sub(r'^〒?\s*\d{3}[-ー]?\d{4}\s*', '', addr)
        addr = re.sub(r'(電話番号|生年月日|使用の本拠|保管場所).*$', '', addr).strip()
        if addr and len(addr) >= 3 and addr not in ['同上', '※1']:
            result["applicantAddress"] = addr

    if not result["applicantAddress"]:
        fallback_addr = re.search(r'((?:愛知県|岐阜県|三重県|滋賀県|静岡県|東京都)?[^\n\r]{2,8}(?:市|郡|区|町|村)[^\n\r]{2,30}[\d０-９一-九]+(?:番地?|丁目|号|-[\d０-９]+)?)', clean_text)
        if fallback_addr:
            result["applicantAddress"] = fallback_addr.group(1).strip()

    # 車両
    car_match = re.search(r'車名\s*[:：]?\s*([^\s\n\r]{2,10})|(トヨタ|ダイハツ|日産|ホンダ|スズキ|マツダ|スバル|三菱|レクサス|ふそう)', clean_text, re.IGNORECASE)
    if car_match:
        result["carName"] = (car_match.group(1) or car_match.group(2)).strip()

    model_match = re.search(r'型式\s*[:：]?\s*([0-9A-Z]{2,4}-[0-9A-Z]{4,10})|(?<![\d\-])([0-9][A-Z]{1,3}-[0-9A-Z]{4,10}|[A-Z]{2,4}-[0-9A-Z]{4,10})\b', clean_text, re.IGNORECASE)
    if model_match:
        result["carModel"] = (model_match.group(1) or model_match.group(2)).upper()

    vin_match = re.search(r'車台番号\s*[:：]?\s*([0-9A-Z]+-[0-9A-Z]*)', clean_text, re.IGNORECASE)
    if vin_match:
        result["vin"] = vin_match.group(1).upper()

    # 推奨タイトル
    store_lbl = result["storeFullName"] or result["dealerName"] or "ディーラー"
    app_lbl = f" ({result['applicantName']} 様)" if result["applicantName"] else ""
    oss_tag = "[OSS]" if result["isOss"] else ""
    order_tag = f" - 注文No:{result['orderNo']}" if result["orderNo"] else ""
    result["suggestedTitle"] = f"{store_lbl}{app_lbl} - 車庫証明{oss_tag}{order_tag}"

    return result

samples = [
    ("Sample 1: 陸田様 / 一宮店 / OSS", """
2026年 8月25日 13時33分 愛知トヨタWEST 一宮店 NO.7766 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 一宮店
提出日 R8 年 8 月 22 日
注文NO 57360875
担当者名 伊藤 弘騎
連絡先 090-4212-1350
申請者 氏名 陸田 正明 フリガナ ムツダ マサアキ
住所 〒491-0924 一宮市大和町於保字二之宮42-1
電話番号 090-3933-6214 生年月日 S38 年 7 月 13 日
車両概要 トヨタ 6AA-MXPL10G 車台番号 MXPL10-
代替有 ウィッシュ (登録番号) 一宮 530そ1037
"""),
    ("Sample 2: 西濃建設様 / 一宮三条店 / 一般", """
26-08-25:01:40PM; 愛知トヨタ 一宮三条店 -> 田中さん(日来行政書士事務所) ; 0586615556 # 1/ 4
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☐ OSS ・ ☑ 一般
会社名 愛知トヨタWEST株式会社
店名 一宮三条店
提出日 2026 年 8 月 25 日
注文NO 57680161
担当者名 関 凌太朗
連絡先 080-5013-1474
申請者 氏名 西濃建設 株式会社 代表取締役社長 宗宮 郷 フリガナ セイノウケンセツ(カブ)
住所 〒501-0618 揖斐郡揖斐川町上三野128番地
電話番号 0585-22-1221
車両概要 トヨタ 3BE-NCP165V 車台番号 NCP165- 新規
"""),
    ("Sample 3: 児玉様 / オートステージM / 送付状+車検証", """
2026年 8月25日 14時38分 オートステージM NO.2861 P. 1
FAX送付のご案内
有限会社 オートステージM
TEL 0584-821655 FAX 0584-81-817
田中様
児玉 様ご依頼の
車種 ハイゼットT 4WD CVT ジャンボスタンダード
車検証をFAXさせて頂きました
手続きの方よろしくお願いします。
納車日は 9/4 午前を予定しております。

自動車検査証記録事項
車両番号 岐阜 483 い 9829
車台番号 S510P-0705500
使用者の氏名又は名称 児玉 一男
使用者の住所 岐阜県安八郡神戸町丈六道406
車名 ダイハツ 型式 3BD-S510P
"""),
    ("Sample 4: 寺澤様 / 小牧村中店 / OSS", """
2026年 8月25日 14時29分 愛知トヨタ 小牧村中店 NO.1718 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 小牧村中店
提出日 令和8 年 8 月 25 日
注文NO 56273129
担当者名 纐纈 健人
申請者 氏名 寺澤 僚 フリガナ テラザワ リョウ
住所 〒483-8044 江南市宮後町向エ80番地
電話番号 080-4962-8425 生年月日 H7 年 3 月 21 日
車両概要 トヨタ 6AA-ZWR90W 車台番号 ZWR90-
代替有 フィット (登録番号) 尾張小牧503た4903
"""),
    ("Sample 5: 渡邉様 / 西春店 / OSS", """
2026年 8月25日 14時48分 愛知トヨタ 西春店 NO.3873 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 西春店
提出日 2026年 8月 25日
注文NO 56695279
担当者名 中村 優貴
連絡先 090-7434-2989
申請者 氏名 渡邉 尚枝 フリガナ ワタナベ ナオエ
住所 〒481-0041 北名古屋市九之坪東ノ川20
電話番号 080-1558-1570 生年月日 S38 年 11 月 19 日
車両概要 トヨタ 6AA-MXPJ10 車台番号 MXPJ10-
代替有 RAIZE (登録番号) 尾張小牧503の4356
""")
]

import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== Testing Dealer Document Extraction ===")
for name, text in samples:
    res = parse_dealer_document(text)
    print(f"\n[{name}]")
    print(f"  店舗:       {res['storeFullName'] or res['dealerName']}")
    print(f"  担当者:     {res['staffName']} ({res['staffPhone'] or 'なし'})")
    print(f"  区分:       {res['applicationType']} (isOss={res['isOss']})")
    print(f"  注文No:     {res['orderNo']}")
    print(f"  受付日:     {res['receivedDate']}")
    print(f"  申請者:     {res['applicantName']} ({res['applicantFurigana'] or ''})")
    print(f"  住所:       〒{res['applicantPostal']} {res['applicantAddress']}")
    print(f"  車両:       {res['carName']} {res['carModel']} (VIN: {res['vin']})")
    print(f"  案件名:     {res['suggestedTitle']}")
