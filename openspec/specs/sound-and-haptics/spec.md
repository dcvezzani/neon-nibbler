# sound-and-haptics Specification

## Purpose
Defines the game's feedback beyond visuals: synthesized sound effects, vibration on supported phones, unlocking audio on the first touch, and the sound setting that controls both.

## Requirements

### Requirement: Synthesized sound effects
The game SHALL produce all sound with the Web Audio API and SHALL NOT load audio files. It SHALL have distinct original effects for: eating a spark, eating a Surge Core, catching a Glitch, a fragment returning home, collecting a bonus, earning an extra life, losing a life, clearing a level and starting a game.

#### Scenario: Spark sound
- **WHEN** Nib eats a spark with sound enabled
- **THEN** a short spark blip plays, alternating between two pitches on successive sparks

#### Scenario: No audio files requested
- **WHEN** the game loads and is played
- **THEN** no audio file is requested over the network

### Requirement: Overload ambience
While Overload is active, a looping background tone SHALL play, and it SHALL stop when Overload ends or the game pauses.

#### Scenario: Ambience stops
- **WHEN** Overload ends
- **THEN** the Overload loop stops within 100 ms

### Requirement: Unlock audio on first touch
Audio SHALL start on the player's first tap, click or key press, as mobile browsers require. If audio cannot start, the game SHALL run silently without errors.

#### Scenario: First tap starts audio
- **WHEN** the player opens the game on a phone and taps to start
- **THEN** the game-start sound plays

#### Scenario: Audio unavailable
- **WHEN** the browser has no Web Audio support
- **THEN** the game plays normally without sound and without errors

### Requirement: Audio resumes after interruption
After the game returns from the background or a phone call, audio SHALL work again once play resumes, without reloading.

#### Scenario: Back from a call
- **WHEN** a phone call interrupts the game and the player later resumes play
- **THEN** sound effects play again

### Requirement: Haptic feedback
On devices that support web vibration, the game SHALL vibrate briefly when Nib loses a life, catches a Glitch, eats a Surge Core and clears a level. Devices without support SHALL behave normally with no errors.

#### Scenario: Life lost on Android
- **WHEN** Nib loses a life on an Android phone with sound on
- **THEN** the phone gives a short vibration

#### Scenario: No vibration support
- **WHEN** the game runs on a browser without the Vibration API
- **THEN** play continues normally with no error

### Requirement: Sound toggle
One sound setting SHALL turn all sound and vibration on or off. It SHALL be changed from the sound button or settings panel, or with the M key on desktop. It SHALL be saved between sessions, and a muted indicator SHALL be shown while off.

#### Scenario: Mute persists
- **WHEN** the player taps the sound button to mute and reopens the game
- **THEN** the game is still muted, shows the muted indicator, and neither plays sound nor vibrates
