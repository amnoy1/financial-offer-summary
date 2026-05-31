# עיצוב מערכת: אפליקציית סיכום פגישות — סוכן פיננסי/ביטוח

> **סטטוס:** תכנון מאושר — טרם התחיל פיתוח  
> **תאריך:** 2026-05-31  
> **GitHub:** https://github.com/amnoy1/financial-offer-summary

---

## 1. מטרה

סוכני פיננסים/ביטוח מבזבזים שעות על סיכומי פגישות ידניים עם נתונים מורכבים.  
האפליקציה מאפשרת לסוכן **להקליט את הפגישה בקול**, ה-AI מתמלל ומסכם אוטומטית,  
והסוכן מקבל **PDF מקצועי מוכן** לשליחה ללקוח ולאחסון ב-CRM.

---

## 2. דומיין

**ראשי:** פנסיה, כסף פנוי, פוליסות פיננסיות, פרישה, מיסוי

**מוצרים ספציפיים בסקופ:**
- קופות גמל
- קרנות השתלמות
- גמל להשקעה
- פנסיות (קרנות פנסיה, ביטוחי מנהלים)
- ביטוחי מנהלים
- כסף פנוי / השקעות

**משני:** ביטוחי חיים, בריאות, רכוש (מידי פעם)

---

## 3. סטאק טכנולוגי

| שכבה | כלי | הסבר |
|------|-----|-------|
| Frontend + API | Next.js 15 (App Router) | PWA מובייל-פירסט |
| Hosting | Vercel | Deploy אוטומטי, Serverless |
| Database + Auth + Storage | Supabase (PostgreSQL) | RLS מובנה, multi-tenant מוכן |
| תמלול | OpenAI Whisper API | תמיכה מצוינת בעברית |
| AI סיכום | Claude Sonnet (Anthropic) | ניתוח מורכב בעברית |
| PDF | @react-pdf/renderer | עברית RTL + לוגו סוכנות |
| CRM (פאזה 2) | Make.com Webhook → Surense | לא ב-MVP |

---

## 4. ארכיטקטורה

```
[PWA — טלפון הסוכן]
         │
         │ קובץ אודיו (m4a/webm)
         ▼
[Vercel API Route — /api/recordings/upload]
         │
         ├──► [Supabase Storage — שמירת אודיו זמנית]
         │
         ▼
[OpenAI Whisper API — תמלול לעברית]
         │
         ▼
[Claude Sonnet — ניתוח וסיכום מובנה JSON]
         │
         ▼
[@react-pdf/renderer — יצירת PDF RTL + לוגו]
         │
         ├──► [Supabase Storage — שמירת PDF קבועה]
         ├──► [Supabase DB — שמירת summaries record]
         └──► [🗑️ מחיקת קובץ האודיו מ-Storage]
         │
         ▼
[סוכן מקבל Signed URL להורדת PDF]
```

**זמן עיבוד:** ~45–90 שניות. מסך loading עם שלבי עיבוד ויזואליים.

---

## 5. מבנה הנתונים (Supabase PostgreSQL)

