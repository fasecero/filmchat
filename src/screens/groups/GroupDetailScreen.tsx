import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, Share, Text, TextInput, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { signOutUser } from '../../services/auth';
import { type Group } from '../../services/groups';
import { buildInviteLink, createInvite, leaveGroup } from '../../services/invites';
import {
  createClientRequestId,
  loadOlderMessages,
  normalizeMessageText,
  sendTextMessage,
  subscribeToLatestMessages,
  type TextMessage,
} from '../../services/messages';

type PendingMessage = TextMessage & { status: 'sending' | 'failed' };

export function GroupDetailScreen({ group, userId, displayName, onBack, onLeft }: {
  group: Group;
  userId: string;
  displayName: string;
  onBack: () => void;
  onLeft: () => void;
}) {
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [pending, setPending] = useState<Record<string, PendingMessage>>({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const cursor = useRef<Parameters<typeof loadOlderMessages>[1]>(null);
  const listRef = useRef<FlatList<TextMessage | PendingMessage>>(null);
  const nearBottomRef = useRef(true);
  useEffect(() => {
    let active = true;
    void loadOlderMessages(group.id, null)
      .then((page) => {
        if (!active) return;
        cursor.current = page.cursor;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch(() => { if (active) { setError('We could not load the conversation.'); setLoading(false); } });
    const unsubscribe = subscribeToLatestMessages(
      group.id,
      (latest) => {
        if (!active) return;
        setMessages((current) => {
          const merged = new Map(current.map((message) => [message.id, message]));
          latest.forEach((message) => merged.set(message.id, message));
          return [...merged.values()].sort(compareMessages);
        });
        if (!nearBottomRef.current) setHasNewMessages(true);
      },
      () => { if (active) setError('The conversation is unavailable right now.'); },
    );
    return () => { active = false; unsubscribe(); };
  }, [group.id]);

  const allMessages = useMemo(() => {
    const merged = new Map<string, TextMessage | PendingMessage>(messages.map((message) => [message.id, message]));
    Object.values(pending).forEach((message) => { if (!merged.has(message.id)) merged.set(message.id, message); });
    return [...merged.values()].sort(compareMessages);
  }, [messages, pending]);

  const send = async (clientRequestId = createClientRequestId(), text = draft) => {
    let normalizedText: string;
    try { normalizedText = normalizeMessageText(text); } catch { return; }
    const messageId = `text_${clientRequestId}`;
    const optimistic: PendingMessage = {
      id: messageId,
      type: 'text',
      authorId: userId,
      authorDisplayNameSnapshot: displayName,
      text: normalizedText,
      createdAt: null,
      clientRequestId,
      status: 'sending',
    };
    setPending((current) => ({ ...current, [messageId]: optimistic }));
    if (!text || text === draft) setDraft('');
    setHasNewMessages(false);
    try {
      await sendTextMessage(group.id, userId, displayName, normalizedText, clientRequestId);
      setPending((current) => { const next = { ...current }; delete next[messageId]; return next; });
    } catch {
      setPending((current) => ({ ...current, [messageId]: { ...optimistic, status: 'failed' } }));
    }
  };

  const loadOlder = async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const page = await loadOlderMessages(group.id, cursor.current);
      cursor.current = page.cursor;
      setMessages((current) => mergeMessages(current, page.messages));
      setHasMore(page.hasMore);
    } catch { setError('We could not load older messages.'); }
    finally { setLoadingOlder(false); }
  };

  const shareInvite = async () => {
    try {
      const invite = await createInvite(group.id);
      await Share.share({ message: buildInviteLink(invite) });
    } catch {
      Alert.alert('Invite unavailable', 'We could not create an invite right now.');
    }
  };
  const confirmLeave = () => Alert.alert('Leave group?', 'You can rejoin later with a valid invite.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => { await leaveGroup(group.id); onLeft(); } },
  ]);
  return <View style={styles.container}>
    <View style={styles.header}><Button label="Back" onPress={onBack} secondary /><View style={styles.headerTitle}><Text style={styles.title}>{group.name}</Text><Text style={styles.subtitle}>Private conversation</Text></View><Pressable onPress={() => void shareInvite()}><Text style={styles.headerAction}>Share</Text></Pressable></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <Text style={styles.status}>Loading conversation...</Text> : <FlatList
      ref={listRef}
      data={allMessages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.messages}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const atBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 48;
        nearBottomRef.current = atBottom;
        if (atBottom) setHasNewMessages(false);
      }}
      scrollEventThrottle={100}
      renderItem={({ item, index }) => <MessageRow message={item} previous={allMessages[index - 1]} currentUserId={userId} onRetry={pending[item.id] ? () => void send(item.clientRequestId, item.text) : undefined} />}
      ListEmptyComponent={<Text style={styles.status}>No messages yet. Start the conversation.</Text>}
    />}
    {hasNewMessages ? <Pressable style={styles.newMessages} onPress={() => { listRef.current?.scrollToEnd({ animated: true }); setHasNewMessages(false); }}><Text style={styles.newMessagesText}>New messages</Text></Pressable> : null}
    <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Write a message" multiline style={styles.input} maxLength={2000} /><Pressable disabled={!draft.trim()} onPress={() => void send()} style={[styles.send, !draft.trim() && styles.sendDisabled]}><Text style={styles.sendText}>Send</Text></Pressable></View>
    <View style={styles.actions}><Button label="Leave group" onPress={confirmLeave} secondary /><Button label="Sign out" onPress={() => void signOutUser()} secondary /></View>
  </View>;
}

