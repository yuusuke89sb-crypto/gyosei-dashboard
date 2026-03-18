/**
 * データストア - localStorage ベースの CRUD 操作
 */
const Store = {
  KEYS: {
    CLIENTS: 'gyosei_clients',
    CASES: 'gyosei_cases',
    STAFF: 'gyosei_staff',
    EVENTS: 'gyosei_events',
    JOURNALS: 'gyosei_journals',
  },

  // ---- ユーティリティ ----
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  _get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  },

  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // ---- 顧客 CRUD ----
  getClients() {
    return this._get(this.KEYS.CLIENTS);
  },

  getClient(id) {
    return this.getClients().find(c => c.id == id) || null;
  },

  addClient(data) {
    const clients = this.getClients();
    const client = {
      id: data.id || this._generateId(),
      name: data.name || '',
      nameKana: data.nameKana || '',
      type: data.type || '個人',
      phone: data.phone || '',
      email: data.email || '',
      zip: data.zip || '',
      address: data.address || '',
      birthday: data.birthday || '',
      companyName: data.companyName || '',
      companyNumber: data.companyNumber || '',
      referral: data.referral || '',
      staffId: data.staffId || '',
      memo: data.memo || '',
      createdAt: data.createdAt || new Date().toISOString(),
    };
    clients.push(client);
    this._set(this.KEYS.CLIENTS, clients);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertCustomer', client);
    }
    return client;
  },

  updateClient(id, data) {
    const clients = this.getClients();
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) return null;
    clients[idx] = { ...clients[idx], ...data };
    this._set(this.KEYS.CLIENTS, clients);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertCustomer', clients[idx]);
    }
    return clients[idx];
  },

  deleteClient(id) {
    const clients = this.getClients().filter(c => c.id !== id);
    this._set(this.KEYS.CLIENTS, clients);
    // 紐づく案件も削除
    const cases = this.getCases().filter(c => c.clientId !== id);
    this._set(this.KEYS.CASES, cases);
    // スプレッドシートからも削除
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('deleteCustomer', { id });
    }
  },

  // ---- 案件 CRUD ----
  getCases() {
    return this._get(this.KEYS.CASES);
  },

  getCase(id) {
    return this.getCases().find(c => c.id == id) || null;
  },

  getCasesByClient(clientId) {
    return this.getCases().filter(c => c.clientId == clientId);
  },

  addCase(data) {
    const cases = this.getCases();
    const newCase = {
      id: this._generateId(),
      clientId: data.clientId || '',
      title: data.title || '',
      category: data.category || 'garage',      // garage | inheritance | mahjong
      status: data.status || 'received',         // received | hearing | documents | applying | done
      deadline: data.deadline || '',
      fee: data.fee || '',
      memo: data.memo || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cases.push(newCase);
    this._set(this.KEYS.CASES, cases);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertCase', newCase);
    }
    return newCase;
  },

  updateCase(id, data) {
    const cases = this.getCases();
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const oldStatus = cases[idx].status;
    // 完了日を自動記録（完了→他ステータスに戻したらクリア）
    if (data.status === 'done' && oldStatus !== 'done') {
      data.completedAt = new Date().toISOString();
    } else if (data.status && data.status !== 'done') {
      data.completedAt = null;
    }
    cases[idx] = { ...cases[idx], ...data, updatedAt: new Date().toISOString() };
    this._set(this.KEYS.CASES, cases);

    // スプレッドシートへ自動プッシュ
    const updatedCase = cases[idx];
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertCase', updatedCase);
    }

    // 完了時に報酬があれば仕訳を自動生成
    if (data.status === 'done' && oldStatus !== 'done' && updatedCase.fee && Number(updatedCase.fee) > 0) {
      this._autoCreateJournal(updatedCase);
    }
    return updatedCase;
  },

  _autoCreateJournal(c) {
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    // 同一案件の重複チェック
    if (journals.some(j => j.caseId === c.id)) return;
    const client = this.getClient(c.clientId);
    const CATS = { garage: '車庫証明', inheritance: '相続', mahjong: '麻雀関連', construction: '建設業', farmland: '農地転用', liquor: '酒類販売', visa: '在留資格', other: 'その他' };
    journals.push({
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().slice(0, 10),
      debit: '売掛金',
      credit: '売上高',
      amount: Number(c.fee),
      description: `[${CATS[c.category] || c.category}] ${c.title}${client ? ' / ' + client.name : ''}`,
      caseId: c.id,
      auto: true,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));
    // 帳簿もスプレッドシートへプッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertJournal', journals[journals.length - 1]);
    }
  },

  deleteCase(id) {
    const cases = this.getCases().filter(c => c.id !== id);
    this._set(this.KEYS.CASES, cases);
    // スプレッドシートからも削除
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('deleteCase', { id });
    }
  },

  // ---- 担当者 ----
  getStaff() {
    return this._get(this.KEYS.STAFF).filter(s => s.status !== '退職');
  },

  getAllStaff() {
    return this._get(this.KEYS.STAFF);
  },

  getStaffMember(id) {
    return this._get(this.KEYS.STAFF).find(s => s.id == id) || null;
  },

  getStaffName(id) {
    if (!id) return '—';
    const staff = this.getStaffMember(id);
    return staff ? staff.name : id;
  },

  // ---- 予定 CRUD ----
  getEvents() {
    return this._get(this.KEYS.EVENTS);
  },

  getEvent(id) {
    return this.getEvents().find(e => e.id === id) || null;
  },

  addEvent(data) {
    const events = this.getEvents();
    const event = {
      id: this._generateId(),
      title: data.title || '',
      date: data.date || '',
      time: data.time || '',
      endTime: data.endTime || '',
      staffId: data.staffId || '',
      category: data.category || 'other',
      memo: data.memo || '',
      createdAt: new Date().toISOString(),
    };
    events.push(event);
    this._set(this.KEYS.EVENTS, events);
    return event;
  },

  updateEvent(id, data) {
    const events = this.getEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    events[idx] = { ...events[idx], ...data };
    this._set(this.KEYS.EVENTS, events);
    return events[idx];
  },

  deleteEvent(id) {
    const events = this.getEvents().filter(e => e.id !== id);
    this._set(this.KEYS.EVENTS, events);
  },

  // ---- エクスポート / インポート ----
  exportData() {
    const data = {
      clients: this.getClients(),
      cases: this.getCases(),
      staff: this.getAllStaff(),
      events: this.getEvents(),
      journals: JSON.parse(localStorage.getItem('gyosei_journals') || '[]'),
      payments: JSON.parse(localStorage.getItem('gyosei_payments') || '[]'),
      activityLog: JSON.parse(localStorage.getItem('gyosei_activity_log') || '[]'),
      recurring: JSON.parse(localStorage.getItem('gyosei_recurring') || '[]'),
      goals: JSON.parse(localStorage.getItem('gyosei_goals') || 'null'),
      koteihi: JSON.parse(localStorage.getItem('koteihi_data') || 'null'),
      koteihiLifeplan: JSON.parse(localStorage.getItem('koteihi_lifeplan') || 'null'),
      syncSettings: JSON.parse(localStorage.getItem('gyosei_sync_settings') || 'null'),
      exportedAt: new Date().toISOString(),
      version: '2.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gyosei_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('バックアップファイルをダウンロードしました');
    }
  },

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.clients) this._set(this.KEYS.CLIENTS, data.clients);
      if (data.cases) this._set(this.KEYS.CASES, data.cases);
      if (data.staff) this._set(this.KEYS.STAFF, data.staff);
      if (data.events) this._set(this.KEYS.EVENTS, data.events);
      if (data.journals) localStorage.setItem('gyosei_journals', JSON.stringify(data.journals));
      if (data.payments) localStorage.setItem('gyosei_payments', JSON.stringify(data.payments));
      if (data.activityLog) localStorage.setItem('gyosei_activity_log', JSON.stringify(data.activityLog));
      if (data.recurring) localStorage.setItem('gyosei_recurring', JSON.stringify(data.recurring));
      if (data.goals) localStorage.setItem('gyosei_goals', JSON.stringify(data.goals));
      if (data.koteihi) localStorage.setItem('koteihi_data', JSON.stringify(data.koteihi));
      if (data.koteihiLifeplan) localStorage.setItem('koteihi_lifeplan', JSON.stringify(data.koteihiLifeplan));
      if (data.syncSettings) localStorage.setItem('gyosei_sync_settings', JSON.stringify(data.syncSettings));
      return true;
    } catch {
      return false;
    }
  },

  // ---- 統計 ----
  getStats() {
    const cases = this.getCases();
    const clients = this.getClients();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const activeCases = cases.filter(c => c.status !== 'done');
    const urgentCases = activeCases.filter(c => {
      if (!c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl <= in3Days;
    });
    const upcomingCases = activeCases.filter(c => {
      if (!c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl > in3Days && dl <= in7Days;
    });

    const statusCounts = {
      received: cases.filter(c => c.status === 'received').length,
      hearing: cases.filter(c => c.status === 'hearing').length,
      documents: cases.filter(c => c.status === 'documents').length,
      applying: cases.filter(c => c.status === 'applying').length,
      done: cases.filter(c => c.status === 'done').length,
    };

    const categoryCounts = {};
    const cats = ['garage', 'inheritance', 'mahjong', 'construction', 'farmland', 'liquor', 'visa', 'other'];
    cats.forEach(cat => {
      const count = cases.filter(c => c.category === cat).length;
      if (count > 0) categoryCounts[cat] = count;
    });

    return {
      totalClients: clients.length,
      totalCases: cases.length,
      activeCases: activeCases.length,
      urgentCases,
      upcomingCases,
      statusCounts,
      categoryCounts,
    };
  },
};
