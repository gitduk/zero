// 评论功能增强模块
(function() {
    'use strict';
    
    // 存储已加载的评论数据
    window._commentsCacheMap = {};
    window._commentsLastLoaded = {};
    
    // 在DOM加载完成后初始化
    document.addEventListener('DOMContentLoaded', function() {
        // 直接拦截原始的XHR，这是最底层的拦截方式
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            // 设置一个标志，用于检查这是否是评论请求
            this._isCommentRequest = typeof url === 'string' && url.includes('/comments') && method.toUpperCase() === 'GET';
            
            // 如果是评论请求，检查我们是否有缓存
            if (this._isCommentRequest) {
                const match = url.match(/\/posts\/([^\/]+)\/comments/);
                if (match && match[1]) {
                    const postId = match[1];
                    this._commentPostId = postId;
                    
                    // 强制刷新或提交评论时不使用缓存
                    if (window._forceCommentRefresh || window._commentSubmitting) {
                        this._useCache = false;
                    } else {
                        // 检查缓存是否存在且未过期
                        const now = new Date().getTime();
                        const lastLoaded = window._commentsLastLoaded[postId] || 0;
                        const cacheAgeMinutes = (now - lastLoaded) / (1000 * 60);
                        
                        if (window._commentsCacheMap[postId] && cacheAgeMinutes <= 3) {
                            this._useCache = true;
                        } else {
                            this._useCache = false;
                        }
                    }
                }
            }
            
            // 调用原始方法
            return originalXHROpen.apply(this, arguments);
        };
        
        // 拦截send方法
        const originalXHRSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
            if (this._isCommentRequest && this._useCache) {
                // 模拟XHR完成
                const postId = this._commentPostId;
                const cachedData = window._commentsCacheMap[postId];
                
                // 设置超时以确保异步行为
                setTimeout(() => {
                    // 模拟XHR各个状态
                    if (this.onreadystatechange) {
                        // 模拟加载中状态
                        this.readyState = 1;
                        this.onreadystatechange();
                        
                        // 模拟请求发送状态
                        this.readyState = 2;
                        this.onreadystatechange();
                        
                        // 模拟接收响应状态
                        this.readyState = 3;
                        this.onreadystatechange();
                        
                        // 模拟完成状态
                        this.readyState = 4;
                        this.status = 200;
                        this.responseText = JSON.stringify(cachedData);
                        this.onreadystatechange();
                    }
                    
                    // 调用onload回调
                    if (this.onload) this.onload();
                }, 10);
                
                // 不真正发送请求
                return;
            }
            
            // 处理响应
            if (this._isCommentRequest && !this._useCache) {
                const originalOnload = this.onload;
                this.onload = () => {
                    if (this.status === 200 && this.responseText) {
                        try {
                            const data = JSON.parse(this.responseText);
                            const postId = this._commentPostId;
                            
                            // 缓存响应数据（除非是强制刷新）
                            if (!window._commentSubmitting) {
                                window._commentsCacheMap[postId] = data;
                                window._commentsLastLoaded[postId] = new Date().getTime();
                            }
                        } catch (e) {
                            console.error('无法解析评论JSON', e);
                        }
                    }
                    
                    // 调用原始的onload
                    if (originalOnload) originalOnload.call(this);
                };
            }
            
            // 调用原始方法
            return originalXHRSend.apply(this, arguments);
        };
        
        attachEventHandlers();
    });
    
    // 为帖子的评论部分添加事件处理程序
    function attachEventHandlers() {
        
        // 委托事件监听 - 为评论按钮添加点击事件（只处理没有绑定原始事件的按钮）
        document.addEventListener('click', function(e) {
            // 处理评论按钮点击
            if (e.target.closest('.btn') && e.target.closest('.post-footer')) {
                const button = e.target.closest('.btn');
                if (button.textContent.includes('评论') && !button.hasAttribute('data-has-click-handler')) {
                    const postCard = button.closest('.post-card');
                    if (postCard) {
                        const postId = postCard.dataset.postId;
                        window.toggleComments(postId, postCard);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }
            
            // 刷新评论功能通过缓存过期自动处理
            
            // 处理评论提交按钮点击
            if (e.target.closest('.submit-comment')) {
                const submitBtn = e.target.closest('.submit-comment');
                const commentSection = submitBtn.closest('.comment-section');
                const textarea = commentSection.querySelector('.new-comment-content');
                const postCard = commentSection.closest('.post-card');
                if (postCard && textarea && textarea.value.trim()) {
                    submitComment(postCard.dataset.postId, textarea.value.trim(), postCard);
                    e.preventDefault();
                }
            }
            
            // 处理点赞按钮点击
            if (e.target.closest('.like-btn')) {
                const likeBtn = e.target.closest('.like-btn');
                const comment = likeBtn.closest('.comment');
                if (comment && comment.dataset.commentId) {
                    likeComment(comment.dataset.commentId, likeBtn);
                    e.preventDefault();
                }
            }
        });
        
        // 为新的评论文本框添加自动调整高度功能
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('new-comment-content')) {
                const textarea = e.target;
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        });
        
        // 监听已有评论区域的DOM变化，为新增的评论区添加功能
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    const commentSections = document.querySelectorAll('.comment-section:not([data-enhanced])');
                    commentSections.forEach(function(section) {
                        enhanceCommentSection(section);
                    });
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // 立即处理页面上已有的评论区
        const commentSections = document.querySelectorAll('.comment-section:not([data-enhanced])');
        commentSections.forEach(function(section) {
            enhanceCommentSection(section);
        });
    }
    
    // 增强评论区功能
    function enhanceCommentSection(commentSection) {
        if (!commentSection || commentSection.dataset.enhanced === 'true') return;
        
        // 标记为已增强，避免重复处理
        commentSection.dataset.enhanced = 'true';
        
        // 添加评论头部（如果不存在）
        if (!commentSection.querySelector('.comments-header')) {
            const header = document.createElement('div');
            header.className = 'comments-header d-flex align-items-center mb-2';
            header.innerHTML = `
                <small class="text-muted comments-status"></small>
            `;
            commentSection.insertBefore(header, commentSection.firstChild);
        }
        
        // 确保评论列表存在且有正确的结构
        if (!commentSection.querySelector('.comments-list')) {
            const commentsList = document.createElement('div');
            commentsList.className = 'comments-list';
            
            // 插入到评论头部后面，评论表单前面
            const header = commentSection.querySelector('.comments-header');
            if (header && header.nextSibling) {
                commentSection.insertBefore(commentsList, header.nextSibling);
            } else {
                const form = commentSection.querySelector('.comment-form');
                if (form) {
                    commentSection.insertBefore(commentsList, form);
                } else {
                    commentSection.appendChild(commentsList);
                }
            }
        }
        
        
    }
    
    // 增强的评论切换函数 - 由于我们直接注入了新的toggleComments函数，此函数不再被直接调用
    function enhancedToggleComments(postId, postElement) {
        // 注意：这个函数现在主要作为备份，实际逻辑已移至注入的脚本中
        if (!postId || !postElement) return;
        
        // 获取评论区元素
        const commentSection = postElement.querySelector('.comment-section');
        if (!commentSection) return;
        
        // 增强评论区
        enhanceCommentSection(commentSection);
        
        // 加载评论 - 使用集中式函数
        if (window.app && typeof window.app.loadComments === 'function') {
            window.app.loadComments(postId, commentSection);
        }
    }
    
    // 检查缓存是否过期
    function isCacheExpired(postId, expiryMinutes = 3) {
        // 检查全局缓存
        if (window._commentsLastLoaded && window._commentsLastLoaded[postId]) {
            const lastLoaded = window._commentsLastLoaded[postId];
            const now = new Date().getTime();
            const diffMinutes = (now - lastLoaded) / (1000 * 60);
            return diffMinutes > expiryMinutes;
        }
        return true;
    }
    
    // 加载评论 (使用集中式loadComments实现)
    async function loadComments(postId, commentSection, forceRefresh = false) {
        // 如果app.js中的集中式loadComments可用，则使用它
        if (window.app && typeof window.app.loadComments === 'function') {
            window.app.loadComments(postId, commentSection, forceRefresh);
            return;
        }
        
        // 以下为向后兼容的实现
        const apiUrl = '/api';
        const commentsList = commentSection.querySelector('.comments-list');
        const statusElem = commentSection.querySelector('.comments-status');
        
        if (!commentsList) return;
        
        // 更新状态显示
        if (statusElem) statusElem.textContent = '正在加载评论...';
        
        // 检查全局缓存
        if (!forceRefresh && window._commentsCacheMap && window._commentsCacheMap[postId] && !isCacheExpired(postId)) {
            renderComments(window._commentsCacheMap[postId], commentsList);
            updateCommentsStatus(postId, commentSection);
            return;
        }
        
        // 显示加载中
        commentsList.innerHTML = createLoadingHTML('加载中...');
        
        try {
            const response = await fetch(`${apiUrl}/posts/${postId}/comments`);
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 更新全局缓存
            if (!window._commentsCacheMap) window._commentsCacheMap = {};
            if (!window._commentsLastLoaded) window._commentsLastLoaded = {};
            
            window._commentsCacheMap[postId] = data;
            window._commentsLastLoaded[postId] = new Date().getTime();
            
            // 渲染评论
            renderComments(data, commentsList);
            
            // 更新评论计数和状态
            updateCommentCount(postId, data.total);
            updateCommentsStatus(postId, commentSection, true);
        } catch (error) {
            console.error('加载评论失败:', error);
            commentsList.innerHTML = createErrorHTML(error.message, () => loadComments(postId, commentSection, true));
            if (statusElem) statusElem.textContent = '加载失败';
        } finally {
            // 恢复按钮状态
        }
    }
    
    // 渲染评论
    function renderComments(data, container) {
        if (!container) return;
        container.innerHTML = '';
        
        if (!data.comments || data.comments.length === 0) {
            container.innerHTML = '<div class="text-center text-muted p-3">暂无评论</div>';
            return;
        }
        
        // 创建评论元素包装器
        const commentsWrapper = document.createElement('div');
        commentsWrapper.className = 'comments-wrapper';
        
        data.comments.forEach(comment => {
            try {
                const commentElement = createCommentElement(comment);
                commentsWrapper.appendChild(commentElement);
            } catch (err) {
                console.error('创建评论元素失败:', err);
            }
        });
        
        container.appendChild(commentsWrapper);
    }
    
    // 创建评论元素
    function createCommentElement(comment) {
        if (!comment || !comment.id) {
            throw new Error('无效的评论数据');
        }
        
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.dataset.commentId = comment.id;
        
        // 添加评论内容
        const content = document.createElement('div');
        content.className = 'comment-content';
        content.innerHTML = comment.content || '';
        
        // 添加评论底部信息栏
        const commentFooter = document.createElement('div');
        commentFooter.className = 'comment-footer d-flex align-items-center justify-content-between';
        
        // 时间信息
        const time = document.createElement('small');
        time.className = 'comment-time text-muted';
        time.textContent = formatDate(comment.created_at);
        const dateObj = new Date(comment.created_at);
        time.title = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}:${dateObj.getSeconds().toString().padStart(2, '0')}`;
        
        // 功能按钮区域
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'comment-actions';
        
        // 添加点赞按钮
        const likeBtn = document.createElement('button');
        likeBtn.className = 'btn btn-sm text-muted like-btn';
        
        // 检查本地存储的点赞状态
        const likedComments = JSON.parse(localStorage.getItem('likedComments') || '{}');
        const likes = likedComments[comment.id] || comment.likes || 0;
        likeBtn.innerHTML = `<small>👍 ${likes}</small>`;
        
        if (likedComments[comment.id]) {
            likeBtn.classList.add('text-primary');
            likeBtn.classList.remove('text-muted');
        }
        
        likeBtn.title = '点赞';
        
        // 组装UI
        actionsDiv.appendChild(likeBtn);
        commentFooter.appendChild(time);
        commentFooter.appendChild(actionsDiv);
        
        commentElement.appendChild(content);
        commentElement.appendChild(commentFooter);
        
        return commentElement;
    }
    
    // 更新评论状态显示
    function updateCommentsStatus(postId, commentSection, isJustLoaded = false) {
        const statusElem = commentSection.querySelector('.comments-status');
        if (!statusElem) return;
        
        const cached = commentsCache[postId];
        if (!cached) {
            statusElem.textContent = '';
            return;
        }
        
        const total = cached.total || 0;
        const comments = cached.comments || [];
        const cachedTime = cached.cachedAt ? new Date(cached.cachedAt) : null;
        
        let statusText = `${total} 条评论`;
        
        if (cachedTime && !isJustLoaded) {
            // 计算时间差
            const now = new Date();
            const diffMinutes = Math.floor((now - cachedTime) / (1000 * 60));
            
            if (diffMinutes < 1) {
                statusText += ' · 刚刚更新';
            } else if (diffMinutes < 60) {
                statusText += ` · ${diffMinutes}分钟前更新`;
            } else {
                const diffHours = Math.floor(diffMinutes / 60);
                if (diffHours < 24) {
                    statusText += ` · ${diffHours}小时前更新`;
                } else {
                    statusText += ` · ${Math.floor(diffHours / 24)}天前更新`;
                }
            }
        } else if (isJustLoaded) {
            statusText += ' · 刚刚更新';
        }
        
        statusElem.textContent = statusText;
        
        // 不需要刷新按钮，自动通过缓存过期处理
    }
    
    // 更新评论计数
    function updateCommentCount(postId, count) {
        const postElement = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (postElement) {
            const countElement = postElement.querySelector('.comments-count');
            if (countElement) {
                countElement.textContent = count || 0;
            }
        }
    }
    
    // 提交评论
    async function submitComment(postId, content, postElement) {
        if (!postId || !content || !postElement) return;
        
        const apiUrl = '/api';
        const commentSection = postElement.querySelector('.comment-section');
        const textarea = commentSection.querySelector('.new-comment-content');
        const submitButton = commentSection.querySelector('.submit-comment');
        
        if (!textarea || !submitButton) return;
        
        // 禁用按钮，防止重复提交
        submitButton.disabled = true;
        submitButton.textContent = '提交中...';
        
        try {
            const response = await fetch(`${apiUrl}/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            
            if (!response.ok) {
                throw new Error(`提交失败 (${response.status})`);
            }
            
            const comment = await response.json();
            
            // 清空文本框
            textarea.value = '';
            textarea.style.height = 'auto';
            
            // 清除所有缓存并强制刷新评论
            if (window._commentsCacheMap) {
                delete window._commentsCacheMap[postId];
            }
            if (window._commentsLastLoaded) {
                delete window._commentsLastLoaded[postId];
            }
            // 使用集中式函数加载评论
            if (window.app && typeof window.app.loadComments === 'function') {
                window.app.loadComments(postId, commentSection, true);  // 强制刷新
            } else {
                // 回退到本地实现
                loadComments(postId, commentSection, true);
            }
            
            // 更新父帖子的评论计数
            const countElement = postElement.querySelector('.comments-count');
            if (countElement) {
                const currentCount = parseInt(countElement.textContent || '0');
                countElement.textContent = (currentCount + 1).toString();
            }
        } catch (error) {
            console.error('提交评论失败:', error);
            alert(`提交评论失败: ${error.message || '未知错误'}`);
        } finally {
            // 恢复按钮状态
            submitButton.disabled = false;
            submitButton.textContent = '回复';
        }
    }
    
    // 点赞评论功能
    function likeComment(commentId, likeButton) {
        if (!commentId || !likeButton) return;
        
        // 防止重复点击
        if (likeButton.disabled) return;
        likeButton.disabled = true;
        
        try {
            // 获取当前点赞数
            const likesElem = likeButton.querySelector('small');
            const currentLikes = parseInt(likesElem.textContent.replace('👍', '').trim() || '0');
            
            // 更新点赞数（前端模拟）
            const newLikes = currentLikes + 1;
            likesElem.textContent = `👍 ${newLikes}`;
            
            // 视觉反馈
            likeButton.classList.add('text-primary');
            likeButton.classList.remove('text-muted');
            
            // 存储在本地（临时方案）
            const likedComments = JSON.parse(localStorage.getItem('likedComments') || '{}');
            likedComments[commentId] = newLikes;
            localStorage.setItem('likedComments', JSON.stringify(likedComments));
            
            // 提示用户（首次点赞时）
            if (newLikes === 1 && window.UIEffects && window.UIEffects.showToast) {
                window.UIEffects.showToast('后端点赞API尚未实现，此操作仅在前端生效', 'info', 3000);
            }
            
        } catch (error) {
            console.error('点赞操作失败:', error);
        } finally {
            // 延迟一段时间后才允许再次点击
            setTimeout(() => {
                likeButton.disabled = false;
            }, 500);
        }
    }
    
    // 创建加载中指示器的HTML
    function createLoadingHTML(message = '正在加载内容...') {
        return `<div class="text-center p-2"><div class="spinner"></div><p>${message}</p></div>`;
    }
    
    // 创建错误提示的HTML
    function createErrorHTML(message, retryCallback) {
        const html = `
            <div class="text-center p-3 error-message">
                <p class="text-muted">${message || '加载失败'}</p>
                ${retryCallback ? '<button class="btn btn-sm btn-outline-secondary mt-2 retry-btn">重试</button>' : ''}
            </div>
        `.trim();
        
        // 使用setTimeout确保DOM元素创建后再添加事件监听
        setTimeout(() => {
            document.querySelectorAll('.error-message .retry-btn').forEach(btn => {
                btn.addEventListener('click', retryCallback);
            });
        }, 0);
        
        return html;
    }
    
    // 格式化日期工具
    function formatDate(dateString) {
        if (!dateString) return '未知时间';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '未知时间';
        
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // 相差的秒数
        
        if (diff < 60) {
            return '刚刚';
        } else if (diff < 3600) {
            return Math.floor(diff / 60) + ' 分钟前';
        } else if (diff < 86400) {
            return Math.floor(diff / 3600) + ' 小时前';
        } else if (diff < 2592000) {
            return Math.floor(diff / 86400) + ' 天前';
        } else {
            // 超过30天显示具体日期和时间（24小时制）
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    }
})();

