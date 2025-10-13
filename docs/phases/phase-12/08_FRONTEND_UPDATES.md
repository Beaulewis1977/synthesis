# Phase 12: Frontend Updates

**Cost dashboard + Document synthesis view**

---

## 🎯 Overview

Phase 12 adds two major user-facing features:

1. **Cost Monitoring Dashboard** - Track API spending, see budget alerts
2. **Document Synthesis View** - Compare multiple sources, see contradictions

**Effort:** 10-14 hours total  
**Priority:** HIGH - These are key Phase 12 features

---

## 📊 Feature 1: Cost Monitoring Dashboard

### What Users See

**New page:** `/costs` (nav link in sidebar)

```
┌─────────────────────────────────────┐
│ 💰 API Cost Dashboard               │
├─────────────────────────────────────┤
│ Current Month                        │
│ $2.45 / $10.00 (24.5% used)         │
│ Remaining: $7.55                     │
├─────────────────────────────────────┤
│ Breakdown by Provider               │
│ • Voyage Embeddings    $1.80 (73%) │
│ • Cohere Re-ranking    $0.50 (20%) │
│ • Claude LLM           $0.15 (7%)  │
├─────────────────────────────────────┤
│ Budget Alerts                        │
│ ⚠️  80% budget reached (yesterday)  │
└─────────────────────────────────────┘
```

### Components to Create

#### 1. `CostDashboard.tsx` (Main page - 80 lines)

```tsx
// apps/web/src/pages/CostDashboard.tsx

import { useQuery } from '@tanstack/react-query';

export default function CostDashboard() {
  const { data } = useQuery({
    queryKey: ['costs'],
    queryFn: () => fetch('/api/costs/summary').then(r => r.json()),
  });
  
  if (!data) return <div>Loading...</div>;
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">API Cost Dashboard</h1>
      
      <CostSummary 
        current={data.current_spend}
        budget={data.budget}
        percentage={data.percentage_used}
      />
      
      <CostBreakdown breakdown={data.breakdown} />
      
      <BudgetAlerts />
    </div>
  );
}
```

#### 2. `CostSummary.tsx` (Summary card - 40 lines)

```tsx
// apps/web/src/components/CostSummary.tsx

interface CostSummaryProps {
  current: number;
  budget: number;
  percentage: number;
}

export function CostSummary({ current, budget, percentage }: CostSummaryProps) {
  const remaining = budget - current;
  const color = percentage > 80 ? 'text-red-600' : 'text-green-600';
  
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Current Month</h2>
      
      <div className="text-3xl font-bold mb-2">
        <span className={color}>${current.toFixed(2)}</span>
        <span className="text-gray-400"> / ${budget.toFixed(2)}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full ${percentage > 80 ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <p className="text-sm text-gray-600">
        {percentage.toFixed(1)}% used · ${remaining.toFixed(2)} remaining
      </p>
    </div>
  );
}
```

#### 3. `CostBreakdown.tsx` (Provider breakdown - 50 lines)

```tsx
// apps/web/src/components/CostBreakdown.tsx

interface Breakdown {
  provider: string;
  operation: string;
  total_cost: number;
}

interface CostBreakdownProps {
  breakdown: Breakdown[];
}

export function CostBreakdown({ breakdown }: CostBreakdownProps) {
  const total = breakdown.reduce((sum, b) => sum + b.total_cost, 0);
  
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Breakdown by Provider</h2>
      
      <div className="space-y-3">
        {breakdown.map(item => {
          const percentage = (item.total_cost / total) * 100;
          
          return (
            <div key={`${item.provider}-${item.operation}`}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">
                  {item.provider} - {item.operation}
                </span>
                <span>${item.total_cost.toFixed(2)} ({percentage.toFixed(0)}%)</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### 4. `BudgetAlerts.tsx` (Alert list - 40 lines)

```tsx
// apps/web/src/components/BudgetAlerts.tsx

import { useQuery } from '@tanstack/react-query';

