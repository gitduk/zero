// 全局变量和状态
const API_BASE_URL = '/api';
let currentPage = 1;
let totalPages = 1;
let commentsCache = {};

// 初始化函数
function init() {
    // DOM 准备完成后执行
    document.addEventListener('DOMContentLoaded', () => {
        console.log('页面初始化开始');

        // 设置事件处理程序
        setupEventHandlers();

        // 初始加载帖子
        loadPosts(1);

        // 移除加载指示器
        hideGlobalLoader();
    });
}

// 设置事件处理程序
function setupEventHandlers() {
    // 发布帖子按钮
    const submitPostBtn = document.getElementById('submit-post');
    if (submitPostBtn) {
        submitPostBtn.addEventListener('click', handlePostSubmit);
    }

    // 自动调整文本框大小
    setupAutoResizeTextareas();

    // Ctrl+Enter 快捷键
    setupCtrlEnterShortcuts();
}

// 帖子加载函数
async function loadPosts(page = 1) {
    console.log(`正在加载第 ${page} 页帖子`);
    currentPage = page;

    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) {
        console.error('找不到帖子容器元素');
        return;
    }

    // 显示加载状态
    postsContainer.innerHTML = createLoadingHTML();

    try {
        // 获取帖子数据
        const response = await fetch(`${API_BASE_URL}/posts?page=${page}&per_page=10`);
        if (!response.ok) {
            throw new Error(`服务器错误 (${response.status})`);
        }

        const data = await response.json();
        console.log('获取到帖子数据:', data);

        // 渲染帖子列表
        renderPosts(data, postsContainer);

        // 更新分页
        totalPages = Math.ceil(data.total / data.page_size);
        updatePagination(data.page, totalPages);
    } catch (error) {
        console.error('加载帖子失败:', error);
        postsContainer.innerHTML = createErrorHTML(error.message, () => loadPosts(page));
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
    footer.className = 'post-footer';

    // 创建时间信息
    const timeElement = document.createElement('small');
    timeElement.className = 'post-time';
    timeElement.textContent = formatDate(post.created_at);
    footer.appendChild(timeElement);

    // 创建评论按钮
    const commentButton = document.createElement('button');
    commentButton.className = 'btn btn-sm btn-outline-secondary';
    commentButton.innerHTML = `评论 (<span class="comments-count">0</span>)`;
    commentButton.addEventListener('click', () => toggleComments(post.id, postElement));
    footer.appendChild(commentButton);

    // 添加到帖子内容
    postContent.appendChild(footer);
    postElement.appendChild(postContent);

    // 创建评论区域
    const commentSection = document.createElement('div');
    commentSection.className = 'comment-section d-none';
    commentSection.innerHTML = `
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
    const isVisible = !commentSection.classList.contains('d-none');

    // 切换显示状态
    commentSection.classList.toggle('d-none');

    // 如果评论区变为可见，加载评论
    if (!isVisible) {
        loadComments(postId, commentSection);
    }
}

// 加载评论
async function loadComments(postId, commentSection) {
    const commentsList = commentSection.querySelector('.comments-list');

    // 显示加载中
    commentsList.innerHTML = createLoadingHTML('正在加载评论...');

    // 检查缓存
    if (commentsCache[postId]) {
        console.log('使用缓存的评论数据:', postId);
        renderComments(commentsCache[postId], commentsList);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`);
        if (!response.ok) {
            throw new Error(`获取评论失败 (${response.status})`);
        }

        const data = await response.json();
        console.log('获取到评论数据:', data);

        // 缓存评论
        commentsCache[postId] = data;

        // 渲染评论
        renderComments(data, commentsList);

        // 更新评论计数
        updateCommentCount(postId, data.total);
    } catch (error) {
        console.error('加载评论失败:', error);
        commentsList.innerHTML = createErrorHTML(error.message, () => loadComments(postId, commentSection));
    }
}

// 渲染评论
function renderComments(data, container) {
    container.innerHTML = '';

    if (!data.comments || data.comments.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-3">暂无评论</div>';
        return;
    }

    data.comments.forEach(comment => {
        try {
            const commentElement = createCommentElement(comment);
            container.appendChild(commentElement);
        } catch (err) {
            console.error('创建评论元素失败:', err);
        }
    });
}

// 创建评论元素
function createCommentElement(comment) {
    if (!comment || !comment.id) {
        throw new Error('无效的评论数据');
    }

    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.dataset.commentId = comment.id;

    const content = document.createElement('div');
    content.className = 'comment-content';
    content.innerHTML = comment.content || '';

    const time = document.createElement('small');
    time.className = 'comment-time';
    time.textContent = formatDate(comment.created_at);

    commentElement.appendChild(content);
    commentElement.appendChild(time);

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

        // 清除缓存并重新加载评论
        delete commentsCache[postId];
        loadComments(postId, commentSection);
    } catch (error) {
        console.error('提交评论失败:', error);
        alert(`提交评论失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        submitButton.disabled = false;
        submitButton.textContent = '回复';
    }
}

// 处理帖子提交
async function handlePostSubmit() {
    const textarea = document.getElementById('new-post-content');
    const submitButton = document.getElementById('submit-post');

    const content = textarea.value.trim();
    if (!content) {
        alert('请输入内容');
        return;
    }

    // 禁用按钮，防止重复提交
    submitButton.disabled = true;
    submitButton.textContent = '发布中...';

    try {
        const response = await fetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error(`发布失败 (${response.status})`);
        }

        const post = await response.json();
        console.log('帖子发布成功:', post);

        // 清空输入框
        textarea.value = '';

        // 重新加载帖子列表
        loadPosts(1);
    } catch (error) {
        console.error('发布帖子失败:', error);
        alert(`发布失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        submitButton.disabled = false;
        submitButton.textContent = '发布';
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

// 更新分页
function updatePagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    // 如果只有一页，不显示分页
    if (totalPages <= 1) return;

    // 创建"上一页"按钮
    const prevItem = document.createElement('
