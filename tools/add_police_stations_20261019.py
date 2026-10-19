# -*- coding: utf-8 -*-
"""愛知県警45署・岐阜県警22署のうち、場所マスタに未登録の警察署を追加する（2026-10-19）
python add_police_stations_20261019.py           -> 確認のみ
python add_police_stations_20261019.py --execute -> 本番反映
"""
import json, sys, urllib.request, datetime

GAS = 'https://script.google.com/macros/s/AKfycbzCXTuW3RirKhn29PiAZe_VtmGXj22LrBAmO_ztCpmiKuQ_YU8pE2JqoZDoSWEbgm0g/exec'
EXECUTE = '--execute' in sys.argv

NEW = [  # id, 名称, 所在地, 備考（管轄区域）
    ('LOC-0125', '中部空港警察署', '愛知県常滑市セントレア', '管轄：常滑市セントレア（中部国際空港島）'),
    ('LOC-0126', '足助警察署', '愛知県豊田市岩神町仲田', '管轄：豊田市のうち旧足助町・下山村・旭町・稲武町'),
    ('LOC-0127', '設楽警察署', '愛知県北設楽郡設楽町田口字小貝津', '管轄：設楽町・東栄町・豊根村'),
    ('LOC-0128', '新城警察署', '愛知県新城市片山字東野畑', '管轄：新城市'),
    ('LOC-0129', '蒲郡警察署', '愛知県蒲郡市緑町', '管轄：蒲郡市'),
    ('LOC-0130', '田原警察署', '愛知県田原市加治町東天神', '管轄：田原市'),
    ('LOC-0131', '郡上警察署', '岐阜県郡上市八幡町中坪', '管轄：郡上市'),
    ('LOC-0132', '中津川警察署', '岐阜県中津川市かやの木町', '管轄：中津川市'),
    ('LOC-0133', '恵那警察署', '岐阜県恵那市長島町正家', '管轄：恵那市'),
    ('LOC-0134', '高山警察署', '岐阜県高山市大新町', '管轄：高山市・白川村'),
    ('LOC-0135', '飛騨警察署', '岐阜県飛騨市古川町朝開町', '管轄：飛騨市'),
    ('LOC-0136', '下呂警察署', '岐阜県下呂市萩原町萩原', '管轄：下呂市'),
]
MEMO_FIX = {'LOC-0103': '管轄：豊明市・日進市・長久手市・東郷町'}

def post(action, data):
    req = urllib.request.Request(GAS, data=json.dumps({'action': action, 'data': data}).encode('utf-8'),
                                 headers={'Content-Type': 'text/plain'}, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

with urllib.request.urlopen(f'{GAS}?type=locations&t={datetime.datetime.now().timestamp()}', timeout=120) as r:
    locs = json.load(r).get('locations', [])
names = {l.get('name') for l in locs}
ids = {l.get('id') for l in locs}
print('現在の場所マスタ:', len(locs), '件')
todo = [n for n in NEW if n[1] not in names and n[0] not in ids]
for n in todo:
    print('追加:', n[0], n[1])
for lid, memo in MEMO_FIX.items():
    print('備考修正:', lid, memo)
if not EXECUTE:
    print('(確認のみ)')
    sys.exit(0)
for lid, nm, addr, memo in todo:
    r = post('upsertLocation', {'id': lid, 'name': nm, 'address': addr, 'memo': memo, 'syakoFee': ''})
    print(lid, nm, r.get('action') or r)
for lid, memo in MEMO_FIX.items():
    r = post('upsertLocation', {'id': lid, 'memo': memo})
    print(lid, r.get('action') or r)
print('完了')
