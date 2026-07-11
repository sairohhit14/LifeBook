import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './Auth';
import Dashboard from './Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading LifeBook...</div>;

  return (
    <div>
      <h1 style={{ textAlign: 'center', color: '#f59e0b', marginTop: '20px' }}>📖 LifeBook</h1>
      {user ? <Dashboard /> : <Auth />}
    </div>
  );
}

export default App;