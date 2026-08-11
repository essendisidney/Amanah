import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { apiGet, apiPost, supabase } from './src/api';
import { registerDevicePushToken } from './src/push';

type Tab =
  | 'home'
  | 'circles'
  | 'dues'
  | 'wallet'
  | 'finance'
  | 'officer'
  | 'invites'
  | 'kyc';

type MeResponse = {
  ok: boolean;
  profile?: {
    full_name?: string | null;
    email?: string | null;
    kyc_status?: string | null;
  };
  wallets?: Array<{ currency: string; available_balance: number | string }>;
};

type Membership = {
  id: string;
  role: string;
  status: string;
  jamiya?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    contribution_amount: number | string;
    currency: string;
    member_count: number;
    max_members: number;
    current_cycle: number;
    cycle_count: number;
  } | null;
};

type Contribution = {
  id: string;
  cycle_number: number;
  amount: number | string;
  currency: string;
  status: string;
  due_date: string;
};

type Invitation = {
  id: string;
  status: string;
  jamiya?: { name?: string; slug?: string } | null;
};

type KycResponse = {
  ok: boolean;
  kycStatus: string;
  documents: Array<{ id: string; document_type: string; status: string }>;
};

type WalletResponse = {
  ok: boolean;
  wallets: Array<{
    currency: string;
    balance: number | string;
    available_balance: number | string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: number | string;
    currency: string;
    direction: string;
    status: string;
    created_at: string;
  }>;
  pendingIntents: Array<{
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    provider: string;
  }>;
  failedIntents: Array<{
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    error_message?: string | null;
  }>;
};

type QardLoan = {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  purpose: string;
  amount_repaid?: number | string;
};

type OfficerResponse = {
  ok: boolean;
  role: string;
  lateCount: number;
  pendingGrace: number;
  nextPayouts: Array<{
    id: string;
    cycle_number: number;
    amount: number | string;
    currency: string;
    scheduled_date: string | null;
  }>;
  graceRequests: Array<{ id: string; reason: string | null; requested_days: number }>;
  members: Array<{
    id: string;
    role: string;
    status: string;
    profile?: { full_name?: string | null; email?: string | null } | null;
  }>;
};

