use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

// 注意：success 和 error 方法已被移除，因为它们当前未被使用
// 如果将来需要这些方法，可以随时恢复

#[derive(Debug, Serialize)]
pub struct IdResponse {
    pub id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}