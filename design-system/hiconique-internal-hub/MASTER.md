# HICONIQUE Internal Hub — Design System Master

> **LOGIC:** Khi xây dựng một trang cụ thể, kiểm tra `design-system/pages/[page-name].md` trước.
> Nếu tồn tại, các quy tắc trong đó **override** file Master này.
> Nếu không, tuân thủ chặt chẽ các quy tắc dưới đây.

---

**Dự án:** HICONIQUE Internal Hub — `noibo.hiconique.com`
**Ngày tạo:** 2026-08-11
**Ngành:** Thiết kế & Thi công Xa xỉ (Luxury Construction & Design)
**Đối tượng:** Nhân viên nội bộ (khoảng 10–50 người)
**Triết lý thiết kế:** "Quiet Luxury" — tối giản phóng khoáng, kiểu chữ statement, không gian âm lớn.

---

## 1. Bảng màu thương hiệu (Brand Palette)

Bộ màu lấy cảm hứng từ phong cách sang trọng kiến trúc — ánh kim đồng cổ trên nền than/navy sâu.

| Role | Hex | CSS Variable | Ghi chú |
|------|-----|--------------|---------|
| **Charcoal 950** (Background chính) | `#0B0D10` | `--color-bg` | Nền tối sâu, gần như đen tuyền |
| **Charcoal 900** | `#111418` | `--color-surface` | Bề mặt card |
| **Charcoal 800** | `#181C22` | `--color-surface-2` | Card nâng cao / hover |
| **Charcoal 700** | `#22272E` | `--color-border` | Viền tinh tế |
| **Deep Navy 600** | `#1B2A41` | `--color-navy` | Điểm nhấn trung tính |
| **Deep Navy 500** | `#2A3B55` | `--color-navy-hover` | Hover navy |
| **Text Primary** | `#F4F1EC` | `--color-text` | Kem ấm — không trắng tuyệt đối |
| **Text Secondary** | `#9AA0A6` | `--color-text-muted` | Xám dịu |
| **Text Tertiary** | `#6B7280` | `--color-text-faint` | Caption / meta |
| **Bronze 500** (Accent chính) | `#B08D57` | `--color-bronze` | Đồng cổ — accent thương hiệu |
| **Bronze 400** (Hover) | `#C9A876` | `--color-bronze-hover` | Hover/active |
| **Bronze 600** | `#8C6F40` | `--color-bronze-deep` | Text-on-light |
| **Muted Bronze 100** | `#E8D9BD` | `--color-bronze-soft` | Badge nhẹ |
| **Success** | `#4F6F52` | `--color-success` | Xanh rêu — không xanh ngọc |
| **Warning** | `#C7A464` | `--color-warning` | Vàng đồng |
| **Destructive** | `#A04848` | `--color-destructive` | Đỏ rượu vang |

**Ghi chú màu:** Bronze accent đã được tinh chỉnh để đạt contrast 4.5:1 trên nền charcoal.

---

## 2. Typography

- **Display/Heading:** `Cormorant Garamond` (serif cao cấp, dùng cho tiêu đề lớn statement)
- **Heading UI:** `Inter` (sans-serif hiện đại, cho heading bảng/button)
- **Body:** `Inter` (300/400/500)
- **Mono/Tabular:** `JetBrains Mono` (mã số, bảng, dữ liệu)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Thang font:**

| Token | Size | Line-height | Weight | Dùng cho |
|-------|------|-------------|--------|----------|
| `--text-display-xl` | `clamp(4rem, 9vw, 9rem)` | 1.0 | 500 | Hero "Không gian làm việc." |
| `--text-display-lg` | `clamp(2.5rem, 5vw, 4.5rem)` | 1.05 | 500 | Section lớn |
| `--text-h1` | `2.25rem` | 1.2 | 600 | Tiêu đề trang |
| `--text-h2` | `1.75rem` | 1.25 | 600 | Card heading |
| `--text-h3` | `1.375rem` | 1.3 | 500 | Sub-heading |
| `--text-body` | `1rem` | 1.6 | 400 | Nội dung |
| `--text-sm` | `0.875rem` | 1.5 | 400 | Meta, caption |
| `--text-xs` | `0.75rem` | 1.4 | 500 | Label, eyebrow (uppercase tracking) |