function MessageRow({ message, previous, currentUserId, onRetry }: { message: TextMessage | PendingMessage; previous?: TextMessage | PendingMessage; currentUserId: string; onRetry?: () => void }) {
  const outgoing = message.authorId === currentUserId;
  const showDate = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
  return <View>{showDate ? <Text style={styles.date}>{formatDate(message.createdAt)}</Text> : null}<View style={[styles.row, outgoing && styles.outgoing]}><View style={[styles.bubble, outgoing && styles.outgoingBubble]}><Text style={styles.author}>{outgoing ? 'You' : message.authorDisplayNameSnapshot}</Text><Text style={styles.body}>{message.text}</Text><Text style={styles.time}>{formatTime(message.createdAt)}{('status' in message && message.status === 'failed') ? '  Failed - tap retry' : ('status' in message && message.status === 'sending') ? '  Sending...' : ''}</Text>{onRetry ? <Pressable onPress={onRetry}><Text style={styles.retry}>Retry</Text></Pressable> : null}</View></View></View>;
}

const compareMessages = (left: TextMessage | PendingMessage, right: TextMessage | PendingMessage) => (left.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) - (right.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id);
const mergeMessages = (current: TextMessage[], incoming: TextMessage[]) => [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()].sort(compareMessages);
const dayKey = (timestamp: TextMessage['createdAt']) => timestamp ? new Date(timestamp.toMillis()).toDateString() : 'pending';
const formatDate = (timestamp: TextMessage['createdAt']) => timestamp ? new Date(timestamp.toMillis()).toLocaleDateString() : 'Today';
const formatTime = (timestamp: TextMessage['createdAt']) => timestamp ? new Date(timestamp.toMillis()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Pending';

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 8 },
  headerTitle: { flex: 1 }, title: { color: '#17313B', fontSize: 24, fontWeight: '800' }, subtitle: { color: '#52656B', fontSize: 13, marginTop: 2 }, headerAction: { color: '#C05640', fontWeight: '800', padding: 12 },
  messages: { gap: 8, paddingBottom: 12 }, status: { color: '#52656B', padding: 24, textAlign: 'center' }, error: { color: '#A3372C', padding: 8, textAlign: 'center' }, date: { color: '#52656B', fontSize: 12, marginVertical: 10, textAlign: 'center' },
  row: { alignItems: 'flex-start', flexDirection: 'row' }, outgoing: { justifyContent: 'flex-end' }, bubble: { backgroundColor: '#FFFFFF', borderRadius: 14, maxWidth: '82%', padding: 12 }, outgoingBubble: { backgroundColor: '#DCE9E5' }, author: { color: '#C05640', fontSize: 12, fontWeight: '800', marginBottom: 4 }, body: { color: '#17313B', fontSize: 16, lineHeight: 22 }, time: { color: '#6D7C7D', fontSize: 11, marginTop: 5 }, retry: { color: '#A3372C', fontSize: 12, fontWeight: '800', marginTop: 5 },
  newMessages: { alignSelf: 'center', backgroundColor: '#174A5B', borderRadius: 16, bottom: 92, paddingHorizontal: 14, paddingVertical: 8, position: 'absolute' }, newMessagesText: { color: '#FFFFFF', fontWeight: '700' }, composer: { alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 8 }, input: { color: '#17313B', flex: 1, maxHeight: 100, padding: 8 }, send: { backgroundColor: '#174A5B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }, sendDisabled: { backgroundColor: '#A7B5B5' }, sendText: { color: '#FFFFFF', fontWeight: '800' }, actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
});