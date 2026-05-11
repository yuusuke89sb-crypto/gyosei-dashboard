const fs = require('fs');
const file = 'd:/行政書士/開業/gyosei-dashboard/js/calendar.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Add viewMode and selectedDate
code = code.replace(
  'showInheritanceDeadlines: false,',
  'showInheritanceDeadlines: false,\n  viewMode: \'month\',\n  selectedDate: null,'
);

// 2. Rename render to renderMonthView and add routing render
code = code.replace(
  '  render() {',
  '  render() {\n    if (this.viewMode === \'day\' && this.selectedDate) {\n      return this.renderDayView();\n    }\n    return this.renderMonthView();\n  },\n\n  renderMonthView() {'
);

// 3. Replace showDayDetail
const showDayDetailMatch = /  showDayDetail\([\s\S]*?document\.body\.appendChild\(modal\);\n  \},\n/g;

const newShowDayDetail = `  // ---- 日付詳細（1日表示への遷移） ----
  showDayDetail(dateStr) {
    this.viewMode = 'day';
    this.selectedDate = dateStr;
    App.refreshView();
  },

  // ---- 1日（デイ）表示 ----
  renderDayView() {
    let cases = Store.getCases().filter(c => c.deadline === this.selectedDate);
    let events = Store.getEvents().filter(e => e.date === this.selectedDate);
    let inheritanceItems = this.showInheritanceDeadlines ? this.getInheritanceDeadlineItems().filter(item => item.date === this.selectedDate) : [];

    if (this.filterStaffId !== 'all') {
      cases = cases.filter(c => c.staffId == this.filterStaffId);
      events = events.filter(e => e.staffId == this.filterStaffId);
      inheritanceItems = inheritanceItems.filter(item => item.staffId == this.filterStaffId);
    }

    const STATUS_LABELS = { received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了' };
    const CATEGORY_LABELS = { garage_oss: '🚗 車庫証明（OSS）', garage_paper: '🚗 車庫証明（紙）', seal: '🚙 丁種封印', inheritance: '📜 相続' };

    // 終日アイテム（時間指定なし）
    let allDayHtml = '';
    const allDayItems = [];
    cases.forEach(c => allDayItems.push({ title: c.title, category: c.category, label: CATEGORY_LABELS[c.category] || '📋', staffId: c.staffId, type: 'case', id: c.id, status: c.status }));
    events.filter(e => !e.time).forEach(e => allDayItems.push({ title: e.title, category: e.category, staffId: e.staffId, type: 'event', id: e.id }));
    inheritanceItems.forEach(dl => {
      const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
      allDayItems.push({ title: dl.label + ' (' + dl.caseTitle + ')', category: 'inheritance', label: icon, staffId: dl.staffId, type: 'inheritance', id: dl.caseId });
    });

    if (allDayItems.length > 0) {
      allDayHtml = allDayItems.map(item => {
        const staffName = Store.getStaffName(item.staffId);
        const clickAction = item.type === 'event' ? \`Calendar.showEventEditModal('\${item.id}')\` : \`App.navigate('cases'); setTimeout(() => Cases.showEditModal('\${item.id}'), 100)\`;
        const icon = item.type === 'event' ? (this.EVENT_CATEGORIES.find(ec => ec.key === item.category)?.label.split(' ')[0] || '📌') : item.label;
        return \`
          <div class="allday-item" onclick="\${clickAction}">
            <div class="allday-item-title">\${icon} \${item.title}</div>
            <div class="allday-item-meta">\${staffName ? '🏷️ ' + staffName : ''}</div>
          </div>
        \`;
      }).join('');
    } else {
      allDayHtml = '<p class="empty-message">終日の予定・期限はありません</p>';
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
          return \`
            <div class="timeline-event-item" onclick="Calendar.showEventEditModal('\${e.id}')" style="border-left-color:\${cat ? cat.color : '#3b82f6'}">
              <div class="timeline-event-header">
                <span class="timeline-event-time">\${e.time}\${e.endTime ? ' 〜 ' + e.endTime : ''}</span>
              </div>
              <div class="timeline-event-title">\${icon} \${e.title}</div>
              <div class="timeline-event-meta">
                \${staffName ? '<span>🏷️ ' + staffName + '</span>' : ''}
              </div>
            </div>
          \`;
        }).join('');
      } else {
        hourEventsHtml = \`<div class="empty-hour"></div>\`;
      }

      timelineHtml += \`
        <div class="timeline-hour-block">
          <div class="timeline-hour-label">\${hourStr}:00</div>
          <div class="timeline-hour-content">
            \${hourEventsHtml}
          </div>
        </div>
      \`;
    }

    // 時間枠外の予定（もしあれば下に追加）
    const outsideEvents = timedEvents.filter(e => {
      const h = parseInt(e.time.split(':')[0], 10);
      return h < 8 || h > 20;
    });
    if (outsideEvents.length > 0) {
      timelineHtml += \`
        <div class="timeline-hour-block">
          <div class="timeline-hour-label">その他</div>
          <div class="timeline-hour-content">
            \` + outsideEvents.map(e => {
              const staffName = Store.getStaffName(e.staffId);
              const cat = this.EVENT_CATEGORIES.find(ec => ec.key === e.category);
              const icon = cat ? cat.label.split(' ')[0] : '📌';
              return \`
                <div class="timeline-event-item" onclick="Calendar.showEventEditModal('\${e.id}')" style="border-left-color:\${cat ? cat.color : '#3b82f6'}">
                  <div class="timeline-event-header">
                    <span class="timeline-event-time">\${e.time}\${e.endTime ? ' 〜 ' + e.endTime : ''}</span>
                  </div>
                  <div class="timeline-event-title">\${icon} \${e.title}</div>
                  <div class="timeline-event-meta">\${staffName ? '<span>🏷️ ' + staffName + '</span>' : ''}</div>
                </div>
              \`;
            }).join('') + \`
          </div>
        </div>
      \`;
    }

    const dateObj = new Date(this.selectedDate);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

    const staffList = Store.getStaff();
    const staffFilterOptions = staffList.map(s =>
      \`<option value="\${s.id}" \${this.filterStaffId == s.id ? 'selected' : ''}>\${s.name}</option>\`
    ).join('');

    return \`
      <div class="calendar-page">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:16px;">
            <button class="btn btn-secondary" onclick="Calendar.goBackToMonth()" style="padding:6px 12px;font-size:1.1rem" title="月表示に戻る">◀</button>
            <h1 style="margin:0">スケジュール</h1>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="Calendar.showEventModal('\${this.selectedDate}')">
              ＋ 予定追加
            </button>
          </div>
        </div>

        <div class="cal-controls">
          <div class="cal-nav">
            <button class="btn btn-icon" onclick="Calendar.prevDay()">◀</button>
            <h2 class="cal-month-name" style="min-width:180px;text-align:center;">\${this.selectedDate}（\${dayOfWeek}）</h2>
            <button class="btn btn-icon" onclick="Calendar.nextDay()">▶</button>
            <button class="btn btn-secondary btn-small" onclick="Calendar.goTodayDay()">今日</button>
          </div>
          <div class="cal-staff-filter">
            <label>👤 担当者:</label>
            <select class="filter-select" onchange="Calendar.onStaffFilter(this.value)">
              <option value="all" \${this.filterStaffId === 'all' ? 'selected' : ''}>全員</option>
              \${staffFilterOptions}
            </select>
          </div>
        </div>

        <div class="cal-day-view">
          <div class="day-view-allday">
            <div class="day-view-allday-title">終日の予定・期限</div>
            <div class="day-view-allday-grid">
              \${allDayHtml}
            </div>
          </div>
          <div class="day-view-timeline">
            \${timelineHtml}
          </div>
        </div>
      </div>
      \${this.renderEventModal()}
    \`;
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
    this.selectedDate = \`\${y}-\${m}-\${day}\`;
    App.refreshView();
  },

  nextDay() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate = \`\${y}-\${m}-\${day}\`;
    App.refreshView();
  },

  goTodayDay() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate = \`\${y}-\${m}-\${day}\`;
    App.refreshView();
  },
`;

code = code.replace(showDayDetailMatch, newShowDayDetail);

fs.writeFileSync(file, code);
console.log('Successfully updated js/calendar.js');
