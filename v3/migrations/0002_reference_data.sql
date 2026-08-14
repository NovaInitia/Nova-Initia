-- Reference data seeded from src/balance/seed.ts

INSERT INTO player_class (id, code, name) VALUES
  (1, 'giver', 'Giver'),
  (2, 'guardian', 'Guardian'),
  (3, 'guide', 'Guide');

INSERT INTO tool_type (id, code, name, owning_class_id, karma_delta, is_placeable, is_consumed_on_trigger, base_cost, initial_xp) VALUES
  (0, 'trap', 'Trap', 1, -1, true, true, 1, 5),
  (1, 'barrel', 'Barrel', 1, 1, true, false, 1, 5),
  (2, 'spider', 'Spider', 2, -1, true, true, 1, 5),
  (3, 'shield', 'Shield', 2, 1, false, false, 1, 0),
  (4, 'doorway', 'Doorway', 3, -1, true, false, 1, 10),
  (5, 'signpost', 'Signpost', 3, 1, true, false, 1, 10);

INSERT INTO level_definition (level, name, experience_threshold, sg_cost, stipend_sg, tool_allowance) VALUES
  (1, 'Novice', 0, 0, 140, 10),
  (2, 'Novice', 630, 120, 165, 12),
  (3, 'Novice', 945, 180, 190, 14),
  (4, 'Novice', 1323, 252, 220, 16),
  (5, 'Apprentice', 1764, 336, 250, 18),
  (6, 'Apprentice', 2268, 432, 275, 20),
  (7, 'Apprentice', 2835, 540, 300, 22),
  (8, 'Apprentice', 3465, 660, 330, 24),
  (9, 'Apprentice', 4158, 792, 355, 26),
  (10, 'Experienced', 4914, 936, 385, 28),
  (11, 'Experienced', 5733, 1092, 410, 30),
  (12, 'Experienced', 6615, 1260, 440, 32),
  (13, 'Experienced', 7560, 1440, 465, 34),
  (14, 'Experienced', 8568, 1632, 495, 36),
  (15, 'Master', 9639, 1836, 520, 38),
  (16, 'Master', 10773, 2052, 550, 40),
  (17, 'Master', 11970, 2280, 575, 42),
  (18, 'Master', 13230, 2520, 600, 44),
  (19, 'Master', 14553, 2772, 630, 46),
  (20, 'Legendary', 15939, 3036, 685, 50),
  (21, 'Legendary', 24413, 4650, 820, 60),
  (22, 'Legendary', 38273, 7290, 955, 70),
  (23, 'Legendary', 55676, 10605, 1095, 80),
  (24, 'Legendary', 76230, 14520, 1230, 90),
  (25, 'Taco', 99934, 19035, 1365, 100);

INSERT INTO consumption_cause (id, code) VALUES
  (1, 'triggered'),
  (2, 'exhausted'),
  (3, 'depleted'),
  (4, 'looted'),
  (5, 'placement_failed');

INSERT INTO ledger_cause (id, code) VALUES
  (1, 'registration'),
  (2, 'purchase'),
  (3, 'stipend'),
  (4, 'level_up'),
  (5, 'trap_damage'),
  (6, 'spider_damage'),
  (7, 'barrel_loot'),
  (8, 'barrel_stash'),
  (9, 'tour_completion'),
  (10, 'tour_owner_reward'),
  (11, 'placement_reward'),
  (12, 'trigger_reward'),
  (13, 'tool_use');

INSERT INTO ability_gate (ability_code, class_id, required_level) VALUES
  ('anonymous_trap', 1, 10),
  ('barrel_outside_message', 1, 5),
  ('barrel_stash_sg', 1, 1),
  ('loot_own_barrel', 1, 15),
  ('wandering_spider', 2, 15),
  ('anti_signpost_spider', 2, 10),
  ('chain_own_doorway', 3, 0),
  ('barrel_inside_message', NULL, 1);

