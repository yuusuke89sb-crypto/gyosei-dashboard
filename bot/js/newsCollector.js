/**
 * ニュースコレクター - 営業トーク用ニュース収集ツール
 * rss2json.com API 経由で NHK RSS を JSON 変換・取得
 */

const NewsCollector = (() => {
  // ===== 設定 =====
  const CONFIG = {
    feeds: [
      {
        id: 'domestic',
        label: '🇯🇵 国内ニュース',
        icon: '🇯🇵',
        url: 'https://www3.nhk.or.jp/rss/news/cat1.xml',
        source: 'NHK',
        count: 3,
        cssClass: 'domestic'
      },
      {
        id: 'local',
        label: '💼 経済・ビジネス',
        icon: '💼',
        url: 'https://www3.nhk.or.jp/rss/news/cat5.xml',
        source: 'NHK',
        count: 2,
        cssClass: 'local'
      },
      {
        id: 'world',
        label: '🌍 国際ニュース',
        icon: '🌍',
        url: 'https://www3.nhk.or.jp/rss/news/cat6.xml',
        source: 'NHK',
        count: 1,
        cssClass: 'world'
      }
    ],
    // rss2json.com は CORS 対応済み (Access-Control-Allow-Origin: *)
    rss2jsonBase: 'https://api.rss2json.com/v1/api.json?rss_url=',
    cacheTTL: 30 * 60 * 1000, // 30分
    cacheKey: 'news_cache_v2'
  };

  // ===== キャッシュ =====
  function getCachedNews() {
    try {
      const raw = localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      if (Date.now() - cache.timestamp > CONFIG.cacheTTL) {
        localStorage.removeItem(CONFIG.cacheKey);
        return null;
      }
      return cache.data;
    } catch { return null; }
  }

  function setCachedNews(data) {
    try {
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch { /* quota exceeded etc */ }
  }

  // ===== RSS取得（rss2json.com API） =====
  async function fetchFeed(feed) {
    const apiUrl = CONFIG.rss2jsonBase + encodeURIComponent(feed.url);
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.status !== 'ok' || !json.items) {
      throw new Error('Invalid RSS response');
    }

    const results = [];
    const items = json.items.slice(0, feed.count);

    for (const item of items) {
      if (item.title) {
        results.push({
          title: item.title.trim(),
          link: item.link || '',
          description: stripHtml(item.description || ''),
          pubDate: formatDate(item.pubDate || ''),
          source: feed.source,
          category: feed.id,
          cssClass: feed.cssClass
        });
      }
    }
    return results;
  }

  // ===== ユーティリティ =====
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch { return dateStr; }
  }

  function getTodayLabel() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const day = days[now.getDay()];
    return `${y}年${m}月${d}日（${day}）`;
  }

  // ===== トースト通知 =====
  function showToast(msg) {
    let toast = document.querySelector('.news-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'news-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ===== レンダリング =====
  function renderLoading(container) {
    container.innerHTML = `
      <div class="news-content">
        <div class="news-loading">
          <div class="loading-spinner"></div>
          <p>ニュースを取得中...</p>
        </div>
      </div>`;
  }

  function renderError(container, msg) {
    container.innerHTML = `
      <div class="news-content">
        <div class="news-error">
          <p>⚠️ ${msg}</p>
          <button onclick="NewsCollector.refresh()">再取得</button>
        </div>
      </div>`;
  }

  function renderNews(container, allNews) {
    const sections = CONFIG.feeds.map(feed => {
      const items = allNews.filter(n => n.category === feed.id);
      return { feed, items };
    });

    let html = `
      <div class="news-content">
        <div class="news-page-header">
          <h2>📰 今日のトークテーマ</h2>
          <div class="news-date"><strong>${getTodayLabel()}</strong> のニュース</div>
        </div>
        <div class="news-actions">
          <button class="refresh-btn" id="refreshBtn" onclick="NewsCollector.refresh()">
            <span class="refresh-icon">🔄</span> 最新に更新
          </button>
          <button class="copy-all-btn" onclick="NewsCollector.copyAll()">
            📋 全てコピー
          </button>
        </div>`;

    for (const { feed, items } of sections) {
      html += `
        <div class="news-section">
          <div class="section-header">
            <div class="section-icon ${feed.cssClass}">${feed.icon}</div>
            <div class="section-title">${feed.label}</div>
            <div class="section-count">${items.length}件</div>
          </div>
          <div class="news-cards">`;

      if (items.length === 0) {
        html += `<div style="padding:16px;text-align:center;color:var(--text-light);font-size:.88rem;">取得できませんでした</div>`;
      }

      for (const item of items) {
        const descPreview = item.description.length > 150
          ? item.description.slice(0, 150) + '…'
          : item.description;

        html += `
            <div class="news-card ${item.cssClass}">
              <div class="news-card-header">
                <div class="news-card-title">
                  <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
                </div>
                <div class="news-card-time">${item.pubDate}</div>
              </div>
              ${descPreview ? `<div class="news-card-desc">${descPreview}</div>` : ''}
              <div class="news-card-footer">
                <div class="news-source">📡 ${item.source}</div>
                <div class="news-card-actions">
                  <button class="memo-btn" onclick="NewsCollector.copyOne(this, '${escapeForAttr(item.title)}')">
                    📋 コピー
                  </button>
                </div>
              </div>
            </div>`;
      }

      html += `
          </div>
        </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  function escapeForAttr(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // ===== メイン =====
  let _allNews = [];

  async function loadNews(forceRefresh = false) {
    const container = document.getElementById('newsContent');
    if (!container) return;

    // キャッシュチェック
    if (!forceRefresh) {
      const cached = getCachedNews();
      if (cached) {
        _allNews = cached;
        renderNews(container, cached);
        return;
      }
    }

    renderLoading(container);

    try {
      const promises = CONFIG.feeds.map(async feed => {
        try {
          return await fetchFeed(feed);
        } catch (err) {
          console.warn(`[NewsCollector] ${feed.label} 取得失敗:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      _allNews = results.flat();

      if (_allNews.length === 0) {
        renderError(container, 'ニュースを取得できませんでした。ネットワーク接続を確認してください。');
        return;
      }

      setCachedNews(_allNews);
      renderNews(container, _allNews);
    } catch (err) {
      console.error('[NewsCollector] Error:', err);
      renderError(container, 'ニュースの取得に失敗しました。');
    }
  }

  function refresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('loading');
    localStorage.removeItem(CONFIG.cacheKey);
    loadNews(true).then(() => {
      if (btn) btn.classList.remove('loading');
      showToast('✅ ニュースを更新しました');
    });
  }

  function copyOne(btn, title) {
    const item = _allNews.find(n => n.title === title.replace(/\\'/g, "'"));
    if (!item) return;
    const text = `【${item.source}】${item.title}\n${item.description}\n${item.link}`;
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = '✅ コピー済';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '📋 コピー';
      }, 2000);
    });
  }

  function copyAll() {
    if (_allNews.length === 0) return;
    let text = `📰 ${getTodayLabel()} の営業トークテーマ\n${'═'.repeat(40)}\n\n`;

    for (const feed of CONFIG.feeds) {
      const items = _allNews.filter(n => n.category === feed.id);
      if (items.length === 0) continue;
      text += `■ ${feed.label}\n`;
      for (const item of items) {
        text += `  ・${item.title}\n`;
        if (item.description) {
          const shortDesc = item.description.length > 80
            ? item.description.slice(0, 80) + '…'
            : item.description;
          text += `    ${shortDesc}\n`;
        }
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 全ニュースをコピーしました');
    });
  }

  // ===== ダークモード =====
  function initDarkMode() {
    const btn = document.getElementById('darkModeBtn');
    if (!btn) return;

    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      btn.textContent = '☀️';
    }

    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', isDark);
      btn.textContent = isDark ? '☀️' : '🌙';
    });
  }

  // ===== サイドバー =====
  function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('show');
      });
    }

    if (overlay && sidebar) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  }

  // ===== 初期化 =====
  function init() {
    initDarkMode();
    initSidebar();
    loadNews();
  }

  // ===== Public API =====
  return { init, refresh, copyOne, copyAll };
})();

// ページ読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', NewsCollector.init);
