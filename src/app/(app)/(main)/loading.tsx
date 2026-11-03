import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6 py-2">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
        <Loader2 aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />
        <span>جارٍ تحميل الصفحة...</span>
      </div>
      <div aria-hidden="true" className="space-y-6 animate-pulse motion-reduce:animate-none">
        <div className="h-8 w-48 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div key={item} className="h-28 rounded-xl border border-gray-100 bg-white" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-gray-100 bg-white" />
      </div>
    </div>
  );
}
