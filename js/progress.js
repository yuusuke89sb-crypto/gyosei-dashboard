/**
 * 案件進捗一覧テーブル
 * スプレッドシート風の一覧で案件の日程・ステータスを確認・編集
 */
const Progress = {
  sortKey: 'createdAt',
  sortDir: 'desc',
  filterDone: false,  // 完了済みも表示するか

  COLUMNS: [
    { key: 'title',       label: '案件名',   sortable: true,  type: 'text' },
    { key: 'clientStore', label: '顧客店舗', sortable: true,  type: 'text' },
    { key: 'clientContact', label: '顧客担当者', sortable: true, type: 'text' },
    { key: 'categoryLabel', label: '業務',   sortable: true,  type: 'text' },
    { key: 'createdAt',   label: '登録日',   sortable: true,  type: 'date-readonly' },
    { key: 'surveyDate',  label: '現調日',   sortable: true,  type: 'date' },
    { key: 'applyDate',   label: '申請日',   sortable: true,  type: 'date' },
    { key: 'policeDeliveryDate', label: '交付日', sortable: true, type: 'date' },
    { key: 'registrationDate',  label: '登録日', sortable: true, type: 'date' },
    { key: 'storeDeliveryDate', label: '店届日', sortable: true, type: 'date' },
    { key: 'status',      label: 'ステータス', sortable: true, type: 'status' },
  ],

  CATEGORY_LABELS: {
    garage_oss: '車庫(OSS)', garage_paper: '車庫(紙)', seal: '丁種封印',
    inheritance: '相続', realestate: '宅建業', antiques: '古物商',
    cabaret: '風営法', visa_work: '在留資格',
  },

  STATUS_OPTIONS: [
    { key: 'received', label: '受付', icon: '📥', color: '#6b7280' },
    { key: 'applying', label: '申請', icon: '📝', color: '#3b82f6' },
    { key: 'delivery', label: '交付', icon: '📋', color: '#f59e0b' },
    { key: 'registration', label: '登録', icon: '🚗', color: '#8b5cf6' },
    { key: 'done', label: '完了', icon: '✅', color: '#10b981' },
  ],

  render() {
    const rows = this.getRows();

    return `
      <div class="progress-page">
        <div class="page-header">
          <h1>📊 進捗管理</h1>
          <div style="display:flex;gap:8px;align-items:center;">
            <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" ${this.filterDone ? 'checked' : ''}
                onchange="Progress.filterDone=this.checked;App.refreshView();">
              完了済みも表示
            </label>
          </div>
        </div>

        <div class="progress-table-wrap">
          <table class="progress-table">
            <thead>
              <tr>
                ${this.COLUMNS.map(col => `
                  <th class="${col.sortable ? 'sortable' : ''} ${this.sortKey === col.key ? 'sorted' : ''}"
                      onclick="${col.sortable ? `Progress.toggleSort('${col.key}')` : ''}">
                    ${col.label}
                    ${this.sortKey === col.key ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0
                ? '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-muted);">案件がありません</td></tr>'
                : rows.map(row => this.renderRow(row)).join('')}
            </tbody>
          </table>
        </div>

        <div class="progress-footer">
          <span style="color:var(--text-muted);font-size:0.78rem;">全 ${rows.length} 件</span>
        </div>
      </div>
    `;
  },

  getRows() {
    let cases = Store.getCases();
    if (!this.filterDone) cases = cases.filter(c => c.status !== 'done');

    // 各行のデータを拡張
    const rows = cases.map(c => {
      const client = Store.getClient(c.clientId);
      const staff = c.staffId ? Store.getStaffName(c.staffId) : '';
      return {
        ...c,
        clientStore: client ? (client.name || '') : '',
        clientContact: client ? (client.companyName || '') : '',
        categoryLabel: this.CATEGORY_LABELS[c.category] || c.category || '',
      };
    });

    // ソート
    rows.sort((a, b) => {
      let va = a[this.sortKey] || '';
      let vb = b[this.sortKey] || '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  },

  renderRow(row) {
    const statusInfo = this.STATUS_OPTIONS.find(s => s.key === row.status) || this.STATUS_OPTIONS[0];
    const isDone = row.status === 'done';
    const rowClass = isDone ? 'progress-row done' : 'progress-row';

    return `
      <tr class="${rowClass}" data-id="${row.id}">
        <td class="cell-title" onclick="Cases.showEditModal('${row.id}')" title="クリックで案件詳細を開く">
          ${this.escHtml(row.title || '(無題)')}
        </td>
        <td class="cell-text">${this.escHtml(row.clientStore)}</td>
        <td class="cell-text">${this.escHtml(row.clientContact)}</td>
        <td class="cell-category">${this.escHtml(row.categoryLabel)}</td>
        <td class="cell-date readonly">${this.formatDate(row.createdAt)}</td>
        ${this.renderDateCell(row, 'surveyDate')}
        ${this.renderDateCell(row, 'applyDate')}
        ${this.renderDateCell(row, 'policeDeliveryDate')}
        ${this.renderDateCell(row, 'registrationDate')}
        ${this.renderDateCell(row, 'storeDeliveryDate')}
        <td class="cell-status" onclick="Progress.showStatusPicker(event, '${row.id}')">
          <span class="status-badge" style="--status-color:${statusInfo.color}">
            ${statusInfo.icon} ${statusInfo.label}
          </span>
        </td>
      </tr>
    `;
  },

  // 日程フィールドがどのステータス段階に属するか
  FIELD_STAGE: {
    surveyDate: 0,           // 受付前〜受付
    applyDate: 1,            // 申請
    policeDeliveryDate: 2,   // 交付
    registrationDate: 3,     // 登録
    storeDeliveryDate: 3,    // 登録（店届も同段階）
  },

  STATUS_STAGE: {
    received: 0,
    applying: 1,
    delivery: 2,
    registration: 3,
    done: 4,
  },

  renderDateCell(row, field) {
    const value = row[field] || '';
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const isToday = value === today;
    const isPast = value && value < today;

    // この日程フィールドの段階と、案件の現在ステータスの段階を比較
    const fieldStage = this.FIELD_STAGE[field] ?? 0;
    const statusStage = this.STATUS_STAGE[row.status] ?? 0;
    const isCompleted = statusStage > fieldStage; // 現在のステータスがこの工程より先に進んでいる

    let cellClass = 'cell-date editable';
    let displayValue = '';

    if (!value) {
      displayValue = '<span class="empty-date">──</span>';
    } else if (isCompleted && isPast) {
      // 通過済み → 完了表示（緑✅）
      cellClass += ' completed';
      displayValue = '✅ ' + this.formatDate(value);
    } else if (isToday) {
      cellClass += ' today';
      displayValue = this.formatDate(value);
    } else if (isPast && !isCompleted) {
      // まだその工程に到達していないのに日付が過去 → 期限超過
      cellClass += ' overdue';
      displayValue = '⚠️ ' + this.formatDate(value);
    } else {
      displayValue = this.formatDate(value);
    }

    return `
      <td class="${cellClass}" onclick="Progress.showDatePicker(event, '${row.id}', '${field}')">
        ${displayValue}
      </td>
    `;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  // ── ソート ──
  toggleSort(key) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    App.refreshView();
  },

  // ── インライン日付編集 ──
  showDatePicker(event, caseId, field) {
    event.stopPropagation();
    // 既存のピッカーを削除
    document.querySelectorAll('.progress-datepicker').forEach(el => el.remove());

    const cell = event.currentTarget;
    const c = Store.getCase(caseId);
    const currentVal = c ? (c[field] || '') : '';

    const picker = document.createElement('div');
    picker.className = 'progress-datepicker';
    picker.innerHTML = `
      <input type="date" value="${currentVal}" autofocus
        onchange="Progress.updateDate('${caseId}', '${field}', this.value)"
        onblur="setTimeout(() => this.parentElement?.remove(), 150)">
      ${currentVal ? `<button class="btn-clear-date" onclick="Progress.updateDate('${caseId}', '${field}', '');this.parentElement.remove();">✕</button>` : ''}
    `;
    cell.appendChild(picker);
    picker.querySelector('input').focus();
  },

  updateDate(caseId, field, value) {
    Store.updateCase(caseId, { [field]: value });
    App.refreshView();
    App.showToast('日付を更新しました');
  },

  // ── ステータス変更 ──
  showStatusPicker(event, caseId) {
    event.stopPropagation();
    document.querySelectorAll('.progress-status-picker').forEach(el => el.remove());

    const cell = event.currentTarget;
    const picker = document.createElement('div');
    picker.className = 'progress-status-picker';
    picker.innerHTML = this.STATUS_OPTIONS.map(s => `
      <button class="status-option" onclick="Progress.updateStatus('${caseId}', '${s.key}');this.parentElement.remove();"
              style="--status-color:${s.color}">
        ${s.icon} ${s.label}
      </button>
    `).join('');
    cell.appendChild(picker);

    // 外側クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!picker.contains(e.target)) {
          picker.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 10);
  },

  updateStatus(caseId, newStatus) {
    Store.updateCase(caseId, { status: newStatus });
    App.refreshView();
    App.showToast('ステータスを更新しました');
  },
};