---

## 3. Spacing & Layout

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--space-xs` | `4px` | Tight gap |
| `--space-sm` | `8px` | Icon gap |
| `--space-md` | `16px` | Card padding |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `40px` | Block separator |
| `--space-2xl` | `64px` | Section margin |
| `--space-3xl` | `96px` | Hero padding |
| `--space-4xl` | `128px` | Page top |

**Container:** `max-width: 1280px`, padding ngang `clamp(20px, 5vw, 60px)`.

---

## 4. Shadow Depths

| Level | Value | Dùng cho |
|-------|-------|----------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.4)` | Subtle lift |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.5)` | Card resting |
| `--shadow-md` | `0 8px 24px rgba(0,0,0,0.55)` | Card hover |
| `--shadow-lg` | `0 16px 40px rgba(0,0,0,0.6)` | Modal, dropdown |
| `--shadow-glow` | `0 0 24px rgba(176,141,87,0.18)` | Bronze halo |

---

## 5. Component Specs

### Buttons

```css
/* Primary — Bronze */
.btn-primary {
  background: var(--color-bronze);
  color: #0B0D10;
  padding: 14px 28px;
  border-radius: 2px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: all 220ms ease;
  cursor: pointer;
  border: 1px solid var(--color-bronze);
}
.btn-primary:hover {
  background: var(--color-bronze-hover);
  box-shadow: var(--shadow-glow);
}

/* Secondary — Outline */
.btn-secondary {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 14px 28px;
  border-radius: 2px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: all 220ms ease;
  cursor: pointer;
}
.btn-secondary:hover {
  border-color: var(--color-bronze);
  color: var(--color-bronze);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 28px;
  transition: all 220ms ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-bronze), transparent);
  opacity: 0;
  transition: opacity 220ms ease;
}
.card:hover {
  border-color: var(--color-bronze);
  background: var(--color-surface-2);
  transform: translateY(-2px);
}
.card:hover::before {
  opacity: 1;
}
```

### Eyebrow label (uppercase tracking)

```css
.eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-bronze);
}
```

---

## 6. Page Pattern

**Pattern:** Internal Portal / Hub

- Hero statement (oversized serif "Không gian làm việc.")
- Section "Công cụ chính" — grid 5–6 card, mỗi card có icon SVG, title, mô tả ngắn, badge nhỏ.
- Section "Tài liệu & Quy trình" — 2 hàng × 5 card text-link.
- Section "AI & Thiết kế" — card dạng chip với gradient subtle.
- Section "Thông báo nội bộ" — 2 cột, notification card có dot màu.
- Section "Team directory" — avatar grid với role và số ngày công.
- Footer đơn giản — copyright + build hash.

---

## 7. Anti-Patterns (TRÁNH)

- ❌ Emoji làm icon — chỉ dùng SVG (Lucide/Heroicons).
- ❌ Gradient tím/hồng AI-style.
- ❌ Bo góc quá lớn (max 6px — giữ phong cách editorial).
- ❌ Drop shadow đậm màu xanh.
- ❌ Card có border màu rực rỡ.
- ❌ Animation quay/spin nhiều.
- ❌ Text < 12px ở body.

---

## 8. Accessibility

- Contrast 4.5:1 cho body text.
- Focus ring màu bronze, 2px offset.
- Keyboard nav đầy đủ.
- ARIA-label cho icon-only buttons.
- `prefers-reduced-motion` tắt stagger/fade.

---

## 9. Pre-Delivery Checklist

- [ ] Không dùng emoji làm icon
- [ ] `cursor-pointer` trên mọi clickable
- [ ] Hover states 220ms
- [ ] Contrast 4.5:1+
- [ ] Focus state bronze, 2px
- [ ] Responsive 375 / 768 / 1024 / 1440
- [ ] Không horizontal scroll mobile
- [ ] Pre-commit hook OK