# hud Specification

## Purpose
Defines what is shown and tappable around the maze: current score, saved high score, remaining lives, level indicators, and the touch buttons for pause, sound and settings.

## Requirements

### Requirement: Top HUD scores
The top HUD rows SHALL show the current score and the high score, each with a label, updating as soon as they change. Text SHALL remain readable at the smallest supported phone width (320 CSS px).

#### Scenario: Score updates live
- **WHEN** Nib eats a spark
- **THEN** the score shown in the top HUD increases by 10 on the next drawn frame

#### Scenario: Small phone
- **WHEN** the game runs on a 320 CSS px wide screen
- **THEN** the score and high score digits are at least 10 CSS px tall and do not overlap each other or the buttons

### Requirement: High score persistence
The high score SHALL be stored in the browser's local storage and loaded when the game opens. It SHALL update live while the current score is higher. If storage is unavailable, the game SHALL still run, keeping the high score only for the session.

#### Scenario: High score survives reload
- **WHEN** a game ends with a score of 5,000 above the previous high score of 3,000 and the game is reopened
- **THEN** the high score shown is 5,000

#### Scenario: Storage blocked
- **WHEN** local storage throws an error on read or write
- **THEN** the game still starts and plays normally, with a high score of 0 at load

### Requirement: Lives display
The bottom HUD SHALL show one small Nib icon for each life in reserve (lives not counting the one in play).

#### Scenario: Reserve lives shown
- **WHEN** a game starts with 3 lives
- **THEN** 2 Nib icons are shown in the bottom HUD

### Requirement: Level indicator
The bottom HUD SHALL show the current level number and icons for the bonus pickup kinds of the most recent levels, up to 7.

#### Scenario: Level number shown
- **WHEN** level 3 begins
- **THEN** the bottom HUD shows level 3 and the bonus icons for levels 1 to 3

### Requirement: Touch buttons
The game SHALL show a pause button during play, and sound and settings buttons on the start and pause screens. Each button SHALL have a touch area of at least 44×44 CSS px, sit inside the safe area, never cover maze tiles, and respond to both touch and mouse click.

#### Scenario: Pause button reachable
- **WHEN** a level is in play on a portrait phone
- **THEN** a pause button with a touch area of at least 44×44 CSS px is visible next to the top HUD, outside the maze

#### Scenario: Mouse click on desktop
- **WHEN** a desktop player clicks the sound button
- **THEN** sound is toggled exactly as with a tap

### Requirement: Settings panel
The settings button SHALL open a panel with toggles for sound and for the on-screen D-pad, each with a clear on/off state. Changes SHALL apply immediately and be saved between sessions.

#### Scenario: Turn on D-pad from settings
- **WHEN** the player opens settings, turns the D-pad on and closes the panel
- **THEN** the D-pad appears and stays on after the game is reopened
