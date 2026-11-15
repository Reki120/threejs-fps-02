// EMBERWORKS: Kiln Yard — every constant in one place. Palette, map data, weapons,
// economy and round rules. No other module invents numbers; it reads them here.

// Look plan: dusk in a foundry yard. Warm mid-tone concrete and rust, amber
// furnace glow, teal hazard marks. The map reads at a glance: floors and walls
// are light enough to see, the accent colours mark the sites and the teams.
export const PALETTE = {
  canvas: '#241c15',
  surface: '#6a5a48',
  hairline: '#7d6c59',
  floor: '#5c4a38',
  ink: '#f2ead9',
  muted: '#a89a86',
  accent: '#f08a2e',
  ember: '#e8722a',
  ash: '#2a9d8f',
  hazard: '#e8c33a',
};

export const MATCH = {
  winRounds: 5,
  maxRounds: 9,
  buySeconds: 12,
  roundSeconds: 100,
  endSeconds: 4,
  fuseSeconds: 35,
  plantSeconds: 3.5,
  defuseSeconds: 5,
  startMoney: 800,
  killMoney: 300,
  winMoney: 3250,
  lossMoney: 1900,
  plantMoney: 300,
  defuseMoney: 300,
  maxMoney: 16000,
};

// Weapons: damage is per body hit; head multiplies. Spread is radians of cone half
// angle; the moving value is added in full at full run speed. All values tuned so a
// standing aimed shot beats a running spray.
export const WEAPONS = {
  p9: {
    name: 'P9', label: 'P9 sidearm', price: 0, slot: 'side',
    damage: 26, headMult: 3, mag: 12, reserve: 36, auto: false,
    gap: 0.14, reload: 1.4, spreadStill: 0.004, spreadMove: 0.03,
    kick: 0.006, range: 60, barrel: 0.16, color: 'hairline',
  },
  vk47: {
    name: 'VK-47', label: 'VK-47 rifle', price: 2700, slot: 'primary',
    damage: 34, headMult: 3, mag: 30, reserve: 90, auto: true,
    gap: 0.1, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028,
    kick: 0.009, range: 90, barrel: 0.42, color: 'ink',
  },
  wasp: {
    name: 'Wasp-9', label: 'Wasp-9 SMG', price: 1500, slot: 'primary',
    damage: 22, headMult: 3, mag: 32, reserve: 96, auto: true,
    gap: 0.07, reload: 1.6, spreadStill: 0.004, spreadMove: 0.034,
    kick: 0.006, range: 55, barrel: 0.3, color: 'ash',
  },
  longbow: {
    name: 'Longbow', label: 'Longbow marksman', price: 4750, slot: 'primary',
    damage: 110, headMult: 4, mag: 5, reserve: 15, auto: false,
    gap: 1.1, reload: 2.8, spreadStill: 0.0008, spreadMove: 0.05,
    kick: 0.03, range: 120, barrel: 0.62, color: 'accent',
    zoom: true,
  },
};

export const GRENADE = { name: 'Spark', label: 'Spark frag grenade', price: 300 };

