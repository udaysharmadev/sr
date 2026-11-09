import * as T from "./vendor/three.module.js";
import { COLLAPSE_MS, collapsePose } from "./presentation.js";
import { rifle, setRifleFinish } from "./rifle-models.js";
export function createDeathEffects(scene, map, now = () => performance.now()) {
  const corpses = [];
  const bounds = new T.Box3();
  function add(model, age = 0, pose = null) {
    if (!model || age >= COLLAPSE_MS) return;
    const root = new T.Group(), hip = new T.Group();
    root.add(hip);
    scene.add(root);
    root.position.copy(model.position);
    root.scale.copy(model.scale);
    root.rotation.y = model.rotation.y;
    if (pose) {
      if ([pose.x, pose.y, pose.z].every(Number.isFinite)) root.position.set(pose.x, pose.y, pose.z);
      if (Number.isFinite(pose.yaw)) root.rotation.y = pose.yaw;
      if (Number.isFinite(pose.eyeHeight)) root.scale.y = pose.eyeHeight < 1.3 ? .77 : 1;
    }
    const fallAxis = new T.Vector3(1, 0, 0);
    const direction = new T.Vector3(pose?.impactX || 0, 0, pose?.impactZ || 0);
    if (direction.lengthSq() > .0001) {
      direction.applyAxisAngle(new T.Vector3(0, 1, 0), -root.rotation.y).normalize();
      fallAxis.set(direction.z, 0, -direction.x);
    }
    const materials = new Map();
    const weaponGeometry = new Set(), weaponTextures = new Map();
    let weapon = null;
    const pivots = {
      body: new T.Group(),
      head: new T.Group(),
      left: new T.Group(),
      right: new T.Group(),
      legL: new T.Group(),
      legR: new T.Group(),
    };
    for (const part of Object.values(pivots)) hip.add(part);
    pivots.head.position.set(0, .64, 0);
    pivots.left.position.set(-.27, .46, 0);
    pivots.right.position.set(.27, .46, 0);
    pivots.legL.position.set(-.115, -.04, 0);
    pivots.legR.position.set(.115, -.04, 0);
    for (const child of model.children) {
      if (child.isSprite || child === model.userData.shield) continue;
      const isWeapon = child === model.userData.gun;
      const replacement = isWeapon && pose?.weapon && (pose.weapon !== model.userData.weapon || pose.finish!==undefined && pose.finish!==child.userData.finish);
      const copy = replacement ? rifle(new T.Group(), pose.weapon, false) : child.clone();
      if (replacement) {
        copy.position.copy(child.position);
        copy.rotation.copy(child.rotation);
        copy.scale.copy(child.scale);
      }
      copy.traverse((node) => {
        if (node.name === "muzzle-flash") node.visible = false;
        if (isWeapon && node.geometry) {
          if (!replacement) node.geometry = node.geometry.clone();
          weaponGeometry.add(node.geometry);
        }
        if (node.material) {
          node.material = [].concat(node.material).map((m) => {
            if (!materials.has(m)) {
              const own = replacement ? m : m.clone();
              own.transparent = true;
              if (isWeapon) {
                for (const key of ["map", "bumpMap"]) {
                  if (!own[key]) continue;
                  if (!weaponTextures.has(own[key])) weaponTextures.set(own[key], replacement ? own[key] : own[key].clone());
                  own[key] = weaponTextures.get(own[key]);
                }
              }
              materials.set(m, own);
            }
            return materials.get(m);
          })[0];
        }
      });
      if (isWeapon) {
        if(pose?.finish!==undefined)setRifleFinish(copy,pose.finish);
        if(replacement)copy.traverse(node=>{if(node.geometry)weaponGeometry.add(node.geometry);for(const mat of [].concat(node.material||[])){if(!materials.has(mat))materials.set(mat,mat);if(mat.map&&!weaponTextures.has(mat.map))weaponTextures.set(mat.map,mat.map);}});
        root.add(copy);
        weapon = { node: copy, start: copy.position.clone(), rotation: copy.rotation.clone() };
        continue;
      }
      const y = child.position.y, x = child.position.x;
      const pivot = y < .73
        ? (x < 0 ? pivots.legL : pivots.legR)
        : y > 1.39
        ? pivots.head
        : Math.abs(x) > .24
        ? (x < 0 ? pivots.left : pivots.right)
        : pivots.body;
      copy.position.y -= .74;
      copy.position.sub(pivot.position);
      pivot.add(copy);
    }
    let floor = 0;
    for (const b of map.boxes) {
      const top = (b.y || 0) + b.h;
      if (
        top <= root.position.y + .02 &&
        Math.abs(root.position.x - b.x) < b.w / 2 &&
        Math.abs(root.position.z - b.z) < b.d / 2
      ) floor = Math.max(floor, top);
    }
    corpses.push({
      root,
      hip,
      pivots,
      weapon,
      fallAxis,
      materials: [...materials.values()],
      weaponGeometry,
      weaponTextures,
      born: now() - age,
      startY: root.position.y,
      floor,
    });
  }
  function update(t) {
    for (let i = corpses.length - 1; i >= 0; i--) {
      const corpse = corpses[i],
        age = t - corpse.born,
        pose = collapsePose(age);
      if (!pose.visible) {
        corpse.root.removeFromParent();
        corpse.materials.forEach((m) => m.dispose());
        corpse.weaponGeometry.forEach((g) => g.dispose());
        corpse.weaponTextures.forEach((texture) => texture.dispose());
        corpses.splice(i, 1);
        continue;
      }
      corpse.hip.position.y = .74 - pose.drop;
      corpse.hip.quaternion.setFromAxisAngle(corpse.fallAxis, pose.tilt);
      corpse.pivots.head.rotation.x = .20 *
        Math.sin(Math.min(1, age / 520) * Math.PI);
      corpse.pivots.left.rotation.z = -pose.arm;
      corpse.pivots.right.rotation.z = pose.arm * .8;
      corpse.pivots.legL.rotation.x = pose.knee;
      corpse.pivots.legR.rotation.x = pose.knee * .65;
      if (corpse.weapon) {
        const { node, start, rotation } = corpse.weapon;
        const settle = Math.min(1, age / 480);
        node.position.set(start.x + settle * .35,
          Math.max(.08, start.y - 6 * Math.pow(age / 1000, 2)), start.z + settle * .2);
        node.rotation.set(rotation.x * (1 - settle), rotation.y + settle * .65,
          rotation.z + (.08 - rotation.z) * settle);
      }
      corpse.root.position.y = Math.max(
        corpse.floor,
        corpse.startY - 10 * Math.pow(age / 1000, 2),
      );
      bounds.setFromObject(corpse.root);
      if (bounds.min.y < corpse.floor) {
        corpse.root.position.y += corpse.floor - bounds.min.y;
      }
      corpse.materials.forEach((m) => m.opacity = pose.opacity);
    }
  }

  return {
    add,
    update,
    dispose() {
      for (const corpse of corpses) {
        corpse.root.removeFromParent();
        corpse.materials.forEach((m) => m.dispose());
        corpse.weaponGeometry.forEach((g) => g.dispose());
        corpse.weaponTextures.forEach((texture) => texture.dispose());
      }
      corpses.length = 0;
    },
  };
}
