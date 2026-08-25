export type IslandGroup = "luzon" | "visayas" | "mindanao";

export type CompanionMode = "online" | "in_person" | "both";

export type ApprovedCompanionSeed = {
  key: string;
  displayName: string;
  bio: string;
  city: string;
  approximateArea: string;
  latitude: number;
  longitude: number;
  intro: string;
  strengths: string[];
  categories: string[];
  mode: CompanionMode;
  hourlyRateCentavos: number;
  islandGroup: IslandGroup;
};

export type MemberSeed = {
  key: string;
  displayName: string;
  bio: string;
  onboardingCategories: string[];
  islandGroup: IslandGroup;
};

const c = (
  key: string,
  displayName: string,
  intro: string,
  strengths: string[],
  categories: string[],
  mode: CompanionMode,
  hourlyRateCentavos: number,
  islandGroup: IslandGroup,
  city: string,
  approximateArea: string,
  latitude: number,
  longitude: number
): ApprovedCompanionSeed => ({
  key,
  displayName,
  intro,
  strengths,
  categories,
  mode,
  hourlyRateCentavos,
  islandGroup,
  city,
  approximateArea,
  latitude,
  longitude,
  bio: `${displayName} is a Companion based in ${city}, ${islandGroup === "luzon" ? "Luzon" : islandGroup === "visayas" ? "the Visayas" : "Mindanao"}. They host ${
    mode === "online" ? "online sessions" : mode === "in_person" ? "in-person sessions" : "online and in-person sessions"
  } that center on ${strengths.slice(0, 2).join(" and ").toLowerCase()}.`,
});

