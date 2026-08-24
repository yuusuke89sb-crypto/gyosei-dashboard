"""
ディーラー各社・各店舗のデモ用案件データ生成および請求書サンプルHTML生成スクリプト
1. 愛知トヨタWEST（一宮店、西春店、稲沢天池店 等）
2. 三菱ふそう（小牧支店、岐阜支店）
3. 日産愛知（桜井店、松降店）

それぞれの様式（トヨタ様式、三菱ふそう様式、日産様式）でサンプル請求書を生成
"""
import json
import os
import datetime

# ─── サンプル顧客データ定義 ───
demo_clients = [
    {
        "id": "client_toyota_west_ichinomiya",
        "name": "愛知トヨタWEST株式会社 一宮店",
        "companyName": "愛知トヨタWEST株式会社",
        "tradeName": "一宮店",
        "type": "法人",
        "phone": "0586-71-2211",
        "fax": "0586-71-2215",
        "zip": "491-0831",
        "address": "愛知県一宮市森本2-1-1",
        "memo": "愛知トヨタWEST専用様式（OSS/紙/封印区分）"
    },
    {
        "id": "client_toyota_west_nishiharu",
        "name": "愛知トヨタWEST株式会社 西春店",
        "companyName": "愛知トヨタWEST株式会社",
        "tradeName": "西春店",
        "type": "法人",
        "phone": "0568-23-3161",
        "fax": "0568-23-3165",
        "zip": "481-0033",
        "address": "愛知県北名古屋市西春町...",
        "memo": "愛知トヨタWEST専用様式"
    },
    {
        "id": "client_fuso_komaki",
        "name": "三菱ふそうトラック・バス株式会社 小牧支店",
        "companyName": "三菱ふそうトラック・バス株式会社",
        "tradeName": "小牧支店",
        "type": "法人",
        "phone": "0568-77-1111",
        "fax": "0568-77-1115",
        "zip": "485-0045",
        "address": "愛知県小牧市...",
        "memo": "三菱ふそう専用様式（印紙・証紙・手数料区分）"
    },
    {
        "id": "client_nissan_sakurai",
        "name": "日産愛知自動車販売株式会社 桜井店",
        "companyName": "日産愛知自動車販売株式会社",
        "tradeName": "桜井店",
        "type": "法人",
        "phone": "0566-99-1111",
        "fax": "0566-99-1115",
        "zip": "444-1154",
        "address": "愛知県安城市...",
        "memo": "日産愛知専用様式"
    }
]

