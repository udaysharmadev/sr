import {WARDROBE_IDS} from './wardrobe.js';
// Original stylized models inspired by these rifles share identical combat rules.
export const WEAPONS = [
  {
    id: "sunbolt",
    name: "M24",
    model: "classic",
    color: 0x68714c,
    barrel: 1.05,
    scope: 1,
    stock: 1,
    description: "Full field stock · tapered match barrel",
  },
  {
    id: "glacier",
    name: "AWM",
    model: "arctic",
    color: 0x708169,
    barrel: 1.12,
    scope: 1.10,
    stock: 1,
    description: "Thumbhole stock · adjustable cheek rest",
  },
  {
    id: "prism",
    name: "Barrett M82A1",
    model: "heavy",
    color: 0x343b40,
    barrel: 1.20,
    scope: 1.1,
    stock: 1,
    description: "Heavy receiver · three-port muzzle brake",
  },
  {
    id: "cinder",
    name: "Dragunov SVD",
    model: "dragun",
    color: 0x88512d,
    barrel: 1.13,
    scope: .88,
    stock: 1,
    description: "Walnut furniture · skeleton stock",
  },
  {
    id: "spectre",
    name: "Sako TRG 42",
    model: "chassis",
    color: 0x9c9174,
    barrel: 1.15,
    scope: 1.07,
    stock: 1,
    description: "Folding chassis · long suppressor",
  },
  {
    id: "volt",
    name: "Steyr Scout",
    model: "scout",
    color: 0x4f5c54,
    barrel: .99,
    scope: .84,
    stock: 1,
    description: "Slim field stock · forward scout optic",
  },
  {
    id: "rose",
    name: "Desert Tech SRS",
    model: "bullpup",
    color: 0x9a9586,
    barrel: 1.13,
    scope: .96,
    stock: 1,
    description: "Bullpup receiver · rear-mounted magazine",
  },
  {
    id: "ivory",
    name: "CheyTac M200",
    model: "competition",
    color: 0x9b8b64,
    barrel: 1.17,
    scope: 1.14,
    stock: 1,
    description: "Machined alloy chassis · adjustable buttplate",
  },
];
export const weaponById = (id) =>
  WEAPONS.find((w) => w.id === id) || WEAPONS[0];
export const CHAMBER_MS = 1500;
export function cosmeticLoadout(value = {}) {
  const choices = { clothing: ["cobalt", "ember", "lime", "arctic", "desert", "shadow",...WARDROBE_IDS.clothing],
    accessories: ["sky", "blaze", "violet", "headset", "cap", "mask",...WARDROBE_IDS.accessories], shoes: ["runner", "tactical", "alpine", "crimson",...WARDROBE_IDS.shoes] };
  return Object.fromEntries(Object.entries(choices).map(([key, ids]) => [key, ids.includes(value?.[key]) ? value[key] : ids[0]]));
}
export const canChangeWeapon = (phase, alive, spectator = false, mode = 'ffa') =>
  mode !== 'arms' && !spectator && (phase === "warmup" || phase === "live" && !alive);
