// 行政書士AIボット - PDF書類生成エンジン（HTML→印刷方式）
class PDFGenerator {
    constructor() {
        this.loaded = true; // jsPDFは不要、ブラウザ印刷を使用
    }

    // ===== テンプレート定義：フィールドのキーマッピング =====
    static TEMPLATES = {
        inheritance_agreement: {
            title: '遺産分割協議書',
            build: (d) => `
        <h1 class="doc-title">遺産分割協議書</h1>
        <div class="doc-body">
          <p>被相続人 <b>${d['被相続人名'] || '＿＿＿＿＿'}</b>（${d['死亡日'] || '令和＿年＿月＿日'}死亡）の遺産について、共同相続人全員で協議を行い、以下のとおり遺産を分割することに合意した。</p>
          <div class="info-block">
            <div class="info-row"><span class="label">被相続人</span><span>${d['被相続人名'] || '　'}</span></div>
            <div class="info-row"><span class="label">死亡日</span><span>${d['死亡日'] || '　'}</span></div>
            <div class="info-row"><span class="label">本籍地</span><span>${d['本籍地'] || '　'}</span></div>
            <div class="info-row"><span class="label">最後の住所</span><span>${d['最後の住所'] || '　'}</span></div>
          </div>
          <h3>第1条（遺産の分割）</h3>
          <p>${d['相続財産の内容'] || '（相続財産の分割内容をここに記載）'}</p>
          <h3>第2条（後日判明した財産）</h3>
          <p>本協議書に記載のない遺産が後日判明した場合は、相続人全員で改めて協議する。</p>
          <p class="spacer">以上のとおり、相続人全員による遺産分割協議が成立したので、これを証するため本協議書を作成し、各自署名押印のうえ、各1通を保有する。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          ${(d['相続人名（複数）'] || '相続人1,相続人2').split(/[,、，]/).map(name =>
                `<div class="sign-block">
              <div class="info-row"><span class="label">相続人</span><span>${name.trim()}</span></div>
              <div class="info-row"><span class="label">住　所</span><span class="line">　</span></div>
              <div class="info-row"><span class="label">署名押印</span><span class="line">　　　　　　　　　　　　　　　　　㊞</span></div>
            </div>`
            ).join('')}
        </div>`
        },

        construction_permit_app: {
            title: '建設業許可申請書',
            build: (d) => `
        <h1 class="doc-title">建設業許可申請書</h1>
        <p class="subtitle">（様式第一号）</p>
        <div class="doc-body">
          <table class="form-table">
            <tr><th>申請区分</th><td>${d['許可の種類'] || '□新規　□更新　□追加'}</td></tr>
            <tr><th>商号又は名称</th><td>${d['商号'] || '　'}</td></tr>
            <tr><th>代表者氏名</th><td>${d['代表者名'] || '　'}</td></tr>
            <tr><th>主たる営業所の所在地</th><td>${d['所在地'] || '　'}</td></tr>
            <tr><th>電話番号</th><td>${d['電話番号'] || '　'}</td></tr>
            <tr><th>許可の区分</th><td>□一般建設業　□特定建設業</td></tr>
            <tr><th>許可の種類</th><td>□知事許可　□大臣許可</td></tr>
            <tr><th>建設工事の種類</th><td>${d['業種'] || '　'}</td></tr>
          </table>
          <p class="spacer">上記のとおり、建設業法第3条第1項の規定により許可を申請します。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">申請者</span><span>${d['商号'] || '　'}</span></div>
            <div class="info-row"><span class="label">代表者</span><span>${d['代表者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        parking_certificate_app: {
            title: '自動車保管場所証明申請書',
            build: (d) => `
        <h1 class="doc-title">自動車保管場所証明申請書</h1>
        <div class="doc-body">
          <table class="form-table">
            <tr><th>申請者氏名</th><td>${d['申請者名'] || '　'}</td></tr>
            <tr><th>住所</th><td>${d['住所'] || '　'}</td></tr>
            <tr><th>車名</th><td>${d['車名'] || '　'}</td></tr>
            <tr><th>型式</th><td>${d['型式'] || '　'}</td></tr>
            <tr><th>車台番号</th><td>${d['車台番号'] || '　'}</td></tr>
            <tr><th>保管場所の位置</th><td>${d['保管場所の住所'] || '　'}</td></tr>
            <tr><th>使用権原</th><td>□自己所有　□賃借</td></tr>
          </table>
          <p class="spacer">上記のとおり自動車の保管場所の確保等に関する法律第4条の規定により申請します。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">申請者</span><span>${d['申請者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        general_contract: {
            title: '業務委託契約書',
            build: (d) => `
        <h1 class="doc-title">業務委託契約書</h1>
        <div class="doc-body">
          <p><b>${d['委託者名'] || '＿＿＿＿＿'}</b>（以下「甲」という）と<b>${d['受託者名'] || '＿＿＿＿＿'}</b>（以下「乙」という）は、以下のとおり業務委託契約を締結する。</p>
          <h3>第1条（委託業務の内容）</h3>
          <p>甲は、以下の業務を乙に委託し、乙はこれを受託する。</p>
          <p class="indent">${d['業務内容'] || '（業務内容を記載）'}</p>
          <h3>第2条（契約期間）</h3>
          <p class="indent">${d['契約期間'] || '令和＿年＿月＿日 から 令和＿年＿月＿日 まで'}</p>
          <h3>第3条（報酬）</h3>
          <p class="indent">金${d['報酬額'] || '＿＿＿＿＿'}円（税別）</p>
          <p class="indent">支払条件：${d['支払条件'] || '請求書受領後30日以内に銀行振込'}</p>
          <h3>第4条（秘密保持）</h3>
          <p>甲及び乙は、本契約に関して知り得た相手方の秘密情報を第三者に開示してはならない。</p>
          <h3>第5条（契約の解除）</h3>
          <p>甲又は乙は、30日前に書面で通知することにより本契約を解除できる。</p>
          <h3>第6条（合意管轄）</h3>
          <p>本契約に関する紛争は、東京地方裁判所を第一審の専属的合意管轄裁判所とする。</p>
          <p class="spacer">以上の合意を証するため、本契約書2通を作成し、甲乙各1通を保有する。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block-pair">
            <div class="sign-block"><p>甲（委託者）</p><div class="info-row"><span class="label">住所</span><span class="line">　</span></div><div class="info-row"><span class="label">氏名</span><span>${d['委託者名'] || '　'}　　㊞</span></div></div>
            <div class="sign-block"><p>乙（受託者）</p><div class="info-row"><span class="label">住所</span><span class="line">　</span></div><div class="info-row"><span class="label">氏名</span><span>${d['受託者名'] || '　'}　　㊞</span></div></div>
          </div>
        </div>`
        },

        content_certified_mail: {
            title: '内容証明郵便',
            build: (d) => `
        <h1 class="doc-title">通　知　書</h1>
        <div class="doc-body content-cert">
          <p class="date-line-right">令和　　年　　月　　日</p>
          <div class="address-block">
            <p>${d['受取人住所'] || '（受取人住所）'}</p>
            <p><b>${d['受取人名'] || '（受取人名）'}</b>　殿</p>
          </div>
          <div class="sender-block">
            <p>${d['差出人住所'] || '（差出人住所）'}</p>
            <p><b>${d['差出人名'] || '（差出人名）'}</b></p>
          </div>
          <div class="body-block">
            <p>${d['要求事項'] || '（通知内容をここに記載してください。1行20字以内、1枚26行以内。）'}</p>
          </div>
          <p class="note">※本書面は内容証明郵便として差し出すものです。</p>
        </div>`
        },

        articles_of_incorporation: {
            title: '定款',
            build: (d) => `
        <h1 class="doc-title">${d['商号'] || '＿＿株式会社'}　定款</h1>
        <div class="doc-body">
          <h3>第1章　総　則</h3>
          <h4>第1条（商号）</h4><p class="indent">当会社は、<b>${d['商号'] || '＿＿株式会社'}</b>と称する。</p>
          <h4>第2条（目的）</h4><p class="indent">${d['目的'] || '1. ＿＿＿＿\n2. ＿＿＿＿\n3. 前各号に附帯する一切の事業'}</p>
          <h4>第3条（本店の所在地）</h4><p class="indent">当会社は、本店を<b>${d['本店所在地'] || '＿＿＿＿'}</b>に置く。</p>
          <h3>第2章　株　式</h3>
          <h4>第4条（発行可能株式総数）</h4><p class="indent">当会社の発行可能株式総数は、<b>${d['発行可能株式総数'] || '＿＿＿'}</b>株とする。</p>
          <h4>第5条（株式の譲渡制限）</h4><p class="indent">当会社の株式を譲渡するには、取締役の承認を得なければならない。</p>
          <h3>第3章　機　関</h3>
          <h4>第6条（機関の設置）</h4><p class="indent">当会社は、株主総会及び取締役を置く。</p>
          <h3>第4章　計　算</h3>
          <h4>第7条（事業年度）</h4><p class="indent">当会社の事業年度は、${d['事業年度'] || '毎年4月1日から翌年3月31日まで'}の年1期とする。</p>
          <h3>附　則</h3>
          <h4>第8条（設立に際して出資される財産の価額）</h4><p class="indent">当会社の設立に際して出資される財産の価額は、金<b>${d['資本金'] || '＿＿＿'}</b>円とする。</p>
          <h4>第9条（発起人）</h4>
          <table class="form-table"><tr><th>氏名</th><th>住所</th><th>引受株式数</th></tr>
          <tr><td>${d['発起人名'] || '　'}</td><td class="line">　</td><td>＿＿株</td></tr></table>
          <p class="spacer">以上、${d['商号'] || '＿＿株式会社'}の設立のためこの定款を作成する。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block"><div class="info-row"><span class="label">発起人</span><span>${d['発起人名'] || '　'}　　　　㊞</span></div></div>
        </div>`
        },

        power_of_attorney: {
            title: '委任状',
            build: (d) => `
        <h1 class="doc-title">委　任　状</h1>
        <div class="doc-body">
          <p class="date-line">令和　　年　　月　　日</p>
          <p>私、<b>${d['委任者名'] || '＿＿＿＿＿'}</b>は、<b>${d['受任者名'] || '＿＿＿＿＿'}</b>を代理人と定め、以下の権限を委任する。</p>
          <h3>委任事項</h3>
          <div class="indent-block"><p>${d['委任事項'] || '（委任する事項を記載）'}</p></div>
          <p class="spacer">以上</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">委任者住所</span><span class="line">　</span></div>
            <div class="info-row"><span class="label">委任者氏名</span><span>${d['委任者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        estimate: {
            title: '見積書',
            build: (d) => {
                const items = (d['項目'] || '業務報酬,100000').split('\n').map(line => {
                    const [name, amt] = line.split(',');
                    return { name: (name || '').trim(), amount: parseInt(amt) || 0 };
                });
                const subtotal = items.reduce((s, i) => s + i.amount, 0);
                const tax = Math.floor(subtotal * 0.1);
                const total = subtotal + tax;
                const fmtNum = (n) => n.toLocaleString();
                return `
        <h1 class="doc-title">見　積　書</h1>
        <div class="doc-body">
          <p class="date-line-right">見積日：${d['見積日'] || '令和　　年　　月　　日'}</p>
          <p class="date-line-right">見積番号：${d['見積番号'] || 'EST-' + Date.now().toString().slice(-6)}</p>
          <div class="address-block">
            <p><b>${d['宛先名'] || '＿＿＿＿＿'}</b>　御中</p>
          </div>
          <div class="sender-block">
            <p>${d['事務所名'] || '○○行政書士事務所'}</p>
            <p>${d['事務所住所'] || '（住所）'}</p>
            <p>TEL: ${d['電話番号'] || '000-0000-0000'}</p>
          </div>
          <p>下記のとおりお見積り申し上げます。</p>
          <div class="estimate-total">
            <span class="label">合計金額（税込）</span>
            <span class="amount">¥${fmtNum(total)}-</span>
          </div>
          <table class="form-table">
            <tr><th style="width:50%">項目</th><th>金額（税抜）</th></tr>
            ${items.map(i => `<tr><td>${i.name}</td><td style="text-align:right">¥${fmtNum(i.amount)}</td></tr>`).join('')}
            <tr><th>小計</th><td style="text-align:right">¥${fmtNum(subtotal)}</td></tr>
            <tr><th>消費税（10%）</th><td style="text-align:right">¥${fmtNum(tax)}</td></tr>
            <tr style="font-weight:bold;background:#f0f0f0"><th>合計</th><td style="text-align:right">¥${fmtNum(total)}</td></tr>
          </table>
          <h3>備考</h3>
          <div class="indent-block"><p>${d['備考'] || '・有効期限：発行日より30日間\n・お支払い条件：請求書発行後30日以内'}</p></div>
        </div>`;
            }
        },

        receipt: {
            title: '領収書',
            build: (d) => `
        <h1 class="doc-title">領　収　書</h1>
        <div class="doc-body">
          <p class="date-line-right">${d['発行日'] || '令和　　年　　月　　日'}</p>
          <div class="address-block">
            <p><b>${d['宛先名'] || '＿＿＿＿＿'}</b>　様</p>
          </div>
          <div class="receipt-amount">
            <span class="label">金額</span>
            <span class="amount">¥${d['金額'] || '＿＿＿＿＿'}−</span>
          </div>
          <p>但し、${d['但し書き'] || '＿＿＿＿＿＿＿＿業務報酬'}として上記正に領収いたしました。</p>
          <table class="form-table" style="margin-top:20px">
            <tr><th>税抜金額</th><td>${d['税抜金額'] || '　'}</td></tr>
            <tr><th>消費税額</th><td>${d['消費税額'] || '　'}</td></tr>
          </table>
          <div class="sign-block" style="text-align:right">
            <p>${d['事務所名'] || '○○行政書士事務所'}</p>
            <p>${d['事務所住所'] || '（住所）'}</p>
            <p>TEL: ${d['電話番号'] || '000-0000-0000'}</p>
            <p style="margin-top:30px">　　　　　　　　　　　　㊞</p>
          </div>
        </div>`
        },

        food_permit_app: {
            title: '飲食店営業許可申請書',
            build: (d) => `
        <h1 class="doc-title">飲食店営業許可申請書</h1>
        <div class="doc-body">
          <table class="form-table">
            <tr><th>申請者氏名</th><td>${d['申請者名'] || '　'}</td></tr>
            <tr><th>店舗名（屋号）</th><td>${d['店舗名'] || '　'}</td></tr>
            <tr><th>営業所所在地</th><td>${d['店舗住所'] || '　'}</td></tr>
            <tr><th>営業の種類</th><td>${d['業種'] || '□飲食店営業　□喫茶店営業'}</td></tr>
            <tr><th>食品衛生責任者</th><td>${d['食品衛生責任者名'] || '　'}</td></tr>
            <tr><th>営業設備の大要</th><td>□調理場　□客席　□トイレ　□手洗い</td></tr>
          </table>
          <p class="spacer">上記のとおり、食品衛生法の規定により営業許可を申請します。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">申請者</span><span>${d['申請者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        transport_permit_app: {
            title: '貨物自動車運送事業許可申請書',
            build: (d) => `
        <h1 class="doc-title">一般貨物自動車運送事業<br>経営許可申請書</h1>
        <div class="doc-body">
          <table class="form-table">
            <tr><th>申請者</th><td>${d['申請者名'] || '　'}</td></tr>
            <tr><th>代表者名</th><td>${d['代表者名'] || '　'}</td></tr>
            <tr><th>主たる事務所の所在地</th><td>${d['営業所住所'] || '　'}</td></tr>
            <tr><th>使用する自動車の種別</th><td>□普通　□小型　□けん引</td></tr>
            <tr><th>車両数</th><td>${d['車両数'] || '　'}両（最低5両以上）</td></tr>
            <tr><th>運行管理者</th><td>${d['運行管理者名'] || '　'}</td></tr>
          </table>
          <p class="spacer">上記のとおり、貨物自動車運送事業法第3条の規定により許可を申請します。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">申請者</span><span>${d['申請者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        farmland_conversion_app: {
            title: '農地転用許可申請書',
            build: (d) => `
        <h1 class="doc-title">農地転用許可申請書</h1>
        <p class="subtitle">（農地法第4条・第5条）</p>
        <div class="doc-body">
          <table class="form-table">
            <tr><th>申請者</th><td>${d['申請者名'] || '　'}</td></tr>
            <tr><th>農地の所在地</th><td>${d['農地の所在地'] || '　'}</td></tr>
            <tr><th>地目</th><td>${d['地目・地積'] || '田・畑　　地積　　㎡'}</td></tr>
            <tr><th>転用の目的</th><td>${d['転用目的'] || '　'}</td></tr>
            <tr><th>転用後の用途</th><td>${d['転用後の用途'] || '　'}</td></tr>
            <tr><th>転用の時期</th><td>令和　　年　　月　　日〜</td></tr>
          </table>
          <p class="spacer">上記のとおり、農地法の規定により許可を申請します。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block">
            <div class="info-row"><span class="label">申請者</span><span>${d['申請者名'] || '　'}　　　　㊞</span></div>
          </div>
        </div>`
        },

        nda_agreement: {
            title: '秘密保持契約書（NDA）',
            build: (d) => `
        <h1 class="doc-title">秘密保持契約書</h1>
        <div class="doc-body">
          <p><b>${d['甲（開示者）'] || '＿＿＿＿＿'}</b>（以下「甲」という）と<b>${d['乙（受領者）'] || '＿＿＿＿＿'}</b>（以下「乙」という）は、以下のとおり秘密保持契約を締結する。</p>
          <h3>第1条（秘密情報の定義）</h3>
          <p>本契約において「秘密情報」とは、${d['秘密情報の範囲'] || '甲が乙に対して開示する一切の技術上・営業上の情報'}をいう。</p>
          <h3>第2条（秘密保持義務）</h3>
          <p>乙は、秘密情報を厳に秘密として保持し、甲の事前の書面による承諾なく第三者に開示・漏洩してはならない。</p>
          <h3>第3条（目的外使用の禁止）</h3>
          <p>乙は、秘密情報を本取引の検討・遂行の目的以外に使用してはならない。</p>
          <h3>第4条（秘密情報の返還）</h3>
          <p>甲の求めがあった場合、乙は速やかに秘密情報及びその複製物を返還または廃棄する。</p>
          <h3>第5条（有効期間）</h3>
          <p class="indent">${d['契約期間'] || '本契約締結日から3年間'}</p>
          <h3>第6条（損害賠償）</h3>
          <p>乙が本契約に違反し甲に損害を与えた場合、乙は甲に対しその損害を賠償する。</p>
          <p class="spacer">以上の合意を証するため、本契約書2通を作成し、甲乙各1通を保有する。</p>
          <p class="date-line">令和　　年　　月　　日</p>
          <div class="sign-block-pair">
            <div class="sign-block"><p>甲（開示者）</p><div class="info-row"><span class="label">住所</span><span class="line">　</span></div><div class="info-row"><span class="label">氏名</span><span>${d['甲（開示者）'] || '　'}　　㊞</span></div></div>
            <div class="sign-block"><p>乙（受領者）</p><div class="info-row"><span class="label">住所</span><span class="line">　</span></div><div class="info-row"><span class="label">氏名</span><span>${d['乙（受領者）'] || '　'}　　㊞</span></div></div>
          </div>
        </div>`
        }
    };

    // ===== PDF生成のCSS =====
    static DOC_CSS = `
    @page { size: A4; margin: 25mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', 'Meiryo', sans-serif;
           font-size: 11pt; line-height: 1.8; color: #111; }
    .doc-title { text-align: center; font-size: 18pt; letter-spacing: 0.3em;
                 border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .subtitle { text-align: center; font-size: 10pt; color: #555; margin-bottom: 20px; }
    .doc-body h3 { font-size: 12pt; margin: 18px 0 6px; border-left: 4px solid #4F46E5; padding-left: 8px; }
    .doc-body h4 { font-size: 11pt; margin: 12px 0 4px; }
    .doc-body p { margin: 6px 0; text-indent: 1em; }
    .indent { margin-left: 2em; text-indent: 0; }
    .indent-block { margin-left: 2em; padding: 10px; border: 1px solid #ccc; background: #fafafa; }
    .info-block { margin: 16px 0; padding: 12px; border: 1px solid #ddd; }
    .info-row { display: flex; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .info-row:last-child { border-bottom: none; }
    .info-row .label { min-width: 120px; font-weight: bold; color: #333; }
    .info-row .line { flex: 1; border-bottom: 1px solid #999; }
    .form-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .form-table th, .form-table td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
    .form-table th { background: #f0f0f0; width: 180px; font-weight: bold; }
    .spacer { margin-top: 30px; }
    .date-line { text-align: right; margin: 20px 0; }
    .date-line-right { text-align: right; margin-bottom: 20px; }
    .sign-block { margin: 24px 0; padding: 16px 0; }
    .sign-block-pair { display: flex; gap: 40px; }
    .sign-block-pair .sign-block { flex: 1; }
    .address-block { margin: 20px 0; }
    .sender-block { margin: 20px 0; text-align: right; }
    .body-block { margin: 30px 0; min-height: 200px; }
    .content-cert { font-family: 'Yu Mincho', 'Hiragino Mincho ProN', serif; }
    .note { font-size: 9pt; color: #666; margin-top: 30px; }
    .estimate-total { display: flex; justify-content: space-between; align-items: center; border: 2px solid #333; padding: 12px 16px; margin: 16px 0; font-size: 14pt; }
    .estimate-total .label { font-weight: bold; }
    .estimate-total .amount { font-size: 18pt; font-weight: bold; color: #111; }
    .receipt-amount { display: flex; justify-content: space-between; align-items: center; border: 3px double #333; padding: 14px 16px; margin: 20px 0; font-size: 16pt; }
    .receipt-amount .label { font-weight: bold; }
    .receipt-amount .amount { font-size: 20pt; font-weight: bold; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;

    // HTML生成ヘルパー
    _buildHTML(templateId, data) {
        const tmpl = PDFGenerator.TEMPLATES[templateId];
        if (!tmpl) return null;
        return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
      <title>${tmpl.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
      <style>${PDFGenerator.DOC_CSS}
        body { max-width: 210mm; margin: 0 auto; padding: 25mm 20mm; background: white; min-height: 297mm; }
      </style>
      </head><body>${tmpl.build(data)}</body></html>`;
    }

    // PDF生成（印刷ダイアログ方式 - iframe使用でポップアップブロック回避）
    async generateAndPrint(templateId, data) {
        const html = this._buildHTML(templateId, data);
        if (!html) { alert('テンプレートが見つかりません'); return; }
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        // フォント読み込みを待ってから印刷
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 2000);
        }, 1200);
    }

    // プレビュー（モーダル内 iframe 表示 - ポップアップブロック回避）
    async previewDocument(templateId, data) {
        const html = this._buildHTML(templateId, data);
        if (!html) return;
        // 既存プレビューを削除
        const old = document.getElementById('pdfPreviewOverlay');
        if (old) old.remove();
        // オーバーレイ
        const overlay = document.createElement('div');
        overlay.id = 'pdfPreviewOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);z-index:2000;display:flex;flex-direction:column;align-items:center;padding:16px;animation:fadeInUp .3s ease;';
        // ツールバー
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;flex-shrink:0;';
        const printBtn = document.createElement('button');
        printBtn.textContent = '🖨️ 印刷 / PDF保存';
        printBtn.style.cssText = 'padding:10px 24px;background:#4F46E5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:sans-serif;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ 閉じる';
        closeBtn.style.cssText = 'padding:10px 24px;background:#EF4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:sans-serif;';
        toolbar.appendChild(printBtn);
        toolbar.appendChild(closeBtn);
        overlay.appendChild(toolbar);
        // iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'flex:1;width:100%;max-width:850px;border:none;border-radius:8px;background:white;box-shadow:0 8px 32px rgba(0,0,0,.3);';
        overlay.appendChild(iframe);
        document.body.appendChild(overlay);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        // イベント
        closeBtn.onclick = () => overlay.remove();
        printBtn.onclick = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    // ダウンロード（プレビュー表示して印刷を案内）
    async downloadDocument(templateId, data, filename) {
        await this.previewDocument(templateId, data);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFGenerator;
}
