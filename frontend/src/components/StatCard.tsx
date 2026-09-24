// frontend/src/components/StatCard.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

const colorClasses = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export function StatCard({ label, value, change, icon, color }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colorClasses[color]}`}>
          <span>{icon}</span>
        </div>
        {change && (
          <span className="text-xs text-slate-500">{change}</span>
        )}
      </div>
      <p className="text-sm text-slate-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}