import * as T from "three";

export const sites = [
  { name: "Empresa 1", role: "Origem do material", x: -32, z: -15 },
  { name: "Empresa 2", role: "Reaproveitamento e novo uso", x: 32, z: -14 },
  { name: "Empresa 3", role: "Nova demanda de material", x: 33, z: 15 },
  { name: "Empresa 4", role: "Novo destino e reinício do ciclo", x: -32, z: 16 },
] as const;

const material = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.82 });

export function makeWorld(logo: T.Texture) {
  const scene = new T.Scene();
  const asphalt = material(0x3a4240);
  const concrete = material(0x827e68);
  const siding = material(0x526549);
  const roof = material(0xbec3a3);
  const solar = new T.MeshStandardMaterial({ color: 0x1d3e65, metalness: 0.45, roughness: 0.33 });
  const metal = new T.MeshStandardMaterial({ color: 0xb0bdb1, metalness: 0.57, roughness: 0.38 });
  const pallet = material(0xaa7743);
  const cargo = material(0xcba763);
  const dark = material(0x152017);
  const white = material(0xe2e8dd);
  const green = material(0x263f28);
  const glass = material(0x243f42);
  const rubber = material(0x121816);
  const yellow = material(0xc39234);
  const amber = new T.MeshStandardMaterial({ color: 0xffc36d, emissive: 0xffa83e, emissiveIntensity: 0.65 });
  const lime = new T.MeshBasicMaterial({ color: 0xcdee56 });
  const trace = new T.MeshBasicMaterial({ color: 0x96b638 });
  const logoInk = new T.MeshBasicMaterial({ map: logo, color: 0xffffff, side: T.DoubleSide });
  const boxShape = new T.BoxGeometry(1, 1, 1);
  const round = new T.CylinderGeometry(1, 1, 1, 12);

  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number) {
    const part = new T.Mesh(geometry, surface);
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  }

  function box(parent: T.Object3D, surface: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const part = mesh(parent, boxShape, surface, x, y, z);
    part.scale.set(w, h, d);
    return part;
  }

  function sign(parent: T.Object3D, x: number, y: number, z: number, size: number, rotation = 0) {
    const part = mesh(parent, new T.PlaneGeometry(size, size), logoInk, x, y, z);
    part.rotation.y = rotation;
    return part;
  }

  const points = [
    [-32, -7], [-23.8, -7], [-17, -6], [-6, -9], [8, -9.3], [23.65, -6.6], [32, -6],
    [40, -6], [45, 0], [43.8, 8], [47, 15], [43, 21], [33, 22],
    [24.65, 22.2], [20, 23], [6, 20.3], [-8, 20.6], [-19, 23], [-23.8, 23], [-32, 23],
    [-42, 23], [-47, 18], [-45, 9], [-47, 0], [-43, -7],
  ];
  const road = new T.CatmullRomCurve3(points.map(([x, z]) => new T.Vector3(x, 0, z)), true);
  road.arcLengthDivisions = 800;
  const segments = 440;
  const samples = road.getSpacedPoints(segments);

  function ribbon(width: number, y: number, surface: T.Material, offset = 0) {
    const coords: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const point = samples[i];
      const tangent = road.getTangentAt(i / segments);
      for (const side of [-1, 1]) {
        const distance = offset + (width / 2) * side;
        coords.push(point.x - tangent.z * distance, y, point.z + tangent.x * distance);
      }
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(coords, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    surface.side = T.DoubleSide;
    mesh(scene, geometry, surface, 0, 0, 0);
  }

  ribbon(5.4, 0.07, concrete);
  ribbon(4.9, 0.09, asphalt);
  ribbon(0.14, 0.105, trace);
  for (const side of [-1, 1]) ribbon(0.07, 0.105, white, side * 2.14);
  const arrows = new T.Shape();
  arrows.moveTo(0.95, 0);
  arrows.lineTo(-0.22, 0.64);
  arrows.lineTo(-0.1, 0.2);
  arrows.lineTo(-1, 0.2);
  arrows.lineTo(-1, -0.2);
  arrows.lineTo(-0.1, -0.2);
  arrows.lineTo(-0.22, -0.64);
  arrows.closePath();
  const arrowGeometry = new T.ShapeGeometry(arrows).rotateX(-Math.PI / 2);
  for (let i = 0; i < 18; i++) {
    const u = (i + 0.5) / 18;
    const position = road.getPointAt(u);
    const direction = road.getTangentAt(u);
    const arrow = mesh(scene, arrowGeometry, lime, position.x, 0.118, position.z);
    arrow.rotation.y = Math.atan2(-direction.z, direction.x);
  }

  function crateStack(parent: T.Object3D, x: number, z: number, count: number) {
    box(parent, pallet, x, 0.13, z, 1.48, 0.24, 1.18);
    for (let level = 0; level < count; level++) {
      box(parent, cargo, x, 0.52 + level * 0.52, z, 1.3, 0.49, 1);
      for (const offset of [-0.37, 0.37]) {
        box(parent, pallet, x + offset, 0.52 + level * 0.52, z + 0.506, 0.06, 0.5, 0.04);
      }
    }
  }

  const labels: T.Vector3[] = [];
  const stations: T.Vector3[] = [];
  const loads: T.Group[] = [];
  const lights: T.Mesh[] = [];
  sites.forEach(({ x, z }, index) => {
    const plant = new T.Group();
    plant.position.set(x, 0, z);
    scene.add(plant);

    box(plant, concrete, 1, -0.025, 1.8, 24, 0.14, 15);
    box(plant, toShade(siding, index), 0, 2.8, -0.6, 13, 5.6, 8.4);
    box(plant, roof, 0, 5.68, -0.6, 13.45, 0.24, 8.72);
    box(plant, roof, 0, 4.12, 3.63, 13.15, 0.22, 0.19);
    for (let i = 0; i < 17; i++) {
      box(plant, metal, -6.32 + i * 0.79, 4.92, 3.62, 0.024, 1.45, 0.045);
    }
    for (const row of [0, 1]) for (let i = 0; i < 5; i++) {
      const panelX = -4.6 + i * 2.03;
      const panelZ = -2.75 + row * 2.08;
      box(plant, metal, panelX, 5.84, panelZ, 1.94, 0.09, 1.82);
      box(plant, solar, panelX, 5.9, panelZ, 1.82, 0.06, 1.7);
      box(plant, metal, panelX, 5.935, panelZ, 0.025, 0.01, 1.7);
      box(plant, metal, panelX, 5.935, panelZ, 1.82, 0.01, 0.025);
    }
    for (const offset of [-2.6, 2.6]) {
      box(plant, dark, offset, 1.65, 3.65, 3.7, 3.3, 0.11);
      box(plant, amber, offset, 2.35, 3.72, 3.47, 1.6, 0.05);
      for (const bar of [-0.85, 0, 0.85]) box(plant, dark, offset + bar, 2.37, 3.76, 0.06, 1.64, 0.03);
      crateStack(plant, offset, 4, 2);
    }
    sign(plant, 0, 4.96, 3.73, 1.15);
    for (const s of [0, 1, 2]) {
      const silo = mesh(plant, round, metal, -7.6 - s * 1.42, 2.55 + s * 0.12, -2.5 + s * 0.45);
      silo.scale.set(0.63, 5.1 + s * 0.24, 0.63);
      const cap = mesh(plant, round, roof, silo.position.x, 5.16 + s * 0.24, silo.position.z);
      cap.scale.set(0.68, 0.18, 0.68);
      for (const level of [0.55, 2.05, 4.32]) {
        mesh(plant, round, concrete, silo.position.x, level, silo.position.z).scale.set(0.65, 0.085, 0.65);
      }
    }

    const sx = index === 0 || index === 3 ? 8.2 : -8.35;
    const station = new T.Group();
    station.position.set(sx, 0, 3.15);
    plant.add(station);
    for (const dx of [-1.65, 1.65]) for (const dz of [-1.48, 1.48]) {
      box(station, yellow, dx, 1.5, dz, 0.13, 3, 0.13);
    }
    box(station, metal, 0, 3.04, 0, 3.8, 0.16, 3.32);
    for (const dx of [-1.2, 0, 1.2]) box(station, dark, dx, 3.13, 0, 0.06, 0.05, 3.25);
    lights.push(box(station, trace, 0, 2.94, 1.54, 2.9, 0.08, 0.1));
    crateStack(station, -0.78, 0.34, 2);
    const loading = new T.Group();
    loading.position.set(0.85, 0, 0.26);
    station.add(loading);
    crateStack(loading, 0, 0, 1);
    loads.push(loading);

    // A stationary forklift, facing out of each collection station.
    box(station, rubber, 1.55, 0.31, 2.22, 0.93, 0.36, 0.75);
    box(station, yellow, 1.55, 0.65, 2.22, 0.88, 0.4, 0.74);
    box(station, dark, 1.55, 1.16, 2.42, 0.56, 1.13, 0.12);
    box(station, rubber, 1.55, 0.24, 2.86, 0.5, 0.08, 0.84);
    box(station, dark, -1.46, 0.35, 2.62, 0.23, 0.66, 0.17);
    box(station, yellow, -1.46, 0.87, 2.62, 0.32, 0.45, 0.21);
    mesh(station, round, white, -1.46, 1.18, 2.62).scale.set(0.105, 0.15, 0.105);
    labels.push(new T.Vector3(x, 7.2, z - 0.4));
    stations.push(new T.Vector3(x + sx, 3.25, z + 3.15));
  });

  function toShade(base: T.MeshStandardMaterial, index: number) {
    const shade = base.clone();
    shade.color.offsetHSL(index * 0.009, 0, index * 0.025);
    return shade;
  }

  const truck = new T.Group();
  scene.add(truck);
  box(truck, rubber, -0.12, 0.45, 0, 3.95, 0.22, 1.27);
  box(truck, green, -0.62, 1.14, 0, 2.85, 1.37, 1.32);
  box(truck, metal, -0.62, 1.84, 0, 2.87, 0.07, 1.34);
  box(truck, white, 1.35, 1.01, 0, 1.02, 1.25, 1.26);
  box(truck, glass, 1.87, 1.33, 0, 0.03, 0.38, 1.03);
  box(truck, metal, 1.88, 0.63, 0, 0.07, 0.18, 1.27);
  for (const side of [-1, 1]) {
    sign(truck, -0.65, 1.16, side * 0.665, 0.74, side < 0 ? Math.PI : 0);
    box(truck, glass, 1.41, 1.34, side * 0.635, 0.53, 0.34, 0.04);
    box(truck, amber, 1.93, 0.78, side * 0.46, 0.055, 0.13, 0.18);
    for (const ax of [-1.58, -0.98, 1.32]) {
      const wheel = mesh(truck, round, rubber, ax, 0.34, side * 0.64);
      wheel.rotation.x = Math.PI / 2;
      wheel.scale.set(0.32, 0.22, 0.32);
      const hub = mesh(truck, round, metal, ax, 0.34, side * 0.758);
      hub.rotation.x = Math.PI / 2;
      hub.scale.set(0.126, 0.025, 0.126);
    }
  }
  const contact = new T.Mesh(
    new T.CircleGeometry(1, 24),
    new T.MeshBasicMaterial({ color: 0x111711, opacity: 0.55, transparent: true }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.017;
  contact.scale.set(2.1, 0.86, 1);
  truck.add(contact);

  for (let i = 0; i < segments; i += 6) {
    const point = samples[i];
    if (Math.abs(point.x) < 42) continue;
    const tangent = road.getTangentAt(i / segments);
    const x = point.x + tangent.z * 2.45;
    const z = point.z - tangent.x * 2.45;
    box(scene, metal, x, 0.31, z, 0.075, 0.56, 0.075);
    const rail = box(scene, metal, x, 0.55, z, 2.45, 0.08, 0.1);
    rail.rotation.y = Math.atan2(-tangent.z, tangent.x);
  }

  const stopCoordinates = [
    { point: points[0], company: 0, station: false },
    { point: points[1], company: 0, station: true },
    { point: points[5], company: 1, station: true },
    { point: points[6], company: 1, station: false },
    { point: points[12], company: 2, station: false },
    { point: points[13], company: 2, station: true },
    { point: points[18], company: 3, station: true },
    { point: points[19], company: 3, station: false },
  ];
  const stops = stopCoordinates.map(({ point: [x, z], company, station }) => {
    let best = 0;
    let distance = Infinity;
    samples.forEach((sample, i) => {
      const difference = (sample.x - x) ** 2 + (sample.z - z) ** 2;
      if (difference < distance) {
        best = i;
        distance = difference;
      }
    });
    return { company, station, u: best / segments };
  });

  const sun = new T.DirectionalLight(0xffd29b, 2.8);
  sun.position.set(-38, 34, 12);
  scene.add(sun, new T.HemisphereLight(0xb4d0ce, 0x38331c, 1.8));
  plantTerrain(scene, samples);
  const moving = new Set<T.Object3D>([truck, ...loads, ...lights]);
  const batches = new Map<T.Material, T.Mesh[]>();
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh) || object.geometry !== boxShape) return;
    for (let ancestor: T.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
      if (moving.has(ancestor)) return;
    }
    const surface = object.material as T.Material;
    const instances = batches.get(surface) ?? [];
    instances.push(object);
    batches.set(surface, instances);
  });
  for (const [surface, instances] of batches) {
    if (instances.length < 2) continue;
    const batch = new T.InstancedMesh(boxShape, surface, instances.length);
    instances.forEach((instance, index) => {
      batch.setMatrixAt(index, instance.matrixWorld);
      instance.removeFromParent();
    });
    scene.add(batch);
  }
  return { scene, road, stops, truck, labels, stations, loads, lights, trace, lime };
}

