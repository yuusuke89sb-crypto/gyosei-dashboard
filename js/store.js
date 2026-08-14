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
    TODOS: 'gyosei_todos',
    CLIENT_CONTACTS: 'gyosei_client_contacts',
    LOCATIONS: 'gyosei_locations',
    INBOX: 'gyosei_inbox',
    INHERITANCE_FILES: 'gyosei_inheritance_files',
  },

  // 旧ステータスの自動マイグレーション（hearing→applying, documents→delivery）
  _migrateStatuses() {
    const MAP = { hearing: 'applying', documents: 'delivery' };
    const cases = JSON.parse(localStorage.getItem('gyosei_cases') || '[]');
    let changed = false;
    cases.forEach(c => { if (MAP[c.status]) { c.status = MAP[c.status]; changed = true; } });
    if (changed) localStorage.setItem('gyosei_cases', JSON.stringify(cases));
  },

  // ---- ユーティリティ ----
  getLocalDateStr(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getDiffDays(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length < 3) return 0;
    const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  },

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

  getClientName(id) {
    if (!id) return '';
    const client = this.getClient(id);
    return client ? client.name : '';
  },

  addClient(data) {
    const clients = this.getClients();
    const client = {
      id: data.id || this._generateId(),
      name: data.name || '',
      nameKana: data.nameKana || '',
      type: data.type || '個人',
      phone: data.phone || '',
      fax: data.fax || '',
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

    // 紐づく案件のIDを収集して案件を削除
    const clientCases = this.getCases().filter(c => c.clientId === id);
    const clientCaseIds = clientCases.map(c => c.id);
    const remainingCases = this.getCases().filter(c => c.clientId !== id);
    this._set(this.KEYS.CASES, remainingCases);

    // 紐づく請求・入金レコード（payments）を削除
    const payments = JSON.parse(localStorage.getItem('gyosei_payments') || '[]');
    const clientPayments = payments.filter(p => p.clientId == id);
    const clientPaymentIds = clientPayments.map(p => p.id);
    const remainingPayments = payments.filter(p => p.clientId != id);
    localStorage.setItem('gyosei_payments', JSON.stringify(remainingPayments));

    // 紐づく仕訳データ（journals）もクリーンアップ（案件IDまたは入金IDで紐づくもの）
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const remainingJournals = journals.filter(j => 
      !clientCaseIds.includes(j.caseId) && !clientPaymentIds.includes(j.paymentId)
    );
    localStorage.setItem('gyosei_journals', JSON.stringify(remainingJournals));

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
      category: data.category || 'garage_oss',      // garage_oss | garage_paper | seal | car_reg_standard | car_reg_light
      subCategory: data.subCategory || '',          // 登録種別（新規、移転、変更、抹消等）
      status: data.status || 'received',            // received | applying | delivery | done
      deadline: data.deadline || '',
      fee: data.fee || '',
      advances: data.advances || [],             // [{label, amount}] 立替金
      docs: data.docs || [],                     // [{id, name, driveUrl, ...}] 添付書類
      deathDate: data.deathDate || '',
      applyDate: data.applyDate || '',
      policeDeliveryDate: data.policeDeliveryDate || '',
      storeDeliveryDate: data.storeDeliveryDate || '',
      storeDeliveryTime: data.storeDeliveryTime || '',
      locationId: data.locationId || '',
      clientContactId: data.clientContactId || '',
      policeLocationId: data.policeLocationId || '',
      landTransportLocationId: data.landTransportLocationId || '',
      registrationDate: data.registrationDate || '',
      carName: data.carName || '',               // 名前（申請者等）
      carAddress: data.carAddress || '',         // 住所
      carNumber: data.carNumber || '',           // 車台番号
      carPolice: data.carPolice || '',           // 所轄警察署
      faxId: data.faxId || '',                   // 受信FAXとの紐付け用ID
      inboxId: data.inboxId || '',               // インボックス連携用ID
      calendarEventIds: data.calendarEventIds || {},  // { apply, delivery, storeDelivery, registration } カレンダー同期用
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
    const CATS = { garage_oss: '車庫証明(OSS)', garage_paper: '車庫証明(紙)', seal: '出張封印', car_reg_standard: '普通車登録', car_reg_light: '軽自動車登録' };
    journals.push({
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: this.getLocalDateStr(),
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

    // 紐づく仕訳データ（journals）もクリーンアップ
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const remainingJournals = journals.filter(j => j.caseId !== id);
    localStorage.setItem('gyosei_journals', JSON.stringify(remainingJournals));

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
      locationId: data.locationId || '',
      clientId: data.clientId || '',
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

  // ---- TODO CRUD ----
  getTodos() {
    return this._get(this.KEYS.TODOS);
  },

  getTodosByDate(dateStr) {
    return this.getTodos().filter(t => t.date === dateStr);
  },

  addTodo(data) {
    const todos = this.getTodos();
    const todo = {
      id: 'todo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: data.date,
      text: data.text || '',
      done: false,
      createdAt: new Date().toISOString(),
    };
    todos.push(todo);
    this._set(this.KEYS.TODOS, todos);
    return todo;
  },

  toggleTodo(id) {
    const todos = this.getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
      this._set(this.KEYS.TODOS, todos);
    }
  },

  deleteTodo(id) {
    const todos = this.getTodos().filter(t => t.id !== id);
    this._set(this.KEYS.TODOS, todos);
  },

  // ---- 顧客担当者 CRUD ----
  getAllClientContacts() {
    return this._get(this.KEYS.CLIENT_CONTACTS);
  },

  getClientContacts(clientId) {
    return this.getAllClientContacts().filter(c => c.clientId == clientId);
  },

  getClientContact(id) {
    return this.getAllClientContacts().find(c => c.id == id) || null;
  },

  addClientContact(data) {
    const contacts = this.getAllClientContacts();
    const contact = {
      id: this._generateId(),
      clientId: data.clientId || '',
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      memo: data.memo || '',
      createdAt: new Date().toISOString(),
    };
    contacts.push(contact);
    this._set(this.KEYS.CLIENT_CONTACTS, contacts);
    return contact;
  },

  updateClientContact(id, data) {
    const contacts = this.getAllClientContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return null;
    contacts[idx] = { ...contacts[idx], ...data };
    this._set(this.KEYS.CLIENT_CONTACTS, contacts);
    return contacts[idx];
  },

  deleteClientContact(id) {
    const contacts = this.getAllClientContacts().filter(c => c.id !== id);
    this._set(this.KEYS.CLIENT_CONTACTS, contacts);
  },

  // ---- 場所マスター CRUD ----
  getLocations() {
    return this._get(this.KEYS.LOCATIONS);
  },

  getLocation(id) {
    return this.getLocations().find(l => l.id == id) || null;
  },

  getLocationName(id) {
    if (!id) return '';
    const loc = this.getLocation(id);
    return loc ? loc.name : '';
  },

  addLocation(data) {
    const locations = this.getLocations();
    const location = {
      id: data.id || this._generateId(),
      name: data.name || '',
      address: data.address || '',
      memo: data.memo || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
    locations.push(location);
    this._set(this.KEYS.LOCATIONS, locations);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertLocation', location);
    }
    return location;
  },

  updateLocation(id, data) {
    const locations = this.getLocations();
    const idx = locations.findIndex(l => l.id === id);
    if (idx === -1) return null;
    locations[idx] = { ...locations[idx], ...data, updatedAt: new Date().toISOString() };
    this._set(this.KEYS.LOCATIONS, locations);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertLocation', locations[idx]);
    }
    return locations[idx];
  },

  deleteLocation(id) {
    const locations = this.getLocations().filter(l => l.id !== id);
    this._set(this.KEYS.LOCATIONS, locations);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('deleteLocation', { id });
    }
  },

  // ---- 相続事件簿 CRUD ----
  getInheritanceFiles() {
    return this._get(this.KEYS.INHERITANCE_FILES);
  },

  getInheritanceFile(id) {
    return this.getInheritanceFiles().find(f => f.id === id) || null;
  },

  getInheritanceFileByCase(caseId) {
    return this.getInheritanceFiles().find(f => f.caseId === caseId) || null;
  },

  addInheritanceFile(data) {
    const files = this.getInheritanceFiles();
    const now = new Date().toISOString();
    const file = {
      id: 'inh_' + this._generateId(),
      caseId: data.caseId || '',
      createdAt: now,
      updatedAt: now,
      acceptanceInfo: data.acceptanceInfo || {},
      deceasedName: data.deceasedName || '',
      deathDate: data.deathDate || '',
      deathCertificateCopies: data.deathCertificateCopies || '',
      heirs: data.heirs || [],
      registryInfo: data.registryInfo || {},
      banks: data.banks || [],
      realEstateProps: data.realEstateProps || [],
      otherInfo: data.otherInfo || {},
    };
    files.push(file);
    this._set(this.KEYS.INHERITANCE_FILES, files);
    return file;
  },

  updateInheritanceFile(id, data) {
    const files = this.getInheritanceFiles();
    const idx = files.findIndex(f => f.id === id);
    if (idx === -1) return null;
    files[idx] = { ...files[idx], ...data, updatedAt: new Date().toISOString() };
    this._set(this.KEYS.INHERITANCE_FILES, files);
    return files[idx];
  },

  deleteInheritanceFile(id) {
    const files = this.getInheritanceFiles().filter(f => f.id !== id);
    this._set(this.KEYS.INHERITANCE_FILES, files);
  },

  // ---- インボックス CRUD ----
  getInbox() {
    return this._get(this.KEYS.INBOX);
  },

  updateInboxStatus(id, status, caseId = '') {
    const inbox = this.getInbox();
    const idx = inbox.findIndex(item => item.id === id);
    if (idx === -1) return null;
    inbox[idx] = { ...inbox[idx], status, caseId };
    this._set(this.KEYS.INBOX, inbox);
    // スプレッドシートへ自動プッシュ
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('upsertInboxItem', inbox[idx]);
    }
    return inbox[idx];
  },

  // ---- エクスポート / インポート ----
  exportData() {
    const data = {
      clients: this.getClients(),
      cases: this.getCases(),
      inbox: this.getInbox(),
      staff: this.getAllStaff(),
      events: this.getEvents(),
      todos: this.getTodos(),
      clientContacts: this.getAllClientContacts(),
      locations: this.getLocations(),
      journals: JSON.parse(localStorage.getItem('gyosei_journals') || '[]'),
      payments: JSON.parse(localStorage.getItem('gyosei_payments') || '[]'),
      activityLog: JSON.parse(localStorage.getItem('gyosei_activity_log') || '[]'),
      recurring: JSON.parse(localStorage.getItem('gyosei_recurring') || '[]'),
      inheritanceFiles: this.getInheritanceFiles(),
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
      if (data.todos) this._set(this.KEYS.TODOS, data.todos);
      if (data.clientContacts) this._set(this.KEYS.CLIENT_CONTACTS, data.clientContacts);
      if (data.locations) this._set(this.KEYS.LOCATIONS, data.locations);
      if (data.inbox) this._set(this.KEYS.INBOX, data.inbox);
      if (data.journals) localStorage.setItem('gyosei_journals', JSON.stringify(data.journals));
      if (data.payments) localStorage.setItem('gyosei_payments', JSON.stringify(data.payments));
      if (data.activityLog) localStorage.setItem('gyosei_activity_log', JSON.stringify(data.activityLog));
      if (data.recurring) localStorage.setItem('gyosei_recurring', JSON.stringify(data.recurring));
      if (data.inheritanceFiles) this._set(this.KEYS.INHERITANCE_FILES, data.inheritanceFiles);
      if (data.goals) localStorage.setItem('gyosei_goals', JSON.stringify(data.goals));
      if (data.koteihi) localStorage.setItem('koteihi_data', JSON.stringify(data.koteihi));
      if (data.koteihiLifeplan) localStorage.setItem('koteihi_lifeplan', JSON.stringify(data.koteihiLifeplan));
      if (data.syncSettings) localStorage.setItem('gyosei_sync_settings', JSON.stringify(data.syncSettings));
      return true;
    } catch {
      return false;
    }
  },

  // 本番移行用のテストデータ消去（仕訳・案件等のみ。顧客・担当者・店舗等は維持）
  clearTestDataForProduction() {
    if (!confirm('【本番移行データの初期化】\n\nテスト用に登録した「仕訳データ」および「案件データ（および関連する請求・タスク・予定・メールBOX）」をすべて消去します。\n\n※ 顧客情報、担当者、店舗/場所マスターは削除されずそのまま残ります。\n本当に実行してよろしいですか？')) {
      return;
    }
    
    if (!confirm('本当に消去してよろしいですか？（実行前に念のためバックアップファイルをダウンロード保存しておくことを強くお勧めします）')) {
      return;
    }

    try {
      // 1. 案件データをクリア
      this._set(this.KEYS.CASES, []);

      // 2. 仕訳データをクリア
      localStorage.setItem('gyosei_journals', JSON.stringify([]));

      // 3. 請求・入金レコードをクリア
      localStorage.setItem('gyosei_payments', JSON.stringify([]));

      // 4. スケジュール (gyosei_events) をクリア
      this._set(this.KEYS.EVENTS, []);

      // 5. タスク (gyosei_todos) をクリア
      this._set(this.KEYS.TODOS, []);

      // 6. 登録前BOX (gyosei_inbox) をクリア
      this._set(this.KEYS.INBOX, []);

      // 7. 履歴ログ (gyosei_activity_log) をクリア
      localStorage.setItem('gyosei_activity_log', JSON.stringify([]));

      // ※定型仕訳・固定費設定 (gyosei_recurring) は設定マスタのため保持します

      // 8. 案件に紐づく地図メーカーの画像・ベクターデータをクリア
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('gyosei_case_map_')) {
          localStorage.removeItem(key);
        }
      });

      if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
        alert('ローカルのテストデータ消去が完了しました。\n\n⚠️ 重要：Googleスプレッドシート連携が設定されているため、このまま同期するとスプレッドシート上のテストデータが再ダウンロードされます。スプレッドシート側（案件シート、仕訳シートなど）からも手動でテスト用の行を削除するか、新しい本番用スプレッドシートへURLを変更してください。');
      } else {
        alert('仕訳および案件データ（テスト用）の消去が完了しました！\n顧客、店舗、担当者、場所情報は維持されています。');
      }

      // 画面をダッシュボードにリフレッシュして再描画
      const modal = document.getElementById('syncSettingsModal');
      if (modal) modal.remove();
      
      if (typeof App !== 'undefined') {
        App.navigate('dashboard');
        App.showToast('テストデータを消去しました');
      }
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
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
    const unappliedCases = cases.filter(c => c.status !== 'done' && c.status !== 'applying');
    const urgentCases = unappliedCases.filter(c => {
      if (!c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl <= in3Days;
    });
    const upcomingCases = unappliedCases.filter(c => {
      if (!c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl > in3Days && dl <= in7Days;
    });

    const statusCounts = {
      received: cases.filter(c => c.status === 'received').length,
      applying: cases.filter(c => c.status === 'applying').length,
      delivery: cases.filter(c => c.status === 'delivery').length,
      done: cases.filter(c => c.status === 'done').length,
    };

    const categoryCounts = {};
    const cats = ['garage_oss', 'garage_paper', 'seal', 'car_reg_standard', 'car_reg_light'];
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
