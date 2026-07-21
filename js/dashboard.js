/**
 * ダッシュボード画面（強化版）
 */
function renderDashboard() {
  const stats = Store.getStats();
  const STATUS_LABELS = { received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了' };
  const CATEGORY_LABELS = { garage_oss: '🚗 車庫証明（OSS）', garage_paper: '🚗 車庫証明（紙）', seal: '🚙 丁種封印', inheritance: '📜 相続' };
  const CATEGORY_COLORS = { garage_oss: '#3b82f6', garage_paper: '#60a5fa', seal: '#f59e0b', inheritance: '#8b5cf6' };

  const maxStatus = Math.max(...Object.values(stats.statusCounts), 1);
  const maxCategory = Math.max(...Object.values(stats.categoryCounts), 1);

  // 今月の売上（完了案件の報酬）
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allCases = Store.getCases();
  const thisMonthCompleted = allCases.filter(c => {
    if (c.status !== 'done' || !c.fee) return false;
    const doneDate = c.completedAt || c.updatedAt || '';
    return doneDate.startsWith(yearMonth);
  });
  const monthlyRevenue = thisMonthCompleted.reduce((sum, c) => sum + Number(c.fee || 0), 0);

  // 今月の経費（帳簿から）
  const EXPENSE_ACCOUNTS = ['旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'];
  const journals = typeof Accounting !== 'undefined' ? Accounting.getJournals() : [];
  const monthlyExpense = journals
    .filter(j => j.date && j.date.startsWith(yearMonth) && EXPENSE_ACCOUNTS.includes(j.debit))
    .reduce((sum, j) => sum + (j.amount || 0), 0);

  // 今日の予定
  const todayStr = Store.getLocalDateStr(now);
  const todayEvents = typeof Store !== 'undefined' ? Store.getEvents().filter(e => e.date === todayStr) : [];
  const todayCases = allCases.filter(c => {
    if (c.status === 'done') return false;
    return c.deadline === todayStr ||
           c.surveyDate === todayStr ||
           c.applyDate === todayStr ||
           c.policeDeliveryDate === todayStr ||
           c.storeDeliveryDate === todayStr ||
           c.registrationDate === todayStr;
  });

  // 期限間近
  let urgentHtml = '';
  if (stats.urgentCases.length === 0) {
    urgentHtml = '<p class="empty-message">期限間近の案件はありません ✨</p>';
  } else {
    urgentHtml = stats.urgentCases.map(c => {
      const client = Store.getClient(c.clientId);
      const dl = new Date(c.deadline);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      const urgencyClass = diffDays <= 0 ? 'overdue' : 'warning';
      const urgencyLabel = diffDays < 0 ? `${Math.abs(diffDays)}日超過` : diffDays === 0 ? '本日期限' : `あと${diffDays}日`;
      return `
        <div class="urgent-item ${urgencyClass}" onclick="App.navigate('cases')">
          <div class="urgent-item-header">
            <span class="urgent-badge badge-${urgencyClass}">${urgencyLabel}</span>
            <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category] || c.category}</span>
          </div>
          <div class="urgent-item-title">${c.title}</div>
          <div class="urgent-item-client">${client ? client.name : '—'} ｜ 期限: ${c.deadline}</div>
        </div>`;
    }).join('');
  }

  // 今後7日
  let upcomingHtml = '';
  if (stats.upcomingCases.length === 0) {
    upcomingHtml = '<p class="empty-message">7日以内の期限案件はありません</p>';
  } else {
    upcomingHtml = stats.upcomingCases.map(c => {
      const client = Store.getClient(c.clientId);
      const dl = new Date(c.deadline);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      return `
        <div class="upcoming-item" onclick="App.navigate('cases')">
          <span class="upcoming-days">あと${diffDays}日</span>
          <div>
            <div class="upcoming-title">${c.title}</div>
            <div class="upcoming-client">${client ? client.name : '—'}</div>
          </div>
        </div>`;
    }).join('');
  }

  // 今日の予定HTML
  let todayScheduleHtml = '';
  if (todayCases.length === 0 && todayEvents.length === 0) {
    todayScheduleHtml = '<p class="empty-message">今日の予定はありません</p>';
  } else {
    todayCases.forEach(c => {
      let actionLabel = '期限';
      if (c.surveyDate === todayStr) actionLabel = '現調';
      else if (c.applyDate === todayStr) actionLabel = '申請';
      else if (c.policeDeliveryDate === todayStr) actionLabel = '交付';
      else if (c.storeDeliveryDate === todayStr) actionLabel = '店届';
      else if (c.registrationDate === todayStr) actionLabel = '登録';
      todayScheduleHtml += `<div class="today-item" onclick="App.navigate('cases')"><span class="today-icon">📋</span>[${actionLabel}] ${c.title}</div>`;
    });
    todayEvents.forEach(e => {
      const time = e.time ? `${e.time} ` : '';
      todayScheduleHtml += `<div class="today-item" onclick="App.navigate('calendar')"><span class="today-icon">📌</span>${time}${e.title}</div>`;
    });
  }

  // 未対応FAXの取得
  let faxAlertHtml = '';
  if (typeof FaxManager !== 'undefined') {
    const unprocessed = FaxManager.getUnprocessedFaxes();
    if (unprocessed.length > 0) {
      faxAlertHtml = `
        <div class="dashboard-section stat-danger-alert" style="margin-bottom: 20px; border-left: 4px solid var(--accent-orange); background: rgba(249, 115, 22, 0.05); padding: 16px 20px; border-radius: var(--radius)">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px">
            <span style="font-weight:700; color:var(--accent-orange); font-size: 0.95rem; display:flex; align-items:center; gap:8px">
              ⚠️ 未登録の受信FAXがあります (${unprocessed.length}件)
            </span>
            <button class="btn btn-secondary btn-small" onclick="App.navigate('fax'); setTimeout(() => FaxManager.loadLog(), 100)">📠 FAX一覧を開く</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px">
            ${unprocessed.slice(0, 3).map(f => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.82rem">
                <div style="text-align:left">
                  <span style="color:var(--text-muted); margin-right:8px">${f.date}</span>
                  <span style="font-weight:600; color:var(--text-primary); margin-right:8px">${f.number}</span>
                  <span style="color:var(--text-secondary)">${f.subject || '（件名なし）'}</span>
                  ${f.clientName ? `<span style="background:rgba(245,158,11,0.15); color:var(--accent-gold); padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left:8px">${f.clientName}</span>` : ''}
                </div>
                <button class="btn btn-primary btn-small" style="font-size:0.75rem; padding:4px 10px; flex-shrink:0" onclick="FaxManager.createCase('${f.date}', '${f.number}', '${f.subject}', '${f.clientName || ''}')">➕ 案件登録</button>
              </div>
            `).join('')}
            ${unprocessed.length > 3 ? `<div style="text-align:right; font-size:0.78rem; color:var(--text-muted)">他 ${unprocessed.length - 3} 件の未対応FAXがあります</div>` : ''}
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="dashboard">
      <div class="page-header">
        <h1>ダッシュボード</h1>
        <p class="page-subtitle">${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
      </div>

      ${faxAlertHtml}

      <div class="stat-cards">
        <div class="stat-card stat-primary">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-number">${stats.activeCases}</div>
            <div class="stat-label">進行中</div>
          </div>
        </div>
        <div class="stat-card stat-secondary">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-number">${stats.totalClients}</div>
            <div class="stat-label">顧客数</div>
          </div>
        </div>
        <div class="stat-card stat-warning">
          <div class="stat-icon">⚠️</div>
          <div class="stat-info">
            <div class="stat-number">${stats.urgentCases.length}</div>
            <div class="stat-label">期限間近</div>
          </div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-number">¥${monthlyRevenue.toLocaleString()}</div>
            <div class="stat-label">今月売上</div>
          </div>
        </div>
        ${typeof Payments !== 'undefined' && Payments.getUnpaid().length > 0 ? `
        <div class="stat-card stat-danger" onclick="Payments.showPaymentList()" style="cursor:pointer">
          <div class="stat-icon">💴</div>
          <div class="stat-info">
            <div class="stat-number">${Payments.getUnpaid().length}</div>
            <div class="stat-label">未入金</div>
          </div>
        </div>` : ''}
      </div>

      <!-- クイックアクション -->
      <div class="quick-actions">
        <button class="quick-btn" onclick="App.navigate('clients'); setTimeout(() => Clients.showAddModal(), 100)">
          <span class="quick-icon">👤</span>顧客追加
        </button>
        <button class="quick-btn" onclick="App.navigate('cases'); setTimeout(() => Cases.showAddModal(), 100)">
          <span class="quick-icon">📋</span>案件登録
        </button>
        <button class="quick-btn" onclick="App.navigate('calendar'); setTimeout(() => Calendar.showEventModal(), 100)">
          <span class="quick-icon">📅</span>予定追加
        </button>
        <button class="quick-btn" onclick="App.navigate('accounting'); setTimeout(() => Accounting.showAddModal(), 100)">
          <span class="quick-icon">💹</span>仕訳追加
        </button>
      </div>

      ${typeof GoalTracker !== 'undefined' ? `
      <div class="dashboard-section" style="margin-bottom:20px">
        ${GoalTracker.renderWidget()}
      </div>` : ''}

      <div class="dashboard-grid">
        <!-- 今日の予定 -->
        <div class="dashboard-section">
          <h2 class="section-title">📌 今日の予定</h2>
          <div class="today-schedule">${todayScheduleHtml}</div>
        </div>

        <div class="dashboard-section">
          <h2 class="section-title">🔥 期限間近の案件</h2>
          <div class="urgent-list">${urgentHtml}</div>
        </div>

        ${typeof InheritanceDeadlines !== 'undefined' ? InheritanceDeadlines.renderDashboardWidget() : ''}
        ${typeof GarageScheduleWidget !== 'undefined' ? GarageScheduleWidget.renderDashboardWidget() : ''}

        <div class="dashboard-section">
          <h2 class="section-title">📅 今後7日間の期限</h2>
          <div class="upcoming-list">${upcomingHtml}</div>
        </div>

        <!-- 今月の収支ウィジェット -->
        <div class="dashboard-section">
          ${typeof RevenueWidget !== 'undefined' ? RevenueWidget.renderWidget() : `
          <h2 class="section-title">💰 今月の収支</h2>
          <div class="revenue-summary">
            <div class="revenue-row">
              <span>売上（完了案件）</span>
              <span class="revenue-amount income">¥${monthlyRevenue.toLocaleString()}</span>
            </div>
            <div class="revenue-row">
              <span>経費</span>
              <span class="revenue-amount expense">¥${monthlyExpense.toLocaleString()}</span>
            </div>
            <div class="revenue-row revenue-total">
              <span>差引利益</span>
              <span class="revenue-amount ${monthlyRevenue - monthlyExpense >= 0 ? 'income' : 'expense'}">¥${(monthlyRevenue - monthlyExpense).toLocaleString()}</span>
            </div>
          </div>
          `}
        </div>

        <div class="dashboard-section">
          <h2 class="section-title">📊 ステータス別</h2>
          <div class="chart-bars">
            ${Object.entries(stats.statusCounts).filter(([k]) => k !== 'done').map(([key, val]) => `
              <div class="chart-bar-row">
                <span class="chart-label">${STATUS_LABELS[key]}</span>
                <div class="chart-bar-track">
                  <div class="chart-bar-fill status-${key}" style="width:${(val / maxStatus) * 100}%"></div>
                </div>
                <span class="chart-value">${val}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dashboard-section">
          <h2 class="section-title">📁 カテゴリ別</h2>
          <div class="chart-bars">
            ${Object.entries(stats.categoryCounts).filter(([, v]) => v > 0).map(([key, val]) => `
              <div class="chart-bar-row">
                <span class="chart-label">${CATEGORY_LABELS[key] || key}</span>
                <div class="chart-bar-track">
                  <div class="chart-bar-fill" style="width:${(val / maxCategory) * 100}%;background:${CATEGORY_COLORS[key] || '#6b7280'}"></div>
                </div>
                <span class="chart-value">${val}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
