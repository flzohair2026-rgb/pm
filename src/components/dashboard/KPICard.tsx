import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  description: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  tone?: 'neutral' | 'emerald';
}

const trendBadgeVariant: Record<'up' | 'down' | 'neutral', 'default' | 'secondary' | 'destructive' | 'outline'> = {
  up: 'default',
  down: 'destructive',
  neutral: 'secondary'
};

const iconColorClasses: Record<NonNullable<KPICardProps['color']>, string> = {
  blue: 'bg-sky-100 text-sky-700 ring-sky-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  purple: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  orange: 'bg-amber-100 text-amber-700 ring-amber-200'
};

export const KPICard = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  description,
  color = 'blue',
  tone = 'neutral'
}: KPICardProps) => {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const showChange = change && change !== '-' && change !== '0%';
  const isEmerald = tone === 'emerald';

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 p-0',
        isEmerald
          ? 'bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 text-white border-0 ring-0 [--card:transparent] [--card-foreground:var(--white)] [--muted-foreground:color-mix(in_oklch,white_75%,transparent)]'
          : 'bg-card/90 backdrop-blur-sm ring-emerald-100/70 hover:ring-emerald-200/70'
      )}
    >
      {/* خلفية أيقونة زخرفية كبيرة */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0 end-0 p-3 sm:p-4 transition-transform duration-500 group-hover/card:scale-110',
          isEmerald ? 'opacity-10 group-hover/card:opacity-15' : 'opacity-5 group-hover/card:opacity-10'
        )}
      >
        <Icon size={80} strokeWidth={1.2} className={cn(isEmerald ? 'text-white' : 'text-foreground')} />
      </div>

      <CardHeader className="relative pb-0 pt-5 sm:pt-6">
        <div className="flex items-center justify-start">
          <div
            className={cn(
              'inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl ring-1 ring-inset shadow-sm shrink-0',
              isEmerald
                ? 'bg-white/10 text-white ring-white/20'
                : iconColorClasses[color]
            )}
          >
            <Icon
              size={22}
              strokeWidth={1.8}
              className={cn(
                'sm:w-[24px] sm:h-[24px]',
                isEmerald && 'text-white'
              )}
            />
          </div>
        </div>

        {showChange && (
          <CardAction>
            <Badge
              variant={trendBadgeVariant[trend]}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] h-6 rounded-full px-2.5',
                isEmerald && [
                  'bg-white/10 text-white ring-white/20 border-0 [color:var(--white)]',
                  trend === 'up' && 'bg-emerald-400/20',
                  trend === 'down' && 'bg-rose-400/25 text-rose-100'
                ],
                !isEmerald && [
                  trend === 'up' && 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 border-emerald-200',
                  trend === 'down' && 'bg-rose-50 text-rose-700 ring-rose-200/60 border-rose-200',
                  trend === 'neutral' && 'bg-slate-100 text-slate-600 border-slate-200'
                ]
              )}
            >
              <TrendIcon size={13} />
              <span className="font-bold">{change}</span>
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="relative pt-3">
        <div
          aria-live="polite"
          className={cn(
            'text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-1',
            isEmerald ? 'text-white' : 'text-foreground'
          )}
        >
          {value}
        </div>
        <CardTitle
          asChild
          className={cn(
            'text-[12px] sm:text-sm font-semibold mb-0.5 mt-0 leading-snug',
            isEmerald ? 'text-white' : 'text-foreground'
          )}
        >
          <div>{title}</div>
        </CardTitle>
        <CardDescription
          className={cn(
            'text-[11px] sm:text-xs font-medium leading-4 mt-1',
            isEmerald ? 'text-white/80' : 'text-muted-foreground'
          )}
        >
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};
