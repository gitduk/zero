use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

// 数据库中的帖子结构
#[derive(Debug, Serialize, FromRow)]
pub struct Post {
    pub id: Uuid,
    pub content: String,
    #[serde(with = "time::serde::iso8601")]
    pub created_at: OffsetDateTime,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

// 创建新帖子的请求结构
#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
}

// 帖子列表响应结构
#[derive(Debug, Serialize)]
pub struct PostListResponse {
    pub posts: Vec<PostSummary>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

// 帖子摘要结构（用于列表）
#[derive(Debug, Serialize)]
pub struct PostSummary {
    pub id: Uuid,
    pub content: String,
    #[serde(with = "time::serde::iso8601")]
    pub created_at: OffsetDateTime,
    pub comments_count: i64,
}