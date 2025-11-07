FROM nginx:alpine

# Копируем все файлы фронтенда напрямую
COPY . /usr/share/nginx/html/

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Устанавливаем правильные права доступа
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Создаем структуру для ROM файлов (будут проксироваться через backend)
RUN mkdir -p /usr/share/nginx/html/roms

# Добавляем правильные MIME типы для WASM и ROM
RUN echo 'types { \
    application/wasm wasm; \
    application/x-genesis-rom gen; \
    application/x-nintendo-nes-rom nes; \
    application/x-super-nintendo-rom smc; \
    application/x-playstation-rom iso bin; \
    application/javascript js mjs; \
}' > /etc/nginx/conf.d/custom_types.conf

# Настраиваем Cross-Origin Isolation для SharedArrayBuffer
RUN echo 'add_header Cross-Origin-Opener-Policy "same-origin" always; \
add_header Cross-Origin-Embedder-Policy "require-corp" always; \
add_header Access-Control-Allow-Origin "*" always; \
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always; \
add_header Access-Control-Allow-Headers "*" always; \
add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;' > /etc/nginx/conf.d/cors.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
