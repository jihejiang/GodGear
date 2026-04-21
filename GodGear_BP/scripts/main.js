import {
  world,
  system,
  EquipmentSlot,
  EntityComponentTypes,
  ItemComponentTypes,
  EnchantmentTypes,
  EntitySwingSource
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
    ["minecraft:looting", 10],
    ["minecraft:knockback", 10]
  ],
  mace: [
    ["minecraft:density", 5],
    ["minecraft:wind_burst", 3],
    ["minecraft:breach", 4]
  ],
  armor: [
    ["minecraft:protection", 10],
    ["minecraft:thorns", 10]
  ]
};

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

function isValidEntity(entity) {
  if (!entity) return false;
  try {
    const value = entity.isValid;
    if (typeof value === "function") return !!value.call(entity);
    return !!value;
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

function nearestTargetInSight(player, maxDistance = 10, minDot = 0.55) {
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

function entitiesInFront(player, maxDistance = 14, minDot = 0.58) {
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

function applyDamage(target, amount, attacker, cause = "entityAttack") {
  try {
    target.applyDamage(amount, { damagingEntity: attacker, cause });
  } catch {}
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

function setEquippedIfChanged(player, slot, definitions) {
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

function updateInventoryEnchants(player) {
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

function keepItemsUpdated(player) {
  updateInventoryEnchants(player);
  const held = getMainhand(player);
  const e = eq(player);
  if (held && e) {
    let definitions;
    if (held.typeId === IDS.sword) definitions = ENCHANTS.sword;
    if (held.typeId === IDS.spear) definitions = ENCHANTS.spear;
    if (held.typeId === IDS.mace) definitions = ENCHANTS.mace;
    if (definitions && ensureEnchantments(held, definitions)) {
      try {
        e.setEquipment(EquipmentSlot.Mainhand, held);
      } catch {}
    }
  }
  setEquippedIfChanged(player, EquipmentSlot.Head, ENCHANTS.armor);
  setEquippedIfChanged(player, EquipmentSlot.Chest, ENCHANTS.armor);
  setEquippedIfChanged(player, EquipmentSlot.Legs, ENCHANTS.armor);
  setEquippedIfChanged(player, EquipmentSlot.Feet, ENCHANTS.armor);
}

function drawSwordBeam(player) {
  const start = player.getHeadLocation();
  const dir = normalize(player.getViewDirection());
  for (let i = 1; i <= 28; i++) {
    particle(player, "minecraft:electric_spark_particle", add(start, mul(dir, i * 0.45)));
  }
}

function swordBeam(player) {
  drawSwordBeam(player);
  sound(player, "random.orb", player.location);
  const targets = entitiesInFront(player, 14, 0.56).slice(0, 4);
  for (const target of targets) {
    applyDamage(target, 9, player, "magic");
    try {
      target.setOnFire(5, true);
    } catch {}
  }
}

function drawFreezeTrail(player, count = 10) {
  const start = player.getHeadLocation();
  const dir = normalize(player.getViewDirection());
  for (let i = 1; i <= count; i++) {
    particle(player, "minecraft:electric_spark_particle", add(start, mul(dir, i * 0.35)));
  }
}

function freezeTarget(target, seconds = 3) {
  if (!isValidEntity(target)) return;
  frozenTargets.set(target.id, {
    entity: target,
    location: { x: target.location.x, y: target.location.y, z: target.location.z },
    until: now() + seconds * TICKS
  });
}

function spearFreezeHit(attacker, target, damage = 6) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  drawFreezeTrail(attacker, 12);
  applyDamage(target, damage, attacker);
  freezeTarget(target, 3);
  try {
    target.addEffect("slowness", 60, { amplifier: 255, showParticles: false });
  } catch {}
  try {
    target.addEffect("weakness", 60, { amplifier: 2, showParticles: false });
  } catch {}
}

function spearLunge(player) {
  const dir = normalize(player.getViewDirection());
  try {
    player.applyKnockback(dir.x, dir.z, 2.4, 0.15);
  } catch {}
  drawFreezeTrail(player, 8);
  const target = nearestTargetInSight(player, 5, 0.45);
  if (target) spearFreezeHit(player, target, 7);
}

function spearChargeAttack(player) {
  drawFreezeTrail(player, 14);
  const target = nearestTargetInSight(player, 8, 0.5);
  if (target) spearFreezeHit(player, target, 6);
}

function groundBurstParticles(player, location) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 3) continue;
      const pos = { x: location.x + dx + 0.5, y: location.y + 0.1, z: location.z + dz + 0.5 };
      particle(player, "minecraft:basic_smoke_particle", pos);
      particle(player, "minecraft:electric_spark_particle", pos);
    }
  }
}

function maceSmash(attacker, target) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  let falling = false;
  try {
    falling = attacker.getVelocity().y < -0.65;
  } catch {}
  if (!falling) return;
  const location = {
    x: Math.floor(target.location.x),
    y: Math.floor(target.location.y),
    z: Math.floor(target.location.z)
  };
  groundBurstParticles(attacker, location);
  sound(attacker, "random.explode", target.location);
  applyDamage(target, 10, attacker);
  const nearby = target.dimension.getEntities({
    location: target.location,
    maxDistance: 3.5,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const entity of nearby) {
    if (!isValidEntity(entity) || entity.id === attacker.id) continue;
    const push = normalize({
      x: entity.location.x - target.location.x,
      y: 0,
      z: entity.location.z - target.location.z
    });
    try {
      entity.applyKnockback(push.x || 0, push.z || 1, 1.7, 0.5);
    } catch {}
    if (entity.id !== target.id) applyDamage(entity, 4, attacker);
  }
}

function armorEffects(player) {
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
      player.addEffect("speed", 40, { amplifier: 2, showParticles: false });
    } catch {}
  }
  if (armor.feet?.typeId === IDS.boots) {
    try {
      player.addEffect("jump_boost", 40, { amplifier: 2, showParticles: false });
    } catch {}
  }
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || player.typeId !== "minecraft:player" || !item) return;
  if (item.typeId !== IDS.sword) return;
  if (onCooldown(player, "sword")) return;
  setCooldown(player, "sword", 1.25);
  swordBeam(player);
});

