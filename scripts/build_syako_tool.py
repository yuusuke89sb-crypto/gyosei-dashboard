import os

html_code = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>行政書士法人フェリス ｜ 車庫証明 OSS 所在図・配置図 作成ツール</title>
<!-- Leaflet.js -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<!-- html2canvas & jsPDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<!-- qrcode.js for dynamic OSS QR code generation -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<style>
  :root {
    --primary: #1E3A8A;
    --primary-light: #2563EB;
    --primary-hover: #1D4ED8;
    --accent: #E11D48;
    --bg-dark: #0F172A;
    --bg-panel: #1E293B;
    --bg-light: #F8FAFC;
    --border: #334155;
    --border-light: #E2E8F0;
    --text-light: #F8FAFC;
    --text-muted: #94A3B8;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Yu Gothic UI', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg-dark);
    color: var(--text-light);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ─── ヘッダー ─── */
  header {
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    gap: 12px;
  }
  .brand { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .brand-title { font-size: 1.1rem; font-weight: bold; color: #FFFFFF; }
  .brand-badge { background: #059669; color: #fff; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  
  .header-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: bold;
    cursor: pointer;
    border: 1px solid transparent;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-primary { background: var(--primary-light); color: white; }
  .btn-primary:hover { background: var(--primary-hover); }
  .btn-success { background: #16A34A; color: white; }
  .btn-success:hover { background: #15803D; }
  .btn-accent { background: var(--accent); color: white; }
  .btn-accent:hover { background: #BE123C; }
  .btn-secondary { background: #334155; color: #E2E8F0; border-color: #475569; }
  .btn-secondary:hover { background: #475569; }

  /* トースト通知 */
  #toast {
    position: fixed;
    top: 54px;
    right: 20px;
    background: #059669;
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-10px);
    transition: all 0.25s ease;
  }
  #toast.show {
    opacity: 1;
    transform: translateY(0);
  }

  /* ─── メインワークスペース ─── */
  .workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* 左側サイドパネル */
  .sidebar {
    width: 380px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .sidebar-section {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  .section-title {
    font-size: 0.82rem;
    font-weight: bold;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* フォーム要素 */
  .form-group { margin-bottom: 8px; }
  .form-label { display: block; font-size: 0.78rem; color: #CBD5E1; margin-bottom: 3px; font-weight: 500; }
  .form-input {
    width: 100%;
    padding: 6px 9px;
    background: #0F172A;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: #F8FAFC;
    font-size: 0.82rem;
  }
  .form-input:focus { outline: none; border-color: var(--primary-light); }
  .form-row { display: flex; gap: 8px; }
  .form-row .form-group { flex: 1; }

  /* ツールボックス（作図ツール） */
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 8px;
  }
  .tool-btn {
    padding: 6px 3px;
    background: #0F172A;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: #CBD5E1;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    transition: all 0.15s;
  }
  .tool-btn:hover { background: #334155; color: #FFFFFF; }
  .tool-btn.active {
    background: var(--primary-light);
    color: #FFFFFF;
    border-color: #38BDF8;
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
  }
  .tool-btn-icon { font-size: 1.05rem; }

  /* 選択中要素のクイック調整パネル */
  .property-panel {
    background: #0F172A;
    border: 1px solid #38BDF8;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 10px;
    display: none;
    animation: fadeIn 0.2s ease;
  }
  .property-panel.active { display: block; }
  .property-title {
    font-size: 0.75rem;
    font-weight: bold;
    color: #38BDF8;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .property-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .property-btn {
    padding: 3px 7px;
    background: #1E293B;
    border: 1px solid #475569;
    border-radius: 4px;
    color: #E2E8F0;
    font-size: 0.72rem;
    cursor: pointer;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .property-btn:hover { background: #334155; border-color: #94A3B8; }

  /* スタンプタグ（削除×ボタン付き） */
  .stamp-tag-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #0F172A;
    border: 1px solid #475569;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 0.73rem;
    color: #E2E8F0;
    transition: all 0.15s;
  }
  .stamp-tag-item:hover { border-color: #94A3B8; background: #1E293B; }
  .stamp-tag-text { cursor: pointer; }
  .stamp-tag-text:hover { color: #38BDF8; }
  .stamp-tag-del {
    cursor: pointer;
    color: #94A3B8;
    font-size: 11px;
    font-weight: bold;
    padding: 0 2px;
    border-radius: 2px;
  }
  .stamp-tag-del:hover { color: #EF4444; background: rgba(239, 68, 68, 0.15); }

  /* 地図ズームコントロールオーバーレイ */
  .map-zoom-bar {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.9);
    padding: 3px 6px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    border: 1px solid #CBD5E1;
  }
  .zoom-btn {
    width: 26px;
    height: 26px;
    background: #FFFFFF;
    border: 1px solid #94A3B8;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    color: #1E293B;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  .zoom-btn:hover { background: #E2E8F0; }

  /* 現在のアクティブ編集対象インジケーター */
  .active-page-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #2563EB;
    color: #FFFFFF;
    font-size: 0.72rem;
    font-weight: bold;
    border-radius: 4px;
    margin-bottom: 6px;
  }

  /* 中央プレビューエリア */
  .preview-area {
    flex: 1;
    background: #0B0F19;
    padding: 20px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  /* 📄 A4横（OSS 2ページ様式） */
  .a4-page-oss {
    width: 1050px;
    height: 742px;
    min-height: 742px;
    background: #FFFFFF;
    color: #000000;
    padding: 20px 24px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    position: relative;
    box-sizing: border-box;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }
  .a4-page-oss.active-edit-target {
    border-color: #38BDF8;
  }

  /* OSS OCR上部バーコード欄 */
  .oss-ocr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px 6px 4px;
    border-bottom: 2px solid #000;
    margin-bottom: 8px;
  }
  .ocr-digits {
    font-family: monospace;
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 4px;
    border: 1.5px solid #000;
    padding: 2px 10px;
    display: flex;
  }
  .ocr-code-box {
    border: 1.5px solid #000;
    padding: 2px 8px;
    font-weight: bold;
    font-size: 13pt;
    margin-left: 8px;
  }

  /* 動的QRコード表示枠 */
  .oss-qr-box {
    width: 38px;
    height: 38px;
    border: 1.5px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FFFFFF;
    overflow: hidden;
  }
  .oss-qr-box img, .oss-qr-box canvas {
    width: 34px !important;
    height: 34px !important;
    display: block;
  }

  .box-title-bar {
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
    padding: 6px 0;
    border: 2px solid #000;
    border-bottom: none;
    background: #FAFAFA;
    letter-spacing: 6px;
  }

  .page-canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #FFFFFF;
    border: 2px solid #000;
    min-height: 490px;
  }

  /* 地図レイヤー（白黒・公図風・道路くっきり） */
  .map-layer {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    z-index: 1;
    filter: grayscale(100%) contrast(180%) brightness(90%);
    transition: opacity 0.3s, filter 0.2s;
  }
  .map-layer.contrast-strong {
    filter: grayscale(100%) contrast(240%) brightness(82%);
  }
  .map-layer.contrast-ultra {
    filter: grayscale(100%) contrast(320%) brightness(75%) saturate(0%);
  }
  .map-layer.blank-mode {
    opacity: 0;
    pointer-events: none;
  }
  /* 描画キャンバス */
  .drawing-canvas {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    z-index: 2;
    cursor: grab;
  }
  .drawing-canvas.drawing-mode {
    cursor: crosshair;
  }

  /* 白紙キャンバスモード時のグリッド背景 */
  .page-canvas-container.grid-bg {
    background-image:
      linear-gradient(rgba(200,210,220,0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200,210,220,0.3) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* 縮尺バー表示用スタイル */
  .scale-bar {
    position: absolute;
    bottom: 10px;
    left: 10px;
    z-index: 3;
    background: rgba(255,255,255,0.85);
    border: 1px solid #333;
    padding: 2px 8px;
    font-size: 9pt;
    font-weight: bold;
    color: #000;
    font-family: monospace;
    pointer-events: none;
  }

  /* 配置図背景モード切替ボタン */
  .canvas-mode-toggle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.92);
    padding: 3px 6px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    border: 1px solid #CBD5E1;
  }
  .mode-btn {
    padding: 3px 8px;
    background: #FFFFFF;
    border: 1px solid #94A3B8;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    color: #1E293B;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mode-btn:hover { background: #E2E8F0; }
  .mode-btn.active-mode { background: #2563EB; color: #fff; border-color: #2563EB; }

  /* 書式フッター */
  .page-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 8px;
    font-size: 8pt;
    color: #000;
  }
  .shutter-box {
    border: 1.2px solid #000;
    padding: 2px 6px;
    font-size: 7.5pt;
    display: flex;
    align-items: center;
    gap: 4px;
    background: #fff;
  }
  .shutter-circle {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.2px solid #000;
    text-align: center;
    line-height: 12px;
    font-weight: bold;
  }

  /* 印刷用スタイル */
  @media print {
    html, body {
      background: #fff !important;
      color: #000 !important;
      width: 100% !important;
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
      position: static !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    }
    header, .sidebar, .leaflet-control-container, .print-hide, .map-zoom-bar, .canvas-mode-toggle, .scale-bar, #toast {
      display: none !important;
    }
    .workspace {
      display: block !important;
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
      position: static !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .preview-area {
      display: block !important;
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
      position: static !important;
      padding: 0 !important;
      margin: 0 !important;
      background: #fff !important;
      gap: 0 !important;
    }
    .a4-page-oss {
      width: 100% !important;
      height: 190mm !important;
      min-height: 190mm !important;
      max-height: 190mm !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      border: none !important;
      padding: 4mm 6mm !important;
      margin: 0 auto !important;
      display: flex !important;
      flex-direction: column !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box !important;
    }
    .a4-page-oss:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .page-canvas-container {
      flex: 1 !important;
      height: 145mm !important;
      min-height: 145mm !important;
    }
  }
</style>
<style id="printPageStyle">
  @page { size: A4 landscape; margin: 8mm; }
</style>
</head>
<body>

<!-- トースト通知 -->
<div id="toast">操作が完了しました</div>

<!-- ─── ヘッダー ─── -->
<header class="print-hide">
  <div class="brand">
    <span style="font-size:1.3rem;">🚗</span>
    <div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="brand-title">車庫証明 OSS 所在図・配置図 作成ツール</span>
        <span class="brand-badge" id="layoutBadge">A4横・OSS 2ページ様式</span>
        <span id="caseLinkedBadge" class="brand-badge" style="display:none; background:#2563EB; font-size:0.75rem;">📁 案件連携中</span>
      </div>
      <div style="font-size:0.72rem; color:var(--text-muted);">行政書士法人フェリス 自動車登録実務システム</div>
    </div>
  </div>
  <div class="header-actions">
    <!-- 案件直接保存ボタン（案件連携時） -->
    <button class="btn btn-success" id="btnSaveToCase" style="display:none;" onclick="saveToCaseDirectly()" title="ダッシュボードの案件に作図データを保存">💾 案件に保存</button>

    <!-- 様式切り替え -->
    <select id="layoutSelect" class="form-input" style="width:205px; background:#1E293B; font-weight:bold; color:#38BDF8;" onchange="switchLayout()">
      <option value="oss-2page" selected>📄 A4横×2ページ（OSS専用様式）</option>
      <option value="horizontal">📄 A4横×1ページ（警察標準）</option>
    </select>
    
    <!-- 案件データの保存と読込 -->
    <button class="btn btn-secondary" onclick="exportJSON()" title="現在の作図・入力データをJSONファイルとして保存">💾 JSON保存</button>
    <button class="btn btn-secondary" onclick="document.getElementById('jsonFileInput').click()" title="過去の案件JSONファイルを読み込み復元">📂 案件読込</button>
    <input type="file" id="jsonFileInput" accept=".json" style="display:none;" onchange="loadJSONFile(event)">
    
    <button class="btn btn-secondary" onclick="loadKurodaSample()">🏠 黒田サンプル</button>
    <button class="btn btn-secondary" onclick="clearCanvas()">🗑️ クリア</button>
    <button class="btn btn-primary" onclick="exportOSSImage()">🖼️ OSS画像(2枚)保存</button>
    <button class="btn btn-success" onclick="exportA4PDF()">🖨️ 印刷 / PDF保存</button>
  </div>
</header>

<!-- ─── ワークスペース ─── -->
<div class="workspace">

  <!-- ─── 左側サイドバー ─── -->
  <div class="sidebar print-hide">

    <!-- 0. OSS OCRコード -->
    <div class="sidebar-section">
      <div class="section-title">🔢 0. OSS OCRコード（案件ごとに変更）</div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">OCR番号（16桁・半角スペース区切り）</label>
        <input type="text" id="ocrCodeInput" class="form-input" value="0 1 1 0 4 7 0 1 5 6 5 0 0 0 0 0" oninput="updateOCRDisplay(); updateQRCodes(); autoSaveDraft();" style="font-family:monospace; letter-spacing:2px; font-weight:bold;">
      </div>
    </div>

    <!-- 1. 住所＆地図連動 -->
    <div class="sidebar-section">
      <div class="section-title">📍 1. 住所検索＆自動地図読込</div>
      <div class="form-group">
        <label class="form-label">使用の本拠の位置（自宅・営業所）</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="homeAddress" class="form-input" placeholder="例: 一宮市木曽川町黒田六ノ通り304-12" value="愛知県一宮市木曽川町黒田六ノ通り304番地12" oninput="autoSaveDraft()">
          <button class="btn btn-secondary" style="padding:4px 10px;" onclick="searchAddress('home')">検索</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">自動車の保管場所の位置（駐車場）</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="parkingAddress" class="form-input" placeholder="例: 一宮市木曽川町黒田六ノ通り304-12" value="愛知県一宮市木曽川町黒田六ノ通り304番地12" oninput="autoSaveDraft()">
          <button class="btn btn-secondary" style="padding:4px 10px;" onclick="searchAddress('parking')">検索</button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:0.78rem; color:#94A3B8; display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="sameAddress" checked onchange="toggleSameAddress(); autoSaveDraft();"> 自宅と保管場所が同一
        </label>
        <div style="display:flex; gap:4px;">
          <button class="btn btn-primary" style="font-size:0.74rem; padding:4px 8px;" onclick="autoFetchMaps()">🗺️ 地図を自動取得</button>
          <button class="btn btn-accent" style="font-size:0.74rem; padding:4px 8px;" onclick="calcDistance(true)">📏 距離算出＆プロット</button>
        </div>
      </div>
    </div>

    <!-- 2. 配置図パラメータ -->
    <div class="sidebar-section">
      <div class="section-title">📐 2. 車庫・道路・申請情報</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">駐車枠 番号</label>
          <input type="text" id="spotNo" class="form-input" value="" placeholder="例: No.3" oninput="autoSaveDraft()">
        </div>
        <div class="form-group">
          <label class="form-label">直線距離（自宅〜車庫）</label>
          <input type="text" id="distanceVal" class="form-input" value="同上 (0m)" oninput="autoSaveDraft()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">駐車枠寸法（幅 × 奥行）</label>
          <div style="display:flex; gap:4px; align-items:center;">
            <input type="text" id="spotWidth" class="form-input" value="2.0m" style="text-align:center;" oninput="autoSaveDraft()">
            <span>×</span>
            <input type="text" id="spotLength" class="form-input" value="5.0m" style="text-align:center;" oninput="autoSaveDraft()">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">前面道路 幅員</label>
          <input type="text" id="roadWidth" class="form-input" value="5.0 m" oninput="autoSaveDraft()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">出入口 幅</label>
          <input type="text" id="entranceWidth" class="form-input" value="10.0 m" oninput="autoSaveDraft()">
        </div>
        <div class="form-group">
          <label class="form-label">シャッター</label>
          <select id="shutterVal" class="form-input" onchange="updateShutterDisplay(); autoSaveDraft();">
            <option value="無" selected>無</option>
            <option value="有">有</option>
          </select>
        </div>
      </div>
      <!-- 店舗連絡先 & 登録番号 & 職印 -->
      <div class="form-group">
        <label class="form-label">連絡先・店舗情報（配置図右下に印字）</label>
        <input type="text" id="dealerInfoInput" class="form-input" placeholder="例: 愛知トヨタ 江南店 TEL 0587-55-6311" value="愛知トヨタ 江南店 TEL 0587-55-6311" oninput="updateFooterDealerInfo(); autoSaveDraft();">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">登録番号（車番）</label>
          <input type="text" id="regNoInput" class="form-input" placeholder="例: 尾張小牧500自1234 (空欄可)" value="" oninput="updateFooterRegNo(); autoSaveDraft();">
        </div>
        <div class="form-group">
          <label class="form-label">作成者・事務所名</label>
          <input type="text" id="officeInfoInput" class="form-input" value="行政書士法人フェリス 0568-26-3713" oninput="updateFooterOfficeInfo(); autoSaveDraft();">
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:4px; border-top:1px dashed #334155;">
        <label style="font-size:0.75rem; color:#E2E8F0; display:flex; align-items:center; gap:5px; cursor:pointer;">
          <input type="checkbox" id="showSealCheckbox" checked onchange="toggleSeal(); autoSaveDraft();"> 🔏 職印（電子印）を押印
        </label>
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:0.70rem; color:#94A3B8;">印影サイズ:</span>
          <input type="range" id="sealSizeSlider" min="22" max="55" step="1" value="34" style="width:75px; cursor:pointer;" oninput="onSealSizeChange(this.value); autoSaveDraft();">
          <span id="sealSizeLabel" style="font-size:0.70rem; color:#38BDF8; width:26px;">34px</span>
        </div>
      </div>
    </div>

    <!-- 3. 作図ツール -->
    <div class="sidebar-section">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div class="section-title" style="margin-bottom:0;">✏️ 3. 作図ツール</div>
        <span class="active-page-badge" id="activePageBadge">📐 配置図 作図中</span>
      </div>

      <!-- 選択中要素の回転・サイズ・プロパティバー -->
      <div class="property-panel" id="propertyPanel">
        <div class="property-title">
          <span id="selectedItemTypeLabel">🎯 選択中の要素</span>
          <button class="property-btn" style="color:#EF4444; padding:1px 5px;" onclick="deleteSelectedItem()">🗑️ 削除</button>
        </div>
        <div class="property-row">
          <span style="font-size:0.72rem; color:#94A3B8; width:48px;">🔄 回転:</span>
          <button class="property-btn" onclick="rotateSelectedItem(-45)">⟲ -45°</button>
          <button class="property-btn" onclick="rotateSelectedItem(45)">⟳ +45°</button>
          <button class="property-btn" onclick="setSelectedItemAngle(0)">0°</button>
          <button class="property-btn" onclick="setSelectedItemAngle(90)">90°</button>
          <button class="property-btn" onclick="setSelectedItemAngle(180)">180°</button>
        </div>
        <div class="property-row">
          <span style="font-size:0.72rem; color:#94A3B8; width:48px;">📏 サイズ:</span>
          <button class="property-btn" onclick="scaleSelectedItem(0.85)">➖ 縮小</button>
          <button class="property-btn" onclick="scaleSelectedItem(1.18)">➕ 拡大</button>
          <button class="property-btn" onclick="editSelectedText()">✏️ 文字変更</button>
        </div>
      </div>

      <div class="tool-grid">
        <button class="tool-btn active" id="tool-select" onclick="setTool('select')">
          <span class="tool-btn-icon">👆</span>選択 / 移動
        </button>
        <button class="tool-btn" id="tool-rect-spot" onclick="setTool('rect-spot')">
          <span class="tool-btn-icon">🅿️</span>保管場所枠
        </button>
        <button class="tool-btn" id="tool-rect-other" onclick="setTool('rect-other')">
          <span class="tool-btn-icon">🔲</span>建物・自宅枠
        </button>
        <button class="tool-btn" id="tool-line-dim" onclick="setTool('line-dim')">
          <span class="tool-btn-icon">📏</span>寸法線(両矢)
        </button>
        <button class="tool-btn" id="tool-line-road" onclick="setTool('line-road')">
          <span class="tool-btn-icon">🛣️</span>道路境界線
        </button>
        <button class="tool-btn" id="tool-line-rail" onclick="setTool('line-rail')">
          <span class="tool-btn-icon">🚆</span>線路(鉄道記号)
        </button>
        <button class="tool-btn" id="tool-arrow" onclick="setTool('arrow')">
          <span class="tool-btn-icon">➡️</span>出入口 矢印
        </button>
        <button class="tool-btn" id="tool-compass" onclick="setTool('compass')">
          <span class="tool-btn-icon">🧭</span>JIS方位記号
        </button>
        <button class="tool-btn" id="tool-car" onclick="setTool('car')">
          <span class="tool-btn-icon">🚗</span>車両マーク
        </button>
        <button class="tool-btn" id="tool-text" onclick="setTool('text')">
          <span class="tool-btn-icon">🔤</span>文字入力
        </button>
        <button class="tool-btn" id="tool-dist-line" onclick="setTool('dist-line')">
          <span class="tool-btn-icon">📍</span>直線距離線
        </button>
        <button class="tool-btn" id="tool-eraser" onclick="setTool('eraser')">
          <span class="tool-btn-icon">🧹</span>要素削除
        </button>
      </div>

      <!-- スタンプ管理（削除×ボタン付き・自由編集） -->
      <div style="margin-top:10px; border-top:1px dashed #334155; padding-top:8px;">
        <div style="font-size:0.75rem; color:#94A3B8; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>🏷️ 文字スタンプ（押して配置・×で削除）</span>
          <button class="property-btn" style="font-size:0.68rem; padding:1px 4px;" onclick="resetDefaultStamps()" title="初期スタンプを復元">🔄 初期化</button>
        </div>
        <div style="display:flex; gap:4px; margin-bottom:6px;">
          <input type="text" id="newStampInput" class="form-input" placeholder="例: 来客用, 県道186号, ブロック塀" style="font-size:0.74rem; padding:4px 6px;">
          <button class="btn btn-secondary" style="font-size:0.74rem; padding:4px 8px; white-space:nowrap;" onclick="addNewStamp()">＋追加</button>
        </div>
        <div id="stampListContainer" style="display:flex; flex-wrap:wrap; gap:4px;"></div>
      </div>
    </div>

    <!-- 4. 地図調整 -->
    <div class="sidebar-section">
      <div class="section-title">🗺️ 4. 地図・道路の濃さ＆縮尺調整</div>

      <!-- 地図種類（国土地理院 / OSM / 交通重視） -->
      <div class="form-group" style="margin-bottom:8px;">
        <label class="form-label">地図デザイン（道路・線路の表示スタイル）</label>
        <select id="mapTileSelect" class="form-input" onchange="changeMapTile(this.value); autoSaveDraft();" style="font-weight:bold; color:#38BDF8;">
          <option value="osm-transit" selected>🚆 交通・線路くっきり（警察提出・車庫証明推奨）</option>
          <option value="gsi-std">🗾 国土地理院 標準（市街地・家形重視）</option>
          <option value="osm">🌐 OpenStreetMap（標準）</option>
          <option value="gsi-pale">🗺️ 国土地理院 淡色（すっきり公図風）</option>
        </select>
      </div>

      <!-- 道路・線画の濃さスライダー -->
      <div style="margin-bottom:10px; background:#0F172A; border:1px solid #334155; border-radius:6px; padding:6px 8px;">
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:3px;">
          <span style="color:#E2E8F0; font-weight:bold;">🖤 道路・線画の濃さ（コントラスト）</span>
          <span id="contrastLabel" style="font-weight:bold; color:#38BDF8;">200%（濃いめ）</span>
        </div>
        <input type="range" id="contrastSlider" min="100" max="350" step="10" value="200" style="width:100%; cursor:pointer;" oninput="onContrastSliderChange(this.value); autoSaveDraft();">
        <div style="display:flex; gap:4px; margin-top:3px;">
          <button class="btn btn-secondary" style="flex:1; padding:2px 4px; font-size:0.70rem;" onclick="setContrastPreset(130)">標準</button>
          <button class="btn btn-primary" style="flex:1; padding:2px 4px; font-size:0.70rem;" onclick="setContrastPreset(200)">濃いめ</button>
          <button class="btn btn-accent" style="flex:1; padding:2px 4px; font-size:0.70rem;" onclick="setContrastPreset(290)">超くっきり</button>
        </div>
      </div>
      
      <!-- 所在図ズーム -->
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:3px;">
          <span>📍 所在図 縮尺（広域 ⇄ 詳細）</span>
          <span id="sozaiZoomLabel" style="font-weight:bold; color:#38BDF8;">Zoom: 15.0</span>
        </div>
        <input type="range" id="sozaiZoomSlider" min="5" max="21" step="0.25" value="15" style="width:100%; cursor:pointer;" oninput="onZoomSliderChange('sozai', this.value)">
        <div style="display:flex; gap:4px; margin-top:3px;">
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('sozai', 12)">広域</button>
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('sozai', 15)">標準</button>
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('sozai', 17.5)">詳細</button>
        </div>
      </div>

      <!-- 配置図ズーム -->
      <div style="margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:3px;">
          <span>📐 配置図 縮尺（敷地・車庫の超拡大）</span>
          <span id="haichiZoomLabel" style="font-weight:bold; color:#38BDF8;">Zoom: 18.0</span>
        </div>
        <input type="range" id="haichiZoomSlider" min="10" max="22" step="0.25" value="18" style="width:100%; cursor:pointer;" oninput="onZoomSliderChange('haichi', this.value)">
        <div style="display:flex; gap:4px; margin-top:3px;">
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('haichi', 17)">周辺道路</button>
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('haichi', 19)">敷地・建物</button>
          <button class="btn btn-secondary" style="flex:1; padding:3px;" onclick="setMapZoomLevel('haichi', 20.5)">🔍 超ドアップ</button>
        </div>
      </div>

      <div style="font-size:0.70rem; color:#94A3B8; margin-top:4px;">
        💡 Zoom 22まで超拡大可能。マウスホイールや「➕」ボタンで敷地を画面いっぱいに広げられます。
      </div>
    </div>

  </div>

  <!-- ─── 中央：A4用紙プレビューエリア（縦2ページ） ─── -->
  <div class="preview-area" id="previewArea">

    <!-- 📄 1ページ目：所在図 -->
    <div class="a4-page-oss" id="page1Sozai" onclick="setActiveTarget('sozai')">
      <!-- OSS OCRヘッダー -->
      <div class="oss-ocr-header">
        <div style="display:flex; align-items:center;">
          <div class="ocr-digits" id="ocrDigitsC">0 1 1 0 4 7 0 1 5 6 5 0 0 0 0 0</div>
          <div class="ocr-code-box">C</div>
        </div>
        <div style="font-size:12pt; font-weight:bold; letter-spacing:4px;">所　在　図</div>
        <div class="oss-qr-box" id="sozaiQRCode" title="OCR連動QRコード"></div>
      </div>

      <div class="box-title-bar">所　在　図　記　載　欄</div>
      <div class="page-canvas-container" id="sozaiContainer">
        <div id="sozaiMap" class="map-layer"></div>
        <canvas id="sozaiCanvas" class="drawing-canvas"></canvas>
        <div class="map-zoom-bar print-hide">
          <button class="zoom-btn" onclick="zoomMap('sozai', 1)" title="拡大">➕</button>
          <button class="zoom-btn" onclick="zoomMap('sozai', -1)" title="縮小">➖</button>
        </div>
        <div class="scale-bar" id="sozaiScaleBar">縮尺：約 1:5,000</div>
      </div>

      <div class="page-footer">
        <div style="color:#333; font-size:7.5pt; line-height:1.3;">
          ※ 使用の本拠の位置（自宅・事業所等）及び保管場所（車庫）の位置を明記してください。<br>
          ※ 目標となる建物や付近の道路を明記してください。
        </div>
        <div style="font-size:9pt; font-weight:bold; color:#666;">（1 / 2 ページ）</div>
      </div>
    </div>

    <!-- 📄 2ページ目：配置図 -->
    <div class="a4-page-oss active-edit-target" id="page2Haichi" onclick="setActiveTarget('haichi')">
      <!-- OSS OCRヘッダー -->
      <div class="oss-ocr-header">
        <div style="display:flex; align-items:center;">
          <div class="ocr-digits" id="ocrDigitsD">0 1 1 0 4 7 0 1 5 6 5 0 0 0 0 0</div>
          <div class="ocr-code-box">D</div>
        </div>
        <div style="font-size:12pt; font-weight:bold; letter-spacing:4px;">配　置　図</div>
        <div class="oss-qr-box" id="haichiQRCode" title="OCR連動QRコード"></div>
      </div>

      <div class="box-title-bar">配　置　図　記　載　欄</div>
      <div class="page-canvas-container" id="haichiContainer">
        <div id="haichiMap" class="map-layer"></div>
        <canvas id="haichiCanvas" class="drawing-canvas"></canvas>
        <div class="map-zoom-bar print-hide">
          <button class="zoom-btn" onclick="zoomMap('haichi', 1)" title="拡大">➕</button>
          <button class="zoom-btn" onclick="zoomMap('haichi', -1)" title="縮小">➖</button>
        </div>
        <div class="canvas-mode-toggle print-hide">
          <button class="mode-btn active-mode" id="modeMap" onclick="setHaichiMode('map')" title="地図背景あり">🗺️ 地図</button>
          <button class="mode-btn" id="modeBlank" onclick="setHaichiMode('blank')" title="白紙キャンバス（略図用）">📝 白紙</button>
        </div>
        <div class="scale-bar" id="haichiScaleBar">縮尺：約 1:500</div>
      </div>

      <!-- 配置図フッター（店舗連絡先・登録番号・作成者・職印） -->
      <div class="page-footer">
        <div style="color:#000; font-size:7pt; line-height:1.25; max-width:480px;">
          備考 1. 保管場所に接する道路の幅員、保管場所の平面の寸法をメートルで記入すること。<br>
          　　 2. 複数の自動車を保管する駐車場所の場合は、保管場所を明示するほか保管場所番号を記載する。<br>
          　　 3. 使用の本拠の位置（自宅等）と保管場所の位置との間を線で結んで距離を記入する。
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <!-- 連絡先・店舗情報 -->
          <div style="display:flex; align-items:center; gap:4px; font-size:7.8pt;">
            <span style="font-weight:bold;">連絡先</span>
            <span id="dealerInfoDisplay" style="border-bottom:1px solid #000; min-width:180px; padding:0 4px; font-weight:bold; color:#000; letter-spacing:0.5px;">愛知トヨタ 江南店 TEL 0587-55-6311</span>
          </div>

          <!-- 登録番号欄 & シャッター & 作成者 & 職印 & ページ番号 -->
          <div style="display:flex; align-items:center; gap:5px; margin-top:2px;">
            <!-- 登録番号枠 -->
            <div style="display:flex; border:1.2px solid #000; font-size:7.5pt; height:22px; align-items:stretch;">
              <div style="background:#f8fafc; padding:2px 5px; font-weight:bold; border-right:1px solid #000; display:flex; align-items:center; letter-spacing:1px;">登録番号</div>
              <div id="regNoDisplay" style="min-width:70px; padding:2px 6px; display:flex; align-items:center; font-family:monospace; font-weight:bold;"></div>
            </div>

            <!-- シャッター -->
            <div class="shutter-box">
              <span>シャッター</span>
              <span id="shutterDisplayYes">有</span>
              <span>・</span>
              <span id="shutterDisplayNo" class="shutter-circle">無</span>
            </div>

            <!-- 作成者 -->
            <div id="officeInfoDisplay" style="font-size:7pt; font-weight:bold; text-align:right; line-height:1.15;">
              <div>行政書士法人フェリス</div>
              <div>0568-26-3713</div>
            </div>

            <!-- 職印（電子印画像） -->
            <div id="sealWrapper" style="position:relative; width:34px; height:34px; margin-top:-4px; margin-bottom:-4px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              <img src="電子印.png" id="sealImg" alt="行政書士法人フェリス之印" style="width:100%; height:100%; object-fit:contain; display:block;" onerror="this.style.display='none'; document.getElementById('sealFallbackBox').style.display='flex';">
              <div id="sealFallbackBox" style="display:none; border:1.2px solid #000; width:22px; height:22px; align-items:center; justify-content:center; font-size:5.5pt; font-weight:bold; text-align:center; line-height:1.0; padding:1px; background:#fff;">
                行政<br>書士
              </div>
            </div>

            <div style="font-size:8.5pt; font-weight:bold; color:#666; margin-left:2px;">（2 / 2 ページ）</div>
          </div>
        </div>
      </div>

    </div>

  </div>

</div>

<!-- ─── スクリプト本体 ─── -->
<script>
// ─── グローバル変数 ───
let sozaiMap, haichiMap;
let currentTool = 'select';
let sozaiCanvas, haichiCanvas;
let sozaiCtx, haichiCtx;
let haichiMode = 'map'; // 'map' or 'blank'
let activeTarget = 'haichi'; // 'sozai' or 'haichi'

let homeCoords = null;
let parkingCoords = null;

let drawings = {
  sozai: [],
  haichi: []
};

let stampList = [];

let isDrawing = false;
let isPanning = false;
let isDragging = false;
let dragTarget = null;
let selectedItemRef = null; // { targetKey, index }
let startX = 0, startY = 0;
let lastPanX = 0, lastPanY = 0;

// ─── 案件連携パラメータ ───
let linkedCaseId = null;
let linkedCaseTitle = null;

// ─── Undo/Redo 履歴管理 ───
const MAX_HISTORY = 50;
let historyStack = [];
let historyIndex = -1;

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1600);
}

function setActiveTarget(target) {
  activeTarget = target;
  const p1 = document.getElementById('page1Sozai');
  const p2 = document.getElementById('page2Haichi');
  const badge = document.getElementById('activePageBadge');
  
  if (target === 'sozai') {
    if (p1) p1.classList.add('active-edit-target');
    if (p2) p2.classList.remove('active-edit-target');
    if (badge) badge.textContent = '📍 1ページ目 (所在図) 作図中';
  } else {
    if (p1) p1.classList.remove('active-edit-target');
    if (p2) p2.classList.add('active-edit-target');
    if (badge) badge.textContent = '📐 2ページ目 (配置図) 作図中';
  }
}

function pushHistory() {
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(JSON.stringify(drawings));
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  historyIndex = historyStack.length - 1;
  autoSaveDraft();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    drawings = JSON.parse(historyStack[historyIndex]);
    selectedItemRef = null;
    hidePropertyPanel();
    redrawAll();
    autoSaveDraft();
    showToast('↩️ 1つ元に戻しました');
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    drawings = JSON.parse(historyStack[historyIndex]);
    selectedItemRef = null;
    hidePropertyPanel();
    redrawAll();
    autoSaveDraft();
    showToast('↪️ やり直しました');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initMaps();
  initCanvases();
  setupEventListeners();
  setupKeyboardShortcuts();
  loadStamps();
  updateQRCodes();
  updateFooterDealerInfo();
  updateFooterRegNo();
  updateFooterOfficeInfo();
  toggleSeal();
  
  // 1. URL経由での案件連携チェック
  const loadedFromCase = checkUrlCaseParams();

  // 2. 案件連携でなく、下書きもなければ初期サンプルをロード
  if (!loadedFromCase) {
    if (!restoreDraftFromStorage()) {
      loadKurodaSample();
    }
  }
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemRef && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      deleteSelectedItem();
    }
    if ((e.key === 'r' || e.key === 'R') && selectedItemRef && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      rotateSelectedItem(45);
    }
  });
}

// ─── フッター表示・職印の更新 ───
function updateFooterDealerInfo() {
  const input = document.getElementById('dealerInfoInput');
  const display = document.getElementById('dealerInfoDisplay');
  if (input && display) {
    display.textContent = input.value.trim() || '—';
  }
}

function updateFooterRegNo() {
  const input = document.getElementById('regNoInput');
  const display = document.getElementById('regNoDisplay');
  if (input && display) {
    display.textContent = input.value.trim();
  }
}

function updateFooterOfficeInfo() {
  const input = document.getElementById('officeInfoInput');
  const display = document.getElementById('officeInfoDisplay');
  if (input && display) {
    const val = input.value.trim();
    display.innerHTML = val.replace(/\s+/g, '<br>');
  }
}

function toggleSeal() {
  const chk = document.getElementById('showSealCheckbox');
  const seal = document.getElementById('sealWrapper');
  if (seal && chk) {
    seal.style.display = chk.checked ? 'flex' : 'none';
  }
}

function onSealSizeChange(val) {
  const size = parseInt(val, 10);
  const seal = document.getElementById('sealWrapper');
  const label = document.getElementById('sealSizeLabel');
  if (seal) {
    seal.style.width = size + 'px';
    seal.style.height = size + 'px';
  }
  if (label) {
    label.textContent = size + 'px';
  }
}

// ─── URL経由での案件データ連携処理 ───
function checkUrlCaseParams() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('caseId');
  const title = params.get('title');
  const home = params.get('home');
  const parking = params.get('parking');
  const name = params.get('name');
  const orderNo = params.get('orderNo');
  const regNo = params.get('regNo');
  const storeInfo = params.get('storeInfo');

  if (caseId) {
    linkedCaseId = caseId;
    linkedCaseTitle = title || name || `案件 #${caseId}`;

    const badge = document.getElementById('caseLinkedBadge');
    const saveBtn = document.getElementById('btnSaveToCase');
    if (badge) {
      badge.textContent = `📁 案件: ${linkedCaseTitle}`;
      badge.style.display = 'inline-block';
    }
    if (saveBtn) {
      saveBtn.style.display = 'inline-flex';
    }

    if (storeInfo) {
      document.getElementById('dealerInfoInput').value = storeInfo;
      updateFooterDealerInfo();
    }
    if (regNo) {
      document.getElementById('regNoInput').value = regNo;
      updateFooterRegNo();
    }

    // 保存済みの案件作図データがあるか確認
    const savedCaseData = localStorage.getItem('syako_case_map_' + caseId);
    if (savedCaseData) {
      try {
        const data = JSON.parse(savedCaseData);
        restoreProjectData(data);
        showToast(`📂 案件「${linkedCaseTitle}」の保存済み図面を読み込みました`);
        return true;
      } catch(e) {}
    }

    // 初回作成の場合：URLパラメータから住所と情報を自動反映
    if (home) {
      document.getElementById('homeAddress').value = home;
      if (parking) {
        document.getElementById('parkingAddress').value = parking;
        document.getElementById('sameAddress').checked = (home === parking);
      } else {
        document.getElementById('parkingAddress').value = home;
        document.getElementById('sameAddress').checked = true;
      }
      toggleSameAddress();
      setTimeout(() => {
        autoFetchMaps();
        showToast(`🗺️ 案件住所「${home}」の地図を自動取得しました`);
      }, 300);
      return true;
    }
  }
  return false;
}

// ─── ダッシュボードの案件に直接保存 ───
async function saveToCaseDirectly() {
  if (!linkedCaseId) {
    exportJSON();
    return;
  }

  showToast('💾 案件に作図データを保存中...');
  const ocr = document.getElementById('ocrCodeInput').value;
  const homeAddr = document.getElementById('homeAddress').value;
  const parkAddr = document.getElementById('parkingAddress').value;
  const sameAddr = document.getElementById('sameAddress').checked;
  const spotNo = document.getElementById('spotNo').value;
  const distance = document.getElementById('distanceVal').value;
  const spotWidth = document.getElementById('spotWidth').value;
  const spotLength = document.getElementById('spotLength').value;
  const roadWidth = document.getElementById('roadWidth').value;
  const entranceWidth = document.getElementById('entranceWidth').value;
  const shutter = document.getElementById('shutterVal').value;
  const layout = document.getElementById('layoutSelect').value;
  const dealerInfo = document.getElementById('dealerInfoInput').value;
  const regNo = document.getElementById('regNoInput').value;
  const officeInfo = document.getElementById('officeInfoInput').value;
  const showSeal = document.getElementById('showSealCheckbox').checked;
  const sealSize = parseInt(document.getElementById('sealSizeSlider').value, 10) || 34;

  const data = {
    version: '1.2',
    savedAt: new Date().toISOString(),
    caseId: linkedCaseId,
    caseTitle: linkedCaseTitle,
    formData: {
      ocr, homeAddr, parkAddr, sameAddr, spotNo, distance,
      spotWidth, spotLength, roadWidth, entranceWidth, shutter, layout, haichiMode,
      dealerInfo, regNo, officeInfo, showSeal, sealSize
    },
    mapState: {
      sozaiCenter: sozaiMap ? sozaiMap.getCenter() : null,
      sozaiZoom: sozaiMap ? sozaiMap.getZoom() : 15,
      haichiCenter: haichiMap ? haichiMap.getCenter() : null,
      haichiZoom: haichiMap ? haichiMap.getZoom() : 18
    },
    drawings: drawings,
    stampList: stampList
  };

  // 1. ベクターJSONをlocalStorageに保存
  localStorage.setItem('syako_case_map_' + linkedCaseId, JSON.stringify(data));

  // 2. ダッシュボード一覧のCaseオブジェクトを更新（parkingAddress等）
  try {
    const rawCases = localStorage.getItem('gyosei_cases');
    if (rawCases) {
      const cases = JSON.parse(rawCases);
      const idx = cases.findIndex(c => c.id == linkedCaseId);
      if (idx !== -1) {
        cases[idx].parkingAddress = parkAddr;
        if (regNo) cases[idx].carNumber = regNo;
        cases[idx].hasMapData = true;
        cases[idx].updatedAt = new Date().toISOString();
        localStorage.setItem('gyosei_cases', JSON.stringify(cases));
      }
    }
  } catch(e) {}

  // 3. サムネイル画像（配置図）を生成して保存
  try {
    const page2 = document.getElementById('page2Haichi');
    if (page2 && typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(page2, { scale: 1, useCORS: true, logging: false });
      const thumbUrl = canvas.toDataURL('image/png');
      localStorage.setItem('gyosei_case_map_png_' + linkedCaseId, thumbUrl);
    }
  } catch(e) {}

  // 4. 親ウィンドウ（ダッシュボード）に通知
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'MAP_SAVED', caseId: linkedCaseId }, '*');
    }
  } catch(e) {}

  showToast(`✅ 案件「${linkedCaseTitle}」に直接保存しました！`);
}

// ─── スタンプ管理（削除・追加・初期化） ───
const DEFAULT_STAMPS = ['⬅ 申請地', '自　宅', '保管場所', '駐車場', '5m道路', '出入口', 'ガレージ', '🚆 JR東海道本線', '🚆 名鉄名古屋本線', '🚧 踏切', '🚉 〇〇駅', '来客用', '軽自動車用', '県道186号', '私道', 'ブロック塀', '木曽川環境クリーン', '卍 福昌寺', 'JA', '鉄工所'];

function loadStamps() {
  try {
    const saved = localStorage.getItem('syako_map_maker_stamps_v3');
    if (saved) {
      stampList = JSON.parse(saved);
    } else {
      stampList = [...DEFAULT_STAMPS];
    }
  } catch(e) {
    stampList = [...DEFAULT_STAMPS];
  }
  renderStamps();
}

function renderStamps() {
  const container = document.getElementById('stampListContainer');
  if (!container) return;
  container.innerHTML = '';
  stampList.forEach((stamp, idx) => {
    const tag = document.createElement('div');
    tag.className = 'stamp-tag-item';
    tag.innerHTML = `
      <span class="stamp-tag-text" onclick="addTextStamp('${stamp.replace(/'/g, "\\'")}')" title="クリックして配置">${stamp}</span>
      <span class="stamp-tag-del" onclick="deleteStamp(${idx})" title="このスタンプを削除">×</span>
    `;
    container.appendChild(tag);
  });
}

function addNewStamp() {
  const input = document.getElementById('newStampInput');
  const text = input.value.trim();
  if (!text) return;
  if (!stampList.includes(text)) {
    stampList.push(text);
    localStorage.setItem('syako_map_maker_stamps_v3', JSON.stringify(stampList));
    renderStamps();
    showToast(`🏷️ 「${text}」をスタンプに追加しました`);
  }
  input.value = '';
}

function deleteStamp(index) {
  const removed = stampList.splice(index, 1);
  localStorage.setItem('syako_map_maker_stamps_v3', JSON.stringify(stampList));
  renderStamps();
  showToast(`🗑️ 「${removed[0]}」を削除しました`);
}

function resetDefaultStamps() {
  if (confirm('スタンプ一覧を初期状態に戻しますか？')) {
    stampList = [...DEFAULT_STAMPS];
    localStorage.setItem('syako_map_maker_stamps_v3', JSON.stringify(stampList));
    renderStamps();
    showToast('🔄 スタンプ一覧を初期化しました');
  }
}

// ─── 選択中要素のプロパティパネル操作（回転・サイズ変更・テキスト編集） ───
function showPropertyPanel(targetKey, index) {
  selectedItemRef = { targetKey, index };
  const panel = document.getElementById('propertyPanel');
  const typeLabel = document.getElementById('selectedItemTypeLabel');
  if (!panel || !typeLabel) return;

  const item = drawings[targetKey][index];
  if (!item) return;

  const typeNames = {
    'rect-spot': '🅿️ 保管場所枠',
    'rect-other': '🔲 建物・自宅枠',
    'compass': '🧭 JIS方位記号',
    'car': '🚗 車両マーク',
    'text': `🔤 文字: 「${item.text || ''}」`,
    'line-dim': `📏 寸法線: 「${item.text || ''}」`,
    'arrow': '➡️ 出入口矢印',
    'line-road': '🛣️ 道路境界線',
    'line-rail': `🚆 線路: 「${item.text || ''}」`,
    'dist-line': `📍 距離線: 「${item.text || ''}」`
  };

  typeLabel.textContent = `🎯 選択中: ${typeNames[item.type] || item.type} (角度: ${Math.round(item.angle || 0)}°)`;
  panel.classList.add('active');
}

function hidePropertyPanel() {
  selectedItemRef = null;
  const panel = document.getElementById('propertyPanel');
  if (panel) panel.classList.remove('active');
}

function rotateSelectedItem(delta) {
  if (!selectedItemRef) return;
  const { targetKey, index } = selectedItemRef;
  const item = drawings[targetKey][index];
  if (!item) return;

  pushHistory();
  item.angle = ((item.angle || 0) + delta + 360) % 360;
  pushHistory();
  redraw(targetKey);
  drawSelectionHighlight(targetKey, index);
  showPropertyPanel(targetKey, index);
  showToast(`🔄 角度を ${Math.round(item.angle)}° に変更しました`);
}

function setSelectedItemAngle(angle) {
  if (!selectedItemRef) return;
  const { targetKey, index } = selectedItemRef;
  const item = drawings[targetKey][index];
  if (!item) return;

  pushHistory();
  item.angle = angle % 360;
  pushHistory();
  redraw(targetKey);
  drawSelectionHighlight(targetKey, index);
  showPropertyPanel(targetKey, index);
  showToast(`🔄 角度を ${angle}° に設定しました`);
}

function scaleSelectedItem(factor) {
  if (!selectedItemRef) return;
  const { targetKey, index } = selectedItemRef;
  const item = drawings[targetKey][index];
  if (!item) return;

  pushHistory();
  if (item.type.startsWith('rect') || item.type === 'car') {
    const oldW = item.w || 60;
    const oldH = item.h || 60;
    item.w = Math.max(20, Math.round(oldW * factor));
    item.h = Math.max(20, Math.round(oldH * factor));
    item.x -= (item.w - oldW) / 2;
    item.y -= (item.h - oldH) / 2;
  } else if (item.type === 'compass') {
    item.size = Math.max(16, Math.min(80, Math.round((item.size || 28) * factor)));
  } else if (item.type === 'text') {
    item.fontSize = Math.max(10, Math.min(48, Math.round((item.fontSize || 14) * factor)));
  } else if (item.type.startsWith('line') || item.type === 'arrow' || item.type === 'dist-line') {
    const cx = (item.x1 + item.x2) / 2;
    const cy = (item.y1 + item.y2) / 2;
    const dx = (item.x2 - item.x1) * factor / 2;
    const dy = (item.y2 - item.y1) * factor / 2;
    item.x1 = cx - dx;
    item.y1 = cy - dy;
    item.x2 = cx + dx;
    item.y2 = cy + dy;
  }
  pushHistory();
  redraw(targetKey);
  drawSelectionHighlight(targetKey, index);
  showToast('📏 サイズを調整しました');
}

function editSelectedText() {
  if (!selectedItemRef) return;
  const { targetKey, index } = selectedItemRef;
  const item = drawings[targetKey][index];
  if (!item) return;

  const curText = item.text || item.label || '';
  const newText = prompt('テキストまたは数値を変更してください:', curText);
  if (newText !== null) {
    pushHistory();
    if (item.type === 'text' || item.type === 'line-dim' || item.type === 'dist-line' || item.type === 'line-rail') {
      item.text = newText;
    } else if (item.label !== undefined) {
      item.label = newText;
    }
    pushHistory();
    redraw(targetKey);
    drawSelectionHighlight(targetKey, index);
    showPropertyPanel(targetKey, index);
    showToast(`✏️ 「${newText}」に更新しました`);
  }
}

function deleteSelectedItem() {
  if (!selectedItemRef) return;
  const { targetKey, index } = selectedItemRef;
  pushHistory();
  drawings[targetKey].splice(index, 1);
  pushHistory();
  hidePropertyPanel();
  redraw(targetKey);
  showToast('🗑️ 要素を削除しました');
}

// ─── OSS OCR連動 QRコード動的生成 ───
function updateQRCodes() {
  const ocrInput = document.getElementById('ocrCodeInput');
  const code = (ocrInput ? ocrInput.value.replace(/\s+/g, '') : '') || '0110470156500000';

  const sozaiEl = document.getElementById('sozaiQRCode');
  const haichiEl = document.getElementById('haichiQRCode');

  if (sozaiEl) {
    sozaiEl.innerHTML = '';
    try {
      new QRCode(sozaiEl, {
        text: code,
        width: 34,
        height: 34,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.M : 0
      });
    } catch(e){}
  }

  if (haichiEl) {
    haichiEl.innerHTML = '';
    try {
      new QRCode(haichiEl, {
        text: code,
        width: 34,
        height: 34,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.M : 0
      });
    } catch(e){}
  }
}

let sozaiTileLayer, haichiTileLayer;
const TILE_URLS = {
  'osm-transit': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'gsi-std': 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
  'osm': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'gsi-pale': 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
};

function changeMapTile(type) {
  const url = TILE_URLS[type] || TILE_URLS['gsi-std'];
  const maxNative = (type === 'osm') ? 19 : 18;
  if (sozaiTileLayer && sozaiMap) sozaiMap.removeLayer(sozaiTileLayer);
  if (haichiTileLayer && haichiMap) haichiMap.removeLayer(haichiTileLayer);

  if (sozaiMap) {
    sozaiTileLayer = L.tileLayer(url, { minZoom: 3, maxZoom: 23, maxNativeZoom: maxNative }).addTo(sozaiMap);
  }
  if (haichiMap) {
    haichiTileLayer = L.tileLayer(url, { minZoom: 3, maxZoom: 23, maxNativeZoom: maxNative }).addTo(haichiMap);
  }
  showToast(`🗺️ 地図を切り替えました: ${type === 'osm' ? 'OSM' : '国土地理院'}`);
}

function onContrastSliderChange(val) {
  const contrast = parseInt(val, 10);
  applyMapContrast(contrast);
}

function setContrastPreset(contrast) {
  const slider = document.getElementById('contrastSlider');
  if (slider) slider.value = contrast;
  applyMapContrast(contrast);
  autoSaveDraft();
  showToast(`🖤 道路の濃さを ${contrast}% に設定しました`);
}

function applyMapContrast(contrast) {
  const label = document.getElementById('contrastLabel');
  const sozaiMapEl = document.getElementById('sozaiMap');
  const haichiMapEl = document.getElementById('haichiMap');
  
  const brightness = Math.max(70, Math.round(100 - (contrast - 100) * 0.1));
  const filterStr = `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`;

  if (sozaiMapEl) sozaiMapEl.style.filter = filterStr;
  if (haichiMapEl) haichiMapEl.style.filter = filterStr;

  let desc = '標準';
  if (contrast >= 280) desc = '超くっきり';
  else if (contrast >= 180) desc = '濃いめ';
  else if (contrast < 150) desc = '薄め';

  if (label) label.textContent = `${contrast}%（${desc}）`;
}

function initMaps() {
  const kurodaLat = 35.3725;
  const kurodaLng = 136.7820;

  sozaiMap = L.map('sozaiMap', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: true,
    minZoom: 3,
    maxZoom: 23,
    zoomSnap: 0.25,
    zoomDelta: 0.5
  }).setView([kurodaLat, kurodaLng], 15);

  sozaiTileLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    minZoom: 3,
    maxZoom: 23,
    maxNativeZoom: 18
  }).addTo(sozaiMap);

  haichiMap = L.map('haichiMap', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: true,
    minZoom: 3,
    maxZoom: 23,
    zoomSnap: 0.25,
    zoomDelta: 0.5
  }).setView([kurodaLat, kurodaLng], 18);

  haichiTileLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    minZoom: 3,
    maxZoom: 23,
    maxNativeZoom: 18
  }).addTo(haichiMap);

  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 120 }).addTo(sozaiMap);
  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 120 }).addTo(haichiMap);

  applyMapContrast(200);

  sozaiMap.on('zoomend', () => {
    const z = sozaiMap.getZoom();
    const slider = document.getElementById('sozaiZoomSlider');
    const label = document.getElementById('sozaiZoomLabel');
    if (slider) slider.value = z;
    if (label) label.textContent = `Zoom: ${z.toFixed(1)}`;
    updateScaleBar('sozai', z);
    autoSaveDraft();
  });

  haichiMap.on('zoomend', () => {
    const z = haichiMap.getZoom();
    const slider = document.getElementById('haichiZoomSlider');
    const label = document.getElementById('haichiZoomLabel');
    if (slider) slider.value = z;
    if (label) label.textContent = `Zoom: ${z.toFixed(1)}`;
    updateScaleBar('haichi', z);
    autoSaveDraft();
  });

  sozaiMap.on('moveend', () => autoSaveDraft());
  haichiMap.on('moveend', () => autoSaveDraft());
}

