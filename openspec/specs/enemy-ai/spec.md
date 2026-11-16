# enemy-ai Specification

## Purpose
Defines how the four Glitch enemies leave the Forge, choose where to go, alternate between behaviour modes, react to Overload, and return home after being caught.

## Requirements

### Requirement: Four distinct Glitches
The game SHALL have four Glitch enemies, each with its own name, color and shape: Rook (crimson triangle), Lure (violet diamond), Splice (lime hexagon) and Skitter (amber square). Each SHALL show which way it is heading.

#### Scenario: Glitches are distinguishable
- **WHEN** a round starts
- **THEN** four Glitches are visible, each with a different color and shape

### Requirement: Release from the Forge
At round start, Rook SHALL begin outside the Forge just above the door, and Lure, Splice and Skitter inside. The inside Glitches SHALL leave in the order Lure, Splice, Skitter, released by a spark-count threshold per Glitch or by a timer that fires when Nib eats nothing for a set time, whichever comes first.

#### Scenario: Release order
- **WHEN** a round begins and play continues
- **THEN** Lure leaves the Forge first, then Splice, then Skitter

#### Scenario: Idle timer forces release
- **WHEN** Nib eats no spark for the idle release time while a Glitch waits in the Forge
- **THEN** the next waiting Glitch leaves the Forge

### Requirement: Intersection decision rule
A Glitch outside the Forge SHALL choose its direction only on reaching a tile center. It SHALL NOT reverse on its own and SHALL NOT enter walls or the Forge door. Among the remaining directions it SHALL pick the one whose next tile is closest in straight-line distance to its target tile, breaking ties in the order up, left, down, right.

#### Scenario: Picks direction closest to target
- **WHEN** a Glitch reaches an intersection with exits left and down, and the tile to the left is closer to its target
- **THEN** it turns left

#### Scenario: Never reverses voluntarily
- **WHEN** a Glitch moving right reaches a tile where only right and left are open
- **THEN** it continues right even if left is closer to its target

### Requirement: Scatter and Chase schedule
Glitches outside Overload SHALL alternate on a level-based timer: Scatter 7s, Chase 20s, Scatter 7s, Chase 20s, Scatter 5s, Chase 20s, Scatter 5s, then Chase with no time limit. The timer SHALL pause while Overload is active. All Glitches SHALL reverse direction when the mode switches.

#### Scenario: Mode timeline at level 1
- **WHEN** 7 seconds of a level 1 round have passed without Overload
- **THEN** Glitches switch from Scatter to Chase and each reverses direction

#### Scenario: Overload pauses the schedule
- **WHEN** an Overload lasting 6 seconds happens 3 seconds into the first Scatter
- **THEN** the switch to Chase happens 4 seconds after the Overload ends

### Requirement: Scatter targets
In Scatter mode each Glitch SHALL target a fixed tile just outside a maze corner: Rook top-right, Lure top-left, Splice bottom-right, Skitter bottom-left. This makes each one circle its own corner.

#### Scenario: Rook scatters to top-right
- **WHEN** Rook is in Scatter mode
- **THEN** its target tile is its top-right corner tile

### Requirement: Rook chase targeting (direct)
In Chase mode Rook SHALL target Nib's current tile.

#### Scenario: Rook follows Nib
- **WHEN** Rook is in Chase mode and Nib is on tile (10, 20)
- **THEN** Rook's target tile is (10, 20)

### Requirement: Lure chase targeting (ambush)
In Chase mode Lure SHALL target the tile 4 tiles ahead of Nib in Nib's facing direction.

#### Scenario: Lure aims ahead of Nib
- **WHEN** Lure is in Chase mode and Nib is on tile (10, 20) facing left
- **THEN** Lure's target tile is (6, 20)

### Requirement: Splice chase targeting (flank)
In Chase mode Splice SHALL take the tile 2 ahead of Nib in its facing direction, draw a vector from Rook's tile to that tile, and target the end of that vector doubled from Rook's tile.

#### Scenario: Splice flank vector
- **WHEN** Splice is in Chase mode, Nib is on (10, 20) facing up, and Rook is on (8, 22)
- **THEN** the pivot tile is (10, 18) and Splice's target tile is (12, 14)

### Requirement: Skitter chase targeting (shy)
In Chase mode Skitter SHALL target Nib's tile when more than 8 tiles away from Nib (straight-line distance), and its own Scatter corner when 8 tiles or closer.

#### Scenario: Skitter far from Nib
- **WHEN** Skitter is in Chase mode 12 tiles from Nib
- **THEN** Skitter's target tile is Nib's tile

#### Scenario: Skitter close to Nib
- **WHEN** Skitter is in Chase mode 5 tiles from Nib
- **THEN** Skitter's target tile is its bottom-left Scatter corner

### Requirement: Overload behaviour
When Overload starts, affected Glitches SHALL reverse, slow down, change to a flickering pale appearance, and pick a random allowed direction at each intersection. Near the end of Overload they SHALL flash to warn the player. Overload length SHALL shrink as levels rise.

#### Scenario: Overloaded Glitches wander
- **WHEN** Glitches are Overloaded
- **THEN** each chooses a random non-reversing open direction at each intersection, using the game's seeded random source

#### Scenario: End-of-Overload warning
- **WHEN** fewer than 2 seconds of Overload remain
- **THEN** Overloaded Glitches flash between their pale look and their normal colors

### Requirement: Caught Glitches return to the Forge
A caught Glitch SHALL turn into a small core fragment that moves fast, ignores collisions with Nib, targets the Forge door, goes into the Forge, and then comes back out in the current Scatter or Chase mode.

#### Scenario: Caught Glitch respawns
- **WHEN** Nib catches an Overloaded Glitch
- **THEN** the Glitch's fragment travels to the Forge, enters it, and leaves again in normal mode

### Requirement: Glitch speeds
Glitch speed SHALL be set per level and per state: normal speed rises with level; Overloaded speed is slower than normal; speed inside the tunnel is reduced; returning fragments move faster than any other entity.

#### Scenario: Tunnel slowdown
- **WHEN** a Glitch in Chase mode enters a tunnel tile
- **THEN** it moves slower than it does in a normal corridor on the same level
