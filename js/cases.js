/**
 * 案件管理画面
 */
const Cases = {
  filterCategory: 'all',
  filterStatus: 'all',
  editingId: null,
  advanceDraft: [],  // 立替金一時データ [{label, amount}]

  STATUSES: [
    { key: 'received', label: '受付', icon: '📥' },
    { key: 'hearing', label: 'ヒアリング', icon: '🎤' },
    { key: 'documents', label: '書類作成', icon: '📝' },
    { key: 'applying', label: '申請中', icon: '📤' },
    { key: 'done', label: '完了', icon: '✅' },
  ],

  CATEGORIES: [
    { key: 'garage_oss', label: '🚗 車庫証明（OSS）' },
    { key: 'garage_paper', label: '🚗 車庫証明（紙）' },
    { key: 'seal', label: '🚙 丁種封印' },
    { key: 'inheritance', label: '📜 相続' },
  ],

  render() {
    const cases = Store.getCases();
    let filtered = cases;
    if (this.filterCategory !== 'all') filtered = filtered.filter(c => c.category === this.filterCategory);
    if (this.filterStatus !== 'all') filtered = filtered.filter(c => c.status === this.filterStatus);

    // 完了から7日以上経過した案件を自動非表示（フィルターで「完了」を選択時は表示）
    if (this.filterStatus !== 'done') {
      const now = Date.now();
      const HIDE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7日
      filtered = filtered.filter(c => {
        if (c.status !== 'done' || !c.completedAt) return true;
        return (now - new Date(c.completedAt).getTime()) < HIDE_AFTER_MS;
      });
    }

    // ビュー切替: PC=カンバン / モバイルはリスト
    const isMobile = window.innerWidth < 768;

    return `
      <div class="cases-page">
        <div class="page-header">
          <h1>案件管理</h1>
          <button class="btn btn-primary" onclick="Cases.showAddModal()">
            <span class="btn-icon">＋</span> 新規案件
          </button>
        </div>

        <div class="filter-bar">
          <div class="filter-group">
            <label>カテゴリ:</label>
            <select id="filterCategory" onchange="Cases.onFilterChange()" class="filter-select">
              <option value="all" ${this.filterCategory === 'all' ? 'selected' : ''}>すべて</option>
              ${this.CATEGORIES.map(c => `<option value="${c.key}" ${this.filterCategory === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label>ステータス:</label>
            <select id="filterStatus" onchange="Cases.onFilterChange()" class="filter-select">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>すべて</option>
              ${this.STATUSES.map(s => `<option value="${s.key}" ${this.filterStatus === s.key ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
            </select>
          </div>
        </div>

        ${isMobile ? this.renderList(filtered) : this.renderKanban(filtered)}
      </div>
      ${this.renderModal()}
    `;
  },

  renderKanban(cases) {
    return `
      <div class="kanban-board">
        ${this.STATUSES.map(status => {
      const statusCases = cases.filter(c => c.status === status.key);
      return `
            <div class="kanban-column" data-status="${status.key}"
              ondragover="event.preventDefault(); this.classList.add('drag-over')"
              ondragleave="this.classList.remove('drag-over')"
              ondrop="Cases.onDrop(event, '${status.key}'); this.classList.remove('drag-over')">
              <div class="kanban-header">
                <span>${status.icon} ${status.label}</span>
                <span class="kanban-count">${statusCases.length}</span>
              </div>
              <div class="kanban-cards">
                ${statusCases.length === 0
          ? '<div class="kanban-empty">案件なし</div>'
          : statusCases.map(c => this.renderKanbanCard(c)).join('')
        }
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  },

  // 立替金行を再描画
  renderAdvanceRows() {
    const container = document.getElementById('csf_advance_rows');
    if (!container) return;
    container.innerHTML = this.advanceDraft.map((adv, i) => `
      <div style="display:flex;gap:6px;align-items:center">
        <input type="text" placeholder="内容（例：申請手数料）" value="${adv.label || ''}"
          style="flex:2" data-adv-idx="${i}" data-adv-field="label"
          oninput="Cases.onAdvInput(this)">
        <input type="number" placeholder="金額" value="${adv.amount || ''}"
          style="flex:1" data-adv-idx="${i}" data-adv-field="amount"
          oninput="Cases.onAdvInput(this)">
        <button type="button" style="flex-shrink:0;background:none;border:1px solid #e5e7eb;border-radius:4px;padding:2px 8px;cursor:pointer;color:#ef4444"
          onclick="Cases.removeAdvanceRow(${i})">✕</button>
      </div>
    `).join('');
  },

  addAdvanceRow() {
    this.advanceDraft.push({ label: '', amount: 0 });
    this.renderAdvanceRows();
  },

  removeAdvanceRow(i) {
    this.advanceDraft.splice(i, 1);
    this.renderAdvanceRows();
  },

  onAdvInput(el) {
    const i = parseInt(el.dataset.advIdx);
    const field = el.dataset.advField;
    if (!this.advanceDraft[i]) this.advanceDraft[i] = { label: '', amount: 0 };
    this.advanceDraft[i][field] = field === 'amount' ? Number(el.value) : el.value;
  },

  renderKanbanCard(c) {
    const client = Store.getClient(c.clientId);
    const catLabel = this.CATEGORIES.find(cat => cat.key === c.category);
    const deadlineClass = this.getDeadlineClass(c.deadline);
    const staffName = Store.getStaffName(c.staffId);
    return `
      <div class="kanban-card ${deadlineClass}" draggable="true"
        ondragstart="event.dataTransfer.setData('text/plain','${c.id}')"
        onclick="Cases.showEditModal('${c.id}')">
        <div class="kanban-card-cat">
          <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : c.category}</span>
        </div>
        <div class="kanban-card-title">${c.title}</div>
        <div class="kanban-card-meta">
          ${client ? `<span>👤 ${client.name}</span>` : ''}
          ${c.staffId ? `<span>🏷️ ${staffName}</span>` : ''}
          ${c.deadline ? `<span>📅 ${c.deadline}</span>` : ''}
          ${c.surveyDate ? `<span style="color:#059669;font-weight:600">📍 調査: ${c.surveyDate.slice(5)}</span>` : ''}
          ${c.policeDeliveryDate ? `<span style="color:#2563eb;font-weight:600">🚔 交付: ${c.policeDeliveryDate.slice(5)}</span>` : ''}
        </div>
        ${c.createdAt ? `<div class="kanban-card-date">📋 ${c.createdAt.slice(0, 10)}</div>` : ''}
        ${c.fee ? `<div class="kanban-card-fee">💰 報酬 ${Number(c.fee).toLocaleString()}円${(c.advances||[]).length > 0 ? ` + 立替 ${(c.advances||[]).reduce((s,a)=>s+Number(a.amount||0),0).toLocaleString()}円` : ''}</div>` : ''}
      </div>
    `;
  },

  renderList(cases) {
    const sorted = cases.sort((a, b) => {
      const statusOrder = ['received', 'hearing', 'documents', 'applying', 'done'];
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });
    return `
      <div class="case-list">
        ${sorted.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📋</div><p>案件がまだありません</p><button class="btn btn-primary" onclick="Cases.showAddModal()">最初の案件を登録</button></div>'
        : sorted.map(c => {
          const client = Store.getClient(c.clientId);
          const statusInfo = this.STATUSES.find(s => s.key === c.status);
          const catLabel = this.CATEGORIES.find(cat => cat.key === c.category);
          const deadlineClass = this.getDeadlineClass(c.deadline);
          return `
                <div class="case-list-item ${deadlineClass}" onclick="Cases.showEditModal('${c.id}')">
                  <div class="case-list-top">
                    <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : ''}</span>
                    <span class="status-badge status-${c.status}">${statusInfo ? statusInfo.icon + ' ' + statusInfo.label : ''}</span>
                  </div>
                  <div class="case-list-title">${c.title}</div>
                    <div class="case-list-meta">
                     ${client ? `<span>👤 ${client.name}</span>` : ''}
                     ${c.staffId ? `<span>🏷️ ${Store.getStaffName(c.staffId)}</span>` : ''}
                     ${c.createdAt ? `<span>📋 ${c.createdAt.slice(0, 10)}</span>` : ''}
                     ${c.deadline ? `<span>📅 ${c.deadline}</span>` : ''}
                     ${c.surveyDate ? `<span style="color:#059669;font-weight:600">📍 調査: ${c.surveyDate.slice(5)}</span>` : ''}
                     ${c.policeDeliveryDate ? `<span style="color:#2563eb;font-weight:600">🚔 交付: ${c.policeDeliveryDate.slice(5)}</span>` : ''}
                     ${c.fee ? `<span>💰 ${Number(c.fee).toLocaleString()}円</span>` : ''}
                   </div>
                  <div class="case-list-status-controls">
                    ${this.STATUSES.map(s => `
                      <button class="status-step-btn ${c.status === s.key ? 'active' : ''}"
                        onclick="event.stopPropagation(); Cases.changeStatus('${c.id}', '${s.key}')"
                        title="${s.label}">${s.icon}</button>
                    `).join('')}
                  </div>
                </div>
              `;
        }).join('')
      }
      </div>
    `;
  },

  renderModal() {
    const clients = Store.getClients();
    const staffList = Store.getStaff();
    const today = new Date().toISOString().slice(0, 10);
    return `
      <div id="caseModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Cases.closeModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="caseModalTitle">案件登録</h2>
            <button class="modal-close" onclick="Cases.closeModal()">✕</button>
          </div>
          <form id="caseForm" onsubmit="Cases.onSubmit(event)">
            <div class="form-group">
              <label>案件名 <span class="required">*</span></label>
              <input type="text" name="title" id="csf_title" required placeholder="例：田中太郎様 車庫証明申請">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>顧客</label>
                <select name="clientId" id="csf_clientId" class="form-select">
                  <option value="">未選択</option>
                  ${clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>カテゴリ <span class="required">*</span></label>
                <select name="category" id="csf_category" required class="form-select" onchange="if(!Cases.editingId) CaseTemplates.applyTemplate(this.value)">
                  ${this.CATEGORIES.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>担当者</label>
                <select name="staffId" id="csf_staffId" class="form-select">
                  <option value="">— 選択 —</option>
                  ${staffList.map(s => `<option value="${s.id}">${s.name}${s.role ? ' (' + s.role + ')' : ''}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>登録日</label>
                <input type="date" name="registeredAt" id="csf_registeredAt" value="${today}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>ステータス</label>
                <select name="status" id="csf_status" class="form-select">
                  ${this.STATUSES.map(s => `<option value="${s.key}">${s.icon} ${s.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>期限日</label>
                <input type="date" name="deadline" id="csf_deadline">
              </div>
            </div>
            <div class="form-group">
              <label>報酬額（円）</label>
              <input type="number" name="fee" id="csf_fee" placeholder="例：30000">
            </div>
            <div class="form-group" id="csf_advances_section">
              <label>立替金</label>
              <div id="csf_advance_rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>
              <button type="button" class="btn btn-secondary" style="font-size:0.8rem;padding:4px 10px"
                onclick="Cases.addAdvanceRow()">＋ 立替金を追加</button>
            </div>
            <div class="form-row" id="csf_deathDate_group" style="display:none">
              <div class="form-group">
                <label>被相続人死亡日 <span style="font-size:0.75rem;color:var(--text-muted)">(期限自動計算用)</span></label>
                <input type="date" name="deathDate" id="csf_deathDate">
              </div>
            </div>
            <div class="form-row" id="csf_garageDates_group" style="display:none">
              <div class="form-group">
                <label>現地調査予定日</label>
                <input type="date" name="surveyDate" id="csf_surveyDate">
              </div>
              <div class="form-group">
                <label>警察署交付（予定）日</label>
                <input type="date" name="policeDeliveryDate" id="csf_policeDeliveryDate">
              </div>
            </div>
            <div class="form-section" style="background:#f9fafb;padding:12px;border-radius:6px;margin-bottom:12px;border:1px solid #e5e7eb;">
              <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:#6b7280;">🚗 車両・申請情報（車庫証明・登録等用）</div>
              <div class="form-row">
                <div class="form-group">
                  <label>名前（申請者・使用者）</label>
                  <input type="text" name="carName" id="csf_carName" placeholder="例：山田 太郎">
                </div>
                <div class="form-group">
                  <label>住所</label>
                  <input type="text" name="carAddress" id="csf_carAddress" placeholder="例：東京都港区...">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>車台番号</label>
                  <input type="text" name="carNumber" id="csf_carNumber" placeholder="例：ABC-1234567">
                </div>
                <div class="form-group">
                  <label>所轄警察署</label>
                  <select name="carPolice" id="csf_carPolice" class="form-select">
                    <option value="">— 選択（任意） —</option>
                    ${typeof Briefing !== 'undefined' 
                      ? Briefing.PRESETS.filter(p => p.group === '警察署').map(p => `<option value="${p.label}">${p.label}</option>`).join('') 
                      : ''}
                  </select>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>メモ</label>
              <textarea name="memo" id="csf_memo" rows="3" placeholder="案件に関するメモ..."></textarea>
            </div>
            <div id="caseExtArea"></div>
            <div class="form-actions">
              <button type="button" class="btn btn-danger" id="caseDeleteBtn" style="display:none; margin-right:auto"
                onclick="Cases.onDelete()">🗑️ 削除</button>
              <button type="button" class="btn btn-secondary" onclick="Cases.closeModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  getDeadlineClass(deadline) {
    if (!deadline) return '';
    const dl = new Date(deadline);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = (dl - today) / (1000 * 60 * 60 * 24);
    if (diff < 0) return 'deadline-overdue';
    if (diff <= 3) return 'deadline-urgent';
    if (diff <= 7) return 'deadline-soon';
    return '';
  },

  onFilterChange() {
    this.filterCategory = document.getElementById('filterCategory').value;
    this.filterStatus = document.getElementById('filterStatus').value;
    App.refreshView();
  },

  onDrop(event, newStatus) {
    event.preventDefault();
    const caseId = event.dataTransfer.getData('text/plain');
    Store.updateCase(caseId, { status: newStatus });
    App.refreshView();
    App.showToast('ステータスを更新しました');
  },

  changeStatus(id, newStatus) {
    Store.updateCase(id, { status: newStatus });
    App.refreshView();
    App.showToast('ステータスを更新しました');
  },

  showAddModal() {
    this.editingId = null;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('caseModalTitle').textContent = '案件登録';
      document.getElementById('caseForm').reset();
      document.getElementById('caseDeleteBtn').style.display = 'none';
      document.getElementById('caseModal').style.display = 'flex';
      this.advanceDraft = [];
      this.renderAdvanceRows();
    }, 0);
  },

  showEditModal(id) {
    this.editingId = id;
    const c = Store.getCase(id);
    if (!c) return;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('caseModalTitle').textContent = '案件編集';
      document.getElementById('csf_title').value = c.title;
      document.getElementById('csf_clientId').value = c.clientId || '';
      document.getElementById('csf_staffId').value = c.staffId || '';
      document.getElementById('csf_registeredAt').value = c.registeredAt || c.createdAt?.slice(0, 10) || '';
      document.getElementById('csf_category').value = c.category;
      document.getElementById('csf_status').value = c.status;
      document.getElementById('csf_deadline').value = c.deadline || '';
      document.getElementById('csf_fee').value = c.fee || '';
      document.getElementById('csf_memo').value = c.memo || '';
      document.getElementById('csf_carName').value = c.carName || '';
      document.getElementById('csf_carAddress').value = c.carAddress || '';
      document.getElementById('csf_carNumber').value = c.carNumber || '';
      document.getElementById('csf_carPolice').value = c.carPolice || '';
      document.getElementById('caseDeleteBtn').style.display = 'block';
      document.getElementById('caseModal').style.display = 'flex';
      // 立替金を読み込み
      this.advanceDraft = Array.isArray(c.advances) ? JSON.parse(JSON.stringify(c.advances)) : [];
      this.renderAdvanceRows();
      // 死亡日フィールド表示制御
      const deathDateGroup = document.getElementById('csf_deathDate_group');
      if (deathDateGroup) {
        deathDateGroup.style.display = c.category === 'inheritance' ? '' : 'none';
      }
      const deathDateEl = document.getElementById('csf_deathDate');
      if (deathDateEl) deathDateEl.value = c.deathDate || '';

      // 車庫関係フィールド表示制御
      const garageDatesGroup = document.getElementById('csf_garageDates_group');
      if (garageDatesGroup) {
        garageDatesGroup.style.display = ['garage_oss', 'garage_paper', 'seal'].includes(c.category) ? '' : 'none';
      }
      const surveyDateEl = document.getElementById('csf_surveyDate');
      if (surveyDateEl) surveyDateEl.value = c.surveyDate || '';
      const policeDeliveryDateEl = document.getElementById('csf_policeDeliveryDate');
      if (policeDeliveryDateEl) policeDeliveryDateEl.value = c.policeDeliveryDate || '';
      // 対応履歴・チェックリスト・期限アラートを追加
      const extArea = document.getElementById('caseExtArea');
      if (extArea) {
        let extHtml = '';
        // 書類添付パネル
        if (typeof CaseDocs !== 'undefined') {
          extHtml += CaseDocs.renderPanel(id);
        }
        extHtml += DocChecklist.renderChecklist(id) + ActivityLog.renderWidget('case', id);
        if (c.category === 'inheritance' && c.deathDate && typeof InheritanceDeadlines !== 'undefined') {
          extHtml = InheritanceDeadlines.renderDeadlinePanel(c.deathDate) + extHtml;
        }
        extArea.innerHTML = extHtml;
      }
    }, 0);
  },

  closeModal() {
    document.getElementById('caseModal').style.display = 'none';
    this.editingId = null;
  },

  onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      title: form.title.value.trim(),
      clientId: form.clientId.value,
      staffId: form.staffId.value,
      registeredAt: form.registeredAt.value,
      category: form.category.value,
      status: form.status.value,
      deadline: form.deadline.value,
      fee: form.fee.value,
      advances: this.advanceDraft.filter(a => a.label || Number(a.amount) > 0),
      deathDate: form.deathDate ? form.deathDate.value : '',
      surveyDate: form.surveyDate ? form.surveyDate.value : '',
      policeDeliveryDate: form.policeDeliveryDate ? form.policeDeliveryDate.value : '',
      carName: form.carName ? form.carName.value.trim() : '',
      carAddress: form.carAddress ? form.carAddress.value.trim() : '',
      carNumber: form.carNumber ? form.carNumber.value.trim() : '',
      carPolice: form.carPolice ? form.carPolice.value.trim() : '',
      memo: form.memo.value.trim(),
    };
    if (this.editingId) {
      Store.updateCase(this.editingId, data);
    } else {
      Store.addCase(data);
    }
    this.closeModal();
    App.refreshView();
    App.showToast(this.editingId ? '案件を更新しました' : '案件を登録しました');
  },

  onDelete() {
    if (!this.editingId) return;
    if (confirm('この案件を削除してもよろしいですか？')) {
      Store.deleteCase(this.editingId);
      this.closeModal();
      App.refreshView();
      App.showToast('案件を削除しました');
    }
  },
};
