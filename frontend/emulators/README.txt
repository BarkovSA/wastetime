Папка emulators/ содержит заглушки для WASM-эмуляторов.
Для рабочей сборки поместите сюда реальные собранные файлы эмуляторов:
  - jsnes (NES) : js + optional wasm
  - snes9x-wasm (SNES) : .js + .wasm
  - genesisplusgx (SEGA) : .js + .wasm
  - pcsx-wasm (PS1) : .js + .wasm

После помещения файлов — интегрируйте их в frontend/js/*.js и обновите app.js для загрузки ROM через /roms/<system>/<file>
