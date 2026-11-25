alter table public.market_listings
  drop constraint if exists market_listings_safe_design_gradient_check;
alter table public.market_listings
  add constraint market_listings_safe_design_gradient_check check (
    case
      when kind = 'theme' and design ? 'gradient' then
        coalesce(design->>'gradient', '') ~ '^linear-gradient\(135deg, #[0-9A-Fa-f]{6}, #[0-9A-Fa-f]{6}\)$'
      when kind = 'bundle' and (design->'theme') ? 'gradient' then
        coalesce(design->'theme'->>'gradient', '') ~ '^linear-gradient\(135deg, #[0-9A-Fa-f]{6}, #[0-9A-Fa-f]{6}\)$'
      else true
    end
  );
