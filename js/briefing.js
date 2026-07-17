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
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem('gyosei_briefing_date');
    if (lastShown !== today) {
      localStorage.setItem('gyosei_briefing_date', today);
      setTimeout(() => this.showModal(), 900); // 描画完了後
    }
  },

  // ─── 今日のタスクを収集 ───────────────────────────────
  getTodayItems() {
    const today = new Date().toISOString().slice(0, 10);
    const cases = Store.getCases();

    // 期限が今日 or 申請中（役所に行く可能性が高い）
    const todayCases = cases.filter(c => {
      if (c.status === 'done') return false;
      return c.deadline === today || c.status === 'applying';
    });

    // ダッシュボード内カレンダーイベント（今日分）
    const allEvents = JSON.parse(localStorage.getItem('gyosei_events') || '[]');
    const todayEvents = allEvents.filter(e => e.date === today);

    return { cases: todayCases, events: todayEvents };
  },

  // ─── Google Maps ルートを開く ────────────────────────────
  openRoute(stops) {
    if (stops.length === 0) {
      App.showToast('訪問先を1件以上チェックしてください');
      return;
    }
    const origin = encodeURIComponent(this.START_ADDRESS);
    const dest    = encodeURIComponent(stops[stops.length - 1]);
    const wps     = stops.slice(0, -1).map(s => encodeURIComponent(s)).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
    if (wps) url += `&waypoints=${wps}`;
    url += '&travelmode=driving';
    window.open(url, '_blank');
  },

  // ─── モーダルを表示 ──────────────────────────────────────
  showModal() {
    const { cases, events } = this.getTodayItems();
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
      received: '受付', hearing: 'ヒアリング', documents: '書類作成', applying: '申請中', done: '完了'
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

    // グループ別プリセット
    const groups = {};
    this.PRESETS.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'briefingModal';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('briefingModal').remove()"></div>
      <div class="modal-content modal-large briefing-modal">

        <!-- ヘッダー -->
        <div class="briefing-header">
          <div class="briefing-header-text">
            <div class="briefing-date">${dateStr}</div>
            <h2 class="briefing-title">${greeting}</h2>
          </div>
          <button class="modal-close" style="color:#fff"
            onclick="document.getElementById('briefingModal').remove()">✕</button>
        </div>

        <div class="briefing-body">
          ${inboxAlertHtml}

          <!-- 本日の案件 -->
          <section class="briefing-section">
            <h3 class="briefing-section-title">
              📋 本日の案件
              <span class="briefing-badge">${cases.length}件</span>
            </h3>
            ${cases.length === 0
              ? '<div class="briefing-empty">本日締切・申請中の案件はありません</div>'
              : cases.map(c => {
                  const client = Store.getClient(c.clientId);
                  const addr = client?.address || '';
                  return `
                    <div class="briefing-case-card">
                      <div class="briefing-case-header">
                        <span class="category-tag category-${c.category}">${CATS[c.category] || c.category}</span>
                        <span class="status-badge status-${c.status}">${STATUSES[c.status] || c.status}</span>
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

            <!-- 顧客住所（案件から自動取得） -->
            ${cases.some(c => Store.getClient(c.clientId)?.address) ? `
              <div class="route-group-title">📍 本日の案件 顧客住所</div>
              ${cases.filter(c => Store.getClient(c.clientId)?.address).map(c => {
                const cl = Store.getClient(c.clientId);
                return `
                  <label class="route-stop-item">
                    <input type="checkbox" class="route-stop-cb" value="${cl.address}"
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">
                      <span class="route-stop-icon">👤</span>
                      <span>${cl.name} — ${cl.address}</span>
                    </span>
                  </label>
                `;
              }).join('')}
            ` : ''}

            <!-- プリセット（警察署・陸運局） -->
            ${Object.entries(groups).map(([groupName, presets]) => `
              <div class="route-group-title">${groupName === '警察署' ? '🏢' : '🚗'} ${groupName}</div>
              <div class="preset-grid">
                ${presets.map(p => `
                  <label class="route-stop-item preset">
                    <input type="checkbox" class="route-stop-cb" value="${p.address}"
                      onchange="Briefing.onStopChange()">
                    <span class="route-stop-label">${p.label}</span>
                  </label>
                `).join('')}
              </div>
            `).join('')}

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
          <div class="briefing-stop-count" id="briefingStopCount">訪問先: 0件選択</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary"
              onclick="document.getElementById('briefingModal').remove()">閉じる</button>
            <button class="btn btn-primary briefing-route-btn"
              onclick="Briefing.openRouteFromModal()">
              🗺️ Googleマップでルートを開く
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  onStopChange() {
    const count = document.querySelectorAll('.route-stop-cb:checked').length;
    const el = document.getElementById('briefingStopCount');
    if (el) el.textContent = `訪問先: ${count}件選択`;
  },

  addManualStop() {
    const input = document.getElementById('briefingManualAddr');
    const addr  = input.value.trim();
    if (!addr) return;

    const list = document.getElementById('briefingManualList');
    const div  = document.createElement('label');
    div.className = 'route-stop-item';
    div.innerHTML = `
      <input type="checkbox" class="route-stop-cb" value="${addr}" checked
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
    const checked = [...document.querySelectorAll('.route-stop-cb:checked')];
    this.openRoute(checked.map(cb => cb.value));
  },

  // ─── 手動で今日のブリーフィングを表示（サイドバーボタン用） ─
  show() {
    this.showModal();
  },
};