// The map: Kiln Yard, an industrial foundry yard, 44 m by 36 m. Attackers spawn
// south, defenders north. Site A (Furnace) west, site B (Silo) east, mid hall
// between them. Every box below is a wall, a crate or a structure: a collider for
// movement and a surface a bullet stops on.
export const MAP = {
  sizeX: 44,
  sizeZ: 36,
  // [width, height, depth, x, y, z, material]
  boxes: [
    // floor and perimeter walls
    [44.4, 0.4, 36.4, 0, -0.2, 0, 'floor'],
    [0.5, 5.0, 36.4, -22.2, 2.5, 0, 'surface'],
    [0.5, 5.0, 36.4, 22.2, 2.5, 0, 'surface'],
    [44.4, 5.0, 0.5, 0, 2.5, -18.2, 'surface'],
    [44.4, 5.0, 0.5, 0, 2.5, 18.2, 'surface'],
    // mid hall: two pillars and a low furnace wall
    [1.4, 4.2, 1.4, -3.5, 2.1, -2, 'hairline'],
    [1.4, 4.2, 1.4, 3.5, 2.1, -2, 'hairline'],
    [6.0, 1.2, 1.0, 0, 0.6, 4, 'surface'],
    // west lane cover: container stack and crates
    [4.4, 2.4, 2.2, -13, 1.2, 2, 'ember'],
    [2.2, 1.1, 1.2, -9, 0.55, 8, 'hairline'],
    [1.2, 1.1, 2.2, -17, 0.55, -2, 'hairline'],
    [2.4, 2.4, 1.2, -11, 1.2, -7, 'surface'],
    // east lane cover
    [4.4, 2.4, 2.2, 13, 1.2, 2, 'ash'],
    [2.2, 1.1, 1.2, 9, 0.55, 8, 'hairline'],
    [1.2, 1.1, 2.2, 17, 0.55, -2, 'hairline'],
    [2.4, 2.4, 1.2, 11, 1.2, -7, 'surface'],
    // site A furnace: big block with a glowing mouth, plus side crates
    [5.0, 3.4, 3.0, -17, 1.7, -12.5, 'surface'],
    [1.6, 1.1, 1.6, -12.5, 0.55, -13.5, 'hairline'],
    [1.6, 1.1, 1.6, -16.5, 0.55, -7.5, 'hairline'],
    // site B silo: cylinder approximated by a tall octagonal block, plus crates
    [3.6, 4.6, 3.6, 17, 2.3, -12.5, 'surface'],
    [1.6, 1.1, 1.6, 12.5, 0.55, -13.5, 'hairline'],
    [1.6, 1.1, 1.6, 16.5, 0.55, -7.5, 'hairline'],
    // spawn cover
    [3.0, 1.1, 1.2, -5, 0.55, 14, 'hairline'],
    [3.0, 1.1, 1.2, 5, 0.55, 14, 'hairline'],
    [3.0, 1.1, 1.2, -5, 0.55, -15, 'hairline'],
    [3.0, 1.1, 1.2, 5, 0.55, -15, 'hairline'],
  ],
  // Bomb sites: centre, radius, label.
  sites: [
    { id: 'A', name: 'Furnace', x: -16, z: -10.5, radius: 3.4 },
    { id: 'B', name: 'Silo', x: 16, z: -10.5, radius: 3.4 },
  ],
  spawns: {
    ember: [[-6, 15], [-2, 15.5], [2, 15.5], [6, 15]],
    ash: [[-6, -15], [-2, -15.5], [2, -15.5], [6, -15]],
  },
  // Waypoint graph for bots: [x, z] nodes, edges by index pairs. Attackers walk
  // south to north; defenders walk north to south and hold the sites.
  nodes: [
    [-6, 15], [-2, 15.5], [2, 15.5], [6, 15], // 0-3 attacker spawn
    [-10, 8], [0, 8], [10, 8], // 4-6 south approach
    [-14, 0], [0, 0], [14, 0], // 7-9 mid
    [-16, -6], [0, -6], [16, -6], // 10-12 north approach
    [-16, -10.5], [16, -10.5], // 13-14 sites A, B
    [-6, -15], [-2, -15.5], [2, -15.5], [6, -15], // 15-18 defender spawn
    [-10, -10], [10, -10], // 19-20 site guards
    [-6, 2], [6, 2], // 21-22 mid flanks
  ],
  edges: [
    [0, 4], [1, 5], [2, 5], [3, 6], [4, 7], [5, 8], [6, 9],
    [4, 21], [6, 22], [21, 8], [22, 8], [7, 10], [8, 11], [9, 12],
    [10, 13], [12, 14], [11, 10], [11, 12], [10, 19], [12, 20],
    [19, 13], [20, 14], [13, 15], [14, 18], [15, 19], [18, 20],
    [16, 11], [17, 11], [15, 10], [18, 12], [5, 21], [5, 22],
  ],
};
