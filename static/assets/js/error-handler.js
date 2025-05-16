// 错误处理模块
(function(window) {
    'use strict';

    // 错误类型枚举
    const ErrorType = {
        NETWORK: 'network',
        API: 'api',
        VALIDATION: 'validation',
        AUTH: 'auth',
        UNKNOWN: 'unknown'
    };

    // 存储全局错误处理器
    let globalErrorHandler = null;

    // 错误处理类
    class ErrorHandler {
        constructor() {
            this.listeners = {};
            this.setupGlobalHandlers();
        }

        // 设置全局错误处理
        setupGlobalHandlers() {
            // 处理未捕获的Promise错误
            window.addEventListener('unhandledrejection', (event) => {
                this.handleError({
                    type: ErrorType.UNKNOWN,
                    message: event.reason?.message || '未知Promise错误',
                    originalError: event.reason
                });
            });

            // 处理全局JavaScript错误
            window.addEventListener('error', (event) => {
                this.handleError({
                    type: ErrorType.UNKNOWN,
                    message: event.message || '未知JavaScript错误',
                    originalError: event.error
                });
            });
        }

        // 添加错误监听器
        on(errorType, callback) {
            if (!this.listeners[errorType]) {
                this.listeners[errorType] = [];
            }
            this.listeners[errorType].push(callback);
            return this; // 链式调用
        }

        // 移除错误监听器
        off(errorType, callback) {
            if (this.listeners[errorType]) {
                this.listeners[errorType] = this.listeners[errorType].filter(
                    listener => listener !== callback
                );
            }
            return this; // 链式调用
        }

        // 处理错误
        handleError(error) {
            // 仅记录关键错误信息
            if (error.type !== ErrorType.VALIDATION) {
                console.error(`[${error.type}] ${error.message}`);
            }
            
            // 首先尝试特定类型的处理器
            const typeListeners = this.listeners[error.type] || [];
            let handled = false;
            
            for (const listener of typeListeners) {
                if (listener(error) === true) {
                    handled = true;
                    break;
                }
            }
            
            // 如果没有特定类型处理器处理，尝试使用通用处理器
            if (!handled && this.listeners[ErrorType.UNKNOWN]) {
                for (const listener of this.listeners[ErrorType.UNKNOWN]) {
                    if (listener(error) === true) {
                        handled = true;
                        break;
                    }
                }
            }
            
            // 如果仍然没有处理，使用全局处理器
            if (!handled && globalErrorHandler) {
                globalErrorHandler(error);
            }
            
            return handled;
        }

        // 创建一个网络错误
        createNetworkError(originalError, message) {
            return {
                type: ErrorType.NETWORK,
                message: message || '网络请求失败',
                originalError,
                timestamp: new Date()
            };
        }

        // 创建一个API错误
        createApiError(statusCode, body, originalError) {
            return {
                type: ErrorType.API,
                statusCode,
                body,
                message: body?.message || `API请求失败 (${statusCode})`,
                originalError,
                timestamp: new Date()
            };
        }

        // 创建一个验证错误
        createValidationError(fieldErrors, message) {
            return {
                type: ErrorType.VALIDATION,
                fieldErrors: fieldErrors || {},
                message: message || '输入验证失败',
                timestamp: new Date()
            };
        }
    }

    // 设置默认的全局错误处理器（可以被覆盖）
    globalErrorHandler = function(error) {
        // 检查是否在开发环境
        const isDev = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
        
        if (isDev) {
            // 开发环境 - 在控制台显示详细信息
            console.group('未处理的错误');
            console.error(`[${error.type}] ${error.message}`);
            if (error.originalError) {
                console.error('原始错误:', error.originalError.message || error.originalError);
            }
            console.groupEnd();
        } else {
            // 生产环境 - 简单通知用户
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-notification';
            errorContainer.innerHTML = `
                <div class="error-content">
                    <div class="error-title">发生错误</div>
                    <div class="error-message">${error.message}</div>
                    <button class="error-close">关闭</button>
                </div>
            `;
            
            document.body.appendChild(errorContainer);
            
            // 5秒后自动关闭
            setTimeout(() => {
                if (errorContainer.parentNode) {
                    errorContainer.parentNode.removeChild(errorContainer);
                }
            }, 5000);
            
            // 点击关闭按钮
            const closeButton = errorContainer.querySelector('.error-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    if (errorContainer.parentNode) {
                        errorContainer.parentNode.removeChild(errorContainer);
                    }
                });
            }
        }
    };

    // 导出
    window.ErrorHandler = new ErrorHandler();
    window.ErrorType = ErrorType;
    
})(window);