// textToSpeech.js
function speak(message) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'en-US'; // Set language (US English)
    utterance.rate = 1; // Set speech rate
    utterance.pitch = 1; // Set speech pitch
    synth.speak(utterance);
}

// Function triggered after login success
function onLoginSuccess() {
    speak("Choose any module to give a test.");
}
