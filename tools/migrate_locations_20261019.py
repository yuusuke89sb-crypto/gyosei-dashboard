# -*- coding: utf-8 -*-
"""場所マスタ統一 移行スクリプト（dry-run / execute）
python migrate_locations.py          -> 分析のみ
python migrate_locations.py --execute -> バックアップ後に本番反映
"""
import json, sys, re, urllib.request, datetime, collections, unicodedata

GAS = 'https://script.google.com/macros/s/AKfycbzCXTuW3RirKhn29PiAZe_VtmGXj22LrBAmO_ztCpmiKuQ_YU8pE2JqoZDoSWEbgm0g/exec'
BACKUP_DIR = r'd:\行政書士\開業\backup'
EXECUTE = '--execute' in sys.argv

def get(t):
    with urllib.request.urlopen(f'{GAS}?type={t}&t={datetime.datetime.now().timestamp()}', timeout=120) as r:
        return json.load(r)

def post(action, data):
    body = json.dumps({'action': action, 'data': data}).encode('utf-8')
    req = urllib.request.Request(GAS, data=body, headers={'Content-Type': 'text/plain'}, method='POST')
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)

# ---------- 正式名称 ----------
OFFICE_ALIASES = {
    '中川陸事': ['愛知運輸支局', '名古屋運輸支局', '中川陸事', '愛知陸事', '中川運輸', '愛知運輸'],
    '岐阜陸事': ['岐阜運輸支局', '岐阜陸事', '岐阜運輸'],
    '小牧陸事': ['小牧自動車検査登録事務所', '小牧陸事', '小牧運輸', '小牧検査登録事務所'],
    '三河陸事': ['西三河自動車検査登録事務所', '三河陸事', '西三河陸事', '西三河運輸'],
    '豊橋陸事': ['豊橋自動車検査登録事務所', '豊橋陸事', '豊橋運輸'],
    '飛騨陸事': ['飛騨自動車検査登録事務所', '飛騨陸事', '飛騨運輸'],
    '三重陸事': ['三重運輸支局', '三重陸事', '三重運輸'],
}
NAGOYA_SHORT = {'東', '西', '北', '中', '南'}
POLICE_ALIASES = {'岐阜羽島': '羽島'}

def norm(s):
    return unicodedata.normalize('NFKC', str(s or '')).replace(' ', '').replace('\u3000', '').strip()

def canonical(name):
    n = norm(name)
    if not n:
        return ''
    for canon, al in OFFICE_ALIASES.items():
        if n in al:
            return canon
    if n.endswith('警察署'):
        base = n[:-3]
    elif n.endswith('署'):
        base = n[:-1]
    else:
        return n  # 警察署・陸事以外はそのまま
    base = re.sub(r'^愛知県', '', base)
    if base.startswith('名古屋') and base[3:] in NAGOYA_SHORT:
        base = base[3:]
    elif base.startswith('愛知') and len(base) > 2:
        base = base[2:]
    base = POLICE_ALIASES.get(base, base)
    return base + '警察署'

# ---------- 住所 -> 警察署（孤立ID救済用） ----------
NAGOYA_WARD = {'中区': '中', '東区': '東', '北区': '北', '西区': '西', '南区': '南', '中村区': '中村', '中川区': '中川',
               '千種区': '千種', '熱田区': '熱田', '名東区': '名東', '瑞穂区': '瑞穂', '昭和区': '昭和', '守山区': '守山',
               '天白区': '天白', '港区': '港', '緑区': '緑'}
CITY = {'一宮市': '一宮', '江南市': '江南', '岩倉市': '江南', '大口町': '江南', '稲沢市': '稲沢', '小牧市': '小牧',
        '犬山市': '犬山', '扶桑町': '犬山', '清須市': '西枇杷島', '北名古屋市': '西枇杷島', '豊山町': '西枇杷島',
        '津島市': '津島', '愛西市': '津島', 'あま市': '津島', '大治町': '津島', '蟹江町': '蟹江', '弥富市': '蟹江',
        '飛島村': '蟹江', '春日井市': '春日井', '瀬戸市': '瀬戸', '東郷町': '愛知', '日進市': '愛知',
        '東海市': '東海', '大府市': '東海', '刈谷市': '刈谷', '豊田市': '豊田', '知多市': '知多', '岡崎市': '岡崎',
        '安城市': '安城', '西尾市': '西尾', '常滑市': '常滑', '半田市': '半田', '碧南市': '碧南', '豊川市': '豊川',
        '豊橋市': '豊橋', '羽島市': '羽島', '笠松町': '羽島', '岐南町': '羽島', '各務原市': '各務原',
        '北方町': '北方', '本巣市': '北方', '瑞穂市': '北方', '大垣市': '大垣', '海津市': '海津', '可児市': '可児',
        '多治見市': '多治見', '関市': '関', '桑名市': '桑名'}
SHORT_KW = {'蟹江': '蟹江', '港': '港', '羽島': '羽島', '豊川': '豊川', '刈谷': '刈谷', '東郷': '愛知'}

