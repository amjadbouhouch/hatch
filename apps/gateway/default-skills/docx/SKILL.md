---
name: docx
description: "Read, create, and edit Word documents (.docx). Extract text and tables, create professional documents with headings/paragraphs/tables/images, apply styling and formatting. Use whenever the user works with Word files — creating reports, letters, proposals, extracting content from .docx files, or converting between formats. Even if they just say 'write a document' or 'make a report', if the output is .docx, use this skill."
---

# Word Documents (.docx)

`python-docx` is pre-installed in your sandbox. Use it directly — do NOT run pip install.

Also available: `pandas` (for table data), `matplotlib` (for chart images), `Pillow` (for image manipulation).

---

## Read Documents

### Extract all text

```python
from docx import Document

doc = Document("input.docx")

for para in doc.paragraphs:
    print(para.text)
```

### Extract with structure (headings, styles)

```python
from docx import Document

doc = Document("input.docx")

for para in doc.paragraphs:
    if para.style.name.startswith("Heading"):
        level = para.style.name.replace("Heading ", "")
        print(f"[H{level}] {para.text}")
    elif para.text.strip():
        print(para.text)
```

### Extract tables

```python
from docx import Document
import pandas as pd

doc = Document("input.docx")

for i, table in enumerate(doc.tables):
    data = [[cell.text for cell in row.cells] for row in table.rows]
    df = pd.DataFrame(data[1:], columns=data[0])
    print(f"Table {i+1}:")
    print(df.to_markdown(index=False))
```

---

## Create Documents

### Basic document

```python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
title = doc.add_heading("Monthly Report", level=0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Subtitle / date
sub = doc.add_paragraph("March 2026")
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_paragraph()  # spacer

# Section
doc.add_heading("Executive Summary", level=1)
doc.add_paragraph(
    "Revenue grew 12% quarter-over-quarter, driven by strong performance "
    "in the enterprise segment."
)

# Bullet list
doc.add_heading("Key Highlights", level=2)
items = ["Revenue: $2.4M (+12%)", "New customers: 47", "Churn rate: 1.8%"]
for item in items:
    doc.add_paragraph(item, style="List Bullet")

doc.save("report.docx")
```

### Add a table

```python
from docx import Document
from docx.shared import Inches, Pt, Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()
doc.add_heading("Sales Report", level=1)

# Create table
headers = ["Region", "Revenue", "Growth"]
rows = [
    ["North", "$1.2M", "+15%"],
    ["South", "$800K", "+8%"],
    ["East", "$950K", "+12%"],
    ["West", "$1.1M", "+10%"],
]

table = doc.add_table(rows=1, cols=len(headers))
table.style = "Light Grid Accent 1"

# Header row
for i, h in enumerate(headers):
    table.rows[0].cells[i].text = h

# Data rows
for row_data in rows:
    row = table.add_row()
    for i, val in enumerate(row_data):
        row.cells[i].text = val

doc.save("sales.docx")
```

### From pandas DataFrame

```python
from docx import Document
import pandas as pd

df = pd.read_csv("data.csv")  # or pd.read_excel("data.xlsx")
doc = Document()
doc.add_heading("Data Report", level=1)

# DataFrame → table
table = doc.add_table(rows=1, cols=len(df.columns))
table.style = "Light Grid Accent 1"

for i, col in enumerate(df.columns):
    table.rows[0].cells[i].text = str(col)

for _, row_data in df.iterrows():
    row = table.add_row()
    for i, val in enumerate(row_data):
        row.cells[i].text = str(val)

doc.save("report.docx")
```

### Add images

```python
from docx import Document
from docx.shared import Inches

doc = Document()
doc.add_heading("Report with Chart", level=1)
doc.add_paragraph("See the chart below:")
doc.add_picture("chart.png", width=Inches(5.5))
doc.save("report.docx")
```

### Embed matplotlib chart

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from docx import Document
from docx.shared import Inches

fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(["Q1", "Q2", "Q3", "Q4"], [120, 145, 132, 178], color="#2c3e50")
ax.set_title("Quarterly Revenue ($k)")
fig.savefig("/tmp/_chart.png", dpi=150, bbox_inches="tight")
plt.close()

doc = Document()
doc.add_heading("Revenue Report", level=1)
doc.add_picture("/tmp/_chart.png", width=Inches(5.5))
doc.save("report.docx")
```

---

## Formatting & Styling

### Paragraph formatting

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
p.paragraph_format.space_after = Pt(12)
p.paragraph_format.line_spacing = 1.5

# Mixed formatting in one paragraph
run = p.add_run("Bold text ")
run.bold = True
run.font.size = Pt(14)

run2 = p.add_run("and normal text with ")
run2.font.size = Pt(12)

run3 = p.add_run("colored text.")
run3.font.color.rgb = RGBColor(0x2C, 0x3E, 0x50)

doc.save("styled.docx")
```

### Page setup

```python
from docx import Document
from docx.shared import Inches

doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
```

### Headers and footers

```python
from docx import Document

doc = Document()
section = doc.sections[0]

header = section.header
header.paragraphs[0].text = "Company Name — Confidential"

footer = section.footer
footer.paragraphs[0].text = "Page "
# Page numbers require XML manipulation for auto-numbering
```

---

## Common Workflows

### Convert DOCX → plain text

```python
from docx import Document

doc = Document("input.docx")
text = "\n".join(p.text for p in doc.paragraphs)
with open("output.txt", "w") as f:
    f.write(text)
```

### Extract tables → Excel

```python
from docx import Document
import pandas as pd

doc = Document("input.docx")
with pd.ExcelWriter("tables.xlsx") as writer:
    for i, table in enumerate(doc.tables):
        data = [[cell.text for cell in row.cells] for row in table.rows]
        df = pd.DataFrame(data[1:], columns=data[0])
        df.to_excel(writer, sheet_name=f"Table_{i+1}", index=False)
```

### Template-based document (find & replace)

```python
from docx import Document

doc = Document("template.docx")

replacements = {
    "{{NAME}}": "Acme Corp",
    "{{DATE}}": "March 28, 2026",
    "{{AMOUNT}}": "$15,000",
}

for para in doc.paragraphs:
    for key, value in replacements.items():
        if key in para.text:
            for run in para.runs:
                if key in run.text:
                    run.text = run.text.replace(key, value)

doc.save("filled.docx")
```

### Merge multiple DOCX files

```python
from docx import Document
from docx.oxml.ns import qn

def merge_docs(files, output):
    merged = Document(files[0])
    for f in files[1:]:
        merged.add_page_break()
        sub = Document(f)
        for element in sub.element.body:
            merged.element.body.append(element)
    merged.save(output)

merge_docs(["part1.docx", "part2.docx", "part3.docx"], "merged.docx")
```

---

## Available Table Styles

Common built-in styles: `"Table Grid"`, `"Light Grid Accent 1"` through `"Light Grid Accent 6"`, `"Light Shading"`, `"Medium Shading 1"`, `"Medium Grid 1"`.

To list all available styles:
```python
from docx import Document
doc = Document()
for style in doc.styles:
    if style.type == 3:  # TABLE style type
        print(style.name)
```
