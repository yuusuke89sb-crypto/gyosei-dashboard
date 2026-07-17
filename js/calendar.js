/**
 * カレンダー・スケジュール画面（担当者フィルタ + 予定登録 + iCal エクスポート対応）
 */
const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  filterStaffId: 'all',
  editingEventId: null,
  showInheritanceDeadlines: false,
  viewMode: 'month',
  selectedDate: null,

  EVENT_CATEGORIES: [
    { key: 'meeting', label: '🤝 打ち合わせ', color: '#3b82f6' },
    { key: 'visit', label: '🚗 外出・訪問', color: '#8b5cf6' },
    { key: 'training', label: '📚 研修・勉強', color: '#10b981' },
    { key: 'deadline', label: '⏰ 締切', color: '#ef4444' },
    { key: 'other', label: '📌 その他', color: '#f59e0b' },
  ],

  render() {
    if (this.viewMode === 'day' && this.selectedDate) {
      return this.renderDayView();
    }
    return this.renderMonthView();
  },

  renderMonthView() {
    const year = this.currentYear;
    const month = this.currentMonth;
    const monthName = `${year}年${month + 1}月`;

    // 案件の予定日（締切・現調・申請・交付・店届）
    let caseEvents = this.getCaseEvents();
    // 予定
    let events = Store.getEvents();
    // 相続期限（フィルターON時のみ）
    let inheritanceItems = this.showInheritanceDeadlines ? this.getInheritanceDeadlineItems() : [];

    // 担当者フィルタ
    if (this.filterStaffId !== 'all') {
      caseEvents = caseEvents.filter(ce => ce.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
      inheritanceItems = inheritanceItems.filter(item => item.staffId == this.filterStaffId);
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calendarDays = '';

    for (let i = 0; i < firstDay; i++) {
      calendarDays += '<div class="cal-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const isToday = dayDate.getTime() === today.getTime();
      const isPast = dayDate < today;

      const dayCaseEvents = caseEvents.filter(ce => ce.date === dateStr);
      const dayEvents = events.filter(e => e.date === dateStr);
      const dayInheritance = inheritanceItems.filter(item => item.date === dateStr);
      const totalItems = dayCaseEvents.length + dayEvents.length + dayInheritance.length;

      let dots = '';
      if (totalItems > 0) {
        const items = [];
        // 案件（現調・申請・交付など）
        dayCaseEvents.slice(0, 2).forEach(ce => {
          const statusClass = ce.status === 'done' ? 'done' : (isPast ? 'overdue' : '');
          items.push(`<div class="cal-event ${statusClass} category-${ce.category}" title="${ce.title}" onclick="event.stopPropagation(); Cases.showEditModal('${ce.caseId}'); App.navigate('cases')">${ce.title.substring(0, 8)}</div>`);
        });
        // 予定
        dayEvents.slice(0, 3 - items.length).forEach(e => {
          const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
          const icon = cat ? cat.label.split(' ')[0] : '📌';
          items.push(`<div class="cal-event cal-event-custom" title="${e.title}" style="border-left:3px solid ${cat ? cat.color : '#f59e0b'}">${icon} ${e.title.substring(0, 5)}</div>`);
        });
        // 相続期限
        dayInheritance.slice(0, 3 - items.length).forEach(item => {
          const icon = item.severity === 'critical' ? '🔴' : item.severity === 'important' ? '🟠' : '🟡';
          items.push(`<div class="cal-event cal-event-custom" title="${item.label} (${item.caseTitle})" style="border-left:3px solid #dc2626">${icon} ${item.label.substring(0, 4)}</div>`);
        });
        const remaining = totalItems - items.length;
        if (remaining > 0) items.push(`<div class="cal-event-more">+${remaining}件</div>`);
        dots = `<div class="cal-events">${items.join('')}</div>`;
      }

      calendarDays += `
        <div class="cal-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${totalItems > 0 ? 'has-events' : ''}"
          onclick="Calendar.showDayDetail('${dateStr}')">
          <span class="cal-date ${isToday ? 'today-badge' : ''}">${d}</span>
          ${dots}
        </div>`;
    }

    // 担当者フィルタ
    const staffList = Store.getStaff();
    const staffFilterOptions = staffList.map(s =>
      `<option value="${s.id}" ${this.filterStaffId == s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    // 期限リスト（案件イベント + 予定 + 相続期限を統合）
    const upcomingItems = [];
    caseEvents.filter(ce => ce.status !== 'done').forEach(ce => {
      upcomingItems.push({ type: 'case-event', date: ce.date, data: ce });
    });
    events.filter(e => new Date(e.date) >= today).forEach(e => {
      upcomingItems.push({ type: 'event', date: e.date, data: e });
    });
    inheritanceItems.filter(item => item.diffDays >= 0).forEach(item => {
      upcomingItems.push({ type: 'inheritance', date: item.date, data: item });
    });
    upcomingItems.sort((a, b) => new Date(a.date) - new Date(b.date));
    const upcoming = upcomingItems.slice(0, 12);

    return `
      <div class="calendar-page">
        <div class="page-header">
          <h1>スケジュール</h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="Calendar.showEventModal()">
              ＋ 予定追加
            </button>
            <button class="btn btn-secondary btn-small" onclick="Calendar.syncFromGoogle()">
              🔄 Google同期
            </button>
            <button class="btn btn-secondary btn-small" onclick="Calendar.exportICS()">
              📤 カレンダー出力
            </button>
          </div>
        </div>

        <div class="cal-controls">
          <div class="cal-nav">
            <button class="btn btn-icon" onclick="Calendar.prevMonth()">◀</button>
            <h2 class="cal-month-name">${monthName}</h2>
            <button class="btn btn-icon" onclick="Calendar.nextMonth()">▶</button>
            <button class="btn btn-secondary btn-small" onclick="Calendar.goToday()">今日</button>
          </div>
          <div class="cal-staff-filter">
            <label>👤 担当者:</label>
            <select class="filter-select" onchange="Calendar.onStaffFilter(this.value)">
              <option value="all" ${this.filterStaffId === 'all' ? 'selected' : ''}>全員</option>
              ${staffFilterOptions}
            </select>
            <button class="btn btn-small ${this.showInheritanceDeadlines ? 'btn-primary' : 'btn-secondary'}" onclick="Calendar.toggleInheritanceDeadlines()" title="相続案件の法定期限を表示">
              📜 相続期限
            </button>
          </div>
        </div>

        <div class="cal-grid">
          <div class="cal-header">日</div>
          <div class="cal-header">月</div>
          <div class="cal-header">火</div>
          <div class="cal-header">水</div>
          <div class="cal-header">木</div>
          <div class="cal-header">金</div>
          <div class="cal-header">土</div>
          ${calendarDays}
        </div>

        <div class="upcoming-section">
          <h2 class="section-title">📋 今後の予定</h2>
          <div class="upcoming-timeline">
            ${upcoming.length === 0
        ? '<p class="empty-message">今後の予定はありません</p>'
        : upcoming.map(item => {
          if (item.type === 'case-event') {
            const ce = item.data;
            const client = Store.getClient(Store.getCase(ce.caseId)?.clientId);
            const staffName = Store.getStaffName(ce.staffId);
            const dl = new Date(ce.date);
            const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
            const urgencyClass = diff < 0 ? 'overdue' : diff <= 3 ? 'urgent' : diff <= 7 ? 'soon' : '';
            const urgencyLabel = diff < 0 ? `${Math.abs(diff)}日超過` : diff === 0 ? '本日' : `あと${diff}日`;
            return `
                        <div class="timeline-item ${urgencyClass}" onclick="Cases.showEditModal('${ce.caseId}'); App.navigate('cases')">
                          <div class="timeline-date">${ce.date}<br><span class="timeline-diff">${urgencyLabel}</span></div>
                          <div class="timeline-content">
                            <div class="timeline-title">${ce.icon} ${ce.title}</div>
                            <div class="timeline-meta">
                              ${client ? `👤 ${client.name}` : '—'}
                              ${ce.staffId ? ` ・ 🏷️ ${staffName}` : ''}
                            </div>
                          </div>
                        </div>`;
          } else if (item.type === 'event') {
            const e = item.data;
            const staffName = Store.getStaffName(e.staffId);
            const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
            const icon = cat ? cat.label.split(' ')[0] : '📌';
            const dl = new Date(e.date);
            const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
            const urgencyLabel = diff === 0 ? '本日' : `あと${diff}日`;
            return `
                        <div class="timeline-item timeline-event" onclick="Calendar.showEventEditModal('${e.id}')" style="border-left-color:${cat ? cat.color : '#f59e0b'}">
                          <div class="timeline-date">${e.date}${e.time ? '<br>' + e.time : ''}<br><span class="timeline-diff">${urgencyLabel}</span></div>
                          <div class="timeline-content">
                            <div class="timeline-title">${icon} ${e.title}</div>
                            <div class="timeline-meta">
                              ${e.staffId ? `🏷️ ${staffName}` : ''}
                              ${e.memo ? ` ・ ${e.memo.substring(0, 20)}` : ''}
                            </div>
                          </div>
                        </div>`;
          } else if (item.type === 'inheritance') {
            const dl = item.data;
            const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
            const urgencyLabel = dl.diffDays === 0 ? '本日' : `あと${dl.diffDays}日`;
            const urgencyClass = dl.diffDays <= 30 ? 'urgent' : '';
            return `
                        <div class="timeline-item ${urgencyClass}" onclick="Cases.showEditModal('${dl.caseId}'); App.navigate('cases')" style="border-left:3px solid #dc2626">
                          <div class="timeline-date">${dl.date}<br><span class="timeline-diff">${urgencyLabel}</span></div>
                          <div class="timeline-content">
                            <div class="timeline-title">${icon} ${dl.label}</div>
                            <div class="timeline-meta">
                              📜 ${dl.caseTitle}
                            </div>
                          </div>
                        </div>`;
          }
        }).join('')
      }
          </div>
        </div>
      </div>
      ${this.renderEventModal()}
    `;
  },

  // ---- 予定モーダル ----
  renderEventModal() {
    const staffList = Store.getStaff();
    const staffOptions = staffList.map(s =>
      `<option value="${s.id}">${s.name}${s.role ? ' (' + s.role + ')' : ''}</option>`
    ).join('');
    const catOptions = this.EVENT_CATEGORIES.map(c =>
      `<option value="${c.key}">${c.label}</option>`
    ).join('');
    const today = new Date().toISOString().slice(0, 10);

    return `
      <div id="eventModal" class="modal" style="display:none" onclick="Calendar.closeEventModal()">
        <div class="modal-content" onclick="event.stopPropagation()" ontouchstart="event.stopPropagation()">
          <div class="modal-header">
            <h2 id="eventModalTitle">予定追加</h2>
            <button class="modal-close" onclick="Calendar.closeEventModal()">✕</button>
          </div>
          <form id="eventForm" onsubmit="Calendar.onEventSubmit(event)">
            <div class="form-group">
              <label>タイトル <span class="required">*</span></label>
              <input type="text" name="title" id="evf_title" required placeholder="例：田中様 打ち合わせ">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>日付 <span class="required">*</span></label>
                <input type="date" name="date" id="evf_date" required value="${today}">
              </div>
              <div class="form-group">
                <label>種別</label>
                <select name="category" id="evf_category">
                  ${catOptions}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>開始時刻</label>
                <input type="time" name="time" id="evf_time">
              </div>
              <div class="form-group">
                <label>終了時刻</label>
                <input type="time" name="endTime" id="evf_endTime">
              </div>
            </div>
            <div class="form-group">
              <label>担当者</label>
              <select name="staffId" id="evf_staffId">
                <option value="">— 選択 —</option>
                ${staffOptions}
              </select>
            </div>
            <div class="form-group">
              <label>📍 場所</label>
              <select name="locationId" id="evf_locationId" class="form-select">
                <option value="">— 未選択 —</option>
                ${Store.getLocations().map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>メモ</label>
              <textarea name="memo" id="evf_memo" rows="2" placeholder="メモ..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-danger" id="eventDeleteBtn" style="display:none;margin-right:auto"
                onclick="Calendar.onEventDelete()">🗑️ 削除</button>
              <button type="button" class="btn btn-secondary" onclick="Calendar.closeEventModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  showEventModal(dateStr) {
    this.editingEventId = null;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('eventModalTitle').textContent = '予定追加';
      document.getElementById('eventForm').reset();
      if (dateStr) document.getElementById('evf_date').value = dateStr;
      else document.getElementById('evf_date').value = new Date().toISOString().slice(0, 10);
      // フィルタ中なら担当者を自動選択
      if (this.filterStaffId !== 'all') {
        document.getElementById('evf_staffId').value = this.filterStaffId;
      }
      document.getElementById('eventDeleteBtn').style.display = 'none';
      document.getElementById('eventModal').style.display = 'flex';
    }, 0);
  },

  showEventEditModal(id) {
    const ev = Store.getEvent(id);
    if (!ev) return;
    this.editingEventId = id;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('eventModalTitle').textContent = '予定編集';
      document.getElementById('evf_title').value = ev.title;
      document.getElementById('evf_date').value = ev.date;
      document.getElementById('evf_category').value = ev.category || 'other';
      document.getElementById('evf_time').value = ev.time || '';
      document.getElementById('evf_endTime').value = ev.endTime || '';
      document.getElementById('evf_staffId').value = ev.staffId || '';
      const evLocSel = document.getElementById('evf_locationId');
      if (evLocSel) evLocSel.value = ev.locationId || '';
      document.getElementById('evf_memo').value = ev.memo || '';
      document.getElementById('eventDeleteBtn').style.display = 'block';
      document.getElementById('eventModal').style.display = 'flex';
    }, 0);
  },

  closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    this.editingEventId = null;
  },

  onEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      title: form.title.value.trim(),
      date: form.date.value,
      category: form.category.value,
      time: form.time.value,
      endTime: form.endTime.value,
      staffId: form.staffId.value,
      locationId: form.locationId ? form.locationId.value : '',
      memo: form.memo.value.trim(),
    };
    if (this.editingEventId) {
      const existing = Store.getEvent(this.editingEventId);
      Store.updateEvent(this.editingEventId, data);
      // Googleカレンダー更新
      if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured() && existing && existing.calendarEventId) {
        SpreadsheetSync.pushCalendarEvent('updateCalendarEvent', {
          ...data, calendarEventId: existing.calendarEventId, localId: this.editingEventId,
        }).then(r => { if (r && r.success) App.showToast('📅 Googleカレンダーも更新しました'); });
      }
    } else {
      const newEvent = Store.addEvent(data);
      // Googleカレンダーに作成
      if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
        SpreadsheetSync.pushCalendarEvent('createCalendarEvent', {
          ...data, localId: newEvent.id,
        }).then(r => {
          if (r && r.success && r.calendarEventId) {
            Store.updateEvent(newEvent.id, { calendarEventId: r.calendarEventId });
            App.showToast('📅 Googleカレンダーに追加しました');
          }
        });
      }
    }
    this.closeEventModal();
    App.refreshView();
    App.showToast(this.editingEventId ? '予定を更新しました' : '予定を追加しました');
  },

  onEventDelete() {
    if (!this.editingEventId) return;
    if (confirm('この予定を削除しますか？')) {
      const existing = Store.getEvent(this.editingEventId);
      // Googleカレンダーからも削除
      if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured() && existing && existing.calendarEventId) {
        SpreadsheetSync.pushCalendarEvent('deleteCalendarEvent', {
          calendarEventId: existing.calendarEventId,
        }).then(r => { if (r && r.success) App.showToast('📅 Googleカレンダーからも削除しました'); });
      }
      Store.deleteEvent(this.editingEventId);
      this.closeEventModal();
      App.refreshView();
      App.showToast('予定を削除しました');
    }
  },

  // ---- ナビゲーション ----
  onStaffFilter(staffId) {
    this.filterStaffId = staffId;
    App.refreshView();
  },

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    App.refreshView();
  },

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    App.refreshView();
  },

  goToday() {
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    App.refreshView();
  },

  // ---- 日付詳細（1日表示への遷移） ----
  showDayDetail(dateStr) {
    this.viewMode = 'day';
    this.selectedDate = dateStr;
    App.refreshView();
  },

  // ---- 1日のTODO管理 ----
  addTodo(dateStr) {
    const input = document.getElementById('newTodoInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    if (typeof Store.addTodo === 'function') {
      Store.addTodo({ date: dateStr, text });
      App.refreshView();
    }
  },

  toggleTodo(id) {
    if (typeof Store.toggleTodo === 'function') {
      Store.toggleTodo(id);
      App.refreshView();
    }
  },

  deleteTodo(id) {
    if (typeof Store.deleteTodo === 'function') {
      Store.deleteTodo(id);
      App.refreshView();
    }
  },

  // ---- 日報の自動生成 ----
  generateDailyReport(dateStr) {
    const todayCases = Store.getCases().filter(c => c.deadline === dateStr);
    const todayEvents = Store.getEvents().filter(e => e.date === dateStr);
    const todayTodos = (typeof Store.getTodosByDate === 'function') ? Store.getTodosByDate(dateStr) : [];
    const doneTodos = todayTodos.filter(t => t.done);
    
    // 翌日の取得
    const dateObj = new Date(dateStr);
    dateObj.setDate(dateObj.getDate() + 1);
    const tomorrow = dateObj.toISOString().slice(0, 10);
    const tomorrowCases = Store.getCases().filter(c => c.deadline === tomorrow);
    const tomorrowEvents = Store.getEvents().filter(e => e.date === tomorrow);
    
    let report = `業務日報：${dateStr}\n\n`;
    
    report += `■ 本日の予定（打ち合わせ・外出など）\n`;
    if(todayEvents.length > 0) {
      report += todayEvents.map(e => `・${e.time ? e.time : '終日'}${e.endTime ? '〜'+e.endTime : ''} ${e.title}`).join('\n') + '\n';
    } else {
      report += `・特になし\n`;
    }
    
    report += `\n■ 本日期限の案件\n`;
    if(todayCases.length > 0) {
      const doneCases = todayCases.filter(c => c.status === 'done');
      const notDoneCases = todayCases.filter(c => c.status !== 'done');
      
      if (doneCases.length > 0) {
        report += `【完了】\n` + doneCases.map(c => {
          const client = Store.getClient(c.clientId);
          return `・${c.title} ${client ? client.name + '様' : ''}`;
        }).join('\n') + '\n';
      }
      if (notDoneCases.length > 0) {
        report += `【未完了】\n` + notDoneCases.map(c => {
          const client = Store.getClient(c.clientId);
          return `・${c.title} ${client ? client.name + '様' : ''}`;
        }).join('\n') + '\n';
      }
    } else {
      report += `・特になし\n`;
    }
    
    report += `\n■ 本日の完了TODO\n`;
    if(doneTodos.length > 0) {
      report += doneTodos.map(t => `・${t.text}`).join('\n') + '\n';
    } else {
      report += `・特になし\n`;
    }
    
    report += `\n■ 明日の予定・期限\n`;
    let tomorrowItems = [];
    tomorrowEvents.forEach(e => tomorrowItems.push(`・[予定] ${e.time ? e.time : '終日'}${e.endTime ? '〜'+e.endTime : ''} ${e.title}`));
    tomorrowCases.forEach(c => {
      const client = Store.getClient(c.clientId);
      tomorrowItems.push(`・[期限] ${c.title} ${client ? client.name + '様' : ''}`);
    });
    if(tomorrowItems.length > 0) {
      report += tomorrowItems.join('\n') + '\n';
    } else {
      report += `・特になし\n`;
    }
    
    report += `\n■ 備考・所感\n（空欄）\n`;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'dailyReportModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('dailyReportModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>📄 業務日報 (${dateStr})</h2>
          <button class="modal-close" onclick="document.getElementById('dailyReportModal').remove()">✕</button>
        </div>
        <textarea class="daily-report-textarea" id="dailyReportTextarea">${report}</textarea>
        <div class="form-actions" style="margin-top:16px;">
          <button class="btn btn-secondary" onclick="document.getElementById('dailyReportModal').remove()">閉じる</button>
          <button class="btn btn-primary" onclick="
            const textarea = document.getElementById('dailyReportTextarea');
            textarea.select();
            document.execCommand('copy');
            App.showToast('クリップボードにコピーしました');
          ">📋 コピー</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // ---- 1日（デイ）表示 ----
  renderDayView() {
    let caseEvents = this.getCaseEvents().filter(ce => ce.date === this.selectedDate);
    let events = Store.getEvents().filter(e => e.date === this.selectedDate);
    let inheritanceItems = this.showInheritanceDeadlines ? this.getInheritanceDeadlineItems().filter(item => item.date === this.selectedDate) : [];

    if (this.filterStaffId !== 'all') {
      caseEvents = caseEvents.filter(ce => ce.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
      inheritanceItems = inheritanceItems.filter(item => item.staffId == this.filterStaffId);
    }

    const STATUS_LABELS = { received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了' };
    const CATEGORY_LABELS = { garage_oss: '🚗 車庫証明（OSS）', garage_paper: '🚗 車庫証明（紙）', seal: '🚙 丁種封印', inheritance: '📜 相続' };

    // 終日アイテム（時間指定なし）
    let allDayHtml = '';
    const allDayItems = [];
    caseEvents.forEach(ce => {
      const c = Store.getCase(ce.caseId);
      if (c) {
        allDayItems.push({
          title: ce.title,
          caseTitle: c.title,
          category: ce.category,
          label: ce.icon,
          staffId: ce.staffId,
          locationId: ce.locationId || '',
          type: 'case',
          id: c.id,
          status: c.status,
          timeLabel: c.storeDeliveryTime ? ` (${c.storeDeliveryTime})` : ''
        });
      }
    });
    events.filter(e => !e.time).forEach(e => allDayItems.push({ title: e.title, category: e.category, staffId: e.staffId, locationId: e.locationId || '', type: 'event', id: e.id }));
    inheritanceItems.forEach(dl => {
      const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
      allDayItems.push({ title: dl.label + ' (' + dl.caseTitle + ')', category: 'inheritance', label: icon, staffId: dl.staffId, locationId: '', type: 'inheritance', id: dl.caseId });
    });

    if (allDayItems.length > 0) {
      // 場所・お届け先別にグループ化
      const locations = Store.getLocations();
      const clients = Store.getClients();
      const groups = {}; // locationId/clientKey -> items[]
      allDayItems.forEach(item => {
        const key = item.locationId || '__none__';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      const renderItem = (item) => {
        const staffName = Store.getStaffName(item.staffId);
        const clickAction = item.type === 'event'
          ? `Calendar.showEventEditModal('${item.id}')`
          : `App.navigate('cases'); setTimeout(() => Cases.showEditModal('${item.id}'), 100)`;
        const icon = item.type === 'event'
          ? (this.EVENT_CATEGORIES.find(ec => ec.key === item.category)?.label.split(' ')[0] || '📌')
          : item.label;
        
        // 店舗お届けの場合はヘッダーの店舗名と重複するため、カード内は案件名＋時間指定にする
        const displayTitle = (item.type === 'case' && item.label === '🚚')
          ? `🚚店届: ${item.caseTitle}${item.timeLabel || ''}`
          : `${icon} ${item.title}`;

        return `
          <div class="allday-item" onclick="${clickAction}">
            <div class="allday-item-title">${displayTitle}</div>
            <div class="allday-item-meta">${staffName ? '🏷️ ' + staffName : ''}</div>
          </div>
        `;
      };

      // 1. 訪問場所マスタにあるグループ
      const locationGroups = [];
      locations.forEach(l => {
        const cleanLocId = String(l.id).trim();
        const matchedItems = [];
        Object.keys(groups).forEach(key => {
          if (String(key).trim() === cleanLocId) {
            matchedItems.push(...groups[key]);
          }
        });
        if (matchedItems.length > 0) {
          locationGroups.push({
            label: `📍 訪問先: ${l.name}`,
            items: matchedItems
          });
        }
      });

      // 2. 店舗お届け先グループ
      clients.forEach(c => {
        const key = `client-${c.id}`;
        if (groups[key]) {
          locationGroups.push({
            label: `🏢 届け先: ${c.name}`,
            items: groups[key]
          });
        }
      });

      // 3. その他・場所未指定
      let noneItems = groups['__none__'] || [];
      Object.keys(groups).forEach(key => {
        const cleanKey = String(key).trim();
        if (cleanKey !== '__none__' && 
            !locations.some(l => String(l.id).trim() === cleanKey) && 
            !clients.some(c => `client-${c.id}` === cleanKey)) {
          noneItems = noneItems.concat(groups[key]);
        }
      });

      if (noneItems.length > 0) {
        locationGroups.push({
          label: '📋 その他・場所未設定',
          items: noneItems
        });
      }

      allDayHtml = locationGroups.map(g => `
        <div style="margin-bottom:10px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:4px;padding:2px 6px;background:var(--bg-secondary);border-radius:4px;display:inline-block">${g.label}</div>
          <div class="day-view-allday-grid" style="margin-top:4px">
            ${g.items.map(renderItem).join('')}
          </div>
        </div>
      `).join('');
    } else {
      allDayHtml = '<p class="empty-message" style="margin:0">終日の予定・期限はありません</p>';
    }

    // 時間枠タイムライン（8:00 〜 20:00）
    let timelineHtml = '';
    const timedEvents = events.filter(e => e.time).sort((a, b) => a.time.localeCompare(b.time));
    for (let h = 8; h <= 20; h++) {
      const hourStr = String(h).padStart(2, '0');
      
      const hourEvents = timedEvents.filter(e => e.time.startsWith(hourStr + ':'));
      
      let hourEventsHtml = '';
      if (hourEvents.length > 0) {
        hourEventsHtml = hourEvents.map(e => {
          const staffName = Store.getStaffName(e.staffId);
          const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
          const icon = cat ? cat.label.split(' ')[0] : '📌';
          return `
            <div class="timeline-event-item" onclick="Calendar.showEventEditModal('${e.id}')" style="border-left-color:${cat ? cat.color : '#3b82f6'}">
              <div class="timeline-event-header">
                <span class="timeline-event-time">${e.time}${e.endTime ? ' 〜 ' + e.endTime : ''}</span>
              </div>
              <div class="timeline-event-title">${icon} ${e.title}</div>
              <div class="timeline-event-meta">
                ${staffName ? '<span>🏷️ ' + staffName + '</span>' : ''}
              </div>
            </div>
          `;
        }).join('');
      } else {
        hourEventsHtml = `<div class="empty-hour"></div>`;
      }

      timelineHtml += `
        <div class="timeline-hour-block">
          <div class="timeline-hour-label">${hourStr}:00</div>
          <div class="timeline-hour-content">
            ${hourEventsHtml}
          </div>
        </div>
      `;
    }

    // 時間枠外の予定（もしあれば下に追加）
    const outsideEvents = timedEvents.filter(e => {
      const h = parseInt(e.time.split(':')[0], 10);
      return h < 8 || h > 20;
    });
    if (outsideEvents.length > 0) {
      timelineHtml += `
        <div class="timeline-hour-block">
          <div class="timeline-hour-label">その他</div>
          <div class="timeline-hour-content">
            ` + outsideEvents.map(e => {
              const staffName = Store.getStaffName(e.staffId);
              const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
              const icon = cat ? cat.label.split(' ')[0] : '📌';
              return `
                <div class="timeline-event-item" onclick="Calendar.showEventEditModal('${e.id}')" style="border-left-color:${cat ? cat.color : '#3b82f6'}">
                  <div class="timeline-event-header">
                    <span class="timeline-event-time">${e.time}${e.endTime ? ' 〜 ' + e.endTime : ''}</span>
                  </div>
                  <div class="timeline-event-title">${icon} ${e.title}</div>
                  <div class="timeline-event-meta">${staffName ? '<span>🏷️ ' + staffName + '</span>' : ''}</div>
                </div>
              `;
            }).join('') + `
          </div>
        </div>
      `;
    }

    const dateObj = new Date(this.selectedDate);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

    const staffList = Store.getStaff();
    const staffFilterOptions = staffList.map(s =>
      `<option value="${s.id}" ${this.filterStaffId == s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    // TODOリストの生成
    const todos = (typeof Store.getTodosByDate === 'function') ? Store.getTodosByDate(this.selectedDate) : [];
    let todoHtml = '';
    if (todos.length > 0) {
      todoHtml = todos.map(t => `
        <div class="todo-item ${t.done ? 'done' : ''}">
          <div class="todo-checkbox" onclick="Calendar.toggleTodo('${t.id}')">
            ${t.done ? '☑' : '☐'}
          </div>
          <div class="todo-text">${t.text}</div>
          <div class="todo-delete" onclick="Calendar.deleteTodo('${t.id}')">✕</div>
        </div>
      `).join('');
    } else {
      todoHtml = '<p class="empty-message" style="margin:0;font-size:0.85rem">今日のTODOはありません</p>';
    }

    return `
      <div class="calendar-page">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:16px;">
            <button class="btn btn-secondary" onclick="Calendar.goBackToMonth()" style="padding:6px 12px;font-size:1.1rem" title="月表示に戻る">◀</button>
            <h1 style="margin:0">スケジュール</h1>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="Calendar.showEventModal('${this.selectedDate}')">
              ＋ 予定追加
            </button>
          </div>
        </div>

        <div class="cal-controls">
          <div class="cal-nav">
            <button class="btn btn-icon" onclick="Calendar.prevDay()">◀</button>
            <h2 class="cal-month-name" style="min-width:180px;text-align:center;">${this.selectedDate}（${dayOfWeek}）</h2>
            <button class="btn btn-icon" onclick="Calendar.nextDay()">▶</button>
            <button class="btn btn-secondary btn-small" onclick="Calendar.goTodayDay()">今日</button>
          </div>
          <div class="cal-staff-filter">
            <label>👤 担当者:</label>
            <select class="filter-select" onchange="Calendar.onStaffFilter(this.value)">
              <option value="all" ${this.filterStaffId === 'all' ? 'selected' : ''}>全員</option>
              ${staffFilterOptions}
            </select>
          </div>
        </div>

        <div class="cal-day-view">
          <div class="day-view-allday">
            <div class="day-view-allday-title">終日の予定・期限</div>
            <div class="day-view-allday-grid">
              ${allDayHtml}
            </div>
          </div>
          <div class="day-todo-section">
            <div class="day-todo-header">
              <div class="day-todo-title">☑️ 今日のTODO</div>
              <button class="btn btn-secondary btn-small" onclick="Calendar.generateDailyReport('${this.selectedDate}')">📄 日報生成</button>
            </div>
            <div class="todo-add-row">
              <input type="text" id="newTodoInput" placeholder="新しいTODOを追加... (Enterで追加)" onkeydown="if(event.key==='Enter') Calendar.addTodo('${this.selectedDate}')">
              <button class="btn btn-primary btn-small" onclick="Calendar.addTodo('${this.selectedDate}')">追加</button>
            </div>
            <div class="todo-list">
              ${todoHtml}
            </div>
          </div>
          <div class="day-view-timeline">
            ${timelineHtml}
          </div>
        </div>
      </div>
      ${this.renderEventModal()}
    `;
  },

  goBackToMonth() {
    this.viewMode = 'month';
    App.refreshView();
  },

  prevDay() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate = `${y}-${m}-${day}`;
    App.refreshView();
  },

  nextDay() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate = `${y}-${m}-${day}`;
    App.refreshView();
  },

  goTodayDay() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate = `${y}-${m}-${day}`;
    App.refreshView();
  },

  // ---- iCalendar (.ics) エクスポート ----
  exportICS() {
    let cases = Store.getCases().filter(c => c.deadline && c.status !== 'done');
    let events = Store.getEvents();
    let inheritanceItems = this.showInheritanceDeadlines ? this.getInheritanceDeadlineItems() : [];
    if (this.filterStaffId !== 'all') {
      cases = cases.filter(c => c.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
      inheritanceItems = inheritanceItems.filter(item => item.staffId == this.filterStaffId);
    }
    const total = cases.length + events.length + inheritanceItems.length;
    if (total === 0) {
      App.showToast('エクスポートする予定がありません');
      return;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GyoseiDashboard//JP',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:行政書士スケジュール',
    ];

    const CASE_LABELS = { garage_oss: '車庫証明(OSS)', garage_paper: '車庫証明(紙)', seal: '丁種封印', inheritance: '相続' };

    cases.forEach(c => {
      const client = Store.getClient(c.clientId);
      const staffName = Store.getStaffName(c.staffId);
      const dateClean = c.deadline.replace(/-/g, '');
      const summary = `[${CASE_LABELS[c.category] || c.category}] ${c.title}`;
      let desc = '';
      if (client) desc += `顧客: ${client.name}\\n`;
      if (c.staffId) desc += `担当: ${staffName}\\n`;
      if (c.fee) desc += `報酬: ${Number(c.fee).toLocaleString()}円\\n`;
      lines.push('BEGIN:VEVENT', `UID:case-${c.id}@gyosei`, `DTSTART;VALUE=DATE:${dateClean}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT');
    });

    events.forEach(ev => {
      const staffName = Store.getStaffName(ev.staffId);
      const cat = this.EVENT_CATEGORIES.find(ec => ec.key === ev.category);
      const catLabel = cat ? cat.label.replace(/^.\s/, '') : ev.category;
      const dateClean = ev.date.replace(/-/g, '');

      if (ev.time) {
        const timeClean = ev.time.replace(/:/g, '') + '00';
        const dtStart = `${dateClean}T${timeClean}`;
        let dtEnd = dtStart;
        if (ev.endTime) {
          dtEnd = `${dateClean}T${ev.endTime.replace(/:/g, '')}00`;
        }
        lines.push('BEGIN:VEVENT', `UID:evt-${ev.id}@gyosei`, `DTSTART:${dtStart}`, `DTEND:${dtEnd}`, `SUMMARY:[${catLabel}] ${ev.title}`, `DESCRIPTION:${ev.staffId ? '担当: ' + staffName + '\\n' : ''}${ev.memo || ''}`, 'END:VEVENT');
      } else {
        lines.push('BEGIN:VEVENT', `UID:evt-${ev.id}@gyosei`, `DTSTART;VALUE=DATE:${dateClean}`, `SUMMARY:[${catLabel}] ${ev.title}`, `DESCRIPTION:${ev.staffId ? '担当: ' + staffName + '\\n' : ''}${ev.memo || ''}`, 'END:VEVENT');
      }
    });

    // 相続期限
    inheritanceItems.forEach(dl => {
      const dateClean = dl.date.replace(/-/g, '');
      const summary = `[相続期限] ${dl.label} - ${dl.caseTitle}`;
      const desc = `${dl.note}\\n案件: ${dl.caseTitle}`;
      lines.push('BEGIN:VEVENT', `UID:inh-${dl.caseId}-${dl.key}@gyosei`, `DTSTART;VALUE=DATE:${dateClean}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const staffSuffix = this.filterStaffId !== 'all' ? `_${Store.getStaffName(this.filterStaffId)}` : '';
    a.download = `gyosei_schedule${staffSuffix}_${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📤 ${total}件の予定をエクスポートしました`);
  },

  // ---- Googleカレンダーから取り込み ----
  async syncFromGoogle() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚙️ スプレッドシート連携を設定してください');
      return;
    }

    App.showToast('🔄 Googleカレンダーから取得中...');

    try {
      const gcalEvents = await SpreadsheetSync.pullCalendarEvents();
      if (!gcalEvents || gcalEvents.length === 0) {
        App.showToast('Googleカレンダーに予定がありません');
        return;
      }

      // 既存イベントのcalendarEventIdを収集
      const localEvents = Store.getEvents();
      const knownIds = new Set(localEvents.filter(e => e.calendarEventId).map(e => e.calendarEventId));

      // 新しい予定だけ追加
      let added = 0;
      gcalEvents.forEach(ge => {
        if (knownIds.has(ge.calendarEventId)) return; // 既に取り込み済み

        // タイトルから先頭の絵文字を除去
        let title = ge.title || '';
        title = title.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '');

        Store.addEvent({
          title,
          date: ge.date,
          time: ge.time || '',
          endTime: ge.endTime || '',
          category: 'other',
          memo: ge.description || '',
          calendarEventId: ge.calendarEventId,
        });
        added++;
      });

      App.refreshView();
      App.showToast(`📅 Googleカレンダーから ${added} 件の新しい予定を取り込みました（全${gcalEvents.length}件中）`);

    } catch (err) {
      App.showToast('❌ 同期エラー: ' + err.message);
    }
  },

  // ---- 相続期限フィルタートグル ----
  toggleInheritanceDeadlines() {
    this.showInheritanceDeadlines = !this.showInheritanceDeadlines;
    App.refreshView();
    App.showToast(this.showInheritanceDeadlines ? '📜 相続期限を表示中' : '📜 相続期限を非表示にしました');
  },

  // ---- 全相続案件の期限をフラットなリストとして取得 ----
  getInheritanceDeadlineItems() {
    if (typeof InheritanceDeadlines === 'undefined') return [];
    const cases = Store.getCases().filter(c => c.category === 'inheritance' && c.status !== 'done' && c.deathDate);
    const items = [];
    cases.forEach(c => {
      const deadlines = InheritanceDeadlines.calculateDeadlines(c.deathDate);
      deadlines.forEach(dl => {
        items.push({
          ...dl,
          caseTitle: c.title,
          caseId: c.id,
          staffId: c.staffId || '',
        });
      });
    });
    return items;
  },

  // ---- 案件から日付イベント（締切・現調・申請・交付・店届）を切り出し ----
  getCaseEvents() {
    const cases = Store.getCases();
    const caseEvents = [];
    const CATEGORY_LABELS = { garage_oss: '車庫(OSS)', garage_paper: '車庫(紙)', seal: '封印', inheritance: '相続' };

    cases.forEach(c => {
      const catLabel = CATEGORY_LABELS[c.category] || '案件';
      // 1. 期限 (Deadline) / 陸運局登録
      const deadlineDate = c.registrationDate || c.deadline || (c.landTransportLocationId ? c.policeDeliveryDate : '');
      if (deadlineDate) {
        const isExplicitDeadline = !c.registrationDate && c.deadline;
        caseEvents.push({
          id: `${c.id}-deadline`,
          caseId: c.id,
          date: deadlineDate,
          title: isExplicitDeadline ? `⏰締切: ${c.title}` : `🚗登録: ${c.title}`,
          category: c.category,
          status: c.status,
          staffId: c.staffId || '',
          locationId: c.landTransportLocationId || c.locationId || '',
          icon: isExplicitDeadline ? '⏰' : '🚗',
          type: 'case-deadline'
        });
      }
      // 2. 現地調査 (Survey)
      if (c.surveyDate) {
        caseEvents.push({
          id: `${c.id}-survey`,
          caseId: c.id,
          date: c.surveyDate,
          title: `🔍現調: ${c.title}`,
          category: c.category,
          status: c.status,
          staffId: c.staffId || '',
          locationId: c.surveyLocationId || c.locationId || '',
          icon: '🔍',
          type: 'case-survey'
        });
      }
      // 3. 申請 (Apply)
      if (c.applyDate) {
        caseEvents.push({
          id: `${c.id}-apply`,
          caseId: c.id,
          date: c.applyDate,
          title: `📝申請: ${c.title}`,
          category: c.category,
          status: c.status,
          staffId: c.staffId || '',
          locationId: c.policeLocationId || c.locationId || '',
          icon: '📝',
          type: 'case-apply'
        });
      }
      // 4. 交付 (Police Delivery)
      if (c.policeDeliveryDate) {
        caseEvents.push({
          id: `${c.id}-delivery`,
          caseId: c.id,
          date: c.policeDeliveryDate,
          title: `📄交付: ${c.title}`,
          category: c.category,
          status: c.status,
          staffId: c.staffId || '',
          locationId: c.policeLocationId || c.locationId || '',
          icon: '📄',
          type: 'case-delivery'
        });
      }
      // 5. 店舗届ける (Store Delivery)
      if (c.storeDeliveryDate) {
        const client = Store.getClient(c.clientId);
        const storeName = client ? client.name : '店舗未選択';
        const timeLabel = c.storeDeliveryTime ? ` (${c.storeDeliveryTime})` : '';
        caseEvents.push({
          id: `${c.id}-store`,
          caseId: c.id,
          date: c.storeDeliveryDate,
          title: `🚚店届: ${storeName} (${c.title})${timeLabel}`,
          category: c.category,
          status: c.status,
          staffId: c.staffId || '',
          locationId: `client-${c.clientId}`,
          icon: '🚚',
          type: 'case-store'
        });
      }
    });
    return caseEvents;
  },
};