INSERT INTO tool_age_bracket (tool_type_id, metric, min_age_ms, value) VALUES
  (0, 'damage_sg', 0, 10),
  (0, 'damage_sg', 604800000, 15),
  (0, 'damage_sg', 2592000000, 15),
  (0, 'damage_sg', 7776000000, 25),
  (0, 'damage_sg', 12960000000, 50),
  (0, 'expert_bonus_dmg', 0, 5),
  (0, 'expert_bonus_dmg', 7776000000, 10),
  (0, 'placer_xp', 0, 5),
  (2, 'damage_sg', 0, 10),
  (2, 'placer_xp', 0, 5),
  (2, 'placer_xp', 604800000, 10),
  (2, 'placer_xp', 2592000000, 15),
  (2, 'placer_xp', 7776000000, 25),
  (2, 'placer_xp', 12960000000, 50),
  (1, 'placer_xp', 0, 5),
  (1, 'placer_xp', 604800000, 10),
  (1, 'placer_xp', 2592000000, 10),
  (1, 'placer_xp', 7776000000, 25),
  (1, 'placer_xp', 12960000000, 50);

INSERT INTO class_scalar (class_id, metric, value) VALUES
  (1, 'shield_max_hits', 1),
  (2, 'shield_max_hits', 3),
  (3, 'shield_max_hits', 1),
  (1, 'barrel_tool_capacity', 100),
  (2, 'barrel_tool_capacity', 10),
  (3, 'barrel_tool_capacity', 10),
  (1, 'forced_doorway_chance', 0.01),
  (2, 'forced_doorway_chance', 0.01),
  (3, 'forced_doorway_chance', 0.03),
  (1, 'trap_fail_chance', 0.05),
  (2, 'trap_fail_chance', 0.05),
  (3, 'trap_fail_chance', 0.05);

INSERT INTO class_level_scalar (class_id, metric, min_level, value) VALUES
  (1, 'signpost_branches', 0, 2),
  (2, 'signpost_branches', 0, 2),
  (3, 'signpost_branches', 0, 1),
  (3, 'signpost_branches', 8, 2),
  (3, 'signpost_branches', 12, 3),
  (3, 'signpost_branches', 20, 4),
  (1, 'doorway_charges', 0, 50),
  (2, 'doorway_charges', 0, 50),
  (3, 'doorway_charges', 0, 50),
  (3, 'doorway_charges', 15, 100);

INSERT INTO balance_constant (code, value, description) VALUES
  ('karma_min', 0, 'Minimum karma value'),
  ('karma_max', 100, 'Maximum karma value'),
  ('karma_step', 1, 'Karma change increment'),
  ('karma_neutral', 50, 'Neutral karma value'),
  ('stipend_floor_fraction', 0.25, 'Fraction for stipend floor calculation'),
  ('stipend_activity_window_ms', 3600000, 'Activity window for stipend in milliseconds'),
  ('stipend_interval_ms', 3600000, 'Stipend interval in milliseconds'),
  ('extremity_karma_low', 5, 'Low extremity karma threshold'),
  ('extremity_karma_high', 95, 'High extremity karma threshold'),
  ('extremity_bonus_xp', 5, 'Bonus XP at extremity'),
  ('expert_trap_karma_max', 95, 'Max karma for expert trap'),
  ('out_of_class_cost_multiplier', 3, 'Multiplier for out-of-class tools'),
  ('inventory_cap_per_level', 250, 'Inventory cap per level'),
  ('page_placement_cap', 250, 'Max placements per page'),
  ('barrel_visit_limit', 3, 'Max visits to barrel'),
  ('barrel_inside_message_max', 155, 'Max length for barrel inside message'),
  ('barrel_outside_message_max', 128, 'Max length for barrel outside message'),
  ('doorway_transport_base', 0.08, 'Base doorway transport chance'),
  ('doorway_transport_per_level', 0.002, 'Doorway transport per level'),
  ('doorway_pass_through_limit', 1, 'Doorway pass-through limit'),
  ('doorway_owner_pass_through_limit', 3, 'Doorway owner pass-through limit'),
  ('starting_sg', 20, 'Starting SG for new players'),
  ('starting_karma', 50, 'Starting karma for new players'),
  ('starting_tools_in_class', 10, 'Starting tools in own class'),
  ('starting_tools_other', 5, 'Starting tools in other classes');

INSERT INTO normalisation_version (version, description) VALUES
  (1, 'BRD-01 Amendment F / D19 — scheme folded, www stripped, host lower-cased, default ports dropped, single trailing slash folded, tracking parameters removed, surviving parameters sorted, fragment discarded');
