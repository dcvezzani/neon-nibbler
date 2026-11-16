# Spec Delta

## Purpose

Defines the overall game loop: the start screen, starting a round, collisions and losing lives, finishing levels and moving on, pausing, and game over.

## ADDED Requirements

### Requirement: Start screen
When the game loads, it SHALL show a start screen with the title "NEON NIBBLER", the four Glitches with their names, a short controls hint matching the device (swipe on touch screens, keys on desktop), and a prompt to tap (or press Enter or Space) to start.

#### Scenario: Starting a game by tapping
- **WHEN** the start screen is shown on a phone and the player taps the screen
- **THEN** a new game begins at level 1 with score 0 and 3 lives

#### Scenario: Starting a game by keyboard
- **WHEN** the start screen is shown on desktop and the player presses Enter or Space
- **THEN** a new game begins at level 1 with score 0 and 3 lives

### Requirement: Round start pause
Each new round (the start of a level or after losing a life) SHALL show a "READY" message for about 2 seconds with all entities frozen in their start positions before play begins.

#### Scenario: Ready message
- **WHEN** a round begins
- **THEN** "READY" is shown, nothing moves for about 2 seconds, and then play starts

### Requirement: Collision detection
Nib and a Glitch SHALL be treated as colliding when they occupy the same tile, or when they swap tiles in the same simulation step.

#### Scenario: Passing through each other
- **WHEN** Nib and a Glitch move toward each other and swap tiles in one step
- **THEN** a collision is detected

### Requirement: Losing a life
Colliding with a Glitch that is in Scatter or Chase mode SHALL freeze play, play a short loss animation, and subtract one life. If lives remain, entities SHALL return to start positions and a new round SHALL begin with the remaining sparks unchanged.

#### Scenario: Caught by a Glitch with lives left
- **WHEN** Nib collides with a Chase-mode Glitch while having 3 lives
- **THEN** lives drop to 2, all entities go back to their start positions, eaten sparks stay eaten, and a READY round starts

### Requirement: Catching an Overloaded Glitch
Colliding with an Overloaded Glitch SHALL catch it: award points per the catch sequence and freeze play for about half a second while the points are shown.

#### Scenario: Catch pause
- **WHEN** Nib collides with an Overloaded Glitch
- **THEN** the game freezes for about half a second, shows the points earned, then continues

### Requirement: Level completion
When every spark and Surge Core in the level has been eaten, play SHALL freeze, the maze SHALL flash, and the next level SHALL begin with a refilled maze, the same score and lives, and the level number increased by one.

#### Scenario: Clearing the maze
- **WHEN** Nib eats the last remaining spark on level 1
- **THEN** the maze flashes and level 2 starts with all sparks and cores restored

### Requirement: Difficulty progression
Each new level up to level 21 SHALL be harder than the one before: Glitch speed SHALL not decrease, Overload length SHALL not increase, and at least one of these SHALL get harder every level until both reach their limits. From level 21 on, Overload SHALL give no vulnerable time (Glitches only reverse).

#### Scenario: Level 2 is harder
- **WHEN** level 2 starts
- **THEN** Glitches are faster than on level 1, or Overload is shorter than on level 1, and neither has become easier

### Requirement: Game over
When the last life is lost, the game SHALL show "GAME OVER" with the final score, update the high score if beaten, and return to the start screen on a tap or Enter/Space. Input SHALL be ignored for the first second so a swipe in progress does not skip the screen.

#### Scenario: Last life lost
- **WHEN** Nib collides with a Chase-mode Glitch while on its last life
- **THEN** "GAME OVER" and the final score are shown, and a tap after one second returns to the start screen

#### Scenario: Swipe does not skip game over
- **WHEN** the player is mid-swipe as the game ends
- **THEN** the GAME OVER screen stays up and ignores that touch

### Requirement: Pause
Tapping the pause button, or pressing P or Escape, during play SHALL pause the game and show "PAUSED" with Resume and Quit choices. Resuming SHALL show a 3-second countdown before play continues, so the player can get their fingers ready. No game time SHALL pass while paused. Automatic pausing when the app is backgrounded is defined by app-shell.

#### Scenario: Pause and resume
- **WHEN** the player taps pause during play, waits 5 seconds, and taps Resume
- **THEN** a 3-2-1 countdown is shown, play continues exactly where it stopped, and no mode or Overload timer advanced during the pause or countdown

#### Scenario: Quit from pause
- **WHEN** the game is paused and the player taps Quit
- **THEN** the game returns to the start screen and the high score is updated if beaten

### Requirement: Deterministic simulation
Game logic SHALL advance in fixed time steps and use a seeded random source, so the same seed and the same input sequence always give the same game state.

#### Scenario: Replay produces identical state
- **WHEN** two simulations run with the same seed and the same timed inputs
- **THEN** their score, positions and modes are identical at every step
