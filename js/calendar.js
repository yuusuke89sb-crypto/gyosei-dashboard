/**
 * カレンダー・スケジュール画面（担当者フィルタ + 予定登録 + iCal エクスポート対応）
 */
const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  filterStaffId: 'all',
  editingEventId: null,

  EVENT_CATEGORIES: [
    { key: 'meeting', label: '🤝 打ち合わせ', color: '#3b82f6' },
    { key: 'visit', label: '🚗 外出・訪問', color: '#8b5cf6' },
    { key: 'training', label: '📚 研修・勉強', color: '#10b981' },
    { key: 'deadline', label: '⏰ 締切', color: '#ef4444' },
    { key: 'other', label: '📌 その他', color: '#f59e0b' },
  ],

  render() {
    const year = this.currentYear;
    const month = this.currentMonth;
    const monthName = `${year}年${month + 1}月`;

    // 案件（期限あり）
    let cases = Store.getCases().filter(c => c.deadline);
    // 予定
    let events = Store.getEvents();

    // 担当者フィルタ
    if (this.filterStaffId !== 'all') {
      cases = cases.filter(c => c.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const CASE_ICONS = { garage: '🚗', inheritance: '📜', mahjong: '🀄' };

    let calendarDays = '';

    for (let i = 0; i < firstDay; i++) {
      calendarDays += '<div class="cal-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const isToday = dayDate.getTime() === today.getTime();
      const isPast = dayDate < today;

      const dayCases = cases.filter(c => c.deadline === dateStr);
      const dayEvents = events.filter(e => e.date === dateStr);
      const totalItems = dayCases.length + dayEvents.length;

      let dots = '';
      if (totalItems > 0) {
        const items = [];
        // 案件
        dayCases.slice(0, 2).forEach(c => {
          const statusClass = c.status === 'done' ? 'done' : (isPast ? 'overdue' : '');
          items.push(`<div class="cal-event ${statusClass} category-${c.category}" title="${c.title}">${CASE_ICONS[c.category] || '📋'} ${c.title.substring(0, 5)}</div>`);
        });
        // 予定
        dayEvents.slice(0, 3 - items.length).forEach(e => {
          const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
          const icon = cat ? cat.label.split(' ')[0] : '📌';
          items.push(`<div class="cal-event cal-event-custom" title="${e.title}" style="border-left:3px solid ${cat ? cat.color : '#f59e0b'}">${icon} ${e.title.substring(0, 5)}</div>`);
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

    // 期限リスト（案件 + 予定を統合）
    const upcomingItems = [];
    cases.filter(c => c.status !== 'done').forEach(c => {
      upcomingItems.push({ type: 'case', date: c.deadline, data: c });
    });
    events.filter(e => new Date(e.date) >= today).forEach(e => {
      upcomingItems.push({ type: 'event', date: e.date, data: e });
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
          if (item.type === 'case') {
            const c = item.data;
            const client = Store.getClient(c.clientId);
            const staffName = Store.getStaffName(c.staffId);
            const dl = new Date(c.deadline);
            const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
            const urgencyClass = diff < 0 ? 'overdue' : diff <= 3 ? 'urgent' : diff <= 7 ? 'soon' : '';
            const urgencyLabel = diff < 0 ? `${Math.abs(diff)}日超過` : diff === 0 ? '本日' : `あと${diff}日`;
            return `
                        <div class="timeline-item ${urgencyClass}" onclick="Cases.showEditModal('${c.id}'); App.navigate('cases')">
                          <div class="timeline-date">${c.deadline}<br><span class="timeline-diff">${urgencyLabel}</span></div>
                          <div class="timeline-content">
                            <div class="timeline-title">📋 ${c.title}</div>
                            <div class="timeline-meta">
                              ${client ? `👤 ${client.name}` : '—'}
                              ${c.staffId ? ` ・ 🏷️ ${staffName}` : ''}
                            </div>
                          </div>
                        </div>`;
          } else {
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
      <div id="eventModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Calendar.closeEventModal()"></div>
        <div class="modal-content">
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

  // ---- 日付詳細モーダル ----
  showDayDetail(dateStr) {
    let cases = Store.getCases().filter(c => c.deadline === dateStr);
    let events = Store.getEvents().filter(e => e.date === dateStr);
    if (this.filterStaffId !== 'all') {
      cases = cases.filter(c => c.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
    }
    if (cases.length === 0 && events.length === 0) {
      // 空の日をクリック → 予定追加
      this.showEventModal(dateStr);
      return;
    }

    const STATUS_LABELS = { received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了' };
    const CATEGORY_LABELS = { garage: '🚗 車庫証明', inheritance: '📜 相続', mahjong: '🀄 麻雀関連' };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'dayDetailModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('dayDetailModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>${dateStr}</h2>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-primary btn-small" onclick="document.getElementById('dayDetailModal').remove(); Calendar.showEventModal('${dateStr}')">＋ 予定追加</button>
            <button class="modal-close" onclick="document.getElementById('dayDetailModal').remove()">✕</button>
          </div>
        </div>
        <div class="day-cases-list">
          ${cases.map(c => {
      const client = Store.getClient(c.clientId);
      const staffName = Store.getStaffName(c.staffId);
      return `
              <div class="day-case-item" onclick="document.getElementById('dayDetailModal').remove(); App.navigate('cases'); setTimeout(() => Cases.showEditModal('${c.id}'), 100)">
                <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category]}</span>
                <div class="day-case-title">${c.title}</div>
                <div class="day-case-meta">
                  <span class="status-badge status-${c.status}">${STATUS_LABELS[c.status]}</span>
                  ${client ? `<span>👤 ${client.name}</span>` : ''}
                  ${c.staffId ? `<span>🏷️ ${staffName}</span>` : ''}
                </div>
              </div>`;
    }).join('')}
          ${events.map(ev => {
      const cat = this.EVENT_CATEGORIES.find(ec => ec.key === ev.category);
      const icon = cat ? cat.label.split(' ')[0] : '📌';
      const staffName = Store.getStaffName(ev.staffId);
      return `
              <div class="day-case-item day-event-item" onclick="document.getElementById('dayDetailModal').remove(); Calendar.showEventEditModal('${ev.id}')" style="border-left:3px solid ${cat ? cat.color : '#f59e0b'}">
                <div class="day-case-title">${icon} ${ev.title}</div>
                <div class="day-case-meta">
                  ${ev.time ? `<span>🕐 ${ev.time}${ev.endTime ? '〜' + ev.endTime : ''}</span>` : ''}
                  ${ev.staffId ? `<span>🏷️ ${staffName}</span>` : ''}
                </div>
              </div>`;
    }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // ---- iCalendar (.ics) エクスポート ----
  exportICS() {
    let cases = Store.getCases().filter(c => c.deadline && c.status !== 'done');
    let events = Store.getEvents();
    if (this.filterStaffId !== 'all') {
      cases = cases.filter(c => c.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
    }
    const total = cases.length + events.length;
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

    const CASE_LABELS = { garage: '車庫証明', inheritance: '相続', mahjong: '麻雀関連' };

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
};
