# GodGear

`GodGear` is a Minecraft Bedrock add-on that adds a small set of overpowered weapons and armor pieces through a behavior pack and a resource pack.

This repository contains:

- `GodGear_BP/`: behavior pack
- `GodGear_RP/`: resource pack

## Features

### Weapons

- `godgear:god_sword`
  Right-click to fire a long-range beam (1.25s cooldown). Left-click ignites the target. Sharpness X / Fire Aspect X / Looting X (script-simulated above vanilla caps).
- `godgear:god_spear`
  Right-click or left-click triggers a forward Lunge dash. Hits set the target on fire, freeze them in place for 3s, apply Weakness, and shove them back. Sharpness X / Fire Aspect X / Looting X / Knockback X / Lunge X.
- `godgear:god_mace`
  Left-click smashes the target with a wind shockwave (gust ring + dust pillar particles). Damage scales with downward velocity (Density X). Hits also deal armor-bypassing magic damage (Breach X). Smashing while falling launches the attacker high upward (Wind Burst X).

### Armor

- `godgear:god_helmet` — Protection 4, grants Water Breathing while worn.
- `godgear:god_chestplate` — Protection 9, grants Health Boost while worn.
- `godgear:god_leggings` — Protection 7, grants Speed while worn.
- `godgear:god_boots` — Protection 4, grants Jump Boost while worn.
- All four worn together grants Resistance + Fire Resistance (Protection X / Thorns X simulated).

All items are effectively unbreakable (durability damage zero via custom component).

### Zecra-style OP enchantments

The script applies every relevant vanilla enchantment up to its real maximum (engine-enforced), then layers on additional damage / reduction logic to make the displayed `X` levels actually feel meaningful — including conflicting enchant pairs like Density + Breach on the mace, which are normally mutually exclusive in vanilla.

## Requirements

- Minecraft Bedrock Edition with add-on support
- Minimum engine version: `1.21.100`
- Script dependency: `@minecraft/server` `2.6.0`
- Item format version: `1.21.100`

## Installation

1. Import both packs into Minecraft Bedrock:
   - `GodGear_BP`
   - `GodGear_RP`
2. Enable both packs on the world.
3. Make sure script support is enabled for the world if your Bedrock setup requires it.

## Give Commands

```mcfunction
/give @s godgear:god_sword
/give @s godgear:god_spear
/give @s godgear:god_mace
/give @s godgear:god_helmet
/give @s godgear:god_chestplate
/give @s godgear:god_leggings
/give @s godgear:god_boots
```

## Repository Layout

```text
GodGear_BP/
  items/
  scripts/main.js
  manifest.json
GodGear_RP/
  attachables/
  textures/item_texture.json
  textures/items/
  textures/models/armor/
  manifest.json
AGENTS.md
README.md
```

## Notes

- Item icons are mapped through `GodGear_RP/textures/item_texture.json` and reference the new `minecraft:icon { textures: { default: ... } }` format required by recent Bedrock versions.
- Worn armor models use `GodGear_RP/attachables/*.player.json` with `god_1.png` (head/chest/feet) and `god_2.png` (legs).
- Ability logic, Lunge dash, mace shockwave, and OP enchantment simulation live in `GodGear_BP/scripts/main.js`.

## Development

If you continue maintaining this repository with Codex, project-specific agent guidance lives in [AGENTS.md](./AGENTS.md).
