# מדריך הקמה – הרכב שלי

המדריך לוקח כ-15 דקות, ועושים אותו פעם אחת בלבד.

## 1. יצירת פרויקט Firebase
1. נכנסים ל-https://console.firebase.google.com ולוחצים **Create a project** (אפשר לקרוא לו `car`). אין צורך ב-Google Analytics.
2. בתפריט: **Build → Authentication → Get started → Sign-in method → Google → Enable**. שומרים.
3. באותו מסך, בלשונית **Settings → Authorized domains**, מוסיפים: `stavshalom95-sys.github.io`
4. בתפריט: **Build → Firestore Database → Create database**. בוחרים מיקום (`eur3` או `me-west1`) ומצב **Production**.
5. בלשונית **Rules** מדביקים את תוכן הקובץ `firestore.rules` מהמאגר ולוחצים **Publish**.
   החוקים מאפשרים לכל משתמש לגשת רק לנתונים של עצמו.

## 2. רישום אפליקציית Web
1. ⚙️ **Project settings → General → Your apps → `</>` (Web)**. שם: `car`. אין צורך ב-Firebase Hosting.
2. מעתיקים את ערכי `firebaseConfig` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
   הערכים האלה הם מזהים ציבוריים ולא סודות. האבטחה נעשית בחוקי Firestore.

## 3. הגדרת GitHub
1. במאגר: **Settings → Secrets and variables → Actions → New repository secret**. מוסיפים סוד לכל ערך:

| שם הסוד | ערך |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |
| `VITE_ALLOWED_EMAIL` | כתובת ה-Gmail שלך (רק היא תוכל להתחבר) |

2. **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Deploy to GitHub Pages → Run workflow** (או כל push ל-`main`).
4. האפליקציה תהיה זמינה בכתובת: https://stavshalom95-sys.github.io/car/

## 4. התקנה בטלפון
- **אנדרואיד (Chrome):** פותחים את הכתובת → תפריט ⋮ → **הוספה למסך הבית / התקנת אפליקציה**.
- **אייפון (Safari):** פותחים את הכתובת → כפתור שיתוף → **הוסף למסך הבית**.

## פיתוח מקומי
```bash
cp .env.example .env.local   # ממלאים את הערכים
npm install
npm run dev                  # http://localhost:5173/car/
```
ב-Firebase → Authentication → Authorized domains, `localhost` כבר מאושר כברירת מחדל.
בלי קובץ `.env.local` האפליקציה רצה ב"מצב מקומי" (ללא סנכרון). המצב הזה נועד לניסוי בלבד.