export const approvedPhilippinesCompanions: ApprovedCompanionSeed[] = [
  c("mariles-de-manila", "Mariles Delgado", "A warm listener who loves slow mornings and honest conversation.", ["Listening", "Empathy", "Cooking"], ["Companionship", "Cooking"], "both", 45000, "luzon", "Manila", "City of Manila", 14.5995, 120.9842),
  c("enrique-quezon", "Enrique Santos", "Long walks and food trails across the capital region.", ["Conversation", "Local Food", "Walking"], ["Sightseeing", "Companionship"], "both", 40000, "luzon", "Quezon City", "Quezon City", 14.676, 121.0437),
  c("anabel-makati", "Anabel Cruz", "A patient guide for first visits to the capital.", ["Guidance", "Patience", "Local Guide"], ["Sightseeing", "Companionship"], "in_person", 55000, "luzon", "Makati", "Makati City", 14.5547, 121.0244),
  c("joaquin-pasig", "Joaquin Reyes", "Good company for coffee and city stories.", ["Coffee", "Storytelling", "Conversation"], ["Companionship", "Coffee"], "online", 35000, "luzon", "Pasig", "Pasig City", 14.5764, 121.0851),
  c("lydiah-taguig", "Lydia Ramos", "A steady presence for focused online check-ins.", ["Focus", "Accountability", "Empathy"], ["Companionship", "Academics"], "online", 32000, "luzon", "Taguig", "Taguig City", 14.5176, 121.0509),
  c("benedict-baguio", "Benedict Aclan", "A lover of cool air, pine trails, and deep talks.", ["Nature", "Hiking", "Listening"], ["Outdoor", "Companionship"], "in_person", 48000, "luzon", "Baguio", "Baguio City", 16.4023, 120.596),
  c("carmela-batangas", "Carmela Villanueva", "Coastal calm and a gift for patient encouragement.", ["Encouragement", "Beach Walks", "Empathy"], ["Wellness", "Companionship"], "both", 42000, "luzon", "Batangas City", "Batangas City", 13.7565, 121.0584),
  c("felipe-lipa", "Felipe Mercado", "An easygoing companion for city and countryside alike.", ["Conversation", "Local Food", "Walking"], ["Sightseeing", "Companionship"], "in_person", 38000, "luzon", "Lipa", "Lipa City", 13.9412, 121.1643),
  c("gina-lucena", "Gina Panganiban", "A cheerful guide to the city and its people.", ["Cheerfulness", "Local Guide", "Conversation"], ["Sightseeing", "Companionship"], "both", 40000, "luzon", "Lucena", "Lucena City", 13.932, 121.617),
  c("hugo-antipolo", "Hugo Marquez", "A calm presence who enjoys art and quiet parks.", ["Art", "Calm", "Listening"], ["Art", "Companionship"], "online", 36000, "luzon", "Antipolo", "Antipolo City", 14.6255, 121.1257),
  c("ines-cabanatuan", "Ines Domingo", "A patient listener rooted in the rice fields of Nueva Ecija.", ["Patience", "Empathy", "Conversation"], ["Companionship", "Wellness"], "both", 34000, "luzon", "Cabanatuan", "Cabanatuan City", 15.4866, 120.9668),
  c("julian-tarlac", "Julian Bautista", "A grounded companion who values steady, honest talk.", ["Honesty", "Listening", "Conversation"], ["Companionship", "Wellness"], "online", 33000, "luzon", "Tarlac City", "Tarlac City", 15.48, 120.598),
  c("karla-angeles", "Karla Soriano", "A warm host for festive and relaxed gatherings.", ["Warmth", "Hosting", "Conversation"], ["Companionship", "Events"], "in_person", 44000, "luzon", "Angeles City", "Angeles City", 15.1567, 120.5912),
  c("leonardo-olongapo", "Leonardo Torres", "A comfortable guide along the coast of Zambales.", ["Coast", "Local Guide", "Listening"], ["Sightseeing", "Companionship"], "in_person", 39000, "luzon", "Olongapo", "Olongapo City", 14.83, 120.282),
  c("miriam-dagupan", "Miriam Estrada", "A dependable friend with a soft spot for seafood.", ["Seafood", "Dependability", "Conversation"], ["Cooking", "Companionship"], "both", 37000, "luzon", "Dagupan", "Dagupan City", 16.043, 120.333),
  c("nestor-san-fernando-pampanga", "Nestor Salazar", "A generous companion who connects through food and stories.", ["Generosity", "Cooking", "Storytelling"], ["Cooking", "Companionship"], "in_person", 41000, "luzon", "San Fernando", "San Fernando City, Pampanga", 15.0286, 120.692),
  c("olivia-la-union", "Olivia Cunanan", "A gentle presence near the northern shore.", ["Gentleness", "Beach Walks", "Conversation"], ["Wellness", "Companionship"], "both", 36000, "luzon", "San Fernando", "San Fernando, La Union", 16.615, 120.316),
  c("pablo-vigan", "Pablo Cajigas", "A storyteller who treasures heritage and long talks.", ["Storytelling", "Heritage", "Listening"], ["Sightseeing", "Companionship"], "in_person", 43000, "luzon", "Vigan", "Vigan City", 17.574, 120.386),
  c("quennie-laoag", "Quennie Alcaraz", "A sunny companion who loves the windmills and the open road.", ["Optimism", "Outdoor", "Conversation"], ["Sightseeing", "Companionship"], "both", 35000, "luzon", "Laoag", "Laoag City", 18.196, 120.592),
  c("rafael-naga", "Rafael Olano", "A patient friend with a musician's ear and a gentle voice.", ["Music", "Patience", "Listening"], ["Arts", "Companionship"], "online", 38000, "luzon", "Naga", "Naga City, Camarines Sur", 13.619, 123.181),
  c("sandra-legazpi", "Sandra Escano", "A calm companion near the volcano and the bay.", ["Nature", "Calm", "Local Guide"], ["Sightseeing", "Companionship"], "in_person", 40000, "luzon", "Legazpi", "Legazpi City", 13.135, 123.746),
  c("teodoro-sorsogon", "Teodoro Bales", "A quiet, steady presence who listens without judgment.", ["Observation", "Steadiness", "Listening"], ["Companionship", "Wellness"], "both", 32000, "luzon", "Sorsogon City", "Sorsogon City", 12.974, 124.009),
  c("ulysses-puerto-princesa", "Ulysses Matias", "An island-hearted guide who loves the underground river.", ["Nature", "Guidance", "Conversation"], ["Outdoor", "Sightseeing"], "in_person", 47000, "luzon", "Puerto Princesa", "Puerto Princesa City", 9.7392, 118.7353),
  c("veronica-calamba", "Veronica Dizon", "A warm listener who enjoys gardens and home cooking.", ["Gardening", "Cooking", "Listening"], ["Cooking", "Wellness"], "both", 39000, "luzon", "Calamba", "Calamba City", 14.209, 121.165),
  c("walter-dasmarenas", "Walter Mangahas", "A friendly companion who keeps the conversation easy.", ["Friendly", "Conversation", "Honesty"], ["Companionship", "Academics"], "online", 34000, "luzon", "Dasmariñas", "Dasmariñas City", 14.329, 120.962),
  c("xenia-san-pablo", "Xenia Caisip", "A thoughtful companion fond of the quiet lake towns.", ["Thoughtfulness", "Lakes", "Conversation"], ["Sightseeing", "Companionship"], "both", 37000, "luzon", "San Pablo", "San Pablo City", 14.066, 121.326),
  c("yuri-tayabas", "Yuri Afable", "A soft-spoken friend who values slow and sincere connection.", ["Sincerity", "Slow Living", "Listening"], ["Wellness", "Companionship"], "online", 31000, "luzon", "Tayabas", "Tayabas City", 14.025, 121.592),
  c("zandro-tuguegarao", "Zandro Mabalot", "A patient companion from the great north.", ["Patience", "Outdoor", "Conversation"], ["Sightseeing", "Companionship"], "in_person", 36000, "luzon", "Tuguegarao", "Tuguegarao City", 17.613, 121.727),
  c("althea-balanga", "Althea Soriano", "A calm host by the bay who listens closely.", ["Listening", "Calm", "Hosting"], ["Companionship", "Wellness"], "both", 35000, "luzon", "Balanga", "Balanga City", 14.676, 120.535),
  c("bruno-quezon-city", "Bruno Calungsod", "A cheerful companion who likes city rooftops and honest talks.", ["Cheerfulness", "Rooftops", "Honesty"], ["Companionship", "Events"], "in_person", 42000, "luzon", "Quezon City", "Quezon City", 14.676, 121.0437),
  c("ciara-makati", "Ciara Villar", "A bright presence for task planning and encouragement.", ["Encouragement", "Focus", "Brightness"], ["Academics", "Companionship"], "online", 38000, "luzon", "Makati", "Makati City", 14.5547, 121.0244),
  c("dante-pasig", "Dante Mercado", "An easy companion who likes curious questions.", ["Curiosity", "Conversation", "Wit"], ["Companionship", "Academics"], "online", 33000, "luzon", "Pasig", "Pasig City", 14.5764, 121.0851),
  c("elena-taguig", "Elena Bautista", "A gentle listener who keeps a steady pace.", ["Steadiness", "Listening", "Empathy"], ["Companionship", "Wellness"], "both", 37000, "luzon", "Taguig", "Taguig City", 14.5176, 121.0509),
  c("fay-baguio", "Fay Gatchalian", "A nature-loving companion who enjoys the mountains.", ["Nature", "Hiking", "Conversation"], ["Outdoor", "Companionship"], "in_person", 46000, "luzon", "Baguio", "Baguio City", 16.4023, 120.596),
  c("gareth-batangas", "Gareth Lim", "A friendly guide for quiet coastal afternoons.", ["Coast", "Friendly", "Local Guide"], ["Sightseeing", "Companionship"], "in_person", 42000, "luzon", "Batangas City", "Batangas City", 13.7565, 121.0584),
  c("hana-lipa", "Hana Navarro", "A warm companion who loves food and conversation.", ["Cooking", "Warmth", "Conversation"], ["Cooking", "Companionship"], "both", 39000, "luzon", "Lipa", "Lipa City", 13.9412, 121.1643),
  c("ignacio-lucena", "Ignacio Sarmiento", "A patient friend who enjoys long, easy talks.", ["Patience", "Easy-going", "Listening"], ["Companionship", "Wellness"], "online", 34000, "luzon", "Lucena", "Lucena City", 13.932, 121.617),
  c("jill-antipolo", "Jill Martenez", "An art-minded companion who likes quiet museums.", ["Art", "Calm", "Conversation"], ["Arts", "Companionship"], "both", 38000, "luzon", "Antipolo", "Antipolo City", 14.6255, 121.1257),
  c("kevin-cabanatuan", "Kevin Santiago", "A grounded listener who values honesty and calm.", ["Honesty", "Grounding", "Listening"], ["Companionship", "Wellness"], "online", 32000, "luzon", "Cabanatuan", "Cabanatuan City", 15.4866, 120.9668),
  c("lana-tarlac", "Lana Pangilinan", "A cheerful companion from the heart of the plains.", ["Cheerfulness", "Warmth", "Conversation"], ["Companionship", "Cooking"], "both", 35000, "luzon", "Tarlac City", "Tarlac City", 15.48, 120.598),
  c("miguel-angeles", "Miguel Dizon", "An easy host who makes visitors feel at home.", ["Hosting", "Friendly", "Conversation"], ["Companionship", "Events"], "in_person", 41000, "luzon", "Angeles City", "Angeles City", 15.1567, 120.5912),
  c("nadia-olongapo", "Nadia Romero", "A patient guide who loves the sea breeze.", ["Sea Breeze", "Guidance", "Listening"], ["Sightseeing", "Companionship"], "both", 38000, "luzon", "Olongapo", "Olongapo City", 14.83, 120.282),
  c("orwin-dagupan", "Orwin Basilio", "A dependable friend with a love of fresh food.", ["Dependability", "Food", "Conversation"], ["Cooking", "Companionship"], "both", 36000, "luzon", "Dagupan", "Dagupan City", 16.043, 120.333),
  c("perla-san-fernando-pampanga", "Perla Castro", "A generous companion who shares food and stories.", ["Generosity", "Cooking", "Storytelling"], ["Cooking", "Companionship"], "in_person", 40000, "luzon", "San Fernando", "San Fernando City, Pampanga", 15.0286, 120.692),
  c("quico-la-union", "Quico Bautista", "A gentle presence near the northern beaches.", ["Gentleness", "Beach", "Conversation"], ["Wellness", "Companionship"], "both", 35000, "luzon", "San Fernando", "San Fernando, La Union", 16.615, 120.316),
  c("rosa-vigan", "Rosa Cabrera", "A storyteller who loves history and calm talks.", ["Storytelling", "History", "Listening"], ["Sightseeing", "Companionship"], "in_person", 43000, "luzon", "Vigan", "Vigan City", 17.574, 120.386),
  c("selmon-laoag", "Selmon Abad", "An upbeat companion for open roads and open hearts.", ["Optimism", "Outdoor", "Conversation"], ["Sightseeing", "Companionship"], "both", 37000, "luzon", "Laoag", "Laoag City", 18.196, 120.592),
  c("tito-naga", "Tito Manalo", "A gentle friend who enjoys music and listening.", ["Music", "Gentleness", "Listening"], ["Arts", "Companionship"], "online", 38000, "luzon", "Naga", "Naga City, Camarines Sur", 13.619, 123.181),
  c("urna-legazpi", "Urna Banol", "A calm companion near the bay and the volcano.", ["Nature", "Calm", "Local Guide"], ["Sightseeing", "Companionship"], "in_person", 41000, "luzon", "Legazpi", "Legazpi City", 13.135, 123.746),
  c("victor-sorsogon", "Victor Baylon", "A steady presence who listens without judgment.", ["Steadiness", "Listening", "Patience"], ["Companionship", "Wellness"], "both", 34000, "luzon", "Sorsogon City", "Sorsogon City", 12.974, 124.009),
  c("wila-puerto-princesa", "Wila Magno", "An island guide who loves the wilds and the water.", ["Nature", "Water", "Guidance"], ["Outdoor", "Sightseeing"], "in_person", 47000, "luzon", "Puerto Princesa", "Puerto Princesa City", 9.7392, 118.7353),
  c("xavier-calamba", "Xavier Paloma", "A warm listener who likes gardens and home coffee.", ["Gardening", "Coffee", "Listening"], ["Coffee", "Wellness"], "both", 39000, "luzon", "Calamba", "Calamba City", 14.209, 121.165),
  c("yasha-dasmarenas", "Yasha Cornejo", "A friendly companion who keeps things light and honest.", ["Friendly", "Honesty", "Conversation"], ["Companionship", "Academics"], "online", 34000, "luzon", "Dasmariñas", "Dasmariñas City", 14.329, 120.962),
  c("zel-san-pablo", "Zel Aclan", "A thoughtful friend fond of the lake towns.", ["Thoughtfulness", "Lakes", "Conversation"], ["Sightseeing", "Companionship"], "both", 37000, "luzon", "San Pablo", "San Pablo City", 14.066, 121.326),
  c("arie-tayabas", "Arie Cuale", "A soft-spoken companion who values sincerity.", ["Sincerity", "Calm", "Listening"], ["Wellness", "Companionship"], "online", 31000, "luzon", "Tayabas", "Tayabas City", 14.025, 121.592),
  c("brita-los-banos", "Brita Nono", "An easy companion who enjoys the garden and slow chats.", ["Gardening", "Calm", "Conversation"], ["Wellness", "Companionship"], "both", 38000, "luzon", "Los Baños", "Los Baños, Laguna", 14.1685, 121.2414),

  c("benilda-cebu", "Benilda Tagle", "A cheerful companion who loves the island's energy.", ["Cheerfulness", "Local Food", "Conversation"], ["Sightseeing", "Companionship"], "both", 45000, "visayas", "Cebu City", "Cebu City", 10.3157, 123.8854),
  c("cris-mandaue", "Cris Villanueva", "A steady friend who enjoys city and coast.", ["Steadiness", "Coast", "Listening"], ["Companionship", "Wellness"], "both", 40000, "visayas", "Mandaue", "Mandaue City", 10.347, 123.94),
  c("diana-lapu-lapu", "Diana Subido", "A warm guide near the famous bridges and waters.", ["Warmth", "Water", "Guidance"], ["Sightseeing", "Companionship"], "in_person", 42000, "visayas", "Lapu-Lapu", "Lapu-Lapu City", 10.312, 123.949),
  c("elio-bacolod", "Elio Fernandez", "A kind companion with a sweet tooth and a soft heart.", ["Kindness", "Sweets", "Conversation"], ["Cooking", "Companionship"], "both", 38000, "visayas", "Bacolod", "Bacolod City", 10.6727, 122.9686),
  c("flor-iloilo", "Flor Trinidad", "A gentle host who loves heritage and long talks.", ["Heritage", "Gentleness", "Listening"], ["Sightseeing", "Companionship"], "in_person", 41000, "visayas", "Iloilo City", "Iloilo City", 10.7202, 122.5621),
  c("gwen-tacloban", "Gwen Aguilar", "A resilient companion who values honest conversation.", ["Resilience", "Honesty", "Conversation"], ["Companionship", "Wellness"], "online", 36000, "visayas", "Tacloban", "Tacloban City", 11.242, 125.015),
  c("hirem-ormoc", "Hirem Barredo", "A patient friend who enjoys the quiet countryside.", ["Patience", "Countryside", "Listening"], ["Companionship", "Wellness"], "both", 35000, "visayas", "Ormoc", "Ormoc City", 11.006, 124.607),
  c("iva-kalibo", "Iva Dumanhog", "A vibrant companion who loves festivals and food.", ["Vibrancy", "Food", "Conversation"], ["Events", "Cooking"], "both", 40000, "visayas", "Kalibo", "Kalibo, Aklan", 11.705, 122.37),
  c("jose-roxas", "Jose Montero", "A friendly host in the heart of the region.", ["Friendly", "Hosting", "Conversation"], ["Companionship", "Events"], "in_person", 39000, "visayas", "Roxas City", "Roxas City", 11.585, 122.751),
  c("kyle-tagbilaran", "Kyle Luardo", "An easygoing companion near the island's hills.", ["Easy-going", "Hills", "Listening"], ["Outdoor", "Companionship"], "both", 37000, "visayas", "Tagbilaran", "Tagbilaran City", 9.643, 123.854),
  c("louise-dumaguete", "Louise Cabal", "A calm companion with a love of the university town.", ["Calm", "University Vibe", "Conversation"], ["Academics", "Companionship"], "online", 42000, "visayas", "Dumaguete", "Dumaguete City", 9.301, 123.308),
  c("marc-boracay", "Marc Palacios", "A sun-loving guide who knows the island's sands.", ["Sun", "Beach", "Guidance"], ["Sightseeing", "Outdoor"], "in_person", 55000, "visayas", "Malay", "Boracay, Malay, Aklan", 11.967, 121.924),
  c("ninfa-catbalogan", "Ninfa Gomez", "A steady listener who values quiet sincerity.", ["Sincerity", "Steadiness", "Listening"], ["Companionship", "Wellness"], "online", 34000, "visayas", "Catbalogan", "Catbalogan City", 11.775, 124.886),
  c("osvaldo-calbayog", "Osvaldo Reta", "A gentle companion who loves the river town.", ["Gentleness", "River", "Conversation"], ["Sightseeing", "Companionship"], "both", 36000, "visayas", "Calbayog", "Calbayog City", 12.066, 124.594),

  c("ariane-davao", "Ariane Cabiling", "A warm companion with a love of fruit and kind talks.", ["Warmth", "Fruits", "Conversation"], ["Cooking", "Companionship"], "both", 44000, "mindanao", "Davao City", "Davao City", 7.1907, 125.4553),
  c("brian-cagayan-oro", "Brian Saavedra", "A grounded friend who enjoys the river city.", ["Grounding", "River", "Listening"], ["Companionship", "Wellness"], "both", 40000, "mindanao", "Cagayan de Oro", "Cagayan de Oro City", 8.484, 124.648),
  c("carla-general-santos", "Carla Tanalgo", "A patient companion who values steady progress.", ["Patience", "Steadiness", "Conversation"], ["Academics", "Companionship"], "online", 37000, "mindanao", "General Santos", "General Santos City", 6.1164, 125.1716),
  c("dino-iligan", "Dino Mercader", "A calm companion near the falls and the hills.", ["Calm", "Falls", "Listening"], ["Outdoor", "Companionship"], "in_person", 39000, "mindanao", "Iligan", "Iligan City", 8.213, 124.243),
  c("ella-butuan", "Ella Florano", "A cheerful guide who knows the city's heart.", ["Cheerfulness", "Guidance", "Conversation"], ["Sightseeing", "Companionship"], "both", 38000, "mindanao", "Butuan", "Butuan City", 8.947, 125.54),
  c("felix-zamboanga", "Felix Salazar", "A friendly companion on the far southern shore.", ["Friendly", "Coast", "Conversation"], ["Sightseeing", "Companionship"], "in_person", 42000, "mindanao", "Zamboanga City", "Zamboanga City", 6.9214, 122.079),
  c("grace-cotabato", "Grace Macapa", "A gentle presence who listens with care.", ["Gentleness", "Care", "Listening"], ["Companionship", "Wellness"], "online", 35000, "mindanao", "Cotabato City", "Cotabato City", 7.224, 124.246),
  c("henry-koronadal", "Henry Lumagas", "A steady friend from the lake region.", ["Steadiness", "Lake", "Conversation"], ["Sightseeing", "Companionship"], "both", 37000, "mindanao", "Koronadal", "Koronadal City", 6.498, 124.847),
  c("issabel-surigao", "Issabel Cabillan", "A calm companion who loves the coastal air.", ["Calm", "Coast", "Listening"], ["Companionship", "Wellness"], "online", 36000, "mindanao", "Surigao City", "Surigao City", 9.784, 125.495),
  c("jomar-marawi", "Jomar Dirampaten", "A patient guide near the lake city.", ["Patience", "Lake", "Guidance"], ["Sightseeing", "Companionship"], "in_person", 38000, "mindanao", "Marawi", "Marawi City", 7.992, 124.293),
];

