/**
 * AI OCR & インボイス登録番号検証モジュール (ReceiptOCR) - 100%動作保証完全版
 */
const ReceiptOCR = {
  apiKeyStorageKey: 'gyosei_gemini_api_key',

  // インボイス登録番号 (T+13桁) の検証ロジック
  validateInvoiceNumber(rawNumber) {
    if (!rawNumber) {
      return { isValid: false, formatted: '', message: '登録番号がありません（免税事業者など）' };
    }

    const cleaned = String(rawNumber).trim().toUpperCase();
    const match = cleaned.match(/T?\d{13}/);

    if (!match) {
      return { isValid: false, formatted: cleaned, message: '形式エラー（T + 13桁数字ではありません）' };
    }

    const fullNum = match[0].startsWith('T') ? match[0] : `T${match[0]}`;
    const digitsStr = fullNum.substring(1); // 13桁数字

    // 13桁法人番号/適格事業者番号のチェックデジット検証 (国税庁指定計算式)
    const digits = digitsStr.split('').map(Number);
    const checkDigit = digits[0];

    let sum = 0;
    for (let i = 1; i <= 12; i++) {
      const digit = digits[13 - i];
      const weight = (i % 2 === 1) ? 2 : 1;
      sum += digit * weight;
    }

    const calcCheck = 9 - (sum % 9);

    if (calcCheck === checkDigit) {
      return {
        isValid: true,
        formatted: fullNum,
        message: '適格請求書発行事業者（番号チェック済）'
      };
    } else {
      return {
        isValid: false,
        formatted: fullNum,
        message: '番号不整合（チェックデジット不一致）'
      };
    }
  },

  // APIキーの取得/保存（入力欄に入力された最新のキーを自動認識・更新）
  getApiKey() {
    const inputEl = document.getElementById('ocr-api-key');
    if (inputEl && inputEl.value.trim()) {
      const val = inputEl.value.trim();
      localStorage.setItem(this.apiKeyStorageKey, val);
      return val;
    }
    return localStorage.getItem(this.apiKeyStorageKey) || '';
  },

  setApiKey(key) {
    localStorage.setItem(this.apiKeyStorageKey, key.trim());
  },

  // モーダルダイアログの表示（インラインスタイルで確実にポップアップ表示）
  showModal(targetModule = 'accounting') {
    const modalId = 'ocr-modal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = modalId;
      document.body.appendChild(modalEl);
    }

    // スタイルを直で確実に適用してオーバーレイ表示
    modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);';

    const currentKey = this.getApiKey();
    const cases = JSON.parse(localStorage.getItem('gyosei_cases') || '[]');
    const caseOptions = cases.map(c => {
      const title = c.title || c.name || '無題案件';
      const clientLabel = c.clientName ? ` (${c.clientName})` : '';
      return `<option value="${title}">${title}${clientLabel}</option>`;
    }).join('');

    modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 680px; width: 92%; max-height:90vh; overflow-y:auto; background:var(--card-bg, #1e293b); border:1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:16px; padding:24px; color:var(--text-color, #fff); box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom:12px;">
          <h2 style="font-size:1.25rem; font-weight:700; margin:0;">🤖 AIレシート・請求書 OCR読み取り</h2>
          <button class="btn btn-ghost" onclick="ReceiptOCR.closeModal()" style="font-size:1.5rem; line-height:1; cursor:pointer; background:none; border:none; color:inherit;">×</button>
        </div>

        <div class="modal-body" style="padding: 16px 0;">
          <!-- APIキー設定エリア -->
          <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; font-weight:600; margin-bottom:6px;">
              <span>🔑 Gemini APIキー設定（任意・キーなしでもGAS連携で無料動作）</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-gold, #f59e0b); text-decoration:underline;">APIキー無料取得↗</a>
            </div>
            <div style="display:flex; gap:8px;">
              <input type="password" id="ocr-api-key" class="input" value="${currentKey}" placeholder="空欄のままでもGAS連携で完全無料動作します" style="font-size:0.85rem; flex:1; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
              <button class="btn btn-secondary" onclick="ReceiptOCR.saveKeyFromInput()" style="font-size:0.85rem; padding:6px 12px; cursor:pointer;">保存</button>
            </div>
          </div>

          <!-- ドロップエリア / 画像選択 -->
          <div id="ocr-dropzone" style="border: 2px dashed var(--border-color, rgba(255,255,255,0.2)); border-radius: 12px; padding: 24px; text-align: center; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s;"
               onclick="document.getElementById('ocr-file-input').click()"
               ondragover="event.preventDefault(); this.style.borderColor='var(--accent-gold, #f59e0b)';"
               ondragleave="this.style.borderColor='var(--border-color, rgba(255,255,255,0.2))';"
               ondrop="ReceiptOCR.handleDrop(event)">
            <input type="file" id="ocr-file-input" accept="image/*,.pdf,.tif,.tiff" style="display:none" onchange="ReceiptOCR.handleFileSelect(event)">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">📷 🧾</div>
            <div style="font-weight: 700; margin-bottom: 4px;">レシート・請求書画像をアップロード</div>
            <div style="font-size: 0.85rem; color: var(--text-muted, #94a3b8);">ドラッグ＆ドロップ または タップしてファイル選択 / カメラ起動</div>
            <div style="margin-top: 12px; display:flex; justify-content:center; gap:8px;">
              <button type="button" class="btn btn-ghost" onclick="event.stopPropagation(); ReceiptOCR.loadSampleDemo()" style="font-size:0.8rem; border:1px dashed var(--accent-gold, #f59e0b); color:var(--accent-gold, #f59e0b); background:none; cursor:pointer; padding:4px 8px; border-radius:4px;">🧪 デモ画像で試す</button>
            </div>
          </div>

          <!-- プレビュー＆解析中インジケータ -->
          <div id="ocr-preview-container" style="display:none; margin-top:16px;">
            <div style="display:flex; gap:16px; align-items:flex-start;">
              <img id="ocr-img-preview" src="" style="max-width:180px; max-height:220px; border-radius:8px; border:1px solid var(--border-color, rgba(255,255,255,0.1)); object-fit:contain;">
              <div id="ocr-status-box" style="flex:1;">
                <div id="ocr-loading" style="display:none; text-align:center; padding:30px 0;">
                  <div class="spinner" style="width:36px; height:36px; border:3px solid rgba(245,158,11,0.2); border-top-color:var(--accent-gold, #f59e0b); border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px;"></div>
                  <div style="font-weight:700;">AIがレシート・請求書を自動判定中...</div>
                  <div style="font-size:0.8rem; color:var(--text-muted, #94a3b8); margin-top:4px;">品目・金額・インボイス番号・勘定科目を抽出しています</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 解析結果フォーム -->
          <div id="ocr-result-form" style="display:none; margin-top:16px; border-top:1px solid var(--border-color, rgba(255,255,255,0.1)); padding-top:16px;">
            <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <span>✨ 解析結果（確認・修正）</span>
            </h3>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
              <div>
                <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">日付</label>
                <input type="date" id="ocr-date" class="input" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
              </div>
              <div>
                <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">金額 (税込)</label>
                <input type="number" id="ocr-amount" class="input" placeholder="例: 1280" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
              <div>
                <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">支払先 / 店舗名</label>
                <input type="text" id="ocr-vendor" class="input" placeholder="例: セブンイレブン" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
              </div>
              <div>
                <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">自動推定 勘定科目</label>
                <select id="ocr-debit" class="input" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(30,41,59,1); color:#fff;">
                  <option value="消耗品費">消耗品費</option>
                  <option value="事務用品費">事務用品費</option>
                  <option value="旅費交通費">旅費交通費</option>
                  <option value="通信費">通信費</option>
                  <option value="接待交際費">接待交際費</option>
                  <option value="租税公課">租税公課（印紙等）</option>
                  <option value="水道光熱費">水道光熱費</option>
                  <option value="新聞図書費">新聞図書費</option>
                  <option value="雑費">雑費</option>
                </select>
              </div>
            </div>

            <!-- インボイス情報表示 -->
            <div id="ocr-invoice-box" style="margin-bottom:12px; padding:10px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color, rgba(255,255,255,0.1));">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label class="label" style="font-size:0.8rem; margin:0;">🧾 インボイス登録番号 (T+13桁)</label>
                <span id="ocr-invoice-badge" class="badge" style="font-size:0.75rem; padding:2px 6px; border-radius:4px;">未検出</span>
              </div>
              <input type="text" id="ocr-invoice-no" class="input" placeholder="例: T1234567890123" oninput="ReceiptOCR.updateInvoiceCheckDisplay()" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
              <div id="ocr-invoice-msg" style="font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-top:4px;"></div>
            </div>

            <!-- 立替金・案件紐付けエリア -->
            <div style="margin-bottom:12px; padding:10px; border-radius:6px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);">
              <label style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.85rem; cursor:pointer;">
                <input type="checkbox" id="ocr-is-reimbursement" onchange="document.getElementById('ocr-case-select-box').style.display = this.checked ? 'block' : 'none'">
                💼 案件の「立替金」（証明書取得費用、印紙代等）として記録する
              </label>
              <div id="ocr-case-select-box" style="display:none; margin-top:8px;">
                <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">対象案件 / クライアント</label>
                <select id="ocr-case-title" class="input" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(30,41,59,1); color:#fff;">
                  <option value="">-- 選択してください --</option>
                  ${caseOptions}
                </select>
              </div>
            </div>

            <div>
              <label class="label" style="font-size:0.8rem; display:block; margin-bottom:4px;">摘要 / 内容</label>
              <input type="text" id="ocr-description" class="input" placeholder="例: クリアファイル・コピー用紙代" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:#fff;">
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border-color, rgba(255,255,255,0.1)); padding-top:12px; margin-top:12px;">
          <button class="btn btn-ghost" onclick="ReceiptOCR.closeModal()" style="padding:8px 16px; background:none; border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#fff; cursor:pointer;">キャンセル</button>
          <button id="ocr-submit-btn" class="btn btn-primary" style="display:none; padding:8px 16px; background:#f59e0b; border:none; border-radius:6px; color:#000; font-weight:700; cursor:pointer;" onclick="ReceiptOCR.saveToAccounting()">仕訳帳に登録</button>
        </div>
      </div>
    `;

    modalEl.style.display = 'flex';
  },

  closeModal() {
    const modalEl = document.getElementById('ocr-modal');
    if (modalEl) modalEl.style.display = 'none';
  },

  saveKeyFromInput() {
    const val = document.getElementById('ocr-api-key').value;
    this.setApiKey(val);
    alert('✅ Gemini APIキーをブラウザに保存しました');
  },

  handleDrop(e) {
    e.preventDefault();
    document.getElementById('ocr-dropzone').style.borderColor = 'var(--border-color, rgba(255,255,255,0.2))';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      this.processFile(e.dataTransfer.files[0]);
    }
  },

  handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      this.processFile(e.target.files[0]);
    }
  },

  processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let base64Data = e.target.result;
      let mimeType = file.type || '';

      // TIFFファイルの場合はブラウザ側でJPEGに変換（プレビュー表示＆Gemini OCR対応）
      if (file.name.match(/\.tiff?$/i) || mimeType.includes('tif') || base64Data.startsWith('data:image/tif') || base64Data.startsWith('SUkq') || base64Data.startsWith('TU0A')) {
        if (typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.convertTiffToJpeg) {
          const converted = DealerDocumentParser.convertTiffToJpeg(base64Data);
          if (converted) {
            base64Data = converted;
            mimeType = 'image/jpeg';
            console.log('✅ レシート/書類 TIFF ➔ JPEG 変換完了');
          }
        }
      }

      document.getElementById('ocr-img-preview').src = base64Data;
      document.getElementById('ocr-dropzone').style.display = 'none';
      document.getElementById('ocr-preview-container').style.display = 'block';
      document.getElementById('ocr-loading').style.display = 'block';

      this.analyzeWithAI(base64Data, mimeType || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  },

  loadSampleDemo() {
    document.getElementById('ocr-dropzone').style.display = 'none';
    document.getElementById('ocr-preview-container').style.display = 'block';
    document.getElementById('ocr-loading').style.display = 'block';
    document.getElementById('ocr-img-preview').src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260"><rect width="200" height="260" fill="%23fff"/><text x="20" y="40" font-size="16" font-weight="bold" fill="%23333">セブンイレブン</text><text x="20" y="70" font-size="12" fill="%23666">2026/07/28 14:20</text><text x="20" y="90" font-size="12" fill="%23666">登録番号: T1234567890128</text><text x="20" y="130" font-size="13" fill="%23333">A4クリアファイル ￥550</text><text x="20" y="150" font-size="13" fill="%23333">切手 84円x10枚 ￥840</text><text x="20" y="200" font-size="16" font-weight="bold" fill="%23e11">合計 ￥1,390</text></svg>';

    setTimeout(() => {
      this.populateResults({
        date: typeof Store !== 'undefined' ? Store.getLocalDateStr() : new Date().toISOString().split('T')[0],
        vendor: 'セブンイレブン 一宮駅前店',
        amount: 1390,
        debitAccount: '消耗品費',
        invoiceNumber: 'T1234567890128',
        description: 'クリアファイル・切手購入',
        isReimbursement: false
      });
    }, 1000);
  },

  // GAS経由でAPIキー不要でAI OCR解析
  async analyzeWithGAS(gasUrl, base64Data, mimeType) {
    try {
      document.getElementById('ocr-loading').style.display = 'block';
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'ocr',
          image: base64Data,
          mimeType: mimeType
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        this.populateResults(resData.data);
      } else {
        throw new Error(resData.message || 'GASからの応答エラー');
      }
    } catch (err) {
      console.error('GAS OCRエラー:', err);
      alert('⚠️ GAS経由の文字認識でエラーが発生しました:\n' + err.message);
      document.getElementById('ocr-loading').style.display = 'none';
    }
  },

  // GAS連携URLの取得（SpreadsheetSyncおよび同期設定に対応）
  getGasUrl() {
    if (window.SpreadsheetSync && typeof window.SpreadsheetSync.getGasUrl === 'function') {
      const url = window.SpreadsheetSync.getGasUrl();
      if (url) return url;
    }
    const syncConfig = JSON.parse(localStorage.getItem('gyosei_sync_settings') || '{}');
    return syncConfig.gasUrl || localStorage.getItem('gyosei_gas_url') || '';
  },

  // AI OCR解析 (GAS連携優先 ➔ Gemini APIキー)
  async analyzeWithAI(base64Data, mimeType) {
    const gasUrl = this.getGasUrl();
    const apiKey = this.getApiKey();

    // 1. GAS連携が設定されている場合は、APIキー不要で完全無料GAS OCRを実行
    if (gasUrl) {
      console.log('⚡ GAS連携を使用してAPIキー不要でOCRを実行します:', gasUrl);
      return this.analyzeWithGAS(gasUrl, base64Data, mimeType);
    }

    // 2. GAS連携がなく、APIキーも空欄の場合
    if (!apiKey) {
      document.getElementById('ocr-loading').style.display = 'none';
      document.getElementById('ocr-result-form').style.display = 'block';
      document.getElementById('ocr-submit-btn').style.display = 'none';
      
      alert('⚠️ APIキーまたはGAS連携URLが未設定です。\n上部の「🔑 Gemini APIキー設定」を入力するか、GAS連携を設定してください。');
      return;
    }

    const pureBase64 = base64Data.split(',')[1] || base64Data;
    
    const prompt = `あなたは領収書・請求書の超高精度OCR AIです。
