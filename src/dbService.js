import { db } from "./firebase"; // path to your firebase.js
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const saveFileMetadata = async (userId, fileName, downloadUrl) => {
  try {
    const docRef = await addDoc(collection(db, "files"), {
      ownerId: userId,
      name: fileName,
      url: downloadUrl,
      isSecure: true,
      createdAt: serverTimestamp()
    });
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};