world.afterEvents.itemReleaseUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item || item.typeId !== IDS.spear) return;
  if (onCooldown(player, "spear_use")) return;
  setCooldown(player, "spear_use", 0.35);
  spearChargeAttack(player);
});

world.afterEvents.playerSwingStart.subscribe((event) => {
  const player = event.player;
  const item = event.heldItemStack;
  if (!player || !item) return;
  if (event.swingSource !== EntitySwingSource.Attack) return;
  if (item.typeId !== IDS.spear) return;
  if (onCooldown(player, "spear_lunge")) return;
  setCooldown(player, "spear_lunge", 0.5);
  spearLunge(player);
});

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  const item = getMainhand(attacker);
  if (!item) return;
  if (item.typeId === IDS.spear) {
    spearFreezeHit(attacker, event.hitEntity, 6);
    return;
  }
  if (item.typeId === IDS.mace) {
    maceSmash(attacker, event.hitEntity);
  }
});

system.runInterval(() => {
  for (const [key, endTick] of cooldowns.entries()) {
    if (endTick <= now()) cooldowns.delete(key);
  }
  for (const [id, frozen] of frozenTargets.entries()) {
    if (!isValidEntity(frozen.entity) || frozen.until <= now()) {
      frozenTargets.delete(id);
      continue;
    }
    try {
      frozen.entity.teleport(frozen.location, { checkForBlocks: false });
    } catch {}
  }
}, 1);

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    keepItemsUpdated(player);
    armorEffects(player);
  }
}, 10);
