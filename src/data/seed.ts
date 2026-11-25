import type { DB } from './types';

export function makeSeed(): DB {
  const studioId = 'orbit-studio';
  const studio = {
    id: studioId, username: 'orbitstudio', name: 'Orbit Studio',
    bio: 'Original palettes and details made for OrbitMc.', hue: 198,
    presence: 'online' as const, statusText: 'Designing inside OrbitMc',
    createdAt: 1795540000000, serverBacked: false, aura: null, sparks: 0,
    inventory: [], frame: null, theme: null, stickerPack: null, accent: null,
    ring: false, lastDaily: 0, lastStipend: 0,
  };
  const listings = {
    orbit_theme_nightglass: {
      id: 'orbit_theme_nightglass', kind: 'theme' as const, name: 'Nightglass', nameRu: 'Ночной витраж', nameUz: 'Tun oynasi',
      about: 'A deep ink canvas with a crisp blue signal.', aboutRu: 'Глубокие чернила и ясный синий акцент.', aboutUz: 'To‘q fon va tiniq moviy urg‘u.',
      price: 180, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: true, bg: '#10161C', panel: '#172129', raised: '#202D36', line: '#34444F', accent: '#70C7E5' },
    },
    orbit_theme_sunroom: {
      id: 'orbit_theme_sunroom', kind: 'theme' as const, name: 'Sunroom', nameRu: 'Солнечная комната', nameUz: 'Quyoshli xona',
      about: 'Warm paper, soft stone and a clear coral accent.', aboutRu: 'Теплая бумага, мягкий камень и коралл.', aboutUz: 'Iliq qog‘oz, sokin tosh va marjon rang.',
      price: 160, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: false, bg: '#F4F2EC', panel: '#FBF9F4', raised: '#E9E6DC', line: '#D4D1C7', accent: '#D95742' },
    },
    orbit_theme_mossline: {
      id: 'orbit_theme_mossline', kind: 'theme' as const, name: 'Mossline', nameRu: 'Моховая линия', nameUz: 'Mox yo‘li',
      about: 'A muted green palette with a quiet gold accent.', aboutRu: 'Приглушенная зелень и спокойное золото.', aboutUz: 'Sokin yashil tus va mayin oltin rang.',
      price: 170, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: true, bg: '#121815', panel: '#1B241F', raised: '#26312A', line: '#39463D', accent: '#B6CA84' },
    },
    orbit_frame_arc: {
      id: 'orbit_frame_arc', kind: 'frame' as const, name: 'Arc frame', nameRu: 'Рамка «Дуга»', nameUz: 'Yoy rom',
      about: 'A clean two-tone orbit around your portrait.', aboutRu: 'Чистая двухцветная орбита вокруг портрета.', aboutUz: 'Portret atrofida ikki rangli saranjom halqa.',
      price: 220, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      auraOnly: true, frame: { colors: ['#73C9E4', '#B7E3EF'], spin: false },
    },
    orbit_frame_ember: {
      id: 'orbit_frame_ember', kind: 'frame' as const, name: 'Ember loop', nameRu: 'Петля уголька', nameUz: 'Cho‘g‘ halqasi',
      about: 'A still copper ring with a small warm glint.', aboutRu: 'Медное кольцо с мягким теплым бликом.', aboutUz: 'Iliq jiloli, mis tusli sokin halqa.',
      price: 200, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      auraOnly: true, frame: { colors: ['#E07A50', '#F0BE79'], spin: false },
    },
  };

  return {
    v: 1,
    users: { [studioId]: studio },
    hubs: {},
    msgs: {},
    listings,
    reads: {},
    dms: {},
    guard: {},
  };
}
