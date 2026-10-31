# BGA Dracula Theme

A [Dracula](https://draculatheme.com/) css theme for [boardgamearena.com](https://boardgamearena.com/),
built on top of BGA's [official dark theme](https://boardgamearena.com/forum/viewtopic.php?p=259278#p259278).

> [!NOTE]
> Work in progress: the theme is being rebuilt from scratch. It will only apply the Dracula
> colors and fix what is actually broken with the official dark theme on some games.

## Installation :

- Enable BGA's official dark theme
- Go to Preferences -> Advanced (or open this link : https://boardgamearena.com/preferences?section=advanced)
- Copy paste the content of [dist/style.css](https://raw.githubusercontent.com/audabas/bga-dracula-theme/main/dist/style.css) in the textbox and save
- Close and reopen BGA

## Development :

```bash
npm install
npm run build   # compiles src/style.scss into dist/style.css and checks BGA's size limit
npm run watch   # rebuilds on change
```