# ─── サンプル案件データ定義 ───
demo_cases = [
    # 1. トヨタWEST 一宮店 (8月分 完了案件)
    {
        "id": "case_toyota_01",
        "clientId": "client_toyota_west_ichinomiya",
        "title": "車庫証明(OSS) - トヨタ プリウス (山田太郎 様)",
        "category": "garage_oss",
        "status": "done",
        "fee": 5500,
        "completedAt": "2026-08-10",
        "carNumber": "一宮500自1234",
        "vin": "MXWH60-1002345",
        "customerName": "山田 太郎",
        "advances": [{"name": "保管場所標章交付手数料", "amount": 500, "category": "stamp"}]
    },
    {
        "id": "case_toyota_02",
        "clientId": "client_toyota_west_ichinomiya",
        "title": "車庫証明(紙) - トヨタ クラウン (佐藤一郎 様)",
        "category": "garage_paper",
        "status": "done",
        "fee": 7000,
        "completedAt": "2026-08-12",
        "carNumber": "名古屋300さ5678",
        "vin": "TZSH35-2005678",
        "customerName": "佐藤 一郎",
        "advances": [
            {"name": "申請手数料（愛知県証紙）", "amount": 2200, "category": "stamp"},
            {"name": "標章交付手数料", "amount": 500, "category": "stamp"}
        ]
    },
    {
        "id": "case_toyota_03",
        "clientId": "client_toyota_west_ichinomiya",
        "title": "普通車登録＋出張封印 - ヴェルファイア (鈴木花子 様)",
        "category": "seal",
        "status": "done",
        "fee": 12000,
        "completedAt": "2026-08-18",
        "carNumber": "尾張小牧300ち9999",
        "vin": "TAHA40W-0019999",
        "customerName": "鈴木 花子",
        "advances": [
            {"name": "検査登録印紙代", "amount": 1800, "category": "stamp"},
            {"name": "ナンバープレート代", "amount": 1980, "category": "plate"}
        ]
    },

    # 2. 三菱ふそう 小牧支店 (8月分 完了案件)
    {
        "id": "case_fuso_01",
        "clientId": "client_fuso_komaki",
        "title": "大型トラック新規登録 - キャンター ((株)愛知物流 様)",
        "category": "car_reg_standard",
        "status": "done",
        "fee": 18000,
        "completedAt": "2026-08-08",
        "carNumber": "尾張小牧100か8888",
        "vin": "FEB70-5001234",
        "customerName": "株式会社愛知物流",
        "advances": [
            {"name": "自動車重量税印紙", "amount": 15000, "category": "tax"},
            {"name": "検査登録手数料", "amount": 2100, "category": "stamp"},
            {"name": "ナンバー代", "amount": 1980, "category": "plate"}
        ]
    },
    {
        "id": "case_fuso_02",
        "clientId": "client_fuso_komaki",
        "title": "出張封印 - ファイター (東海興業(株) 様)",
        "category": "seal",
        "status": "done",
        "fee": 15000,
        "completedAt": "2026-08-15",
        "carNumber": "名古屋100き7777",
        "vin": "FK62F-7009876",
        "customerName": "東海興業株式会社",
        "advances": [
            {"name": "封印代・再交付代", "amount": 1200, "category": "stamp"}
        ]
    },

    # 3. 日産愛知 桜井店 (8月分 完了案件)
    {
        "id": "case_nissan_01",
        "clientId": "client_nissan_sakurai",
        "title": "車庫証明(OSS) - セレナ (高橋健二 様)",
        "category": "garage_oss",
        "status": "done",
        "fee": 5500,
        "completedAt": "2026-08-11",
        "carNumber": "三河500す4321",
        "vin": "C28-1004321",
        "customerName": "高橋 健二",
        "advances": [{"name": "保管場所標章手数料", "amount": 500, "category": "stamp"}]
    },
    {
        "id": "case_nissan_02",
        "clientId": "client_nissan_sakurai",
        "title": "軽自動車名義変更 - サクラ (伊藤美咲 様)",
        "category": "car_reg_light",
        "status": "done",
        "fee": 6000,
        "completedAt": "2026-08-17",
        "carNumber": "三河580あ8765",
        "vin": "B6AW-0012345",
        "customerName": "伊藤 美咲",
        "advances": [{"name": "軽ナンバープレート代", "amount": 1980, "category": "plate"}]
    }
]

# ─── HTMLサンプル出力機能 ───
office_info = {
    "name": "行政書士法人フェリス",
    "assocName": "愛知県行政書士会会員",
    "representative": "代表行政書士 日栄 政敏",
    "zip": "481-0033",
    "address": "愛知県北名古屋市六ツ師道毛74番地1",
    "tel": "0568-26-3713",
    "fax": "0568-26-3714",
    "bankName": "三菱UFJ銀行",
    "bankBranch": "西春支店",
    "accountType": "普通",
    "accountNumber": "0129129",
    "accountHolder": "行政書士法人フェリス"
}

def generate_sample_showcase_html():
    """全ディーラーの請求書サンプルを一覧・プレビュー・印刷できるHTMLを生成"""
    
    html_content = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>行政書士法人フェリス ｜ ディーラー請求書サンプル集</title>
