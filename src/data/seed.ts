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
    orbit_theme_tidalglass: {
      id: 'orbit_theme_tidalglass', kind: 'theme' as const, name: 'Tidal glass', nameRu: 'Приливное стекло', nameUz: 'Dengiz oynasi',
      about: 'Cold sea-glass tones with a bright current of cyan.', aboutRu: 'Холодные морские оттенки с яркой бирюзовой волной.', aboutUz: 'Sovuq dengiz tuslari va yorqin moviy jilva.',
      price: 190, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: true, bg: '#101a21', panel: '#182a33', raised: '#213a45', line: '#36535e', accent: '#69d7dc', gradient: 'linear-gradient(155deg, #10242e 0%, #172a34 48%, #263b46 100%)' },
    },
    orbit_theme_orchidstatic: {
      id: 'orbit_theme_orchidstatic', kind: 'theme' as const, name: 'Orchid static', nameRu: 'Статика орхидеи', nameUz: 'Orxideya',
      about: 'A soft plum gradient with lilac signals.', aboutRu: 'Мягкий сливовый градиент и сиреневые акценты.', aboutUz: 'Mayin olxo‘ri tusli gradient va binafsha urg‘ular.',
      price: 210, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: true, bg: '#191522', panel: '#241d31', raised: '#302740', line: '#4b3d60', accent: '#c29cf4', gradient: 'linear-gradient(145deg, #21192d 0%, #312139 50%, #241c36 100%)' },
    },
    orbit_theme_claylight: {
      id: 'orbit_theme_claylight', kind: 'theme' as const, name: 'Claylight', nameRu: 'Глиняный свет', nameUz: 'Loy shu’lasi',
      about: 'Sunlit clay, pale cream and a persimmon accent.', aboutRu: 'Солнечная глина, кремовый фон и хурмовый акцент.', aboutUz: 'Quyosh tekkan loy, qaymoqrang fon va xurmo tusli urg‘u.',
      price: 180, sellerId: studioId, sales: 0, createdAt: 1795540000000,
      theme: { dark: false, bg: '#f4eee5', panel: '#fbf7ef', raised: '#e9ddd0', line: '#d8c7b6', accent: '#bf603f', gradient: 'linear-gradient(145deg, #f2e4d6 0%, #f7f0e7 52%, #ead9cb 100%)' },
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