// 添加相关CSS
document.addEventListener('DOMContentLoaded', function() {
    // 添加必要的CSS样式
    if (!document.getElementById('comment-enhancements-css')) {
        const style = document.createElement('style');
        style.id = 'comment-enhancements-css';
        style.textContent = `
    .comments-header {
        padding-bottom: 8px;
        margin-bottom: 12px;
        border-bottom: 1px solid #eee;
        justify-content: flex-start !important;
    }
    
    .comments-status {
        font-size: 0.9rem;
        color: #6c757d;
        padding-left: 0;
    }
    
    /* 已移除刷新按钮 */
    
    .comments-wrapper {
        max-height: 400px;
        overflow-y: auto;
        margin-bottom: 15px;
        padding-right: 5px;
    }
    
    .comment-footer {
        font-size: 0.8rem;
        padding-top: 5px;
    }
    
    .comment-actions {
        display: flex;
        gap: 10px;
    }
    
    .like-btn {
        border: none;
        background: none;
        padding: 0 5px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }
    
    .like-btn:hover {
        opacity: 1;
        color: #495057 !important;
    }
    `;
        document.head.appendChild(style);
    }
    
    // 设置全局变量用于控制强制刷新和评论提交
    window._forceCommentRefresh = false;
    window._commentSubmitting = false;
    
    // 评论增强模块已加载，XHR拦截生效中
});