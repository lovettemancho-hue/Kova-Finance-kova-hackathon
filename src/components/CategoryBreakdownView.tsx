import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Sector,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { ExpenseCategory } from '../types';
import { CategoryBreakdownItem } from '../utils/analytics';
import { formatCurrency, formatWholeCurrency } from '../utils/currency';
import {
  ShoppingBag,
  Wrench,
  ShoppingBasket,
  Dumbbell,
  Sparkles,
  Coffee,
  Tv,
  Plane,
  TrendingUp,
  DollarSign,
  UtensilsCrossed,
  PieChart,
  BarChart3,
  Layers,
  Home,
} from 'lucide-react';

interface CategoryBreakdownViewProps {
  items: CategoryBreakdownItem[];
  totalAmount: number;
  currency: string;
  monthName: string;
  filterType: 'outcome' | 'income';
}

const getCategoryIcon = (category: string) => {
  const iconClass = "w-3.5 h-3.5 text-white/90 stroke-[1.75]";
  switch (category) {
    case 'Shopping':
      return <ShoppingBag className={iconClass} />;
    case 'Car repair':
      return <Wrench className={iconClass} />;
    case 'Grocery':
      return <ShoppingBasket className={iconClass} />;
    case 'Gym':
      return <Dumbbell className={iconClass} />;
    case 'Laundry':
      return <Sparkles className={iconClass} />;
    case 'Coffee':
      return <Coffee className={iconClass} />;
    case 'Dining out':
      return <UtensilsCrossed className={iconClass} />;
    case 'Subscriptions':
      return <Tv className={iconClass} />;
    case 'Travel':
      return <Plane className={iconClass} />;
    case 'Housing':
      return <Home className={iconClass} />;
    case 'Income':
      return <TrendingUp className={iconClass} />;
    default:
      return <DollarSign className={iconClass} />;
  }
};

// Premium monochrome-with-accents palette for Kova's obsidian design system
const SLICE_COLORS = [
  '#FFFFFF',
  '#E4E4E7',
  '#A1A1AA',
  '#71717A',
  '#52525B',
  '#3F3F46',
  '#F59E0B',
  '#10B981',
  '#6366F1',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
];

const PieComponent = Pie as any;
const BarComponent = Bar as any;
const BarChartComponent = RechartsBarChart as any;
const PieChartComponent = RechartsPieChart as any;
const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.4))',
          transition: 'all 0.3s ease-out',
        }}
      />
    </g>
  );
};