function onZoomSliderChange(target, val) {
  const z = parseFloat(val);
  if (target === 'sozai') {
    sozaiMap.setZoom(z);
    document.getElementById('sozaiZoomLabel').textContent = `Zoom: ${z.toFixed(1)}`;
  } else {
    haichiMap.setZoom(z);
    document.getElementById('haichiZoomLabel').textContent = `Zoom: ${z.toFixed(1)}`;
  }
}

function setMapZoomLevel(target, z) {
  if (target === 'sozai') {
    sozaiMap.setZoom(z);
  } else {
    haichiMap.setZoom(z);
  }
}

function zoomMap(target, delta) {
  const map = target === 'sozai' ? sozaiMap : haichiMap;
  if (delta > 0) {
    map.zoomIn();
  } else {
    map.zoomOut();
  }
}

function initCanvases() {
  sozaiCanvas = document.getElementById('sozaiCanvas');
  haichiCanvas = document.getElementById('haichiCanvas');
  sozaiCtx = sozaiCanvas.getContext('2d');
  haichiCtx = haichiCanvas.getContext('2d');

  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
}

function resizeCanvases() {
  const sContainer = document.getElementById('sozaiContainer');
  const hContainer = document.getElementById('haichiContainer');

  if (sContainer && sozaiCanvas) {
    sozaiCanvas.width = sContainer.clientWidth;
    sozaiCanvas.height = sContainer.clientHeight;
  }
  if (hContainer && haichiCanvas) {
    haichiCanvas.width = hContainer.clientWidth;
    haichiCanvas.height = hContainer.clientHeight;
  }

  redrawAll();
}

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add('active');

  const isDraw = tool !== 'select' && tool !== 'eraser';
  if (sozaiCanvas) sozaiCanvas.classList.toggle('drawing-mode', isDraw);
  if (haichiCanvas) haichiCanvas.classList.toggle('drawing-mode', isDraw);

  if (tool !== 'select') {
    hidePropertyPanel();
  }

  const toolLabels = {
    'select': '選択 / 移動 モード（要素をクリックで調整バー表示）',
    'rect-spot': '保管場所枠 描画（ドラッグまたはクリック）',
    'rect-other': '建物枠 描画（ドラッグまたはクリック）',
    'line-dim': '寸法線 描画（ドラッグまたはクリック）',
    'line-road': '道路境界線 描画（ドラッグまたはクリック）',
    'line-rail': '線路(鉄道記号) 描画（ドラッグまたはクリック）',
    'arrow': '出入口 矢印（ドラッグまたはクリック）',
    'compass': 'JIS方位記号 配置（クリック）',
    'car': '車両マーク 配置（クリック）',
    'text': '文字入力（クリック）',
    'dist-line': '直線距離線（ドラッグまたはクリック）',
    'eraser': '要素削除（クリックで削除）'
  };
  showToast(toolLabels[tool] || tool);
}

