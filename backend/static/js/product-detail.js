document.addEventListener("DOMContentLoaded", function () {
    const productDetailBox = document.getElementById("productDetailBox");
    const productId = window.PRODUCT_ID;
    const editBtn = document.getElementById("editBtn");
    const deleteBtn = document.getElementById("deleteProductBtn");
    const reviewForm = document.getElementById("reviewCreateForm");
    const contentInput = document.getElementById("content");
    const ratingInput = document.getElementById("rating");
    const imageInput = document.getElementById("images");
    const previewBox = document.getElementById("previewBox");
    const reviewList = document.getElementById("reviewList");
    const api = window.api || axios;

    function getAuthHeaders(extraHeaders = {}) {
        const token =
            localStorage.getItem("access") ||
            localStorage.getItem("access_token") ||
            localStorage.getItem("token");
        const headers = { ...extraHeaders };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async function loadProductDetail() {
        try {
            const response = await api.get(`/products/api/${productId}/`);
            const product = response.data;
            productDetailBox.innerHTML = `
                <img src="${product.image_url || ""}" alt="${product.name}" class="thumb">
                <h1>${product.name}</h1>
                <p>${product.description || ""}</p>
                <p><strong>${Number(product.price).toLocaleString()}원</strong></p>
                <p class="muted">등록일: ${product.created_at || "-"}</p>
            `;
        } catch (error) {
            productDetailBox.innerHTML = `<p>상품 상세 정보를 불러오지 못했습니다.</p>`;
        }
    }

    async function loadReviews() {
        try {
            const response = await api.get(`/reviews/?product=${productId}`);
            const data = response.data;
            const reviews = data.results || data;

            reviewList.innerHTML = "";

            if (!reviews || reviews.length === 0) {
                reviewList.innerHTML = "<p>아직 등록된 리뷰가 없습니다.</p>";
                return;
            }

            const guideBox = document.createElement("div");
            guideBox.innerHTML = `<p>비슷한 후기를 비동기로 찾아 보여줍니다.</p>`;
            reviewList.appendChild(guideBox);

            reviews.forEach((review) => {
                const card = document.createElement("div");
                card.innerHTML = `
                    <p>${review.content}</p>
                    <button class="ai-analyze-btn" data-review-id="${review.id}">
                        비슷한 후기 보기
                    </button>
                    <div id="ai-result-${review.id}" style="display:none;"></div>
                `;
                reviewList.appendChild(card);
            });

            bindAnalyzeButtons();

        } catch (error) {
            reviewList.innerHTML = "<p>리뷰 목록을 불러오지 못했습니다.</p>";
        }
    }

    function getSimilarityLabel(score) {
        if (score > 0.7) return "매우 비슷";
        if (score > 0.5) return "비슷";
        if (score > 0.3) return "약간 비슷";
        return "관련 있음";
    }

    function getSimilarityDescription(score) {
        if (score > 0.7) return "표현과 느낌이 매우 비슷한 후기예요.";
        if (score > 0.5) return "비슷한 의견을 담고 있는 후기예요.";
        if (score > 0.3) return "어느 정도 관련 있는 후기예요.";
        return "참고용으로 볼 수 있는 후기예요.";
    }

    async function pollTaskStatus(taskId, reviewId, button, resultBox) {
        const maxTry = 20;
        let currentTry = 0;

        const intervalId = setInterval(async () => {
            currentTry += 1;

            try {
                const response = await api.get(`/ai/tasks/${taskId}/status/`);
                const data = response.data;

                if (data.status === "SUCCESS") {
                    clearInterval(intervalId);
                    const result = data.result || {};

                    if (!result.similar_reviews || result.similar_reviews.length === 0) {
                        resultBox.innerHTML = `
                            <div class="ai-result-inner">
                                <p><strong>이 리뷰와 비슷한 다른 후기</strong></p>
                                <p>충분히 비슷한 후기를 찾지 못했어요.</p>
                                <p class="ai-sub-guide">비교할 후기가 부족하거나, 현재 후기들과 표현 차이가 클 수 있어요.</p>
                            </div>
                        `;
                    } else {
                        resultBox.innerHTML = `
                            <div class="ai-result-inner">
                                <p><strong>이 리뷰와 비슷한 다른 후기</strong></p>
                                <p>비슷한 후기 ${result.similar_reviews.length}개를 찾았어요.</p>
                                <p class="ai-sub-guide">같은 상품에 대해 비슷하게 느낀 사용자 후기입니다.</p>
                                <ul class="ai-similar-review-list">
                                    ${result.similar_reviews.map((item) => `
                                        <li class="ai-similar-review-item">
                                            <p><strong>${item.label || getSimilarityLabel(item.score)}</strong> : ${item.content}</p>
                                            <p><small>작성자: ${item.username}</small></p>
                                            <p><small>${getSimilarityDescription(item.score)}</small></p>
                                            <p><small>유사도 ${item.score.toFixed(2)} / 작성일 ${item.created_at}</small></p>
                                            <p><small>AI 결과 ID: ${item.analysis_id}</small></p>
                                        </li>
                                    `).join("")}
                                </ul>
                            </div>
                        `;
                    }

                    button.disabled = false;
                    button.textContent = "비슷한 후기 보기";
                    return;
                }

                if (data.status === "FAILURE") {
                    clearInterval(intervalId);
                    resultBox.innerHTML = `
                        <div class="ai-result-inner error">
                            <p>${data.error_message || "AI 분석 중 오류가 발생했습니다."}</p>
                        </div>
                    `;
                    button.disabled = false;
                    button.textContent = "비슷한 후기 보기";
                    return;
                }

                resultBox.innerHTML = `
                    <div class="ai-result-inner">
                        <p>AI가 후기를 분석 중입니다...</p>
                        <p class="ai-sub-guide">현재 상태: ${data.status}</p>
                    </div>
                `;

                if (currentTry >= maxTry) {
                    clearInterval(intervalId);
                    resultBox.innerHTML = `
                        <div class="ai-result-inner error">
                            <p>분석 시간이 길어지고 있습니다. 잠시 후 다시 확인해주세요.</p>
                        </div>
                    `;
                    button.disabled = false;
                    button.textContent = "비슷한 후기 보기";
                }
            } catch (error) {
                clearInterval(intervalId);
                resultBox.innerHTML = `
                    <div class="ai-result-inner error">
                        <p>작업 상태를 확인하는 중 오류가 발생했습니다.</p>
                    </div>
                `;
                button.disabled = false;
                button.textContent = "비슷한 후기 보기";
            }
        }, 1500);
    }

    function connectWebSocket(taskId, reviewId, button, resultBox) {
        const socket = new WebSocket(`ws://${window.location.hostname}:8001/ws/task/${taskId}`);

        socket.onopen = function () {
            resultBox.innerHTML = `
                <div class="ai-result-inner">
                    <p>AI가 후기를 실시간으로 분석 중입니다...</p>
                    <p class="ai-sub-guide">작업이 끝나면 결과가 자동으로 표시됩니다.</p>
                </div>
            `;
        };

        socket.onmessage = function (event) {
            const data = JSON.parse(event.data);

            if (data.status === "FAILURE") {
                resultBox.innerHTML = `
                    <div class="ai-result-inner error">
                        <p>${data.error || "AI 분석 중 오류가 발생했습니다."}</p>
                    </div>
                `;
                button.disabled = false;
                button.textContent = "비슷한 후기 보기";
                socket.close();
                return;
            }

            if (data.status === "SUCCESS") {
                const result = data;

                if (!result.similar_reviews || result.similar_reviews.length === 0) {
                    resultBox.innerHTML = `
                        <div class="ai-result-inner">
                            <p><strong>이 리뷰와 비슷한 다른 후기</strong></p>
                            <p>충분히 비슷한 후기를 찾지 못했어요.</p>
                            <p class="ai-sub-guide">비교할 후기가 부족하거나, 현재 후기들과 표현 차이가 클 수 있어요.</p>
                        </div>
                    `;
                } else {
                    resultBox.innerHTML = `
                        <div class="ai-result-inner">
                            <p><strong>이 리뷰와 비슷한 다른 후기</strong></p>
                            <p>비슷한 후기 ${result.similar_reviews.length}개를 찾았어요.</p>
                            <p class="ai-sub-guide">같은 상품에 대해 비슷하게 느낀 사용자 후기입니다.</p>
                            <ul class="ai-similar-review-list">
                                ${result.similar_reviews.map((item) => `
                                    <li class="ai-similar-review-item">
                                        <p><strong>${item.label || getSimilarityLabel(item.score)}</strong> : ${item.content}</p>
                                        <p><small>작성자: ${item.username}</small></p>
                                        <p><small>${getSimilarityDescription(item.score)}</small></p>
                                        <p><small>유사도 ${item.score.toFixed(2)} / 작성일 ${item.created_at}</small></p>
                                        <p><small>AI 결과 ID: ${item.analysis_id}</small></p>
                                    </li>
                                `).join("")}
                            </ul>
                        </div>
                    `;
                }

                button.disabled = false;
                button.textContent = "비슷한 후기 보기";
                socket.close();
            }
        };

        socket.onclose = function () {
            console.log("[WebSocket] Connection closed");
        };

        socket.onerror = function (error) {
            console.error("[WebSocket] Error:", error);
            resultBox.innerHTML = `
                <div class="ai-result-inner">
                    <p>실시간 연결에 문제가 있어 상태 확인 방식으로 전환합니다...</p>
                </div>
            `;
            pollTaskStatus(taskId, reviewId, button, resultBox);
        };
    }

    function bindAnalyzeButtons() {
        const buttons = document.querySelectorAll(".ai-analyze-btn");

        buttons.forEach((button) => {
            button.addEventListener("click", async () => {
                const reviewId = button.dataset.reviewId;
                const resultBox = document.getElementById(`ai-result-${reviewId}`);

                button.disabled = true;
                button.textContent = "작업 등록 중...";
                resultBox.style.display = "block";
                resultBox.innerHTML = "<p>작업 등록 중...</p>";

                try {
                    const response = await api.post(
                        `/ai/reviews/${reviewId}/analyze/`,
                        {},
                        { headers: getAuthHeaders() }
                    );

                    const taskId = response.data.task_id;

                    // WebSocket으로 교체
                    button.textContent = "실시간 분석 연결 중...";
                    connectWebSocket(taskId, reviewId, button, resultBox);

                } catch (error) {
                    button.disabled = false;
                    button.textContent = "비슷한 후기 보기";
                }
            });
        });
    }

    loadProductDetail();
    loadReviews();
});
