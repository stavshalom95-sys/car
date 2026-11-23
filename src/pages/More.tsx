import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronLeft, FileText, Package, Receipt, Settings } from 'lucide-react';
import { PageHeader } from '../components/ui';

const ITEMS = [
  { to: '/equipment', label: 'ציוד ברכב ורשימת קניות', desc: 'ציוד לפי מיקום, תוקף, ורשימה לשיתוף', icon: Package },
  { to: '/expenses', label: 'הוצאות ועלות שנתית', desc: 'חניה, כביש 6, דוחות, שטיפות וסך עלות הרכב', icon: Receipt },
  { to: '/test', label: 'טסט ורישיון רכב', desc: 'ספירה לאחור, רשימת בדיקות והיסטוריה', icon: CalendarCheck },
  { to: '/documents', label: 'מסמכים', desc: 'רישיונות, ביטוחים, טלפונים וקבצים', icon: FileText },
  { to: '/settings', label: 'הגדרות', desc: 'פרטי הרכב, תזכורות, ערכת נושא וגיבוי', icon: Settings },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="עוד" />
      <div className="space-y-2">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="card flex items-center gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <i.icon className="h-6 w-6 text-blue-700 dark:text-blue-400" />
            <div className="flex-1">
              <div className="font-semibold">{i.label}</div>
              <div className="text-sm muted">{i.desc}</div>
            </div>
            <ChevronLeft className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
