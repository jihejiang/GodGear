import {
  world,
  system,
  EquipmentSlot,
  EntityComponentTypes,
  ItemComponentTypes,
  EnchantmentTypes
} from "@minecraft/server";

const TICKS = 20;
const cooldowns = new Map();
const frozenTargets = new Map();

const IDS = {
  sword: "godgear:god_sword",
  spear: "godgear:god_spear",
  mace: "godgear:god_mace",
  helmet: "godgear:god_helmet",
  chestplate: "godgear:god_chestplate",
  leggings: "godgear:god_leggings",
  boots: "godgear:god_boots"
};

const ENCHANTS = {
  sword: [
    ["minecraft:sharpness", 10],
    ["minecraft:fire_aspect", 10],
    ["minecraft:looting", 10]
  ],
  spear: [
    ["minecraft:sharpness", 10],
    ["minecraft:fire_aspect", 10],
    ["minecraft:looting", 10],
    ["minecraft:knockback", 10],
    ["minecraft:lunge", 10]
  ],
  mace: [
    ["minecraft:density", 10],
    ["minecraft:wind_burst", 3],
    ["minecraft:breach", 10]
  ],
  armor: [
    ["minecraft:protection", 10],
    ["minecraft:thorns", 10]
  ]
};

function send(player, text) {
  try {
    player.sendMessage(text);
  } catch {}
}

function now() {
  return system.currentTick;
}

function cdKey(player, key) {
  return `${player.id}:${key}`;
}

function setCooldown(player, key, seconds) {
  cooldowns.set(cdKey(player, key), now() + Math.floor(seconds * TICKS));
}

function onCooldown(player, key) {
  return (cooldowns.get(cdKey(player, key)) ?? 0) > now();
}

function secondsLeft(player, key) {
  const end = cooldowns.get(cdKey(player, key)) ?? 0;
  return Math.max(0, Math.ceil((end - now()) / TICKS));
}

function isValidEntity(entity) {
  try {
    return !!entity?.isValid();
  } catch {
    return false;
  }
}

function eq(player) {
  return (
    player.getComponent(EntityComponentTypes.Equippable) ??
    player.getComponent("minecraft:equippable")
  );
}

function inv(player) {
  return (
    player.getComponent(EntityComponentTypes.Inventory) ??
    player.getComponent("minecraft:inventory")
  );
}

function getMainhand(player) {
  const e = eq(player);
  return e ? e.getEquipment(EquipmentSlot.Mainhand) : undefined;
}

function getArmor(player) {
  const e = eq(player);
  if (!e) return {};
  return {
    head: e.getEquipment(EquipmentSlot.Head),
    chest: e.getEquipment(EquipmentSlot.Chest),
    legs: e.getEquipment(EquipmentSlot.Legs),
    feet: e.getEquipment(EquipmentSlot.Feet)
  };
}

function normalize(v) {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < 0.0001) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function mul(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function horizontalDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const mag = Math.sqrt(dx * dx + dz * dz);
  if (mag < 0.0001) return { x: 0, z: 1 };
  return { x: dx / mag, z: dz / mag };
}

function particle(player, name, pos) {
  try {
    player.dimension.spawnParticle(name, pos);
  } catch {}
}

function sound(player, name, pos) {
  try {
    player.dimension.playSound(name, pos ?? player.location);
  } catch {}
}

