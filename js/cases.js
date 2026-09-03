/**
 * 案件管理画面
 */
const Cases = {
  filterCategory: 'all',
  filterStatus: 'all',
  filterMapStatus: 'all', // 'all' | 'uncreated' (車庫証明の図面未作成)
  searchQuery: '',        // 検索クエリ (申請者名・車台番号・ナンバー・注文書No等)
  editingId: null,
  advanceDraft: [],  // 立替金一時データ [{label, amount}]

  // 車庫証明案件判定
  isSyakoCase(c) {
    if (!c || !c.category) return false;
    return c.category === 'garage_oss' || c.category === 'garage_paper' || c.category.includes('garage');
  },

  // 案件の所在図・配置図データ存在判定
  hasMapData(caseId) {
    if (!caseId) return false;
    return !!(localStorage.getItem('syako_case_map_' + caseId) || localStorage.getItem('gyosei_case_map_png_' + caseId));
  },

  // 図面未作成クイックフィルター切り替え
  toggleMapFilter() {
    this.filterMapStatus = this.filterMapStatus === 'uncreated' ? 'all' : 'uncreated';
    App.refreshView();
  },

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

  onSearchInput(val) {
    this.searchQuery = val;
    const container = document.getElementById('casesMainContainer');
    if (container) {
      const filtered = this.getFilteredCases();
      const isMobile = window.innerWidth < 768;
      container.innerHTML = isMobile ? this.renderList(filtered) : this.renderKanban(filtered);
    } else {
      App.refreshView();
    }
  },

  clearSearch() {
    this.searchQuery = '';
    const input = document.getElementById('caseSearchInput');
    if (input) input.value = '';
    App.refreshView();
  },

  getFilteredCases() {
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

    // 図面未作成クイックフィルター適用
    if (this.filterMapStatus === 'uncreated') {
      filtered = filtered.filter(c => this.isSyakoCase(c) && !this.hasMapData(c.id));
    }

    // キーワード検索フィルター（申請者名・車台番号・ナンバー・旧ナンバー・注文書No・メモ・顧客名・住所等）
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => {
        const client = Store.getClient(c.clientId);
        const clientName = client ? client.name.toLowerCase() : '';
        const staffName = c.staffId ? (Store.getStaffName(c.staffId) || '').toLowerCase() : '';
        return (
          (c.title || '').toLowerCase().includes(q) ||
          (c.carName || '').toLowerCase().includes(q) ||
          (c.applicantName || '').toLowerCase().includes(q) ||
          (c.orderNo || '').toLowerCase().includes(q) ||
          (c.carNumber || '').toLowerCase().includes(q) ||
          (c.oldCarNumber || '').toLowerCase().includes(q) ||
          (c.vin || '').toLowerCase().includes(q) ||
          (c.carAddress || '').toLowerCase().includes(q) ||
          (c.parkingAddress || '').toLowerCase().includes(q) ||
          (c.carPolice || '').toLowerCase().includes(q) ||
          (typeof c.memo === 'string' && c.memo.toLowerCase().includes(q)) ||
          (c.subCategory || '').toLowerCase().includes(q) ||
          clientName.includes(q) ||
          staffName.includes(q)
        );
      });
    }

    return filtered;
  },

  render() {
    const cases = Store.getCases();
    const filtered = this.getFilteredCases();

    // 進行中の車庫証明案件のうち、図面未作成の件数を集計
    const activeGarageCases = cases.filter(c => c.status !== 'done' && this.isSyakoCase(c));
    const uncreatedMapCount = activeGarageCases.filter(c => !this.hasMapData(c.id)).length;

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

        <div class="filter-bar" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <!-- 🔍 キーワード検索ボックス -->
          <div class="filter-group" style="position:relative; flex:1; min-width:220px; max-width:380px;">
            <input type="text" id="caseSearchInput" class="filter-input" placeholder="🔍 申請者名・車台・ナンバー・注文書No等..."
              value="${this.searchQuery}" oninput="Cases.onSearchInput(this.value)"
              style="width:100%; padding:6px 28px 6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card,#fff); color:var(--text-color); font-size:0.85rem;">
            ${this.searchQuery ? `<button type="button" onclick="Cases.clearSearch()" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem;" title="検索クリア">✕</button>` : ''}
          </div>

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
          <div class="filter-group" style="margin-left:auto;">
            <button type="button" class="btn btn-small" onclick="Cases.toggleMapFilter()"
              title="車庫証明の所在図・配置図が未作成の案件のみを絞り込み表示"
              style="font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:6px; transition:all 0.2s; ${this.filterMapStatus === 'uncreated' ? 'background:#fef3c7; color:#b45309; border:1.5px solid #f59e0b; font-weight:bold; box-shadow:0 1px 3px rgba(245,158,11,0.2);' : 'background:var(--bg-card, #fff); border:1px solid var(--border-color); color:var(--text-secondary);'}">
              <span>🗺️ 図面未作成</span>
              ${uncreatedMapCount > 0 
                ? `<span style="background:#ef4444; color:white; border-radius:10px; padding:1px 6px; font-size:0.72rem; font-weight:bold;">${uncreatedMapCount}</span>` 
                : '<span style="color:var(--text-muted); font-size:0.72rem;">(0)</span>'}
            </button>
          </div>
        </div>

        <div id="casesMainContainer">
          ${isMobile ? this.renderList(filtered) : this.renderKanban(filtered)}
        </div>
      </div>
      ${this.renderModal()}
    `;
  },
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
    const container = document.getElementById('advancesRowsContainer') || document.getElementById('csf_advance_rows');
    if (!container) return;
    if (!this.advanceDraft || this.advanceDraft.length === 0) {
      container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted, #94a3b8); padding:4px 0;">立替金（証紙代・印紙代・プレート代等）がある場合は「＋ 追加」またはプリセットを押してください</div>`;
      return;
    }
    container.innerHTML = this.advanceDraft.map((adv, i) => `
      <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
        <input type="text" placeholder="内容（例：車庫証明 証紙代）" value="${adv.label || ''}"
          style="flex:2; font-size:0.85rem;" data-adv-idx="${i}" data-adv-field="label"
          oninput="Cases.onAdvInput(this)">
        <input type="number" placeholder="金額（円）" value="${adv.amount !== undefined ? adv.amount : ''}"
          style="flex:1.2; font-size:0.85rem;" data-adv-idx="${i}" data-adv-field="amount"
          oninput="Cases.onAdvInput(this)">
        <button type="button" class="btn btn-secondary btn-small" style="flex-shrink:0; padding:2px 8px; color:#ef4444; border-color:rgba(239,68,68,0.3);"
          onclick="Cases.removeAdvanceRow(${i})" title="削除">✕</button>
      </div>
    `).join('');
  },

  addAdvanceRow(label = '', amount = '') {
    if (!this.advanceDraft) this.advanceDraft = [];
    this.advanceDraft.push({ label: label, amount: amount });
    this.renderAdvanceRows();
  },

  removeAdvanceRow(i) {
    if (!this.advanceDraft) return;
    this.advanceDraft.splice(i, 1);
    this.renderAdvanceRows();
  },

  onAdvInput(el) {
    const i = parseInt(el.dataset.advIdx, 10);
    const field = el.dataset.advField;
    if (!this.advanceDraft) this.advanceDraft = [];
    if (!this.advanceDraft[i]) this.advanceDraft[i] = { label: '', amount: '' };
    this.advanceDraft[i][field] = field === 'amount' ? (el.value === '' ? '' : Number(el.value)) : el.value;
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

    // 車庫証明の所在図・配置図バッジ判定
    let syakoMapBadgeHtml = '';
    if (this.isSyakoCase(c)) {
      const hasMap = this.hasMapData(c.id);
      syakoMapBadgeHtml = hasMap
        ? `<span class="syako-map-badge map-done" onclick="event.stopPropagation(); Cases.openSyakoMapMaker('${c.id}')" title="クリックで作図ツールを開く（作成済）" style="font-size:0.7rem; background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:4px; padding:1px 6px; font-weight:600; cursor:pointer; margin-left:4px; display:inline-flex; align-items:center; gap:2px;">🟢 図面済</span>`
        : `<span class="syako-map-badge map-pending" onclick="event.stopPropagation(); Cases.openSyakoMapMaker('${c.id}')" title="クリックで作図ツールを起動（未作成）" style="font-size:0.7rem; background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:4px; padding:1px 6px; font-weight:bold; cursor:pointer; margin-left:4px; display:inline-flex; align-items:center; gap:2px;">🟡 図面未作成</span>`;
    }

    return `
      <div class="kanban-card ${deadlineClass}" draggable="true"
        ondragstart="event.dataTransfer.setData('text/plain','${c.id}')"
        onclick="Cases.showEditModal('${c.id}')">
        <div class="kanban-card-cat" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
          <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : c.category}</span>
          ${c.subCategory ? `<span style="font-size:0.7rem;background:rgba(0,0,0,0.05);padding:1px 5px;border-radius:3px;color:var(--text-secondary)">${c.subCategory}</span>` : ''}
          ${syakoMapBadgeHtml}
        </div>
        <div class="kanban-card-title">${c.title}</div>
        <div class="kanban-card-meta">
          ${client ? `<span>🏢 ${client.name}</span>` : ''}
          ${c.carName ? `<span style="color:#0369a1; font-weight:600">👤 ${c.carName} 様</span>` : ''}
          ${(c.carNumber || c.oldCarNumber || c.vin) ? `<span style="font-size:0.75rem; color:var(--text-secondary)">🚗 ${c.carNumber || c.oldCarNumber || ''}${c.vin ? ` (${c.vin})` : ''}</span>` : ''}
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
        ${(c.memo && typeof c.memo === 'string' && c.memo.trim()) ? `<div class="kanban-card-memo" style="font-size:0.75rem;color:var(--text-muted);background:rgba(241,245,249,0.8);border-left:3px solid var(--primary);padding:4px 8px;margin-top:6px;border-radius:4px;white-space:pre-wrap;word-break:break-word;" title="${String(c.memo).replace(/"/g, '&quot;')}">📝 ${String(c.memo).trim()}</div>` : ''}
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

          // 車庫証明の所在図・配置図バッジ判定
          let syakoMapBadgeHtml = '';
          if (this.isSyakoCase(c)) {
            const hasMap = this.hasMapData(c.id);
            syakoMapBadgeHtml = hasMap
              ? `<span class="syako-map-badge map-done" onclick="event.stopPropagation(); Cases.openSyakoMapMaker('${c.id}')" title="クリックで作図ツールを開く（作成済）" style="font-size:0.75rem; background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:4px; padding:2px 6px; font-weight:600; cursor:pointer; margin-left:6px; display:inline-flex; align-items:center; gap:2px;">🟢 図面済</span>`
              : `<span class="syako-map-badge map-pending" onclick="event.stopPropagation(); Cases.openSyakoMapMaker('${c.id}')" title="クリックで作図ツールを起動（未作成）" style="font-size:0.75rem; background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:4px; padding:2px 6px; font-weight:bold; cursor:pointer; margin-left:6px; display:inline-flex; align-items:center; gap:2px;">🟡 図面未作成</span>`;
          }

          return `
                <div class="case-list-item ${deadlineClass}" onclick="Cases.showEditModal('${c.id}')">
                  <div class="case-list-top">
                    <span class="category-tag category-${c.category}">${catLabel ? catLabel.label : ''}</span>
                    ${c.subCategory ? `<span style="font-size:0.75rem;background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;color:var(--text-secondary)">${c.subCategory}</span>` : ''}
                    ${syakoMapBadgeHtml}
                    <span class="status-badge status-${c.status}">${statusInfo ? statusInfo.icon + ' ' + statusInfo.label : ''}</span>
                    ${milestoneHtml}
                  </div>
                  <div class="case-list-title">${c.title}</div>
                    <div class="case-list-meta">
                      ${client ? `<span>🏢 ${client.name}</span>` : ''}
                      ${c.carName ? `<span style="color:#0369a1; font-weight:600">👤 ${c.carName} 様</span>` : ''}
                      ${(c.carNumber || c.oldCarNumber || c.vin) ? `<span style="color:var(--text-secondary)">🚗 ${c.carNumber || c.oldCarNumber || ''}${c.vin ? ` (${c.vin})` : ''}</span>` : ''}
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
                  ${(c.memo && typeof c.memo === 'string' && c.memo.trim()) ? `<div class="case-list-memo" style="font-size:0.78rem;color:var(--text-muted);background:rgba(241,245,249,0.8);border-left:3px solid var(--primary);padding:4px 8px;margin-top:6px;border-radius:4px;white-space:pre-wrap;word-break:break-word;">📝 ${String(c.memo).trim()}</div>` : ''}
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
        <div class="modal-content" id="caseModalContent" style="max-width: 720px; width: 94%; max-height: 92vh; display:flex; flex-direction:column; transition: max-width 0.25s ease;">
          <div class="modal-header" style="flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 id="caseModalTitle" style="margin:0;">案件登録</h2>
              <button type="button" id="casePreviewToggleBtn" class="btn btn-secondary btn-small" style="display:none; font-size:0.75rem; padding:3px 8px;" onclick="Cases.toggleAttachmentSplitView()">
                📑 添付プレビュー切替
              </button>
            </div>
            <button class="modal-close" onclick="Cases.closeModal()">✕</button>
          </div>

          <div id="caseModalSplitBody" style="display:flex; gap:16px; flex:1; min-height:0; overflow:hidden; padding: 4px 0;">
            
            <!-- ─── 👈 左側: 添付ファイルプレビューワー（FAX・依頼書・車検証） ─── -->
            <div id="caseAttachmentPane" style="display:none; flex:1.3; min-width:340px; background:var(--bg-secondary, #0f172a); border:1px solid var(--border-color, #334155); border-radius:8px; overflow:hidden; flex-direction:column; max-height:78vh; transition: flex 0.2s ease;">
              <!-- ツールバー / ページタブ -->
              <div style="background:rgba(0,0,0,0.3); border-bottom:1px solid var(--border-color, #334155); padding:6px 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; flex-shrink:0;">
                <div id="caseAttTabs" style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                  <span style="font-size:0.75rem; font-weight:bold; color:var(--accent-gold, #f59e0b);">📄 添付:</span>
                  <div id="caseAttTabList" style="display:flex; gap:4px; flex-wrap:wrap;"></div>
                </div>
                <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 7px; font-size:0.75rem; font-weight:bold; background:#1e293b; border-color:#475569;" onclick="Cases.rotateViewer()" title="90度回転（横向き・縦向き切り替え）">🔄 90°回転</button>
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem; background:#1e293b; border-color:#475569;" onclick="Cases.fitWidthViewer()" title="横幅に合わせて最大フィット">↕ 幅フィット</button>
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem;" onclick="Cases.zoomViewer(0.25)" title="拡大">🔍＋</button>
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem;" onclick="Cases.zoomViewer(-0.25)" title="縮小">🔍−</button>
                  <button type="button" class="btn btn-secondary btn-small" id="caseViewerWideBtn" style="padding:2px 7px; font-size:0.75rem; color:#38bdf8; border-color:#0284c7;" onclick="Cases.toggleWidePreview()" title="プレビュー枠を大きく拡大（7:3比率）">⛶ プレビュー拡大</button>
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem;" onclick="Cases.openViewerInNewTab()" title="別タブで原本を最大表示">↗ 別窓</button>
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem;" onclick="Cases.resetViewer()" title="リセット">⤢</button>
                  <input type="file" id="caseViewerFileInput" accept=".tif,.tiff,image/*,.pdf" style="display:none;" onchange="Cases.handleViewerFileSelect(event)">
                  <button type="button" class="btn btn-secondary btn-small" style="padding:2px 6px; font-size:0.75rem; background:#334155;" onclick="document.getElementById('caseViewerFileInput').click()" title="手元のTIF/PDFを選択">📁開く</button>
                </div>
              </div>
              <!-- ビューワー本文 -->
              <div id="caseViewerContainer" style="flex:1; overflow:auto; position:relative; background:#0f172a; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:12px; min-height:420px; cursor:grab; user-select:none;"
                   ondragover="event.preventDefault(); this.style.borderColor='var(--accent-gold, #f59e0b)'"
                   ondrop="event.preventDefault(); if(event.dataTransfer.files[0]) Cases.loadLocalFileToViewer(event.dataTransfer.files[0])">
                <div id="caseViewerLoading" style="display:none; text-align:center; color:#94a3b8; margin:auto;">
                  <div class="spinner" style="width:36px; height:36px; border:3px solid rgba(245,158,11,0.2); border-top-color:#f59e0b; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 10px;"></div>
                  <div style="font-size:0.85rem; font-weight:bold;">添付ファイル（TIF/PDF）を読み込み中...</div>
                </div>
                <div id="caseViewerImgWrapper" style="display:none; position:relative; align-items:center; justify-content:center; margin:auto; transition:width 0.15s ease, height 0.15s ease;">
                  <img id="caseViewerImg" src="" style="display:block; border-radius:4px; box-shadow:0 6px 20px rgba(0,0,0,0.6); transform-origin:center center; transition:transform 0.15s ease;">
                </div>
                <iframe id="caseViewerIframe" src="" style="display:none; width:100%; height:100%; min-height:500px; border:none; border-radius:4px;"></iframe>
                <div id="caseViewerEmpty" style="text-align:center; color:var(--text-muted, #94a3b8); padding:50px 16px; margin:auto;">
                  <div style="font-size:2.4rem; margin-bottom:8px;">📄 🔍</div>
                  <div style="font-size:0.95rem; font-weight:bold; color:#e2e8f0;">FAX・注文書・車検証 プレビュー</div>
                  <div style="font-size:0.75rem; margin-top:6px; color:#94a3b8;">手元のTIF/PDFファイルをドラッグ＆ドロップして表示することも可能です</div>
                </div>
              </div>
            </div>

            <!-- ─── 👉 右側: 案件登録フォーム ─── -->
            <div id="caseFormPane" style="flex:1; width:100%; max-height:78vh; overflow-y:auto; padding-right:8px;">
              <form id="caseForm" onsubmit="Cases.onSubmit(event)" onkeydown="if(event.key==='Enter' && event.target.tagName==='INPUT'){event.preventDefault();}">
                <div class="form-row">
                  <div class="form-group" style="flex:2">
                    <label>案件名 <span class="required">*</span></label>
                    <input type="text" name="title" id="csf_title" required placeholder="例：愛知トヨタWEST 一宮開明店 - 横田 清 様 (車庫証明)">
                  </div>
                  <div class="form-group" style="flex:1">
                    <label>注文書№</label>
                    <input type="text" name="orderNo" id="csf_orderNo" placeholder="例：57500855">
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

                <!-- 登録種別（やること）サブカテゴリ ＆ 封印事由 -->
                <div class="form-row" id="csf_subCategory_group" style="display:none">
                  <div class="form-group" style="flex:1">
                    <label>登録種別（やること）</label>
                    <select name="subCategory" id="csf_subCategory" class="form-select" onchange="Cases.onSubCategoryChange(this.value)">
                      ${this.SUB_CATEGORIES.map(sc => `<option value="${sc.key}">${sc.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group" style="flex:1" id="csf_regType_group">
                    <label>封印事由・登録区分 <span style="font-size:0.7rem;color:#10b981;font-weight:bold;">※監査台帳用</span></label>
                    <select name="regType" id="csf_regType" class="form-select">
                      <option value="">— 自動判定 —</option>
                      <option value="new">🚗 新規登録（新車・中古新規）</option>
                      <option value="transfer">🔄 移転登録（名義変更＋番号変更）</option>
                      <option value="change">📍 変更登録（住所変更等＋番号変更）</option>
                      <option value="reseal">🔩 再封印（修繕・破損・再取付）</option>
                      <option value="plate_change">⭐ 番号変更（希望番号・図柄ナンバー）</option>
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
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <label style="margin:0;">顧客担当者（店舗担当）</label>
                      <button type="button" class="btn btn-secondary btn-small" style="font-size:0.7rem; padding:1px 6px;" onclick="Cases.quickAddContact()" title="店舗担当者を新規登録">＋ 担当者追加</button>
                    </div>
                    <select name="clientContactId" id="csf_clientContactId" class="form-select">
                      <option value="">— 未選択 —</option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>自所 担当者</label>
                    <select name="staffId" id="csf_staffId" class="form-select">
                      <option value="">未定</option>
                      ${staffList.map(s => `<option value="${s.id}">${s.name}${s.role ? ' (' + s.role + ')' : ''}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>受任日</label>
                    <input type="date" name="registeredAt" id="csf_registeredAt" value="${today}">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>期日（締切）</label>
                    <input type="date" name="deadline" id="csf_deadline">
                  </div>
                  <div class="form-group">
                    <label>報酬額（円）</label>
                    <input type="number" name="fee" id="csf_fee" placeholder="例：55000" min="0" step="1">
                  </div>
                </div>

                <!-- 立替金入力エリア -->
                <div class="advances-section" style="margin-bottom:16px; border:1px solid var(--border-color); border-radius:6px; padding:12px; background:var(--bg-secondary)">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                    <label style="font-weight:600; margin:0">💰 立替金（証紙代・印紙代等）</label>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                      <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:2px 6px;" onclick="Cases.addAdvanceRow('車庫証明証紙代', 2300)">＋ 証紙2,300円</button>
                      <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:2px 6px;" onclick="Cases.addAdvanceRow('軽届出証紙代', 700)">＋ 軽700円</button>
                      <button type="button" class="btn btn-secondary btn-small" style="font-size:0.72rem; padding:2px 6px;" onclick="Cases.addAdvanceRow('登録印紙代', 700)">＋ 登録印紙700円</button>
                      <button type="button" class="btn btn-primary btn-small" style="font-size:0.72rem; padding:2px 8px;" onclick="Cases.addAdvanceRow()">＋ 追加</button>
                    </div>
                  </div>
                  <div id="advancesRowsContainer"></div>
                </div>

                <div class="form-group">
                  <label>Google Drive フォルダURL</label>
                  <div style="display:flex; gap:6px">
                    <input type="url" name="driveFolderUrl" id="csf_driveFolderUrl"
                      placeholder="https://drive.google.com/..." style="flex:1">
                    <button type="button" class="btn btn-secondary btn-small" onclick="Cases.openDriveFolder()" title="フォルダを開く">📂</button>
                  </div>
                </div>

                <!-- 車両・保管場所情報 -->
                <div id="csf_car_fields" style="background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); border-radius:8px; padding:12px; margin-bottom:16px">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                    <span style="font-weight:600; font-size:0.9rem; color:var(--primary-color)">🚗 車両・保管場所情報</span>
                    <button type="button" class="btn btn-secondary btn-small" onclick="Cases.openSyakoMapMaker()" style="font-size:0.75rem; background:#2563eb; color:#fff; border-color:#2563eb; font-weight:bold;">
                      🗺️ 所在図・配置図を作成
                    </button>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>名前（申請者・使用者）</label>
                      <input type="text" name="carName" id="csf_carName" placeholder="例：横田 清">
                    </div>
                    <div class="form-group">
                      <label>使用の本拠の位置（自宅住所）</label>
                      <input type="text" name="carAddress" id="csf_carAddress" placeholder="例：一宮市三条 字墓北94-3">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>保管場所の位置（車庫住所） <span style="font-size:0.72rem;color:var(--text-muted)">(空欄時は自宅と同上)</span></label>
                      <input type="text" name="parkingAddress" id="csf_parkingAddress" placeholder="例：一宮市三条 字墓北94-3 (空欄時は同上)">
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
                  <div class="form-row">
                    <div class="form-group">
                      <label>自動車登録番号（新ナンバー）</label>
                      <input type="text" name="carNumber" id="csf_carNumber" placeholder="例：尾張小牧300自1234">
                    </div>
                    <div class="form-group">
                      <label>旧登録番号（旧ナンバー / 返納対象）</label>
                      <input type="text" name="oldCarNumber" id="csf_oldCarNumber" placeholder="例：名古屋500さ5678 (名変・変更時)">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>車台番号（VIN）</label>
                      <input type="text" name="vin" id="csf_vin" placeholder="例：ZWR90-0123456">
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label>📝 メモ・特記事項</label>
                  <textarea name="memo" id="csf_memo" rows="4" style="min-height:90px;resize:vertical;font-size:0.88rem;line-height:1.5;width:100%;box-sizing:border-box" placeholder="案件に関するメモ、特記事項、連絡事項など..."></textarea>
                </div>
                <div id="caseExtArea"></div>
                <div class="form-actions" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:20px;">
                  <button type="button" class="btn btn-danger" id="caseDeleteBtn" style="display:none; margin-right:auto"
                    onclick="Cases.onDelete()">🗑️ 削除</button>
                  <button type="button" class="btn btn-secondary" onclick="Cases.closeModal()" style="margin-right:auto;">✕ 閉じる</button>
                  <button type="button" class="btn btn-secondary" onclick="Cases.saveCase('keep')" style="background:#334155; color:#fff; font-weight:600;" title="現在の入力内容を保存し、そのまま編集を続けます">💾 途中保存</button>
                  <button type="button" class="btn btn-primary" id="caseSaveAndNextBtn" onclick="Cases.saveCase('continueNext')" style="background:#0284c7; border-color:#0284c7; color:#fff; font-weight:bold;" title="この案件を登録して、左側のFAX原本を見ながらそのまま次の案件（2台目）を入力します">📑 保存して「同じFAXから続けて登録」</button>
                  <button type="button" class="btn btn-primary" onclick="Cases.saveCase('close')" style="background:#16a34a; border-color:#16a34a; font-weight:bold;">✅ 保存して閉じる</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ─── 📑 添付ファイル（FAX/依頼書/車検証）スプリットビューワー ───
  viewerState: {
    attachments: [],
    currentIndex: 0,
    zoom: 1.0,
    rotation: 0,
    isOpen: false
  },

  initAttachmentViewer(attachments = [], preselectIdx = 0) {
    this.viewerState.attachments = attachments || [];
    this.viewerState.currentIndex = preselectIdx;
    this.viewerState.zoom = 1.0;
    this.viewerState.rotation = 0;

    const pane = document.getElementById('caseAttachmentPane');
    const content = document.getElementById('caseModalContent');
    const toggleBtn = document.getElementById('casePreviewToggleBtn');
    const tabList = document.getElementById('caseAttTabList');

    if (!pane || !content) return;

    if (attachments && attachments.length > 0) {
      this.viewerState.isOpen = true;
      pane.style.display = 'flex';
      content.style.maxWidth = '1360px';
      content.style.width = '96vw';
      if (toggleBtn) toggleBtn.style.display = 'inline-flex';

      // ページタブの生成
      if (tabList) {
        tabList.innerHTML = attachments.map((att, idx) => `
          <button type="button" class="btn btn-small ${idx === preselectIdx ? 'btn-primary' : 'btn-secondary'}"
            style="font-size:0.72rem; padding:2px 8px; border-radius:4px;"
            onclick="Cases.loadAttachmentByIndex(${idx})">
            ${idx + 1}枚目${att.name ? ' (' + att.name.replace(/^.*\./, '.') + ')' : ''}
          </button>
        `).join('');
      }

      this.loadAttachmentByIndex(preselectIdx);
    } else {
      this.viewerState.isOpen = false;
      pane.style.display = 'none';
      content.style.maxWidth = '720px';
      content.style.width = '94%';
      if (toggleBtn) toggleBtn.style.display = 'none';
    }
  },

  toggleAttachmentSplitView() {
    const pane = document.getElementById('caseAttachmentPane');
    const content = document.getElementById('caseModalContent');
    if (!pane || !content) return;

    if (this.viewerState.isOpen) {
      pane.style.display = 'none';
      content.style.maxWidth = '720px';
      content.style.width = '94%';
      this.viewerState.isOpen = false;
    } else {
      pane.style.display = 'flex';
      content.style.maxWidth = '1360px';
      content.style.width = '96vw';
      this.viewerState.isOpen = true;
      if (this.viewerState.attachments.length > 0) {
        this.loadAttachmentByIndex(this.viewerState.currentIndex);
      }
    }
  },

  async loadAttachmentByIndex(idx) {
    const atts = this.viewerState.attachments;
    if (!atts || !atts[idx]) return;
    this.viewerState.currentIndex = idx;
    this.viewerState.zoom = 1.0;
    this.viewerState.rotation = 0;

    // タブのアクティブ表示更新
    const tabList = document.getElementById('caseAttTabList');
    if (tabList) {
      const btns = tabList.querySelectorAll('button');
      btns.forEach((b, i) => {
        b.className = `btn btn-small ${i === idx ? 'btn-primary' : 'btn-secondary'}`;
      });
    }

    const att = atts[idx];
    const loading = document.getElementById('caseViewerLoading');
    const wrapper = document.getElementById('caseViewerImgWrapper');
    const imgEl = document.getElementById('caseViewerImg');
    const iframeEl = document.getElementById('caseViewerIframe');
    const emptyEl = document.getElementById('caseViewerEmpty');

    if (emptyEl) emptyEl.style.display = 'none';
    if (wrapper) wrapper.style.display = 'none';
    if (imgEl) imgEl.style.display = 'none';
    if (iframeEl) iframeEl.style.display = 'none';
    if (loading) loading.style.display = 'block';

    try {
      const isPdf = (att.name && att.name.match(/\.pdf$/i)) || (att.url && att.url.includes('.pdf'));
      const gasUrl = typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.getGasUrl ? SpreadsheetSync.getGasUrl() : '';

      // 1. Google Driveのファイル
      if (att.url && att.url.includes('drive.google.com')) {
        const match = att.url.match(/[-\w]{25,}/);
        if (match) {
          const fileId = match[0];
          if (isPdf) {
            // PDFの場合はiframeでGoogleプレビュー表示
            const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            if (loading) loading.style.display = 'none';
            if (iframeEl) {
              iframeEl.src = previewUrl;
              iframeEl.style.display = 'block';
            }
            return;
          } else {
            // 画像（JPG/PNG/TIF等）の場合はネイティブ<img>で直接ロード（90度回転・ズーム・パンに完全対応）
            if (loading) loading.style.display = 'none';
            if (imgEl && wrapper) {
              imgEl.onerror = () => {
                // サムネイル高画質URLにフォールバック
                imgEl.onerror = () => {
                  if (iframeEl) {
                    wrapper.style.display = 'none';
                    imgEl.style.display = 'none';
                    iframeEl.src = `https://drive.google.com/file/d/${fileId}/preview`;
                    iframeEl.style.display = 'block';
                  }
                };
                imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2500`;
              };
              imgEl.src = `https://lh3.googleusercontent.com/d/${fileId}`;
              wrapper.style.display = 'flex';
              imgEl.style.display = 'block';
              imgEl.onload = () => {
                this.applyViewerTransform();
                this.setupViewerInteractions();
              };
              if (imgEl.complete) {
                this.applyViewerTransform();
                this.setupViewerInteractions();
              }
            }
            return;
          }
        }
      }

      // 2. ローカルまたはBlobのPDFファイルの場合
      if (isPdf && att.url) {
        if (loading) loading.style.display = 'none';
        if (iframeEl) {
          iframeEl.src = att.url.includes('#') ? att.url : `${att.url}#toolbar=0`;
          iframeEl.style.display = 'block';
        }
        return;
      }

      // 2. Google Drive上の画像（TIFF, JPEG, PNG等）
      if (att.url && gasUrl) {
        let data = null;
        try {
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'getFileBase64',
              fileUrl: att.url,
              fileId: (att.url.match(/[-\w]{25,}/) || [])[0] || ''
            })
          });
          data = await res.json();
        } catch (e) {
          console.warn('doPost getFileBase64 failed, trying doGet fallback...', e);
          const fileId = (att.url.match(/[-\w]{25,}/) || [])[0] || '';
          if (fileId) {
            const getRes = await fetch(`${gasUrl}?action=getFileBase64&fileId=${fileId}`);
            data = await getRes.json();
          }
        }

        if (data && data.success && data.base64) {
          let converted = data.base64;
          const mime = data.mimeType || '';
          const isTiffData = mime.includes('tif') || (att.name && att.name.match(/\.tiff?$/i)) || data.base64.startsWith('SUkq') || data.base64.startsWith('TU0A');
          
          if (isTiffData && typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.convertTiffToJpeg) {
            const cJpg = DealerDocumentParser.convertTiffToJpeg(data.base64);
            if (cJpg) converted = cJpg;
          }

          if (loading) loading.style.display = 'none';
          if (imgEl && wrapper) {
            imgEl.src = converted.startsWith('data:') ? converted : `data:${mime || 'image/jpeg'};base64,${converted}`;
            wrapper.style.display = 'block';
            imgEl.style.display = 'block';
            imgEl.onload = () => {
              this.applyViewerTransform();
              this.setupViewerInteractions();
            };
            if (imgEl.complete) {
              this.applyViewerTransform();
              this.setupViewerInteractions();
            }
          }
          return;
        } else {
          console.warn('GAS getFileBase64 failed:', data ? data.error : 'No response');
        }
      }

      // 3. 一般Web画像URL（Base64またはhttp画像直リンク）
      if (att.url && (att.url.startsWith('data:') || att.url.match(/\.(png|jpe?g|webp|gif)/i))) {
        if (loading) loading.style.display = 'none';
        if (imgEl && wrapper) {
          imgEl.src = att.url;
          wrapper.style.display = 'block';
          imgEl.style.display = 'block';
          imgEl.onload = () => {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          };
          if (imgEl.complete) {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          }
        }
        return;
      }

      // 4. フォールバック
      if (loading) loading.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `
          <div style="font-size:2rem; margin-bottom:8px;">📄</div>
          <div style="font-size:0.85rem; font-weight:bold; color:var(--text-dark, #fff);">${att.name || '添付ファイル'}</div>
          <div style="font-size:0.75rem; margin:8px 0; color:#94a3b8;">Google Drive上の原本ファイルを開くか、手元のファイルを選択してください</div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:14px;">
            <a href="${att.url}" target="_blank" class="btn btn-secondary btn-small" style="padding:6px 12px;">↗ Google Driveで開く</a>
            <button type="button" class="btn btn-primary btn-small" style="padding:6px 12px; background:#f59e0b; color:#000; font-weight:bold;" onclick="document.getElementById('caseViewerFileInput').click()">📁 手元のファイルを選択</button>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Viewer load error:', e);
      if (loading) loading.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `
          <div style="font-size:2rem; margin-bottom:8px;">📄</div>
          <div style="font-size:0.85rem; font-weight:bold; color:var(--text-dark, #fff);">${att.name || '添付ファイル'}</div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:14px;">
            <a href="${att.url}" target="_blank" class="btn btn-secondary btn-small" style="padding:6px 12px;">↗ Google Driveで開く</a>
            <button type="button" class="btn btn-primary btn-small" style="padding:6px 12px; background:#f59e0b; color:#000; font-weight:bold;" onclick="document.getElementById('caseViewerFileInput').click()">📁 手元のファイルを選択</button>
          </div>
        `;
      }
    }
  },

  handleViewerFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.loadLocalFileToViewer(file);
    }
  },

  loadLocalFileToViewer(file) {
    const loading = document.getElementById('caseViewerLoading');
    const wrapper = document.getElementById('caseViewerImgWrapper');
    const imgEl = document.getElementById('caseViewerImg');
    const iframeEl = document.getElementById('caseViewerIframe');
    const emptyEl = document.getElementById('caseViewerEmpty');

    if (emptyEl) emptyEl.style.display = 'none';
    if (wrapper) wrapper.style.display = 'none';
    if (imgEl) imgEl.style.display = 'none';
    if (iframeEl) iframeEl.style.display = 'none';
    if (loading) loading.style.display = 'block';

    const isTiff = file.name.match(/\.tiff?$/i) || (file.type && file.type.includes('tif'));
    const isPdf = file.name.match(/\.pdf$/i) || file.type === 'application/pdf';

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (loading) loading.style.display = 'none';
      const result = ev.target.result;

      if (isTiff) {
        let converted = result;
        if (typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.convertTiffToJpeg) {
          const cJpg = DealerDocumentParser.convertTiffToJpeg(result);
          if (cJpg) converted = cJpg;
        }
        if (imgEl && wrapper) {
          imgEl.src = converted;
          wrapper.style.display = 'block';
          imgEl.style.display = 'block';
          imgEl.onload = () => {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          };
          if (imgEl.complete) {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          }
        }
      } else if (isPdf) {
        if (iframeEl) {
          iframeEl.src = result;
          iframeEl.style.display = 'block';
        }
      } else {
        if (imgEl && wrapper) {
          imgEl.src = result;
          wrapper.style.display = 'block';
          imgEl.style.display = 'block';
          imgEl.onload = () => {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          };
          if (imgEl.complete) {
            this.applyViewerTransform();
            this.setupViewerInteractions();
          }
        }
      }
      App.showToast(`📄 「${file.name}」をプレビュー表示しました`);
    };

    if (isTiff) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsDataURL(file);
    }
  },

  zoomViewer(delta) {
    this.viewerState.zoom = Math.max(0.4, Math.min(4.0, (this.viewerState.zoom || 1.0) + delta));
    this.applyViewerTransform();
  },

  fitWidthViewer() {
    this.viewerState.zoom = 1.0;
    this.applyViewerTransform();
    App.showToast('↕ 横幅に合わせてフィットしました');
  },

  /**
   * 画像そのものをHTML5 Canvasで物理的に90度回転（CSS変形によるレイアウト崩れ・画面回転感を完全防止）
   */
  rotateImageSource(imgSrc, angle = 90) {
    return new Promise((resolve) => {
      const img = new Image();
      if (!imgSrc.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (angle === 90 || angle === 270) {
            canvas.width = img.naturalHeight;
            canvas.height = img.naturalWidth;
          } else {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (e) {
          console.warn('Canvas rotation error (CORS):', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imgSrc;
    });
  },

  async rotateViewer() {
    const imgEl = document.getElementById('caseViewerImg');
    const iframeEl = document.getElementById('caseViewerIframe');
    
    // 1. 画像が表示されている場合
    if (imgEl && imgEl.src && imgEl.style.display !== 'none') {
      // まずCanvasによる物理回転を試行（解像度・レイアウト比率をそのまま反転）
      const rotatedSrc = await this.rotateImageSource(imgEl.src, 90);
      if (rotatedSrc) {
        imgEl.src = rotatedSrc;
        this.viewerState.rotation = 0; // 物理回転したのでCSS回転は0に戻す
        this.applyViewerTransform();
        App.showToast('🔄 90°回転しました（紙面の向きを変更）');
        return;
      }

      // CORS制限等でCanvasが使えない場合：CSS Transformで回転
      this.viewerState.rotation = ((this.viewerState.rotation || 0) + 90) % 360;
      this.applyViewerTransform();
      App.showToast(`🔄 ${this.viewerState.rotation}° 回転しました`);
      return;
    }

    // 2. iframe（PDF等）が表示されている場合
    if (iframeEl && iframeEl.src && iframeEl.style.display !== 'none') {
      this.viewerState.rotation = ((this.viewerState.rotation || 0) + 90) % 360;
      this.applyViewerTransform();
      App.showToast(`🔄 プレビューを ${this.viewerState.rotation}° 回転しました`);
      return;
    }

    App.showToast('⚠️ 回転可能なファイルが開かれていません');
  },

  toggleWidePreview() {
    const pane = document.getElementById('caseAttachmentPane');
    const formPane = document.getElementById('caseFormPane');
    const content = document.getElementById('caseModalContent');
    const btn = document.getElementById('caseViewerWideBtn');
    if (!pane || !formPane || !content) return;

    this.viewerState.isWideMode = !this.viewerState.isWideMode;
    if (this.viewerState.isWideMode) {
      pane.style.flex = '2.4';
      formPane.style.flex = '1';
      content.style.maxWidth = '98vw';
      content.style.width = '98vw';
      if (btn) btn.innerHTML = '⛶ 標準比率';
      App.showToast('⛶ プレビュー枠を最大化しました（7:3比率）');
    } else {
      pane.style.flex = '1.3';
      formPane.style.flex = '1';
      content.style.maxWidth = '1360px';
      content.style.width = '96vw';
      if (btn) btn.innerHTML = '⛶ プレビュー拡大';
      App.showToast('⛶ 標準比率に戻しました（5.5:4.5比率）');
    }
    setTimeout(() => this.applyViewerTransform(), 150);
  },

  openViewerInNewTab() {
    const imgEl = document.getElementById('caseViewerImg');
    const iframeEl = document.getElementById('caseViewerIframe');
    const rotation = this.viewerState.rotation || 0;
    if (imgEl && imgEl.src && imgEl.style.display !== 'none') {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`
          <!DOCTYPE html>
          <html lang="ja">
            <head>
              <meta charset="utf-8">
              <title>原本プレビュー</title>
              <style>
                body { margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh; overflow:auto; padding:20px; box-sizing:border-box; }
                img { max-width:96vw; max-height:96vh; object-fit:contain; box-shadow:0 8px 30px rgba(0,0,0,0.8); border-radius:4px; transform: rotate(${rotation}deg); }
              </style>
            </head>
            <body>
              <img src="${imgEl.src}">
            </body>
          </html>
        `);
        w.document.close();
      }
    } else if (iframeEl && iframeEl.style.display !== 'none' && iframeEl.src) {
      window.open(iframeEl.src, '_blank');
    } else if (this.viewerState.attachments && this.viewerState.attachments[this.viewerState.currentIndex]?.url) {
      window.open(this.viewerState.attachments[this.viewerState.currentIndex].url, '_blank');
    }
  },

  resetViewer() {
    this.viewerState.zoom = 1.0;
    this.viewerState.rotation = 0;
    this.applyViewerTransform();
  },

  applyViewerTransform() {
    const wrapper = document.getElementById('caseViewerImgWrapper');
    const imgEl = document.getElementById('caseViewerImg');
    const iframeEl = document.getElementById('caseViewerIframe');
    const zoom = this.viewerState.zoom || 1.0;
    const rotation = this.viewerState.rotation || 0;

    if (imgEl && imgEl.src && imgEl.style.display !== 'none') {
      const isSideways = (rotation === 90 || rotation === 270);
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.width = '100%';
      wrapper.style.minHeight = '100%';
      wrapper.style.overflow = 'visible';
      wrapper.style.padding = isSideways ? '20px 0' : '0';

      imgEl.style.display = 'block';
      imgEl.style.margin = 'auto';
      imgEl.style.boxShadow = '0 6px 25px rgba(0,0,0,0.6)';
      imgEl.style.borderRadius = '4px';

      if (isSideways) {
        imgEl.style.maxWidth = '65vh';
        imgEl.style.maxHeight = '90%';
        imgEl.style.width = 'auto';
        imgEl.style.height = 'auto';
      } else {
        imgEl.style.maxWidth = '100%';
        imgEl.style.maxHeight = 'none';
        imgEl.style.width = '100%';
        imgEl.style.height = 'auto';
      }

      imgEl.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
      imgEl.style.transformOrigin = 'center center';
      imgEl.style.transition = 'transform 0.15s ease';
    } else if (iframeEl && iframeEl.style.display !== 'none') {
      iframeEl.style.transform = `rotate(${rotation}deg)`;
      iframeEl.style.transformOrigin = 'center center';
      iframeEl.style.transition = 'transform 0.15s ease';
    }
  },

  setupViewerInteractions() {
    const container = document.getElementById('caseViewerContainer');
    if (!container || container._hasInteractions) return;
    container._hasInteractions = true;

    let isDragging = false;
    let startX = 0, startY = 0;
    let scrollLeft = 0, scrollTop = 0;

    container.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;
      isDragging = true;
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (container) container.style.cursor = 'grab';
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.3;
      const walkY = (y - startY) * 1.3;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });

    container.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        Cases.zoomViewer(delta);
      }
    }, { passive: false });
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
      contacts.map(c => `<option value="${c.id}">${c.name}${c.phone ? ' (' + c.phone + ')' : ''}</option>`).join('');
    if (preSelectContactId) sel.value = preSelectContactId;
  },

  quickAddContact() {
    const clientSelect = document.getElementById('csf_clientId');
    const clientId = clientSelect ? clientSelect.value : '';
    if (!clientId) {
      App.showToast('⚠️ 先に「顧客店舗」を選択してください');
      return;
    }
    const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || '';
    const name = prompt(`【${clientName}】の担当者名を入力してください:`);
    if (!name || !name.trim()) return;
    const phone = prompt('担当者の電話番号（空欄可）:', '');
    const newContact = Store.addClientContact({
      clientId: clientId,
      name: name.trim(),
      phone: phone ? phone.trim() : ''
    });
    this.onClientChange(clientId, newContact.id);
    App.showToast(`✅ 担当者「${name.trim()}」を登録・選択しました`);
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

  // 個別案件の請求取消（未請求に戻す）
  cancelSingleCaseInvoice(caseId) {
    const c = Store.getCase(caseId);
    if (!c || !c.invoiceNo) return;
    if (!confirm(`案件「${c.title}」の請求書（${c.invoiceNo}）を取り消して「未請求」に戻しますか？`)) return;
    const oldInv = c.invoiceNo;
    Store.updateCase(caseId, { invoiceNo: '' });
    // 他の案件にこの請求書番号が残っていなければPaymentsからも削除
    const otherCases = Store.getCases().filter(other => other.id !== caseId && other.invoiceNo === oldInv);
    if (otherCases.length === 0 && typeof Payments !== 'undefined') {
      Payments.deleteByInvoiceNo(oldInv);
    }
    this.closeModal();
    App.refreshView();
    App.showToast(`✅ 案件「${c.title}」を未請求状態に戻しました`);
  },

  showAddModal(prefills) {
    this.editingId = null;

    if (typeof App !== 'undefined' && App.currentPage !== 'cases') {
      App.navigate('cases');
    }

    const modal = document.getElementById('caseModal');
    if (!modal) {
      setTimeout(() => this.showAddModal(prefills), 50);
      return;
    }

    const titleEl = document.getElementById('caseModalTitle');
    if (titleEl) titleEl.textContent = '案件登録';
    const formEl = document.getElementById('caseForm');
    if (formEl) formEl.reset();
    const deleteBtn = document.getElementById('caseDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    modal.style.display = 'flex';
    this.advanceDraft = [];
    this.renderAdvanceRows();
    this.onClientChange('');

    // 注文書№ 自動連番付与 (PO-YYYYMMDD-XXX)
    const nextNum = Store.getCases().length + 1;
    const yyyymmdd = Store.getLocalDateStr().replace(/-/g, '');
    const autoOrderNo = `PO-${yyyymmdd}-${String(nextNum).padStart(3, '0')}`;
    const orderNoEl = document.getElementById('csf_orderNo');
    if (orderNoEl) orderNoEl.value = (prefills && prefills.orderNo) ? prefills.orderNo : autoOrderNo;

    // 添付ファイルプレビューワーの初期化（横並び表示）
    if (prefills && prefills.attachments && prefills.attachments.length > 0) {
      this.initAttachmentViewer(prefills.attachments, 0);
    } else {
      this.initAttachmentViewer([]);
    }

    // 受信FAX/メールインボックスからの自動入力（プリフィル）
    if (prefills) {
      if (prefills.title) {
        const tEl = document.getElementById('csf_title');
        if (tEl) tEl.value = prefills.title;
      }
      if (prefills.clientId) {
        const cEl = document.getElementById('csf_clientId');
        if (cEl) cEl.value = prefills.clientId;
        this.onClientChange(prefills.clientId);
      }
      if (prefills.category) {
        const catEl = document.getElementById('csf_category');
        if (catEl) catEl.value = prefills.category;
      }
      if (prefills.carPolice) {
        const polEl = document.getElementById('csf_carPolice');
        if (polEl) polEl.value = prefills.carPolice;
      }
      if (prefills.applicantName || prefills.carName) {
        const carNameEl = document.getElementById('csf_carName');
        if (carNameEl) carNameEl.value = prefills.applicantName || prefills.carName;
      }
      if (prefills.applicantAddress || prefills.carAddress) {
        const carAddrEl = document.getElementById('csf_carAddress');
        if (carAddrEl) carAddrEl.value = prefills.applicantAddress || prefills.carAddress;
      }
      if (prefills.garageAddress || prefills.parkingAddress) {
        const parkAddrEl = document.getElementById('csf_parkingAddress');
        if (parkAddrEl) parkAddrEl.value = prefills.garageAddress || prefills.parkingAddress;
      }
      if (prefills.vin || prefills.carNumber) {
        const carNumEl = document.getElementById('csf_carNumber');
        if (carNumEl) carNumEl.value = prefills.carNumber || prefills.vin;
      }
      if (prefills.oldCarNumber) {
        const oldCarNumEl = document.getElementById('csf_oldCarNumber');
        if (oldCarNumEl) oldCarNumEl.value = prefills.oldCarNumber;
      }
      if (prefills.deadline) {
        const dlEl = document.getElementById('csf_deadline');
        if (dlEl) dlEl.value = prefills.deadline;
      }
      if (prefills.memo) {
        const memoEl = document.getElementById('csf_memo');
        if (memoEl) memoEl.value = prefills.memo;
      }
      
      let faxInput = document.getElementById('csf_faxId');
      if (!faxInput && formEl) {
        faxInput = document.createElement('input');
        faxInput.type = 'hidden';
        faxInput.name = 'faxId';
        faxInput.id = 'csf_faxId';
        formEl.appendChild(faxInput);
      }
      if (faxInput) faxInput.value = prefills.faxId || '';

      let inboxInput = document.getElementById('csf_inboxId');
      if (!inboxInput && formEl) {
        inboxInput = document.createElement('input');
        inboxInput.type = 'hidden';
        inboxInput.name = 'inboxId';
        inboxInput.id = 'csf_inboxId';
        formEl.appendChild(inboxInput);
      }
      if (inboxInput) inboxInput.value = prefills.inboxId || '';
    } else {
      const faxInput = document.getElementById('csf_faxId');
      if (faxInput) faxInput.value = '';
      const inboxInput = document.getElementById('csf_inboxId');
      if (inboxInput) inboxInput.value = '';
    }
    const wrap = document.getElementById('csf_milestone_stepper_wrap');
    if (wrap) wrap.style.display = 'none';
    const catEl = document.getElementById('csf_category');
    const catVal = catEl ? catEl.value : 'garage_oss';
    Cases.toggleCategoryFields(catVal);
    if (typeof CaseTemplates !== 'undefined' && CaseTemplates.applyTemplate) {
      CaseTemplates.applyTemplate(catVal);
    }
  },

  showEditModal(id) {
    this.editingId = id;
    const c = Store.getCase(id);
    if (!c) return;

    if (typeof App !== 'undefined' && App.currentPage !== 'cases') {
      App.navigate('cases');
    }

    const modal = document.getElementById('caseModal');
    if (!modal) {
      setTimeout(() => this.showEditModal(id), 50);
      return;
    }

    const invBadge = c.invoiceNo 
      ? `<span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; margin-left:10px; font-weight:normal; display:inline-flex; align-items:center; gap:4px;">
          📄 請求済: <strong>${c.invoiceNo}</strong>
          <button type="button" onclick="Cases.cancelSingleCaseInvoice('${id}')" style="background:#dc2626; color:#fff; border:none; border-radius:3px; padding:1px 6px; font-size:0.7rem; cursor:pointer; font-weight:bold;" title="この案件の請求を取り消して未請求に戻す">❌ 請求取消</button>
         </span>`
      : '';
    document.getElementById('caseModalTitle').innerHTML = '案件編集' + invBadge;
      document.getElementById('csf_title').value = c.title || '';
      document.getElementById('csf_orderNo').value = c.orderNo || c['注文書№'] || c['注文書No'] || c['注文番号'] || '';
      document.getElementById('csf_clientId').value = c.clientId || '';
      Cases.onClientChange(c.clientId || '', c.clientContactId || '');
      document.getElementById('csf_staffId').value = c.staffId || '';
      document.getElementById('csf_registeredAt').value = c.registeredAt || c.createdAt?.slice(0, 10) || '';
      document.getElementById('csf_category').value = c.category || 'garage_oss';
      const subCatEl = document.getElementById('csf_subCategory');
      if (subCatEl) subCatEl.value = c.subCategory || '';
      const regTypeEl = document.getElementById('csf_regType');
      if (regTypeEl) regTypeEl.value = c.regType || '';
      document.getElementById('csf_status').value = c.status || 'received';
      const deadlineEl = document.getElementById('csf_deadline');
      if (deadlineEl) deadlineEl.value = c.deadline || '';
      document.getElementById('csf_driveFolderUrl').value = c.driveFolderUrl || '';
      document.getElementById('csf_fee').value = c.fee || '';
      const locSel = document.getElementById('csf_locationId');
      if (locSel) locSel.value = c.locationId || '';
      document.getElementById('csf_memo').value = c.memo || '';
      document.getElementById('csf_carName').value = c.carName || '';
      document.getElementById('csf_carAddress').value = c.carAddress || '';
      const parkAddrEl = document.getElementById('csf_parkingAddress');
      if (parkAddrEl) parkAddrEl.value = c.parkingAddress || '';
      document.getElementById('csf_carNumber').value = c.carNumber || '';
      const oldCarNumEl = document.getElementById('csf_oldCarNumber');
      if (oldCarNumEl) oldCarNumEl.value = c.oldCarNumber || '';
      const vinEl = document.getElementById('csf_vin');
      if (vinEl) vinEl.value = c.vin || '';
      document.getElementById('csf_carPolice').value = c.carPolice || '';
      document.getElementById('caseDeleteBtn').style.display = 'block';
      modal.style.display = 'flex';
      // 立替金を読み込み
      this.advanceDraft = Array.isArray(c.advances) ? JSON.parse(JSON.stringify(c.advances)) : [];
      this.renderAdvanceRows();

      // カテゴリに応じたフィールド表示制御
      Cases.toggleCategoryFields(c.category || 'garage_oss');

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

        // 出張封印案件の場合：封印取付報告書（個別A4縦）および監査管理簿（全体A4横）への連携ウィジェット
        if (c.category === 'seal' || (c.subCategory && c.subCategory.includes('封印')) || (c.title && c.title.includes('封印'))) {
          extHtml = `
            <div class="checklist-widget" style="margin-top:12px; border-left:4px solid #10b981; padding:12px; border-radius:6px; background:rgba(16,185,129,0.05); border:1px solid var(--border-color)">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="margin:0; font-size:0.88rem; color:#10b981; display:flex; align-items:center; gap:4px;">
                  🔩 封印取付報告書・監査管理簿
                </h4>
                <span style="font-size:0.7rem; background:#059669; color:#fff; padding:1px 6px; border-radius:3px; font-weight:bold;">2年保存義務</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-primary btn-small" onclick="SealReportManager.printSingleReport('${id}')" style="flex:1; font-weight:bold; font-size:0.78rem; background:#2563eb; color:#fff;">
                  📄 個別完了報告書 (A4縦)
                </button>
                <button type="button" class="btn btn-secondary btn-small" onclick="SealReportManager.showLedgerModal()" style="flex:1; font-size:0.78rem;">
                  📋 全体管理簿 (A4横)
                </button>
              </div>
            </div>
          ` + extHtml;
        }

        extArea.innerHTML = extHtml;
      }
  },

  _submitMode: 'close',

  saveCase(mode = 'close') {
    this._submitMode = mode;
    const form = document.getElementById('caseForm');
    if (!form) return;
    if (!form.reportValidity()) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  },

  closeModal() {
    document.getElementById('caseModal').style.display = 'none';
    this.editingId = null;
    this._submitMode = 'close';
  },

  onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const isExisting = !!this.editingId;
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
      regType: form.regType ? form.regType.value : '',
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
      parkingAddress: form.parkingAddress ? form.parkingAddress.value.trim() : '',
      carNumber: form.carNumber ? form.carNumber.value.trim() : '',
      oldCarNumber: form.oldCarNumber ? form.oldCarNumber.value.trim() : '',
      vin: form.vin ? form.vin.value.trim() : '',
      carPolice: form.carPolice ? form.carPolice.value.trim() : '',
      faxId: document.getElementById('csf_faxId') ? document.getElementById('csf_faxId').value : '',
      inboxId: document.getElementById('csf_inboxId') ? document.getElementById('csf_inboxId').value : '',
      memo: form.memo.value.trim(),
    };

    // 添付書類（docs）の保持とインボックス添付ファイルの自動登録
    let initialDocs = [];
    if (this.editingId) {
      const existing = Store.getCase(this.editingId);
      initialDocs = (existing && Array.isArray(existing.docs)) ? [...existing.docs] : [];
    }
    const incomingAtts = (this.viewerState && this.viewerState.attachments && this.viewerState.attachments.length > 0)
      ? this.viewerState.attachments
      : [];
    if (incomingAtts.length > 0) {
      incomingAtts.forEach((att, idx) => {
        const attName = att.name || '受信添付書類';
        const exists = initialDocs.some(d => d.name === attName || (d.driveUrl && att.url && d.driveUrl === att.url));
        if (!exists) {
          initialDocs.push({
            id: 'doc_att_' + Date.now().toString(36) + '_' + idx,
            name: attName,
            driveUrl: att.url || '',
            driveId: (att.url && att.url.match(/[-\w]{25,}/)) ? att.url.match(/[-\w]{25,}/)[0] : '',
            mimeType: att.mimeType || (attName.toLowerCase().endsWith('.tif') ? 'image/tiff' : (attName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')),
            size: att.size || 0,
            uploadedAt: new Date().toISOString(),
            source: 'inbox'
          });
        }
      });
    }
    data.docs = initialDocs;

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
      // インボックスからの移行の場合、ステータスを対応済に更新 ＆ 送信元メールを顧客マスタへ自動学習
      if (data.inboxId && typeof Store.updateInboxStatus === 'function') {
        Store.updateInboxStatus(data.inboxId, '対応済', savedCase.id);

        // 顧客マスタへの送信元メール自動学習処理
        const inbox = Store.getInbox ? Store.getInbox() : [];
        const inboxItem = inbox.find(i => i.id === data.inboxId);
        if (inboxItem && savedCase.clientId) {
          const client = Store.getClient(savedCase.clientId);
          if (client) {
            let parsed = { email: '', contactName: '' };
            if (typeof InboxManager !== 'undefined' && typeof InboxManager.parseDealerSender === 'function') {
              parsed = InboxManager.parseDealerSender(inboxItem.sender);
            } else {
              const emailMatch = (inboxItem.sender || '').match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) parsed.email = emailMatch[0].toLowerCase();
            }

            if (parsed.email) {
              const existingEmails = (client.email || '').split(/[\s,;\n]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
              if (!existingEmails.includes(parsed.email.toLowerCase())) {
                const newEmailStr = client.email ? `${client.email}, ${parsed.email}` : parsed.email;
                Store.updateClient(client.id, { email: newEmailStr });
                setTimeout(() => {
                  App.showToast(`💡 顧客「${client.companyName || client.name}」にメール「${parsed.email}」を自動登録しました`);
                }, 400);
              }
            }

            // 担当者名があれば顧客担当者マスターにも未登録なら追加
            if (parsed.contactName && typeof Store.getClientContacts === 'function' && typeof Store.addClientContact === 'function') {
              const contacts = Store.getClientContacts(client.id);
              const exists = contacts.some(c => c.name && (c.name.includes(parsed.contactName) || parsed.contactName.includes(c.name)));
              if (!exists) {
                const newContact = Store.addClientContact({
                  clientId: client.id,
                  name: parsed.contactName,
                  email: parsed.email || ''
                });
                if (newContact && !savedCase.clientContactId) {
                  Store.updateCase(savedCase.id, { clientContactId: newContact.id });
                }
              }
            }
          }
        }
      }
    }

    // フォルダ未作成の場合は裏側でGAS連携してフォルダ作成＆添付ファイルの自動保管
    if (!data.driveFolderUrl && typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      const client = Store.getClient(savedCase.clientId);
      const clientName = client ? (client.companyName || client.name) : 'お客様';
      const contact = savedCase.clientContactId ? (typeof Store.getClientContact === 'function' ? Store.getClientContact(savedCase.clientContactId) : null) : null;
      const contactName = contact ? contact.name : (savedCase.contactName || '');
      const atts = (this.viewerState && this.viewerState.attachments && this.viewerState.attachments.length > 0) ? this.viewerState.attachments : [];
      const folderData = {
        ...savedCase,
        clientName: clientName,
        contactName: contactName,
        attachments: atts,
        inboxId: data.inboxId || ''
      };
      
      // 非同期で実行（UIはブロックしない）
      SpreadsheetSync.push('createCaseFolder', folderData).then(res => {
        if (res && res.success && res.folderUrl) {
          Store.updateCase(savedCase.id, { driveFolderUrl: res.folderUrl });
          // もし現在該当案件のモーダルが開いている場合はDOMを壊さず入力欄のURLだけ直接更新
          if (Cases.editingId === savedCase.id) {
            const driveInput = document.getElementById('csf_driveFolderUrl');
            if (driveInput) driveInput.value = res.folderUrl;
          }
          if (typeof App !== 'undefined' && typeof App.refreshView === 'function') {
            App.refreshView();
          }
          if (res.copiedFilesCount > 0) {
            App.showToast(`📁 Google Driveに案件フォルダを作成し、添付書類(${res.copiedFilesCount}件)を保管しました`);
          }
        }
      }).catch(err => console.warn('Google Drive フォルダ自動生成に失敗しました:', err));
    }

    // Googleカレンダーへ案件日程を自動同期
    this.syncCaseDatesToCalendar(savedCase);

    const mode = this._submitMode || 'close';
    this._submitMode = 'close'; // reset

    if (mode === 'close') {
      this.closeModal();
      App.refreshView();
      if (!isExisting && data.inboxId) {
        App.showToast('✅ 案件を登録しました');
      } else {
        App.showToast(isExisting ? '案件を更新しました' : '案件を登録しました');
      }
    } else if (mode === 'continueNext') {
      // 画面を閉じずに、店舗や日付・添付プレビューを保持したまま次の車両入力へ移行
      this.editingId = null;

      const client = Store.getClient(data.clientId);
      const clientName = client ? (client.companyName || client.name) : '';

      const nextNum = Store.getCases().length + 1;
      const yyyymmdd = Store.getLocalDateStr().replace(/-/g, '');
      const autoOrderNo = `PO-${yyyymmdd}-${String(nextNum).padStart(3, '0')}`;

      document.getElementById('csf_title').value = clientName ? `${clientName} - ` : '';
      document.getElementById('csf_orderNo').value = autoOrderNo;
      document.getElementById('csf_carName').value = '';
      document.getElementById('csf_carAddress').value = '';
      document.getElementById('csf_parkingAddress').value = '';
      document.getElementById('csf_carNumber').value = '';
      const oldCarNumEl = document.getElementById('csf_oldCarNumber');
      if (oldCarNumEl) oldCarNumEl.value = '';
      document.getElementById('csf_vin').value = '';
      document.getElementById('csf_memo').value = '';

      // 立替金のリセット
      this.advanceDraft = [];
      this.renderAdvanceRows();

      // 報酬額テンプレートの再適用
      if (typeof CaseTemplates !== 'undefined') {
        CaseTemplates.applyTemplate(data.category);
      }

      // タイトル表示の更新
      const titleEl = document.getElementById('caseModalTitle');
      if (titleEl) {
        titleEl.innerHTML = '案件登録 <span style="font-size:0.75rem; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-weight:bold; margin-left:8px;">📑 同じFAXから続けて登録中</span>';
      }

      const deleteBtn = document.getElementById('caseDeleteBtn');
      if (deleteBtn) deleteBtn.style.display = 'none';

      // 車両情報・申請者入力欄にフォーカス
      const carNameEl = document.getElementById('csf_carName');
      if (carNameEl) {
        carNameEl.focus();
      }

      App.showToast('✅ 案件を登録しました！そのまま2件目を入力できます');
    } else {
      // mode === 'keep'（途中保存）
      this.editingId = savedCase.id;
      const titleEl = document.getElementById('caseModalTitle');
      if (titleEl) {
        const invBadge = savedCase.invoiceNo 
          ? `<span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; margin-left:10px; font-weight:normal; display:inline-flex; align-items:center; gap:4px;">
              📄 請求済: <strong>${savedCase.invoiceNo}</strong>
              <button type="button" onclick="Cases.cancelSingleCaseInvoice('${savedCase.id}')" style="background:#dc2626; color:#fff; border:none; border-radius:3px; padding:1px 6px; font-size:0.7rem; cursor:pointer; font-weight:bold;" title="この案件の請求を取り消して未請求に戻す">❌ 請求取消</button>
             </span>`
          : '';
        titleEl.innerHTML = '案件編集' + invBadge;
      }
      const deleteBtn = document.getElementById('caseDeleteBtn');
      if (deleteBtn) deleteBtn.style.display = 'block';
      App.showToast('💾 案件データを保存しました（続けて入力できます）');
    }
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
    const isCarRegOrSeal = ['car_reg_standard', 'car_reg_light', 'seal'].includes(category);
    const subCatGroup = document.getElementById('csf_subCategory_group');
    if (subCatGroup) subCatGroup.style.display = isCarRegOrSeal ? '' : 'none';

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

  openDriveFolder() {
    const input = document.getElementById('csf_driveFolderUrl');
    const url = input ? input.value.trim() : '';
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      App.showToast('⚠️ Google DriveのフォルダURLが登録されていません');
    }
  },

  openSyakoMapMaker(caseId) {
    let targetCase = null;
    if (caseId) {
      targetCase = Store.getCase(caseId);
    } else if (this.editingId) {
      targetCase = Store.getCase(this.editingId);
    }

    const modal = document.getElementById('caseModal');
    const isModalOpen = modal && modal.style.display !== 'none';

    const params = new URLSearchParams();
    let storeInfo = '';

    if (targetCase) {
      params.set('caseId', targetCase.id);
      const title = (isModalOpen && document.getElementById('csf_title')?.value) || targetCase.title || '';
      const home = (isModalOpen && document.getElementById('csf_carAddress')?.value) || targetCase.carAddress || '';
      const parking = (isModalOpen && document.getElementById('csf_parkingAddress')?.value) || targetCase.parkingAddress || '';
      const name = (isModalOpen && document.getElementById('csf_carName')?.value) || targetCase.carName || '';
      const orderNo = (isModalOpen && document.getElementById('csf_orderNo')?.value) || targetCase.orderNo || '';
      const regNo = (isModalOpen && document.getElementById('csf_carNumber')?.value) || targetCase.carNumber || '';
      const folderUrl = (isModalOpen && document.getElementById('csf_driveFolderUrl')?.value) || targetCase.driveFolderUrl || '';
      const contactName = targetCase.contactName || '';

      if (title) params.set('title', title);
      if (home) params.set('home', home);
      if (parking) params.set('parking', parking);
      if (name) params.set('name', name);
      if (orderNo) params.set('orderNo', orderNo);
      if (regNo) params.set('regNo', regNo);
      if (folderUrl) params.set('folderUrl', folderUrl);
      if (contactName) params.set('contact', contactName);
      else if (targetCase.clientContactId && typeof Store !== 'undefined' && typeof Store.getClientContact === 'function') {
        const ct = Store.getClientContact(targetCase.clientContactId);
        if (ct && ct.name) params.set('contact', ct.name);
      }

      // 顧客マスターから店舗情報を取得
      const clientId = (isModalOpen && document.getElementById('csf_clientId')?.value) || targetCase.clientId;
      if (clientId && typeof Store !== 'undefined') {
        const client = Store.getClient(clientId);
        if (client) {
          const company = client.companyName || client.name || '';
          const branch = client.branchName || client.tradeName || client.department || '';
          const phone = client.phone || client.tel || '';
          storeInfo = [company, branch].filter(Boolean).join(' ');
          if (phone) storeInfo += (storeInfo ? '　' : '') + 'TEL ' + phone;
        }
      }
      if (storeInfo) params.set('storeInfo', storeInfo);
    } else {
      const title = document.getElementById('csf_title')?.value || '';
      const addr = document.getElementById('csf_carAddress')?.value || '';
      const parkAddr = document.getElementById('csf_parkingAddress')?.value || '';
      const name = document.getElementById('csf_carName')?.value || '';
      const orderNo = document.getElementById('csf_orderNo')?.value || '';
      const carNo = document.getElementById('csf_carNumber')?.value || '';
      const clientId = document.getElementById('csf_clientId')?.value || '';
      const folderUrl = document.getElementById('csf_driveFolderUrl')?.value || '';
      const contactId = document.getElementById('csf_clientContactId')?.value || '';
      if (title) params.set('title', title);
      if (addr) params.set('home', addr);
      if (parkAddr) params.set('parking', parkAddr);
      if (name) params.set('name', name);
      if (orderNo) params.set('orderNo', orderNo);
      if (carNo) params.set('regNo', carNo);
      if (folderUrl) params.set('folderUrl', folderUrl);
      if (contactId && typeof Store !== 'undefined' && typeof Store.getClientContact === 'function') {
        const ct = Store.getClientContact(contactId);
        if (ct && ct.name) params.set('contact', ct.name);
      }

      if (clientId && typeof Store !== 'undefined') {
        const client = Store.getClient(clientId);
        if (client) {
          const company = client.companyName || client.name || '';
          const branch = client.branchName || client.tradeName || client.department || '';
          const phone = client.phone || client.tel || '';
          storeInfo = [company, branch].filter(Boolean).join(' ');
          if (phone) storeInfo += (storeInfo ? '　' : '') + 'TEL ' + phone;
        }
      }
      if (storeInfo) params.set('storeInfo', storeInfo);
    }

    window.open('syako_map_maker.html?' + params.toString(), '_blank');
  },

  renderMapWidget(caseId) {
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId);
    const hasMapData = !!localStorage.getItem('syako_case_map_' + caseId);
    
    let mapPreviewHtml = '';
    if (mapPng || hasMapData) {
      mapPreviewHtml = `
        ${mapPng ? `
        <div style="position:relative; margin-bottom:8px; border:1px solid var(--border-color); border-radius:6px; overflow:hidden; background:#0f172a; display:flex; align-items:center; justify-content:center; max-height:200px; padding:6px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.15);" onclick="Cases.showFullMapModal('${caseId}')" title="クリックして全画面拡大プレビュー">
          <img src="${mapPng}" style="max-width:100%; max-height:190px; object-fit:contain; border-radius:4px; transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1.0)'" />
          <div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.75); color:white; font-size:0.75rem; padding:4px 10px; border-radius:20px; backdrop-filter:blur(4px); display:flex; align-items:center; gap:4px; pointer-events:none; border:1px solid rgba(255,255,255,0.2);">
            🔍 全画面で拡大表示
          </div>
        </div>` : '<div style="font-size:0.75rem; color:#059669; font-weight:bold; margin-bottom:6px;">✅ 作図データが保存されています</div>'}
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-small" onclick="Cases.openSyakoMapMaker('${caseId}')" style="flex:2; font-size:0.78rem; padding:5px 8px; font-weight:bold;">🗺️ 作図ツールで再編集</button>
          ${mapPng ? `<button type="button" class="btn btn-secondary btn-small" onclick="Cases.showFullMapModal('${caseId}')" style="flex:1; font-size:0.75rem; padding:5px 8px;">🔍 拡大</button>` : ''}
          ${mapPng ? `<button type="button" class="btn btn-secondary btn-small" onclick="Cases.downloadAttachedMap('${caseId}')" style="flex:1; font-size:0.75rem; padding:5px 8px;">📥 保存</button>` : ''}
          <input type="file" id="mapPdfFileInput_${caseId}" accept=".pdf,image/*,.tif" style="display:none;" onchange="Cases.handleMapPdfUpload(event, '${caseId}')">
          <button type="button" class="btn btn-secondary btn-small" onclick="document.getElementById('mapPdfFileInput_${caseId}').click()" style="flex:1.5; font-size:0.75rem; padding:5px 8px; background:#334155; color:#fff;" title="手元のPDFや画像ファイルをGoogle Drive案件フォルダに保存">📎 PDF/図面をフォルダ保存</button>
          <button type="button" class="btn btn-danger btn-small" onclick="Cases.deleteAttachedMap('${caseId}')" style="font-size:0.75rem; padding:5px 8px;" title="削除">🗑️</button>
        </div>
      `;
    } else {
      mapPreviewHtml = `
        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">
          案件の住所（本拠・車庫）を引き継いで、車庫証明の所在図・配置図をブラウザ上で作成・保存できます。
        </p>
        <button type="button" class="btn btn-primary btn-small" onclick="Cases.openSyakoMapMaker('${caseId}')" style="width:100%; font-weight:bold; font-size:0.82rem; padding:7px; background:#2563eb; color:#fff;">
          🗺️ 車庫証明 作図ツールを起動 ➔
        </button>
      `;
    }

    return `
      <div class="checklist-widget" style="margin-top:12px; border-left:4px solid var(--accent-orange); padding:12px; border-radius:6px; background:rgba(249,115,22,0.02); border:1px solid var(--border-color)">
        <h4 style="margin:0 0 8px; font-size:0.88rem; display:flex; align-items:center; justify-content:space-between; color:var(--text-dark)">
          <span style="display:flex;align-items:center;gap:6px;">🚗 車庫証明 所在図・配置図</span>
          ${hasMapData ? '<span style="font-size:0.72rem;background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-weight:bold;">作図済</span>' : ''}
        </h4>
        ${mapPreviewHtml}
      </div>
    `;
  },

  showFullMapModal(caseId) {
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId);
    if (!mapPng) return;
    const targetCase = Store.getCase(caseId);
    const title = targetCase ? (targetCase.title || '車庫証明 所在図・配置図') : '車庫証明 所在図・配置図';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'fullMapModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('fullMapModal').remove()" style="background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); position:fixed; inset:0;"></div>
      <div class="modal-content" style="max-width:92vw; max-height:92vh; width:1100px; padding:20px; display:flex; flex-direction:column; background:var(--card-bg, #1e293b); border:1px solid var(--border-color); border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.6); z-index:100000; position:relative;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
          <h2 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px; color:var(--text-color, #fff);">
            🗺️ ${title} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">(配置図プレビュー)</span>
          </h2>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-primary btn-small" onclick="Cases.openSyakoMapMaker('${caseId}'); document.getElementById('fullMapModal').remove();">✏️ 所在図・配置図を再編集</button>
            <button class="btn btn-secondary btn-small" onclick="Cases.downloadAttachedMap('${caseId}')">📥 画像保存</button>
            <button class="btn btn-secondary btn-small" onclick="const win=window.open('','_blank'); win.document.write('<img src=\\'${mapPng}\\' style=\\'width:100%;height:auto;display:block;margin:auto;\\' />'); setTimeout(()=>win.print(),200);">🖨️ 印刷</button>
            <button class="modal-close" onclick="document.getElementById('fullMapModal').remove()" style="font-size:1.4rem; cursor:pointer; background:none; border:none; color:var(--text-color, #fff); margin-left:8px;" title="閉じる">✕</button>
          </div>
        </div>
        <div style="flex:1; overflow:auto; display:flex; align-items:center; justify-content:center; background:#0f172a; border-radius:8px; padding:12px; min-height:450px;">
          <img src="${mapPng}" style="max-width:100%; max-height:75vh; object-fit:contain; border-radius:4px; box-shadow:0 4px 20px rgba(0,0,0,0.5);" alt="所在図・配置図" />
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  handleMapPdfUpload(event, caseId) {
    const file = event.target.files[0];
    if (!file) return;
    if (typeof CaseDocs !== 'undefined') {
      App.showToast('⏳ 所在図・配置図ファイルをGoogle Driveへアップロード中...');
      CaseDocs.upload(caseId, file).then(docMeta => {
        if (docMeta) {
          App.showToast(`✅ ${file.name} を案件フォルダに保存しました`);
          Cases.showEditModal(caseId);
        }
      });
    } else {
      App.showToast('⚠️ 書類アップロードモジュールが利用できません');
    }
  },

  downloadAttachedMap(caseId) {
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId);
    if (!mapPng) return;
    const a = document.createElement('a');
    a.href = mapPng;
    a.download = `車庫証明図面_案件_${caseId}.png`;
    a.click();
  },

  deleteAttachedMap(caseId) {
    if (confirm('保存された所在図・配置図データを削除しますか？')) {
      localStorage.removeItem('gyosei_case_map_png_' + caseId);
      localStorage.removeItem('syako_case_map_' + caseId);
      Cases.showEditModal(caseId);
      App.showToast('作図データを削除しました');
    }
  }
};

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'MAP_SAVED') {
    const { caseId } = e.data;
    if (typeof Cases !== 'undefined' && Cases.editingId === caseId) {
      Cases.showEditModal(caseId);
    }
    if (typeof App !== 'undefined') {
      App.refreshView();
      App.showToast('✅ 所在図・配置図が案件に保存されました');
    }
  }
});