const TABS: Array<[Tab, string]> = [
  ['home', 'Home'],
  ['circles', 'Circles'],
  ['dues', 'Dues'],
  ['wallet', 'Wallet'],
  ['finance', 'Finance'],
  ['officer', 'Officer'],
  ['invites', 'Invites'],
  ['kyc', 'KYC'],
];

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [kyc, setKyc] = useState<KycResponse | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loans, setLoans] = useState<QardLoan[]>([]);
  const [officer, setOfficer] = useState<OfficerResponse | null>(null);
  const [officerJamiyaId, setOfficerJamiyaId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [qardAmount, setQardAmount] = useState('1000');
  const [qardPurpose, setQardPurpose] = useState('Short-term need');
  const [qardJamiyaId, setQardJamiyaId] = useState('');
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleAmount, setNewCircleAmount] = useState('1000');
  const [newCircleMembers, setNewCircleMembers] = useState('5');
  const [newCircleCycles, setNewCircleCycles] = useState('6');
  const [inviteJamiyaId, setInviteJamiyaId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (accessToken: string, active: Tab) => {
      setError(null);
      try {
        if (active === 'home') {
          setMe(await apiGet<MeResponse>('/api/v1/me', accessToken));
        } else if (active === 'circles') {
          const data = await apiGet<{ ok: boolean; memberships: Membership[] }>(
            '/api/v1/circles',
            accessToken,
          );
          setMemberships(data.memberships ?? []);
          const adminCircle =
            data.memberships?.find((m) => m.role === 'circle_admin') ??
            data.memberships?.[0] ??
            null;
          if (!inviteJamiyaId && adminCircle?.jamiya?.id) {
            setInviteJamiyaId(adminCircle.jamiya.id);
          }
        } else if (active === 'dues') {
          const data = await apiGet<{ ok: boolean; contributions: Contribution[] }>(
            '/api/v1/contributions',
            accessToken,
          );
          setContributions(data.contributions ?? []);
        } else if (active === 'wallet') {
          setWallet(await apiGet<WalletResponse>('/api/v1/wallet', accessToken));
        } else if (active === 'finance') {
          const [qard, circles] = await Promise.all([
            apiGet<{ ok: boolean; loans: QardLoan[] }>('/api/v1/finance/qard', accessToken),
            apiGet<{ ok: boolean; memberships: Membership[] }>('/api/v1/circles', accessToken),
          ]);
          setLoans(qard.loans ?? []);
          setMemberships(circles.memberships ?? []);
          if (!qardJamiyaId && circles.memberships?.[0]?.jamiya?.id) {
            setQardJamiyaId(circles.memberships[0].jamiya!.id);
          }
        } else if (active === 'officer') {
          const circles = await apiGet<{ ok: boolean; memberships: Membership[] }>(
            '/api/v1/circles',
            accessToken,
          );
          setMemberships(circles.memberships ?? []);
          const officerCircle =
            circles.memberships?.find((m) =>
              ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(m.role),
            ) ?? null;
          const jid = officerCircle?.jamiya?.id ?? null;
          setOfficerJamiyaId(jid);
          if (jid) {
            setOfficer(
              await apiGet<OfficerResponse>(`/api/v1/circles/${jid}/officer`, accessToken),
            );
          } else {
            setOfficer(null);
          }
        } else if (active === 'invites') {
          const data = await apiGet<{ ok: boolean; invitations: Invitation[] }>(
            '/api/v1/invitations',
            accessToken,
          );
          setInvitations(data.invitations ?? []);
        } else if (active === 'kyc') {
          setKyc(await apiGet<KycResponse>('/api/v1/kyc', accessToken));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    },
    [qardJamiyaId, inviteJamiyaId],
  );

  useEffect(() => {
    if (!token) return;
    void refresh(token, tab);
  }, [token, tab, refresh]);

  async function signIn() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      const access = data.session?.access_token ?? null;
      setToken(access);
      if (access) void registerDevicePushToken(access);
      setTab('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function createCircle() {
    if (!token) return;
    const name = newCircleName.trim();
    const amount = Number(newCircleAmount);
    const maxMembers = Number(newCircleMembers);
    const cycleCount = Number(newCircleCycles);
    if (name.length < 3) {
      setError('Circle name must be at least 3 characters');
      return;
    }
    if (!Number.isFinite(amount) || amount < 100) {
      setError('Contribution must be at least 100');
      return;
    }
    if (!Number.isFinite(maxMembers) || maxMembers < 2) {
      setError('Need at least 2 members');
      return;
    }
    if (!Number.isFinite(cycleCount) || cycleCount < 2) {
      setError('Need at least 2 cycles');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<{
        ok: boolean;
        circle?: { id: string; slug: string; name: string };
        jamiya?: { id: string; slug: string; name: string };
        error?: string;
      }>('/api/v1/circles', token, {
        name,
        contributionAmount: amount,
        currency: 'KES',
        maxMembers,
        cycleCount,
        contributionFrequencyDays: 30,
        status: 'open',
      });
      const created = result.circle ?? result.jamiya;
      setMessage(`Created ${created?.name ?? 'circle'}`);
      setNewCircleName('');
      if (created?.id) setInviteJamiyaId(created.id);
      await refresh(token, 'circles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create circle failed');
    } finally {
      setLoading(false);
    }
  }

  async function inviteMember() {
    if (!token) return;
    if (!inviteJamiyaId) {
      setError('Select a circle to invite into');
      return;
    }
    if (!inviteEmail.trim() && !invitePhone.trim()) {
      setError('Enter invitee email or phone (+254…)');
      return;
    }
    setLoading(true);
    setError(null);
    setLastInviteUrl(null);
    setLastInviteCode(null);
    try {
      const result = await apiPost<{
        ok: boolean;
        inviteUrl?: string;
        inviteCode?: string;
        token?: string;
        error?: string;
      }>('/api/v1/invitations', token, {
        jamiyaId: inviteJamiyaId,
        email: inviteEmail.trim() || undefined,
        phone: invitePhone.trim() || undefined,
      });
      setMessage('Invitation created — use Share / WhatsApp / QR below');
      setLastInviteUrl(result.inviteUrl ?? null);
      setLastInviteCode(result.inviteCode ?? result.token ?? null);
      setInviteEmail('');
      setInvitePhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setLoading(false);
    }
  }

  async function shareInvite(channel: 'system' | 'whatsapp' | 'sms') {
    if (!lastInviteUrl) return;
    const codeLine = lastInviteCode ? `Invite code: ${lastInviteCode}\n` : '';
    const body = `You're invited to join an Amanah savings circle.\n\n${codeLine}Or open: ${lastInviteUrl}`;
    try {
      if (channel === 'whatsapp') {
        await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(body)}`);
        return;
      }
      if (channel === 'sms') {
        await Linking.openURL(`sms:?body=${encodeURIComponent(body)}`);
        return;
      }
      await Share.share({ message: body, url: lastInviteUrl, title: 'Amanah invitation' });
    } catch {
      setError('Could not open share sheet');
    }
  }

  async function payContribution(id: string) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/v1/contributions/pay', token, { contributionId: id });
      setMessage('Contribution paid');
      await refresh(token, 'dues');
      await refresh(token, 'home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  async function topUp() {
    if (!token) return;
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount < 100) {
      setError('Top-up must be at least 100');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/v1/wallet/top-up', token, { amount, currency: 'KES' });
      setMessage('Wallet topped up');
      await refresh(token, 'wallet');
      await refresh(token, 'home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setLoading(false);
    }
  }

  async function retryIntent(intentId: string) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/v1/wallet/retry', token, { intentId });
      setMessage('Intent retried');
      await refresh(token, 'wallet');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  }

  async function requestQard() {
    if (!token || !qardJamiyaId) {
      setError('Pick a circle for Qard');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/v1/finance/qard', token, {
        action: 'request',
        jamiyaId: qardJamiyaId,
        amount: Number(qardAmount),
        purpose: qardPurpose,
        installments: 4,
      });
      setMessage('Qard requested');
      await refresh(token, 'finance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qard request failed');
    } finally {
      setLoading(false);
    }
  }

  async function decideGrace(requestId: string, approve: boolean) {
    if (!token || !officerJamiyaId) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/api/v1/circles/${officerJamiyaId}/officer`, token, {
        action: 'decide_grace',
        requestId,
        approve,
      });
      setMessage(approve ? 'Grace approved' : 'Grace rejected');
      await refresh(token, 'officer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grace decision failed');
    } finally {
      setLoading(false);
    }
  }

  async function respondInvite(decision: 'accept' | 'decline') {
    if (!token || !inviteToken.trim()) {
      setError('Paste the invite code from the share panel or invite link');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/v1/invitations/respond', token, {
        token: inviteToken.trim(),
        decision,
      });
      setMessage(decision === 'accept' ? 'Joined circle' : 'Invite declined');
      setInviteToken('');
      await refresh(token, 'invites');
      await refresh(token, 'circles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite action failed');
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setToken(null);
    setMe(null);
    setMemberships([]);
    setContributions([]);
    setInvitations([]);
    setKyc(null);
    setWallet(null);
    setLoans([]);
    setOfficer(null);
    void supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>Amanah</Text>
        <Text style={styles.sub}>Create circles, invite members, wallet &amp; dues</Text>

        {!token ? (
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
            />
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
            />
            {loading ? (
              <ActivityIndicator color="#047857" />
            ) : (
              <Button title="Sign in" color="#047857" onPress={() => void signIn()} />
            )}
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              {TABS.map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tab, tab === key && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'home' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>
                  {me?.profile?.full_name ?? me?.profile?.email ?? 'Member'}
                </Text>
                <Text style={styles.meta}>KYC: {me?.profile?.kyc_status ?? '—'}</Text>
                {(me?.wallets ?? []).map((w) => (
                  <Text key={w.currency} style={styles.wallet}>
                    {w.currency}: {String(w.available_balance)}
                  </Text>
                ))}
                <Button title="Sign out" color="#6b7280" onPress={signOut} />
              </View>
            ) : null}

            {tab === 'circles' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>My circles</Text>
                {memberships.length === 0 ? (
                  <Text style={styles.meta}>No circles yet — create one below</Text>
                ) : (
                  memberships.map((m) => (
                    <View key={m.id} style={styles.row}>
                      <Text style={styles.rowTitle}>{m.jamiya?.name ?? 'Circle'}</Text>
                      <Text style={styles.meta}>
                        {m.role} · {m.jamiya?.status} · cycle{' '}
                        {m.jamiya?.current_cycle}/{m.jamiya?.cycle_count}
                      </Text>
                      <Text style={styles.meta}>id {m.jamiya?.id ?? '—'}</Text>
                    </View>
                  ))
                )}

                <Text style={styles.heading}>Create circle</Text>
                <TextInput
                  style={styles.input}
                  value={newCircleName}
                  onChangeText={setNewCircleName}
                  placeholder="Circle name"
                />
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={newCircleAmount}
                  onChangeText={setNewCircleAmount}
                  placeholder="Contribution (KES)"
                />
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={newCircleMembers}
                  onChangeText={setNewCircleMembers}
                  placeholder="Max members"
                />
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={newCircleCycles}
                  onChangeText={setNewCircleCycles}
                  placeholder="Number of cycles"
                />
                <Button
                  title="Create circle"
                  color="#047857"
                  onPress={() => void createCircle()}
                />

                <Text style={styles.heading}>Invite member</Text>
                <Text style={styles.meta}>
                  Only circle admins can invite. Paste circle id or use the one filled after create.
                </Text>
                <TextInput
                  style={styles.input}
                  value={inviteJamiyaId}
                  onChangeText={setInviteJamiyaId}
                  placeholder="Circle id"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Invitee email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  value={invitePhone}
                  onChangeText={setInvitePhone}
                  placeholder="Phone +2547…"
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                />
                <Button
                  title="Send invite"
                  color="#047857"
                  onPress={() => void inviteMember()}
                />
                {lastInviteUrl ? (
                  <View style={styles.shareBox}>
                    <Text style={styles.meta} selectable>
                      Link: {lastInviteUrl}
                    </Text>
                    {lastInviteCode ? (
                      <Text style={styles.meta} selectable>
                        Code: {lastInviteCode}
                      </Text>
                    ) : null}
                    <View style={styles.shareRow}>
                      <Button
                        title="Share…"
                        color="#047857"
                        onPress={() => void shareInvite('system')}
                      />
                      <Button
                        title="WhatsApp"
                        color="#128C7E"
                        onPress={() => void shareInvite('whatsapp')}
                      />
                      <Button
                        title="SMS"
                        color="#2563eb"
                        onPress={() => void shareInvite('sms')}
                      />
                    </View>
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lastInviteUrl)}`,
                      }}
                      style={styles.qr}
                      accessibilityLabel="Invitation QR code"
                    />
                    <Text style={styles.meta}>Scan QR or paste the code in Invites tab</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {tab === 'dues' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Due contributions</Text>
                {contributions.length === 0 ? (
                  <Text style={styles.meta}>Nothing due</Text>
                ) : (
                  contributions.map((c) => (
                    <View key={c.id} style={styles.row}>
                      <Text style={styles.rowTitle}>
                        Cycle {c.cycle_number} · {String(c.amount)} {c.currency}
                      </Text>
                      <Text style={styles.meta}>
                        {c.status} · due {c.due_date}
                      </Text>
                      {loading ? (
                        <ActivityIndicator color="#047857" />
                      ) : (
                        <Button
                          title="Pay from wallet"
                          color="#047857"
                          onPress={() => void payContribution(c.id)}
                        />
                      )}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {tab === 'wallet' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Wallet</Text>
                {(wallet?.wallets ?? []).map((w) => (
                  <Text key={w.currency} style={styles.wallet}>
                    {w.currency} available {String(w.available_balance)} / balance{' '}
                    {String(w.balance)}
                  </Text>
                ))}
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={topUpAmount}
                  onChangeText={setTopUpAmount}
                  placeholder="Top-up amount"
                />
                <Button title="Top up (simulated/bank)" color="#047857" onPress={() => void topUp()} />
                {(wallet?.failedIntents ?? []).map((intent) => (
                  <View key={intent.id} style={styles.row}>
                    <Text style={styles.meta}>
                      Failed {String(intent.amount)} {intent.currency}:{' '}
                      {intent.error_message ?? intent.status}
                    </Text>
                    <Button
                      title="Retry"
                      color="#047857"
                      onPress={() => void retryIntent(intent.id)}
                    />
                  </View>
                ))}
                {(wallet?.transactions ?? []).slice(0, 8).map((tx) => (
                  <Text key={tx.id} style={styles.meta}>
                    {tx.direction} {String(tx.amount)} {tx.currency} · {tx.type} · {tx.status}
                  </Text>
                ))}
              </View>
            ) : null}

            {tab === 'finance' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Qard</Text>
                <Text style={styles.meta}>Request an interest-free circle loan.</Text>
                <TextInput
                  style={styles.input}
                  value={qardJamiyaId}
                  onChangeText={setQardJamiyaId}
                  placeholder="Circle id"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={qardAmount}
                  onChangeText={setQardAmount}
                  placeholder="Amount"
                />
                <TextInput
                  style={styles.input}
                  value={qardPurpose}
                  onChangeText={setQardPurpose}
                  placeholder="Purpose"
                />
                <Button title="Request Qard" color="#047857" onPress={() => void requestQard()} />
                {loans.map((loan) => (
                  <View key={loan.id} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {String(loan.amount)} {loan.currency} · {loan.status}
                    </Text>
                    <Text style={styles.meta}>{loan.purpose}</Text>
                  </View>
                ))}
                <Text style={styles.meta}>
                  Tawarruq, goals, and welfare are available on web; mobile uses the same
                  /api/v1/finance/* routes.
                </Text>
              </View>
            ) : null}

            {tab === 'officer' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Officer</Text>
                {!officerJamiyaId ? (
                  <Text style={styles.meta}>
                    No officer role on your circles (need chair, treasurer, secretary, or
                    circle_admin).
                  </Text>
                ) : (
                  <>
                    <Text style={styles.meta}>
                      Role {officer?.role} · late {officer?.lateCount ?? 0} · grace{' '}
                      {officer?.pendingGrace ?? 0}
                    </Text>
                    {(officer?.nextPayouts ?? []).map((p) => (
                      <Text key={p.id} style={styles.meta}>
                        Next payout cycle {p.cycle_number}: {String(p.amount)} {p.currency}
                      </Text>
                    ))}
                    {(officer?.graceRequests ?? []).map((g) => (
                      <View key={g.id} style={styles.row}>
                        <Text style={styles.meta}>
                          Grace {g.requested_days}d · {g.reason ?? 'no reason'}
                        </Text>
                        <View style={styles.rowActions}>
                          <Button
                            title="Approve"
                            color="#047857"
                            onPress={() => void decideGrace(g.id, true)}
                          />
                          <Button
                            title="Reject"
                            color="#b91c1c"
                            onPress={() => void decideGrace(g.id, false)}
                          />
                        </View>
                      </View>
                    ))}
                    {(officer?.members ?? []).slice(0, 12).map((m) => (
                      <Text key={m.id} style={styles.meta}>
                        {m.profile?.full_name ?? m.profile?.email ?? m.id.slice(0, 8)} · {m.role} ·{' '}
                        {m.status}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            ) : null}

            {tab === 'invites' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Invitations</Text>
                {invitations.map((inv) => (
                  <Text key={inv.id} style={styles.meta}>
                    {inv.jamiya?.name ?? 'Circle'} · {inv.status}
                  </Text>
                ))}
                <Text style={styles.meta}>
                  Paste the invite code (or token from the invite link) to accept or decline.
                </Text>
                <TextInput
                  style={styles.input}
                  value={inviteToken}
                  onChangeText={setInviteToken}
                  placeholder="Invite code"
                  autoCapitalize="none"
                />
                <View style={styles.rowActions}>
                  <Button
                    title="Accept"
                    color="#047857"
                    onPress={() => void respondInvite('accept')}
                  />
                  <Button
                    title="Decline"
                    color="#b91c1c"
                    onPress={() => void respondInvite('decline')}
                  />
                </View>
              </View>
            ) : null}

            {tab === 'kyc' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>KYC</Text>
                <Text style={styles.meta}>Status: {kyc?.kycStatus ?? '—'}</Text>
                {(kyc?.documents ?? []).map((doc) => (
                  <Text key={doc.id} style={styles.meta}>
                    {doc.document_type} · {doc.status}
                  </Text>
                ))}
                <Text style={styles.meta}>
                  Upload documents from the web profile for now; mobile registers paths via
                  POST /api/v1/kyc after Storage upload.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef5f0' },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  brand: { fontSize: 36, fontWeight: '700', color: '#047857' },
  sub: { color: '#4b5563', marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heading: { fontSize: 20, fontWeight: '600', color: '#111827' },
  wallet: { fontSize: 16, color: '#111827' },
  meta: { fontSize: 14, color: '#6b7280' },
  error: { color: '#b91c1c' },
  ok: { color: '#047857' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: '#047857', borderColor: '#047857' },
  tabText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  row: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  rowActions: { gap: 8 },
  shareBox: { gap: 10, marginTop: 4 },
  shareRow: { gap: 8 },
  qr: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});
