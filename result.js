window.addEventListener('DOMContentLoaded', async () => {
    // --- 0. モーダルウィンドウのHTMLをページに追加 ---
    const modalHtml = `
        <div class="modal-overlay" id="question-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="modal-question-number"></h4>
                    <button class="modal-close-button" id="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p id="modal-question-text"></p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // モーダルの要素を取得
    const modalOverlay = document.getElementById('question-modal');
    const modalQuestionNumber = document.getElementById('modal-question-number');
    const modalQuestionText = document.getElementById('modal-question-text');
    const modalCloseButton = document.getElementById('modal-close');

    // モーダルを閉じる関数
    const closeModal = () => {
        modalOverlay.classList.remove('visible');
    };
    modalCloseButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) { closeModal(); }
    });

    // --- 1. データの取得と準備 ---
    const answersString = sessionStorage.getItem('quizAnswers');
    const concernsText = sessionStorage.getItem('quizConcerns') || ''; 
    
    // ★ エラー処理
    if (!answersString) { 
        const pageWrapper = document.querySelector('.page-wrapper');
        if (pageWrapper) {
            pageWrapper.innerHTML = `
                <div style="text-align: center; padding-top: 60px; padding-bottom: 60px; max-width: 700px; margin: 0 auto;">
                    <h2 style="color: #005f73; font-size: 1.8em; margin-bottom: 20px;">エラーが発生しました</h2>
                    <p style="font-size: 1.1em; margin-bottom: 40px; line-height: 1.8;">
                        回答データが見つかりません。<br>
                        診断セッションがタイムアウトしたか、診断が中断されました。<br>
                        お手数ですが、最初からやり直してください。
                    </p>
                    <a href="index.html" class="next-button" style="width: 250px; margin: 0 auto;">トップページに戻る</a>
                </div>
            `;
            const footer = document.querySelector('.global-footer');
            if (footer) footer.style.display = 'none';
            
            return;
        } else {
            document.body.innerHTML = "<h1>エラー: 回答データが見つかりません。</h1><p>診断を最初からやり直してください。</p><a href='index.html'>トップページに戻る</a>";
            return;
        }
    }
    
    const userAnswers = JSON.parse(answersString);

    // ★ 診断履歴を削除
    sessionStorage.removeItem('quizAnswers');
    
    const response = await fetch('questions.json');
    const allQuestions = (await response.json()).questions;

    // --- 2. スコア計算 と 回答データ整理 ---
    let totalScore = 0;
    let totalMaxPossibleScore = 0;
    const categoryResults = {};
    const categoriesOrder = ["Part1：雇用の意識・ルール", "Part2：採用・面接の工夫", "Part3：入社時の受け入れ", "Part4：日常の支援・安全", "Part5：入社後のキャリア", "Part6：職場・生活サポート"];

    for (const catName of categoriesOrder) {
        categoryResults[catName] = { score: 0, maxPossibleScore: 0, answers: [] };
    }

    allQuestions.forEach(q => {
        if (!categoryResults[q.category]) return; 

        const userAnswer = userAnswers.find(a => a.questionId === q.id);
        const maxScoreForQuestion = Math.max(...(q.choices || []).map(c => c.score).filter(s => s >= 0));
        
        let userScoreForCalculation = 0;
        let selectedTextForList = "(未回答)";
        let answerScoreForList = 0;
        let isNotImplemented = false; // (isNotImplementedフラグはもう使いません)

        if (userAnswer) {
            selectedTextForList = userAnswer.selectedText;
            answerScoreForList = userAnswer.score;

            if (userAnswer.score !== -1) { 
                userScoreForCalculation = userAnswer.score >= 0 ? userAnswer.score : 0;
            } else {
                userScoreForCalculation = 0; 
            }

        } else {
            selectedTextForList = "(未回答)";
            answerScoreForList = 0;
            userScoreForCalculation = 0;
        }

        if (userAnswer && userAnswer.score === -1) {
            // 「該当しない」場合は分母分子に加算しない
        } else {
            if (maxScoreForQuestion > 0) {
                totalMaxPossibleScore += maxScoreForQuestion;
                categoryResults[q.category].maxPossibleScore += maxScoreForQuestion;
            }
            totalScore += userScoreForCalculation;
            categoryResults[q.category].score += userScoreForCalculation;
        }
        
        categoryResults[q.category].answers.push({
            questionId: q.id,
            label: q.label || `Q${allQuestions.findIndex(item => item.id === q.id) + 1}`,
            text: q.text,
            selectedText: selectedTextForList,
            score: answerScoreForList,
            maxScore: maxScoreForQuestion
        });
    });


    const finalScore = totalMaxPossibleScore > 0 ? Math.round((totalScore / totalMaxPossibleScore) * 100) : 0;
    
    // ★★★ ランク判定ロジック ★★★
    let finalRank = 'C';
    let rankClass = 'rank-bg-c'; 
    if (finalScore >= 90) { 
        finalRank = 'S'; 
        rankClass = 'rank-bg-s';
    }
    else if (finalScore >= 75) { 
        finalRank = 'A'; 
        rankClass = 'rank-bg-a';
    }
    else if (finalScore >= 50) { 
        finalRank = 'B'; 
        rankClass = 'rank-bg-b';
    }
    // Cランクはデフォルト

    // --- 3. 総合結果の表示 ---
    const banner = document.getElementById('result-banner');
    banner.classList.add(rankClass); 

    // ★★★ スコアのカウントアップアニメーションを実行 ★★★
    animateCountUp(document.getElementById('score-value'), finalScore);
    document.getElementById('rank-text').textContent = `評価ランク: ${finalRank}`;

    // --- 4. レーダーチャート & 総合コメント準備 ---
    const categoryData = categoriesOrder.map(catName => {
        const res = categoryResults[catName];
        let percentage = 0;
        let rank = 'C'; 
        if (res && res.maxPossibleScore > 0) {
            percentage = Math.round((res.score / res.maxPossibleScore) * 100);
            if (percentage >= 90) rank = 'S';
            else if (percentage >= 75) rank = 'A';
            else if (percentage >= 50) rank = 'B';
        } else if (res && res.answers.length > 0 && res.maxPossibleScore === 0) {
             rank = '-'; 
             percentage = 0;
        }
        return { name: catName, percentage: percentage, rank: rank };
    });

    // 総合コメント生成
    const overallCommentEl = document.getElementById('overall-comment-text');
    const urgentCategories = categoryData 
        .filter(cat => cat.rank === 'C' && cat.name)
        .map(cat => `『${cat.name.replace(/Part\d+：/, '')}』`);
        
    const improvementCategories = categoryData 
        .filter(cat => cat.rank === 'B' && cat.name)
        .map(cat => `『${cat.name.replace(/Part\d+：/, '')}』`);

    let comment = '';
    switch(finalRank) {
        case 'S':
        case 'A':
            comment = '素晴らしいです！全体的に高いレベルで受け入れ体制が構築されています。';
            const allProblemCategories = [...urgentCategories, ...improvementCategories];
            if (allProblemCategories.length > 0) {
                comment += ` ただし、${allProblemCategories.join('、')}には、まだ改善の余地があります。`;
            }
            break;
        case 'B':
            comment = '基本的な受け入れ体制は整っていますが、いくつかの重要な課題が見られます。';
            if (urgentCategories.length > 0) {
                comment += ` 特に、${urgentCategories.join('、')}において早急な改善が必要です。`;
            } else if (improvementCategories.length > 0) {
                comment += ` まずは${improvementCategories.join('、')}の分野から見直しを進めましょう。`;
            }
            break;
        case 'C':
            comment = '受け入れ体制に多くの課題が見られます。';
            if (urgentCategories.length > 0) {
                comment += ` まずは、${urgentCategories.join('、')}における早急な課題の把握と改善が求められます。`;
            } else {
                comment += ' 各カテゴリの詳細を確認し、基本的な項目から見直しを始めましょう。';
            }
            break;
        default:
            comment = '診断結果を分析中です。';
    }
    overallCommentEl.innerHTML = comment;

    // レーダーチャート
    const radarCtx = document.getElementById('radar-chart').getContext('2d');
    
    const radarLabels = [
        ['雇用の意識', 'ルール'],
        ['採用・面接の', '工夫'],
        ['入社時の', '受け入れ'],
        ['日常の支援', '安全'],
        ['入社後の', 'キャリア'],
        ['職場・生活', 'サポート']
    ];
    const radarScores = categoryData.map(cat => cat.percentage);

    const getRankColor = (rank) => {
        switch(rank) {
            case 'S': return '#28a745'; 
            case 'A': return '#28a745';
            case 'B': return '#0a9396'; 
            case 'C': return '#dc3545';
            default: return '#777';
        }
    };

    new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: radarLabels, 
            datasets: [{
                label: 'カテゴリ別達成度 (%)', data: radarScores,
                backgroundColor: 'rgba(10, 147, 150, 0.1)',
                borderColor: 'rgba(10, 147, 150, 1)',
                borderWidth: 2,
                pointBackgroundColor: categoryData.map(cat => getRankColor(cat.rank)),
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: categoryData.map(cat => getRankColor(cat.rank)),
                pointRadius: 6,
                pointHoverRadius: 8 
            }]
        },
        options: {
             maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, color: '#ddd' },
                    suggestedMin: 0, suggestedMax: 100,
                    grid: { color: 'transparent' },
                    ticks: { display: false, stepSize: 25, backdropColor: 'transparent' },
                    pointLabels: {
                        font: { size: 16 },
                        padding: 20,
                        callback: function(pointLabel, index) {
                            return Array.isArray(pointLabel) ? pointLabel : [pointLabel];
                        },
                        color: '#333'
                    }
                }
            },
             plugins: {
                legend: { display: false },
                tooltip: {
                     callbacks: {
                        label: function(context) {
                             const catName = categoryData[context.dataIndex].name.replace(/Part\d+：/, '');
                             if (context.label && context.label.replace(/\n/g,'') !== context.dataset.label) {
                                return `${context.label.replace(/\n/g,'')}: ${context.raw}%`;
                            }
                            return `${catName}: ${context.raw}%`;
                        }
                    }
                }
            },
            layout: { padding: { top: 20, bottom: 20, left: 10, right: 10 } }
        }
    });

    // --- 5. 詳細結果（「回答の詳細」を表示） ---
    const detailedResultsListEl = document.getElementById('detailed-results-list');
    detailedResultsListEl.innerHTML = '';

    categoryData.forEach(({ name: categoryName, percentage, rank }) => {
        const result = categoryResults[categoryName];
        if (!result || !result.answers || result.answers.length === 0) return;
        
        let answerListHtml = '<ul class="answer-detail-list">';
        result.answers.forEach(answer => {

            const cleanedSelectedText = answer.selectedText
                .replace(/^はい、/, '')
                .replace(/^いいえ、/, '')
                .trim();

            let rankDisplayHtml = '';
            let itemClass = ''; 
            
            if (answer.score === -1) {
                rankDisplayHtml = `<span class="answer-rank-na">対象外</span>`;
            } else {
                let scoreRank = 'D'; 
                if (answer.score === 4) scoreRank = 'S';
                else if (answer.score === 3) scoreRank = 'A';
                else if (answer.score === 2) scoreRank = 'B';
                else if (answer.score === 1) scoreRank = 'C';
                
                rankDisplayHtml = `<span class="answer-rank">${scoreRank}</span>`;
                
                if (scoreRank === 'D') {
                    itemClass = 'rank-d-highlight';
                }
            }

            answerListHtml += `
                <li class="answer-item ${itemClass}" data-question-id="${answer.questionId}">
                    <span class="answer-label">${answer.label.replace(/Q\d+\s/, '')}</span>
                    <div class="answer-row">
                        <span class="answer-choice">${cleanedSelectedText}</span>
                        ${rankDisplayHtml}
                    </div>
                </li>
            `;
        });
        answerListHtml += '</ul>';

        const rankBlockHtml = rank === '-' ? 
            `<span class="rank-block-na">対象外</span>` :
            `<div>
                <span class="rank-block">${rank}ランク</span>
                <span class="rank-percentage">(${percentage}%)</span>
             </div>`;

        const resultCard = `
            <div class="result-card">
                <div class="card-header">
                    <div class="title-block">
                         <p class="category-name">${categoryName.replace(/Part\d+：/, '')}</p>
                    </div>
                    ${rankBlockHtml}
                </div>
                <div class="card-body">
                    ${answerListHtml}
                </div>
            </div>
        `;
        detailedResultsListEl.insertAdjacentHTML('beforeend', resultCard);
    });
    
    // --- 5b. 自動アコーディオンオープン (Dランクがある場合) ---
    document.querySelectorAll('.result-card').forEach(card => {
        const hasDRank = card.querySelector('.rank-d-highlight');
        if (hasDRank) {
            card.classList.add('is-open');
        }
    });


    // --- 6. アコーディオン機能 ---
    detailedResultsListEl.addEventListener('click', (event) => {
        const header = event.target.closest('.card-header');
        
        // 質問項目(li)のモーダル表示を優先
        if (event.target.closest('.answer-item')) {
            const answerItem = event.target.closest('.answer-item');
            const questionId = parseInt(answerItem.dataset.questionId);
            const question = allQuestions.find(q => q.id === questionId);

            if (question) {
                const questionIndex = allQuestions.findIndex(q => q.id === questionId);
                 modalQuestionNumber.textContent = `Q${questionIndex + 1}`;
                
                const fullText = question.text;
                const cleanedText = fullText.replace(/^[0-9]+-[0-9]+：.+?\n/, ''); 
                modalQuestionText.textContent = cleanedText;
                
                modalOverlay.classList.add('visible');
            }
            return; 
        }
        
        // ヘッダーがクリックされた場合
        if (header) {
            const card = header.closest('.result-card');
            if (card) {
                card.classList.toggle('is-open');
            }
        }
    });

    // --- 7. 自由記述欄の表示 ---
    if (concernsText && concernsText.trim() !== "") {
        const concernsArea = document.getElementById('concerns-area');
        const concernsTextEl = document.getElementById('concerns-text');
        if (concernsTextEl) {
             concernsTextEl.textContent = concernsText;
             concernsArea.style.display = 'block';
        }
    }

    // --- 8. PDF保存ボタンの処理 (window.print) ---
    const printButton = document.getElementById('print-button');
    printButton.addEventListener('click', () => {
        
        const score = document.getElementById('score-value').textContent;
        const rank = document.getElementById('rank-text').textContent;
        const comment = document.getElementById('overall-comment-text').innerHTML;
        const concerns = concernsText; 
        const radarCanvas = document.getElementById('radar-chart');
        
        const today = new Date();
        const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

        let radarImage = '';
        try {
            radarImage = radarCanvas.toDataURL('image/png');
        } catch (e) {
            console.error("チャートの画像への変換に失敗:", e);
        }

        let printHtml = `
            <html>
            <head>
                <title>外国人材定着支援ナビ - 診断結果レポート</title>
                <style>
                    body { font-family: sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; font-size: 10pt; }
                    .print-container { width: 100%; margin: 0 auto; padding: 10mm; box-sizing: border-box; }
                    h1 { color: #005f73; border-bottom: 2px solid #005f73; padding-bottom: 8px; margin-bottom: 5px; font-size: 18pt; }
                    .report-date { font-size: 10pt; text-align: right; margin: 0 0 20px 0; }
                    h2 { color: #005f73; margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px; font-size: 14pt;}
                    p { margin-bottom: 1em; }
                    
                    .overall-grid { display: flex; flex-direction: row; gap: 20px; align-items: flex-start; margin-bottom: 20px; page-break-inside: avoid; }
                    .score-box { flex: 1; background-color: #f4f7f6; padding: 15px; border-radius: 5px; font-size: 10pt; }
                    .score-box p { margin: 0 0 0.5em 0; }
                    .score-box strong { font-size: 1.1em; }
                    .score-box hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
                    .chart-box { flex: 1; text-align: center; }
                    .chart-box img { max-width: 100%; height: auto; display: block; }
                    
                    .card { margin-bottom: 10px; border: 1px solid #dee2e6; border-radius: 5px; overflow: hidden; page-break-inside: avoid; }
                    .card-header { background-color: #f8f9fa; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; }
                    .card-header h3 { margin: 0; color: #005f73; font-size: 12pt; }
                    .card-header .rank { font-weight: bold; font-size: 11pt; }
                    
                    .card-body { padding: 0; }
                    .answer-list { list-style-type: none; padding: 0; margin: 0; }
                    .answer-item { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; page-break-inside: avoid; display: flex; align-items: center; gap: 10px; }
                    .answer-item:last-child { border-bottom: none; }
                    
                    .answer-item .eval { font-weight: bold; font-size: 10pt; width: 80px; text-align: right; flex-shrink: 0; }
                    .answer-item .label { font-weight: bold; font-size: 10pt; flex-basis: 120px; flex-shrink: 0; }
                    .answer-item .question-full-text { font-size: 9pt; color: #666; margin: 2px 0 4px 0; display: block; }
                    .answer-item .choice-container { flex-grow: 1; }
                    .answer-item .choice { font-size: 10pt; }
                    .answer-item .choice strong { color: #333; font-size: 10pt; }
                    
                    .concerns-box { background-color: #fdfaee; border: 1px solid #faeac7; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-size: 10pt; page-break-before: auto; }

                    /* PDF固有の評価テキスト色 */
                    .eval-not-applicable { color: #6c757d; } /* 評価不能 */
                    .eval-S { color: #28a745; } /* ★ 紫から緑 */
                    .eval-A { color: #28a745; }
                    .eval-B { color: #0a9396; }
                    .eval-C { color: #dc3545; }
                    .eval-D { color: #dc3545; } /* Dも赤色 */

                    /* 注意書きスタイル */
                    .disclaimer { 
                        font-size: 8pt; 
                        color: #666; 
                        margin-top: 30px; 
                        border-top: 1px solid #eee; 
                        padding-top: 15px;
                        page-break-before: auto;
                    }
                    .disclaimer ul { padding-left: 20px; }

                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .print-container { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <h1>外国人材定着支援ナビ 診断結果レポート</h1>
                    <p class="report-date">診断実施日: ${dateString}</p> <h2>総合評価</h2>
                    <div class="overall-grid"> <div class="score-box">
                            <p><strong>総合スコア:</strong> ${score}</p>
                            <p><strong>${rank}</strong></p>
                            <hr>
                            <p><strong>総合コメント:</strong></p>
                            <div>${comment}</div>
                        </div>
                        <div class="chart-box">
                            <img src="${radarImage}" alt="レーダーチャート">
                        </div>
                    </div>

                    <h2>カテゴリ別の詳細</h2>
        `;

        // --- 全45問の詳細を追加 ---
        categoryData.forEach(({ name: categoryName, percentage, rank: categoryRank }) => {
            const result = categoryResults[categoryName];
            if (!result || !result.answers || result.answers.length === 0) return;

            printHtml += `
                <div class="card">
                    <div class="card-header">
                        <h3>${categoryName.replace(/Part\d+：/, '')}</h3>
                        <span class="rank"><strong>${categoryRank}ランク</strong> (${percentage}%)</span>
                    </div>
                    <div class="card-body">
                        <ul class="answer-list">
            `;
            
            result.answers.forEach(answer => {
                const questionIndex = allQuestions.findIndex(item => item.id === answer.questionId) + 1;
                const cleanedQuestionText = (answer.text || '').replace(/^[0-9]+-[0-9]+：.+?\n/, '').trim();
                const cleanedSelectedText = (answer.selectedText || '').replace(/^はい、/, '').replace(/^いいえ、/, '').trim();
                
                let rankText = '';
                let rankClass = '';
                let scoreTextForPDF = '';

                if (answer.score === -1) {
                    rankText = "<strong>対象外</strong>";
                    rankClass = "eval-not-applicable";
                    scoreTextForPDF = '';
                } else {
                    let scoreRank = 'D'; // デフォルト (0点)
                    if (answer.score === 4) scoreRank = 'S';
                    else if (answer.score === 3) scoreRank = 'A';
                    else if (answer.score === 2) scoreRank = 'B';
                    else if (answer.score === 1) scoreRank = 'C';
                    
                    rankText = `<strong>${scoreRank}</strong>`;
                    rankClass = `eval-${scoreRank}`;
                    scoreTextForPDF = ` (${answer.score}点)`;
                }
                
                printHtml += `
                    <li class="answer-item">
                        <span class="label">${answer.label.replace(/Q\d+\s/, '')}</span>
                        <div class="choice-container">
                            <span class="question-full-text">(Q${questionIndex}) ${cleanedQuestionText}</span>
                            <span class="choice"><strong>[回答]</strong> ${cleanedSelectedText}</span> 
                        </div>
                        <span class="eval ${rankClass}">${rankText}${scoreTextForPDF}</span>
                    </li>
                `;
            });
            
            printHtml += `</ul></div></div>`;
        });
        
        // --- 自由記述欄を追加 ---
        if (concernsText && concernsText.trim() !== "") {
            printHtml += `
                <h2>貴社が現在お困りのこと</h2>
                <div class="concerns-box">
                    <p>${concernsText}</p>
                </div>
            `;
        }

        // --- 注意書きを追加 ---
        printHtml += `
                <div class="disclaimer">
                    <h3>診断結果の評価について</h3>
                    <ul>
                        <li><strong>対象外:</strong> 貴社にとってこの質問は「該当しない」と回答されたため、総合スコアおよびカテゴリ別スコアの計算対象外としています。</li>
                        <li><strong>Dランク (0点):</strong> この質問は「まったく実施/意識していない」または「わからない」と回答された項目です。定着支援の改善点として優先的にご検討いただくことを推奨します。</li>
                    </ul>
                </div>
            `;

        printHtml += `</div></body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus(); 
        
        setTimeout(() => {
            try {
                printWindow.print();
            } catch (e) {
                console.error("印刷に失敗しました:", e);
                printWindow.close();
            }
        }, 1000);
    });

    // --- 10. "トップに戻る" ボタンの処理 ---
    const backToTopButton = document.querySelector('.result-footer-buttons .next-button');
    if (backToTopButton) {
        backToTopButton.addEventListener('click', (event) => {
            event.preventDefault(); // リンクを即座に実行しない
            
            // ★ 診断履歴（自由記述欄）もクリア
            sessionStorage.removeItem('quizConcerns');
            // (quizAnswers は既にページ読み込み時に削除済み)
            
            // トップページに移動
            window.location.href = event.target.href;
        });
    }

    // --- 11. ★★★ スコア・カウントアップ関数 ★★★
    function animateCountUp(element, finalValue) {
        let start = 0;
        const duration = 1500; // 1.5秒
        const startTime = performance.now();

        function update(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            // イージング関数 (easeOutQuad) で滑らかな減速
            const easeOutProgress = progress * (2 - progress);
            const currentVal = Math.floor(easeOutProgress * finalValue);
            
            element.textContent = `${currentVal} / 100点`;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = `${finalValue} / 100点`; // 最終値を保証
            }
        }
        
        // 0点を表示してからアニメーション開始
        element.textContent = `0 / 100点`;
        requestAnimationFrame(update);
    }

});