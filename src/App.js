import React, { useRef, useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [inputText, setInputText] = useState('');
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

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

  // トップページ表示用state
  const [showTop, setShowTop] = useState(true);

  // ジャンル選択state
  const [selectedGenre, setSelectedGenre] = useState(null);

  // 問題データ取得
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://wri-flask-backend.onrender.com/api/questions');
        const data = await res.json();
        console.log('selectedGenre:', selectedGenre);
        console.log('categories:', data.map(q => q.category));
        // 部分一致でテスト
        setQuestions(data.filter(q => q.question && q.category && q.category.includes(selectedGenre)));
        setLoading(false);
      } catch (err) {
        setError('問題データの取得に失敗しました');
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedGenre]);

  // 問題が切り替わったらチャット履歴をリセットし、先生の出題を追加
  useEffect(() => {
    if (questions.length > 0) {
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal' }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length]);

  // チャットが更新されたら自動で下までスクロール
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
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

  // タッチイベントをマウスイベントに変換する関数
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setLastX(x);
    setLastY(y);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 線の継続性を保つ
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setLastX(x);
    setLastY(y);
    triggerAutoRecognize();
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsDrawing(false);
    triggerAutoRecognize();
  };

  // タッチイベントリスナーを追加
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDrawing, lastX, lastY]);

  // Canvas描画処理
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = getPointerPos(e);
    ctx.moveTo(x, y);
    setLastX(x);
    setLastY(y);
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
    setLastX(x);
    setLastY(y);
    triggerAutoRecognize();
  };

  const endDrawing = () => {
    setIsDrawing(false);
    triggerAutoRecognize();
  };

  // Canvasクリア
  const clearCanvas = (clearText = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (clearText) {
      setRecognizedText('');
      setInputText('');
    }
  };

  // Canvas画像をGoogle Cloud Vision APIで認識
  const recognize = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    setRecognizedText('認識中...');
    try {
      const res = await fetch('https://wri-flask-backend.onrender.com/api/vision_ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await res.json();
      // スペース除去（全角・半角両方）
      const cleaned = (data.text || '').replace(/[\s\u3000]/g, '');
      // 既存のテキストに新しい文字を追加
      setRecognizedText(prev => prev + cleaned);
      setInputText(prev => prev + cleaned);
      // キャンバスだけクリア（テキストは保持）
      clearCanvas(false);
    } catch (err) {
      setRecognizedText('認識エラー');
    }
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
    let face = 'tai-normal';
    if (isCorrect) {
      const goodNum = Math.floor(Math.random() * 5) + 1;
      face = `tai-good${goodNum}`;
    } else {
      const badNum = Math.floor(Math.random() * 4) + 1;
      face = `tai-bad${badNum}`;
    }
    setChat(prev => [
      ...prev,
      { sender: 'seito', text: inputText },
      { sender: 'sensei', text: isCorrect ? '正解！' : `不正解… 正解は「${answer}」`, face }
    ]);
    setEffect(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setEffect('none'), 500);
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setChat(prev => [
          ...prev,
          { sender: 'sensei', text: '全ての問題が終了しました！お疲れさまでした。', face: 'tai-normal' }
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

  // 〇✕エフェクト表示時など、effectが変わるたびに画面を上端にスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [effect]);

  // 一文字戻る
  const handleBackspace = () => {
    setRecognizedText(prev => prev.slice(0, -1));
    setInputText(prev => prev.slice(0, -1));
  };

  // スタイル定義
  const styles = {
    container: {
      aspectRatio: '0.62',
      width: 'calc(100vw - 32px)',
      maxWidth: 420,
      maxHeight: 750,
      margin: '0 auto',
      border: '1px solid #e0e0e0',
      borderRadius: 16,
      background: '#e3f2fd',
      boxShadow: '0 4px 24px #d0d8e8',
      padding: 0,
      fontFamily: "'Segoe UI', 'Meiryo', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      position: 'relative',
      overflow: 'auto',
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      margin: 0,
      gap: 4,
      background: '#bbdefb',
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
      background: '#4FC3F7',
      color: '#01579b',
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
      color: '#01579b',
      border: '1px solid #90caf9',
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
      margin: '12px 8px 8px 8px',
      padding: 0,
      borderRadius: 8,
      position: 'relative',
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 140,
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
      height: 132,
      width: 'calc(100% - 40px)',
      maxWidth: 380,
    },
    chatArea: {
      flex: 'none',
      overflowY: 'auto',
      padding: '24px 32px 8px 32px',
      background: '#e3f2fd',
      height: 260,
      display: 'block',
    },
    avatar: {
      width: 48,
      height: 48,
      margin: 0,
      objectFit: 'contain',
    },
  };

  if (showTop) {
    return (
      <>
        <div style={{
          aspectRatio: '0.62',
          width: 'calc(100vw - 32px)',
          maxWidth: 420,
          maxHeight: 750,
          margin: '0 auto',
          border: '1px solid #e0e0e0',
          borderRadius: 16,
          background: '#fff0f6',
          boxShadow: '0 4px 24px #d0d8e8',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          position: 'relative',
        }}>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: '100%' }}>
            <img
              src={process.env.PUBLIC_URL + '/top.png'}
              alt="トップ画像"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div style={{
              position: 'absolute',
              top: '60%',
              left: '50%',
              transform: 'translate(-50%, 0)',
              display: 'flex',
              flexDirection: 'row',
              gap: 16,
            }}>
              <button
                style={{
                  background: '#A5D6A7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px 32px',
                  fontSize: 22,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 24px #d0d8e8',
                  minWidth: 80,
                  whiteSpace: 'nowrap',
                }}
                onClick={() => { setSelectedGenre('地理'); setShowTop(false); }}
              >
                地理
              </button>
              <button
                style={{
                  background: '#CE93D8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px 32px',
                  fontSize: 22,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 24px #d0d8e8',
                  minWidth: 80,
                  whiteSpace: 'nowrap',
                }}
                onClick={() => { setSelectedGenre('歴史'); setShowTop(false); }}
              >
                歴史
              </button>
              <button
                style={{
                  background: '#90CAF9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px 32px',
                  fontSize: 22,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 24px #d0d8e8',
                  minWidth: 80,
                  whiteSpace: 'nowrap',
                }}
                onClick={() => { setSelectedGenre('公民'); setShowTop(false); }}
              >
                公民
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ height: 32 }} />
      <div className="App" style={{ ...styles.container, position: 'relative' }}>
        {/* エフェクトオーバーレイ */}
        {effect === 'correct' && (
          <div style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(33,150,243,0.08)',
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              fontSize: 210,
              color: 'rgba(33,150,243,0.35)',
              fontWeight: 'bold',
              userSelect: 'none',
              textShadow: '0 0 24px rgba(33,150,243,0.18)',
            }}>
              〇
            </div>
          </div>
        )}
        {effect === 'wrong' && (
          <div style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(33,150,243,0.08)',
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              fontSize: 140,
              color: 'rgba(33,150,243,0.35)',
              fontWeight: 'bold',
              userSelect: 'none',
              textShadow: '0 0 24px rgba(33,150,243,0.18)',
            }}>
              ✕
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px' }}>
          <div style={{ width: 190, height: 40, overflow: 'hidden', display: 'inline-block', transform: 'scale(0.7)' }}>
            <img
              src={process.env.PUBLIC_URL + '/shittore.png'}
              alt="社会クイズ"
              style={{
                height: 40,
                display: 'block'
              }}
            />
          </div>
          <button
            style={{
              background: '#4FC3F7',
              color: '#01579b',
              border: '1px solid #01579b',
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
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: msg.sender === 'sensei' ? 'row' : 'row-reverse',
                  alignItems: 'flex-start',
                  marginBottom: 8,
                  ...(msg.sender === 'sensei'
                    ? { marginLeft: -16, paddingLeft: -16 }
                    : msg.sender === 'seito'
                      ? { marginRight: -16, paddingRight: -16 }
                      : {}),
                }}>
                  <img
                    src={msg.sender === 'sensei' ? process.env.PUBLIC_URL + `/${msg.face || 'tai-normal'}.png` : process.env.PUBLIC_URL + '/seito.png'}
                    alt={msg.sender}
                    style={
                      msg.sender === 'sensei'
                        ? { ...styles.avatar, transform: 'scale(0.9)' }
                        : { ...styles.avatar, width: 76, height: 76, transform: 'scale(0.8)', position: 'relative', top: 6 }
                    }
                  />
                  <div style={{
                    maxWidth: msg.sender === 'sensei' ? 260 : 220,
                    minWidth: 40,
                    padding: '8px 13px',
                    borderRadius: 18,
                    fontSize: 15,
                    marginBottom: 1,
                    wordBreak: 'break-word',
                    background: msg.sender === 'sensei' ? '#fff' : '#90caf9',
                    color: '#222',
                    alignSelf: msg.sender === 'sensei' ? 'flex-start' : 'flex-end',
                    boxShadow: '0 2px 8px #90caf9',
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
                onKeyDown={e => { if (e.key === 'Enter') { handleSend(); } }}
                style={styles.input}
                placeholder="認識結果がここに表示されます"
                disabled={isFinished}
              />
              <button onClick={handleSend} style={styles.button} disabled={isFinished}>送信</button>
              <button onClick={handleBackspace} style={styles.button} disabled={isFinished}>戻る</button>
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
                onContextMenu={e => e.preventDefault()}
                className="no-select"
              >
                <span role="img" aria-label="mic">🎤</span>
              </button>
            </div>
            <div style={styles.canvasBox}>
            <canvas
              ref={canvasRef}
                width={380}
                height={132}
                style={styles.canvas}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
        </>
      )}
    </div>
    </>
  );
}

export default App;
