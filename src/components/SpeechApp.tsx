'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Heart, Sparkles, Smile, Zap } from 'lucide-react';

const SpeechApp = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [liveText, setLiveText] = useState('');
  const [flirtWords, setFlirtWords] = useState<Array<{word: string, id: number, timestamp: number}>>([]);
  const [compliments, setCompliments] = useState<Array<{compliment: string, id: number, timestamp: number}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Flirty words and compliments database
  const flirtWordsList = [
    'beautiful', 'gorgeous', 'stunning', 'cute', 'pretty', 'lovely', 'amazing',
    'wonderful', 'perfect', 'sweet', 'charming', 'attractive', 'adorable',
    'sexy', 'hot', 'handsome', 'elegant', 'graceful', 'divine', 'enchanting',
    'brilliant', 'fantastic', 'incredible', 'magnificent', 'radiant', 'dazzling'
  ];

  const complimentsList = [
    'you look amazing',
    'you are beautiful',
    'you are gorgeous',
    'you look stunning',
    'you are cute',
    'you look pretty',
    'you are lovely',
    'you look wonderful',
    'you are perfect',
    'you look sweet',
    'you are charming',
    'you look attractive',
    'you are adorable',
    'you look incredible',
    'you are fantastic',
    'you look brilliant',
    'you are magnificent',
    'you look radiant',
    'you are dazzling',
    'you look divine'
  ];

  const detectFlirtWords = useCallback((text: string) => {
    const words = text.toLowerCase().split(' ');
    const foundFlirtWords = words.filter(word => 
      flirtWordsList.some(flirtWord => word.includes(flirtWord))
    );
    
    foundFlirtWords.forEach(word => {
      setFlirtWords(prev => {
        const newWord = { 
          word, 
          id: Date.now() + Math.random(),
          timestamp: Date.now()
        };
        
        const filtered = prev.filter(item => 
          item.word !== word && Date.now() - item.timestamp < 3000
        );
        
        return [...filtered, newWord];
      });
    });
  }, []);

  const detectCompliments = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    const foundCompliments = complimentsList.filter(compliment => 
      lowerText.includes(compliment)
    );
    
    foundCompliments.forEach(compliment => {
      setCompliments(prev => {
        const newCompliment = { 
          compliment, 
          id: Date.now() + Math.random(),
          timestamp: Date.now()
        };
        
        const filtered = prev.filter(item => 
          item.compliment !== compliment && Date.now() - item.timestamp < 5000
        );
        
        return [...filtered, newCompliment];
      });
    });
  }, []);

  const transcribeAudio = async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return;
    
    setIsProcessing(true);
    setLiveText('🔄 Processing...');

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('temperature', '0.1');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY || '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'}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const transcribedText = data.text?.trim() || '';
      
      if (transcribedText && transcribedText.length > 3) {
        setTranscript(prev => {
          const newTranscript = prev + ' ' + transcribedText;
          return newTranscript.trim();
        });
        
        detectFlirtWords(transcribedText);
        detectCompliments(transcribedText);
        setLiveText(`✅ "${transcribedText}"`);
        
        setTimeout(() => {
          setLiveText('');
        }, 3000);
      } else {
        setLiveText('🔇 Listening...');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setError(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLiveText('');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Audio monitoring setup failed:', error);
    }
  };

  const startContinuousRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      setupAudioLevelMonitoring(stream);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          transcribeAudio(audioBlob);
        }
        audioChunksRef.current = [];
        
        if (isListening && mediaRecorderRef.current) {
          setTimeout(() => {
            if (isListening) {
              mediaRecorderRef.current?.start();
              setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
              }, 3000);
            }
          }, 100);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setLiveText('🎤 Listening...');
      
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('❌ Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsListening(false);
    setLiveText('');
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (isListening) {
      stopRecording();
    } else {
      startContinuousRecording();
    }
  };

  const clearAll = () => {
    setTranscript('');
    setFlirtWords([]);
    setCompliments([]);
    setLiveText('');
    setError('');
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFlirtWords(prev => prev.filter(item => now - item.timestamp < 3000));
      setCompliments(prev => prev.filter(item => now - item.timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  const FloatingWord = ({ word, index }: { word: { word: string, id: number, timestamp: number }, index: number }) => (
    <div
      key={word.id}
      className="absolute animate-pulse text-pink-400 font-bold text-base md:text-lg pointer-events-none transition-all duration-3000 ease-out opacity-100"
      style={{
        left: `${15 + (index * 12) % 70}%`,
        top: `${25 + (index * 8) % 50}%`,
        animation: `float 3s ease-out forwards, fadeOut 3s ease-out forwards`,
      }}
    >
      <div className="flex items-center gap-1 bg-pink-500/20 px-2 py-1 rounded-full backdrop-blur-sm">
        <Heart className="w-3 h-3 md:w-4 md:h-4 text-red-400 animate-bounce" />
        <span className="text-sm md:text-base">{word.word}</span>
        <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 animate-spin" />
      </div>
    </div>
  );

  const ComplimentBanner = ({ compliment }: { compliment: { compliment: string, id: number, timestamp: number } }) => (
    <div
      key={compliment.id}
      className="fixed top-16 md:top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-[90vw]
        bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 md:px-8 py-3 md:py-4 rounded-full
        shadow-2xl animate-bounce text-lg md:text-xl font-bold border-2 md:border-4 border-white"
      style={{
        animation: `slideDown 0.5s ease-out, pulse 4s ease-in-out infinite, slideUp 0.5s ease-out 4.5s forwards`,
      }}
    >
      <div className="flex items-center gap-2 justify-center">
        <Smile className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
        <span className="text-center text-sm md:text-xl">💕 {compliment.compliment.toUpperCase()} 💕</span>
        <Smile className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-hidden relative">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-pink-400/20 to-purple-600/20 rounded-full animate-spin-slow"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full animate-spin-reverse"></div>
      </div>

      {/* Floating Words */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {flirtWords.map((word, index) => (
          <FloatingWord key={word.id} word={word} index={index} />
        ))}
      </div>

      {/* Compliment Banners */}
      {compliments.map(compliment => (
        <ComplimentBanner key={compliment.id} compliment={compliment} />
      ))}

      <div className="relative z-20 container mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 md:mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            ✨ Live Speech Magic ✨
          </h1>
          <p className="text-sm md:text-xl text-blue-200 mb-1 md:mb-2">
            Powered by Whisper Large v3 Turbo ASR
          </p>
          <p className="text-sm md:text-lg text-gray-300">
            Tap to start continuous real-time voice analysis! 💫
          </p>
        </div>

        {/* Main Control */}
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="relative mb-4">
            <button
              onClick={toggleListening}
              className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 transition-all duration-300 transform active:scale-95 ${
                isListening
                  ? 'bg-red-500 border-red-300 shadow-red-500/50 animate-pulse'
                  : 'bg-green-500 border-green-300 shadow-green-500/50 hover:shadow-green-500/75'
              } shadow-2xl`}
              style={{
                transform: `scale(${1 + audioLevel / 500})`,
              }}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 md:w-14 md:h-14 text-white mx-auto" />
              ) : (
                <Mic className="w-10 h-10 md:w-14 md:h-14 text-white mx-auto" />
              )}
              {isListening && (
                <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
              )}
            </button>
            
            {/* Audio Level Indicator */}
            {isListening && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 md:w-2 rounded-full transition-all duration-100 ${
                      audioLevel > i * 30 ? 'bg-green-400 h-4 md:h-6' : 'bg-gray-600 h-2 md:h-3'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <p className="text-base md:text-lg font-semibold mb-2">
              {isListening ? '🎤 Live Listening...' : '▶️ Tap to Start'}
            </p>
            {isListening && (
              <div className="flex items-center justify-center gap-2 text-green-300 text-sm md:text-base">
                <Zap className="w-4 h-4 animate-pulse" />
                <span>Continuous Real-Time Analysis</span>
                <Zap className="w-4 h-4 animate-pulse" />
              </div>
            )}
            <button
              onClick={clearAll}
              className="mt-2 px-3 py-1 md:px-4 md:py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm md:text-base"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Live Status */}
        {(liveText || error || isProcessing) && (
          <div className="bg-black/30 backdrop-blur-lg rounded-xl p-3 md:p-4 mb-4 md:mb-6 border border-white/20 text-center">
            {error ? (
              <p className="text-red-400 text-sm md:text-lg">{error}</p>
            ) : (
              <p className="text-blue-300 text-sm md:text-lg animate-pulse">{liveText}</p>
            )}
          </div>
        )}

        {/* Live Transcript */}
        {transcript && (
          <div className="bg-black/30 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 mb-6 md:mb-8 border border-white/20">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
              <h2 className="text-lg md:text-2xl font-bold text-blue-300">Live Transcript</h2>
            </div>
            
            <div className="p-3 md:p-4 bg-green-500/20 rounded-lg md:rounded-xl border border-green-400/30">
              <p className="text-green-200 text-xs md:text-sm mb-2">📝 REAL-TIME TRANSCRIPTION:</p>
              <p className="text-sm md:text-lg text-gray-100 leading-relaxed break-words">{transcript}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-6 mb-6 md:mb-8">
          <div className="bg-pink-500/20 backdrop-blur-lg rounded-lg md:rounded-xl p-3 md:p-6 border border-pink-400/30">
            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 mb-1 md:mb-2">
              <Heart className="w-5 h-5 md:w-8 md:h-8 text-pink-400" />
              <h3 className="text-xs md:text-xl font-bold text-pink-300 text-center md:text-left">Sweet Words</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-white text-center">{flirtWords.length}</p>
            <p className="text-pink-200 text-xs md:text-sm text-center">Detected</p>
          </div>
          
          <div className="bg-purple-500/20 backdrop-blur-lg rounded-lg md:rounded-xl p-3 md:p-6 border border-purple-400/30">
            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 mb-1 md:mb-2">
              <Sparkles className="w-5 h-5 md:w-8 md:h-8 text-purple-400" />
              <h3 className="text-xs md:text-xl font-bold text-purple-300 text-center md:text-left">Magic Phrases</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-white text-center">{compliments.length}</p>
            <p className="text-purple-200 text-xs md:text-sm text-center">Found</p>
          </div>
          
          <div className="bg-blue-500/20 backdrop-blur-lg rounded-lg md:rounded-xl p-3 md:p-6 border border-blue-400/30">
            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 mb-1 md:mb-2">
              <Volume2 className="w-5 h-5 md:w-8 md:h-8 text-blue-400" />
              <h3 className="text-xs md:text-xl font-bold text-blue-300 text-center md:text-left">Words Spoken</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-white text-center">
              {transcript.split(' ').filter(word => word.length > 0).length}
            </p>
            <p className="text-blue-200 text-xs md:text-sm text-center">Total</p>
          </div>
        </div>

        {/* Example phrases */}
        <div className="bg-black/20 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-8 border border-white/10">
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 text-center text-yellow-300">
            ✨ Try saying these magical phrases ✨
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[
              "You look amazing today",
              "You are absolutely gorgeous",
              "You have a beautiful smile",
              "You look stunning in that dress",
              "You are incredibly cute",
              "You look so pretty right now"
            ].map((phrase, index) => (
              <div key={index} className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 p-3 md:p-4 rounded-lg border border-pink-400/30">
                <p className="text-white text-center italic text-xs md:text-base">"{phrase}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* API Info */}
        <div className="mt-6 md:mt-8 bg-green-500/10 backdrop-blur-lg rounded-lg md:rounded-xl p-3 md:p-4 border border-green-400/20">
          <p className="text-green-300 text-center text-xs md:text-sm">
            🚀 Using Groq's ultra-fast Whisper Large v3 Turbo API (216x real-time speed)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpeechApp;
