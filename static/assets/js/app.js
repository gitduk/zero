// 树洞应用的主要JavaScript文件
(function() {
    'use strict';
    
    // 全局变量
    const apiUrl = '/api';
    let currentPage = 1;
    let totalPages = 1;
    var commentsCache = {}; // 使用var避免重复声明问题

    // DOM元素
    let postsContainer;
    let postTextarea;
    let submitPostBtn;
    let paginationContainer;
    let loadingIndicator;
    
    // 在DOM加载完成后初始化
    document.addEventListener('DOMContentLoaded', function() {
        // 获取DOM元素
        postsContainer = document.getElementById('posts-container');
        postTextarea = document.getElementById('new-post-content');
        submitPostBtn = document.getElementById('submit-post');
        paginationContainer = document.getElementById('pagination');
        loadingIndicator = document.getElementById('loading-indicator');
        
        // 初始化应用
        init();
    });

    // 初始化
    function init() {
        setupEventListeners();
        loadPosts(1);
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 发布帖子按钮
        if (submitPostBtn) {
            // 移除可能存在的旧事件监听器，避免重复绑定
            submitPostBtn.removeEventListener('click', submitPost);
            submitPostBtn.addEventListener('click', submitPost);
        }

        // 自动调整文本框高度
        document.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        });
    }

    // 加载帖子列表
    function loadPosts(page = 1) {
        // 不显示顶部加载指示器，因为帖子容器内已有加载动画
        if (!postsContainer) {
            console.error('[DEBUG] 找不到帖子容器元素');
            return;
        }
        
        postsContainer.innerHTML = `<div class="text-center p-2"><div class="spinner"></div></div>`;
        currentPage = page;

        
        // 添加5秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        fetch(`${apiUrl}/posts?page=${page}&per_page=10`, {
            signal: controller.signal
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`服务器错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                displayPosts(data);
                if (data.page && data.total && data.page_size) {
                    updatePagination(data.page, Math.ceil(data.total / data.page_size));
                }
                // 不需要隐藏顶部加载指示器
            })
            .catch(error => {
                console.error('加载帖子失败:', error);
                postsContainer.innerHTML = '<div class="text-center text-muted p-3">暂无内容</div>';
                // 不需要隐藏顶部加载指示器
            });
    }

    // 显示帖子列表
    function displayPosts(data) {
        if (!postsContainer) {
            console.error('找不到帖子容器元素');
            return;
        }
        
        if (!data.posts || data.posts.length === 0) {
            postsContainer.innerHTML = '<div class="text-center text-muted p-2">暂无内容</div>';
            return;
        }

        try {
            postsContainer.innerHTML = '';
            data.posts.forEach(post => {
                if (post && post.id) {
                    const postElement = createPostElement(post);
                    postsContainer.appendChild(postElement);
                }
            });
        } catch (err) {
            console.error('显示帖子时出错:', err);
            postsContainer.innerHTML = '<div class="alert alert-danger">显示帖子时出错</div>';
        }
    }

    // 创建帖子元素
    function createPostElement(post) {
        try {
            if (!post || !post.id) {
                console.error('帖子数据无效:', post);
                const errorEl = document.createElement('div');
                errorEl.className = 'alert alert-warning';
                errorEl.textContent = '无效的帖子数据';
                return errorEl;
            }
            
            const postElement = document.createElement('div');
            postElement.className = 'card mb-4';
            postElement.dataset.postId = post.id;
    
            // 确保内容安全
            const content = post.content || '(无内容)';
            const date = new Date(post.created_at);
            const time = post.created_at ? 
                `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}` 
                : '未知时间';
    
            postElement.innerHTML = `
                <div class="card-body">
                    <div class="post-content">${content}</div>
                    <div class="post-footer d-flex justify-content-between align-items-center mt-2">
                        <small class="post-time text-muted">${time}</small>
                        <button type="button" class="btn btn-sm btn-outline-primary show-comments">
                            ${post.comments_count > 0 ? `评论 ${post.comments_count}` : '评论'}
                        </button>
                    </div>
                </div>
                <div class="comment-section" style="display: none; padding: 0 15px 15px 15px;">
                    <div class="comments-list mt-2">
                        <div class="text-center p-2">
                            <div class="spinner"></div>
                        </div>
                    </div>
                    <div class="comment-form mt-3">
                        <textarea class="form-control new-comment" placeholder="添加评论..."></textarea>
                        <div class="text-end mt-2">
                            <button type="button" class="btn btn-sm btn-primary submit-comment">发表评论</button>
                        </div>
                    </div>
                </div>
            `;
    
            // 长文本处理
            const contentEl = postElement.querySelector('.post-content');
            if (contentEl && content.length > 200) {
                try {
                    setupCollapsibleContent(contentEl);
                } catch (err) {
                    console.error('设置可折叠内容失败:', err);
                }
            }
    
            // 评论按钮点击
            const commentBtn = postElement.querySelector('.show-comments');
            const commentSection = postElement.querySelector('.comment-section');
                
            if (commentBtn && commentSection) {
                commentBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // 切换评论区显示状态
                    if (commentSection.style.display === 'none') {
                        commentSection.style.display = 'block';
                        loadComments(post.id, commentSection);
                    } else {
                        commentSection.style.display = 'none';
                    }
                });
            }
    
            // 提交评论
            const submitCommentBtn = postElement.querySelector('.submit-comment');
            const commentTextarea = postElement.querySelector('.new-comment');
            
            if (submitCommentBtn && commentTextarea) {
                submitCommentBtn.addEventListener('click', function() {
                    submitComment(post.id, commentTextarea.value, commentSection);
                });
            }
    
            return postElement;
        } catch (err) {
            console.error('创建帖子元素失败:', err);
            const errorEl = document.createElement('div');
            errorEl.className = 'alert alert-danger';
            errorEl.textContent = '创建帖子元素失败';
            return errorEl;
        }
    }

    // 设置可折叠内容
    function setupCollapsibleContent(element) {
        if (!element || !element.parentNode) {
            console.error('设置可折叠内容失败: 无效元素');
            return;
        }
        
        element.classList.add('collapsible-content');
        element.style.maxHeight = '200px';
        element.style.overflow = 'hidden';
        element.style.position = 'relative';
        
        const overlay = document.createElement('div');
        overlay.className = 'content-overlay';
        overlay.style.position = 'absolute';
        overlay.style.bottom = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.height = '50px';
        overlay.style.background = 'linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1))';
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn btn-sm btn-link';
        expandBtn.textContent = '展开';
        expandBtn.style.display = 'block';
        expandBtn.style.width = '100%';
        expandBtn.style.textAlign = 'center';
        expandBtn.style.marginTop = '5px';
        
        element.parentNode.appendChild(overlay);
        element.parentNode.appendChild(expandBtn);
        
        expandBtn.addEventListener('click', function() {
            if (element.style.maxHeight === '200px') {
                // 展开
                element.style.maxHeight = 'none';
                element.style.overflow = 'visible';
                overlay.style.display = 'none';
                expandBtn.textContent = '收起';
            } else {
                // 收起
                element.style.maxHeight = '200px';
                element.style.overflow = 'hidden';
                overlay.style.display = 'block';
                expandBtn.textContent = '展开';
            }
        });
    }

    // 加载评论
    function loadComments(postId, commentSection) {
        const commentsList = commentSection.querySelector('.comments-list');
        
        // 检查缓存
        if (commentsCache[postId]) {
            renderComments(commentsCache[postId], commentsList);
            return;
        }
        
        commentsList.innerHTML = '<div class="text-center p-3"><div class="spinner"></div><p>加载评论中...</p></div>';
        
        fetch(`${apiUrl}/posts/${postId}/comments`)
            .then(handleResponse)
            .then(data => {
                commentsCache[postId] = data;
                renderComments(data, commentsList);
            })
            .catch(error => {
                commentsList.innerHTML = `<div class="alert alert-danger">加载评论失败: ${error.message}</div>`;
            });
    }

    // 渲染评论
    function renderComments(data, container) {
        if (!data.comments || data.comments.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">暂无评论</div>';
            return;
        }
        
        container.innerHTML = '';
        data.comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <div class="comment-content">${comment.content}</div>
                <small class="comment-time">${formatTime(comment.created_at)}</small>
            `;
            container.appendChild(commentElement);
        });
    }

    // 格式化评论时间为24小时制
    function formatCommentTime(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // 提交评论
    function submitComment(postId, content, commentSection) {
        if (!content.trim()) {
            alert('请输入评论内容');
            return;
        }
        
        const commentTextarea = commentSection.querySelector('.new-comment');
        const submitBtn = commentSection.querySelector('.submit-comment');
        
        submitBtn.disabled = true;
        submitBtn.textContent = '发表中';
        
        fetch(`${apiUrl}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })
        .then(handleResponse)
        .then(comment => {
            // 清空输入
            commentTextarea.value = '';
            
            // 清除缓存
            delete commentsCache[postId];
            
            // 重新加载评论
            loadComments(postId, commentSection);
        })
        .catch(error => {
            alert(`发布评论失败: ${error.message}`);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = '发表评论';
            submitBtn.blur();
        });
    }

    // 提交新帖子
    function submitPost() {
        if (!postTextarea || !submitPostBtn) {
            console.error('找不到必要的DOM元素');
            return;
        }
        
        const content = postTextarea.value.trim();
        
        if (!content) {
            return;
        }
        
        // 防止重复提交 - 如果按钮已禁用，直接退出
        if (submitPostBtn.disabled) {
            return;
        }
        
        submitPostBtn.disabled = true;
        submitPostBtn.textContent = '发表中';
        
        fetch(`${apiUrl}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status}`);
            }
            return response.json();
        })
        .then(post => {
            postTextarea.value = '';
            loadPosts(1); // 重新加载第一页
            
            if (window.UIEffects && window.UIEffects.showToast) {
                window.UIEffects.showToast('发布成功', 'success');
            } else {
                alert('发布成功');
            }
        })
        .catch(error => {
            console.error('发布失败:', error.message);
            alert(`发布失败: ${error.message || '未知错误'}`);
        })
        .finally(() => {
            submitPostBtn.disabled = false;
            submitPostBtn.textContent = '发表';
            submitPostBtn.blur();
        });
    }

    // 更新分页
    function updatePagination(current, total) {
        if (!paginationContainer) return;
        
        try {
            totalPages = total;
            if (total <= 1) {
                paginationContainer.innerHTML = '';
                return;
            }
            
            let html = '<ul class="pagination">';
            
            // 上一页
            if (current > 1) {
                html += `<li><a href="javascript:void(0)" data-page="${current - 1}">&laquo;</a></li>`;
            } else {
                html += '<li class="disabled"><a href="javascript:void(0)">&laquo;</a></li>';
            }
            
            // 页码
            const startPage = Math.max(1, current - 2);
            const endPage = Math.min(total, startPage + 4);
            
            for (let i = startPage; i <= endPage; i++) {
                if (i === current) {
                    html += `<li class="active"><a href="javascript:void(0)">${i}</a></li>`;
                } else {
                    html += `<li><a href="javascript:void(0)" data-page="${i}">${i}</a></li>`;
                }
            }
            
            // 下一页
            if (current < total) {
                html += `<li><a href="javascript:void(0)" data-page="${current + 1}">&raquo;</a></li>`;
            } else {
                html += '<li class="disabled"><a href="javascript:void(0)">&raquo;</a></li>';
            }
            
            html += '</ul>';
            paginationContainer.innerHTML = html;
            
            // 添加事件监听
            paginationContainer.querySelectorAll('a[data-page]').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const page = parseInt(this.dataset.page);
                    loadPosts(page);
                });
            });
        } catch (err) {
            console.error('更新分页失败:', err);
        }
    }

    // 加载评论
    // commentsCache已在顶部声明为全局变量
    
    // 确保window.app存在
    if (!window.app) window.app = {};
    
    function loadComments(postId, commentSection, forceRefresh = false) {
        if (!commentSection) return;
        
        const commentsList = commentSection.querySelector('.comments-list');
        if (!commentsList) return;
        
        // 检查缓存是否存在且没有过期
        if (!forceRefresh && commentsCache[postId]) {
            const now = new Date().getTime();
            const cachedAt = commentsCache[postId].cachedAt || 0;
            const cacheAgeMinutes = (now - cachedAt) / (1000 * 60);
            
            // 如果缓存不超过3分钟，直接使用缓存
            if (cacheAgeMinutes <= 3) {
                console.log('使用缓存的评论数据:', postId);
                renderCachedComments(commentsCache[postId], commentsList);
                return;
            }
        }
        
        // 显示加载中
        commentsList.innerHTML = '<div class="text-center p-2"><div class="spinner"></div></div>';
        
        // 添加5秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        fetch(`${apiUrl}/posts/${postId}/comments`, {
            signal: controller.signal
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`服务器错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // 添加时间戳并保存到缓存
                data.cachedAt = new Date().getTime();
                commentsCache[postId] = data;
                
                // 更新评论按钮中的评论数
                const postElement = commentSection.closest('.card');
                if (postElement) {
                    const commentBtn = postElement.querySelector('.show-comments');
                    const count = data.total || data.comments?.length || 0;
                
                    // 更新按钮文本
                    if (commentBtn) {
                        commentBtn.textContent = count > 0 ? `评论 ${count}` : '评论';
                        // 确保按钮样式正确
                        commentBtn.className = 'btn btn-sm btn-outline-primary show-comments';
                    }
                }
                
                renderCachedComments(data, commentsList);
            })
            .catch(error => {
                console.error('加载评论失败:', error);
                const errorMessage = error.name === 'AbortError' 
                    ? '加载超时，请检查网络连接' 
                    : `加载失败: ${error.message}`;
                commentsList.innerHTML = `
                    <div class="alert alert-danger">${errorMessage}</div>
                    <div class="text-center mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="window.app.loadComments('${postId}', this.closest('.comment-section'), true)">重试</button>
                    </div>
                `;
            });
    }
    
    // 导出函数到window.app命名空间
    window.app.loadComments = loadComments;
    
    
    // 渲染缓存的评论
    function renderCachedComments(data, commentsList) {
        if (!data.comments || data.comments.length === 0) {
            commentsList.innerHTML = `<div class="text-center text-muted p-3">暂无评论</div>`;
            return;
        }
        
        commentsList.innerHTML = '';
        data.comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment mb-2 pb-2 border-bottom';
            commentElement.innerHTML = `
                <div class="comment-content mb-1">${comment.content || ''}</div>
                <small class="comment-time text-muted d-block">${comment.created_at ? formatCommentTime(comment.created_at) : '未知时间'}</small>
            `;
            commentsList.appendChild(commentElement);
        });
    }
    
    // 提交评论
    function submitComment(postId, content, commentSection) {
        if (!commentSection) return;
        if (!content || !content.trim()) {
            return;
        }
        
        const commentTextarea = commentSection.querySelector('.new-comment');
        const submitBtn = commentSection.querySelector('.submit-comment');
        
        if (!commentTextarea || !submitBtn) return;
        
        // 防止重复提交
        if (submitBtn.disabled) {
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = '发表中...';
        
        fetch(`${apiUrl}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: content.trim() })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('提交失败');
            }
            return response.json();
        })
        .then(comment => {
            commentTextarea.value = '';
            
            // 更新评论按钮中的评论数
            const postElement = commentSection.closest('.card');
            if (postElement) {
                const commentBtn = postElement.querySelector('.show-comments');
                // 解析当前评论数并增加1
                let currentText = commentBtn?.textContent || '';
                let matches = currentText.match(/评论\s*(\d+)/);
                let currentCount = matches ? parseInt(matches[1], 10) : 0;
                let newCount = currentCount + 1;
                    
                // 更新按钮文本
                if (commentBtn) {
                    commentBtn.textContent = `评论 ${newCount}`;
                    commentBtn.className = 'btn btn-sm btn-outline-primary show-comments';
                }
            }
            
            // 清除缓存，强制重新加载
            delete commentsCache[postId];
    
            // 添加延迟确保 DOM 更新完成后再加载
            setTimeout(() => {
                loadComments(postId, commentSection, true); // 强制刷新
            }, 100);
        })
        .catch(error => {
            console.error('提交评论失败:', error);
            alert('提交评论失败: ' + error.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = '发表';
        });
    }

    // 公开API
    // 合并已有的函数，确保不覆盖window.app已有内容
    Object.assign(window.app, {
        loadPosts: loadPosts,
        submitPost: submitPost,
        loadComments: loadComments, // 确保导出loadComments函数
        renderCachedComments: renderCachedComments, // 导出渲染函数以便其他脚本使用
        refresh: function() { // 添加刷新函数
            loadPosts(1);
        },
        version: '1.0.5' // 添加版本号以便调试
    });
    
    // 添加自我诊断功能
    window.setTimeout(function() {
        const posts = document.querySelectorAll('#posts-container .card');
        if (posts.length === 0 && postsContainer) {
            loadPosts(1);
        }
    }, 5000);
})();