const m = (
  key: string,
  displayName: string,
  bio: string,
  onboardingCategories: string[],
  islandGroup: IslandGroup
): MemberSeed => ({ key, displayName, bio, onboardingCategories, islandGroup });

export const philippinesMembers: MemberSeed[] = [
  m("luisa-madrigal", "Luisa Madrigal", "A member looking to find authentic connections and kind company.", ["Companionship", "Wellness"], "luzon"),
  m("benito-cayabyab", "Benito Cayabyab", "A member who enjoys food, walks, and good conversation.", ["Companionship", "Cooking"], "luzon"),
  m("cora-mendiola", "Cora Mendiola", "A member curious about guided city tours and new experiences.", ["Sightseeing", "Companionship"], "luzon"),
  m("dindo-acebedo", "Dindo Acebedo", "A member who values steady focus and encouragement.", ["Academics", "Companionship"], "luzon"),
  m("elisa-buenaflor", "Elisa Buenaflor", "A member who loves outdoor walks and gentle company.", ["Companionship", "Outdoor"], "luzon"),
  m("franco-salvacion", "Franco Salvacion", "A member hoping to build good habits with a kind guide.", ["Wellness", "Companionship"], "luzon"),
  m("gilda-manalac", "Gilda Manalac", "A member who enjoys art and quiet museum mornings.", ["Arts", "Companionship"], "luzon"),
  m("homer-olivar", "Homer Olivar", "A member looking for relaxed coffee and real talk.", ["Coffee", "Companionship"], "luzon"),
  m("irma-capili", "Irma Capili", "A member who wants warm, honest connections.", ["Companionship", "Wellness"], "luzon"),
  m("jovito-ulindang", "Jovito Ulindang", "A member who loves festivals and shared experiences.", ["Events", "Companionship"], "luzon"),
  m("krisana-lopez", "Krisana Lopez", "A member seeking patient guidance and encouragement.", ["Academics", "Companionship"], "luzon"),
  m("leroy-tomas", "Leroy Tomas", "A member who enjoys cooking and pleasant company.", ["Cooking", "Companionship"], "luzon"),
  m("milagros-ocampo", "Milagros Ocampo", "A member who values calm and genuine conversation.", ["Companionship", "Wellness"], "luzon"),
  m("nilo-barrayco", "Nilo Barrayco", "A member curious about the city and its stories.", ["Sightseeing", "Companionship"], "luzon"),
  m("osita-gatmaitan", "Osita Gatmaitan", "A member who seeks steady, honest companionship.", ["Companionship", "Wellness"], "luzon"),
  m("pia-jimenez", "Pia Jimenez", "A member who loves the mountains and long walks.", ["Outdoor", "Companionship"], "luzon"),
  m("quitain-bautista", "Quitain Bautista", "A member looking for light and friendly company.", ["Companionship", "Events"], "luzon"),
  m("reyna-dagdag", "Reyna Dagdag", "A member who enjoys home cooking and warm talk.", ["Cooking", "Companionship"], "luzon"),
  m("sylvino-campos", "Sylvino Campos", "A member who values focused and kind support.", ["Academics", "Companionship"], "luzon"),
  m("teresita-abad", "Teresita Abad", "A member who wants calm company and honest chat.", ["Companionship", "Wellness"], "luzon"),
  m("umberto-flores", "Umberto Flores", "A member who enjoys the coast and gentle company.", ["Sightseeing", "Companionship"], "luzon"),
  m("violeta-tan", "Violeta Tan", "A member seeking warm, sincere connection.", ["Companionship", "Wellness"], "luzon"),
  m("alfonso-rabaya", "Alfonso Rabaya", "A member who loves island life and good food.", ["Cooking", "Companionship"], "visayas"),
  m("bessie-culanag", "Bessie Culanag", "A member who enjoys the beach and easy flow.", ["Outdoor", "Companionship"], "visayas"),
  m("cayetano-deleon", "Cayetano Deleon", "A member who values heritage and long talks.", ["Sightseeing", "Companionship"], "visayas"),
  m("dzul-fernandez", "Dzul Fernandez", "A member looking for honest, steady company.", ["Companionship", "Wellness"], "visayas"),
  m("esmeralda-garcia", "Esmeralda Garcia", "A member who enjoys festivals and shared joy.", ["Events", "Companionship"], "visayas"),
  m("fabio-santos", "Fabio Santos", "A member who loves the coast and kind company.", ["Sightseeing", "Companionship"], "visayas"),
  m("greta-andrada", "Greta Andrada", "A member who wants calm and supportive company.", ["Academics", "Companionship"], "mindanao"),
  m("hussain-alonto", "Hussain Alonto", "A member who values patient guidance and warmth.", ["Companionship", "Wellness"], "mindanao"),
  m("isabel-pascual", "Isabel Pascual", "A member who enjoys the countryside and gentle talk.", ["Outdoor", "Companionship"], "mindanao"),
  m("joel-bucoy", "Joel Bucoy", "A member seeking friendly, sincere connections.", ["Companionship", "Events"], "mindanao"),
];

