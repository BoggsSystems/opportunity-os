import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CreditCard,
  DatabaseZap,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import type { ApiClient } from '../lib/api';
import type {
  AdminBillingReferralAnalytics,
  AdminCampaignAnalytics,
  AdminConnectorAnalytics,
  AdminFunnel,
  AdminMetricSnapshots,
  AdminOperationalIssues,
  AdminOverview,
  AdminUsersResult,
  AuthResponse,
} from '../types';

type AdminSection =
  | 'overview'
  | 'funnel'
  | 'users'
  | 'campaigns'
  | 'connectors'
  | 'billing'
  | 'operations'
  | 'nexus';

interface AdminDashboardState {
  overview: AdminOverview | null;
  funnel: AdminFunnel | null;
  users: AdminUsersResult | null;
  campaigns: AdminCampaignAnalytics | null;
  connectors: AdminConnectorAnalytics | null;
  billing: AdminBillingReferralAnalytics | null;
  snapshots: AdminMetricSnapshots | null;
  operations: AdminOperationalIssues | null;
}

const initialState: AdminDashboardState = {
  overview: null,
  funnel: null,
  users: null,
  campaigns: null,
  connectors: null,
  billing: null,
  snapshots: null,
  operations: null,
};

const sections: Array<{ id: AdminSection; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'funnel', label: 'Funnel', icon: GitBranch },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'campaigns', label: 'Campaigns', icon: Workflow },
  { id: 'connectors', label: 'Connectors', icon: DatabaseZap },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'operations', label: 'Operations', icon: AlertTriangle },
  { id: 'nexus', label: 'Nexus Audit', icon: ShieldCheck },
];

const snapshotMetrics = [
  'billing.mrr_cents',
  'billing.paid_users',
  'users.activated',
  'usage.active_users',
  'campaigns.created',
  'actions.completed',
  'referrals.paid_conversions',
  'command_queue.completion_rate',
];

const overviewChartMetrics = [
  'billing.mrr_cents',
  'billing.paid_users',
  'usage.active_users',
  'campaigns.created',
  'actions.completed',
  'referrals.paid_conversions',
  'command_queue.completion_rate',
];

const revenueChartMetrics = [
  'billing.mrr_cents',
  'billing.arr_cents',
  'billing.paid_users',
  'billing.new_paid_users',
  'billing.churned_users',
  'billing.failed_payment_users',
  'referrals.paid_conversions',
];

const nexusChartMetrics = [
  'billing.mrr_cents',
  'usage.active_users',
  'actions.completed',
  'command_queue.completion_rate',
];

