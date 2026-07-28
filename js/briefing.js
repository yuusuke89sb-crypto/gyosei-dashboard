/**
 * 今日のブリーフィング & ルート生成モジュール
 * - アプリ起動時に1日1回自動表示
 * - 本日の案件・予定を集約
 * - Google Maps ワンクリック・ルート生成
 */
const Briefing = {

  // ─── 起点（固定） ────────────────────────────────────────
  START_ADDRESS: '木曽川駅、愛知県一宮市',

  // ─── よく行く場所テーブル ──────────────────────────────
  PRESETS: [
    // 警察署
    { group: '警察署', label: '一宮警察署',       address: '愛知県一宮市七夕2丁目3-1' },
    { group: '警察署', label: '尾西警察署',       address: '愛知県一宮市北方町北方字市場1-5' },
    { group: '警察署', label: '稲沢警察署',       address: '愛知県稲沢市正明寺3丁目2-3' },
    { group: '警察署', label: '江南警察署',       address: '愛知県江南市北山町西300' },
    { group: '警察署', label: '小牧警察署',       address: '愛知県小牧市堀の内1丁目26' },
    { group: '警察署', label: '春日井警察署',     address: '愛知県春日井市三ツ又町1丁目100' },
    { group: '警察署', label: '名古屋西警察署',   address: '愛知県名古屋市西区幅下1丁目3-1' },
    { group: '警察署', label: '一宮西警察署',     address: '愛知県一宮市浅野字井ノ上20-1' },
    { group: '警察署', label: '岐阜南警察署',     address: '岐阜県岐阜市茜部菱野1丁目88' },
    { group: '警察署', label: '岐阜中警察署',     address: '岐阜県岐阜市美江寺町2丁目10' },
    { group: '警察署', label: '岐阜北警察署',     address: '岐阜県岐阜市上土居2丁目2-22' },
    { group: '警察署', label: '各務原警察署',     address: '岐阜県各務原市蘇原中央町2丁目1-3' },
    { group: '警察署', label: '岐阜羽島警察署',   address: '岐阜県岐阜市柳津町梅松3丁目108' },
    // 陸運局
    { group: '陸運局', label: '名古屋運輸支局',             address: '愛知県名古屋市中村区岩塚町字高道1' },
    { group: '陸運局', label: '一宮自動車検査登録事務所',   address: '愛知県一宮市開明字貝田1-1' },
    { group: '陸運局', label: '春日井自動車検査登録事務所', address: '愛知県春日井市牛山町字中神ケ根2880-1' },
    { group: '陸運局', label: '豊橋自動車検査登録事務所',   address: '愛知県豊橋市三弥町字元畑6-1' },
  ],

  // ─── アプリ起動時チェック（1日1回自動表示） ────────────
  checkAndShow() {
    const today = Store.getLocalDateStr();
    const lastShown = localStorage.getItem('gyosei_briefing_date');
    if (lastShown !== today) {
      localStorage.setItem('gyosei_briefing_date', today);
      setTimeout(() => this.showModal(), 900); // 描画完了後
    }
  },

  // ─── 今日のタスクを収集 ───────────────────────────────
  getTodayItems(staffId = '') {
    const today = Store.getLocalDateStr();
    let cases = Store.getCases();
    if (staffId) {
      cases = cases.filter(c => c.staffId == staffId);
    }

    // 期限が今日 or 各日付（現調・申請・交付・店届・登録）が今日
    const todayCases = cases.filter(c => {
      if (c.status === 'done') return false;
      if (c.status === 'applying') {
        return c.policeDeliveryDate === today ||
               c.storeDeliveryDate === today ||
               c.registrationDate === today;
      }
      return c.deadline === today ||
             c.surveyDate === today ||
             c.applyDate === today ||
             c.policeDeliveryDate === today ||
             c.storeDeliveryDate === today ||
             c.registrationDate === today;
    });

    // ダッシュボード内カレンダーイベント（今日分）
    let allEvents = JSON.parse(localStorage.getItem('gyosei_events') || '[]');
    if (staffId) {
      allEvents = allEvents.filter(e => e.staffId == staffId);
    }
    const todayEvents = allEvents.filter(e => e.date === today);

    return { cases: todayCases, events: todayEvents };
  },

  cleanAddress(addr) {
    if (!addr) return '';
    return addr.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').replace(/\[[^\]]*\]/g, '').replace(/【[^】]*】/g, '').trim();
  },

  getCityName(address) {
    if (!address) return '';
    const cleanAddr = address.replace(/^(愛知県|岐阜県|三重県|東京都|京都府|大阪府|北海道|[\u4e00-\u9fa5]{2,3}県)/, '').trim();
    // 「○○市○○区」のように市と区が連続しているパターンを検出
    const matchCityWard = cleanAddr.match(/^([^\s0-9０-９a-zA-Z]+市[^\s0-9０-９a-zA-Z]+区)/);
    if (matchCityWard) return matchCityWard[1];
    const matchCity = cleanAddr.match(/^([^\s0-9０-９a-zA-Z]+[市区町村郡])/);
    if (matchCity) return matchCity[1];
    return cleanAddr.substring(0, 3);
  },

  sortByCity(stops) {
    return [...stops].sort((a, b) => {
      const cityA = this.getCityName(a.address || a.name);
      const cityB = this.getCityName(b.address || b.name);
      return cityA.localeCompare(cityB, 'ja');
    });
  },

  // ─── Google Maps ルートを開く ────────────────────────────
  openRoute(stops) {
    if (stops.length === 0) {
      App.showToast('訪問先を1件以上チェックしてください');
      return;
    }
    const cleanStops = stops.map(s => {
      const cleanName = s.name ? this.cleanAddress(s.name) : '';
      const cleanAddr = s.address ? this.cleanAddress(s.address) : '';
      if (cleanName && cleanAddr) {
        return `${cleanName}, ${cleanAddr}`;
      }
      return cleanName || cleanAddr;
    }).filter(q => q !== '');

    if (cleanStops.length === 0) {
      App.showToast('有効な訪問先がありません');
      return;
    }
    const origin = encodeURIComponent(this.START_ADDRESS);
    const dest    = encodeURIComponent(cleanStops[cleanStops.length - 1]);
    const wps     = cleanStops.slice(0, -1).map(s => encodeURIComponent(s)).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
    if (wps) url += `&waypoints=${wps}`;
    url += '&travelmode=driving';
    window.open(url, '_blank');
  },

  // ─── モーダルを表示 ──────────────────────────────────────
  showModal(selectedStaffId = '') {
    this.selectedStaffId = selectedStaffId;
    const { cases, events } = this.getTodayItems(selectedStaffId);
    const today = Store.getLocalDateStr();
    
    // 本日の案件から、今日訪問予定の役所・施設情報を抽出
    const todayLocations = [];
    const seenLocs = new Set();
    cases.forEach(c => {
      let locId = '';
      if (c.surveyDate === today) locId = c.surveyLocationId || c.locationId;
      else if (c.applyDate === today || c.policeDeliveryDate === today) locId = c.policeLocationId || c.locationId;
      else if (c.registrationDate === today || c.deadline === today) locId = c.landTransportLocationId || c.locationId;
      else locId = c.locationId || c.policeLocationId || c.landTransportLocationId || c.surveyLocationId;

      if (locId) {
        const loc = Store.getLocation(locId);
        if (loc && loc.address && !seenLocs.has(loc.address)) {
          seenLocs.add(loc.address);
          todayLocations.push(loc);
        }
      }
    });

    // 本日の案件の顧客（店舗・お届け先）の重複を排除して抽出
    const todayCaseClients = [];
    const seenClientIds = new Set();
    cases.forEach(c => {
      const cl = Store.getClient(c.clientId);
      if (cl && (cl.address || cl.name) && !seenClientIds.has(cl.id)) {
        seenClientIds.add(cl.id);
        todayCaseClients.push(cl);
      }
    });

    const now     = new Date();
    const dateStr = now.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
    const hour     = now.getHours();
    const greeting = hour < 12 ? 'おはようございます ☀️'
                   : hour < 17 ? 'こんにちは 🌤️'
                   : 'お疲れ様です 🌙';

    const existing = document.getElementById('briefingModal');
    if (existing) existing.remove();

    const CATS = {
      garage_oss: '🚗 車庫証明（OSS）', garage_paper: '🚗 車庫証明（紙）', seal: '🚙 丁種封印', inheritance: '📜 相続'
    };
    const STATUSES = {
      received: '受付', applying: '申請', delivery: '交付', registration: '登録', done: '完了'
    };

    // インボックスの未対応件数を取得
    const inbox = (typeof Store !== 'undefined' && Store.getInbox) ? Store.getInbox() : [];
    const unprocessedInbox = inbox.filter(item => item.status === '未対応');
    const inboxAlertHtml = unprocessedInbox.length > 0
      ? `
        <div class="briefing-alert-banner" style="background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;padding:12px;margin-bottom:20px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="document.getElementById('briefingModal').remove(); App.navigate('inbox')">
          <span style="font-size:1.5rem">📥</span>
          <div>
            <strong style="color:#856404;font-size:0.95rem">未登録の受信FAX・メールがあります（${unprocessedInbox.length}件）</strong>
            <div style="font-size:0.75rem;color:#856404;margin-top:2px">クリックすると登録前BOXに移動します。案件の登録漏れがないか確認してください。</div>
          </div>
        </div>
      `
      : '';

    // 1. 場所マスタから場所を取得してプリセットとマージ
    const defaultPresets = this.PRESETS;
    const userLocations = (typeof Store !== 'undefined' && Store.getLocations) ? Store.getLocations() : [];
    
    const allLocations = [...userLocations.map(l => {
      let group = 'その他登録場所';
      if (l.name.includes('警察署')) group = '警察署';
      else if (l.name.includes('陸運') || l.name.includes('支局') || l.name.includes('検査') || l.name.includes('運輸支局')) group = '陸運局';
      return { group, label: l.name, address: l.address };
    })];

    // 重複を避けてデフォルトプリセットを追加
    defaultPresets.forEach(p => {
      const exists = allLocations.some(loc => loc.address === p.address || loc.label === p.label);
      if (!exists) {
        allLocations.push(p);
      }
    });

    // グループ別プリセット
    const groups = {};
    allLocations.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    // 2. 顧客マスタから住所のある顧客を取得（本日の案件の顧客以外）
    const allClients = (typeof Store !== 'undefined' && Store.getClients) ? Store.getClients() : [];
    const todayCaseClientIds = cases.map(c => c.clientId);
    let otherClientsWithAddress = allClients.filter(c => c.address && c.address.trim() !== '' && !todayCaseClientIds.includes(c.id));
    if (selectedStaffId) {
      otherClientsWithAddress = otherClientsWithAddress.filter(c => c.staffId == selectedStaffId);
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'briefingModal';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('briefingModal').remove()"></div>
      <div class="modal-content modal-large briefing-modal">

        <!-- ヘッダー -->
        <div class="briefing-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="briefing-header-text">
            <div class="briefing-date">${dateStr}</div>
            <h2 class="briefing-title">${greeting}</h2>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" class="btn" onclick="Briefing.sendToLine()" style="background:#16a34a; color:#fff; font-size:0.8rem; padding:6px 12px; font-weight:600; border-radius:4px; border:none; cursor:pointer;">
              💬 LINEに送る
            </button>
            <button class="modal-close" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;"
              onclick="document.getElementById('briefingModal').remove()">✕</button>
          </div>
        </div>

        <div class="briefing-body">
          ${inboxAlertHtml}

          <!-- 担当者フィルター -->
          ${(typeof Store !== 'undefined' && Store.getStaff) ? `
            <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px; background: var(--bg-secondary); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                👤 担当者で絞り込む:
              </label>
              <select id="briefingStaffFilter" style="padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 0.85rem; cursor: pointer; outline: none;" onchange="Briefing.onStaffFilterChange(this.value)">
                <option value="">— 全ての担当者 —</option>
                ${Store.getStaff().map(s => `<option value="${s.id}" ${s.id === selectedStaffId ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}

          <!-- 本日の案件 -->
          <section class="briefing-section">
            <h3 class="briefing-section-title">
              📋 本日の案件
              <span class="briefing-badge">${cases.length}件</span>
            </h3>
            ${cases.length === 0
              ? '<div class="briefing-empty">本日締切・申請中の案件はありません</div>'
              : [...cases].sort((a, b) => {
                  const hasTimeA = a.storeDeliveryTime ? 1 : 0;
                  const hasTimeB = b.storeDeliveryTime ? 1 : 0;
                  return hasTimeB - hasTimeA;
                }).map(c => {
                  const client = Store.getClient(c.clientId);
                  const addr = client?.address || '';
                  const actionBadges = [];
                  if (c.surveyDate === today) actionBadges.push('<span class="status-badge" style="background:#3b82f6;color:white;font-weight:600">🔍 現調</span>');
                  if (c.applyDate === today && c.status !== 'applying') actionBadges.push('<span class="status-badge" style="background:#10b981;color:white;font-weight:600">📝 申請</span>');
                  if (c.policeDeliveryDate === today) actionBadges.push('<span class="status-badge" style="background:#f59e0b;color:white;font-weight:600">🚚 交付</span>');
                  if (c.storeDeliveryDate === today) actionBadges.push('<span class="status-badge" style="background:#8b5cf6;color:white;font-weight:600">🚚 店届</span>');
                  if (c.registrationDate === today) actionBadges.push('<span class="status-badge" style="background:#ec4899;color:white;font-weight:600">🚗 登録</span>');
                  if (c.deadline === today && c.status !== 'applying') actionBadges.push('<span class="status-badge status-applying" style="background:#ef4444;color:white;font-weight:600">⏰ 期限</span>');
                  if (c.status === 'applying' && actionBadges.length === 0) {
                    actionBadges.push('<span class="status-badge" style="background:#3b82f6;color:white;font-weight:600">⏳ 交付待ち</span>');
                  }
                  const actionBadgeHtml = actionBadges.join(' ');
                  
                  return `
                    <div class="briefing-case-card">
                      <div class="briefing-case-header">
                        <span class="category-tag category-${c.category}">${CATS[c.category] || c.category}</span>
                        <span class="status-badge status-${c.status}">${STATUSES[c.status] || c.status}</span>
                        ${actionBadgeHtml}
                        ${c.deadline ? `<span class="briefing-deadline">📅 ${c.deadline}</span>` : ''}
                      </div>
                      <div class="briefing-case-title">${c.title}</div>
                      ${client ? `<div class="briefing-case-client">👤 ${client.name}${addr ? ' ／ ' + addr : ''}</div>` : ''}
                    </div>
                  `;
                }).join('')
            }
          </section>

          <!-- 本日の予定 -->
          <section class="briefing-section">
            <h3 class="briefing-section-title">
              📅 本日の予定
              <span class="briefing-badge">${events.length}件</span>
            </h3>
            ${events.length === 0
              ? '<div class="briefing-empty">本日の予定はありません</div>'
              : events.map(e => `
                  <div class="briefing-event-card">
                    <span class="briefing-event-time">${e.time || '終日'}</span>
                    <span class="briefing-event-title">${e.title}</span>
                  </div>
                `).join('')
            }
          </section>

          <!-- ルート生成 -->
          <section class="briefing-section">
            <h3 class="briefing-section-title">🗺️ 今日のルートを作成</h3>
            <div class="briefing-route-hint">
              🚩 起点：<strong>木曽川駅</strong>　→　訪問先をチェックして「ルートを開く」
            </div>

            <!-- 本日行く予定の役所・施設 -->
            ${todayLocations.length > 0 ? `
              <div class="route-group-title" style="color: var(--accent-orange); font-weight: bold;">🏢 本日の案件 訪問先（役所・陸運局など）</div>
              <div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
                ${todayLocations.map(loc => `
                  <label class="route-stop-item" style="border: 1px solid var(--accent-orange); background: rgba(249, 115, 22, 0.03);">
                    <input type="checkbox" class="route-stop-cb" value="${loc.address}" data-name="${loc.name}" checked
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">
                      <span class="route-stop-icon">🏢</span>
                      <span style="font-weight: 600;">${loc.name} — ${loc.address}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            ` : ''}

            <!-- 顧客住所（案件から自動取得） -->
            ${todayCaseClients.length > 0 ? `
              <div class="route-group-title" style="color: var(--primary); font-weight: bold;">📍 本日の案件 顧客住所（店舗・お届け先）</div>
              <div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
                ${todayCaseClients.map(cl => `
                  <label class="route-stop-item" style="border: 1px solid var(--primary); background: rgba(59, 130, 246, 0.03);">
                    <input type="checkbox" class="route-stop-cb" value="${cl.address || cl.name}" data-name="${cl.name}" checked
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">
                      <span class="route-stop-icon">👤</span>
                      <span style="font-weight: 600;">${cl.name}${cl.address ? ' — ' + cl.address : ''}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            ` : ''}

            <!-- プリセット（警察署・陸運局） -->
            ${Object.entries(groups).map(([groupName, presets]) => `
              <div class="route-group-title">${groupName === '警察署' ? '🏢' : '🚗'} ${groupName}</div>
              <div class="preset-grid">
                ${presets.map(p => `
                  <label class="route-stop-item preset">
                    <input type="checkbox" class="route-stop-cb" value="${p.address}" data-name="${p.label}"
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">${p.label}</span>
                  </label>
                `).join('')}
              </div>
            `).join('')}

            <!-- 顧客マスタ住所（その他） -->
            ${otherClientsWithAddress.length > 0 ? `
              <div class="route-group-title">👤 顧客住所（マスタ一覧）</div>
              <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; gap: 4px; background: var(--bg-secondary);">
                ${otherClientsWithAddress.map(c => `
                  <label class="route-stop-item" style="padding: 4px 8px;">
                    <input type="checkbox" class="route-stop-cb" value="${c.address}" data-name="${c.name}"
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">
                      <span class="route-stop-icon">👤</span>
                      <span>${c.name} — ${c.address}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            ` : ''}

            <!-- 手動入力 -->
            <div class="route-group-title">✏️ 住所を直接入力</div>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <input type="text" id="briefingManualAddr"
                placeholder="例：愛知県一宮市... または 施設名"
                class="briefing-manual-input">
              <button class="btn btn-secondary" onclick="Briefing.addManualStop()">追加</button>
            </div>
            <div id="briefingManualList" style="display:flex;flex-direction:column;gap:4px"></div>
          </section>

        </div><!-- /briefing-body -->

        <!-- フッター -->
        <div class="briefing-footer">
          <div class="briefing-stop-count" id="briefingStopCount">訪問先: ${todayLocations.length + todayCaseClients.length}件選択</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary"
              onclick="document.getElementById('briefingModal').remove()">閉じる</button>
            <button class="btn btn-primary briefing-route-btn"
              onclick="Briefing.openRouteFromModal()">
              🗺️ 通常ルート
            </button>
            <button class="btn briefing-route-btn" style="background:#8b5cf6; color:#fff;"
              onclick="Briefing.openOptimizedRouteFromModal()">
              ✨ 最適順ルート
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  onStaffFilterChange(staffId) {
    this.showModal(staffId);
  },

  onStopChange() {
    const checked = [...document.querySelectorAll('.route-stop-cb:checked')];
    const count = checked.length;
    const el = document.getElementById('briefingStopCount');
    if (el) el.textContent = `訪問先: ${count}件選択`;

    const footerActions = document.querySelector('.briefing-footer > div:not(.briefing-stop-count)');
    if (footerActions) {
      if (count > 9) {
        footerActions.innerHTML = `
          <button class="btn btn-secondary"
            onclick="document.getElementById('briefingModal').remove()">閉じる</button>
          <button class="btn btn-primary briefing-route-btn" style="background:#2563eb; color:#fff;"
            onclick="Briefing.openSplitRoute(1)">
            🗺️ ルート1 (1〜9件目)
          </button>
          <button class="btn btn-primary briefing-route-btn" style="background:#1d4ed8; color:#fff;"
            onclick="Briefing.openSplitRoute(2)">
            🗺️ ルート2 (10件目〜)
          </button>
          <button class="btn briefing-route-btn" style="background:#8b5cf6; color:#fff;"
            onclick="Briefing.openOptimizedRouteFromModal()">
            ✨ 全件最適順
          </button>
        `;
      } else {
        footerActions.innerHTML = `
          <button class="btn btn-secondary"
            onclick="document.getElementById('briefingModal').remove()">閉じる</button>
          <button class="btn btn-primary briefing-route-btn"
            onclick="Briefing.openRouteFromModal()">
            🗺️ 通常ルート
          </button>
          <button class="btn briefing-route-btn" style="background:#8b5cf6; color:#fff;"
            onclick="Briefing.openOptimizedRouteFromModal()">
            ✨ 最適順ルート
          </button>
        `;
      }
    }
  },

  addManualStop() {
    const input = document.getElementById('briefingManualAddr');
    const addr  = input.value.trim();
    if (!addr) return;

    const list = document.getElementById('briefingManualList');
    const div  = document.createElement('label');
    div.className = 'route-stop-item';
    div.innerHTML = `
      <input type="checkbox" class="route-stop-cb" value="${addr}" data-name="${addr}" checked
        onchange="Briefing.onStopChange()">
      <span class="route-stop-label">
        <span class="route-stop-icon">📍</span>
        <span>${addr}</span>
      </span>
    `;
    list.appendChild(div);
    input.value = '';
    this.onStopChange();
  },

  openRouteFromModal() {
    const checked = [...document.querySelectorAll('.route-stop-cb:checked')].map(cb => ({
      address: cb.value.trim(),
      name: cb.getAttribute('data-name')?.trim() || ''
    })).filter(x => x.address !== '' || x.name !== '');
    const sorted = this.sortByCity(checked);
    this.openRoute(sorted);
  },

  // ─── 住所の緯度経度を取得（OSM Nominatim API） ───
  async geocode(stop) {
    try {
      const searchStr = stop.address || stop.name;
      const cleanAddr = this.cleanAddress(searchStr);
      if (!cleanAddr) return null;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddr)}&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GyoseiDashboardApp/1.0' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          address: address
        };
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    }
    return null;
  },

  // ─── 2点間の直線距離（km）を計算（ハバースインの公式） ───
  getDistance(p1, p2) {
    const R = 6371; // 地球の半径 km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // ─── 最適な訪問順（TSP 貪欲法）を計算 ───
  async optimizeRoute(stops) {
    if (stops.length <= 1) return stops;
    
    App.showToast('🔍 住所の位置情報を解決中...');
    
    // 起点と全目的地のジオコーディング
    const originGeocoded = await this.geocode({ address: this.START_ADDRESS, name: '' });
    if (!originGeocoded) {
      App.showToast('⚠️ 起点の位置が特定できませんでした');
      return stops;
    }

    const destinations = [];
    for (const stop of stops) {
      const g = await this.geocode(stop);
      if (g) {
        destinations.push(g);
      } else {
        destinations.push({ lat: originGeocoded.lat, lon: originGeocoded.lon, stop: stop, failed: true });
      }
      // API利用制限を考慮したウェイト
      await new Promise(r => setTimeout(r, 650));
    }

    // 貪欲法による巡回順序の決定（常に現在の位置から最も近い未訪問地を選択）
    const optimized = [];
    let current = originGeocoded;
    const unvisited = [...destinations];

    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dest = unvisited[i];
        if (dest.failed) continue;
        const dist = this.getDistance(current, dest);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      if (nearestIdx === -1) {
        // ジオコーディングに失敗した残りの目的地を追加
        optimized.push(...unvisited.map(u => u.stop));
        break;
      }

      const next = unvisited.splice(nearestIdx, 1)[0];
      optimized.push(next.stop);
      current = next;
    }

    return optimized;
  },

  // ─── 最適化したルートをGoogleマップで開く ───
  async openOptimizedRouteFromModal() {
    const checked = [...document.querySelectorAll('.route-stop-cb:checked')].map(cb => ({
      address: cb.value.trim(),
      name: cb.getAttribute('data-name')?.trim() || ''
    })).filter(x => x.address !== '' || x.name !== '');
    if (checked.length === 0) {
      App.showToast('訪問先を1件以上チェックしてください');
      return;
    }
    
    const btn = document.querySelector('.briefing-footer button[onclick*="openOptimizedRouteFromModal"]');
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ 計算中...';

    try {
      const optimized = await this.optimizeRoute(checked);
      if (optimized.length > 9) {
        App.showToast('✨ 最適化完了！9件を超えるため分割ボタンを表示します');
        this.optimizedStops = optimized;
        const footerActions = document.querySelector('.briefing-footer > div:not(.briefing-stop-count)');
        if (footerActions) {
          footerActions.innerHTML = `
            <button class="btn btn-secondary"
              onclick="document.getElementById('briefingModal').remove()">閉じる</button>
            <button class="btn btn-primary" style="background:#8b5cf6; color:#fff;"
              onclick="Briefing.openOptimizedSplitRoute(1)">
              ✨ 最適ルート1 (1〜9件目)
            </button>
            <button class="btn btn-primary" style="background:#7c3aed; color:#fff;"
              onclick="Briefing.openOptimizedSplitRoute(2)">
              ✨ 最適ルート2 (10件目〜)
            </button>
          `;
        }
      } else {
        this.openRoute(optimized);
      }
    } catch (e) {
      console.error(e);
      App.showToast('❌ 最適化エラーのため、通常順で開きます');
      this.openRoute(checked);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  },

  // ─── 通常（未最適化）の分割ルートを開く ───
  openSplitRoute(part) {
    const checked = [...document.querySelectorAll('.route-stop-cb:checked')].map(cb => ({
      address: cb.value.trim(),
      name: cb.getAttribute('data-name')?.trim() || ''
    })).filter(x => x.address !== '' || x.name !== '');
    if (checked.length === 0) return;
    const sorted = this.sortByCity(checked);

    if (part === 1) {
      const part1 = sorted.slice(0, 9);
      this.openRoute(part1);
    } else if (part === 2) {
      const startAddressBackup = this.START_ADDRESS;
      this.START_ADDRESS = sorted[8].address || sorted[8].name;
      const part2 = sorted.slice(9);
      this.openRoute(part2);
      this.START_ADDRESS = startAddressBackup;
    }
  },

  // ─── 最適化された分割ルートを開く ───
  openOptimizedSplitRoute(part) {
    if (!this.optimizedStops) return;
    if (part === 1) {
      const part1 = this.optimizedStops.slice(0, 9);
      this.openRoute(part1);
    } else if (part === 2) {
      const startAddressBackup = this.START_ADDRESS;
      this.START_ADDRESS = this.optimizedStops[8].address || this.optimizedStops[8].name;
      const part2 = this.optimizedStops.slice(9);
      this.openRoute(part2);
      this.START_ADDRESS = startAddressBackup;
    }
  },

  // ─── 手動で今日のブリーフィングを表示（サイドバーボタン用） ─
  show() {
    this.showModal();
  },

  // ─── 本日のブリーフィング情報をLINEへ送信する ──
  sendToLine() {
    const { cases, events } = this.getTodayItems(this.selectedStaffId || '');
    const now = new Date();
    const dateStr = now.toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', weekday: 'short'
    });
    
    let msg = `\n【☀️ 本日のブリーフィング】\n${dateStr}の業務まとめ\n`;
    msg += `━━━━━━━━━━━━━━━━\n`;
    
    // 1. 本日の予定
    msg += `📅 本日の予定 (${events.length}件)\n`;
    if (events.length === 0) {
      msg += '・予定はありません\n';
    } else {
      events.forEach(e => {
        let locText = '';
        if (e.locationId) {
          const loc = Store.getLocation(e.locationId);
          if (loc) {
            locText = ` 📍${loc.name}`;
          }
        }
        const memoText = e.memo && e.memo.trim() ? `\n   📝 ${e.memo.trim().replace(/\n/g, ' ')}` : '';
        msg += `・[${e.time || '終日'}] ${e.title}${locText}${memoText}\n`;
      });
    }
    
    msg += `━━━━━━━━━━━━━━━━\n`;
    
    // 2. 本日のタスク（行き先ごとにグループ化）
    msg += `📋 本日のタスク (${cases.length}件)\n`;
    if (cases.length === 0) {
      msg += '・本日のタスクはありません\n';
    } else {
      const allActions = [];
      cases.forEach(c => {
        const client = Store.getClient(c.clientId);
        const clientText = client ? ` (${client.name}様)` : '';
        const todayStr = Store.getLocalDateStr();
        const caseMemo = c.memo || '';
        
        if (c.surveyDate === todayStr) {
          allActions.push({
            label: '現調',
            title: c.title,
            clientText,
            locId: c.surveyLocationId || c.locationId,
            timeLabel: '',
            deadline: c.deadline,
            memo: caseMemo
          });
        }
        if (c.applyDate === todayStr && c.status !== 'applying' && c.status !== 'done') {
          allActions.push({
            label: '申請',
            title: c.title,
            clientText,
            locId: c.policeLocationId || c.locationId,
            timeLabel: '',
            deadline: c.deadline,
            memo: caseMemo
          });
        }
        if (c.policeDeliveryDate === todayStr) {
          allActions.push({
            label: '交付',
            title: c.title,
            clientText,
            locId: c.policeLocationId || c.locationId,
            timeLabel: '',
            deadline: c.deadline,
            memo: caseMemo
          });
        }
        if (c.storeDeliveryDate === todayStr) {
          // 店届は顧客店舗ごとにグループ化するため、locId が空なら顧客名をフォールバック
          const client = Store.getClient(c.clientId);
          const storeLocId = c.locationId || null;
          const storeLocFallback = client ? `🚚 ${client.name}様` : '🚚 店届先';
          allActions.push({
            label: '店届',
            title: c.title,
            clientText,
            locId: storeLocId,
            locFallbackName: storeLocFallback,
            isStoreDelivery: true,
            timeLabel: c.storeDeliveryTime ? `【${c.storeDeliveryTime}】` : '',
            deadline: c.deadline,
            memo: caseMemo,
            priority: c.storeDeliveryTime ? 1 : 0
          });
        }
        if (c.registrationDate === todayStr) {
          allActions.push({
            label: '登録',
            title: c.title,
            clientText,
            locId: c.landTransportLocationId || c.locationId,
            timeLabel: '',
            deadline: c.deadline,
            memo: caseMemo
          });
        }
        
        // どのアクション日程にも当てはまらない場合
        if (
          c.surveyDate !== todayStr &&
          c.applyDate !== todayStr &&
          c.policeDeliveryDate !== todayStr &&
          c.storeDeliveryDate !== todayStr &&
          c.registrationDate !== todayStr
        ) {
          const label = (c.status === 'applying') ? '交付待ち' : '期限';
          allActions.push({
            label: label,
            title: c.title,
            clientText,
            locId: c.policeLocationId || c.landTransportLocationId || c.locationId,
            timeLabel: '',
            deadline: c.deadline,
            memo: caseMemo
          });
        }
      });

      // ── 行き先ごとにグループ化 ──
      const locationGroups = {};  // locName => actions[]
      const noLocationActions = [];

      allActions.forEach(act => {
        let locName = null;

        if (act.locId) {
          const loc = Store.getLocation(act.locId);
          locName = loc ? loc.name : act.locId;
        } else if (act.locFallbackName) {
          // 店届など：locationId未設定でも顧客名でグループ化
          locName = act.locFallbackName;
        }

        if (locName) {
          if (!locationGroups[locName]) {
            locationGroups[locName] = [];
          }
          locationGroups[locName].push(act);
        } else {
          noLocationActions.push(act);
        }
      });

      // 行き先ごとに出力（時間指定があるタスクを含むグループを上に）
      const sortedLocations = Object.keys(locationGroups).sort((a, b) => {
        const aPriority = locationGroups[a].some(act => act.priority) ? 0 : 1;
        const bPriority = locationGroups[b].some(act => act.priority) ? 0 : 1;
        return aPriority - bPriority;
      });

      let printedCount = 0;
      sortedLocations.forEach(locName => {
        const actions = locationGroups[locName];
        // 同じ行き先内でも時間指定を上に
        actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        msg += `\n📍 ${locName} (${actions.length}件)\n`;
        actions.forEach(act => {
          const deadlineText = act.deadline ? ` (期限: ${act.deadline.slice(5)})` : '';
          const prefix = act.timeLabel ? `${act.timeLabel} ` : '';
          const memoText = act.memo && act.memo.trim() ? `\n   📝 ${act.memo.trim().replace(/\n/g, ' ')}` : '';
          msg += `・${prefix}[${act.label}] ${act.title}${act.clientText}${deadlineText}${memoText}\n`;
          printedCount++;
        });
      });

      // 行き先未設定のタスク
      if (noLocationActions.length > 0) {
        msg += `\n🏠 事務所・その他 (${noLocationActions.length}件)\n`;
        noLocationActions.forEach(act => {
          const deadlineText = act.deadline ? ` (期限: ${act.deadline.slice(5)})` : '';
          const memoText = act.memo && act.memo.trim() ? `\n   📝 ${act.memo.trim().replace(/\n/g, ' ')}` : '';
          msg += `・[${act.label}] ${act.title}${act.clientText}${deadlineText}${memoText}\n`;
          printedCount++;
        });
      }
      
      if (printedCount === 0) {
        msg += '・タスクはありません\n';
      }
    }
    
    msg += `━━━━━━━━━━━━━━━━\n`;
    
    // 3. 登録前BOX
    const inbox = (typeof Store !== 'undefined' && Store.getInbox) ? Store.getInbox() : [];
    const unprocessedInbox = inbox.filter(item => item.status === '未対応');
    if (unprocessedInbox.length > 0) {
      msg += `📥 登録前BOX (未対応): ${unprocessedInbox.length}件あります。\n`;
      msg += `━━━━━━━━━━━━━━━━\n`;
    }
    
    msg += '今日も一日頑張りましょう！';
    
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      SpreadsheetSync.push('sendLineNotification', { message: msg })
        .then(res => {
          if (res && !res.error) {
            App.showToast('✅ LINEへ本日の予定を送信しました');
          } else {
            App.showToast('❌ 送信失敗: 連携設定のLINEトークンまたはIDを確認してください');
          }
        });
    } else {
      App.showToast('⚠️ スプレッドシート連携が未設定です');
    }
  },
};
