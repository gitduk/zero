use time::OffsetDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// 数据库中的评论结构
#[derive(Debug, Serialize, FromRow)]
pub struct Comment {
    pub id: Uuid,
    pub post_id: Uuid,
    pub content: String,
    #[serde(with = "time::serde::iso8601")]
    pub created_at: OffsetDateTime,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

// 创建新评论的请求结构
#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub content: String,
}

// 评论列表响应结构
#[derive(Debug, Serialize)]
pub struct CommentListResponse {
    pub comments: Vec<Comment>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}