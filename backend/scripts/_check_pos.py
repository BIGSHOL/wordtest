"""Final POS classification audit with safety check."""
import sys
sys.path.insert(0, ".")

import xlrd
from app.utils.load_words import XLS_PATH, BOOK_LEVEL_MAP, classify_expression

wb = xlrd.open_workbook(str(XLS_PATH), encoding_override="cp949")
sheet = wb.sheet_by_index(0)

results = {"구동사": [], "관용구": [], "숙어": [], None: []}

for r in range(sheet.nrows):
    book = str(sheet.cell_value(r, 0)).strip()
    english = str(sheet.cell_value(r, 2)).strip()
    korean = str(sheet.cell_value(r, 3)).strip()
    pos = str(sheet.cell_value(r, 4)).strip() or None if sheet.ncols > 4 else None

    level = BOOK_LEVEL_MAP.get(book)
    if level is None or not english or not korean:
        continue

    if not pos and ("~" in english or " " in english):
        cls = classify_expression(english)
        results.setdefault(cls, []).append({"english": english, "korean": korean, "level": level})

# Show only skipped
items = results.get(None, [])
print(f"SKIPPED ({len(items)}개) - ALL:")
for w in items:
    print(f"  {w['english']:35s} | {w['korean']}")

total = sum(len(v) for v in results.values())
classified = total - len(items)
print(f"\nTotal: {total} | Classified: {classified} | Skipped: {len(items)}")
