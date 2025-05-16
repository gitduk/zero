// 全局变量和状态
const API_BASE_URL = '/api';
// 避免变量名冲突
let main_currentPage = 1;
let main_totalPages = 1;
// 移除重复的缓存对象
// let commentsCache = {};

// 隐藏全局加载指示器
function hideGlobalLoader() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
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
        const retryBtn = document.querySelector('.error-message .retry-btn');
        if (retryBtn && retryCallback) {
            retryBtn.addEventListener('click', retryCallback);
        }
    }, 0);
    
    return html;
}

// 初始化函数
// 不再使用立即执行的init函数，而是等待app.js完成初始化
function mainInit() {
    // 静默初始化
    if (window.app) {
        // 已加载app.js
    }

    // 设置事件处理程序
    setupEventHandlers();
    console.log('[MAIN.JS] 事件处理程序设置完成');

    // 总是让app.js负责加载帖子，避免重复加载
    
    // 移除加载指示器
    hideGlobalLoader();
    console.log('[MAIN.JS] 初始化完成');
}

// 等待DOM和app.js都准备好
document.addEventListener('DOMContentLoaded', () => {
    // 检查app.js是否已加载
    if (window.app && window.app.loadPosts) {
        mainInit();
    } else {
        // 如果app.js尚未加载，则等待1秒再检查
        setTimeout(() => {
            if (window.app && window.app.loadPosts) {
                mainInit();
            } else {
                mainInit();
            }
        }, 1000);
    }
});

// 设置事件处理程序
function setupEventHandlers() {
    // 不再主动绑定提交事件，避免双重提交
    // 由app.js负责处理提交帖子功能

    // 自动调整文本框大小
    setupAutoResizeTextareas();

    // Ctrl+Enter 快捷键
    setupCtrlEnterShortcuts();
}

// 帖子加载函数 - 简化为仅调用app.js的实现
async function loadPosts(page = 1) {
    console.log('[MAIN.JS] loadPosts 被调用, page =', page);
    // 如果app.js已经提供了加载帖子功能，优先使用它
    if (window.app && typeof window.app.loadPosts === 'function') {
        window.app.loadPosts(page);
        return;
    }
    
    // 如果app.js不可用，显示错误消息
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = `<div class="alert alert-danger">加载失败: app.js未正确加载</div>`;
    }
}

// 渲染帖子列表
function renderPosts(data, container) {
    // 清空容器
    container.innerHTML = '';

    // 检查是否有帖子
    if (!data.posts || data.posts.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center">还没有帖子，来发布第一个吧！</div>';
        return;
    }

    // 创建帖子元素
    data.posts.forEach(post => {
        try {
            const postElement = createPostElement(post);
            container.appendChild(postElement);
        } catch (err) {
            console.error(`创建帖子元素失败:`, err, post);
        }
    });
}

// 创建帖子元素
function createPostElement(post) {
    if (!post || !post.id) {
        throw new Error('无效的帖子数据');
    }

    // 创建帖子卡片
    const postElement = document.createElement('div');
    postElement.className = 'card post-card';
    postElement.dataset.postId = post.id;

    // 创建帖子内容
    const postContent = document.createElement('div');
    postContent.className = 'card-body';

    // 添加内容
    const contentContainer = document.createElement('div');
    contentContainer.className = 'post-content';
    contentContainer.innerHTML = post.content || '(无内容)';
    postContent.appendChild(contentContainer);

    // 添加底部信息
    const footer = document.createElement('div');
    footer.className = 'post-footer d-flex justify-content-between';

    // 创建左侧信息（时间）
    const infoDiv = document.createElement('div');
    infoDiv.className = 'post-info';
    
    const timeElement = document.createElement('small');
    timeElement.className = 'post-time text-muted';
    timeElement.textContent = formatDate(post.created_at);
    const dateObj = new Date(post.created_at);
    timeElement.title = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    infoDiv.appendChild(timeElement);
    
    // 创建右侧按钮组
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'post-actions';

    // 创建评论按钮
    const commentButton = document.createElement('button');
    commentButton.className = 'btn btn-sm btn-outline-secondary';
    commentButton.innerHTML = `评论 (<span class="comments-count">${post.comments_count || 0}</span>)`;
    commentButton.addEventListener('click', () => toggleComments(post.id, postElement));
    actionsDiv.appendChild(commentButton);

    // 添加到帖子底部
    footer.appendChild(infoDiv);
    footer.appendChild(actionsDiv);
    postContent.appendChild(footer);
    postElement.appendChild(postContent);

    // 创建评论区域
    const commentSection = document.createElement('div');
    commentSection.className = 'comment-section d-none';
    commentSection.innerHTML = `
        <div class="comments-header d-flex justify-content-between align-items-center mb-2">
            <small class="text-muted comments-status">评论</small>
            <button class="btn btn-sm btn-outline-secondary refresh-comments" title="刷新评论">
                <small>刷新</small>
            </button>
        </div>
        <div class="comments-list"></div>
        <div class="comment-form mt-3">
            <textarea class="form-control new-comment-content" placeholder="添加评论..."></textarea>
            <div class="text-center mt-2">
                <button class="btn btn-secondary submit-comment">回复</button>
            </div>
        </div>
    `;

    // 绑定评论提交事件
    const submitCommentBtn = commentSection.querySelector('.submit-comment');
    submitCommentBtn.addEventListener('click', () => {
        const content = commentSection.querySelector('.new-comment-content').value.trim();
        if (content) {
            submitComment(post.id, content, postElement);
        }
    });
    
    // 绑定刷新评论事件
    const refreshBtn = commentSection.querySelector('.refresh-comments');
    refreshBtn.addEventListener('click', () => {
        loadComments(post.id, commentSection, true);
    });

    postElement.appendChild(commentSection);

    // 处理长文本
    if (post.content && post.content.length > 200) {
        handleLongContent(contentContainer);
    }

    return postElement;
}