function setupEventListeners() {
  setupCanvasEvents(sozaiCanvas, 'sozai');
  setupCanvasEvents(haichiCanvas, 'haichi');
}

function setupCanvasEvents(canvas, targetKey) {
  const map = targetKey === 'sozai' ? sozaiMap : haichiMap;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      map.zoomIn(1);
    } else {
      map.zoomOut(1);
    }
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    setActiveTarget(targetKey);
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    lastPanX = e.clientX;
    lastPanY = e.clientY;

    if (currentTool === 'select') {
      const hitResult = hitTestElement(targetKey, startX, startY);
      if (hitResult !== null) {
        isDragging = true;
        const item = drawings[targetKey][hitResult];
        let ox = 0, oy = 0;
        if (item.type.startsWith('rect') || item.type === 'compass' || item.type === 'car' || item.type === 'text') {
          ox = startX - item.x;
          oy = startY - item.y;
        } else {
          ox = startX - (item.x1 + item.x2) / 2;
          oy = startY - (item.y1 + item.y2) / 2;
        }
        dragTarget = { targetKey, index: hitResult, offsetX: ox, offsetY: oy };
        pushHistory();
        canvas.style.cursor = 'move';
        redraw(targetKey);
        drawSelectionHighlight(targetKey, hitResult);
        showPropertyPanel(targetKey, hitResult);
        return;
      }
      hidePropertyPanel();
      isPanning = true;
      canvas.style.cursor = 'grabbing';
      return;
    }

    isDrawing = true;

    if (currentTool === 'compass') {
      pushHistory();
      drawings[targetKey].push({
        type: 'compass',
        x: startX,
        y: startY,
        size: 28,
        angle: 0
      });
      pushHistory();
      redraw(targetKey);
      isDrawing = false;
      showToast('🧭 JIS方位記号を配置しました');
      showPropertyPanel(targetKey, drawings[targetKey].length - 1);
    } else if (currentTool === 'car') {
      pushHistory();
      drawings[targetKey].push({
        type: 'car',
        x: startX - 25,
        y: startY - 45,
        w: 50,
        h: 90,
        angle: 0
      });
      pushHistory();
      redraw(targetKey);
      isDrawing = false;
      showToast('🚗 車両マークを配置しました');
      showPropertyPanel(targetKey, drawings[targetKey].length - 1);
    } else if (currentTool === 'text') {
      const text = prompt('挿入するテキストを入力してください:', '幅員 5.0m');
      if (text) {
        pushHistory();
        drawings[targetKey].push({
          type: 'text',
          x: startX,
          y: startY,
          text: text,
          fontSize: 14,
          color: '#000000',
          angle: 0
        });
        pushHistory();
        redraw(targetKey);
        showToast(`🔤 「${text}」を配置しました`);
        showPropertyPanel(targetKey, drawings[targetKey].length - 1);
      }
      isDrawing = false;
    } else if (currentTool === 'eraser') {
      pushHistory();
      deleteNearElement(targetKey, startX, startY);
      pushHistory();
      isDrawing = false;
      redraw(targetKey);
      showToast('🧹 要素を削除しました');
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (isDragging && dragTarget && dragTarget.targetKey === targetKey) {
      const item = drawings[targetKey][dragTarget.index];
      if (item.type.startsWith('rect') || item.type === 'compass' || item.type === 'car' || item.type === 'text') {
        item.x = curX - dragTarget.offsetX;
        item.y = curY - dragTarget.offsetY;
      } else {
        const cx = (item.x1 + item.x2) / 2;
        const cy = (item.y1 + item.y2) / 2;
        const dx = (curX - dragTarget.offsetX) - cx;
        const dy = (curY - dragTarget.offsetY) - cy;
        item.x1 += dx; item.y1 += dy;
        item.x2 += dx; item.y2 += dy;
      }
      redraw(targetKey);
      drawSelectionHighlight(targetKey, dragTarget.index);
      return;
    }

    if (isPanning && currentTool === 'select') {
      const dx = e.clientX - lastPanX;
      const dy = e.clientY - lastPanY;
      map.panBy([-dx, -dy], { animate: false });
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }

    if (!isDrawing) return;

    redraw(targetKey);
    drawPreview(targetKey, startX, startY, curX, curY);
  });

  canvas.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      pushHistory();
      canvas.style.cursor = 'grab';
      dragTarget = null;
      redraw(targetKey);
      return;
    }

    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = 'grab';
      return;
    }

    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const dragDist = Math.hypot(endX - startX, endY - startY);

    pushHistory();

    let newIndex = drawings[targetKey].length;

    if (currentTool === 'rect-spot') {
      const sNo = document.getElementById('spotNo').value.trim();
      const labelText = sNo ? `${sNo}\\n保管場所` : '保管場所';
      const w = dragDist < 8 ? 100 : Math.abs(endX - startX);
      const h = dragDist < 8 ? 120 : Math.abs(endY - startY);
      const x = dragDist < 8 ? startX - 50 : Math.min(startX, endX);
      const y = dragDist < 8 ? startY - 60 : Math.min(startY, endY);

      drawings[targetKey].push({
        type: 'rect-spot',
        x, y, w, h,
        label: labelText,
        angle: 0
      });
      showToast('🅿️ 保管場所枠を作成しました');
    } else if (currentTool === 'rect-other') {
      const w = dragDist < 8 ? 140 : Math.abs(endX - startX);
      const h = dragDist < 8 ? 140 : Math.abs(endY - startY);
      const x = dragDist < 8 ? startX - 70 : Math.min(startX, endX);
      const y = dragDist < 8 ? startY - 70 : Math.min(startY, endY);

      drawings[targetKey].push({
        type: 'rect-other',
        x, y, w, h,
        angle: 0
      });
      showToast('🔲 建物枠を作成しました');
    } else if (currentTool === 'line-dim') {
      const dimText = prompt('寸法を入力（例: 2.0m, 5.0m）:', '5.0m');
      const eX = dragDist < 8 ? startX + 100 : endX;
      const eY = dragDist < 8 ? startY : endY;
      drawings[targetKey].push({
        type: 'line-dim',
        x1: startX, y1: startY, x2: eX, y2: eY,
        text: dimText || '5.0m',
        angle: 0
      });
      showToast('📏 寸法線を描画しました');
    } else if (currentTool === 'arrow') {
      const eX = dragDist < 8 ? startX + 60 : endX;
      const eY = dragDist < 8 ? startY : endY;
      drawings[targetKey].push({
        type: 'arrow',
        x1: startX, y1: startY, x2: eX, y2: eY,
        label: '出入口',
        angle: 0
      });
      showToast('➡️ 出入口矢印を描画しました');
    } else if (currentTool === 'line-road') {
      const eX = dragDist < 8 ? startX + 150 : endX;
      const eY = dragDist < 8 ? startY : endY;
      drawings[targetKey].push({
        type: 'line-road',
        x1: startX, y1: startY, x2: eX, y2: eY,
        angle: 0
      });
      showToast('🛣️ 道路境界線を描画しました');
    } else if (currentTool === 'line-rail') {
      const railName = prompt('路線名を入力（例: JR東海道本線, 名鉄名古屋本線, 踏切など / 空欄可）:', 'JR東海道本線');
      const eX = dragDist < 8 ? startX + 200 : endX;
      const eY = dragDist < 8 ? startY : endY;
      drawings[targetKey].push({
        type: 'line-rail',
        x1: startX, y1: startY, x2: eX, y2: eY,
        text: railName || '',
        angle: 0
      });
      showToast('🚆 線路（鉄道記号）を描画しました');
    } else if (currentTool === 'dist-line') {
      const dist = document.getElementById('distanceVal').value || '約350m';
      const eX = dragDist < 8 ? startX + 150 : endX;
      const eY = dragDist < 8 ? startY : endY;
      drawings[targetKey].push({
        type: 'dist-line',
        x1: startX, y1: startY, x2: eX, y2: eY,
        text: dist,
        angle: 0
      });
      showToast('📍 直線距離線を描画しました');
    }

    pushHistory();
    redraw(targetKey);
    showPropertyPanel(targetKey, newIndex);
  });
}

