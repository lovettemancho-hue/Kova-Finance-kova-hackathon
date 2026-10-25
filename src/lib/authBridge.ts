import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export const handleGoogleAuth = async () => {
  if (Capacitor.isNativePlatform()) {
    // 1. Native Android Google Sign-In flow
    const result = await FirebaseAuthentication.signInWithGoogle();
    if (!result.credential?.idToken) {
      throw new Error('No ID token returned from native Google Sign-In');
    }
    // 2. Link native token to web Firebase auth instance
    const credential = GoogleAuthProvider.credential(result.credential.idToken);
    return await signInWithCredential(auth, credential);
  } else {
    // Web fallback for browser testing
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
  }
};

export const loginWithGoogleUnified = handleGoogleAuth;
