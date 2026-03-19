/**
 * 案件管理画面
 */
const Cases = {
  filterCategory: 'all',
  filterStatus: 'all',
  editingId: null,

  STATUSES: [
    { key: 'received', label: '受付', icon: '📥' },
    { key: 'hearing', label: 'ヒアリング', icon: '🎤' },
    { key: 'documents', label: '書類作成', icon: '📝' },
    { key: 'applying', label: '申請中', icon: '📤' },
    { key: 'done', label: '完了', icon: '✅' },
  ],

  CATEGORIES: [
    { key: 'garage', label: '🚗 車庫証明' },
    { key: 'inheritance', label: '📜 相続' },
    { key: 'mahjong', label: '🀄 麻雀関連' },
    { key: 'construction', label: '🏗️ 建設業許可' },
    { key: 'farmland', label: '🌾 農地転用' },
    { key: 'liquor', label: '🍶 酒類販売' },
    { key: 'visa', label: '🛂 在留資格' },
    { key: 'other', label: '📌 その他' },
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
        </div>
        ${c.createdAt ? `<div class="kanban-card-date">📋 ${c.createdAt.slice(0, 10)}</div>` : ''}
        ${c.fee ? `<div class="kanban-card-fee">💰 ${Number(c.fee).toLocaleString()}円</div>` : ''}
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
            <div class="form-row" id="csf_deathDate_group" style="display:none">
              <div class="form-group">
                <label>被相続人死亡日 <span style="font-size:0.75rem;color:var(--text-muted)">(期限自動計算用)</span></label>
                <input type="date" name="deathDate" id="csf_deathDate">
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
      document.getElementById('caseDeleteBtn').style.display = 'block';
      document.getElementById('caseModal').style.display = 'flex';
      // 死亡日フィールド表示制御
      const deathDateGroup = document.getElementById('csf_deathDate_group');
      if (deathDateGroup) {
        deathDateGroup.style.display = c.category === 'inheritance' ? '' : 'none';
      }
      const deathDateEl = document.getElementById('csf_deathDate');
      if (deathDateEl) deathDateEl.value = c.deathDate || '';
      // 対応履歴・チェックリスト・期限アラートを追加
      const extArea = document.getElementById('caseExtArea');
      if (extArea) {
        let extHtml = DocChecklist.renderChecklist(id) + ActivityLog.renderWidget('case', id);
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
      deathDate: form.deathDate ? form.deathDate.value : '',
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
