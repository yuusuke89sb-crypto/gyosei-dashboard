/**
 * 場所マスタの正式名称・照合ルール（2026-10-19 追加）
 *
 * - 「旧表記・別名 → 正式名称」を1か所で管理し、案件登録・FAX読取・請求書・同期のすべてで使う
 * - 照合は「正式名称どうしの完全一致」のみ（部分一致による誤判定を防止）
 *   例：「西枇杷島警察署」が「西警察署」に、「岐阜中警察署」が「中警察署」になる不具合の対策
 */
const LocationMaster = {
  // 陸事（運輸支局・自動車検査登録事務所）の正式名称と別名
  OFFICE_ALIASES: {
    '中川陸事': ['愛知運輸支局', '名古屋運輸支局', '中川陸事', '愛知陸事', '中川運輸', '愛知運輸'],
    '岐阜陸事': ['岐阜運輸支局', '岐阜陸事', '岐阜運輸'],
    '小牧陸事': ['小牧自動車検査登録事務所', '小牧陸事', '小牧運輸', '小牧検査登録事務所'],
    '三河陸事': ['西三河自動車検査登録事務所', '三河陸事', '西三河陸事', '西三河運輸'],
    '豊橋陸事': ['豊橋自動車検査登録事務所', '豊橋陸事', '豊橋運輸'],
    '飛騨陸事': ['飛騨自動車検査登録事務所', '飛騨陸事', '飛騨運輸'],
    '三重陸事': ['三重運輸支局', '三重陸事', '三重運輸'],
  },
  // 「名古屋〇警察署」→「〇警察署」とする名古屋市内の1文字署
  NAGOYA_SHORT: ['東', '西', '北', '中', '南'],
  // その他の警察署の別名（左：別名の基幹部分 → 右：正式名称の基幹部分）
  POLICE_ALIASES: { '岐阜羽島': '羽島' },

  _norm(s) {
    let t = String(s == null ? '' : s);
    try { t = t.normalize('NFKC'); } catch (e) { /* 古い環境 */ }
    return t.replace(/[\s\u3000]+/g, '').trim();
  },

  /** 任意の表記を正式名称に変換する（該当なしはそのまま返す） */
  canonicalName(name) {
    const n = this._norm(name);
    if (!n) return '';
    for (const canon in this.OFFICE_ALIASES) {
      if (this.OFFICE_ALIASES[canon].includes(n)) return canon;
    }
    let base;
    if (n.endsWith('警察署')) base = n.slice(0, -3);
    else if (n.endsWith('署')) base = n.slice(0, -1);
    else return n;
    base = base.replace(/^愛知県/, '');
    if (base.startsWith('名古屋') && this.NAGOYA_SHORT.includes(base.slice(3))) {
      base = base.slice(3);
    } else if (base.startsWith('愛知') && base.length > 2) {
      // 「愛知〇警察署」→「〇警察署」。ただし「愛知警察署」（東郷町）はそのまま
      base = base.slice(2);
    }
    base = this.POLICE_ALIASES[base] || base;
    return base + '警察署';
  },

  /** 請求書などの短縮表示（「警察署」を外す。陸事はそのまま） */
  shortLabel(name) {
    return this.canonicalName(name).replace(/警察署$/, '');
  },

  /** 正式名称の完全一致で場所を探す */
  findByName(name, locations) {
    const target = this.canonicalName(name);
    if (!target) return null;
    const locs = locations || ((typeof Store !== 'undefined' && Store.getLocations) ? Store.getLocations() : []);
    return locs.find(l => l && l.name && this.canonicalName(l.name) === target) || null;
  },

  // ---------- 住所 → 所轄警察署（市区町村の完全一致） ----------
  NAGOYA_WARD: {
    '中区': '中', '東区': '東', '北区': '北', '西区': '西', '南区': '南', '中村区': '中村', '中川区': '中川',
    '千種区': '千種', '熱田区': '熱田', '名東区': '名東', '瑞穂区': '瑞穂', '昭和区': '昭和', '守山区': '守山',
    '天白区': '天白', '港区': '港', '緑区': '緑',
  },
  // 市町村 → 所轄警察署（愛知県警45署・岐阜県警22署の管轄区域に基づく。2026-10-19 全署対応）
  // ※ 1つの市を複数の署が管轄する岐阜市（中・南・北・羽島）は自動判定しない（柳津町のみ羽島）
  CITY: {
    // ── 愛知県 尾張 ──
    '一宮市': '一宮', '江南市': '江南', '岩倉市': '江南', '大口町': '江南', '犬山市': '犬山', '扶桑町': '犬山',
    '稲沢市': '稲沢', '小牧市': '小牧', '春日井市': '春日井', '瀬戸市': '瀬戸', '尾張旭市': '守山',
    '豊明市': '愛知', '日進市': '愛知', '長久手市': '愛知', '東郷町': '愛知',
    '清須市': '西枇杷島', '北名古屋市': '西枇杷島', '豊山町': '西枇杷島',
    '津島市': '津島', '愛西市': '津島', 'あま市': '津島', '大治町': '津島',
    '弥富市': '蟹江', '蟹江町': '蟹江', '飛島村': '蟹江',
    '半田市': '半田', '阿久比町': '半田', '武豊町': '半田', '東浦町': '半田', '南知多町': '半田', '美浜町': '半田',
    '東海市': '東海', '大府市': '東海', '知多市': '知多', '常滑市': '常滑',
    // ── 愛知県 三河 ──
    '刈谷市': '刈谷', '碧南市': '碧南', '高浜市': '碧南', '安城市': '安城', '知立市': '安城', '西尾市': '西尾',
    '岡崎市': '岡崎', '幸田町': '岡崎', '豊田市': '豊田', 'みよし市': '豊田',
    '設楽町': '設楽', '東栄町': '設楽', '豊根村': '設楽', '新城市': '新城', '豊川市': '豊川', '蒲郡市': '蒲郡',
    '豊橋市': '豊橋', '田原市': '田原',
    // ── 岐阜県 ──
    '羽島市': '羽島', '岐南町': '羽島', '笠松町': '羽島', '各務原市': '各務原',
    '北方町': '北方', '瑞穂市': '北方', '本巣市': '北方', '山県市': '山県',
    '大垣市': '大垣', '神戸町': '大垣', '輪之内町': '大垣', '安八町': '大垣', '海津市': '海津', '養老町': '養老',
    '垂井町': '垂井', '関ケ原町': '垂井', '関ヶ原町': '垂井', '揖斐川町': '揖斐', '大野町': '揖斐', '池田町': '揖斐',
    '関市': '関', '美濃市': '関', '美濃加茂市': '加茂', '坂祝町': '加茂', '富加町': '加茂', '川辺町': '加茂',
    '七宗町': '加茂', '八百津町': '加茂', '白川町': '加茂', '東白川村': '加茂', '可児市': '可児', '御嵩町': '可児',
    '郡上市': '郡上', '多治見市': '多治見', '土岐市': '多治見', '瑞浪市': '多治見', '中津川市': '中津川',
    '恵那市': '恵那', '高山市': '高山', '白川村': '高山', '飛騨市': '飛騨', '下呂市': '下呂',
    // ── 三重県（近隣） ──
    '桑名市': '桑名',
  },
  // 市の一部だけ別の署が管轄する区域（CITY より先に判定）
  // ※ 豊田市の旧足助町・下山村・旭町・稲武町の区域は足助警察署（町名が多いため代表的な町名のみ）
  PARTIAL: [
    ['大垣市上石津町', '養老'], ['岐阜市柳津町', '羽島'], ['常滑市セントレア', '中部空港'],
    ['豊田市足助町', '足助'], ['豊田市稲武町', '足助'],
  ],

  /** 住所から所轄警察署の正式名称を返す（判定できなければ ''） */
  policeNameFromAddress(address) {
    let a = this._norm(address);
    if (!a || a === '同上' || a === '別紙' || a === '-') return '';
    a = a.replace(/^(愛知県|岐阜県|三重県)/, '');
    const m = a.match(/^名古屋市(.{1,2}区)/);
    if (m && this.NAGOYA_WARD[m[1]]) return this.NAGOYA_WARD[m[1]] + '警察署';
    if (a.startsWith('名古屋市')) return '';
    // 郡名を外す（例：西春日井郡豊山町 → 豊山町、海部郡蟹江町 → 蟹江町）
    const a2 = a.replace(/^[^市区町村郡]{1,5}郡/, '');
    for (const [prefix, st] of this.PARTIAL) {
      if (a2.startsWith(prefix)) return st + '警察署';
    }
    const cities = Object.keys(this.CITY).sort((x, y) => y.length - x.length);
    for (const city of cities) {
      if (a2.startsWith(city)) return this.CITY[city] + '警察署';
    }
    return '';
  },

  /** 住所から場所マスタの警察署を返す（マスタに無ければ null。別の署で代用しない） */
  findPoliceByAddress(address, locations) {
    const name = this.policeNameFromAddress(address);
    return name ? this.findByName(name, locations) : null;
  },

  // 愛知県警（45署）・岐阜県警（22署）の短縮名（shortLabel）セット
  AICHI_POLICE_SET: new Set([
    // 名古屋市内（16署）
    '中', '東', '北', '西', '南', '中村', '中川', '千種', '熱田', '名東', '瑞穂', '昭和', '守山', '天白', '港', '緑',
    '名古屋中', '名古屋東', '名古屋北', '名古屋西', '名古屋南',
    // 尾張・知多（16署）
    '一宮', '江南', '犬山', '稲沢', '小牧', '春日井', '瀬戸', '愛知', '西枇杷島', '津島', '蟹江',
    '半田', '東海', '知多', '常滑', '中部空港',
    // 三河（13署）
    '刈谷', '碧南', '安城', '西尾', '岡崎', '豊田', '足助', '設楽', '新城', '豊川', '蒲郡', '豊橋', '田原',
  ]),
  GIFU_POLICE_SET: new Set([
    // 岐阜県警（22署）
    '岐阜中', '岐阜南', '岐阜北', '羽島', '岐阜羽島', '各務原', '山県', '北方',
    '大垣', '海津', '養老', '垂井', '揖斐', '関', '郡上', '加茂', '可児',
    '多治見', '中津川', '恵那', '高山', '飛騨', '下呂',
  ]),

  /**
   * 警察署・場所マスタ・住所から都道府県（'愛知県' | '岐阜県' | ''）を判定する
   * @param {Object} info - { policeLocationId, carPolice, parkingAddress, carAddress }
   */
  detectPrefecture(info) {
    if (!info) return '';
    const checkStationName = (rawName) => {
      if (!rawName) return '';
      const s = this.shortLabel(rawName);
      if (this.GIFU_POLICE_SET.has(s)) return '岐阜県';
      if (this.AICHI_POLICE_SET.has(s)) return '愛知県';
      if (String(rawName).includes('岐阜')) return '岐阜県';
      if (String(rawName).includes('愛知') || String(rawName).includes('名古屋')) return '愛知県';
      return '';
    };

    // 1. 申請先警察署ID（policeLocationId）から場所マスタを参照
    if (info.policeLocationId && typeof Store !== 'undefined' && typeof Store.getLocation === 'function') {
      const loc = Store.getLocation(info.policeLocationId);
      if (loc) {
        const addrAndMemo = `${loc.address || ''} ${loc.memo || ''}`;
        if (addrAndMemo.includes('岐阜県') || addrAndMemo.includes('岐阜県警')) return '岐阜県';
        if (addrAndMemo.includes('愛知県') || addrAndMemo.includes('愛知県警')) return '愛知県';
        const byLocName = checkStationName(loc.name);
        if (byLocName) return byLocName;
      }
    }

    // 2. 所轄警察署テキスト（carPolice）から判定
    if (info.carPolice) {
      const byCarPolice = checkStationName(info.carPolice);
      if (byCarPolice) return byCarPolice;
    }

    // 3. 保管場所住所（parkingAddress）または自宅住所（carAddress）から判定
    const checkAddr = (addr) => {
      const norm = this._norm(addr);
      if (!norm || norm === '同上' || norm === '別紙' || norm === '-') return '';
      if (norm.startsWith('岐阜県') || norm.startsWith('岐阜市')) return '岐阜県';
      if (norm.startsWith('愛知県') || norm.startsWith('名古屋市')) return '愛知県';
      const polName = this.policeNameFromAddress(norm);
      if (polName) return checkStationName(polName);
      return '';
    };

    return checkAddr(info.parkingAddress) || checkAddr(info.carAddress) || '';
  },

  /**
   * 車庫証明（一般）の完了日から交付予定日までの営業日数を返す（愛知県: 3, 岐阜県: 4, 不明: 0）
   */
  getGarageDeliveryBusinessDays(info) {
    const pref = this.detectPrefecture(info);
    if (pref === '愛知県') return 3;
    if (pref === '岐阜県') return 4;
    return 0;
  },
};

if (typeof window !== 'undefined') window.LocationMaster = LocationMaster;
