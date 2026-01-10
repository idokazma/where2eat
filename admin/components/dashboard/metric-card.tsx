'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: number;
  trendData?: Array<{ value: number }>;
  icon?: React.ReactNode;
  href?: string;
}

export function MetricCard({ title, value, trend, trendData, icon, href }: MetricCardProps) {
  const trendIcon = trend !== undefined ? (
    trend > 0 ? (
      <ArrowUp className="h-4 w-4 text-green-600" />
    ) : trend < 0 ? (
      <ArrowDown className="h-4 w-4 text-red-600" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    )
  ) : null;

  const trendColor = trend !== undefined ? (
    trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground'
  ) : '';

  const CardWrapper = href ? 'a' : 'div';
  const cardProps = href ? { href, className: 'block hover:bg-accent/50 transition-colors' } : {};

  return (
    <CardWrapper {...cardProps}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">{value}</div>

            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trendIcon}
                <span className={trendColor}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
                <span className="text-muted-foreground">from last week</span>
              </div>
            )}

            {trendData && trendData.length > 0 && (
              <div className="h-[60px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  );
}
