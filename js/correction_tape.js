/**
 * デジタル修正テープ (Digital Correction Tape) モジュール
 * - FAXやスキャンしたPDF・画像（車庫証明依頼書・申請書・車検証等）の
 *   「左端の相手側FAX通知（耳）」や不要な汚れ・メモ等をワンクリック＆ドラッグで白消し
 * - 高品質PDF（PDF-Lib）または高解像度画像として出力・ダウンロード
 * - 案件添付Driveへの直接保存やメール送信用エクスポートに対応
 */
const DigitalCorrectionTape = {
  activeFile: null,
  activeFileName: '',
  activeFileType: 'pdf', // 'pdf' | 'image'
  activeCaseId: null,
  
  pdfDoc: null,           // PDFLib document
  rawArrayBuffer: null,   // Original ArrayBuffer
  pdfPagesData: [],       // Array of { pageNum, viewport, canvas, whiteouts: [] }
  currentPageIdx: 0,
  
  // 表示倍率
  zoom: 1.0,
  baseScale: 1.5, // 描画精細度（1.5倍でクッキリ描画）
  
  // 白消しテープの履歴 (Undo用)
  history: [],
  
  // ドラッグ白消しの状態
  isDrawing: false,
  drawStartX: 0,
  drawStartY: 0,
  activeWhiteoutId: null,
  
  // 耳消しの設定 (デフォルト 7.2% = A4横幅210mm中約15mm)
  marginErasePercent: 0.075,

  /**
   * モーダル初期化＆オープン
   */
  async open({ file = null, url = null, dataUrl = null, arrayBuffer = null, fileName = '', caseId = null } = {}) {
    this.ensureModalDOM();
    const modal = document.getElementById('digitalCorrectionTapeModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.activeCaseId = caseId;
    this.activeFileName = fileName || '書類_修正テープ済.pdf';
    this.history = [];
    this.pdfPagesData = [];
    this.currentPageIdx = 0;
    this.zoom = 1.0;

    // ファイルが渡されている場合は即座に読み込み
    if (file) {
      await this.loadFile(file);
    } else if (arrayBuffer) {
      await this.loadArrayBuffer(arrayBuffer, fileName);
    } else if (url || dataUrl) {
      await this.loadUrl(url || dataUrl, fileName);
    } else {
      // 未指定の場合はドロップ待機画面を表示
      this.showEmptyDropZone();
    }
  },

  close() {
    const modal = document.getElementById('digitalCorrectionTapeModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    this.activeFile = null;
    this.rawArrayBuffer = null;
    this.pdfDoc = null;
    this.pdfPagesData = [];
  },

  ensureModalDOM() {
    if (document.getElementById('digitalCorrectionTapeModal')) return;

    const div = document.createElement('div');
    div.id = 'digitalCorrectionTapeModal';
    div.className = 'modal';
    div.style.cssText = `
      display:none; position:fixed; inset:0; z-index:99999;
      background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(4px);
      align-items:center; justify-content:center;
    `;

    div.innerHTML = `
      <div style="
        width:98vw; height:96vh; max-width:1440px; max-height:920px;
        background:#0f172a; border:1px solid #334155; border-radius:12px;
        display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);
        color:#f8fafc; font-family:var(--font-sans, system-ui, sans-serif);
      ">
        <!-- ─── ヘッダーツールバー ─── -->
        <div style="
          background:#1e293b; border-bottom:1px solid #334155; padding:8px 16px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; flex-shrink:0;
        ">
          <!-- タイトル & ファイル名 -->
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:1.3rem;">🩹</span>
              <span style="font-weight:700; font-size:1.05rem; color:#f8fafc; letter-spacing:0.5px;">デジタル修正テープ</span>
              <span style="font-size:0.72rem; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); border-radius:4px; padding:1px 6px; font-weight:600;">FAX耳・不要箇所 白消し</span>
            </div>
            <div id="dctFileNameBadge" style="font-size:0.8rem; color:#94a3b8; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:#0f172a; padding:3px 8px; border-radius:6px; border:1px solid #334155;">
              未選択
            </div>
          </div>

          <!-- 一発消去プリセット -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.eraseLeftMargin(false)" 
              title="相手側FAXの通知・送信番号（左端の耳）をワンクリックで白消しします"
              style="background:#0284c7; border-color:#38bdf8; color:#ffffff; font-weight:700; padding:4px 10px; font-size:0.82rem; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              🧹 左端FAX耳を一発白消し
            </button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.eraseLeftMargin(true)" 
              title="全ページの左端FAX耳を一括で白消しします"
              style="background:#1e293b; border-color:#0284c7; color:#38bdf8; font-size:0.78rem; padding:4px 8px;">
              📑 全ページ左耳消し
            </button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.eraseTopMargin()" 
              title="用紙上端のFAXヘッダー・日時を白消しします"
              style="background:#1e293b; border-color:#475569; color:#cbd5e1; font-size:0.78rem; padding:4px 8px;">
              🧹 上端消去
            </button>

            <!-- 耳消し幅プリセット選択 -->
            <select id="dctMarginSelect" onchange="DigitalCorrectionTape.onMarginPercentChange(this.value)"
              style="background:#0f172a; color:#cbd5e1; border:1px solid #475569; border-radius:4px; font-size:0.75rem; padding:3px 6px;">
              <option value="0.05">耳幅: 細め (5%)</option>
              <option value="0.075" selected>耳幅: 標準 (7.5%)</option>
              <option value="0.10">耳幅: 広め (10%)</option>
              <option value="0.14">耳幅: 特大 (14%)</option>
            </select>
          </div>

          <!-- 編集操作・拡大縮小 -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.undo()" title="直前の白消しを取り消す (Ctrl+Z)"
              style="background:#334155; border-color:#475569; color:#f8fafc; font-size:0.78rem; padding:4px 8px;">
              ↩️ 元に戻す
            </button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.clearCurrentPageWhiteouts()" title="このページの白消しをすべて解除"
              style="background:#334155; border-color:#475569; color:#f87171; font-size:0.78rem; padding:4px 8px;">
              🗑️ 全解除
            </button>

            <div style="width:1px; height:20px; background:#475569; margin:0 4px;"></div>

            <!-- ページ送り -->
            <div id="dctPageNavGroup" style="display:flex; align-items:center; gap:4px;">
              <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.prevPage()" style="padding:2px 7px;">◀</button>
              <span id="dctPageIndicator" style="font-size:0.8rem; font-weight:600; min-width:55px; text-align:center;">1 / 1</span>
              <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.nextPage()" style="padding:2px 7px;">▶</button>
            </div>

            <!-- ズーム -->
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.zoomView(-0.2)" title="縮小" style="padding:2px 7px;">🔍−</button>
            <span id="dctZoomIndicator" style="font-size:0.78rem; color:#94a3b8; min-width:40px; text-align:center;">100%</span>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.zoomView(0.2)" title="拡大" style="padding:2px 7px;">🔍＋</button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.fitWidth()" title="幅に合わせる" style="font-size:0.75rem; padding:3px 7px;">↕ 幅</button>
          </div>

          <!-- 保存 & 閉じる -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="btn btn-primary" onclick="DigitalCorrectionTape.exportCleanPDF()"
              style="background:#16a34a; border-color:#22c55e; color:#ffffff; font-weight:700; font-size:0.85rem; padding:5px 14px; box-shadow:0 2px 6px rgba(22,163,74,0.3);">
              📥 修正済みPDFを保存
            </button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.exportCleanImage()" title="高精細JPEG画像として保存"
              style="background:#1e293b; border-color:#475569; color:#cbd5e1; font-size:0.78rem; padding:4px 8px;">
              🖼️ 画像で保存
            </button>
            <button type="button" class="btn btn-secondary btn-small" onclick="DigitalCorrectionTape.close()" style="padding:4px 9px; font-size:1rem; line-height:1;">✕</button>
          </div>
        </div>

        <!-- ─── メインワークエリア ─── -->
        <div id="dctWorkArea" style="
          flex:1; overflow:auto; position:relative; background:#090d16;
          display:flex; align-items:center; justify-content:center; padding:24px; user-select:none;
        " ondragover="event.preventDefault();" ondrop="DigitalCorrectionTape.onFileDrop(event)">
          
          <!-- 空の初期ドラッグ＆ドロップ待機エリア -->
          <div id="dctEmptyDropZone" style="
            display:none; flex-direction:column; align-items:center; justify-content:center;
            border:2px dashed #475569; border-radius:12px; padding:48px 36px; text-align:center;
            background:rgba(30,41,59,0.5); max-width:540px;
          ">
            <span style="font-size:3.5rem; margin-bottom:12px; display:block;">🩹 📄</span>
            <div style="font-size:1.15rem; font-weight:700; color:#f8fafc; margin-bottom:6px;">
              スキャンPDFまたは画像をここにドロップ
            </div>
            <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:20px; line-height:1.5;">
              FAXの耳（左端の相手側番号通知）や、黒ずみ・不要な記載を<br>純白修正テープで綺麗に消去してPDF出力します
            </div>
            <label class="btn btn-primary" style="cursor:pointer; font-size:0.9rem; padding:8px 20px;">
              📁 ファイルを選択（PDF / 画像）
              <input type="file" accept=".pdf,.tif,.tiff,.jpg,.jpeg,.png" style="display:none;" onchange="DigitalCorrectionTape.onFileInputChange(event)">
            </label>
          </div>

          <!-- ローディングインジケーター -->
          <div id="dctLoading" style="display:none; flex-direction:column; align-items:center; color:#94a3b8;">
            <div class="spinner" style="width:40px; height:40px; border:3px solid rgba(56,189,248,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:12px;"></div>
            <div style="font-size:0.9rem; font-weight:600; color:#e2e8f0;">高解像度レンダリング中...</div>
          </div>

          <!-- キャンバスコンテナ（文書本体キャンバス ＋ 白消しオーバーレイキャンバス） -->
          <div id="dctCanvasWrapper" style="display:none; position:relative; box-shadow:0 12px 36px rgba(0,0,0,0.7); border-radius:4px; overflow:hidden;">
            <!-- 原本レンダリングキャンバス -->
            <canvas id="dctDocCanvas" style="display:block; background:#ffffff;"></canvas>
            <!-- 白消しインタラクティブ操作キャンバス -->
            <canvas id="dctOverlayCanvas" style="position:absolute; top:0; left:0; cursor:crosshair;"></canvas>
          </div>

        </div>

        <!-- ─── フッターヒントバー ─── -->
        <div style="
          background:#1e293b; border-top:1px solid #334155; padding:6px 16px;
          display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94a3b8; flex-shrink:0;
        ">
          <div style="display:flex; align-items:center; gap:16px;">
            <span>💡 <strong>使い方:</strong> 左端FAX耳は「🧹 左端FAX耳を一発白消し」ボタンで瞬時に消去できます。</span>
            <span>✏️ 画面上をドラッグすると任意の場所を修正テープで自由に白消しできます。</span>
          </div>
          <div>
            ショートカット: <kbd style="background:#0f172a; padding:1px 5px; border-radius:3px; border:1px solid #475569;">Ctrl+Z</kbd> 元に戻す
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    // キーボードショートカット (Ctrl+Z, Escape)
    window.addEventListener('keydown', (e) => {
      const modalEl = document.getElementById('digitalCorrectionTapeModal');
      if (!modalEl || modalEl.style.display === 'none') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        DigitalCorrectionTape.undo();
      } else if (e.key === 'Escape') {
        DigitalCorrectionTape.close();
      }
    });
  },

  showEmptyDropZone() {
    const dropZone = document.getElementById('dctEmptyDropZone');
    const wrapper = document.getElementById('dctCanvasWrapper');
    const loading = document.getElementById('dctLoading');
    if (dropZone) dropZone.style.display = 'flex';
    if (wrapper) wrapper.style.display = 'none';
    if (loading) loading.style.display = 'none';
  },

  showLoading(text = '高解像度レンダリング中...') {
    const dropZone = document.getElementById('dctEmptyDropZone');
    const wrapper = document.getElementById('dctCanvasWrapper');
    const loading = document.getElementById('dctLoading');
    if (dropZone) dropZone.style.display = 'none';
    if (wrapper) wrapper.style.display = 'none';
    if (loading) {
      loading.style.display = 'flex';
      const tEl = loading.querySelector('div:last-child');
      if (tEl) tEl.textContent = text;
    }
  },

  hideLoading() {
    const loading = document.getElementById('dctLoading');
    if (loading) loading.style.display = 'none';
    const wrapper = document.getElementById('dctCanvasWrapper');
    if (wrapper) wrapper.style.display = 'block';
  },

  onFileInputChange(e) {
    const files = e.target.files;
    if (files && files[0]) {
      this.loadFile(files[0]);
    }
    e.target.value = '';
  },

  onFileDrop(e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      this.loadFile(e.dataTransfer.files[0]);
    }
  },

  async loadFile(file) {
    this.activeFile = file;
    this.activeFileName = file.name || '書類_白消し.pdf';
    document.getElementById('dctFileNameBadge').textContent = this.activeFileName;

    const isPdf = file.name.match(/\.pdf$/i) || (file.type && file.type.includes('pdf'));
    const isTiff = file.name.match(/\.tiff?$/i) || (file.type && file.type.includes('tif'));

    this.showLoading('ファイルを読み込み中...');

    try {
      const buffer = await file.arrayBuffer();
      this.rawArrayBuffer = buffer;

      if (isPdf) {
        this.activeFileType = 'pdf';
        await this.renderPdfBuffer(buffer);
      } else if (isTiff) {
        this.activeFileType = 'image';
        await this.renderTiffBuffer(buffer);
      } else {
        this.activeFileType = 'image';
        await this.renderImageBuffer(buffer, file.type);
      }
    } catch (err) {
      console.error('File load error:', err);
      alert('ファイルの読み込みに失敗しました: ' + err.message);
      this.showEmptyDropZone();
    }
  },

  async loadArrayBuffer(buffer, fileName = '') {
    this.rawArrayBuffer = buffer;
    this.activeFileName = fileName || '書類_白消し.pdf';
    document.getElementById('dctFileNameBadge').textContent = this.activeFileName;
    this.activeFileType = 'pdf';
    await this.renderPdfBuffer(buffer);
  },

  async loadUrl(url, fileName = '') {
    this.showLoading('リモートファイルをダウンロード中...');
    this.activeFileName = fileName || url.split('/').pop().split('?')[0] || '書類_白消し.pdf';
    document.getElementById('dctFileNameBadge').textContent = this.activeFileName;

    try {
      const resp = await fetch(url);
      const buffer = await resp.arrayBuffer();
      this.rawArrayBuffer = buffer;

      const isPdf = this.activeFileName.match(/\.pdf$/i) || resp.headers.get('content-type')?.includes('pdf');
      if (isPdf) {
        this.activeFileType = 'pdf';
        await this.renderPdfBuffer(buffer);
      } else {
        this.activeFileType = 'image';
        await this.renderImageBuffer(buffer, resp.headers.get('content-type') || 'image/jpeg');
      }
    } catch (err) {
      console.error('URL load error:', err);
      alert('リモート書類の取得に失敗しました: ' + err.message);
      this.showEmptyDropZone();
    }
  },

  /**
   * PDF のレンダリング (PDF.js)
   */
  async renderPdfBuffer(arrayBuffer) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js が読み込まれていません');
    }

    this.showLoading('PDFページを解析中...');
    const typedarray = new Uint8Array(arrayBuffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
    this.pdfPagesData = [];

    const numPages = pdfDoc.numPages;
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const viewport = page.getViewport({ scale: this.baseScale });

      // オフスクリーンキャンバスに描画してキャッシュ
      const offscreen = document.createElement('canvas');
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      const offCtx = offscreen.getContext('2d');

      await page.render({ canvasContext: offCtx, viewport: viewport }).promise;

      this.pdfPagesData.push({
        pageNum: i,
        width: viewport.width,
        height: viewport.height,
        ptWidth: unscaledViewport.width,
        ptHeight: unscaledViewport.height,
        canvas: offscreen,
        whiteouts: [] // { id, x, y, w, h, label }
      });
    }

    this.currentPageIdx = 0;
    this.displayCurrentPage();
    this.setupEventListeners();
    this.hideLoading();
  },

  /**
   * TIFF のレンダリング (UTIF.js)
   */
  async renderTiffBuffer(arrayBuffer) {
    if (typeof UTIF === 'undefined') {
      throw new Error('UTIF.js が利用できません');
    }
    this.showLoading('TIFF画像を解析中...');
    const ifds = UTIF.decode(arrayBuffer);
    this.pdfPagesData = [];

    for (let i = 0; i < ifds.length; i++) {
      const ifd = ifds[i];
      UTIF.decodeImage(arrayBuffer, ifd);
      const rgba = UTIF.toRGBA8(ifd);

      const offscreen = document.createElement('canvas');
      offscreen.width = ifd.width;
      offscreen.height = ifd.height;
      const offCtx = offscreen.getContext('2d');
      const imgData = offCtx.createImageData(ifd.width, ifd.height);
      imgData.data.set(rgba);
      offCtx.putImageData(imgData, 0, 0);

      this.pdfPagesData.push({
        pageNum: i + 1,
        width: ifd.width,
        height: ifd.height,
        ptWidth: ifd.width * 0.75, // 目安pt
        ptHeight: ifd.height * 0.75,
        canvas: offscreen,
        whiteouts: []
      });
    }

    this.currentPageIdx = 0;
    this.displayCurrentPage();
    this.setupEventListeners();
    this.hideLoading();
  },

  /**
   * 一般画像 (JPEG, PNG等) のレンダリング
   */
  async renderImageBuffer(arrayBuffer, mimeType = 'image/jpeg') {
    this.showLoading('画像をデコード中...');
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    this.pdfPagesData = [{
      pageNum: 1,
      width: img.naturalWidth,
      height: img.naturalHeight,
      ptWidth: img.naturalWidth * 0.75,
      ptHeight: img.naturalHeight * 0.75,
      canvas: offscreen,
      whiteouts: []
    }];

    this.currentPageIdx = 0;
    this.displayCurrentPage();
    this.setupEventListeners();
    this.hideLoading();
  },

  /**
   * 現在選択中ページの表示・キャンバスサイズ設定
   */
  displayCurrentPage() {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;
    const pageData = this.pdfPagesData[this.currentPageIdx];
    if (!pageData) return;

    // ページインジケーター更新
    const indicator = document.getElementById('dctPageIndicator');
    if (indicator) {
      indicator.textContent = `${this.currentPageIdx + 1} / ${this.pdfPagesData.length}`;
    }

    // キャンバス実寸
    const docCanvas = document.getElementById('dctDocCanvas');
    const overlayCanvas = document.getElementById('dctOverlayCanvas');
    const wrapper = document.getElementById('dctCanvasWrapper');

    docCanvas.width = pageData.width;
    docCanvas.height = pageData.height;
    overlayCanvas.width = pageData.width;
    overlayCanvas.height = pageData.height;

    // ズーム表示用CSSサイズ
    const dispW = Math.round(pageData.width * this.zoom);
    const dispH = Math.round(pageData.height * this.zoom);

    docCanvas.style.width = `${dispW}px`;
    docCanvas.style.height = `${dispH}px`;
    overlayCanvas.style.width = `${dispW}px`;
    overlayCanvas.style.height = `${dispH}px`;
    wrapper.style.width = `${dispW}px`;
    wrapper.style.height = `${dispH}px`;

    // 原本画像の描画
    const dCtx = docCanvas.getContext('2d');
    dCtx.clearRect(0, 0, docCanvas.width, docCanvas.height);
    dCtx.drawImage(pageData.canvas, 0, 0);

    // 白消しテープオーバーレイの再描画
    this.redrawOverlay();
  },

  /**
   * 白消しオーバーレイの再描画
   */
  redrawOverlay() {
    const overlayCanvas = document.getElementById('dctOverlayCanvas');
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const pageData = this.pdfPagesData[this.currentPageIdx];
    if (!pageData || !pageData.whiteouts) return;

    pageData.whiteouts.forEach(rect => {
      // 1. 純白のベタ塗り白消し
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      // 2. 編集確認用の極薄いガイド破線枠（印刷・PDF出力時は描画されません）
      ctx.save();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // 白消しラベル（耳消し等の場合）
      if (rect.label) {
        ctx.fillStyle = 'rgba(2, 132, 199, 0.9)';
        ctx.fillRect(rect.x + 2, rect.y + 2, 74, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(rect.label, rect.x + 6, rect.y + 15);
      }
      ctx.restore();
    });
  },

  /**
   * 🧹 左端FAX耳を一発白消し
   */
  eraseLeftMargin(allPages = false) {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;

    this.pushHistory();

    const applyToPage = (pData) => {
      // 左端から指定%の幅で上から下までカバー
      const marginW = Math.round(pData.width * this.marginErasePercent);
      const newRect = {
        id: 'left_ear_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        x: 0,
        y: 0,
        w: marginW,
        h: pData.height,
        label: '🩹 左端FAX耳'
      };
      // 既存の同種があれば置換
      pData.whiteouts = pData.whiteouts.filter(w => !w.label?.includes('左端FAX耳'));
      pData.whiteouts.push(newRect);
    };

    if (allPages) {
      this.pdfPagesData.forEach(applyToPage);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`✅ 全 ${this.pdfPagesData.length} ページの左端FAX耳を白消ししました`);
      }
    } else {
      applyToPage(this.pdfPagesData[this.currentPageIdx]);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('✅ 現在のページの左端FAX耳を白消ししました');
      }
    }

    this.redrawOverlay();
  },

  /**
   * 🧹 上端ヘッダーを一発白消し
   */
  eraseTopMargin() {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;
    this.pushHistory();

    const pData = this.pdfPagesData[this.currentPageIdx];
    const marginH = Math.round(pData.height * 0.05); // 上端 5%
    const newRect = {
      id: 'top_header_' + Date.now(),
      x: 0,
      y: 0,
      w: pData.width,
      h: marginH,
      label: '🩹 上端消去'
    };
    pData.whiteouts = pData.whiteouts.filter(w => !w.label?.includes('上端'));
    pData.whiteouts.push(newRect);
    this.redrawOverlay();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('✅ 上端ヘッダーを白消ししました');
    }
  },

  onMarginPercentChange(val) {
    this.marginErasePercent = parseFloat(val) || 0.075;
    // 既に左端耳消しがある場合は即座に幅を更新
    const pData = this.pdfPagesData[this.currentPageIdx];
    if (pData && pData.whiteouts.some(w => w.label?.includes('左端FAX耳'))) {
      this.eraseLeftMargin(false);
    }
  },

  /**
   * 全白消し解除
   */
  clearCurrentPageWhiteouts() {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;
    this.pushHistory();
    this.pdfPagesData[this.currentPageIdx].whiteouts = [];
    this.redrawOverlay();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('🗑️ 白消しを全解除しました');
    }
  },

  /**
   * 履歴操作 (Undo)
   */
  pushHistory() {
    const snapshot = this.pdfPagesData.map(p => ({
      pageNum: p.pageNum,
      whiteouts: JSON.parse(JSON.stringify(p.whiteouts))
    }));
    this.history.push(snapshot);
    if (this.history.length > 20) this.history.shift();
  },

  undo() {
    if (this.history.length === 0) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('これ以上元に戻せません');
      }
      return;
    }
    const last = this.history.pop();
    last.forEach((item, idx) => {
      if (this.pdfPagesData[idx]) {
        this.pdfPagesData[idx].whiteouts = item.whiteouts;
      }
    });
    this.redrawOverlay();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('↩️ 白消しを元に戻しました');
    }
  },

  /**
   * ページ送り
   */
  prevPage() {
    if (this.currentPageIdx > 0) {
      this.currentPageIdx--;
      this.displayCurrentPage();
    }
  },

  nextPage() {
    if (this.currentPageIdx < this.pdfPagesData.length - 1) {
      this.currentPageIdx++;
      this.displayCurrentPage();
    }
  },

  /**
   * ズーム & フィット
   */
  zoomView(delta) {
    this.zoom = Math.max(0.4, Math.min(3.0, this.zoom + delta));
    const zInd = document.getElementById('dctZoomIndicator');
    if (zInd) zInd.textContent = `${Math.round(this.zoom * 100)}%`;
    this.displayCurrentPage();
  },

  fitWidth() {
    const workArea = document.getElementById('dctWorkArea');
    const pData = this.pdfPagesData[this.currentPageIdx];
    if (!workArea || !pData) return;

    const availableW = workArea.clientWidth - 48;
    this.zoom = Math.max(0.4, Math.min(3.0, availableW / pData.width));
    const zInd = document.getElementById('dctZoomIndicator');
    if (zInd) zInd.textContent = `${Math.round(this.zoom * 100)}%`;
    this.displayCurrentPage();
  },

  /**
   * マウスによる自由ドラッグ白消し
   */
  setupEventListeners() {
    const canvas = document.getElementById('dctOverlayCanvas');
    if (!canvas) return;

    // 古いリスナーをリセットするためクローン
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);

    newCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = newCanvas.getBoundingClientRect();
      const scaleX = newCanvas.width / rect.width;
      const scaleY = newCanvas.height / rect.height;

      this.isDrawing = true;
      this.drawStartX = (e.clientX - rect.left) * scaleX;
      this.drawStartY = (e.clientY - rect.top) * scaleY;
    });

    newCanvas.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;
      const rect = newCanvas.getBoundingClientRect();
      const scaleX = newCanvas.width / rect.width;
      const scaleY = newCanvas.height / rect.height;

      const curX = (e.clientX - rect.left) * scaleX;
      const curY = (e.clientY - rect.top) * scaleY;

      // リアルタイムプレビュー
      this.redrawOverlay();
      const ctx = newCanvas.getContext('2d');
      ctx.save();
      const rx = Math.min(this.drawStartX, curX);
      const ry = Math.min(this.drawStartY, curY);
      const rw = Math.abs(curX - this.drawStartX);
      const rh = Math.abs(curY - this.drawStartY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    });

    const finishDraw = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      const rect = newCanvas.getBoundingClientRect();
      const scaleX = newCanvas.width / rect.width;
      const scaleY = newCanvas.height / rect.height;

      const endX = (e.clientX - rect.left) * scaleX;
      const endY = (e.clientY - rect.top) * scaleY;

      const rw = Math.abs(endX - this.drawStartX);
      const rh = Math.abs(endY - this.drawStartY);

      // 最低サイズ（誤クリック防止）
      if (rw > 5 && rh > 5) {
        this.pushHistory();
        const rx = Math.min(this.drawStartX, endX);
        const ry = Math.min(this.drawStartY, endY);
        const pData = this.pdfPagesData[this.currentPageIdx];
        pData.whiteouts.push({
          id: 'manual_' + Date.now(),
          x: rx,
          y: ry,
          w: rw,
          h: rh
        });
      }
      this.redrawOverlay();
    };

    newCanvas.addEventListener('mouseup', finishDraw);
    newCanvas.addEventListener('mouseleave', finishDraw);
  },

  /**
   * 📥 修正済みPDFの生成＆ダウンロード
   */
  async exportCleanPDF() {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;
    if (typeof PDFLib === 'undefined') {
      alert('PDFLib ライブラリが読み込まれていません');
      return;
    }

    this.showLoading('修正済み高品質PDFを出力中...');

    try {
      let finalPdfBytes = null;

      // ─── パターンA: 元がPDFの場合（元のベクター情報・フォントを保持したまま白消し矩形を描画） ───
      if (this.activeFileType === 'pdf' && this.rawArrayBuffer) {
        const pdfDoc = await PDFLib.PDFDocument.load(this.rawArrayBuffer);
        const pages = pdfDoc.getPages();

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pageData = this.pdfPagesData[i];
          if (!pageData || !pageData.whiteouts || pageData.whiteouts.length === 0) continue;

          const { width: ptW, height: ptH } = page.getSize();
          const scaleX = ptW / pageData.width;
          const scaleY = ptH / pageData.height;

          for (const w of pageData.whiteouts) {
            // PDF座標系への変換 (PDFの原点は左下)
            const pdfX = w.x * scaleX;
            const pdfW = w.w * scaleX;
            const pdfH = w.h * scaleY;
            const pdfY = ptH - (w.y * scaleY + pdfH);

            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: pdfW,
              height: pdfH,
              color: PDFLib.rgb(1, 1, 1),
              opacity: 1
            });
          }
        }

        finalPdfBytes = await pdfDoc.save();
      } else {
        // ─── パターンB: 元が画像/TIFFの場合（白消し合成キャンバスからPDFを作成） ───
        const pdfDoc = await PDFLib.PDFDocument.create();

        for (const pageData of this.pdfPagesData) {
          const mergedCanvas = document.createElement('canvas');
          mergedCanvas.width = pageData.width;
          mergedCanvas.height = pageData.height;
          const mCtx = mergedCanvas.getContext('2d');

          // 原本描画
          mCtx.drawImage(pageData.canvas, 0, 0);

          // 白消し描画
          mCtx.fillStyle = '#FFFFFF';
          pageData.whiteouts.forEach(w => {
            mCtx.fillRect(w.x, w.y, w.w, w.h);
          });

          const jpgDataUrl = mergedCanvas.toDataURL('image/jpeg', 0.95);
          const embeddedJpg = await pdfDoc.embedJpg(jpgDataUrl);
          const pdfPage = pdfDoc.addPage([embeddedJpg.width * 0.75, embeddedJpg.height * 0.75]);
          pdfPage.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: embeddedJpg.width * 0.75,
            height: embeddedJpg.height * 0.75
          });
        }

        finalPdfBytes = await pdfDoc.save();
      }

      // ファイルダウンロード
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const downloadName = this.activeFileName.replace(/\.[^/.]+$/, '') + '_白消し済.pdf';

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      this.hideLoading();

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`✅ ${downloadName} をダウンロードしました`);
      }
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF出力中にエラーが発生しました: ' + err.message);
      this.hideLoading();
    }
  },

  /**
   * 🖼️ 高解像度画像として保存
   */
  exportCleanImage() {
    if (!this.pdfPagesData || this.pdfPagesData.length === 0) return;
    const pageData = this.pdfPagesData[this.currentPageIdx];
    if (!pageData) return;

    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = pageData.width;
    mergedCanvas.height = pageData.height;
    const mCtx = mergedCanvas.getContext('2d');

    // 原本描画
    mCtx.drawImage(pageData.canvas, 0, 0);

    // 白消し描画
    mCtx.fillStyle = '#FFFFFF';
    pageData.whiteouts.forEach(w => {
      mCtx.fillRect(w.x, w.y, w.w, w.h);
    });

    const downloadName = this.activeFileName.replace(/\.[^/.]+$/, '') + `_p${pageData.pageNum}_白消し済.jpg`;
    mergedCanvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`✅ ${downloadName} を保存しました`);
      }
    }, 'image/jpeg', 0.95);
  }
};

window.DigitalCorrectionTape = DigitalCorrectionTape;