```sql
-- טנאנט / סוכנות
CREATE TABLE agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- סוכנים
CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT CHECK (role IN ('admin','agent')) DEFAULT 'agent',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- לקוחות
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID REFERENCES agencies NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  id_number   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- פגישות
CREATE TABLE meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID REFERENCES agents NOT NULL,
  client_id      UUID REFERENCES clients NOT NULL,
  meeting_date   TIMESTAMPTZ NOT NULL,
  recording_url  TEXT,
  transcript     TEXT,
  mode           TEXT CHECK (mode IN ('live','memo')) NOT NULL,
  status         TEXT CHECK (status IN (
                   'recording','uploading','transcribing',
                   'summarizing','ready','error'
                 )) DEFAULT 'recording',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- סיכומים
CREATE TABLE summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        UUID REFERENCES meetings NOT NULL,
  content           JSONB NOT NULL,
  pdf_url           TEXT,
  edited_by_agent   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES agents,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### מבנה JSONB — summary.content

```json
{
  "client": {
    "name": "דוד לוי",
    "phone": "050-1234567",
    "meeting_date": "2026-05-31"
  },
  "topics_discussed": ["פנסיה", "קרן השתלמות", "גמל להשקעה"],
  "financial_profile": {
    "pension": "קרן פנסיה מגדל מקפת, ותק 12 שנה, חיסכון נוכחי 280,000 ₪",
    "free_capital": "200,000 ₪ בפיקדון בנקאי בריבית נמוכה",
    "existing_products": [
      { "type": "קרן השתלמות", "company": "הראל", "monthly": 1500, "total": 85000 },
      { "type": "ביטוח מנהלים", "company": "הפניקס", "monthly": 950, "coverage": 500000 },
      { "type": "גמל להשקעה", "company": "מיטב", "monthly": 0, "total": 45000 }
    ]
  },
  "recommendations": [
    "ניוד ביטוח המנהלים לקרן פנסיה — חיסכון של ~350 ₪/חודש בדמי ניהול",
    "הגדלת הפקדה לקרן השתלמות לתקרת ההטבה (20,520 ₪/שנה)",
    "העברת הפיקדון הבנקאי לגמל להשקעה — יתרון מיסוי בפרישה"
  ],
  "tax_notes": [
    "זכאי לניכוי מס לפי סעיף 47 — עד 7% מהכנסה (כ-8,400 ₪/שנה)",
    "קרן השתלמות פטורה ממס רווחי הון לאחר 6 שנים"
  ],
  "action_items": [
    {
      "task": "שליחת הצעה להעברת ביטוח מנהלים",
      "due_date": "2026-06-07",
      "owner": "agent"
    },
    {
      "task": "הבאת תלושי שכר + אישור מעסיק",
      "due_date": "2026-06-07",
      "owner": "client"
    }
  ]
}
```

---

## 6. זרימת משתמש (UX)

```
┌─────────────────────────────────────────┐
│  🏠 Dashboard                           │
│  פגישות אחרונות + סטטוס                 │
│  כפתור: [+ פגישה חדשה]                  │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  👤 בחירת לקוח                          │
│  חיפוש חכם / יצירת לקוח חדש            │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  🎙️ הקלטה                               │
│  [הקלטה חיה]  /  [הערת קול לאחר]       │
│  ⏺ כפתור גדול + טיימר + גלי קול        │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  ⏳ עיבוד (45–90 שנ')                   │
│  ✅ מעלה קובץ...                        │
│  🔄 מתמלל בעברית...                     │
│  🔄 מנתח ומסכם...                       │
│  ⏳ מייצר PDF...                        │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  📄 סיכום — עריכה ואישור               │
│                                         │
│  [פרטי לקוח + תאריך]                   │
│  [מוצרים ומצב פיננסי] ✏️               │
│  [המלצות הסוכן] ✏️                     │
│  [משימות + צעדי המשך] ✏️               │
│                                         │
│  [אשר ושמור]  [הורד PDF]               │
└─────────────────────────────────────────┘
```

---

## 7. אבטחה

נתוני פנסיה, גמל והשקעות הם סודיים ביותר. מדיניות אבטחה:

| נושא | מדיניות |
|------|---------|
| HTTPS | Vercel מאכף בכל מקום |
| בידוד נתונים | Supabase RLS — כל סוכנות רואה רק את שלה |
| קובצי אודיו | נמחקים מיידית לאחר תמלול מוצלח |
| PDF | Signed URLs בלבד — לא URLs ציבוריים |
| Auth | JWT + session expiry + auto-logout |
| לוגים | ללא PII — אין שמות/מספרי ת"ז בלוגים |
| Audit trail | כל גישה לסיכום נרשמת (מי, מתי) |
| API Keys | רק ב-Vercel Environment Variables, אף פעם ב-client |
| Validation | ולידציה מלאה בצד שרת לכל קלט |
| Rate Limiting | הגנה על כל API routes |

---

## 8. מבנה קבצים (Next.js)

```
financial-offer-summary/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   └── (app)/
│       ├── dashboard/page.tsx
│       ├── meetings/[id]/page.tsx
│       ├── record/page.tsx
│       ├── clients/page.tsx
│       └── settings/page.tsx
├── api/
│   ├── recordings/
│   │   ├── upload/route.ts
│   │   └── transcribe/route.ts
│   └── summaries/
│       ├── generate/route.ts
│       └── pdf/route.ts
├── components/
│   ├── RecordingButton/
│   ├── SummaryEditor/
│   └── PDFTemplate/
├── lib/
│   ├── supabase/
│   ├── openai/
│   ├── anthropic/
│   └── pdf/
└── supabase/
    └── migrations/
```

---

## 9. שלבי הביצוע

### שלב 0 — Setup
- [ ] Init Next.js 15 + Supabase project
- [ ] Deploy ל-Vercel
- [ ] הגדרת Environment Variables
- [ ] Supabase migrations + RLS policies

### שלב 1 — Auth + בסיס
- [ ] דף התחברות
- [ ] Dashboard
- [ ] ניהול לקוחות

### שלב 2 — הקלטה + תמלול
- [ ] מסך הקלטה (live + memo)
- [ ] Upload ל-Supabase Storage
- [ ] OpenAI Whisper integration
- [ ] מחיקת אודיו לאחר תמלול

### שלב 3 — AI + עריכה
- [ ] **skill-creator** — סקיל עיצוב RTL פיננסי
- [ ] Claude prompt לדומיין פיננסי/פנסיוני
- [ ] מסך עריכת סיכום

### שלב 4 — PDF + סיום
- [ ] @react-pdf/renderer + RTL עברית
- [ ] תבנית PDF + לוגו סוכנות
- [ ] Signed URLs
- [ ] בדיקות קצה-לקצה

---

## 10. פאזה 2 (עתיד)

- Surense CRM integration via Make.com Webhook
- הרשמה עצמית לסוכנויות (SaaS)
- תבניות PDF מרובות
- דוחות ואנליטיקס
- שליחה ישירה ב-WhatsApp

---

## 11. Verification Checklist

- [ ] הקלטה → תמלול עברי קריא
- [ ] תמלול → 4 סעיפים מובנים נכון (כולל קופות גמל, קרנות השתלמות וכו')
- [ ] PDF → RTL תקני, לוגו מופיע, ניתן להורדה
- [ ] סוכנות A לא רואה נתוני סוכנות B
- [ ] קובץ אודיו נמחק לאחר תמלול
- [ ] PDF נגיש רק דרך Signed URL
