import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { enterDemoWorkspace, register, validateBio, validateName, validatePassword } from '../src/data/auth';
import { sendMessage, addReaction, editMessage, pinMessage, deleteMessage, startDM, canPostInChannel, votePoll } from '../src/data/chat';
import { db } from '../src/data/db';
import { chronologicalRemoteHistory } from '../src/data/cloud';
import { clearHistory, deleteConversation, getMuteUntil, hiddenBefore, hideMessage, isBlocked, isMessageHidden, isMuted, replaceRemoteBlocks, restoreHistory, setBlocked, setMuted, setMutedFor } from '../src/data/chatControls';
import { AppError } from '../src/data/errors';
import { addRoom, joinInvite, kickHubMember, leaveHub, makeHub, setHubMemberRole, updateHub, updateRoom } from '../src/data/hubs';
import { adminAdjustSparks, adminGrantAura, adminToggleListingFeatured, adminToggleSuspended, getWorkspaceStats, isAdminUser } from '../src/data/admin';
import { buyListing, cancelAura, claimDaily, computeOrbitXP, createListing, equipListing, giftListing, hasAura, subscribeAura } from '../src/data/market';
import { updateProfile } from '../src/data/profile';
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

  const hub = await makeHub({ userId: user.id, name: 'Test corner', about: 'A private place', emoji: '✳', public: false });
  assert.equal((await joinInvite(hub.invite, other.id))?.id, hub.id);
  const room = await addRoom(hub.id, user.id, 'behind-the-scenes');
  assert.ok(db.get().hubs[hub.id].rooms.some((item) => item.id === room));
  await leaveHub(hub.id, other.id);
  assert.equal(db.get().hubs[hub.id].members[other.id], undefined);

  const set = await createListing({ userId: user.id, kind: 'stickers', name: 'My set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  assert.equal(await claimDaily(user.id), 25);
  assert.throws(() => claimDaily(user.id), isError('dailyDone'));
  db.transaction((data) => { data.users[other.id].sparks = 100; });
  const sellerBeforeSale = db.get().users[user.id].sparks;
  await buyListing(other.id, set.id);
  assert.ok(db.get().users[other.id].inventory.includes(set.id));
  assert.equal(db.get().users[user.id].sparks, sellerBeforeSale + 21, 'free seller receives the sale after the 15% bazaar fee');
  equipListing(other.id, set.id);
  assert.throws(() => buyListing(other.id, set.id), isError('alreadyOwned'));

  db.transaction((data) => { data.users[user.id].inventory.push(set.id); data.users[user.id].sparks = 100; });
  await giftListing(user.id, recipient.id, set.id);
  assert.ok(db.get().users[recipient.id].inventory.includes(set.id), 'an item the sender owns can be gifted');
  assert.deepEqual(db.get().users[recipient.id].giftsReceived, [set.id], 'gift activity is available for the public profile preview');
  assert.equal(db.get().users[user.id].sparks, 75);

  subscribeAura(user.id, 'flare', 'month');
  assert.equal(hasAura(user.id), true);
  const sellerBeforeAuraSale = db.get().users[user.id].sparks;
  const auraSale = await createListing({ userId: user.id, kind: 'stickers', name: 'Orbit set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  db.transaction((data) => { data.users[other.id].sparks = 100; });
  await buyListing(other.id, auraSale.id);
  assert.equal(db.get().users[user.id].sparks, sellerBeforeAuraSale + 23, 'Flare sellers pay the configured 5% fee');
  db.transaction((data) => { data.users[user.id].lastDaily = 0; });
  assert.equal(await claimDaily(user.id), 500, 'Flare daily reward uses the configured stipend');
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
});

test('demo workspace, hub templates, polls, broadcast permissions, and admin actions work cleanly', async () => {
  db.wipe();
  const demo = enterDemoWorkspace();
  assert.equal(isAdminUser(demo), true);
  assert.ok(db.get().hubs['h_orbit_builders']);

  const member = addUser('user_member', 'member_one');
  const teamHub = await makeHub({ userId: demo.id, name: 'Product Sprint', about: 'Work hub', emoji: '🚀', public: true, template: 'team' });
  assert.ok(teamHub.rooms.some((r) => r.name === 'announcements' && r.kind === 'broadcast'));
  joinInvite(teamHub.invite, member.id);

  const announceRoom = teamHub.rooms.find((r) => r.kind === 'broadcast')!;
  assert.equal(canPostInChannel(announceRoom.id, member.id), false, 'regular members cannot post in broadcast rooms');
  assert.equal(canPostInChannel(announceRoom.id, demo.id), true, 'owners can post in broadcast rooms');

  setHubMemberRole(teamHub.id, demo.id, member.id, 'mod');
  assert.equal(canPostInChannel(announceRoom.id, member.id), true, 'moderators can post in broadcast rooms');

  updateHub(teamHub.id, demo.id, { name: 'Orbit Core Team' });
  assert.equal(db.get().hubs[teamHub.id].name, 'Orbit Core Team');

  const generalRoom = teamHub.rooms.find((r) => r.name === 'general')!;
  updateRoom(teamHub.id, generalRoom.id, demo.id, { topic: 'Daily standups' });
  assert.equal(db.get().hubs[teamHub.id].rooms.find((r) => r.id === generalRoom.id)?.topic, 'Daily standups');

  const pollMsg = await sendMessage({
    channel: generalRoom.id,
    userId: demo.id,
    text: '',
    poll: {
      question: 'Ship redesign?',
      options: [
        { id: 'a', text: 'Yes', votes: [] },
        { id: 'b', text: 'Right now', votes: [] },
      ],
    },
  });
  votePoll(generalRoom.id, pollMsg.id, 'b', member.id);
  assert.deepEqual(db.get().msgs[generalRoom.id][0].poll?.options[1].votes, [member.id]);

  adminGrantAura(demo.id, member.id, 'nova');
  assert.equal(hasAura(member.id), true);
  await adminAdjustSparks(demo.id, member.id, 1250);
  assert.equal(db.get().users[member.id].sparks, 1550);
  adminToggleSuspended(demo.id, member.id);
  assert.equal(canPostInChannel(generalRoom.id, member.id), false, 'suspended users cannot post');
  kickHubMember(teamHub.id, demo.id, member.id);
  assert.equal(db.get().hubs[teamHub.id].members[member.id], undefined);

  assert.equal(adminToggleListingFeatured(demo.id, 'orbit_theme_nightglass'), true);
  const stats = getWorkspaceStats(db.get());
  assert.ok(stats.totalHubs >= 2 && stats.totalUsers >= 4);

  await updateProfile(member.id, { name: member.name, bio: member.bio, birthday: '2001-05-14', birthdayVisible: true, hideGiftSenders: true });
  assert.equal(db.get().users[member.id].birthday, '2001-05-14');
  assert.equal(db.get().users[member.id].hideGiftSenders, true);
  const xp = computeOrbitXP(db.get().users[member.id]);
  assert.ok(xp.xp > 600 && xp.level >= 2);

  setMutedFor(demo.id, member.id, 3_600_000);
  assert.equal(isMuted(demo.id, member.id), true);
  assert.ok(getMuteUntil(demo.id, member.id) > Date.now());
  const dmId = startDM(demo.id, member.id);
  deleteConversation(demo.id, dmId);
  assert.equal((db.get().dms[demo.id] ?? []).includes(dmId), false);
});
