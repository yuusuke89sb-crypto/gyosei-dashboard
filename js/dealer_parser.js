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
      category: 'garage_oss',
      orderNo: parsed.orderNo || '',
      clientId: parsed.matchedClientId || '',
      clientName: parsed.matchedClientName || parsed.storeFullName || parsed.dealerName || '',
      clientStaff: parsed.staffName || '',
      clientStaffPhone: parsed.staffPhone || '',
      deadline: parsed.receivedDate || '',
      status: '受任・書類確認中',
      receivedDate: parsed.receivedDate || new Date().toISOString().split('T')[0],
      memo: memoLines.join('\n'),
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
   * モーダルを開いてOCR解析結果を表示＆原本プレビューと並べて確認・修正して案件登録へ連携
   */
  showOcrResultModal(parsed, rawAttachmentUrl = '') {
    const modalId = 'dealer-ocr-result-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = modalId;
      document.body.appendChild(modalEl);
    }

    modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(6px);';

    let previewUrl = rawAttachmentUrl || '';
    let previewHtml = '';

    if (previewUrl.includes('drive.google.com')) {
      const embedUrl = previewUrl.replace(/\/view(\?.*)?$/, '/preview');
      previewHtml = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none; background:#fff;" allow="autoplay"></iframe>`;
    } else if (previewUrl.startsWith('data:image/') || previewUrl.match(/\.(png|jpe?g|webp|gif)(\?.*)?$/i)) {
      previewHtml = `<img src="${previewUrl}" style="max-width:100%; max-height:100%; object-fit:contain; display:block;" alt="依頼書原本">`;
    } else if (previewUrl.startsWith('data:application/pdf') || previewUrl.match(/\.pdf(\?.*)?$/i)) {
      previewHtml = `<iframe src="${previewUrl}#toolbar=0" style="width:100%; height:100%; border:none; background:#fff;"></iframe>`;
    } else if (previewUrl) {
      previewHtml = `<iframe src="${previewUrl}" style="width:100%; height:100%; border:none; background:#fff;"></iframe>`;
    } else {
      previewHtml = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted, #94a3b8);">
          <span style="font-size:3rem; display:block; margin-bottom:8px;">📄</span>
          <p style="margin:0; font-size:0.9rem;">原本プレビューはありません</p>
          <div style="margin-top:12px;">
            <input type="file" id="dealer-direct-file-input2" accept="application/pdf,image/*,.tif,.tiff" style="display:none" onchange="DealerDocumentParser.handleDirectFile(event)">
            <button class="btn btn-secondary btn-small" onclick="document.getElementById('dealer-direct-file-input2').click()">📁 ファイルを選択して表示</button>
          </div>
        </div>
      `;
    }

    modalEl.innerHTML = `
      <div class="modal-content" style="max-width:1280px; width:96%; height:90vh; display:flex; flex-direction:column; background:var(--card-bg, #1e293b); border:1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:16px; color:var(--text-color, #fff); box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); overflow:hidden;">
        
        <!-- ヘッダー -->
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.1)); padding:12px 20px; flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.4rem;">⚡</span>
            <h2 style="font-size:1.15rem; font-weight:700; margin:0;">FAX・依頼書 OCR自動解析＆照合・修正</h2>
          </div>
          <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()" style="font-size:1.5rem; line-height:1; cursor:pointer; background:none; border:none; color:inherit;">×</button>
        </div>

        <!-- 2カラムボディ（左: 原本プレビュー / 右: 入力・修正フォーム） -->
        <div class="modal-body" style="display:grid; grid-template-columns: 1.1fr 1fr; gap:16px; padding:16px 20px; flex:1; min-height:0; overflow:hidden;">
          
          <!-- 左側：原本プレビュー -->
          <div style="display:flex; flex-direction:column; background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; min-height:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.85rem; font-weight:bold; flex-shrink:0;">
              <span>📄 原本プレビュー (FAX / 依頼書)</span>
              ${previewUrl ? `<a href="${previewUrl}" target="_blank" class="btn btn-secondary btn-small" style="font-size:0.75rem; padding:2px 8px; text-decoration:none;">別タブで拡大 ↗</a>` : ''}
            </div>
            <div style="flex:1; width:100%; height:100%; position:relative; background:#334155; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              ${previewHtml}
            </div>
          </div>

          <!-- 右側：修正フォーム -->
          <div style="display:flex; flex-direction:column; overflow-y:auto; padding-right:8px; gap:12px;">
            <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); border-radius:8px; padding:8px 12px; font-size:0.8rem; color:#93c5fd; flex-shrink:0;">
              💡 左の原本を見ながら内容を修正できます。「この内容で案件登録」を押すと、修正内容がそのまま案件フォームに適用されます。
            </div>

            <!-- 申請区分 & 注文No -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">申請区分</label>
                <select id="ocr-edit-isOss" class="form-input" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
                  <option value="false" ${!parsed.isOss ? 'selected' : ''}>一般（書面申請）</option>
                  <option value="true" ${parsed.isOss ? 'selected' : ''}>OSS（オンライン）</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">注文No (8桁)</label>
                <input type="text" id="ocr-edit-orderNo" class="form-input" value="${parsed.orderNo || ''}" style="width:100%; font-family:monospace; font-weight:bold; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
            </div>

            <!-- ディーラー店舗名 ＆ 担当者 -->
            <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">店舗・ディーラー</label>
                <input type="text" id="ocr-edit-store" class="form-input" value="${parsed.storeFullName || parsed.dealerName || ''}" style="width:100%; font-weight:bold; color:var(--accent-gold, #f59e0b); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px;">
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">担当者名・TEL</label>
                <div style="display:flex; gap:6px;">
                  <input type="text" id="ocr-edit-staffName" class="form-input" value="${parsed.staffName || ''}" placeholder="氏名" style="width:50%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 8px;">
                  <input type="text" id="ocr-edit-staffPhone" class="form-input" value="${parsed.staffPhone || ''}" placeholder="TEL" style="width:50%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 8px;">
                </div>
              </div>
            </div>

            <!-- 申請者氏名 & フリガナ -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">申請者 氏名 / 法人名 <span style="color:#ef4444">*</span></label>
                <input type="text" id="ocr-edit-applicantName" class="form-input" value="${parsed.applicantName || ''}" style="width:100%; font-size:1rem; font-weight:bold; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">フリガナ</label>
                <input type="text" id="ocr-edit-applicantFurigana" class="form-input" value="${parsed.applicantFurigana || ''}" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
            </div>

            <!-- 使用の本拠 / 住所 -->
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">使用の本拠の位置（住所）</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="ocr-edit-postal" class="form-input" value="${parsed.applicantPostal || ''}" placeholder="〒483-8143" style="width:110px; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
                <input type="text" id="ocr-edit-applicantAddress" class="form-input" value="${parsed.applicantAddress || ''}" style="flex:1; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
            </div>

            <!-- 保管場所の位置 -->
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <label style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">保管場所の位置（駐車場住所）</label>
                <button type="button" class="btn btn-secondary btn-small" style="font-size:0.7rem; padding:1px 6px;" onclick="document.getElementById('ocr-edit-garageAddress').value = document.getElementById('ocr-edit-applicantAddress').value">使用の本拠と同じ</button>
              </div>
              <input type="text" id="ocr-edit-garageAddress" class="form-input" value="${parsed.garageAddress || ''}" placeholder="使用の本拠と同じ場合は「同上」または住所を入力" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
            </div>

            <!-- 車両情報（車名・型式・車台番号） -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1.2fr; gap:10px;">
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">車名</label>
                <input type="text" id="ocr-edit-carName" class="form-input" value="${parsed.carName || ''}" placeholder="例: トヨタ" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">型式</label>
                <input type="text" id="ocr-edit-carModel" class="form-input" value="${parsed.carModel || ''}" placeholder="例: 6AA-ZWR90W" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">車台番号</label>
                <input type="text" id="ocr-edit-vin" class="form-input" value="${parsed.vin || ''}" placeholder="例: ZWR90-..." style="width:100%; font-family:monospace; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
            </div>

            <!-- 代替車 ＆ 登録/納車予定日 -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">代替車情報（車番）</label>
                <input type="text" id="ocr-edit-replaceCar" class="form-input" value="${parsed.replaceCar || ''}" placeholder="例: 一宮350 て 7942" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">登録/納車予定日</label>
                <input type="text" id="ocr-edit-targetDeliveryDate" class="form-input" value="${parsed.targetDeliveryDate || ''}" placeholder="例: 9/11" style="width:100%; color:#38bdf8; font-weight:bold; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px;">
              </div>
            </div>

            <!-- 📄 保存するページ範囲の指定（同一FAX複数案件対策） -->
            <div style="background:rgba(56, 189, 248, 0.08); border:1px solid rgba(56, 189, 248, 0.3); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <label style="font-size:0.8rem; font-weight:bold; color:#38bdf8; margin:0;">📄 この案件に添付・保存するページ範囲</label>
                <span style="font-size:0.72rem; color:var(--text-muted);">※同一FAXに複数顧客がある場合に指定</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">開始:</span>
                <input type="number" id="ocr-page-from" min="1" value="1" style="width:55px; font-size:0.85rem; padding:4px; text-align:center; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:4px;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">枚目 〜 終了:</span>
                <input type="number" id="ocr-page-to" min="1" value="" placeholder="最終" style="width:55px; font-size:0.85rem; padding:4px; text-align:center; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:4px;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">枚目</span>
                <span style="font-size:0.72rem; color:#94a3b8; margin-left:auto;">※指定外のページは保存されません</span>
              </div>
            </div>

            <!-- 推奨案件タイトル -->
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-bottom:2px;">推奨案件タイトル</label>
              <input type="text" id="dealer-ocr-title-input" class="form-input" value="${parsed.suggestedTitle}" style="width:100%; font-weight:bold; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-color); border-radius:6px; padding:6px 10px;">
            </div>

          </div>
        </div>

        <!-- フッター -->
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color, rgba(255,255,255,0.1)); padding:12px 20px; flex-shrink:0;">
          <div style="font-size:0.8rem; color:var(--text-muted, #94a3b8);">
            ※ 入力欄を直接修正して「この内容で案件登録」を押すと、フォームに反映されます
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">閉じる</button>
            <button class="btn btn-primary" id="btn-apply-ocr-case" style="background:var(--accent-gold, #f59e0b); color:#000; font-weight:bold; padding:8px 20px; font-size:0.95rem;">📋 この内容で案件登録</button>
          </div>
        </div>
      </div>
    `;

    // 確定・案件登録ボタンのイベントリスナー
    document.getElementById('btn-apply-ocr-case').onclick = () => {
      // ユーザーが画面上で修正した最新値を取得
      const isOss = document.getElementById('ocr-edit-isOss').value === 'true';
      const pageFrom = parseInt(document.getElementById('ocr-page-from').value, 10) || 1;
      const pageToVal = document.getElementById('ocr-page-to').value;
      const pageTo = pageToVal ? parseInt(pageToVal, 10) : null;

      const updatedParsed = {
        ...parsed,
        isOss: isOss,
        applicationType: isOss ? 'OSS' : '一般',
        orderNo: document.getElementById('ocr-edit-orderNo').value.trim(),
        storeFullName: document.getElementById('ocr-edit-store').value.trim(),
        staffName: document.getElementById('ocr-edit-staffName').value.trim(),
        staffPhone: document.getElementById('ocr-edit-staffPhone').value.trim(),
        applicantName: document.getElementById('ocr-edit-applicantName').value.trim(),
        applicantFurigana: document.getElementById('ocr-edit-applicantFurigana').value.trim(),
        applicantPostal: document.getElementById('ocr-edit-postal').value.trim(),
        applicantAddress: document.getElementById('ocr-edit-applicantAddress').value.trim(),
        garageAddress: document.getElementById('ocr-edit-garageAddress').value.trim(),
        carName: document.getElementById('ocr-edit-carName').value.trim(),
        carModel: document.getElementById('ocr-edit-carModel').value.trim(),
        vin: document.getElementById('ocr-edit-vin').value.trim(),
        replaceCar: document.getElementById('ocr-edit-replaceCar').value.trim(),
        targetDeliveryDate: document.getElementById('ocr-edit-targetDeliveryDate').value.trim(),
        suggestedTitle: document.getElementById('dealer-ocr-title-input').value.trim(),
        pageRange: { from: pageFrom, to: pageTo }
      };

      const prefill = this.toCasePrefill(updatedParsed);
      prefill.pageRange = { from: pageFrom, to: pageTo };
      if (parsed.attachments && parsed.attachments.length > 0) {
        prefill.attachments = parsed.attachments;
      } else if (rawAttachmentUrl) {
        prefill.attachments = [{ name: (updatedParsed.orderNo ? `【${updatedParsed.orderNo}】依頼書原本.pdf` : '依頼書原本.pdf'), url: rawAttachmentUrl }];
      }

      modalEl.remove();

      // 案件管理画面へ遷移して登録モーダルを開く
      if (typeof App !== 'undefined' && App.navigate) {
        App.navigate('cases');
      }
      setTimeout(() => {
        if (typeof Cases !== 'undefined' && typeof Cases.showAddModal === 'function') {
          Cases.showAddModal(prefill);
        } else if (typeof CaseManager !== 'undefined' && typeof CaseManager.openModal === 'function') {
          CaseManager.openModal(prefill);
        }
      }, 120);
    };
  },

  // ─── 🔄 TIFFをJPEG Base64にクライアント側で瞬時変換するヘルパー（マルチページFAX対応） ───
  convertTiffToJpeg(arrayBufferOrBase64) {
    try {
      let buffer;
      if (typeof arrayBufferOrBase64 === 'string') {
        const cleanB64 = arrayBufferOrBase64.includes(',') ? arrayBufferOrBase64.split(',')[1] : arrayBufferOrBase64;
        const binaryStr = atob(cleanB64.trim());
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else {
        buffer = arrayBufferOrBase64;
      }

      if (typeof UTIF !== 'undefined') {
        const ifds = UTIF.decode(buffer);
        if (ifds && ifds.length > 0) {
          // 単一ページの場合
          if (ifds.length === 1) {
            UTIF.decodeImage(buffer, ifds[0]);
            const rgba = UTIF.toRGBA8(ifds[0]);
            const canvas = document.createElement('canvas');
            canvas.width = ifds[0].width;
            canvas.height = ifds[0].height;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(canvas.width, canvas.height);
            imgData.data.set(rgba);
            ctx.putImageData(imgData, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.95);
          }

          // 複数ページ（マルチページFAX: 1枚目依頼書 + 2枚目車検証等）の場合、縦に結合
          let maxWidth = 0;
          let totalHeight = 0;
          const pages = [];

          for (let i = 0; i < ifds.length; i++) {
            UTIF.decodeImage(buffer, ifds[i]);
            const rgba = UTIF.toRGBA8(ifds[i]);
            pages.push({ ifd: ifds[i], rgba: rgba });
            maxWidth = Math.max(maxWidth, ifds[i].width);
            totalHeight += ifds[i].height;
          }

          const combinedCanvas = document.createElement('canvas');
          combinedCanvas.width = maxWidth;
          combinedCanvas.height = totalHeight;
          const ctx = combinedCanvas.getContext('2d');

          // 背景を白で初期化
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, maxWidth, totalHeight);

          let currentY = 0;
          for (const p of pages) {
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = p.ifd.width;
            pageCanvas.height = p.ifd.height;
            const pageCtx = pageCanvas.getContext('2d');
            const pageImgData = pageCtx.createImageData(p.ifd.width, p.ifd.height);
            pageImgData.data.set(p.rgba);
            pageCtx.putImageData(pageImgData, 0, 0);

            ctx.drawImage(pageCanvas, 0, currentY);
            currentY += p.ifd.height;
          }

          console.log(`✅ マルチページTIFF (${ifds.length}ページ) をJPEGへ結合変換しました: ${maxWidth}x${totalHeight}`);
          return combinedCanvas.toDataURL('image/jpeg', 0.95);
        }
      }
    } catch (e) {
      console.warn('TIFF client conversion failed:', e);
    }
    return null;
  },

  // ─── 📑 マルチページTIFFから各ページごとの個別画像配列を生成 ───
  convertTiffToPages(arrayBufferOrBase64) {
    try {
      let buffer;
      if (typeof arrayBufferOrBase64 === 'string') {
        const cleanB64 = arrayBufferOrBase64.includes(',') ? arrayBufferOrBase64.split(',')[1] : arrayBufferOrBase64;
        const binaryStr = atob(cleanB64.trim());
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else {
        buffer = arrayBufferOrBase64;
      }

      if (typeof UTIF !== 'undefined') {
        const ifds = UTIF.decode(buffer);
        if (ifds && ifds.length > 0) {
          const pages = [];
          for (let i = 0; i < ifds.length; i++) {
            UTIF.decodeImage(buffer, ifds[i]);
            const rgba = UTIF.toRGBA8(ifds[i]);
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = ifds[i].width;
            pageCanvas.height = ifds[i].height;
            const pageCtx = pageCanvas.getContext('2d');
            const pageImgData = pageCtx.createImageData(ifds[i].width, ifds[i].height);
            pageImgData.data.set(rgba);
            pageCtx.putImageData(pageImgData, 0, 0);
            pages.push({
              pageNumber: i + 1,
              name: `ページ ${i + 1} (${ifds[i].width}x${ifds[i].height})`,
              dataUrl: pageCanvas.toDataURL('image/jpeg', 0.95),
              width: ifds[i].width,
              height: ifds[i].height
            });
          }
          return pages;
        }
      }
    } catch (e) {
      console.warn('TIFF convertTiffToPages failed:', e);
    }
    return [];
  },

  // ─── 🤖 Gemini Vision による画像/PDFの直接超高精度AI解析 ───
  async parseWithGemini(base64Data, mimeType, item = {}) {
    const apiKey = localStorage.getItem('gyosei_gemini_api_key') || '';
    if (!apiKey) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('⚠️ Gemini APIキーが未設定です。連携設定から入力してください');
      }
      return null;
    }

    const prompt = `あなたは行政書士事務所の自動車登録・車庫証明の専門AIです。
