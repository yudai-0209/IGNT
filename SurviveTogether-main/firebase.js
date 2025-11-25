import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyAGdG8o5fT5145e53rK_Oe3zIk5Kboj_Gk",
  authDomain: "ignt-no1.firebaseapp.com",
  projectId: "ignt-no1",
  storageBucket: "ignt-no1.firebasestorage.app",
  databaseURL: "https://ignt-no1-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
// Firebase初期化
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;