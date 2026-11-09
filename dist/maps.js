// Coordinates are metres. A spawn yaw of zero looks toward negative Z.
const block = (x, z, w, d, h, style = "concrete", y = 0) => ({
  x,
  z,
  w,
  d,
  h,
  style,
  y,
});
function tower(x, z, w, d, style, sideDoor = false) {
  return [
    // A real ground passage under the upper shooting room.
    block(x - w / 2 + .75, z, 1.5, d, 3.1, style),
    block(x + w / 2 - .75, z, 1.5, d, 3.1, style),
    block(x, z, w, d, .3, "walkway", 2.8),
    ...(sideDoor ? [-1, 1].map((side) =>
      block(x - w / 2 + .6, z + side * (d + 2.4) / 4, 1.2, (d - 2.4) / 2, 3.2, style, 3.1)
    ) : [block(x - w / 2 + .6, z, 1.2, d, 3.2, style, 3.1)]),
    block(x + w / 2 - .6, z, 1.2, d, 3.2, style, 3.1),
    block(x, z - d / 2 + .4, w, .8, 1.05, style, 3.1),
    block(x, z - d / 2 + .4, w, .8, .7, style, 5.6),
    block(x, z, w + .2, d + .2, .45, "walkway", 6.3),
    ...Array.from(
      { length: 8 },
      (_, i) =>
        block(
          x + w / 2 - 2,
          z + d / 2 + 5.8 - i * .8,
          2,
          .85,
          (i + 1) * .4,
          "steel",
        ),
    ),
  ];
}
// Open shooting decks retain ground passages and accept stairs from any side.
function pavilion(x, z, w, d, style) {
  return [
    block(x, z, w, d, .3, "walkway", 2.9),
    block(x, z, w + .2, d + .2, .4, "walkway", 6.3),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) =>
      block(x + sx * (w / 2 - .45), z + sz * (d / 2 - .45), .9, .9, 6.3, style))),
  ];
}
function stairs(x, z, dx, dz, base = 0, count = 8) {
  return Array.from({ length: count }, (_, i) =>
    block(x + dx * i * .8, z + dz * i * .8, dx ? .85 : 2,
      dz ? .85 : 2, (i + 1) * .4, "steel", base));
}
const rail = (x, z, w, d) => block(x, z, w, d, .95, "rail", 3.2);

const spawns = [[0, 23], [-21, 20], [20, -20], [0, -23], [23, 4], [-23, 0], [
  18,
  21,
], [-20, -20]]
  .map(([x, z]) => ({ x, z, yaw: Math.atan2(x, z) }));

// The public training compound is intentionally excluded from map voting.
export const TRAINING_MAP = {
  id:'training-compound', name:'Training compound', description:'Target lanes · sniper warmup', half:26,
  colors:{cobalt:['#797a64','#686b57'],amber:['#ad8252','#926c44'],floor:['#aaa799','#928f82']},
  spawns:Array.from({length:16},(_,i)=>({x:-15+(i%4)*10,z:5+Math.floor(i/4)*5,yaw:0})),
  targets:[-18,-12,-6,0,6,12,18].map(x=>({x,y:1.65,z:-20})),
  boxes:[...[-18,-12,-6,0,6,12,18].map(x=>block(x,-20.1,1.4,.2,2.5,'steel')),
    block(-23,-13,3,3,1.2,'amber'),block(23,-13,3,3,1.2,'amber'),
    block(-23,0,2,8,2.3,'cobalt'),block(23,0,2,8,2.3,'cobalt')],
};

