// RetroArch Web Player loader
const RetroArchLoader = {
    wasmModule: null,
    canvas: null,
    config: {
        wasmPath: '/emulator/cores/',
        assetsPath: '/emulator/assets/',
        romPath: '/roms/sega/'
    },

    async init(canvasId = 'retroarch-canvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        // Сначала загружаем WASM бинарник
        const wasmBinary = await this.loadWASM();
        
        // Настраиваем конфигурацию Module до загрузки скрипта
        window.Module = {
            canvas: this.canvas,
            wasmBinary: wasmBinary,
            preRun: [],
            postRun: [],
            print: function(text) { console.log(text); },
            printErr: function(text) { console.error(text); },
            totalDependencies: 0,
            monitorRunDependencies: function(left) {
                this.totalDependencies = Math.max(this.totalDependencies, left);
            }
        };

        // Теперь загружаем JavaScript
        await this.loadScript(`${this.config.wasmPath}genesis_plus_gx_libretro.js`);
    },

    async loadWASM() {
        const response = await fetch(`${this.config.wasmPath}genesis_plus_gx_libretro.wasm`);
        if (!response.ok) {
            throw new Error(`Failed to load WASM: ${response.statusText}`);
        }
        return await response.arrayBuffer();
    },

    async loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async loadROM(romName) {
        try {
            console.log('Загрузка ROM:', romName);
            const response = await fetch(`${this.config.romPath}${romName}`);
            if (!response.ok) {
                throw new Error(`Failed to load ROM: ${response.statusText}`);
            }
            const romData = await response.arrayBuffer();
            console.log('ROM загружен, размер:', romData.byteLength);
            
            // Дождёмся инициализации Module и FS
            await new Promise(resolve => {
                if (window.Module && window.Module.FS) {
                    resolve();
                } else {
                    const checkInterval = setInterval(() => {
                        if (window.Module && window.Module.FS) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                }
            });
            
            // Загружаем ROM в файловую систему эмулятора
            window.Module.FS.writeFile(romName, new Uint8Array(romData));
            console.log('ROM записан в FS');
            
            // Запускаем эмулятор
            window.Module.callMain([romName]);
        } catch (error) {
            console.error('Ошибка загрузки ROM:', error);
            throw error;
        }
    },

    // Add gamepad support
    initGamepad() {
        // Basic gamepad support
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad);
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected:", e.gamepad);
        });
    },

    // Add keyboard controls
    initKeyboard() {
        const keyMap = {
            'ArrowUp': 0x1,
            'ArrowDown': 0x2,
            'ArrowLeft': 0x4,
            'ArrowRight': 0x8,
            'z': 0x10,      // A button
            'x': 0x20,      // B button
            'a': 0x40,      // X button
            's': 0x80,      // Y button
            'Enter': 0x100, // Start
            'ShiftRight': 0x200  // Select
        };

        document.addEventListener('keydown', (event) => {
            const mask = keyMap[event.key];
            if (mask && window.Module) {
                window.Module._input_state_cb(0, 0, 0, mask);
            }
        });

        document.addEventListener('keyup', (event) => {
            const mask = keyMap[event.key];
            if (mask && window.Module) {
                window.Module._input_state_cb(0, 0, 0, 0);
            }
        });
    }
};

export default RetroArchLoader;