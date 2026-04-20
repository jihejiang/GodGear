# GodGear

`GodGear` is a Minecraft Bedrock add-on that adds a small set of overpowered weapons and armor pieces through a behavior pack and a resource pack.

This repository contains:

- `GodGear_BP/`: behavior pack
- `GodGear_RP/`: resource pack

## Features

### Weapons

- `godgear:god_sword`
  Right-click/use to charge and fire a laser attack. Base damage is `8` and the laser has a `7` second cooldown.
- `godgear:god_spear`
  Base damage is `10`. Hitting an entity also calls lightning, deals bonus damage, and applies slowness and weakness.
- `godgear:god_mace`
  Base damage is `12`. Hitting an entity triggers a burst that damages and knocks back nearby entities.

### Armor

- `godgear:god_helmet`
  Armor protection `4`. Grants water breathing while worn.
- `godgear:god_chestplate`
  Armor protection `9`. Grants health boost and resistance while worn.
- `godgear:god_leggings`
  Armor protection `7`. Grants speed while worn. Hold it in hand and use/right-click to toggle the speed effect on or off.
- `godgear:god_boots`
  Armor protection `4`. Grants jump boost while worn. Hold it in hand and use/right-click to toggle the jump boost effect on or off.

All items are configured as effectively unbreakable with very high durability and custom durability prevention.

## Requirements

- Minecraft Bedrock Edition with add-on support
- Minimum engine version: `1.21.0`
- Script dependency: `@minecraft/server` `2.6.0`

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
  textures/item_texture.json
  textures/items/
  manifest.json
AGENTS.md
README.md
```

## Notes

- Item icons are included in the resource pack and mapped through `GodGear_RP/textures/item_texture.json`.
- Armor protection uses native Bedrock armor components.
- Ability logic and armor effects are implemented in `GodGear_BP/scripts/main.js`.

## Development

If you continue maintaining this repository with Codex, project-specific agent guidance lives in [AGENTS.md](./AGENTS.md).
