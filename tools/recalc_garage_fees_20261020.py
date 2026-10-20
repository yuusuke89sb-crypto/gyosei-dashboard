# -*- coding: utf-8 -*-
"""車庫証明（一般）の新単価計算（軽=半額千円切上+1000 / 申請のみ・受取のみ=半額千円切上）
起動時の自動一括反映(applyLatestPoliceFeesToCases)と同じ条件で、報酬額が変わる案件を一覧表示する。
--apply を付けると patchCases で本番反映（事前にバックアップを保存）。
"""
import json, re, sys, math, urllib.request, datetime, os

GAS = "https://script.google.com/macros/s/AKfycbzCXTuW3RirKhn29PiAZe_VtmGXj22LrBAmO_ztCpmiKuQ_YU8pE2JqoZDoSWEbgm0g/exec"
APPLY_ONLY_RE = re.compile(r"(申請(代行)?のみ|受取のみ|受け取りのみ|受領のみ|交付のみ)")


def get(t):
    with urllib.request.urlopen(GAS + "?type=" + t, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def s(v):
    return "" if v is None else str(v)


def main():
    data = get("all")
    d = data.get("data", data)
    cases = d.get("cases") or []
    locs = d.get("locations") or []
    clients = {c.get("id"): c for c in (d.get("customers") or d.get("clients") or []) if c}
    inv = d.get("invoices") or {}
    invoiced = {}
    for it in (inv.get("items") or []):
        if it and s(it.get("status")) == "有効":
            invoiced[s(it.get("caseId"))] = s(it.get("invoiceNo"))

    def is_toyota(c):
        cl = clients.get(c.get("clientId"))
        if cl:
            n = (s(cl.get("companyName")) + " " + s(cl.get("name")) + " " + s(cl.get("tradeName"))).upper()
            if any(k in n for k in ("トヨタ", "TOYOTA", "WEST", "キャラット")):
                return True
        t = (s(c.get("clientName")) + " " + s(c.get("title")) + " " + s(c.get("memo"))).upper()
        return any(k in t for k in ("トヨタ", "TOYOTA", "WEST", "キャラット"))

    def find_loc(c):
        pid = c.get("policeLocationId")
        if pid:
            for l in locs:
                if l and s(l.get("id")) == s(pid):
                    return l
        cp = c.get("carPolice")
        if cp and isinstance(cp, str):
            p = re.sub(r"\s+", "", cp)
            for l in locs:
                if not l or not l.get("name"):
                    continue
                ln = re.sub(r"\s+", "", l["name"])
                if ln.replace("警察署", "", 1) in p or p.replace("警察署", "", 1) in ln:
                    return l
        addr = re.sub(r"\s+", "", s(c.get("parkingAddress") or c.get("carAddress")))
        if addr:
            for l in locs:
                if not l or not l.get("name"):
                    continue
                city = l["name"].replace("警察署", "", 1).strip()
                if city and len(city) >= 2 and city in addr:
                    return l
        return None

    rows = []
    for c in cases:
        if not c:
            continue
        cat = s(c.get("category"))
        title, memo = s(c.get("title")), s(c.get("memo"))
        is_oss = cat == "garage_oss" or "OSS" in title.upper() or "OSS" in memo.upper()
        if is_oss:
            continue
        is_reg_light = cat == "car_reg_light" or "軽登録" in title or "軽自動車" in title
        is_garage = (not is_reg_light) and (cat == "garage_paper" or (("車庫" in title or "車庫" in memo) and cat not in ("car_reg_standard", "seal")))
        if not is_garage:
            continue  # 軽自動車登録は計算式変更なし
        if c.get("invoiceLocked") or s(c.get("id")) in invoiced or s(c.get("invoiceNo")):
            continue
        if not is_toyota(c):
            continue
        reg = s(c.get("registeredAt")) or s(c.get("createdAt"))[:10]
        if not (reg >= "2026-08-26" or c.get("status") != "done"):
            continue
        loc = find_loc(c)
        if not loc or not loc.get("syakoFee") or float(loc["syakoFee"]) <= 0:
            continue
        full = int(float(loc["syakoFee"]))
        advs = c.get("advances") or []
        if isinstance(advs, str):
            try:
                advs = json.loads(advs)
            except Exception:
                advs = []
        adv = " ".join(s(a.get("label")) for a in advs if isinstance(a, dict))
        is_light = c.get("carType") == "light" or any("軽" in x for x in (title, memo, s(c.get("subCategory")), s(c.get("remarks")), adv))
        apply_only = (not is_light) and bool(APPLY_ONLY_RE.search(" ".join([title, memo, s(c.get("remarks")), s(c.get("subCategory")), adv])))
        old_t = (round(full / 2 + 1e-9) + 1000) if is_light else full
        half_up = math.ceil(full / 2 / 1000) * 1000
        new_t = half_up + 1000 if is_light else (half_up if apply_only else full)
        cur = int(float(c.get("fee"))) if s(c.get("fee")) != "" else 0
        if cur != new_t:
            rows.append({
                "id": c["id"], "title": title, "police": loc["name"], "full": full,
                "kind": "軽" if is_light else ("申請/受取のみ" if apply_only else "通常"),
                "cur": cur, "new": new_t, "invoiceNo": s(c.get("invoiceNo")), "reg": reg,
                "status": s(c.get("status")),
            })

    for r in rows:
        flag = "  ※請求書番号あり:" + r["invoiceNo"] if r["invoiceNo"] else ""
        print(f'{r["reg"]} | {r["kind"]} | {r["title"]} | {r["police"]}(¥{r["full"]:,}) | ¥{r["cur"]:,} → ¥{r["new"]:,}{flag}')
    print("対象件数:", len(rows))

    if "--apply" in sys.argv:
        targets = [r for r in rows if not r["invoiceNo"]]
        bk = os.path.join(os.path.dirname(__file__), "..", "..", "backup",
                          "車庫単価再計算前_全データ_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".json")
        with open(bk, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print("backup:", os.path.abspath(bk))
        now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
        items = [{"id": r["id"], "fields": {"fee": r["new"]}, "fieldTs": {"fee": now}} for r in targets]
        body = json.dumps({"action": "patchCases", "data": {"items": items}}).encode("utf-8")
        req = urllib.request.Request(GAS, data=body, headers={"Content-Type": "text/plain"})
        with urllib.request.urlopen(req, timeout=120) as r:
            print(r.read().decode("utf-8")[:500])


if __name__ == "__main__":
    main()
