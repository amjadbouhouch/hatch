---
name: pdf
description: "Read, create, edit, merge, split, OCR, and convert PDF documents. Use whenever the user works with PDF files — extracting text or tables, generating reports, converting HTML to PDF, OCR on scanned documents, merging/splitting, adding watermarks, or any PDF manipulation. Even if the user just says 'make me a report' or 'pull the data from this file', if a PDF is involved, use this skill."
---

# PDF Processing

All libraries below are pre-installed in your sandbox. Use them directly — do NOT run pip install.

## Pick the Right Tool

| Task | Best Tool |
|------|-----------|
| Extract text (digital PDF) | `pdfplumber` or `pdftotext` CLI |
| Extract tables → DataFrame | `pdfplumber` + `pandas` |
| OCR scanned PDFs | `pytesseract` + `pdf2image` |
| Create styled PDF from HTML/CSS | `weasyprint` |
| Create PDF programmatically | `reportlab` |
| Merge / split | `pypdf` or `qpdf` CLI |
| Rotate, encrypt, metadata | `pypdf` |
| Extract images from PDF | `pdfimages` CLI (poppler) |
| Fast CLI text extraction | `pdftotext` CLI (poppler) |

---

## Extract Text

### pdfplumber — structured text and tables

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        print(page.extract_text())
```

### Extract tables → Excel

```python
import pdfplumber
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    tables = []
    for page in pdf.pages:
        for table in page.extract_tables():
            if table:
                df = pd.DataFrame(table[1:], columns=table[0])
                tables.append(df)

if tables:
    combined = pd.concat(tables, ignore_index=True)
    combined.to_excel("extracted.xlsx", index=False)
```

### pdftotext CLI — fast, preserves layout

```bash
pdftotext input.pdf output.txt
pdftotext -layout input.pdf output.txt        # preserve layout
pdftotext -f 1 -l 5 input.pdf output.txt      # pages 1–5 only
```

### pypdf — basic extraction

```python
from pypdf import PdfReader

reader = PdfReader("document.pdf")
text = "\n".join(page.extract_text() for page in reader.pages)
```

---

## OCR Scanned PDFs

```python
import pytesseract
from pdf2image import convert_from_path

images = convert_from_path("scanned.pdf")
text = ""
for i, img in enumerate(images):
    text += f"--- Page {i+1} ---\n"
    text += pytesseract.image_to_string(img)
    text += "\n\n"
```

---

## Create PDFs

### weasyprint — HTML/CSS to PDF (best for styled reports)

```python
import weasyprint

html = """
<html>
<style>
  body { font-family: sans-serif; margin: 2cm; }
  h1 { color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; margin-top: 1em; }
  th { background: #2c3e50; color: white; padding: 10px; text-align: left; }
  td { border: 1px solid #ddd; padding: 8px; }
  tr:nth-child(even) { background: #f9f9f9; }
</style>
<body>
  <h1>Monthly Report</h1>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Revenue</td><td>$50,000</td></tr>
    <tr><td>Growth</td><td>+12%</td></tr>
  </table>
</body>
</html>
"""
weasyprint.HTML(string=html).write_pdf("report.pdf")

# From an HTML file:
weasyprint.HTML(filename="report.html").write_pdf("report.pdf")
```

### reportlab — programmatic PDF creation

```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

story.append(Paragraph("Report Title", styles['Title']))
story.append(Spacer(1, 12))
story.append(Paragraph("Body text goes here.", styles['Normal']))
story.append(Spacer(1, 12))

# Table
data = [['Name', 'Age', 'City'], ['Alice', '30', 'NYC'], ['Bob', '25', 'LA']]
t = Table(data)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(t)
doc.build(story)
```

### Embed matplotlib charts in PDF

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.platypus import SimpleDocTemplate, Image, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

fig, ax = plt.subplots(figsize=(6, 4))
ax.bar(['Q1', 'Q2', 'Q3', 'Q4'], [120, 145, 132, 178])
ax.set_title('Quarterly Revenue')
fig.savefig("/tmp/_chart.png", dpi=150, bbox_inches='tight')
plt.close()

doc = SimpleDocTemplate("report.pdf")
styles = getSampleStyleSheet()
story = [
    Paragraph("Revenue Report", styles['Title']),
    Image("/tmp/_chart.png", width=400, height=250),
]
doc.build(story)
```

---

## Merge & Split

### pypdf

```python
from pypdf import PdfReader, PdfWriter

# Merge
writer = PdfWriter()
for f in ["doc1.pdf", "doc2.pdf"]:
    for page in PdfReader(f).pages:
        writer.add_page(page)
with open("merged.pdf", "wb") as out:
    writer.write(out)

# Split — one page per file
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    w = PdfWriter()
    w.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as out:
        w.write(out)
```

### qpdf CLI (fast)

```bash
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf     # merge
qpdf input.pdf --pages . 1-5 -- first5.pdf                  # extract pages
qpdf input.pdf --rotate=+90:1 output.pdf                    # rotate page 1
qpdf --password=secret --decrypt encrypted.pdf decrypted.pdf # decrypt
```

---

## Other Operations

### Rotate

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.rotate(90)
    writer.add_page(page)
with open("rotated.pdf", "wb") as f:
    writer.write(f)
```

### Encrypt / password-protect

```python
from pypdf import PdfReader, PdfWriter

writer = PdfWriter()
for page in PdfReader("input.pdf").pages:
    writer.add_page(page)
writer.encrypt("password")
with open("protected.pdf", "wb") as f:
    writer.write(f)
```

### Watermark

```python
from pypdf import PdfReader, PdfWriter

watermark = PdfReader("watermark.pdf").pages[0]
reader = PdfReader("document.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)
with open("watermarked.pdf", "wb") as f:
    writer.write(f)
```

### Extract images from PDF

```bash
pdfimages -j input.pdf output_prefix
# → output_prefix-000.jpg, output_prefix-001.jpg, ...
```

### Metadata

```python
from pypdf import PdfReader
meta = PdfReader("document.pdf").metadata
print(f"Title: {meta.title}, Author: {meta.author}, Pages: {len(PdfReader('document.pdf').pages)}")
```