function nearestTargetInSight(player, maxDistance = 18, minDot = 0.7) {
  if (!isValidEntity(player)) return undefined;
  const from = player.getHeadLocation();
  const look = normalize(player.getViewDirection());
  let best;
  let bestDist = Infinity;
  const entities = player.dimension.getEntities({
    location: player.location,
    maxDistance,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const entity of entities) {
    if (!isValidEntity(entity) || entity.id === player.id) continue;
    const targetPos = { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z };
    const toTarget = normalize({
      x: targetPos.x - from.x,
      y: targetPos.y - from.y,
      z: targetPos.z - from.z
    });
    if (dot(look, toTarget) < minDot) continue;
    const d = distance(from, targetPos);
    if (d < bestDist) {
      bestDist = d;
      best = entity;
    }
  }
  return best;
}

function entitiesInFront(player, maxDistance = 18, minDot = 0.55) {
  if (!isValidEntity(player)) return [];
  const from = player.getHeadLocation();
  const look = normalize(player.getViewDirection());
  const found = [];
  const entities = player.dimension.getEntities({
    location: player.location,
    maxDistance,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const entity of entities) {
    if (!isValidEntity(entity) || entity.id === player.id) continue;
    const targetPos = { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z };
    const toTarget = normalize({
      x: targetPos.x - from.x,
      y: targetPos.y - from.y,
      z: targetPos.z - from.z
    });
    if (dot(look, toTarget) < minDot) continue;
    found.push({ entity, distance: distance(from, targetPos) });
  }
  found.sort((a, b) => a.distance - b.distance);
  return found.map((entry) => entry.entity);
}

function drawSwordBeam(player, length = 18) {
  const start = player.getHeadLocation();
  const dir = normalize(player.getViewDirection());
  for (let i = 1; i <= length * 2; i++) {
    const pos = add(start, mul(dir, i * 0.5));
    particle(player, "minecraft:electric_spark_particle", pos);
    if (i % 2 === 0) particle(player, "minecraft:basic_flame_particle", pos);
  }
}

function drawSpearPyramids(player, length = 8) {
  const start = add(player.getHeadLocation(), mul(normalize(player.getViewDirection()), 0.6));
  const dir = normalize(player.getViewDirection());
  for (let step = 0; step < length; step++) {
    const center = add(start, mul(dir, step * 0.8));
    const width = Math.max(0, 2 - Math.floor(step / 3));
    for (let y = 0; y <= width; y++) {
      const layer = width - y;
      for (let x = -layer; x <= layer; x++) {
        const pos = {
          x: center.x + x * 0.12,
          y: center.y - 0.2 + y * 0.16,
          z: center.z
        };
        particle(player, "minecraft:electric_spark_particle", pos);
      }
    }
  }
}

function drawSpearLine(attacker, target) {
  const from = attacker.getHeadLocation();
  const to = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  const dir = normalize({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z });
  const len = Math.min(10, Math.max(4, Math.floor(distance(from, to))));
  for (let i = 1; i <= len; i++) {
    const center = add(from, mul(dir, i * 0.7));
    const half = Math.max(0.05, 0.18 - i * 0.01);
    particle(attacker, "minecraft:electric_spark_particle", center);
    particle(attacker, "minecraft:basic_flame_particle", { x: center.x + half, y: center.y, z: center.z });
    particle(attacker, "minecraft:basic_flame_particle", { x: center.x - half, y: center.y, z: center.z });
    particle(attacker, "minecraft:basic_flame_particle", { x: center.x, y: center.y + half, z: center.z });
  }
}

function applyDamage(target, amount, attacker, cause = "entityAttack") {
  try {
    target.applyDamage(amount, { damagingEntity: attacker, cause });
  } catch {}
}

function setFire(target, seconds = 4) {
  try {
    target.setOnFire(seconds, true);
  } catch {}
}

function freezeTarget(target, seconds = 3) {
  if (!isValidEntity(target)) return;
  frozenTargets.set(target.id, {
    entity: target,
    location: { x: target.location.x, y: target.location.y, z: target.location.z },
    untilTick: now() + seconds * TICKS
  });
}

function thornsDamage(player) {
  const armor = getArmor(player);
  let pieces = 0;
  if (armor.head?.typeId === IDS.helmet) pieces++;
  if (armor.chest?.typeId === IDS.chestplate) pieces++;
  if (armor.legs?.typeId === IDS.leggings) pieces++;
  if (armor.feet?.typeId === IDS.boots) pieces++;
  return pieces;
}

function fullSetEquipped(player) {
  const armor = getArmor(player);
  return (
    armor.head?.typeId === IDS.helmet &&
    armor.chest?.typeId === IDS.chestplate &&
    armor.legs?.typeId === IDS.leggings &&
    armor.feet?.typeId === IDS.boots
  );
}

function fireSwordBeam(player) {
  if (!isValidEntity(player)) return;
  drawSwordBeam(player, 18);
  sound(player, "random.orb", player.location);
  const targets = entitiesInFront(player, 18, 0.56).slice(0, 4);
  for (const target of targets) {
    applyDamage(target, 12, player, "magic");
    setFire(target, 5);
    sound(player, "random.explode", target.location);
  }
}

function spearLunge(player, power = 2.2) {
  if (!isValidEntity(player)) return;
  const dir = normalize(player.getViewDirection());
  try {
    player.applyKnockback(dir.x, dir.z, power, 0.12);
  } catch {}
}

function spearHit(attacker, target, bonusDamage = 6) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  drawSpearLine(attacker, target);
  applyDamage(target, bonusDamage, attacker);
  setFire(target, 4);
  freezeTarget(target, 3);
  try {
    target.addEffect("weakness", 60, { amplifier: 4, showParticles: false });
  } catch {}
  sound(attacker, "random.orb", target.location);
}

function spearUse(player) {
  if (!isValidEntity(player)) return;
  spearLunge(player, 2.6);
  drawSpearPyramids(player, 8);
  sound(player, "random.orb", player.location);
  const target = nearestTargetInSight(player, 10, 0.58);
  if (target) spearHit(player, target, 8);
}

function maceSmash(attacker, target) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  let smashBonus = 6;
  try {
    const v = attacker.getVelocity();
    if (v.y < -0.35) {
      smashBonus += Math.min(10, Math.floor(Math.abs(v.y) * 6));
    }
  } catch {}
  sound(attacker, "random.explode", target.location);
  applyDamage(target, smashBonus, attacker);
  const nearby = target.dimension.getEntities({
    location: target.location,
    maxDistance: 3.5,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const entity of nearby) {
    if (!isValidEntity(entity) || entity.id === attacker.id) continue;
    const dir = horizontalDirection(target.location, entity.location);
    try {
      entity.applyKnockback(dir.x, dir.z, 1.6, 0.45);
    } catch {}
    if (entity.id !== target.id) applyDamage(entity, 3, attacker);
  }
}

function ensureEnchantments(itemStack, definitions) {
  if (!itemStack || !definitions?.length) return false;
  const enchantable =
    itemStack.getComponent(ItemComponentTypes.Enchantable) ??
    itemStack.getComponent("minecraft:enchantable");
  if (!enchantable?.addEnchantment) return false;
  let changed = false;
  for (const [id, requestedLevel] of definitions) {
    const type = EnchantmentTypes.get(id);
    if (!type) continue;
    const level = Math.max(1, Math.min(requestedLevel, type.maxLevel ?? requestedLevel));
    try {
      const current = enchantable.getEnchantment?.(type);
      if (current?.level >= level) continue;
    } catch {}
    try {
      enchantable.addEnchantment({ type, level });
      changed = true;
    } catch {}
  }
  return changed;
}

function updateEquipmentEnchant(player, slot, definitions) {
  const e = eq(player);
  if (!e) return;
  const item = e.getEquipment(slot);
  if (!item) return;
  if (ensureEnchantments(item, definitions)) {
    try {
      e.setEquipment(slot, item);
    } catch {}
  }
}

function updateSelectedItemEnchant(player) {
  const item = getMainhand(player);
  const e = eq(player);
  if (!item || !e) return;
  let definitions;
  if (item.typeId === IDS.sword) definitions = ENCHANTS.sword;
  if (item.typeId === IDS.spear) definitions = ENCHANTS.spear;
  if (item.typeId === IDS.mace) definitions = ENCHANTS.mace;
  if (!definitions) return;
  if (ensureEnchantments(item, definitions)) {
    try {
      e.setEquipment(EquipmentSlot.Mainhand, item);
    } catch {}
  }
}

function updateInventoryWeaponEnchants(player) {
  const inventory = inv(player);
  const container = inventory?.container;
  if (!container) return;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    let definitions;
    if (item.typeId === IDS.sword) definitions = ENCHANTS.sword;
    if (item.typeId === IDS.spear) definitions = ENCHANTS.spear;
    if (item.typeId === IDS.mace) definitions = ENCHANTS.mace;
    if (!definitions) continue;
    if (ensureEnchantments(item, definitions)) {
      try {
        container.setItem(i, item);
      } catch {}
    }
  }
}

