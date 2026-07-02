const firebaseConfig = {
  apiKey: "AIzaSyDsM01OmlEn81NUOupCpNYT7rg-9_XMNCc",
  authDomain: "dayoni-abbas.firebaseapp.com",
  databaseURL: "https://dayoni-abbas-default-rtdb.firebaseio.com",
  projectId: "dayoni-abbas",
  storageBucket: "dayoni-abbas.firebasestorage.app",
  messagingSenderId: "432024002505",
  appId: "1:432024002505:web:e91be30c5d47953e4fd218"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
