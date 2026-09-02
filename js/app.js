/**
 * メインアプリケーション - ルーティング・初期化
 */
const App = {
  currentPage: 'dashboard',

  init() {
    // 認証チェック: 未認証ならログイン画面を表示
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
      document.getElementById('sidebar').style.display = 'none';
      const mobileHeader = document.querySelector('.mobile-header');
      const bottomNav = document.querySelector('.bottom-nav');
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (bottomNav) bottomNav.style.display = 'none';
      document.getElementById('content').innerHTML = Auth.renderLoginScreen();
      setTimeout(() => { const pw = document.getElementById('authPassword'); if (pw) pw.focus(); }, 100);
      return; // 初期化を中断
    }
    // 旧ステータスの自動変換
    if (typeof Store !== 'undefined') Store._migrateStatuses();
    // 9/1以降の未入力案件へのテンプレート報酬額自動補完
    if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.backfillSeptemberFees === 'function') {
      CaseTemplates.backfillSeptemberFees();
    }
    this.renderSidebar();
    this.renderContent();
    // セッションタイムアウト監視を開始
    if (typeof Auth !== 'undefined') Auth.startSessionTimer();
    // リサイズ時に再描画
    window.addEventListener('resize', () => this.refreshView());
    // スプレッドシート自動同期
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.pull().then(() => {
        if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.backfillSeptemberFees === 'function') {
          CaseTemplates.backfillSeptemberFees();
        }
        this.refreshView();
      }).catch(() => { });

      // 3分ごとに自動同期（他デバイスの変更を取り込む）
      setInterval(() => {
        if (document.hidden) return; // ページが非表示なら省略
        // モーダルが開いている時は同期をスキップ（入力中のデータが消えるのを防止）
        const openModal = document.querySelector('.modal[style*="flex"]');
        if (openModal) return;
        SpreadsheetSync.pull().then(() => this.refreshView()).catch(() => { });
      }, 3 * 60 * 1000);
    }
    // 期限リマインダー
    if (typeof Reminders !== 'undefined') Reminders.init();
    // 古い完了案件を自動アーカイブ（localStorage 容量管理）
    if (typeof CaseArchive !== 'undefined') CaseArchive.run();
    // 今日のブリーフィング（1日1回自動表示）
    if (typeof Briefing !== 'undefined') Briefing.checkAndShow();
    // Ctrl+K で検索
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        GlobalSearch.show();
      }
    });
  },

  navigate(page) {
    this.currentPage = page;
    this.renderContent();
    this.updateNav();
    // モバイルでサイドバーが開いていたら閉じる
    document.getElementById('sidebar').classList.remove('open');
  },

  isAnyModalOpen() {
    const caseModal = document.getElementById('caseModal');
    if (caseModal && caseModal.style.display !== 'none' && caseModal.style.display !== '') return true;

    const modals = document.querySelectorAll('.modal, .full-modal, #caseModal, #invoiceSelectModal, #clientDetailModal, #fullMapModal');
    for (let i = 0; i < modals.length; i++) {
      const m = modals[i];
      if (m.style.display && m.style.display !== 'none') return true;
      try {
        const comp = window.getComputedStyle(m);
        if (comp && comp.display !== 'none' && comp.visibility !== 'hidden' && comp.opacity !== '0') return true;
      } catch (e) {}
    }
    return false;
  },

  refreshView() {
    // 案件登録モーダルや各種入力モーダルが開いている最中はDOM再構築をスキップ（入力中のデータ消失を完全防止）
    if (this.isAnyModalOpen()) {
      return;
    }
    this.renderContent();
    this.renderSidebar();
  },

  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isAdmin = typeof Auth !== 'undefined' && typeof Auth.isAdminMode === 'function' ? Auth.isAdminMode() : false;

    sidebar.innerHTML = `
      <div class="sidebar-header" style="display:flex;align-items:center;justify-content:space-between">
        <div class="sidebar-logo">
          <span class="logo-icon">⚖️</span>
          <span class="logo-text">行政書士法人<br>Felis</span>
        </div>
        <button onclick="App.toggleSidebar()" class="sidebar-close-btn" style="display:none;background:none;border:none;color:var(--text-secondary);font-size:1.5rem;cursor:pointer;padding:4px 8px">✕</button>
      </div>
      <nav class="sidebar-nav">
        <a class="nav-item ${this.currentPage === 'dashboard' ? 'active' : ''}" onclick="App.navigate('dashboard')">
          <span class="nav-icon">📊</span><span class="nav-label">ダッシュボード</span>
        </a>
        <a class="nav-item ${this.currentPage === 'clients' ? 'active' : ''}" onclick="App.navigate('clients')">
          <span class="nav-icon">👥</span><span class="nav-label">顧客管理</span>
        </a>
        <a class="nav-item ${this.currentPage === 'cases' ? 'active' : ''}" onclick="App.navigate('cases')">
          <span class="nav-icon">📋</span><span class="nav-label">案件管理</span>
        </a>
        <a class="nav-item ${this.currentPage === 'advances' ? 'active' : ''}" onclick="App.navigate('advances')">
          <span class="nav-icon">💰</span><span class="nav-label">立替・一括消込</span>
        </a>
        <a class="nav-item ${this.currentPage === 'progress' ? 'active' : ''}" onclick="App.navigate('progress')">
          <span class="nav-icon">📊</span><span class="nav-label">進捗管理</span>
        </a>
        <a class="nav-item ${this.currentPage === 'calendar' ? 'active' : ''}" onclick="App.navigate('calendar')">
          <span class="nav-icon">📅</span><span class="nav-label">スケジュール</span>
        </a>
        <a class="nav-item ${this.currentPage === 'accounting' ? 'active' : ''}" onclick="App.navigate('accounting')">
          <span class="nav-icon">💹</span><span class="nav-label">帳簿</span>
        </a>
        <a class="nav-item ${this.currentPage === 'inbox' ? 'active' : ''}" onclick="App.navigate('inbox')" style="position:relative">
          <span class="nav-icon">📥</span><span class="nav-label">登録前BOX</span>
          ${this.getInboxBadgeHtml()}
        </a>
        <a class="nav-item ${this.currentPage === 'formats' ? 'active' : ''}" onclick="App.navigate('formats')">
          <span class="nav-icon">📂</span><span class="nav-label">書式ライブラリ</span>
        </a>
        <a class="nav-item ${this.currentPage === 'analytics' ? 'active' : ''}" onclick="App.navigate('analytics')">
          <span class="nav-icon">📈</span><span class="nav-label">ビジュアル分析</span>
        </a>
      </nav>
      <div class="sidebar-tools">
        <button class="btn btn-ghost" onclick="GlobalSearch.show()" title="検索 (Ctrl+K)">🔍 案件・顧客検索</button>
        <button class="btn btn-ghost briefing-sidebar-btn" onclick="Briefing.show()" title="今日のブリーフィング">☀️ 今日のブリーフィング</button>
        
        ${isAdmin ? `
          <!-- 管理者（代表者）専用メニュー -->
          <div style="border-top:1px dashed var(--border-color);margin:6px 0 4px 0;padding-top:4px;font-size:0.68rem;color:var(--accent-gold);font-weight:700;padding-left:8px">
            👑 管理者メニュー
          </div>
          <button class="btn btn-ghost" onclick="Invoice.showOfficeSettings()" title="請求書の振込先口座・インボイス番号・住所等を設定" style="color:#38bdf8;font-weight:600">🏢 事務所・振込先設定</button>
          <button class="btn btn-ghost" onclick="SealReportManager.showLedgerModal()" title="丁種出張封印 取付作業管理簿（監査2年間台帳）" style="color:#10b981;font-weight:600">🔩 封印管理簿 (監査2年台帳)</button>
          <button class="btn btn-ghost" onclick="Payments.showPaymentList()" title="入金管理">💴 入金管理</button>
          <button class="btn btn-ghost" onclick="AnnualReport.show()" title="年間収支">📊 年間収支</button>
          <button class="btn btn-ghost" onclick="TaxHelper.show()" title="確定申告集計">📊 確定申告集計</button>
          <button class="btn btn-ghost" onclick="SalarySimulator.show()" title="役員報酬シミュレーション">⚖️ 役員報酬シミュレーター</button>
          <button class="btn btn-ghost" onclick="MonthlyReport.show()" title="月次レポート">📄 月次レポート</button>
          <button class="btn btn-ghost" onclick="RecurringExpenses.show()" title="定型仕訳">🔄 定型仕訳</button>
          <button class="btn btn-ghost" onclick="ReferralAnalysis.show()" title="紹介元分析">🤝 紹介元分析</button>
          <button class="btn btn-ghost" onclick="StaffManager.show()" title="担当者管理">👥 担当者管理</button>
          <button class="btn btn-ghost" onclick="LocationManager.show()" title="場所マスター管理">📍 場所管理</button>
          <button class="btn btn-ghost" onclick="Auth.showChangeAdminPinModal()" title="PINコード変更">🔢 PIN変更</button>
          <button class="btn btn-ghost" onclick="Auth.toggleAdminMode()" style="color:var(--text-muted);font-size:0.75rem;margin-top:4px" title="スタッフ表示に切り替え">
            🔒 スタッフ表示に戻す
          </button>
        ` : `
          <!-- 一般スタッフ向け：管理者メニュー解除ボタン -->
          <button class="btn btn-ghost" onclick="SealReportManager.showLedgerModal()" title="丁種出張封印 取付作業管理簿（監査2年間台帳）" style="color:#10b981;font-weight:600;font-size:0.8rem;">🔩 封印管理簿 (監査2年台帳)</button>
          <button class="btn btn-ghost" onclick="Auth.toggleAdminMode()" style="color:var(--accent-gold);font-size:0.75rem;margin-top:6px;border:1px dashed rgba(245,158,11,0.3)" title="代表者PINを入力して管理者メニューを開く">
            🔐 管理者メニュー（要PIN）
          </button>
        `}
      </div>

      <div class="sidebar-tools" style="border-top:1px solid var(--border-color);padding-top:4px">
        <div style="font-size:0.68rem;font-weight:600;color:var(--text-muted);padding:2px 12px 4px;letter-spacing:0.5px">自動車・実務ツール</div>
        <button class="btn btn-ghost" onclick="SealReportManager.showLedgerModal()" style="text-decoration:none;display:block;text-align:left;color:#10b981;font-weight:bold;width:100%;">🔩 封印管理簿 (監査2年台帳)</button>
        <a class="btn btn-ghost" href="syako_map_maker.html" target="_blank" style="text-decoration:none;display:block;text-align:left;color:#38bdf8;font-weight:bold;">🚗 車庫証明 所在図・配置図</a>
        <a class="btn btn-ghost" href="請求書サンプル一覧.html" target="_blank" style="text-decoration:none;display:block;text-align:left">📄 ディーラー請求書サンプル</a>
        <a class="btn btn-ghost" href="map-maker/index.html" target="_blank" style="text-decoration:none;display:block;text-align:left">🗺️ 地図メーカー</a>
        <a class="btn btn-ghost" href="bot/index.html" style="text-decoration:none;display:block;text-align:left">💬 AIチャット</a>
      </div>

      <div class="sidebar-footer">
        ${isAdmin ? `
          <button class="btn btn-ghost" onclick="SpreadsheetSync.syncNow()" title="スプレッドシート同期">🔄 同期</button>
          <button class="btn btn-ghost" onclick="SpreadsheetSync.showSettingsModal()" title="連携設定">⚙️ 設定</button>
          <button class="btn btn-ghost" onclick="Store.exportData()" title="データバックアップ">💾 バックアップ</button>
          <label class="btn btn-ghost" title="データ復元">
            📂 復元
            <input type="file" accept=".json" style="display:none" onchange="App.onImport(event)">
          </label>
          <button class="btn btn-ghost" onclick="Auth.showChangePasswordModal()" title="パスワード変更">🔑 PW変更</button>
        ` : ''}
        <button class="btn btn-ghost" onclick="Auth.logout()" title="ログアウト">🚪 ログアウト</button>
      </div>
    `;
  },

  renderContent() {
    const content = document.getElementById('content');
    switch (this.currentPage) {
      case 'dashboard': content.innerHTML = renderDashboard(); break;
      case 'clients': content.innerHTML = Clients.render(); break;
      case 'cases': content.innerHTML = Cases.render(); break;
      case 'advances': content.innerHTML = Advances.render(); break;
      case 'inheritance-casefile': content.innerHTML = InheritanceCasefile.render(); break;
      case 'progress': content.innerHTML = Progress.render(); break;
      case 'calendar': content.innerHTML = Calendar.render(); break;
      case 'accounting': content.innerHTML = Accounting.render(); break;
      case 'inbox': content.innerHTML = InboxManager.render(); break;
      case 'formats': content.innerHTML = Formats.render(); Formats.init(); break;
      case 'analytics': content.innerHTML = Analytics.render(); Analytics.init(); break;
    }
  },

  updateNav() {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    const navItems = document.querySelectorAll('.nav-item');
    const sidebarPages = ['dashboard', 'clients', 'cases', 'advances', 'inheritance-casefile', 'progress', 'calendar', 'accounting', 'inbox', 'formats', 'analytics'];
    const sidebarIdx = sidebarPages.indexOf(this.currentPage);
    if (navItems[sidebarIdx]) navItems[sidebarIdx].classList.add('active');
    const bottomItems = document.querySelectorAll('.bottom-nav-item');
    const bottomPages = ['dashboard', 'cases', 'progress', 'calendar', 'accounting'];
    const bottomIdx = bottomPages.indexOf(this.currentPage);
    if (bottomItems[bottomIdx]) bottomItems[bottomIdx].classList.add('active');
  },

  getInboxBadgeHtml() {
    if (typeof Store === 'undefined' || !Store.getInbox) return '';
    const inbox = Store.getInbox();
    const count = inbox.filter(item => item.status === '未対応').length;
    if (count > 0) {
      return `<span class="badge badge-danger sidebar-badge" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:#ef4444;color:white;font-size:0.7rem;padding:2px 6px;border-radius:10px;font-weight:bold;line-height:1">${count}</span>`;
    }
    return '';
  },

  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  onImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (confirm('現在のデータを上書きしてバックアップから復元しますか？')) {
        if (Store.importData(e.target.result)) {
          this.showToast('データを復元しました');
          this.navigate('dashboard');
        } else {
          this.showToast('復元に失敗しました。ファイルを確認してください');
        }
      }
    };
    reader.readAsText(file);
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },
};

// 初期化
document.addEventListener('DOMContentLoaded', () => App.init());
