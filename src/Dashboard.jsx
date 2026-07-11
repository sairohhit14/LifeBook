import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState(''); // Simulated upload URL for testing
  const currentUser = auth.currentUser;

  // Real-time listener: Fetch files belonging to the logged-in user
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "files"),
      where("ownerId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fileList = [];
      snapshot.forEach((doc) => {
        fileList.push({ id: doc.id, ...doc.data() });
      });
      setFiles(fileList);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!fileName || !fileUrl) return alert("Please fill out all fields");

    try {
      // Save file metadata tied to the specific user's UID
      await addDoc(collection(db, "files"), {
        ownerId: currentUser.uid,
        name: fileName,
        url: fileUrl,
        isSecure: true,
        createdAt: serverTimestamp()
      });

      setFileName('');
      setFileUrl('');
      alert("File registered to your secure vault!");
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  if (!currentUser) {
    return <p style={{ textAlign: 'center', marginTop: '50px' }}>Please log in to view your dashboard.</p>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Your Secure LifeBook Vault</h2>
        <button onClick={() => auth.signOut()} style={{ padding: '5px 10px' }}>Log Out</button>
      </div>

      {/* Form to add/register a file metadata */}
      <form onSubmit={handleAddFile} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <input type="text" placeholder="File Name" value={fileName} onChange={e => setFileName(e.target.value)} style={{ flex: 1, padding: '8px' }} />
        <input type="text" placeholder="Download Link / URL" value={fileUrl} onChange={e => setFileUrl(e.target.value)} style={{ flex: 1, padding: '8px' }} />
        <button type="submit" style={{ padding: '8px 15px', background: 'green', color: 'white', border: 'none' }}>Add</button>
      </form>

      {/* File List Grid */}
      <h3>Your Protected Files ({files.length})</h3>
      {files.length === 0 ? <p>No files uploaded yet.</p> : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {files.map(file => (
            <li key={file.id} style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', background: '#f9f9f9', marginBottom: '5px' }}>
              <strong>{file.name}</strong>
              <a href={file.url} target="_blank" rel="noreferrer" style={{ color: '#f59e0b', textDecoration: 'none' }}>Access Secure Link →</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}