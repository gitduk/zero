// UI交互效果模块
(function(window) {
    'use strict';

    // 淡入效果
    function fadeIn(element, duration = 400) {
        if (!element) return;
        
        element.style.opacity = 0;
        element.style.display = 'block';
        
        let start = null;
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const percent = Math.min(progress / duration, 1);
            
            element.style.opacity = percent;
            
            if (progress < duration) {
                window.requestAnimationFrame(animate);
            }
        }
        
        window.requestAnimationFrame(animate);
    }
    
    // 淡出效果
    function fadeOut(element, duration = 400) {
        if (!element) return;
        
        let start = null;
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity);
        
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const percent = Math.max(1 - (progress / duration), 0);
            
            element.style.opacity = percent * initialOpacity;
            
            if (progress < duration) {
                window.requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        }
        
        window.requestAnimationFrame(animate);
    }
    
    // 滑入效果
    function slideDown(element, duration = 400) {
        if (!element) return;
        
        // 保存元素原始样式
        const paddingTop = window.getComputedStyle(element).paddingTop;
        const paddingBottom = window.getComputedStyle(element).paddingBottom;
        const height = element.scrollHeight;
        
        // 设置初始状态
        element.style.overflow = 'hidden';
        element.style.paddingTop = 0;
        element.style.paddingBottom = 0;
        element.style.height = 0;
        element.style.display = 'block';
        
        let start = null;
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const percent = Math.min(progress / duration, 1);
            
            element.style.height = (percent * height) + 'px';
            element.style.paddingTop = (percent * parseFloat(paddingTop)) + 'px';
            element.style.paddingBottom = (percent * parseFloat(paddingBottom)) + 'px';
            
            if (progress < duration) {
                window.requestAnimationFrame(animate);
            } else {
                // 恢复原始样式
                element.style.overflow = '';
                element.style.height = '';
                element.style.paddingTop = paddingTop;
                element.style.paddingBottom = paddingBottom;
            }
        }
        
        window.requestAnimationFrame(animate);
    }
    
    // 滑出效果
    function slideUp(element, duration = 400) {
        if (!element) return;
        
        // 保存元素原始样式
        const height = element.scrollHeight;
        const paddingTop = window.getComputedStyle(element).paddingTop;
        const paddingBottom = window.getComputedStyle(element).paddingBottom;
        
        // 设置初始状态
        element.style.overflow = 'hidden';
        element.style.height = height + 'px';
        
        let start = null;
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const percent = Math.max(1 - (progress / duration), 0);
            
            element.style.height = (percent * height) + 'px';
            element.style.paddingTop = (percent * parseFloat(paddingTop)) + 'px';
            element.style.paddingBottom = (percent * parseFloat(paddingBottom)) + 'px';
            
            if (progress < duration) {
                window.requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
                // 恢复原始样式
                element.style.overflow = '';
                element.style.height = '';
                element.style.paddingTop = paddingTop;
                element.style.paddingBottom = paddingBottom;
            }
        }
        
        window.requestAnimationFrame(animate);
    }
    
    // 添加脉冲动画
    function addPulse(element, duration = 1000, times = 1) {
        if (!element) return;
        
        let count = 0;
        function doPulse() {
            element.classList.add('pulse-animation');
            
            setTimeout(() => {
                element.classList.remove('pulse-animation');
                count++;
                if (count < times) {
                    setTimeout(doPulse, 300);
                }
            }, duration);
        }
        
        doPulse();
    }
    
    // 平滑滚动到元素
    function scrollToElement(element, offset = 0, duration = 600) {
        if (!element) return;
        
        const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        let startTime = null;
        
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = easeOutQuad(progress);
            
            window.scrollTo(0, startPosition + distance * ease);
            
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }
        
        function easeOutQuad(t) {
            return t * (2 - t);
        }
        
        requestAnimationFrame(animation);
    }
    
    // 上下文菜单
    function createContextMenu(items, event) {
        // 阻止默认右键菜单
        event.preventDefault();
        
        // 移除任何已存在的上下文菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        // 添加菜单项
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            if (item.separator) {
                menuItem.className += ' separator';
            } else {
                menuItem.textContent = item.text;
                if (item.disabled) {
                    menuItem.className += ' disabled';
                } else {
                    menuItem.addEventListener('click', function() {
                        if (typeof item.action === 'function') {
                            item.action();
                        }
                        // 点击后关闭菜单
                        document.body.removeChild(menu);
                    });
                }
            }
            menu.appendChild(menuItem);
        });
        
        // 设置位置
        menu.style.top = `${event.pageY}px`;
        menu.style.left = `${event.pageX}px`;
        
        // 添加到DOM
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            }
        });
    }

    // 显示通知提示
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 200ms后显示
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);
        
        // 设置自动消失
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
        
        return toast;
    }
    
    // 导出功能
    window.UIEffects = {
        fadeIn,
        fadeOut,
        slideDown,
        slideUp,
        addPulse,
        scrollToElement,
        createContextMenu,
        showToast
    };
    
})(window);