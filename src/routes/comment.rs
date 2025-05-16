use axum::{
    extract::{Extension, Path, Query},
    http::{HeaderMap, StatusCode},
    Json,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use time;

use crate::models::comment::{Comment, CommentListResponse, CreateCommentRequest};
use crate::utils::filter::filter_sensitive_words;
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
        tracing::error!("数据库错误: {}", e);
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
    let total = match sqlx::query("SELECT COUNT(*) FROM comments WHERE post_id = $1")
        .bind(post_id)
        .fetch_one(&pool)
        .await
    {
        Ok(row) => {
            match row.try_get::<i64, _>(0) {
                Ok(count) => count,
                Err(e) => {
                    tracing::error!("解析评论数量失败: {}", e);
                    0
                }
            }
        }
        Err(e) => {
            tracing::error!("查询评论数量失败: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to count comments: {}", e),
            ));
        }
    };

    // 获取评论列表，手动处理查询结果
    let rows = match sqlx::query(
        r#"
        SELECT 
            id, 
            post_id, 
            content, 
            created_at, 
            ip_address, 
            user_agent
        FROM comments
        WHERE post_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(post_id)
    .bind(page_size as i64)
    .bind(offset as i64)
    .fetch_all(&pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to fetch comments: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch comments: {}", e),
            ));
        }
    };

    // 手动构建 Comment 结构体
    let mut comments = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = match row.try_get("id") {
            Ok(val) => val,
            Err(_) => continue, // 跳过无效的行
        };

        let post_id: Uuid = match row.try_get("post_id") {
            Ok(val) => val,
            Err(_) => continue,
        };

        let content: String = match row.try_get("content") {
            Ok(val) => val,
            Err(_) => continue,
        };

        let created_at: time::OffsetDateTime = match row.try_get("created_at") {
            Ok(val) => val,
            Err(_) => continue,
        };

        let ip_address: Option<String> = match row.try_get("ip_address") {
            Ok(val) => val,
            Err(_) => None,
        };

        let user_agent: Option<String> = match row.try_get("user_agent") {
            Ok(val) => val,
            Err(_) => None,
        };

        // 确保输出到前端的内容也经过了安全处理
        let comment = Comment {
            id,
            post_id,
            content,
            created_at,
            ip_address,
            user_agent,
        };
        comments.push(comment);
    }

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
        tracing::error!("数据库错误: {}", e);
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

    // 内容验证已在 model 的反序列化时完成

    // 处理内容
    let filtered_content = filter_sensitive_words(&request.content);
    let sanitized_content = sanitize_content(&filtered_content);

    // 创建新评论 - 手动处理查询结果
    let row = match sqlx::query(
        r#"
        INSERT INTO comments (post_id, content, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
        RETURNING 
            id, 
            post_id, 
            content, 
            created_at, 
            ip_address, 
            user_agent
        "#
    )
    .bind(post_id)
    .bind(sanitized_content)
    .bind(ip_address)
    .bind(user_agent)
    .fetch_one(&pool)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("Failed to create comment: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create comment: {}", e),
            ));
        }
    };

    // 手动构建 Comment 结构体
    let id: Uuid = match row.try_get("id") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("解析新评论ID失败: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new comment: {}", e),
            ));
        }
    };

    let comment_post_id: Uuid = match row.try_get("post_id") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("解析新评论帖子ID失败: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new comment: {}", e),
            ));
        }
    };

    let content: String = match row.try_get("content") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("解析新评论内容失败: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new comment: {}", e),
            ));
        }
    };

    let created_at: time::OffsetDateTime = match row.try_get("created_at") {
        Ok(val) => val,
        Err(e) => {
            tracing::error!("解析新评论时间失败: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse new comment: {}", e),
            ));
        }
    };

    let ip_address: Option<String> = match row.try_get("ip_address") {
        Ok(val) => val,
        Err(_) => None,
    };

    let user_agent: Option<String> = match row.try_get("user_agent") {
        Ok(val) => val,
        Err(_) => None,
    };

    let comment = Comment {
        id,
        post_id: comment_post_id,
        content,  // 内容已在插入数据库前被净化
        created_at,
        ip_address,
        user_agent,
    };

    Ok(Json(comment))
}

