# collectibles-scoring Specification

## Purpose
Defines what Nib can collect, how many points each item and each caught enemy is worth, and how extra lives are earned.

## Requirements

### Requirement: Spark placement
At the start of each level, every open path tile SHALL hold one spark, except tiles holding a Surge Core, the tunnel tiles, the player start tile, and the open area around the Forge. The total of sparks plus cores per level SHALL be fixed by the maze data and be between 220 and 260.

#### Scenario: Fresh level is fully stocked
- **WHEN** a new level begins
- **THEN** every eligible open path tile holds a spark and the excluded tiles hold none

### Requirement: Eating sparks
When Nib's tile center reaches a tile holding a spark, the spark SHALL be removed and 10 points SHALL be added to the score.

#### Scenario: Spark eaten
- **WHEN** Nib enters a tile holding a spark
- **THEN** the spark disappears and the score increases by 10

### Requirement: Surge Cores
Each level SHALL contain exactly 4 Surge Cores, one in each quadrant near the maze corners. Cores SHALL pulse visibly. Eating a core SHALL remove it, add 50 points, and start Overload mode for the Glitches.

#### Scenario: Core eaten
- **WHEN** Nib enters a tile holding a Surge Core
- **THEN** the core disappears, the score increases by 50, and all Glitches not currently returning to the Forge become Overloaded

### Requirement: Escalating enemy catch value
While Glitches are Overloaded, catching them SHALL score 200, 400, 800 and then 1600 points for the first through fourth catch. The sequence SHALL restart at 200 whenever a new Surge Core is eaten. The points earned SHALL be shown briefly where the catch happened.

#### Scenario: Four catches in one Overload
- **WHEN** Nib catches all four Overloaded Glitches after eating one core
- **THEN** the catches score 200, 400, 800 and 1600, a total of 3000

#### Scenario: New core restarts the sequence
- **WHEN** Nib catches two Glitches, then eats another core, then catches a third Glitch
- **THEN** the third catch scores 200

### Requirement: Bonus pickups
A bonus pickup SHALL appear just below the Forge after 70 and again after 170 sparks or cores have been eaten in a level. Each stays for 9–10 seconds unless collected. Its kind and value SHALL depend on the level, from 100 points at level 1 up to 5000 points at level 13 and above.

#### Scenario: Bonus appears and is collected
- **WHEN** the 70th spark of a level is eaten and Nib reaches the bonus tile within its time limit
- **THEN** the bonus disappears, its value for that level is added to the score, and the value is shown briefly at that spot

#### Scenario: Bonus expires
- **WHEN** a bonus pickup is not collected within its time limit
- **THEN** it disappears and no points are awarded

### Requirement: Extra life
The player SHALL receive exactly one extra life the first time the score reaches 10,000 points in a game.

#### Scenario: Crossing 10,000
- **WHEN** the score goes from below 10,000 to 10,000 or more
- **THEN** the lives count increases by one, and does not increase again on later points