// 处理长文本内容
function handleLongContent(container) {
    container.classList.add('collapsible-content');

    // 添加渐变遮罩
    const overlay = document.createElement('div');
    overlay.className = 'content-overlay';
    container.appendChild(overlay);

    // 添加展开按钮
    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn';
    expandBtn.textContent = '展开';
    container.parentNode.insertBefore(expandBtn, container.nextSibling);

    // 绑定展开/收起事件
    expandBtn.addEventListener('click', () => {
        const isExpanded = container.classList.toggle('expanded');
        expandBtn.textContent = isExpanded ? '收起' : '展开';
        overlay.style.display = isExpanded ? 'none' : 'block';
    });
}

// 切换评论显示
function toggleComments(postId, postElement) {
    const commentSection = postElement.querySelector('.comment-section');
    if (!commentSection) return;
    
    const isVisible = !commentSection.classList.contains('d-none');
    
    // 切换显示状态
    commentSection.classList.toggle('d-none');
    
    // 如果评论区变为隐藏，不做进一步处理
    if (isVisible) return;
    
    // 自动聚焦评论输入框
    const textarea = commentSection.querySelector('.new-comment-content');
    if (textarea) {
        setTimeout(() => textarea.focus(), 100);
    }
    
    // 使用app.js中的loadComments函数
    if (window.app && typeof window.app.loadComments === 'function') {
        window.app.loadComments(postId, commentSection);
    } else {
        // 回退到本地实现
        loadComments(postId, commentSection);
    }
}

// 加载评论 - 简化为仅调用app.js的函数
async function loadComments(postId, commentSection, forceRefresh = false) {
    // 直接调用app.js中的loadComments函数
    if (window.app && typeof window.app.loadComments === 'function') {
        window.app.loadComments(postId, commentSection, forceRefresh);
        return;
    }
    
    console.error('app.js中的loadComments函数不可用');
    
    // 显示错误信息
    const commentsList = commentSection?.querySelector('.comments-list');
    if (commentsList) {
        commentsList.innerHTML = `<div class="alert alert-danger">加载失败: app.js未正确加载</div>`;
    }
}

