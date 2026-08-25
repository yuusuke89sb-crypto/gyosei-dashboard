/**
 * 案件書類管理モジュール
 * - 案件ごとに書類（PDF・画像・Word等）を添付
 * - Google Drive に自動保存（GAS経由）
 * - メタデータ（URL・ファイル名・日時）を localStorage に保持
 * - 2年間保管義務に対応
 */
const CaseDocs = {

  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB

  // ─── ファイルを Drive にアップロード ────────────────────────
  async upload(caseId, file) {
    if (!SpreadsheetSync.isConfigured()) {
      App.showToast('⚠️ GAS連携が未設定です。設定 → 連携設定 から設定してください');
      return null;
    }
    if (file.size > this.MAX_FILE_SIZE) {
      App.showToast('ファイルサイズは15MB以内にしてください');
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        // base64部分のみ抽出（data:xxx;base64, を除去）
        const base64Data = e.target.result.split(',')[1];
        const btn = document.getElementById(`docsUploadBtn_${caseId}`);
        if (btn) { btn.disabled = true; btn.textContent = '⏳ アップロード中...'; }

        try {
          const c = Store.getCase(caseId);
          let caseTitle = c ? c.title : '';
          let clientId = c ? c.clientId : '';
          
          // 新規作成時などStoreに保存される前は画面上の入力値を取得
          if (!caseTitle) {
            const titleInput = document.getElementById('csf_title');
            if (titleInput) caseTitle = titleInput.value;
          }
          if (!caseTitle) caseTitle = '無題の案件';

          if (!clientId) {
            const clientSelect = document.getElementById('csf_clientId');
            if (clientSelect) clientId = clientSelect.value;
          }
          
          let clientName = '不明な顧客';
          if (clientId) {
            const client = Store.getClient(clientId);
            if (client) clientName = client.name;
          }
          const result = await SpreadsheetSync.push('saveCaseDocument', {
            caseId,
            caseTitle,
            clientName,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data,
            folderUrl: c ? c.driveFolderUrl : undefined,
          });

          if (result && result.success) {
            const docMeta = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              name: file.name,
              driveUrl: result.url || '',
              driveId: result.fileId || '',
              mimeType: file.type || '',
              size: file.size,
              uploadedAt: new Date().toISOString(),
            };
            // メタデータを案件に追加
            const c = Store.getCase(caseId);
            const docs = Array.isArray(c?.docs) ? [...c.docs, docMeta] : [docMeta];
            Store.updateCase(caseId, { docs });
            App.showToast(`✅ ${file.name} をDriveに保存しました`);
            resolve(docMeta);
          } else {
            App.showToast(`❌ アップロード失敗: ${result?.error || '不明なエラー'}`);
            resolve(null);
          }
        } catch (err) {
          App.showToast(`❌ 通信エラー: ${err.message}`);
          resolve(null);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '📎 書類を追加'; }
        }
      };
      reader.readAsDataURL(file);
    });
  },

  // ─── Drive からファイルを削除 ─────────────────────────────
  async delete(caseId, docId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    const doc = (c.docs || []).find(d => d.id === docId);
    if (!doc) return;

    if (!confirm(`「${doc.name}」を削除しますか？\nDriveからも削除されます。`)) return;

    // ローカルから削除
    const docs = (c.docs || []).filter(d => d.id !== docId);
    Store.updateCase(caseId, { docs });

    // Drive からも削除（失敗しても継続）
    if (doc.driveId && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('deleteCaseDocument', { fileId: doc.driveId }).catch(() => {});
    }

    // UIを更新
    const el = document.getElementById(`doc_${docId}`);
    if (el) el.remove();
    const listEl = document.getElementById(`docsList_${caseId}`);
    if (listEl && !listEl.querySelector('.doc-item')) {
      listEl.innerHTML = '<div class="docs-empty">書類が添付されていません</div>';
    }
    // カウント更新
    const countEl = document.getElementById(`docsCount_${caseId}`);
    if (countEl) countEl.textContent = (docs.length) + '件';

    App.showToast(`🗑️ ${doc.name} を削除しました`);
  },

  // ─── 書類パネルを描画（案件編集モーダル内） ───────────────
  renderPanel(caseId) {
    const c = Store.getCase(caseId);
    let docs = Array.isArray(c?.docs) ? [...c.docs] : [];

    // インボックスやFAX由来の添付ファイルがあれば自動マージして一覧に含める
    if (c) {
      if (c.inboxId && typeof Store.getInbox === 'function') {
        const inb = Store.getInbox().find(i => i.id === c.inboxId);
        if (inb && Array.isArray(inb.attachments)) {
          inb.attachments.forEach((att, idx) => {
            const attName = att.name || '受信添付書類';
            if (!docs.some(d => d.name === attName || (d.driveUrl && att.url && d.driveUrl === att.url))) {
              docs.push({
                id: 'inb_' + (att.id || idx),
                name: attName,
                driveUrl: att.url || '',
                mimeType: att.mimeType || (attName.toLowerCase().endsWith('.tif') ? 'image/tiff' : (attName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')),
                size: att.size || 0,
                uploadedAt: inb.date || new Date().toISOString(),
                source: 'inbox'
              });
            }
          });
        }
      }
    }
    const hasGas = SpreadsheetSync.isConfigured();

    return `
      <div class="docs-panel">
        <div class="docs-panel-header">
          <span class="docs-title">📎 添付書類</span>
          <span class="docs-badge" id="docsCount_${caseId}">${docs.length}件</span>
          ${!hasGas ? `<span class="docs-warn" title="GAS連携が必要">⚠️ 未連携</span>` : ''}
        </div>

        <div class="docs-list" id="docsList_${caseId}">
          ${docs.length === 0
            ? '<div class="docs-empty">書類が添付されていません</div>'
            : docs.map(d => this.renderDocItem(caseId, d)).join('')
          }
        </div>

        <div class="docs-upload-area">
          <label class="docs-upload-btn" id="docsUploadBtn_${caseId}">
            <input type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt"
              style="display:none"
              onchange="CaseDocs.onFileSelect('${caseId}', this)"
              ${!hasGas ? 'disabled' : ''}>
            📎 書類を追加
          </label>
          <span class="docs-hint">PDF・TIF・画像・Word・Excel / 最大15MB</span>
        </div>

        <div class="docs-export-area" style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'receipt')">📥 お預かり証</button>
            <button type="button" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'transmittal')">📤 送付状</button>
            <button type="button" class="btn btn-primary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'poa')">📝 委任状</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'estimate')">📊 見積書</button>
            <button type="button" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'agreement')">🤝 委託契約</button>
            <button type="button" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:6px" onclick="CaseDocs.generateDocument('${caseId}', 'antisocial')">🔒 反社表明確約</button>
          </div>
        </div>
      </div>
    `;
  },

  renderDocItem(caseId, doc) {
    const icon = this.getIcon(doc.mimeType);
    const size = this.formatSize(doc.size);
    const date = doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : '';
    const isInbox = doc.source === 'inbox';
    return `
      <div class="doc-item" id="doc_${doc.id}">
        <span class="doc-icon">${icon}</span>
        <div class="doc-info">
          <div class="doc-name">${doc.name} ${isInbox ? '<span style="font-size:0.7rem; background:rgba(59,130,246,0.15); color:#38bdf8; padding:1px 5px; border-radius:4px; margin-left:4px;">受信原本</span>' : ''}</div>
          <div class="doc-meta">${[size, date].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="doc-actions">
          ${doc.driveUrl
            ? `<a class="doc-btn" href="${doc.driveUrl}" target="_blank" title="Driveで開く / 閲覧">🔗 開く</a>`
            : ''
          }
          ${!isInbox ? `<button class="doc-btn doc-btn-delete" onclick="CaseDocs.delete('${caseId}', '${doc.id}')" title="削除">🗑️</button>` : ''}
        </div>
      </div>
    `;
  },

  async onFileSelect(caseId, input) {
    const file = input.files[0];
    if (!file) return;
    input.value = ''; // リセット（同じファイルを再選択できるよう）

    const meta = await this.upload(caseId, file);
    if (!meta) return;

    // リスト更新
    const listEl = document.getElementById(`docsList_${caseId}`);
    if (listEl) {
      const empty = listEl.querySelector('.docs-empty');
      if (empty) empty.remove();
      const div = document.createElement('div');
      div.innerHTML = this.renderDocItem(caseId, meta);
      listEl.appendChild(div.firstElementChild);
    }
    // カウント更新
    const c = Store.getCase(caseId);
    const countEl = document.getElementById(`docsCount_${caseId}`);
    if (countEl) countEl.textContent = (c?.docs?.length || 0) + '件';
  },

  // ─── ユーティリティ ────────────────────────────────────────
  getIcon(mimeType = '') {
    if (mimeType.includes('pdf'))         return '📕';
    if (mimeType.includes('image'))       return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('csv') || mimeType.includes('text')) return '📃';
    return '📄';
  },

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024)           return bytes + 'B';
    if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  },

  // ─── 書類生成（お預かり証・送付状） ──────────────────────────
  generateDocument(caseId, type) {
    const c = Store.getCase(caseId);
    if (!c) return App.showToast('案件が保存されていません');
    
    let clientName = 'お客様';
    let clientAddress = '';
    const client = Store.getClient(c.clientId);
    if (client) {
      clientName = client.type === '法人' ? (client.companyName || client.name) : client.name;
      if (client.zip) clientAddress += `〒${client.zip}<br>`;
      if (client.address) clientAddress += client.address;
    }

    const officeInfo = (typeof Invoice !== 'undefined') ? Invoice.getOfficeInfo() : {};
    const officeName = officeInfo.name || '行政書士事務所';
    const officeDetail = [
      officeInfo.representative,
      officeInfo.zip ? '〒' + officeInfo.zip : '',
      officeInfo.address,
      officeInfo.tel ? 'TEL: ' + officeInfo.tel : '',
      officeInfo.email
    ].filter(Boolean).join('<br>');

    const docs = Array.isArray(c.docs) ? c.docs : [];
    if (docs.length === 0) {
      if (!confirm('添付書類が0件ですが、空の書類を作成しますか？')) return;
    }

    const today = new Date().toLocaleDateString('ja-JP');
    const docTitle = type === 'receipt' ? '預 り 証' : '送 付 状';
    
    let message = '';
    if (type === 'receipt') {
      message = '平素は格別のお引き立てを賜り、厚く御礼申し上げます。<br>以下の書類を確かにお預かりいたしました。';
    } else if (type === 'transmittal') {
      message = '平素は格別のお引き立てを賜り、厚く御礼申し上げます。<br>以下の書類をご送付いたしますので、ご査収のほどよろしくお願い申し上げます。';
    }

    if (type === 'poa') {
      return this.generatePOA(c, clientName, clientAddress, officeName, officeInfo);
    }
    if (type === 'estimate') {
      return this.generateEstimate(c, clientName, clientAddress, officeName, officeDetail, officeInfo);
    }
    if (type === 'agreement') {
      return this.generateAgreement(c, clientName, clientAddress, officeName, officeDetail, officeInfo);
    }
    if (type === 'antisocial') {
      return this.generateAntisocial(c, clientName, clientAddress, officeName, officeDetail, officeInfo);
    }

    let docListHtml = docs.map((d, i) => `
      <tr>
        <td style="width:40px; text-align:center">${i + 1}</td>
        <td>${d.name}</td>
        <td style="width:80px; text-align:center">1 通</td>
      </tr>
    `).join('');

    if (docs.length === 0) {
      docListHtml = `
      <tr>
        <td style="width:40px; text-align:center">1</td>
        <td style="color:#aaa">（書類名を入力）</td>
        <td style="width:80px; text-align:center">1 通</td>
      </tr>
      <tr><td style="width:40px; text-align:center">2</td><td></td><td></td></tr>
      <tr><td style="width:40px; text-align:center">3</td><td></td><td></td></tr>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${docTitle} - ${c.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Sans JP', sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 15mm; size: A4; } }
  .print-bar { display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end; }
  .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .client-box { font-size: 20px; font-weight: 700; border-bottom: 2px solid #1a1a2e; padding-bottom: 4px; margin-bottom: 8px; display: inline-block; }
  .client-box::after { content: " 様"; font-size: 16px; font-weight: 400; }
  .client-address { font-size: 12px; color: #555; line-height: 1.6; }
  .office-box { text-align: right; }
  .office-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .office-detail { font-size: 11px; color: #555; line-height: 1.8; }
  .title { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 12px; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; }
  .message { font-size: 13px; line-height: 1.8; margin-bottom: 30px; }
  .case-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; padding: 8px 12px; background: #f8f9fa; border-left: 4px solid #1a1a2e; }
  .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
  .doc-table th { background: #1a1a2e; color: #fff; padding: 10px; text-align: left; font-weight: 600; }
  .doc-table th.center { text-align: center; }
  .doc-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
  .signature-area { margin-top: 60px; display: flex; justify-content: flex-end; }
  .signature-box { width: 250px; border-top: 1px solid #1a1a2e; text-align: center; padding-top: 8px; font-size: 12px; color: #555; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>
  
  <div style="text-align:right; margin-bottom: 16px; font-size: 12px;">${today}</div>
  
  <div class="header">
    <div>
      <div class="client-box">${clientName}</div>
      <div class="client-address">${clientAddress}</div>
    </div>
    <div class="office-box">
      <div class="office-name">${officeName}</div>
      <div class="office-detail">${officeDetail}</div>
    </div>
  </div>

  <div class="title">${docTitle}</div>
  
  <div class="message">${message}</div>
  
  <div class="case-title">件名：${c.title}</div>
  
  <div style="text-align:center; font-weight:700; margin-bottom: 12px;">記</div>
  
  <table class="doc-table">
    <thead>
      <tr>
        <th class="center" style="width:40px">No.</th>
        <th>書類名</th>
        <th class="center" style="width:80px">部数</th>
      </tr>
    </thead>
    <tbody>
      ${docListHtml}
    </tbody>
  </table>
  
  <div style="text-align:center; font-weight:700; margin-top: 20px;">以上</div>
  
  ${type === 'receipt' ? `
  <div class="signature-area">
    <div class="signature-box">
      受領者ご署名
    </div>
  </div>` : ''}
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    // 案件フォルダURLがあればDriveへ自動バックアップ
    if (c.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      App.showToast(`🔄 Driveへ${docTitle}を自動保存中...`);
      SpreadsheetSync.push('saveGeneratedPdf', {
        html: html,
        fileName: docTitle + '.pdf',
        folderUrl: c.driveFolderUrl
      }).then(res => {
        if (res && res.success) App.showToast(`✅ ${docTitle}をDriveに保存しました`);
      });
    }
  },

  // ─── 委任状専用ジェネレーター ──────────────────────────
  generatePOA(c, clientName, clientAddress, officeName, officeInfo) {
    const isGarage = ['garage_oss', 'garage_paper'].includes(c.category);
    
    let delegatedMatters = '';
    let carDetails = '';
    
    if (isGarage) {
      delegatedMatters = `
        <div style="margin-left: 20px; line-height: 2;">
          自動車保管場所証明の申請および受領に関する一切の件<br>
          （保管場所標章の交付申請および受領に関する一切の件を含む）
        </div>
      `;
      carDetails = `
        <div style="margin-top: 30px;">
          <strong>２．自動車の表示</strong>
          <table style="width: 100%; margin-top: 10px; margin-left: 20px; border-spacing: 0; line-height: 2;">
            <tr><td style="width: 220px;">車名</td><td>： ${c.carName || ''}</td></tr>
            <tr><td>型式</td><td>： </td></tr>
            <tr><td>車台番号</td><td>： ${c.carNumber || ''}</td></tr>
            <tr><td>自動車の使用の本拠の位置</td><td>： ${c.carAddress || ''}</td></tr>
            <tr><td>自動車の保管場所の位置</td><td>： </td></tr>
          </table>
        </div>
      `;
    } else {
      delegatedMatters = `
        <div style="margin-left: 20px; line-height: 2; margin-top: 10px;">
          <div style="border-bottom: 1px solid #1a1a2e; width: 90%; height: 30px;"></div>
          <div style="border-bottom: 1px solid #1a1a2e; width: 90%; height: 30px;"></div>
          <div style="border-bottom: 1px solid #1a1a2e; width: 90%; height: 30px;"></div>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>委任状 - ${c.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Serif JP', serif; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 20mm; size: A4; } }
  .print-bar { display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end; font-family: sans-serif; }
  .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .title { text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 12px; margin-top: 20px; margin-bottom: 50px; }
  .lead { font-size: 16px; margin-bottom: 40px; }
  .section-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
  .signature-block { display: flex; justify-content: space-between; margin-top: 60px; font-size: 16px; }
  .signature-left { width: 50%; }
  .signature-right { width: 50%; }
  .sig-row { margin-bottom: 20px; display: flex; }
  .sig-label { width: 80px; }
  .sig-value { flex: 1; border-bottom: 1px dotted #ccc; position: relative; }
  .inkan { position: absolute; right: 10px; top: -5px; font-size: 24px; color: #ccc; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>
  
  <div class="title">委 任 状</div>
  
  <div class="lead">
    私は、下記の者を代理人と定め、次の権限を委任します。
  </div>
  
  <div>
    <strong class="section-title">１．委任事項</strong>
    ${delegatedMatters}
  </div>
  
  ${carDetails}
  
  <div style="margin-top: 60px; text-align: right; padding-right: 20px;">
    令和　　　年　　　月　　　日
  </div>
  
  <div class="signature-block">
    <div class="signature-left">
      <div style="font-weight: 700; margin-bottom: 16px;">（受任者）</div>
      <div style="margin-left: 20px; line-height: 2;">
        住所： ${officeInfo.address || ''}<br>
        氏名： 行政書士 ${officeInfo.representative || ''}<br>
        電話： ${officeInfo.tel || ''}
      </div>
    </div>
    <div class="signature-right">
      <div style="font-weight: 700; margin-bottom: 16px;">（委任者）</div>
      <div class="sig-row" style="margin-top: 20px;">
        <div class="sig-label">住所</div>
        <div class="sig-value">${clientAddress || ''}</div>
      </div>
      <div class="sig-row" style="margin-top: 30px;">
        <div class="sig-label">氏名</div>
        <div class="sig-value">${clientName !== 'お客様' ? clientName : ''}<span class="inkan">㊞</span></div>
      </div>
      <div class="sig-row" style="margin-top: 30px;">
        <div class="sig-label">電話番号</div>
        <div class="sig-value"></div>
      </div>
    </div>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    // 案件フォルダURLがあればDriveへ自動バックアップ
    if (c.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      App.showToast(`🔄 Driveへ委任状を自動保存中...`);
      SpreadsheetSync.push('saveGeneratedPdf', {
        html: html,
        fileName: '委任状.pdf',
        folderUrl: c.driveFolderUrl
      }).then(res => {
        if (res && res.success) App.showToast(`✅ 委任状をDriveに保存しました`);
      });
    }
  },

  // ─── 御見積書ジェネレーター ──────────────────────────
  generateEstimate(c, clientName, clientAddress, officeName, officeDetail, officeInfo) {
    const today = new Date().toLocaleDateString('ja-JP');
    const feeNum = parseInt(c.fee, 10) || 0;
    const taxNum = Math.round(feeNum * 0.1);
    const advances = Array.isArray(c.advances) ? c.advances : [];
    const advancesSum = advances.reduce((sum, a) => sum + (parseInt(a.amount, 10) || 0), 0);
    const grandTotal = feeNum + taxNum + advancesSum;

    let itemsHtml = `
      <tr>
        <td style="text-align:center">1</td>
        <td>行政書士業務報酬（${c.title}）</td>
        <td style="text-align:right">￥${feeNum.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="text-align:center">2</td>
        <td>消費税（10%）</td>
        <td style="text-align:right">￥${taxNum.toLocaleString()}</td>
      </tr>
    `;

    advances.forEach((a, i) => {
      itemsHtml += `
        <tr>
          <td style="text-align:center">${i + 3}</td>
          <td>立替金：${a.label || '実費'}</td>
          <td style="text-align:right">￥${(parseInt(a.amount, 10) || 0).toLocaleString()}</td>
        </tr>
      `;
    });

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>御見積書 - ${c.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Sans JP', sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 15mm; size: A4; } }
  .print-bar { display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end; }
  .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .client-box { font-size: 20px; font-weight: 700; border-bottom: 2px solid #1a1a2e; padding-bottom: 4px; margin-bottom: 8px; display: inline-block; }
  .client-box::after { content: " 御中"; font-size: 16px; font-weight: 400; }
  .client-address { font-size: 12px; color: #555; line-height: 1.6; }
  .office-box { text-align: right; }
  .office-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .office-detail { font-size: 11px; color: #555; line-height: 1.8; }
  .title { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 12px; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; }
  .total-box { background: #f3f4f6; border: 2px solid #1a1a2e; padding: 15px; margin-bottom: 30px; text-align: center; }
  .total-label { font-size: 14px; font-weight: 700; margin-bottom: 5px; }
  .total-amount { font-size: 26px; font-weight: 700; color: #1e3a8a; }
  .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
  .doc-table th { background: #1a1a2e; color: #fff; padding: 10px; text-align: left; font-weight: 600; }
  .doc-table th.center { text-align: center; }
  .doc-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
  .notes-area { font-size: 12px; color: #555; line-height: 1.8; background: #fafafa; padding: 15px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>
  
  <div style="text-align:right; margin-bottom: 16px; font-size: 12px;">${today}</div>
  
  <div class="header">
    <div>
      <div class="client-box">${clientName}</div>
      <div class="client-address">${clientAddress}</div>
    </div>
    <div class="office-box">
      <div class="office-name">${officeName}</div>
      <div class="office-detail">${officeDetail}</div>
    </div>
  </div>

  <div class="title">御見積書</div>
  
  <div style="margin-bottom: 20px; font-size: 14px;">
    件名： ${c.title} に伴う行政書士業務報酬及び実費
  </div>
  
  <div class="total-box">
    <div class="total-label">御見積額合計（税込）</div>
    <div class="total-amount">￥${grandTotal.toLocaleString()}-</div>
  </div>
  
  <table class="doc-table">
    <thead>
      <tr>
        <th class="center" style="width:50px">No.</th>
        <th>項目名</th>
        <th style="width:150px; text-align:right">金額</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  
  <div class="notes-area">
    <strong>【備考・お支払条件】</strong><br>
    ※ 官公署の法定手数料（登録免許税や印紙代）は、申請時に必要となるため、原則前払いにてお願い申し上げます。<br>
    ※ 本見積書の有効期限は、作成日より3ヶ月間とさせていただきます。<br>
    ※ ご不明な点がございましたら、担当行政書士までお気軽にお問い合わせください。
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    if (c.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      App.showToast(`🔄 Driveへ御見積書を自動保存中...`);
      SpreadsheetSync.push('saveGeneratedPdf', {
        html: html,
        fileName: '御見積書.pdf',
        folderUrl: c.driveFolderUrl
      }).then(res => {
        if (res && res.success) App.showToast(`✅ 御見積書をDriveに保存しました`);
      });
    }
  },

  // ─── 業務委託契約書ジェネレーター ──────────────────────────
  generateAgreement(c, clientName, clientAddress, officeName, officeDetail, officeInfo) {
    const feeNum = parseInt(c.fee, 10) || 0;
    const taxNum = Math.round(feeNum * 0.1);
    const totalFee = feeNum + taxNum;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>業務委託契約書 - ${c.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Serif JP', serif; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; font-size: 14px; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 20mm; size: A4; } }
  .print-bar { display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end; font-family: sans-serif; }
  .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .title { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 4px; margin-top: 20px; margin-bottom: 40px; }
  .contract-clause { margin-bottom: 20px; text-indent: 1em; }
  .clause-title { font-weight: 700; margin-top: 25px; margin-bottom: 10px; text-indent: 0; }
  .signature-block { display: flex; justify-content: space-between; margin-top: 60px; }
  .signature-left, .signature-right { width: 48%; }
  .sig-row { margin-bottom: 15px; display: flex; }
  .sig-label { width: 60px; }
  .sig-value { flex: 1; border-bottom: 1px dotted #555; position: relative; min-height: 25px; }
  .inkan { position: absolute; right: 10px; top: -5px; font-size: 20px; color: #ccc; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>
  
  <div class="title">業務委託契約書</div>
  
  <div style="margin-bottom: 30px;">
    委託者 ${clientName}（以下「甲」という）と、受託者 行政書士 ${officeInfo.representative || '○○ ○○'}（以下「乙」という）は、甲の乙に対する行政書士業務の委託に関し、次のとおり業務委託契約（以下「本契約」という）を締結する。
  </div>

  <div class="clause-title">第１条（委託業務）</div>
  <div class="contract-clause">
    甲は、次の業務（以下「本業務」という）を乙に委託し、乙はこれを受託する。<br>
    <strong>本業務の内容： ${c.title} 申請手続 of 代理及び書類の作成</strong>
  </div>

  <div class="clause-title">第２条（報酬及び支払方法）</div>
  <div class="contract-clause">
    本業務に伴う乙の報酬額は、金 ${feeNum.toLocaleString()} 円（消費税等別、税込合計額 金 ${totalFee.toLocaleString()} 円）とする。
  </div>
  <div class="contract-clause">
    ２．甲は乙に対し、本契約締結後速やかに着手金として上記金額を乙が指定する口座へ振込により支払うものとする。なお、振込手数料は甲の負担とする。
  </div>

  <div class="clause-title">第３条（必要書類の提供）</div>
  <div class="contract-clause">
    甲は、乙の請求に基づき、本業務の遂行に必要な書類及び情報を、遅滞なく乙に提供しなければならない。
  </div>

  <div class="clause-title">第４条（秘密保持）</div>
  <div class="contract-clause">
    乙は、本業務の遂行上知り得た甲の秘密情報（個人情報及び事業上の秘密を含む）を、正当な理由なく第三者に漏洩してはならない。本契約終了後も同様とする。
  </div>

  <div class="clause-title">第５条（反社会的勢力の排除）</div>
  <div class="contract-clause">
    甲及び乙は、自ら又は自らの役員若しくは従業員が、反社会的勢力（暴力団、暴力団員、その他これらに準ずる者）に該当しないこと、及び資金提供等を通じて反社会的勢力の維持・運営に関与していないことを表明し、将来にわたっても確約する。
  </div>
  <div class="contract-clause">
    ２．甲又は乙は、相手方が前項の表明確約に違反した場合、催告することなく直ちに本契約を解除することができる。
  </div>

  <div class="clause-title">第６条（合意管轄）</div>
  <div class="contract-clause">
    本契約に関し裁判上の紛争が生じたときは、乙の事務所所在地を管轄する地方裁判所又は簡易裁判所を第一審の専属的合意管轄裁判所とする。
  </div>

  <div style="margin-top: 50px; text-align: right; padding-right: 20px;">
    本契約締結の証として、本書２通を作成し、甲乙双方が署名又は記名押印の上、各自１通を保有する。<br><br>
    令和　　　年　　　月　　　日
  </div>
  
  <div class="signature-block">
    <div class="signature-left">
      <div style="font-weight: 700; margin-bottom: 16px;">（甲）委託者</div>
      <div class="sig-row">
        <div class="sig-label">住所</div>
        <div class="sig-value">${clientAddress || ''}</div>
      </div>
      <div class="sig-row" style="margin-top:20px;">
        <div class="sig-label">氏名</div>
        <div class="sig-value">${clientName !== 'お客様' ? clientName : ''}<span class="inkan">㊞</span></div>
      </div>
    </div>
    <div class="signature-right">
      <div style="font-weight: 700; margin-bottom: 16px;">（乙）受託者</div>
      <div class="sig-row">
        <div class="sig-label">住所</div>
        <div class="sig-value">${officeInfo.address || ''}</div>
      </div>
      <div class="sig-row" style="margin-top:20px;">
        <div class="sig-label">氏名</div>
        <div class="sig-value">行政書士 ${officeInfo.representative || ''}<span class="inkan">㊞</span></div>
      </div>
    </div>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    if (c.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      App.showToast(`🔄 Driveへ業務委託契約書を自動保存中...`);
      SpreadsheetSync.push('saveGeneratedPdf', {
        html: html,
        fileName: '業務委託契約書.pdf',
        folderUrl: c.driveFolderUrl
      }).then(res => {
        if (res && res.success) App.showToast(`✅ 業務委託契約書をDriveに保存しました`);
      });
    }
  },

  // ─── 表明確約書（反社排除）ジェネレーター ──────────────────
  generateAntisocial(c, clientName, clientAddress, officeName, officeDetail, officeInfo) {
    const today = new Date().toLocaleDateString('ja-JP');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>表明確約書 - ${c.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Serif JP', serif; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 2; font-size: 14px; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 20mm; size: A4; } }
  .print-bar { display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end; font-family: sans-serif; }
  .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .title { text-align: center; font-size: 22px; font-weight: 700; letter-spacing: 4px; margin-top: 20px; margin-bottom: 40px; }
  .clause-item { margin-bottom: 15px; padding-left: 20px; text-indent: -20px; }
  .signature-block { margin-top: 60px; display: flex; justify-content: flex-end; }
  .signature-box { width: 350px; }
  .sig-row { margin-bottom: 15px; display: flex; }
  .sig-label { width: 80px; }
  .sig-value { flex: 1; border-bottom: 1px dotted #555; position: relative; min-height: 25px; }
  .inkan { position: absolute; right: 10px; top: -5px; font-size: 20px; color: #ccc; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>
  
  <div class="title">反社会的勢力の排除に関する表明確約書</div>
  
  <div style="margin-bottom: 30px; text-align: left;">
    行政書士 ${officeInfo.representative || '○○ ○○'} 御中
  </div>

  <div style="margin-bottom: 30px; text-indent: 1em;">
    私は、行政書士との間における業務委託契約その他一切の取引（以下「本取引」という）に際し、現在及び将来にわたって、次の各号の事項を表明し、確約いたします。
  </div>

  <div class="clause-item">
    １．自ら又は自らの法人の役員、主要な株主若しくはこれらに準ずる者が、現在、暴力団、暴力団員、暴力団員でなくなった時から５年を経過しない者、暴力団準構成員、暴力団関係企業、総会屋、社会運動標ぼうゴロ、特殊知能暴力集団その他これらに準ずる者（以下、これらを総称して「暴力団員等」という）に該当しないこと。
  </div>

  <div class="clause-item">
    ２．暴力団員等が、自らの経営又は事業の実質的な運営に関与していないこと。
  </div>

  <div class="clause-item">
    ３．自己若しくは第三者の不正の利益を図る目的、又は第三者に損害を加える目的をもって、暴力団員等を利用していると認められる関係を有していないこと。
  </div>

  <div class="clause-item">
    ４．暴力団員等に対して資金等を提供し、又は便宜を供与するなどの関与をしていないこと。
  </div>

  <div class="clause-item">
    ５．自ら又は第三者を利用して、暴力的若しくは法的な責任を超えた不当な要求行為、脅迫的な言動若しくは暴力を用いる行為、又は風説を流布し、偽計若しくは威力を用いて貴事務所の信用を毀損し、業務を妨害する行為を行わないこと。
  </div>

  <div style="margin-top: 30px; text-indent: 1em;">
    私は、上記の表明確約に違反する事実が判明した場合には、貴事務所が何らの催告を要せず直ちに本取引を解除されても異議を申し立てず、また、これにより被った損害についての賠償請求を行わないことを確約いたします。
  </div>

  <div style="margin-top: 50px; text-align: right; padding-right: 20px;">
    令和　　　年　　　月　　　日
  </div>
  
  <div class="signature-block">
    <div class="signature-box">
      <div class="sig-row">
        <div class="sig-label">住所</div>
        <div class="sig-value">${clientAddress || ''}</div>
      </div>
      <div class="sig-row" style="margin-top:20px;">
        <div class="sig-label">氏名・商号</div>
        <div class="sig-value">${clientName !== 'お客様' ? clientName : ''}<span class="inkan">㊞</span></div>
      </div>
      <div class="sig-row" style="margin-top:20px;">
        <div class="sig-label">代表者氏名</div>
        <div class="sig-value"><span class="inkan">㊞</span></div>
      </div>
    </div>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    if (c.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      App.showToast(`🔄 Driveへ表明確約書を自動保存中...`);
      SpreadsheetSync.push('saveGeneratedPdf', {
        html: html,
        fileName: '表明確約書.pdf',
        folderUrl: c.driveFolderUrl
      }).then(res => {
        if (res && res.success) App.showToast(`✅ 表明確約書をDriveに保存しました`);
      });
    }
  },
};


/**
 * 案件アーカイブ管理
 * - 完了から60日以上経過した案件を localStorage のサブキーに移動
 * - Sheets 側には全件残るので 2年間保管義務はクリア
 * - ダッシュボードを軽量に保つ
 */
const CaseArchive = {
  ARCHIVE_KEY: 'gyosei_archived_cases',
  THRESHOLD_DAYS: 60,

  // 起動時に実行: 古い完了案件をアーカイブ
  run() {
    const cases = Store.getCases();
    const threshold = Date.now() - this.THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const active  = [];
    const toArchive = [];
    cases.forEach(c => {
      const isDone = c.status === 'done';
      const isOld  = c.completedAt && new Date(c.completedAt).getTime() < threshold;
      if (isDone && isOld) toArchive.push(c);
      else active.push(c);
    });

    if (toArchive.length === 0) return;

    const existing  = JSON.parse(localStorage.getItem(this.ARCHIVE_KEY) || '[]');
    const existIds  = new Set(existing.map(c => c.id));
    const merged    = [...existing, ...toArchive.filter(c => !existIds.has(c.id))];
    localStorage.setItem(this.ARCHIVE_KEY, JSON.stringify(merged));
    Store._set(Store.KEYS.CASES, active);
    console.log(`📦 CaseArchive: ${toArchive.length}件をアーカイブ (アクティブ: ${active.length}件)`);
  },

  // アーカイブ済み案件を取得
  getArchived() {
    return JSON.parse(localStorage.getItem(this.ARCHIVE_KEY) || '[]');
  },

  // 使用容量チェック
  getStorageInfo() {
    const casesJson = localStorage.getItem(Store.KEYS.CASES) || '[]';
    const archiveJson = localStorage.getItem(this.ARCHIVE_KEY) || '[]';
    const totalJson = JSON.stringify(localStorage).length;
    return {
      activeCases:   JSON.parse(casesJson).length,
      archivedCases: JSON.parse(archiveJson).length,
      estimatedKB:   Math.round(totalJson / 1024),
      warningLevel:  totalJson > 3 * 1024 * 1024 ? 'warn' : 'ok', // 3MB超で警告
    };
  },
};
