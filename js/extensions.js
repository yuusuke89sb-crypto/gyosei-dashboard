/**
 * 拡張機能モジュール
 * - 入金管理
 * - 対応履歴
 * - グローバル検索
 * - 案件テンプレート
 * - 書類チェックリスト
 * - 期限リマインダー
 * - 年間収支レポート
 * - 紹介元分析
 */

// ============================================================
// 1. 入金管理
// ============================================================
const Payments = {
  STORAGE_KEY: 'gyosei_payments',

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  // 請求書発行時に請求レコードを作成
  createFromInvoice(invoiceNo, clientId, amount, dueDate) {
    const payments = this.getAll();
    payments.push({
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      invoiceNo,
      clientId,
      amount,
      dueDate,
      status: 'unpaid', // unpaid, paid
      paidAt: null,
      paidAmount: 0,
      method: '',
      createdAt: new Date().toISOString(),
    });
    this.save(payments);
  },

  markPaid(id, method) {
    const payments = this.getAll();
    const p = payments.find(x => x.id === id);
    if (!p) return;
    p.status = 'paid';
    p.paidAt = new Date().toISOString();
    p.paidAmount = p.amount;
    p.method = method || '振込';
    this.save(payments);

    // 入金仕訳を自動生成
    const client = Store.getClient(p.clientId);
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    journals.push({
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().slice(0, 10),
      debit: '普通預金',
      credit: '売掛金',
      amount: p.amount,
      description: `入金 ${p.invoiceNo}${client ? ' / ' + client.name : ''}`,
      auto: true,
      paymentId: p.id,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));
  },

  getByClient(clientId) {
    return this.getAll().filter(p => p.clientId == clientId);
  },

  getUnpaid() {
    return this.getAll().filter(p => p.status === 'unpaid');
  },

  showPaymentList() {
    const payments = this.getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'paymentModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('paymentModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>💴 入金管理</h2>
          <button class="modal-close" onclick="document.getElementById('paymentModal').remove()">✕</button>
        </div>
        <div class="payment-tabs">
          <button class="tab-btn active" onclick="Payments.filterTab(this,'all')">全て (${payments.length})</button>
          <button class="tab-btn" onclick="Payments.filterTab(this,'unpaid')">未入金 (${payments.filter(p => p.status === 'unpaid').length})</button>
          <button class="tab-btn" onclick="Payments.filterTab(this,'paid')">入金済 (${payments.filter(p => p.status === 'paid').length})</button>
        </div>
        <div class="mini-case-list" id="paymentListBody">
          ${payments.length === 0 ? '<p class="empty-message">請求データがありません</p>' :
        payments.map(p => {
          const client = Store.getClient(p.clientId);
          const overdue = p.status === 'unpaid' && p.dueDate && new Date(p.dueDate) < new Date();
          return `
              <div class="mini-case-item payment-item" data-status="${p.status}">
                <span class="status-badge ${p.status === 'paid' ? 'status-done' : overdue ? 'status-overdue' : 'status-received'}">
                  ${p.status === 'paid' ? '✅ 入金済' : overdue ? '⚠️ 期限超過' : '🔵 未入金'}
                </span>
                <span class="mini-case-title">${p.invoiceNo}</span>
                <span style="color:var(--text-secondary)">${client ? client.name : ''}</span>
                <span class="mini-case-fee">¥${p.amount.toLocaleString()}</span>
                ${p.status === 'unpaid' ? `<button class="btn btn-small btn-primary" onclick="event.stopPropagation(); Payments.confirmPaid('${p.id}')">入金</button>` : `<span style="font-size:0.75rem;color:var(--text-muted)">${p.paidAt ? p.paidAt.slice(0, 10) : ''}</span>`}
              </div>`;
        }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  filterTab(btn, filter) {
    btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.payment-item').forEach(el => {
      if (filter === 'all') el.style.display = '';
      else el.style.display = el.dataset.status === filter ? '' : 'none';
    });
  },

  confirmPaid(id) {
    if (confirm('入金を確認しますか？（普通預金への振込として記録します）')) {
      this.markPaid(id, '振込');
      document.getElementById('paymentModal').remove();
      this.showPaymentList();
      App.showToast('入金を記録しました');
    }
  },
};

// ============================================================
// 2. 対応履歴 (Activity Log)
// ============================================================
const ActivityLog = {
  STORAGE_KEY: 'gyosei_activity_log',

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  add(type, refId, text) {
    const logs = this.getAll();
    logs.unshift({
      id: 'log_' + Date.now(),
      type, // 'client' or 'case'
      refId,
      text,
      timestamp: new Date().toISOString(),
    });
    this.save(logs);
  },

  getByRef(type, refId) {
    return this.getAll().filter(l => l.type === type && l.refId == refId);
  },

  renderWidget(type, refId) {
    const logs = this.getByRef(type, refId);
    return `
      <div class="activity-log-widget">
        <h4>📝 対応履歴</h4>
        <div class="activity-add-row">
          <input type="text" id="activityInput_${refId}" placeholder="例：電話にて書類の確認をした" style="flex:1">
          <button class="btn btn-small btn-primary" onclick="ActivityLog.addFromWidget('${type}','${refId}')">追加</button>
        </div>
        <div class="activity-list" id="activityList_${refId}">
          ${logs.length === 0 ? '<p class="empty-message" style="font-size:0.8rem;padding:8px 0">履歴なし</p>' :
        logs.slice(0, 10).map(l => `
            <div class="activity-item">
              <span class="activity-time">${l.timestamp.slice(0, 16).replace('T', ' ')}</span>
              <span class="activity-text">${l.text}</span>
            </div>
          `).join('')}
          ${logs.length > 10 ? `<p style="font-size:0.75rem;color:var(--text-muted)">... 他${logs.length - 10}件</p>` : ''}
        </div>
      </div>
    `;
  },

  addFromWidget(type, refId) {
    const input = document.getElementById(`activityInput_${refId}`);
    const text = input.value.trim();
    if (!text) return;
    this.add(type, refId, text);
    input.value = '';
    // リフレッシュ
    const listEl = document.getElementById(`activityList_${refId}`);
    if (listEl) {
      const logs = this.getByRef(type, refId);
      listEl.innerHTML = logs.slice(0, 10).map(l => `
        <div class="activity-item">
          <span class="activity-time">${l.timestamp.slice(0, 16).replace('T', ' ')}</span>
          <span class="activity-text">${l.text}</span>
        </div>
      `).join('');
    }
    App.showToast('履歴を追加しました');
  },
};

// ============================================================
// 3. グローバル検索
// ============================================================
const GlobalSearch = {
  show() {
    const existing = document.getElementById('globalSearchModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'globalSearchModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('globalSearchModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔍 検索</h2>
          <button class="modal-close" onclick="document.getElementById('globalSearchModal').remove()">✕</button>
        </div>
        <input type="text" id="globalSearchInput" class="search-input" placeholder="顧客名・案件名で検索..." autofocus
          oninput="GlobalSearch.onSearch(this.value)" style="width:100%;margin-bottom:12px">
        <div id="globalSearchResults" class="mini-case-list" style="max-height:400px;overflow-y:auto">
          <p class="empty-message">キーワードを入力してください</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
  },

  onSearch(q) {
    q = q.trim().toLowerCase();
    const results = document.getElementById('globalSearchResults');
    if (!q) { results.innerHTML = '<p class="empty-message">キーワードを入力してください</p>'; return; }

    let html = '';
    const clients = Store.getClients().filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.nameKana || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.companyName || '').toLowerCase().includes(q)
    );
    const cases = Store.getCases().filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.memo || '').toLowerCase().includes(q)
    );

    if (clients.length > 0) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding:8px 0">👥 顧客</div>';
      clients.forEach(c => {
        html += `<div class="mini-case-item" onclick="document.getElementById('globalSearchModal').remove(); App.navigate('clients'); setTimeout(()=>Clients.showDetail('${c.id}'),100)" style="cursor:pointer">
          <span class="mini-case-title">${c.name}</span>
          <span style="color:var(--text-secondary);font-size:0.8rem">${c.phone || ''} ${c.email || ''}</span>
        </div>`;
      });
    }
    if (cases.length > 0) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding:8px 0">📋 案件</div>';
      cases.forEach(c => {
        const client = Store.getClient(c.clientId);
        html += `<div class="mini-case-item" onclick="document.getElementById('globalSearchModal').remove(); App.navigate('cases'); setTimeout(()=>Cases.showEditModal('${c.id}'),100)" style="cursor:pointer">
          <span class="mini-case-title">${c.title}</span>
          <span style="color:var(--text-secondary);font-size:0.8rem">${client ? client.name : ''}</span>
        </div>`;
      });
    }
    if (!html) html = '<p class="empty-message">見つかりません</p>';
    results.innerHTML = html;
  },
};