添付された書類（愛知トヨタ・トヨタWEST・三菱・日産などのFAX/依頼書/車検証/委任状）を精査し、以下のJSON形式のみを出力してください。Markdown記法や解説文は一切含めないでください。

【最重要ルール】
1. 申請者（お客様）の情報は、1枚目「車庫証明申請手続き依頼書」の「使用の本拠の位置（使用者・所有者）」枠内にある【氏名（漢字）】【フリガナ】【住所】【電話番号】を抽出してください（例: 氏名「石原 智之」、住所「愛知県江南市古知野町福寿16番地」）。
2. 2枚目以降の委任状等に記載されている「受任者・行政書士事務所（例: 吉村行政書士、フェリス、日栄行政書士、小郷町伍大力73など）」の住所や氏名は、絶対に申請者として抽出しないでください！
3. 「注文NO」は提出日の横等にある8桁の数字（例: "88006185", "53118413"）を抽出してください。
4. 「保管場所の位置」に「別紙」や「同上」とある場合は、その通り抽出してください。
5. 「車名」「型式」「車台番号」「代替車情報」も枠内または車検証から正確に抽出してください。

【抽出項目（JSONキー）】
- orderNo: 注文No（8桁数字）
- isOss: OSS申請ならtrue、一般申請（書面）ならfalse
- applicationType: "OSS" または "一般"
- dealerName: 会社名（例: "愛知トヨタWEST株式会社"）
- branchName: 店舗名（例: "江南店", "西店"）
- storeFullName: ディーラー名と店舗名（例: "愛知トヨタ自動車 江南店"）
- staffName: 担当者氏名（例: "赤羽 勇樹"）
- staffPhone: 担当者電話番号（例: "0587-55-6311"）
- receivedDate: 提出日/依頼日 (YYYY-MM-DD)
- applicantName: 申請者 氏名 / 法人名（例: "石原 智之"）
- applicantFurigana: 申請者 フリガナ（例: "イシハラ トモユキ"）
- applicantPhone: 申請者 電話番号（例: "090-6654-3301"）
- applicantPostal: 郵便番号（例: "483-0004"）
- applicantAddress: 使用の本拠・住所（例: "愛知県江南市古知野町福寿16番地"）
- garageAddress: 保管場所の位置（例: "同上", "別紙", または住所）
- carName: 車名（例: "トヨタ"）
- carModel: 型式（例: "6AA-MXPL10G", "6AA-ZWR90W"）
- vin: 車台番号（例: "MXPL10-..."）
- registrationNo: 登録番号（ナンバー）
- replaceCar: 代替車情報（例: "名古屋507 ほ 1062 シエンタ"）
- targetDeliveryDate: 登録/納車予定日
- memo: 備考・特記事項`;

    let finalBase64 = base64Data;
    let finalMime = mimeType || 'image/jpeg';

    // TIFFの場合はブラウザ側でJPEG Canvasに変換（GeminiはTIFF非対応のため必須）
    if (finalMime.includes('tif') || base64Data.startsWith('data:image/tif') || base64Data.startsWith('SUkq') || base64Data.startsWith('TU0A')) {
      console.log('🔄 TIFF検出: ブラウザ側でJPEG変換を実行します...');
      const converted = this.convertTiffToJpeg(base64Data);
      if (converted) {
        finalBase64 = converted;
        finalMime = 'image/jpeg';
        console.log('✅ TIFF ➔ JPEG 変換完了');
      } else {
        console.warn('⚠️ TIFF変換に失敗しました');
      }
    }

    const cleanBase64 = finalBase64.includes(',') ? finalBase64.split(',')[1] : finalBase64;
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: finalMime === 'image/tiff' ? 'image/jpeg' : finalMime,
                    data: cleanBase64
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.warn(`Gemini API ${model} HTTP ${response.status}:`, errBody);
          continue;
        }
        const resData = await response.json();
        const textContent = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const parsed = JSON.parse(textContent);
          parsed.rawText = JSON.stringify(parsed);
          parsed.suggestedTitle = `${parsed.storeFullName || parsed.dealerName || 'ディーラー'} - ${parsed.applicantName || '案件'} 様 (${parsed.applicationType || (parsed.isOss ? 'OSS' : '車庫証明')})`;
          // 顧客マスタ照合
          if (typeof Store !== 'undefined' && Store.getClients) {
            const clients = Store.getClients();
            const targetStore = (parsed.storeFullName || parsed.dealerName || '').toLowerCase();
            for (const c of clients) {
              const cName = (c.name || '').toLowerCase();
              if (targetStore && (cName.includes(targetStore) || targetStore.includes(cName))) {
                parsed.matchedClientId = c.id;
                parsed.matchedClientName = c.name;
                break;
              }
            }
          }
          return parsed;
        }
      } catch (err) {
        console.warn(`Gemini model ${model} error:`, err);
      }
    }
    return null;
  },

  handleDirectFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('🔍 選択したファイルをGemini AIで解析中...');
      }
      let base64 = ev.target.result;
      let mime = file.type;
      if (!mime && file.name.match(/\.tiff?$/i)) mime = 'image/tiff';
      if (!mime && file.name.match(/\.pdf$/i)) mime = 'application/pdf';
      const parsed = await this.parseWithGemini(base64, mime);
      if (parsed) {
        this.showOcrResultModal(parsed);
      } else {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('⚠️ 解析できませんでした。APIキーをご確認ください');
        }
      }
    };
    reader.readAsDataURL(file);
  }
};

// Node.js またはブラウザ環境両対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DealerDocumentParser;
}