export const pendingCompanionApplicants: ApprovedCompanionSeed[] = [
  c("aurelia-taytay", "Aurelia Buena", "A patient applicant who loves the lakeside mornings.", ["Patience", "Lakes", "Conversation"], ["Sightseeing", "Companionship"], "both", 36000, "luzon", "Taytay", "Taytay, Rizal", 14.5595, 121.1337),
  c("clarito-los-banos", "Clarito Aguilar", "A friendly applicant who enjoys university-town energy.", ["Friendly", "Energy", "Conversation"], ["Academics", "Companionship"], "online", 35000, "luzon", "Los Baños", "Los Baños, Laguna", 14.1685, 121.2414),
  c("delia-san-quilino", "Delia Madelo", "A warm applicant who loves the countryside and home food.", ["Warmth", "Countryside", "Cooking"], ["Cooking", "Companionship"], "both", 37000, "luzon", "Santa Rosa", "Santa Rosa, Laguna", 14.2756, 121.1137),
  c("eufronio-baguio", "Eufronio Bahin", "A calm applicant who prefers the cool mountain air.", ["Calm", "Mountains", "Listening"], ["Outdoor", "Companionship"], "in_person", 40000, "luzon", "Itogon", "Itogon, Benguet", 16.3739, 120.5959),
  c("fidela-tarlac", "Fidela Lapuz", "A gentle applicant who values steady, honest talk.", ["Gentleness", "Honesty", "Conversation"], ["Companionship", "Wellness"], "online", 33000, "luzon", "Concepcion", "Concepcion, Tarlac", 15.3251, 120.6541),
  c("gabriel-boracay", "Gabriel Kiamco", "A sun-loving applicant who knows the island paths.", ["Sun", "Beach", "Guidance"], ["Sightseeing", "Outdoor"], "in_person", 52000, "visayas", "Malay", "Boracay, Malay, Aklan", 11.967, 121.924),
  c("hebi-iloilo", "Hebi Salcedo", "A thoughtful applicant from the river city.", ["Thoughtfulness", "River", "Listening"], ["Sightseeing", "Companionship"], "both", 38000, "visayas", "Lapaz", "La Paz, Iloilo City", 10.719, 122.55),
  c("japal-davao", "Japal Dacay", "A patient applicant who loves fruit and kind talk.", ["Patience", "Fruits", "Conversation"], ["Cooking", "Companionship"], "both", 41000, "mindanao", "Davao City", "Davao City", 7.1907, 125.4553),
];