export function BudgetAlerts() {
  const { data } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/costs/alerts').then(r => r.json()),
  });
  
  if (!data?.alerts?.length) return null;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Budget Alerts</h2>
      
      <div className="space-y-2">
        {data.alerts.map((alert: any) => (
          <div 
            key={alert.id}
            className={`p-3 rounded ${
              alert.alert_type === 'limit_reached' 
                ? 'bg-red-50 text-red-800' 
                : 'bg-yellow-50 text-yellow-800'
            }`}
          >
            <div className="flex items-start">
              <span className="text-xl mr-2">
                {alert.alert_type === 'limit_reached' ? '🚨' : '⚠️'}
              </span>
              <div>
                <p className="font-medium">
                  {alert.alert_type === 'limit_reached' 
                    ? 'Budget Limit Reached' 
                    : '80% Budget Warning'}
                </p>
                <p className="text-sm">
                  ${alert.current_spend_usd.toFixed(2)} of ${alert.threshold_usd} used
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 5. Add Route (Update router - 5 lines)

```tsx
// apps/web/src/App.tsx or router config

import CostDashboard from './pages/CostDashboard';

// Add route
<Route path="/costs" element={<CostDashboard />} />

// Add nav link in sidebar
<NavLink to="/costs">💰 Costs</NavLink>
```

---

## 🔍 Feature 2: Document Synthesis View

### What Users See

**Enhanced search results page** with toggle:

```
[List View] [Synthesis View] ← Toggle button

┌─────────────────────────────────────────┐
│ Approach 1: Firebase Authentication    │
│ Sources: 3 documents                    │
│ Consensus: ⭐⭐⭐⭐ (High agreement)      │
│                                         │
│ Summary: Firebase Auth provides...     │
│ • Official Firebase docs               │
│ • Community tutorial                   │
│ • Stack Overflow guide                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Approach 2: Supabase Authentication    │
│ Sources: 2 documents                    │
│ Consensus: ⭐⭐⭐ (Medium agreement)     │
│                                         │
│ Summary: Supabase Auth integrates...   │
│ • Supabase docs                        │
│ • GitHub example                       │
└─────────────────────────────────────────┘

⚠️  Contradiction Found
Firebase docs (2020) recommends Provider
Firebase docs (2024) now recommends Riverpod
→ Recommendation: Use newer docs (Riverpod)
```

### Components to Create

#### 1. Update `SearchPage.tsx` (Add toggle - 20 lines)

```tsx
// apps/web/src/pages/SearchPage.tsx

export default function SearchPage() {
  const [viewMode, setViewMode] = useState<'list' | 'synthesis'>('list');
  const { data } = useSearchResults(query);
  
  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setViewMode('list')}
          className={viewMode === 'list' ? 'btn-active' : 'btn'}
        >
          List View
        </button>
        <button 
          onClick={() => setViewMode('synthesis')}
          className={viewMode === 'synthesis' ? 'btn-active' : 'btn'}
        >
          Synthesis View
        </button>
      </div>
      
      {viewMode === 'list' ? (
        <ResultsList results={data.results} />
      ) : (
        <SynthesisView query={query} />
      )}
    </div>
  );
}
```

#### 2. `SynthesisView.tsx` (Main synthesis container - 60 lines)

```tsx
// apps/web/src/components/SynthesisView.tsx

import { useQuery } from '@tanstack/react-query';

interface SynthesisViewProps {
  query: string;
}

export function SynthesisView({ query }: SynthesisViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['synthesis', query],
    queryFn: () => 
      fetch('/api/synthesis/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          collection_id: currentCollectionId,
          top_k: 15 
        }),
      }).then(r => r.json()),
  });
  
  if (isLoading) return <div>Analyzing sources...</div>;
  if (!data) return null;
  
  return (
    <div className="space-y-6">
      {/* Approaches */}
      <div className="space-y-4">
        {data.approaches.map((approach: any, i: number) => (
          <ApproachCard 
            key={i}
            approach={approach}
            isRecommended={approach.method === data.recommended.method}
          />
        ))}
      </div>
      
      {/* Contradictions */}
      {data.conflicts.length > 0 && (
        <ConflictsList conflicts={data.conflicts} />
      )}
    </div>
  );
}
```

#### 3. `ApproachCard.tsx` (Approach display - 50 lines)

```tsx
// apps/web/src/components/ApproachCard.tsx

interface ApproachCardProps {
  approach: {
    method: string;
    sources: any[];
    consensus_score: number;
    summary: string;
  };
  isRecommended: boolean;
}

export function ApproachCard({ approach, isRecommended }: ApproachCardProps) {
  const stars = Math.round(approach.consensus_score * 5);
  
  return (
    <div className={`border rounded-lg p-4 ${isRecommended ? 'border-green-500 bg-green-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{approach.method}</h3>
        {isRecommended && (
          <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
            ✓ Recommended
          </span>
        )}
      </div>
      
      {/* Consensus */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <span>{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
        <span>{approach.sources.length} sources</span>
      </div>
      
      {/* Summary */}
      <p className="text-gray-700 mb-3">{approach.summary}</p>
      
      {/* Sources */}
      <details className="text-sm">
        <summary className="cursor-pointer text-blue-600 hover:underline">
          View sources
        </summary>
        <ul className="mt-2 ml-4 space-y-1">
          {approach.sources.map((src: any, i: number) => (
            <li key={i} className="text-gray-600">
              • {src.docTitle}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
```

#### 4. `ConflictsList.tsx` (Show contradictions - 50 lines)

```tsx
// apps/web/src/components/ConflictsList.tsx

interface ConflictsListProps {
  conflicts: Array<{
    topic: string;
    source_a: { title: string; statement: string };
    source_b: { title: string; statement: string };
    severity: 'high' | 'medium' | 'low';
    difference: string;
    recommendation: string;
  }>;
}

export function ConflictsList({ conflicts }: ConflictsListProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">⚠️  Contradictions Found</h3>
      
      <div className="space-y-4">
        {conflicts.map((conflict, i) => (
          <div key={i} className="bg-white rounded p-3">
            <div className="font-medium mb-2">{conflict.topic}</div>
            
            {/* Source A */}
            <div className="text-sm mb-2">
              <span className="font-medium">Source A: </span>
              {conflict.source_a.title}
              <p className="text-gray-600 ml-4 mt-1">{conflict.source_a.statement}</p>
            </div>
            
            {/* Source B */}
            <div className="text-sm mb-2">
              <span className="font-medium">Source B: </span>
              {conflict.source_b.title}
              <p className="text-gray-600 ml-4 mt-1">{conflict.source_b.statement}</p>
            </div>
            
            {/* Difference */}
            <div className="text-sm bg-gray-50 p-2 rounded mt-2">
              <span className="font-medium">Difference: </span>
              {conflict.difference}
            </div>
            
            {/* Recommendation */}
            <div className="text-sm bg-green-50 p-2 rounded mt-2">
              <span className="font-medium">→ Recommendation: </span>
              {conflict.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## ✅ Implementation Checklist

### Cost Dashboard
- [ ] Create `CostDashboard.tsx` page (80 lines)
- [ ] Create `CostSummary.tsx` (40 lines)
- [ ] Create `CostBreakdown.tsx` (50 lines)
- [ ] Create `BudgetAlerts.tsx` (40 lines)
- [ ] Add `/costs` route (5 lines)
- [ ] Add nav link in sidebar (2 lines)

**Subtotal:** ~220 lines, 4-6 hours

### Synthesis View
- [ ] Update `SearchPage.tsx` with toggle (20 lines)
- [ ] Create `SynthesisView.tsx` (60 lines)
- [ ] Create `ApproachCard.tsx` (50 lines)
- [ ] Create `ConflictsList.tsx` (50 lines)

**Subtotal:** ~180 lines, 6-8 hours

**Total:** ~400 lines, 10-14 hours

---

## 🚫 What NOT to Add

**Keep it simple:**
- ❌ No complex charts/graphs (progress bars are enough)
- ❌ No date range filtering for costs (just show current month)
- ❌ No export to CSV (can add later if needed)
- ❌ No real-time cost updates (polling is fine)
- ❌ No synthesis customization (default settings work)

---

## 🎯 Priority

**Must implement:**
- ✅ Synthesis view (main Phase 12 feature)

**Nice to have:**
- ⚠️  Cost dashboard (useful but not critical)

**Can defer:**
- Nothing - these are the core Phase 12 features

---

**Next:** See Phase 13 frontend docs for related files UI
