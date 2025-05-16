use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::utils::sanitize::sanitize_content;

// 数据库中的帖子结构
#[derive(Debug, FromRow)]
pub struct Post {
    pub id: Uuid,
    pub content: String,
    pub created_at: OffsetDateTime,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    #[sqlx(default)]
    pub comments_count: i64,
}

// 为Post实现自定义序列化，确保content字段经过安全处理
impl Serialize for Post {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        
        // Format the datetime as ISO string
        let created_at_str = self.created_at.format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| String::from(""));
            
        let mut state = serializer.serialize_struct("Post", 6)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("content", &sanitize_content(&self.content))?;
        state.serialize_field("created_at", &created_at_str)?;
        state.serialize_field("ip_address", &self.ip_address)?;
        state.serialize_field("user_agent", &self.user_agent)?;
        state.serialize_field("comments_count", &self.comments_count)?;
        state.end()
    }
}

// 创建新帖子的请求结构
#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    #[serde(deserialize_with = "deserialize_and_validate_content")]
    pub content: String,
}

// 验证帖子内容的自定义反序列化函数
fn deserialize_and_validate_content<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let content: String = String::deserialize(deserializer)?;
    
    // 验证帖子不为空
    if content.trim().is_empty() {
        return Err(serde::de::Error::custom("Post content cannot be empty"));
    }
    
    // 验证帖子长度
    if content.len() > 5000 {
        return Err(serde::de::Error::custom("Post content is too long (max 5000 characters)"));
    }
    
    Ok(content)
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
#[derive(Debug)]
pub struct PostSummary {
    pub id: Uuid,
    pub content: String,
    pub created_at: OffsetDateTime,
    pub comments_count: i64,
}

// 为PostSummary实现自定义序列化，确保content字段经过安全处理
impl Serialize for PostSummary {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        
        // Format the datetime as ISO string
        let created_at_str = self.created_at.format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| String::from(""));
            
        let mut state = serializer.serialize_struct("PostSummary", 4)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("content", &sanitize_content(&self.content))?;
        state.serialize_field("created_at", &created_at_str)?;
        state.serialize_field("comments_count", &self.comments_count)?;
        state.end()
    }
}