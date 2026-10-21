/**
 * 店舗送付パック（表紙＋依頼書＋所在図＋配置図 → 1つのPDF）作成UI
 * 行政書士法人フェリス
 *
 * 実物の DocuWorks / Excel テンプレートを使うため、処理はローカル補助サーバー
 * （scripts/oss_pack_server.py）で行う。ツールは補助サーバー経由（http://localhost:8765/）で開く想定。
 */
const OssStorePack = (() => {
  const API = (location.protocol === 'http:' && location.port === '8765') ? '' : 'http://localhost:8765';
  const LS_TEL = 'oss_pack_dealer_tel';
  const LS_EAR = 'oss_pack_ear';
  const LS_FORM = 'oss_pack_form_';

  let state = null; // { fileId, pages:[{index,thumb,width,height}], selected:[{index,rotate}], focus, ear:{top,bottom,left,right,width} }

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = msg => (typeof showToast === 'function' ? showToast(msg) : console.log(msg));

  async function api(path, body) {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const res = await fetch(API + path, opt);
    const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || json.ok === false) throw new Error(json.error || (json.issues || []).join('\n') || `HTTP ${res.status}`);
    return json;
  }

  function loadJSON(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch (e) { return def; }
  }

  function reiwaToday() {
    const d = new Date();
    return `令　和　${d.getFullYear() - 2018}　年　${d.getMonth() + 1}月${d.getDate()}日　`;
  }

  // ── 初期値の収集（ツール画面の入力 ＋ 連携案件） ──
  function collectDefaults() {
    const ocr = ($('ocrCodeInput')?.value || '').replace(/\D/g, '');
    const digits8 = ocr.length > 8 ? ocr.slice(-8) : ocr.padStart(8, '0');
    const dealerName = ($('dealerInfoInput')?.value || '').replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '').trim();
    const telMap = loadJSON(LS_TEL, {});
    let p = null;
    try {
      if (typeof linkedCaseId !== 'undefined' && linkedCaseId && typeof OssDocuWorks !== 'undefined') p = OssDocuWorks.getCasePayload(linkedCaseId);
    } catch (e) { p = null; }
    const reg = ($('regNoInput')?.value || '').trim();
    const base = {
      orderNo8: digits8,
      dealerName: dealerName || p?.dealerName || '',
      dealerTel: telMap[dealerName] || '',
      regNo: reg || '増車',
      dateText: reiwaToday(),
      contactName: p?.contactName || '',
      usageLocation: '申請者に同じ',
      parkingLocation: '同上',
      zip: '',
      address: p?.carAddress || ($('homeAddress')?.value || ''),
      applicantName: p?.applicantName || (typeof linkedCaseTitle !== 'undefined' ? linkedCaseTitle : '') || ''
    };
    // 同じ注文番号で以前入力した内容があれば復元（日付は今日に更新）
    const saved = loadJSON(LS_FORM + digits8, null);
    if (saved) Object.assign(base, saved, { dateText: reiwaToday() });
    return base;
  }

  // ── モーダル ──
  function open() {
    $('ossStorePackModal')?.remove();
    const d = collectDefaults();
    const earSaved = loadJSON(LS_EAR, { top: true, bottom: false, left: false, right: false, width: 3 });
    state = { fileId: null, pages: [], selected: [], focus: null, ear: earSaved, kind: null };

    const field = (id, label, val, attrs = '') =>
      `<label class="osp-field"><span>${label}</span><input id="${id}" value="${esc(val)}" ${attrs}></label>`;

    const modal = document.createElement('div');
    modal.id = 'ossStorePackModal';
    modal.innerHTML = `
      <div class="osp-overlay"></div>
      <div class="osp-dialog" role="dialog" aria-labelledby="ospTitle">
        <div class="osp-head">
          <h2 id="ospTitle">📦 店舗送付パック作成 <small>表紙 → 依頼書 → 所在図 → 配置図 を1つのPDFに</small></h2>
          <button class="osp-x" id="ospCloseBtn" title="閉じる">✕</button>
        </div>
        <div id="ospServerStatus" class="osp-status">⏳ 補助サーバーを確認中...</div>
        <div class="osp-body">
          <section class="osp-sec">
            <h3>① 番号・送付先（所在図・配置図に入ります）</h3>
            <div class="osp-grid">
              ${field('ospOrderNo', '注文書番号（8桁）', d.orderNo8, 'maxlength="8" inputmode="numeric" style="font-family:monospace;letter-spacing:2px;font-weight:bold"')}
              ${field('ospRegNo', '登録番号', d.regNo)}
              ${field('ospDealer', '店名（連絡先）', d.dealerName)}
              ${field('ospDealerTel', '店舗の電話番号', d.dealerTel, 'placeholder="例: 0587-55-6311（店名ごとに記憶）"')}
            </div>
          </section>
          <section class="osp-sec">
            <h3>② 表紙（書類確認書）</h3>
            <div class="osp-grid">
              ${field('ospDate', '日付', d.dateText)}
              ${field('ospContact', '担当者（様）', d.contactName)}
              ${field('ospUsage', '使用の本拠の位置', d.usageLocation)}
              ${field('ospParking', '保管場所の位置', d.parkingLocation)}
              ${field('ospZip', '申請者 〒', d.zip, 'placeholder="例: 480-0146"')}
              ${field('ospApplicant', '申請者 氏名', d.applicantName)}
              <label class="osp-field osp-wide"><span>申請者 住所</span><input id="ospAddress" value="${esc(d.address)}"></label>
            </div>
            <div class="osp-note">作成担当は「吉村」で出力されます。</div>
          </section>
          <section class="osp-sec">
            <h3>③ 依頼書（耳消し）</h3>
            <input type="file" id="ospReqFile" accept=".pdf,.tif,.tiff" hidden>
            <div id="ospDrop" class="osp-drop" tabindex="0">
              <div id="ospDropMsg">📄 依頼書の <b>PDF（メール）</b> または <b>TIF（FAX）</b> をここにドラッグ<br><small>またはクリックして選択 ／ 依頼書なしでも作成できます</small></div>
            </div>
            <div id="ospReqArea" class="osp-req" hidden>
              <div class="osp-req-left">
                <div class="osp-hint">使うページをクリック（選んだ順に入ります）</div>
                <div id="ospThumbs" class="osp-thumbs"></div>
              </div>
              <div class="osp-req-right">
                <div class="osp-ear">
                  <span>耳消し：</span>
                  ${['top:上', 'bottom:下', 'left:左', 'right:右'].map(s => {
                    const [k, l] = s.split(':');
                    return `<button type="button" class="osp-edge ${state.ear[k] ? 'on' : ''}" data-edge="${k}" id="ospEdge_${k}">${l}</button>`;
                  }).join('')}
                  <label class="osp-earw">幅 <input type="range" id="ospEarWidth" min="1" max="12" step="0.5" value="${state.ear.width}"> <b id="ospEarWidthVal">${state.ear.width}%</b></label>
                </div>
                <div class="osp-preview-wrap">
                  <canvas id="ospPreview" width="380" height="380"></canvas>
                  <div id="ospPreviewEmpty" class="osp-preview-empty">左でページを選ぶと<br>仕上がりがここに出ます</div>
                </div>
                <div class="osp-rot">
                  <button type="button" id="ospRotL">⟲ 左に回転</button>
                  <button type="button" id="ospRotR">⟳ 右に回転</button>
                  <button type="button" id="ospClearReq">依頼書を外す</button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div class="osp-foot">
          <div id="ospResult" class="osp-result"></div>
          <button id="ospBuildBtn" class="osp-build">📦 送付用PDFを作成</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    injectStyle();
    bind();
    checkServer();
  }

  function close() { $('ossStorePackModal')?.remove(); }

  async function checkServer() {
    const el = $('ospServerStatus');
    try {
      const r = await api('/api/oss-pack/ping');
      el.className = 'osp-status ok';
      el.textContent = `✅ 準備OK（保存先: ${r.outputRoot}）`;
    } catch (e) {
      el.className = 'osp-status ng';
      el.innerHTML = `⚠️ 補助サーバーにつながりません。<b>gyosei-dashboardフォルダの「start_syako_tool.bat」</b>からツールを開き直してください。<br><small>${esc(e.message)}</small>`;
      $('ospBuildBtn').disabled = true;
    }
  }

  function bind() {
    $('ospCloseBtn').onclick = close;
    modalEl().querySelector('.osp-overlay').onclick = close;
    const drop = $('ospDrop'), file = $('ospReqFile');
    drop.onclick = () => file.click();
    drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') file.click(); };
    file.onchange = () => { if (file.files[0]) loadRequest(file.files[0]); file.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hover'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hover'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadRequest(f); });

    modalEl().querySelectorAll('.osp-edge').forEach(b => b.onclick = () => {
      const k = b.dataset.edge; state.ear[k] = !state.ear[k]; b.classList.toggle('on', state.ear[k]); saveEar(); drawPreview();
    });
    $('ospEarWidth').oninput = e => { state.ear.width = parseFloat(e.target.value); $('ospEarWidthVal').textContent = state.ear.width + '%'; saveEar(); drawPreview(); };
    $('ospRotL').onclick = () => rotateFocus(-90);
    $('ospRotR').onclick = () => rotateFocus(90);
    $('ospClearReq').onclick = () => { state.fileId = null; state.pages = []; state.selected = []; state.focus = null; $('ospReqArea').hidden = true; $('ospDrop').hidden = false; };
    $('ospBuildBtn').onclick = build;
    $('ospOrderNo').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); };
  }

  const modalEl = () => $('ossStorePackModal');
  const saveEar = () => localStorage.setItem(LS_EAR, JSON.stringify(state.ear));

  async function loadRequest(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'tif', 'tiff'].includes(ext)) { alert('PDF または TIF ファイルを選んでください'); return; }
    const drop = $('ospDrop');
    const msg = $('ospDropMsg');
    const msgHtml = msg.innerHTML;
    msg.innerHTML = '⏳ 依頼書を読み込み中...';
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const r = await api('/api/oss-pack/request-doc', { name: f.name, data });
      state.fileId = r.fileId; state.pages = r.pages; state.kind = r.kind;
      state.selected = r.pages.length === 1 ? [{ index: 0, rotate: 0 }] : [];
      state.focus = state.selected.length ? 0 : null;
      // FAX は耳消しON、メールPDFは耳消しOFFを初期値に（いつでも切替可）
      if (r.kind === 'pdf') ['top', 'bottom', 'left', 'right'].forEach(k => { state.ear[k] = false; $('ospEdge_' + k).classList.remove('on'); });
      else if (!['top', 'bottom', 'left', 'right'].some(k => state.ear[k])) { state.ear.top = true; $('ospEdge_top').classList.add('on'); }
      $('ospReqArea').hidden = false; drop.hidden = true;
      renderThumbs(); drawPreview();
      toast(`📄 依頼書を読み込みました（${r.pages.length}ページ）`);
    } catch (e) {
      alert('依頼書の読み込みに失敗しました: ' + e.message);
    } finally {
      msg.innerHTML = msgHtml;
    }
  }

  function renderThumbs() {
    const box = $('ospThumbs');
    box.innerHTML = state.pages.map(p => {
      const selIdx = state.selected.findIndex(s => s.index === p.index);
      const sel = selIdx >= 0 ? state.selected[selIdx] : null;
      return `<button type="button" class="osp-thumb ${sel ? 'sel' : ''} ${sel && state.focus === selIdx ? 'focus' : ''}" data-index="${p.index}" id="ospThumb_${p.index}">
        <img src="${p.thumb}" style="transform:rotate(${sel ? sel.rotate : 0}deg)" alt="${p.index + 1}ページ">
        <span class="osp-pno">${p.index + 1}P</span>
        ${sel ? `<span class="osp-order">${selIdx + 1}</span>` : ''}
      </button>`;
    }).join('');
    box.querySelectorAll('.osp-thumb').forEach(b => b.onclick = () => {
      const idx = parseInt(b.dataset.index, 10);
      const at = state.selected.findIndex(s => s.index === idx);
      if (at >= 0 && state.focus === at) { state.selected.splice(at, 1); state.focus = state.selected.length ? 0 : null; }
      else if (at >= 0) { state.focus = at; }
      else { state.selected.push({ index: idx, rotate: 0 }); state.focus = state.selected.length - 1; }
      renderThumbs(); drawPreview();
    });
  }

  function rotateFocus(deg) {
    if (state.focus == null) return;
    const s = state.selected[state.focus];
    s.rotate = ((s.rotate + deg) % 360 + 360) % 360;
    renderThumbs(); drawPreview();
  }

  function drawPreview() {
    const cv = $('ospPreview'); if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const empty = $('ospPreviewEmpty');
    if (state.focus == null || !state.selected[state.focus]) { empty.hidden = false; return; }
    empty.hidden = true;
    const sel = state.selected[state.focus];
    const page = state.pages.find(p => p.index === sel.index);
    const img = new Image();
    img.onload = () => {
      const rot = sel.rotate % 180 !== 0;
      const iw = rot ? img.height : img.width, ih = rot ? img.width : img.height;
      const s = Math.min(cv.width / iw, cv.height / ih);
      const w = iw * s, h = ih * s, x = (cv.width - w) / 2, y = (cv.height - h) / 2;
      ctx.save();
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(sel.rotate * Math.PI / 180);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      // 耳消し範囲（白で消える部分）を表示
      const e = state.ear, f = e.width / 100;
      const rects = [];
      if (e.top) rects.push([x, y, w, h * f]);
      if (e.bottom) rects.push([x, y + h - h * f, w, h * f]);
      if (e.left) rects.push([x, y, w * f, h]);
      if (e.right) rects.push([x + w - w * f, y, w * f, h]);
      rects.forEach(r => {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(...r);
        ctx.strokeStyle = '#EF4444'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(...r); ctx.setLineDash([]);
      });
      ctx.strokeStyle = '#94A3B8'; ctx.strokeRect(x, y, w, h);
    };
    img.src = page.thumb;
  }

  // ── 地図の取り込み（印刷・PDF保存と同じ見た目） ──
  async function captureMap(target) {
    const isSozai = target === 'sozai';
    const container = $(isSozai ? 'sozaiContainer' : 'haichiContainer');
    const mode = isSozai ? sozaiMode : haichiMode;
    if (mode !== 'map') return await captureCleanCanvasContainer(container);

    const prev = { border: container.style.border, outline: container.style.outline, shadow: container.style.boxShadow };
    const hadGrid = container.classList.contains('grid-bg');
    if (hadGrid) container.classList.remove('grid-bg');
    container.style.border = 'none'; container.style.outline = 'none'; container.style.boxShadow = 'none';
    try {
      let c = await html2canvas(container, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      if (isSozai) c = applyHighContrastWhitewash(c, parseInt($('contrastSlider')?.value, 10) || 160);
      return c.toDataURL('image/png');
    } finally {
      container.style.border = prev.border; container.style.outline = prev.outline; container.style.boxShadow = prev.shadow;
      if (hadGrid) container.classList.add('grid-bg');
    }
  }

  async function build() {
    const v = id => ($(id)?.value || '').trim();
    const orderNo8 = v('ospOrderNo');
    if (!/^\d{8}$/.test(orderNo8)) { alert('注文書番号は8桁の数字で入力してください'); $('ospOrderNo').focus(); return; }
    if (!v('ospDealer')) { alert('店名を入力してください'); $('ospDealer').focus(); return; }
    if (state.fileId && !state.selected.length) {
      if (!confirm('依頼書のページが選ばれていません。依頼書なしで作成しますか？')) return;
    }

    const btn = $('ospBuildBtn'), out = $('ospResult');
    btn.disabled = true; btn.textContent = '⏳ 作成中...（Excel・DocuWorks 処理）';
    out.innerHTML = '';
    try {
      if (typeof clearSelection === 'function') clearSelection();
      const [sozaiPng, haichiPng] = [await captureMap('sozai'), await captureMap('haichi')];

      const telMap = loadJSON(LS_TEL, {});
      if (v('ospDealerTel')) { telMap[v('ospDealer')] = v('ospDealerTel'); localStorage.setItem(LS_TEL, JSON.stringify(telMap)); }

      const cover = {
        dealerName: v('ospDealer'), dateText: v('ospDate'), contactName: v('ospContact'),
        usageLocation: v('ospUsage'), parkingLocation: v('ospParking'),
        zip: v('ospZip'), address: v('ospAddress'), applicantName: v('ospApplicant')
      };
      localStorage.setItem(LS_FORM + orderNo8, JSON.stringify({ ...cover, dealerTel: v('ospDealerTel'), regNo: v('ospRegNo') }));

      const e = state.ear, w = e.width;
      const body = {
        orderNo8, dealerName: v('ospDealer'), dealerTel: v('ospDealerTel'), regNo: v('ospRegNo'),
        applicantName: v('ospApplicant'), cover, sozaiPng, haichiPng,
        request: state.fileId && state.selected.length ? {
          fileId: state.fileId,
          pages: state.selected.map(s => ({ index: s.index, rotate: s.rotate })),
          ear: { top: e.top ? w : 0, bottom: e.bottom ? w : 0, left: e.left ? w : 0, right: e.right ? w : 0 }
        } : null
      };
      const r = await api('/api/oss-pack/build', body);
      const kb = Math.round(r.pdf_size / 1024);
      out.innerHTML = `
        <div class="osp-done">✅ 完成しました（${r.pages}ページ・${kb >= 1024 ? (kb / 1024).toFixed(1) + 'MB' : kb + 'KB'}）</div>
        <div class="osp-path" title="${esc(r.pdf)}">${esc(r.pdf.split('\\').pop())}</div>
        <div class="osp-open">
          <button type="button" id="ospOpenPdf">📄 PDFを開く</button>
          <button type="button" id="ospOpenFolder">📂 フォルダを開く</button>
        </div>`;
      $('ospOpenPdf').onclick = () => api('/api/oss-pack/open', { path: r.pdf }).catch(err => alert(err.message));
      $('ospOpenFolder').onclick = () => api('/api/oss-pack/open', { path: r.folder }).catch(err => alert(err.message));
      toast('✅ 店舗送付用PDFを作成しました');
    } catch (err) {
      console.error(err);
      out.innerHTML = `<div class="osp-err">⚠️ 作成に失敗しました：${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '📦 送付用PDFを作成';
    }
  }

  function injectStyle() {
    if ($('ossStorePackStyle')) return;
    const st = document.createElement('style');
    st.id = 'ossStorePackStyle';
    st.textContent = `
      #ossStorePackModal{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;font-family:inherit}
      #ossStorePackModal .osp-overlay{position:absolute;inset:0;background:rgba(2,6,23,.78);backdrop-filter:blur(4px)}
      #ossStorePackModal .osp-dialog{position:relative;width:980px;max-width:96vw;max-height:94vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1E293B,#172033);border:1px solid #334155;border-radius:14px;color:#E2E8F0;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:ospIn .18s ease-out}
      @keyframes ospIn{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
      #ossStorePackModal .osp-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #334155}
      #ossStorePackModal h2{margin:0;font-size:1.1rem;color:#38BDF8}
      #ossStorePackModal h2 small{color:#94A3B8;font-weight:normal;font-size:.75rem;margin-left:8px}
      #ossStorePackModal .osp-x{background:none;border:none;color:#94A3B8;font-size:1.3rem;cursor:pointer}
      #ossStorePackModal .osp-status{margin:10px 18px 0;padding:7px 10px;border-radius:8px;font-size:.78rem;background:#0F172A;border:1px solid #334155}
      #ossStorePackModal .osp-status.ok{border-color:#10B981;color:#6EE7B7}
      #ossStorePackModal .osp-status.ng{border-color:#F59E0B;color:#FCD34D}
      #ossStorePackModal .osp-body{overflow:auto;padding:6px 18px 10px}
      #ossStorePackModal .osp-sec{background:#0F172A;border:1px solid #273449;border-radius:10px;padding:10px 12px;margin-top:10px}
      #ossStorePackModal h3{margin:0 0 8px;font-size:.86rem;color:#F8FAFC}
      #ossStorePackModal .osp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      #ossStorePackModal .osp-field{display:flex;flex-direction:column;gap:3px;font-size:.72rem;color:#94A3B8}
      #ossStorePackModal .osp-field.osp-wide{grid-column:span 2}
      #ossStorePackModal .osp-field input{background:#1E293B;border:1px solid #475569;border-radius:6px;color:#F8FAFC;padding:6px 8px;font-size:.85rem}
      #ossStorePackModal .osp-field input:focus{outline:none;border-color:#38BDF8;box-shadow:0 0 0 2px rgba(56,189,248,.25)}
      #ossStorePackModal .osp-note{font-size:.7rem;color:#64748B;margin-top:6px}
      #ossStorePackModal .osp-drop{border:2px dashed #475569;border-radius:10px;padding:18px;text-align:center;color:#CBD5E1;cursor:pointer;transition:.15s;font-size:.85rem}
      #ossStorePackModal .osp-drop.hover,#ossStorePackModal .osp-drop:hover{border-color:#38BDF8;background:rgba(56,189,248,.06)}
      #ossStorePackModal .osp-req{display:grid;grid-template-columns:1fr 400px;gap:12px}
      #ossStorePackModal .osp-hint{font-size:.72rem;color:#94A3B8;margin-bottom:6px}
      #ossStorePackModal .osp-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:400px;overflow:auto;padding:2px}
      #ossStorePackModal .osp-thumb{position:relative;background:#fff;border:2px solid #334155;border-radius:6px;padding:4px;cursor:pointer;aspect-ratio:1/1.2;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:.12s}
      #ossStorePackModal .osp-thumb:hover{border-color:#64748B;transform:translateY(-1px)}
      #ossStorePackModal .osp-thumb.sel{border-color:#38BDF8}
      #ossStorePackModal .osp-thumb.focus{border-color:#F59E0B;box-shadow:0 0 0 2px rgba(245,158,11,.35)}
      #ossStorePackModal .osp-thumb img{max-width:100%;max-height:100%;transition:transform .15s}
      #ossStorePackModal .osp-pno{position:absolute;left:4px;bottom:4px;background:rgba(15,23,42,.8);color:#fff;font-size:.65rem;padding:1px 5px;border-radius:4px}
      #ossStorePackModal .osp-order{position:absolute;right:4px;top:4px;background:#38BDF8;color:#0F172A;font-weight:bold;font-size:.75rem;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center}
      #ossStorePackModal .osp-ear{display:flex;align-items:center;gap:5px;font-size:.75rem;flex-wrap:wrap;margin-bottom:6px}
      #ossStorePackModal .osp-edge{background:#1E293B;border:1px solid #475569;color:#CBD5E1;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:.75rem}
      #ossStorePackModal .osp-edge.on{background:#F59E0B;border-color:#F59E0B;color:#111;font-weight:bold}
      #ossStorePackModal .osp-earw{display:flex;align-items:center;gap:4px;margin-left:auto}
      #ossStorePackModal .osp-earw input{width:90px}
      #ossStorePackModal .osp-preview-wrap{position:relative;background:#334155;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:6px}
      #ossStorePackModal .osp-preview-empty{position:absolute;color:#94A3B8;font-size:.78rem;text-align:center}
      #ossStorePackModal .osp-rot{display:flex;gap:6px;margin-top:6px}
      #ossStorePackModal .osp-rot button,#ossStorePackModal .osp-open button{flex:1;background:#1E293B;border:1px solid #475569;color:#E2E8F0;border-radius:6px;padding:5px;cursor:pointer;font-size:.75rem}
      #ossStorePackModal .osp-rot button:hover,#ossStorePackModal .osp-open button:hover{border-color:#38BDF8;color:#38BDF8}
      #ossStorePackModal .osp-foot{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid #334155}
      #ossStorePackModal .osp-result{flex:1;font-size:.78rem;min-width:0}
      #ossStorePackModal .osp-done{color:#6EE7B7;font-weight:bold}
      #ossStorePackModal .osp-err{color:#FCA5A5}
      #ossStorePackModal .osp-path{color:#94A3B8;font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0 5px}
      #ossStorePackModal .osp-open{display:flex;gap:6px;max-width:320px}
      #ossStorePackModal .osp-build{background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#fff;border:none;border-radius:10px;padding:12px 22px;font-weight:bold;font-size:.95rem;cursor:pointer;box-shadow:0 6px 18px rgba(14,165,233,.35);transition:.15s;white-space:nowrap}
      #ossStorePackModal .osp-build:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(14,165,233,.5)}
      #ossStorePackModal .osp-build:disabled{opacity:.6;cursor:wait}
    `;
    document.head.appendChild(st);
  }

  return { open, close, loadRequest };
})();
