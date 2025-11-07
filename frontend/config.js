// Configuration for different environments
const config = {
    // Базовый путь для всех запросов
    // Локально: '' (пустая строка)
    // Продакшн: '/segagenesis'
    basePath: window.location.hostname === 'wastetime.ru' 
        ? '/segagenesis'
        : '',
    
    // Путь к ROM файлам
    getRomPath: function(platform, rom) {
        return this.basePath + '/roms/' + platform + '/' + encodeURIComponent(rom);
    },
    
    // Путь к эмулятору
    getEmulatorPath: function() {
        return this.basePath + '/emulators/lib/retroarch/index.html';
    }
};

// Делаем доступным глобально
window.APP_CONFIG = config;
console.log('APP_CONFIG loaded:', config.basePath || '(root)');