// ============================================================
// 4. 案件テンプレート
// ============================================================
const CaseTemplates = {
  TEMPLATES: {
    garage: {
      fee: 8000,
      memo: '【車庫証明】\n\n📋 お客様からの受領書類\n□ 車検証コピー（or 車両情報）\n□ 住民票 or 印鑑証明書\n□ 駐車場の契約書コピー（月極の場合）\n□ 委任状（署名済み）\n\n📝 作成書類\n□ 自動車保管場所証明申請書\n□ 保管場所標章交付申請書\n□ 保管場所の所在図・配置図\n□ 保管場所使用権原疎明書面（自認書）or 使用承諾証明書\n\n🏢 申請・受取\n□ 管轄警察署の確認\n□ 申請書類の最終チェック\n□ 警察署に申請（証紙代 ¥2,100〜¥2,200）\n□ 標章代（¥500〜¥610）\n□ 交付受取（3〜7営業日後）\n□ お客様への納品',
    },
    inheritance: {
      fee: 50000,
      memo: '【相続手続き】\n\n📋 基本情報の確認\n□ 被相続人の死亡日確認\n□ 相続人の確定\n\n📄 戸籍収集\n□ 被相続人の出生〜死亡までの戸籍\n□ 相続人全員の現在戸籍\n□ 相続人全員の住民票\n\n💰 財産調査\n□ 不動産（登記簿謄本の取得）\n□ 預貯金（各銀行への残高証明請求）\n□ 有価証券\n□ 生命保険\n□ 自動車（車検証確認）\n□ 負債の確認\n\n📝 書類作成\n□ 相続関係説明図\n□ 財産目録\n□ 遺産分割協議書\n\n✍️ 署名捺印\n□ 相続人への協議書送付\n□ 全員の署名捺印回収\n\n🏦 名義変更手続き\n□ 不動産（司法書士引継ぎ or 自分で対応）\n□ 預貯金\n□ 自動車',
    },
    mahjong: {
      fee: 50000,
      memo: '【麻雀関連】\n□ 営業許可申請書類準備\n□ 店舗図面作成\n□ 消防法確認\n□ 風営法関連確認\n□ 管轄警察署へ申請\n□ 許可証受取',
    },
    construction: {
      fee: 150000,
      memo: '【建設業許可】\n□ 経営業務管理責任者の確認\n□ 専任技術者の確認\n□ 財産的基礎の確認\n□ 決算変届（直前3年分）\n□ 許可申請書作成\n□ 都道府県庁へ申請',
    },
    farmland: {
      fee: 80000,
      memo: '【農地転用】\n□ 農地の現況確認\n□ 土地利用計画図作成\n□ 農業委員会事前相談\n□ 転用許可申請書作成\n□ 各添付書類収集\n□ 農業委員会へ提出',
    },
    liquor: {
      fee: 150000,
      memo: '【酒類販売】\n□ 免許要件の確認\n□ 酒類販売場所の確認\n□ 申請書類作成\n□ 事業計画書作成\n□ 所轄税務署へ申請\n□ 免許交付',
    },
    visa: {
      fee: 100000,
      memo: '【在留資格】\n□ 在留資格の種類確認\n□ 必要書類の確認・収集\n□ 申請書類作成\n□ 理由書作成\n□ 入国管理局へ申請\n□ 結果受取',
    },
    other: {
      fee: 0,
      memo: '',
    },
  },

  _lastAppliedCategory: null,

  applyTemplate(category) {
    const tmpl = this.TEMPLATES[category];
    if (!tmpl) return;
    const feeEl = document.getElementById('csf_fee');
    const memoEl = document.getElementById('csf_memo');

    // 現在のメモ・報酬が別テンプレートの内容かどうかを判定
    const currentMemo = memoEl ? memoEl.value : '';
    const currentFee = feeEl ? feeEl.value : '';
    const isTemplateMemo = !currentMemo || Object.values(this.TEMPLATES).some(t => t.memo === currentMemo);
    const isTemplateFee = !currentFee || Object.values(this.TEMPLATES).some(t => String(t.fee) === currentFee);

    // テンプレート由来の値なら新カテゴリのテンプレートで上書き
    if (feeEl && isTemplateFee && tmpl.fee) feeEl.value = tmpl.fee;
    if (memoEl && isTemplateMemo) memoEl.value = tmpl.memo || '';

    this._lastAppliedCategory = category;

    // 相続の場合は死亡日フィールドを表示
    const deathDateGroup = document.getElementById('csf_deathDate_group');
    if (deathDateGroup) {
      deathDateGroup.style.display = category === 'inheritance' ? '' : 'none';
    }
  },
};

