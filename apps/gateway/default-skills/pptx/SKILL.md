---
name: pptx
description: "Create, read, and edit PowerPoint presentations (.pptx). Build slide decks with titles, bullet points, tables, charts, and images. Use whenever the user wants to create a presentation, pitch deck, report slides, or modify an existing .pptx file. Even if they just say 'make me a deck' or 'create slides for this', use this skill."
---

# PowerPoint Presentations (.pptx)

`python-pptx` is pre-installed in your sandbox. Use it directly — do NOT run pip install.

Also available: `pandas` (for table data), `matplotlib` (for chart images), `Pillow` (for image manipulation).

---

## Create a Presentation

### Basic deck

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

prs = Presentation()

# Title slide
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "Quarterly Review"
slide.placeholders[1].text = "Q1 2026 — Sales Team"

# Content slide with bullets
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Key Highlights"
body = slide.placeholders[1].text_frame
body.text = "Revenue grew 12% QoQ"
body.add_paragraph().text = "47 new enterprise customers"
body.add_paragraph().text = "Churn rate down to 1.8%"

prs.save("review.pptx")
```

### Slide layouts reference

| Index | Layout Name | Use For |
|-------|-------------|---------|
| 0 | Title Slide | Opening slide with title + subtitle |
| 1 | Title and Content | Title + bullet points (most common) |
| 2 | Section Header | Section dividers |
| 3 | Two Content | Side-by-side content |
| 4 | Comparison | Two columns with headers |
| 5 | Title Only | Title + custom content |
| 6 | Blank | Fully custom layout |

---

## Text & Formatting

### Styled text

```python
from pptx import Presentation
from pptx.util import Pt, Inches
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])  # Title Only

# Title
slide.shapes.title.text = "Styled Content"

# Text box with formatting
txBox = slide.shapes.add_textbox(Inches(1), Inches(2), Inches(8), Inches(3))
tf = txBox.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
p.alignment = PP_ALIGN.LEFT
run = p.add_run()
run.text = "Bold heading"
run.font.bold = True
run.font.size = Pt(24)
run.font.color.rgb = RGBColor(0x2C, 0x3E, 0x50)

p2 = tf.add_paragraph()
p2.space_before = Pt(12)
run2 = p2.add_run()
run2.text = "Normal body text with details."
run2.font.size = Pt(14)
run2.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

prs.save("styled.pptx")
```

### Bullet levels

```python
from pptx.util import Pt

body = slide.placeholders[1].text_frame
body.text = "Top-level point"

p = body.add_paragraph()
p.text = "Sub-point"
p.level = 1

p2 = body.add_paragraph()
p2.text = "Sub-sub-point"
p2.level = 2
```

---

## Tables

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Sales by Region"

headers = ["Region", "Revenue", "Growth"]
rows_data = [
    ["North", "$1.2M", "+15%"],
    ["South", "$800K", "+8%"],
    ["East", "$950K", "+12%"],
    ["West", "$1.1M", "+10%"],
]

table = slide.shapes.add_table(
    len(rows_data) + 1, len(headers),
    Inches(1.5), Inches(2), Inches(7), Inches(3)
).table

# Style header row
for i, h in enumerate(headers):
    cell = table.cell(0, i)
    cell.text = h
    for paragraph in cell.text_frame.paragraphs:
        for run in paragraph.runs:
            run.font.bold = True
            run.font.size = Pt(14)
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0x2C, 0x3E, 0x50)

# Data rows
for r, row_data in enumerate(rows_data):
    for c, val in enumerate(row_data):
        table.cell(r + 1, c).text = val

prs.save("sales.pptx")
```

### From pandas DataFrame

```python
import pandas as pd
from pptx import Presentation
from pptx.util import Inches

df = pd.read_csv("data.csv")  # or pd.read_excel(...)
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Data Overview"

table = slide.shapes.add_table(
    len(df) + 1, len(df.columns),
    Inches(0.5), Inches(2), Inches(9), Inches(4.5)
).table

for i, col in enumerate(df.columns):
    table.cell(0, i).text = str(col)

for r, (_, row) in enumerate(df.iterrows()):
    for c, val in enumerate(row):
        table.cell(r + 1, c).text = str(val)

prs.save("data_deck.pptx")
```

---

## Charts (matplotlib → image)

