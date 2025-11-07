==============================
          WasteTime.ru 
==============================

🎮 Ретро-игры в браузере с автозапуском!

Проект для запуска классических игр (NES, SNES, Sega Genesis, PSX) 
прямо в браузере через RetroArch Web Player.

✨ Возможности:
- Автоматический запуск игр в один клик
- Кастомное управление (WASD + AZXQWS)
- 🎯 Управление в играх:
  движение (↑←↓→)
  A - кнопка A
  Z - кнопка B  
  X - кнопка C
  Q - кнопка X
  W - кнопка Y
  S - кнопка Z
 (ебучее, надо фиксить перехватом)
- Красивый интерфейс с карточками игр
- Docker для простого деплоя на свой сайт

📋 Требования:
- Docker и Docker Compose
- Для продакшена: VPS с nginx
- Для разработки: Windows 10/11 с Docker Desktop

🚀 Быстрый старт (локально):
1. docker-compose up -d
2. Откройте http://localhost

📦 Деплой на сервер (wastetime.ru):

ВАРИАНТ 1 - Автоматический (рекомендуется):
  
  На вашем компьютере:
  1. PowerShell > .\cleanup.ps1
  2. scp wastetime-deploy.zip user@wastetime.ru:/var/www/
  
  На сервере:
  3. ssh user@wastetime.ru
  4. cd /var/www && unzip wastetime-deploy.zip -d wastetime/
  5. cd wastetime && bash deploy-step2.sh

ВАРИАНТ 2 - Ручной:
  
  См. файл DEPLOY-QUICK.md

📁 Структура проекта:
  wastetime/
  ├── docker-compose.yml       # Docker конфигурация
  ├── frontend/                # Статический сайт
  │   ├── index.html          # Главная страница с карточками
  │   └── emulators/          # RetroArch Web Player
  ├── backend/                # Flask API для ROM файлов
  ├── roms/                   # ROM файлы игр
  │   ├── nes/
  │   ├── snes/
  │   ├── sega/              # Comix Zone
  │   └── psx/
  └── deploy-step2.sh        # Скрипт автоматического деплоя


⚙️ Добавление новых игр:
1. Поместите ROM в папку roms/<платформа>/
2. Игра автоматически появится на главной странице
3. Один клик - игра запускается!

📝 Важные файлы:
- cleanup.ps1          - Очистка проекта перед деплоем
- deploy-step2.sh      - Автоматический деплой на сервер
- DEPLOY-QUICK.md      - Быстрая инструкция
- nginx-wastetime.ru.conf - Конфигурация nginx

🔧 Управление Docker:
  Запуск:     docker-compose up -d
  Остановка:  docker-compose down
  Логи:       docker-compose logs -f
  Рестарт:    docker-compose restart

📌 ВАЖНО - Законность ROM:
- Используйте только собственные бэкапы легально купленных игр
- Или бесплатные homebrew/public domain ROM
- Проект не включает коммерческие ROM


