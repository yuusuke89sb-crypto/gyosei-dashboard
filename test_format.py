import sys
sys.stdout.reconfigure(encoding='utf-8')

# 半角カタカナを連想に使ったテストCSV
line = '22,"2","ﾃｽﾄ2","テスト第二トヨタ","テスト2",1,0'
content = line + '\r\n'

with open(r'D:\行政書士\開業\gyosei-dashboard\取引先テスト3.csv', 'wb') as f:
    f.write(content.encode('cp932'))

print('OK:', line)
print()

# 全角カタカナ→半角カタカナ変換テスト
ZENKAKU = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴー'
HANKAKU = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｶﾞｷﾞｸﾞｹﾞｺﾞｻﾞｼﾞｽﾞｾﾞｿﾞﾀﾞﾁﾞﾂﾞﾃﾞﾄﾞﾊﾞﾋﾞﾌﾞﾍﾞﾎﾞﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟｳﾞｰ'

# テスト
test = 'ヨシムラユウスケ'
result = ''
for ch in test:
    idx = ZENKAKU.find(ch)
    if idx >= 0:
        result += HANKAKU[idx]
    else:
        result += ch
print(f'変換テスト: {test} → {result}')
