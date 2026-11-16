# player-movement Specification

## Purpose
Defines how the player controls Nib: swipe, D-pad and keyboard input, grid-aligned movement, buffered turns, blocking by walls, and wrapping through the tunnel.

## Requirements

### Requirement: Swipe steering
Swiping anywhere on the game screen, except on buttons, SHALL steer Nib in the swipe's main direction (up, down, left or right). The direction SHALL be taken as soon as the finger has moved 20 CSS pixels, without waiting for it to lift.

#### Scenario: Swipe left
- **WHEN** the player touches the maze and drags the finger 30 px left and 5 px down
- **THEN** a Left input is registered once the finger has moved 20 px, before it lifts

#### Scenario: Tiny movement ignored
- **WHEN** the player touches and moves the finger less than 20 px before lifting
- **THEN** no direction input is registered

#### Scenario: Swipe on a button
- **WHEN** a touch starts on the pause button
- **THEN** it is handled as a button press and not as a swipe

### Requirement: Chained swipes without lifting
After a swipe direction is registered, continued movement of the same finger SHALL be able to register a new direction: the start point resets to where the last direction was registered, and a further 20 px move in a different main direction registers that direction.

#### Scenario: L-shaped drag
- **WHEN** the player drags 30 px left and then, without lifting, 30 px up
- **THEN** a Left input is registered followed by an Up input

### Requirement: Optional on-screen D-pad
The game SHALL offer an on-screen D-pad, off by default and turned on in settings. Each of its four arrows SHALL be at least 56 CSS px square, register its direction on touch down, and never cover the maze. The setting SHALL be saved between sessions. Swipes SHALL still work while the D-pad is shown.

#### Scenario: D-pad press
- **WHEN** the D-pad is on and the player touches its Up arrow
- **THEN** an Up input is registered immediately

#### Scenario: Setting remembered
- **WHEN** the player turns the D-pad on and reloads the game
- **THEN** the D-pad is still shown

### Requirement: Keyboard steering
On devices with a keyboard, the player SHALL be able to steer Nib with arrow keys and with W/A/S/D. Both key sets SHALL work at the same time, and keys used for steering SHALL NOT scroll the page.

#### Scenario: WASD steering
- **WHEN** the player presses D while Nib is moving in an open corridor that continues right
- **THEN** Nib moves right

#### Scenario: Arrow keys do not scroll
- **WHEN** the player presses an arrow key while the game page is focused
- **THEN** the page does not scroll

### Requirement: One input model for all controls
Swipe, D-pad and keyboard SHALL produce the same kind of direction input, handled by the same reversal and buffering rules, so the game behaves the same whichever control is used.

#### Scenario: Same result from swipe and key
- **WHEN** the same timed sequence of directions is given once by swipes and once by keys
- **THEN** Nib follows the same path in both cases

### Requirement: Grid-aligned continuous movement
Nib SHALL move continuously in its current direction along the center lines of corridors, without the key being held. Nib SHALL stop when the next tile in its direction is a wall and SHALL stay stopped until a valid direction is chosen.

#### Scenario: Running into a wall
- **WHEN** Nib is moving right and the next tile to the right is a wall
- **THEN** Nib stops at the center of its current tile and remains stopped

#### Scenario: Movement continues without holding a key
- **WHEN** the player taps Left once in an open corridor and releases it
- **THEN** Nib keeps moving left until it reaches a wall or a new direction is taken

### Requirement: Instant reversal
Nib SHALL reverse direction immediately when the opposite direction is pressed, at any position, not only at tile centers.

#### Scenario: Reverse mid-tile
- **WHEN** Nib is halfway between two tiles moving right and the player presses Left
- **THEN** Nib starts moving left immediately

### Requirement: Input buffering for turns
A perpendicular turn pressed before Nib reaches an intersection SHALL be remembered and taken as soon as Nib reaches a tile where that direction is open. The buffered turn SHALL stay active until it is taken, replaced by another key press, or 0.5 seconds pass without being taken.

#### Scenario: Early turn executes at the intersection
- **WHEN** Nib is moving left, the player presses Up two tiles before an opening above, and does not press anything else
- **THEN** Nib turns up at the tile where the opening is

#### Scenario: Buffer expires
- **WHEN** the player presses Up while no upward opening is reached within 0.5 seconds
- **THEN** the buffered turn is discarded and Nib continues in its current direction

#### Scenario: Newer input replaces buffer
- **WHEN** a turn Up is buffered and the player then presses Down before Up is taken
- **THEN** the Up turn is discarded and Down is handled instead

### Requirement: Tunnel wrapping for the player
Nib SHALL be able to enter the wrap tunnel and come out at the opposite edge, as defined by the maze-board tunnel rule.

#### Scenario: Player wraps right to left
- **WHEN** Nib moves right past the right edge on the tunnel row
- **THEN** Nib reappears at the left edge still moving right

### Requirement: Player speed
Nib's speed SHALL be set per level and SHALL be independent of display frame rate. Nib SHALL never move fast enough to skip over a tile in a single simulation step.

#### Scenario: Frame-rate independence
- **WHEN** the same input sequence is simulated at 30 and at 144 rendered frames per second
- **THEN** Nib covers the same distance over the same game time