export function AdminApp(props: {
  api: ApiClient;
  user: AuthResponse['user'];
  onBackToWorkspace: () => void;
  onLogout: () => void;
}) {
  const { api } = props;
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [state, setState] = useState<AdminDashboardState>(initialState);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdmin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        overview,
        funnel,
        users,
        campaigns,
        connectors,
        billing,
        snapshots,
        operations,
      ] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminFunnel(),
        api.listAdminUsers({ limit: 25 }),
        api.getAdminCampaigns(),
        api.getAdminConnectors(),
        api.getAdminBillingReferrals(),
        api.getAdminMetricSnapshots({ limit: 500 }),
        api.getAdminOperationalIssues({ limit: 50 }),
      ]);

      setState({
        overview,
        funnel,
        users,
        campaigns,
        connectors,
        billing,
        snapshots,
        operations,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Admin data could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const filteredSnapshots = useMemo(() => {
    const snapshots = state.snapshots?.snapshots ?? [];
    return snapshots.filter((snapshot) => snapshotMetrics.includes(snapshot.metricKey));
  }, [state.snapshots]);

  const searchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const searchInput: { query?: string; limit: number } = { limit: 50 };
      if (userQuery.trim()) searchInput.query = userQuery.trim();
      const users = await api.listAdminUsers(searchInput);
      setState((current) => ({ ...current, users }));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'User search failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const openUser = async (userId: string) => {
    setSelectedUser(null);
    setError(null);
    try {
      const detail = await api.getAdminUser(userId);
      setSelectedUser(detail.user);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'User detail failed.');
    }
  };

  const refreshMonthlySnapshot = async () => {
    setIsRefreshingSnapshot(true);
    setError(null);
    try {
      await api.createAdminMonthlySnapshot();
      const snapshots = await api.getAdminMetricSnapshots({ limit: 500 });
      setState((current) => ({ ...current, snapshots }));
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : 'Snapshot refresh failed.');
    } finally {
      setIsRefreshingSnapshot(false);
    }
  };

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark"><ShieldCheck size={20} /></div>
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Control Tower</h1>
          </div>
        </div>
        <div className="admin-operator">
          <span>{props.user.fullName || 'Operator'}</span>
          <small>{props.user.email}</small>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                className={activeSection === section.id ? 'active' : ''}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <Icon size={16} />
                {section.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-actions">
          <button className="admin-secondary-button" onClick={props.onBackToWorkspace} type="button">
            <ArrowLeft size={16} />
            Workspace
          </button>
          <button className="admin-secondary-button" onClick={props.onLogout} type="button">
            Log out
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Opportunity OS</p>
            <h2>{sectionTitle(activeSection)}</h2>
          </div>
          <div className="admin-topbar-actions">
            <button className="admin-secondary-button" disabled={isRefreshingSnapshot} onClick={refreshMonthlySnapshot} type="button">
              {isRefreshingSnapshot ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
              Monthly snapshot
            </button>
            <button className="admin-primary-button" disabled={isLoading} onClick={() => void loadAdmin()} type="button">
              {isLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
              Refresh
            </button>
          </div>
        </header>

        {error ? <div className="admin-error">{error}</div> : null}
        {isLoading && !state.overview ? <div className="admin-loading"><Loader2 className="spin" size={18} /> Loading admin data</div> : null}

        {activeSection === 'overview' ? (
          <OverviewSection overview={state.overview} snapshots={filteredSnapshots} operations={state.operations} />
        ) : null}
        {activeSection === 'funnel' ? <FunnelSection funnel={state.funnel} /> : null}
        {activeSection === 'users' ? (
          <UsersSection
            users={state.users}
            query={userQuery}
            selectedUser={selectedUser}
            onQueryChange={setUserQuery}
            onSearch={() => void searchUsers()}
            onOpenUser={(userId) => void openUser(userId)}
          />
        ) : null}
        {activeSection === 'campaigns' ? <CampaignsSection campaigns={state.campaigns} /> : null}
        {activeSection === 'connectors' ? <ConnectorsSection connectors={state.connectors} /> : null}
        {activeSection === 'billing' ? <BillingSection billing={state.billing} snapshots={filteredSnapshots} /> : null}
        {activeSection === 'operations' ? <OperationsSection operations={state.operations} /> : null}
        {activeSection === 'nexus' ? <NexusSection snapshots={filteredSnapshots} operations={state.operations} /> : null}
      </section>
    </main>
  );
}

function OverviewSection(props: {
  overview: AdminOverview | null;
  snapshots: any[];
  operations: AdminOperationalIssues | null;
}) {
  const overview = props.overview;
  return (
    <>
      <div className="admin-metric-grid">
        <MetricCard label="Total users" value={overview?.users.total} />
        <MetricCard label="Activated" value={overview?.users.activated} detail={formatRate(overview?.activation.activationRate)} />
        <MetricCard label="First actions" value={overview?.users.firstActionCompleted} detail={formatRate(overview?.activation.firstActionCompletionRate)} />
        <MetricCard label="Paid users" value={overview?.users.paid} />
        <MetricCard label="Connector users" value={overview?.connectors.usersWithConnectedConnectors} detail={formatRate(overview?.connectors.adoptionRate)} />
        <MetricCard label="Campaigns" value={overview?.campaigns.total} />
        <MetricCard label="Completed actions" value={overview?.campaigns.completedActions} />
        <MetricCard label="Open issues" value={overview?.operations.openIssues} tone={overview?.operations.openIssues ? 'warning' : 'normal'} />
      </div>
      <div className="admin-two-column">
        <SnapshotPanel
          chartMetrics={overviewChartMetrics}
          snapshots={props.snapshots}
          title="Growth Over Time"
        />
        <IssueList issues={props.operations?.issues ?? []} />
      </div>
    </>
  );
}

function FunnelSection(props: { funnel: AdminFunnel | null }) {
  const stages = props.funnel?.stages ?? [];
  return (
    <section className="admin-panel">
      <PanelTitle eyebrow="Lifecycle" title="Funnel and drop-off" />
      <div className="admin-funnel">
        {stages.map((stage) => (
          <div className="admin-funnel-row" key={stage.stage}>
            <div>
              <strong>{humanize(stage.stage)}</strong>
              <span>{stage.reached} reached · {stage.current} current</span>
            </div>
            <div className="admin-funnel-bar">
              <span style={{ width: `${Math.max(stage.conversionFromPrevious * 100, 2)}%` }} />
            </div>
            <small>{formatRate(stage.conversionFromPrevious)} from previous</small>
            <small>{stage.dropoffFromPrevious} dropped</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsersSection(props: {
  users: AdminUsersResult | null;
  query: string;
  selectedUser: any | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onOpenUser: (userId: string) => void;
}) {
  const users = props.users?.users ?? [];
  return (
    <div className="admin-users-layout">
      <section className="admin-panel">
        <PanelTitle eyebrow="Explorer" title="User state explorer" />
        <div className="admin-search">
          <Search size={16} />
          <input
            onChange={(event) => props.onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') props.onSearch();
            }}
            placeholder="Search by email or name"
            value={props.query}
          />
          <button className="admin-primary-button" onClick={props.onSearch} type="button">Search</button>
        </div>
        <div className="admin-table">
          {users.map((user) => (
            <button className="admin-user-row" key={user.id} onClick={() => props.onOpenUser(user.id)} type="button">
              <div>
                <strong>{user.fullName || 'Unnamed user'}</strong>
                <span>{user.email}</span>
              </div>
              <StatusPill label={user.lifecycleSnapshot?.currentStage || 'unknown'} />
              <small>{user._count?.campaigns ?? 0} campaigns</small>
              <small>{user._count?.actionItems ?? 0} actions</small>
            </button>
          ))}
        </div>
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="Selected" title="User detail" />
        {props.selectedUser ? (
          <div className="admin-detail-stack">
            <div>
              <h3>{props.selectedUser.fullName || 'Unnamed user'}</h3>
              <p>{props.selectedUser.email}</p>
            </div>
            <StatusPill label={props.selectedUser.lifecycleSnapshot?.currentStage || 'unknown'} />
            <MetricCard compact label="Campaigns" value={props.selectedUser.campaigns?.length ?? 0} />
            <MetricCard compact label="Connectors" value={props.selectedUser.userConnectors?.length ?? 0} />
            <MetricCard compact label="Lifecycle events" value={props.selectedUser.lifecycleEvents?.length ?? 0} />
            <div className="admin-mini-list">
              {(props.selectedUser.campaigns ?? []).slice(0, 5).map((campaign: any) => (
                <div key={campaign.id}>
                  <strong>{campaign.title}</strong>
                  <span>{campaign.actionItems?.length ?? 0} actions · {campaign.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="admin-muted">Select a user to inspect lifecycle, campaigns, connectors, billing, and referral state.</p>
        )}
      </section>
    </div>
  );
}

function CampaignsSection(props: { campaigns: AdminCampaignAnalytics | null }) {
  return (
    <div className="admin-two-column">
      <section className="admin-panel">
        <PanelTitle eyebrow="Execution" title="Campaign and action totals" />
        <div className="admin-metric-grid compact">
          <MetricCard label="Campaigns" value={props.campaigns?.totals.campaigns} />
          <MetricCard label="Action items" value={props.campaigns?.totals.actionItems} />
        </div>
        <GroupedRows title="Campaign status" rows={props.campaigns?.campaignStatus ?? []} field="status" />
        <GroupedRows title="Action status" rows={props.campaigns?.actionStatus ?? []} field="status" />
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="Lanes" title="Action engine shape" />
        <GroupedRows title="Lane status" rows={props.campaigns?.laneStatus ?? []} field="status" />
        <GroupedRows title="Cycle status" rows={props.campaigns?.cycleStatus ?? []} field="status" />
      </section>
    </div>
  );
}

function ConnectorsSection(props: { connectors: AdminConnectorAnalytics | null }) {
  return (
    <div className="admin-two-column">
      <section className="admin-panel">
        <PanelTitle eyebrow="Data bridges" title="Connector status" />
        <GroupedRows title="Status counts" rows={props.connectors?.statusCounts ?? []} field="status" />
        <GroupedRows title="Provider status" rows={(props.connectors?.providerStatusCounts ?? []).map((row) => ({
          ...row,
          providerName: row.provider?.displayName || row.provider?.providerKey || 'Unknown provider',
        }))} field="providerName" secondaryField="status" />
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="Failures" title="Recent connector issues" />
        <div className="admin-mini-list">
          {(props.connectors?.recentFailures ?? []).map((failure) => (
            <div key={failure.id}>
              <strong>{failure.user?.email || 'Unknown user'}</strong>
              <span>{failure.capabilityProvider?.displayName || failure.providerName || 'Connector'} · {failure.status}</span>
            </div>
          ))}
          {props.connectors?.recentFailures?.length === 0 ? <p className="admin-muted">No recent connector failures.</p> : null}
        </div>
      </section>
    </div>
  );
}

function BillingSection(props: { billing: AdminBillingReferralAnalytics | null; snapshots: any[] }) {
  return (
    <div className="admin-two-column">
      <section className="admin-panel">
        <PanelTitle eyebrow="Revenue" title="Billing and plan distribution" />
        <GroupedRows
          title="Plans"
          rows={(props.billing?.planDistribution ?? []).map((row) => ({
            ...row,
            planName: row.plan?.name || row.plan?.code || 'Unknown plan',
          }))}
          field="planName"
          secondaryField="status"
        />
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="Growth loop" title="Referrals" />
        <div className="admin-metric-grid compact">
          <MetricCard label="Visits" value={props.billing?.referrals.visits} />
          <MetricCard label="Attributions" value={props.billing?.referrals.attributions} />
          <MetricCard label="Paid conversions" value={props.billing?.referrals.paidConversions} />
        </div>
        <SnapshotPanel
          chartMetrics={revenueChartMetrics}
          snapshots={props.snapshots.filter((snapshot) => snapshot.metricKey.startsWith('billing.') || snapshot.metricKey.startsWith('referrals.'))}
          title="Revenue and Referral Trends"
        />
      </section>
    </div>
  );
}

function OperationsSection(props: { operations: AdminOperationalIssues | null }) {
  return (
    <section className="admin-panel">
      <PanelTitle eyebrow="Health" title="Operational issues" />
      <IssueList issues={props.operations?.issues ?? []} />
    </section>
  );
}

function NexusSection(props: { snapshots: any[]; operations: AdminOperationalIssues | null }) {
  return (
    <div className="admin-two-column">
      <section className="admin-panel">
        <PanelTitle eyebrow="Simulation" title="Nexus Audit readiness" />
        <p className="admin-muted">
          This view exposes the durable metrics generated by the growth simulation. Use it to compare synthetic lifecycle, revenue, CRM, retention, and usage behavior after large E2E runs.
        </p>
        <SnapshotPanel
          chartMetrics={nexusChartMetrics}
          snapshots={props.snapshots}
          title="Observed Simulation Trends"
        />
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="Validation" title="Failure triage" />
        <IssueList issues={props.operations?.issues ?? []} />
      </section>
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value?: number | string | undefined;
  detail?: string | undefined;
  tone?: 'normal' | 'warning' | undefined;
  compact?: boolean | undefined;
}) {
  return (
    <div className={`admin-metric-card ${props.compact ? 'compact' : ''} ${props.tone === 'warning' ? 'warning' : ''}`}>
      <span>{props.label}</span>
      <strong>{props.value ?? '—'}</strong>
      {props.detail ? <small>{props.detail}</small> : null}
    </div>
  );
}

function SnapshotPanel(props: { title: string; snapshots: any[]; chartMetrics?: string[] }) {
  const chartMetrics = props.chartMetrics ?? snapshotMetrics;
  const chartSeries = chartMetrics
    .map((metricKey) => buildMetricSeries(props.snapshots, metricKey))
    .filter((series) => series.points.length > 0);
  const rows = props.snapshots.slice(-12);
  return (
    <section className="admin-panel nested">
      <PanelTitle eyebrow="Historical" title={props.title} />
      <div className="admin-chart-grid">
        {chartSeries.map((series) => (
          <MetricTrendChart key={series.metricKey} series={series} />
        ))}
        {!chartSeries.length ? <p className="admin-muted">No metric snapshots yet.</p> : null}
      </div>
      <div className="admin-snapshot-list">
        {rows.map((snapshot) => (
          <div key={snapshot.id}>
            <span>{formatMonth(snapshot.periodStart)} · {snapshot.metricKey}</span>
            <strong>{formatMetricValue(snapshot.metricKey, snapshot.metricValue)}</strong>
          </div>
        ))}
        {!rows.length ? <p className="admin-muted">No metric snapshots yet.</p> : null}
      </div>
    </section>
  );
}

function MetricTrendChart(props: { series: MetricSeries }) {
  const { series } = props;
  const width = 280;
  const height = 96;
  const padding = 10;
  const maxValue = Math.max(...series.points.map((point) => point.value), 0);
  const minValue = Math.min(...series.points.map((point) => point.value), 0);
  const range = Math.max(maxValue - minValue, 1);
  const pointCount = Math.max(series.points.length - 1, 1);
  const coordinates = series.points.map((point, index) => {
    const x = padding + (index / pointCount) * (width - padding * 2);
    const y = height - padding - ((point.value - minValue) / range) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const latest = series.points[series.points.length - 1];
  const previous = series.points[series.points.length - 2];
  const delta = latest && previous ? latest.value - previous.value : 0;

  return (
    <article className="admin-chart-card">
      <header>
        <span>{humanize(series.metricKey)}</span>
        <strong>{latest ? formatMetricValue(series.metricKey, latest.value) : '—'}</strong>
      </header>
      <svg aria-hidden="true" className="admin-line-chart" viewBox={`0 0 ${width} ${height}`}>
        <line className="admin-chart-gridline" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line className="admin-chart-gridline" x1={padding} x2={width - padding} y1={padding} y2={padding} />
        <path className="admin-chart-path" d={path} />
        {coordinates.map((point) => (
          <circle className="admin-chart-point" cx={point.x} cy={point.y} key={point.month} r="3" />
        ))}
      </svg>
      <footer>
        <span>{series.points[0]?.month ?? '—'} to {latest?.month ?? '—'}</span>
        <strong className={delta >= 0 ? 'positive' : 'negative'}>{formatDelta(series.metricKey, delta)}</strong>
      </footer>
    </article>
  );
}

function IssueList(props: { issues: any[] }) {
  if (!props.issues.length) {
    return <p className="admin-muted">No operational issues are currently open.</p>;
  }
  return (
    <div className="admin-mini-list">
      {props.issues.map((issue) => (
        <div key={issue.id}>
          <strong>{issue.title}</strong>
          <span>{issue.source} · {issue.severity} · {issue.status}</span>
        </div>
      ))}
    </div>
  );
}

function GroupedRows(props: { title: string; rows: any[]; field: string; secondaryField?: string }) {
  return (
    <div className="admin-grouped-rows">
      <h3>{props.title}</h3>
      {props.rows.map((row, index) => (
        <div key={`${props.title}-${index}`}>
          <span>
            {humanize(row[props.field] || 'unknown')}
            {props.secondaryField ? ` · ${humanize(row[props.secondaryField] || 'unknown')}` : ''}
          </span>
          <strong>{row._count?._all ?? row.count ?? 0}</strong>
        </div>
      ))}
      {!props.rows.length ? <p className="admin-muted">No data yet.</p> : null}
    </div>
  );
}

function PanelTitle(props: { eyebrow: string; title: string }) {
  return (
    <header className="admin-panel-title">
      <p className="eyebrow">{props.eyebrow}</p>
      <h3>{props.title}</h3>
    </header>
  );
}

function StatusPill(props: { label: string }) {
  return <span className="admin-status-pill">{humanize(props.label)}</span>;
}

function sectionTitle(section: AdminSection) {
  return sections.find((candidate) => candidate.id === section)?.label ?? 'Admin';
}

function formatRate(value?: number) {
  if (value === undefined || value === null) return undefined;
  return `${Math.round(value * 100)}%`;
}

function formatMonth(value?: string | null) {
  if (!value) return 'Current';
  return value.slice(0, 7);
}

function formatMetricValue(metricKey: string, value: unknown) {
  const numeric = Number(value);
  if (metricKey.endsWith('_cents')) {
    return `$${Math.round(numeric / 100).toLocaleString()}`;
  }
  if (metricKey.endsWith('_rate')) {
    return `${numeric}%`;
  }
  return Number.isFinite(numeric) ? numeric.toLocaleString() : String(value ?? '—');
}

function humanize(value: string) {
  return value.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface MetricSeries {
  metricKey: string;
  points: Array<{ month: string; value: number }>;
}

function buildMetricSeries(snapshots: any[], metricKey: string): MetricSeries {
  const byMonth = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (snapshot.metricKey !== metricKey || snapshot.dimensionsJson) continue;
    const month = formatMonth(snapshot.periodStart);
    byMonth.set(month, Number(snapshot.metricValue));
  }

  return {
    metricKey,
    points: Array.from(byMonth.entries())
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

function formatDelta(metricKey: string, delta: number) {
  const prefix = delta > 0 ? '+' : '';
  if (metricKey.endsWith('_cents')) {
    return `${prefix}$${Math.round(delta / 100).toLocaleString()}`;
  }
  return `${prefix}${delta.toLocaleString()}`;
}
