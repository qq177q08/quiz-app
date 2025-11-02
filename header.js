document.addEventListener('DOMContentLoaded', () => {
    // ページ上の .header-logo 要素を取得
    const logoLink = document.querySelector('.header-logo');

    if (logoLink) {
        // ロゴがクリックされたときの動作
        logoLink.addEventListener('click', (event) => {
            // ★ 即座にページ遷移するのを防ぐ
            event.preventDefault(); 
            
            // ★ 確認ポップアップを表示
            const userConfirmed = window.confirm(
                '診断（または結果表示）を中断してトップページに戻りますか？\n現在の内容は保存されません。'
            );
            
            // ★ ユーザーが「OK」を押した場合のみ、トップページに移動
            if (userConfirmed) {
                window.location.href = 'index.html';
            }
            // 「キャンセル」が押された場合は何もしない
        });
    }
});