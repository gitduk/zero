use axum::{
    extract::{Extension, Path, Query},
    http::{HeaderMap, StatusCode},
    Json,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use time;

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
    let total = match sqlx::query("SELECT COUNT(*) FROM posts")
        .fetch_one(&pool)
        .await
    {
        Ok(row) => {
            match row.try_get::<i64, _>(0) {
                Ok(count) => count,
                Err(e) => {
                    tracing::error!("Error parsing post count: {}", e);
                    0
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to count posts: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to count posts: {}", e),
            ));
        }
    };

    // 手动获取帖子列表并构建结果，避免宏生成
    let rows = match sqlx::query(
        r#"
        SELECT 
            id, 
            content, 
            created_at, 
            COALESCE(comments_count, 0) as comments_count
        FROM 
            posts
        ORDER BY 
            created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(page_size as i64)
    .bind(offset as i64)
    .fetch_all(&pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to fetch posts: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch posts: {}", e),
            ));
        }
    };

    // 手动构建 PostSummary 结构体
    let mut posts = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = match row.try_get("id") {
            Ok(val) => val,
            Err(e) => {
                tracing::error!("Error parsing post id: {}", e);
                continue; // 跳过无效的行
            }
        };

        let content: String = match row.try_get("content") {
            Ok(val) => val,
            Err(e) => {
                tracing::error!("Error parsing post content for id {}: {}", id, e);
                continue;
            }
        };

        let created_at: time::OffsetDateTime = match row.try_get("created_at") {
            Ok(val) => val,
            Err(e) => {
                tracing::error!("Error parsing post created_at for id {}: {}", id, e);
                continue;
            }
        };

        let comments_count: i32 = match row.try_get("comments_count") {
            Ok(val) => val,
            Err(e) => {
                tracing::error!("Error parsing post comments_count for id {}: {}", id, e);
                0 // 默认为0
            }
        };
        
        // 转换为i64类型
        let comments_count: i64 = comments_count as i64;

        posts.push(PostSummary {
            id,
            content,
            created_at,
            comments_count,
        });
    }

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

    // 创建新帖子 - 手动处理查询结果
    let row = match sqlx::query(
        r#"
        INSERT INTO posts (content, ip_address, user_agent, comments_count)
        VALUES ($1, $2, $3, 0)
        RETURNING id, content, created_at, ip_address, user_agent
        "#
    )
    .bind(sanitized_content)
    .bind(ip_address.clone())
    .bind(user_agent.clone())
    .fetch_one(&pool)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("Failed to create post: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create post: {}", e),
            ));
        }
    };

    // 手动构建 Post 结构体
    let id: Uuid = match row.try_get("id") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing new post id: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new post: {}", e),
            ));
        }
    };

    let content: String = match row.try_get("content") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing new post content: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new post: {}", e),
            ));
        }
    };

    let created_at: time::OffsetDateTime = match row.try_get("created_at") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing new post created_at: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new post: {}", e),
            ));
        }
    };

    let post = Post {
        id,
        content,
        created_at,
        ip_address,
        user_agent,
    };

    Ok(Json(post))
}

// 获取单个帖子
pub async fn get_post(
    Extension(pool): Extension<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Post>, (StatusCode, String)> {
    // 获取单个帖子 - 手动处理查询结果
    let row = match sqlx::query(
        r#"
        SELECT 
            id, 
            content, 
            created_at, 
            ip_address, 
            user_agent
        FROM posts
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
        }
        Err(e) => {
            tracing::error!("Failed to fetch post: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch post: {}", e),
            ));
        }
    };

    // 手动构建 Post 结构体
    let post_id: Uuid = match row.try_get("id") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing post id: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse post: {}", e),
            ));
        }
    };

    let content: String = match row.try_get("content") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing post content: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse post: {}", e),
            ));
        }
    };

    let created_at: time::OffsetDateTime = match row.try_get("created_at") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing post created_at: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse post: {}", e),
            ));
        }
    };

    let ip_address: Option<String> = match row.try_get("ip_address") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing post ip_address: {}", e);
            None
        }
    };

    let user_agent: Option<String> = match row.try_get("user_agent") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("Error parsing post user_agent: {}", e);
            None
        }
    };

    let post = Post {
        id: post_id,
        content,
        created_at,
        ip_address,
        user_agent,
    };

    Ok(Json(post))
}

