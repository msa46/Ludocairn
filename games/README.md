# Creating a Deckwright Game

Repository games are ordinary Markdown files with validated YAML frontmatter.
The format is designed so that most game contributions do not require changes
to application code.

## Add a game

1. Choose a stable lowercase ID containing letters, digits, and single hyphens.
2. Create `games/<game-id>/game.md`.
3. Add version 1 frontmatter following
   [the game-format reference](../docs/game-format.md).
4. Write the rules as Markdown after the closing `---` delimiter.
5. Keep version 1 rules self-contained; embedded images and game-owned assets
   are not yet part of the format.
6. Run the repository validation and test commands documented by the
   implementation once the application foundation is in place.
7. Submit the game through a pull request.

## Authoring principles

- Prefer clear rules over encoding every rule as tracker configuration.
- Use a boolean field for a two-state fact such as alive/dead.
- Use a choice field for roles or mutually exclusive statuses.
- Use a number field for scores, resources, votes, and counters.
- Use a text field for freeform notes.
- Do not embed HTML, JavaScript, remote widgets, or secrets.
- Treat IDs as permanent API values; improve display text without renaming IDs.

## Scope of version 1

Version 1 configures a reference document and local tracker. It does not deal,
shuffle, assign roles, enforce turns, hide information per player, or decide a
winner. If a proposed game needs new behavior, describe the user interaction
and demonstrate why the existing four field types cannot represent it before
proposing a schema extension.