python-pptx has built-in chart support, but matplotlib produces better-looking visuals. Save as image and insert:

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pptx import Presentation
from pptx.util import Inches

# Create chart
fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(["Q1", "Q2", "Q3", "Q4"], [120, 145, 132, 178], color="#2c3e50")
ax.set_title("Quarterly Revenue ($k)", fontsize=16)
ax.set_ylabel("Revenue")
fig.savefig("/tmp/_chart.png", dpi=150, bbox_inches="tight")
plt.close()

# Insert into slide
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Revenue Performance"
slide.shapes.add_picture("/tmp/_chart.png", Inches(1), Inches(1.8), Inches(8), Inches(5))

prs.save("chart_deck.pptx")
```

### Built-in charts (native PowerPoint charts)

```python
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Native Chart"

chart_data = CategoryChartData()
chart_data.categories = ["Q1", "Q2", "Q3", "Q4"]
chart_data.add_series("Revenue", (120, 145, 132, 178))
chart_data.add_series("Costs", (80, 95, 88, 105))

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(2), Inches(8), Inches(4.5),
    chart_data,
).chart

chart.has_legend = True
chart.legend.include_in_layout = False

prs.save("native_chart.pptx")
```

---

## Images

```python
from pptx import Presentation
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank

# Add image with position and size
slide.shapes.add_picture("photo.png", Inches(1), Inches(1), Inches(4), Inches(3))

# Full-width image
slide.shapes.add_picture("banner.png", Inches(0), Inches(0), Inches(10), Inches(7.5))

prs.save("images.pptx")
```

---

## Read & Edit Existing

### Read slide content

```python
from pptx import Presentation

prs = Presentation("existing.pptx")

for i, slide in enumerate(prs.slides):
    print(f"--- Slide {i+1} ---")
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                print(para.text)
```

### Modify existing slides

```python
from pptx import Presentation

prs = Presentation("template.pptx")

# Update title slide
slide = prs.slides[0]
slide.shapes.title.text = "Updated Title"
slide.placeholders[1].text = "New Subtitle"

prs.save("updated.pptx")
```

### Delete a slide

```python
from pptx import Presentation

prs = Presentation("deck.pptx")
slide = prs.slides[2]  # 3rd slide (0-indexed)
rId = prs.slides._sldIdLst[2].get('r:id')
prs.part.drop_rel(rId)
del prs.slides._sldIdLst[2]

prs.save("trimmed.pptx")
```

---

## Slide Background

```python
from pptx import Presentation
from pptx.dml.color import RGBColor

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])

background = slide.background
fill = background.fill
fill.solid()
fill.fore_color.rgb = RGBColor(0x2C, 0x3E, 0x50)

prs.save("dark_bg.pptx")
```

---

## Common Workflows

### Multi-slide report from data

```python
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

df = pd.read_csv("sales.csv")
prs = Presentation()

# 1. Title slide
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "Sales Report"
slide.placeholders[1].text = "March 2026"

# 2. Summary bullets
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Summary"
body = slide.placeholders[1].text_frame
body.text = f"Total revenue: ${df['Revenue'].sum():,.0f}"
body.add_paragraph().text = f"Top region: {df.loc[df['Revenue'].idxmax(), 'Region']}"
body.add_paragraph().text = f"Records: {len(df)}"

# 3. Chart slide
fig, ax = plt.subplots(figsize=(8, 5))
summary = df.groupby("Region")["Revenue"].sum()
summary.plot(kind="bar", ax=ax, color="#2c3e50")
ax.set_title("Revenue by Region")
fig.savefig("/tmp/_chart.png", dpi=150, bbox_inches="tight")
plt.close()

slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Revenue by Region"
slide.shapes.add_picture("/tmp/_chart.png", Inches(1), Inches(1.8), Inches(8), Inches(5))

# 4. Data table slide
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Detailed Data"
cols = list(df.columns)
table = slide.shapes.add_table(min(len(df), 10) + 1, len(cols), Inches(0.5), Inches(2), Inches(9), Inches(4.5)).table

for i, col in enumerate(cols):
    table.cell(0, i).text = str(col)
for r in range(min(len(df), 10)):
    for c, col in enumerate(cols):
        table.cell(r + 1, c).text = str(df.iloc[r][col])

prs.save("sales_report.pptx")
```
