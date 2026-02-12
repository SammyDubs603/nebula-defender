import type { RunUpgrades, UpgradeDefinition, UpgradeId } from '../entities/types';

export const UPGRADE_POOL: UpgradeDefinition[] = [
  { id: 'fireRate', name: 'Rapid Feed', description: 'Fire Rate +15%', icon: '⚡' },
  { id: 'damage', name: 'Overcharge Rounds', description: 'Damage +20%', icon: '✹' },
  { id: 'projectileSpeed', name: 'Rail Slugs', description: 'Projectile Speed +25%', icon: '➤' },
  { id: 'extraProjectile', name: 'Tri-Shot', description: '+1 Projectile with slight spread', icon: '⋮' },
  { id: 'pierce', name: 'Penetrator', description: 'Pierce +1 enemy', icon: '⟡' },
  { id: 'critChance', name: 'Targeting AI', description: 'Crit Chance +10% (2x damage)', icon: '◎' },
  { id: 'magnet', name: 'Flux Magnet', description: 'Pickup radius +25%', icon: '🧲' },
  { id: 'maxHp', name: 'Hull Plating', description: 'Max HP +20', icon: '♥' },
  { id: 'maxShield', name: 'Shield Cells', description: 'Shield Max +20', icon: '⬡' },
  { id: 'shieldRegen', name: 'Shield Relay', description: 'Shield Regen +15%', icon: '↻' },
  { id: 'moveSpeed', name: 'Afterburners', description: 'Move Speed +12%', icon: '⇧' },
  { id: 'dash', name: 'Thruster Dash', description: 'Short cooldown burst + 0.25s invuln', icon: '⤴' },
];

export function createUpgradeState(): RunUpgrades {
  return {
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    extraProjectile: 0,
    pierce: 0,
    critChance: 0,
    magnet: 0,
    maxHp: 0,
    maxShield: 0,
    shieldRegen: 0,
    moveSpeed: 0,
    dash: 0,
  };
}

export const UPGRADE_LABELS: Record<UpgradeId, string> = {
  fireRate: 'Rapid Feed',
  damage: 'Overcharge',
  projectileSpeed: 'Rail Slugs',
  extraProjectile: 'Tri-Shot',
  pierce: 'Penetrator',
  critChance: 'Targeting AI',
  magnet: 'Flux Magnet',
  maxHp: 'Hull Plating',
  maxShield: 'Shield Cells',
  shieldRegen: 'Shield Relay',
  moveSpeed: 'Afterburners',
  dash: 'Thruster Dash',
};