function plantTerrain(scene: T.Scene, road: T.Vector3[]) {
  let seed = 729;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const land = new T.PlaneGeometry(320, 200, 162, 112).rotateX(-Math.PI / 2);
  const vertices = land.attributes.position;
  const colors: number[] = [];
  const moss = new T.Color(0x334825);
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const z = vertices.getZ(i);
    const edge = Math.max(0, Math.abs(x) - 51, -z - 23, z - 27);
    vertices.setY(i, -0.14 + Math.min(edge * 0.32, 5) * Math.sin(x * 0.12 + z * 0.11));
    const color = moss.clone().multiplyScalar(0.7 + random() * 0.55 + Math.sin(x * 0.55 + z) * 0.1);
    colors.push(color.r, color.g, color.b);
  }
  land.computeVertexNormals();
  land.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const ground = new T.Mesh(land, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  const treeCount = 2300;
  const canopy = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), material(0xffffff), treeCount);
  const shade = new T.InstancedMesh(
    new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: 0x101c0b, transparent: true, opacity: 0.35 }),
    treeCount,
  );
  const dummy = new T.Object3D();
  const foliage = [0x213e22, 0x354c23, 0x4e5c25, 0x586331, 0x314f2d];
  let count = 0;
  for (let i = 0; i < 4300 && count < treeCount; i++) {
    const x = (random() - 0.5) * (i < 1250 ? 130 : 218);
    const z = (random() - 0.5) * (i < 1250 ? 80 : 130);
    if (sites.some((site) => Math.abs(x - site.x) < 13.2 && Math.abs(z - site.z) < 8.05)) continue;
    if (road.some((point) => (point.x - x) ** 2 + (point.z - z) ** 2 < 14)) continue;
    const edge = Math.max(0, Math.abs(x) - 51, -z - 23, z - 27);
    const y = -0.14 + Math.min(edge * 0.32, 5) * Math.sin(x * 0.12 + z * 0.11);
    const size = 0.48 + random() * 1.32;
    dummy.position.set(x, y + 0.055, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(size * 1.2, 1, size * 1.05);
    dummy.updateMatrix();
    shade.setMatrixAt(count, dummy.matrix);
    dummy.position.set(x, y + size * 0.78, z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(size, size * (0.85 + random() * 0.65), size * 0.83);
    dummy.updateMatrix();
    canopy.setMatrixAt(count, dummy.matrix);
    canopy.setColorAt(count, new T.Color(foliage[Math.floor(random() * foliage.length)]));
    count++;
  }
  canopy.count = shade.count = count;
  scene.add(ground, canopy, shade);
}
