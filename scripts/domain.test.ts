import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { register, signIn } from '../src/data/auth';
import { sendMessage, addReaction, editMessage, pinMessage, deleteMessage, startDM } from '../src/data/chat';
import { db } from '../src/data/db';
import { AppError } from '../src/data/errors';
import { addRoom, joinInvite, leaveHub, makeHub } from '../src/data/hubs';
import { buyListing, cancelAura, claimDaily, createListing, equipListing, giftListing, hasAura, subscribeAura } from '../src/data/market';

const isError = (key: string) => (error: unknown) => error instanceof AppError && error.key === key;

test('account, chat, rooms, bazaar and backup work together', async () => {
  const { user } = await register({ username: 'test_user', name: 'Test User', password: 'StrongPass123!' });
  assert.equal(user.username, 'test_user');
  assert.equal((await signIn({ username: 'test_user', password: 'StrongPass123!' })).user.id, user.id);
  await assert.rejects(() => signIn({ username: 'test_user', password: 'WrongPass123!' }), isError('err.signIn'));
  await assert.rejects(() => register({ username: 'x', name: 'X', password: 'short' }), isError('err.username'));

  const dm = startDM(user.id, 'u_mila');
  const message = sendMessage({ channel: dm, userId: user.id, text: 'Hello, little corner.', reply: undefined });
  editMessage(dm, message.id, user.id, 'A revised hello.');
  addReaction(dm, message.id, 'u_mila', '✨');
  pinMessage(dm, message.id, user.id);
  assert.equal(db.get().msgs[dm][0].text, 'A revised hello.');
  assert.equal(db.get().msgs[dm][0].pinned, true);
  assert.deepEqual(db.get().msgs[dm][0].reactions['✨'], ['u_mila']);
  assert.throws(() => sendMessage({ channel: dm, userId: user.id, text: ' '.repeat(3) }), isError('err.emptyMessage'));
  deleteMessage(dm, message.id, user.id);
  assert.equal(db.get().msgs[dm].length, 0);

  const hub = makeHub({ userId: user.id, name: 'Test corner', about: 'A private place', emoji: '✳', public: false });
  assert.equal(joinInvite(hub.invite, 'u_mila')?.id, hub.id);
  const room = addRoom(hub.id, user.id, 'behind-the-scenes');
  assert.ok(db.get().hubs[hub.id].rooms.some((item) => item.id === room));
  leaveHub(hub.id, 'u_mila');
  assert.equal(db.get().hubs[hub.id].members.u_mila, undefined);

  const set = createListing({ userId: user.id, kind: 'stickers', name: 'My set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  assert.equal(claimDaily(user.id), 25);
  assert.throws(() => claimDaily(user.id), isError('dailyDone'));
  db.transaction((data) => { data.users.u_mila.sparks = 100; });
  const sellerBeforeSale = db.get().users[user.id].sparks;
  buyListing('u_mila', set.id);
  assert.ok(db.get().users.u_mila.inventory.includes(set.id));
  assert.equal(db.get().users[user.id].sparks, sellerBeforeSale + 21, 'free seller receives the sale after the 15% bazaar fee');
  equipListing('u_mila', set.id);
  assert.throws(() => buyListing('u_mila', set.id), isError('alreadyOwned'));

  db.transaction((data) => { data.users[user.id].inventory.push(set.id); data.users[user.id].sparks = 100; });
  giftListing(user.id, 'u_leo', set.id);
  assert.ok(db.get().users.u_leo.inventory.includes(set.id), 'an item the sender owns can be gifted');
  assert.equal(db.get().users[user.id].sparks, 75);

  subscribeAura(user.id, 'flare', 'month');
  assert.equal(hasAura(user.id), true);
  const sellerBeforeAuraSale = db.get().users[user.id].sparks;
  const auraSale = createListing({ userId: user.id, kind: 'stickers', name: 'Orbit set', about: 'Made for you', price: 25, stickers: ['🫶', '✨', '🥹', '🌙', '🌱', '🤍'] });
  db.transaction((data) => { data.users.u_mila.sparks = 100; });
  buyListing('u_mila', auraSale.id);
  assert.equal(db.get().users[user.id].sparks, sellerBeforeAuraSale + 23, 'Flare sellers pay the configured 5% fee');
  db.transaction((data) => { data.users[user.id].lastDaily = 0; });
  assert.equal(claimDaily(user.id), 500, 'Flare daily reward uses the configured stipend');
  cancelAura(user.id);
  assert.equal(hasAura(user.id), true, 'cancelling renewal keeps benefits until expiry');

  const backup = JSON.parse(db.exportJSON(user)) as { data: { users: Record<string, { auth?: { hash: string }; password?: string }> } };
  assert.ok(backup.data.users[user.id].auth?.hash);
  assert.equal(backup.data.users[user.id].password, undefined, 'plain passwords are never exported');
  db.importJSON(JSON.stringify(backup));
  assert.equal((await signIn({ username: 'test_user', password: 'StrongPass123!' })).user.id, user.id);
});