<style>
  :root {{
    --primary: #1E3A8A;
    --primary-light: #3B82F6;
    --bg: #F8FAFC;
    --card: #FFFFFF;
    --text: #1E293B;
    --text-muted: #64748B;
    --border: #E2E8F0;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Yu Gothic UI', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px;
  }}
  .header {{
    max-width: 1000px;
    margin: 0 auto 24px auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--card);
    padding: 20px 24px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    border: 1px solid var(--border);
  }}
  .header h1 {{ font-size: 1.4rem; color: var(--primary); display: flex; align-items: center; gap: 8px; }}
  .header p {{ font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }}
  
  .tabs {{
    max-width: 1000px;
    margin: 0 auto 16px auto;
    display: flex;
    gap: 8px;
  }}
  .tab-btn {{
    padding: 10px 20px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }}
  .tab-btn.active {{
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }}
  .tab-btn:hover:not(.active) {{
    background: #F1F5F9;
  }}
  
  .container {{
    max-width: 1000px;
    margin: 0 auto;
  }}
  .sample-card {{
    display: none;
    background: var(--card);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    border: 1px solid var(--border);
    overflow: hidden;
  }}
  .sample-card.active {{ display: block; }}
  
  .card-toolbar {{
    padding: 12px 24px;
    background: #F1F5F9;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .card-title {{ font-size: 1rem; font-weight: bold; color: #334155; }}
  .btn-print {{
    background: var(--primary-light);
    color: white;
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }}
  .btn-print:hover {{ background: var(--primary); }}
  
  .preview-frame {{
    width: 100%;
    height: 900px;
    border: none;
    background: white;
  }}

  /* 請求書共通スタイル（各iframe用） */
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🏢 行政書士法人フェリス ｜ ディーラー請求書サンプル集</h1>
    <p>自動車部門：愛知トヨタWEST様式・三菱ふそう様式・日産愛知様式のデモサンプル一覧</p>
  </div>
  <div style="text-align:right;">
    <div style="font-size:0.85rem; font-weight:bold; color:var(--primary);">新事務所仕様</div>
    <div style="font-size:0.75rem; color:var(--text-muted);">北名古屋本部 / インボイス対応</div>
  </div>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="showTab('toyota')">🚗 愛知トヨタWEST様式（一宮店）</button>
  <button class="tab-btn" onclick="showTab('fuso')">🚚 三菱ふそう様式（小牧支店）</button>
  <button class="tab-btn" onclick="showTab('nissan')">🚙 日産愛知様式（桜井店）</button>
</div>

<div class="container">
  <!-- トヨタ -->
  <div id="tab-toyota" class="sample-card active">
    <div class="card-toolbar">
      <span class="card-title">愛知トヨタWEST株式会社 一宮店 御中（2026年8月分 請求書）</span>
      <button class="btn-print" onclick="printFrame('frame-toyota')">🖨️ 印刷プレビュー</button>
    </div>
    <iframe id="frame-toyota" class="preview-frame" src="sample_toyota_invoice.html"></iframe>
  </div>

  <!-- ふそう -->
  <div id="tab-fuso" class="sample-card">
    <div class="card-toolbar">
      <span class="card-title">三菱ふそうトラック・バス株式会社 小牧支店 御中（2026年8月分 請求書）</span>
      <button class="btn-print" onclick="printFrame('frame-fuso')">🖨️ 印刷プレビュー</button>
    </div>
    <iframe id="frame-fuso" class="preview-frame" src="sample_fuso_invoice.html"></iframe>
  </div>

  <!-- 日産 -->
  <div id="tab-nissan" class="sample-card">
    <div class="card-toolbar">
      <span class="card-title">日産愛知自動車販売株式会社 桜井店 御中（2026年8月分 請求書）</span>
      <button class="btn-print" onclick="printFrame('frame-nissan')">🖨️ 印刷プレビュー</button>
    </div>
    <iframe id="frame-nissan" class="preview-frame" src="sample_nissan_invoice.html"></iframe>
  </div>
</div>

<script>
function showTab(id) {{
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sample-card').forEach(c => c.classList.remove('active'));
  
  if (id === 'toyota') {{
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('tab-toyota').classList.add('active');
  }} else if (id === 'fuso') {{
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tab-fuso').classList.add('active');
  }} else if (id === 'nissan') {{
    document.querySelectorAll('.tab-btn')[2].classList.add('active');
    document.getElementById('tab-nissan').classList.add('active');
  }}
}}

function printFrame(frameId) {{
  const frame = document.getElementById(frameId);
  if (frame && frame.contentWindow) {{
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }}
}}
</script>

</body>
</html>"""

    showcase_path = r"d:\行政書士\開業\gyosei-dashboard\請求書サンプル一覧.html"
    with open(showcase_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Created: {showcase_path}")

def generate_individual_invoices():
    """各社の請求書HTML本体を生成"""
    
    # ─── 1. トヨタWEST様式 ───
    toyota_html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>御請求書 - 愛知トヨタWEST株式会社 一宮店 御中</title>
<style>
  @page {{ size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }}
  body {{ font-family: 'MS Gothic', 'Yu Gothic', sans-serif; font-size: 11pt; color: #000; background: #fff; margin: 0; padding: 20px; }}
  .header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
  .title {{ font-size: 18pt; font-weight: bold; text-align: center; letter-spacing: 4px; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 16px; }}
  .client-box {{ font-size: 13pt; line-height: 1.6; }}
  .client-name {{ font-size: 15pt; font-weight: bold; text-decoration: underline; }}
  .office-box {{ text-align: right; font-size: 9.5pt; line-height: 1.5; }}
  .office-name {{ font-size: 13pt; font-weight: bold; margin-bottom: 2px; }}
  
  .summary-box {{ margin: 16px 0; border: 2px solid #000; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: #fdfdfd; }}
  .summary-label {{ font-size: 12pt; font-weight: bold; }}
  .summary-amount {{ font-size: 18pt; font-weight: bold; }}
  
  .main-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }}
  .main-table th {{ border: 1px solid #000; background: #eee; padding: 6px 4px; text-align: center; }}
  .main-table td {{ border: 1px solid #000; padding: 5px 6px; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  
  .bank-box {{ margin-top: 16px; border: 1px solid #000; padding: 8px 12px; font-size: 9pt; line-height: 1.5; }}
</style>
</head>
<body>

<div class="title">御 請 求 書</div>

<table class="header-table">
  <tr>
    <td style="vertical-align:top; width:60%;" class="client-box">
      <div class="client-name">愛知トヨタWEST株式会社　一宮店 御中</div>
      <div style="margin-top:6px; font-size:10pt;">2026年8月度　自動車登録・車庫証明業務分</div>
    </td>
    <td style="vertical-align:top; width:40%;" class="office-box">
      <div>請求番号：INV-202608-001</div>
      <div>請求日：2026年8月31日</div>
      <div class="office-name">{office_info['name']}</div>
      <div>{office_info['representative']}</div>
      <div>〒{office_info['zip']} {office_info['address']}</div>
      <div>TEL: {office_info['tel']} / FAX: {office_info['fax']}</div>
    </td>
  </tr>
</table>

<div class="summary-box">
  <span class="summary-label">ご請求金額（税込・立替金合計）</span>
  <span class="summary-amount">￥34,080 -</span>
</div>

<table class="main-table">
  <thead>
    <tr>
      <th style="width:22px;">No</th>
      <th style="width:75px;">完了日</th>
      <th style="width:110px;">車種・車台番号</th>
      <th>使用者名 / 案件内容</th>
      <th style="width:80px;">業務種別</th>
      <th style="width:75px;">報酬額(税抜)</th>
      <th style="width:75px;">立替金(証紙等)</th>
      <th style="width:85px;">小計(税込)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td class="center">2026/08/10</td>
      <td>プリウス<br><span style="font-size:8pt;color:#555;">MXWH60-1002345</span></td>
      <td>山田 太郎 様<br><span style="font-size:8pt;color:#555;">一宮500自1234</span></td>
      <td class="center">車庫証明(OSS)</td>
      <td class="right">￥5,500</td>
      <td class="right">￥500</td>
      <td class="right">￥6,550</td>
    </tr>
    <tr>
      <td class="center">2</td>
      <td class="center">2026/08/12</td>
      <td>クラウン<br><span style="font-size:8pt;color:#555;">TZSH35-2005678</span></td>
      <td>佐藤 一郎 様<br><span style="font-size:8pt;color:#555;">名古屋300さ5678</span></td>
      <td class="center">車庫証明(紙)</td>
      <td class="right">￥7,000</td>
      <td class="right">￥2,700</td>
      <td class="right">￥10,400</td>
    </tr>
    <tr>
      <td class="center">3</td>
      <td class="center">2026/08/18</td>
      <td>ヴェルファイア<br><span style="font-size:8pt;color:#555;">TAHA40W-0019999</span></td>
      <td>鈴木 花子 様<br><span style="font-size:8pt;color:#555;">尾張小牧300ち9999</span></td>
      <td class="center">出張封印</td>
      <td class="right">￥12,000</td>
      <td class="right">￥3,780</td>
      <td class="right">￥16,980</td>
    </tr>
    <!-- 合計行 -->
    <tr style="font-weight:bold; background:#fafafa;">
      <td colspan="5" class="center">合　　計</td>
      <td class="right">￥24,500</td>
      <td class="right">￥6,980</td>
      <td class="right">￥34,080</td>
    </tr>
  </tbody>
</table>

<div style="margin-top:10px; font-size:9pt; display:flex; justify-content:flex-end;">
  <table style="border-collapse:collapse; width:280px;">
    <tr><td style="padding:2px;">報酬額（税抜）：</td><td class="right" style="padding:2px;">￥24,500</td></tr>
    <tr><td style="padding:2px;">消費税等（10%）：</td><td class="right" style="padding:2px;">￥2,450</td></tr>
    <tr><td style="padding:2px;">立替金（非課税）：</td><td class="right" style="padding:2px;">￥6,980</td></tr>
    <tr style="border-top:1px solid #000; font-weight:bold;"><td style="padding:3px 2px;">合計請求額：</td><td class="right" style="padding:3px 2px;">￥34,080</td></tr>
  </table>
</div>

<div class="bank-box">
  <div style="font-weight:bold; margin-bottom:2px;">【お振込先】</div>
  <div>{office_info['bankName']} {office_info['bankBranch']}　{office_info['accountType']}口座　{office_info['accountNumber']}</div>
  <div>口座名義：{office_info['accountHolder']}</div>
</div>

</body>
</html>"""

    with open(r"d:\行政書士\開業\gyosei-dashboard\sample_toyota_invoice.html", "w", encoding="utf-8") as f:
        f.write(toyota_html)

    # ─── 2. 三菱ふそう様式 ───
    fuso_html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>御請求書 - 三菱ふそうトラック・バス株式会社 小牧支店 御中</title>
<style>
  @page {{ size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }}
  body {{ font-family: 'MS Gothic', 'Yu Gothic', sans-serif; font-size: 11pt; color: #000; background: #fff; margin: 0; padding: 20px; }}
  .header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
  .title {{ font-size: 18pt; font-weight: bold; text-align: center; letter-spacing: 4px; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 16px; }}
  .client-name {{ font-size: 15pt; font-weight: bold; text-decoration: underline; }}
  .office-box {{ text-align: right; font-size: 9.5pt; line-height: 1.5; }}
  .office-name {{ font-size: 13pt; font-weight: bold; }}
  
  .summary-box {{ margin: 16px 0; border: 2px solid #000; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: #fdfdfd; }}
  .summary-amount {{ font-size: 18pt; font-weight: bold; }}
  
  .main-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }}
  .main-table th {{ border: 1px solid #000; background: #eee; padding: 6px 4px; text-align: center; }}
  .main-table td {{ border: 1px solid #000; padding: 5px 6px; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  
  .bank-box {{ margin-top: 16px; border: 1px solid #000; padding: 8px 12px; font-size: 9pt; line-height: 1.5; }}
</style>
</head>
<body>

<div class="title">御 請 求 書（トラック・バス登録）</div>

<table class="header-table">
  <tr>
    <td style="vertical-align:top; width:60%;">
      <div class="client-name">三菱ふそうトラック・バス株式会社<br>小牧支店 御中</div>
      <div style="margin-top:6px; font-size:10pt;">2026年8月度　自動車登録・出張封印業務分</div>
    </td>
    <td style="vertical-align:top; width:40%;" class="office-box">
      <div>請求番号：INV-202608-002</div>
      <div>請求日：2026年8月31日</div>
      <div class="office-name">{office_info['name']}</div>
      <div>{office_info['representative']}</div>
      <div>〒{office_info['zip']} {office_info['address']}</div>
      <div>TEL: {office_info['tel']} / FAX: {office_info['fax']}</div>
    </td>
  </tr>
</table>

<div class="summary-box">
  <span style="font-size:12pt; font-weight:bold;">ご請求金額（税込・立替金合計）</span>
  <span class="summary-amount">￥56,580 -</span>
</div>

<table class="main-table">
  <thead>
    <tr>
      <th style="width:24px;">No</th>
      <th style="width:80px;">完了日</th>
      <th>車名・車台番号 / 登録番号</th>
      <th>使用者名 / 業務内容</th>
      <th style="width:80px;">報酬額(税抜)</th>
      <th style="width:80px;">立替金(重量税等)</th>
      <th style="width:85px;">小計(税込)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td class="center">2026/08/08</td>
      <td>キャンター<br><span style="font-size:8pt;color:#555;">FEB70-5001234 / 尾張小牧100か8888</span></td>
      <td>株式会社愛知物流 様<br><span style="font-size:8pt;color:#555;">大型トラック新規登録</span></td>
      <td class="right">￥18,000</td>
      <td class="right">￥19,080</td>
      <td class="right">￥38,880</td>
    </tr>
    <tr>
      <td class="center">2</td>
      <td class="center">2026/08/15</td>
      <td>ファイター<br><span style="font-size:8pt;color:#555;">FK62F-7009876 / 名古屋100き7777</span></td>
      <td>東海興業株式会社 様<br><span style="font-size:8pt;color:#555;">出張封印取付</span></td>
      <td class="right">￥15,000</td>
      <td class="right">￥1,200</td>
      <td class="right">￥17,700</td>
    </tr>
    <tr style="font-weight:bold; background:#fafafa;">
      <td colspan="4" class="center">合　　計</td>
      <td class="right">￥33,000</td>
      <td class="right">￥20,280</td>
      <td class="right">￥56,580</td>
    </tr>
  </tbody>
</table>

<div style="margin-top:10px; font-size:9pt; display:flex; justify-content:flex-end;">
  <table style="border-collapse:collapse; width:280px;">
    <tr><td style="padding:2px;">報酬額（税抜）：</td><td class="right" style="padding:2px;">￥33,000</td></tr>
    <tr><td style="padding:2px;">消費税等（10%）：</td><td class="right" style="padding:2px;">￥3,300</td></tr>
    <tr><td style="padding:2px;">立替金合計：</td><td class="right" style="padding:2px;">￥20,280</td></tr>
    <tr style="border-top:1px solid #000; font-weight:bold;"><td style="padding:3px 2px;">合計請求額：</td><td class="right" style="padding:3px 2px;">￥56,580</td></tr>
  </table>
</div>

<div class="bank-box">
  <div style="font-weight:bold; margin-bottom:2px;">【お振込先】</div>
  <div>{office_info['bankName']} {office_info['bankBranch']}　{office_info['accountType']}口座　{office_info['accountNumber']}</div>
  <div>口座名義：{office_info['accountHolder']}</div>
</div>

</body>
</html>"""

    with open(r"d:\行政書士\開業\gyosei-dashboard\sample_fuso_invoice.html", "w", encoding="utf-8") as f:
        f.write(fuso_html)

    # ─── 3. 日産愛知様式 ───
    nissan_html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>御請求書 - 日産愛知自動車販売株式会社 桜井店 御中</title>
<style>
  @page {{ size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }}
  body {{ font-family: 'MS Gothic', 'Yu Gothic', sans-serif; font-size: 11pt; color: #000; background: #fff; margin: 0; padding: 20px; }}
  .header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
  .title {{ font-size: 18pt; font-weight: bold; text-align: center; letter-spacing: 4px; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 16px; }}
  .client-name {{ font-size: 15pt; font-weight: bold; text-decoration: underline; }}
  .office-box {{ text-align: right; font-size: 9.5pt; line-height: 1.5; }}
  .office-name {{ font-size: 13pt; font-weight: bold; }}
  
  .summary-box {{ margin: 16px 0; border: 2px solid #000; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: #fdfdfd; }}
  .summary-amount {{ font-size: 18pt; font-weight: bold; }}
  
  .main-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }}
  .main-table th {{ border: 1px solid #000; background: #eee; padding: 6px 4px; text-align: center; }}
  .main-table td {{ border: 1px solid #000; padding: 5px 6px; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  
  .bank-box {{ margin-top: 16px; border: 1px solid #000; padding: 8px 12px; font-size: 9pt; line-height: 1.5; }}
</style>
</head>
<body>

<div class="title">御 請 求 書</div>

<table class="header-table">
  <tr>
    <td style="vertical-align:top; width:60%;">
      <div class="client-name">日産愛知自動車販売株式会社<br>桜井店 御中</div>
      <div style="margin-top:6px; font-size:10pt;">2026年8月度　車庫証明・登録業務分</div>
    </td>
    <td style="vertical-align:top; width:40%;" class="office-box">
      <div>請求番号：INV-202608-003</div>
      <div>請求日：2026年8月31日</div>
      <div class="office-name">{office_info['name']}</div>
      <div>{office_info['representative']}</div>
      <div>〒{office_info['zip']} {office_info['address']}</div>
      <div>TEL: {office_info['tel']} / FAX: {office_info['fax']}</div>
    </td>
  </tr>
</table>

<div class="summary-box">
  <span style="font-size:12pt; font-weight:bold;">ご請求金額（税込・立替金合計）</span>
  <span class="summary-amount">￥15,130 -</span>
</div>

<table class="main-table">
  <thead>
    <tr>
      <th style="width:24px;">No</th>
      <th style="width:80px;">完了日</th>
      <th>車種・登録番号</th>
      <th>使用者名 / 業務種別</th>
      <th style="width:80px;">報酬額(税抜)</th>
      <th style="width:80px;">立替金(実費)</th>
      <th style="width:85px;">小計(税込)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td class="center">2026/08/11</td>
      <td>セレナ<br><span style="font-size:8pt;color:#555;">三河500す4321</span></td>
      <td>高橋 健二 様<br><span style="font-size:8pt;color:#555;">車庫証明(OSS)</span></td>
      <td class="right">￥5,500</td>
      <td class="right">￥500</td>
      <td class="right">￥6,550</td>
    </tr>
    <tr>
      <td class="center">2</td>
      <td class="center">2026/08/17</td>
      <td>サクラ<br><span style="font-size:8pt;color:#555;">三河580あ8765</span></td>
      <td>伊藤 美咲 様<br><span style="font-size:8pt;color:#555;">軽自動車名義変更</span></td>
      <td class="right">￥6,000</td>
      <td class="right">￥1,980</td>
      <td class="right">￥8,580</td>
    </tr>
    <tr style="font-weight:bold; background:#fafafa;">
      <td colspan="4" class="center">合　　計</td>
      <td class="right">￥11,500</td>
      <td class="right">￥2,480</td>
      <td class="right">￥15,130</td>
    </tr>
  </tbody>
</table>

<div style="margin-top:10px; font-size:9pt; display:flex; justify-content:flex-end;">
  <table style="border-collapse:collapse; width:280px;">
    <tr><td style="padding:2px;">報酬額（税抜）：</td><td class="right" style="padding:2px;">￥11,500</td></tr>
    <tr><td style="padding:2px;">消費税等（10%）：</td><td class="right" style="padding:2px;">￥1,150</td></tr>
    <tr><td style="padding:2px;">立替金合計：</td><td class="right" style="padding:2px;">￥2,480</td></tr>
    <tr style="border-top:1px solid #000; font-weight:bold;"><td style="padding:3px 2px;">合計請求額：</td><td class="right" style="padding:3px 2px;">￥15,130</td></tr>
  </table>
</div>

<div class="bank-box">
  <div style="font-weight:bold; margin-bottom:2px;">【お振込先】</div>
  <div>{office_info['bankName']} {office_info['bankBranch']}　{office_info['accountType']}口座　{office_info['accountNumber']}</div>
  <div>口座名義：{office_info['accountHolder']}</div>
</div>

</body>
</html>"""

    with open(r"d:\行政書士\開業\gyosei-dashboard\sample_nissan_invoice.html", "w", encoding="utf-8") as f:
        f.write(nissan_html)

if __name__ == "__main__":
    generate_individual_invoices()
    generate_sample_showcase_html()
    print("All demo invoices generated successfully!")
