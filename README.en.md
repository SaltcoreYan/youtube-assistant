# YouTube Currency Converter

## Introduction
This Chrome extension converts Super Chats, Super Stickers, and other amounts on YouTube Live into CNY in real time, helping users quickly understand their value.

## Features
- Detects Super Chats, Super Stickers, and membership events in live chat.
- Fetches exchange rates from a configurable API and caches them locally.
- Offers a popup toggle to enable or disable conversion and shows the latest update time.

## Installation
1. Navigate to `chrome://extensions/`, enable Developer Mode, click “Load unpacked”, and select this project folder.
2. Ensure the extension is enabled and the `RATE_API_URL` in `config.js` is reachable.

## Usage
Open any YouTube live or replay page; the extension automatically converts chat amounts. Use the toolbar popup to toggle the feature.

## Configuration
- File: `config.js`
- Update `RATE_API_URL` to point to your preferred rate service; the background worker refreshes data periodically.

## Development
Core logic lives in `content.js`, `background.js`, and related scripts—extend currencies or UI as needed.

## License
Distributed under the [Apache License 2.0](LICENSE).
