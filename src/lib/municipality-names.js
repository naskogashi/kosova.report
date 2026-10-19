// Display names for Kosovo municipalities. Reports and routing always use the
// city code from the database, so these names are presentation-only and never
// reach backend queries.
const names = [
  ["Deçan", "Dečani", "Deçan"],
  ["Dragash", "Dragaš", "Dragash"],
  ["Ferizaj", "Uroševac", "Ferizaj"],
  ["Fushë Kosovë", "Kosovo Polje", "Fushë Kosova", ["fushe kosova"]],
  ["Gjakovë", "Đakovica", "Gjakova"],
  ["Gjilan", "Gnjilane", "Gjilan"],
  ["Drenas", "Glogovac", "Drenas", ["gllogoc"]],
  ["Graçanicë", "Gračanica", "Gračanica"],
  ["Hani i Elezit", "Elez Han", "Hani i Elezit", ["general jankovic"]],
  ["Istog", "Istok", "Istog"],
  ["Junik", "Junik", "Junik"],
  ["Kaçanik", "Kačanik", "Kaçanik"],
  ["Kamenicë", "Kamenica", "Kamenica"],
  ["Klinë", "Klina", "Klina"],
  ["Kllokot", "Klokot", "Klokot"],
  ["Leposaviq", "Leposavić", "Leposavić"],
  ["Lipjan", "Lipljan", "Lipjan"],
  ["Malishevë", "Mališevo", "Malisheva"],
  ["Mamushë", "Mamuša", "Mamusha"],
  [
    "Mitrovicë",
    "Mitrovica",
    "Mitrovica",
    ["mitrovice e jugut", "juzna mitrovica", "south mitrovica"],
  ],
  [
    "Mitrovicë e Veriut",
    "Severna Mitrovica",
    "North Mitrovica",
    ["mitrovica e veriut"],
  ],
  ["Novobërdë", "Novo Brdo", "Novo Brdo"],
  ["Obiliq", "Obilić", "Obiliq"],
  ["Partesh", "Parteš", "Partesh"],
  ["Pejë", "Peć", "Peja", ["pec", "peja"]],
  ["Podujevë", "Podujevo", "Podujeva"],
  ["Prishtinë", "Priština", "Prishtina", ["pristina"]],
  ["Prizren", "Prizren", "Prizren"],
  ["Rahovec", "Orahovac", "Rahovec"],
  ["Ranillug", "Ranilug", "Ranilug"],
  ["Shtërpcë", "Štrpce", "Shtërpca"],
  ["Shtime", "Štimlje", "Shtime"],
  ["Skënderaj", "Srbica", "Skenderaj"],
  ["Suharekë", "Suva Reka", "Suhareka"],
  ["Viti", "Vitina", "Viti"],
  ["Vushtrri", "Vučitrn", "Vushtrri"],
  ["Zubin Potok", "Zubin Potok", "Zubin Potok"],
  ["Zveçan", "Zvečan", "Zvečan"],
];
const regionSuffix =
  /,?\s*(kosovo|kosova|kosove|kosovë|republika e kosov[eë]s)\s*$/i;
// Strips a trailing ", Kosovo"/", Kosovë" that older city records may carry.
export const cleanCityName = (name) =>
  String(name || "")
    .replace(regionSuffix, "")
    .trim();
const normalize = (text) =>
  cleanCityName(text)
    .toLowerCase()
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const lookup = new Map();
for (const [sq, sr, en, aliases = []] of names)
  for (const key of [sq, sr, en, ...aliases])
    lookup.set(normalize(key), { sq, sr, en });
lookup.set("dakovica", lookup.get(normalize("Gjakovë")));
export function localizedCityName(name, language = "sq") {
  const match = lookup.get(normalize(name));
  return match?.[language] || match?.sq || cleanCityName(name);
}
