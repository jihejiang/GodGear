import {
  world,
  system,
  EquipmentSlot,
  EntityComponentTypes
} from "@minecraft/server";

const TICKS = 20;
const cooldowns = new Map();

const IDS = {
  sword: "godgear:god_sword",
  spear: "godgear:god_spear",
  mace: "godgear:god_mace",
  helmet: "godgear:god_helmet",
  chestplate: "godgear:god_chestplate",
  leggings: "godgear:god_leggings",
  boots: "godgear:god_boots"
};

const TOGGLE_TAGS = {
  jumpDisabled: "godgear:jump_disabled",
  speedDisabled: "godgear:speed_disabled"
};

function send(player, text) {
  try { player.sendMessage(text); } catch {}
}
function now() { return system.currentTick; }
function cdKey(player, key) { return `${player.id}:${key}`; }
function setCooldown(player, key, seconds) {
  cooldowns.set(cdKey(player, key), now() + seconds * TICKS);
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
function setToggle(player, disabledTag, enabled) {
  try {
    if (enabled) {
      player.removeTag(disabledTag);
    } else {
      player.addTag(disabledTag);
    }
  } catch {}
}
function getToggle(player, disabledTag, fallback = true) {
  try {
    return !player.hasTag(disabledTag);
  } catch {
    return fallback;
  }
}
function eq(player) {
  return player.getComponent(EntityComponentTypes.Equippable) ?? player.getComponent("minecraft:equippable");
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
  const m = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
  if (m < 0.0001) return {x:0,y:0,z:0};
  return {x:v.x/m,y:v.y/m,z:v.z/m};
}
function add(a, b) {
  return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};
}
function mul(v, s) {
  return {x:v.x*s,y:v.y*s,z:v.z*s};
}
function dot(a, b) {
  return a.x*b.x + a.y*b.y + a.z*b.z;
}
function distance(a, b) {
  const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}
function horizontalDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const mag = Math.sqrt(dx * dx + dz * dz);
  if (mag < 0.0001) return { x: 0, z: 1 };
  return { x: dx / mag, z: dz / mag };
}
function particle(player, name, pos) {
  try { player.dimension.spawnParticle(name, pos); } catch {}
}
function sound(player, name, pos) {
  try { player.dimension.playSound(name, pos ?? player.location); } catch {}
}
function nearestTargetInSight(player, maxDistance=24, minDot=0.95) {
  if (!isValidEntity(player)) return undefined;
  const from = player.getHeadLocation();
  const look = normalize(player.getViewDirection());
  let best = undefined;
  let bestDist = Infinity;
  const entities = player.dimension.getEntities({
    location: player.location,
    maxDistance,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const entity of entities) {
    if (entity.id === player.id) continue;
    if (!entity.isValid()) continue;
    const targetPos = {x:entity.location.x, y:entity.location.y+1, z:entity.location.z};
    const toTarget = normalize({x:targetPos.x-from.x, y:targetPos.y-from.y, z:targetPos.z-from.z});
    if (dot(look, toTarget) < minDot) continue;
    const d = distance(from, targetPos);
    if (d < bestDist) {
      bestDist = d;
      best = entity;
    }
  }
  return best;
}
function drawLaser(player, length=24) {
  if (!isValidEntity(player)) return;
  const start = player.getHeadLocation();
  const dir = normalize(player.getViewDirection());
  for (let i=1;i<=length*2;i++) {
    const pos = add(start, mul(dir, i*0.5));
    particle(player, "minecraft:electric_spark_particle", pos);
    particle(player, "minecraft:basic_flame_particle", pos);
  }
}
function fireSwordLaser(player) {
  if (!isValidEntity(player)) return;
  drawLaser(player, 24);
  sound(player, "random.orb", player.location);
  const target = nearestTargetInSight(player, 24, 0.96);
  if (!target) return;
  try { target.applyDamage(16, { damagingEntity: player, cause: "magic" }); } catch {}
  try { target.setOnFire(3, true); } catch {}
  sound(player, "random.explode", target.location);
}
function startSwordCharge(player) {
  if (!isValidEntity(player)) return;
  if (onCooldown(player, "sword")) {
    send(player, `§eSword cooldown: ${secondsLeft(player, "sword")}s`);
    return;
  }
  setCooldown(player, "sword", 7);
  send(player, "§fCharging God Sword...");
  sound(player, "random.fizz", player.location);
  for (let i=1;i<=10;i++) {
    system.runTimeout(() => {
      if (!isValidEntity(player)) return;
      const base = player.getHeadLocation();
      particle(player, "minecraft:electric_spark_particle", {x:base.x+0.2,y:base.y,z:base.z});
      particle(player, "minecraft:electric_spark_particle", {x:base.x-0.2,y:base.y,z:base.z});
    }, i*2);
  }
  system.runTimeout(() => fireSwordLaser(player), 20);
}
function spearStrike(attacker, target) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  const x = Math.floor(target.location.x);
  const y = Math.floor(target.location.y);
  const z = Math.floor(target.location.z);
  try { attacker.dimension.runCommand(`summon lightning_bolt ${x} ${y} ${z}`); } catch {}
  try { target.applyDamage(6, { damagingEntity: attacker, cause: "lightning" }); } catch {}
  try { target.addEffect("slowness", 40, { amplifier: 10, showParticles: true }); } catch {}
  try { target.addEffect("weakness", 40, { amplifier: 2, showParticles: false }); } catch {}
  sound(attacker, "ambient.weather.lightning.impact", target.location);
}
function maceBurst(attacker, target) {
  if (!isValidEntity(attacker) || !isValidEntity(target)) return;
  sound(attacker, "random.explode", target.location);
  const nearby = target.dimension.getEntities({
    location: target.location,
    maxDistance: 3.5,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
  });
  for (const e of nearby) {
    if (!isValidEntity(e) || e.id === attacker.id) continue;
    const dir = horizontalDirection(attacker.location, e.location);
    try { e.applyKnockback(dir.x, dir.z, 1.4, 0.45); } catch {}
    if (e.id === target.id) {
      try { e.applyDamage(6, { damagingEntity: attacker, cause: "entityAttack" }); } catch {}
    } else {
      try { e.applyDamage(4, { damagingEntity: attacker, cause: "entityAttack" }); } catch {}
    }
  }
}
function armorEffects(player) {
  if (!isValidEntity(player)) return;
  const armor = getArmor(player);
  if (armor.head?.typeId === IDS.helmet) {
    try { player.addEffect("water_breathing", 40, { amplifier: 0, showParticles: false }); } catch {}
  }
  if (armor.chest?.typeId === IDS.chestplate) {
    try { player.addEffect("health_boost", 40, { amplifier: 1, showParticles: false }); } catch {}
    try { player.addEffect("resistance", 40, { amplifier: 0, showParticles: false }); } catch {}
  }
  if (armor.legs?.typeId === IDS.leggings && getToggle(player, TOGGLE_TAGS.speedDisabled, true)) {
    try { player.addEffect("speed", 40, { amplifier: 4, showParticles: false }); } catch {}
  }
  if (armor.feet?.typeId === IDS.boots && getToggle(player, TOGGLE_TAGS.jumpDisabled, true)) {
    try { player.addEffect("jump_boost", 40, { amplifier: 4, showParticles: false }); } catch {}
  }
}

system.beforeEvents.startup.subscribe((event) => {
  const reg = event.itemComponentRegistry;
  reg.registerCustomComponent("godgear:unbreakable", {
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
  reg.registerCustomComponent("godgear:sword_laser", {
    onUse(e) {
      startSwordCharge(e.source);
    },
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
  reg.registerCustomComponent("godgear:mace_burst", {
    onHitEntity(e) {
      maceBurst(e.attackingEntity, e.hitEntity);
    },
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
  reg.registerCustomComponent("godgear:toggle_jump", {
    onUse(e) {
      const next = !getToggle(e.source, TOGGLE_TAGS.jumpDisabled, true);
      setToggle(e.source, TOGGLE_TAGS.jumpDisabled, next);
      send(e.source, next ? "§aJump boost ON" : "§eJump boost OFF");
    },
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
  reg.registerCustomComponent("godgear:toggle_speed", {
    onUse(e) {
      const next = !getToggle(e.source, TOGGLE_TAGS.speedDisabled, true);
      setToggle(e.source, TOGGLE_TAGS.speedDisabled, next);
      send(e.source, next ? "§aSpeed ON" : "§eSpeed OFF");
    },
    onBeforeDurabilityDamage(e) {
      e.durabilityDamage = 0;
    }
  });
});

world.afterEvents.entityHitEntity.subscribe((e) => {
  const attacker = e.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  const item = getMainhand(attacker);
  if (!item) return;
  if (item.typeId === IDS.spear) spearStrike(attacker, e.hitEntity);
});

system.runInterval(() => {
  if (cooldowns.size > 0) {
    for (const [key, value] of cooldowns.entries()) {
      if (value <= now()) cooldowns.delete(key);
    }
  }
  for (const player of world.getAllPlayers()) {
    armorEffects(player);
  }
}, 10);
