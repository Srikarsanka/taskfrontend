/**
 * firebase-messaging-sw.js
 * 
 * This service worker is required by Firebase Cloud Messaging to receive 
 * push notifications when the app is in the background or closed.
 * 
 * Place this file in your web server's root directory (next to index.html).
 */

// Import and configure the Firebase SDK
// Note: These scripts must be loaded from CDN in a service worker
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js");

// TODO: Replace this with your actual Firebase config (must match the one in script.js)
const firebaseConfig = {
  apiKey: "AIzaSyAHmdgZ-0OBO839mxuuVDBTaN9VKgHxt5U",
  authDomain: "task-54626.firebaseapp.com",
  projectId: "task-54626",
  storageBucket: "task-54626.firebasestorage.app",
  messagingSenderId: "354464483940",
  appId: "1:354464483940:web:96d55d05923f6e68cded71",
  measurementId: "G-V1QTCEDWCY"
};

// Initialize Firebase App
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);

  // Retrieve an instance of Firebase Messaging so that it can handle background
  // messages.
  const messaging = firebase.messaging();

  // Customize background notification handling here
  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: "https://cdn-icons-png.flaticon.com/512/1055/1055687.png", // Productivity icon
      badge: "https://cdn-icons-png.flaticon.com/512/1055/1055687.png",
      data: {
        click_action: "/" // Open the dashboard when clicked
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
