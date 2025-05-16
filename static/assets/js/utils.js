// 工具函数集合
(function(window) {
    'use strict';

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

    // 安全HTML显示（防止XSS）
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 简单的防抖函数
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    // 简单的节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // 自动调整文本框大小
    function autoResizeTextarea(textarea) {
        if (!textarea) return;
        
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }
    
    // 复制文本到剪贴板
    function copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (!navigator.clipboard) {
                // 备用方法
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                // 避免滚动到底部
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.position = "fixed";
                
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) {
                        resolve(true);
                    } else {
                        reject(new Error('无法复制文本'));
                    }
                } catch (err) {
                    document.body.removeChild(textArea);
                    reject(err);
                }
            } else {
                navigator.clipboard.writeText(text)
                    .then(() => resolve(true))
                    .catch(err => reject(err));
            }
        });
    }

    // 加载指示器
    const loadingUtils = {
        show: function(element, message = '加载中...') {
            if (!element) return;
            
            const loadingEl = document.createElement('div');
            loadingEl.className = 'loading-indicator';
            loadingEl.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
            
            element.appendChild(loadingEl);
            return loadingEl;
        },
        
        hide: function(element) {
            if (!element) return;
            
            const loadingEl = element.querySelector('.loading-indicator');
            if (loadingEl) {
                element.removeChild(loadingEl);
            }
        }
    };

    // 导出工具函数
    window.Utils = {
        formatDate,
        escapeHtml,
        debounce,
        throttle,
        autoResizeTextarea,
        copyToClipboard,
        loading: loadingUtils
    };
    
})(window);