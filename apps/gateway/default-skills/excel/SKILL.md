---
name: excel
description: "Read, write, edit, format, and analyze Excel files (.xlsx). Create spreadsheets, manipulate data with pandas, apply formatting, manage sheets, create charts, and export to CSV/JSON/Markdown. Use whenever the user works with Excel or spreadsheet data — even if they just mention a .xlsx file, data analysis, or creating a report from tabular data."
---

# Excel

All libraries below are pre-installed in your sandbox. Use them directly — do NOT run pip install.

**Available**: `openpyxl`, `pandas`, `numpy`, `matplotlib`

## Pick the Right Tool

| Task | Best Tool |
|------|-----------|
| Read/write cells, format, merge | `openpyxl` |
| Data analysis, filtering, pivot | `pandas` + `openpyxl` engine |
| Charts and visualizations | `matplotlib` (save as image or embed) |
| CSV ↔ Excel conversion | `pandas` |
| JSON ↔ Excel conversion | `pandas` |

---

## Read Data

### openpyxl — cell-level access

```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx")
ws = wb.active  # or wb["SheetName"]

# Read all rows
for row in ws.iter_rows(min_row=1, values_only=True):
    print(row)

# Read specific cell
print(ws["B5"].value)

# Sheet info
print(f"Sheets: {wb.sheetnames}, Rows: {ws.max_row}, Cols: {ws.max_column}")
```

### pandas — DataFrames (best for analysis)

```python
import pandas as pd

df = pd.read_excel("data.xlsx")                          # first sheet
df = pd.read_excel("data.xlsx", sheet_name="Sales")      # specific sheet
df = pd.read_excel("data.xlsx", sheet_name=None)         # all sheets → dict

print(df.head())
print(df.describe())
```

---

## Create & Write

### openpyxl — new workbook

```python
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "Data"

# Write headers + rows
ws.append(["Name", "Age", "City"])
ws.append(["Alice", 30, "NYC"])
ws.append(["Bob", 25, "LA"])

wb.save("output.xlsx")
```

### pandas — DataFrame to Excel

```python
import pandas as pd

df = pd.DataFrame({
    "Name": ["Alice", "Bob", "Charlie"],
    "Revenue": [50000, 42000, 61000],
    "Growth": [0.12, 0.08, 0.15],
})

# Simple write
df.to_excel("report.xlsx", index=False, sheet_name="Revenue")

# Multiple sheets
with pd.ExcelWriter("report.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Revenue", index=False)
    summary = df.describe()
    summary.to_excel(writer, sheet_name="Summary")
```

---

## Edit Cells

```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx")
ws = wb.active

ws["A1"] = "New Value"
ws["B2"] = 100
ws["C3"] = "=SUM(A1:B2)"      # formula

wb.save("data.xlsx")
```

---

## Formatting

```python
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

wb = load_workbook("data.xlsx")
ws = wb.active

# Header styling
header_font = Font(bold=True, size=12, color="FFFFFF")
header_fill = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
thin_border = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"),
)

for cell in ws[1]:  # first row
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center")
    cell.border = thin_border

# Auto-width columns
for col in ws.columns:
    max_len = max(len(str(cell.value or "")) for cell in col)
    ws.column_dimensions[col[0].column_letter].width = max_len + 2

# Freeze header row
ws.freeze_panes = "A2"

wb.save("data.xlsx")
```

### Number formats

```python
ws["B2"].number_format = '#,##0.00'       # 1,234.56
ws["C2"].number_format = '0.0%'           # 15.0%
ws["D2"].number_format = '$#,##0.00'      # $1,234.56
ws["E2"].number_format = 'YYYY-MM-DD'     # 2026-01-15
```

---

## Sheet Management

```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx")

# Add sheet
ws_new = wb.create_sheet("Summary")
ws_new = wb.create_sheet("First", 0)  # insert at position

# Rename
wb["Sheet1"].title = "Data"

# Copy
source = wb["Data"]
target = wb.copy_worksheet(source)
target.title = "Data Copy"

# Delete
del wb["OldSheet"]

wb.save("data.xlsx")
```

---

## Row & Column Operations

```python
ws.insert_rows(5)           # insert 1 row at row 5
ws.insert_rows(5, 3)        # insert 3 rows at row 5
ws.insert_cols(3)           # insert 1 col at column C
ws.delete_rows(5, 2)        # delete 2 rows starting at row 5
ws.delete_cols(3)           # delete column C

# Merge / unmerge
ws.merge_cells("A1:C1")
ws.unmerge_cells("A1:C1")
```

---

## Charts with matplotlib

openpyxl has built-in chart support, but matplotlib produces better-looking charts. Save as image and insert:

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from openpyxl import load_workbook
from openpyxl.drawing.image import Image

# Create chart
fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(["Q1", "Q2", "Q3", "Q4"], [120, 145, 132, 178], color="#2c3e50")
ax.set_title("Quarterly Revenue ($k)")
ax.set_ylabel("Revenue")
fig.savefig("/tmp/_chart.png", dpi=150, bbox_inches="tight")
plt.close()

# Insert into Excel
wb = load_workbook("report.xlsx")
ws = wb.active
img = Image("/tmp/_chart.png")
ws.add_image(img, "E2")
wb.save("report.xlsx")
```

---

## Conversions

### CSV → Excel

```python
import pandas as pd
df = pd.read_csv("data.csv")
df.to_excel("data.xlsx", index=False)
```

### Excel → CSV

```python
import pandas as pd
df = pd.read_excel("data.xlsx")
df.to_csv("data.csv", index=False)
```

### Excel → JSON

```python
import pandas as pd
df = pd.read_excel("data.xlsx")
df.to_json("data.json", orient="records", indent=2)
```

### JSON → Excel

```python
import pandas as pd
df = pd.read_json("data.json")
df.to_excel("data.xlsx", index=False)
```

### Excel → Markdown table

```python
import pandas as pd
df = pd.read_excel("data.xlsx")
print(df.to_markdown(index=False))
```

---

## Data Analysis with pandas

```python
import pandas as pd

df = pd.read_excel("sales.xlsx")

# Filter
high_rev = df[df["Revenue"] > 50000]

# Group and aggregate
summary = df.groupby("Region").agg(
    total_revenue=("Revenue", "sum"),
    avg_revenue=("Revenue", "mean"),
    count=("Revenue", "count"),
).reset_index()

# Pivot table
pivot = df.pivot_table(values="Revenue", index="Region", columns="Quarter", aggfunc="sum")

# Save results
with pd.ExcelWriter("analysis.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Raw", index=False)
    summary.to_excel(writer, sheet_name="Summary", index=False)
    pivot.to_excel(writer, sheet_name="Pivot")
```

---

## Common Workflows

### Styled report from data

```python
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment

# Write data
df = pd.read_csv("sales.csv")
df.to_excel("report.xlsx", index=False, sheet_name="Sales")

# Style it
wb = load_workbook("report.xlsx")
ws = wb["Sales"]

for cell in ws[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill(start_color="2C3E50", fill_type="solid")
    cell.alignment = Alignment(horizontal="center")

for col in ws.columns:
    max_len = max(len(str(c.value or "")) for c in col)
    ws.column_dimensions[col[0].column_letter].width = max_len + 2

ws.freeze_panes = "A2"
wb.save("report.xlsx")
```

### Find and replace

```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx")
ws = wb.active

for row in ws.iter_rows():
    for cell in row:
        if isinstance(cell.value, str) and "old_text" in cell.value:
            cell.value = cell.value.replace("old_text", "new_text")

wb.save("data.xlsx")
```
