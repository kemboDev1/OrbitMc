import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { register, validateBio, validateName, validatePassword } from '../src/data/auth';
import { sendMessage, addReaction, editMessage, pinMessage, deleteMessage, startDM } from '../src/data/chat';
import { db } from '../src/data/db';
import { chronologicalRemoteHistory } from '../src/data/cloud';
import { clearHistory, deleteChatForUser, getChatTheme, hiddenBefore, hideMessage, isBlocked, isChatDeleted, isMessageHidden, isMuted, replaceRemoteBlocks, restoreHistory, setBlocked, setChatTheme, setMuted } from '../src/data/chatControls';
import { AppError } from '../src/data/errors';
import { addRoom, joinInvite, leaveHub, makeHub } from '../src/data/hubs';
import { buyListing, cancelAura, claimDaily, createListing, equipListing, giftListing, hasAura, subscribeAura } from '../src/data/market';
import type { User } from '../src/data/types';
import { releaseAssetFor, type ReleaseAsset } from '../src/lib/downloads';

const isError = (key: string) => (error: unknown) => error instanceof AppError && error.key === key;

test('remote history loads the newest page in conversation order', () => {
  const newestFirst = [
    { id: 'newer', sender_id: 'user_a', recipient_id: 'user_b', body: 'newer message', image: null, sticker: null, reply_to: null, edited_at: null, pinned: false, reactions: {}, created_at: '2026-11-25T12:00:02.000654Z' },
    { id: 'older', sender_id: 'user_a', recipient_id: 'user_b', body: 'older message', image: null, sticker: null, reply_to: null, edited_at: null, pinned: false, reactions: {}, created_at: '2026-11-25T12:00:01.123456Z' },
  ];
  const history = chronologicalRemoteHistory(newestFirst);
  assert.deepEqual(history.map((message) => message.text), ['older message', 'newer message']);
  assert.deepEqual(history.map((message) => message.ts), [Date.parse('2026-11-25T12:00:01.123Z'), Date.parse('2026-11-25T12:00:02.000Z')]);
  assert.equal(history[0].remoteCreatedAt, '2026-11-25T12:00:01.123456Z', 'pagination keeps sub-millisecond database precision');
});

function addUser(id: string, username: string): User {
  const user: User = {
    id, username, name: username, bio: '', hue: 210, presence: 'offline', statusText: '',
    createdAt: Date.now(), aura: null, sparks: 300, inventory: [], frame: null, theme: null,
    accent: null, ring: false, lastDaily: 0, lastStipend: 0,
  };
  db.transaction((data) => { data.users[id] = user; });
  return user;
}

