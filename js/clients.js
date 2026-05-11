/**
 * 顧客管理画面
 */
const Clients = {
  searchQuery: '',
  editingId: null,

  render() {
    const clients = Store.getClients();
    const filtered = this.searchQuery
      ? clients.filter(c =>
        c.name.includes(this.searchQuery) ||
        c.nameKana.includes(this.searchQuery) ||
        c.phone.includes(this.searchQuery) ||
        c.email.includes(this.searchQuery)
      )
      : clients;

    const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return `
      <div class="clients-page">
        <div class="page-header">
          <h1>顧客管理</h1>
          <button class="btn btn-primary" onclick="Clients.showAddModal()">
            <span class="btn-icon">＋</span> 新規登録
          </button>
        </div>

        <div class="search-bar">
          <input type="text" id="clientSearch" class="search-input" placeholder="🔍 名前・電話・メールで検索..."
            value="${this.searchQuery}" oninput="Clients.onSearch(this.value)">
        </div>

        <div class="client-list">
          ${sorted.length === 0
        ? '<div class="empty-state"><div class="empty-icon">👥</div><p>顧客がまだ登録されていません</p><button class="btn btn-primary" onclick="Clients.showAddModal()">最初の顧客を登録</button></div>'
        : sorted.map(c => this.renderCard(c)).join('')
      }
        </div>
      </div>
      ${this.renderModal()}
    `;
  },

  // 今月完了分の請求額を計算
  getMonthlyBilling(clientId) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cases = Store.getCasesByClient(clientId);
    const completed = cases.filter(c => {
      if (c.status !== 'done' || !c.fee) return false;
      const doneDate = c.completedAt || c.updatedAt || '';
      return doneDate.startsWith(yearMonth);
    });
    const total = completed.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    return { total, cases: completed };
  },

  renderCard(client) {
    const cases = Store.getCasesByClient(client.id);
    const HIDE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const visibleCases = cases.filter(c => {
      if (c.status !== 'done' || !c.completedAt) return true;
      return (now - new Date(c.completedAt).getTime()) < HIDE_AFTER_MS;
    });
    const activeCases = visibleCases.filter(c => c.status !== 'done');
    const staffName = Store.getStaffName(client.staffId);
    const typeBadge = client.type === '法人'
      ? '<span class="badge badge-corp">法人</span>'
      : '<span class="badge badge-personal">個人</span>';
    const billing = this.getMonthlyBilling(client.id);
    return `
      <div class="client-card" onclick="Clients.showDetail('${client.id}')">
        <div class="client-card-header">
          <div class="client-avatar">${client.name.charAt(0)}</div>
          <div class="client-info">
            <div class="client-name">${typeBadge} ${client.name}</div>
            <div class="client-kana">${client.nameKana || ''}</div>
          </div>
          <div class="client-cases-badge">
            ${activeCases.length > 0
        ? `<span class="badge badge-active">${activeCases.length}件進行中</span>`
        : visibleCases.length > 0
          ? `<span class="badge badge-done">${visibleCases.length}件完了</span>`
          : `<span class="badge badge-none">案件なし</span>`}
          </div>
        </div>
        <div class="client-card-body">
          ${client.phone ? `<div class="client-detail"><span class="detail-icon">📞</span> ${client.phone}</div>` : ''}
          ${client.email ? `<div class="client-detail"><span class="detail-icon">✉️</span> ${client.email}</div>` : ''}
          ${client.address ? `<div class="client-detail"><span class="detail-icon">📍</span> ${client.address}</div>` : ''}
          ${client.staffId ? `<div class="client-detail"><span class="detail-icon">👤</span> 担当: ${staffName}</div>` : ''}
          ${billing.total > 0 ? `<div class="client-billing">💰 今月請求: <strong>${billing.total.toLocaleString()}円</strong> (${billing.cases.length}件)</div>` : ''}
        </div>
      </div>
    `;
  },

  renderModal() {
    const staffOptions = Store.getStaff().map(s =>
      `<option value="${s.id}">${s.name}${s.role ? ' (' + s.role + ')' : ''}</option>`
    ).join('');

    return `
      <div id="clientModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Clients.closeModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="clientModalTitle">顧客登録</h2>
            <button class="modal-close" onclick="Clients.closeModal()">✕</button>
          </div>
          <form id="clientForm" onsubmit="Clients.onSubmit(event)">
            <div class="form-row">
              <div class="form-group">
                <label>氏名 <span class="required">*</span></label>
                <input type="text" name="name" id="cf_name" required placeholder="山田 太郎">
              </div>
              <div class="form-group">
                <label>フリガナ</label>
                <input type="text" name="nameKana" id="cf_nameKana" placeholder="ヤマダ タロウ">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>区分</label>
                <select name="type" id="cf_type">
                  <option value="個人">個人</option>
                  <option value="法人">法人</option>
                </select>
              </div>
              <div class="form-group">
                <label>担当者</label>
                <select name="staffId" id="cf_staffId">
                  <option value="">— 選択 —</option>
                  ${staffOptions}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>電話番号</label>
                <input type="tel" name="phone" id="cf_phone" placeholder="090-1234-5678">
              </div>
              <div class="form-group">
                <label>メール</label>
                <input type="email" name="email" id="cf_email" placeholder="example@mail.com">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>郵便番号</label>
                <input type="text" name="zip" id="cf_zip" placeholder="460-0001">
              </div>
              <div class="form-group">
                <label>紹介元</label>
                <input type="text" name="referral" id="cf_referral" placeholder="田中先生紹介">
              </div>
            </div>
            <div class="form-group">
              <label>住所</label>
              <input type="text" name="address" id="cf_address" placeholder="愛知県名古屋市...">
            </div>
            <div class="form-group">
              <label>メモ</label>
              <textarea name="memo" id="cf_memo" rows="3" placeholder="その他メモ..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="Clients.closeModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  onSearch(query) {
    this.searchQuery = query;
    App.refreshView();
  },

  showAddModal() {
    this.editingId = null;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('clientModalTitle').textContent = '顧客登録';
      document.getElementById('clientForm').reset();
      document.getElementById('clientModal').style.display = 'flex';
    }, 0);
  },

  showEditModal(id) {
    this.editingId = id;
    const client = Store.getClient(id);
    if (!client) return;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('clientModalTitle').textContent = '顧客編集';
      document.getElementById('cf_name').value = client.name;
      document.getElementById('cf_nameKana').value = client.nameKana || '';
      document.getElementById('cf_type').value = client.type || '個人';
      document.getElementById('cf_staffId').value = client.staffId || '';
      document.getElementById('cf_phone').value = client.phone || '';
      document.getElementById('cf_email').value = client.email || '';
      document.getElementById('cf_zip').value = client.zip || '';
      document.getElementById('cf_referral').value = client.referral || '';
      document.getElementById('cf_address').value = client.address || '';
      document.getElementById('cf_memo').value = client.memo || '';
      document.getElementById('clientModal').style.display = 'flex';
    }, 0);
  },

  closeModal() {
    document.getElementById('clientModal').style.display = 'none';
    this.editingId = null;
  },

  onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      nameKana: form.nameKana.value.trim(),
      type: form.type.value,
      staffId: form.staffId.value,
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      zip: form.zip.value.trim(),
      referral: form.referral.value.trim(),
      address: form.address.value.trim(),
      memo: form.memo.value.trim(),
    };
    if (this.editingId) {
      Store.updateClient(this.editingId, data);
    } else {
      Store.addClient(data);
    }
    this.closeModal();
    App.refreshView();
    App.showToast(this.editingId ? '顧客情報を更新しました' : '顧客を登録しました');
  },

  showDetail(id) {
    const client = Store.getClient(id);
    if (!client) return;
    const cases = Store.getCasesByClient(id);
    const CATEGORY_LABELS = { garage_oss: '🚗 車庫証明（OSS）', garage_paper: '🚗 車庫証明（紙）', seal: '🚙 丁種封印', inheritance: '📜 相続' };
    const STATUS_LABELS = { received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了' };
    const staffName = Store.getStaffName(client.staffId);
    const typeBadge = client.type === '法人'
      ? '<span class="badge badge-corp">法人</span>'
      : '<span class="badge badge-personal">個人</span>';
    const billing = this.getMonthlyBilling(id);
    const now = new Date();
    const billingMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'clientDetailModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('clientDetailModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${typeBadge} ${client.name} の詳細</h2>
          <button class="modal-close" onclick="document.getElementById('clientDetailModal').remove()">✕</button>
        </div>
        <div class="detail-section">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">フリガナ</span><span>${client.nameKana || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">区分</span><span>${client.type || '個人'}</span></div>
            <div class="detail-item"><span class="detail-label">電話</span><span>${client.phone || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">メール</span><span>${client.email || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">郵便番号</span><span>${client.zip || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">住所</span><span>${client.address || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">担当者</span><span>${staffName}</span></div>
            <div class="detail-item"><span class="detail-label">紹介元</span><span>${client.referral || '—'}</span></div>
            ${client.type === '法人' ? `
            <div class="detail-item"><span class="detail-label">法人名</span><span>${client.companyName || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">法人番号</span><span>${client.companyNumber || '—'}</span></div>
            ` : ''}
            <div class="detail-item full-width"><span class="detail-label">メモ</span><span>${client.memo || '—'}</span></div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-secondary" onclick="document.getElementById('clientDetailModal').remove(); Clients.showEditModal('${client.id}')">✏️ 編集</button>
            <button class="btn btn-primary" onclick="document.getElementById('clientDetailModal').remove(); Invoice.showSelectModal('${client.id}')">📄 請求書発行</button>
            <button class="btn btn-danger" onclick="if(confirm('この顧客と紐づく案件を全て削除しますか？')){Store.deleteClient('${client.id}'); document.getElementById('clientDetailModal').remove(); App.refreshView(); App.showToast('顧客を削除しました');}">🗑️ 削除</button>
          </div>
        </div>
        <div class="detail-section billing-section">
          <h3>💰 ${billingMonth}分 請求額</h3>
          ${billing.total > 0 ? `
            <div class="billing-total">¥${billing.total.toLocaleString()}</div>
            <div class="billing-breakdown">
              ${billing.cases.map(c => `
                <div class="billing-item">
                  <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category]}</span>
                  <span class="billing-item-title">${c.title}</span>
                  <span class="billing-item-fee">¥${Number(c.fee).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
            <div class="billing-note">※ 完了案件のみ・月末締め</div>
          ` : '<p class="empty-message">今月の請求はありません</p>'}
        </div>
        <div class="detail-section">
          <h3>📋 案件一覧 (${cases.length}件)</h3>
          ${cases.length === 0
        ? '<p class="empty-message">紐づく案件はありません</p>'
        : `<div class="mini-case-list">${cases.map(c => `
                <div class="mini-case-item">
                  <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category]}</span>
                  <span class="mini-case-title">${c.title}</span>
                  ${c.fee ? `<span class="mini-case-fee">¥${Number(c.fee).toLocaleString()}</span>` : ''}
                  <span class="status-badge status-${c.status}">${STATUS_LABELS[c.status]}</span>
                </div>`).join('')}</div>`
      }
        </div>
        <div class="detail-section">
          ${typeof ActivityLog !== 'undefined' ? ActivityLog.renderWidget('client', id) : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
};
