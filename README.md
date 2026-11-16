# Petals, tika and diyas · दशैं र तिहार

**A Personal Dashain and Tihar Break Diary**  
**Student:** Suruchi Gurung · **Class:** 10 · **School:** [school name] · **Year:** [year]

---

## 1. How to Run

- Simply **double-click `index.html`** in your file manager to open it in any web browser (Chrome, Safari, Firefox, Edge).
- No web server, node, build steps, or internet connection (other than optional Google Fonts) are required. Everything runs locally off the `file://` protocol.

---

## 2. How to Add Photos and Videos

Drop your personal vacation media into the project folders:

- **Hero portrait:** `images/hero.jpg` (ideal ratio: 4:5 vertical)
- **Dashain photos:** `images/dashain-01.jpg` through `images/dashain-08.jpg`
- **Tihar photos:** `images/tihar-01.jpg` through `images/tihar-08.jpg`
- **Videos:** `videos/dashain-01.mp4`, `videos/tihar-01.mp4` (standard H.264 MP4 format)
- **Video preview posters:** `videos/posters/dashain-01.jpg`, `videos/posters/tihar-01.jpg`

_Note:_ If any image or video file is missing or not yet added, the website automatically displays an elegant, designed placeholder showing the expected file path, preserving the layout with zero jump.

---

## 3. How to Edit Text & Memories

Open `index.html` in any text editor (VS Code, TextEdit, Notepad):

- Replace bracketed placeholders like `[school name]`, `[year]`, `[Grandpa]`, `[date]`, and `[my brother]` with your actual details.
- Each story moment is an `<article class="story-moment">` block with:
  - `<p class="moment-date">` (Festival day and date)
  - `<h3 class="moment-title">` (Moment headline)
  - `<div class="moment-body"><p>` (Your story in your first-person voice)
  - `<aside class="margin-note">` (Handwritten margin reflection)
- You can freely copy, duplicate, or delete any story moment block.

---

## 4. How to Change Default Settings

- While viewing the website in your browser, click the **sakura flower button** at the bottom-right corner to open the **Make it yours** live panel.
- Change theme (Light, Dark, Auto), accent colours (Sakura, Makhamali, Sayapatri, Tika, Lilac, or custom picker), font styling, petal density, speed, wind direction, text size, and motion.
- To change code defaults permanently, adjust `DEFAULT_SETTINGS` near line 16 of `script.js` or the corresponding `data-*` attributes on the `<html>` tag in `index.html`.
