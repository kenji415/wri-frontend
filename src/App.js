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
  const [originalQuestions, setOriginalQuestions] = useState([]); // 元のデータを保持
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

  // 詳細カテゴリ選択用state
  const [detailCategories, setDetailCategories] = useState([]);
  const [selectedDetailCategory, setSelectedDetailCategory] = useState(null);
  const [showCategoryButtons, setShowCategoryButtons] = useState(false);

  // レベル選択用state
  const [showLevelButtons, setShowLevelButtons] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);

  // 問題数選択用state
  const [showQuestionCountButtons, setShowQuestionCountButtons] = useState(false);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(null);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [customQuestionCount, setCustomQuestionCount] = useState('');
  const [isRandomOrder, setIsRandomOrder] = useState(false);

  // 復習モード用state
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewRound, setReviewRound] = useState(1);

  // ユーザー管理用state
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');

  // ユーザーIDの生成・管理
  useEffect(() => {
    // ローカルストレージからユーザーIDを取得
    let storedUserId = localStorage.getItem('wri_user_id');
    let storedUserName = localStorage.getItem('wri_user_name');
    
    if (!storedUserId) {
      // 新しいユーザーIDを生成
      storedUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('wri_user_id', storedUserId);
    }
    
    if (!storedUserName) {
      // デフォルトユーザー名を設定
      storedUserName = '生徒' + Math.floor(Math.random() * 1000);
      localStorage.setItem('wri_user_name', storedUserName);
    }
    
    setUserId(storedUserId);
    setUserName(storedUserName);
  }, []);

  // 回答記録を送信する関数
  const recordAnswer = async (questionId, isCorrect) => {
    try {
      console.log('回答記録送信開始:', { userId, userName, questionId, isCorrect });
      
      const response = await fetch('https://wri-flask-backend.onrender.com/api/record_answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          userName: userName,
          questionId: questionId,
          isCorrect: isCorrect
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('回答記録の送信に失敗しました:', response.status, errorText);
      } else {
        const result = await response.json();
        console.log('回答記録送信成功:', result);
      }
    } catch (error) {
      console.error('回答記録の送信エラー:', error);
    }
  };

  // 間違えた問題を記録する関数
  const recordWrongQuestion = (question) => {
    console.log('記録しようとしている問題:', question);
    setWrongQuestions(prev => {
      console.log('現在の間違えた問題リスト:', prev);
      // 既に記録されているかチェック
      const exists = prev.find(q => q.id === question.id);
      console.log('既に存在するか:', exists);
      if (!exists) {
        const newList = [...prev, question];
        console.log('新しい間違えた問題リスト:', newList);
        return newList;
      }
      return prev;
    });
  };

  // 問題データ取得
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://wri-flask-backend.onrender.com/api/questions');
        const data = await res.json();
        console.log('API response sample:', data.slice(0, 3));
        console.log('First question structure:', data[0]);
        console.log('All fields in first question:', Object.keys(data[0]));
        
        // 全フィールドの詳細を確認
        console.log('Detailed field analysis:', data.slice(0, 3).map(q => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          category: q.category,
          detailCategory: q.detailCategory,
          subCategory: q.subCategory,
          level: q.level,
          type: q.type,
          imageUrl: q.imageUrl,
          // 可能性のあるヒントフィールド名をチェック
          hint: q.hint,
          hintText: q.hintText,
          hint_message: q.hint_message,
          tip: q.tip,
          clue: q.clue
        })));
        
        // ヒントフィールドの存在を特別に確認
        console.log('Hint field check:', data.slice(0, 5).map(q => ({
          id: q.id,
          hasHint: 'hint' in q,
          hintValue: q.hint,
          hintType: typeof q.hint
        })));
        
        // 選択されたジャンルに基づいて問題をフィルタリング
        const filteredQuestions = data.filter(q => q.question && q.category && q.category.includes(selectedGenre));
        console.log('filteredQuestions by genre:', filteredQuestions.length);
        console.log('Sample filtered questions:', filteredQuestions.slice(0, 3));
        
        setOriginalQuestions(filteredQuestions); // 元のデータを保持
        setQuestions(filteredQuestions);
        
        // 詳細カテゴリを抽出（重複を除去）
        const uniqueDetailCategories = [...new Set(filteredQuestions.map(q => q.detailCategory).filter(Boolean))];
        console.log('uniqueDetailCategories:', uniqueDetailCategories);
        
        const finalDetailCategories = uniqueDetailCategories;
        console.log('finalDetailCategories:', finalDetailCategories);
        
        setDetailCategories(finalDetailCategories);
        
        // 先生の質問を表示
        setChat([{ 
          sender: 'sensei', 
          text: `${selectedGenre}やね！分野はどれにする？`,
          face: 'tai-normal',
          showButtons: true,
          buttons: finalDetailCategories
        }]);
        setShowCategoryButtons(true);
        
        setLoading(false);
      } catch (err) {
        setError('問題データの取得に失敗しました');
        setLoading(false);
      }
    };
    
    if (selectedGenre) {
      fetchQuestions();
    }
  }, [selectedGenre]);

  // ジャンル選択後に先生の質問を表示
  useEffect(() => {
    if (selectedGenre && !selectedDetailCategory && detailCategories.length > 0) {
      setChat([{ 
        sender: 'sensei', 
        text: `${selectedGenre}やね！分野はどれにする？`,
        face: 'tai-normal',
        showButtons: true,
        buttons: detailCategories
      }]);
      setShowCategoryButtons(true);
    }
  }, [selectedGenre, detailCategories.length, selectedDetailCategory]);

  // 詳細カテゴリが選択されたら、レベル選択を表示
  useEffect(() => {
    if (selectedDetailCategory && originalQuestions.length > 0) {
      console.log('Filtering by detail category:', selectedDetailCategory);
      console.log('Original questions count:', originalQuestions.length);
      
      // 中分類でフィルタリング
      const filteredByDetail = originalQuestions.filter(q => q.detailCategory === selectedDetailCategory);
      console.log('Questions after detail category filtering:', filteredByDetail.length);
      console.log('Sample questions after detail filtering:', filteredByDetail.slice(0, 3));
      
      setQuestions(filteredByDetail);
      setShowCategoryButtons(false);
      setShowLevelButtons(true);
      
      // 先生の質問を追加
      setChat([
        { 
          sender: 'seito', 
          text: selectedDetailCategory 
        },
        { 
          sender: 'sensei', 
          text: `${selectedDetailCategory}やな。レベルはどうしよっか？`, 
          face: 'tai-normal',
          showLevelButtons: true,
          levelButtons: ['レベル1', 'レベル2', 'レベル3']
        }
      ]);
    }
  }, [selectedDetailCategory, originalQuestions.length, selectedGenre]);

  // レベルが選択されたら、そのレベルの問題のみをフィルタリング
  useEffect(() => {
    if (selectedLevel && questions.length > 0) {
      const levelNumber = parseInt(selectedLevel.replace('レベル', ''));
      console.log('Selected level:', selectedLevel, 'Level number:', levelNumber);
      console.log('Questions before filtering:', questions.length);
      console.log('Sample questions before filtering:', questions.slice(0, 3).map(q => ({ question: q.question, level: q.level, detailCategory: q.detailCategory })));
      
      // levelフィールドの値の型と内容を詳しく確認
      console.log('Level field types and values:', questions.slice(0, 10).map(q => ({ 
        level: q.level, 
        levelType: typeof q.level, 
        levelAsNumber: parseInt(q.level),
        levelAsNumberType: typeof parseInt(q.level)
      })));
      
      // 文字列比較でのフィルタリングを試す
      const filteredByLevelString = questions.filter(q => q.level === levelNumber.toString());
      console.log('Questions after string level filtering:', filteredByLevelString.length);
      
      // 数値比較でのフィルタリング
      const filteredByLevel = questions.filter(q => q.level === levelNumber);
      console.log('Questions after number level filtering:', filteredByLevel.length);
      
      // どちらかで結果が得られた方を使用
      const finalFiltered = filteredByLevelString.length > 0 ? filteredByLevelString : filteredByLevel;
      console.log('Final filtered questions:', finalFiltered.length);
      console.log('Sample questions after filtering:', finalFiltered.slice(0, 3));
      
      // フィルタリング後の問題データの詳細を確認
      console.log('Detailed filtered questions:', finalFiltered.slice(0, 3).map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        hint: q.hint,
        hasHint: !!q.hint,
        hintLength: q.hint ? q.hint.length : 0
      })));
      
      setQuestions(finalFiltered);
      setAvailableQuestionCount(finalFiltered.length);
      setCurrentIndex(0);
      setShowLevelButtons(false);
      setShowQuestionCountButtons(true);
      
      // 先生の質問を追加
      setChat(prev => [
        ...prev,
        { 
          sender: 'seito', 
          text: selectedLevel 
        },
        { 
          sender: 'sensei', 
          text: `${selectedDetailCategory}${selectedLevel}、はりきっていこかー！何問やる？`, 
          face: 'tai-normal',
          showQuestionCountButtons: true,
          questionCountButtons: [
            '全部'
          ]
        }
      ]);
    }
  }, [selectedLevel, questions.length, selectedGenre, selectedDetailCategory]);

  // 問題数が選択された時の処理
  useEffect(() => {
    if (selectedQuestionCount && questions.length > 0) {
      let finalQuestions = [...questions];
      
      if (selectedQuestionCount !== '全部') {
        const count = parseInt(selectedQuestionCount);
        finalQuestions = questions.slice(0, count);
      }
      
      // ランダム順序が選択されている場合はシャッフル
      if (isRandomOrder) {
        // インデックス付きでシャッフル
        const indexedQuestions = finalQuestions.map((q, index) => ({ ...q, originalIndex: index }));
        const shuffled = indexedQuestions.sort(() => Math.random() - 0.5);
        finalQuestions = shuffled;
      }
      
      setQuestions(finalQuestions);
      setCurrentIndex(0);
      setShowQuestionCountButtons(false);
      
      // 先生の質問を追加
      setChat(prev => [
        ...prev,
        { 
          sender: 'seito', 
          text: selectedQuestionCount 
        },
        { 
          sender: 'sensei', 
          text: `${selectedGenre}の「${selectedDetailCategory}」の${selectedLevel}を始めましょう！`, 
          face: 'tai-normal' 
        }
      ]);
    }
  }, [selectedQuestionCount, questions.length, selectedGenre, selectedDetailCategory, selectedLevel, isRandomOrder]);

  // 問題が切り替わったらチャット履歴をリセットし、先生の出題を追加
  useEffect(() => {
    if (questions.length > 0 && !showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && selectedDetailCategory && selectedLevel && selectedQuestionCount && currentIndex === 0 && !isReviewMode) {
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, showCategoryButtons, showLevelButtons, showQuestionCountButtons, selectedDetailCategory, selectedLevel, selectedQuestionCount, isReviewMode]);

  // 次の問題への移行
  useEffect(() => {
    if (questions.length > 0 && !showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && selectedDetailCategory && selectedLevel && selectedQuestionCount && currentIndex > 0 && !isReviewMode) {
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, showCategoryButtons, showLevelButtons, showQuestionCountButtons, selectedDetailCategory, selectedLevel, selectedQuestionCount, isReviewMode]);

  // 復習モードでの問題出題
  useEffect(() => {
    if (isReviewMode && questions.length > 0 && currentIndex > 0) {
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, isReviewMode]);

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
      // タッチイベントの場合、スケールを考慮した座標計算
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    } else {
      // マウスイベントの場合は既存の処理
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
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // スケールを考慮した座標計算
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    setIsDrawing(true);
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
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // スケールを考慮した座標計算
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
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
    
    // 間違えた問題を記録
    if (!isCorrect) {
      recordWrongQuestion(questions[currentIndex]);
    }
    
    // 回答記録を送信
    const currentQuestion = questions[currentIndex];
    let questionId;
    if (isRandomOrder && currentQuestion.originalIndex !== undefined) {
      questionId = originalQuestions[currentQuestion.originalIndex].id;
    } else {
      questionId = currentQuestion.id;
    }
    recordAnswer(questionId, isCorrect);
    
    // 正解表示後に少し待ってから次の問題へ
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        // 次の問題を表示
        setCurrentIndex(prev => prev + 1);
      } else {
        // 全ての問題が終了
        // 最後の問題の間違えた記録が反映されるように、少し待ってから判定
        setTimeout(() => {
          if (wrongQuestions.length > 0 && !isReviewMode) {
            // 間違えた問題がある場合は復習モードを開始
            startReviewMode(wrongQuestions);
          } else if (wrongQuestions.length === 0 && isReviewMode) {
            // 復習モードで全問正解
            console.log('復習モード → 全問正解');
            setChat(prev => [
              ...prev,
              { sender: 'sensei', text: 'おめでとうございます！全問正解です！', face: 'tai-good1' }
            ]);
            setWrongQuestions([]); // 全問正解時に間違えた問題リストをクリア
            setIsFinished(true);
          } else if (wrongQuestions.length > 0 && isReviewMode) {
            // 復習モードで間違えた問題がある場合は次の復習ラウンドを開始
            console.log('復習モード → 次の復習ラウンド開始');
            startReviewMode(wrongQuestions); // 間違えた問題リストを直接渡す
          } else {
            // 通常の終了
            console.log('通常の終了');
            setChat(prev => [
              ...prev,
              { sender: 'sensei', text: '全ての問題が終了しました！お疲れさまでした。', face: 'tai-normal' }
            ]);
            setIsFinished(true);
          }
        }, 100); // 100ms待ってから判定
      }
    }, 1500); // 正解表示から1.5秒後に次の処理
  };

  // 復習モードを開始する関数
  const startReviewMode = (wrongQuestionsToReview) => {
    console.log('復習モード開始 - 現在の間違えた問題数:', wrongQuestionsToReview.length);
    console.log('間違えた問題リスト:', wrongQuestionsToReview);
    
    setIsReviewMode(true);
    setReviewRound(prev => prev + 1);
    
    // 渡された間違えた問題リストを使用
    const currentWrongQuestions = [...wrongQuestionsToReview];
    console.log('復習用の問題リスト:', currentWrongQuestions);
    setQuestions(currentWrongQuestions);
    
    setCurrentIndex(0);
    setChat(prev => [
      ...prev,
      { sender: 'sensei', text: `復習${reviewRound}回目です！間違えた問題をもう一度解いてみましょう。`, face: 'tai-normal' }
    ]);
    
    // 復習モード開始時に最初の問題を出題
    setTimeout(() => {
      if (currentWrongQuestions.length > 0) {
        setChat(prev => [
          ...prev,
          { sender: 'sensei', text: currentWrongQuestions[0].question, face: 'tai-normal', isQuestion: true }
        ]);
        clearCanvas();
        setInputText('');
        setRecognizedText('');
      }
    }, 1000); // 1秒後に最初の問題を出題
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
      width: 160,
      marginRight: 4,
      outline: 'none',
      height: 28,
    },
    button: {
      background: '#4FC3F7',
      color: '#01579b',
      border: 'none',
      borderRadius: 8,
      padding: '2px 6px',
      fontSize: 11,
      fontWeight: 'bold',
      cursor: 'pointer',
      marginRight: 4,
      minWidth: 32,
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
            {/* console.log('chat:', chat); */}
            {/* console.log('showCategoryButtons:', showCategoryButtons); */}
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
                  {/* 先生のメッセージにボタンがある場合 */}
                  {msg.sender === 'sensei' && msg.showButtons && msg.buttons && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      {msg.buttons.map((category, index) => (
                        <button
                          key={index}
                          style={{
                            background: '#4FC3F7',
                            color: '#01579b',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            width: '100%',
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#29B6F6';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#4FC3F7';
                            e.target.style.transform = 'translateY(0)';
                          }}
                          onClick={() => setSelectedDetailCategory(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 先生のメッセージにレベルボタンがある場合 */}
                  {msg.sender === 'sensei' && msg.showLevelButtons && msg.levelButtons && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      {msg.levelButtons.map((level, index) => (
                        <button
                          key={index}
                          style={{
                            background: '#4FC3F7',
                            color: '#01579b',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            width: '100%',
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#29B6F6';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#4FC3F7';
                            e.target.style.transform = 'translateY(0)';
                          }}
                          onClick={() => setSelectedLevel(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 先生のメッセージに問題数選択ボタンがある場合 */}
                  {msg.sender === 'sensei' && msg.showQuestionCountButtons && msg.questionCountButtons && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      {/* 数字入力フィールド */}
                      <div style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                      }}>
                        <input
                          type="number"
                          min="1"
                          max={availableQuestionCount}
                          value={customQuestionCount}
                          onChange={(e) => setCustomQuestionCount(e.target.value)}
                          placeholder={`1-${availableQuestionCount}の数字を入力`}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: 14,
                            border: '1px solid #ccc',
                            borderRadius: 8,
                            outline: 'none',
                          }}
                        />
                        <button
                          style={{
                            background: customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount ? '#4FC3F7' : '#ccc',
                            color: customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount ? '#01579b' : '#666',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount ? 'pointer' : 'not-allowed',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseOver={(e) => {
                            if (customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount) {
                              e.target.style.background = '#29B6F6';
                              e.target.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount) {
                              e.target.style.background = '#4FC3F7';
                              e.target.style.transform = 'translateY(0)';
                            }
                          }}
                          onClick={() => {
                            if (customQuestionCount && parseInt(customQuestionCount) > 0 && parseInt(customQuestionCount) <= availableQuestionCount) {
                              setSelectedQuestionCount(parseInt(customQuestionCount).toString());
                            }
                          }}
                        >
                          開始
                        </button>
                      </div>
                      
                      {/* 全部ボタン */}
                      {msg.questionCountButtons.map((count, index) => {
                        const isAll = count === '全部';
                        
                        return (
                          <button
                            key={index}
                            style={{
                              background: '#4FC3F7',
                              color: '#01579b',
                              border: 'none',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 14,
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              textAlign: 'left',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              transition: 'all 0.2s ease',
                              width: '100%',
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#29B6F6';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = '#4FC3F7';
                              e.target.style.transform = 'translateY(0)';
                            }}
                            onClick={() => {
                              setSelectedQuestionCount(count);
                            }}
                          >
                            {`全部(${availableQuestionCount}問)で開始`}
                          </button>
                        );
                      })}

                      {/* ランダム順序チェックボックス */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 8,
                        padding: '8px 12px',
                        background: '#f5f5f5',
                        borderRadius: 8,
                        border: '1px solid #e0e0e0',
                      }}>
                        <input
                          type="checkbox"
                          id="randomOrder"
                          checked={isRandomOrder}
                          onChange={(e) => setIsRandomOrder(e.target.checked)}
                          style={{
                            width: 16,
                            height: 16,
                            cursor: 'pointer',
                          }}
                        />
                        <label
                          htmlFor="randomOrder"
                          style={{
                            fontSize: 14,
                            color: '#333',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          ランダム
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {/* 問題出題時のヒント・わからないボタン */}
                  {msg.sender === 'sensei' && 
                   !msg.showButtons && 
                   !msg.showLevelButtons && 
                   questions[currentIndex] && 
                   !isFinished && 
                   msg.text === questions[currentIndex].question && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'flex-end',
                    }}>
                      {/* ヒントボタン - J列にデータがある場合のみ表示 */}
                      {questions[currentIndex].hint && questions[currentIndex].hint.trim() && (
                        <button
                          style={{
                            background: '#90CAF9',
                            color: '#01579b',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 14,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            width: 96,
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#64B5F6';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#90CAF9';
                            e.target.style.transform = 'translateY(0)';
                          }}
                          onClick={() => {
                            setChat(prev => [
                              ...prev,
                              { sender: 'sensei', text: `ヒント: ${questions[currentIndex].hint}`, face: 'tai-normal' }
                            ]);
                          }}
                        >
                          ヒント
                        </button>
                      )}
                      
                      {/* わからないボタン - 常に表示 */}
                      <button
                        style={{
                          background: '#9E9E9E',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 14,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s ease',
                          width: 96,
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#757575';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#9E9E9E';
                          e.target.style.transform = 'translateY(0)';
                        }}
                        onClick={() => {
                          const answer = questions[currentIndex].answer.trim();
                          setChat(prev => [
                            ...prev,
                            { sender: 'sensei', text: `正解は「${answer}」でした。`, face: 'tai-normal' }
                          ]);
                          
                          // 間違えた問題を記録
                          recordWrongQuestion(questions[currentIndex]);
                          
                          // 回答記録を送信（不正解として記録）
                          const currentQuestion = questions[currentIndex];
                          let questionId;
                          if (isRandomOrder && currentQuestion.originalIndex !== undefined) {
                            questionId = originalQuestions[currentQuestion.originalIndex].id;
                          } else {
                            questionId = currentQuestion.id;
                          }
                          recordAnswer(questionId, false);
                          
                          setTimeout(() => {
                            if (currentIndex + 1 < questions.length) {
                              setCurrentIndex(prev => prev + 1);
                            } else {
                              // 全ての問題が終了
                              // 最後の問題の間違えた記録が反映されるように、少し待ってから判定
                              setTimeout(() => {
                                if (wrongQuestions.length > 0 && !isReviewMode) {
                                  // 間違えた問題がある場合は復習モードを開始
                                  startReviewMode(wrongQuestions);
                                } else if (wrongQuestions.length === 0 && isReviewMode) {
                                  // 復習モードで全問正解
                                  console.log('復習モード → 全問正解');
                                  setChat(prev => [
                                    ...prev,
                                    { sender: 'sensei', text: 'おめでとうございます！全問正解です！', face: 'tai-good1' }
                                  ]);
                                  setWrongQuestions([]); // 全問正解時に間違えた問題リストをクリア
                                  setIsFinished(true);
                                } else if (wrongQuestions.length > 0 && isReviewMode) {
                                  // 復習モードで間違えた問題がある場合は次の復習ラウンドを開始
                                  console.log('復習モード → 次の復習ラウンド開始');
                                  startReviewMode(wrongQuestions); // 間違えた問題リストを直接渡す
                                } else {
                                  // 通常の終了
                                  console.log('通常の終了');
                                  setChat(prev => [
                                    ...prev,
                                    { sender: 'sensei', text: '全ての問題が終了しました！お疲れさまでした。', face: 'tai-normal' }
                                  ]);
                                  setIsFinished(true);
                                }
                              }, 100); // 100ms待ってから判定
                            }
                          }, 1500); // 正解表示から1.5秒後に次の処理
                        }}
                      >
                        わからない
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
              <div ref={chatEndRef} />
          </div>

          {/* 入力エリア - カテゴリ選択中は非表示 */}
          {!showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && (
            <>
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
        </>
      )}
    </div>
    </>
  );
}

export default App;