function keepGodGearReady(player) {
  updateSelectedItemEnchant(player);
  updateInventoryWeaponEnchants(player);
  updateEquipmentEnchant(player, EquipmentSlot.Head, ENCHANTS.armor);
  updateEquipmentEnchant(player, EquipmentSlot.Chest, ENCHANTS.armor);
  updateEquipmentEnchant(player, EquipmentSlot.Legs, ENCHANTS.armor);
  updateEquipmentEnchant(player, EquipmentSlot.Feet, ENCHANTS.armor);
}

function armorEffects(player) {
  if (!isValidEntity(player)) return;
  const armor = getArmor(player);
  if (armor.head?.typeId === IDS.helmet) {
    try {
      player.addEffect("water_breathing", 40, { amplifier: 0, showParticles: false });
    } catch {}
  }
  if (armor.chest?.typeId === IDS.chestplate) {
    try {
      player.addEffect("health_boost", 40, { amplifier: 4, showParticles: false });
    } catch {}
  }
  if (armor.legs?.typeId === IDS.leggings) {
    try {
      player.addEffect("speed", 40, { amplifier: 3, showParticles: false });
    } catch {}
  }
  if (armor.feet?.typeId === IDS.boots) {
    try {
      player.addEffect("jump_boost", 40, { amplifier: 3, showParticles: false });
    } catch {}
  }
  if (fullSetEquipped(player)) {
    try {
      player.addEffect("resistance", 40, { amplifier: 1, showParticles: false });
    } catch {}
  }
}