def police_from_address(addr):
    a = norm(addr)
    a = re.sub(r'^(愛知県|岐阜県|三重県)', '', a)
    m = re.match(r'^名古屋市(.{1,2}区)', a)
    if m and m.group(1) in NAGOYA_WARD:
        return NAGOYA_WARD[m.group(1)] + '警察署'
    a2 = re.sub(r'^.{1,4}郡', '', a)
    for city, st in sorted(CITY.items(), key=lambda x: -len(x[0])):
        if a2.startswith(city):
            return st + '警察署'
    if a in SHORT_KW:
        return SHORT_KW[a] + '警察署'
    return ''

# ---------- 統一後マスタ ----------
RENAME = {  # 既存ID -> 正式名称
    'LOC-0001': '中川陸事', 'LOC-0002': '小牧陸事', 'LOC-0003': '三河陸事', 'LOC-0004': '豊橋陸事',
    'LOC-0005': '岐阜陸事', 'LOC-0006': '飛騨陸事', 'LOC-0007': '三重陸事', 'LOC-0013': '東警察署',
}
DELETE_NAMES = {'浜松中央', '名古屋市', '岐阜市', '岐阜軽自動車事務所'}
# 追加する警察署（POLICE_FEES 由来・固定ID）
NEW_STATIONS = [
    ('LOC-0101', '蟹江警察署', 8000, '愛知県海部郡蟹江町富吉3-225', '弥富市・飛島村管轄'),
    ('LOC-0102', '瀬戸警察署', 15000, '愛知県瀬戸市原山町1-2', '愛知県警'),
    ('LOC-0103', '愛知警察署', 15000, '愛知県愛知郡東郷町大字諸輪字向泉82', '日進・東郷管轄'),
    ('LOC-0104', '東海警察署', 17000, '愛知県東海市横須賀町天宝新田52-1', '高速代別¥15,000'),
    ('LOC-0105', '刈谷警察署', 18000, '愛知県刈谷市寿町1-303', '高速代別¥15,000'),
    ('LOC-0106', '知多警察署', 20000, '愛知県知多市緑町30-1', '高速代別¥15,000'),
    ('LOC-0107', '安城警察署', 20000, '愛知県安城市横山町下毛賀知117', '高速代別¥16,000'),
    ('LOC-0108', '西尾警察署', 22000, '愛知県西尾市寄住町下田14', '高速代別¥18,000'),
    ('LOC-0109', '常滑警察署', 22000, '愛知県常滑市蛇草1-6', '高速代別¥18,000'),
    ('LOC-0110', '半田警察署', 22000, '愛知県半田市出口町1-180', '高速代別¥17,000'),
    ('LOC-0111', '碧南警察署', 22000, '愛知県碧南市松本町26-1', '高速代別¥18,000'),
    ('LOC-0112', '豊川警察署', 15000, '愛知県豊川市諏訪3-245', '高速代別'),
    ('LOC-0113', '南警察署', 10000, '愛知県名古屋市南区寺部通2-20', '愛知県警'),
    ('LOC-0114', '中村警察署', 7000, '愛知県名古屋市中村区椿町17-9', '愛知県警'),
    ('LOC-0115', '名東警察署', 9000, '愛知県名古屋市名東区猪高台2-1009', '愛知県警'),
    ('LOC-0116', '瑞穂警察署', 9000, '愛知県名古屋市瑞穂区瑞穂通2-22', '愛知県警'),
    ('LOC-0117', '昭和警察署', 9000, '愛知県名古屋市昭和区広路通5-11', '愛知県警'),
    ('LOC-0118', '港警察署', 10000, '愛知県名古屋市港区入船2-4-8', '愛知県警'),
    ('LOC-0119', '緑警察署', 10000, '愛知県名古屋市緑区青山3-20', '愛知県警'),
    ('LOC-0120', '岐阜北警察署', 6000, '岐阜県岐阜市上土居2-2-22', '岐阜県警'),
    ('LOC-0121', '山県警察署', 7000, '岐阜県山県市高富2378-2', '岐阜県警'),
    ('LOC-0122', '海津警察署', 8000, '岐阜県海津市海津町福岡341-2', '岐阜県警'),
    ('LOC-0123', '養老警察署', 10000, '岐阜県養老郡養老町石畑1115-1', '大垣市上石津管轄'),
    ('LOC-0124', '垂井警察署', 10000, '岐阜県不破郡垂井町1533-9', '岐阜県警'),
]

