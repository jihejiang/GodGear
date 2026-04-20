# GodGear Agent Guide

This repository is a Minecraft Bedrock add-on split into two packs:

- `GodGear_BP/`: behavior pack
- `GodGear_RP/`: resource pack

Use this file as the operating guide when updating the add-on with Codex or other coding agents.

## Goals

- Keep the add-on playable in current Bedrock versions targeted by the manifests.
- Preserve existing item identifiers under the `godgear:` namespace unless a rename is explicitly requested.
- Favor reliable, simple Bedrock-compatible implementations over clever abstractions.
- When fixing issues, prefer end-to-end fixes: item JSON, script logic, and resource pack assets must stay in sync.

## Project Layout

- `GodGear_BP/items/*.json`: custom item definitions
- `GodGear_BP/scripts/main.js`: runtime behavior for custom item abilities and armor effects
- `GodGear_BP/manifest.json`: behavior pack metadata and script dependency
- `GodGear_RP/textures/item_texture.json`: item texture mapping
- `GodGear_RP/textures/items/*.png`: item icons
- `GodGear_RP/manifest.json`: resource pack metadata

## Working Rules

- Do not change pack UUIDs unless the user explicitly asks for new packs.
- Do not rename item identifiers such as `godgear:god_sword` unless the user explicitly asks for a breaking change.
- Keep behavior pack item definitions and resource pack texture keys aligned.
- If an item is meant to be usable on right click, make sure its components actually allow `onUse` behavior to trigger.
- If armor is meant to provide defense, use native armor components instead of script-only effects.
- Prefer Bedrock features that degrade safely when unavailable.
- Avoid adding dependencies beyond `@minecraft/server` unless the user asks for them.

## Script Conventions

- Keep all gameplay logic in `GodGear_BP/scripts/main.js` unless the code becomes large enough to justify a split.
- Before using delayed callbacks or event-driven logic, guard against invalid entities.
- Favor small helper functions for repeated Bedrock API patterns.
- Wrap risky Bedrock API calls in `try/catch` when runtime failure is plausible.
- Use player tags for lightweight persistent toggles unless there is a strong reason to introduce dynamic properties.
- Clean up temporary runtime state like cooldown maps when practical.

## Item Update Checklist

When editing or adding an item, verify all matching pieces:

1. The item JSON exists in `GodGear_BP/items/`.
2. The `identifier` uses the `godgear:` namespace.
3. The icon key matches `GodGear_RP/textures/item_texture.json`.
4. The referenced PNG exists in `GodGear_RP/textures/items/`.
5. Any custom component named in the item JSON is registered in `scripts/main.js`.
6. Armor items include `minecraft:wearable` and `minecraft:armor` when they should provide protection.
7. Weapons have sane base damage and any special ability is still usable after changes.

## Validation Expectations

After changes, always do local validation before handing work back:

- Parse all edited JSON files to ensure they are valid.
- Confirm texture files exist and are not placeholder-size images unless the user explicitly wants placeholders.
- Re-read changed item files and `main.js` for identifier mismatches.
- If a change affects gameplay, describe what the user should test in-game.

## Safe Change Policy

- Do not remove existing abilities, effects, or item IDs without explicit approval.
- Do not overwrite user-authored art with generated placeholders unless the user asked for replacement.
- If the current behavior is unclear, inspect the whole feature path before patching.
- If you find multiple related defects, fix them together instead of only patching the first visible symptom.

## Preferred Response Style For Future Agents

- Start by inspecting the relevant files before proposing changes.
- Make concrete fixes directly when the intent is clear.
- Summarize root cause, files changed, and any remaining in-game verification needed.
- Keep explanations concise and technical.
