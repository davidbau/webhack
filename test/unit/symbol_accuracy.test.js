/**
 * Symbol System Accuracy Tests
 *
 * Verify that symbol constants (S_* from defsym.h/sym.h) match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Dungeon features - walls
  S_stone, S_vwall, S_hwall, S_tlcorn, S_trcorn, S_blcorn, S_brcorn,
  S_crwall, S_tuwall, S_tdwall, S_tlwall, S_trwall,
  // Doors, bars, trees
  S_ndoor, S_vodoor, S_hodoor, S_vcdoor, S_hcdoor, S_bars, S_tree,
  // Rooms and corridors
  S_room, S_darkroom, S_engroom, S_corr, S_litcorr, S_engrcorr,
  // Stairs and ladders
  S_upstair, S_dnstair, S_upladder, S_dnladder,
  S_brupstair, S_brdnstair, S_brupladder, S_brdnladder,
  // Dungeon features
  S_altar, S_grave, S_throne, S_sink, S_fountain,
  S_pool, S_ice, S_lava, S_vodbridge, S_hodbridge,
  S_vcdbridge, S_hcdbridge, S_air, S_cloud, S_water,
  // Traps
  S_arrow_trap, S_dart_trap, S_falling_rock_trap, S_squeaky_board,
  S_bear_trap, S_land_mine, S_rolling_boulder_trap, S_sleeping_gas_trap,
  S_rust_trap, S_fire_trap, S_pit, S_spiked_pit, S_hole, S_trap_door,
  S_teleportation_trap, S_level_teleporter, S_magic_portal,
  S_web, S_statue_trap, S_magic_trap, S_anti_magic_trap,
  S_polymorph_trap, S_vibrating_square,
  // Effects
  S_vbeam, S_hbeam, S_lslant, S_rslant, S_digbeam,
  S_flashbeam, S_boomleft, S_boomright, S_ss1, S_ss2, S_ss3, S_ss4,
  S_sw_tc, S_sw_ml, S_sw_mr, S_sw_bc,
  S_expl_tl, S_expl_tc, S_expl_tr, S_expl_ml, S_expl_mc, S_expl_mr,
  S_expl_bl, S_expl_bc, S_expl_br,
  // Miscellaneous (monster symbols - uppercase!)
  S_GOLEM, S_DEMON, S_HUMAN, S_GHOST,
  MAXPCHARS
} from '../../js/symbols.js';

describe('Symbol System Accuracy', () => {
  describe('Wall Symbol Constants', () => {
    it('should have correct values for basic walls', () => {
      // C ref: include/defsym.h cmap_symbols enum (lines 90-100)
      assert.strictEqual(S_stone, 0, 'S_stone should be 0');
      assert.strictEqual(S_vwall, 1, 'S_vwall (vertical wall) should be 1');
      assert.strictEqual(S_hwall, 2, 'S_hwall (horizontal wall) should be 2');
    });

    it('should have corner wall symbols in order', () => {
      // C ref: Corner walls are sequential
      assert.strictEqual(S_tlcorn, 3, 'S_tlcorn (top-left) should be 3');
      assert.strictEqual(S_trcorn, 4, 'S_trcorn (top-right) should be 4');
      assert.strictEqual(S_blcorn, 5, 'S_blcorn (bottom-left) should be 5');
      assert.strictEqual(S_brcorn, 6, 'S_brcorn (bottom-right) should be 6');
    });

    it('should have T-junction wall symbols', () => {
      // C ref: T-walls for junctions
      assert.strictEqual(S_crwall, 7, 'S_crwall (crosswall/4-way) should be 7');
      assert.strictEqual(S_tuwall, 8, 'S_tuwall (T pointing up) should be 8');
      assert.strictEqual(S_tdwall, 9, 'S_tdwall (T pointing down) should be 9');
      assert.strictEqual(S_tlwall, 10, 'S_tlwall (T pointing left) should be 10');
      assert.strictEqual(S_trwall, 11, 'S_trwall (T pointing right) should be 11');
    });
  });

  describe('Door Symbol Constants', () => {
    it('should have door types in sequence', () => {
      // C ref: include/defsym.h door symbols
      assert.strictEqual(S_ndoor, 12, 'S_ndoor (no door) should be 12');
      assert.strictEqual(S_vodoor, 13, 'S_vodoor (vertical open) should be 13');
      assert.strictEqual(S_hodoor, 14, 'S_hodoor (horizontal open) should be 14');
      assert.strictEqual(S_vcdoor, 15, 'S_vcdoor (vertical closed) should be 15');
      assert.strictEqual(S_hcdoor, 16, 'S_hcdoor (horizontal closed) should be 16');
    });

    it('vertical and horizontal doors should be paired', () => {
      // Vertical/horizontal variants should be adjacent
      assert.strictEqual(S_hodoor - S_vodoor, 1,
        'Horizontal open door should be 1 after vertical');
      assert.strictEqual(S_hcdoor - S_vcdoor, 1,
        'Horizontal closed door should be 1 after vertical');
    });
  });

  describe('Room and Corridor Symbols', () => {
    it('should have room types', () => {
      // C ref: include/defsym.h room symbols
      assert.strictEqual(S_bars, 17, 'S_bars (iron bars) should be 17');
      assert.strictEqual(S_tree, 18, 'S_tree should be 18');
      assert.strictEqual(S_room, 19, 'S_room (lit room) should be 19');
      assert.strictEqual(S_darkroom, 20, 'S_darkroom should be 20');
    });

    it('should have corridor types', () => {
      assert.strictEqual(S_corr, 22, 'S_corr (corridor) should be 22');
      assert.strictEqual(S_litcorr, 23, 'S_litcorr (lit corridor) should be 23');
    });

    it('should have engraved variants', () => {
      assert.strictEqual(S_engroom, 21, 'S_engroom (engraved room) should be 21');
      assert.strictEqual(S_engrcorr, 24, 'S_engrcorr (engraved corridor) should be 24');
    });
  });

  describe('Stair and Ladder Symbols', () => {
    it('should have basic stair types', () => {
      // C ref: include/defsym.h stair symbols
      assert.strictEqual(S_upstair, 25, 'S_upstair should be 25');
      assert.strictEqual(S_dnstair, 26, 'S_dnstair should be 26');
      assert.strictEqual(S_upladder, 27, 'S_upladder should be 27');
      assert.strictEqual(S_dnladder, 28, 'S_dnladder should be 28');
    });

    it('should have branch stair types', () => {
      // Branch stairs for dungeon branches (Mines, Sokoban, etc.)
      assert.strictEqual(S_brupstair, 29, 'S_brupstair (branch up stair) should be 29');
      assert.strictEqual(S_brdnstair, 30, 'S_brdnstair (branch down stair) should be 30');
      assert.strictEqual(S_brupladder, 31, 'S_brupladder should be 31');
      assert.strictEqual(S_brdnladder, 32, 'S_brdnladder should be 32');
    });

    it('stairs and ladders should be paired', () => {
      // Up/down pairs should be adjacent
      assert.strictEqual(S_dnstair - S_upstair, 1,
        'Down stair should be 1 after up stair');
      assert.strictEqual(S_dnladder - S_upladder, 1,
        'Down ladder should be 1 after up ladder');
    });
  });

  describe('Dungeon Feature Symbols', () => {
    it('should have furniture types', () => {
      // C ref: include/defsym.h feature symbols
      assert(typeof S_altar === 'number', 'S_altar should be defined');
      assert(typeof S_grave === 'number', 'S_grave should be defined');
      assert(typeof S_throne === 'number', 'S_throne should be defined');
      assert(typeof S_sink === 'number', 'S_sink should be defined');
      assert(typeof S_fountain === 'number', 'S_fountain should be defined');
    });

    it('should have water/lava types', () => {
      assert(typeof S_pool === 'number', 'S_pool should be defined');
      assert(typeof S_ice === 'number', 'S_ice should be defined');
      assert(typeof S_lava === 'number', 'S_lava should be defined');
      assert(typeof S_water === 'number', 'S_water should be defined');
    });

    it('should have drawbridge variants', () => {
      // Drawbridges have open/closed and vertical/horizontal
      assert(typeof S_vodbridge === 'number', 'S_vodbridge (vertical open) should be defined');
      assert(typeof S_hodbridge === 'number', 'S_hodbridge (horizontal open) should be defined');
      assert(typeof S_vcdbridge === 'number', 'S_vcdbridge (vertical closed) should be defined');
      assert(typeof S_hcdbridge === 'number', 'S_hcdbridge (horizontal closed) should be defined');
    });

    it('should have air and cloud', () => {
      assert(typeof S_air === 'number', 'S_air should be defined');
      assert(typeof S_cloud === 'number', 'S_cloud should be defined');
    });
  });

  describe('Trap Symbol Constants', () => {
    it('should have common trap types', () => {
      // C ref: include/defsym.h trap symbols
      assert(typeof S_arrow_trap === 'number', 'S_arrow_trap should be defined');
      assert(typeof S_dart_trap === 'number', 'S_dart_trap should be defined');
      assert(typeof S_bear_trap === 'number', 'S_bear_trap should be defined');
      assert(typeof S_land_mine === 'number', 'S_land_mine should be defined');
      assert(typeof S_pit === 'number', 'S_pit should be defined');
      assert(typeof S_spiked_pit === 'number', 'S_spiked_pit should be defined');
    });

    it('should have trap door and holes', () => {
      assert(typeof S_hole === 'number', 'S_hole should be defined');
      assert(typeof S_trap_door === 'number', 'S_trap_door should be defined');
    });

    it('should have magical traps', () => {
      assert(typeof S_teleportation_trap === 'number', 'S_teleportation_trap should be defined');
      assert(typeof S_level_teleporter === 'number', 'S_level_teleporter should be defined');
      assert(typeof S_magic_portal === 'number', 'S_magic_portal should be defined');
      assert(typeof S_magic_trap === 'number', 'S_magic_trap should be defined');
      assert(typeof S_anti_magic_trap === 'number', 'S_anti_magic_trap should be defined');
      assert(typeof S_polymorph_trap === 'number', 'S_polymorph_trap should be defined');
    });

    it('should have elemental traps', () => {
      assert(typeof S_fire_trap === 'number', 'S_fire_trap should be defined');
      assert(typeof S_rust_trap === 'number', 'S_rust_trap should be defined');
      assert(typeof S_sleeping_gas_trap === 'number', 'S_sleeping_gas_trap should be defined');
    });

    it('should have special traps', () => {
      assert(typeof S_squeaky_board === 'number', 'S_squeaky_board should be defined');
      assert(typeof S_web === 'number', 'S_web should be defined');
      assert(typeof S_statue_trap === 'number', 'S_statue_trap should be defined');
      assert(typeof S_rolling_boulder_trap === 'number', 'S_rolling_boulder_trap should be defined');
      assert(typeof S_vibrating_square === 'number', 'S_vibrating_square should be defined');
    });
  });

  describe('Effect Symbol Constants', () => {
    it('should have beam types', () => {
      // C ref: Zap/ray effects
      assert(typeof S_vbeam === 'number', 'S_vbeam (vertical beam) should be defined');
      assert(typeof S_hbeam === 'number', 'S_hbeam (horizontal beam) should be defined');
      assert(typeof S_lslant === 'number', 'S_lslant (left slant) should be defined');
      assert(typeof S_rslant === 'number', 'S_rslant (right slant) should be defined');
      assert(typeof S_digbeam === 'number', 'S_digbeam should be defined');
      assert(typeof S_flashbeam === 'number', 'S_flashbeam should be defined');
    });

    it('should have explosion symbols', () => {
      // Explosions use 3x3 grid of symbols
      assert(typeof S_expl_tl === 'number', 'S_expl_tl (top-left) should be defined');
      assert(typeof S_expl_tc === 'number', 'S_expl_tc (top-center) should be defined');
      assert(typeof S_expl_tr === 'number', 'S_expl_tr (top-right) should be defined');
      assert(typeof S_expl_ml === 'number', 'S_expl_ml (middle-left) should be defined');
      assert(typeof S_expl_mc === 'number', 'S_expl_mc (middle-center) should be defined');
      assert(typeof S_expl_mr === 'number', 'S_expl_mr (middle-right) should be defined');
      assert(typeof S_expl_bl === 'number', 'S_expl_bl (bottom-left) should be defined');
      assert(typeof S_expl_bc === 'number', 'S_expl_bc (bottom-center) should be defined');
      assert(typeof S_expl_br === 'number', 'S_expl_br (bottom-right) should be defined');
    });

    it('should have swallow symbols', () => {
      // Swallow interior symbols
      assert(typeof S_sw_tc === 'number', 'S_sw_tc (swallow top center) should be defined');
      assert(typeof S_sw_ml === 'number', 'S_sw_ml (swallow middle left) should be defined');
      assert(typeof S_sw_mr === 'number', 'S_sw_mr (swallow middle right) should be defined');
      assert(typeof S_sw_bc === 'number', 'S_sw_bc (swallow bottom center) should be defined');
    });
  });

  describe('Special Entity Symbols', () => {
    it('should have monster type symbols', () => {
      // C ref: Special monster appearance symbols (uppercase in symbols.js)
      assert(typeof S_GOLEM === 'number', 'S_GOLEM should be defined');
      assert(typeof S_DEMON === 'number', 'S_DEMON should be defined');
      assert(typeof S_HUMAN === 'number', 'S_HUMAN should be defined');
      assert(typeof S_GHOST === 'number', 'S_GHOST should be defined');
    });
  });

  describe('Symbol Count', () => {
    it('MAXPCHARS should define total symbol count', () => {
      // C ref: MAXPCHARS is the count of all cmap symbols
      assert(typeof MAXPCHARS === 'number', 'MAXPCHARS should be defined');
      assert(MAXPCHARS > 100, 'MAXPCHARS should be > 100 (many symbols)');
    });
  });

  describe('Symbol Ranges', () => {
    it('all symbol constants should be in valid range', () => {
      const symbols = [
        S_stone, S_vwall, S_hwall, S_tlcorn, S_trcorn, S_blcorn, S_brcorn,
        S_crwall, S_tuwall, S_tdwall, S_tlwall, S_trwall,
        S_ndoor, S_vodoor, S_hodoor, S_vcdoor, S_hcdoor,
        S_room, S_corr, S_upstair, S_dnstair
      ];

      for (const sym of symbols) {
        assert(sym >= 0 && sym < 300,
          `Symbol ${sym} should be in range [0, 300)`);
      }
    });

    it('wall symbols should be first (0-11)', () => {
      // C ref: Walls are the first 12 symbols
      assert.strictEqual(S_stone, 0, 'Stone is first symbol');
      assert(S_trwall <= 11, 'Last wall symbol should be <= 11');
      assert(S_vwall >= 0 && S_vwall <= 11, 'Wall symbols in range [0,11]');
      assert(S_hwall >= 0 && S_hwall <= 11, 'Wall symbols in range [0,11]');
    });

    it('doors should come after walls', () => {
      assert(S_ndoor > S_trwall, 'Doors should come after walls');
      assert(S_ndoor === 12, 'First door symbol should be 12');
    });

    it('stairs should come after rooms/corridors', () => {
      assert(S_upstair > S_corr, 'Stairs should come after corridors');
    });
  });

  describe('Symbol Uniqueness', () => {
    it('basic feature symbols should all be unique', () => {
      const symbols = [
        S_stone, S_vwall, S_hwall, S_tlcorn, S_trcorn, S_blcorn, S_brcorn,
        S_crwall, S_tuwall, S_tdwall, S_tlwall, S_trwall,
        S_ndoor, S_vodoor, S_hodoor, S_vcdoor, S_hcdoor, S_bars, S_tree,
        S_room, S_darkroom, S_corr, S_litcorr,
        S_upstair, S_dnstair, S_upladder, S_dnladder
      ];

      const unique = new Set(symbols);
      assert.strictEqual(unique.size, symbols.length,
        'All basic feature symbols should have unique values');
    });
  });

  describe('Symbol Ordering', () => {
    it('should have walls before doors before rooms', () => {
      // C ref: Logical ordering in defsym.h
      assert(S_stone < S_ndoor, 'Walls before doors');
      assert(S_ndoor < S_room, 'Doors before rooms');
      assert(S_room < S_upstair, 'Rooms before stairs');
    });

    it('open doors should come before closed doors', () => {
      assert(S_vodoor < S_vcdoor, 'Vertical open before vertical closed');
      assert(S_hodoor < S_hcdoor, 'Horizontal open before horizontal closed');
    });
  });

  describe('Critical Symbol Values', () => {
    it('S_stone should be 0 (default/invalid)', () => {
      // Stone is often used as the default/unset value
      assert.strictEqual(S_stone, 0, 'S_stone must be 0');
    });

    it('wall corners should be sequential', () => {
      // Corners must be in exact sequence for drawing code
      assert.strictEqual(S_trcorn - S_tlcorn, 1);
      assert.strictEqual(S_blcorn - S_trcorn, 1);
      assert.strictEqual(S_brcorn - S_blcorn, 1);
    });

    it('T-walls should be sequential after crosswall', () => {
      assert.strictEqual(S_tuwall - S_crwall, 1);
      assert.strictEqual(S_tdwall - S_tuwall, 1);
      assert.strictEqual(S_tlwall - S_tdwall, 1);
      assert.strictEqual(S_trwall - S_tlwall, 1);
    });
  });
});
