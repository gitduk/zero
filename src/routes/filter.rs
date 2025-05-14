use crate::utils::filter::{filter_sensitive_words, reload_sensitive_words};
use axum::{http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};

/// 创建敏感词过滤相关路由
pub fn filter_routes() -> Router {
    Router::new()
        .route("/reload", post(reload_filter))
        .route("/test", post(test_filter))
}

/// 重新加载敏感词列表的响应
#[derive(Serialize)]
pub struct ReloadResponse {
    success: bool,
    message: String,
    count: Option<usize>,
}

/// 重新加载敏感词列表
///
/// 管理员可以通过这个接口在更新 filter.txt 文件后重新加载敏感词列表，
/// 无需重启服务器
async fn reload_filter() -> Result<Json<ReloadResponse>, (StatusCode, String)> {
    match reload_sensitive_words() {
        Ok(count) => Ok(Json(ReloadResponse {
            success: true,
            message: format!("成功重新加载敏感词列表"),
            count: Some(count),
        })),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("加载敏感词列表失败: {}", e),
        )),
    }
}

/// 敏感词测试请求
#[derive(Deserialize)]
pub struct TestFilterRequest {
    content: String,
}

/// 敏感词测试响应
#[derive(Serialize)]
pub struct TestFilterResponse {
    original: String,
    filtered: String,
}

/// 测试敏感词过滤
///
/// 可以通过这个接口测试特定内容的敏感词过滤效果
async fn test_filter(Json(request): Json<TestFilterRequest>) -> Json<TestFilterResponse> {
    let filtered = filter_sensitive_words(&request.content);

    Json(TestFilterResponse {
        original: request.content,
        filtered,
    })
}

