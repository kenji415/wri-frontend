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

  // 小分類選択用state
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [showSubCategoryButtons, setShowSubCategoryButtons] = useState(false);

  // レベル選択用state
  const [showLevelButtons, setShowLevelButtons] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // 問題数選択用state
  const [showQuestionCountButtons, setShowQuestionCountButtons] = useState(false);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(null);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [customQuestionCount, setCustomQuestionCount] = useState('');
  const [isRandomOrder, setIsRandomOrder] = useState(false);

  // おぼえるモード用state
  const [isMemorizeMode, setIsMemorizeMode] = useState(false);
  const [memorizePhase, setMemorizePhase] = useState('study'); // 'study' | 'test' | 'review'
  const [memorizeTimer, setMemorizeTimer] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [memorizeProgress, setMemorizeProgress] = useState({
    currentQuestionIndex: 0,
    studyQuestions: [],
    phase: 'study', // 'study' or 'review'
    reviewStartIndex: 0,
    totalQuestions: 0
  });

  // 復習モード用state
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);

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
        
        // 先生の質問を表示（チャット履歴は非表示）
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

  // 詳細カテゴリが選択されたら、小分類選択を表示
  useEffect(() => {
    if (selectedDetailCategory && originalQuestions.length > 0) {
      console.log('Filtering by detail category:', selectedDetailCategory);
      console.log('Original questions count:', originalQuestions.length);
      
      // 中分類でフィルタリング
      const filteredByDetail = originalQuestions.filter(q => q.detailCategory === selectedDetailCategory);
      console.log('Questions after detail category filtering:', filteredByDetail.length);
      console.log('Sample questions after detail filtering:', filteredByDetail.slice(0, 3));
      
              // 小分類を抽出（重複を除去、空文字列は除外）
        const uniqueSubCategories = [...new Set(filteredByDetail.map(q => q.subCategory).filter(sub => sub && sub.trim() !== ''))];
        console.log('uniqueSubCategories:', uniqueSubCategories);
        
        // 問題データの詳細を確認
        console.log('Sample questions with subCategory:', filteredByDetail.slice(0, 5).map(q => ({
          id: q.id,
          question: q.question,
          detailCategory: q.detailCategory,
          subCategory: q.subCategory,
          level: q.level,
          // 全てのフィールドを確認
          allFields: Object.keys(q)
        })));
        
        // 小分類の値を詳しく確認
        console.log('SubCategory values:', filteredByDetail.map(q => ({
          id: q.id,
          subCategory: q.subCategory,
          subCategoryType: typeof q.subCategory,
          subCategoryLength: q.subCategory ? q.subCategory.length : 0
        })));
        
        // 全てのフィールドの値を確認
        console.log('All field values for first question:', Object.entries(filteredByDetail[0] || {}));
      
      if (uniqueSubCategories.length > 1) {
        // 小分類が複数ある場合は小分類選択を表示
        setSubCategories(uniqueSubCategories);
        setShowSubCategoryButtons(true);
        setShowCategoryButtons(false);
        console.log('Sub categories found, showing sub category selection');
      } else if (uniqueSubCategories.length === 1) {
        // 小分類が1つしかない場合は直接レベル選択へ
        setQuestions(filteredByDetail);
        setExpandedCategory(selectedDetailCategory);
        console.log('expandedCategory set to:', selectedDetailCategory);
        console.log('Single sub category, proceeding to level selection');
      } else {
        // 小分類が入力されていない場合は直接レベル選択へ
        setQuestions(filteredByDetail);
        setExpandedCategory(selectedDetailCategory);
        console.log('expandedCategory set to:', selectedDetailCategory);
        console.log('No sub categories, proceeding to level selection');
      }
    }
  }, [selectedDetailCategory, originalQuestions.length, selectedGenre]);

  // 小分類が選択されたら、レベル選択を表示
  useEffect(() => {
    if (selectedSubCategory && originalQuestions.length > 0) {
      console.log('Filtering by sub category:', selectedSubCategory);
      console.log('Original questions count:', originalQuestions.length);
      
      // 小分類でフィルタリング
      const filteredBySub = originalQuestions.filter(q => 
        q.detailCategory === selectedDetailCategory && 
        q.subCategory === selectedSubCategory
      );
      console.log('Questions after sub category filtering:', filteredBySub.length);
      console.log('Sample questions after sub filtering:', filteredBySub.slice(0, 3));
      
      setQuestions(filteredBySub);
      setExpandedCategory(selectedSubCategory);
      // setShowSubCategoryButtons(false); // この行を削除して、小分類ボタンを表示したままにする
      console.log('expandedCategory set to:', selectedSubCategory);
      console.log('Sub category selected, proceeding to level selection');
      
      // 新しいチャットメッセージは追加せず、既存のメッセージの下にレベルボタンを展開
    }
  }, [selectedSubCategory, originalQuestions.length, selectedDetailCategory, selectedGenre]);

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
      setExpandedCategory(null);
      setShowCategoryButtons(false);
      setShowQuestionCountButtons(true);
      setSelectedQuestionCount(null); // 問題数選択をリセット
      
      // 先生の質問を追加
      setChat(prev => [
        ...prev,
        { 
          sender: 'sensei', 
          text: `はりきっていこかー！何問やる？`, 
          face: 'tai-normal',
          showQuestionCountButtons: true,
          questionCountButtons: [
            '全部'
          ]
        }
      ]);
    }
  }, [selectedLevel, selectedGenre, selectedDetailCategory]);

  // 問題数が選択された時の処理
  useEffect(() => {
    console.log('問題数選択useEffect実行 - selectedQuestionCount:', selectedQuestionCount, 'questions.length:', questions.length);
    console.log('useEffect実行時のスタックトレース:', new Error().stack);
    if (selectedQuestionCount) {
      console.log('問題数選択:', selectedQuestionCount, '問題数:', questions.length);
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
      // selectedQuestionCountは保持する（リセットしない）
      console.log('最終問題数:', finalQuestions.length);
      
      // おぼえるモードの場合の特別な処理
      if (isMemorizeMode) {
        setMemorizeProgress({
          currentQuestionIndex: 0,
          studyQuestions: finalQuestions,
          phase: 'study', // 'study' or 'review'
          reviewStartIndex: 0,
          totalQuestions: finalQuestions.length
        });
        setMemorizePhase('study');
        setShowAnswer(true);
        
        // おぼえるモード開始メッセージと最初の問題・解答を同時に表示
        setChat(prev => [
          ...prev,
          { 
            sender: 'sensei', 
            text: `今から問題と解答を5秒間だけみせるから、おぼえてな。\n正解したらどんどん次の問題にいくで。\nただ、途中細かく復習も入れてくよ。\nすこしずつ覚えていこなー！`, 
            face: 'tai-normal' 
          },
          { 
            sender: 'sensei', 
            text: finalQuestions[0].question, 
            face: 'tai-normal',
            isQuestion: true,
            showMemorizeAnswer: true, // おぼえるモード用のフラグ
            isMemorizeQuestionDisplay: true, // 問題表示フラグを追加
            isNextQuestion: true // 次の問題フラグを追加
          }
        ]);
        
        // 5秒後に解答を非表示
        setTimeout(() => {
          setShowAnswer(false);
          // チャット履歴を更新して解答表示フラグを削除
          setChat(prev => prev.map(msg => 
            msg.showMemorizeAnswer ? { ...msg, showMemorizeAnswer: false } : msg
          ));
        }, 5000);
      } else {
        // 通常モード
        setChat(prev => [
          ...prev,
          { 
            sender: 'sensei', 
            text: `ほなはじめるで～`, 
            face: 'tai-normal' 
          }
        ]);
      }
    }
  }, [selectedQuestionCount, selectedLevel, isRandomOrder, isMemorizeMode]);

  // 問題が切り替わったらチャット履歴をリセットし、先生の出題を追加
  useEffect(() => {
    if (questions.length > 0 && !showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && selectedLevel && selectedQuestionCount && currentIndex === 0 && !isReviewMode && !isMemorizeMode) {
      // 1秒待ってから第一問を表示
      setTimeout(() => {
        console.log('🔍 第一問表示デバッグ:', {
          currentIndex,
          question: questions[currentIndex],
          questionsLength: questions.length
        });
        
        setChat(prev => [
          ...prev,
          { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
        ]);
        clearCanvas();
        setInputText('');
        setRecognizedText('');
        
        // 次の問題の画像をプリロード
        if (questions[currentIndex + 1] && questions[currentIndex + 1].questionImageUrl) {
          const img = new Image();
          img.src = convertGoogleDriveUrl(questions[currentIndex + 1].questionImageUrl);
        }
              }, 1000);
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, showCategoryButtons, showLevelButtons, showQuestionCountButtons, selectedDetailCategory, selectedLevel, selectedQuestionCount, isReviewMode, isMemorizeMode]);

  // 次の問題への移行
  useEffect(() => {
    console.log('次の問題表示useEffect実行 - 条件チェック:');
    console.log('questions.length > 0:', questions.length > 0);
    console.log('!showCategoryButtons:', !showCategoryButtons);
    console.log('!showLevelButtons:', !showLevelButtons);
    console.log('!showQuestionCountButtons:', !showQuestionCountButtons);
    console.log('selectedLevel:', selectedLevel);
    console.log('selectedQuestionCount:', selectedQuestionCount);
    console.log('currentIndex > 0:', currentIndex > 0);
    console.log('!isReviewMode:', !isReviewMode);
    console.log('!isMemorizeMode:', !isMemorizeMode);
    
    if (questions.length > 0 && !showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && selectedLevel && selectedQuestionCount && currentIndex > 0 && !isReviewMode && !isMemorizeMode) {
      console.log('次の問題表示処理開始 - currentIndex:', currentIndex);
      console.log('表示する問題:', questions[currentIndex]);
      
      // デバッグ用ログを追加
      console.log('🔍 次の問題表示デバッグ:', {
        currentIndex,
        question: questions[currentIndex],
        questionsLength: questions.length
      });
      
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
      
      // 次の問題の画像をプリロード
      if (questions[currentIndex + 1] && questions[currentIndex + 1].questionImageUrl) {
        const img = new Image();
        img.src = convertGoogleDriveUrl(questions[currentIndex + 1].questionImageUrl);
      }
    } else {
      console.log('条件が満たされていません');
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, showCategoryButtons, showLevelButtons, showQuestionCountButtons, selectedDetailCategory, selectedLevel, selectedQuestionCount, isReviewMode, isMemorizeMode]);

  // 復習モードでの問題出題
  useEffect(() => {
    console.log('🔄 復習モード問題表示useEffect発火:', {
      isReviewMode,
      questionsLength: questions.length,
      currentIndex,
      questions: questions
    });
    
    if (isReviewMode && questions.length > 0 && currentIndex >= 0) {
      console.log('✅ 復習モード - 問題表示:', currentIndex);
      console.log('表示する問題:', questions[currentIndex]);
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: questions[currentIndex].question, face: 'tai-normal', isQuestion: true }
      ]);
      clearCanvas();
      setInputText('');
      setRecognizedText('');
      
      // 次の問題の画像をプリロード
      if (questions[currentIndex + 1] && questions[currentIndex + 1].questionImageUrl) {
        const img = new Image();
        img.src = convertGoogleDriveUrl(questions[currentIndex + 1].questionImageUrl);
      }
    } else {
      console.log('❌ 復習モード問題表示条件不成立:', {
        isReviewMode,
        questionsLength: questions.length,
        currentIndex
      });
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length, isReviewMode]);

  // おぼえるモードでの問題出題
  useEffect(() => {
    console.log('🧠 おぼえるモード問題表示useEffect発火:', {
      isMemorizeMode,
      memorizeProgress,
      questionsLength: questions.length
    });
    
    // おぼえるモードの回答処理で問題を表示した場合は、useEffectを発火させない
    const lastMessage = chat[chat.length - 1];
    const isMemorizeAnswerDisplayed = lastMessage && lastMessage.showMemorizeAnswer;
    const isMemorizeQuestionDisplayed = lastMessage && lastMessage.isMemorizeQuestionDisplay;
    const isRetryQuestion = lastMessage && lastMessage.isRetryQuestion;
    const isNextQuestion = lastMessage && lastMessage.isNextQuestion;
    const isTestQuestion = lastMessage && lastMessage.isTestQuestion;
    
    // デバッグ用ログを追加
    console.log('🔍 おぼえるモード問題表示条件チェック:', {
      isMemorizeAnswerDisplayed,
      isMemorizeQuestionDisplayed,
      isRetryQuestion,
      isNextQuestion,
      isTestQuestion
    });
    
    if (isMemorizeMode && 
        memorizeProgress.studyQuestions.length > 0 && 
        !showCategoryButtons && 
        !showLevelButtons && 
        !showQuestionCountButtons && 
        selectedLevel && 
        selectedQuestionCount && 
        !isMemorizeAnswerDisplayed && 
        !isMemorizeQuestionDisplayed && 
        !isRetryQuestion && 
        !isNextQuestion && 
        !isTestQuestion) {
      
      console.log('✅ おぼえるモード - 問題表示:', memorizeProgress.currentQuestionIndex);
      
      // おぼえるモードでは、memorizeProgressから正しい問題を取得
      const { currentQuestionIndex, studyQuestions, phase } = memorizeProgress;
      const memorizeQuestion = studyQuestions[currentQuestionIndex];
      
      console.log('表示する問題:', memorizeQuestion);
      
      // デバッグ用ログを追加
      console.log('🔍 おぼえるモード問題表示デバッグ:', {
        currentQuestionIndex,
        memorizeQuestion,
        studyQuestionsLength: studyQuestions.length,
        phase
      });
      
      // STUDYフェーズの場合は解答表示あり、REVIEWフェーズの場合は解答表示なし
      if (phase === 'study') {
        setShowAnswer(true);
        setChat(prev => [
          ...prev,
          { 
            sender: 'sensei', 
            text: memorizeQuestion.question, 
            face: 'tai-normal', 
            isQuestion: true,
            showMemorizeAnswer: true,
            isMemorizeQuestionDisplay: true,
            isNextQuestion: true
          }
        ]);
        
        // 5秒後に解答を非表示
        setTimeout(() => {
          setShowAnswer(false);
          setChat(prev => prev.map(msg => 
            msg.showMemorizeAnswer ? { ...msg, showMemorizeAnswer: false } : msg
          ));
        }, 5000);
      } else if (phase === 'review') {
        // REVIEWフェーズの場合は解答表示なし
        // 再チェック開始時（currentQuestionIndex === reviewStartIndex）の場合はメッセージを追加
        if (currentQuestionIndex === memorizeProgress.reviewStartIndex) {
          setChat(prev => [
            ...prev,
            { 
              sender: 'sensei', 
              text: '3問前から再チェックするよ！', 
              face: 'tai-normal'
            },
            { 
              sender: 'sensei', 
              text: memorizeQuestion.question, 
              face: 'tai-normal', 
              isQuestion: true,
              isMemorizeQuestionDisplay: true,
              isNextQuestion: true
            }
          ]);
        } else {
          setChat(prev => [
            ...prev,
            { 
              sender: 'sensei', 
              text: memorizeQuestion.question, 
              face: 'tai-normal', 
              isQuestion: true,
              isMemorizeQuestionDisplay: true,
              isNextQuestion: true
            }
          ]);
        }
      }
      
      clearCanvas();
      setInputText('');
      setRecognizedText('');
      
      // 次の問題の画像をプリロード
      if (studyQuestions[currentQuestionIndex + 1] && studyQuestions[currentQuestionIndex + 1].questionImageUrl) {
        const img = new Image();
        img.src = convertGoogleDriveUrl(studyQuestions[currentQuestionIndex + 1].questionImageUrl);
      }
    } else {
      console.log('❌ おぼえるモード問題表示条件不成立:', {
        isMemorizeMode,
        studyQuestionsLength: memorizeProgress.studyQuestions.length,
        showCategoryButtons,
        showLevelButtons,
        showQuestionCountButtons,
        selectedLevel,
        selectedQuestionCount,
        isMemorizeAnswerDisplayed,
        isMemorizeQuestionDisplayed,
        isRetryQuestion,
        isNextQuestion,
        isTestQuestion
      });
    }
    // eslint-disable-next-line
  }, [memorizeProgress.currentQuestionIndex, memorizeProgress.studyQuestions.length, memorizeProgress.phase, isMemorizeMode, showCategoryButtons, showLevelButtons, showQuestionCountButtons, selectedLevel, selectedQuestionCount]);

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

  // 小分類選択時に自動スクロール
  useEffect(() => {
    if (selectedSubCategory && chatEndRef.current) {
      // 少し待ってからスクロール（UIの更新を待つ）
      setTimeout(() => {
        chatEndRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [selectedSubCategory]);

  // レベル選択時に自動スクロール
  useEffect(() => {
    if (selectedLevel && chatEndRef.current) {
      // 少し待ってからスクロール（UIの更新を待つ）
      setTimeout(() => {
        chatEndRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [selectedLevel]);

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

  // 音声再生関数
  const playSound = (soundType) => {
    try {
      const audio = new Audio(`/sounds/${soundType}.mp3`);
      audio.volume = 0.5; // 音量を50%に設定
      audio.play().catch(error => {
        console.log('音声再生エラー:', error);
      });
    } catch (error) {
      console.log('音声ファイル読み込みエラー:', error);
    }
  };

  // ボタンクリック音再生関数
  const playButtonSound = () => {
    playSound('push');
  };

  // 解答判定関数（複数形式対応・順番判定対応）
  const checkAnswer = (userAnswer, correctAnswer, currentQuestion = null) => {
    // 前後の空白を除去
    const cleanUserAnswer = userAnswer.trim();
    const cleanCorrectAnswer = correctAnswer.trim();
    
    // 順番判定が必要かどうかをチェック
    const isOrderRequired = currentQuestion && currentQuestion.type && currentQuestion.type === '順番';
    
    // デバッグ用ログ
    console.log('🔍 解答判定:', {
      userAnswer: cleanUserAnswer,
      correctAnswer: cleanCorrectAnswer,
      isOrderRequired,
      questionType: currentQuestion?.type,
      questionId: currentQuestion?.id
    });
    
    // 正解例を/で分割して配列に変換
    const correctAnswers = cleanCorrectAnswer
      .split('/')
      .map(answer => answer.trim())
      .filter(answer => answer.length > 0);
    
    // ユーザーの回答が正解例のいずれかと一致するかチェック（単一回答の場合）
    for (const correctAnswer of correctAnswers) {
      if (cleanUserAnswer === correctAnswer) {
        return true;
      }
    }
    
    // 複数回答の場合（カンマ区切りなど）の処理
    const normalizeAnswer = (answer, keepOrder = false) => {
      // 様々な区切り文字で分割（、,、,、スペース、全角スペース）
      const items = answer
        .split(/[、,，\s　]+/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      // 順番が必要な場合はソートしない、そうでなければソート
      return keepOrder ? items : items.sort();
    };
    
    const userAnswers = normalizeAnswer(cleanUserAnswer, isOrderRequired);
    
    // 各正解例に対して複数回答の比較を実行
    for (const correctAnswer of correctAnswers) {
      const correctAnswerArray = normalizeAnswer(correctAnswer, isOrderRequired);
      
      // 配列の長さが異なる場合はスキップ
      if (userAnswers.length !== correctAnswerArray.length) {
        continue;
      }
      
      // 順番を考慮した比較
      let isMatch = true;
      for (let i = 0; i < userAnswers.length; i++) {
        if (userAnswers[i] !== correctAnswerArray[i]) {
          isMatch = false;
          break;
        }
      }
      
      if (isMatch) {
        return true;
      }
    }
    
    return false;
  };

  // 回答送信
  const handleSend = () => {
    if (!inputText || isFinished) return;
    
    // おぼえるモードでは、memorizeProgressから正しい問題を取得
    let currentQuestion, answer;
    if (isMemorizeMode) {
      const { currentQuestionIndex, studyQuestions } = memorizeProgress;
      currentQuestion = studyQuestions[currentQuestionIndex];
      answer = currentQuestion.answer.trim();
    } else {
      currentQuestion = questions[currentIndex];
      answer = currentQuestion.answer.trim();
    }
    
    // デバッグ用ログを追加
    console.log('🔍 回答送信デバッグ:', {
      currentIndex,
      inputText,
      currentQuestion: {
        id: currentQuestion.id,
        question: currentQuestion.question,
        answer: currentQuestion.answer
      },
      questionsLength: questions.length,
      isMemorizeMode
    });
    
    const isCorrect = checkAnswer(inputText, answer, currentQuestion);
    
    // 音声再生
    playSound(isCorrect ? 'correct' : 'wrong');
    
    let face = 'tai-normal';
    if (isCorrect) {
      const goodNum = Math.floor(Math.random() * 5) + 1;
      face = `tai-good${goodNum}`;
    } else {
      const badNum = Math.floor(Math.random() * 4) + 1;
      face = `tai-bad${badNum}`;
    }
    // 正解表示用のテキストを取得（複数正解例がある場合は最初のものを表示）
    const displayAnswer = answer.split('/')[0].trim();
    
    setChat(prev => [
      ...prev,
      { sender: 'seito', text: inputText },
      { sender: 'sensei', text: isCorrect ? '正解！' : `不正解… 正解は「${displayAnswer}」`, face }
    ]);
    setEffect(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setEffect('none'), 500);
    
    // 間違えた問題を記録
    if (!isCorrect) {
      recordWrongQuestion(questions[currentIndex]);
    }
    
    // 回答記録を送信
    let questionId;
    if (isRandomOrder && currentQuestion.originalIndex !== undefined) {
      questionId = originalQuestions[currentQuestion.originalIndex].id;
    } else {
      questionId = currentQuestion.id;
    }
    recordAnswer(questionId, isCorrect);
    
    // おぼえるモードの場合の特別な処理
    if (isMemorizeMode) {
      // おぼえるモードでは、memorizeProgressから正しい問題を取得
      const { currentQuestionIndex, studyQuestions } = memorizeProgress;
      const memorizeQuestion = studyQuestions[currentQuestionIndex];
      console.log('🧠 おぼえるモード選択肢回答デバッグ:', {
        currentQuestionIndex,
        memorizeQuestion,
        currentQuestion
      });
      handleMemorizeModeAnswer(isCorrect, memorizeQuestion);
    } else {
      // 正解表示後に少し待ってから次の問題へ
      setTimeout(() => {
        console.log('次の問題への移行処理開始');
        console.log('現在のインデックス:', currentIndex);
        console.log('問題数:', questions.length);
        console.log('次の問題があるか:', currentIndex + 1 < questions.length);
        
        if (currentIndex + 1 < questions.length) {
          // 次の問題を表示
          console.log('次の問題に移行します');
          setCurrentIndex(prev => {
            console.log('currentIndex更新:', prev, '→', prev + 1);
            return prev + 1;
          });
        } else {
          // 全ての問題が終了
          console.log('全ての問題が終了しました');
          setQuestions([]); // ここでquestionsを空にする
          // setTimeoutでの復習ラウンド判定はuseEffectに一元化したのでここでは何もしない
        }
      }, 1500); // 正解表示から1.5秒後に次の処理
    }
    
    // 入力フィールドをクリア
    setInputText('');
    setRecognizedText('');
    clearCanvas(false);
  };

  // おぼえるモードの回答処理
  const handleMemorizeModeAnswer = (isCorrect, currentQuestion) => {
    setMemorizeProgress(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      
      // REVIEWフェーズ
      if (prev.phase === 'review') {
        // 3問分進める
        if (nextIndex < prev.reviewStartIndex + 3 && nextIndex < prev.studyQuestions.length) {
          return {
            ...prev,
            currentQuestionIndex: nextIndex
          };
        } else {
          // review終わったらstudyに戻す
          const nextStudyIndex = prev.reviewStartIndex + 3;
          
          return {
            ...prev,
            phase: 'study',
            currentQuestionIndex: nextStudyIndex
          };
        }
      }
      // STUDYフェーズ
      if (prev.phase === 'study') {
        // 3問ごとにreviewへ
        if (nextIndex % 3 === 0 && nextIndex < prev.studyQuestions.length) {
          const restartIndex = nextIndex - 3;
          
          return {
            ...prev,
            phase: 'review',
            reviewStartIndex: restartIndex,
            currentQuestionIndex: restartIndex
          };
        }
        // 最後まで行ったらテストフェーズへ
        if (nextIndex >= prev.studyQuestions.length) {
          // テストフェーズ移行処理（必要なら追加）
          return prev;
        }
        // 通常は次へ
        return {
          ...prev,
          currentQuestionIndex: nextIndex
        };
      }
      return prev;
    });
  };

  // おぼえるモード完了処理
  const handleMemorizeModeComplete = () => {
    setChat(prev => [
      ...prev,
      { 
        sender: 'sensei', 
        text: '全チェックテスト！', 
        face: 'tai-normal'
      }
    ]);
    // ここで全問題の最終テストを開始
    setMemorizePhase('review');
    setMemorizeProgress(prev => ({
      ...prev,
      reviewQuestions: [...prev.studyQuestions],
      currentQuestionIndex: 0
    }));
  };

  // 復習モードを開始する関数
  const startReviewMode = () => {
    setIsReviewMode(true);
  };

  // 復習モード開始時の処理（年号アプリのシンプルな実装を参考）
  useEffect(() => {
    if (isReviewMode && questions.length === 0 && wrongQuestions.length > 0) {
      console.log('🔄 復習モード開始:', {
        wrongQuestionsLength: wrongQuestions.length
      });
      
      // 間違えた問題をquestionsにセット
      setQuestions([...wrongQuestions]);
      setCurrentIndex(0);
      setWrongQuestions([]); // 間違えた問題リストをクリア
      
      // 復習メッセージを表示（1回だけ）
      setChat(prev => [
        ...prev,
        { sender: 'sensei', text: '間違ってたとこ、もっかいいこ～！', face: 'tai-normal' }
      ]);
    }
  }, [isReviewMode, questions.length, wrongQuestions.length]);

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

  // 選択肢ボタンをクリックした時の処理
  const handleChoiceClick = (selectedChoice) => {
    console.log('🎯 回答処理開始:', {
      selectedChoice,
      isReviewMode,
      questionsLength: questions.length,
      currentIndex,
      wrongQuestionsLength: wrongQuestions.length
    });
    
    if (isFinished) return;
    
    // おぼえるモードでは、memorizeProgressから正しい問題を取得
    let currentQuestion, answer;
    if (isMemorizeMode) {
      const { currentQuestionIndex, studyQuestions } = memorizeProgress;
      currentQuestion = studyQuestions[currentQuestionIndex];
      answer = currentQuestion.answer.trim();
    } else {
      currentQuestion = questions[currentIndex];
      answer = currentQuestion.answer.trim();
    }
    
    // デバッグ用ログを追加
    console.log('🔍 選択肢回答デバッグ:', {
      currentIndex,
      selectedChoice,
      currentQuestion: {
        id: currentQuestion.id,
        question: currentQuestion.question,
        answer: currentQuestion.answer
      },
      questionsLength: questions.length,
      isMemorizeMode
    });
    
    const isCorrect = checkAnswer(selectedChoice, answer, currentQuestion);
    
    // 音声再生
    playSound(isCorrect ? 'correct' : 'wrong');
    
    let face = 'tai-normal';
    if (isCorrect) {
      const goodNum = Math.floor(Math.random() * 5) + 1;
      face = `tai-good${goodNum}`;
    } else {
      const badNum = Math.floor(Math.random() * 4) + 1;
      face = `tai-bad${badNum}`;
    }
    
    // 正解表示用のテキストを取得（複数正解例がある場合は最初のものを表示）
    const displayAnswer = answer.split('/')[0].trim();
    
    setChat(prev => [
      ...prev,
      { sender: 'seito', text: selectedChoice },
      { sender: 'sensei', text: isCorrect ? '正解！' : `不正解… 正解は「${displayAnswer}」`, face }
    ]);
    setEffect(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setEffect('none'), 500);
    
    // 間違えた問題を記録
    if (!isCorrect) {
      recordWrongQuestion(currentQuestion);
    }
    
    // 復習モードで正解した場合は、questionsから削除（年号アプリのシンプルな実装）
    if (isCorrect && isReviewMode) {
      console.log('復習モード - 正解した問題を削除:', currentQuestion.id);
      setQuestions(prev => {
        const newQuestions = prev.filter(q => q.id !== currentQuestion.id);
        console.log('削除後のquestions:', newQuestions);
        return newQuestions;
      });
      // 復習モードで問題を削除した場合、currentIndexを調整
      if (currentIndex >= questions.length - 1) {
        setCurrentIndex(0);
      }
    } else if (isCorrect) {
      // 通常モードで正解した場合も、復習モードで再度出題されるようにwrongQuestionsから削除
      setWrongQuestions(prev => {
        const newWrongQuestions = prev.filter(q => q.id !== currentQuestion.id);
        console.log('通常モード正解 - wrongQuestionsから削除:', newWrongQuestions);
        return newWrongQuestions;
      });
    }
    
    // 回答記録を送信
    let questionId;
    if (isRandomOrder && currentQuestion.originalIndex !== undefined) {
      questionId = originalQuestions[currentQuestion.originalIndex].id;
    } else {
      questionId = currentQuestion.id;
    }
    recordAnswer(questionId, isCorrect);
    
    // 正解表示後に少し待ってから次の問題へ
      setTimeout(() => {
      console.log('次の問題への移行処理開始');
      console.log('現在のインデックス:', currentIndex);
      console.log('問題数:', questions.length);
      console.log('次の問題があるか:', currentIndex + 1 < questions.length);
      
      if (currentIndex + 1 < questions.length) {
        // 次の問題を表示
        console.log('次の問題に移行します');
        setCurrentIndex(prev => {
          console.log('currentIndex更新:', prev, '→', prev + 1);
          return prev + 1;
        });
      } else {
        // 全ての問題が終了
        console.log('全ての問題が終了しました');
        setQuestions([]); // ここでquestionsを空にする
        // setTimeoutでの復習ラウンド判定はuseEffectに一元化したのでここでは何もしない
      }
    }, 1500); // 正解表示から1.5秒後に次の処理
    
    // 入力フィールドをクリア
    setInputText('');
    setRecognizedText('');
    clearCanvas(false);
  };

  // Google DriveのURLを直接画像URLに変換する関数
  const convertGoogleDriveUrl = (url) => {
    if (!url) return '';
    
    // Google Driveの共有リンクを直接画像URLに変換
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const fileId = match[1];
      // バックエンドのAPIを使用して画像を取得
      return `https://wri-flask-backend.onrender.com/api/get_image/${fileId}`;
    }
    
    return url;
  };

  // 選択肢を取得する関数
  const getChoices = (question) => {
    const choices = [];
    for (let i = 1; i <= 7; i++) {
      const choice = question[`choice${i}`];
      if (choice && choice.trim()) {
        choices.push(choice.trim());
      }
    }
    return choices;
  };

  // 現在の問題が選択肢問題かどうかを判定
  const isChoiceQuestion = (question) => {
    return question && question.type === '選択肢';
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

  // 状態変更の監視用useEffect
  useEffect(() => {
    console.log('🔍 状態変更監視 - isReviewMode:', isReviewMode);
  }, [isReviewMode]);

  useEffect(() => {
    console.log('🔍 状態変更監視 - questions:', questions.length, 'questions:', questions);
  }, [questions]);

  useEffect(() => {
    console.log('🔍 状態変更監視 - wrongQuestions:', wrongQuestions.length, 'wrongQuestions:', wrongQuestions);
  }, [wrongQuestions]);

  useEffect(() => {
    console.log('🔍 状態変更監視 - currentIndex:', currentIndex);
  }, [currentIndex]);

  // 復習モードのラウンド遷移をuseEffectで管理
  useEffect(() => {
    console.log('復習ラウンド遷移useEffect実行:', {
      isReviewMode,
      questionsLength: questions.length,
      wrongQuestionsLength: wrongQuestions.length,
      questions: questions
    });
    
    // 通常モード終了時に復習モードへ
    if (!isReviewMode && questions.length === 0 && wrongQuestions.length > 0) {
      console.log('通常モード終了→復習モード開始:', wrongQuestions);
      startReviewMode();
      return;
    }
    
    // 復習モードのラウンド遷移（年号アプリのシンプルな実装）
    if (isReviewMode && questions.length === 0) {
      console.log('復習モード - questionsが空になった');
      
      if (wrongQuestions.length === 0) {
        console.log('復習モード終了 - 全問正解');
        setChat(prev => [
          ...prev,
          { sender: 'sensei', text: 'よーがんばったね！これで完璧', face: 'tai-good1' }
        ]);
        setIsFinished(true);
        setIsReviewMode(false);
        // 復習モード終了後は問題をクリアして終了状態を維持（年号アプリの実装を参考）
        setQuestions([]);
        setCurrentIndex(0);
      } else {
        console.log('復習モード継続 - まだ間違えた問題がある');
        // 間違えた問題をquestionsにセットして復習継続
        setQuestions([...wrongQuestions]);
        setCurrentIndex(0);
        setWrongQuestions([]); // 間違えた問題リストをクリア
      }
    }
  }, [questions.length, wrongQuestions.length, isReviewMode]);

  // ジャンル選択
  const handleGenreSelect = (genre) => {
    playButtonSound(); // ボタンクリック音
    setSelectedGenre(genre);
    setShowCategoryButtons(false);
    setShowLevelButtons(true);
  };

  // レベル選択
  const handleLevelSelect = (level) => {
    playButtonSound(); // ボタンクリック音
    setSelectedLevel(level);
    setShowLevelButtons(false);
    setShowQuestionCountButtons(true);
  };

  // 戻るボタン
  const handleBack = () => {
    playButtonSound(); // ボタンクリック音
    if (showQuestionCountButtons) {
      setShowQuestionCountButtons(false);
      setShowLevelButtons(true);
      setSelectedQuestionCount(null);
    } else if (showLevelButtons) {
      setShowLevelButtons(false);
      if (showSubCategoryButtons) {
        setShowSubCategoryButtons(true);
        setSelectedLevel(null);
      } else {
        setShowCategoryButtons(true);
        setSelectedLevel(null);
      }
    } else if (showSubCategoryButtons) {
      setShowSubCategoryButtons(false);
      setShowCategoryButtons(true);
      setSelectedSubCategory(null);
    } else if (showCategoryButtons) {
      setShowCategoryButtons(false);
      setShowTop(true);
      setSelectedGenre(null);
    }
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
                onClick={() => { handleGenreSelect('地理'); setShowTop(false); }}
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
                onClick={() => { handleGenreSelect('歴史'); setShowTop(false); }}
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
                onClick={() => { handleGenreSelect('公民'); setShowTop(false); }}
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
                        <div key={index}>
                          <button
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
                              console.log('Category clicked:', category);
                              setSelectedDetailCategory(category);
                            }}
                          >
                            {category}
                          </button>
                          
                          {/* 小分類選択ボタン */}
                          {showSubCategoryButtons && selectedDetailCategory === category && (
                            <div style={{
                              marginTop: 4,
                              marginLeft: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}>
                              {subCategories.map((subCategory, subIndex) => (
                                <div key={subIndex}>
                                  <button
                                    style={{
                                      background: '#90CAF9',
                                      color: '#01579b',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '6px 10px',
                                      fontSize: 12,
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      transition: 'all 0.2s ease',
                                      width: '100%',
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
                                      console.log('Sub category clicked:', subCategory);
                                      setSelectedSubCategory(subCategory);
                                    }}
                                  >
                                    {subCategory}
                                  </button>
                                  
                                  {/* 小分類選択後のレベルボタン */}
                                  {expandedCategory === subCategory && (
                                    <div style={{
                                      marginTop: 4,
                                      marginLeft: 16,
                                      display: 'flex',
                                      flexDirection: 'row',
                                      gap: 8,
                                    }}>
                                      <button
                                        style={{
                                          background: '#90CAF9',
                                          color: '#01579b',
                                          border: 'none',
                                          borderRadius: 6,
                                          padding: '6px 10px',
                                          fontSize: 12,
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                          transition: 'all 0.2s ease',
                                          width: '100%',
                                        }}
                                        onMouseOver={(e) => {
                                          e.target.style.background = '#64B5F6';
                                          e.target.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseOut={(e) => {
                                          e.target.style.background = '#90CAF9';
                                          e.target.style.transform = 'translateY(0)';
                                        }}
                                        onClick={() => handleLevelSelect('レベル1')}
                                      >
                                        基礎
                                      </button>
                                      <button
                                        style={{
                                          background: '#90CAF9',
                                          color: '#01579b',
                                          border: 'none',
                                          borderRadius: 6,
                                          padding: '6px 10px',
                                          fontSize: 12,
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                          transition: 'all 0.2s ease',
                                          width: '100%',
                                        }}
                                        onMouseOver={(e) => {
                                          e.target.style.background = '#64B5F6';
                                          e.target.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseOut={(e) => {
                                          e.target.style.background = '#90CAF9';
                                          e.target.style.transform = 'translateY(0)';
                                        }}
                                        onClick={() => handleLevelSelect('レベル2')}
                                      >
                                        標準
                                      </button>
                                      <button
                                        style={{
                                          background: '#90CAF9',
                                          color: '#01579b',
                                          border: 'none',
                                          borderRadius: 6,
                                          padding: '6px 10px',
                                          fontSize: 12,
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                          transition: 'all 0.2s ease',
                                          width: '100%',
                                        }}
                                        onMouseOver={(e) => {
                                          e.target.style.background = '#64B5F6';
                                          e.target.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseOut={(e) => {
                                          e.target.style.background = '#90CAF9';
                                          e.target.style.transform = 'translateY(0)';
                                        }}
                                        onClick={() => handleLevelSelect('レベル3')}
                                      >
                                        応用
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* 展開されたカテゴリのレベルボタン */}
                          {expandedCategory === category && (
                            <div style={{
                              marginTop: 4,
                              marginLeft: 16,
                              display: 'flex',
                              flexDirection: 'row',
                              gap: 8,
                            }}>
                              <button
                                style={{
                                  background: '#90CAF9',
                                  color: '#01579b',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                  transition: 'all 0.2s ease',
                                  width: '100%',
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.background = '#64B5F6';
                                  e.target.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.background = '#90CAF9';
                                  e.target.style.transform = 'translateY(0)';
                                }}
                                onClick={() => handleLevelSelect('レベル1')}
                              >
                                基礎
                              </button>
                              <button
                                style={{
                                  background: '#90CAF9',
                                  color: '#01579b',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                  transition: 'all 0.2s ease',
                                  width: '100%',
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.background = '#64B5F6';
                                  e.target.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.background = '#90CAF9';
                                  e.target.style.transform = 'translateY(0)';
                                }}
                                onClick={() => handleLevelSelect('レベル2')}
                              >
                                標準
                              </button>
                              <button
                                style={{
                                  background: '#90CAF9',
                                  color: '#01579b',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                  transition: 'all 0.2s ease',
                                  width: '100%',
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.background = '#64B5F6';
                                  e.target.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.background = '#90CAF9';
                                  e.target.style.transform = 'translateY(0)';
                                }}
                                onClick={() => handleLevelSelect('レベル3')}
                              >
                                応用
                              </button>
                            </div>
                          )}
                        </div>
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
                          onClick={() => handleLevelSelect(level)}
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
                              playButtonSound(); // ボタンクリック音
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
                              console.log('問題数選択ボタンクリック:', count);
                              playButtonSound(); // ボタンクリック音
                              setSelectedQuestionCount(count);
                            }}
                          >
                            {`全部(${availableQuestionCount}問)で開始`}
                          </button>
                        );
                      })}

                      {/* おぼえるモードチェックボックス */}
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
                          id="memorizeMode"
                          checked={isMemorizeMode}
                          onChange={(e) => setIsMemorizeMode(e.target.checked)}
                          style={{
                            width: 16,
                            height: 16,
                            cursor: 'pointer',
                          }}
                        />
                        <label
                          htmlFor="memorizeMode"
                          style={{
                            fontSize: 14,
                            color: '#333',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          おぼえるモード
                        </label>
                      </div>

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
                  
                  {/* 問題画像の表示 */}
                  {msg.sender === 'sensei' && 
                   !msg.showButtons && 
                   !msg.showLevelButtons && 
                   questions[currentIndex] && 
                   !isFinished && 
                   msg.text === questions[currentIndex].question &&
                   questions[currentIndex].questionImageUrl && (
                    <div style={{
                      marginTop: 8,
                      textAlign: 'center',
                    }}>
                      <img
                        src={convertGoogleDriveUrl(questions[currentIndex].questionImageUrl)}
                        alt="問題画像"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          borderRadius: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                        onError={(e) => {
                          console.log('画像読み込みエラー:', questions[currentIndex].questionImageUrl);
                          console.log('変換後URL:', convertGoogleDriveUrl(questions[currentIndex].questionImageUrl));
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('画像読み込み成功:', convertGoogleDriveUrl(questions[currentIndex].questionImageUrl));
                        }}
                      />
                    </div>
                  )}

                  {/* おぼえるモードでの解答表示 */}
                  {isMemorizeMode && showAnswer && msg.showMemorizeAnswer && (
                    <div style={{
                      marginTop: 8,
                      padding: '12px',
                      background: '#fff3cd',
                      border: '1px solid #ffeaa7',
                      borderRadius: 8,
                      fontSize: 14,
                      color: '#856404',
                    }}>
                      <strong>解答:</strong> {(() => {
                        // 現在の問題に対応する解答を取得
                        const currentQuestionText = msg.text;
                        const currentQuestion = memorizeProgress.studyQuestions.find(q => q.question === currentQuestionText);
                        return currentQuestion ? currentQuestion.answer : '';
                      })()}
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
                          // 正解表示用のテキストを取得（複数正解例がある場合は最初のものを表示）
                          const displayAnswer = answer.split('/')[0].trim();
                          setChat(prev => [
                            ...prev,
                            { sender: 'sensei', text: `正解は「${displayAnswer}」でした。`, face: 'tai-normal' }
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
                                console.log('問題終了時の判定 - wrongQuestions.length:', wrongQuestions.length, 'isReviewMode:', isReviewMode);
                                if (wrongQuestions.length > 0 && !isReviewMode) {
                                  // 間違えた問題がある場合は復習モードを開始
                                  console.log('復習モード開始');
                                  startReviewMode();
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
                                  console.log('次の復習ラウンド対象問題:', wrongQuestions);
                                  startReviewMode(); // 間違えた問題リストのコピーを渡す
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

                  {/* 選択肢問題の選択肢ボタン */}
                  {msg.sender === 'sensei' && 
                   !msg.showButtons && 
                   !msg.showLevelButtons && 
                   questions[currentIndex] && 
                   !isFinished && 
                   msg.text === questions[currentIndex].question &&
                   isChoiceQuestion(questions[currentIndex]) && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}>
                      {getChoices(questions[currentIndex]).map((choice, index) => (
                        <button
                          key={index}
                          style={{
                            background: '#4FC3F7',
                            color: '#01579b',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textAlign: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            minWidth: 'fit-content',
                            maxWidth: 'calc(50% - 3px)',
                            flex: '1 1 auto',
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = '#29B6F6';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = '#4FC3F7';
                            e.target.style.transform = 'translateY(0)';
                          }}
                          onClick={() => handleChoiceClick(choice)}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
              <div ref={chatEndRef} />
          </div>

          {/* 入力エリア - カテゴリ選択中は非表示、選択肢問題の場合も非表示 */}
          {!showCategoryButtons && !showLevelButtons && !showQuestionCountButtons && 
           !(questions[currentIndex] && isChoiceQuestion(questions[currentIndex])) && (
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
