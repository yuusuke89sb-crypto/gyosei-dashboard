/**
 * 相続事件簿 — 独立画面
 * 研修で入手したプロ仕様の管理シートをデジタル化
 */
const InheritanceCasefile = {
  currentView: 'list',  // 'list' | 'detail'
  editingId: null,
  openSections: { sec1: true, sec2: true, sec3: true, sec4: true, sec5: true, sec6: true },

  // ============================================================
  // レンダリング
  // ============================================================
  render() {
    if (this.currentView === 'detail' && this.editingId) {
      return this.renderDetail();
    }
    return this.renderList();
  },

  // ---- 一覧画面 ----
  renderList() {
    const files = Store.getInheritanceFiles();
    const sortedFiles = [...files].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return `
      <div class="inh-page">
        <div class="page-header">
          <h1>📜 相続事件簿</h1>
          <button class="btn btn-primary" onclick="InheritanceCasefile.showCreate()">
            <span class="btn-icon">＋</span> 新規作成
          </button>
        </div>

        ${files.length === 0 ? `
          <div class="inh-empty">
            <div class="inh-empty-icon">📜</div>
            <h3>まだ事件簿がありません</h3>
            <p>「新規作成」ボタンから相続案件の事件簿を作成しましょう</p>
          </div>
        ` : `
          <div class="inh-card-grid">
            ${sortedFiles.map(f => this.renderFileCard(f)).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderFileCard(f) {
    const heirCount = (f.heirs || []).length;
    const bankCount = (f.banks || []).filter(b => b.bankName).length;
    const reCount = (f.realEstateProps || []).filter(r => r.address).length;
    const progress = this.calcProgress(f);
    const linkedCase = f.caseId ? Store.getCase(f.caseId) : null;

    return `
      <div class="inh-card" onclick="InheritanceCasefile.showDetail('${f.id}')">
        <div class="inh-card-header">
          <div class="inh-card-title">
            <span class="inh-card-icon">📜</span>
            <div>
              <div class="inh-card-name">${f.deceasedName || '（被相続人未入力）'}</div>
              <div class="inh-card-sub">${f.deathDate ? '死亡日: ' + f.deathDate : '死亡日未入力'}</div>
            </div>
          </div>
          ${linkedCase ? `<span class="category-tag category-inheritance" style="font-size:0.72rem">🔗 ${linkedCase.title}</span>` : ''}
        </div>
        <div class="inh-card-stats">
          <span>👥 相続人 ${heirCount}名</span>
          <span>🏦 銀行 ${bankCount}行</span>
          <span>🏠 不動産 ${reCount}件</span>
        </div>
        <div class="inh-card-progress">
          <div class="inh-progress-bar">
            <div class="inh-progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="inh-progress-text">${progress}%</span>
        </div>
        <div class="inh-card-footer">
          <span>受任: ${(f.otherInfo && f.otherInfo.acceptDate) || f.createdAt?.slice(0, 10) || '—'}</span>
          <span>更新: ${f.updatedAt?.slice(0, 10) || '—'}</span>
        </div>
      </div>
    `;
  },

  // ---- 進捗計算 ----
  calcProgress(f) {
    let total = 0, done = 0;
    // 相続人の書類チェック（各5項目）
    (f.heirs || []).forEach(h => {
      ['koseki', 'juminhyo', 'inkanShoumei', 'honninKakunin', 'keiyakusho'].forEach(k => {
        total++;
        if (h[k]) done++;
      });
    });
    // 銀行手続き（各3チェック: depositReceive, cancelReceive, balanceCert）
    (f.banks || []).filter(b => b.bankName).forEach(b => {
      total += 3;
      if (b.depositReceive) done++;
      if (b.cancelReceive) done++;
      if (b.balanceCert) done++;
    });
    // 不動産（各5チェック）
    (f.realEstateProps || []).filter(r => r.address).forEach(r => {
      ['nayose', 'hyoukaShoumei', 'toukiBo', 'shihoShoshi', 'isanBunkatsu'].forEach(k => {
        total++;
        if (r[k]) done++;
      });
    });
    // その他チェック（5項目）
    const oi = f.otherInfo || {};
    ['deceasedKoseki', 'kosekiFuhyo', 'joJuminHyo', 'toukiBo', 'shutokuJuminHyo'].forEach(k => {
      total++;
      if (oi[k]) done++;
    });
    // 協議書サイン
    total++;
    if (f.registryInfo && f.registryInfo.agreementSigned) done++;

    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  },

  // ============================================================
  // 詳細画面（書式に沿った入力フォーム）
  // ============================================================
  renderDetail() {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return '<p>データが見つかりません</p>';
    const ai = f.acceptanceInfo || {};
    const ri = f.registryInfo || {};
    const oi = f.otherInfo || {};
    const progress = this.calcProgress(f);
    const cases = Store.getCases().filter(c => c.category === 'inheritance');

    return `
      <div class="inh-page inh-detail-page">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px">
            <button class="btn btn-ghost" onclick="InheritanceCasefile.backToList()" title="一覧に戻る">← 戻る</button>
            <h1 style="font-size:1.2rem">📜 ${f.deceasedName || '新規事件簿'}</h1>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="inh-detail-progress" title="全体進捗 ${progress}%">
              <div class="inh-progress-bar" style="width:120px">
                <div class="inh-progress-fill" style="width:${progress}%"></div>
              </div>
              <span class="inh-progress-text">${progress}%</span>
            </div>
            <button class="btn btn-secondary" onclick="InheritanceCasefile.printFile('${f.id}')" title="印刷">🖨️ 印刷</button>
            <button class="btn btn-danger" onclick="InheritanceCasefile.deleteFile('${f.id}')" title="削除">🗑️</button>
          </div>
        </div>

        <!-- 案件紐付け -->
        <div class="inh-link-bar">
          <label>🔗 案件紐付け:</label>
          <select id="inh_caseId" class="form-select" style="max-width:300px" onchange="InheritanceCasefile.save()">
            <option value="">— 紐付けなし —</option>
            ${cases.map(c => `<option value="${c.id}" ${f.caseId === c.id ? 'selected' : ''}>${c.title}</option>`).join('')}
          </select>
        </div>

        <!-- セクション1: 受任情報 -->
        ${this.renderSection('sec1', '1. 受任情報', `
          <div class="inh-form-grid">
            <div class="inh-field">
              <label>遺言</label>
              <select id="inh_hasWill" onchange="InheritanceCasefile.save()">
                <option value="" ${!ai.hasWill ? 'selected' : ''}>—</option>
                <option value="済" ${ai.hasWill === '済' ? 'selected' : ''}>済（あり）</option>
                <option value="無" ${ai.hasWill === '無' ? 'selected' : ''}>無</option>
              </select>
            </div>
            <div class="inh-field">
              <label>遺言検索</label>
              <label class="inh-check"><input type="checkbox" id="inh_willSearchDone" ${ai.willSearchDone ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 済</label>
            </div>
            <div class="inh-field">
              <label>保険関係確認</label>
              <label class="inh-check"><input type="checkbox" id="inh_insuranceCheck" ${ai.insuranceCheck ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 済</label>
            </div>
            <div class="inh-field">
              <label>委任状日付</label>
              <input type="date" id="inh_powerOfAttorneyDate" value="${ai.powerOfAttorneyDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>報酬額</label>
              <input type="number" id="inh_fee" value="${ai.fee || ''}" placeholder="円" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>報酬受領</label>
              <label class="inh-check"><input type="checkbox" id="inh_feeReceived" ${ai.feeReceived ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 済</label>
            </div>
          </div>
          <div class="inh-form-grid" style="margin-top:12px">
            <div class="inh-field">
              <label>監事報酬</label>
              <input type="number" id="inh_supervisorFee" value="${ai.supervisorFee || ''}" placeholder="円" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>監事委任状日付</label>
              <input type="date" id="inh_supervisorPOADate" value="${ai.supervisorPOADate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>監事提出日</label>
              <input type="date" id="inh_supervisorSubmitDate" value="${ai.supervisorSubmitDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>法定相続委任状日付</label>
              <input type="date" id="inh_legalInfoPOADate" value="${ai.legalInfoPOADate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>法定相続提出日</label>
              <input type="date" id="inh_legalInfoSubmitDate" value="${ai.legalInfoSubmitDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
          </div>
        `)}

        <!-- セクション2: 被相続人・相続人 -->
        ${this.renderSection('sec2', '2. 被相続人・相続人', `
          <div class="inh-form-grid" style="margin-bottom:16px">
            <div class="inh-field" style="flex:2">
              <label>被相続人（名前）</label>
              <input type="text" id="inh_deceasedName" value="${f.deceasedName || ''}" placeholder="例：田中一郎" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>死亡日</label>
              <input type="date" id="inh_deathDate" value="${f.deathDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>死亡届 通数</label>
              <input type="text" id="inh_deathCertCopies" value="${f.deathCertificateCopies || ''}" placeholder="通" onchange="InheritanceCasefile.save()">
            </div>
          </div>

          <div class="inh-subtitle">相続人一覧</div>
          <div class="inh-table-wrap">
            <table class="inh-heirs-table">
              <thead>
                <tr>
                  <th style="min-width:100px">名前</th>
                  <th style="min-width:60px">続柄</th>
                  <th>戸籍</th>
                  <th>住民票</th>
                  <th>印鑑証明</th>
                  <th>本人確認</th>
                  <th style="min-width:120px">振込口座</th>
                  <th>契約書</th>
                  <th>委任状</th>
                  <th style="min-width:100px">メモ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${(f.heirs || []).map((h, i) => `
                  <tr>
                    <td><input type="text" value="${h.name || ''}" data-heir="${i}" data-key="name" onchange="InheritanceCasefile.saveHeir(this)"></td>
                    <td><input type="text" value="${h.relationship || ''}" data-heir="${i}" data-key="relationship" onchange="InheritanceCasefile.saveHeir(this)" style="width:60px"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.koseki ? 'checked' : ''} data-heir="${i}" data-key="koseki" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.juminhyo ? 'checked' : ''} data-heir="${i}" data-key="juminhyo" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.inkanShoumei ? 'checked' : ''} data-heir="${i}" data-key="inkanShoumei" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.honninKakunin ? 'checked' : ''} data-heir="${i}" data-key="honninKakunin" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td><input type="text" value="${h.furikomiKouza || ''}" data-heir="${i}" data-key="furikomiKouza" onchange="InheritanceCasefile.saveHeir(this)" placeholder="口座情報"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.keiyakusho ? 'checked' : ''} data-heir="${i}" data-key="keiyakusho" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td class="inh-td-center"><input type="checkbox" ${h.ininjo ? 'checked' : ''} data-heir="${i}" data-key="ininjo" onchange="InheritanceCasefile.saveHeirCheck(this)"></td>
                    <td><input type="text" value="${h.memo || ''}" data-heir="${i}" data-key="memo" onchange="InheritanceCasefile.saveHeir(this)" placeholder="備考"></td>
                    <td><button class="btn-icon-sm btn-danger-ghost" onclick="InheritanceCasefile.removeHeir(${i})" title="削除">✕</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <button class="btn btn-secondary btn-small" style="margin-top:8px" onclick="InheritanceCasefile.addHeir()">＋ 相続人を追加</button>
        `)}

        <!-- セクション3: 戸籍関連 -->
        ${this.renderSection('sec3', '3. 戸籍関連', `
          <div class="inh-form-grid">
            <div class="inh-field">
              <label>法定相続情報</label>
              <select id="inh_legalInfoStatus" onchange="InheritanceCasefile.save()">
                <option value="" ${!ri.legalInfoStatus ? 'selected' : ''}>—</option>
                <option value="制作中" ${ri.legalInfoStatus === '制作中' ? 'selected' : ''}>制作中</option>
                <option value="完了" ${ri.legalInfoStatus === '完了' ? 'selected' : ''}>完了</option>
              </select>
            </div>
            <div class="inh-field">
              <label>完了月</label>
              <input type="month" id="inh_legalInfoMonth" value="${ri.legalInfoMonth || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>保険証明利用 通数</label>
              <input type="text" id="inh_insuranceCertCopies" value="${ri.insuranceCertCopies || ''}" placeholder="通" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>協議書サイン</label>
              <label class="inh-check"><input type="checkbox" id="inh_agreementSigned" ${ri.agreementSigned ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 済</label>
            </div>
          </div>
        `)}

        <!-- セクション4: 銀行手続き -->
        ${this.renderSection('sec4', '4. 銀行手続き', `
          ${(f.banks || []).map((b, i) => this.renderBankCard(b, i)).join('')}
          ${(f.banks || []).length < 4 ? `
            <button class="btn btn-secondary btn-small" style="margin-top:8px" onclick="InheritanceCasefile.addBank()">＋ 銀行を追加</button>
          ` : `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">※ 最大4行まで</div>`}
        `)}

        <!-- セクション5: 不動産 -->
        ${this.renderSection('sec5', '5. 不動産', `
          ${(f.realEstateProps || []).map((r, i) => this.renderRealEstateCard(r, i)).join('')}
          <button class="btn btn-secondary btn-small" style="margin-top:8px" onclick="InheritanceCasefile.addRealEstate()">＋ 不動産を追加</button>
        `)}

        <!-- セクション6: その他 -->
        ${this.renderSection('sec6', '6. その他', `
          <div class="inh-form-grid">
            <div class="inh-field">
              <label>年金手続</label>
              <select id="inh_pensionType" onchange="InheritanceCasefile.save()">
                <option value="" ${!oi.pensionType ? 'selected' : ''}>—</option>
                <option value="有" ${oi.pensionType === '有' ? 'selected' : ''}>有</option>
                <option value="賃" ${oi.pensionType === '賃' ? 'selected' : ''}>賃</option>
                <option value="未支給" ${oi.pensionType === '未支給' ? 'selected' : ''}>未支給</option>
                <option value="還付" ${oi.pensionType === '還付' ? 'selected' : ''}>還付</option>
              </select>
            </div>
            <div class="inh-field">
              <label>社労士依頼日</label>
              <input type="date" id="inh_sharoushiDate" value="${oi.sharoushiDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>受任日</label>
              <input type="date" id="inh_acceptDate" value="${oi.acceptDate || ''}" onchange="InheritanceCasefile.save()">
            </div>
            <div class="inh-field">
              <label>納品予定</label>
              <input type="date" id="inh_deliveryTarget" value="${oi.deliveryTarget || ''}" onchange="InheritanceCasefile.save()">
            </div>
          </div>
          <div class="inh-subtitle" style="margin-top:16px">書類取得チェック</div>
          <div class="inh-check-grid">
            <label class="inh-check-item"><input type="checkbox" id="inh_deceasedKoseki" ${oi.deceasedKoseki ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 被相続人戸籍</label>
            <label class="inh-check-item"><input type="checkbox" id="inh_kosekiFuhyo" ${oi.kosekiFuhyo ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 戸籍附票</label>
            <label class="inh-check-item"><input type="checkbox" id="inh_joJuminHyo" ${oi.joJuminHyo ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 除住民票</label>
            <label class="inh-check-item"><input type="checkbox" id="inh_otherToukiBo" ${oi.toukiBo ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 登記簿</label>
            <label class="inh-check-item"><input type="checkbox" id="inh_shutokuJuminHyo" ${oi.shutokuJuminHyo ? 'checked' : ''} onchange="InheritanceCasefile.save()"> 取得者住民票</label>
          </div>
          <div class="inh-field" style="margin-top:12px">
            <label>メモ</label>
            <textarea id="inh_otherMemo" rows="3" onchange="InheritanceCasefile.save()" placeholder="案件に関する自由メモ...">${oi.memo || ''}</textarea>
          </div>
        `)}
      </div>
    `;
  },

  // ---- セクション（アコーディオン） ----
  renderSection(key, title, content) {
    const isOpen = this.openSections[key] !== false;
    return `
      <div class="inh-section ${isOpen ? 'open' : ''}">
        <div class="inh-section-header" onclick="InheritanceCasefile.toggleSection('${key}')">
          <span class="inh-section-arrow">${isOpen ? '▼' : '▶'}</span>
          <span class="inh-section-title">${title}</span>
        </div>
        <div class="inh-section-body" style="${isOpen ? '' : 'display:none'}">
          ${content}
        </div>
      </div>
    `;
  },

  toggleSection(key) {
    this.openSections[key] = !this.openSections[key];
    App.refreshView();
  },

  // ---- 銀行カード ----
  renderBankCard(b, idx) {
    return `
      <div class="inh-bank-card">
        <div class="inh-bank-header">
          <span class="inh-bank-num">🏦 銀行${idx + 1}</span>
          <button class="btn-icon-sm btn-danger-ghost" onclick="InheritanceCasefile.removeBank(${idx})" title="削除">✕</button>
        </div>
        <div class="inh-form-grid">
          <div class="inh-field" style="flex:2">
            <label>銀行名</label>
            <input type="text" value="${b.bankName || ''}" data-bank="${idx}" data-key="bankName" onchange="InheritanceCasefile.saveBank(this)" placeholder="例：三菱UFJ銀行">
          </div>
          <div class="inh-field">
            <label>支店名</label>
            <input type="text" value="${b.branchName || ''}" data-bank="${idx}" data-key="branchName" onchange="InheritanceCasefile.saveBank(this)" placeholder="例：一宮支店">
          </div>
        </div>
        <div class="inh-form-grid" style="margin-top:8px">
          <div class="inh-field">
            <label>預金申請</label>
            <input type="date" value="${b.depositApply || ''}" data-bank="${idx}" data-key="depositApply" onchange="InheritanceCasefile.saveBank(this)">
          </div>
          <div class="inh-field">
            <label>預金受領</label>
            <input type="date" value="${b.depositReceive || ''}" data-bank="${idx}" data-key="depositReceive" onchange="InheritanceCasefile.saveBank(this)">
          </div>
          <div class="inh-field">
            <label>解約申請</label>
            <input type="date" value="${b.cancelApply || ''}" data-bank="${idx}" data-key="cancelApply" onchange="InheritanceCasefile.saveBank(this)">
          </div>
          <div class="inh-field">
            <label>解約受領</label>
            <input type="date" value="${b.cancelReceive || ''}" data-bank="${idx}" data-key="cancelReceive" onchange="InheritanceCasefile.saveBank(this)">
          </div>
        </div>
        <div class="inh-form-grid" style="margin-top:8px">
          <div class="inh-field" style="flex:2">
            <label>預り物</label>
            <input type="text" value="${b.custody || ''}" data-bank="${idx}" data-key="custody" onchange="InheritanceCasefile.saveBank(this)" placeholder="例：通帳, 印鑑, カード">
          </div>
          <div class="inh-field">
            <label>枚数</label>
            <input type="text" value="${b.custodyCount || ''}" data-bank="${idx}" data-key="custodyCount" onchange="InheritanceCasefile.saveBank(this)" placeholder="枚/冊">
          </div>
          <div class="inh-field">
            <label>残高証明</label>
            <label class="inh-check"><input type="checkbox" ${b.balanceCert ? 'checked' : ''} data-bank="${idx}" data-key="balanceCert" onchange="InheritanceCasefile.saveBankCheck(this)"> 取得済</label>
          </div>
        </div>
      </div>
    `;
  },

  // ---- 不動産カード ----
  renderRealEstateCard(r, idx) {
    return `
      <div class="inh-re-card">
        <div class="inh-re-header">
          <span class="inh-re-num">🏠 不動産${idx + 1}</span>
          <button class="btn-icon-sm btn-danger-ghost" onclick="InheritanceCasefile.removeRealEstate(${idx})" title="削除">✕</button>
        </div>
        <div class="inh-field" style="margin-bottom:8px">
          <label>所在地</label>
          <input type="text" value="${r.address || ''}" data-re="${idx}" data-key="address" onchange="InheritanceCasefile.saveRealEstate(this)" placeholder="例：愛知県一宮市...">
        </div>
        <div class="inh-check-grid">
          <label class="inh-check-item"><input type="checkbox" ${r.nayose ? 'checked' : ''} data-re="${idx}" data-key="nayose" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 名寄せ</label>
          <label class="inh-check-item"><input type="checkbox" ${r.hyoukaShoumei ? 'checked' : ''} data-re="${idx}" data-key="hyoukaShoumei" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 評価証明</label>
          <label class="inh-check-item"><input type="checkbox" ${r.toukiBo ? 'checked' : ''} data-re="${idx}" data-key="toukiBo" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 登記簿</label>
          <label class="inh-check-item"><input type="checkbox" ${r.shihoShoshi ? 'checked' : ''} data-re="${idx}" data-key="shihoShoshi" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 司法書士</label>
          <label class="inh-check-item"><input type="checkbox" ${r.zeiRishi ? 'checked' : ''} data-re="${idx}" data-key="zeiRishi" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 税理士</label>
          <label class="inh-check-item"><input type="checkbox" ${r.isanBunkatsu ? 'checked' : ''} data-re="${idx}" data-key="isanBunkatsu" onchange="InheritanceCasefile.saveRealEstateCheck(this)"> 遺産分割協議書</label>
        </div>
      </div>
    `;
  },

  // ============================================================
  // アクション
  // ============================================================
  showCreate() {
    const today = Store.getLocalDateStr();
    const file = Store.addInheritanceFile({
      heirs: [{ name: '', relationship: '' }],
      banks: [{ bankName: '' }],
      realEstateProps: [],
      otherInfo: { acceptDate: today },
    });
    this.editingId = file.id;
    this.currentView = 'detail';
    App.refreshView();
    App.showToast('新しい事件簿を作成しました');
  },

  showDetail(id) {
    this.editingId = id;
    this.currentView = 'detail';
    App.refreshView();
  },

  backToList() {
    this.editingId = null;
    this.currentView = 'list';
    App.refreshView();
  },

  deleteFile(id) {
    if (!confirm('この事件簿を削除してもよろしいですか？')) return;
    Store.deleteInheritanceFile(id);
    this.backToList();
    App.showToast('事件簿を削除しました');
  },

  // ============================================================
  // 保存（即座にlocalStorageへ反映 — ページ再描画なし）
  // ============================================================
  save() {
    if (!this.editingId) return;
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;

    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const chk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

    const data = {
      caseId: val('inh_caseId'),
      deceasedName: val('inh_deceasedName'),
      deathDate: val('inh_deathDate'),
      deathCertificateCopies: val('inh_deathCertCopies'),
      acceptanceInfo: {
        hasWill: val('inh_hasWill'),
        willSearchDone: chk('inh_willSearchDone'),
        insuranceCheck: chk('inh_insuranceCheck'),
        powerOfAttorneyDate: val('inh_powerOfAttorneyDate'),
        fee: val('inh_fee'),
        feeReceived: chk('inh_feeReceived'),
        supervisorFee: val('inh_supervisorFee'),
        supervisorPOADate: val('inh_supervisorPOADate'),
        supervisorSubmitDate: val('inh_supervisorSubmitDate'),
        legalInfoPOADate: val('inh_legalInfoPOADate'),
        legalInfoSubmitDate: val('inh_legalInfoSubmitDate'),
      },
      registryInfo: {
        legalInfoStatus: val('inh_legalInfoStatus'),
        legalInfoMonth: val('inh_legalInfoMonth'),
        insuranceCertCopies: val('inh_insuranceCertCopies'),
        agreementSigned: chk('inh_agreementSigned'),
      },
      otherInfo: {
        pensionType: val('inh_pensionType'),
        sharoushiDate: val('inh_sharoushiDate'),
        acceptDate: val('inh_acceptDate'),
        deliveryTarget: val('inh_deliveryTarget'),
        deceasedKoseki: chk('inh_deceasedKoseki'),
        kosekiFuhyo: chk('inh_kosekiFuhyo'),
        joJuminHyo: chk('inh_joJuminHyo'),
        toukiBo: chk('inh_otherToukiBo'),
        shutokuJuminHyo: chk('inh_shutokuJuminHyo'),
        memo: val('inh_otherMemo'),
      },
    };

    Store.updateInheritanceFile(this.editingId, data);
  },

  // ---- 相続人の行内保存 ----
  saveHeir(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.heir);
    const key = el.dataset.key;
    const heirs = [...(f.heirs || [])];
    if (!heirs[idx]) return;
    heirs[idx] = { ...heirs[idx], [key]: el.value };
    Store.updateInheritanceFile(this.editingId, { heirs });
  },

  saveHeirCheck(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.heir);
    const key = el.dataset.key;
    const heirs = [...(f.heirs || [])];
    if (!heirs[idx]) return;
    heirs[idx] = { ...heirs[idx], [key]: el.checked };
    Store.updateInheritanceFile(this.editingId, { heirs });
  },

  addHeir() {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const heirs = [...(f.heirs || []), { name: '', relationship: '' }];
    Store.updateInheritanceFile(this.editingId, { heirs });
    App.refreshView();
  },

  removeHeir(idx) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const heirs = [...(f.heirs || [])];
    heirs.splice(idx, 1);
    Store.updateInheritanceFile(this.editingId, { heirs });
    App.refreshView();
  },

  // ---- 銀行の行内保存 ----
  saveBank(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.bank);
    const key = el.dataset.key;
    const banks = [...(f.banks || [])];
    if (!banks[idx]) return;
    banks[idx] = { ...banks[idx], [key]: el.value };
    Store.updateInheritanceFile(this.editingId, { banks });
  },

  saveBankCheck(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.bank);
    const key = el.dataset.key;
    const banks = [...(f.banks || [])];
    if (!banks[idx]) return;
    banks[idx] = { ...banks[idx], [key]: el.checked };
    Store.updateInheritanceFile(this.editingId, { banks });
  },

  addBank() {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const banks = [...(f.banks || [])];
    if (banks.length >= 4) return;
    banks.push({ bankName: '' });
    Store.updateInheritanceFile(this.editingId, { banks });
    App.refreshView();
  },

  removeBank(idx) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const banks = [...(f.banks || [])];
    banks.splice(idx, 1);
    Store.updateInheritanceFile(this.editingId, { banks });
    App.refreshView();
  },

  // ---- 不動産の行内保存 ----
  saveRealEstate(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.re);
    const key = el.dataset.key;
    const props = [...(f.realEstateProps || [])];
    if (!props[idx]) return;
    props[idx] = { ...props[idx], [key]: el.value };
    Store.updateInheritanceFile(this.editingId, { realEstateProps: props });
  },

  saveRealEstateCheck(el) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const idx = Number(el.dataset.re);
    const key = el.dataset.key;
    const props = [...(f.realEstateProps || [])];
    if (!props[idx]) return;
    props[idx] = { ...props[idx], [key]: el.checked };
    Store.updateInheritanceFile(this.editingId, { realEstateProps: props });
  },

  addRealEstate() {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const props = [...(f.realEstateProps || []), { address: '' }];
    Store.updateInheritanceFile(this.editingId, { realEstateProps: props });
    App.refreshView();
  },

  removeRealEstate(idx) {
    const f = Store.getInheritanceFile(this.editingId);
    if (!f) return;
    const props = [...(f.realEstateProps || [])];
    props.splice(idx, 1);
    Store.updateInheritanceFile(this.editingId, { realEstateProps: props });
    App.refreshView();
  },

  // ============================================================
  // 印刷
  // ============================================================
  printFile(id) {
    const f = Store.getInheritanceFile(id);
    if (!f) return;
    const ai = f.acceptanceInfo || {};
    const ri = f.registryInfo || {};
    const oi = f.otherInfo || {};
    const chk = (v) => v ? '☑' : '☐';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>相続事件簿 — ${f.deceasedName || '未入力'}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Noto Sans JP', sans-serif; font-size:11px; padding:20px; color:#000; }
          h1 { font-size:16px; text-align:center; margin-bottom:12px; border-bottom:2px solid #000; padding-bottom:6px; }
          .section { margin-bottom:14px; }
          .section h2 { font-size:12px; background:#f0f0f0; padding:4px 8px; border-left:3px solid #333; margin-bottom:6px; }
          table { width:100%; border-collapse:collapse; font-size:10px; }
          th, td { border:1px solid #999; padding:3px 6px; }
          th { background:#f5f5f5; font-weight:600; }
          .info-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:4px 12px; font-size:10px; }
          .info-item { display:flex; gap:4px; }
          .info-label { font-weight:600; min-width:80px; }
          @media print { body { padding:10px; } }
        </style>
      </head>
      <body>
        <h1>📜 相続事件簿</h1>

        <div class="section">
          <h2>1. 受任情報</h2>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">遺言:</span>${ai.hasWill || '—'}</div>
            <div class="info-item"><span class="info-label">遺言検索:</span>${chk(ai.willSearchDone)}</div>
            <div class="info-item"><span class="info-label">保険確認:</span>${chk(ai.insuranceCheck)}</div>
            <div class="info-item"><span class="info-label">委任状日付:</span>${ai.powerOfAttorneyDate || '—'}</div>
            <div class="info-item"><span class="info-label">報酬:</span>${ai.fee ? Number(ai.fee).toLocaleString() + '円' : '—'}</div>
            <div class="info-item"><span class="info-label">報酬受領:</span>${chk(ai.feeReceived)}</div>
          </div>
        </div>

        <div class="section">
          <h2>2. 被相続人・相続人</h2>
          <div class="info-grid" style="margin-bottom:6px">
            <div class="info-item"><span class="info-label">被相続人:</span>${f.deceasedName || '—'}</div>
            <div class="info-item"><span class="info-label">死亡日:</span>${f.deathDate || '—'}</div>
            <div class="info-item"><span class="info-label">死亡届:</span>${f.deathCertificateCopies || '—'} 通</div>
          </div>
          <table>
            <thead><tr><th>名前</th><th>続柄</th><th>戸籍</th><th>住民票</th><th>印鑑証明</th><th>本人確認</th><th>口座</th><th>契約書</th><th>委任状</th></tr></thead>
            <tbody>
              ${(f.heirs || []).map(h => `
                <tr>
                  <td>${h.name || ''}</td><td>${h.relationship || ''}</td>
                  <td style="text-align:center">${chk(h.koseki)}</td><td style="text-align:center">${chk(h.juminhyo)}</td>
                  <td style="text-align:center">${chk(h.inkanShoumei)}</td><td style="text-align:center">${chk(h.honninKakunin)}</td>
                  <td>${h.furikomiKouza || ''}</td>
                  <td style="text-align:center">${chk(h.keiyakusho)}</td><td style="text-align:center">${chk(h.ininjo)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>3. 戸籍関連</h2>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">法定相続情報:</span>${ri.legalInfoStatus || '—'}</div>
            <div class="info-item"><span class="info-label">完了月:</span>${ri.legalInfoMonth || '—'}</div>
            <div class="info-item"><span class="info-label">保険証明:</span>${ri.insuranceCertCopies || '—'} 通</div>
            <div class="info-item"><span class="info-label">協議書サイン:</span>${chk(ri.agreementSigned)}</div>
          </div>
        </div>

        <div class="section">
          <h2>4. 銀行手続き</h2>
          <table>
            <thead><tr><th>銀行名</th><th>支店</th><th>預金申請</th><th>受領</th><th>解約申請</th><th>受領</th><th>預り物</th><th>残高証明</th></tr></thead>
            <tbody>
              ${(f.banks || []).map(b => `
                <tr>
                  <td>${b.bankName || ''}</td><td>${b.branchName || ''}</td>
                  <td>${b.depositApply || ''}</td><td>${b.depositReceive || ''}</td>
                  <td>${b.cancelApply || ''}</td><td>${b.cancelReceive || ''}</td>
                  <td>${b.custody || ''} ${b.custodyCount || ''}</td>
                  <td style="text-align:center">${chk(b.balanceCert)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>5. 不動産</h2>
          <table>
            <thead><tr><th>所在地</th><th>名寄せ</th><th>評価証明</th><th>登記簿</th><th>司法書士</th><th>税理士</th><th>分割協議書</th></tr></thead>
            <tbody>
              ${(f.realEstateProps || []).map(r => `
                <tr>
                  <td>${r.address || ''}</td>
                  <td style="text-align:center">${chk(r.nayose)}</td><td style="text-align:center">${chk(r.hyoukaShoumei)}</td>
                  <td style="text-align:center">${chk(r.toukiBo)}</td><td style="text-align:center">${chk(r.shihoShoshi)}</td>
                  <td style="text-align:center">${chk(r.zeiRishi)}</td><td style="text-align:center">${chk(r.isanBunkatsu)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>6. その他</h2>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">年金手続:</span>${oi.pensionType || '—'}</div>
            <div class="info-item"><span class="info-label">社労士依頼日:</span>${oi.sharoushiDate || '—'}</div>
            <div class="info-item"><span class="info-label">受任日:</span>${oi.acceptDate || '—'}</div>
            <div class="info-item"><span class="info-label">納品予定:</span>${oi.deliveryTarget || '—'}</div>
          </div>
          <div style="margin-top:6px;font-size:10px">
            ${chk(oi.deceasedKoseki)} 被相続人戸籍　${chk(oi.kosekiFuhyo)} 戸籍附票　${chk(oi.joJuminHyo)} 除住民票　${chk(oi.toukiBo)} 登記簿　${chk(oi.shutokuJuminHyo)} 取得者住民票
          </div>
          ${oi.memo ? `<div style="margin-top:6px;border:1px solid #ccc;padding:4px;font-size:10px;white-space:pre-wrap">${oi.memo}</div>` : ''}
        </div>

        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `;
    const w = window.open('', '_blank');
    w.document.write(printHtml);
    w.document.close();
  },
};