test('local profile previews, chats, rooms, bazaar and backups keep working', async () => {
  db.wipe();
  const user = addUser('user_test', 'test_user');
  const other = addUser('user_other', 'other_user');
  const recipient = addUser('user_gift', 'gift_user');
  assert.ok(Object.values(db.get().listings).some((listing) => listing.sellerId === 'orbit-studio' && listing.kind === 'theme'), 'the starter collection includes original themes');
  assert.ok(Object.values(db.get().listings).filter((listing) => listing.sellerId === 'orbit-studio').every((listing) => listing.kind !== 'stickers'), 'the studio shop does not seed sticker products');

  assert.equal(validateName('  Test   User '), 'Test User');
  assert.equal(validateBio(' hello '), 'hello');
  assert.equal(validatePassword('StrongPass123!'), 'StrongPass123!');
  await assert.rejects(() => register({ email: 'bad', username: 'test_user', name: 'Test User', password: 'StrongPass123!' }), isError('err.emailInvalid'));
  await assert.rejects(() => register({ email: 'test@example.com', username: 'x', name: 'Test User', password: 'StrongPass123!' }), isError('err.username'));

  const dm = startDM(user.id, user.id);
  const message = await sendMessage({ channel: dm, userId: user.id, text: 'Hello, little corner.' });
  await editMessage(dm, message.id, user.id, 'A revised hello.');
  await addReaction(dm, message.id, user.id, '✨');
  await pinMessage(dm, message.id, user.id);
  assert.equal(db.get().msgs[dm][0].text, 'A revised hello.');
  assert.equal(db.get().msgs[dm][0].pinned, true);
  assert.deepEqual(db.get().msgs[dm][0].reactions['✨'], [user.id]);
  assert.throws(() => sendMessage({ channel: dm, userId: user.id, text: ' '.repeat(3) }), isError('err.emptyMessage'));
  await deleteMessage(dm, message.id, user.id);
  assert.equal(db.get().msgs[dm].length, 0);

  const hub = makeHub({ userId: user.id, name: 'Test corner', about: 'A private place', emoji: '✳', public: false });
  assert.equal(joinInvite(hub.invite, other.id)?.id, hub.id);
  const room = addRoom(hub.id, user.id, 'behind-the-scenes');
  assert.ok(db.get().hubs[hub.id].rooms.some((item) => item.id === room));
  leaveHub(hub.id, other.id);
  assert.equal(db.get().hubs[hub.id].members[other.id], undefined);

  const set = createListing({ userId: user.id, kind: 'stickers', name: 'My set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  assert.equal(claimDaily(user.id), 25);
  assert.throws(() => claimDaily(user.id), isError('dailyDone'));
  db.transaction((data) => { data.users[other.id].sparks = 100; });
  const sellerBeforeSale = db.get().users[user.id].sparks;
  buyListing(other.id, set.id);
  assert.ok(db.get().users[other.id].inventory.includes(set.id));
  assert.equal(db.get().users[user.id].sparks, sellerBeforeSale + 21, 'free seller receives the sale after the 15% bazaar fee');
  equipListing(other.id, set.id);
  assert.throws(() => buyListing(other.id, set.id), isError('alreadyOwned'));

  db.transaction((data) => { data.users[user.id].inventory.push(set.id); data.users[user.id].sparks = 100; });
  giftListing(user.id, recipient.id, set.id);
  assert.ok(db.get().users[recipient.id].inventory.includes(set.id), 'an item the sender owns can be gifted');
  assert.deepEqual(db.get().users[recipient.id].giftsReceived, [set.id], 'gift activity is available for the public profile preview');
  assert.equal(db.get().users[user.id].sparks, 75);

  subscribeAura(user.id, 'flare', 'month');
  assert.equal(hasAura(user.id), true);
  const sellerBeforeAuraSale = db.get().users[user.id].sparks;
  const auraSale = createListing({ userId: user.id, kind: 'stickers', name: 'Orbit set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  db.transaction((data) => { data.users[other.id].sparks = 100; });
  buyListing(other.id, auraSale.id);
  assert.equal(db.get().users[user.id].sparks, sellerBeforeAuraSale + 23, 'Flare sellers pay the configured 5% fee');
  db.transaction((data) => { data.users[user.id].lastDaily = 0; });
  assert.equal(claimDaily(user.id), 500, 'Flare daily reward uses the configured stipend');
  cancelAura(user.id);
  assert.equal(hasAura(user.id), true, 'cancelling renewal keeps benefits until expiry');

  const backup = JSON.parse(db.exportJSON(user)) as { data: { users: Record<string, { auth?: { hash: string }; password?: string }> } };
  assert.equal(backup.data.users[user.id].password, undefined, 'plain passwords are never exported');
  db.importJSON(JSON.stringify(backup));
  assert.ok(db.get().users[user.id]);
});

test('release lookup only selects the installer matching the detected platform', () => {
  const assets: ReleaseAsset[] = [
    { name: 'OrbitMc-Windows-1.2.3.exe', browser_download_url: 'https://example.invalid/windows.exe' },
    { name: 'OrbitMc-1.2.3-universal.dmg', browser_download_url: 'https://example.invalid/macos.dmg' },
    { name: 'OrbitMc-1.2.3.AppImage', browser_download_url: 'https://example.invalid/linux.AppImage' },
    { name: 'OrbitMc-Windows-1.2.3.zip', browser_download_url: 'https://example.invalid/other.zip' },
  ];
  assert.equal(releaseAssetFor('windows', assets)?.name, 'OrbitMc-Windows-1.2.3.exe');
  assert.equal(releaseAssetFor('macos', assets)?.name, 'OrbitMc-1.2.3-universal.dmg');
  assert.equal(releaseAssetFor('macos', [{ name: 'OrbitMc-1.2.3-arm64.dmg', browser_download_url: 'https://example.invalid/arm64.dmg' }])?.name, 'OrbitMc-1.2.3-arm64.dmg');
  assert.equal(releaseAssetFor('linux', assets)?.name, 'OrbitMc-1.2.3.AppImage');
  assert.equal(releaseAssetFor('unknown', assets), undefined);
});

test('conversation controls stay per account and history can be restored', () => {
  const owner = 'controls_owner';
  const other = 'controls_other';
  const channel = 'dm:controls_owner:controls_other';
  setMuted(owner, other, true);
  setBlocked(owner, other, true);
  assert.equal(isMuted(owner, other), true);
  assert.equal(isBlocked(owner, other), true);
  setMuted(owner, other, true, 60_000);
  assert.equal(isMuted(owner, other), true, 'a timed mute stays active until it expires');
  setMuted(owner, other, true, -1);
  assert.equal(isMuted(owner, other), false, 'an expired timed mute is ignored');
  assert.equal(isBlocked(other, owner), false, 'block settings are private to the local account');
  setMuted(owner, other, false);
  setBlocked(owner, other, false);
  assert.equal(isMuted(owner, other), false);
  assert.equal(isBlocked(owner, other), false);

  replaceRemoteBlocks('remote_owner', [other]);
  assert.equal(isBlocked('remote_owner', other), true, 'server-backed blocks are included in the current device state');
  replaceRemoteBlocks('remote_owner', []);
  assert.equal(isBlocked('remote_owner', other), false, 'server sync removes blocks deleted from the account');

  assert.equal(hiddenBefore(owner, channel), 0);
  const previous = clearHistory(owner, channel);
  assert.ok(hiddenBefore(owner, channel) > 0);
  hideMessage(owner, channel, 'hidden-message');
  assert.equal(isMessageHidden(owner, channel, 'hidden-message'), true);
  restoreHistory(owner, channel, previous);
  assert.equal(hiddenBefore(owner, channel), 0, 'undo restores the previous history boundary');
  assert.equal(isMessageHidden(owner, channel, 'hidden-message'), true, 'individual hidden messages remain hidden');
  setChatTheme(owner, channel, 'ocean');
  assert.equal(getChatTheme(owner, channel), 'ocean');
  assert.equal(getChatTheme(other, channel), 'default', 'chat appearance belongs to the current account');
  setChatTheme(owner, channel, 'default');
  assert.equal(getChatTheme(owner, channel), 'default', 'default removes a saved override');
  deleteChatForUser(owner, channel);
  assert.equal(isChatDeleted(owner, channel), true);
  assert.equal(isChatDeleted(other, channel), false, 'chat hiding is private to the local account');
});
