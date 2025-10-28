import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  firebase: {
    apiKey: "AIzaSyC3mF1wXulavewsCEGT-I3aUvWBj65mxHA",
    authDomain: "votaipb-prod.firebaseapp.com",
    projectId: "votaipb-prod",
    storageBucket: "votaipb-prod.firebasestorage.app",
    messagingSenderId: "81191872145",
    appId: "1:81191872145:web:1303bd6de6126e9f8c8130",
    measurementId: "G-XVBK6GH3CW"
  }
};
