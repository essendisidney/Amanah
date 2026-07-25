import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { apiGet, apiPost, supabase } from './src/api';

type Tab = 'home' | 'circles' | 'dues' | 'invites' | 'kyc';

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
  const [inviteToken, setInviteToken] = useState('');
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
            '/api/v1/jamiyas',
            accessToken,
          );
          setMemberships(data.memberships ?? []);
        } else if (active === 'dues') {
          const data = await apiGet<{ ok: boolean; contributions: Contribution[] }>(
            '/api/v1/contributions',
            accessToken,
          );
          setContributions(data.contributions ?? []);
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
    [],
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
      setToken(data.session?.access_token ?? null);
      setTab('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
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

  async function respondInvite(decision: 'accept' | 'decline') {
    if (!token || !inviteToken.trim()) {
      setError('Paste the invite token from your email/SMS link');
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
    void supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>Amanah</Text>
        <Text style={styles.sub}>Phase 6 · circles, dues, invites, KYC</Text>

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
              {(
                [
                  ['home', 'Home'],
                  ['circles', 'Circles'],
                  ['dues', 'Dues'],
                  ['invites', 'Invites'],
                  ['kyc', 'KYC'],
                ] as const
              ).map(([key, label]) => (
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
                {(me?.wallets ?? []).map((wallet) => (
                  <Text key={wallet.currency} style={styles.wallet}>
                    {wallet.currency}: {String(wallet.available_balance)}
                  </Text>
                ))}
                <Button title="Sign out" color="#6b7280" onPress={signOut} />
              </View>
            ) : null}

            {tab === 'circles' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>My circles</Text>
                {memberships.length === 0 ? (
                  <Text style={styles.meta}>No circles yet</Text>
                ) : (
                  memberships.map((m) => (
                    <View key={m.id} style={styles.row}>
                      <Text style={styles.rowTitle}>{m.jamiya?.name ?? 'Circle'}</Text>
                      <Text style={styles.meta}>
                        {m.role} · {m.jamiya?.status} · cycle{' '}
                        {m.jamiya?.current_cycle}/{m.jamiya?.cycle_count}
                      </Text>
                    </View>
                  ))
                )}
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

            {tab === 'invites' ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Invitations</Text>
                {invitations.map((inv) => (
                  <Text key={inv.id} style={styles.meta}>
                    {inv.jamiya?.name ?? 'Circle'} · {inv.status}
                  </Text>
                ))}
                <Text style={styles.meta}>
                  Paste the token from your invite link to accept or decline.
                </Text>
                <TextInput
                  style={styles.input}
                  value={inviteToken}
                  onChangeText={setInviteToken}
                  placeholder="Invite token"
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
  row: { gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  rowActions: { gap: 8 },
});
