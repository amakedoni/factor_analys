# Генератор портфеля и факторный анализ на C++

Исходная версия команды из ветки `refactor/core-quality`, коммит `7a6fb0f`.

## Запуск на Windows

Нужны CMake 3.20 или новее и компилятор C++17. Выполните в PowerShell из этой папки.

```powershell
cmake -S . -B build
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
.\START_APP.cmd
```

Откройте `http://127.0.0.1:8765`. В «Генераторе» выберите «Короткие кредиты» и нажмите «Сгенерировать». В отчёте есть состав портфеля, месячные платежи и расчётный факторный анализ. Пара для импорта CF лежит в [папке данных «Спектра»](../spectrum/data/).

## Готовые отчёты на macOS

Выполните из этой папки. Для повторного запуска выберите свободные имена выходных файлов и папок.

```sh
cmake -S . -B build-mac -DCMAKE_BUILD_TYPE=Release
cmake --build build-mac --target portfolio dashboard
./build-mac/portfolio --profile short --out defense-demo
./build-mac/dashboard ../spectrum/data defense-cf.html
open defense-demo/report.html defense-cf.html
```

- [Инструкция к интерфейсу](DASHBOARD.md)
- [Параметры и расчётная модель](docs/portfolio-dashboard.md)