function hitTestElement(targetKey, x, y) {
  const items = drawings[targetKey];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type.startsWith('rect') || it.type === 'car') {
      if (x >= it.x - 5 && x <= it.x + it.w + 5 && y >= it.y - 5 && y <= it.y + it.h + 5) {
        return i;
      }
    } else if (it.type === 'compass') {
      const s = it.size || 28;
      if (Math.hypot(it.x - x, it.y - y) <= s * 1.3) {
        return i;
      }
    } else if (it.type === 'text') {
      if (Math.hypot(it.x - x, it.y - y) < 45) {
        return i;
      }
    } else if (it.type.startsWith('line') || it.type === 'arrow' || it.type === 'dist-line') {
      const dist = Math.hypot((it.x1 + it.x2) / 2 - x, (it.y1 + it.y2) / 2 - y);
      if (dist < 30) {
        return i;
      }
    }
  }
  return null;
}

function drawSelectionHighlight(targetKey, index) {
  const ctx = targetKey === 'sozai' ? sozaiCtx : haichiCtx;
  const item = drawings[targetKey][index];
  if (!ctx || !item) return;
  ctx.save();
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);

  if (item.type.startsWith('rect') || item.type === 'car') {
    ctx.strokeRect(item.x - 4, item.y - 4, item.w + 8, item.h + 8);
  } else if (item.type === 'compass') {
    const s = item.size || 28;
    ctx.beginPath();
    ctx.arc(item.x, item.y, s + 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (item.type === 'text') {
    ctx.strokeRect(item.x - 6, item.y - 18, 110, 24);
  } else {
    const mx = (item.x1 + item.x2) / 2;
    const my = (item.y1 + item.y2) / 2;
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function redrawAll() {
  redraw('sozai');
  redraw('haichi');
}

function redraw(targetKey) {
  const canvas = targetKey === 'sozai' ? sozaiCanvas : haichiCanvas;
  const ctx = targetKey === 'sozai' ? sozaiCtx : haichiCtx;
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const items = drawings[targetKey] || [];
  items.forEach(item => {
    drawElement(ctx, item);
  });
}

function drawPreview(targetKey, x1, y1, x2, y2) {
  const ctx = targetKey === 'sozai' ? sozaiCtx : haichiCtx;
  if (!ctx) return;
  ctx.save();
  ctx.strokeStyle = '#2563EB';
  ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  if (currentTool === 'rect-spot' || currentTool === 'rect-other') {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (currentTool.startsWith('line') || currentTool === 'arrow' || currentTool === 'dist-line') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawElement(ctx, item) {
  ctx.save();

  // 回転の適用
  if (item.angle) {
    let cx = item.x, cy = item.y;
    if (item.type.startsWith('rect') || item.type === 'car') {
      cx = item.x + item.w / 2;
      cy = item.y + item.h / 2;
    } else if (item.type.startsWith('line') || item.type === 'arrow' || item.type === 'dist-line') {
      cx = (item.x1 + item.x2) / 2;
      cy = (item.y1 + item.y2) / 2;
    }
    ctx.translate(cx, cy);
    ctx.rotate(item.angle * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }

  if (item.type === 'rect-spot') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(item.x, item.y, item.w, item.h);

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let offset = -item.h; offset < item.w; offset += 8) {
      ctx.moveTo(Math.max(item.x, item.x + offset), Math.max(item.y, item.y - offset));
      ctx.lineTo(Math.min(item.x + item.w, item.x + offset + item.h), Math.min(item.y + item.h, item.y + item.h));
    }
    ctx.stroke();
    ctx.restore();

    const labelText = item.label || '保管場所';
    const lines = labelText.split('\\n');
    ctx.fillStyle = '#FFFFFF';
    const boxH = lines.length * 15 + 4;
    const boxW = Math.max(...lines.map(l => l.length * 12)) + 12;
    ctx.fillRect(item.x + item.w / 2 - boxW / 2, item.y + item.h / 2 - boxH / 2, boxW, boxH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(item.x + item.w / 2 - boxW / 2, item.y + item.h / 2 - boxH / 2, boxW, boxH);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    lines.forEach((line, idx) => {
      ctx.fillText(line, item.x + item.w / 2, item.y + item.h / 2 - boxH / 2 + 13 + idx * 14);
    });
  } else if (item.type === 'rect-other') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
  } else if (item.type === 'line-dim') {
    drawDimensionLine(ctx, item.x1, item.y1, item.x2, item.y2, item.text);
  } else if (item.type === 'arrow') {
    drawArrow(ctx, item.x1, item.y1, item.x2, item.y2, '#000000', 2.5);
    if (item.label) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, (item.x1 + item.x2) / 2, Math.min(item.y1, item.y2) - 6);
    }
  } else if (item.type === 'line-road') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(item.x1, item.y1);
    ctx.lineTo(item.x2, item.y2);
    ctx.stroke();
  } else if (item.type === 'line-rail') {
    drawRailwayTrack(ctx, item.x1, item.y1, item.x2, item.y2, item.text);
  } else if (item.type === 'dist-line') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(item.x1, item.y1);
    ctx.lineTo(item.x2, item.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (item.text) {
      const midX = (item.x1 + item.x2) / 2;
      const midY = (item.y1 + item.y2) / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(midX - 45, midY - 10, 90, 20);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(midX - 45, midY - 10, 90, 20);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.text, midX, midY + 4);
    }
  } else if (item.type === 'compass') {
    drawVectorCompass(ctx, item.x, item.y, item.size || 28);
  } else if (item.type === 'car') {
    drawCarSilhouette(ctx, item.x, item.y, item.w || 50, item.h || 90);
  } else if (item.type === 'text') {
    ctx.fillStyle = item.color || '#000000';
    ctx.font = `bold ${item.fontSize || 14}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(item.text, item.x, item.y);
  }
  ctx.restore();
}

function drawVectorCompass(ctx, cx, cy, size = 28) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.7, 0);
  ctx.lineTo(size * 0.7, 0);
  ctx.moveTo(0, size * 0.7);
  ctx.lineTo(0, -size * 0.7);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(size * 0.35, 0);
  ctx.lineTo(0, -size * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(0, -size * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(size * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -size * 1.05);

  ctx.restore();
}

function drawCarSilhouette(ctx, x, y, w = 50, h = 90) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#F1F5F9';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#CBD5E1';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.25);
  ctx.lineTo(w * 0.85, h * 0.25);
  ctx.lineTo(w * 0.75, h * 0.4);
  ctx.lineTo(w * 0.25, h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.75);
  ctx.lineTo(w * 0.8, h * 0.75);
  ctx.lineTo(w * 0.85, h * 0.85);
  ctx.lineTo(w * 0.15, h * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.fillRect(-2, h * 0.18, 4, h * 0.16);
  ctx.fillRect(w - 2, h * 0.18, 4, h * 0.16);
  ctx.fillRect(-2, h * 0.65, 4, h * 0.16);
  ctx.fillRect(w - 2, h * 0.65, 4, h * 0.16);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('車両', w / 2, h * 0.6);

  ctx.restore();
}

function drawArrow(ctx, fromX, fromY, toX, toY, color = '#000', width = 2) {
  const headLen = 12;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDimensionLine(ctx, x1, y1, x2, y2, text) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const headLen = 8;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + headLen * Math.cos(angle - Math.PI / 6), y1 + headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x1 + headLen * Math.cos(angle + Math.PI / 6), y1 + headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (text) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(midX - textWidth / 2 - 3, midY - 9, textWidth + 6, 18);

    ctx.fillStyle = '#000000';
    ctx.fillText(text, midX, midY + 5);
  }
  ctx.restore();
}

function drawRailwayTrack(ctx, x1, y1, x2, y2, text) {
  ctx.save();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) { ctx.restore(); return; }

  const angle = Math.atan2(dy, dx);

  // 1. 黒の土台ライン
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 2. 白の内側点線（黒白のストライプ鉄道記号 ──■──□──）
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. 枕木（クロスライン）
  const tieSpacing = 16;
  const tieLen = 10;
  const nx = -Math.sin(angle) * (tieLen / 2);
  const ny = Math.cos(angle) * (tieLen / 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let d = 4; d <= len; d += tieSpacing) {
    const px = x1 + (dx / len) * d;
    const py = y1 + (dy / len) * d;
    ctx.moveTo(px - nx, py - ny);
    ctx.lineTo(px + nx, py + ny);
  }
  ctx.stroke();

  // 4. 路線名ラベル
  if (text) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(midX - tw / 2 - 4, midY - 9, tw + 8, 18);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(midX - tw / 2 - 4, midY - 9, tw + 8, 18);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, midX, midY + 5);
  }
  ctx.restore();
}

function addTextStamp(text) {
  pushHistory();
  const targetCanvas = activeTarget === 'sozai' ? sozaiCanvas : haichiCanvas;
  const cx = targetCanvas.width / 2;
  const cy = targetCanvas.height / 2;
  
  const newIndex = drawings[activeTarget].length;
  drawings[activeTarget].push({
    type: 'text',
    x: cx - 35,
    y: cy,
    text: text,
    fontSize: 14,
    color: '#000000',
    angle: 0
  });
  pushHistory();
  redraw(activeTarget);
  showToast(`「${text}」を配置しました`);
  showPropertyPanel(activeTarget, newIndex);
}

function deleteNearElement(targetKey, x, y) {
  const items = drawings[targetKey];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type.startsWith('rect') && x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) {
      items.splice(i, 1);
      break;
    } else if (it.type === 'compass' && Math.hypot(it.x - x, it.y - y) <= (it.size || 28) * 1.3) {
      items.splice(i, 1);
      break;
    } else if (it.type === 'car' && x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) {
      items.splice(i, 1);
      break;
    } else if (it.type.startsWith('line') || it.type === 'arrow' || it.type === 'dist-line') {
      const dist = Math.hypot((it.x1 + it.x2) / 2 - x, (it.y1 + it.y2) / 2 - y);
      if (dist < 30) {
        items.splice(i, 1);
        break;
      }
    } else if (it.type === 'text') {
      if (Math.hypot(it.x - x, it.y - y) < 40) {
        items.splice(i, 1);
        break;
      }
    }
  }
}

// ─── 住所検索 ───
async function fetchCoords(rawQuery) {
  let q = rawQuery.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();
  try {
    const gsiRes = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`);
    const gsiData = await gsiRes.json();
    if (gsiData && gsiData.length > 0) {
      const coord = gsiData[0].geometry.coordinates;
      return { lat: coord[1], lon: coord[0] };
    }
  } catch (e) {}

  const simplified = q.replace(/[0-9０-９]+番地?[0-9０-９]*号?.*$/, '')
                      .replace(/[0-9０-９]+-[0-9０-９]+.*$/, '')
                      .replace(/[0-9０-９]+丁目.*$/, '');
  if (simplified && simplified !== q) {
    try {
      const gsiRes2 = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(simplified)}`);
      const gsiData2 = await gsiRes2.json();
      if (gsiData2 && gsiData2.length > 0) {
        const coord = gsiData2[0].geometry.coordinates;
        return { lat: coord[1], lon: coord[0] };
      }
    } catch (e) {}
  }
  return null;
}

async function searchAddress(type) {
  const inputId = type === 'home' ? 'homeAddress' : 'parkingAddress';
  const query = document.getElementById(inputId).value.trim();
  if (!query) return;

  const coord = await fetchCoords(query);
  if (coord) {
    if (type === 'home') {
      sozaiMap.setView([coord.lat, coord.lon], 16);
      homeCoords = coord;
    } else {
      haichiMap.setView([coord.lat, coord.lon], 18);
      sozaiMap.setView([coord.lat, coord.lon], 16);
      parkingCoords = coord;
    }
    autoSaveDraft();
    showToast(`📍 「${query}」の地図を取得しました`);
  } else {
    alert(`「${query}」の座標が見つかりませんでした。\\n地図をドラッグして位置を調整してください。`);
  }
}

function autoFetchMaps() {
  searchAddress('home');
  searchAddress('parking');
}

function toggleSameAddress() {
  const isSame = document.getElementById('sameAddress').checked;
  if (isSame) {
    document.getElementById('parkingAddress').value = document.getElementById('homeAddress').value;
    document.getElementById('distanceVal').value = '同上 (0m)';
    homeCoords = null;
    parkingCoords = null;
  } else {
    document.getElementById('distanceVal').value = '約 350m';
  }
}

function updateShutterDisplay() {
  const val = document.getElementById('shutterVal').value;
  const yes = document.getElementById('shutterDisplayYes');
  const no = document.getElementById('shutterDisplayNo');
  if (val === '有') {
    yes.className = 'shutter-circle';
    no.className = '';
  } else {
    yes.className = '';
    no.className = 'shutter-circle';
  }
}

function updateOCRDisplay() {
  const val = document.getElementById('ocrCodeInput').value;
  const digitC = document.getElementById('ocrDigitsC');
  const digitD = document.getElementById('ocrDigitsD');
  if (digitC) digitC.textContent = val;
  if (digitD) digitD.textContent = val;
}

function setHaichiMode(mode) {
  haichiMode = mode;
  const mapLayer = document.getElementById('haichiMap');
  const container = document.getElementById('haichiContainer');
  const btnMap = document.getElementById('modeMap');
  const btnBlank = document.getElementById('modeBlank');
  const scaleBar = document.getElementById('haichiScaleBar');

  if (mode === 'blank') {
    mapLayer.classList.add('blank-mode');
    container.classList.add('grid-bg');
    btnMap.classList.remove('active-mode');
    btnBlank.classList.add('active-mode');
    if (scaleBar) scaleBar.style.display = 'none';
    showToast('📝 白紙キャンバスモードに切り替えました');
  } else {
    mapLayer.classList.remove('blank-mode');
    container.classList.remove('grid-bg');
    btnMap.classList.add('active-mode');
    btnBlank.classList.remove('active-mode');
    if (scaleBar) scaleBar.style.display = 'block';
    showToast('🗺️ 地図背景モードに切り替えました');
  }
  autoSaveDraft();
}

function updateScaleBar(target, zoom) {
  const scaleMap = {
    10: '1:500,000', 11: '1:250,000', 12: '1:150,000',
    13: '1:70,000', 14: '1:35,000', 15: '1:18,000',
    16: '1:9,000', 17: '1:4,500', 18: '1:2,000',
    19: '1:1,000', 20: '1:500', 21: '1:250', 22: '1:125'
  };
  const roundedZoom = Math.round(zoom);
  const scale = scaleMap[roundedZoom] || `Zoom ${zoom.toFixed(1)}`;
  const barId = target === 'sozai' ? 'sozaiScaleBar' : 'haichiScaleBar';
  const bar = document.getElementById(barId);
  if (bar) bar.textContent = `縮尺：約 ${scale}`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── 距離算出 ＆ 2地点自動プロット ───
async function calcDistance(shouldPlot = true) {
  const homeAddr = document.getElementById('homeAddress').value.trim();
  const parkAddr = document.getElementById('parkingAddress').value.trim();
  
  if (!homeAddr || !parkAddr) {
    alert('「使用の本拠の位置」と「保管場所の位置」の両方を入力してください。');
    return;
  }

  if (document.getElementById('sameAddress').checked || homeAddr === parkAddr) {
    document.getElementById('distanceVal').value = '同上 (0m)';
    showToast('📏 自宅と保管場所は同一 (0m) です');
    return;
  }

  const hCoord = await fetchCoords(homeAddr);
  const pCoord = await fetchCoords(parkAddr);

  if (!hCoord || !pCoord) {
    alert('住所の座標取得に失敗しました。');
    return;
  }

  homeCoords = hCoord;
  parkingCoords = pCoord;

  const dist = haversineDistance(hCoord.lat, hCoord.lon, pCoord.lat, pCoord.lon);
  const distText = dist < 1000 
    ? `約 ${Math.round(dist)}m` 
    : `約 ${(dist / 1000).toFixed(1)}km`;

  document.getElementById('distanceVal').value = distText;

  if (dist > 2000) {
    alert(`⚠️ 直線距離が約${(dist/1000).toFixed(1)}kmです。\\n\\n車庫証明の要件として「使用の本拠の位置」と「保管場所」の距離は原則2km以内である必要があります。ご確認ください。`);
  }

  if (shouldPlot) {
    setActiveTarget('sozai');
    sozaiMap.fitBounds([
      [hCoord.lat, hCoord.lon],
      [pCoord.lat, pCoord.lon]
    ], { padding: [60, 60] });

    setTimeout(() => {
      const hPt = sozaiMap.latLngToContainerPoint([hCoord.lat, hCoord.lon]);
      const pPt = sozaiMap.latLngToContainerPoint([pCoord.lat, pCoord.lon]);

      pushHistory();
      drawings.sozai = [
        { type: 'rect-other', x: hPt.x - 18, y: hPt.y - 18, w: 36, h: 36, angle: 0 },
        { type: 'text', x: hPt.x + 22, y: hPt.y + 5, text: '使用の本拠の位置 (自宅等)', fontSize: 13, angle: 0 },
        { type: 'rect-other', x: pPt.x - 18, y: pPt.y - 18, w: 36, h: 36, angle: 0 },
        { type: 'text', x: pPt.x + 22, y: pPt.y + 5, text: '保管場所の位置 (車庫)', fontSize: 13, angle: 0 },
        { type: 'dist-line', x1: hPt.x, y1: hPt.y, x2: pPt.x, y2: pPt.y, text: `直線距離 ${distText}`, angle: 0 }
      ];
      pushHistory();
      redrawAll();
      showToast(`📏 2地点を自動プロットしました（${distText}）`);
    }, 200);
  }
}

function switchLayout() {
  const mode = document.getElementById('layoutSelect').value;
  const badge = document.getElementById('layoutBadge');
  const styleEl = document.getElementById('printPageStyle');

  if (mode === 'oss-2page') {
    badge.textContent = 'A4横・OSS 2ページ様式';
    styleEl.innerHTML = `@page { size: A4 landscape; margin: 8mm; }`;
  } else {
    badge.textContent = 'A4横・1ページ警察標準';
    styleEl.innerHTML = `@page { size: A4 landscape; margin: 8mm; }`;
  }

  setTimeout(() => {
    resizeCanvases();
    if (sozaiMap) sozaiMap.invalidateSize();
    if (haichiMap) haichiMap.invalidateSize();
  }, 100);
  showToast(`📄 様式を変更しました: ${badge.textContent}`);
}

function loadKurodaSample() {
  document.getElementById('layoutSelect').value = 'oss-2page';
  switchLayout();

  const addr = '愛知県一宮市木曽川町黒田六ノ通り304番地12';
  document.getElementById('homeAddress').value = addr;
  document.getElementById('parkingAddress').value = addr;
  document.getElementById('sameAddress').checked = true;
  document.getElementById('spotNo').value = '';
  document.getElementById('spotWidth').value = '2.0m';
  document.getElementById('spotLength').value = '5.0m';
  document.getElementById('roadWidth').value = '5.0m';
  document.getElementById('entranceWidth').value = '10.0m';
  document.getElementById('distanceVal').value = '同上 (0m)';
  document.getElementById('shutterVal').value = '無';
  document.getElementById('dealerInfoInput').value = '愛知トヨタ 江南店 TEL 0587-55-6311';
  document.getElementById('regNoInput').value = '';
  document.getElementById('officeInfoInput').value = '行政書士法人フェリス 0568-26-3713';
  document.getElementById('showSealCheckbox').checked = true;
  document.getElementById('sealSizeSlider').value = 34;
  updateShutterDisplay();
  updateFooterDealerInfo();
  updateFooterRegNo();
  updateFooterOfficeInfo();
  toggleSeal();
  onSealSizeChange(34);

  const kurodaLat = 35.3725;
  const kurodaLng = 136.7820;
  sozaiMap.setView([kurodaLat, kurodaLng], 16);
  haichiMap.setView([kurodaLat, kurodaLng], 18);

  setTimeout(() => {
    const sw = sozaiCanvas.width || 800;
    const sh = sozaiCanvas.height || 500;
    const hw = haichiCanvas.width || 800;
    const hh = haichiCanvas.height || 500;

    drawings.sozai = [
      { type: 'line-rail', x1: 220, y1: 20, x2: 290, y2: sh - 20, text: 'JR東海道本線', angle: 0 },
      { type: 'rect-other', x: sw / 2 - 25, y: sh / 2 - 25, w: 50, h: 50, angle: 0 },
      { type: 'text', x: sw / 2 + 35, y: sh / 2 + 6, text: '⬅ 申請地', fontSize: 16, color: '#000000', angle: 0 },
      { type: 'text', x: 80, y: 150, text: '木曽川環境クリーン', fontSize: 12, angle: 0 },
      { type: 'text', x: sw - 200, y: 160, text: '卍 福昌寺', fontSize: 12, angle: 0 },
      { type: 'text', x: sw - 180, y: 280, text: '㈱ 井鉄工所', fontSize: 12, angle: 0 },
      { type: 'text', x: sw / 2 - 60, y: 220, text: 'JA 自動車', fontSize: 12, angle: 0 }
    ];

    drawings.haichi = [
      { type: 'compass', x: 80, y: 100, size: 28, angle: 0 },
      { type: 'line-road', x1: 200, y1: 80, x2: hw - 80, y2: 80, angle: 0 },
      { type: 'line-road', x1: 200, y1: 80, x2: 200, y2: hh - 80, angle: 0 },
      { type: 'text', x: 215, y: 140, text: '5m\\n道\\n路', fontSize: 13, angle: 0 },
      { type: 'line-dim', x1: 200, y1: 100, x2: 280, y2: 100, text: '5m', angle: 0 },
      { type: 'line-dim', x1: 230, y1: 200, x2: 230, y2: 440, text: '10m', angle: 0 },
      { type: 'text', x: 240, y: 320, text: '出入口', fontSize: 13, angle: 0 },
      { type: 'rect-other', x: 280, y: 160, w: 320, h: 360, angle: 0 },
      { type: 'rect-other', x: 380, y: 200, w: 180, h: 280, angle: 0 },
      { type: 'text', x: 440, y: 340, text: '自　宅', fontSize: 18, angle: 0 },
      { type: 'rect-spot', x: 280, y: 240, w: 100, h: 120, label: '保管場所', angle: 0 },
      { type: 'line-dim', x1: 280, y1: 390, x2: 380, y2: 390, text: '5.0m', angle: 0 },
      { type: 'line-dim', x1: 400, y1: 240, x2: 400, y2: 360, text: '2.0m', angle: 0 }
    ];

    pushHistory();
    redrawAll();
    showToast('🏠 木曽川町黒田サンプルを読み込みました');
  }, 150);
}

function clearCanvas() {
  if (confirm('作図内容をすべてクリアしますか？')) {
    pushHistory();
    drawings = { sozai: [], haichi: [] };
    pushHistory();
    hidePropertyPanel();
    redrawAll();
    showToast('🗑️ 作図をクリアしました');
  }
}

// ─── 案件データのJSON保存・読込 ───
function exportJSON() {
  const ocr = document.getElementById('ocrCodeInput').value;
  const homeAddr = document.getElementById('homeAddress').value;
  const parkAddr = document.getElementById('parkingAddress').value;
  const sameAddr = document.getElementById('sameAddress').checked;
  const spotNo = document.getElementById('spotNo').value;
  const distance = document.getElementById('distanceVal').value;
  const spotWidth = document.getElementById('spotWidth').value;
  const spotLength = document.getElementById('spotLength').value;
  const roadWidth = document.getElementById('roadWidth').value;
  const entranceWidth = document.getElementById('entranceWidth').value;
  const shutter = document.getElementById('shutterVal').value;
  const layout = document.getElementById('layoutSelect').value;
  const dealerInfo = document.getElementById('dealerInfoInput').value;
  const regNo = document.getElementById('regNoInput').value;
  const officeInfo = document.getElementById('officeInfoInput').value;
  const showSeal = document.getElementById('showSealCheckbox').checked;
  const sealSize = parseInt(document.getElementById('sealSizeSlider').value, 10) || 34;

  const mapTile = document.getElementById('mapTileSelect').value;
  const mapContrast = parseInt(document.getElementById('contrastSlider').value, 10) || 200;

  const data = {
    version: '1.3',
    exportedAt: new Date().toISOString(),
    caseId: linkedCaseId,
    formData: {
      ocr, homeAddr, parkAddr, sameAddr, spotNo, distance,
      spotWidth, spotLength, roadWidth, entranceWidth, shutter, layout, haichiMode,
      dealerInfo, regNo, officeInfo, showSeal, sealSize, mapTile, mapContrast
    },
    mapState: {
      sozaiCenter: sozaiMap ? sozaiMap.getCenter() : null,
      sozaiZoom: sozaiMap ? sozaiMap.getZoom() : 15,
      haichiCenter: haichiMap ? haichiMap.getCenter() : null,
      haichiZoom: haichiMap ? haichiMap.getZoom() : 18
    },
    drawings: drawings,
    stampList: stampList
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (parkAddr || homeAddr || linkedCaseTitle || '車庫証明').replace(/[\\s\\/\\\\:;,.*?"<>|]/g, '_').slice(0, 20);
  a.download = `車庫証明データ_${safeName}_${new Date().toISOString().slice(0,10)}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 案件JSONファイルを保存しました');
}

function loadJSONFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      restoreProjectData(data);
      showToast('📂 案件データを復元しました');
    } catch(err) {
      alert('JSONファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function restoreProjectData(data) {
  if (data.formData) {
    const f = data.formData;
    if (f.ocr) document.getElementById('ocrCodeInput').value = f.ocr;
    if (f.homeAddr) document.getElementById('homeAddress').value = f.homeAddr;
    if (f.parkAddr) document.getElementById('parkingAddress').value = f.parkAddr;
    if (f.sameAddr !== undefined) document.getElementById('sameAddress').checked = f.sameAddr;
    if (f.spotNo !== undefined) document.getElementById('spotNo').value = f.spotNo;
    if (f.distance) document.getElementById('distanceVal').value = f.distance;
    if (f.spotWidth) document.getElementById('spotWidth').value = f.spotWidth;
    if (f.spotLength) document.getElementById('spotLength').value = f.spotLength;
    if (f.roadWidth) document.getElementById('roadWidth').value = f.roadWidth;
    if (f.entranceWidth) document.getElementById('entranceWidth').value = f.entranceWidth;
    if (f.shutter) document.getElementById('shutterVal').value = f.shutter;
    if (f.dealerInfo !== undefined) document.getElementById('dealerInfoInput').value = f.dealerInfo;
    if (f.regNo !== undefined) document.getElementById('regNoInput').value = f.regNo;
    if (f.officeInfo !== undefined) document.getElementById('officeInfoInput').value = f.officeInfo;
    if (f.showSeal !== undefined) {
      document.getElementById('showSealCheckbox').checked = f.showSeal;
      toggleSeal();
    }
    if (f.sealSize !== undefined) {
      document.getElementById('sealSizeSlider').value = f.sealSize;
      onSealSizeChange(f.sealSize);
    }
    if (f.mapTile) {
      document.getElementById('mapTileSelect').value = f.mapTile;
      changeMapTile(f.mapTile);
    }
    if (f.mapContrast) {
      document.getElementById('contrastSlider').value = f.mapContrast;
      applyMapContrast(f.mapContrast);
    }
    if (f.layout) {
      document.getElementById('layoutSelect').value = f.layout;
      switchLayout();
    }
    if (f.haichiMode) setHaichiMode(f.haichiMode);

    updateOCRDisplay();
    updateQRCodes();
    updateShutterDisplay();
    updateFooterDealerInfo();
    updateFooterRegNo();
    updateFooterOfficeInfo();
  }

  if (data.mapState) {
    const m = data.mapState;
    if (m.sozaiCenter && m.sozaiZoom && sozaiMap) {
      sozaiMap.setView([m.sozaiCenter.lat, m.sozaiCenter.lng], m.sozaiZoom);
    }
    if (m.haichiCenter && m.haichiZoom && haichiMap) {
      haichiMap.setView([m.haichiCenter.lat, m.haichiCenter.lng], m.haichiZoom);
    }
  }

  if (data.drawings) {
    drawings = data.drawings;
    pushHistory();
    redrawAll();
  }

  if (data.stampList) {
    stampList = data.stampList;
    localStorage.setItem('syako_map_maker_stamps_v2', JSON.stringify(stampList));
    renderStamps();
  }
}

// ─── localStorage 自動バックアップ ───
let autoSaveTimer = null;
function autoSaveDraft() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      const ocr = document.getElementById('ocrCodeInput').value;
      const homeAddr = document.getElementById('homeAddress').value;
      const parkAddr = document.getElementById('parkingAddress').value;
      const sameAddr = document.getElementById('sameAddress').checked;
      const spotNo = document.getElementById('spotNo').value;
      const distance = document.getElementById('distanceVal').value;
      const spotWidth = document.getElementById('spotWidth').value;
      const spotLength = document.getElementById('spotLength').value;
      const roadWidth = document.getElementById('roadWidth').value;
      const entranceWidth = document.getElementById('entranceWidth').value;
      const shutter = document.getElementById('shutterVal').value;
      const layout = document.getElementById('layoutSelect').value;
      const dealerInfo = document.getElementById('dealerInfoInput').value;
      const regNo = document.getElementById('regNoInput').value;
      const officeInfo = document.getElementById('officeInfoInput').value;
      const showSeal = document.getElementById('showSealCheckbox').checked;
      const sealSize = parseInt(document.getElementById('sealSizeSlider').value, 10) || 34;
      const mapTile = document.getElementById('mapTileSelect').value;
      const mapContrast = parseInt(document.getElementById('contrastSlider').value, 10) || 200;

      const draft = {
        savedAt: new Date().toISOString(),
        caseId: linkedCaseId,
        formData: {
          ocr, homeAddr, parkAddr, sameAddr, spotNo, distance,
          spotWidth, spotLength, roadWidth, entranceWidth, shutter, layout, haichiMode,
          dealerInfo, regNo, officeInfo, showSeal, sealSize, mapTile, mapContrast
        },
        mapState: {
          sozaiCenter: sozaiMap ? sozaiMap.getCenter() : null,
          sozaiZoom: sozaiMap ? sozaiMap.getZoom() : 15,
          haichiCenter: haichiMap ? haichiMap.getCenter() : null,
          haichiZoom: haichiMap ? haichiMap.getZoom() : 18
        },
        drawings: drawings
      };
      localStorage.setItem('syako_map_maker_draft', JSON.stringify(draft));
    } catch(e){}
  }, 400);
}