const islandCount = (rows: IslandGroup[], wanted: IslandGroup): number =>
  rows.filter((r) => r === wanted).length;

const ensureUniqueStrings = (label: string, values: string[]): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${label} has duplicate value: ${value}`);
    }
    seen.add(value);
  }
};

const assertCount = (label: string, actual: number, expected: number): void => {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected} but got ${actual}`);
  }
};

const companionGroups = approvedPhilippinesCompanions.map((p) => p.islandGroup);

assertCount("approvedPhilippinesCompanions total", approvedPhilippinesCompanions.length, 80);
assertCount("approvedPhilippinesCompanions luzon", islandCount(companionGroups, "luzon"), 56);
assertCount("approvedPhilippinesCompanions visayas", islandCount(companionGroups, "visayas"), 14);
assertCount("approvedPhilippinesCompanions mindanao", islandCount(companionGroups, "mindanao"), 10);
ensureUniqueStrings("companion keys", approvedPhilippinesCompanions.map((p) => p.key));
ensureUniqueStrings("companion display names", approvedPhilippinesCompanions.map((p) => p.displayName));

const memberGroups = philippinesMembers.map((p) => p.islandGroup);

assertCount("philippinesMembers total", philippinesMembers.length, 32);
assertCount("philippinesMembers luzon", islandCount(memberGroups, "luzon"), 22);
assertCount("philippinesMembers visayas", islandCount(memberGroups, "visayas"), 6);
assertCount("philippinesMembers mindanao", islandCount(memberGroups, "mindanao"), 4);
ensureUniqueStrings("member keys", philippinesMembers.map((p) => p.key));
ensureUniqueStrings("member display names", philippinesMembers.map((p) => p.displayName));

