use axum::{
    extract::{Extension, Path, Query},
    http::{HeaderMap, StatusCode},
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::post::{CreatePostRequest, Post, PostListResponse, PostSummary};
use crate::utils::filter::filter_sensitive_words;
use crate::utils::pagination::PaginationParams;
use crate::utils::sanitize::sanitize_content;

// 获取帖子列表
pub async fn get_posts(
    Extension(pool): Extension<PgPool>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<PostListResponse>, (StatusCode, String)> {
    let page = pagination.page.unwrap_or(1);
    let page_size = pagination.per_page.unwrap_or(20);
    let offset = (page - 1) * page_size;

    // 获取帖子总数
    let total = sqlx::query_scalar!("SELECT COUNT(*) FROM posts")
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to count posts: {}", e),
            )
        })?
        .unwrap_or(0);

    // 获取帖子列表，包括评论数
    let posts = sqlx::query_as!(
        PostSummary,
        r#"
        SELECT 
            p.id,
            p.content,
            p.created_at,
            COUNT(c.id) AS "comments_count!: i64"
        FROM 
            posts p
        LEFT JOIN 
            comments c ON p.id = c.post_id
        GROUP BY 
            p.id
        ORDER BY 
            p.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        page_size as i64,
        offset as i64
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch posts: {}", e),
        )
    })?;

    Ok(Json(PostListResponse {
        posts,
        total,
        page,
        page_size,
    }))
}

// 创建新帖子
pub async fn create_post(
    Extension(pool): Extension<PgPool>,
    headers: HeaderMap,
    Json(request): Json<CreatePostRequest>,
) -> Result<Json<Post>, (StatusCode, String)> {
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

    // 首先过滤敏感词
    let filtered_content = filter_sensitive_words(&request.content);

    // 转义内容以便安全显示，但保留原始格式
    let sanitized_content = sanitize_content(&filtered_content);

    // 创建新帖子
    let post = sqlx::query_as!(
        Post,
        r#"
        INSERT INTO posts (content, ip_address, user_agent)
        VALUES ($1, $2, $3)
        RETURNING id, content, created_at, ip_address, user_agent
        "#,
        sanitized_content,
        ip_address,
        user_agent
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create post: {}", e),
        )
    })?;

    Ok(Json(post))
}

// 获取单个帖子
pub async fn get_post(
    Extension(pool): Extension<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Post>, (StatusCode, String)> {
    let post = sqlx::query_as!(
        Post,
        r#"
        SELECT id, content, created_at, ip_address, user_agent
        FROM posts
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch post: {}", e),
        )
    })?;

    match post {
        Some(post) => Ok(Json(post)),
        None => Err((StatusCode::NOT_FOUND, "Post not found".to_string())),
    }
}

