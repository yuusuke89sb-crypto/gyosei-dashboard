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
  // ※ 1つの市を複数の署が管轄する地域（岐阜市・四日市市・豊田市の一部など）は自動判定しない
  CITY: {
    '一宮市': '一宮', '江南市': '江南', '岩倉市': '江南', '大口町': '江南', '稲沢市': '稲沢', '小牧市': '小牧',
    '犬山市': '犬山', '扶桑町': '犬山', '清須市': '西枇杷島', '北名古屋市': '西枇杷島', '豊山町': '西枇杷島',
    '津島市': '津島', '愛西市': '津島', 'あま市': '津島', '大治町': '津島', '蟹江町': '蟹江', '弥富市': '蟹江',
    '飛島村': '蟹江', '春日井市': '春日井', '瀬戸市': '瀬戸', '東郷町': '愛知', '日進市': '愛知',
    '東海市': '東海', '大府市': '東海', '刈谷市': '刈谷', '知多市': '知多', '岡崎市': '岡崎',
    '安城市': '安城', '西尾市': '西尾', '常滑市': '常滑', '半田市': '半田', '碧南市': '碧南', '豊川市': '豊川',
    '豊橋市': '豊橋', '羽島市': '羽島', '笠松町': '羽島', '岐南町': '羽島', '各務原市': '各務原',
    '北方町': '北方', '本巣市': '北方', '瑞穂市': '北方', '大垣市': '大垣', '海津市': '海津', '可児市': '可児',
    '多治見市': '多治見', '関市': '関', '桑名市': '桑名', '山県市': '山県', '養老町': '養老', '垂井町': '垂井',
  },

  /** 住所から所轄警察署の正式名称を返す（判定できなければ ''） */
  policeNameFromAddress(address) {
    let a = this._norm(address);
    if (!a || a === '同上' || a === '別紙' || a === '-') return '';
    a = a.replace(/^(愛知県|岐阜県|三重県)/, '');
    const m = a.match(/^名古屋市(.{1,2}区)/);
    if (m && this.NAGOYA_WARD[m[1]]) return this.NAGOYA_WARD[m[1]] + '警察署';
    if (a.startsWith('名古屋市')) return '';
    const a2 = a.replace(/^.{1,4}郡/, '');
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
};

if (typeof window !== 'undefined') window.LocationMaster = LocationMaster;
