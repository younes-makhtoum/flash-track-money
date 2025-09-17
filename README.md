# Flash Track Money

A React Native Expo companion app for Lunch Money personal finance management, focusing on mobile-first features missing from the official Lunch Money mobile app.

## 🚀 Features

- **📷 Receipt Capture**: Take photos of receipts with built-in cropping functionality
- **⚡ Quick Expense Entry**: Fast transaction creation with offline capability
- **🔄 Lunch Money Sync**: Bidirectional data sync with Lunch Money API
- **📱 Offline Support**: Local storage for transactions when offline
- **🎯 Mobile-First**: Designed specifically for mobile expense tracking workflows

## 🛠️ Tech Stack

- **React Native** with **Expo** for cross-platform mobile development
- **TypeScript** for type safety and better developer experience
- **Expo Camera & Image Picker** for receipt capture
- **Expo Image Manipulator** for image cropping and processing
- **TanStack Query** for API state management and caching
- **Zustand** for lightweight local state management
- **Lunch Money API** for data synchronization

## 📋 Prerequisites

- Node.js 20+ (LTS recommended)
- Expo CLI
- Lunch Money account and API token
- iOS Simulator or Android Emulator (or physical device)

## 🏃‍♂️ Getting Started

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo>
   cd flash-track-money
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Run on device/simulator**:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## 🔧 Configuration

### Lunch Money API Setup

1. Get your API token from [Lunch Money Developer Settings](https://my.lunchmoney.app/developers)
2. In the app, go to Settings and add your API token
3. The app will automatically sync categories and enable transaction creation

### Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_LUNCH_MONEY_API_URL=https://dev-api.lunchmoney.app/v1
```

## 📱 App Structure

```
src/
├── components/          # Reusable UI components
│   ├── ReceiptCapture.tsx
│   └── QuickExpenseEntry.tsx
├── screens/            # Screen components
│   └── HomeScreen.tsx
├── services/           # API and external service integrations
│   └── lunchMoneyAPI.ts
├── store/             # State management (Zustand)
│   └── appStore.ts
├── types/             # TypeScript type definitions
│   └── index.ts
└── utils/             # Utility functions
```

## 🔄 Offline Functionality

The app supports offline-first workflows:

- **Offline Transaction Storage**: Transactions are saved locally when offline
- **Automatic Sync**: When connection is restored, pending transactions sync automatically
- **Sync Status Indicator**: Visual feedback on connection and sync status
- **Conflict Resolution**: Handles sync conflicts gracefully

## 📸 Receipt Capture Workflow

1. **Capture**: Use built-in camera with document detection frame
2. **Crop**: Automatic image optimization and manual cropping option
3. **Attach**: Receipt is linked to transaction and stored locally
4. **Sync**: Receipt metadata syncs with Lunch Money (image stored locally)

## 🎯 Key Features Missing from Official App

- **Receipt capture with cropping**
- **Offline transaction entry**
- **Quick expense workflows**
- **Visual receipt management**
- **Optimized mobile UX**

## 🚧 Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web (limited functionality)

### Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

## 🔐 Security & Privacy

- **API tokens are stored securely** using Expo SecureStore
- **Receipt images are stored locally** on device only
- **No data is shared** with third parties
- **All API communication** uses HTTPS

## 🐛 Known Issues

- Camera permissions required for receipt capture
- Large receipt images may impact performance on older devices
- Sync conflicts are resolved by keeping server data (last-write-wins)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Lunch Money](https://lunchmoney.app) for the excellent personal finance platform
- [Expo](https://expo.dev) for the amazing development toolchain
- The React Native community for the ecosystem

---

**Note**: This is an unofficial companion app and is not affiliated with Lunch Money.
