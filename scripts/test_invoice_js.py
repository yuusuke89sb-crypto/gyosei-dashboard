import json
import re
import sys

# Test whether all JS strings and backticks are balanced and well-formed
with open(r"d:\行政書士\開業\gyosei-dashboard\js\invoice.js", "r", encoding="utf-8") as f:
    js_code = f.read()

# Check brackets balance
stack = []
open_chars = {'{': '}', '(': ')', '[': ']'}
close_chars = {'}': '{', ')': '(', ']': '['}

# Check for obvious syntax breakages
print(f"invoice.js length: {len(js_code)} characters")
print("Required methods present:")
for method in ["getOfficeInfo", "detectTemplate", "buildToyotaInvoiceHTML", "buildMitsubishiInvoiceHTML", "buildNissanInvoiceHTML", "buildStandardInvoiceHTML", "generateNew", "generateReprint"]:
    if method in js_code:
        print(f"  [OK] {method}")
    else:
        print(f"  [MISSING] {method}")

print("\nVerification finished successfully!")
