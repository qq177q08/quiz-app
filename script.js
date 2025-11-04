// HTMLの要素を取得
const quizArea = document.getElementById('quiz-area');
const freetextArea = document.getElementById('freetext-area');
const freetextInput = document.getElementById('freetext-concerns');

const questionNumberEl = document.querySelector('.question-number');
const questionTextEl = document.querySelector('.question-text');
const choicesEl = document.querySelector('.choices');
const backButton = document.getElementById('back-q-button');
const showResultButton = document.getElementById('show-result-button');
// ★★★ プログレスバーの参照先を変更 ★★★
const progressBar = document.querySelector('.fixed-progress'); 
const currentCategoryEl = document.querySelector('.current-category');

let questions = [];
let currentQuestionIndex = 0;
let userAnswers = []; // 回答履歴として使用
let isProcessingClick = false; // クリック連打防止フラグ

// 質問データをJSONファイルから読み込む
fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        questions = data.questions;
        if (questions.length > 0) {
            
            // ★★★ バグ修正: questions.length を引数として渡す ★★★
            checkSessionAnswers(questions.length);
            
            // ★★★ バグ修正: 読み込んだインデックスをチェック ★★★
            if (currentQuestionIndex < questions.length) {
                // 診断途中の場合
                showQuestion(questions[currentQuestionIndex]);
            } else {
                // 既に全問回答済みの場合 (例: 結果から「戻る」で来た時)
                progressBar.style.width = '100%';
                quizArea.style.display = 'none';
                freetextArea.style.display = 'block';
            }
            
        } else {
            console.error("質問データが空です。");
        }
    })
    .catch(error => {
        console.error("質問データの読み込みに失敗しました:", error);
    });

// ★ セッションストレージから回答を読み込む（もしあれば）
// ★★★ バグ修正: 全質問数を引数で受け取る ★★★
function checkSessionAnswers(totalQuestions) {
    try {
        const answersString = sessionStorage.getItem('quizAnswers');
        if (answersString && answersString !== "null") {
            userAnswers = JSON.parse(answersString);
            currentQuestionIndex = userAnswers.length;

            // ★★★ バグ修正: 回答数が質問総数より多い(ありえないが)場合は補正
            if (currentQuestionIndex > totalQuestions) {
                currentQuestionIndex = totalQuestions;
            }
        } else {
            // データが不正か空ならリセット
            userAnswers = [];
            currentQuestionIndex = 0;
        }
    } catch (e) {
        console.error("セッションデータの読み込みに失敗:", e);
        userAnswers = [];
        currentQuestionIndex = 0;
    }
}


// 質問を画面に表示する関数
function showQuestion(question) {
    // ★★★ バグ修正: undefined チェックを強化
    if (!question || !question.category) {
        console.error("無効な質問データです:", question);
        // フリーズする代わりにトップに戻す
        // alert("エラーが発生しました。トップページに戻ります。");
        // sessionStorage.clear();
        // window.location.href = 'index.html';
        return; 
    }
    
    currentCategoryEl.textContent = question.category.replace(/Part\d+：/, '') || 'カテゴリ情報なし';
    questionNumberEl.textContent = `Q${currentQuestionIndex + 1}`; // 連番表示
    
    const fullText = question.text || '質問テキストがありません。';
    let cleanedText = fullText.replace(/^[0-9]+-[0-9]+：.+?\n/, '');
    cleanedText = cleanedText.trim();
    questionTextEl.textContent = cleanedText;
    
    choicesEl.innerHTML = ''; 

    // ★ 戻るボタンで来た場合、この質問の回答を取得
    const previousAnswer = userAnswers.find(a => a.questionId === question.id);

    if (question.choices && question.choices.length > 0) {
        question.choices.forEach((choice, index) => {
            const choiceId = `choice-${question.id}-${index}`;
            // ★ 選択状態を復元
            const isChecked = previousAnswer && previousAnswer.score === choice.score;
            
            // ★★★ HTML構造を変更 (input と label を兄弟に) ★★★
            const choiceItem = `
                <div class="choice-item">
                    <input type="radio" id="${choiceId}" name="answer" value="${choice.score}" ${isChecked ? 'checked' : ''}>
                    <label for="${choiceId}">
                        <span>${choice.text || '選択肢テキストなし'}</span>
                    </label>
                </div>
            `;
            choicesEl.insertAdjacentHTML('beforeend', choiceItem);
        });
    }

    // ★ プログレスバーは全質問数に対する「現在の質問インデックス」で計算
    const progressPercent = ((currentQuestionIndex) / questions.length) * 100;
    progressBar.style.width = `${progressPercent}%`;
    
    backButton.disabled = (currentQuestionIndex === 0);
    
    isProcessingClick = false;
}

// 選択肢がクリックされたときの処理 (連打防止機能付き)
choicesEl.addEventListener('click', (event) => {
    const selectedLabel = event.target.closest('label');
    if (!selectedLabel) return;

    if (isProcessingClick) return;
    isProcessingClick = true; 

    const selectedInput = document.getElementById(selectedLabel.htmlFor);
    
    if (selectedInput) {
        
        // ★ 選択状態を即時反映 (CSSだけだと遅れるため)
        selectedInput.checked = true; 
        
        // ★ 他の選択肢のハイライトを外す（念のため）
        document.querySelectorAll('.choice-item input[type="radio"]').forEach(input => {
            const label = input.nextElementSibling;
            if (label !== selectedLabel) {
                label.classList.remove('choice-selected'); // JSフィードバック用クラス
            }
        });
        
        // ★ スタイルをCSSクラスで付与
        selectedLabel.classList.add('choice-selected');

        setTimeout(() => {
            handleNext(selectedInput, selectedLabel);
        }, 300);
    } else {
        isProcessingClick = false;
    }
});

// 「次へ」進むロジック
function handleNext(selectedInput, selectedLabel) {
    // ★ 既存の回答があれば上書き、なければ追加
    const existingAnswerIndex = userAnswers.findIndex(a => a.questionId === questions[currentQuestionIndex].id);
    const answerData = {
        questionId: questions[currentQuestionIndex].id,
        score: parseInt(selectedInput.value),
        selectedText: selectedLabel.querySelector('span').textContent.trim() // ★ span のテキストを取得
    };

    if (existingAnswerIndex > -1) {
        userAnswers[existingAnswerIndex] = answerData;
    } else {
        userAnswers.push(answerData);
    }
    
    // ★ 回答の途中経過をセッションストレージに保存（戻るボタンのため）
    sessionStorage.setItem('quizAnswers', JSON.stringify(userAnswers));

    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion(questions[currentQuestionIndex]);
    } else {
        // ★ 最後の質問が終わったらプログレスバーを100%に
        progressBar.style.width = `100%`;
        
        quizArea.style.display = 'none';
        freetextArea.style.display = 'block';
    }
}

// 「戻る」ボタンがクリックされたときの処理
backButton.addEventListener('click', () => {
    if (isProcessingClick) return;
    
    if (currentQuestionIndex > 0) {
        // ★ 回答履歴(userAnswers)は消さずに、インデックスだけ戻す
        currentQuestionIndex--;
        showQuestion(questions[currentQuestionIndex]);
    }
});

// 「診断結果を見る」ボタンの処理
showResultButton.addEventListener('click', () => {
    const concernsText = freetextInput.value;
    // ★ 回答(quizAnswers)は handleNext でセッションストレージに保存済み
    sessionStorage.setItem('quizConcerns', concernsText);
    
    window.location.href = 'result.html';
});