// 渲染评论
function renderComments(data, container) {
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

// 更新评论状态显示
function updateCommentsStatus(postId, commentSection, isJustLoaded = false) {
    const statusElem = commentSection.querySelector('.comments-status');
    if (!statusElem) return;
    
    const cached = commentsCache[postId];
    if (!cached) {
        statusElem.textContent = '评论';
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
    
    // 更新刷新按钮提示
    const refreshBtn = commentSection.querySelector('.refresh-comments');
    if (refreshBtn && cachedTime) {
        const now = new Date();
        const diffMinutes = Math.floor((now - cachedTime) / (1000 * 60));
        
        if (diffMinutes < 1) {
            refreshBtn.title = '刚刚更新过';
        } else if (diffMinutes < 60) {
            refreshBtn.title = `${diffMinutes}分钟前更新过`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);
            if (diffHours < 24) {
                refreshBtn.title = `${diffHours}小时前更新过`;
            } else {
                refreshBtn.title = `${Math.floor(diffHours / 24)}天前更新过`;
            }
        }
    }
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
    time.title = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    
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
    likeBtn.addEventListener('click', () => likeComment(comment.id, likeBtn));
    
    // 组装UI
    actionsDiv.appendChild(likeBtn);
    commentFooter.appendChild(time);
    commentFooter.appendChild(actionsDiv);
    
    commentElement.appendChild(content);
    commentElement.appendChild(commentFooter);

    return commentElement;
}

// 提交评论
async function submitComment(postId, content, postElement) {
    const commentSection = postElement.querySelector('.comment-section');
    const textarea = commentSection.querySelector('.new-comment-content');
    const submitButton = commentSection.querySelector('.submit-comment');

    // 禁用按钮，防止重复提交
    submitButton.disabled = true;
    submitButton.textContent = '提交中...';

    try {
        // 标记提交评论操作，绕过缓存检查
        window._commentSubmitting = true;
        
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error(`提交失败 (${response.status})`);
        }

        const comment = await response.json();
        console.log('评论提交成功:', comment);

        // 清空文本框
        textarea.value = '';

        // 清除缓存并强制刷新评论
        delete commentsCache[postId];
        if (window._commentsCacheMap) {
            delete window._commentsCacheMap[postId];
        }
        if (window._commentsLastLoaded) {
            delete window._commentsLastLoaded[postId];
        }
        
        // 强制刷新评论
        window._forceCommentRefresh = true;
        loadComments(postId, commentSection, true);
        
        // 更新父帖子的评论计数
        const countElement = postElement.querySelector('.comments-count');
        if (countElement) {
            const currentCount = parseInt(countElement.textContent || '0');
            countElement.textContent = (currentCount + 1).toString();
        }
    } catch (error) {
        console.error('提交评论失败:', error);
        alert(`提交评论失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        submitButton.disabled = false;
        submitButton.textContent = '回复';
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

// 点赞评论功能（前端模拟实现，因为后端API尚未实现）
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

// 处理帖子提交 - 不再使用此函数，由app.js处理
// 保留函数定义以避免引用错误
async function handlePostSubmit() {
    // 转发到app.js中的submitPost函数
    if (window.app && typeof window.app.submitPost === 'function') {
        window.app.submitPost();
    } else {
        alert('帖子提交功能不可用');
    }
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

// 设置Ctrl+Enter快捷键
function setupCtrlEnterShortcuts() {
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('keydown', function(e) {
            // 检测Ctrl+Enter组合键
            if ((e.ctrlKey || e.metaKey) && e.keyCode === 13) {
                e.preventDefault();
                
                // 查找最近的提交按钮
                const form = this.closest('.comment-form, .post-form');
                if (form) {
                    // 检查是否是帖子表单
                    if (form.classList.contains('post-form') && window.app && typeof window.app.submitPost === 'function') {
                        // 直接调用app.js的提交函数
                        window.app.submitPost();
                    } else {
                        const submitBtn = form.querySelector('button[type="submit"], .submit-comment, .submit-post, #submit-post');
                        if (submitBtn && !submitBtn.disabled) {
                            submitBtn.click();
                        }
                    }
                }
            }
        });
    });
}

// 设置自动调整文本框大小的函数
function setupAutoResizeTextareas() {
    document.querySelectorAll('textarea').forEach(textarea => {
        if (window.Utils && window.Utils.autoResizeTextarea) {
            window.Utils.autoResizeTextarea(textarea);
        } else {
            // 降级处理
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        }
    });
}

// 更新分页
function updatePagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    // 如果只有一页，不显示分页
    if (totalPages <= 1) return;

    // 创建"上一页"按钮
    const prevItem = document.createElement('li');
    prevItem.className = currentPage <= 1 ? 'disabled' : '';
    prevItem.innerHTML = `<a href="#" ${currentPage <= 1 ? 'tabindex="-1"' : 'data-page="' + (currentPage - 1) + '"'}>上一页</a>`;
    paginationContainer.appendChild(prevItem);
    
    // 创建页码按钮
    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = currentPage === i ? 'active' : '';
        pageItem.innerHTML = `<a href="#" data-page="${i}">${i}</a>`;
        paginationContainer.appendChild(pageItem);
    }
    
    // 创建"下一页"按钮
    const nextItem = document.createElement('li');
    nextItem.className = currentPage >= totalPages ? 'disabled' : '';
    nextItem.innerHTML = `<a href="#" ${currentPage >= totalPages ? 'tabindex="-1"' : 'data-page="' + (currentPage + 1) + '"'}>下一页</a>`;
    paginationContainer.appendChild(nextItem);
    
    // 添加点击事件
    paginationContainer.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.dataset.page);
            loadPosts(page);
        });
    });
}
