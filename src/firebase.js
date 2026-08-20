import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child,
  serverTimestamp 
} from "firebase/database";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { 
  app, 
  db, 
  auth, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child, 
  serverTimestamp,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
};
export default db;