function keepFrozenTargetsLocked() {
  if (frozenTargets.size === 0) return;
  for (const [id, frozen] of frozenTargets.entries()) {
    if (!isValidEntity(frozen.entity) || frozen.untilTick <= now()) {
      frozenTargets.delete(id);
      continue;
    }
    try {
      frozen.entity.teleport(frozen.location, { checkForBlocks: false });
    } catch {
      try {
        frozen.entity.teleport(frozen.location);
      } catch {}
    }
  }
}

system.beforeEvents.startup.subscribe((event) => {
  const reg = event.itemComponentRegistry;
  reg.registerCustomComponent("godgear:unbreakable", {
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
});

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || player.typeId !== "minecraft:player" || !item) return;
  if (item.typeId === IDS.sword) {
    if (onCooldown(player, "sword")) {
      send(player, `§eSword cooldown: ${secondsLeft(player, "sword")}s`);
      return;
    }
    setCooldown(player, "sword", 1.25);
    fireSwordBeam(player);
    return;
  }
  if (item.typeId === IDS.spear) {
    if (onCooldown(player, "spear")) return;
    setCooldown(player, "spear", 0.6);
    spearUse(player);
  }
});

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  const item = getMainhand(attacker);
  if (!item) return;
  if (item.typeId === IDS.sword) {
    setFire(event.hitEntity, 5);
    return;
  }
  if (item.typeId === IDS.spear) {
    spearLunge(attacker, 1.8);
    spearHit(attacker, event.hitEntity, 6);
    return;
  }
  if (item.typeId === IDS.mace) {
    maceSmash(attacker, event.hitEntity);
  }
});

world.afterEvents.entityHurt.subscribe((event) => {
  const player = event.hurtEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const thorns = thornsDamage(player);
  if (thorns <= 0) return;
  const attacker = event.damageSource?.damagingEntity;
  if (!isValidEntity(attacker)) return;
  applyDamage(attacker, thorns + 1, player, "thorns");
});

system.runInterval(() => {
  for (const [key, value] of cooldowns.entries()) {
    if (value <= now()) cooldowns.delete(key);
  }
}, 5);

system.runInterval(() => {
  keepFrozenTargetsLocked();
}, 1);

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    keepGodGearReady(player);
    armorEffects(player);
  }
}, 10);
