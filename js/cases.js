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
    { key: 'applying', label: '申請中', icon: '📝' },
    { key: 'delivery', label: '交付・受取', icon: '📋' },
    { key: 'done', label: '完了・納品', icon: '✅' },
  ],

  CATEGORIES: [
    { key: 'garage_oss', label: '🚗 車庫証明（OSS）' },
    { key: 'garage_paper', label: '📄 車庫証明（紙）' },
    { key: 'seal', label: '🔩 出張封印' },
    { key: 'car_reg_standard', label: '🚘 普通自動車登録' },
    { key: 'car_reg_light', label: '🚙 軽自動車登録' },
  ],

  SUB_CATEGORIES: [
    { key: '', label: '— 登録種別を選択（任意） —' },
    { key: '新規登録', label: '新規登録（新車・中古新規）' },
    { key: '移転登録（名義変更）', label: '移転登録（名義変更・管轄変更なし）' },
    { key: '移転登録（出張封印）', label: '移転登録（管轄変更あり・出張封印）' },
    { key: '変更登録', label: '変更登録（住所・氏名等）' },
    { key: '抹消登録', label: '抹消登録（一時抹消・永久抹消）' },
    { key: '希望ナンバー', label: '希望ナンバー申し込み' },
    { key: 'ナンバー再交付', label: 'ナンバー再交付（破損・汚損）' },
    { key: '車検証・標章再交付', label: '車検証 / 検査標章 再交付' },
    { key: '登録事項証明書', label: '登録事項等証明書（現在・詳細）' },
    { key: '減免申請', label: '減免申請（身体障害者等）' },
    { key: 'その他', label: 'その他' },
  ],

  render() {
    const cases = Store.getCases();
    let filtered = cases;
    if (this.filterCategory !== 'all') filtered = filtered.filter(c => c.category === this.filterCategory);
    
    if (this.filterStatus === 'active') {
      filtered = filtered.filter(c => c.status !== 'done');
    } else if (this.filterStatus !== 'all' && this.filterStatus !== 'done') {
      filtered = filtered.filter(c => c.status === this.filterStatus);
    } else if (this.filterStatus === 'done') {
      filtered = filtered.filter(c => c.status === 'done');
    }

    // 完了から7日以上経過した案件を「すべて」選択時に自動非表示（「完了」フィルター選択時は全表示）
    if (this.filterStatus === 'all') {
      const now = Date.now();
      const HIDE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7日
      filtered = filtered.filter(c => {
        if (c.status !== 'done') return true;
        const doneTime = c.completedAt ? new Date(c.completedAt).getTime() : (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);
        return doneTime > 0 ? (now - doneTime) < HIDE_AFTER_MS : true;
      });
    }

    // ビュー切替: PC=カンバン / モバイルはリスト
    const isMobile = window.innerWidth < 768;

    return `
      <div class="cases-page">
        <div class="page-header">
          <h1>案件管理</h1>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-ghost" onclick="Cases.syncAllCasesToCalendar()" title="進行中の全案件をGoogleカレンダーに一括同期" style="font-size:0.82rem;">
              📅 カレンダー一括同期
            </button>
            <button class="btn btn-primary" onclick="Cases.showAddModal()">
              <span class="btn-icon">＋</span> 新規案件
            </button>
          </div>
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
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>すべて（進行中＋直近完了）</option>
              <option value="active" ${this.filterStatus === 'active' ? 'selected' : ''}>⚡ 進行中のみ（未完了）</option>
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
          let statusCases = cases.filter(c => c.status === status.key);
          let extraFooterHtml = '';
          if (status.key === 'done' && this.filterStatus === 'all' && statusCases.length > 5) {
            const totalDoneCount = statusCases.length;
            statusCases = [...statusCases].sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt)).slice(0, 5);
            extraFooterHtml = `
              <div style="text-align:center;padding:10px 4px;font-size:0.78rem;color:var(--primary);cursor:pointer;font-weight:600;background:rgba(99,102,241,0.06);border-radius:6px;margin-top:6px" onclick="Cases.filterStatus='done';App.refreshView();">
                過去の完了案件を見る (${totalDoneCount}件) ➔
              </div>`;
          }
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
                ${extraFooterHtml}
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
    const deadlineClass = this.getDeadlineClass(c.deadline, c.status);
    const staffName = Store.getStaffName(c.staffId);
    const contactName = c.clientContactId ? Store.getClientContact(c.clientContactId)?.name : '';
    
    // 複数目的地のバッジを組み立て
    const locNames = [];
    if (c.surveyLocationId) {
      const loc = Store.getLocationName(c.surveyLocationId);
      if (loc) locNames.push(`現調:${loc}`);
    }
    if (c.policeLocationId) {
      const loc = Store.getLocationName(c.policeLocationId);
      if (loc) locNames.push(`警察:${loc}`);
    }
    if (c.landTransportLocationId) {
      const loc = Store.getLocationName(c.landTransportLocationId);
      if (loc) locNames.push(`陸局:${loc}`);
    }
    if (locNames.length === 0 && c.locationId) {
      const loc = Store.getLocationName(c.locationId);
      if (loc) locNames.push(loc);
    }
    const locationsHtml = locNames.map(name => `<span>📍 ${name}</span>`).join('');

    let milestoneHtml = '';
    const mIndex = c.milestoneIndex !== undefined ? Number(c.milestoneIndex) : 0;
    if (this.filterCategory === 'all') {
      if (c.category !== 'inheritance') {
        const steps = c.category === 'seal' 
          ? ['書類受領', '日程調整', '施封完了'] 
          : ['配置図作成', '承諾書回収', '警察署申請'];
        milestoneHtml = `
          <div class="card-milestone-dots" title="進捗: ${mIndex}/3 (現在: ${steps[Math.min(mIndex, 2)] || '未完了'})">
            ${[0, 1, 2].map(idx => `<span class="milestone-dot ${idx < mIndex ? 'active' : ''} ${c.category}"></span>`).join('')}
            <span class="milestone-text-ratio">${mIndex}/3</span>
          </div>`;
      }
    } else if (this.filterCategory === 'inheritance') {
      const steps = ['相続人特定', '財産調査', '協議書捺印', '手続完了'];
      milestoneHtml = `
        <div class="card-milestone-dots" title="進捗: ${mIndex}/4 (現在: ${steps[Math.min(mIndex, 3)] || '未完了'})">
          ${[0, 1, 2, 3].map(idx => `<span class="milestone-dot ${idx < mIndex ? 'active' : ''} ${c.category}"></span>`).join('')}
          <span class="milestone-text-ratio">${mIndex}/4</span>
        </div>`;
    } else {
      const steps = c.category === 'seal' 
        ? ['書類受領', '日程調整', '施封完了'] 
        : ['配置図作成', '承諾書回収', '警察署申請'];
      milestoneHtml = `
        <div class="card-milestone-dots" title="進捗: ${mIndex}/3 (現在: ${steps[Math.min(mIndex, 2)] || '未完了'})">
          ${[0, 1, 2].map(idx => `<span class="milestone-dot ${idx < mIndex ? 'active' : ''} ${c.category}"></span>`).join('')}
          <span class="milestone-text-ratio">${mIndex}/3</span>
        </div>`;
    }

    return `
      <div class="kanban-card ${deadlineClass}" draggable="true"
        ondragstart="event.dataTransfer.setData('text/plain','${c.id}')"
        onclick="Cases.showEditModal('${c.id}')">
        <div class="kanban-card-cat">
          <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : c.category}</span>
          ${c.subCategory ? `<span style="font-size:0.7rem;background:rgba(0,0,0,0.05);padding:1px 5px;border-radius:3px;margin-left:4px;color:var(--text-secondary)">${c.subCategory}</span>` : ''}
        </div>
        <div class="kanban-card-title">${c.title}</div>
        <div class="kanban-card-meta">
          ${client ? `<span>👤 ${client.name}</span>` : ''}
          ${contactName ? `<span style="font-size:0.78rem;color:var(--text-muted)">└ ${contactName}</span>` : ''}
          ${c.staffId ? `<span>🏷️ ${staffName}</span>` : ''}
          ${locationsHtml}
          ${c.orderNo ? `<span>🎫 ${c.orderNo}</span>` : ''}
          ${c.deadline ? `<span>📅 ${c.deadline}</span>` : ''}
          ${c.registrationDate ? `<span style="color:#d97706;font-weight:600">🚗 登録: ${c.registrationDate.slice(5)}</span>` : ''}
          ${c.policeDeliveryDate ? `<span style="color:#2563eb;font-weight:600">🚔 交付: ${c.policeDeliveryDate.slice(5)}</span>` : ''}
          ${c.storeDeliveryDate ? `<span style="color:#8b5cf6;font-weight:600">🚚 店届: ${c.storeDeliveryDate.slice(5)}</span>` : ''}
        </div>
        ${milestoneHtml}
        ${c.memo && c.memo.trim() ? `<div class="kanban-card-memo" style="font-size:0.75rem;color:var(--text-muted);background:rgba(241,245,249,0.8);border-left:3px solid var(--primary);padding:4px 8px;margin-top:6px;border-radius:4px;white-space:pre-wrap;word-break:break-word;" title="${c.memo.replace(/"/g, '&quot;')}">📝 ${c.memo.trim()}</div>` : ''}
        ${c.createdAt ? `<div class="kanban-card-date">📋 ${c.createdAt.slice(0, 10)}</div>` : ''}
        ${c.fee ? `<div class="kanban-card-fee">💰 報酬 ${Number(c.fee).toLocaleString()}円${(c.advances||[]).length > 0 ? ` + 立替 ${(c.advances||[]).reduce((s,a)=>s+Number(a.amount||0),0).toLocaleString()}円` : ''}</div>` : ''}
      </div>
    `;
  },

  renderList(cases) {
    const sorted = cases.sort((a, b) => {
      const statusOrder = ['received', 'applying', 'delivery', 'done'];
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
          const deadlineClass = this.getDeadlineClass(c.deadline, c.status);

          // 複数目的地のバッジを組み立て
          const locNames = [];
          if (c.policeLocationId) {
            const loc = Store.getLocationName(c.policeLocationId);
            if (loc) locNames.push(`警察:${loc}`);
          }
          if (c.landTransportLocationId) {
            const loc = Store.getLocationName(c.landTransportLocationId);
            if (loc) locNames.push(`陸局:${loc}`);
          }
          if (locNames.length === 0 && c.locationId) {
            const loc = Store.getLocationName(c.locationId);
            if (loc) locNames.push(loc);
          }
          const locationsHtml = locNames.map(name => `<span>📍 ${name}</span>`).join('');

          let milestoneHtml = '';
          const mIndex = c.milestoneIndex !== undefined ? Number(c.milestoneIndex) : 0;
          const colorVar = c.category === 'seal' ? 'var(--accent-gold)' : 'var(--accent-blue)';
          const bgVar = c.category === 'seal' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)';
          milestoneHtml = `<span style="font-size:0.75rem;color:${colorVar};background:${bgVar};padding:2px 6px;border-radius:4px;margin-left:8px;font-weight:600">🏁 進捗: ${mIndex}/3</span>`;

          return `
                <div class="case-list-item ${deadlineClass}" onclick="Cases.showEditModal('${c.id}')">
                  <div class="case-list-top">
                    <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : ''}</span>
                    ${c.subCategory ? `<span style="font-size:0.75rem;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;color:var(--text-secondary)">${c.subCategory}</span>` : ''}
                    <span class="status-badge status-${c.status}">${statusInfo ? statusInfo.icon + ' ' + statusInfo.label : ''}</span>
                    ${milestoneHtml}
                  </div>
                  <div class="case-list-title">${c.title}</div>
                    <div class="case-list-meta">
                      ${client ? `<span>👤 ${client.name}</span>` : ''}
                      ${c.staffId ? `<span>🏷️ ${Store.getStaffName(c.staffId)}</span>` : ''}
                      ${locationsHtml}
                      ${c.orderNo ? `<span>🎫 ${c.orderNo}</span>` : ''}
                      ${c.createdAt ? `<span>📋 ${c.createdAt.slice(0, 10)}</span>` : ''}
                      ${c.deadline ? `<span>📅 ${c.deadline}</span>` : ''}
                      ${c.registrationDate ? `<span style="color:#d97706;font-weight:600">🚗 登録: ${c.registrationDate.slice(5)}</span>` : ''}
                      ${c.policeDeliveryDate ? `<span style="color:#2563eb;font-weight:600">🚔 交付: ${c.policeDeliveryDate.slice(5)}</span>` : ''}
                      ${c.storeDeliveryDate ? `<span style="color:#8b5cf6;font-weight:600">🚚 店届: ${c.storeDeliveryDate.slice(5)}</span>` : ''}
                      ${c.fee ? `<span>💰 ${Number(c.fee).toLocaleString()}円</span>` : ''}
                    </div>
                  ${c.memo && c.memo.trim() ? `<div class="case-list-memo" style="font-size:0.78rem;color:var(--text-muted);background:rgba(241,245,249,0.8);border-left:3px solid var(--primary);padding:4px 8px;margin-top:6px;border-radius:4px;white-space:pre-wrap;word-break:break-word;">📝 ${c.memo.trim()}</div>` : ''}
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
    const today = Store.getLocalDateStr();
    return `
      <div id="caseModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Cases.closeModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="caseModalTitle">案件登録</h2>
            <button class="modal-close" onclick="Cases.closeModal()">✕</button>
          </div>
          <form id="caseForm" onsubmit="Cases.onSubmit(event)">
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <label>案件名 <span class="required">*</span></label>
                <input type="text" name="title" id="csf_title" required placeholder="例：田中太郎様 車庫証明申請">
              </div>
              <div class="form-group" style="flex:1">
                <label>注文書№</label>
                <input type="text" name="orderNo" id="csf_orderNo" placeholder="例：PO-20260501">
              </div>
            </div>

            <!-- マイルストーン表示エリア -->
            <div id="csf_milestone_stepper_wrap" style="display:none; margin-bottom: 20px;"></div>

            <!-- カテゴリとステータス -->
            <div class="form-row">
              <div class="form-group">
                <label>カテゴリ <span class="required">*</span></label>
                <select name="category" id="csf_category" required class="form-select" onchange="Cases.toggleCategoryFields(this.value); if(!Cases.editingId) CaseTemplates.applyTemplate(this.value)">
                  ${this.CATEGORIES.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>ステータス</label>
                <select name="status" id="csf_status" class="form-select">
                  ${this.STATUSES.map(s => `<option value="${s.key}">${s.icon} ${s.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 登録種別（やること）サブカテゴリ -->
            <div class="form-row" id="csf_subCategory_group" style="display:none">
              <div class="form-group" style="flex:1">
                <label>登録種別（やること）</label>
                <select name="subCategory" id="csf_subCategory" class="form-select" onchange="Cases.onSubCategoryChange(this.value)">
                  ${this.SUB_CATEGORIES.map(sc => `<option value="${sc.key}">${sc.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 申請先、申請日 -->
            <div class="form-row" id="csf_garageDates_group_police_apply">
              <div class="form-group">
                <label>申請先（警察署など）</label>
                <select name="policeLocationId" id="csf_policeLocationId" class="form-select">
                  <option value="">— 未選択 —</option>
                  ${Store.getLocations().map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>申請日</label>
                <input type="date" name="applyDate" id="csf_applyDate" onchange="if(!document.getElementById('csf_policeDeliveryDate').value) document.getElementById('csf_policeDeliveryDate').value = this.value">
              </div>
            </div>

            <!-- 交付日 -->
            <div class="form-row" id="csf_garageDates_group_police_delivery">
              <div class="form-group">
                <label>交付日 <span style="font-size:0.72rem;color:var(--text-muted)">(空欄時は申請日と同日)</span></label>
                <input type="date" name="policeDeliveryDate" id="csf_policeDeliveryDate">
              </div>
            </div>

            <!-- 登録先、登録予定日 -->
            <div class="form-row" id="csf_garageDates_group_land_transport">
              <div class="form-group">
                <label>登録先（陸運支局・軽検協）</label>
                <select name="landTransportLocationId" id="csf_landTransportLocationId" class="form-select">
                  <option value="">— 未選択 —</option>
                  ${Store.getLocations().map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>登録予定日</label>
                <input type="date" name="registrationDate" id="csf_registrationDate">
              </div>
            </div>

            <!-- 店舗届ける予定日、店舗届ける時間帯 -->
            <div class="form-row" id="csf_garageDates_group2">
              <div class="form-group">
                <label>店舗届ける予定日</label>
                <input type="date" name="storeDeliveryDate" id="csf_storeDeliveryDate">
              </div>
              <div class="form-group">
                <label>店舗届ける時間帯</label>
                <input type="text" name="storeDeliveryTime" id="csf_storeDeliveryTime" placeholder="例：午前中、15:00まで">
              </div>
            </div>

            <!-- 顧客店舗、担当者、その他の設定 -->
            <div class="form-row">
              <div class="form-group">
                <label>顧客店舗</label>
                <select name="clientId" id="csf_clientId" class="form-select" onchange="Cases.onClientChange(this.value)">
                  <option value="">未選択</option>
                  ${clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>顧客担当者</label>
                <select name="clientContactId" id="csf_clientContactId" class="form-select">
                  <option value="">— 未選択 —</option>
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
                <label>📍 訪問場所 (共通/予備)</label>
                <select name="locationId" id="csf_locationId" class="form-select">
                  <option value="">— 未選択 —</option>
                  ${Store.getLocations().map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>登録日</label>
                <input type="date" name="registeredAt" id="csf_registeredAt" value="${today}">
              </div>
              <div class="form-group">
                <label>報酬額（円）</label>
                <input type="number" name="fee" id="csf_fee" placeholder="例：30000">
              </div>
            </div>

            <div class="form-group">
              <label>📁 Google Drive 案件フォルダURL</label>
              <div style="display:flex;gap:8px">
                <input type="url" name="driveFolderUrl" id="csf_driveFolderUrl" placeholder="https://drive.google.com/drive/folders/..." style="flex:1">
                <button type="button" class="btn btn-secondary" onclick="const url=document.getElementById('csf_driveFolderUrl').value; if(url) window.open(url, '_blank'); else alert('URLが入力されていません');">🔗 開く</button>
              </div>
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
              <label>📝 メモ・特記事項</label>
              <textarea name="memo" id="csf_memo" rows="4" style="min-height:110px;resize:vertical;font-size:0.88rem;line-height:1.5;width:100%;box-sizing:border-box" placeholder="案件に関するメモ、特記事項、連絡事項など..."></textarea>
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

  onSubCategoryChange(val) {
    if (!val) return;
    const titleInput = document.getElementById('csf_title');
    if (titleInput && (!titleInput.value || titleInput.value.startsWith('【'))) {
      const clientSelect = document.getElementById('csf_clientId');
      const clientName = clientSelect && clientSelect.selectedIndex > 0 ? clientSelect.options[clientSelect.selectedIndex].text : '';
      titleInput.value = `【${val}】${clientName ? clientName + ' ' : ''}`;
    }
  },

  getDeadlineClass(deadline, status) {
    if (!deadline || status === 'done' || status === 'applying') return '';
    const diff = Store.getDiffDays(deadline);
    if (diff < 0) return 'deadline-overdue';
    if (diff <= 3) return 'deadline-urgent';
    if (diff <= 7) return 'deadline-soon';
    return '';
  },

  onClientChange(clientId, preSelectContactId) {
    const sel = document.getElementById('csf_clientContactId');
    if (!sel) return;
    const contacts = clientId ? Store.getClientContacts(clientId) : [];
    sel.innerHTML = '<option value="">— 未選択 —</option>' +
      contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (preSelectContactId) sel.value = preSelectContactId;
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

  showAddModal(prefills) {
    this.editingId = null;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('caseModalTitle').textContent = '案件登録';
      document.getElementById('caseForm').reset();
      document.getElementById('caseDeleteBtn').style.display = 'none';
      document.getElementById('caseModal').style.display = 'flex';
      this.advanceDraft = [];
      this.renderAdvanceRows();
      // 顧客担当者リストをリセット
      this.onClientChange('');

      // 注文書№ 自動連番付与 (PO-YYYYMMDD-XXX)
      const nextNum = Store.getCases().length + 1;
      const yyyymmdd = Store.getLocalDateStr().replace(/-/g, '');
      const autoOrderNo = `PO-${yyyymmdd}-${String(nextNum).padStart(3, '0')}`;
      document.getElementById('csf_orderNo').value = autoOrderNo;

      // 受信FAX/メールインボックスからの自動入力（プリフィル）
      if (prefills) {
        if (prefills.title) document.getElementById('csf_title').value = prefills.title;
        if (prefills.clientId) {
          document.getElementById('csf_clientId').value = prefills.clientId;
          this.onClientChange(prefills.clientId);
        }
        if (prefills.category) document.getElementById('csf_category').value = prefills.category;
        if (prefills.carPolice) document.getElementById('csf_carPolice').value = prefills.carPolice;
        if (prefills.memo) document.getElementById('csf_memo').value = prefills.memo;
        
        let faxInput = document.getElementById('csf_faxId');
        if (!faxInput) {
          faxInput = document.createElement('input');
          faxInput.type = 'hidden';
          faxInput.name = 'faxId';
          faxInput.id = 'csf_faxId';
          document.getElementById('caseForm').appendChild(faxInput);
        }
        faxInput.value = prefills.faxId || '';

        let inboxInput = document.getElementById('csf_inboxId');
        if (!inboxInput) {
          inboxInput = document.createElement('input');
          inboxInput.type = 'hidden';
          inboxInput.name = 'inboxId';
          inboxInput.id = 'csf_inboxId';
          document.getElementById('caseForm').appendChild(inboxInput);
        }
        inboxInput.value = prefills.inboxId || '';
      } else {
        const faxInput = document.getElementById('csf_faxId');
        if (faxInput) faxInput.value = '';
        const inboxInput = document.getElementById('csf_inboxId');
        if (inboxInput) inboxInput.value = '';
      }
      const wrap = document.getElementById('csf_milestone_stepper_wrap');
      if (wrap) wrap.style.display = 'none';
      Cases.toggleCategoryFields(document.getElementById('csf_category').value);
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
      document.getElementById('csf_orderNo').value = c.orderNo || '';
      document.getElementById('csf_clientId').value = c.clientId || '';
      Cases.onClientChange(c.clientId || '', c.clientContactId || '');
      document.getElementById('csf_staffId').value = c.staffId || '';
      document.getElementById('csf_registeredAt').value = c.registeredAt || c.createdAt?.slice(0, 10) || '';
      document.getElementById('csf_category').value = c.category;
      const subCatEl = document.getElementById('csf_subCategory');
      if (subCatEl) subCatEl.value = c.subCategory || '';
      document.getElementById('csf_status').value = c.status;
      const deadlineEl = document.getElementById('csf_deadline');
      if (deadlineEl) deadlineEl.value = c.deadline || '';
      document.getElementById('csf_driveFolderUrl').value = c.driveFolderUrl || '';
      document.getElementById('csf_fee').value = c.fee || '';
      const locSel = document.getElementById('csf_locationId');
      if (locSel) locSel.value = c.locationId || '';
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

      // カテゴリに応じたフィールド表示制御
      Cases.toggleCategoryFields(c.category);

      const deathDateEl = document.getElementById('csf_deathDate');
      if (deathDateEl) deathDateEl.value = c.deathDate || '';

      const surveyDateEl = document.getElementById('csf_surveyDate');
      if (surveyDateEl) surveyDateEl.value = c.surveyDate || '';
      const surveyLocationIdEl = document.getElementById('csf_surveyLocationId');
      if (surveyLocationIdEl) surveyLocationIdEl.value = c.surveyLocationId || '';
      const applyDateEl = document.getElementById('csf_applyDate');
      if (applyDateEl) applyDateEl.value = c.applyDate || '';
      const policeDeliveryDateEl = document.getElementById('csf_policeDeliveryDate');
      if (policeDeliveryDateEl) policeDeliveryDateEl.value = c.policeDeliveryDate || '';
      const policeLocationIdEl = document.getElementById('csf_policeLocationId');
      if (policeLocationIdEl) policeLocationIdEl.value = c.policeLocationId || '';
      const registrationDateEl = document.getElementById('csf_registrationDate');
      if (registrationDateEl) registrationDateEl.value = c.registrationDate || '';
      const landTransportLocationIdEl = document.getElementById('csf_landTransportLocationId');
      if (landTransportLocationIdEl) landTransportLocationIdEl.value = c.landTransportLocationId || '';
      const storeDeliveryDateEl = document.getElementById('csf_storeDeliveryDate');
      if (storeDeliveryDateEl) storeDeliveryDateEl.value = c.storeDeliveryDate || '';
      const storeDeliveryTimeEl = document.getElementById('csf_storeDeliveryTime');
      if (storeDeliveryTimeEl) storeDeliveryTimeEl.value = c.storeDeliveryTime || '';

      // マイルストーン表示制御
      Cases.renderMilestoneStepper(id);

      // 対応履歴・チェックリスト・期限アラートを追加
      const extArea = document.getElementById('caseExtArea');
      if (extArea) {
        let extHtml = '';
        
        // 所在図・配置図（地図メーカー）ウィジェットを最上部に追加
        extHtml += Cases.renderMapWidget(id);

        // 書類添付パネル
        if (typeof CaseDocs !== 'undefined') {
          extHtml += CaseDocs.renderPanel(id);
        }
        extHtml += DocChecklist.renderChecklist(id) + ActivityLog.renderWidget('case', id);
        if (c.category === 'inheritance' && c.deathDate && typeof InheritanceDeadlines !== 'undefined') {
          extHtml = InheritanceDeadlines.renderDeadlinePanel(c.deathDate) + extHtml;
        }
        if (c.category === 'inheritance') {
          extHtml = `
            <div class="checklist-widget" style="margin-top:12px; border-left:4px solid var(--accent-purple); padding:12px; border-radius:6px; background:rgba(139,92,246,0.03); border:1px solid var(--border-color)">
              <h4 style="margin:0 0 8px;font-size:0.9rem">🌳 相続関係説明図</h4>
              <button type="button" class="btn btn-secondary btn-small" onclick="FamilyTreeMaker.show('${id}')" style="width:100%;font-weight:600">関係図エディタを開く</button>
            </div>
          ` + extHtml;
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
      orderNo: form.orderNo ? form.orderNo.value.trim() : '',
      clientId: form.clientId.value,
      clientContactId: form.clientContactId ? form.clientContactId.value : '',
      staffId: form.staffId.value,
      locationId: form.locationId ? form.locationId.value : '',
      registeredAt: form.registeredAt.value,
      category: form.category.value,
      subCategory: form.subCategory ? form.subCategory.value : '',
      status: form.status.value,
      deadline: (form.deadline && form.deadline.value) ? form.deadline.value : '',
      driveFolderUrl: form.driveFolderUrl.value.trim(),
      fee: form.fee.value,
      advances: this.advanceDraft.filter(a => a.label || Number(a.amount) > 0),
      applyDate: form.applyDate ? form.applyDate.value : '',
      policeDeliveryDate: (form.policeDeliveryDate && form.policeDeliveryDate.value) ? form.policeDeliveryDate.value : (form.applyDate ? form.applyDate.value : ''),
      policeLocationId: form.policeLocationId ? form.policeLocationId.value : '',
      registrationDate: form.registrationDate ? form.registrationDate.value : '',
      landTransportLocationId: form.landTransportLocationId ? form.landTransportLocationId.value : '',
      carName: form.carName ? form.carName.value.trim() : '',
      carAddress: form.carAddress ? form.carAddress.value.trim() : '',
      carNumber: form.carNumber ? form.carNumber.value.trim() : '',
      carPolice: form.carPolice ? form.carPolice.value.trim() : '',
      faxId: document.getElementById('csf_faxId') ? document.getElementById('csf_faxId').value : '',
      inboxId: document.getElementById('csf_inboxId') ? document.getElementById('csf_inboxId').value : '',
      memo: form.memo.value.trim(),
    };

    // マイルストーン同期ロジック (全カテゴリ)
    let milestoneVal = 0;
    const totalSteps = 3;

    if (this.editingId) {
      const existing = Store.getCase(this.editingId);
      const oldMilestone = (existing && existing.milestoneIndex !== undefined) ? Number(existing.milestoneIndex) : 0;
      
      if (existing && existing.category !== data.category) {
        milestoneVal = data.status === 'done' ? totalSteps : 0;
      } else {
        if (data.status === 'done') {
          milestoneVal = totalSteps;
        } else if (existing && existing.status === 'done' && data.status !== 'done') {
          milestoneVal = totalSteps - 1; // 完了から戻した場合は1段階戻す
        } else {
          milestoneVal = oldMilestone;
        }
      }
    } else {
      milestoneVal = data.status === 'done' ? totalSteps : 0;
    }
    data.milestoneIndex = milestoneVal;

    let savedCase;
    if (this.editingId) {
      savedCase = Store.updateCase(this.editingId, data);
    } else {
      savedCase = Store.addCase(data);
      // インボックスからの移行の場合、ステータスを対応済に更新
      if (data.inboxId && typeof Store.updateInboxStatus === 'function') {
        Store.updateInboxStatus(data.inboxId, '対応済', savedCase.id);
      }
    }

    // フォルダ未作成の場合は裏側でGAS連携してフォルダ作成
    if (!data.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      const client = Store.getClient(savedCase.clientId);
      const clientName = client ? (client.companyName || client.name) : 'お客様';
      const folderData = {
        ...savedCase,
        clientName: clientName
      };
      
      // 非同期で実行（UIはブロックしない）
      SpreadsheetSync.push('createCaseFolder', folderData).then(res => {
        if (res && res.success && res.folderUrl) {
          Store.updateCase(savedCase.id, { driveFolderUrl: res.folderUrl });
          App.refreshView();
        }
      }).catch(err => console.warn('Google Drive フォルダ自動生成に失敗しました:', err));
    }

    // Googleカレンダーへ案件日程を自動同期
    this.syncCaseDatesToCalendar(savedCase);

    this.closeModal();
    App.refreshView();
    App.showToast(this.editingId ? '案件を更新しました' : '案件を登録しました');
  },

  // 案件の各日程をGoogleカレンダーに自動同期する（Promiseを返す）
  syncCaseDatesToCalendar(caseData) {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) return Promise.resolve();
    
    // 最新の案件データを読み直す（calendarEventIdsが更新されている可能性）
    const latestCase = Store.getCase(caseData.id) || caseData;

    // 日付が1つも設定されていなければスキップ
    const hasAnyDate = latestCase.surveyDate || latestCase.applyDate || 
                       latestCase.policeDeliveryDate || latestCase.storeDeliveryDate || 
                       latestCase.registrationDate;
    const hasExistingIds = latestCase.calendarEventIds && Object.values(latestCase.calendarEventIds).some(id => id);
    
    if (!hasAnyDate && !hasExistingIds) return Promise.resolve();

    const client = Store.getClient(latestCase.clientId);
    const clientName = client ? (client.companyName || client.name) : '';

    const resolveLoc = (locId) => {
      if (!locId) return '';
      const loc = Store.getLocation(locId);
      return loc ? loc.name : '';
    };

    const syncData = {
      caseId: latestCase.id,
      caseTitle: latestCase.title,
      clientName: clientName,
      calendarEventIds: latestCase.calendarEventIds || {},
      surveyDate: latestCase.surveyDate || '',
      applyDate: latestCase.applyDate || '',
      policeDeliveryDate: latestCase.policeDeliveryDate || '',
      storeDeliveryDate: latestCase.storeDeliveryDate || '',
      storeDeliveryTime: latestCase.storeDeliveryTime || '',
      registrationDate: latestCase.registrationDate || '',
      surveyLocationName: resolveLoc(latestCase.surveyLocationId),
      policeLocationName: resolveLoc(latestCase.policeLocationId),
      locationName: resolveLoc(latestCase.locationId),
      landTransportLocationName: resolveLoc(latestCase.landTransportLocationId),
    };

    return SpreadsheetSync.push('syncCaseCalendar', syncData).then(res => {
      if (res && res.success && res.calendarEventIds) {
        // calendarEventIdsの保存はlocalStorageに直接書き込む
        // （Store.updateCaseを使うとupsertCaseがGASに再送されてawaitが崩れるため）
        const cases = JSON.parse(localStorage.getItem('gyosei_cases') || '[]');
        const idx = cases.findIndex(c => c.id === latestCase.id);
        if (idx !== -1) {
          cases[idx].calendarEventIds = res.calendarEventIds;
          localStorage.setItem('gyosei_cases', JSON.stringify(cases));
        }
        console.log('📅 タスク同期完了:', latestCase.title, res.calendarEventIds);
      }
    }).catch(err => console.warn('案件タスク同期に失敗:', err));
  },

  // 全案件を一括でGoogleカレンダーに同期（応答を待ってから次へ進む）
  async syncAllCasesToCalendar() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚠️ スプレッドシート連携が未設定です');
      return;
    }
    const allCases = Store.getCases().filter(c => c.status !== 'done');
    const targets = allCases.filter(c =>
      c.surveyDate || c.applyDate || c.policeDeliveryDate || c.storeDeliveryDate || c.registrationDate
    );

    if (targets.length === 0) {
      App.showToast('日程が設定されている案件がありません');
      return;
    }

    if (!confirm(`進行中の ${targets.length} 件の案件日程をGoogleカレンダーに一括同期します。\nよろしいですか？`)) return;

    App.showToast(`📅 ${targets.length} 件の案件を同期中...しばらくお待ちください`);
    let successCount = 0;

    for (const c of targets) {
      try {
        // GASの応答を完全に待ってからcalendarEventIdsを保存 → 次へ
        await this.syncCaseDatesToCalendar(c);
        successCount++;
      } catch (err) {
        console.warn(`案件 ${c.title} の同期に失敗:`, err);
      }
    }

    App.showToast(`📅 ${successCount}/${targets.length} 件の案件をカレンダーに同期しました！`);
  },

  onDelete() {
    if (!this.editingId) return;
    if (confirm('この案件を削除してもよろしいですか？')) {
      const existing = Store.getCase(this.editingId);
      
      // Googleカレンダーから案件の予定を一括削除
      if (existing && existing.calendarEventIds && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
        const hasIds = Object.values(existing.calendarEventIds).some(id => id);
        if (hasIds) {
          SpreadsheetSync.push('deleteCaseCalendarEvents', {
            calendarEventIds: existing.calendarEventIds
          }).then(res => {
            if (res && res.success) console.log('📅 案件のカレンダー予定を一括削除しました');
          }).catch(err => console.warn('案件カレンダー削除に失敗:', err));
        }
      }
      
      Store.deleteCase(this.editingId);
      this.closeModal();
      App.refreshView();
      App.showToast('案件を削除しました');
    }
  },

  toggleCategoryFields(category) {
    const isCarReg = ['car_reg_standard', 'car_reg_light'].includes(category);
    const subCatGroup = document.getElementById('csf_subCategory_group');
    if (subCatGroup) subCatGroup.style.display = isCarReg ? '' : 'none';

    // マイルストーン表示の動的切り替え
    const wrap = document.getElementById('csf_milestone_stepper_wrap');
    if (wrap) {
      if (this.editingId) {
        this.renderMilestoneStepper(this.editingId);
      } else {
        wrap.style.display = 'none';
      }
    }
  },

  renderMilestoneStepper(caseId) {
    const wrap = document.getElementById('csf_milestone_stepper_wrap');
    if (!wrap) return;
    const c = Store.getCase(caseId);
    if (!c) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';

    let steps = [];
    if (c.category === 'seal') {
      steps = ['書類受領', '日程調整', '施封完了'];
    } else if (['car_reg_standard', 'car_reg_light'].includes(c.category)) {
      steps = ['書類確認', '陸事申請/登録', '納品完了'];
    } else {
      steps = ['配置図作成', '警察署申請', '交付受取'];
    }

    const totalSteps = steps.length;
    const mIndex = c.milestoneIndex !== undefined ? Number(c.milestoneIndex) : 0;
    
    let pct = 0;
    if (mIndex > 0) {
      pct = Math.round(((mIndex - 1) / (totalSteps - 1)) * 100);
      if (mIndex === totalSteps) pct = 100;
    }
    
    const activeColor = c.category === 'seal' ? 'var(--accent-gold)' : 'var(--accent-blue)';

    wrap.innerHTML = `
      <label style="font-size:0.8rem;color:var(--text-secondary);font-weight:600">🏁 進捗マイルストーン (クリックして進捗を更新)</label>
      <div class="milestone-stepper">
        <div class="stepper-line">
          <div class="stepper-line-fill" style="width:${pct}%; background-color:${activeColor}"></div>
        </div>
        ${steps.map((label, idx) => {
          const isCompleted = idx < mIndex;
          const isActive = idx === mIndex || (mIndex === totalSteps && idx === totalSteps - 1);
          let stateClass = '';
          if (isActive) stateClass = 'active';
          else if (isCompleted) stateClass = 'completed';
          
          return `
            <div class="step-node ${stateClass}" onclick="Cases.setMilestone('${caseId}', ${idx + 1})">
              <div class="step-circle" style="${isActive || isCompleted ? `border-color:${activeColor}; color:${isActive ? '#fff' : activeColor}; background-color:${isActive ? activeColor : 'var(--bg-card)'}` : ''}">${idx + 1}</div>
              <div class="step-label" style="${isActive ? `color:var(--text-primary); font-weight:700` : ''}">${label}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  setMilestone(caseId, milestoneVal) {
    const c = Store.getCase(caseId);
    if (!c) return;

    const totalSteps = 3;
    const updates = { milestoneIndex: milestoneVal };
    if (milestoneVal === totalSteps) {
      updates.status = 'done';
    } else {
      if (c.status === 'done') {
        updates.status = 'applying'; // Doneから戻した場合は申請中にする
      }
    }
    Store.updateCase(caseId, updates);
    this.renderMilestoneStepper(caseId);
    
    // フォームが開いていたらステータスプルダウンも同期
    const statusSel = document.getElementById('csf_status');
    if (statusSel && updates.status) {
      statusSel.value = updates.status;
    }
    
    App.showToast(`マイルストーンを更新しました: ${milestoneVal}/${totalSteps}`);
    App.refreshView();
  },

  renderMapWidget(caseId) {
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId);
    
    let mapPreviewHtml = '';
    if (mapPng) {
      mapPreviewHtml = `
        <div style="margin-bottom:8px; border:1px solid var(--border-color); border-radius:4px; overflow:hidden; background:white; display:flex; align-items:center; justify-content:center; max-height:160px; padding:4px">
          <img src="${mapPng}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:2px;" />
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-secondary btn-small" onclick="window.open('map-maker/index.html?caseId=${caseId}', '_blank')" style="flex:1; font-size:0.75rem; padding:4px 8px;">🗺️ 再編集</button>
          <button type="button" class="btn btn-secondary btn-small" onclick="Cases.downloadAttachedMap('${caseId}')" style="flex:1; font-size:0.75rem; padding:4px 8px;">📥 保存</button>
          <button type="button" class="btn btn-danger btn-small" onclick="Cases.deleteAttachedMap('${caseId}')" style="font-size:0.75rem; padding:4px 8px;" title="削除">🗑️</button>
        </div>
      `;
    } else {
      mapPreviewHtml = `
        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">
          車庫証明の所在図・配置図をブラウザ上で簡単に作成し、この案件へ添付できます。
        </p>
        <button type="button" class="btn btn-secondary btn-small" onclick="window.open('map-maker/index.html?caseId=${caseId}', '_blank')" style="width:100%; font-weight:600; font-size:0.78rem; padding:6px">
          🗺️ 地図メーカーで図面を作成
        </button>
      `;
    }

    return `
      <div class="checklist-widget" style="margin-top:12px; border-left:4px solid var(--accent-orange); padding:12px; border-radius:6px; background:rgba(249,115,22,0.02); border:1px solid var(--border-color)">
        <h4 style="margin:0 0 8px; font-size:0.88rem; display:flex; align-items:center; gap:6px; color:var(--text-dark)">
          🗺️ 所在図・配置図
        </h4>
        ${mapPreviewHtml}
      </div>
    `;
  },

  downloadAttachedMap(caseId) {
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId);
    if (!mapPng) return;
    const a = document.createElement('a');
    a.href = mapPng;
    a.download = `case_${caseId}_map.png`;
    a.click();
  },

  deleteAttachedMap(caseId) {
    if (confirm('添付された地図を削除しますか？\n（ベクター作成データも消去されます）')) {
      localStorage.removeItem('gyosei_case_map_png_' + caseId);
      localStorage.removeItem('gyosei_case_map_vector_' + caseId);
      Cases.showEditModal(caseId); // Reload modal
      App.showToast('地図を削除しました');
    }
  }
};

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'MAP_SAVED') {
    const { caseId, mapDataUrl } = e.data;
    if (typeof Cases !== 'undefined' && Cases.editingId === caseId) {
      Cases.showEditModal(caseId);
      App.showToast('✅ 地図が保存されました');
    }
  }
});
