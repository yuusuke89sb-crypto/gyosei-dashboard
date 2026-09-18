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

  getBillingPeriod(year, month) {
    return Store.getBillingPeriod(year, month);
  },

  getCurrentBillingPeriod(refDate) {
    return Store.getCurrentBillingPeriod(refDate);
  },

  // 請求書・見積書選択モーダルを表示
  showSelectModal(clientId, docType = 'invoice', includeAll = false) {
    const client = Store.getClient(clientId);
    if (!client) return;

    const now = new Date();
    const currentPeriod = this.getCurrentBillingPeriod(now);
    const defaultIssueDate = Store.getLocalDateStr(now);
    const defaultDueDate = currentPeriod.dueDate;
    const detectedTpl = this.detectTemplate(client);

    // 未請求案件のリスト生成
    const unbilledCases = this.getUnbilledCases(clientId, includeAll);
    const newCount = unbilledCases.filter(c => !c.isUsedCar).length;
    const usedCount = unbilledCases.filter(c => !!c.isUsedCar).length;
    this.activeCarFilter = 'all';

    let unbilledHtml = '';
    if (unbilledCases.length === 0) {
      unbilledHtml = `<div style="color:var(--text-muted);font-size:0.9rem;padding:20px 0;text-align:center;">${includeAll ? '請求可能な案件がありません。' : '未請求の完了案件はありません。（右上の「未完了も表示」にチェックを入れると未完了案件も請求可能になります）'}</div>`;
    } else {
      unbilledHtml = unbilledCases.map(c => {
        const isUsed = !!c.isUsedCar;
        const effectiveFee = c.isPaid ? 0 : Number(c.fee||0);
        const effectiveAdv = c.isAdvancePaid ? 0 : (c.advances||[]).reduce((s,a) => s+Number(a.amount||0), 0);
        let partialBadge = '';
        if (c.status !== 'done') {
          partialBadge = `<span style="background:#fef3c7;color:#b45309;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;">${c.status === 'in_progress' ? '進行中' : '受付済'}</span>`;
        }
        if (c.isAdvancePaid && !c.isPaid) partialBadge += '<span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;">立替済</span>';
        if (c.isPaid && !c.isAdvancePaid) partialBadge += '<span style="background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:600;">報酬済</span>';

        const rawDate = c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || (c.createdAt ? c.createdAt.slice(0, 10) : '') || '';
        const cDate = rawDate.slice(0, 10);
        const inPeriod = currentPeriod ? (cDate >= currentPeriod.startDate && cDate <= currentPeriod.endDate) : true;
        const dateBadge = cDate ? `<span style="background:${inPeriod ? 'rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);' : 'rgba(100,116,139,0.1);color:var(--text-muted);border:1px solid var(--border-color);'}padding:1px 5px;border-radius:3px;font-size:0.7rem;white-space:nowrap;">${inPeriod ? '📅 ' + cDate.slice(5) : '⚠️ 期間外 ' + cDate.slice(5)}</span>` : '';

        const carTypeBadge = isUsed
          ? `<span style="font-size:0.72rem;background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:1px 6px;border-radius:4px;font-weight:bold;white-space:nowrap;">🚙 中古</span>`
          : `<span style="font-size:0.72rem;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:1px 6px;border-radius:4px;font-weight:600;white-space:nowrap;">🚗 新車</span>`;

        let catName = c.category || '';
        if (c.category === 'garage_oss') catName = '車庫OSS';
        else if (c.category === 'garage_paper') catName = '車庫一般';
        else if (c.category === 'seal') catName = '封印';
        else if (c.category === 'car_reg_standard') catName = '普通車登録';
        else if (c.category === 'car_reg_light') catName = '軽登録';
        const subCat = c.subCategory ? ` (${c.subCategory})` : '';

        return `
          <div class="invoice-case-row ${inPeriod ? 'selected' : ''}" id="caseRow_${c.id}" onclick="Invoice.toggleCaseRow('${c.id}', '${clientId}', event)" data-is-used="${isUsed ? '1' : '0'}" data-case-date="${cDate}">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
              <input type="checkbox" name="targetCases" value="${c.id}" id="cb_${c.id}" data-case-date="${cDate}" data-is-used="${isUsed ? '1' : '0'}" ${inPeriod ? 'checked' : ''} class="case-checkbox" onclick="event.stopPropagation()" onchange="Invoice.onCheckboxChange('${clientId}', '${c.id}')">
              
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                ${carTypeBadge}
                ${dateBadge}
                ${partialBadge}
              </div>

              <div style="min-width:0; flex:1;">
                <div style="font-size:0.86rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
                  ${c.orderNo ? `<span style="font-size:0.72rem; color:var(--text-muted); font-family:monospace; background:rgba(255,255,255,0.05); padding:1px 4px; border-radius:3px; border:1px solid var(--border-color);">№${c.orderNo}</span>` : ''}
                  <span>${c.carName ? `${c.carName} 様` : c.title}</span>
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${c.carName && c.title !== c.carName ? `${c.title} • ` : ''}${catName}${subCat}
                </div>
              </div>
            </div>

            <div style="flex-shrink:0; text-align:right; margin-left:8px;">
              <div style="font-size:0.88rem; font-weight:bold; color:var(--text-primary);">¥${(effectiveFee + effectiveAdv).toLocaleString()}</div>
              <div style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap;">
                報酬:¥${effectiveFee.toLocaleString()}${effectiveAdv > 0 ? ` + 立替:¥${effectiveAdv.toLocaleString()}` : ''}
              </div>
            </div>
          </div>
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
            <div class="form-row" style="margin-bottom:12px; gap:12px;">
              <div class="form-group" style="flex:1;">
                <label>🗓️ 請求対象月（20日締め・翌月25日払）</label>
                <select id="invoiceBillingPeriod" class="form-select" style="font-weight:600;" onchange="Invoice.onPeriodChange('${clientId}', '${docType}', this.value)">
                  <option value="2026-09" ${currentPeriod.year === 2026 && currentPeriod.month === 9 ? 'selected' : ''}>令和8年 9月分 (2026/08/26 〜 09/20 締 / 10/25 払)</option>
                  <option value="2026-10" ${currentPeriod.year === 2026 && currentPeriod.month === 10 ? 'selected' : ''}>令和8年 10月分 (2026/09/21 〜 10/20 締 / 11/25 払)</option>
                  <option value="2026-11" ${currentPeriod.year === 2026 && currentPeriod.month === 11 ? 'selected' : ''}>令和8年 11月分 (2026/10/21 〜 11/20 締 / 12/25 払)</option>
                  <option value="all">全未請求案件（期間指定なし）</option>
                </select>
              </div>
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

            <div class="form-group" style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-bottom:16px;">
              <!-- フィルタバー＆選択アクション -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <!-- 車両区分フィルタ (すべて / 新車のみ / 中古車のみ) -->
                <div style="display:inline-flex; background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px; padding:2px; gap:2px;">
                  <button type="button" id="btnFilterAllCars" class="filter-pill-btn active" onclick="Invoice.filterCarType('${clientId}', 'all')">
                    すべて <span style="font-size:0.7rem; opacity:0.85;">(${unbilledCases.length})</span>
                  </button>
                  <button type="button" id="btnFilterNewCars" class="filter-pill-btn" onclick="Invoice.filterCarType('${clientId}', 'new')">
                    🚗 新車のみ <span style="font-size:0.7rem; opacity:0.85;">(${newCount})</span>
                  </button>
                  <button type="button" id="btnFilterUsedCars" class="filter-pill-btn" onclick="Invoice.filterCarType('${clientId}', 'used')">
                    🚙 中古車のみ <span style="font-size:0.7rem; opacity:0.85;">(${usedCount})</span>
                  </button>
                </div>

                <!-- 一括選択ボタン -->
                <div style="display:flex; align-items:center; gap:6px;">
                  <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:3px 8px;" onclick="Invoice.selectFilteredCases('${clientId}', 'period')">🎯 期間内のみ</button>
                  <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:3px 8px;" onclick="Invoice.selectFilteredCases('${clientId}', 'all')">全選択</button>
                  <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:3px 8px;" onclick="Invoice.selectFilteredCases('${clientId}', 'none')">解除</button>
                  
                  <label style="font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer; margin-left:6px;">
                    <input type="checkbox" ${includeAll ? 'checked' : ''} onchange="Invoice.toggleIncludeAll('${clientId}', '${docType}', this.checked)" style="width:14px;height:14px;margin:0;">
                    未完了も表示
                  </label>
                </div>
              </div>

              <!-- 案件リストコンテナ -->
              <div class="invoice-case-list" id="invoiceCaseList">
                ${unbilledHtml}
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>発行日</label>
                <input type="date" id="invoiceDate" value="${defaultIssueDate}">
              </div>
              <div class="form-group" style="${docType === 'estimate' ? 'display:none' : ''}">
                <label>支払期限（翌月25日）</label>
                <input type="date" id="invoiceDueDate" value="${defaultDueDate}">
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
              <textarea id="invoiceNote" rows="2" placeholder="例：中古車分、9月登録分 など"></textarea>
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

  onPeriodChange(clientId, docType, periodKey) {
    const dueDateInput = document.getElementById('invoiceDueDate');
    let period = null;
    if (periodKey && periodKey !== 'all') {
      const parts = periodKey.split('-');
      period = this.getBillingPeriod(parts[0], parts[1]);
    }

    if (period && dueDateInput) {
      dueDateInput.value = period.dueDate;
    }

    // チェックボックスの自動選別
    this.selectFilteredCases(clientId, 'period');
  },

  activeCarFilter: 'all',

  filterCarType(clientId, filterType) {
    this.activeCarFilter = filterType;

    const btnAll = document.getElementById('btnFilterAllCars');
    const btnNew = document.getElementById('btnFilterNewCars');
    const btnUsed = document.getElementById('btnFilterUsedCars');
    if (btnAll) btnAll.classList.toggle('active', filterType === 'all');
    if (btnNew) btnNew.classList.toggle('active', filterType === 'new');
    if (btnUsed) btnUsed.classList.toggle('active', filterType === 'used');

    const periodKey = document.getElementById('invoiceBillingPeriod') ? document.getElementById('invoiceBillingPeriod').value : 'all';
    let period = null;
    if (periodKey && periodKey !== 'all') {
      const parts = periodKey.split('-');
      period = this.getBillingPeriod(parts[0], parts[1]);
    }

    const rows = document.querySelectorAll('.invoice-case-row');
    rows.forEach(row => {
      const isUsed = row.getAttribute('data-is-used') === '1';
      const caseDate = row.getAttribute('data-case-date') || '';
      const inPeriod = (!period || periodKey === 'all') ? true : (caseDate >= period.startDate && caseDate <= period.endDate);
      const cb = row.querySelector('.case-checkbox');

      let visible = true;
      if (filterType === 'new') {
        visible = !isUsed;
      } else if (filterType === 'used') {
        visible = isUsed;
      }

      row.style.display = visible ? 'flex' : 'none';

      if (visible) {
        if (cb) {
          cb.checked = inPeriod;
          row.classList.toggle('selected', cb.checked);
        }
      } else {
        if (cb) {
          cb.checked = false;
          row.classList.remove('selected');
        }
      }
    });

    const noteEl = document.getElementById('invoiceNote');
    if (noteEl) {
      let currentNote = noteEl.value.trim();
      if (filterType === 'used') {
        if (!currentNote.includes('中古車分')) {
          noteEl.value = currentNote ? `${currentNote}（中古車分）` : '（中古車分）';
        }
      } else {
        noteEl.value = currentNote.replace(/[（(]?中古車分[）)]?/g, '').trim();
      }
    }

    this.updatePreview(clientId);
  },

  selectFilteredCases(clientId, mode) {
    const periodKey = document.getElementById('invoiceBillingPeriod') ? document.getElementById('invoiceBillingPeriod').value : 'all';
    let period = null;
    if (periodKey && periodKey !== 'all') {
      const parts = periodKey.split('-');
      period = this.getBillingPeriod(parts[0], parts[1]);
    }

    const rows = document.querySelectorAll('.invoice-case-row');
    rows.forEach(row => {
      if (row.style.display === 'none') return;
      const cb = row.querySelector('.case-checkbox');
      if (!cb) return;

      if (mode === 'all') {
        cb.checked = true;
      } else if (mode === 'none') {
        cb.checked = false;
      } else if (mode === 'period') {
        const caseDate = cb.getAttribute('data-case-date') || '';
        if (!period || periodKey === 'all') {
          cb.checked = true;
        } else if (caseDate) {
          cb.checked = (caseDate >= period.startDate && caseDate <= period.endDate);
        } else {
          cb.checked = true;
        }
      }
      row.classList.toggle('selected', cb.checked);
    });

    this.updatePreview(clientId);
  },

  selectCasesByPeriod(clientId, mode) {
    this.selectFilteredCases(clientId, mode);
  },

  toggleCaseRow(caseId, clientId, event) {
    if (event && event.target && event.target.tagName === 'INPUT') return;
    const cb = document.getElementById(`cb_${caseId}`);
    if (!cb) return;
    cb.checked = !cb.checked;
    this.onCheckboxChange(clientId, caseId);
  },

  onCheckboxChange(clientId, caseId) {
    const row = document.getElementById(`caseRow_${caseId}`);
    const cb = document.getElementById(`cb_${caseId}`);
    if (row && cb) {
      row.classList.toggle('selected', cb.checked);
    }
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

    const usedCount = cases.filter(c => !!c.isUsedCar).length;
    const newCount = cases.length - usedCount;
    let carBreakdownBadge = '';
    if (usedCount > 0 && newCount > 0) {
      carBreakdownBadge = `<span style="font-size:0.75rem; color:var(--text-secondary); margin-left:6px;">(新車:${newCount}件, 中古:${usedCount}件)</span>`;
    } else if (usedCount > 0) {
      carBreakdownBadge = `<span style="font-size:0.75rem; color:#b45309; font-weight:bold; margin-left:6px;">(全件中古車)</span>`;
    } else {
      carBreakdownBadge = `<span style="font-size:0.75rem; color:#0369a1; font-weight:600; margin-left:6px;">(全件新車)</span>`;
    }

    let html = `<strong>選択中案件 (${cases.length}件)</strong>${carBreakdownBadge}<br>`;
    html += cases.map(c => {
      const advs = (c.advances||[]).filter(a=>a.label||Number(a.amount)>0);
      const advSum = advs.reduce((s,a)=>s+Number(a.amount||0),0);
      const usedTag = c.isUsedCar ? '【中古】' : '';
      return `・${usedTag}${c.title}：報酬 ¥${Number(c.fee||0).toLocaleString()}${advSum>0?` + 立替 ¥${advSum.toLocaleString()}`:''}`;
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
    let note = (document.getElementById('invoiceNote').value || '').trim();
    // 全選択案件が中古車で備考に「中古車分」の指定がなければ自動付与
    const isAllUsed = cases.length > 0 && cases.every(c => !!c.isUsedCar);
    if (isAllUsed && !note.includes('中古車分')) {
      note = note ? `${note}（中古車分）` : '（中古車分）';
    }
    const templateType = document.getElementById('invoiceTemplateType')
      ? document.getElementById('invoiceTemplateType').value
      : (this.detectTemplate(client) || 'standard');
    const periodKey = document.getElementById('invoiceBillingPeriod') ? document.getElementById('invoiceBillingPeriod').value : '';
    let year, month;
    if (periodKey && periodKey !== 'all') {
      const parts = periodKey.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      const curP = this.getCurrentBillingPeriod();
      year = curP.year;
      month = curP.month;
    }
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

    // ソートキー取得関数
    const getSortDate = (c) => {
      return c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || c.createdAt || c.registeredAt || '';
    };
    // 封印判定
    const isSeal = (c) => c.category === 'seal' || (c.title || '').includes('封印');
    // 車庫・その他（封印以外）と封印を分離し、それぞれ完了日順でソート
    const nonSealCases = cases.filter(c => !isSeal(c)).sort((a, b) => getSortDate(a).localeCompare(getSortDate(b)));
    const sealCases = cases.filter(c => isSeal(c)).sort((a, b) => getSortDate(a).localeCompare(getSortDate(b)));
    const sortedCases = [...nonSealCases, ...sealCases];

    // 明細ページの分割（1ページあたり22件、見出し・№1, №2...を各ページに描画）
    const ROWS_PER_PAGE = 22;
    const totalDetailPages = Math.ceil(sortedCases.length / ROWS_PER_PAGE) || 1;

    let detailPagesHTML = '';
    for (let pIdx = 0; pIdx < totalDetailPages; pIdx++) {
      const pageNum = pIdx + 1;
      const isLastPage = (pageNum === totalDetailPages);
      const pageCases = sortedCases.slice(pIdx * ROWS_PER_PAGE, (pIdx + 1) * ROWS_PER_PAGE);

      const rowsHTML = pageCases.map((c) => {
        const rawDate = getSortDate(c);
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
        
        // OSSの管轄は空欄
        let policeName = '';
        if (c.category !== 'garage_oss') {
          policeName = (c.carPolice || '').replace(/警察署?/, '').trim();
          if (!policeName && c.policeLocationId && typeof Store !== 'undefined') {
            const loc = Store.getLocation(c.policeLocationId);
            if (loc) policeName = (loc.name || '').replace(/警察署?/, '').trim();
          }
          if (!policeName) policeName = (c.policeStation || c.authority || '').replace(/警察署?/, '').trim();
        }

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
        if (c.isUsedCar) {
          categoryShort = categoryShort ? `中古・${categoryShort}` : '中古';
        }

        const fee = Number(c.fee || 0);
        const advSum = (c.advances || []).reduce((s,a)=>s+Number(a.amount||0), 0);
        const advDetails = (c.advances || []).filter(a => Number(a.amount) > 0).map(a => {
          const displayLabel = a.label || a.category || (a.label && a.label.includes('証紙') ? '証紙' : (a.label && a.label.includes('印紙') ? '印紙' : (a.label && (a.label.includes('送') || a.label.includes('レターパック')) ? '送料' : (a.label && (a.label.includes('プレート') || a.label.includes('ナンバー')) ? 'プレート' : '実費'))));
          return `${displayLabel}:${Number(a.amount).toLocaleString()}`;
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
      }).join('');

      detailPagesHTML += `
<!-- 明細書 ページ ${pageNum} -->
<div class="page ${isLastPage ? '' : 'page-break'}">
  <div class="doc-title" style="font-size:20px; letter-spacing:6px; margin-bottom:12px;">車庫証明申請等明細書${note ? `<span style="font-size:13px; letter-spacing:0; font-weight:normal; margin-left:12px; vertical-align:middle;">${note}</span>` : ''}</div>
  
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; font-size:12.5px;">
    <div>
      <div style="font-size:15px; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:2px; display:inline-block;">
        ${clientName}　御中
      </div>
    </div>
    <div style="text-align:right; font-size:11.5px; line-height:1.45;">
      <div>〒${office.zip || '481-0033'}</div>
      <div>${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:12.5px;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div style="margin-top:4px; font-weight:bold;">令和 ${reiwaYear} 年 ${month || issueM} 月分　　№${pageNum}</div>
    </div>
  </div>

  <table class="grid-table" style="font-size:11.5px; margin-bottom:8px;">
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
      ${rowsHTML}
      ${isLastPage ? `
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" class="col-center">合　　計</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
        <td class="col-num">${advanceTotal.toLocaleString()}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="detail-footer" style="font-size:10.5px; text-align:right; color:#666; margin-top:auto; padding-top:6px;">
    ${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo} (${pageNum}/${totalDetailPages})
  </div>
</div>
`;
    }

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
    body { background: #fff; padding: 0; margin: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 0; }
    .page {
      width: 210mm !important;
      min-height: 297mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 12mm 15mm 10mm !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    .page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .page-break {
      page-break-after: always !important;
      break-after: page !important;
    }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto 20px;
    padding: 15mm 18mm 12mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
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
    font-size: 24px;
    font-weight: bold;
    letter-spacing: 10px;
    margin-bottom: 18px;
    padding-bottom: 6px;
  }
  .recipient-box {
    margin-bottom: 18px;
    font-size: 17px;
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
    margin-bottom: 12px;
    font-size: 12px;
  }
  table.grid-table th, table.grid-table td {
    border: 1px solid #000;
    padding: 4px 7px;
    line-height: 1.35;
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
    font-size: 15px;
    font-weight: bold;
    background: #f8fafc;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }

  .sender-container {
    margin-top: 18px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    line-height: 1.6;
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
  <div class="doc-title">${docType === 'estimate' ? '御 見 積 書' : '請 求 書'}${note ? `<div style="font-size:13px; font-weight:normal; letter-spacing:1px; margin-top:4px; color:#334155;">${note}</div>` : ''}</div>
  
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
        <td class="section-label col-center" ${sealCount > 0 ? 'rowspan="2"' : ''}>報酬</td>
        <td>
          <div style="font-weight:bold;">車庫証明申請他</div>
          <div style="font-size:11px; color:#475569; margin-top:2px;">(内、車庫証明申請 ${garageCount}件)</div>
        </td>
        <td class="col-center">${garageCount + otherCount}件</td>
        <td class="col-num">${(garageFee + otherFee).toLocaleString()}</td>
      </tr>
      ${sealCount > 0 ? `<tr>
        <td>
          <div style="font-weight:bold;">出張封印</div>
        </td>
        <td class="col-center">${sealCount}件</td>
        <td class="col-num">${sealFee.toLocaleString()}</td>
      </tr>` : ''}
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

  <div style="font-size:13px; margin-bottom: 8px;">上記のとおりご請求申し上げます。</div>
  <div style="font-size:13px; margin-bottom: 8px;">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>
  ${dueDate && docType !== 'estimate' ? `
  <div style="font-size:13px; font-weight:bold; color:#b91c1c; margin-bottom: 18px;">
    お支払期日：${dueDate.replace(/-/g, '/')}（翌月25日）
  </div>` : '<div style="margin-bottom: 20px;"></div>'}

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

${detailPagesHTML}

</body>
</html>`;
  },

  // =========================================================================
  // 2. 三菱ふそう様式（業務別集計＋実費・諸費用 ＆ 2ページ目明細書）
  // =========================================================================
  buildMitsubishiInvoiceHTML({ invoiceNo = '', issueDate = '', dueDate = '', year = '', month = '', client = {}, office = {}, cases = [], feeSubtotal = 0, tax = 0, total = 0, advanceTotal = 0, docType = 'invoice' }) {
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

    // 明細ページの分割（1ページあたり22件、見出し・№1, №2...を各ページに描画）
    const ROWS_PER_PAGE = 22;
    const totalDetailPages = Math.ceil(cases.length / ROWS_PER_PAGE) || 1;

    let fusoDetailPagesHTML = '';
    for (let pIdx = 0; pIdx < totalDetailPages; pIdx++) {
      const pageNum = pIdx + 1;
      const isLastPage = (pageNum === totalDetailPages);
      const pageCases = cases.slice(pIdx * ROWS_PER_PAGE, (pIdx + 1) * ROWS_PER_PAGE);

      const rowsHTML = pageCases.map((c) => {
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
        if (c.isUsedCar) {
          categoryShort = categoryShort ? `中古・${categoryShort}` : '中古';
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
      }).join('');

      fusoDetailPagesHTML += `
<!-- 明細書 ページ ${pageNum} -->
<div class="page ${isLastPage ? '' : 'page-break'}">
  <div class="doc-title" style="font-size:20px; letter-spacing:6px; margin-bottom:12px;">車庫証明・登録申請等明細書</div>
  
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; font-size:12.5px;">
    <div>
      <div style="font-size:15px; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:2px; display:inline-block;">
        ${clientName}　御中
      </div>
    </div>
    <div style="text-align:right; font-size:11.5px; line-height:1.45;">
      <div>〒${office.zip || '481-0033'}</div>
      <div>${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div style="font-weight:bold; font-size:12.5px;">${office.name || '行政書士法人フェリス'}</div>
      <div>${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div style="margin-top:4px; font-weight:bold;">令和 ${reiwaYear} 年 ${month || issueM || ''} 月分　　№${pageNum}</div>
    </div>
  </div>

  <table class="fuso-table" style="font-size:11.5px; margin-bottom:8px;">
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
      ${rowsHTML}
      ${isLastPage ? `
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" class="col-center">合　　計</td>
        <td class="col-num">${feeSubtotal.toLocaleString()}</td>
        <td class="col-num">${advanceTotal.toLocaleString()}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="detail-footer" style="font-size:10.5px; text-align:right; color:#666; margin-top:auto; padding-top:6px;">
    ${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo} (${pageNum}/${totalDetailPages})
  </div>
</div>
`;
    }

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
    body { background: #fff; padding: 0; margin: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 0; }
    .page {
      width: 210mm !important;
      min-height: 297mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 12mm 15mm 10mm !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    .page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .page-break {
      page-break-after: always !important;
      break-after: page !important;
    }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto 20px;
    padding: 15mm 18mm 12mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .no-print-bar { max-width: 210mm; margin: 0 auto 15px; display: flex; justify-content: flex-end; gap: 10px; }
  .btn { padding: 8px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; font-size: 14px; }
  .btn-print { background: #dc2626; color: #fff; }
  .btn-close { background: #cbd5e1; color: #1e293b; }

  .doc-title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 10px; margin-bottom: 18px; padding-bottom: 6px; }
  table.fuso-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
  table.fuso-table th, table.fuso-table td { border: 1px solid #000; padding: 4px 7px; line-height: 1.35; }
  table.fuso-table th { background: #f8fafc; text-align: center; font-weight: bold; }
  .col-num { text-align: right; font-family: 'Noto Sans JP', sans-serif; }
  .col-center { text-align: center; }

  .sender-container {
    margin-top: 18px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    line-height: 1.6;
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

  <div style="font-size:13px; margin: 15px 0 8px;">上記のとおりご請求申し上げます。</div>
  <div style="font-size:13px; margin-bottom: 8px;">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>
  ${dueDate && docType !== 'estimate' ? `
  <div style="font-size:13px; font-weight:bold; color:#b91c1c; margin-bottom: 18px;">
    お支払期日：${dueDate.replace(/-/g, '/')}（翌月25日）
  </div>` : '<div style="margin-bottom: 20px;"></div>'}

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

${fusoDetailPagesHTML}

</body>
</html>`;
  },

  // =========================================================================
  // 3. 日産愛知販売様式（A4縦表紙＋A4横納品・請求明細書30行＋OSS作成明細別紙）
  // =========================================================================
  buildNissanInvoiceHTML({ invoiceNo, issueDate, dueDate = '', year = '', month = '', client, office, cases, feeSubtotal, tax, taxRate = 10, total, advanceTotal, docType = 'invoice' }) {
    let clientName = client.type === '法人' ? (client.companyName || client.name) : client.name;
    if (!clientName) clientName = '日産愛知販売株式会社 御中';
    else if (!clientName.includes('御中') && !clientName.includes('様')) clientName += ' 御中';

    const [issueY, issueM, issueD] = (issueDate || Store.getLocalDateStr()).split('-');
    const reiwaYear = issueY ? parseInt(issueY, 10) - 2018 : 8;

    const formatDateMMDD = (rawDate) => {
      if (!rawDate) return '';
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
      const parts = String(rawDate).split(/[-/T]/);
      if (parts.length >= 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      return String(rawDate).slice(5);
    };

    const formatItemName = (c) => {
      if (c.item) return c.item;
      if (c.category === 'garage_oss' || (c.title || '').includes('OSS作成')) return '車庫証明（OSS作成）';
      if (c.category === 'garage_light' || ((c.title || '').includes('車庫') && (c.title || '').includes('軽'))) return '車庫証明（軽自動車届出）';
      if (c.category === 'garage_paper' || (c.title || '').includes('車庫')) return '車庫証明（申請・取得）';
      if (c.category === 'seal' || (c.title || '').includes('封印')) return '封印';
      if (c.category === 'car_reg_new' || (c.title || '').includes('新規')) return (c.title || '').includes('軽') ? '新車新規登録（軽）' : '新車新規登録';
      if (c.category === 'tax_reduction' || (c.title || '').includes('減免')) return '減免申請';
      if (c.category === 'plate' || (c.title || '').includes('ナンバー')) return 'ナンバー再交付';
      if (c.isUsedCar) return `中古・${c.title || c.subCategory || '登録申請等'}`;
      return c.title || c.subCategory || '登録申請等';
    };

    const formatPoliceName = (c) => {
      if (c.policeName) return c.policeName;
      let p = (c.carPolice || '').replace(/警察署?/, '').trim();
      if (!p && c.policeLocationId && typeof Store !== 'undefined') {
        const loc = Store.getLocation(c.policeLocationId);
        if (loc) p = (loc.name || '').replace(/警察署?/, '').trim();
      }
      if (!p) p = (c.policeStation || c.authority || '').replace(/警察署?/, '').trim();
      return p;
    };

    // OSS図面作成（立替金のないOSS案件）を分離し別紙集計、通常案件を個別計上
    const ossCases = [];
    const nonOssCases = [];

    cases.forEach(c => {
      const isOss = c.category === 'garage_oss' || 
                    (c.subCategory && c.subCategory.includes('OSS')) || 
                    (c.title && c.title.includes('OSS作成'));
      const hasAdvances = (c.advances || []).some(a => Number(a.amount || 0) > 0);
      if (isOss && !hasAdvances) {
        ossCases.push(c);
      } else {
        nonOssCases.push(c);
      }
    });

    const processedRegularItems = nonOssCases.map(c => {
      const advList = (c.advances || []).filter(a => Number(a.amount || 0) > 0 || (a.label && a.label.trim()));
      return {
        applyDateStr: formatDateMMDD(c.applyDate || c.createdAt || c.completedAt),
        orderNo: c.orderNo || c.caseNo || '',
        applicantName: c.carName || c.applicantName || c.title || '',
        policeName: formatPoliceName(c),
        item: formatItemName(c),
        fee: Number(c.fee || 0), // 税抜金額
        completedDateStr: formatDateMMDD(c.completedAt || c.registrationDate || c.policeDeliveryDate || ''),
        advances: advList
      };
    });

    // OSS案件が存在する場合：横向き台帳には「別紙明細参照【N件】」として1行に集約し、Page 4に別紙明細を出力
    let sortedOssCases = [];
    if (ossCases.length > 0) {
      sortedOssCases = [...ossCases].sort((a, b) => {
        const da = a.completedAt || a.applyDate || a.createdAt || '';
        const db = b.completedAt || b.applyDate || b.createdAt || '';
        return da.localeCompare(db);
      });
      const firstOssDate = formatDateMMDD(sortedOssCases[0].applyDate || sortedOssCases[0].completedAt || sortedOssCases[0].createdAt || '');
      const lastOssDate = formatDateMMDD(sortedOssCases[sortedOssCases.length - 1].completedAt || sortedOssCases[sortedOssCases.length - 1].applyDate || sortedOssCases[sortedOssCases.length - 1].createdAt || '');
      const ossFeeSubtotal = sortedOssCases.reduce((s, c) => s + Number(c.fee || 0), 0);

      processedRegularItems.push({
        isOssBundle: true,
        applyDateStr: firstOssDate,
        orderNo: '',
        applicantName: `別紙明細参照【${sortedOssCases.length}件】`,
        policeName: '',
        item: '車庫証明（OSS作成）',
        fee: ossFeeSubtotal, // 税抜金額
        completedDateStr: lastOssDate,
        advances: []
      });
    }

    // 金額集計（税抜報酬、消費税10%、立替金、総合計）
    const effectiveFeeSubtotal = (feeSubtotal !== undefined) ? feeSubtotal : processedRegularItems.reduce((s, it) => s + (it.fee || 0), 0);
    const effectiveTaxRate = (taxRate !== undefined) ? taxRate : 10;
    const effectiveTax = (tax !== undefined) ? tax : Math.floor(effectiveFeeSubtotal * effectiveTaxRate / 100);
    const effectiveAdvanceTotal = (advanceTotal !== undefined) ? advanceTotal : processedRegularItems.reduce((s, it) => s + it.advances.reduce((sa, a) => sa + Number(a.amount || 0), 0), 0);
    const invoiceGrandTotal = (total !== undefined) ? total : (effectiveFeeSubtotal + effectiveTax + effectiveAdvanceTotal);

    // A4横向き台帳の改ページ制御（1ページ30行、案件間は必ず1行空ける、余白は30行まで空行パディング）
    const MAX_ROWS = 30;
    const landscapePages = [];
    let curPageRows = [];

    processedRegularItems.forEach((item, itemIdx) => {
      const advCount = Math.max(1, item.advances.length);
      
      // 次の案件が現在のページに入らない場合は30行までパディングして次ページへ
      if (curPageRows.length + advCount > MAX_ROWS) {
        while (curPageRows.length < MAX_ROWS) {
          curPageRows.push({ type: 'pad' });
        }
        landscapePages.push(curPageRows);
        curPageRows = [];
      }
      
      // 案件の行を追加（立替金が複数ある場合は2行目以降も消費）
      for (let aIdx = 0; aIdx < advCount; aIdx++) {
        curPageRows.push({
          type: 'case',
          item: item,
          isFirst: (aIdx === 0),
          adv: item.advances[aIdx] || null
        });
      }
      
      // 【ユーザー指定】案件ごとに必ず1行空ける（空行も行番号付きの行としてカウント）
      if (curPageRows.length < MAX_ROWS && itemIdx < processedRegularItems.length - 1) {
        curPageRows.push({ type: 'blank' });
      }
    });

    if (curPageRows.length > 0) {
      while (curPageRows.length < MAX_ROWS) {
        curPageRows.push({ type: 'pad' });
      }
      landscapePages.push(curPageRows);
    } else if (landscapePages.length === 0) {
      while (curPageRows.length < MAX_ROWS) {
        curPageRows.push({ type: 'pad' });
      }
      landscapePages.push(curPageRows);
    }

    const totalLandscapePages = landscapePages.length;

    // 横向き明細書HTMLの生成
    let nissanDetailPagesHTML = '';
    landscapePages.forEach((pRows, pIdx) => {
      const pageNum = pIdx + 1;
      let pageFeeSubtotal = 0;
      let pageAdvSubtotal = 0;

      const rowsHTML = pRows.map((r, rIdx) => {
        const lineNo = rIdx + 1;
        if (r.type === 'case') {
          const it = r.item;
          const isFirst = r.isFirst;
          const adv = r.adv;

          if (isFirst) {
            pageFeeSubtotal += (it.fee || 0);
          }
          if (adv && Number(adv.amount || 0) > 0) {
            pageAdvSubtotal += Number(adv.amount || 0);
          }

          const applyDate = isFirst ? (it.applyDateStr || '') : '';
          const orderNo = isFirst ? (it.orderNo || '') : '';
          const applicant = isFirst ? `<strong>${it.applicantName || ''}</strong>` : '';
          const police = isFirst ? (it.policeName || '') : '';
          const itemText = isFirst ? (it.item || '') : '';
          const feeText = (isFirst && it.fee > 0) ? it.fee.toLocaleString() : '';
          const completeDate = isFirst ? (it.completedDateStr || '') : '';

          const advLabel = adv ? (adv.label || adv.category || '') : '';
          const advAmt = (adv && Number(adv.amount || 0) > 0) ? Number(adv.amount).toLocaleString() : '';

          return `
          <tr>
            <td class="col-no">${lineNo}</td>
            <td class="col-center">${applyDate}</td>
            <td class="col-center col-ord">${orderNo}</td>
            <td class="col-left col-app">${applicant}</td>
            <td class="col-center">${police}</td>
            <td class="col-left">${itemText}</td>
            <td class="col-right num">${feeText}</td>
            <td class="col-center">${completeDate}</td>
            <td class="col-left">${advLabel}</td>
            <td class="col-right num">${advAmt}</td>
            <td class="col-left"></td>
          </tr>`;
        } else {
          // 案件間の空行または30行目までの余白空行
          return `
          <tr class="${r.type === 'blank' ? 'blank-row' : 'pad-row'}">
            <td class="col-no">${lineNo}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>`;
        }
      }).join('');

      nissanDetailPagesHTML += `
<!-- 横向き明細書 ページ ${pageNum} (No. ${pageNum}) -->
<div class="page page-landscape">
  <div class="landscape-header">
    <div class="landscape-header-left">
      <div class="landscape-recipient"><span>${clientName}</span></div>
      <div class="landscape-subtext">下記のとおりご請求申し上げます。</div>
      <div class="landscape-month">令和 ${reiwaYear} 年 ${month || issueM} 月分</div>
    </div>

    <div class="landscape-header-center">
      <div class="nissan-summary-box">
        <table>
          <thead>
            <tr>
              <th style="width:25%;">報酬料（税抜）</th>
              <th style="width:23%;">消費税(${effectiveTaxRate}%)</th>
              <th style="width:25%;">立替金合計</th>
              <th style="width:27%;">ご請求額</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="num">${effectiveFeeSubtotal.toLocaleString()}</td>
              <td class="num">${effectiveTax.toLocaleString()}</td>
              <td class="num">${effectiveAdvanceTotal.toLocaleString()}</td>
              <td class="num" style="font-size:12.5px; font-weight:bold;">${invoiceGrandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="landscape-header-right">
      <div class="office-box-inner">
        <div class="office-text">
          <div class="office-title">${office.name || '行政書士法人フェリス'}</div>
          <div>行政書士　${office.representative || '日栄 政敏'}</div>
          <div>${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
          <div>TEL ${office.tel || '0586-50-2896'} / FAX ${office.fax || '0568-26-3714'}</div>
        </div>
      </div>
      <div class="page-no-indicator">No. ${pageNum}</div>
    </div>
  </div>

  <table class="nissan-table">
    <thead>
      <tr>
        <th style="width:2.8%;">No.</th>
        <th style="width:5.8%;">申請日</th>
        <th style="width:9.2%;">受注No.</th>
        <th style="width:16%;">申請者名</th>
        <th style="width:9.8%;">管　轄</th>
        <th style="width:16.8%;">項　目</th>
        <th style="width:8%;">報酬料（税抜）</th>
        <th style="width:5.8%;">完了日</th>
        <th style="width:10.5%;">立替金 名目</th>
        <th style="width:7.8%;">立替金額</th>
        <th style="width:7.5%;">備考</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
      <tr class="subtotal-row">
        <td colspan="6" class="col-center" style="letter-spacing:4px;">小　　計</td>
        <td class="col-right num">${pageFeeSubtotal > 0 ? pageFeeSubtotal.toLocaleString() : '0'}</td>
        <td></td>
        <td></td>
        <td class="col-right num">${pageAdvSubtotal > 0 ? pageAdvSubtotal.toLocaleString() : '0'}</td>
        <td class="col-right num">0</td>
      </tr>
    </tbody>
  </table>

  <div class="landscape-footer">
    <span>※報酬料は税抜表示です。全頁合計 報酬税抜: ¥${effectiveFeeSubtotal.toLocaleString()} ＋ 消費税(${effectiveTaxRate}%): ¥${effectiveTax.toLocaleString()} ＝ 報酬税込: ¥${(effectiveFeeSubtotal + effectiveTax).toLocaleString()}</span>
    <span>${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo} (${pageNum}/${totalLandscapePages})</span>
  </div>
</div>
`;
    });

    // OSS明細別紙（OSS作成案件がある場合のみA4縦で出力）
    let ossSheetHTML = '';
    if (sortedOssCases.length > 0) {
      const OSS_ROWS_PER_PAGE = 30;
      const ossRows = [];
      for (let i = 0; i < OSS_ROWS_PER_PAGE; i++) {
        const oc = sortedOssCases[i];
        const lineNo = i + 1;
        if (oc) {
          const ocDate = formatDateMMDD(oc.completedAt || oc.applyDate || oc.createdAt || '');
          const ocOrder = oc.orderNo || oc.caseNo || '';
          const ocName = oc.applicantName || oc.carName || oc.title || '';
          ossRows.push(`
          <tr>
            <td class="col-center">${lineNo}</td>
            <td class="col-center">${ocDate}</td>
            <td class="col-center col-ord">${ocOrder}</td>
            <td class="col-left"><strong>${ocName}</strong></td>
            <td></td>
          </tr>`);
        } else {
          ossRows.push(`
          <tr>
            <td class="col-center">${lineNo}</td>
            <td></td><td></td><td></td><td></td>
          </tr>`);
        }
      }

      ossSheetHTML = `
<!-- PAGE: OSS所在図・配置図作成明細 (A4縦) -->
<div class="page page-portrait page-oss" id="nissanOssPage">
  <div class="oss-title">ＯＳＳ所在図・配置図作成明細</div>
  
  <div class="oss-meta">
    <div style="font-weight:bold; font-size:16px;">${clientName}</div>
    <div style="margin-top:6px; font-size:14px;">令和 ${reiwaYear} 年 ${month || issueM} 月分</div>
  </div>

  <table class="oss-table">
    <thead>
      <tr>
        <th style="width:7%;">No.</th>
        <th style="width:14%;">日　付</th>
        <th style="width:25%;">受注No.</th>
        <th style="width:40%;">申　請　者　名</th>
        <th style="width:14%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      ${ossRows.join('')}
    </tbody>
  </table>

  <div style="margin-top:auto; display:flex; justify-content:space-between; font-size:11px; color:#666; padding-top:10px;">
    <span>車庫証明OSS所在図・配置図作成分（単価: 税抜¥3,000 / 税込¥3,300）</span>
    <span>${office.name || '行政書士法人フェリス'} | 請求書番号: ${invoiceNo}</span>
  </div>
</div>
`;
    }

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${clientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page { margin: 0; }
  @page portrait-sheet { size: A4 portrait; margin: 0; }
  @page landscape-sheet { size: A4 landscape; margin: 0; }

  body {
    font-family: 'Shippori Mincho', 'Yu Mincho', serif;
    color: #000;
    background: #cbd5e1;
    padding: 20px;
  }

  .no-print-bar {
    max-width: 297mm;
    margin: 0 auto 15px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    padding: 7px 15px;
    font-size: 13px;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.12);
  }
  .btn-all { background: #ea580c; color: #fff; }
  .btn-all:hover { background: #c2410c; }
  .btn-sec { background: #2563eb; color: #fff; }
  .btn-sec:hover { background: #1d4ed8; }
  .btn-oss { background: #059669; color: #fff; }
  .btn-oss:hover { background: #047857; }
  .btn-close { background: #64748b; color: #fff; }
  .btn-close:hover { background: #475569; }

  /* Page base styles */
  .page {
    background: #fff;
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    position: relative;
    box-sizing: border-box;
  }

  .page-portrait {
    page: portrait-sheet;
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    margin: 0 auto 20px;
    padding: 24mm 24mm 18mm;
    display: flex;
    flex-direction: column;
  }

  .page-landscape {
    page: landscape-sheet;
    width: 297mm;
    min-height: 210mm;
    height: 210mm;
    margin: 0 auto 20px;
    padding: 7mm 11mm 5mm;
    display: flex;
    flex-direction: column;
  }

  /* Print Media Rules */
  @media print {
    body {
      background: #fff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .no-print { display: none !important; }
    
    .page-portrait {
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 20mm 22mm 15mm !important;
      box-shadow: none !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: hidden !important;
    }
    .page-landscape {
      width: 297mm !important;
      height: 210mm !important;
      margin: 0 !important;
      padding: 6mm 10mm 5mm !important;
      box-shadow: none !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: hidden !important;
    }
    .page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    body.print-cover-only .page-landscape,
    body.print-cover-only .page-oss {
      display: none !important;
    }
    body.print-detail-only .page-portrait {
      display: none !important;
    }
    body.print-oss-only .page-portrait:not(.page-oss),
    body.print-oss-only .page-landscape {
      display: none !important;
    }
  }

  /* Typography and alignments */
  .num { font-family: 'Noto Sans JP', sans-serif; font-feature-settings: 'tnum'; }
  .col-center { text-align: center; }
  .col-left { text-align: left; }
  .col-right { text-align: right; }
  .col-ord { font-family: 'Noto Sans JP', sans-serif; font-size: 9.5px; letter-spacing: -0.2px; }
  .col-app { font-weight: normal; }

  /* Cover Page (A4縦) */
  .cover-title {
    text-align: center;
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 12px;
    margin-bottom: 25px;
    padding-bottom: 6px;
  }
  .cover-recipient {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 25px;
  }
  .cover-recipient span {
    border-bottom: 1.5px solid #000;
    padding-bottom: 4px;
    display: inline-block;
  }
  .cover-claim-box {
    border: 2px solid #000;
    padding: 13px 22px;
    margin-bottom: 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
  }
  .cover-claim-label {
    font-size: 19px;
    font-weight: bold;
    letter-spacing: 8px;
  }
  .cover-claim-amount {
    font-size: 24px;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .cover-summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  .cover-summary-table th, .cover-summary-table td {
    border: 1px solid #000;
    padding: 7px 14px;
    font-size: 13.5px;
    line-height: 1.4;
  }
  .cover-summary-table th {
    background: #fff;
    text-align: center;
    font-weight: bold;
  }
  .cover-summary-table tr.total-row {
    font-weight: bold;
    font-size: 15px;
  }
  .cover-prose {
    font-size: 13.5px;
    margin: 10px 0 6px;
  }
  .cover-date {
    font-size: 13.5px;
    margin-bottom: 6px;
  }
  .cover-duedate {
    font-size: 13px;
    font-weight: bold;
    color: #b91c1c;
    margin-bottom: 20px;
  }
  .cover-footer-grid {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    font-size: 12.5px;
    line-height: 1.65;
  }
  .cover-bank-area {
    width: 48%;
  }
  .cover-bank-title {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .cover-bank-note {
    font-size: 11px;
    color: #444;
    margin-top: 5px;
  }
  .cover-office-area {
    width: 48%;
    text-align: right;
    position: relative;
    padding-right: 5px;
  }
  .cover-office-name {
    font-weight: bold;
    font-size: 14.5px;
    margin: 2px 0;
  }

  /* Landscape Detail Page Header (A4横) */
  .landscape-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 5px;
  }
  .landscape-header-left {
    width: 34%;
  }
  .landscape-recipient {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 3px;
  }
  .landscape-recipient span {
    border-bottom: 1.5px solid #000;
    padding-bottom: 2px;
    display: inline-block;
  }
  .landscape-subtext {
    font-size: 11px;
    margin-bottom: 4px;
  }
  .landscape-month {
    font-size: 12.5px;
    font-weight: bold;
  }
  .landscape-header-center {
    width: 34%;
    display: flex;
    justify-content: center;
  }
  .nissan-summary-box table {
    border-collapse: collapse;
    width: 320px;
  }
  .nissan-summary-box th, .nissan-summary-box td {
    border: 1px solid #000;
    text-align: center;
    padding: 2px 5px;
    font-size: 10px;
    line-height: 1.25;
  }
  .nissan-summary-box th {
    background: #fff;
    font-weight: bold;
  }
  .nissan-summary-box td {
    font-weight: bold;
    font-size: 11.5px;
    text-align: right;
  }
  .landscape-header-right {
    width: 32%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .office-box-inner {
    display: flex;
    align-items: center;
    text-align: right;
    font-size: 10px;
    line-height: 1.35;
  }
  .office-title {
    font-weight: bold;
    font-size: 11.5px;
  }
  .page-no-indicator {
    font-size: 12px;
    font-weight: bold;
    margin-top: 2px;
    letter-spacing: 1px;
  }

  /* 30-Row Table */
  table.nissan-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    table-layout: fixed;
    margin-bottom: 0;
  }
  table.nissan-table th, table.nissan-table td {
    border: 1px solid #000;
    padding: 0 4px;
    height: 4.6mm;
    line-height: 4.6mm;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    vertical-align: middle;
  }
  table.nissan-table th {
    background: #fff;
    text-align: center;
    font-weight: bold;
    font-size: 10.5px;
    height: 5.2mm;
    line-height: 5.2mm;
  }
  table.nissan-table td.col-no {
    text-align: center;
    font-weight: normal;
    font-size: 9px;
  }
  table.nissan-table tr.blank-row td,
  table.nissan-table tr.pad-row td {
    height: 4.6mm;
    line-height: 4.6mm;
    background: #fff;
  }
  table.nissan-table tr.subtotal-row td {
    font-weight: bold;
    font-size: 10.5px;
    height: 5.2mm;
    line-height: 5.2mm;
    background: #fff;
  }
  .landscape-footer {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #555;
    margin-top: auto;
    padding-top: 3px;
  }

  /* OSS Sheet Styling (A4縦) */
  .oss-title {
    text-align: center;
    font-size: 21px;
    font-weight: bold;
    letter-spacing: 6px;
    margin-bottom: 24px;
  }
  .oss-meta {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 18px;
  }
  table.oss-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table.oss-table th, table.oss-table td {
    border: 1px solid #000;
    padding: 5px 8px;
    line-height: 1.35;
    height: 6.8mm;
  }
  table.oss-table th {
    background: #fff;
    text-align: center;
    font-weight: bold;
  }
</style>
</head>
<body>

<div class="no-print-bar no-print">
  <button class="btn btn-all" onclick="NissanPrint.printAll()">🖨️ 全ページ一括印刷</button>
  <button class="btn btn-sec" onclick="NissanPrint.printSection('cover')">📄 表紙のみ印刷 (A4縦)</button>
  <button class="btn btn-sec" onclick="NissanPrint.printSection('detail')">📋 明細書のみ印刷 (A4横)</button>
  ${sortedOssCases.length > 0 ? `<button class="btn btn-oss" onclick="NissanPrint.printSection('oss')">🗺️ OSS明細のみ印刷 (A4縦)</button>` : ''}
  <button class="btn btn-close" onclick="window.close()">✕ 閉じる</button>
</div>

<!-- PAGE 1: 表紙請求書 (A4縦) -->
<div class="page page-portrait" id="nissanCoverPage">
  <div class="cover-title">${docType === 'estimate' ? '御 見 積 書' : '請　求　書'}</div>
  
  <div class="cover-recipient">
    <span>${clientName}</span>
  </div>

  <div class="cover-claim-box">
    <span class="cover-claim-label">${docType === 'estimate' ? '御 見 積 額' : 'ご 請 求 額'}</span>
    <span class="cover-claim-amount num">¥ ${invoiceGrandTotal.toLocaleString()}</span>
  </div>

  <table class="cover-summary-table">
    <thead>
      <tr>
        <th style="width:45%;">摘　　要</th>
        <th style="width:35%;">金　　額</th>
        <th style="width:20%;">備　考</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>別紙明細報酬</td>
        <td class="col-right num">¥ ${effectiveFeeSubtotal.toLocaleString()}</td>
        <td class="col-center">（税抜）</td>
      </tr>
      <tr>
        <td>消費税等（${effectiveTaxRate}%）</td>
        <td class="col-right num">¥ ${effectiveTax.toLocaleString()}</td>
        <td class="col-center"></td>
      </tr>
      <tr>
        <td>立　替　金</td>
        <td class="col-right num">¥ ${effectiveAdvanceTotal.toLocaleString()}</td>
        <td class="col-center">（実費）</td>
      </tr>
      <tr class="total-row">
        <td class="col-center">合　　計</td>
        <td class="col-right num">¥ ${invoiceGrandTotal.toLocaleString()}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="cover-prose">上記のとおりご請求申し上げます。</div>
  <div class="cover-date">令和 ${reiwaYear} 年 ${issueM || ''} 月 ${issueD || ''} 日</div>
  ${dueDate && docType !== 'estimate' ? `
  <div class="cover-duedate">
    お支払期日：${dueDate.replace(/-/g, '/')}（翌月25日）
  </div>` : '<div style="margin-bottom: 20px;"></div>'}

  <div class="cover-footer-grid">
    <div class="cover-bank-area">
      <div class="cover-bank-title">≪振込先≫</div>
      <div>${office.bankName || '三菱UFJ銀行'}　${office.bankBranch || '西春支店'}</div>
      <div>(${office.accountType || '普通'}) ${office.accountNumber || '0129129'}</div>
      <div>口座名義：${office.accountHolder || '行政書士法人フェリス'}</div>
      <div class="cover-bank-note">※恐れ入りますが、振込手数料はお客様の負担でお願いいたします</div>
    </div>
    <div class="cover-office-area">
      <div>${office.assocName || '愛知県行政書士会会員'}</div>
      <div>事業所所在地　${office.address || '北名古屋市六ツ師道毛74番地1'}</div>
      <div class="cover-office-name">事務所の名称　${office.name || '行政書士法人フェリス'}</div>
      <div>行　政　書　士　${office.representative || '代表行政書士 日栄 政敏'}</div>
      <div>TEL　${office.tel || '0586-50-2896'}</div>
      <div>FAX　${office.fax || '0568-26-3714'}</div>
      ${office.registrationNumber ? `<div style="font-size:11px;">登録番号: ${office.registrationNumber}</div>` : ''}
    </div>
  </div>
</div>

<!-- PAGE 2以降: 納品・請求明細書 (A4横・1ページ30行台帳) -->
${nissanDetailPagesHTML}

<!-- PAGE LAST: OSS所在図・配置図作成明細 (A4縦、存在時のみ) -->
${ossSheetHTML}

<script>
window.NissanPrint = {
  printAll() {
    document.body.className = '';
    window.print();
  },
  printSection(sec) {
    document.body.className = 'print-' + sec + '-only';
    window.print();
    setTimeout(() => {
      document.body.className = '';
    }, 1000);
  }
};
</script>

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
      ${dueDate && docType !== 'estimate' ? `<div style="color:#e11d48; margin-top:4px; font-weight:bold;">お支払期日：${dueDate.replace(/-/g, '/')}（翌月25日）</div>` : ''}
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
        <td><strong>${c.title}</strong>${c.isUsedCar ? ' <span style="font-size:11px; background:#fef3c7; color:#b45309; padding:1px 5px; border-radius:3px; font-weight:bold;">(中古)</span>' : ''}</td>
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
            <input type="text" name="officeName" value="${info.name}" required placeholder="行政書士法人フェリス">
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
      name: form.officeName.value.trim(),
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
