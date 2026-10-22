/**
 * スプレッドシート同期モジュール
 * Google Apps Script の Web API 経由でスプレッドシートとデータを同期
 */
const SpreadsheetSync = {
    CONFIG_KEY: 'gyosei_sync_settings',
    INBOX_QUEUE_KEY: 'gyosei_inbox_pending_queue',
    REVS_KEY: 'gyosei_sync_revs',
    LAST_FULL_SYNC_KEY: 'gyosei_last_full_sync',

    // デフォルトGAS URL（全デバイスで自動接続）
    DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbzCXTuW3RirKhn29PiAZe_VtmGXj22LrBAmO_ztCpmiKuQ_YU8pE2JqoZDoSWEbgm0g/exec',

    // ---- 設定管理 ----
    getConfig() {
        try {
            return JSON.parse(localStorage.getItem(this.CONFIG_KEY)) || {};
        } catch {
            return {};
        }
    },

    saveConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    },

    getRevs() {
        try {
            return JSON.parse(localStorage.getItem(this.REVS_KEY)) || null;
        } catch (e) {
            return null;
        }
    },

    saveRevs(revs) {
        try {
            localStorage.setItem(this.REVS_KEY, JSON.stringify(revs || {}));
        } catch (e) {}
    },

    clearRevs() {
        try {
            localStorage.removeItem(this.REVS_KEY);
            localStorage.removeItem(this.LAST_FULL_SYNC_KEY);
        } catch (e) {}
    },

    getGasUrl() {
        const conf = this.getConfig();
        // 古い無効なURLがローカルストレージに残っている場合は自動で最新デフォルトに切り替える
        if (conf.gasUrl && (
            conf.gasUrl.includes('AKfycbxDLp223') ||
            conf.gasUrl.includes('AKfycbzdDtMh') ||
            conf.gasUrl.includes('AKfycbyBUWa')
        )) {
            conf.gasUrl = this.DEFAULT_GAS_URL;
            this.saveConfig(conf);
            return this.DEFAULT_GAS_URL;
        }
        return (conf.gasUrl && conf.gasUrl.trim()) ? conf.gasUrl.trim() : this.DEFAULT_GAS_URL;
    },

    isConfigured() {
        return !!this.getGasUrl();
    },

    // ---- 受信の設定（2026-10-22 スマホ受信失敗対策）----
    // 一括受信(type=all)は約4.8MB・約100秒かかるため、スマホ（約60秒で通信が打ち切られる）では使わない。
    // 種類ごとの受信は同時に11本投げるとGASが処理しきれず404になるため、同時2本までに絞り、小さいものから順に取る。
    PULL_CHUNK_TYPES: ['settings', 'staff', 'locations', 'clientContacts', 'customers', 'deletedCases', 'invoices', 'events', 'journals', 'inbox', 'cases'],
    PULL_CONCURRENCY: 2,
    PULL_RETRY_WAITS: [0, 3000, 8000],   // 初回・3秒後・8秒後
    PULL_ALL_TIMEOUT_MS: 180000,         // PCの一括受信
    PULL_CHUNK_TIMEOUT_MS: 120000,       // 種類ごとの受信
    _pullPromise: null,

    isMobile() {
        try {
            const ua = navigator.userAgent || '';
            return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
        } catch (e) { return false; }
    },

    async _fetchJson(fullUrl, timeoutMs) {
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
        try {
            const r = await fetch(fullUrl, ctrl ? { signal: ctrl.signal } : {});
            if (!r.ok) throw new Error('通信エラー: ' + r.status);
            const j = await r.json();
            if (j && j.error) throw new Error(j.error);
            return j;
        } catch (e) {
            if (e && e.name === 'AbortError') throw new Error('タイムアウト（' + Math.round(timeoutMs / 1000) + '秒）');
            throw e;
        } finally {
            if (timer) clearTimeout(timer);
        }
    },

    // 1種類を取得（失敗時は少し待って再試行）
    async _fetchChunk(url, sep, type, extraQuery) {
        let lastErr;
        const extraParam = extraQuery ? ('&' + extraQuery) : '';
        for (const wait of this.PULL_RETRY_WAITS) {
            if (wait) await new Promise(res => setTimeout(res, wait));
            try {
                return await this._fetchJson(url + sep + 'type=' + type + '&t=' + Date.now() + extraParam, this.PULL_CHUNK_TIMEOUT_MS);
            } catch (e) {
                lastErr = e;
                console.warn(`[SpreadsheetSync] ${type} の受信に失敗（再試行します）:`, e && e.message);
            }
        }
        throw lastErr;
    },

    // 全データの取得：差分同期時は type=all を試行（数KB〜数十KBでスマホでも一瞬で完了）
    // 全件同期時：PCは一括→分割、スマホは最初から分割（同時2本）
    async _fetchAllData(url, sep, queryParams, isDiff) {
        const extra = queryParams ? ('&' + queryParams) : '';
        if (!this.isMobile() || isDiff) {
            try {
                const timeout = isDiff ? 35000 : this.PULL_ALL_TIMEOUT_MS;
                return await this._fetchJson(url + sep + 'type=all&t=' + Date.now() + extra, timeout);
            } catch (allErr) {
                console.warn('[SpreadsheetSync.pull] 一括受信に失敗。種類ごとの受信に切り替えます...', allErr);
            }
        }
        const types = this.PULL_CHUNK_TYPES;
        const data = { syncedAt: new Date().toISOString() };
        const failed = [];
        let next = 0;
        const worker = async () => {
            while (next < types.length) {
                const t = types[next++];
                try {
                    const res = await this._fetchChunk(url, sep, t, queryParams);
                    if (res) {
                        if (res[t] !== undefined && res[t] !== null) data[t] = res[t];
                        if (res.casesPartial) data.casesPartial = true;
                        if (res.deletedCases !== undefined) data.deletedCases = res.deletedCases;
                        if (res.revs) data.revs = Object.assign(data.revs || {}, res.revs);
                        if (res.unchanged && Array.isArray(res.unchanged)) {
                            data.unchanged = (data.unchanged || []).concat(res.unchanged);
                        }
                        if (res.syncedAt) data.syncedAt = res.syncedAt;
                    }
                } catch (e) {
                    failed.push(t);
                }
            }
        };
        const n = Math.max(1, Math.min(this.PULL_CONCURRENCY, types.length));
        await Promise.all(Array.from({ length: n }, worker));
        const hasContent = data.customers !== undefined || data.cases !== undefined || data.journals !== undefined || (data.unchanged && data.unchanged.length > 0);
        if (!hasContent && !isDiff) {
            throw new Error('受信できませんでした（混雑中の可能性。数分後に自動で再試行します）');
        }
        if (failed.length) data._failed = failed;
        return data;
    },

    // ---- データ取得（Pull）----
    // 同期が重ならないように、実行中ならその結果を待つ（3分ごとの自動同期・タブ復帰・手動同期の多重実行を防止）
    pull(opts) {
        if (this._pullPromise) return this._pullPromise;
        this._pullPromise = this._pullImpl(opts).finally(() => { this._pullPromise = null; });
        return this._pullPromise;
    },

    async _pullImpl(opts) {
        opts = opts || {};
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        // 未送信の案件変更を先に送る（取得で上書きされないように）
        if (typeof CaseSync !== 'undefined') {
            try { await CaseSync.flush(); } catch (e) { console.warn('[SpreadsheetSync.pull] 案件の送信警告:', e); }
        }

        // 未送信キューがあれば事前に再送試行
        try {
            await this.flushPendingInboxQueue();
        } catch (e) {
            console.warn('[SpreadsheetSync.pull] キュー自動フラッシュ警告:', e);
        }

        // 未送信の請求書発行があれば事前に再送試行
        if (typeof InvoiceSync !== 'undefined' && typeof InvoiceSync.flushQueue === 'function') {
            try { await InvoiceSync.flushQueue(); } catch (e) { console.warn('[SpreadsheetSync.pull] 請求キュー送信警告:', e); }
        }

        try {
            const sep = url.includes('?') ? '&' : '?';

            // 差分判定
            const knownRevs = this.getRevs();
            const lastFull = Number(localStorage.getItem(this.LAST_FULL_SYNC_KEY)) || 0;
            const isDailyFull = (Date.now() - lastFull) > 24 * 60 * 60 * 1000;
            const forceFull = !!opts.forceFull;
            const isDiff = !forceFull && !isDailyFull && !!knownRevs;

            let queryParams = '';
            if (isDiff) {
                const conf = this.getConfig();
                const since = conf.lastSync || '';
                queryParams = 'revs=' + encodeURIComponent(JSON.stringify(knownRevs));
                if (since) {
                    queryParams += '&since=' + encodeURIComponent(since);
                }
            }

            const data = await this._fetchAllData(url, sep, queryParams, isDiff);

            // 顧客データを localStorage に保存
            if (data.customers) {
                Store._set(Store.KEYS.CLIENTS, data.customers);
            }

            // 担当者データを localStorage に保存
            if (data.staff) {
                Store._set(Store.KEYS.STAFF, data.staff);
            }

            // 案件データ：項目単位のマージ（case_sync.js）。未送信の変更・新規案件は消さない
            if (typeof CaseSync !== 'undefined') {
                if (data.cases || data.deletedCases) {
                    CaseSync.mergeRemoteCases(data.cases || [], data.deletedCases || [], {
                        serverReady: Array.isArray(data.deletedCases),
                        isPartial: !!data.casesPartial || (isDiff && !data.cases)
                    });
                }
            }

            // 請求書・請求明細・入金（invoice_sync.js）。案件の請求済み表示もここで組み立て直す
            if (data.invoices && typeof InvoiceSync !== 'undefined') {
                InvoiceSync.applyRemote(data.invoices);
            } else if (data.cases && typeof InvoiceSync !== 'undefined' && InvoiceSync.isReady()) {
                InvoiceSync.reconcileCases();
            }

            // 全端末共通の設定（目標値・事務所情報 / shared_settings.js）
            if (data.settings && typeof SharedSettings !== 'undefined') {
                SharedSettings.applyRemote(data.settings);
            }

            // インボックスデータを localStorage に保存（ローカルのステータス変更を優先保持）
            if (data.inbox && Array.isArray(data.inbox)) {
                this.mergeInboxData(data.inbox);
            }

            // 場所マスタデータをマージ（リモートの単価が未設定でもローカル単価や既定単価を保護・維持）
            if (data.locations && Array.isArray(data.locations)) {
                var localLocations = Store.getLocations() || [];
                var policeFees = (typeof CaseTemplates !== 'undefined' && CaseTemplates.POLICE_FEES) ? CaseTemplates.POLICE_FEES : {};

                var mergedLocations = data.locations.map(function(remoteLoc) {
                    var cleanRemoteName = (remoteLoc.name || '').replace(/\s+/g, '');
                    var localLoc = localLocations.find(function(l) {
                        return l && (l.id === remoteLoc.id || (l.name && l.name.replace(/\s+/g, '') === cleanRemoteName));
                    });

                    var fee = remoteLoc.syakoFee;
                    // 数値として不正、または未設定(null, undefined, '')、または0以下の場合
                    if (fee === undefined || fee === null || fee === '' || isNaN(Number(fee)) || Number(fee) <= 0) {
                        if (localLoc && localLoc.syakoFee && !isNaN(Number(localLoc.syakoFee)) && Number(localLoc.syakoFee) > 0) {
                            fee = Number(localLoc.syakoFee);
                        } else {
                            var defaultInfo = policeFees[remoteLoc.name];
                            if (!defaultInfo) {
                                for (var pName in policeFees) {
                                    if (pName.replace(/\s+/g, '') === cleanRemoteName) {
                                        defaultInfo = policeFees[pName];
                                        break;
                                    }
                                }
                            }
                            if (defaultInfo && defaultInfo.fee) {
                                fee = defaultInfo.fee;
                            } else {
                                fee = null;
                            }
                        }
                    } else {
                        fee = Number(fee);
                    }

                    return Object.assign({}, remoteLoc, {
                        syakoFee: fee,
                        address: remoteLoc.address || (localLoc && localLoc.address) || '',
                        memo: remoteLoc.memo || (localLoc && localLoc.memo) || ''
                    });
                });

                // ローカルにしか存在しない場所の扱い（2026-10-19 変更）
                // 以前は無条件に残していたため、端末ごとに作られた古い場所（LOC-0047 等）や削除済みの場所が
                // 復活・増殖していた。スプレッドシートを正とし、作成直後（送信待ち）の場所だけを残して再送する。
                var canonOf = function(n) { return (typeof LocationMaster !== 'undefined') ? LocationMaster.canonicalName(n || '') : (n || '').replace(/\s+/g, ''); };
                var remoteNames = {};
                mergedLocations.forEach(function(m) { remoteNames[canonOf(m.name)] = true; });
                var RECENT_MS = 15 * 60 * 1000;
                localLocations.forEach(function(localLoc) {
                    if (!localLoc || !localLoc.id) return;
                    if (mergedLocations.some(function(m) { return m.id === localLoc.id; })) return;
                    var created = Date.parse(localLoc.createdAt || '') || 0;
                    var isRecent = created && (Date.now() - created) < RECENT_MS;
                    if (isRecent && !remoteNames[canonOf(localLoc.name)]) {
                        mergedLocations.push(localLoc);
                        SpreadsheetSync.push('upsertLocation', localLoc).catch(function(){});
                    }
                });

                Store._set(Store.KEYS.LOCATIONS, mergedLocations);

                if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.seedPoliceFees === 'function') {
                    CaseTemplates.seedPoliceFees();
                }
            }

            // 顧客担当者データをマージ（受信時のみローカル既存データを保持 + ローカルのみのデータをSSへPush）
            if (data.clientContacts && Array.isArray(data.clientContacts)) {
                var localContacts = JSON.parse(localStorage.getItem('gyosei_client_contacts') || '[]');
                var remoteContacts = data.clientContacts || [];

                // スプレッドシート側でID未採番の担当者に確定IDを付与
                remoteContacts.forEach(function(c) {
                    if (!c.id && c.name) {
                        c.id = 'cnt_' + (c.clientId || 'c') + '_' + encodeURIComponent(c.name.trim());
                        SpreadsheetSync.push('upsertClientContact', c).catch(function(){});
                    }
                });

                var remoteContactIds = {};
                remoteContacts.forEach(function(c){ if (c.id) remoteContactIds[c.id] = true; });
                var localOnlyContacts = localContacts.filter(function(c){ return c.id && !remoteContactIds[c.id]; });

                // ローカルのみの担当者をスプレッドシートへ自動Push
                if (localOnlyContacts.length > 0) {
                    console.log('📤 ローカル専用の顧客担当者を同期:', localOnlyContacts.length, '件');
                    localOnlyContacts.forEach(function(c) {
                        SpreadsheetSync.push('upsertClientContact', c).catch(function(e) {
                            console.warn('顧客担当者Push失敗:', c.name, e);
                        });
                    });
                }

                var mergedContacts = remoteContacts.concat(localOnlyContacts);
                localStorage.setItem('gyosei_client_contacts', JSON.stringify(mergedContacts));
            }

            // 帳簿データをマージ（ローカル専用データを保持）
            if (data.journals) {
                // 異常金額（タイムスタンプ等の誤混入）を事前サニタイズ
                data.journals.forEach(function(j){
                    if (typeof j.amount === 'string') {
                        var parsed = Number(j.amount.replace(/[^0-9.]/g, ''));
                        j.amount = isNaN(parsed) ? 0 : parsed;
                    }
                    if (j.amount > 10000000) {
                        var fixed = 4000;
                        if (j.description) {
                            if (j.description.includes('車庫証明(OSS)')) fixed = 3500;
                            else if (j.description.includes('出張封印')) fixed = 5000;
                            else if (j.description.includes('軽自動車登録')) fixed = 3000;
                        }
                        j.amount = fixed;
                    }
                });
                var local = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
                var remoteKeys = {};
                data.journals.forEach(function(j){
                    if (j.id) remoteKeys[j.id] = true;
                    if (j.caseId) {
                        remoteKeys['case_' + j.caseId] = true;
                    }
                    var orderNo = j.orderNo || (j.description && j.description.match(/\[注:([^\]]+)\]/)?.[1]) || '';
                    var key = (j.date || '') + '_' + (j.debit || '') + '_' + (j.credit || '') + '_' + (j.amount || 0) + '_' + orderNo + '_' + (j.description || '');
                    remoteKeys[key] = true;
                });
                var localOnly = local.filter(function(j){
                    // トヨタの古いゴミ仕訳（警察署単価が誤混入した3,500円以外の仕訳）のみ排除（日産・三菱等の個別単価は保護）
                    var isToyotaDesc = j.description && (j.description.includes('トヨタ') || j.description.includes('WEST') || j.description.includes('キャラット'));
                    if (isToyotaDesc && j.description.includes('車庫証明(OSS)') && Number(j.amount) !== 3500) {
                        return false;
                    }
                    if (j.id && remoteKeys[j.id]) return false;
                    if (j.caseId && remoteKeys['case_' + j.caseId]) return false;
                    var orderNo = j.orderNo || (j.description && j.description.match(/\[注:([^\]]+)\]/)?.[1]) || '';
                    var key = (j.date || '') + '_' + (j.debit || '') + '_' + (j.credit || '') + '_' + (j.amount || 0) + '_' + orderNo + '_' + (j.description || '');
                    return !remoteKeys[key];
                });
                var merged = data.journals.concat(localOnly);
                // 重複排除を保存前に実行
                var seenKeys = new Map();
                var deduplicated = [];
                merged.forEach(function(j) {
                    var key = (j.id ? 'id_' + j.id : '') + '_' + (j.date || '') + '_' + (j.debit || '') + '_' + (j.credit || '') + '_' + (j.amount || 0) + '_' + (j.orderNo || '') + '_' + (j.caseId || '');
                    if (!seenKeys.has(key)) {
                        seenKeys.set(key, true);
                        deduplicated.push(j);
                    }
                });

                // 容量オーバーセーフセーブ
                try {
                    localStorage.setItem('gyosei_journals', JSON.stringify(deduplicated));
                } catch (quotaErr) {
                    console.warn('[Sync] Quota exceeded on gyosei_journals. Pruning and saving recent journals.');
                    try { localStorage.removeItem('gyosei_archived_cases'); } catch(e){}
                    try { localStorage.removeItem('gyosei_temp_doc'); } catch(e){}
                    // 直近600件にスリム化して安全保存
                    var recent = deduplicated.slice(-600);
                    try {
                        localStorage.setItem('gyosei_journals', JSON.stringify(recent));
                    } catch(e2) {
                        localStorage.setItem('gyosei_journals', JSON.stringify(recent.slice(-300)));
                    }
                }
                if (typeof Accounting !== 'undefined' && typeof Accounting.cleanDuplicates === 'function') {
                    Accounting.cleanDuplicates(true); // 自動同期時はトースト通知を出さずにサイレント実行
                }
            }

            // カレンダー予定データを localStorage にマージ保存
            if (data.events && Array.isArray(data.events)) {
                const localEvents = Store.getEvents();
                const knownIds = new Set(localEvents.filter(e => e.calendarEventId).map(e => e.calendarEventId));
                // タイトル＋日付の組み合わせでも重複チェック（手動追加分との重複防止）
                const knownTitleDate = new Set(localEvents.map(e => {
                    const t = (e.title || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim();
                    return t + '|' + (e.date || '');
                }));
                data.events.forEach(ge => {
                    if (knownIds.has(ge.calendarEventId)) return;
                    // タイトル＋日付が既存と一致する場合もスキップ
                    const cleanTitle = (ge.title || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim();
                    if (knownTitleDate.has(cleanTitle + '|' + (ge.date || ''))) return;
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
                });
            }

            // 版番号（revs）の更新
            if (data.revs) {
                const mergedRevs = Object.assign({}, knownRevs || {}, data.revs);
                this.saveRevs(mergedRevs);
            }
            if (!isDiff) {
                localStorage.setItem(this.LAST_FULL_SYNC_KEY, String(Date.now()));
            }

            // 同期日時を記録
            this.saveConfig({
                ...this.getConfig(),
                lastSync: data.syncedAt || new Date().toISOString(),
            });

            return {
                isDiff: isDiff,
                customers: data.customers ? data.customers.length : null,
                staff: data.staff ? data.staff.length : null,
                cases: data.cases ? data.cases.length : null,
                journals: data.journals ? data.journals.length : null,
                inbox: data.inbox ? data.inbox.length : null,
                locations: data.locations ? data.locations.length : null,
                clientContacts: data.clientContacts ? data.clientContacts.length : null,
                events: (data.events || []).length,
                unchanged: data.unchanged || [],
                casesPartial: !!data.casesPartial,
                failed: data._failed || [],
                syncedAt: data.syncedAt,
            };

        } catch (err) {
            console.error('同期エラー:', err);
            throw err;
        }
    },

    async push(action, data) {
        const url = this.getGasUrl();
        if (!url) return null;  // 未設定なら何もしない

        const config = this.getConfig();
        const payload = {
            action,
            data,
            lineToken: config.lineToken || '',
            lineUserId: config.lineUserId || '',
            lineNotifyCase: !!config.lineNotifyCase,
            lineNotifyInbox: !!config.lineNotifyInbox
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },  // GAS の CORS 制限回避
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (result.error) {
                console.warn('Push エラー:', result.error);
            }
            return result;

        } catch (err) {
            console.warn('Push 通信エラー:', err);
            return null;  // Push 失敗は致命的ではないので null を返す
        }
    },

    // ---- 接続テスト ----
    async testConnection(url) {
        try {
            const sep = url.includes('?') ? '&' : '?';
            const response = await fetch(url + sep + 'type=customers&t=' + Date.now());
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return {
                success: true,
                customers: (data.customers || []).length,
                staff: (data.staff || []).length,
                locations: (data.locations || []).length,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    // ---- 設定モーダル ----
    showSettingsModal() {
        const config = this.getConfig();
        const currentGasUrl = this.getGasUrl();
        const existing = document.getElementById('syncSettingsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'syncSettingsModal';
        modal.style.display = 'flex';
        modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('syncSettingsModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔄 スプレッドシート連携設定</h2>
          <button class="modal-close" onclick="document.getElementById('syncSettingsModal').remove()">✕</button>
        </div>
        <div class="sync-settings-body">
          <div class="form-group">
            <label>GAS Web App URL <span class="required">*</span></label>
            <input type="url" id="syncGasUrl" class="search-input" 
              placeholder="${this.DEFAULT_GAS_URL}"
              value="${config.gasUrl || currentGasUrl}"
              style="width:100%;margin-top:4px">
            <p class="form-hint">Apps Script のデプロイ URL を入力してください</p>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label>📊 Googleスプレッドシート（原本）のURL</label>
            <input type="url" id="syncSheetUrl" class="search-input" 
              placeholder="https://docs.google.com/spreadsheets/d/xxx/edit"
              value="${config.sheetUrl || ''}"
              style="width:100%;margin-top:4px">
            <p class="form-hint">店舗管理ボタンを押した際に開くスプレッドシートのURL</p>
          </div>

          <!-- 🤖 Gemini API キー (AI OCR・自動解析用) -->
          <div class="form-group" style="margin-top:12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="font-size:0.8rem; font-weight:700; color:var(--accent-gold, #f59e0b);">🔑 Gemini API キー（完全無料・高精度AI OCR用）</label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size:0.72rem; color:var(--accent-gold, #f59e0b); text-decoration:underline;">無料取得↗</a>
            </div>
            <input type="password" id="syncGeminiApiKey" class="search-input" 
              placeholder="AIzaSy... から始まるAPIキーを入力"
              value="${localStorage.getItem('gyosei_gemini_api_key') || ''}"
              style="width:100%;margin-top:4px">
            <p class="form-hint" style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">
              ※ 入力すると横向きFAXや手書き文字も自動で超高精度認識されます。
            </p>
          </div>

          <!-- LINE Messaging API 設定 -->
          <div style="border-top:1px solid var(--border-color);margin-top:16px;padding-top:16px">
            <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--accent-orange);display:flex;align-items:center;gap:6px">💬 LINE Messaging API 連携（Bot通知）</h3>
            <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;line-height:1.4">
              LINE公式アカウントのBot機能経由で、スマートフォンのLINE宛てに業務通知や完了リマインダーをPush送信します。
            </p>
            <div class="form-group">
              <label style="font-size:0.75rem">LINE チャネルアクセストークン</label>
              <input type="password" id="syncLineToken" class="search-input" 
                placeholder="LINE Developersで発行したアクセストークンを入力"
                value="${config.lineToken || ''}"
                style="width:100%;margin-top:2px">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label style="font-size:0.75rem">LINE 送信先ユーザーID (Your User ID)</label>
              <input type="text" id="syncLineUserId" class="search-input" 
                placeholder="Uから始まる32桁のユーザーIDを入力"
                value="${config.lineUserId || ''}"
                style="width:100%;margin-top:2px">
              <p class="form-hint" style="margin-top:4px;font-size:0.68rem;line-height:1.35;color:var(--text-muted)">
                ※ ユーザーIDが不明な場合、友だち追加したBotへスマホから適当な言葉（例:「ID」）を送信後、Googleスプレッドシートの「**操作ログ**」シートを開くと、あなたのユーザーIDが自動で記録されています。
              </p>
            </div>
            
            <!-- 通知項目のオン・オフ切り替え -->
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
              <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--text-color);cursor:pointer">
                <input type="checkbox" id="syncLineNotifyCase" ${config.lineNotifyCase ? 'checked' : ''} style="margin:0">
                <span>案件完了時にお祝い＆売上報告通知を送る</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--text-color);cursor:pointer">
                <input type="checkbox" id="syncLineNotifyInbox" ${config.lineNotifyInbox ? 'checked' : ''} style="margin:0">
                <span>新着資料・FAX受信時に通知を送る</span>
              </label>
            </div>
          </div>

          <div class="form-actions" style="gap:8px">
            <button class="btn btn-secondary" onclick="SpreadsheetSync.onTestConnection()" id="syncTestBtn">
              🔍 接続テスト
            </button>
            <button class="btn btn-primary" onclick="SpreadsheetSync.onSaveSettings()">
              💾 保存
            </button>
          </div>

          <div id="syncTestResult" style="margin-top:12px;display:none"></div>

          ${config.lastSync ? `
            <div class="sync-status-info" style="margin-bottom:8px">
              <span class="detail-icon">⏱️</span>
              最終同期: ${new Date(config.lastSync).toLocaleString('ja-JP')}
            </div>
          ` : ''}

          <div class="sync-status-info" id="idbModalStorageStatus" style="margin-bottom:12px; font-size:0.75rem; color:var(--text-muted);">
            <span class="detail-icon">💾</span>
            ストレージ: 取得中...
          </div>

          <!-- 差分同期・トラブル復旧ツール -->
          <div style="border-top:1px solid var(--border-color);margin-top:16px;padding-top:16px">
            <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--text-color);display:flex;align-items:center;gap:6px">🔄 同期トラブル対応</h3>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;line-height:1.4">
              通常は変更があった差分のみを数秒で高速同期します。<br>
              他端末との表示にズレがある場合や全データを再取得したい場合は、ここから全件同期を実行してください。
            </p>
            <button class="btn btn-secondary" onclick="SpreadsheetSync.forceFullSync()" style="font-size:0.78rem;padding:6px 12px">
              🔄 全件同期をやり直す
            </button>
          </div>

          <!-- 本番移行用メンテナンスツール -->
          <div style="border-top:1px solid var(--border-color);margin-top:16px;padding-top:16px">
            <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--accent-orange);display:flex;align-items:center;gap:6px">⚠️ 本番移行用のデータ初期化</h3>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;line-height:1.4">
              テスト用に登録した「仕訳帳」および「案件データ（進捗、請求、予定、タスク含む）」のみを一括消去します。<br>
              <strong>※ 顧客情報、担当者、店舗/場所マスターは削除されずにそのまま残ります。</strong>
            </p>
            <button class="btn" onclick="Store.clearTestDataForProduction()" style="background-color:#c2410c;color:white;font-size:0.78rem;padding:6px 12px">
              🧹 仕訳・案件データのみ消去
            </button>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(modal);

        // IndexedDB ストレージ容量の非同期表示
        if (typeof IdbStore !== 'undefined' && typeof IdbStore.getStorageEstimate === 'function') {
          IdbStore.getStorageEstimate().then(function(est) {
            var el = document.getElementById('idbModalStorageStatus');
            if (el) {
              el.innerHTML = '<span class="detail-icon">💾</span> ストレージ (IndexedDB): <strong>' + est.usageMB + ' MB</strong> / 上限 <strong>' + est.quotaMB + ' MB</strong> <span style="color:var(--accent-green, #10b981); margin-left:6px; font-weight:600;">● 正常稼働中 (5MB制限解除済)</span>';
            }
          }).catch(function() {});
        }
    },

    async onTestConnection() {
        let url = document.getElementById('syncGasUrl').value.trim();
        if (!url) url = this.getGasUrl();

        const btn = document.getElementById('syncTestBtn');
        btn.disabled = true;
        btn.textContent = '⏳ テスト中...';

        const resultDiv = document.getElementById('syncTestResult');
        resultDiv.style.display = 'block';

        const result = await this.testConnection(url);

        if (result.success) {
            resultDiv.innerHTML = `
        <div class="sync-result success">
          ✅ 接続成功！<br>
          顧客: ${result.customers}件 / 担当者: ${result.staff}件 / 場所: ${result.locations}件
        </div>
      `;
        } else {
            resultDiv.innerHTML = `
        <div class="sync-result error">
          ❌ 接続失敗: ${result.error}
        </div>
      `;
        }

        btn.disabled = false;
        btn.textContent = '🔍 接続テスト';
    },

    onSaveSettings() {
        const url = document.getElementById('syncGasUrl').value.trim();
        const sheetUrl = document.getElementById('syncSheetUrl') ? document.getElementById('syncSheetUrl').value.trim() : '';
        const lineToken = document.getElementById('syncLineToken') ? document.getElementById('syncLineToken').value.trim() : '';
        const lineUserId = document.getElementById('syncLineUserId') ? document.getElementById('syncLineUserId').value.trim() : '';
        const lineNotifyCase = document.getElementById('syncLineNotifyCase') ? document.getElementById('syncLineNotifyCase').checked : false;
        const lineNotifyInbox = document.getElementById('syncLineNotifyInbox') ? document.getElementById('syncLineNotifyInbox').checked : false;
        const geminiApiKey = document.getElementById('syncGeminiApiKey') ? document.getElementById('syncGeminiApiKey').value.trim() : '';
        if (geminiApiKey) {
            localStorage.setItem('gyosei_gemini_api_key', geminiApiKey);
        }
        this.saveConfig({
            ...this.getConfig(),
            gasUrl: url,
            sheetUrl: sheetUrl,
            lineToken: lineToken,
            lineUserId: lineUserId,
            lineNotifyCase: lineNotifyCase,
            lineNotifyInbox: lineNotifyInbox
        });
        document.getElementById('syncSettingsModal').remove();
        App.showToast('連携設定を保存しました');
    },

    // ---- 手動での全件同期やり直し ----
    async forceFullSync() {
        if (!confirm('スプレッドシートから全件のデータを再取得しますか？\n（通常より数秒〜数十秒多くかかります）')) return;
        const modal = document.getElementById('syncSettingsModal');
        if (modal) modal.remove();
        App.showToast('🔄 全件同期中...');
        try {
            const result = await this.pull({ forceFull: true });
            if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.seedPoliceFees === 'function') {
                CaseTemplates.seedPoliceFees();
            }
            App.refreshView();
            App.showToast(`✅ 全件同期完了！ 案件${result.cases || 0}件 / 顧客${result.customers || 0}件 / 帳簿${result.journals || 0}件`);
        } catch (err) {
            App.showToast('❌ 同期エラー: ' + err.message);
        }
    },

    // ---- ワンクリック同期 ----
    async syncNow() {
        if (!this.isConfigured()) {
            this.showSettingsModal();
            return;
        }

        App.showToast('🔄 同期中...');

        try {
            const result = await this.pull();
            if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.seedPoliceFees === 'function') {
                CaseTemplates.seedPoliceFees();
            }
            App.refreshView();

            if (result.isDiff) {
                const updatedCount = (result.cases !== null ? result.cases : 0) +
                                     (result.journals !== null ? result.journals : 0) +
                                     (result.inbox !== null ? result.inbox : 0) +
                                     (result.customers !== null ? result.customers : 0);
                if (updatedCount === 0 && (!result.failed || result.failed.length === 0)) {
                    App.showToast(`✅ 同期完了：すべて最新です（${result.unchanged.length}種確認済）`);
                } else {
                    App.showToast(`✅ 差分同期完了！ 案件${result.cases || 0}件 / 帳簿${result.journals || 0}件 / インボックス${result.inbox || 0}件`
                        + (result.unchanged.length ? `（変更なし: ${result.unchanged.length}種）` : '')
                        + (result.failed && result.failed.length ? ` （⚠️一部未取得: ${result.failed.join(', ')}）` : ''));
                }
            } else {
                App.showToast(`✅ 全件同期完了！ 顧客${result.customers || 0}件 / 担当者${result.staff || 0}件 / 場所${result.locations || 0}件 / 案件${result.cases || 0}件 / 帳簿${result.journals || 0}件`
                    + (result.failed && result.failed.length ? ` （⚠️一部未取得: ${result.failed.join(', ')}）` : ''));
            }
        } catch (err) {
            App.showToast('❌ 同期エラー: ' + err.message);
        }
    },

    // ---- 請求書PDF → Drive保存 ----
    async pushInvoice(html, invoiceNo, clientName, docType) {
        const url = this.getGasUrl();
        if (!url) return null;  // 未設定なら何もしない

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'saveInvoicePdf',
                    data: { html, invoiceNo, clientName, docType: docType || '請求書' },
                }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn('Drive保存エラー:', result.error);
                return null;
            }
            return result;

        } catch (err) {
            console.warn('Drive保存通信エラー:', err);
            return null;
        }
    },

    // ---- Google Apps Script 汎用通信送信 ----
    async postToGas(action, data) {
        const url = this.getGasUrl();
        if (!url) return null;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action, data }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn(`${action} 同期エラー:`, result.error);
            }
            return result;

        } catch (err) {
            console.warn(`${action} 通信エラー:`, err);
            return null;
        }
    },

    // バックワード互換性のためのエイリアス
    async pushCalendarEvent(action, data) {
        return this.postToGas(action, data);
    },

    async pullCalendarEvents() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        try {
            const response = await fetch(url + '?type=events&daysBack=7&daysForward=90');
            if (!response.ok) throw new Error('通信エラー: ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return data.events || [];

        } catch (err) {
            console.error('カレンダー取得エラー:', err);
            throw err;
        }
    },

    // ---- インボックス未送信キュー管理（オフライン・通信断でもステータス変更を絶対に失わない）----
    getPendingInboxQueue() {
        try {
            return JSON.parse(localStorage.getItem(this.INBOX_QUEUE_KEY)) || {};
        } catch (e) {
            return {};
        }
    },

    savePendingInboxQueue(queue) {
        try {
            localStorage.setItem(this.INBOX_QUEUE_KEY, JSON.stringify(queue || {}));
        } catch (e) {}
    },

    recordPendingInboxUpdate(item) {
        if (!item || !item.id) return;
        const queue = this.getPendingInboxQueue();
        queue[String(item.id)] = {
            item: { ...item, status: String(item.status || '未対応').trim() },
            updatedAt: Date.now()
        };
        this.savePendingInboxQueue(queue);
    },

    removePendingInboxUpdate(itemId) {
        if (!itemId) return;
        const queue = this.getPendingInboxQueue();
        const sId = String(itemId);
        if (queue[sId]) {
            delete queue[sId];
            this.savePendingInboxQueue(queue);
        }
    },

    // インボックスのステータス変更を即座にプッシュ（失敗時はキューに保持して次回自動再送）
    async pushInboxUpdate(item) {
        if (!item || !item.id) return null;
        this.recordPendingInboxUpdate(item);

        if (!this.isConfigured()) return null;

        try {
            const result = await this.push('upsertInboxItem', item);
            if (result && result.success) {
                this.removePendingInboxUpdate(item.id);
                return result;
            } else {
                console.warn('[pushInboxUpdate] GAS応答で失敗（キューに保持）:', result);
                return null;
            }
        } catch (err) {
            console.warn('[pushInboxUpdate] 通信エラー（キューに保持し次回同期時に再送）:', err);
            return null;
        }
    },

    // 未送信のインボックス更新をスプレッドシートへ一括再送
    async flushPendingInboxQueue() {
        if (!this.isConfigured()) return;
        const queue = this.getPendingInboxQueue();
        const ids = Object.keys(queue);
        if (ids.length === 0) return;

        console.log(`[SpreadsheetSync] 未送信インボックス更新を再送中: ${ids.length}件`);
        for (const id of ids) {
            const entry = queue[id];
            if (!entry || !entry.item) {
                delete queue[id];
                continue;
            }
            try {
                const res = await this.push('upsertInboxItem', entry.item);
                if (res && res.success) {
                    delete queue[id];
                }
            } catch (e) {
                console.warn(`[SpreadsheetSync] 再送一時失敗 (${id}):`, e);
                break; // 通信不通時は無理にループせず次回に持ち越す
            }
        }
        this.savePendingInboxQueue(queue);
    },

    // インボックスデータの確定マージ（スプレッドシートを正とするSSOT + ゾンビデータ自動消去）
    mergeInboxData(remoteInbox) {
        if (!remoteInbox || !Array.isArray(remoteInbox)) {
            return (typeof Store !== 'undefined' && Store.getInbox) ? Store.getInbox() : [];
        }

        const localInbox = (typeof Store !== 'undefined' && Store.getInbox) ? Store.getInbox() : [];
        const pendingQueue = this.getPendingInboxQueue();
        const mergedMap = new Map();

        // ★同一IDの重複行対策: 処理済みステータスを優先（重複の片方だけ「未対応」で残っても復活させない）
        const statusRank = (s) => {
            const st = String(s || '未対応').trim();
            if (st === '対応済') return 3;
            if (st === '除外') return 2;
            if (st === '保留') return 1;
            return 0;
        };
        const dedupedRemote = new Map();
        remoteInbox.forEach(r => {
            if (!r || !r.id) return;
            const k = String(r.id);
            const prev = dedupedRemote.get(k);
            if (!prev || statusRank(r.status) > statusRank(prev.status)) {
                dedupedRemote.set(k, r);
            }
        });

        // 1. スプレッドシート（リモート）にあるアイテムをベースに構築
        dedupedRemote.forEach(remoteItem => {
            if (!remoteItem || !remoteItem.id) return;
            const sId = String(remoteItem.id);
            const pending = pendingQueue[sId];

            if (pending && pending.item) {
                // ローカルで変更済みかつ未プッシュの最新ステータスを一時的に優先保護
                mergedMap.set(sId, {
                    ...remoteItem,
                    ...pending.item,
                    status: String(pending.item.status || remoteItem.status || '未対応').trim(),
                    caseId: pending.item.caseId !== undefined ? pending.item.caseId : (remoteItem.caseId || '')
                });
            } else {
                // リモートが真実のマスター
                const localItem = localInbox.find(l => String(l.id) === sId);
                const sStatus = String(remoteItem.status || '未対応').trim();
                let body = remoteItem.body || '';
                // 容量節約: 対応済や除外済みの過去データは本文が長大な場合に100文字に軽量化
                if ((sStatus === '対応済' || sStatus === '除外') && body.length > 100) {
                    body = body.slice(0, 100) + '...';
                }
                mergedMap.set(sId, {
                    ...remoteItem,
                    body: body,
                    status: sStatus,
                    caseId: remoteItem.caseId || (localItem && localItem.caseId) || '',
                    // 添付ファイルがリモートでパース前文字列や空配列でもローカルに原本があれば保護
                    attachments: remoteItem.attachments || (localItem && localItem.attachments) || []
                });
            }
        });

        // 2. ローカルにしか存在しないアイテムの扱い:
        // 「未送信キューにあるもの（ローカルで新規作成されたばかりのアイテム）」のみ保持。
        // スプレッドシート側で削除・整理されたゾンビデータはここで完全に消滅します。
        Object.keys(pendingQueue).forEach(pId => {
            if (!mergedMap.has(pId)) {
                const pEntry = pendingQueue[pId];
                if (pEntry && pEntry.item) {
                    mergedMap.set(pId, pEntry.item);
                }
            }
        });

        const mergedInbox = Array.from(mergedMap.values());

        if (typeof Store !== 'undefined' && Store._set && Store.KEYS && Store.KEYS.INBOX) {
            Store._set(Store.KEYS.INBOX, mergedInbox);
        } else {
            localStorage.setItem('gyosei_inbox', JSON.stringify(mergedInbox));
        }
        return mergedInbox;
    },

    // インボックス単体のみを高速同期（全テーブル読み込みをスキップして0.3秒で完了）
    async pullInbox() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        try {
            await this.flushPendingInboxQueue();
            const response = await fetch(url + '?type=inbox&t=' + Date.now());
            if (!response.ok) throw new Error('通信エラー: ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (typeof CaseSync !== 'undefined' && typeof CaseSync.setState === 'function') {
                CaseSync.setState({ lastPullAt: new Date().toISOString() });
            }
            return this.mergeInboxData(data.inbox || []);
        } catch (err) {
            console.error('インボックス取得エラー:', err);
            throw err;
        }
    },

    // スプレッドシートと強制完全一致（キャッシュ再構築・ゾンビ完全パージ）
    async forceResyncInbox() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        // 1. 先に保留中の変更があれば送信試行
        try {
            await this.flushPendingInboxQueue();
        } catch (e) {}

        // 2. キャッシュ完全回避でスプレッドシートから直接取得
        const response = await fetch(url + '?type=inbox&t=' + Date.now());
        if (!response.ok) throw new Error('通信エラー: ' + response.status);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const remoteInbox = data.inbox || [];
        // 3. マージ処理（スプレッドシートをマスターとし、ゾンビデータを全削除）
        const result = this.mergeInboxData(remoteInbox);

        if (data.faxLog && Array.isArray(data.faxLog)) {
            localStorage.setItem('gyosei_fax_logs', JSON.stringify(data.faxLog));
        }

        if (typeof CaseSync !== 'undefined' && typeof CaseSync.setState === 'function') {
            CaseSync.setState({ lastPullAt: new Date().toISOString() });
        }

        return result;
    }
};

// ネットワーク復帰時に保留キューを自動フラッシュ
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
            SpreadsheetSync.flushPendingInboxQueue().then(() => {
                SpreadsheetSync.pullInbox().then(() => {
                    if (typeof App !== 'undefined' && typeof App.refreshView === 'function') {
                        App.refreshView();
                    }
                }).catch(() => {});
            }).catch(() => {});
        }
    });
}