export const MAPS = [
  {
    id: "crosswind",
    name: "Crosswind",
    description: "Connected towers · upper relay deck · open underpasses",
    half: 26,
    spawns,
    boxes: [
      ...tower(-13, -7, 9, 6, "cobalt"),
      ...tower(13, 8, 9, 6, "amber", true),
      block(-8, 12, 6, 2.5, 1.45),
      block(-10.1, 10.6, 1.8, 3.6, 1.45),
      block(8, -12, 6, 2.5, 1.45),
      block(10.1, -10.6, 1.8, 3.6, 1.45),
      block(0, 0, 6, 5, 2.9, "steel"),
      // East stairs → upper room → guarded L walkway → central relay deck.
      block(0, 0, 6.4, 5.4, .3, "walkway", 2.9),
      block(6, 8, 6, 2.4, .28, "walkway", 2.92),
      block(3, 4, 2.4, 8, .28, "walkway", 2.92),
      block(2.05, 6.4, .35, .35, 2.92, "steel"),
      block(7.8, 8.95, .35, .35, 2.92, "steel"),
      block(6, 9.2, 6, .16, .85, "rail", 3.2),
      block(6.7, 6.8, 4.6, .16, .85, "rail", 3.2),
      block(1.8, 4.8, .16, 3.6, .85, "rail", 3.2),
      block(4.2, 4.8, .16, 3.6, .85, "rail", 3.2),
      block(-3.1, 0, .16, 5.2, .95, "rail", 3.2),
      block(0, -2.6, 6.2, .16, .95, "rail", 3.2),
      block(-1.2, 2.6, 3.8, .16, .95, "rail", 3.2),
      block(3.1, -1.5, .16, 2.4, .95, "rail", 3.2),
      block(19, -4, 4, 5, 2.3),
      block(-19, 4, 4, 5, 2.3),
      block(-8, -18, 4, 4, 2.4, "steel"),
      block(8, 18, 4, 4, 2.4, "steel"),
      ...tower(3, -16, 7, 5, "cobalt"),
    ],
  },
  {
    id: "switchyard",
    name: "Switchyard",
    description: "Freight lanes · side gantries · divided crossfire",
    colors: { cobalt: ["#75866c", "#63765d"], amber: ["#bf925e", "#aa7c4f"], floor: ["#aaa69a", "#969184"] },
    half: 26,
    spawns,
    boxes: [
      ...[-1, 1].flatMap((side) => [
        ...pavilion(side * 14, 0, 8, 6, side < 0 ? "cobalt" : "amber"),
        ...stairs(side * 15.5, 8.8, 0, -1),
        // Long outer gantry: two approaches and an open ground route beneath.
        block(side * 19, -1, 3, 18, .3, "walkway", 2.9),
        ...stairs(side * 19, -15.8, 0, 1),
        rail(side * 20.5, -1, .16, 18),
        rail(side * 17.5, -6, .16, 8),
        rail(side * 19, 8, 3, .16),
        block(side * 19, -6, .6, .6, 2.9, "steel"),
        block(side * 19, 5, .6, .6, 2.9, "steel"),
      ]),
      // A broken central spine has two standing-height crossovers.
      block(0, 0, 1.4, 9, 2.5, "steel"),
      block(0, -13, 1.4, 7, 2.5, "steel"),
      block(0, 13, 1.4, 7, 2.5, "steel"),
      block(0, -7, 1.4, 5, .35, "walkway", 2.5),
      block(0, 7, 1.4, 5, .35, "walkway", 2.5),
      block(-6, -12, 4, 7, 2.2, "amber"),
      block(6, 12, 4, 7, 2.2, "cobalt"),
      block(-6, 11, 6, 2.5, 1.4),
      block(6, -11, 6, 2.5, 1.4),
      block(-7, 15, 1.4, 4, 1.4),
      block(7, -15, 1.4, 4, 1.4),
      block(-11, -20, 4, 2, 1.4),
      block(11, 20, 4, 2, 1.4),
    ],
  },
  {
    id: "overlook",
    name: "Overlook",
    description: "Courtyard loop · four balconies · six stair approaches",
    colors: { cobalt: ["#997965", "#866653"], amber: ["#b8ac86", "#a09570"], floor: ["#b6b2a5", "#a09c8e"] },
    half: 26,
    spawns,
    boxes: [
      ...[-1, 1].flatMap((side) => [-10, 10].flatMap((z) => [
        ...pavilion(side * 13, z, 7, 6, side < 0 ? "amber" : "cobalt"),
        ...stairs(side * 22.3, z, -side, 0),
      ])),
      ...[-1, 1].flatMap((side) => [
        block(side * 13, 0, 3, 20, .3, "walkway", 2.9),
        rail(side * 14.5, 0, .16, 14),
        rail(side * 11.5, 0, .16, 14),
        block(0, side * 10, 26, 3, .3, "walkway", 2.9),
        rail(0, side * 8.5, 18, .16),
        rail(-5.5, side * 11.5, 7, .16),
        rail(5.5, side * 11.5, 7, .16),
        ...stairs(0, side * 17.3, 0, -side),
        ...[-6, 6].map((x) => block(x, side * 10, .7, .7, 2.9, "amber")),
        block(side * 13, 0, .7, .7, 2.9, "cobalt"),
        block(side * 5, -4, 3.5, 1.4, 1.35),
        block(side * 5, 4, 3.5, 1.4, 1.35),
        block(side * 7.5, 0, 1.4, 3, 1.35),
        block(side * 19, 0, 2, 4, 1.4, "steel"),
      ]),
      block(0, 0, 2, 2, 1.25, "steel"),
    ],
  },
  {
    id: "foundry",
    name: "Foundry",
    description: "Switchback ascent · relay skywalk · workshop underpasses",
    colors: { cobalt: ["#8a918d", "#737d78"], amber: ["#be7653", "#a56343"], floor: ["#a49b8d", "#8f8679"] },
    half: 26,
    spawns,
    boxes: [
      ...tower(-13, -11, 9, 6, "amber"),
      ...tower(14, -11, 8, 6, "cobalt", true),
      // The machine deck can be contested from the tower or the two-flight ascent.
      block(-2, 0, 10, 7, .3, "walkway", 2.9),
      block(-2, 0, 3, 4, 2.9, "steel"),
      rail(-2, -3.5, 10, .16),
      rail(-2.5, 3.5, 9, .16),
      rail(3, -1.8, .16, 3.4),
      block(-13, -4.5, 3, 7, .3, "walkway", 2.9),
      block(-8.5, -1, 9, 2.6, .3, "walkway", 2.9),
      rail(-14.5, -4.5, .16, 7),
      rail(-11.5, -5, .16, 5),
      rail(-9, -2.3, 4, .16),
      rail(-9, .3, 4, .16),
      block(-13, -3, .6, .6, 2.9, "steel"),
      // Lower flight, landing, then a perpendicular upper flight.
      ...stairs(14.5, 10.1, 0, -1, 0, 4),
      block(13, 6, 5, 3, .3, "walkway", 1.3),
      ...stairs(10.3, 6, -1, 0, 1.6, 4),
      block(5, 6, 5.4, 3, .3, "walkway", 2.9),
      block(2.5, 3, 2.6, 6, .3, "walkway", 2.9),
      rail(5, 7.5, 5.4, .16),
      rail(5.8, 4.5, 3.8, .16),
      rail(1.2, 4.3, .16, 3.4),
      block(6, 6, .6, .6, 2.9, "steel"),
      block(13, 6, .6, .6, 1.3, "steel"),
      block(-8, 10, 5, 2.5, 1.4, "amber"),
      block(-10, 8, 1.4, 5, 1.4, "amber"),
      block(7, -13, 2.5, 6, 1.45),
      block(-19, 9, 4, 4, 2.1, "steel"),
      block(19, -17, 4, 4, 2.1, "steel"),
      block(-11, 18, 5, 2, 1.45),
      block(11, 18, 5, 2, 1.45),
      block(0, 16, 3, 4, 1.4),
    ],
  },
];

export function clearPosition(
  map,
  x,
  z,
  feet = 0,
  radius = .36,
  height = 1.85,
) {
  return Math.abs(x) <= map.half - radius && Math.abs(z) <= map.half - radius &&
    !map.boxes.some((b) =>
      feet < (b.y || 0) + b.h - .015 && feet + height > (b.y || 0) + .015 &&
      Math.abs(x - b.x) < b.w / 2 + radius &&
      Math.abs(z - b.z) < b.d / 2 + radius
    );
}
