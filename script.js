// HTMLの要素を取得
const quizArea = document.getElementById('quiz-area');
const freetextArea = document.getElementById('freetext-area');
const freetextInput = document.getElementById('freetext-concerns');

const questionNumberEl = document.querySelector('.question-number');
const questionTextEl = document.querySelector('.question-text');
const choicesEl = document.querySelector('.choices');
const backButton = document.getElementById('back-q-button');
const showResultButton = document.getElementById('show-result-button');
const progressBar = document.querySelector('.progress');
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
            showQuestion(questions[currentQuestionIndex]);
        } else {
            console.error("質問データが空です。");
        }
    })
    .catch(error => {
        console.error("質問データの読み込みに失敗しました:", error);
    });

// 質問を画面に表示する関数
function showQuestion(question) {
    if (!question) return;
    
    currentCategoryEl.textContent = question.category.replace(/Part\d+：/, '') || 'カテゴリ情報なし';
    questionNumberEl.textContent = `Q${currentQuestionIndex + 1}`; // 連番表示
    
    // ★★★ 質問文の表示ロジックを修正 ★★★
    const fullText = question.text || '質問テキストがありません。';
    
    // 1. まず、小見出し (例: "1-1：...") とそれに続く改行を削除
    let cleanedText = fullText.replace(/^[0-9]+-[0-9]+：.+?\n/, '');

    // 2. Q1の導入文を削除
    cleanedText = cleanedText.replace(/「日本の労働力不足は、.+?という予測データもあります。\n/, '');
    
    // 3. テキストの先頭と末尾の空白や改行を削除
    cleanedText = cleanedText.trim();
    
    // 4. (「」」の削除処理は不要。元のJSONが正しければ)
    
    questionTextEl.textContent = cleanedText;
    
    choicesEl.innerHTML = ''; 

    if (question.choices && question.choices.length > 0) {
        question.choices.forEach((choice, index) => {
            const choiceId = `choice-${question.id}-${index}`;
            const choiceItem = `
                <div class="choice-item">
                    <label for="${choiceId}">
                        <input type="radio" id="${choiceId}" name="answer" value="${choice.score}">
                        <span>${choice.text || '選択肢テキストなし'}</span>
                    </label>
                </div>
            `;
            choicesEl.insertAdjacentHTML('beforeend', choiceItem);
        });
    }

    const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
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

    const selectedInput = selectedLabel.querySelector('input[type="radio"]');
    if (selectedInput) {
        selectedLabel.style.borderColor = '#28a745';
        selectedLabel.style.backgroundColor = '#dcfce3';

        setTimeout(() => {
            handleNext(selectedInput);
        }, 300);
    } else {
        isProcessingClick = false;
    }
});

// 「次へ」進むロジック
function handleNext(selectedInput) {
    userAnswers.push({
        questionId: questions[currentQuestionIndex].id,
        score: parseInt(selectedInput.value),
        selectedText: selectedInput.nextElementSibling.textContent.trim()
    });

    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion(questions[currentQuestionIndex]);
    } else {
        quizArea.style.display = 'none';
        freetextArea.style.display = 'block';
    }
}

// 「戻る」ボタンがクリックされたときの処理
backButton.addEventListener('click', () => {
    if (isProcessingClick) return;
    
    if (currentQuestionIndex > 0) {
        userAnswers.pop();
        currentQuestionIndex--;
        showQuestion(questions[currentQuestionIndex]);
    }
});

// 「診断結果を見る」ボタンの処理
showResultButton.addEventListener('click', () => {
    const concernsText = freetextInput.value;
    const answersString = JSON.stringify(userAnswers);
    
    sessionStorage.setItem('quizAnswers', answersString);
    sessionStorage.setItem('quizConcerns', concernsText);
    
    window.location.href = 'result.html';
});