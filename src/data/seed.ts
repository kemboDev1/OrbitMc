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
  const listings: DB['listings'] = {
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

  Object.assign(listings, {
    orbit_theme_coral_dusk: { id: 'orbit_theme_coral_dusk', kind: 'theme', name: 'Coral Dusk', nameUz: 'Marjon shomi', nameRu: 'Коралловый вечер', about: 'Night-sky ink with a warm coral signal.', aboutUz: 'Tun osmoni tusli fon va iliq marjon urg‘usi.', aboutRu: 'Чернильный вечерний фон и тёплый коралловый акцент.', price: 165, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#17131B', panel: '#211922', raised: '#30212B', line: '#49313D', accent: '#F27970', gradient: 'linear-gradient(135deg, #F27970, #A94E79)' } },
    orbit_theme_icefield: { id: 'orbit_theme_icefield', kind: 'theme', name: 'Icefield', nameUz: 'Muzlik', nameRu: 'Ледяное поле', about: 'Glacier blue with a bright, clean cyan accent.', aboutUz: 'Muzdek moviy tuslar va tiniq havorang urg‘u.', aboutRu: 'Ледниковая синева и ясный бирюзовый акцент.', price: 175, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#101923', panel: '#16232E', raised: '#1E3441', line: '#315162', accent: '#69D5E5', gradient: 'linear-gradient(135deg, #69D5E5, #547EE8)' } },
    orbit_theme_rose_window: { id: 'orbit_theme_rose_window', kind: 'theme', name: 'Rose Window', nameUz: 'Atirgul oynasi', nameRu: 'Розовое окно', about: 'Powdered rose, porcelain and a plum accent.', aboutUz: 'Atirgulrang, chinnidek oq va olxo‘ri tusli urg‘u.', aboutRu: 'Пудровая роза, фарфор и сливовый акцент.', price: 155, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: false, bg: '#F3E9EF', panel: '#FBF5F8', raised: '#E9D9E3', line: '#D3BACB', accent: '#A94C78', gradient: 'linear-gradient(135deg, #F0C4D6, #E6D5F4)' } },
    orbit_theme_citron_grove: { id: 'orbit_theme_citron_grove', kind: 'theme', name: 'Citron Grove', nameUz: 'Nordon bog‘', nameRu: 'Цитрусовый сад', about: 'Deep leaf green brightened with a citrus spark.', aboutUz: 'To‘q bargrang fon va limon tusli yorqin nuqta.', aboutRu: 'Листовая зелень и яркий цитрусовый штрих.', price: 160, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#141A13', panel: '#1C2719', raised: '#293922', line: '#415537', accent: '#D0D86F', gradient: 'linear-gradient(135deg, #D0D86F, #58AE78)' } },
    orbit_theme_ultraviolet: { id: 'orbit_theme_ultraviolet', kind: 'theme', name: 'Ultraviolet', nameUz: 'Ultrabinafsha', nameRu: 'Ультрафиолет', about: 'Midnight violet with a vivid electric-lilac current.', aboutUz: 'Tun binafshasi va yorqin liloviy tus.', aboutRu: 'Полуночный фиолетовый и яркая сиреневая волна.', price: 195, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#151224', panel: '#211B35', raised: '#30264C', line: '#473A6D', accent: '#AC8AFF', gradient: 'linear-gradient(135deg, #AC8AFF, #F278BF)' } },
    orbit_theme_morning_fog: { id: 'orbit_theme_morning_fog', kind: 'theme', name: 'Morning Fog', nameUz: 'Tonggi tuman', nameRu: 'Утренний туман', about: 'Quiet silver mist with a cool blue highlight.', aboutUz: 'Kumushrang mayin tuman va sovuq moviy urg‘u.', aboutRu: 'Серебристый туман и холодный синий акцент.', price: 150, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: false, bg: '#EAF0F2', panel: '#F7FAFB', raised: '#DCE6E9', line: '#B9CCD2', accent: '#397F9C', gradient: 'linear-gradient(135deg, #C8E1E9, #DFDDF0)' } },
    orbit_frame_solar: { id: 'orbit_frame_solar', kind: 'frame', name: 'Solar arc', nameUz: 'Quyosh yoyi', nameRu: 'Солнечная дуга', about: 'A golden orbit with a vivid apricot flare.', aboutUz: 'Oltin halqa va shaftolirang jilva.', aboutRu: 'Золотая орбита с абрикосовым свечением.', price: 185, sellerId: studioId, sales: 0, createdAt: 1795540000000, frame: { colors: ['#F5CB71', '#F18155'], spin: false } },
    orbit_frame_aurora: { id: 'orbit_frame_aurora', kind: 'frame', name: 'Aurora ribbon', nameUz: 'Qutb yog‘dusi', nameRu: 'Лента сияния', about: 'A slow, shifting ribbon of jade and glacier blue.', aboutUz: 'Yashil va muzrang moviy tuslarda sekin aylanuvchi halqa.', aboutRu: 'Медленная орбита в нефритовых и ледяных тонах.', price: 245, sellerId: studioId, sales: 0, createdAt: 1795540000000, frame: { colors: ['#50D7B7', '#5999ED'], spin: true } },
    orbit_frame_orchid: { id: 'orbit_frame_orchid', kind: 'frame', name: 'Orchid halo', nameUz: 'Orxideya halqasi', nameRu: 'Орхидейный ореол', about: 'A lilac and rose-gold ring with a gentle shimmer.', aboutUz: 'Liloviy va pushti-oltin tusli mayin halqa.', aboutRu: 'Сиреневое кольцо с мягким розово-золотым блеском.', price: 235, sellerId: studioId, sales: 0, createdAt: 1795540000000, auraOnly: true, frame: { colors: ['#BC8BFF', '#F1A2C8'], spin: true } },
    orbit_frame_tide: { id: 'orbit_frame_tide', kind: 'frame', name: 'Tide ring', nameUz: 'To‘lqin halqasi', nameRu: 'Приливное кольцо', about: 'A crisp blue-green wave around your portrait.', aboutUz: 'Portret atrofida moviy-yashil to‘lqin.', aboutRu: 'Ясная сине-зелёная волна вокруг портрета.', price: 175, sellerId: studioId, sales: 0, createdAt: 1795540000000, frame: { colors: ['#47BED2', '#376FCC'], spin: false } },
    orbit_bundle_sunset: { id: 'orbit_bundle_sunset', kind: 'bundle', name: 'Sunset orbit', nameUz: 'Shom halqasi', nameRu: 'Закатная орбита', about: 'A coral night theme paired with its warm avatar ring.', aboutUz: 'Marjon tusli tun mavzusi va unga mos avatar halqasi.', aboutRu: 'Коралловая ночная тема и подходящее кольцо аватара.', price: 290, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#17131B', panel: '#211922', raised: '#30212B', line: '#49313D', accent: '#F27970', gradient: 'linear-gradient(135deg, #F27970, #A94E79)' }, frame: { colors: ['#F27970', '#E7AA56'], spin: false } },
    orbit_bundle_tidal: { id: 'orbit_bundle_tidal', kind: 'bundle', name: 'Tidal pair', nameUz: 'Dengiz jufti', nameRu: 'Приливная пара', about: 'Cold sea-glass colors and a matching moving ring.', aboutUz: 'Sovuq dengiz tuslari va unga mos harakatlanuvchi halqa.', aboutRu: 'Морские оттенки и подходящее вращающееся кольцо.', price: 315, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#101A21', panel: '#182A33', raised: '#213A45', line: '#36535E', accent: '#69D7DC', gradient: 'linear-gradient(135deg, #69D7DC, #547EE8)' }, frame: { colors: ['#69D7DC', '#547EE8'], spin: true } },
    orbit_bundle_orchid: { id: 'orbit_bundle_orchid', kind: 'bundle', name: 'Orchid night', nameUz: 'Binafsha tun', nameRu: 'Орхидейная ночь', about: 'A deep violet palette with a soft orchid halo.', aboutUz: 'To‘q binafsha mavzu va mayin orxideya halqasi.', aboutRu: 'Глубокая фиолетовая палитра и орхидейное кольцо.', price: 330, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#151224', panel: '#211B35', raised: '#30264C', line: '#473A6D', accent: '#AC8AFF', gradient: 'linear-gradient(135deg, #AC8AFF, #F278BF)' }, frame: { colors: ['#BC8BFF', '#F1A2C8'], spin: true } },
    orbit_bundle_grove: { id: 'orbit_bundle_grove', kind: 'bundle', name: 'Moss garden', nameUz: 'Mox bog‘i', nameRu: 'Мшистый сад', about: 'A leafy green workspace with a citrus orbit.', aboutUz: 'Bargrang ish maydoni va limon tusli avatar halqasi.', aboutRu: 'Листовая зелень и цитрусовая орбита аватара.', price: 280, sellerId: studioId, sales: 0, createdAt: 1795540000000, theme: { dark: true, bg: '#141A13', panel: '#1C2719', raised: '#293922', line: '#415537', accent: '#D0D86F', gradient: 'linear-gradient(135deg, #D0D86F, #58AE78)' }, frame: { colors: ['#D0D86F', '#58AE78'], spin: false } },
  });

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