def main():
    print('取得中...')
    allD = get('all')
    locs = allD.get('locations', [])
    cases = allD.get('cases', [])
    print(f'場所 {len(locs)} 件 / 案件 {len(cases)} 件')

    # 統一後マスタを構築
    final = {}      # id -> loc
    name2id = {}    # canonical -> id
    remap = {}      # old id -> new id or ''
    to_delete, to_upsert = [], []
    # LOC-xxxx を優先して残す
    ordered = sorted(locs, key=lambda l: (0 if str(l.get('id', '')).startswith('LOC-') else 1, str(l.get('createdAt') or ''), str(l.get('id'))))
    for l in ordered:
        lid = l['id']
        if norm(l.get('name')) in DELETE_NAMES:
            remap[lid] = None  # 個別判定
            to_delete.append(l)
            continue
        cname = RENAME.get(lid) or canonical(l.get('name'))
        if cname in name2id:
            remap[lid] = name2id[cname]
            to_delete.append(l)
            continue
        name2id[cname] = lid
        nl = dict(l, name=cname)
        final[lid] = nl
        remap[lid] = lid
        if cname != l.get('name'):
            to_upsert.append(nl)
    for nid, nm, fee, addr, memo in NEW_STATIONS:
        if nm in name2id:
            continue
        nl = {'id': nid, 'name': nm, 'syakoFee': fee, 'address': addr, 'memo': memo}
        final[nid] = nl
        name2id[nm] = nid
        to_upsert.append(nl)

    # 案件の付け替え
    patches, report, unresolved, mismatch = [], collections.Counter(), [], []
    for c in cases:
        fields = {}
        cp_old = c.get('carPolice') or ''
        cp_new = canonical(cp_old) if cp_old else ''
        if cp_new and cp_new != cp_old:
            fields['carPolice'] = cp_new
        for f in ('policeLocationId', 'landTransportLocationId', 'surveyLocationId'):
            old = c.get(f) or ''
            if not old:
                continue
            new = remap.get(old, 'ORPHAN')
            if new in ('ORPHAN', None):
                guess = ''
                if f == 'policeLocationId':
                    if cp_new and cp_new in name2id:
                        guess = name2id[cp_new]
                    else:
                        st = police_from_address(c.get('parkingAddress') or c.get('carAddress') or '')
                        guess = name2id.get(st, '')
                if not guess:
                    unresolved.append((c['id'], f, old, cp_old, (c.get('parkingAddress') or c.get('carAddress') or '')[:20]))
                new = guess
                report[f'{f}: {old} -> {final[new]["name"] if new else "(空欄)"}'] += 1
            elif new != old:
                report[f'{f}: {old} -> {final[new]["name"]}'] += 1
            if new != old:
                fields[f] = new
        # 不一致チェック（参考）
        pid = fields.get('policeLocationId', c.get('policeLocationId'))
        if pid and cp_new and pid in final and final[pid]['name'].endswith('警察署') and final[pid]['name'] != cp_new:
            mismatch.append((c['id'], c.get('category'), final[pid]['name'], cp_new))
        if fields:
            patches.append({'id': c['id'], 'fields': fields})

    print('\n=== 名称変更・追加する場所 ===')
    for l in to_upsert:
        print(f"  {l['id']}: {l['name']}")
    print('\n=== 削除する場所 ===')
    for l in to_delete:
        print(f"  {l['id']}: {l.get('name')}  -> {final[remap[l['id']]]['name'] if remap.get(l['id']) else '(案件ごとに判定)'}")
    print('\n=== 案件の付け替え ===')
    for k, v in sorted(report.items()):
        print(f'  {k}: {v}件')
    cpc = collections.Counter((c.get('carPolice'), canonical(c.get('carPolice'))) for c in cases if c.get('carPolice') and canonical(c.get('carPolice')) != c.get('carPolice'))
    print('\n=== 所轄警察署欄の表記統一 ===')
    for (a, b), v in cpc.items():
        print(f'  {a} -> {b}: {v}件')
    print(f'\n更新対象案件: {len(patches)}件')
    print(f'\n=== 判定できず空欄になるもの: {len(unresolved)}件 ===')
    for u in unresolved:
        print('  ', u)
    print(f'\n=== 参考: 場所IDと所轄警察署欄が食い違う案件: {len(mismatch)}件 ===')
    for m in mismatch:
        print('  ', m)

    if not EXECUTE:
        print('\n(dry-run のため反映していません)')
        return

    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    bpath = f'{BACKUP_DIR}\\場所マスタ統一前_全データ_{ts}.json'
    with open(bpath, 'w', encoding='utf-8') as fp:
        json.dump(allD, fp, ensure_ascii=False)
    print('\nバックアップ:', bpath)

    for l in to_upsert:
        r = post('upsertLocation', l)
        print('upsertLocation', l['id'], l['name'], r.get('action') or r)
    now = datetime.datetime.utcnow().isoformat(timespec='milliseconds') + 'Z'
    for i in range(0, len(patches), 100):
        chunk = patches[i:i + 100]
        items = [{'id': p['id'], 'fields': p['fields'], 'fieldTs': {k: now for k in p['fields']}} for p in chunk]
        r = post('patchCases', {'items': items})
        res = r.get('results', [])
        bad = [x for x in res if x.get('status') not in ('updated',) or x.get('rejected')]
        print(f'patchCases {i}-{i + len(chunk)}: {len(res)}件, 問題 {len(bad)}件', bad[:3] if bad else '', r.get('error', ''))
    for l in to_delete:
        r = post('deleteLocation', {'id': l['id']})
        print('deleteLocation', l['id'], l.get('name'), r.get('success', r))
    print('\n完了')

if __name__ == '__main__':
    main()
