/**
 * スプレッドシート同期モジュール
 * Google Apps Script の Web API 経由でスプレッドシートとデータを同期
 */
const SpreadsheetSync = {
    CONFIG_KEY: 'gyosei_sync_settings',
    INBOX_QUEUE_KEY: 'gyosei_inbox_pending_queue',

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

    // ---- データ取得（Pull）----
    async pull() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        // 未送信キューがあれば事前に再送試行
        try {
            await this.flushPendingInboxQueue();
        } catch (e) {
            console.warn('[SpreadsheetSync.pull] キュー自動フラッシュ警告:', e);
        }

        try {
            let data;
            const sep = url.includes('?') ? '&' : '?';
        try {
            const response = await fetch(url + sep + 'type=all&t=' + Date.now());
            if (!response.ok) throw new Error('通信エラー: ' + response.status);

            data = await response.json();
            if (data.error) throw new Error(data.error);
        } catch (allErr) {
            console.warn('[SpreadsheetSync.pull] type=all 通信エラーまたはタイムアウト。個別並行取得へフォールバックします...', allErr);
            // 分割並行取得にフォールバック（Google 30秒タイムアウト対策）
            const chunkTypes = ['customers', 'staff', 'locations', 'clientContacts', 'cases', 'journals', 'inbox', 'events'];
            const chunkResults = await Promise.allSettled(chunkTypes.map(async (t) => {
                const r = await fetch(url + sep + 'type=' + t + '&t=' + Date.now());
                if (!r.ok) return null;
                return r.json();
            }));
            data = { syncedAt: new Date().toISOString() };
            chunkResults.forEach((res, i) => {
                if (res.status === 'fulfilled' && res.value && !res.value.error) {
                    const key = chunkTypes[i];
                    if (res.value[key]) data[key] = res.value[key];
                    if (res.value.syncedAt) data.syncedAt = res.value.syncedAt;
                }
            });
            if (!data.customers && !data.cases && !data.journals) {
                throw allErr;
            }
        }

            // 顧客データを localStorage に保存
            if (data.customers) {
                Store._set(Store.KEYS.CLIENTS, data.customers);
            }

            // 担当者データを localStorage に保存
            if (data.staff) {
                Store._set(Store.KEYS.STAFF, data.staff);
            }

            // 案件データを localStorage に保存
            if (data.cases) {
                // ローカルの案件データから docs 等の失われたくないデータをマージ
                const localCases = Store.getCases();
                
                const mergedCases = data.cases.map(remoteCase => {
                    const localCase = localCases.find(c => c.id === remoteCase.id);
                    
                    // docs のパース（GASから文字列で返ってきた場合）
                    let parsedDocs = remoteCase.docs;
                    if (typeof parsedDocs === 'string') {
                        try { parsedDocs = JSON.parse(parsedDocs); } catch(e) { parsedDocs = null; }
                    }
                    // リモートに docs が無い、または空の場合はローカルを優先
                    if ((!parsedDocs || parsedDocs.length === 0) && localCase && localCase.docs) {
                        parsedDocs = localCase.docs;
                    }

                    // advances のパース
                    let parsedAdvances = remoteCase.advances;
                    if (typeof parsedAdvances === 'string') {
                        try { parsedAdvances = JSON.parse(parsedAdvances); } catch(e) { parsedAdvances = null; }
                    }
                    if ((!parsedAdvances || parsedAdvances.length === 0) && localCase && localCase.advances) {
                        parsedAdvances = localCase.advances;
                    }

                    // familyTreeData のパース
                    let parsedFamilyTree = remoteCase.familyTreeData;
                    if (typeof parsedFamilyTree === 'string') {
                        try { parsedFamilyTree = JSON.parse(parsedFamilyTree); } catch(e) { parsedFamilyTree = null; }
                    }
                    if (!parsedFamilyTree && localCase && localCase.familyTreeData) {
                        parsedFamilyTree = localCase.familyTreeData;
                    }

                    // 車台番号(VIN)と自動車登録番号(ナンバー)のスマート判定とフォールバック
                    let rawCarNum = String(remoteCase.carNumber || remoteCase['自動車登録番号'] || remoteCase['新自動車登録番号'] || remoteCase['登録番号'] || remoteCase['新ナンバー'] || (localCase && localCase.carNumber) || '').trim();
                    let rawOldCarNum = String(remoteCase.oldCarNumber || remoteCase['旧自動車登録番号'] || remoteCase['旧登録番号'] || remoteCase['旧ナンバー'] || (localCase && localCase.oldCarNumber) || '').trim();
                    let rawVin = String(remoteCase.vin || remoteCase['車台番号'] || remoteCase['VIN'] || (localCase && localCase.vin) || '').trim();
                    let rawRegType = String(remoteCase.regType || remoteCase['封印事由'] || remoteCase['登録区分'] || remoteCase['登録種別区分'] || (localCase && localCase.regType) || '').trim();

                    // 車台番号判定（英数字とハイフンのみ、日本語文字なし）
                    const isChassisNum = (str) => Boolean(str && !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(str) && /^[A-Z0-9]+-[A-Z0-9]+$/i.test(str));
                    // ナンバー判定（日本の地域名漢字やひらがなを含む）
                    const isPlateNum = (str) => Boolean(str && /[\u3040-\u30ff\u4e00-\u9fff]/.test(str));

                    // 救済1: vin にナンバーが入っている場合（旧GASで車台番号列にナンバーを保存していたケース）
                    if (!rawCarNum && isPlateNum(rawVin)) {
                        rawCarNum = rawVin;
                        rawVin = (localCase && localCase.vin) || '';
                    }

                    // 救済2: carNumber に車台番号が入っている場合（旧GASで車台番号列がcarNumberにマップされていたケース）
                    if (!rawVin && isChassisNum(rawCarNum)) {
                        rawVin = rawCarNum;
                        rawCarNum = (localCase && localCase.carNumber && !isChassisNum(localCase.carNumber)) ? localCase.carNumber : '';
                    }

                    return {
                        ...remoteCase,
                        orderNo: String(remoteCase.orderNo || remoteCase['注文書№'] || remoteCase['注文書No'] || remoteCase['注文書NO'] || remoteCase['注文番号'] || remoteCase['注文No'] || (localCase && localCase.orderNo) || ''),
                        docs: Array.isArray(parsedDocs) ? parsedDocs : [],
                        advances: Array.isArray(parsedAdvances) ? parsedAdvances : [],
                        clientContactId: remoteCase.clientContactId || (localCase && localCase.clientContactId) || '',
                        locationId: remoteCase.locationId || (localCase && localCase.locationId) || '',
                        faxId: remoteCase.faxId || (localCase && localCase.faxId) || '',
                        inboxId: remoteCase.inboxId || (localCase && localCase.inboxId) || '',
                        driveFolderUrl: remoteCase.driveFolderUrl || (localCase && localCase.driveFolderUrl) || '',
                        carName: remoteCase.carName || (localCase && localCase.carName) || '',
                        carAddress: remoteCase.carAddress || (localCase && localCase.carAddress) || '',
                        parkingAddress: remoteCase.parkingAddress || (localCase && localCase.parkingAddress) || '',
                        carPolice: remoteCase.carPolice || (localCase && localCase.carPolice) || '',
                        carNumber: rawCarNum,
                        oldCarNumber: rawOldCarNum,
                        vin: rawVin,
                        regType: rawRegType,
                        subCategory: remoteCase.subCategory || remoteCase['登録種別'] || (localCase && localCase.subCategory) || '',
                        invoiceNo: remoteCase.invoiceNo || (localCase && localCase.invoiceNo) || '',
                        deathDate: remoteCase.deathDate || (localCase && localCase.deathDate) || '',
                        surveyDate: remoteCase.surveyDate || (localCase && localCase.surveyDate) || '',
                        applyDate: remoteCase.applyDate || (localCase && localCase.applyDate) || '',
                        policeDeliveryDate: remoteCase.policeDeliveryDate || (localCase && localCase.policeDeliveryDate) || '',
                        storeDeliveryDate: remoteCase.storeDeliveryDate || (localCase && localCase.storeDeliveryDate) || '',
                        storeDeliveryTime: remoteCase.storeDeliveryTime || (localCase && localCase.storeDeliveryTime) || '',
                        surveyLocationId: remoteCase.surveyLocationId || (localCase && localCase.surveyLocationId) || '',
                        policeLocationId: remoteCase.policeLocationId || (localCase && localCase.policeLocationId) || '',
                        landTransportLocationId: remoteCase.landTransportLocationId || (localCase && localCase.landTransportLocationId) || '',
                        registrationDate: remoteCase.registrationDate || (localCase && localCase.registrationDate) || '',
                        completedAt: remoteCase.completedAt || remoteCase['螳御ｺ・律'] || (localCase && localCase.completedAt) || '',
                        milestoneIndex: remoteCase.milestoneIndex !== undefined && remoteCase.milestoneIndex !== ''
                            ? Number(remoteCase.milestoneIndex)
                            : (localCase && localCase.milestoneIndex) !== undefined && (localCase && localCase.milestoneIndex) !== ''
                                ? Number(localCase.milestoneIndex)
                                : 0,
                        familyTreeData: parsedFamilyTree || null,
                    };
                });
                
                Store._set(Store.KEYS.CASES, mergedCases);
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

                // ローカルにしか存在しない場所があれば残す
                localLocations.forEach(function(localLoc) {
                    if (localLoc && localLoc.id && !mergedLocations.some(function(m) { return m.id === localLoc.id; })) {
                        mergedLocations.push(localLoc);
                    }
                });

                Store._set(Store.KEYS.LOCATIONS, mergedLocations);

                if (typeof CaseTemplates !== 'undefined' && typeof CaseTemplates.seedPoliceFees === 'function') {
                    CaseTemplates.seedPoliceFees();
                }
            }

            // 顧客担当者データをマージ（ローカル既存データを保持 + ローカルのみのデータをSSへPush）
            {
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
                            else if (j.description.includes('軽自動車登録')) fixed = 3500;
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
                data.events.forEach(ge => {
                    if (knownIds.has(ge.calendarEventId)) return;
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

            // 同期日時を記録
            this.saveConfig({
                ...this.getConfig(),
                lastSync: new Date().toISOString(),
            });

            return {
                customers: (data.customers || []).length,
                staff: (data.staff || []).length,
                cases: (data.cases || []).length,
                journals: (data.journals || []).length,
                inbox: (data.inbox || []).length,
                locations: (data.locations || []).length,
                clientContacts: (data.clientContacts || []).length,
                events: (data.events || []).length,
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
            App.showToast(`✅ 同期完了！ 顧客${result.customers}件 / 担当者${result.staff}件 / 顧客担当者${result.clientContacts || 0}件 / 場所${result.locations}件 / 案件${result.cases}件 / 予定${result.events || 0}件 / インボックス${result.inbox}件 / 帳簿${result.journals}件`);
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

        // 1. スプレッドシート（リモート）にあるアイテムをベースに構築
        remoteInbox.forEach(remoteItem => {
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

