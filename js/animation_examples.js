/**
 * animation_examples.js - Example usage of animation system
 * 
 * These examples show how to integrate tmp_at() and delay_output()
 * into throw and zap commands, matching C NetHack behavior.
 */

import { tmp_at, DISP_BEAM, DISP_FLASH, DISP_TETHER, DISP_END, BACKTRACK } from './animations.js';
import { delay_output } from './delay.js';

/**
 * Example 1: Throw a projectile (dagger, arrow, rock, etc.)
 * Pattern: DISP_FLASH mode (only current position visible)
 * 
 * Equivalent to C NetHack's bhit() function
 */
export async function throwProjectile(obj, dx, dy, range) {
    const obj_glyph = obj.glyph || 100; // Get object's display glyph
    
    // Initialize animation with DISP_FLASH mode
    tmp_at(DISP_FLASH, obj_glyph);
    
    try {
        let x = player.x;
        let y = player.y;
        
        // Animate along projectile path
        while (range-- > 0) {
            x += dx;
            y += dy;
            
            // Check if position is valid
            if (!isValidPosition(x, y)) break;
            
            // Display projectile at this position
            tmp_at(x, y);
            
            // Wait 50ms so player can see it
            await delay_output();
            
            // Check for hit
            const target = getMonsterAt(x, y);
            if (target) {
                // Hit something - handle damage, etc.
                handleProjectileHit(obj, target);
                break;
            }
            
            // Check for wall/obstacle
            if (isWall(x, y)) {
                // Check if object breaks
                if (shouldBreak(obj, x, y)) {
                    // Show breaking animation (single flash)
                    await delay_output();
                }
                break;
            }
        }
    } finally {
        // Always cleanup animation, even if interrupted
        tmp_at(DISP_END, 0);
    }
    
    // Object lands at final position (x, y)
    return { x, y };
}

/**
 * Example 2: Zap a wand (beam/ray effect)
 * Pattern: DISP_BEAM mode (trail stays visible until end)
 * 
 * Equivalent to C NetHack's dobuzz() function
 */
export async function zapWand(wand, dx, dy) {
    const beam_glyph = getBeamGlyph(dx, dy, wand.zapType);
    const range = 7 + Math.floor(Math.random() * 7); // 7-13 squares
    
    // Initialize animation with DISP_BEAM mode
    tmp_at(DISP_BEAM, beam_glyph);
    
    try {
        let x = player.x;
        let y = player.y;
        
        // Animate beam along path
        for (let i = 0; i < range; i++) {
            x += dx;
            y += dy;
            
            if (!isValidPosition(x, y)) break;
            
            // Show beam at this position
            if (canSee(x, y)) {
                tmp_at(x, y);
                await delay_output(); // 50ms delay
            }
            
            // Check for target
            const target = getMonsterAt(x, y);
            if (target) {
                // Apply zap effect
                applyZapEffect(wand, target);
                
                // Check for reflection
                if (target.reflects) {
                    // Reverse direction
                    dx = -dx;
                    dy = -dy;
                    continue;
                }
                // Beam stops at target (unless it penetrates)
                if (!wand.penetrates) break;
            }
        }
    } finally {
        // Cleanup - erase entire beam trail
        tmp_at(DISP_END, 0);
    }
}

/**
 * Example 3: Throw tethered weapon (aklys)
 * Pattern: DISP_TETHER mode (shows rope connecting to hero)
 * 
 * Equivalent to C NetHack's throwit() with tethered_weapon
 */
export async function throwTetheredWeapon(weapon, dx, dy) {
    const weapon_glyph = weapon.glyph;
    const maxRange = 5; // Aklys has limited range due to tether
    
    // Initialize with DISP_TETHER mode
    tmp_at(DISP_TETHER, weapon_glyph);
    
    try {
        let x = player.x;
        let y = player.y;
        let actualRange = 0;
        
        // Outbound flight
        for (let i = 0; i < maxRange; i++) {
            x += dx;
            y += dy;
            
            if (!isValidPosition(x, y)) break;
            
            tmp_at(x, y);
            await delay_output();
            
            actualRange++;
            
            const target = getMonsterAt(x, y);
            if (target) {
                handleWeaponHit(weapon, target);
                break;
            }
        }
        
        // Return flight - BACKTRACK mode animates return
        tmp_at(DISP_END, BACKTRACK);
        
        // Weapon automatically returns to hero
        message("Your aklys returns to your hand!");
        
    } catch (error) {
        // If something goes wrong, still cleanup
        tmp_at(DISP_END, 0);
        throw error;
    }
}

/**
 * Example 4: Boomerang with curved path
 * More complex animation with custom path
 */
export async function throwBoomerang(boomerang, dx, dy) {
    const glyph = boomerang.glyph;
    const path = calculateBoomerangPath(player.x, player.y, dx, dy);
    
    tmp_at(DISP_FLASH, glyph);
    
    try {
        for (const pos of path) {
            tmp_at(pos.x, pos.y);
            await delay_output();
            
            const target = getMonsterAt(pos.x, pos.y);
            if (target) {
                handleBoomerangHit(boomerang, target);
                // Boomerang continues after hitting
            }
        }
        
        // Check if player catches it
        const finalPos = path[path.length - 1];
        if (finalPos.x === player.x && finalPos.y === player.y) {
            message("You skillfully catch the boomerang!");
        }
    } finally {
        tmp_at(DISP_END, 0);
    }
}

/**
 * Example 5: Breaking potion
 * Shows object flying then breaking with flash
 */
export async function throwPotion(potion, dx, dy) {
    const glyph = potion.glyph;
    
    tmp_at(DISP_FLASH, glyph);
    
    try {
        let x = player.x;
        let y = player.y;
        
        // Fly until hitting wall
        while (true) {
            x += dx;
            y += dy;
            
            tmp_at(x, y);
            await delay_output();
            
            if (isWall(x, y)) {
                // Show breaking flash
                await delay_output();
                message(`The ${potion.name} shatters!`);
                
                // Apply splash effects
                applySplashEffects(potion, x, y);
                break;
            }
        }
    } finally {
        tmp_at(DISP_END, 0);
    }
}

// Helper functions (stubs - would be implemented in actual game)
function isValidPosition(x, y) { return true; }
function canSee(x, y) { return true; }
function isWall(x, y) { return false; }
function getMonsterAt(x, y) { return null; }
function shouldBreak(obj, x, y) { return true; }
function handleProjectileHit(obj, target) {}
function handleWeaponHit(weapon, target) {}
function handleBoomerangHit(boomerang, target) {}
function applyZapEffect(wand, target) {}
function applySplashEffects(potion, x, y) {}
function getBeamGlyph(dx, dy, type) { return 300; }
function calculateBoomerangPath(x, y, dx, dy) { return []; }
function message(msg) { console.log(msg); }

const player = { x: 40, y: 11 };

export default {
    throwProjectile,
    zapWand,
    throwTetheredWeapon,
    throwBoomerang,
    throwPotion
};
