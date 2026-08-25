/**
 * 自動車ディーラーFAX依頼書・車検証 OCR自動解析エンジン (DealerDocumentParser)
 * 
 * 対応帳票:
 * 1. 愛知トヨタWEST / ATグループ標準「車庫証明申請手続き依頼書（行政書士依頼書）」
 * 2. 自動車検査証記録事項（車検証）
 * 3. 一般FAX送付状 ＋ 車検証パターン
 */
const DealerDocumentParser = {

  /**
   * テキストおよび補足メタデータから案件情報を構造化抽出
   * @param {string} text OCR認識テキスト
   * @param {object} [metadata] 送信元、件名、FAXヘッダー等の補足情報
   * @returns {object} 抽出結果オブジェクト
   */
  parse(text, metadata = {}) {
    const rawText = (text || '') + '\n' + (metadata.subject || '') + '\n' + (metadata.body || '') + '\n' + (metadata.sender || '');
    const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const result = {
      docType: 'shako_request', // shako_atgroup | inspection_cert | generic
      orderNo: '',              // 注文No（8桁）
      isOss: false,             // OSSフラグ
      applicationType: '一般',   // OSS または 一般
      dealerName: '',           // 愛知トヨタWEST株式会社 等
      branchName: '',           // 一宮店 等
      storeFullName: '',        // 愛知トヨタWEST 一宮店
      staffName: '',            // 担当者名
      staffPhone: '',           // 担当者連絡先
      receivedDate: '',         // 受付日 / 提出日
      applicantName: '',        // 申請者 氏名 / 法人名
      applicantFurigana: '',    // フリガナ
      applicantPostal: '',      // 郵便番号
      applicantAddress: '',     // 申請者 住所
      applicantPhone: '',       // 申請者 電話番号
      applicantBirth: '',       // 生年月日
      garageAddress: '',        // 保管場所の位置
      baseAddress: '',          // 使用の本拠の位置
      carName: '',              // 車名（トヨタ等）
      carModel: '',             // 型式（6AA-MXPL10G等）
      vin: '',                  // 車台番号
      registrationNo: '',       // 車両登録番号（ナンバー）
      replaceCar: '',           // 代替車情報
      targetDeliveryDate: '',   // 納車/登録希望日
      suggestedTitle: '',       // 推奨案件タイトル
      category: '車庫証明',      // 業務カテゴリ
      matchedClientId: null,    // マッチした顧客ID
      matchedClientName: '',    // マッチした顧客名
      rawText: text
    };

    // ─── 1. 注文No（8桁数字）の抽出 ───
    // 例: 注文NO 57360875, 注文№ 57680161, 56273129, 56695279
    const orderNoMatch = cleanText.match(/注文(?:NO|No|№|番号|コード)?\s*[:：]?\s*([5-9]\d{7})/i) ||
                         cleanText.match(/\b([5-9]\d{7})\b/);
    if (orderNoMatch) {
      result.orderNo = orderNoMatch[1];
    }

    // ─── 2. 申請区分 (OSS vs 一般) ───
    // チェックボックス ☑ OSS / ☑ 一般、またはテキスト表記
    if (/☑\s*OSS|\[x\]\s*OSS|【x】\s*OSS|■\s*OSS|レ\s*OSS/i.test(cleanText) ||
        (cleanText.includes('OSS') && !/☑\s*一般|\[x\]\s*一般/i.test(cleanText) && (cleanText.match(/OSS/g) || []).length >= 1)) {
      if (/☑\s*一般|\[x\]\s*一般/i.test(cleanText)) {
        result.isOss = false;
        result.applicationType = '一般';
      } else {
        result.isOss = true;
        result.applicationType = 'OSS';
      }
    } else if (/☑\s*一般|\[x\]\s*一般|■\s*一般/i.test(cleanText)) {
      result.isOss = false;
      result.applicationType = '一般';
    } else if (/OSS/i.test(cleanText)) {
      result.isOss = true;
      result.applicationType = 'OSS';
    }

    // ─── 3. 店舗名・会社名の抽出 ───
    // 例: 愛知トヨタWEST株式会社 一宮店 / 一宮三条店 / 小牧村中店 / 西春店
    const dealerKeywords = [
      { key: '愛知トヨタWEST', alias: '愛知トヨタWEST株式会社' },
      { key: '愛知トヨタ', alias: '愛知トヨタ自動車株式会社' },
      { key: '三菱ふそう', alias: '三菱ふそうトラック・バス株式会社' },
      { key: '日産愛知', alias: '日産愛知自動車販売株式会社' },
      { key: 'オートステージM', alias: '有限会社 オートステージM' }
    ];

    for (const d of dealerKeywords) {
      if (cleanText.includes(d.key)) {
        result.dealerName = d.alias;
        break;
      }
    }

    // 支店名/店舗名の抽出
    const branchMatch = cleanText.match(/(?:店名|店舗名|店\s*名)?\s*([^\s\n]+(?:店|営業所|支店|センター))/);
    const knownBranches = [
      '一宮店', '一宮インター店', '一宮開明店', '一宮三条店', 'キャラット一宮店',
      '中店', '高辻店', '中村店', '江南店', '豊田店', '岡崎店', '豊橋店',
      '稲沢おりづマイカーセンター', '西春店', '北名古屋店', '北店', '昭和橋店',
      '小牧村中店', 'キャラット小牧店', '蟹江店', '津島店', '稲沢店', '春日井店', '尾張旭店', '小牧店', '清須店'
    ];
    
    for (const br of knownBranches) {
      if (cleanText.includes(br)) {
        result.branchName = br;
        break;
      }
    }
    if (!result.branchName && branchMatch) {
      const bCandidate = branchMatch[1].replace(/^(会社名|店名|御中|担当者名)/, '').trim();
      if (bCandidate.length <= 12) result.branchName = bCandidate;
    }

    if (result.dealerName || result.branchName) {
      const dShort = (result.dealerName.includes('WEST') ? '愛知トヨタWEST' : (result.dealerName.replace(/株式会社|有限会社|\(株\)|\(有\)/g, '').trim())) || '愛知トヨタWEST';
      result.storeFullName = `${dShort} ${result.branchName}`.trim();
    }

    // ─── 4. 担当者名・連絡先電話番号 ───
    const staffMatch = cleanText.match(/担当者名?\s*[:：]?\s*([^\s\n\d\(\)（）:：]{1,6}(?:\s+[^\s\n\d\(\)（）:：]{1,6})?)/);
    if (staffMatch) {
      const st = staffMatch[1].replace(/(様|殿|係|携帯|TEL|連絡先)/g, '').trim();
      if (st.length >= 2 && !['株式会社', '有限会社', '依頼書', '日来行政書士', '御中'].includes(st)) {
        result.staffName = st;
      }
    }

    // 連絡先（携帯・TEL: 090/080/070/0586/0585/0568等）
    const phoneMatch = cleanText.match(/(?:連絡先|携帯|TEL|電話番号|担当携帯)?\s*[:：]?\s*(0[789]0[-ー\s]?\d{4}[-ー\s]?\d{4}|0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{4})/);
    if (phoneMatch) {
      result.staffPhone = phoneMatch[1].replace(/[\sー]/g, '-');
    }

    // ─── 5. 提出日 / 受付日 ───
    const dateMatch = cleanText.match(/(?:提出日|受付日|依頼日|日付)\s*[:：]?\s*([R令和H平成\d]{1,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ||
                      cleanText.match(/(\d{4})[年\/\.-](\d{1,2})[月\/\.-](\d{1,2})/);
    if (dateMatch) {
      let y = dateMatch[1];
      const m = String(dateMatch[2]).padStart(2, '0');
      const d = String(dateMatch[3]).padStart(2, '0');
      if (y.includes('R') || y.includes('令和') || y === '8') {
        const rNum = parseInt(y.replace(/[^\d]/g, ''), 10) || 8;
        y = String(2018 + rNum);
      } else if (y.includes('H') || y.includes('平成')) {
        const hNum = parseInt(y.replace(/[^\d]/g, ''), 10) || 30;
        y = String(1988 + hNum);
      } else if (y.length === 1 || y.length === 2) {
        y = String(2018 + parseInt(y, 10));
      }
      result.receivedDate = `${y}-${m}-${d}`;
    }

    // ─── 6. 申請者 氏名・フリガナ・法人名 ───
    // 例: 陸田 正明 / 西濃建設 株式会社 代表取締役社長 宗宮 郷 / 寺澤 僚 / 渡邉 尚枝 / 児玉 一男
    const applicantMatch = cleanText.match(/(?:申請者|使用者(?:の氏名又は名称)?|氏名\s*(?:※1)?)\s*[:：]?\s*(?:氏名\s*(?:※1)?\s*[:：]?\s*)?([^\n\r]{2,40})/);
    if (applicantMatch) {
      let nameCandidate = applicantMatch[1].trim();
      nameCandidate = nameCandidate.replace(/^(?:氏名\s*(?:※1)?|申請者名?|使用者名?)\s*[:：]?\s*/, '').trim();
      nameCandidate = nameCandidate.replace(/(フリガナ|電話番号|住所|生年月日|同上).*$/, '').trim();
      if (nameCandidate && !['トヨタ', 'ダイハツ', '日産', '同上', '日来行政書士事務所', '愛知トヨタ'].includes(nameCandidate)) {
        result.applicantName = nameCandidate;
      }
    }

    const furiganaMatch = cleanText.match(/フリガナ\s*[:：]?\s*([ァ-ンヴー\s\(\)（）]+)/);
    if (furiganaMatch) {
      result.applicantFurigana = furiganaMatch[1].trim();
    }

    // ─── 7. 住所・郵便番号・保管場所 ───
    // 郵便番号: 〒491-0924 または [1-9]\d{2}-\d{4} (電話番号 090/080/058等を絶対に除外)
    const postalMatch = cleanText.match(/〒\s*([0-9]{3})[-ー\s]?([0-9]{4})/) ||
                        cleanText.match(/(?<![\d\-])([1-9][0-9]{2})[-ー]([0-9]{4})(?![\d\-])/);
    if (postalMatch) {
      result.applicantPostal = `${postalMatch[1]}-${postalMatch[2]}`;
    }

    const addrLineMatch = cleanText.match(/(?:住所|使用の本拠|本拠の位置|使用者の住所)\s*[:：]?\s*([^\n\r]+)/);
    if (addrLineMatch) {
      let addr = addrLineMatch[1].trim();
      addr = addr.replace(/^〒?\s*\d{3}[-ー]?\d{4}\s*/, '');
      addr = addr.replace(/(電話番号|生年月日|使用の本拠|保管場所).*$/, '').trim();
      if (addr && addr.length >= 3 && !['同上', '※1'].includes(addr)) {
        result.applicantAddress = addr;
      }
    }

    if (!result.applicantAddress) {
      const fallbackAddr = cleanText.match(/((?:愛知県|岐阜県|三重県|滋賀県|静岡県|東京都)?[^\n\r]{2,8}(?:市|郡|区|町|村)[^\n\r]{2,30}[\d０-９一-九]+(?:番地?|丁目|号|-[\d０-９]+)?)/);
      if (fallbackAddr) {
        result.applicantAddress = fallbackAddr[1].trim();
      }
    }

    // 保管場所の位置
    if (cleanText.includes('保管場所の位置') && cleanText.includes('同上')) {
      result.garageAddress = '同上（使用の本拠と同じ）';
    } else {
      const garageMatch = cleanText.match(/保管場所の位置\s*[:：]?\s*([^\n\r]{4,40})/);
      if (garageMatch && !garageMatch[1].includes('同上')) {
        result.garageAddress = garageMatch[1].trim();
      }
    }

    // 申請者電話番号
    const appPhoneMatch = cleanText.match(/電話番号\s*[:：]?\s*(0[789]0[-ー\s]?\d{4}[-ー\s]?\d{4}|0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{4})/);
    if (appPhoneMatch) {
      result.applicantPhone = appPhoneMatch[1].replace(/[\sー]/g, '-');
    }

    // ─── 8. 車両情報（車名・型式・車台番号・代替車） ───
    const carNameMatch = cleanText.match(/車名\s*[:：]?\s*([^\s\n\r]{2,10})/i) || cleanText.match(/(トヨタ|ダイハツ|日産|ホンダ|スズキ|マツダ|スバル|三菱|レクサス|ふそう)/i);
    if (carNameMatch) {
      result.carName = (carNameMatch[1] || carNameMatch[0]).trim();
    }

    // 型式（例: 6AA-MXPL10G, 3BE-NCP165V, 6AA-ZWR90W, 6AA-MXPJ10, 3BD-S510P）
    // 電話番号 (090-, 080-, 058-) を確実に除外するため、英字を含む型式パターンを指定
    const modelMatch = cleanText.match(/型式\s*[:：]?\s*([0-9A-Z]{2,4}-[0-9A-Z]{4,10})/i) ||
                       cleanText.match(/(?<![\d\-])([0-9][A-Z]{1,3}-[0-9A-Z]{4,10}|[A-Z]{2,4}-[0-9A-Z]{4,10})\b/i);
    if (modelMatch) {
      result.carModel = (modelMatch[1] || modelMatch[0]).toUpperCase();
    }

    // 車台番号（例: MXPL10-, S510P-0705500, ZWR90-）
    const vinMatch = cleanText.match(/車台番号\s*[:：]?\s*([0-9A-Z]+-[0-9A-Z]*)/i);
    if (vinMatch) {
      result.vin = vinMatch[1].toUpperCase();
    }

    // 車両登録番号（ナンバー: 尾張小牧503た4903, 岐阜 483 い 9829 等）
    const regNoMatch = cleanText.match(/((?:尾張小牧|一宮|名古屋|豊橋|三河|岡崎|豊田|岐阜|飛騨|三重|鈴鹿)\s*[0-9０-９]{2,3}\s*[ぁ-んァ-ン]\s*[0-9０-９]{1,4})/);
    if (regNoMatch) {
      result.registrationNo = regNoMatch[1];
    }

    // 代替車情報
    const replaceMatch = cleanText.match(/代替(?:車|有)?\s*[:：]?\s*([^\n\r]{2,30})/);
    if (replaceMatch) {
      result.replaceCar = replaceMatch[1].trim();
    }

    // ─── 9. 手書きメモ・登録希望日 ───
    const deliveryMatch = cleanText.match(/(?:登録|納車|希望日|予定日)?\s*[:：]?\s*(\d{1,2})[\/月](\d{1,2})日?/);
    if (deliveryMatch) {
      result.targetDeliveryDate = `${deliveryMatch[1]}/${deliveryMatch[2]}`;
    }

    // ─── 10. 顧客マスターとの自動照合 ───
    if (typeof Store !== 'undefined' && typeof Store.getClients === 'function') {
      const clients = Store.getClients();
      const targetStore = (result.storeFullName || result.dealerName || '').toLowerCase();
      for (const c of clients) {
        const cName = (c.name || '').toLowerCase();
        const cComp = (c.companyName || '').toLowerCase();
        if (targetStore && (cName.includes(targetStore) || targetStore.includes(cName) || cComp.includes(targetStore) || targetStore.includes(cComp))) {
          result.matchedClientId = c.id;
          result.matchedClientName = c.name;
          break;
        }
        if (result.branchName && (cName.includes(result.branchName.toLowerCase()) || cComp.includes(result.branchName.toLowerCase()))) {
          result.matchedClientId = c.id;
          result.matchedClientName = c.name;
          break;
        }
      }
    }

    // ─── 11. 推奨案件タイトルの自動生成 ───
    const storeLabel = result.storeFullName || result.dealerName || 'ディーラー';
    const appLabel = result.applicantName ? ` (${result.applicantName} 様)` : '';
    const ossTag = result.isOss ? '[OSS]' : '';
    const orderTag = result.orderNo ? ` - 注文No:${result.orderNo}` : '';
    result.suggestedTitle = `${storeLabel}${appLabel} - 車庫証明${ossTag}${orderTag}`;

    return result;
  },

  /**
   * 抽出結果から案件登録用のプレフィルオブジェクトを作成
   * @param {object} parsed DealerDocumentParser.parse の戻り値
   * @returns {object} CaseManager.openModal に渡すデータ
   */
  toCasePrefill(parsed) {
    const memoLines = [];
    if (parsed.orderNo) memoLines.push(`【注文No】 ${parsed.orderNo}`);
    if (parsed.applicationType) memoLines.push(`【申請区分】 ${parsed.applicationType}`);
    if (parsed.staffName) memoLines.push(`【担当者】 ${parsed.staffName} 様 (${parsed.staffPhone || '連絡先未記載'})`);
    if (parsed.applicantName) memoLines.push(`【申請者】 ${parsed.applicantName} 様 (${parsed.applicantFurigana || ''})`);
    if (parsed.applicantAddress) memoLines.push(`【使用の本拠/住所】 〒${parsed.applicantPostal || ''} ${parsed.applicantAddress}`);
    if (parsed.garageAddress) memoLines.push(`【保管場所】 ${parsed.garageAddress}`);
    if (parsed.carName || parsed.carModel || parsed.vin) {
      memoLines.push(`【車両情報】 ${parsed.carName || ''} ${parsed.carModel || ''} (車台番号: ${parsed.vin || '未定'})`);
    }
    if (parsed.replaceCar) memoLines.push(`【代替車】 ${parsed.replaceCar}`);
    if (parsed.registrationNo) memoLines.push(`【登録番号】 ${parsed.registrationNo}`);
    if (parsed.targetDeliveryDate) memoLines.push(`【登録/納車予定日】 ${parsed.targetDeliveryDate}`);

    return {
      title: parsed.suggestedTitle,
      clientId: parsed.matchedClientId || '',
      clientName: parsed.matchedClientName || parsed.storeFullName || parsed.dealerName,
      category: parsed.category || '車庫証明',
      status: '受任・書類確認中',
      deadline: parsed.targetDeliveryDate ? this._formatDeadlineToDate(parsed.targetDeliveryDate) : '',
      receivedDate: parsed.receivedDate || new Date().toISOString().split('T')[0],
      memo: memoLines.join('\n'),
      orderNo: parsed.orderNo,
      isOss: parsed.isOss,
      applicantName: parsed.applicantName,
      applicantAddress: parsed.applicantAddress,
      staffName: parsed.staffName,
      staffPhone: parsed.staffPhone
    };
  },

  _formatDeadlineToDate(m_d_str) {
    const parts = m_d_str.split('/');
    if (parts.length >= 2) {
      const year = new Date().getFullYear();
      const month = String(parts[0]).padStart(2, '0');
      const day = String(parts[1]).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  },

  /**
   * モーダルを開いてOCR解析結果を表示＆案件登録へ連携
   */
  showOcrResultModal(parsed, rawAttachmentUrl = '') {
    const modalId = 'dealer-ocr-result-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = modalId;
      document.body.appendChild(modalEl);
    }

    modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);';

    modalEl.innerHTML = `
      <div class="modal-content" style="max-width:720px; width:92%; max-height:90vh; overflow-y:auto; background:var(--card-bg, #1e293b); border:1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:16px; padding:24px; color:var(--text-color, #fff); box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.4rem;">⚡</span>
            <h2 style="font-size:1.25rem; font-weight:700; margin:0;">FAX・依頼書 OCR自動解析結果</h2>
          </div>
          <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()" style="font-size:1.5rem; line-height:1; cursor:pointer; background:none; border:none; color:inherit;">×</button>
        </div>

        <div class="modal-body" style="padding:16px 0;">
          <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); border-radius:8px; padding:12px; margin-bottom:16px;">
            <span style="font-size:0.85rem; color:#93c5fd;">💡 依頼書PDFから主要項目を自動抽出しました。内容を確認し「この内容で案件登録」を押すと、フォームに自動セットされます。</span>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:0.9rem; margin-bottom:16px;">
            <tbody>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8); width:30%;">申請区分</td>
                <td style="padding:8px; font-weight:bold;">
                  <span style="padding:2px 8px; border-radius:4px; ${parsed.isOss ? 'background:#059669; color:#fff;' : 'background:#475569; color:#fff;'}">${parsed.applicationType || '一般'}</span>
                </td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">店舗・ディーラー</td>
                <td style="padding:8px; font-weight:bold; color:var(--accent-gold, #f59e0b);">${parsed.storeFullName || parsed.dealerName || '未検出'}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">担当者名・TEL</td>
                <td style="padding:8px;">${parsed.staffName ? `${parsed.staffName} 様 (${parsed.staffPhone || 'TELなし'})` : '未検出'}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">注文NO (8桁)</td>
                <td style="padding:8px; font-family:monospace; font-weight:bold;">${parsed.orderNo || 'なし'}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">受付日 / 提出日</td>
                <td style="padding:8px;">${parsed.receivedDate || '本日'}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">申請者（顧客名）</td>
                <td style="padding:8px; font-weight:bold; font-size:1rem;">${parsed.applicantName || '未検出'} <span style="font-size:0.8rem; color:var(--text-muted, #94a3b8); font-weight:normal;">${parsed.applicantFurigana ? `(${parsed.applicantFurigana})` : ''}</span></td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">使用の本拠 / 住所</td>
                <td style="padding:8px;">${parsed.applicantPostal ? `〒${parsed.applicantPostal} ` : ''}${parsed.applicantAddress || '未検出'}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">車両情報</td>
                <td style="padding:8px;">${parsed.carName || ''} ${parsed.carModel || ''} ${parsed.vin ? `(車台番号: ${parsed.vin})` : ''}</td>
              </tr>
              ${parsed.replaceCar ? `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">代替車情報</td>
                <td style="padding:8px;">${parsed.replaceCar}</td>
              </tr>` : ''}
              ${parsed.targetDeliveryDate ? `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <td style="padding:8px; color:var(--text-muted, #94a3b8);">登録/納車予定</td>
                <td style="padding:8px; color:#38bdf8; font-weight:bold;">${parsed.targetDeliveryDate}</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div style="margin-top:12px;">
            <label style="display:block; font-size:0.8rem; color:var(--text-muted, #94a3b8); margin-bottom:4px;">推奨案件タイトル:</label>
            <input type="text" id="dealer-ocr-title-input" class="form-input" value="${parsed.suggestedTitle}" style="width:100%; font-size:0.95rem; font-weight:bold;">
          </div>
        </div>

        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border-color, rgba(255,255,255,0.1)); padding-top:16px;">
          <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">閉じる</button>
          <button class="btn btn-primary" id="btn-apply-ocr-case" style="background:var(--accent-gold, #f59e0b); color:#000; font-weight:bold;">📋 この内容で案件登録</button>
        </div>
      </div>
    `;

    document.getElementById('btn-apply-ocr-case').onclick = () => {
      const customTitle = document.getElementById('dealer-ocr-title-input').value;
      const prefill = this.toCasePrefill(parsed);
      if (customTitle) prefill.title = customTitle;
      modalEl.remove();

      // 案件管理モーダルを開いてプリフィル
      if (typeof CaseManager !== 'undefined' && typeof CaseManager.openModal === 'function') {
        CaseManager.openModal(prefill);
      } else {
        App.showToast('✅ 案件登録データを準備しました');
      }
    };
  }
};

// Node.js またはブラウザ環境両対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DealerDocumentParser;
}
