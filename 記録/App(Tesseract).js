import React, { useRef, useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [inputText, setInputText] = useState('');

  // クイズ用state
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // チャット履歴
  const [chat, setChat] = useState([]);

  // 終了フラグ
  const [isFinished, setIsFinished] = useState(false);

  // エフェクト用state
  const [effect, setEffect] = useState('none'); // "none" | "correct" | "wrong"
  const [isMicActive, setIsMicActive] = useState(false);

  // 音声認識用ref
  const recognitionRef = useRef(null);

  // 自動認識用タイマーref
  const recognizeTimer = useRef(null);

  // チャットが更新されたら自動スクロール
  const chatEndRef = useRef(null);

  // 問題データ取得
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:5001/api/questions');
        const data = await res.json();
        setQuestions(data.filter(q => q.question));
        setLoading(false);
      } catch (err) {
        setError('問題データの取得に失敗しました');
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // 問題が切り替わったらチャット履歴をリセットし、先生の出題を追加
  useEffect(() => {
    if (questions.length > 0) {
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length]);

  // チャットが更新されたら自動スクロール
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat]);

  // 座標取得関数
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
      };
    }
  };

  // Canvas描画処理
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const { x, y } = getPointerPos(e);
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = getPointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    triggerAutoRecognize();
  };

  const endDrawing = () => {
    setIsDrawing(false);
    triggerAutoRecognize();
  };

  // Canvasクリア
  const clearCanvas = (clearText = true) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (clearText) {
      setRecognizedText('');
      setInputText('');
    }
  };

  // Canvas画像をtesseract.jsで認識
  const recognize = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    setRecognizedText('認識中...');
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'jpn');
    const cleaned = text.replace(/[\s\u3000]/g, '');
    // 既存テキストに追記
    setRecognizedText(prev => prev + cleaned);
    setInputText(prev => prev + cleaned);
    clearCanvas(false); // キャンバスだけクリア
  };

  // 0.6秒後に自動認識
  const triggerAutoRecognize = () => {
    if (recognizeTimer.current) clearTimeout(recognizeTimer.current);
    recognizeTimer.current = setTimeout(() => {
      recognize();
    }, 600);
  };

  // 回答送信
  const handleSend = () => {
    if (!inputText || isFinished) return;
    const answer = questions[currentIndex].answer.trim();
    const isCorrect = inputText.trim() === answer;
    setChat(prev => [
      ...prev,
      { sender: 'seito', text: inputText },
      { sender: 'sensei', text: isCorrect ? '正解！' : `不正解… 正解は「${answer}」` }
    ]);
    // effect表示
    setEffect(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setEffect('none'), 500);
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setChat(prev => [
          ...prev,
          { sender: 'sensei', text: '全ての問題が終了しました！お疲れさまでした。' }
        ]);
        setIsFinished(true);
      }
    }, 1000); // 1秒待って次へ
  };

  // 次の問題へ
  const nextQuestion = () => {
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  };

  // 音声認識開始
  const startSpeechRecognition = () => {
    setIsMicActive(true);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('このブラウザは音声認識に対応していません');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + transcript);
    };
    recognition.onerror = (event) => {
      // エラー時は何もしない
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // 音声認識停止
  const stopSpeechRecognition = () => {
    setIsMicActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // スタイル定義
  const styles = {
    container: {
      maxWidth: 420,
      margin: '40px auto',
      border: '1px solid #e0e0e0',
      borderRadius: 16,
      background: '#fff0f6',
      boxShadow: '0 4px 24px #d0d8e8',
      padding: 0,
      fontFamily: "'Segoe UI', 'Meiryo', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      height: '80vh',
      fontSize: 15,
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      margin: 0,
      gap: 4,
      background: '#f5cfe4',
      borderRadius: 0,
      padding: '8px 12px',
    },
    input: {
      fontSize: 13,
      border: '1px solid #b2c8a2',
      borderRadius: 6,
      padding: '2px 6px',
      background: '#fff',
      color: '#222',
      width: 180,
      marginRight: 4,
      outline: 'none',
      height: 28,
    },
    button: {
      background: '#f8bbd0',
      color: '#b71c5c',
      border: 'none',
      borderRadius: 8,
      padding: '2px 8px',
      fontSize: 13,
      fontWeight: 'bold',
      cursor: 'pointer',
      marginRight: 4,
      minWidth: 36,
      height: 28,
      boxSizing: 'border-box',
    },
    micButton: {
      background: '#fff',
      color: '#b71c5c',
      border: '1px solid #b2c8a2',
      borderRadius: 8,
      padding: '0 18px',
      fontSize: 22,
      fontWeight: 'bold',
      cursor: 'pointer',
      minWidth: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      boxSizing: 'border-box',
    },
    canvasBox: {
      border: '2px solid #15313a',
      background: '#fff',
      margin: '0 8px 8px 8px',
      padding: 0,
      borderRadius: 8,
      position: 'relative',
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 70,
      boxSizing: 'border-box',
    },
    penIcon: {
      position: 'absolute',
      top: 12,
      right: 24,
      fontSize: 48,
      color: '#15313a',
      pointerEvents: 'none',
    },
    canvas: {
      background: '#fff',
      border: 'none',
      borderRadius: 0,
      display: 'block',
      margin: '0 auto',
      height: 66,
      width: '100%',
      maxWidth: 380,
    },
    chatArea: {
      flex: 'none',
      overflowY: 'auto',
      padding: '24px 32px 8px 32px',
      background: '#fff0f6',
      minHeight: 120,
      maxHeight: 320,
      display: 'block',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      margin: '0 8px',
      border: '2px solid #fff',
      boxShadow: '0 2px 6px #bbb',
      objectFit: 'cover',
      background: '#fff',
    },
  };

  return (
    <div className="App" style={styles.container}>
      {/* エフェクトオーバーレイ */}
      {effect === 'correct' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,0,64,0.08)',
          transition: 'opacity 0.3s',
        }}>
          <div style={{
            fontSize: 140,
            color: 'rgba(255,0,64,0.35)',
            fontWeight: 'bold',
            userSelect: 'none',
            textShadow: '0 0 24px rgba(255,0,64,0.18)',
          }}>
            〇
          </div>
        </div>
      )}
      {effect === 'wrong' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.18)',
          transition: 'opacity 0.3s',
        }}>
          <div style={{
            fontSize: 140,
            color: 'rgba(0,0,0,0.35)',
            fontWeight: 'bold',
            userSelect: 'none',
            textShadow: '0 0 24px rgba(0,0,0,0.18)',
          }}>
            ✕
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px' }}>
        <h2 style={{ margin: 0 }}>社会クイズ</h2>
        <button
          style={{
            background: '#fff',
            color: '#b71c5c',
            border: '1px solid #b71c5c',
            borderRadius: 8,
            padding: '4px 16px',
            fontWeight: 'bold',
            fontSize: 14,
            cursor: 'pointer',
            marginLeft: 16
          }}
          onClick={() => window.location.reload()}
        >
          最初から
        </button>
      </div>
      {loading ? (
        <div>読み込み中...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : questions.length === 0 ? (
        <div>問題がありません</div>
      ) : (
        <>
          {/* チャットエリア */}
          <div style={styles.chatArea}>
            {chat.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: msg.sender === 'sensei' ? 'row' : 'row-reverse', alignItems: 'flex-start', marginBottom: 8 }}>
                <img
                  src={msg.sender === 'sensei' ? process.env.PUBLIC_URL + '/sensei.png' : process.env.PUBLIC_URL + '/seito.png'}
                  alt={msg.sender}
                  style={styles.avatar}
                />
                <div style={{
                  maxWidth: msg.sender === 'sensei' ? 260 : 220,
                  minWidth: 40,
                  padding: '8px 13px',
                  borderRadius: 18,
                  fontSize: 15,
                  marginBottom: 1,
                  wordBreak: 'break-word',
                  background: msg.sender === 'sensei' ? '#fff' : '#f8bbd0',
                  color: '#222',
                  alignSelf: msg.sender === 'sensei' ? 'flex-start' : 'flex-end',
                  boxShadow: '0 2px 8px #f8bbd0',
                  minHeight: 32,
                  display: 'block',
                  textAlign: 'left',
                  borderTopRightRadius: msg.sender === 'sensei' ? 18 : 4,
                  borderTopLeftRadius: msg.sender === 'sensei' ? 4 : 18,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 入力エリア */}
          <div style={styles.headerRow}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              style={styles.input}
              placeholder="認識結果がここに表示されます"
              disabled={isFinished}
            />
            <button onClick={handleSend} style={styles.button} disabled={isFinished}>送信</button>
            <button onClick={clearCanvas} style={styles.button} disabled={isFinished}>クリア</button>
            <button
              style={{
                ...styles.micButton,
                background: isMicActive ? '#f8bbd0' : '#fff',
                color: isMicActive ? '#fff' : '#b71c5c',
                border: isMicActive ? '2px solid #b71c5c' : styles.micButton.border,
                transition: 'background 0.2s, color 0.2s, border 0.2s',
              }}
              disabled={isFinished}
              onMouseDown={startSpeechRecognition}
              onMouseUp={stopSpeechRecognition}
              onMouseLeave={stopSpeechRecognition}
              onTouchStart={startSpeechRecognition}
              onTouchEnd={stopSpeechRecognition}
            >
              <span role="img" aria-label="mic">🎤</span>
            </button>
          </div>
          <div style={styles.canvasBox}>
            <canvas
              ref={canvasRef}
              width={380}
              height={66}
              style={styles.canvas}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={endDrawing}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
