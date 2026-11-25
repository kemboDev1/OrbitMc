create index if not exists hub_messages_reply_to_idx
  on public.hub_messages (reply_to);

create index if not exists hub_messages_sender_id_idx
  on public.hub_messages (sender_id);

create index if not exists hubs_owner_id_idx
  on public.hubs (owner_id);

create index if not exists market_purchases_gifted_by_idx
  on public.market_purchases (gifted_by);

create index if not exists market_purchases_listing_id_idx
  on public.market_purchases (listing_id);
