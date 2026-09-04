/**
 * 請求書発行モジュール
 * 自動車ディーラー3社（愛知トヨタWEST、三菱ふそう、日産愛知）の実務専用様式および標準様式に対応
 */
const Invoice = {
  // 事務所情報（設定で変更可能・デフォルトは行政書士法人フェリス）
  getDefaultOfficeInfo() {
    return {
      name: '行政書士法人フェリス',
      assocName: '愛知県行政書士会会員',
      representative: '代表行政書士 日栄 政敏',
      zip: '481-0033',
      address: '愛知県北名古屋市六ツ師道毛74番地1',
      tel: '0586-50-2896',
      fax: '0568-26-3714',
      email: '',
      bankName: '三菱UFJ銀行',
      bankBranch: '西春支店',
      accountType: '普通',
      accountNumber: '0129129',
      accountHolder: '行政書士法人フェリス',
      registrationNumber: '',
    };
  },

  getOfficeInfo() {
    const defaults = this.getDefaultOfficeInfo();
    const saved = localStorage.getItem('gyosei_office_info');
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  },

  saveOfficeInfo(info) {
    localStorage.setItem('gyosei_office_info', JSON.stringify(info));
  },

  // 顧客名から最適な請求書様式を自動判定
  detectTemplate(client) {
    if (!client) return 'standard';
    const name = (client.companyName || client.name || '') + ' ' + (client.tradeName || '');
    if (name.includes('トヨタ') || name.includes('TOYOTA') || name.includes('WEST') || name.includes('キャラット')) {
      return 'toyota';
    }
    if (name.includes('三菱') || name.includes('ふそう') || name.includes('FUSO')) {
      return 'mitsubishi';
    }
    if (name.includes('日産') || name.includes('NISSAN')) {
      return 'nissan';
    }
    return 'standard';
  },

  // 請求書番号を生成
  generateInvoiceNumber(clientId, year, month) {
    const m = String(month).padStart(2, '0');
    const seq = String(this.getNextSeq()).padStart(3, '0');
    return `INV-${year}${m}-${seq}`;
  },

  getNextSeq() {
    const current = parseInt(localStorage.getItem('gyosei_invoice_seq') || '0');
    const next = current + 1;
    localStorage.setItem('gyosei_invoice_seq', String(next));
    return next;
  },

  // 未請求の案件を取得（デフォルトは完了案件のみ、includeAll=trueで全ステータス）
  getUnbilledCases(clientId, includeAll = false) {
    const cases = Store.getCasesByClient(clientId);
    return cases.filter(c => {
      if (!includeAll && c.status !== 'done') return false;
      if (c.invoiceNo) return false;
      const hasAdvances = Array.isArray(c.advances) && c.advances.length > 0;
      if (!c.fee && !hasAdvances) return false;
      return true;
    });
  },

  toggleIncludeAll(clientId, docType, checked) {
    this.showSelectModal(clientId, docType, checked);
  },

  // 再印刷用に特定の請求書番号に紐づく案件を取得
  getBilledCases(clientId, invoiceNo) {
    const cases = Store.getCasesByClient(clientId);
    return cases.filter(c => c.invoiceNo === invoiceNo);
  },

  // 請求書・見積書選択モーダルを表示
  showSelectModal(clientId, docType = 'invoice', includeAll = false) {
    const client = Store.getClient(clientId);
    if (!client) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const defaultIssueDate = Store.getLocalDateStr(now);
    const endOfMonth = Store.getLocalDateStr(new Date(currentYear, currentMonth, 0));
    const detectedTpl = this.detectTemplate(client);

    // 未請求案件のリスト生成
    const unbilledCases = this.getUnbilledCases(clientId, includeAll);
    let unbilledHtml = '';
    if (unbilledCases.length === 0) {
      unbilledHtml = `<div style="color:var(--text-muted);font-size:0.9rem;padding:8px 0;">${includeAll ? '請求可能な案件がありません。' : '未請求の完了案件はありません。（下の「進行中・受付済みも表示」にチェックを入れると未完了案件も請求可能になります）'}</div>`;
    } else {
      unbilledHtml = unbilledCases.map(c => {
        const effectiveFee = c.isPaid ? 0 : Number(c.fee||0);
        const effectiveAdv = c.isAdvancePaid ? 0 : (c.advances||[]).reduce((s,a) => s+Number(a.amount||0), 0);
        let partialBadge = '';
        if (c.status !== 'done') {
          partialBadge = `<span style="background:#fef3c7;color:#b45309;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;margin-left:4px;">${c.status === 'in_progress' ? '進行中' : '受付済'}</span>`;
        }
        if (c.isAdvancePaid && !c.isPaid) partialBadge += '<span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;margin-left:4px;">立替済</span>';
        if (c.isPaid && !c.isAdvancePaid) partialBadge += '<span style="background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;margin-left:4px;">報酬済</span>';
        const amountStr = `報酬 ¥${effectiveFee.toLocaleString()} ${effectiveAdv>0 ? '+ 立替 ¥'+effectiveAdv.toLocaleString() : ''}`;
        return `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:0.9rem;cursor:pointer;">
            <input type="checkbox" name="targetCases" value="${c.id}" checked class="case-checkbox" onchange="Invoice.updatePreview('${clientId}')">
            <span>${c.title}${partialBadge} <small style="color:var(--text-muted)">(${amountStr})</small></span>
          </label>
        `;
      }).join('');
    }

    // 過去の請求書リスト（再印刷用）を取得
    let pastInvoicesHtml = '<option value="">選択してください</option>';
    let hasPastInvoices = false;
    if (typeof Payments !== 'undefined') {
      const payments = Payments.getByClient(clientId);
      const invoices = payments.filter(p => p.invoiceNo).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      if (invoices.length > 0) {
        hasPastInvoices = true;
        pastInvoicesHtml += invoices.map(p => {
          return `<option value="${p.invoiceNo}">${p.invoiceNo} (¥${Number(p.amount||0).toLocaleString()})</option>`;
        }).join('');
      }
    }

    const existing = document.getElementById('invoiceSelectModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'invoiceSelectModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('invoiceSelectModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>📄 ${docType === 'estimate' ? '御見積書発行' : '請求書発行'}</h2>
          <button class="modal-close" onclick="document.getElementById('invoiceSelectModal').remove()">✕</button>
        </div>
        <div style="padding:0">
          
          <!-- タブ切り替えUI -->
          <div style="display:flex; gap:16px; margin-bottom:16px; border-bottom:1px solid var(--border); ${docType === 'estimate' ? 'display:none !important' : ''}">
            <button type="button" id="tabNew" style="padding:8px 16px; background:none; border:none; border-bottom:2px solid var(--primary); color:var(--primary); font-weight:bold; cursor:pointer;" onclick="Invoice.switchTab('new')">新規発行</button>
            <button type="button" id="tabReprint" style="padding:8px 16px; background:none; border:none; border-bottom:2px solid transparent; color:var(--text-muted); cursor:pointer;" onclick="Invoice.switchTab('reprint')">再印刷</button>
          </div>

          <!-- 新規発行エリア -->
          <div id="areaNew">
            <div class="form-row" style="margin-bottom:12px;">
              <div class="form-group" style="flex:1;">
                <label>📋 請求書様式（テンプレート）</label>
                <select id="invoiceTemplateType" class="form-select" style="font-weight:600;">
                  <option value="toyota" ${detectedTpl === 'toyota' ? 'selected' : ''}>愛知トヨタWEST様式（表紙サマリー＋明細票）</option>
                  <option value="mitsubishi" ${detectedTpl === 'mitsubishi' ? 'selected' : ''}>三菱ふそう様式（業務別集計＋諸費用）</option>
                  <option value="nissan" ${detectedTpl === 'nissan' ? 'selected' : ''}>日産愛知販売様式（別紙明細報酬＋税目別立替）</option>
                  <option value="standard" ${detectedTpl === 'standard' ? 'selected' : ''}>標準様式（一般・他士業向け）</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="background:var(--bg-secondary); padding:12px; border-radius:var(--radius-sm); margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <label style="margin:0;">📝 ${docType === 'estimate' ? '見積対象の案件を選択' : '請求対象の案件を選択'}</label>
                <label style="font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
                  <input type="checkbox" ${includeAll ? 'checked' : ''} onchange="Invoice.toggleIncludeAll('${clientId}', '${docType}', this.checked)">
                  進行中・受付済みも表示
                </label>
              </div>
              <div style="margin-top:8px; max-height:160px; overflow-y:auto;">
                ${unbilledHtml}
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>発行日</label>
                <input type="date" id="invoiceDate" value="${defaultIssueDate}">
              </div>
              <div class="form-group" style="${docType === 'estimate' ? 'display:none' : ''}">
                <label>支払期限</label>
                <input type="date" id="invoiceDueDate" value="${endOfMonth}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>消費税率 (%)</label>
                <input type="number" id="invoiceTaxRate" value="10" min="0" max="100" step="1">
              </div>
            </div>
            <div class="form-group">
              <label>備考</label>
              <textarea id="invoiceNote" rows="2" placeholder="備考があれば入力..."></textarea>
            </div>
            <div id="invoicePreviewInfoNew" style="margin:12px 0;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.85rem"></div>
            
            <div class="form-actions">
              <button class="btn btn-secondary" onclick="Invoice.showOfficeSettings()">🏢 事務所情報</button>
              <button class="btn btn-primary" id="generateInvoiceBtn" onclick="Invoice.generateNew('${clientId}', '${docType}')" ${unbilledCases.length === 0 ? 'disabled' : ''}>📄 印刷プレビュー・発行</button>
            </div>
          </div>

          <!-- 再印刷エリア -->
          <div id="areaReprint" style="display:none;">
            <div class="form-row" style="margin-bottom:12px;">
              <div class="form-group" style="flex:1;">
                <label>📋 請求書様式（テンプレート）</label>
                <select id="reprintTemplateType" class="form-select" style="font-weight:600;">
                  <option value="toyota" ${detectedTpl === 'toyota' ? 'selected' : ''}>愛知トヨタWEST様式（表紙サマリー＋明細票）</option>
                  <option value="mitsubishi" ${detectedTpl === 'mitsubishi' ? 'selected' : ''}>三菱ふそう様式（業務別集計＋諸費用）</option>
                  <option value="nissan" ${detectedTpl === 'nissan' ? 'selected' : ''}>日産愛知販売様式（別紙明細報酬＋税目別立替）</option>
                  <option value="standard" ${detectedTpl === 'standard' ? 'selected' : ''}>標準様式（一般向け）</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>過去の請求書を選択</label>
              <select id="reprintInvoiceNo" class="form-select" onchange="Invoice.updateReprintPreview('${clientId}')" ${!hasPastInvoices ? 'disabled' : ''}>
                ${hasPastInvoices ? pastInvoicesHtml : '<option value="">過去の請求書はありません</option>'}
              </select>
            </div>
            <div class="form-actions" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <button type="button" class="btn btn-danger" id="cancelInvoiceBtn" onclick="Invoice.cancelInvoice('${clientId}')" disabled style="background:#dc2626; color:#fff; font-weight:bold;">🗑️ この請求書を取り消す（未請求に戻す）</button>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary" onclick="Invoice.showOfficeSettings()">🏢 事務所情報</button>
                <button type="button" class="btn btn-primary" id="reprintInvoiceBtn" onclick="Invoice.generateReprint('${clientId}')" disabled>📄 再印刷する</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.updatePreview(clientId);
  },

  switchTab(tab) {
    const tabNew = document.getElementById('tabNew');
    const tabReprint = document.getElementById('tabReprint');
    const areaNew = document.getElementById('areaNew');
    const areaReprint = document.getElementById('areaReprint');
    
    if (tab === 'new') {
      tabNew.style.borderBottomColor = 'var(--primary)';
      tabNew.style.color = 'var(--primary)';
      tabNew.style.fontWeight = 'bold';
      tabReprint.style.borderBottomColor = 'transparent';
      tabReprint.style.color = 'var(--text-muted)';
      tabReprint.style.fontWeight = 'normal';
      areaNew.style.display = 'block';
      areaReprint.style.display = 'none';
    } else {
      tabReprint.style.borderBottomColor = 'var(--primary)';
      tabReprint.style.color = 'var(--primary)';
      tabReprint.style.fontWeight = 'bold';
      tabNew.style.borderBottomColor = 'transparent';
      tabNew.style.color = 'var(--text-muted)';
      tabNew.style.fontWeight = 'normal';
      areaReprint.style.display = 'block';
      areaNew.style.display = 'none';
    }
  },

  updatePreview(clientId) {
    const info = document.getElementById('invoicePreviewInfoNew');
    const btn = document.getElementById('generateInvoiceBtn');
    if (!info) return;

    const checkboxes = document.querySelectorAll('.case-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
      info.innerHTML = '<span style="color:var(--text-muted)">案件が選択されていません</span>';
      if (btn) btn.disabled = true;
      return;
    }
    if (btn) btn.disabled = false;

    const allCases = Store.getCasesByClient(clientId);
    const cases = allCases.filter(c => selectedIds.includes(c.id));
    
    const feeTotal = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    const advTotal = cases.reduce((sum, c) => sum + (c.advances||[]).reduce((s,a)=>s+Number(a.amount||0),0), 0);
    
    let html = `<strong>選択中案件 (${cases.length}件)</strong><br>`;
    html += cases.map(c => {
      const advs = (c.advances||[]).filter(a=>a.label||Number(a.amount)>0);
      const advSum = advs.reduce((s,a)=>s+Number(a.amount||0),0);
      return `・${c.title}：報酬 ¥${Number(c.fee||0).toLocaleString()}${advSum>0?` + 立替 ¥${advSum.toLocaleString()}`:''}`;
    }).join('<br>');
    html += `<br><strong style="color:var(--accent-green)">報酬小計：¥${feeTotal.toLocaleString()} ／ 立替金合計：¥${advTotal.toLocaleString()}</strong>`;
    info.innerHTML = html;
  },

  updateReprintPreview(clientId) {
    const info = document.getElementById('invoicePreviewInfoReprint');
    const btn = document.getElementById('reprintInvoiceBtn');
    const cancelBtn = document.getElementById('cancelInvoiceBtn');
    const invoiceNo = document.getElementById('reprintInvoiceNo') ? document.getElementById('reprintInvoiceNo').value : '';
    
    if (!invoiceNo) {
      if (info) info.innerHTML = '';
      if (btn) btn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      return;
    }
    if (btn) btn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;

    const cases = this.getBilledCases(clientId, invoiceNo);
    if(cases.length === 0) {
      if (info) info.innerHTML = '<span style="color:#eab308">この請求書に紐づく案件データが見つかりません。当時の請求書のみが印刷されます。</span>';
      return;
    }

    const feeTotal = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    const advTotal = cases.reduce((sum, c) => sum + (c.advances||[]).reduce((s,a)=>s+Number(a.amount||0),0), 0);
    
    let html = `<strong>対象案件 (${cases.length}件)</strong><br>`;
    html += cases.map(c => {
      const advs = (c.advances||[]).filter(a=>a.label||Number(a.amount)>0);
      const advSum = advs.reduce((s,a)=>s+Number(a.amount||0),0);
      return `・${c.title}：報酬 ¥${Number(c.fee||0).toLocaleString()}${advSum>0?` + 立替 ¥${advSum.toLocaleString()}`:''}`;
    }).join('<br>');
    html += `<br><strong>報酬小計：¥${feeTotal.toLocaleString()} ／ 立替金合計：¥${advTotal.toLocaleString()}</strong>`;
    if (info) info.innerHTML = html;
  },

  // 請求書を取り消して対象案件を未請求に戻す
  cancelInvoice(clientId) {
    const invoiceNo = document.getElementById('reprintInvoiceNo') ? document.getElementById('reprintInvoiceNo').value : '';
    if (!invoiceNo) return;

    if (!confirm(`⚠️ 請求書「${invoiceNo}」を取り消して、含まれる案件を「未請求」状態に戻しますか？\n（入金・売掛金データも連動して削除されます）`)) {
      return;
    }

    const cases = this.getBilledCases(clientId, invoiceNo);
    cases.forEach(c => {
      Store.updateCase(c.id, { invoiceNo: '' });
    });

    if (typeof Payments !== 'undefined') {
      Payments.deleteByInvoiceNo(invoiceNo);
    }

    const modal = document.getElementById('invoiceSelectModal');
    if (modal) modal.remove();

    App.refreshView();
    App.showToast(`✅ 請求書 ${invoiceNo} を取り消し、対象案件(${cases.length}件)を未請求に戻しました`);
  },

  // 新規に請求書・見積書を発行する
  generateNew(clientId, docType = 'invoice') {
    const checkboxes = document.querySelectorAll('.case-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
      App.showToast('対象の案件が選択されていません');
      return;
    }

    const allCases = Store.getCasesByClient(clientId);
    const cases = allCases.filter(c => selectedIds.includes(c.id));

    const client = Store.getClient(clientId);
    const office = this.getOfficeInfo();
    const issueDate = document.getElementById('invoiceDate').value;
    const dueDate = docType === 'estimate' ? '' : document.getElementById('invoiceDueDate').value;
    const taxRate = parseInt(document.getElementById('invoiceTaxRate').value) || 10;
    const note = document.getElementById('invoiceNote').value;
    const templateType = document.getElementById('invoiceTemplateType') ? document.getElementById('invoiceTemplateType').value : 'standard';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let invoiceNo = this.generateInvoiceNumber(clientId, year, month);
    if (docType === 'estimate') {
      invoiceNo = invoiceNo.replace('INV-', 'EST-');
    }

    // 消し込み済みの項目は請求書から自動除外
    const feeSubtotal = cases.reduce((sum, c) => sum + (c.isPaid ? 0 : Number(c.fee || 0)), 0);
    const tax = Math.floor(feeSubtotal * taxRate / 100);
    const advanceTotal = cases.reduce((sum, c) =>
      sum + (c.isAdvancePaid ? 0 : (c.advances||[]).reduce((s,a) => s+Number(a.amount||0), 0)), 0);
    const total = feeSubtotal + tax + advanceTotal;

    const CATS = { 
      garage_oss: '車庫証明(OSS)', 
      garage_paper: '車庫証明(一般)', 
      seal: '出張封印', 
      car_reg_standard: '普通車登録', 
      car_reg_light: '軽自動車登録',
      inheritance: '相続・遺言',
      permit: '許認可'
    };

    const contactNames = [...new Set(
      cases
        .filter(c => c.clientContactId)
        .map(c => {
          const ct = Store.getClientContact(c.clientContactId);
          return ct ? ct.name : null;
        })
        .filter(Boolean)
    )];

    const html = this.buildInvoiceHTML({
      invoiceNo, issueDate, dueDate, year, month,
      client, office, cases, CATS,
      feeSubtotal, tax, taxRate, advanceTotal, total, note,
      docType, contactNames, templateType
    });

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      }
    } catch (err) {
      console.error('印刷画面オープン失敗:', err);
      alert('印刷画面を開けませんでした: ' + err.message);
    }

    const modal = document.getElementById('invoiceSelectModal');
    if (modal) modal.remove();
    
    if (docType === 'invoice') {
      cases.forEach(c => {
        Store.updateCase(c.id, { invoiceNo: invoiceNo });
      });

      if (typeof Payments !== 'undefined') {
        Payments.createFromInvoice(invoiceNo, clientId, total, dueDate, taxRate);
      }
      App.showToast(`請求書 ${invoiceNo} を発行しました`);
    } else {
      App.showToast(`見積書 ${invoiceNo} を作成しました`);
    }
  },

  // 再印刷
  generateReprint(clientId) {
    const invoiceNo = document.getElementById('reprintInvoiceNo').value;
    if (!invoiceNo) return;

    const cases = this.getBilledCases(clientId, invoiceNo);
    if (cases.length === 0) {
      App.showToast('対象の案件が見つかりません');
      return;
    }

    const client = Store.getClient(clientId);
    const office = this.getOfficeInfo();
    const templateType = document.getElementById('reprintTemplateType') ? document.getElementById('reprintTemplateType').value : 'standard';
    
    let dueDate = '';
    let taxRate = 10;
    let issueDate = Store.getLocalDateStr();
    if (typeof Payments !== 'undefined') {
      const p = Payments.getByClient(clientId).find(x => x.invoiceNo === invoiceNo);
      if (p) {
        if (p.dueDate) dueDate = p.dueDate;
        if (p.taxRate !== undefined) taxRate = p.taxRate;
      }
    }

    const match = invoiceNo.match(/INV-(\d{4})(\d{2})-/);
    const year = match ? parseInt(match[1]) : new Date().getFullYear();
    const month = match ? parseInt(match[2]) : new Date().getMonth() + 1;

    // 消し込み済みの項目は請求書から自動除外（再印刷時も同様）
    const feeSubtotal = cases.reduce((sum, c) => sum + (c.isPaid ? 0 : Number(c.fee || 0)), 0);
    const tax = Math.floor(feeSubtotal * taxRate / 100);
    const advanceTotal = cases.reduce((sum, c) =>
      sum + (c.isAdvancePaid ? 0 : (c.advances||[]).reduce((s,a) => s+Number(a.amount||0), 0)), 0);
    const total = feeSubtotal + tax + advanceTotal;

    const CATS = { 
      garage_oss: '車庫証明(OSS)', 
      garage_paper: '車庫証明(一般)', 
      seal: '出張封印', 
      car_reg_standard: '普通車登録', 
      car_reg_light: '軽自動車登録',
      inheritance: '相続・遺言',
      permit: '許認可'
    };

    const contactNames = [...new Set(
      cases
        .filter(c => c.clientContactId)
        .map(c => {
          const ct = Store.getClientContact(c.clientContactId);
          return ct ? ct.name : null;
        })
        .filter(Boolean)
    )];

    const html = this.buildInvoiceHTML({
      invoiceNo, issueDate, dueDate, year, month,
      client, office, cases, CATS,
      feeSubtotal, tax, taxRate, advanceTotal, total, note: '（再印刷）',
      contactNames, templateType
    });

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      }
    } catch (err) {
      console.error('再印刷画面オープン失敗:', err);
      alert('再印刷画面を開けませんでした: ' + err.message);
    }

    const modal = document.getElementById('invoiceSelectModal');
    if (modal) modal.remove();
    App.showToast(`請求書 ${invoiceNo} を再印刷しました`);
  },

  // 請求書HTMLビルダー（様式に応じた分岐）
  buildInvoiceHTML(params) {
    const templateType = params.templateType || 'standard';
    if (templateType === 'toyota') {
      return this.buildToyotaInvoiceHTML(params);
    } else if (templateType === 'mitsubishi') {
      return this.buildMitsubishiInvoiceHTML(params);
    } else if (templateType === 'nissan') {
      return this.buildNissanInvoiceHTML(params);
    }
    return this.buildStandardInvoiceHTML(params);
  },

  // =========================================================================
  // 1. 愛知トヨタWEST様式（表紙サマリー＋明細票）
  // =========================================================================
  buildToyotaInvoiceHTML({ invoiceNo, issueDate, dueDate, year, month, client, office, cases, feeSubtotal, tax, taxRate, advanceTotal, total, note, docType = 'invoice' }) {
    // 案件を集計（車庫証明、封印、移転登録、その他）
    let garageCount = 0, garageFee = 0;
    let sealCount = 0, sealFee = 0;
    let otherCount = 0, otherFee = 0;

    cases.forEach(c => {
      const cat = c.category || '';
      const title = c.title || '';
      if (cat.includes('garage') || title.includes('車庫')) {
        garageCount++;
        garageFee += Number(c.fee || 0);
      } else if (cat.includes('seal') || title.includes('封印')) {
        sealCount++;
        sealFee += Number(c.fee || 0);
      } else {
        otherCount++;
        otherFee += Number(c.fee || 0);
      }
    });

    // 立替金明細を分類（区分付きで集計）
    const advMap = {};
    cases.forEach(c => {
      (c.advances || []).forEach(a => {
        const cat = a.category || (a.label && a.label.includes('証紙') ? '証紙代' : (a.label && a.label.includes('印紙') ? '印紙代' : (a.label && (a.label.includes('送') || a.label.includes('レターパック')) ? '送料' : (a.label && (a.label.includes('プレート') || a.label.includes('ナンバー')) ? 'プレート代' : 'その他実費'))));
        const lbl = a.label ? (a.label.startsWith('【') ? a.label : `【${cat}】${a.label}`) : `【${cat}】`;
        const amt = Number(a.amount || 0);
        if (!advMap[lbl]) advMap[lbl] = { count: 0, amount: 0 };
        advMap[lbl].count++;
        advMap[lbl].amount += amt;
      });
    });

    const clientName = client.type === '法人' ? (client.companyName || client.name) : client.name;
    const [issueY, issueM, issueD] = issueDate.split('-');
    const reiwaYear = issueY ? parseInt(issueY) - 2018 : 8;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${clientName} 様</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Shippori Mincho', 'Noto Sans JP', 'Hiragino Mincho ProN', serif;
    color: #000;
    background: #e2e8f0;
    padding: 20px;
    -webkit-print-color-adjust: exact;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    .page-break { page-break-after: always; }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto 20px;
    padding: 20mm 20mm 15mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    position: relative;
  }
  .no-print-bar {
    max-width: 210mm;
    margin: 0 auto 15px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .btn {
    padding: 8px 20px;
    font-size: 14px;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    border: none;
  }
  .btn-print { background: #2563eb; color: #fff; }
  .btn-close { background: #cbd5e1; color: #1e293b; }

  .doc-title {
    text-align: center;
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 12px;
    margin-bottom: 25px;
    padding-bottom: 8px;
  }
  .recipient-box {
    margin-bottom: 25px;
    font-size: 18px;
    font-weight: bold;
  }
  .recipient-box .name {
    display: inline-block;
    border-bottom: 1.5px solid #000;
    padding-bottom: 3px;
  }

  table.grid-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 13px;
  }
  table.grid-table th, table.grid-table td {
    border: 1px solid #000;
    padding: 6px 10px;
  }
  table.grid-table th {
    background: #f8fafc;
    text-align: center;
    font-weight: bold;
  }
  .col-num { text-align: right; font-family: 'Noto Sans JP', sans-serif; }
  .col-center { text-align: center; }

  .section-label {
    writing-mode: vertical-rl;
    text-orientation: upright;
    letter-spacing: 4px;
    font-weight: bold;
    background: #f1f5f9;
  }

  .grand-total-row th, .grand-total-row td {
    font-size: 16px;
    font-weight: bold;
    background: #f8fafc;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }

  .sender-container {
    margin-top: 25px;
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .bank-info {
    width: 48%;
  }
  .bank-info h4 {
    font-size: 13px;
    margin-bottom: 4px;
  }
  .office-info {
    width: 48%;
    text-align: right;
  }
  .office-info .seal-box {
    display: inline-block;
    width: 55px;
    height: 55px;
    border: 1.5px solid #c00;
    color: #c00;
    font-size: 10px;
    border-radius: 4px;
    text-align: center;
    line-height: 52px;
    margin-top: 5px;
    font-family: sans-serif;
  }
</style>
</head>
<body>

<div class="no-print-bar no-print">
  <button class="btn btn-print" onclick="window.print()">🖨️ 印刷 / PDF出力</button>
  <button class="btn btn-close" onclick="window.close()">✕ 閉じる</button>
</div>

<!-- 1ページ目：請求書 表紙 -->
<div class="page page-break">
  <div class="doc-title">${docType === 'estimate' ? '御 見 積 書' : '請 求 書'}</div>
  
  <div class="recipient-box">
    <span class="name">${clientName} 御中</span>
  </div>

  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 15%;">区分</th>
        <th style="width: 45%;">件名</th>
        <th style="width: 15%;">数量</th>
        <th style="width: 25%;">金額（円）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="section-label col-center">報酬</td>
        <td>
          <div style="font-weight:bold;">車庫証明申請他</div>
          <div style="font-size:11px; color:#475569; margin-top:2px;">(内、車庫証明申請 ${garageCount}件)</div>
        </td>
        <td class="col-center">${cases.length}件</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
      </tr>
      <tr style="background:#fdfdfd;">
        <td colspan="2" class="col-center" style="font-weight:bold;">計</td>
        <td class="col-center">${cases.length}件</td>
        <td class="col-num" style="font-weight:bold;">${feeSubtotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="3" class="col-center">消費税 (${taxRate || 10}%)</td>
        <td class="col-num">${tax.toLocaleString()}</td>
      </tr>
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="3" class="col-center">合　　計</td>
        <td class="col-num">${(feeSubtotal + tax).toLocaleString()}</td>
      </tr>

      <!-- 立替金パート -->
      ${Object.keys(advMap).length > 0 ? Object.entries(advMap).map(([lbl, data], idx) => `
      <tr>
        ${idx === 0 ? `<td rowspan="${Object.keys(advMap).length}" class="section-label col-center">立替金</td>` : ''}
        <td>${lbl}</td>
        <td class="col-center">${data.count}件</td>
        <td class="col-num">${data.amount.toLocaleString()}</td>
      </tr>
      `).join('') : `
      <tr>
        <td class="section-label col-center">立替金</td>
        <td>立替金なし</td>
        <td class="col-center">0件</td>
        <td class="col-num">0</td>
      </tr>`}
      <tr style="background:#fdfdfd; font-weight:bold;">
        <td colspan="3" class="col-center">立替金計</td>
        <td class="col-num">${advanceTotal.toLocaleString()}</td>
      </tr>

      <!-- 総合計 -->
      <tr class="grand-total-row">
        <td colspan="3" class="col-center">総　合　計</td>
        <td class="col-num" style="font-size:18px;">¥${total.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:13px; margin-bottom: 15px;">上記のとおりご請求申し上げます。</div>
  <div style="font-size:13px; margin-bottom: 25px;">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>

  <div class="sender-container">
    <div class="bank-info">
      <h4>《 振込先 》</h4>
      <div>${office.bankName || '三菱UFJ銀行'}　${office.bankBranch || '西春支店'}</div>
      <div>${office.accountType || '普通'}　${office.accountNumber || '0129129'}</div>
      <div>口座名義：${office.accountHolder || '行政書士法人フェリス'}</div>
      <div style="font-size:11px; color:#555; margin-top:4px;">※振込手数料は貴社にてご負担願います。</div>
    </div>
    <div class="office-info">
      <div>${office.assocName || '愛知県行政書士会会員'}</div>
      <div>所在地：${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:14px; margin:2px 0;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div>TEL: ${office.tel || '0586-50-2896'}</div>
      <div>FAX: ${office.fax || '0568-26-3714'}</div>
      ${office.registrationNumber ? `<div style="font-size:11px;">登録番号: ${office.registrationNumber}</div>` : ''}
    </div>
  </div>
</div>

<!-- 2ページ目：車庫証明申請等明細書 -->
<div class="page">
  <div class="doc-title" style="font-size:22px; letter-spacing:6px; margin-bottom:15px;">車庫証明申請等明細書</div>
  
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; font-size:13px;">
    <div>
      <div style="font-size:16px; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:3px; display:inline-block;">
        ${clientName}　御中
      </div>
    </div>
    <div style="text-align:right; font-size:12px; line-height:1.6;">
      <div>〒${office.zip || '481-0033'}</div>
      <div>${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:13px;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div style="margin-top:6px; font-weight:bold;">令和 ${reiwaYear} 年 ${issueM} 月分　　NO. 1</div>
    </div>
  </div>

  <table class="grid-table" style="font-size:12px;">
    <thead>
      <tr>
        <th rowspan="2" style="width:7%;">日付</th>
        <th colspan="4" style="width:65%;">申　請　者</th>
        <th rowspan="2" style="width:14%;">報酬額</th>
        <th rowspan="2" style="width:14%;">立替金</th>
      </tr>
      <tr>
        <th style="width:16%;">注文No.</th>
        <th style="width:21%;">氏　名</th>
        <th style="width:14%;">管　轄</th>
        <th style="width:14%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      ${cases.map((c) => {
        const rawDate = c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || c.createdAt || c.registeredAt || '';
        let dateStr = '-';
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          } else {
            const parts = String(rawDate).split(/[-/T]/);
            if (parts.length >= 3) dateStr = `${parseInt(parts[1])}/${parseInt(parts[2])}`;
            else dateStr = String(rawDate).slice(5);
          }
        }
        const orderNo = c.orderNo || c.caseNo || '-';
        const applicant = c.carName || c.applicantName || c.title || '-';
        
        let policeName = (c.carPolice || '').replace(/警察署?/, '').trim();
        if (!policeName && c.policeLocationId && typeof Store !== 'undefined') {
          const loc = Store.getLocation(c.policeLocationId);
          if (loc) policeName = (loc.name || '').replace(/警察署?/, '').trim();
        }
        if (!policeName) policeName = (c.policeStation || c.authority || '').replace(/警察署?/, '').trim();

        let categoryShort = '';
        if (c.category === 'garage_oss') {
          categoryShort = 'OSS';
        } else if (c.category === 'garage_paper' || (c.category && c.category.includes('garage'))) {
          categoryShort = '一般';
        } else if (c.subCategory) {
          categoryShort = c.subCategory;
        } else if (c.category === 'car_reg_standard') {
          categoryShort = '新規登録';
        } else if (c.category === 'car_reg_light') {
          categoryShort = '軽登録';
        } else if (c.category === 'seal') {
          categoryShort = '封印';
        }

        const fee = Number(c.fee || 0);
        const advSum = (c.advances || []).reduce((s,a)=>s+Number(a.amount||0), 0);
        const advDetails = (c.advances || []).filter(a => Number(a.amount) > 0).map(a => {
          const cat = a.category || (a.label && a.label.includes('証紙') ? '証紙' : (a.label && a.label.includes('印紙') ? '印紙' : (a.label && (a.label.includes('送') || a.label.includes('レターパック')) ? '送料' : (a.label && (a.label.includes('プレート') || a.label.includes('ナンバー')) ? 'プレート' : '実費'))));
          return `${cat}:${Number(a.amount).toLocaleString()}`;
        }).join(' ');

        return `
        <tr>
          <td class="col-center">${dateStr}</td>
          <td class="col-center" style="font-family:'Noto Sans JP', sans-serif;">${orderNo}</td>
          <td><strong>${applicant}</strong></td>
          <td class="col-center">${policeName}</td>
          <td class="col-center">${categoryShort}</td>
          <td class="col-num">${fee > 0 ? fee.toLocaleString() : '-'}</td>
          <td class="col-num">${advSum > 0 ? `${advSum.toLocaleString()}${advDetails ? `<div style="font-size:9px; color:#64748b; font-weight:normal; line-height:1.2;">(${advDetails})</div>` : ''}` : ''}</td>
        </tr>`;
      }).join('')}
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" class="col-center">合　　計</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
        <td class="col-num">${advanceTotal.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:11px; text-align:right; color:#666; margin-top:20px;">
    ${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo}
  </div>
</div>

</body>
</html>`;
  },

  // =========================================================================
  // 2. 三菱ふそう様式（業務別集計＋実費・諸費用 ＆ 2ページ目明細書）
  // =========================================================================
  buildMitsubishiInvoiceHTML({ invoiceNo = '', issueDate = '', client = {}, office = {}, cases = [], feeSubtotal = 0, tax = 0, total = 0, advanceTotal = 0, docType = 'invoice' }) {
    const clientName = client.type === '法人' ? (client.companyName || client.name || 'お客様') : (client.name || 'お客様');
    const [issueY, issueM, issueD] = (issueDate || Store.getLocalDateStr()).split('-');
    const reiwaYear = issueY ? parseInt(issueY) - 2018 : 8;

    // 業務分類
    let garageCases = [], docCases = [], regCases = [];
    cases.forEach(c => {
      const t = (c.title || '') + (c.category || '') + (c.subCategory || '');
      if (t.includes('車庫')) garageCases.push(c);
      else if (t.includes('書類') || t.includes('作成')) docCases.push(c);
      else regCases.push(c);
    });

    const garageFee = garageCases.reduce((s,c)=>s+Number(c.fee||0),0);
    // 立替金明細の区分別集計
    let fusoSyoshiAmt = 0, fusoSyoshiCount = 0;
    let fusoPostAmt = 0, fusoPostCount = 0;
    let fusoOtherAmt = 0, fusoOtherCount = 0;

    cases.forEach(c => {
      (c.advances || []).forEach(a => {
        const amt = Number(a.amount || 0);
        const cat = a.category || '';
        const lbl = a.label || '';
        if (cat === '証紙代' || lbl.includes('証紙')) {
          fusoSyoshiAmt += amt;
          fusoSyoshiCount++;
        } else if (cat === '送料' || lbl.includes('送') || lbl.includes('郵送') || lbl.includes('レターパック')) {
          fusoPostAmt += amt;
          fusoPostCount++;
        } else {
          fusoOtherAmt += amt;
          fusoOtherCount++;
        }
      });
    });

    const otherFee = docCases.reduce((s,c)=>s+Number(c.fee||0),0) + regCases.reduce((s,c)=>s+Number(c.fee||0),0);

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${clientName} 様</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Shippori Mincho', 'Noto Sans JP', serif;
    color: #000;
    background: #e2e8f0;
    padding: 20px;
    -webkit-print-color-adjust: exact;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    .page-break { page-break-after: always; }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto 20px;
    padding: 20mm 20mm 15mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    position: relative;
  }
  .no-print-bar { max-width: 210mm; margin: 0 auto 15px; display: flex; justify-content: flex-end; gap: 10px; }
  .btn { padding: 8px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; font-size: 14px; }
  .btn-print { background: #dc2626; color: #fff; }
  .btn-close { background: #cbd5e1; color: #1e293b; }

  .doc-title { text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 10px; margin-bottom: 25px; }
  table.fuso-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  table.fuso-table th, table.fuso-table td { border: 1px solid #000; padding: 7px 10px; }
  table.fuso-table th { background: #f8fafc; text-align: center; font-weight: bold; }
  .col-num { text-align: right; font-family: 'Noto Sans JP', sans-serif; }
  .col-center { text-align: center; }

  .sender-container {
    margin-top: 25px;
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .bank-info { width: 50%; }
  .bank-info h4 { font-size: 13px; margin-bottom: 4px; font-weight: bold; }
  .office-info { width: 48%; text-align: right; }
</style>
</head>
<body>

<div class="no-print-bar no-print">
  <button class="btn btn-print" onclick="window.print()">🖨️ 印刷 / PDF出力</button>
  <button class="btn btn-close" onclick="window.close()">✕ 閉じる</button>
</div>

<!-- 1ページ目：三菱ふそう請求書サマリー -->
<div class="page page-break">
  <div class="doc-title">${docType === 'estimate' ? '御 見 積 書' : '請 求 書'}</div>
  
  <div style="font-size:18px; font-weight:bold; margin-bottom:20px;">
    <span style="border-bottom:1.5px solid #000; padding-bottom:3px;">${clientName} 御中</span>
  </div>

  <table class="fuso-table">
    <thead>
      <tr>
        <th style="width:15%;">区分</th>
        <th style="width:45%;">件名</th>
        <th style="width:15%;">数量</th>
        <th style="width:25%;">報酬額（円）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2" class="col-center" style="font-weight:bold; vertical-align:middle;">書類<br>作成<br>業務</td>
        <td>車庫証明申請</td>
        <td class="col-center">${garageCases.length}件</td>
        <td class="col-num">${garageFee.toLocaleString()}</td>
      </tr>
      <tr>
        <td>登録業務・その他</td>
        <td class="col-center">${(docCases.length + regCases.length)}件</td>
        <td class="col-num">${otherFee.toLocaleString()}</td>
      </tr>
      <tr style="font-weight:bold; background:#fafafa;">
        <td colspan="2" class="col-center">計</td>
        <td class="col-center">${cases.length}件</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="3" class="col-center">消費税 (10%)</td>
        <td class="col-num">${tax.toLocaleString()}</td>
      </tr>
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="3" class="col-center">合　計</td>
        <td class="col-num">${(feeSubtotal + tax).toLocaleString()}</td>
      </tr>

      <!-- 実費・立替 -->
      <tr>
        <td rowspan="3" class="col-center" style="font-weight:bold; vertical-align:middle;">立替金<br>その他</td>
        <td>証紙代（愛知・岐阜・警察手数料）</td>
        <td class="col-center">${fusoSyoshiCount > 0 ? fusoSyoshiCount + '件' : '-'}</td>
        <td class="col-num">${fusoSyoshiAmt.toLocaleString()}</td>
      </tr>
      <tr>
        <td>送料・郵送依頼分</td>
        <td class="col-center">${fusoPostCount > 0 ? fusoPostCount + '件' : '-'}</td>
        <td class="col-num">${fusoPostAmt.toLocaleString()}</td>
      </tr>
      <tr>
        <td>印紙代・プレート代・その他実費</td>
        <td class="col-center">${fusoOtherCount > 0 ? fusoOtherCount + '件' : '-'}</td>
        <td class="col-num">${fusoOtherAmt.toLocaleString()}</td>
      </tr>
      <tr style="font-size:16px; font-weight:bold; background:#f8fafc; border-top:2px solid #000;">
        <td colspan="3" class="col-center">総　合　計</td>
        <td class="col-num">¥${total.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:13px; margin: 20px 0 10px;">上記のとおりご請求申し上げます。</div>
  <div style="font-size:13px; margin-bottom: 25px;">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>

  <div class="sender-container">
    <div class="bank-info">
      <h4>《 振込先 》</h4>
      <div>${office.bankName || '三菱UFJ銀行'}　${office.bankBranch || '西春支店'}</div>
      <div>${office.accountType || '普通'}　${office.accountNumber || '0129129'}</div>
      <div>口座名義：${office.accountHolder || '行政書士法人フェリス'}</div>
      <div style="font-size:11px; color:#555; margin-top:4px;">※振込手数料は貴社にてご負担願います。</div>
    </div>
    <div class="office-info">
      <div>${office.assocName || '愛知県行政書士会会員'}</div>
      <div>所在地：${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:14px; margin:2px 0;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div>TEL: ${office.tel || '0586-50-2896'} / FAX: ${office.fax || '0568-26-3714'}</div>
      ${office.registrationNumber ? `<div style="font-size:11px;">登録番号: ${office.registrationNumber}</div>` : ''}
    </div>
  </div>
</div>

<!-- 2ページ目：三菱ふそう 申請等明細書 -->
<div class="page">
  <div class="doc-title" style="font-size:22px; letter-spacing:6px; margin-bottom:15px;">車庫証明・登録申請等明細書</div>
  
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; font-size:13px;">
    <div>
      <div style="font-size:16px; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:3px; display:inline-block;">
        ${clientName}　御中
      </div>
    </div>
    <div style="text-align:right; font-size:12px; line-height:1.6;">
      <div>〒${office.zip || '481-0033'}</div>
      <div>${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:13px;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div style="margin-top:6px; font-weight:bold;">令和 ${reiwaYear} 年 ${issueM || ''} 月分　　NO. 1</div>
    </div>
  </div>

  <table class="fuso-table" style="font-size:12px;">
    <thead>
      <tr>
        <th rowspan="2" style="width:7%;">日付</th>
        <th colspan="4" style="width:65%;">申　請　者</th>
        <th rowspan="2" style="width:14%;">報酬額</th>
        <th rowspan="2" style="width:14%;">立替金</th>
      </tr>
      <tr>
        <th style="width:16%;">注文No.</th>
        <th style="width:21%;">氏　名</th>
        <th style="width:14%;">管　轄</th>
        <th style="width:14%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      ${cases.map((c) => {
        const rawDate = c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || c.createdAt || c.registeredAt || '';
        let dateStr = '-';
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          } else {
            const parts = String(rawDate).split(/[-/T]/);
            if (parts.length >= 3) dateStr = `${parseInt(parts[1])}/${parseInt(parts[2])}`;
            else dateStr = String(rawDate).slice(5);
          }
        }
        const orderNo = c.orderNo || c.caseNo || '-';
        const applicant = c.carName || c.applicantName || c.title || '-';
        
        let policeName = (c.carPolice || '').replace(/警察署?/, '').trim();
        if (!policeName && c.policeLocationId && typeof Store !== 'undefined') {
          const loc = Store.getLocation(c.policeLocationId);
          if (loc) policeName = (loc.name || '').replace(/警察署?/, '').trim();
        }
        if (!policeName) policeName = (c.policeStation || c.authority || '').replace(/警察署?/, '').trim();

        let categoryShort = '';
        if (c.category === 'garage_oss') {
          categoryShort = 'OSS';
        } else if (c.category === 'garage_paper' || (c.category && c.category.includes('garage'))) {
          categoryShort = '一般';
        } else if (c.subCategory) {
          categoryShort = c.subCategory;
        } else if (c.category === 'car_reg_standard') {
          categoryShort = '新規登録';
        } else if (c.category === 'car_reg_light') {
          categoryShort = '軽登録';
        } else if (c.category === 'seal') {
          categoryShort = '封印';
        }

        const fee = Number(c.fee || 0);
        const advSum = (c.advances || []).reduce((s,a)=>s+Number(a.amount||0), 0);

        return `
        <tr>
          <td class="col-center">${dateStr}</td>
          <td class="col-center" style="font-family:'Noto Sans JP', sans-serif;">${orderNo}</td>
          <td><strong>${applicant}</strong></td>
          <td class="col-center">${policeName}</td>
          <td class="col-center">${categoryShort}</td>
          <td class="col-num">${fee > 0 ? fee.toLocaleString() : '-'}</td>
          <td class="col-num">${advSum > 0 ? advSum.toLocaleString() : ''}</td>
        </tr>`;
      }).join('')}
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" class="col-center">合　　計</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
        <td class="col-num">${advanceTotal.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:11px; text-align:right; color:#666; margin-top:20px;">
    ${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo}
  </div>
</div>

</body>
</html>`;
  },

  // =========================================================================
  // 3. 日産愛知販売様式（別紙明細報酬＋税目別立替集計）
  // =========================================================================
  buildNissanInvoiceHTML({ invoiceNo, issueDate, client, office, cases, feeSubtotal, tax, total, advanceTotal, docType = 'invoice' }) {
    const clientName = client.type === '法人' ? (client.companyName || client.name) : client.name;
    const [issueY, issueM, issueD] = issueDate.split('-');
    const reiwaYear = issueY ? parseInt(issueY) - 2018 : 8;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${clientName} 様</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Shippori Mincho', 'Noto Sans JP', serif;
    color: #000;
    background: #e2e8f0;
    padding: 20px;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 15mm; }
    .page-break { page-break-after: always; }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto 20px;
    padding: 20mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }
  .no-print-bar { max-width: 210mm; margin: 0 auto 15px; display: flex; justify-content: flex-end; gap: 10px; }
  .btn { padding: 8px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; }
  .btn-print { background: #ea580c; color: #fff; }
  .btn-close { background: #cbd5e1; color: #1e293b; }

  .doc-title { text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 10px; margin-bottom: 25px; }
  table.nissan-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; }
  table.nissan-table th, table.nissan-table td { border: 1px solid #000; padding: 10px 14px; }
  table.nissan-table th { background: #f8fafc; text-align: center; }
  .col-num { text-align: right; font-family: 'Noto Sans JP', sans-serif; font-weight: bold; }
</style>
</head>
<body>

<div class="no-print-bar no-print">
  <button class="btn btn-print" onclick="window.print()">🖨️ 印刷 / PDF出力</button>
  <button class="btn btn-close" onclick="window.close()">✕ 閉じる</button>
</div>

<!-- 1ページ目：表紙請求書 -->
<div class="page page-break">
  <div class="doc-title">${docType === 'estimate' ? '御 見 積 書' : '請 求 書'}</div>
  
  <div style="font-size:18px; font-weight:bold; margin-bottom:25px;">
    <span style="border-bottom:1.5px solid #000; padding-bottom:3px;">${clientName} 御中</span>
  </div>

  <div style="background:#f8fafc; border:2px solid #000; padding:15px 20px; margin-bottom:25px; font-size:18px; font-weight:bold; display:flex; justify-content:space-between;">
    <span>ご請求金額</span>
    <span>¥${total.toLocaleString()}</span>
  </div>

  <table class="nissan-table">
    <thead>
      <tr>
        <th style="width:50%;">摘　要</th>
        <th style="width:30%;">金　額</th>
        <th style="width:20%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>別紙明細報酬</td>
        <td class="col-num">¥${(feeSubtotal + tax).toLocaleString()}</td>
        <td style="text-align:center;">（税込）</td>
      </tr>
      <tr>
        <td>立替金</td>
        <td class="col-num">¥${advanceTotal.toLocaleString()}</td>
        <td style="text-align:center;">（実費）</td>
      </tr>
      <tr style="background:#f8fafc; font-size:16px;">
        <td style="font-weight:bold; text-align:center;">合　　計</td>
        <td class="col-num">¥${total.toLocaleString()}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:13px; margin: 20px 0;">上記のとおりご請求申し上げます。</div>
  <div style="font-size:13px; margin-bottom: 30px;">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>

  <div style="display:flex; justify-content:space-between; font-size:13px;">
    <div style="width:48%;">
      <div style="font-weight:bold; margin-bottom:4px;">《 振込先 》</div>
      <div>${office.bankName} ${office.bankBranch}</div>
      <div>${office.accountType} ${office.accountNumber}</div>
      <div>口座名義：${office.accountHolder}</div>
    </div>
    <div style="width:48%; text-align:right;">
      <div>${office.assocName || '愛知県行政書士会会員'}</div>
      <div>所在地：${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:14px;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div>TEL: ${office.tel || '0586-50-2896'} / FAX: ${office.fax || '0568-26-3714'}</div>
      ${office.registrationNumber ? `<div style="font-size:11px;">登録番号: ${office.registrationNumber}</div>` : ''}
    </div>
  </div>
</div>

<!-- 2ページ目：別紙納品・請求明細書 -->
<div class="page">
  <div class="doc-title" style="font-size:20px; letter-spacing:4px; margin-bottom:15px;">別 紙 納 品 ・ 請 求 明 細 書</div>
  <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:13px;">
    <div><strong>${clientName} 御中</strong></div>
    <div>令和 ${reiwaYear} 年 ${issueM} 月分</div>
  </div>

  <table class="nissan-table" style="font-size:12px;">
    <thead>
      <tr>
        <th rowspan="2" style="width:7%;">日付</th>
        <th colspan="4" style="width:65%;">申　請　者</th>
        <th rowspan="2" style="width:14%;">報酬料（税込）</th>
        <th rowspan="2" style="width:14%;">立替金</th>
      </tr>
      <tr>
        <th style="width:16%;">注文No.</th>
        <th style="width:21%;">氏　名</th>
        <th style="width:14%;">管　轄</th>
        <th style="width:14%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      ${cases.map((c) => {
        const rawDate = c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || c.createdAt || c.registeredAt || '';
        let dateStr = '-';
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          } else {
            const parts = String(rawDate).split(/[-/T]/);
            if (parts.length >= 3) dateStr = `${parseInt(parts[1])}/${parseInt(parts[2])}`;
            else dateStr = String(rawDate).slice(5);
          }
        }
        const orderNo = c.orderNo || c.caseNo || '-';
        const applicant = c.carName || c.applicantName || c.title || '-';
        
        let policeName = (c.carPolice || '').replace(/警察署?/, '').trim();
        if (!policeName && c.policeLocationId && typeof Store !== 'undefined') {
          const loc = Store.getLocation(c.policeLocationId);
          if (loc) policeName = (loc.name || '').replace(/警察署?/, '').trim();
        }
        if (!policeName) policeName = (c.policeStation || c.authority || '').replace(/警察署?/, '').trim();

        let categoryShort = '';
        if (c.category === 'garage_oss') {
          categoryShort = 'OSS';
        } else if (c.category === 'garage_paper' || (c.category && c.category.includes('garage'))) {
          categoryShort = '一般';
        } else if (c.subCategory) {
          categoryShort = c.subCategory;
        } else if (c.category === 'car_reg_standard') {
          categoryShort = '新規登録';
        } else if (c.category === 'car_reg_light') {
          categoryShort = '軽登録';
        } else if (c.category === 'seal') {
          categoryShort = '封印';
        }

        const feeTaxIncluded = Math.floor(Number(c.fee || 0) * 1.1);
        const advSum = (c.advances || []).reduce((s,a)=>s+Number(a.amount||0), 0);
        const advDetails = (c.advances || []).filter(a => Number(a.amount) > 0).map(a => {
          const cat = a.category || (a.label && a.label.includes('証紙') ? '証紙' : (a.label && a.label.includes('印紙') ? '印紙' : (a.label && (a.label.includes('送') || a.label.includes('レターパック')) ? '送料' : (a.label && (a.label.includes('プレート') || a.label.includes('ナンバー')) ? 'プレート' : '実費'))));
          return `${cat}:${Number(a.amount).toLocaleString()}`;
        }).join(' ');

        return `
        <tr>
          <td style="text-align:center;">${dateStr}</td>
          <td style="text-align:center;">${orderNo}</td>
          <td><strong>${applicant}</strong></td>
          <td style="text-align:center;">${policeName}</td>
          <td style="text-align:center;">${categoryShort}</td>
          <td class="col-num">${feeTaxIncluded > 0 ? '¥' + feeTaxIncluded.toLocaleString() : '-'}</td>
          <td class="col-num">${advSum > 0 ? `¥${advSum.toLocaleString()}${advDetails ? `<div style="font-size:9px; color:#64748b; font-weight:normal; line-height:1.2;">(${advDetails})</div>` : ''}` : ''}</td>
        </tr>`;
      }).join('')}
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" style="text-align:center;">合　　計</td>
        <td class="col-num">¥${(feeSubtotal + tax).toLocaleString()}</td>
        <td class="col-num">¥${advanceTotal.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>
</div>

</body>
</html>`;
  },

  // =========================================================================
  // 4. 標準様式（一般向け汎用テンプレート）
  // =========================================================================
  buildStandardInvoiceHTML({ invoiceNo, issueDate, dueDate, year, month, client, office, cases, CATS, feeSubtotal, tax, taxRate, advanceTotal, total, note, docType = 'invoice', contactNames = [] }) {
    const allAdvances = cases.flatMap(c =>
      (c.advances||[]).filter(a => a.label || Number(a.amount) > 0).map(a => {
        const cat = a.category || (a.label && a.label.includes('証紙') ? '証紙代' : (a.label && a.label.includes('印紙') ? '印紙代' : (a.label && (a.label.includes('送') || a.label.includes('レターパック')) ? '送料' : (a.label && (a.label.includes('プレート') || a.label.includes('ナンバー')) ? 'プレート代' : '実費・その他'))));
        return {
          category: cat,
          label: a.label || cat,
          amount: Number(a.amount||0),
          caseTitle: c.title
        };
      })
    );
    const clientName = client.type === '法人' ? (client.companyName || client.name) : client.name;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${docType === 'estimate' ? '御見積書' : '請求書'} ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Noto Sans JP', sans-serif;
    color: #1e293b;
    background: #f8fafc;
    padding: 30px;
    max-width: 850px;
    margin: 0 auto;
  }
  @media print {
    body { padding: 0; background: #fff; }
    .no-print { display: none !important; }
    @page { margin: 15mm; size: A4 portrait; }
  }

  .print-bar { display: flex; gap: 10px; margin-bottom: 25px; justify-content: flex-end; }
  .btn-print { padding: 8px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
  .btn-close { padding: 8px 20px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; cursor: pointer; }

  .invoice-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
  .invoice-title { font-size: 24px; font-weight: 700; letter-spacing: 8px; }
  .invoice-no { font-size: 12px; color: #64748b; margin-top: 4px; }

  .two-col { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 20px; font-size: 13px; }
  .client-side { width: 55%; }
  .client-name { font-size: 18px; font-weight: 700; border-bottom: 2px solid #0f172a; padding-bottom: 4px; display: inline-block; margin-bottom: 6px; }
  .office-side { width: 45%; text-align: right; line-height: 1.6; font-size: 12px; }
  .office-name { font-size: 15px; font-weight: 700; color: #0f172a; }

  .total-box { background: #f1f5f9; border: 1.5px solid #0f172a; border-radius: 8px; padding: 12px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .total-amount { font-size: 24px; font-weight: 700; color: #0f172a; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12.5px; }
  th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; }
  th.num, td.num { text-align: right; font-feature-settings: "tnum"; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }

  .summary-table { width: 300px; margin-left: auto; margin-bottom: 20px; }
  .summary-table td { padding: 6px 10px; }
  .summary-table .total-row td { font-weight: 700; font-size: 14px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }

  .bank-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>

  <div class="invoice-header">
    <div class="invoice-title">${docType === 'receipt' ? '領 収 書' : docType === 'estimate' ? '御 見 積 書' : '請 求 書'}</div>
    <div class="invoice-no">No. ${invoiceNo} | 発行日: ${issueDate}</div>
  </div>

  <div class="two-col">
    <div class="client-side">
      <div class="client-name">${clientName} 御中</div>
      ${contactNames && contactNames.length > 0 ? `<div style="color:#64748b;">ご担当：${contactNames.join(' 様、')} 様</div>` : ''}
      ${dueDate && docType !== 'estimate' ? `<div style="color:#e11d48; margin-top:4px; font-weight:bold;">お支払期日：${dueDate}</div>` : ''}
    </div>
    <div class="office-side">
      <div class="office-name">${office.name}</div>
      <div>${office.assocName || ''}</div>
      <div>〒${office.zip} ${office.address}</div>
      <div>TEL: ${office.tel} / FAX: ${office.fax}</div>
      ${office.registrationNumber ? `<div>登録番号: ${office.registrationNumber}</div>` : ''}
      <div>${office.representative}</div>
    </div>
  </div>

  <div class="total-box">
    <span style="font-weight:bold;">${docType === 'estimate' ? '御見積合計金額（税込）' : '御請求合計金額（税込）'}</span>
    <span class="total-amount">¥${total.toLocaleString()}</span>
  </div>

  <table style="margin-bottom:15px;">
    <thead>
      <tr>
        <th style="width:8%;">No.</th>
        <th>業務内容・案件名</th>
        <th style="width:25%;">区分</th>
        <th class="num" style="width:20%;">報酬額</th>
      </tr>
    </thead>
    <tbody>
      ${cases.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.title}</strong></td>
        <td>${CATS[c.category] || c.category || '業務'}</td>
        <td class="num">¥${Number(c.fee||0).toLocaleString()}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  ${allAdvances.length > 0 ? `
  <table style="margin-bottom:15px;">
    <thead>
      <tr>
        <th style="width:8%;">No.</th>
        <th style="width:18%;">区分</th>
        <th>立替金・実費項目</th>
        <th>対象案件</th>
        <th class="num" style="width:20%;">立替金額</th>
      </tr>
    </thead>
    <tbody>
      ${allAdvances.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><span style="display:inline-block; padding:2px 8px; background:#e2e8f0; border-radius:4px; font-size:11px; font-weight:bold; color:#0f172a;">${a.category}</span></td>
        <td>${a.label}</td>
        <td style="color:#64748b;">${a.caseTitle}</td>
        <td class="num">¥${a.amount.toLocaleString()}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <table class="summary-table">
    <tr><td>報酬小計</td><td class="num">¥${feeSubtotal.toLocaleString()}</td></tr>
    <tr><td>消費税 (${taxRate}%)</td><td class="num">¥${tax.toLocaleString()}</td></tr>
    ${advanceTotal > 0 ? `<tr><td>立替実費合計</td><td class="num">¥${advanceTotal.toLocaleString()}</td></tr>` : ''}
    <tr class="total-row"><td>合計請求額</td><td class="num">¥${total.toLocaleString()}</td></tr>
  </table>

  ${office.bankName ? `
  <div class="bank-section">
    <div style="font-weight:bold; margin-bottom:4px;">🏦 お振込先</div>
    <div>${office.bankName} ${office.bankBranch} ${office.accountType} ${office.accountNumber}</div>
    <div>口座名義：${office.accountHolder}</div>
  </div>` : ''}

  ${note ? `<div style="font-size:12px; color:#475569; border-top:1px solid #e2e8f0; padding-top:8px;"><strong>備考：</strong> ${note}</div>` : ''}
</body>
</html>`;
  },

  // 事務所情報設定モーダル
  showOfficeSettings() {
    const info = this.getOfficeInfo();
    const existing = document.getElementById('officeSettingsModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'officeSettingsModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('officeSettingsModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>🏢 事務所情報設定</h2>
          <button class="modal-close" onclick="document.getElementById('officeSettingsModal').remove()">✕</button>
        </div>
        <form id="officeForm" onsubmit="Invoice.onSaveOffice(event)">
          <div class="form-group">
            <label>事務所・法人名 <span class="required">*</span></label>
            <input type="text" name="name" value="${info.name}" required placeholder="行政書士法人フェリス">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>所属会名</label>
              <input type="text" name="assocName" value="${info.assocName || '愛知県行政書士会会員'}" placeholder="愛知県行政書士会会員">
            </div>
            <div class="form-group">
              <label>代表者名</label>
              <input type="text" name="representative" value="${info.representative}" placeholder="代表行政書士 日栄 政敏">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>適格請求書登録番号（インボイス）</label>
              <input type="text" name="registrationNumber" value="${info.registrationNumber || ''}" placeholder="T1234567890123">
            </div>
            <div class="form-group">
              <label>郵便番号</label>
              <input type="text" name="zip" value="${info.zip}" placeholder="481-0033">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>電話番号</label>
              <input type="text" name="tel" value="${info.tel}" placeholder="0586-50-2896">
            </div>
            <div class="form-group">
              <label>FAX番号</label>
              <input type="text" name="fax" value="${info.fax || ''}" placeholder="0568-26-3714">
            </div>
          </div>
          <div class="form-group">
            <label>所在地（住所）</label>
            <input type="text" name="address" value="${info.address}" placeholder="愛知県北名古屋市六ツ師道毛74番地1" style="width:100%">
          </div>
          <h3 style="margin:16px 0 8px;font-size:0.95rem">🏦 振込先口座</h3>
          <div class="form-row">
            <div class="form-group">
              <label>金融機関名</label>
              <input type="text" name="bankName" value="${info.bankName}" placeholder="三菱UFJ銀行">
            </div>
            <div class="form-group">
              <label>支店名</label>
              <input type="text" name="bankBranch" value="${info.bankBranch}" placeholder="西春支店">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>口座種別</label>
              <select name="accountType" class="form-select">
                <option value="普通" ${info.accountType === '普通' ? 'selected' : ''}>普通</option>
                <option value="当座" ${info.accountType === '当座' ? 'selected' : ''}>当座</option>
              </select>
            </div>
            <div class="form-group">
              <label>口座番号</label>
              <input type="text" name="accountNumber" value="${info.accountNumber}" placeholder="0129129">
            </div>
          </div>
          <div class="form-group">
            <label>口座名義</label>
            <input type="text" name="accountHolder" value="${info.accountHolder}" placeholder="行政書士法人フェリス" style="width:100%">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="document.getElementById('officeSettingsModal').remove()">キャンセル</button>
            <button type="submit" class="btn-primary">💾 保存</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onSaveOffice(e) {
    e.preventDefault();
    const form = e.target;
    const info = {
      name: form.name.value.trim(),
      assocName: form.assocName.value.trim(),
      representative: form.representative.value.trim(),
      registrationNumber: form.registrationNumber.value.trim(),
      zip: form.zip.value.trim(),
      tel: form.tel.value.trim(),
      fax: form.fax.value.trim(),
      address: form.address.value.trim(),
      bankName: form.bankName.value.trim(),
      bankBranch: form.bankBranch.value.trim(),
      accountType: form.accountType.value,
      accountNumber: form.accountNumber.value.trim(),
      accountHolder: form.accountHolder.value.trim(),
    };
    this.saveOfficeInfo(info);
    const modal = document.getElementById('officeSettingsModal');
    if (modal) modal.remove();
    App.showToast('事務所情報を保存しました');
  },

  showReceipt(invoiceNo) {
    const payments = typeof Payments !== 'undefined' ? Payments.getAll() : [];
    const p = payments.find(x => x.invoiceNo === invoiceNo);
    if (!p) {
      App.showToast('入金データが見つかりません');
      return;
    }
    const clientId = p.clientId;
    const client = Store.getClient(clientId);
    const office = this.getOfficeInfo();
    const cases = this.getBilledCases(clientId, invoiceNo);
    
    const feeSubtotal = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    const taxRate = p.taxRate !== undefined ? p.taxRate : 10;
    const tax = Math.floor(feeSubtotal * taxRate / 100);
    const advanceTotal = cases.reduce((sum, c) => sum + (c.advances || []).reduce((s,a) => s + Number(a.amount || 0), 0), 0);
    const total = p.amount;
    const paidAt = p.paidAt ? p.paidAt.slice(0, 10) : Store.getLocalDateStr();
    
    const html = this.buildStandardInvoiceHTML({
      invoiceNo, issueDate: paidAt, dueDate: '', year: new Date(paidAt).getFullYear(), month: new Date(paidAt).getMonth() + 1,
      client, office, cases, CATS: { garage_oss: '車庫証明(OSS)', garage_paper: '車庫証明(一般)', seal: '出張封印', car_reg_standard: '普通車登録', car_reg_light: '軽自動車登録' },
      feeSubtotal, tax, taxRate, advanceTotal, total, note: '領収証として上記正に領収いたしました。',
      docType: 'receipt', contactNames: []
    });

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    App.showToast(`領収書 ${invoiceNo} を印刷プレビューしました`);
  }
};