const applicantGroups = pendingCompanionApplicants.map((p) => p.islandGroup);

assertCount("pendingCompanionApplicants total", pendingCompanionApplicants.length, 8);
assertCount("pendingCompanionApplicants luzon", islandCount(applicantGroups, "luzon"), 5);
assertCount("pendingCompanionApplicants visayas", islandCount(applicantGroups, "visayas"), 2);
assertCount("pendingCompanionApplicants mindanao", islandCount(applicantGroups, "mindanao"), 1);
ensureUniqueStrings("applicant keys", pendingCompanionApplicants.map((p) => p.key));
ensureUniqueStrings("applicant display names", pendingCompanionApplicants.map((p) => p.displayName));

const usedCompanionKeys = new Set(approvedPhilippinesCompanions.map((p) => p.key));
const usedCompanionNames = new Set(approvedPhilippinesCompanions.map((p) => p.displayName));
for (const applicant of pendingCompanionApplicants) {
  if (usedCompanionKeys.has(applicant.key)) {
    throw new Error(`applicant key collides with companion: ${applicant.key}`);
  }
  if (usedCompanionNames.has(applicant.displayName)) {
    throw new Error(`applicant display name collides with companion: ${applicant.displayName}`);
  }
}
ensureUniqueStrings("all catalog keys", [
  ...approvedPhilippinesCompanions.map((p) => p.key),
  ...philippinesMembers.map((p) => p.key),
  ...pendingCompanionApplicants.map((p) => p.key),
]);
ensureUniqueStrings("all catalog display names", [
  ...approvedPhilippinesCompanions.map((p) => p.displayName),
  ...philippinesMembers.map((p) => p.displayName),
  ...pendingCompanionApplicants.map((p) => p.displayName),
]);

for (const companion of approvedPhilippinesCompanions) {
  if (companion.hourlyRateCentavos < 30000 || companion.hourlyRateCentavos > 90000) {
    throw new Error(`companion ${companion.key} rate out of range`);
  }
}

export const catalogCounts = {
  companions: 80,
  companionLuzon: 56,
  companionVisayas: 14,
  companionMindanao: 10,
  members: 32,
  memberLuzon: 22,
  memberVisayas: 6,
  memberMindanao: 4,
  applicantCompanions: 8,
  applicantLuzon: 5,
  applicantVisayas: 2,
  applicantMindanao: 1,
};
