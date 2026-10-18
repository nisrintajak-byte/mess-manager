#!/usr/bin/env python3
"""Generate src/data/countries.json.

Sources (no network needed):
- Country codes: IANA tzdata iso3166.tab (ISO 3166-1 alpha-2)
- Country -> time zones: IANA tzdata zone.tab
- Country -> currency and localized country names (en, ar, ur, hi): Unicode CLDR via Babel
- Currency decimals: ISO 4217 minor units (table below)

Plain text only: no flags or symbols (PRD section 16.1).
Run: python3 scripts/generate-countries.py
"""
import json
import os
from datetime import date

from babel import Locale
from babel.numbers import get_territory_currencies

ZONEINFO = "/usr/share/zoneinfo"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "countries.json")
LANGS = ["en", "ar", "ur", "hi"]

# ISO 4217 minor units that differ from the default of 2.
ISO4217_DECIMALS = {
    **{c: 0 for c in "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF".split()},
    **{c: 3 for c in "BHD IQD JOD KWD LYD OMR TND".split()},
    **{c: 4 for c in "CLF UYW".split()},
}


def read_tab(name):
    with open(os.path.join(ZONEINFO, name), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            yield line.rstrip("\n").split("\t")


def main():
    codes = [row[0] for row in read_tab("iso3166.tab")]
    zones = {}
    for row in read_tab("zone.tab"):
        zones.setdefault(row[0], []).append(row[2])

    locales = {lang: Locale.parse(lang) for lang in LANGS}
    today = date.today()
    countries = []
    for code in codes:
        currencies = get_territory_currencies(code, start_date=today, tender=True)
        tz = sorted(zones.get(code, []))
        if not currencies or not tz:
            continue  # e.g. Antarctica: no currency
        currency = currencies[0]
        names = {lang: locales[lang].territories.get(code, code) for lang in LANGS}
        countries.append({
            "code": code,
            "names": names,
            "currency": currency,
            "decimals": ISO4217_DECIMALS.get(currency, 2),
            "timeZones": tz,
        })

    countries.sort(key=lambda c: c["names"]["en"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(countries, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"wrote {len(countries)} countries to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
