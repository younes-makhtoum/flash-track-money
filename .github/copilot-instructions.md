# Copilot Instructions for Flash Track Money

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React Native Expo app that serves as a companion mobile app for Lunch Money personal finance management. The app focuses on mobile-first features missing from Lunch Money's official mobile app.

## Key Technologies
- **React Native** with **Expo** for cross-platform mobile development
- **TypeScript** for type safety
- **Expo Camera** and **Image Picker** for receipt capture
- **Expo Image Manipulator** for image cropping and processing
- **TanStack Query** for API state management
- **Zustand** for local state management
- **Lunch Money API** for data synchronization

## Core Features
1. **Receipt Capture**: Camera integration with cropping functionality for expense receipts
2. **Quick Expense Entry**: Fast transaction creation with offline capability
3. **Lunch Money Sync**: Bidirectional data sync with Lunch Money API
4. **Offline Support**: Local storage for transactions when offline

## Development Guidelines
- Use TypeScript for all new files
- Implement proper error handling for camera and API operations
- Follow React Native best practices for performance
- Use Expo's managed workflow for simplicity
- Implement offline-first architecture for core features
- Ensure accessibility compliance for all components

## API Integration
- All API calls should go through the Lunch Money API service layer
- Implement proper authentication with API tokens
- Use optimistic updates for better UX
- Handle network errors gracefully

## File Structure
- `/src/components/` - Reusable UI components
- `/src/screens/` - Screen components
- `/src/services/` - API and external service integrations
- `/src/store/` - State management
- `/src/types/` - TypeScript type definitions
- `/src/utils/` - Utility functions
