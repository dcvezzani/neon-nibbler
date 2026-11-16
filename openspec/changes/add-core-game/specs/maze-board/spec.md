# Spec Delta

## Purpose

Defines the playfield: the tile grid and screen layout, which tiles are walls or open paths, the wrap tunnel, and the Forge where enemies start and respawn.

## ADDED Requirements

### Requirement: Playfield grid dimensions
The playfield SHALL be a logical grid of 28 columns by 36 rows of square tiles, 16 logical pixels per tile (448×576). Rows 0–2 SHALL be reserved for the top HUD, rows 3–33 SHALL hold the 28×31 maze, and rows 34–35 SHALL be reserved for the bottom HUD. How the playfield is scaled to the screen is defined by app-shell.

#### Scenario: Maze occupies the middle rows
- **WHEN** the playfield is laid out
- **THEN** the maze occupies exactly rows 3 through 33 across all 28 columns, and no maze tile is drawn in rows 0–2 or 34–35

### Requirement: Tile types
Each maze tile SHALL be exactly one of: wall, open path, Forge interior, or Forge door. Only open path tiles and tunnel tiles SHALL be walkable by the player. Wall tiles SHALL NOT be walkable by any entity.

#### Scenario: Player cannot enter a wall
- **WHEN** the player tries to move into a wall tile
- **THEN** the player stays out of the wall tile

#### Scenario: Player cannot enter the Forge
- **WHEN** the player is next to the Forge door and presses toward it
- **THEN** the player does not pass through the door

### Requirement: Original symmetric maze layout
The maze SHALL be an original layout, mirror-symmetric left-to-right, with every walkable tile reachable from the player start tile. It SHALL contain no dead ends: every open path tile has at least two walkable neighbours (counting tunnel wrap).

#### Scenario: Layout integrity check
- **WHEN** the maze data is loaded
- **THEN** an automated check confirms the layout is mirror-symmetric, fully connected from the player start, and free of dead ends

### Requirement: Horizontal wrap tunnel
The maze SHALL have one horizontal tunnel on a middle row, open at both the left and right edges. An entity that leaves one edge through the tunnel SHALL reappear at the opposite edge on the same row, keeping its direction.

#### Scenario: Exiting left edge
- **WHEN** an entity moving left passes beyond column 0 on the tunnel row
- **THEN** it reappears entering from beyond column 27 on the same row, still moving left

### Requirement: Forge enemy home
The maze SHALL have an enclosed central area called the Forge, with a single door opening on its top edge (two tiles wide, centred, so the maze stays symmetric). Enemies SHALL start in or just above the Forge and respawn inside it. Only enemies leaving the Forge or returning to it after being caught SHALL pass through the door.

#### Scenario: Normal enemy blocked by door
- **WHEN** an enemy in Scatter or Chase mode is outside the Forge next to the door
- **THEN** it does not choose to move through the door into the Forge

### Requirement: Distinct visual identity
Walls SHALL be drawn as glowing outlines in the game's neon palette on a black background. Wall color SHALL change between levels so successive levels look different.

#### Scenario: Level change recolors walls
- **WHEN** the player advances from level 1 to level 2
- **THEN** the maze walls are drawn in a different color from level 1