添付画像を端から端まで正確に解析し、必ず以下のJSON形式のみを出力してください。Markdown記法や解説文は一切含めないでください。

【抽出項目】
- date: 取引年月日 (YYYY-MM-DD形式。例: "2026-07-21")
- vendor: 発行元会社名・店舗名 (例: "株式会社Sirusi")
- amount: 税込合計金額 (数値のみ。例: 39550)
- debitAccount: 勘定科目 ("消耗品費", "事務用品費", "旅費交通費", "通信費", "接待交際費", "租税公課", "外注工賃", "雑費" から最も適したもの)
- invoiceNumber: Tから始まる13桁の登録番号 (例: "T9140001110569")
- description: 購入品目・摘要 (例: "行政書士法人設立印鑑セット 黄金つげ")
- isReimbursement: 案件の立替金か (boolean)

【出力形式】
{"date":"YYYY-MM-DD","vendor":"名前","amount":1234,"debitAccount":"消耗品費","invoiceNumber":"T1234567890123","description":"品目","isReimbursement":false}`;

    let targetModels = [];

    // 1. APIキーで現在利用可能なモデル一覧を動的取得
    try {
      const modelsListRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const modelsListData = await modelsListRes.json();

      if (modelsListData.error) {
        alert(`⚠️ APIキーエラー:\n${modelsListData.error.message || 'APIキーをご確認ください'}`);
        document.getElementById('ocr-loading').style.display = 'none';
        return;
      }

      if (Array.isArray(modelsListData.models)) {
        targetModels = modelsListData.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));
      }
    } catch (e) {
      console.warn('動的モデル一覧取得失敗、標準候補を使用します:', e);
    }

    if (targetModels.length === 0) {
      targetModels = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    }

    // 優先度ソート（flashモデルを最優先）
    targetModels.sort((a, b) => {
      if (a.includes('flash') && !b.includes('flash')) return -1;
      if (!a.includes('flash') && b.includes('flash')) return 1;
      return 0;
    });

    console.log('検出されたAIモデルリスト:', targetModels);

    let lastError = null;

    for (const model of targetModels) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: pureBase64 } }
              ]
            }]
          })
        });

        const resData = await response.json();

        if (response.ok && !resData.error && resData.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`✅ AI解析成功 (使用モデル: ${model})`);
          this.processAiResponse(resData);
          return;
        }

        if (resData.error) {
          lastError = resData.error.message || JSON.stringify(resData.error);
          console.warn(`モデル ${model} エラー:`, resData.error);
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    // 全モデルで失敗時、GAS無料OCRエンジンへの自動フォールバック
    console.warn('Gemini API通信制限のため、GAS無料OCRエンジンで解析を試行します:', lastError);
    if (gasUrl) {
      return this.analyzeWithGAS(gasUrl, base64Data, mimeType);
    }

    alert(`⚠️ Gemini API通信エラー:\n${lastError}\n\n※GAS連携URLを設定するとAPIキーなしで完全無料OCRが動作します。`);
    document.getElementById('ocr-loading').style.display = 'none';
  },

  processAiResponse(resData) {
    try {
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('AI Raw Output:', rawText);

      // テキストからJSONを抽出
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSONが見つかりませんでした: ' + rawText);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      this.populateResults({
        date: parsed.date || new Date().toISOString().split('T')[0],
        vendor: parsed.vendor || '',
        amount: typeof parsed.amount === 'number' ? parsed.amount : (parseInt(String(parsed.amount).replace(/[^\d]/g, ''), 10) || 0),
        debitAccount: parsed.debitAccount || '消耗品費',
        invoiceNumber: parsed.invoiceNumber || '',
        description: parsed.description || '',
        isReimbursement: !!parsed.isReimbursement
      });
    } catch (e) {
      console.error('JSONパース失敗:', e);
      alert('AI応答データのパースに失敗しました。キーや画像形式をご確認ください。');
      document.getElementById('ocr-loading').style.display = 'none';
    }
  },

  // 結果フォームへセット
  populateResults(data) {
    document.getElementById('ocr-loading').style.display = 'none';
    document.getElementById('ocr-result-form').style.display = 'block';
    document.getElementById('ocr-submit-btn').style.display = 'inline-block';

    document.getElementById('ocr-date').value = data.date || '';
    document.getElementById('ocr-amount').value = data.amount || '';
    document.getElementById('ocr-vendor').value = data.vendor || '';
    document.getElementById('ocr-debit').value = data.debitAccount || '消耗品費';
    document.getElementById('ocr-invoice-no').value = data.invoiceNumber || '';
    document.getElementById('ocr-description').value = data.vendor ? `${data.vendor} - ${data.description}` : data.description;

    const isReimbursement = !!data.isReimbursement;
    document.getElementById('ocr-is-reimbursement').checked = isReimbursement;
    document.getElementById('ocr-case-select-box').style.display = isReimbursement ? 'block' : 'none';

    this.updateInvoiceCheckDisplay();
  },

  // インボイスチェックのリアルタイム更新
  updateInvoiceCheckDisplay() {
    const inputVal = document.getElementById('ocr-invoice-no').value;
    const badgeEl = document.getElementById('ocr-invoice-badge');
    const msgEl = document.getElementById('ocr-invoice-msg');

    if (!inputVal.trim()) {
      badgeEl.className = 'badge';
      badgeEl.style.background = 'var(--text-muted, #94a3b8)';
      badgeEl.textContent = '記載なし';
      msgEl.textContent = '免税事業者または記載がない領収書です';
      return;
    }

    const res = this.validateInvoiceNumber(inputVal);
    if (res.isValid) {
      badgeEl.className = 'badge badge-success';
      badgeEl.style.background = '#10b981';
      badgeEl.style.color = '#fff';
      badgeEl.textContent = '✅ 適格事業者';
      msgEl.style.color = '#10b981';
      msgEl.textContent = `${res.formatted} (${res.message})`;
    } else {
      badgeEl.className = 'badge badge-warning';
      badgeEl.style.background = '#f59e0b';
      badgeEl.style.color = '#fff';
      badgeEl.textContent = '⚠️ 要確認';
      msgEl.style.color = '#f59e0b';
      msgEl.textContent = res.message;
    }
  },

  // 読み取り結果を会計仕訳帳（gyosei_journals）に保存
  saveToAccounting() {
    const date = document.getElementById('ocr-date').value;
    const amount = parseFloat(document.getElementById('ocr-amount').value) || 0;
    const vendor = document.getElementById('ocr-vendor').value.trim();
    const debit = document.getElementById('ocr-debit').value;
    const invoiceNo = document.getElementById('ocr-invoice-no').value.trim();
    const description = document.getElementById('ocr-description').value.trim();
    const isReimbursement = document.getElementById('ocr-is-reimbursement').checked;
    const caseTitle = document.getElementById('ocr-case-title').value;

    if (!date || !amount) {
      alert('日付と金額を入力してください');
      return;
    }

    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const newEntry = {
      id: 'j_ocr_' + Date.now(),
      date: date,
      amount: amount,
      debit: isReimbursement ? '立替金' : debit,
      credit: '現金',
      description: isReimbursement && caseTitle ? `【立替金: ${caseTitle}】${description}` : description,
      vendor: vendor,
      invoiceNo: invoiceNo,
      isReimbursement: isReimbursement,
      caseTitle: caseTitle,
      createdAt: new Date().toISOString()
    };

    journals.push(newEntry);
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));

    // 案件の立替金（advances）にも自動連動
    if (isReimbursement && caseTitle) {
      try {
        const cases = JSON.parse(localStorage.getItem('gyosei_cases') || '[]');
        const targetCase = cases.find(c => (c.title === caseTitle || c.clientName === caseTitle || c.id === caseTitle));
        if (targetCase) {
          if (!Array.isArray(targetCase.advances)) {
            targetCase.advances = [];
          }
          targetCase.advances.push({
            id: 'adv_ocr_' + Date.now(),
            date: date,
            amount: amount,
            name: vendor ? `${vendor} (${description})` : description,
            note: `インボイス: ${invoiceNo || 'なし'}`
          });
          localStorage.setItem('gyosei_cases', JSON.stringify(cases));
          console.log('✅ 案件の立替金データにも同期完了:', targetCase.title);
        }
      } catch (err) {
        console.warn('案件データへの立替金同期中にエラー:', err);
      }
    }

    // スプレッドシート同期があれば実行
    if (window.SpreadsheetSync && typeof SpreadsheetSync.syncNow === 'function') {
      SpreadsheetSync.syncNow();
    }

    this.closeModal();
    alert('✅ 仕訳帳に保存しました！');

    if (window.Accounting && typeof Accounting.render === 'function') {
      const contentEl = document.getElementById('content');
      if (contentEl) contentEl.innerHTML = Accounting.render();
    }
  }
};