function restoreDraftFromStorage() {
  try {
    const raw = localStorage.getItem('syako_map_maker_draft');
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft && draft.drawings && (draft.drawings.sozai.length > 0 || draft.drawings.haichi.length > 0)) {
        restoreProjectData(draft);
        return true;
      }
    }
  } catch(e){}
  return false;
}

function exportA4PDF() {
  window.print();
}

async function exportOSSImage() {
  showToast('🖼️ OSS用画像を生成中...');
  const page1 = document.getElementById('page1Sozai');
  const page2 = document.getElementById('page2Haichi');

  const addr = (document.getElementById('parkingAddress').value || linkedCaseTitle || '申請地').replace(/[\\s\\/\\\\:;,.*?"<>|]/g, '_').slice(0, 25);
  const dateStr = new Date().toISOString().slice(0,10);

  const c1 = await html2canvas(page1, { scale: 2, useCORS: true, logging: false });
  const l1 = document.createElement('a');
  l1.download = `車庫証明_所在図_${addr}_${dateStr}.png`;
  l1.href = c1.toDataURL('image/png');
  l1.click();

  setTimeout(async () => {
    const c2 = await html2canvas(page2, { scale: 2, useCORS: true, logging: false });
    const l2 = document.createElement('a');
    l2.download = `車庫証明_配置図_${addr}_${dateStr}.png`;
    l2.href = c2.toDataURL('image/png');
    l2.click();
    showToast('✅ OSS画像(2枚)を保存しました');
  }, 500);
}
</script>

</body>
</html>
"""

# Write to both locations
path1 = r"d:\行政書士\開業\gyosei-dashboard\syako_map_maker.html"
path2 = r"d:\行政書士\車庫証明_所在図・配置図作成ツール.html"

with open(path1, "w", encoding="utf-8") as f:
    f.write(html_code)

with open(path2, "w", encoding="utf-8") as f:
    f.write(html_code)

print("Successfully written clean files to both paths.")