export const CategoryBreakdownView: React.FC<CategoryBreakdownViewProps> = ({
  items,
  totalAmount,
  currency,
  monthName,
  filterType,
}) => {
  const [chartType, setChartType] = useState<'donut' | 'bars'>('donut');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeItem = useMemo(() => {
    if (activeIndex !== null && items[activeIndex]) {
      return items[activeIndex];
    }
    return null;
  }, [activeIndex, items]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return items.map((item, index) => ({
      name: item.category,
      value: item.amount,
      percentage: item.percentage,
      count: item.count,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-[24px] p-6 border border-white/10 text-center bg-[#161618]/80 my-4">
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/40">
          <PieChart className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-white/80">No {filterType} entries for {monthName}</p>
        <p className="text-[11px] text-[#8A8A8E] mt-1">
          Log an expense to see your categorical distribution chart.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618]/80 space-y-5">
      {/* Header & Chart Type Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-white/80" />
          <span className="text-xs font-bold text-white tracking-tight">Categorical Distribution</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#121214] p-0.5 rounded-full border border-white/10">
          <button
            type="button"
            onClick={() => setChartType('donut')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              chartType === 'donut'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#8A8A8E] hover:text-white'
            }`}
          >
            <PieChart className="w-3 h-3" />
            <span>Donut</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('bars')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              chartType === 'bars'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#8A8A8E] hover:text-white'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>Ranked</span>
          </button>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="bg-[#121214]/90 rounded-2xl p-4 border border-white/5 relative flex flex-col items-center justify-center min-h-[220px]">
        {chartType === 'donut' ? (
          <div className="relative w-full h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChartComponent>
                <RechartsTooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#18181A]/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-left z-50">
                          <p className="text-xs font-bold text-white mb-0.5">{data.name}</p>
                          <p className="text-[11px] font-mono font-semibold text-white">
                            {formatCurrency(data.value, currency)} ({data.percentage}%)
                          </p>
                          <p className="text-[10px] text-[#8A8A8E]">
                            {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <PieComponent
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  activeIndex={activeIndex !== null ? activeIndex : undefined}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_: any, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_: any, index: number) => setActiveIndex(index === activeIndex ? null : index)}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="cursor-pointer transition-all duration-300 focus:outline-none"
                    />
                  ))}
                </PieComponent>
              </PieChartComponent>
            </ResponsiveContainer>

            {/* Centered Dynamic Readout inside Donut Hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8A8E] font-medium truncate max-w-[110px]">
                {activeItem ? activeItem.category : (filterType === 'outcome' ? 'Total Spent' : 'Total Income')}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white font-mono mt-0.5">
                {formatWholeCurrency(activeItem ? activeItem.amount : totalAmount, currency)}
              </span>
              <span className="text-[10px] font-semibold text-white/70 bg-white/10 px-1.5 py-0.2 rounded-full font-mono mt-0.5">
                {activeItem ? `${activeItem.percentage}%` : `${items.length} cats`}
              </span>
            </div>
          </div>
        ) : (
          /* Recharts Horizontal Ranked Bar Distribution */
          <div className="w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChartComponent
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  hide
                  domain={[0, 'dataMax']}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={90}
                  tick={{ fill: '#A1A1AA', fontSize: 11, fontWeight: 500 }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#18181A]/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-left z-50">
                          <p className="text-xs font-bold text-white mb-0.5">{data.name}</p>
                          <p className="text-[11px] font-mono font-semibold text-white">
                            {formatCurrency(data.value, currency)} ({data.percentage}%)
                          </p>
                          <p className="text-[10px] text-[#8A8A8E]">
                            {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <BarComponent
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`bar-cell-${index}`}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                      onClick={() => setActiveIndex(index === activeIndex ? null : index)}
                      className="cursor-pointer transition-opacity duration-200"
                    />
                  ))}
                </BarComponent>
              </BarChartComponent>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart Legend / Active summary note */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-[#8A8A8E]">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-white/50" />
            <span>Interactive {chartType === 'donut' ? 'Donut' : 'Ranked Bars'}</span>
          </span>
          <span className="font-mono">
            Top: {items[0]?.category} ({items[0]?.percentage}%)
          </span>
        </div>
      </div>

      {/* Category Breakdown Breakdown List Rows */}
      <div className="space-y-2 pt-1">
        {items.map((item, idx) => {
          const isSelected = activeIndex === idx;
          const avgPerTransaction = item.count > 0 ? item.amount / item.count : item.amount;
          const sliceColor = SLICE_COLORS[idx % SLICE_COLORS.length];

          return (
            <div
              key={item.category}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(isSelected ? null : idx)}
              className={`p-3 rounded-2xl transition-all duration-200 cursor-pointer border ${
                isSelected
                  ? 'bg-white/10 border-white/30 scale-[1.01] shadow-lg'
                  : 'bg-white/3 border-transparent hover:bg-white/5 hover:border-white/10'
              }`}
            >
              {/* Row Top: Icon, Label, Percentage, Amount */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: `${sliceColor}20`,
                      borderColor: sliceColor,
                    }}
                  >
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white truncate block flex items-center gap-1.5">
                      {item.category}
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </span>
                    <span className="text-[10px] text-[#8A8A8E]">
                      {item.count} {item.count === 1 ? 'entry' : 'entries'}
                      {isSelected && ` • avg ${formatCurrency(avgPerTransaction, currency)}`}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white font-mono">
                    {formatCurrency(item.amount, currency)}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.2 rounded font-mono"
                    style={{
                      backgroundColor: `${sliceColor}25`,
                      color: sliceColor === '#FFFFFF' ? '#FFFFFF' : sliceColor,
                    }}
                  >
                    {item.percentage}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: sliceColor,
                  }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSelected ? 'shadow-[0_0_8px_rgba(255,255,255,0.9)] brightness-125' : 'opacity-70'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
