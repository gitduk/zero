use axum::{
    extract::{Extension, Path, Query},
    http::{HeaderMap, StatusCode},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::comment::{Comment, CommentListResponse, CreateCommentRequest};
use crate::utils::pagination::PaginationParams;
use crate::utils::sanitize::sanitize_content;

// 获取帖子下的评论列表
pub async fn get_comments(
    Extension(pool): Extension<PgPool>,
    Path(post_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<CommentListResponse>, (StatusCode, String)> {
    let page = pagination.page.unwrap_or(1);
    let page_size = pagination.per_page.unwrap_or(20);
    let offset = (page - 1) * page_size;

    // 检查帖子是否存在
    let post_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM posts WHERE id = $1)",
        post_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to check post existence: {}", e),
        )
    })?
    .unwrap_or(false);

    if !post_exists {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    // 获取评论总数
    let total = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM comments WHERE post_id = $1",
        post_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to count comments: {}", e),
        )
    })?
    .unwrap_or(0);

    // 获取评论列表
    let comments = sqlx::query_as!(
        Comment,
        r#"
        SELECT id, post_id, content, created_at, ip_address, user_agent
        FROM comments
        WHERE post_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
        "#,
        post_id,
        page_size as i64,
        offset as i64
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch comments: {}", e),
        )
    })?;

    Ok(Json(CommentListResponse {
        comments,
        total,
        page,
        page_size,
    }))
}

// 创建新评论
pub async fn create_comment(
    Extension(pool): Extension<PgPool>,
    Path(post_id): Path<Uuid>,
    headers: HeaderMap,
    Json(request): Json<CreateCommentRequest>,
) -> Result<Json<Comment>, (StatusCode, String)> {
    // 检查帖子是否存在
    let post_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM posts WHERE id = $1)",
        post_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to check post existence: {}", e),
        )
    })?
    .unwrap_or(false);

    if !post_exists {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    // 获取客户端信息
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .map(ToString::to_string);

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string);

    // 转义内容以便安全显示，但保留原始格式
    let sanitized_content = sanitize_content(&request.content);
    
    // 创建新评论
    let comment = sqlx::query_as!(
        Comment,
        r#"
        INSERT INTO comments (post_id, content, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
        RETURNING id, post_id, content, created_at, ip_address, user_agent
        "#,
        post_id,
        sanitized_content,
        ip_address,
        user_agent
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create comment: {}", e),
        )
    })?;

    Ok(Json(comment))
}