// ============================================================
// 4-B. 相続案件 期限自動計算アラート
// ============================================================
const InheritanceDeadlines = {
  // 法定期限の定義
  DEADLINES: [
    { key: 'souzokuHouki',      label: '相続放棄',         months: 3,  years: 0, severity: 'critical', note: '相続を知った日から3ヶ月' },
    { key: 'junKakuteiShinkoku', label: '準確定申告',       months: 4,  years: 0, severity: 'warning',  note: '死亡日から4ヶ月（該当者のみ）' },
    { key: 'souzokuZei',        label: '相続税申告・納付', months: 10, years: 0, severity: 'critical', note: '死亡日から10ヶ月' },
    { key: 'iryubun',           label: '遺留分侵害額請求', months: 0,  years: 1, severity: 'warning',  note: '知った日から1年（該当者のみ）' },
    { key: 'toukiGimu',         label: '相続登記義務化',   months: 0,  years: 3, severity: 'important', note: '知った日から3年（2024年4月〜）' },
  ],

  // 死亡日から各期限日を計算
  calculateDeadlines(deathDateStr) {
    if (!deathDateStr) return [];
    const d = new Date(deathDateStr);
    if (isNaN(d.getTime())) return [];
    return this.DEADLINES.map(def => {
      const dl = new Date(d);
      if (def.months) dl.setMonth(dl.getMonth() + def.months);
      if (def.years) dl.setFullYear(dl.getFullYear() + def.years);
      const today = new Date(); today.setHours(0,0,0,0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      return { ...def, date: dl.toISOString().slice(0,10), diffDays };
    });
  },

  // 案件モーダル内に期限一覧を表示
  renderDeadlinePanel(deathDateStr) {
    const deadlines = this.calculateDeadlines(deathDateStr);
    if (deadlines.length === 0) return '';

    return `
      <div class="checklist-widget" style="margin-top:12px">
        <h4 style="margin:0 0 8px;font-size:0.9rem">⏰ 相続期限アラート</h4>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
          被相続人死亡日: ${deathDateStr}
        </div>
        ${deadlines.map(dl => {
          const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
          let statusClass = '';
          let statusLabel = '';
          if (dl.diffDays < 0) {
            statusClass = 'color:#ef4444;font-weight:700';
            statusLabel = `${Math.abs(dl.diffDays)}日超過`;
          } else if (dl.diffDays <= 30) {
            statusClass = 'color:#f59e0b;font-weight:700';
            statusLabel = `あと${dl.diffDays}日`;
          } else {
            statusClass = 'color:var(--text-secondary)';
            statusLabel = `あと${dl.diffDays}日`;
          }
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:0.82rem">
              <span>${icon}</span>
              <span style="flex:1">${dl.label}</span>
              <span style="min-width:80px">${dl.date}</span>
              <span style="${statusClass};min-width:70px;text-align:right">${statusLabel}</span>
            </div>`;
        }).join('')}
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">
          ※ 相続放棄・遺留分・登記義務は「知った日」が起算日（ここでは死亡日で仮計算）
        </div>
      </div>`;
  },

  // ダッシュボード用ウィジェット: すべての相続案件の期限を一覧表示
  renderDashboardWidget() {
    const cases = Store.getCases().filter(c => c.category === 'inheritance' && c.status !== 'done' && c.deathDate);
    if (cases.length === 0) return '';

    let alertItems = [];
    cases.forEach(c => {
      const deadlines = this.calculateDeadlines(c.deathDate);
      deadlines.forEach(dl => {
        if (dl.diffDays <= 90) { // 90日以内の期限のみ表示
          alertItems.push({ ...dl, caseTitle: c.title, caseId: c.id });
        }
      });
    });
    alertItems.sort((a, b) => a.diffDays - b.diffDays);

    if (alertItems.length === 0) return '';

    return `
      <div class="dashboard-section">
        <h2 class="section-title">⏰ 相続期限アラート</h2>
        <div class="urgent-list">
          ${alertItems.map(dl => {
            const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
            let urgencyClass = dl.diffDays < 0 ? 'overdue' : dl.diffDays <= 30 ? 'warning' : '';
            let urgencyLabel = dl.diffDays < 0 ? `${Math.abs(dl.diffDays)}日超過` : `あと${dl.diffDays}日`;
            return `
              <div class="urgent-item ${urgencyClass}" onclick="App.navigate('cases'); setTimeout(()=>Cases.showEditModal('${dl.caseId}'),100)">
                <div class="urgent-item-header">
                  <span class="urgent-badge badge-${urgencyClass || 'info'}">${icon} ${urgencyLabel}</span>
                  <span class="category-tag category-inheritance">📜 相続</span>
                </div>
                <div class="urgent-item-title">${dl.label}</div>
                <div class="urgent-item-client">${dl.caseTitle} ｜ 期限: ${dl.date}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },
};

// ============================================================
// 5. 書類チェックリスト（案件メモ内の □/■ をトグル）
// ============================================================
const DocChecklist = {
  toggle(caseId, lineIndex) {
    const c = Store.getCase(caseId);
    if (!c || !c.memo) return;
    const lines = c.memo.split('\n');
    if (lines[lineIndex]) {
      if (lines[lineIndex].startsWith('□')) {
        lines[lineIndex] = '■' + lines[lineIndex].slice(1);
      } else if (lines[lineIndex].startsWith('■')) {
        lines[lineIndex] = '□' + lines[lineIndex].slice(1);
      }
      Store.updateCase(caseId, { memo: lines.join('\n') });
    }
    // モーダル内のチェックリストだけを再描画（モーダルを閉じない）
    this.refreshInPlace(caseId);
  },

  // チェックリストウィジェットだけをその場で更新
  refreshInPlace(caseId) {
    const wrapper = document.querySelector('.checklist-widget');
    if (!wrapper) return;
    // 新しいチェックリストHTMLを生成して差し替え
    const newHtml = this.renderChecklist(caseId);
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newWidget = temp.querySelector('.checklist-widget');
    if (newWidget) {
      wrapper.replaceWith(newWidget);
    }
    // メモ欄も同期（モーダル内のtextareaがあれば更新）
    const memoEl = document.getElementById('csf_memo');
    const c = Store.getCase(caseId);
    if (memoEl && c) {
      memoEl.value = c.memo || '';
    }
  },

  renderChecklist(caseId) {
    const c = Store.getCase(caseId);
    if (!c || !c.memo) return '';
    const lines = c.memo.split('\n');
    const checkItems = lines.filter(l => l.startsWith('□') || l.startsWith('■'));
    if (checkItems.length === 0) return '';
    const done = lines.filter(l => l.startsWith('■')).length;
    const total = checkItems.length;
    const pct = Math.round((done / total) * 100);
    return `
      <div class="checklist-widget">
        <div class="checklist-progress">
          <div class="checklist-bar"><div class="checklist-fill" style="width:${pct}%"></div></div>
          <span class="checklist-count">${done}/${total}</span>
        </div>
        <div class="checklist-items">
          ${lines.map((l, i) => {
      if (l.startsWith('□')) return `<div class="checklist-item" onclick="DocChecklist.toggle('${caseId}',${i})"><span class="check-box">☐</span>${l.slice(1).trim()}</div>`;
      if (l.startsWith('■')) return `<div class="checklist-item done" onclick="DocChecklist.toggle('${caseId}',${i})"><span class="check-box">☑</span>${l.slice(1).trim()}</div>`;
      return '';
    }).join('')}
        </div>
      </div>
    `;
  },
};

// ============================================================
// 6. 期限リマインダー通知
// ============================================================
const Reminders = {
  init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    this.check();
    // 1時間ごとにチェック
    setInterval(() => this.check(), 60 * 60 * 1000);
  },

  check() {
    if (Notification.permission !== 'granted') return;
    const cases = Store.getCases();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 3);

    const lastNotified = localStorage.getItem('gyosei_last_reminder') || '';
    const todayStr = today.toISOString().slice(0, 10);
    if (lastNotified === todayStr) return; // 1日1回
    localStorage.setItem('gyosei_last_reminder', todayStr);

    const urgent = cases.filter(c => {
      if (c.status === 'done' || !c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl <= dayAfter;
    });

    if (urgent.length > 0) {
      new Notification('⚖️ 2号行政書士事務所', {
        body: `期限間近の案件が${urgent.length}件あります`,
        icon: '⚖️',
      });
    }
  },
};

// ============================================================
// 7. 年間収支レポート
// ============================================================
const AnnualReport = {
  show(year) {
    year = year || new Date().getFullYear();
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE = ['旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'];

    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      const monthJ = journals.filter(j => j.date && j.date.startsWith(ym));
      const income = monthJ.filter(j => INCOME.includes(j.credit)).reduce((s, j) => s + (j.amount || 0), 0);
      const expense = monthJ.filter(j => EXPENSE.includes(j.debit)).reduce((s, j) => s + (j.amount || 0), 0);
      monthlyData.push({ month: m, income, expense, profit: income - expense });
    }

    const totalIncome = monthlyData.reduce((s, d) => s + d.income, 0);
    const totalExpense = monthlyData.reduce((s, d) => s + d.expense, 0);
    const totalProfit = totalIncome - totalExpense;

    // 経費科目別集計
    const expByAccount = {};
    journals.filter(j => j.date && j.date.startsWith(String(year)) && EXPENSE.includes(j.debit))
      .forEach(j => { expByAccount[j.debit] = (expByAccount[j.debit] || 0) + j.amount; });

    const existing = document.getElementById('annualReportModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'annualReportModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('annualReportModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>📊 ${year}年 年間収支レポート</h2>
          <button class="modal-close" onclick="document.getElementById('annualReportModal').remove()">✕</button>
        </div>
        <div class="acc-controls" style="margin-bottom:16px">
          <div class="acc-period">
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('annualReportModal').remove(); AnnualReport.show(${year - 1})">◀ ${year - 1}年</button>
            <span style="font-weight:700;padding:0 12px">${year}年</span>
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('annualReportModal').remove(); AnnualReport.show(${year + 1})">${year + 1}年 ▶</button>
          </div>
        </div>
        <div class="acc-summary" style="margin-bottom:16px">
          <div class="acc-summary-card acc-income"><div class="acc-summary-label">年間収入</div><div class="acc-summary-amount">¥${totalIncome.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-expense"><div class="acc-summary-label">年間支出</div><div class="acc-summary-amount">¥${totalExpense.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-profit ${totalProfit >= 0 ? 'positive' : 'negative'}"><div class="acc-summary-label">年間利益</div><div class="acc-summary-amount">¥${totalProfit.toLocaleString()}</div></div>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>月</th><th>収入</th><th>支出</th><th>利益</th></tr></thead>
            <tbody>
              ${monthlyData.map(d => `
                <tr>
                  <td>${d.month}月</td>
                  <td class="amount-cell" style="color:var(--accent-green)">¥${d.income.toLocaleString()}</td>
                  <td class="amount-cell" style="color:var(--accent-orange)">¥${d.expense.toLocaleString()}</td>
                  <td class="amount-cell" style="color:${d.profit >= 0 ? 'var(--accent-blue)' : '#ef4444'}">¥${d.profit.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="font-weight:700;border-top:2px solid var(--border-color)">
                <td>合計</td>
                <td class="amount-cell" style="color:var(--accent-green)">¥${totalIncome.toLocaleString()}</td>
                <td class="amount-cell" style="color:var(--accent-orange)">¥${totalExpense.toLocaleString()}</td>
                <td class="amount-cell" style="color:${totalProfit >= 0 ? 'var(--accent-blue)' : '#ef4444'}">¥${totalProfit.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${Object.keys(expByAccount).length > 0 ? `
        <h3 style="margin:20px 0 8px;font-size:0.95rem">📋 経費科目別内訳</h3>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>勘定科目</th><th>金額</th><th>構成比</th></tr></thead>
            <tbody>
              ${Object.entries(expByAccount).sort((a, b) => b[1] - a[1]).map(([acct, amt]) => `
                <tr>
                  <td>${acct}</td>
                  <td class="amount-cell">¥${amt.toLocaleString()}</td>
                  <td class="amount-cell">${totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    `;
    document.body.appendChild(modal);
  },
};

// ============================================================
// 8. 紹介元分析
// ============================================================
const ReferralAnalysis = {
  show() {
    const clients = Store.getClients();
    const referralMap = {};
    clients.forEach(c => {
      const ref = c.referral || '直接・不明';
      referralMap[ref] = (referralMap[ref] || 0) + 1;
    });
    const sorted = Object.entries(referralMap).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...sorted.map(s => s[1]), 1);

    // 紹介元ごとの売上
    const refRevenue = {};
    clients.forEach(c => {
      const ref = c.referral || '直接・不明';
      const cases = Store.getCasesByClient(c.id);
      const revenue = cases.filter(cs => cs.status === 'done' && cs.fee).reduce((s, cs) => s + Number(cs.fee || 0), 0);
      refRevenue[ref] = (refRevenue[ref] || 0) + revenue;
    });

    const existing = document.getElementById('referralModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'referralModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('referralModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🤝 紹介元分析</h2>
          <button class="modal-close" onclick="document.getElementById('referralModal').remove()">✕</button>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>紹介元</th><th>顧客数</th><th>売上合計</th></tr></thead>
            <tbody>
              ${sorted.map(([ref, cnt]) => `
                <tr>
                  <td>${ref}</td>
                  <td class="amount-cell">${cnt}件</td>
                  <td class="amount-cell">¥${(refRevenue[ref] || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <h3 style="margin:20px 0 8px;font-size:0.95rem">📊 紹介元比率</h3>
        <div class="chart-bars">
          ${sorted.map(([ref, cnt]) => `
            <div class="chart-bar-row">
              <span class="chart-label">${ref}</span>
              <div class="chart-bar-track">
                <div class="chart-bar-fill" style="width:${(cnt / max) * 100}%;background:var(--accent-gold)"></div>
              </div>
              <span class="chart-value">${cnt}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
};

// ============================================================
// 9. 定型仕訳（毎月の固定経費をワンクリック一括登録）
//    固定費ツール（koteihi_data）と連携
// ============================================================
const RecurringExpenses = {
  STORAGE_KEY: 'gyosei_recurring',

  // 固定費ツールの勘定科目 → ダッシュボードの勘定科目マッピング
  CATEGORY_MAP: {
    'office': { debit: '家賃地代', note: '事務所関連' },
    'insurance': { debit: '保険料', note: '保険・年金' },
    'vehicle': { debit: '旅費交通費', note: '車両関連' },
    'business': { debit: '租税公課', note: '事業経費' },
    'living': { debit: '雑費', note: '生活費' },
    'tax': { debit: '租税公課', note: '税金・社会保険' },
    'other': { debit: '雑費', note: 'その他' },
  },

  // 固定費ツールの項目名 → 最適な勘定科目
  ITEM_DEBIT_MAP: {
    '家賃': '家賃地代',
    '電気代': '水道光熱費',
    'ガス代': '水道光熱費',
    '水道代': '水道光熱費',
    'インターネット': '通信費',
    '固定電話': '通信費',
    'FAX': '通信費',
    '国民健康保険': '保険料',
    '国民年金': '保険料',
    '生命保険': '保険料',
    '賠償責任保険': '保険料',
    '車両ローン': '雑費',
    '自動車保険': '保険料',
    '駐車場': '家賃地代',
    'ガソリン': '旅費交通費',
    '行政書士会費': '租税公課',
    '政治連盟': '租税公課',
    '会計ソフト': '支払手数料',
    'HP': '広告宣伝費',
    'ドメイン': '広告宣伝費',
    '名刺': '広告宣伝費',
    'チラシ': '広告宣伝費',
    '事務用品': '事務用品費',
    '消耗品': '消耗品費',
    '食費': '雑費',
    '日用品': '雑費',
    '携帯電話': '通信費',
    'サブスク': '雑費',
    '住民税': '租税公課',
    '所得税': '租税公課',
    '個人事業税': '租税公課',
    '消費税': '租税公課',
    '交際費': '接待交際費',
    '書籍': '新聞図書費',
    '研修': '研修費',
    '予備費': '雑費',
  },

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  defaults() {
    return [
      { id: 'r1', debit: '家賃地代', credit: '普通預金', amount: 0, description: '事務所家賃', enabled: true },
      { id: 'r2', debit: '通信費', credit: '普通預金', amount: 0, description: '電話・インターネット', enabled: true },
      { id: 'r3', debit: '水道光熱費', credit: '普通預金', amount: 0, description: '電気・水道', enabled: true },
      { id: 'r4', debit: '保険料', credit: '普通預金', amount: 0, description: '行政書士賠償責任保険', enabled: true },
      { id: 'r5', debit: '租税公課', credit: '普通預金', amount: 0, description: '行政書士会会費', enabled: true },
      { id: 'r6', debit: '支払手数料', credit: '普通預金', amount: 0, description: '銀行手数料等', enabled: true },
    ];
  },

  // 固定費ツールからデータを読み込み
  importFromKoteihi() {
    const raw = localStorage.getItem('koteihi_data');
    if (!raw) {
      App.showToast('固定費ツールのデータが見つかりません。同じブラウザで固定費ツールを開いてデータを入力してください。');
      return [];
    }

    try {
      const koteihiData = JSON.parse(raw);
      const items = [];
      let idx = 0;

      Object.keys(koteihiData).forEach(catId => {
        const catItems = koteihiData[catId];
        if (!Array.isArray(catItems)) return;

        catItems.forEach(item => {
          const amount = parseInt(String(item.amount).replace(/[¥,、\s]/g, ''), 10) || 0;
          if (amount <= 0) return; // 0円の項目はスキップ

          // 項目名から最適な勘定科目を判定
          let debit = (this.CATEGORY_MAP[catId] || { debit: '雑費' }).debit;
          for (const [keyword, account] of Object.entries(this.ITEM_DEBIT_MAP)) {
            if (item.name && item.name.includes(keyword)) {
              debit = account;
              break;
            }
          }

          items.push({
            id: 'k_' + catId + '_' + idx++,
            debit,
            credit: '普通預金',
            amount,
            description: item.name + (item.note ? ` (${item.note})` : ''),
            enabled: true,
            fromKoteihi: true,
          });
        });
      });

      return items;
    } catch (e) {
      App.showToast('固定費データの読み込みに失敗しました');
      return [];
    }
  },

  // 固定費ツールからインポートして定型仕訳に反映
  syncFromKoteihi() {
    const imported = this.importFromKoteihi();
    if (imported.length === 0) return;

    // 既存のkoteihi由来のアイテムを削除し、手動追加分は保持
    let existing = this.getAll();
    const manual = existing.filter(item => !item.fromKoteihi);

    const merged = [...imported, ...manual];
    this.save(merged);

    // モーダルを再表示
    const modal = document.getElementById('recurringModal');
    if (modal) modal.remove();
    this.show();
    App.showToast(`固定費ツールから ${imported.length} 件のデータを取り込みました`);
  },

  // 固定費ツールにデータがあるか確認
  hasKoteihiData() {
    const raw = localStorage.getItem('koteihi_data');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      return Object.values(data).some(items =>
        Array.isArray(items) && items.some(item => {
          const amt = parseInt(String(item.amount).replace(/[¥,、\s]/g, ''), 10) || 0;
          return amt > 0;
        })
      );
    } catch (e) {
      return false;
    }
  },

  show() {
    let items = this.getAll();

    // 初回起動時：固定費ツールにデータがあれば自動インポート
    if (items.length === 0) {
      if (this.hasKoteihiData()) {
        items = this.importFromKoteihi();
        if (items.length > 0) {
          this.save(items);
        } else {
          items = this.defaults();
          this.save(items);
        }
      } else {
        items = this.defaults();
        this.save(items);
      }
    }

    const existing = document.getElementById('recurringModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'recurringModal';
    modal.style.display = 'flex';

    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 合計金額を計算
    const totalAmount = items.filter(item => item.enabled).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);

    const hasKoteihi = this.hasKoteihiData();

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('recurringModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>🔄 定型仕訳</h2>
          <button class="modal-close" onclick="document.getElementById('recurringModal').remove()">✕</button>
        </div>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">
          毎月発生する固定経費を一括登録できます。金額を設定して「一括登録」ボタンを押してください。
        </p>
        ${hasKoteihi ? `
        <div style="margin-bottom:12px;padding:10px 14px;background:rgba(45,212,168,0.1);border:1px solid rgba(45,212,168,0.3);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="font-size:0.82rem;color:#2dd4a8">💰 固定費ツールのデータを検出しました</span>
          <button class="btn btn-secondary" style="font-size:0.8rem;padding:4px 12px" onclick="RecurringExpenses.syncFromKoteihi()">📥 固定費を取り込む</button>
        </div>
        ` : ''}
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:0.85rem;font-weight:600">記帳月:</label>
            <input type="month" id="recurringMonth" value="${defaultYM}" 
              style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit">
          </div>
          <div style="font-size:0.9rem;font-weight:700;color:var(--primary)">
            合計: ¥${totalAmount.toLocaleString()}/月
          </div>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr><th>✓</th><th>借方（経費）</th><th>摘要</th><th>金額</th></tr>
            </thead>
            <tbody>
              ${items.map((item, i) => `
                <tr${item.fromKoteihi ? ' style="background:rgba(45,212,168,0.03)"' : ''}>
                  <td><input type="checkbox" id="rec_chk_${i}" ${item.enabled ? 'checked' : ''}></td>
                  <td style="font-size:0.82rem">${item.debit}${item.fromKoteihi ? ' <span style="font-size:0.7rem;color:#2dd4a8">●</span>' : ''}</td>
                  <td><input type="text" id="rec_desc_${i}" value="${item.description}" 
                    style="padding:4px 8px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:0.82rem;width:100%;font-family:inherit"></td>
                  <td><input type="number" id="rec_amt_${i}" value="${item.amount}" min="0" 
                    style="padding:4px 8px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:0.82rem;width:100px;font-family:inherit;text-align:right"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions" style="margin-top:16px">
          <button class="btn btn-secondary" onclick="RecurringExpenses.addRow()">＋ 行追加</button>
          <button class="btn btn-primary" onclick="RecurringExpenses.registerAll()">📝 一括登録</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  addRow() {
    const items = this.getAll();
    items.push({
      id: 'r_' + Date.now(),
      debit: '雑費',
      credit: '普通預金',
      amount: 0,
      description: '',
      enabled: true,
    });
    this.save(items);
    document.getElementById('recurringModal').remove();
    this.show();
  },

  registerAll() {
    const items = this.getAll();
    const ym = document.getElementById('recurringMonth').value; // e.g. "2026-07"
    const date = ym + '-28'; // 月末付近
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    let count = 0;

    items.forEach((item, i) => {
      const chk = document.getElementById(`rec_chk_${i}`);
      const amt = document.getElementById(`rec_amt_${i}`);
      const desc = document.getElementById(`rec_desc_${i}`);
      if (!chk || !chk.checked) return;
      const amount = parseInt(amt.value) || 0;
      if (amount <= 0) return;

      // 設定を保存
      item.amount = amount;
      item.description = desc.value;
      item.enabled = true;

      // 重複防止
      const exists = journals.some(j => j.auto && j.recurringId === item.id && j.date && j.date.startsWith(ym));
      if (exists) return;

      journals.push({
        id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        date,
        debit: item.debit,
        credit: item.credit,
        amount,
        description: item.description,
        auto: true,
        recurringId: item.id,
        createdAt: new Date().toISOString(),
      });
      count++;
    });

    this.save(items);
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));
    document.getElementById('recurringModal').remove();
    App.showToast(`${count}件の定型仕訳を登録しました`);
    App.refreshView();
  },
};

// ============================================================
// 10. 年間目標トラッカー
// ============================================================
const GoalTracker = {
  STORAGE_KEY: 'gyosei_goals',

  getGoals() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null') || {
      annualRevenue: 3000000,
      annualCases: 50,
      monthlyCases: 5,
    };
  },
  saveGoals(goals) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(goals));
  },

  renderWidget() {
    const goals = this.getGoals();
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    // 年間実績
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const yearlyIncome = journals
      .filter(j => j.date && j.date.startsWith(String(year)) && INCOME.includes(j.credit))
      .reduce((s, j) => s + (j.amount || 0), 0);

    const cases = Store.getCases();
    const yearlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(String(year))).length;
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const monthlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(ym)).length;

    const revPct = goals.annualRevenue > 0 ? Math.min(100, Math.round(yearlyIncome / goals.annualRevenue * 100)) : 0;
    const caseYPct = goals.annualCases > 0 ? Math.min(100, Math.round(yearlyCases / goals.annualCases * 100)) : 0;
    const caseMPct = goals.monthlyCases > 0 ? Math.min(100, Math.round(monthlyCases / goals.monthlyCases * 100)) : 0;

    return `
      <div class="goal-tracker">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:0.95rem;margin:0">🎯 年間目標</h3>
          <button class="btn btn-small btn-ghost" onclick="GoalTracker.showSettings()">⚙️</button>
        </div>
        <div class="goal-item">
          <div class="goal-label">💰 年間売上 <span style="float:right">¥${yearlyIncome.toLocaleString()} / ¥${goals.annualRevenue.toLocaleString()}</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${revPct}%;background:${revPct >= 80 ? 'var(--accent-green)' : revPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${revPct}%</div>
        </div>
        <div class="goal-item">
          <div class="goal-label">📋 年間案件数 <span style="float:right">${yearlyCases} / ${goals.annualCases}件</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${caseYPct}%;background:${caseYPct >= 80 ? 'var(--accent-green)' : caseYPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${caseYPct}%</div>
        </div>
        <div class="goal-item">
          <div class="goal-label">📅 今月案件数 <span style="float:right">${monthlyCases} / ${goals.monthlyCases}件</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${caseMPct}%;background:${caseMPct >= 80 ? 'var(--accent-green)' : caseMPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${caseMPct}%</div>
        </div>
      </div>
    `;
  },

  showSettings() {
    const goals = this.getGoals();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'goalSettingsModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('goalSettingsModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🎯 目標設定</h2>
          <button class="modal-close" onclick="document.getElementById('goalSettingsModal').remove()">✕</button>
        </div>
        <form onsubmit="event.preventDefault(); GoalTracker.onSave()">
          <div class="form-group">
            <label>年間売上目標（円）</label>
            <input type="number" id="goal_revenue" value="${goals.annualRevenue}" min="0" step="100000">
          </div>
          <div class="form-group">
            <label>年間案件数目標</label>
            <input type="number" id="goal_cases_y" value="${goals.annualCases}" min="0">
          </div>
          <div class="form-group">
            <label>月間案件数目標</label>
            <input type="number" id="goal_cases_m" value="${goals.monthlyCases}" min="0">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('goalSettingsModal').remove()">キャンセル</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onSave() {
    const goals = {
      annualRevenue: parseInt(document.getElementById('goal_revenue').value) || 0,
      annualCases: parseInt(document.getElementById('goal_cases_y').value) || 0,
      monthlyCases: parseInt(document.getElementById('goal_cases_m').value) || 0,
    };
    this.saveGoals(goals);
    document.getElementById('goalSettingsModal').remove();
    App.refreshView();
    App.showToast('目標を更新しました');
  },
};

// ============================================================
// 11. 月次レポート
// ============================================================
const MonthlyReport = {
  show(year, month) {
    const now = new Date();
    year = year || now.getFullYear();
    month = month || now.getMonth() + 1;
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    // データ収集
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = Accounting.ACCOUNTS.expense;

    let totalIncome = 0, totalExpense = 0;
    const incomeItems = [];
    const expenseItems = [];

    filtered.forEach(j => {
      if (INCOME.includes(j.credit)) {
        totalIncome += j.amount || 0;
        incomeItems.push(j);
      }
      if (EXPENSE_ACCOUNTS.includes(j.debit)) {
        totalExpense += j.amount || 0;
        expenseItems.push(j);
      }
    });

    const profit = totalIncome - totalExpense;

    // 案件データ
    const cases = Store.getCases();
    const monthCases = cases.filter(c => c.createdAt && c.createdAt.startsWith(ym));
    const completedCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(ym));
    const activeCases = cases.filter(c => c.status !== 'done');

    // 顧客データ
    const clients = Store.getClients();
    const newClients = clients.filter(c => c.createdAt && c.createdAt.startsWith(ym));

    // 入金データ
    const payments = JSON.parse(localStorage.getItem('gyosei_payments') || '[]');
    const monthPayments = payments.filter(p => p.paidAt && p.paidAt.startsWith(ym));
    const totalPaid = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const unpaid = payments.filter(p => p.status === 'unpaid');
    const totalUnpaid = unpaid.reduce((s, p) => s + (p.amount || 0), 0);

    // 経費内訳をグループ化
    const expenseByAccount = {};
    expenseItems.forEach(j => {
      if (!expenseByAccount[j.debit]) expenseByAccount[j.debit] = 0;
      expenseByAccount[j.debit] += j.amount || 0;
    });
    const expenseEntries = Object.entries(expenseByAccount).sort((a, b) => b[1] - a[1]);

    // カテゴリ別案件
    const CATS = { garage: '車庫証明', inheritance: '相続', mahjong: '麻雀関連', construction: '建設業', farmland: '農地転用', liquor: '酒類販売', visa: '在留資格', other: 'その他' };
    const catCounts = {};
    completedCases.forEach(c => {
      const label = CATS[c.category] || c.category;
      catCounts[label] = (catCounts[label] || 0) + 1;
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'monthlyReportModal';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('monthlyReportModal').remove()"></div>
      <div class="modal-content modal-large" style="max-width:700px">
        <div class="modal-header">
          <h2>📄 ${year}年${month}月 月次レポート</h2>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-small" onclick="window.print()">🖨 印刷</button>
            <button class="modal-close" onclick="document.getElementById('monthlyReportModal').remove()">✕</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:rgba(45,212,168,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">収入</div>
            <div style="font-size:1.3rem;font-weight:700;color:#2dd4a8">¥${totalIncome.toLocaleString()}</div>
          </div>
          <div style="background:rgba(255,107,107,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">支出</div>
            <div style="font-size:1.3rem;font-weight:700;color:#ff6b6b">¥${totalExpense.toLocaleString()}</div>
          </div>
          <div style="background:rgba(108,99,255,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">利益</div>
            <div style="font-size:1.3rem;font-weight:700;color:${profit >= 0 ? '#2dd4a8' : '#ff6b6b'}">¥${profit.toLocaleString()}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <div>
            <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">📋 案件サマリー</h3>
            <table class="acc-table" style="font-size:0.82rem">
              <tr><td>新規受付</td><td style="text-align:right;font-weight:600">${monthCases.length}件</td></tr>
              <tr><td>完了</td><td style="text-align:right;font-weight:600">${completedCases.length}件</td></tr>
              <tr><td>現在進行中</td><td style="text-align:right;font-weight:600">${activeCases.length}件</td></tr>
              <tr><td>新規顧客</td><td style="text-align:right;font-weight:600">${newClients.length}名</td></tr>
            </table>
          </div>
          <div>
            <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">💴 入金状況</h3>
            <table class="acc-table" style="font-size:0.82rem">
              <tr><td>今月入金</td><td style="text-align:right;font-weight:600;color:#2dd4a8">¥${totalPaid.toLocaleString()}</td></tr>
              <tr><td>未収金合計</td><td style="text-align:right;font-weight:600;color:${totalUnpaid > 0 ? '#ff6b6b' : 'inherit'}">¥${totalUnpaid.toLocaleString()}</td></tr>
              <tr><td>未収件数</td><td style="text-align:right;font-weight:600">${unpaid.length}件</td></tr>
            </table>
          </div>
        </div>

        ${completedCases.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">📊 完了案件の内訳</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.entries(catCounts).map(([label, count]) => `
              <span style="background:var(--bg-input);padding:4px 10px;border-radius:12px;font-size:0.8rem">${label}: ${count}件</span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${expenseEntries.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">💸 経費内訳</h3>
          <table class="acc-table" style="font-size:0.82rem">
            ${expenseEntries.map(([account, amount]) => `
              <tr>
                <td>${account}</td>
                <td style="text-align:right;font-weight:600">¥${amount.toLocaleString()}</td>
                <td style="text-align:right;color:var(--text-muted);font-size:0.75rem">${totalExpense > 0 ? Math.round(amount / totalExpense * 100) : 0}%</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        <div style="text-align:center;padding:12px;font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--border-color);margin-top:12px">
          レポート生成日: ${new Date().toLocaleDateString('ja-JP')} | 吉村行政書士事務所
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
};

// ============================================================
// 12. ダッシュボード 収支ウィジェット
// ============================================================
const RevenueWidget = {
  renderWidget() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = typeof Accounting !== 'undefined' ? Accounting.ACCOUNTS.expense : [];

    const monthFiltered = journals.filter(j => j.date && j.date.startsWith(ym));
    let monthIncome = 0, monthExpense = 0;
    monthFiltered.forEach(j => {
      if (INCOME.includes(j.credit)) monthIncome += j.amount || 0;
      if (EXPENSE_ACCOUNTS.includes(j.debit)) monthExpense += j.amount || 0;
    });
    const monthProfit = monthIncome - monthExpense;

    // 前月比較
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevYm = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevFiltered = journals.filter(j => j.date && j.date.startsWith(prevYm));
    let prevIncome = 0;
    prevFiltered.forEach(j => {
      if (INCOME.includes(j.credit)) prevIncome += j.amount || 0;
    });

    const diff = monthIncome - prevIncome;
    const diffLabel = diff > 0 ? `↑ +¥${diff.toLocaleString()}` : diff < 0 ? `↓ ¥${diff.toLocaleString()}` : '→ 変動なし';
    const diffColor = diff > 0 ? '#2dd4a8' : diff < 0 ? '#ff6b6b' : '#888';

    return `
      <div class="goal-tracker" style="cursor:pointer" onclick="MonthlyReport.show()" title="クリックで月次レポートを表示">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:0.95rem;margin:0">💰 ${month}月の収支</h3>
          <span style="font-size:0.72rem;color:${diffColor};font-weight:600">${diffLabel}（前月比）</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">収入</div>
            <div style="font-size:1.05rem;font-weight:700;color:#2dd4a8">¥${monthIncome.toLocaleString()}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">支出</div>
            <div style="font-size:1.05rem;font-weight:700;color:#ff6b6b">¥${monthExpense.toLocaleString()}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">利益</div>
            <div style="font-size:1.05rem;font-weight:700;color:${monthProfit >= 0 ? '#2dd4a8' : '#ff6b6b'}">¥${monthProfit.toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
  },
};
